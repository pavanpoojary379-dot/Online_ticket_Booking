import sys
import os
from datetime import datetime, timedelta

from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models import User, Movie, Theatre, Screen, Show, Seat, SeatLock, Booking, BookingSeat
from app.utils.auth import create_access_token, get_password_hash

client = TestClient(app)
db = SessionLocal()

print("Testing Lock Verification & Pending Booking Deduplication...")

# 1. Fetch or create a test user
test_user = db.query(User).filter(User.email == "customer@cinebook.com").first()
if not test_user:
    test_user = User(
        full_name="Test Customer",
        email="customer@cinebook.com",
        hashed_password=get_password_hash("password123"),
        is_admin=False
    )
    db.add(test_user)
    db.commit()
    db.refresh(test_user)

token = create_access_token({"sub": str(test_user.id)})
auth_headers = {"Authorization": f"Bearer {token}"}

# 2. Get an upcoming show and seats
show = db.query(Show).first()
assert show is not None, "Show should exist"
# Find 2 seats for this show that are NOT confirmed booked
booked_seat_ids = [
    bs.seat_id for bs in db.query(BookingSeat).join(Booking).filter(
        Booking.show_id == show.id,
        Booking.status == "CONFIRMED"
    ).all()
]
seats = db.query(Seat).filter(
    Seat.screen_id == show.screen_id,
    ~Seat.id.in_(booked_seat_ids) if booked_seat_ids else True
).limit(2).all()
assert len(seats) == 2, "Should have at least 2 available seats"
seat_ids = [s.id for s in seats]

# Release existing locks for test isolation
db.query(SeatLock).filter(SeatLock.show_id == show.id, SeatLock.seat_id.in_(seat_ids)).delete()
db.commit()

# Test 1: Verify lock when seats are NOT locked
res = client.post("/api/bookings/verify-lock", json={"show_id": show.id, "seat_ids": seat_ids}, headers=auth_headers)
assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
data = res.json()
assert data["is_locked_by_user"] is False, "Seats should not be locked initially"
print("✓ Test 1: verify-lock returns False when seats not held")

# Test 2: Hold seats and verify lock returns True
hold_res = client.post("/api/bookings/hold-seats", json={"show_id": show.id, "seat_ids": seat_ids}, headers=auth_headers)
assert hold_res.status_code == 200, f"Hold failed: {hold_res.text}"

res2 = client.post("/api/bookings/verify-lock", json={"show_id": show.id, "seat_ids": seat_ids}, headers=auth_headers)
assert res2.status_code == 200
data2 = res2.json()
assert data2["is_locked_by_user"] is True, "Seats should be reported as locked by user"
assert data2["expires_at"] is not None
print("✓ Test 2: verify-lock returns True and valid expires_at when held")

# Test 3: Deduplication of PENDING bookings
pending1 = client.post("/api/bookings/create-pending", json={"show_id": show.id, "seat_ids": seat_ids}, headers=auth_headers)
assert pending1.status_code == 200, f"Pending booking 1 failed: {pending1.text}"
p1_data = pending1.json()

pending2 = client.post("/api/bookings/create-pending", json={"show_id": show.id, "seat_ids": seat_ids}, headers=auth_headers)
assert pending2.status_code == 200, f"Pending booking 2 failed: {pending2.text}"
p2_data = pending2.json()

# ID should be the same, deduplicated!
assert p1_data["id"] == p2_data["id"], f"Expected deduplicated booking ID, got {p1_data['id']} and {p2_data['id']}"
print("✓ Test 3: create_pending_booking successfully deduplicates without duplicate records")

# Clean up
client.post("/api/bookings/release-seats", json={"show_id": show.id, "seat_ids": seat_ids}, headers=auth_headers)
print("==================================================")
print("ALL LOCK VERIFICATION TESTS PASSED 100%!")
print("==================================================")
