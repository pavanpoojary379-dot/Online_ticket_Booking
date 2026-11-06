import sys
import os
import uuid
from datetime import datetime, timedelta

from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models import User, Movie, Theatre, Screen, Show, Seat, SeatLock, Booking, BookingSeat, Payment
from app.utils.auth import create_access_token

client = TestClient(app)
db = SessionLocal()

print("=================================================================")
print("RUNNING CINEBOOK BOOKING STATUS & SEAT HOLD EXPIRATION TEST SUITE")
print("=================================================================")

# 1. Fetch or create test customer
customer = db.query(User).filter(User.email == "flow_tester@cinebook.com").first()
if not customer:
    from app.utils.auth import get_password_hash
    customer = User(
        full_name="Flow Tester",
        email="flow_tester@cinebook.com",
        hashed_password=get_password_hash("password123"),
        is_admin=False
    )
    db.add(customer)
    db.commit()
    db.refresh(customer)

token = create_access_token({"sub": str(customer.id)})
headers = {"Authorization": f"Bearer {token}"}

# 2. Pick a show with available seats
show = db.query(Show).first()
assert show is not None, "Show must exist"

# Helper to find N available seats for the show
def get_available_seats(count=2):
    booked_seat_ids = [
        bs.seat_id for bs in db.query(BookingSeat).join(Booking).filter(
            Booking.show_id == show.id,
            Booking.status == "CONFIRMED"
        ).all()
    ]
    locked_seat_ids = [
        sl.seat_id for sl in db.query(SeatLock).filter(
            SeatLock.show_id == show.id,
            SeatLock.expires_at > datetime.utcnow()
        ).all()
    ]
    unavailable = set(booked_seat_ids + locked_seat_ids)
    seats = db.query(Seat).filter(
        Seat.screen_id == show.screen_id,
        ~Seat.id.in_(unavailable) if unavailable else True
    ).limit(count).all()
    assert len(seats) == count, f"Need {count} available seats"
    return seats

# =====================================================================
# Scenario 1: Successful payment within 5 minutes -> Confirmed Booking
# =====================================================================
print("\n--- Scenario 1: Successful payment within 5 minutes ---")
seats_1 = get_available_seats(2)
s1_ids = [s.id for s in seats_1]

# 1a. Hold seats
hold_res = client.post("/api/bookings/hold-seats", json={"show_id": show.id, "seat_ids": s1_ids}, headers=headers)
assert hold_res.status_code == 200, f"Hold failed: {hold_res.text}"
hold_data = hold_res.json()
assert hold_data["expires_at"].endswith("Z"), f"Expires at should be UTC ISO ending in Z, got {hold_data['expires_at']}"

# 1b. Create pending booking
pending_res = client.post("/api/bookings/create-pending", json={"show_id": show.id, "seat_ids": s1_ids}, headers=headers)
assert pending_res.status_code == 200, f"Pending failed: {pending_res.text}"
b1 = pending_res.json()
assert b1["status"] == "PENDING"
assert b1["booking_code"].startswith("CB-")

# 1c. Process successful payment
pay_res = client.post("/api/payments/process", json={
    "booking_id": b1["id"],
    "payment_method": "UPI",
    "simulate_status": "SUCCESS"
}, headers=headers)
assert pay_res.status_code == 200, f"Pay failed: {pay_res.text}"
p1 = pay_res.json()
assert p1["success"] is True
assert p1["status"] == "CONFIRMED"
assert p1["qr_code_url"] is not None

# 1d. Verify in DB: booking is CONFIRMED, seat locks deleted
db_b1 = db.query(Booking).filter(Booking.id == b1["id"]).first()
assert db_b1.status == "CONFIRMED"
locks_left = db.query(SeatLock).filter(SeatLock.show_id == show.id, SeatLock.seat_id.in_(s1_ids)).count()
assert locks_left == 0, "Temporary locks should be removed upon confirmation"
print("✓ Scenario 1 Passed: Payment succeeded, booking CONFIRMED, QR generated, locks converted")

# =====================================================================
# Scenario 2: Failed payment -> Booking CANCELLED, locks released
# =====================================================================
print("\n--- Scenario 2: Failed payment ---")
seats_2 = get_available_seats(2)
s2_ids = [s.id for s in seats_2]

client.post("/api/bookings/hold-seats", json={"show_id": show.id, "seat_ids": s2_ids}, headers=headers)
p_res2 = client.post("/api/bookings/create-pending", json={"show_id": show.id, "seat_ids": s2_ids}, headers=headers)
b2 = p_res2.json()

pay_fail_res = client.post("/api/payments/process", json={
    "booking_id": b2["id"],
    "payment_method": "CREDIT_CARD",
    "simulate_status": "FAILED",
    "failure_reason": "Card declined by issuing bank (Simulated Test Scenario)"
}, headers=headers)
assert pay_fail_res.status_code == 200
pf = pay_fail_res.json()
assert pf["success"] is False
assert pf["status"] == "FAILED"
assert "declined" in pf["message"].lower()

# Verify booking is not confirmed and locks are released
db_b2 = db.query(Booking).filter(Booking.id == b2["id"]).first()
assert db_b2.status == "CANCELLED"
s2_locks = db.query(SeatLock).filter(SeatLock.show_id == show.id, SeatLock.seat_id.in_(s2_ids)).count()
assert s2_locks == 0, "Seat locks must be released on failure so others can book"
print("✓ Scenario 2 Passed: Failed payment rejected confirmation, status set to CANCELLED, locks released")

# =====================================================================
# Scenario 3: Expired seat hold -> verify-lock returns False
# =====================================================================
print("\n--- Scenario 3: Expired seat hold ---")
seats_3 = get_available_seats(2)
s3_ids = [s.id for s in seats_3]

# Create an artificially expired seat lock in DB
past_time = datetime.utcnow() - timedelta(minutes=10)
for sid in s3_ids:
    db.query(SeatLock).filter(SeatLock.show_id == show.id, SeatLock.seat_id == sid).delete()
    db.add(SeatLock(
        show_id=show.id,
        seat_id=sid,
        user_id=customer.id,
        locked_at=past_time - timedelta(minutes=5),
        expires_at=past_time
    ))
db.commit()

verify_res = client.post("/api/bookings/verify-lock", json={"show_id": show.id, "seat_ids": s3_ids}, headers=headers)
assert verify_res.status_code == 200
v_data = verify_res.json()
assert v_data["is_locked_by_user"] is False, "Expired lock should not be considered locked by user"
assert v_data["remaining_seconds"] == 0
print("✓ Scenario 3 Passed: Expired lock correctly identified as expired")

# =====================================================================
# Scenario 4: Successful booking after seat-lock validation
# =====================================================================
print("\n--- Scenario 4: Successful booking after seat-lock validation ---")
# Re-lock seats_3 with fresh valid 5-minute timer
client.post("/api/bookings/hold-seats", json={"show_id": show.id, "seat_ids": s3_ids}, headers=headers)
v_valid = client.post("/api/bookings/verify-lock", json={"show_id": show.id, "seat_ids": s3_ids}, headers=headers).json()
assert v_valid["is_locked_by_user"] is True
assert v_valid["remaining_seconds"] > 280

p_valid = client.post("/api/bookings/create-pending", json={"show_id": show.id, "seat_ids": s3_ids}, headers=headers).json()
pay_valid = client.post("/api/payments/process", json={
    "booking_id": p_valid["id"],
    "payment_method": "DEBIT_CARD",
    "simulate_status": "SUCCESS"
}, headers=headers).json()
assert pay_valid["success"] is True
print("✓ Scenario 4 Passed: Seat-lock verified and converted to confirmed booking")

# =====================================================================
# Scenario 5: Refreshing the confirmation page maintains confirmed status
# =====================================================================
print("\n--- Scenario 5: Refreshing the confirmation page ---")
# Query booking by ID as the confirmation page does on mount/refresh
conf_res = client.get(f"/api/bookings/{b1['id']}", headers=headers)
assert conf_res.status_code == 200
conf_data = conf_res.json()
assert conf_data["status"] == "CONFIRMED"
assert conf_data["booking_code"] == b1["booking_code"]
assert conf_data["qr_code_path"] is not None
assert conf_data["show"]["screen_number"] is not None
print(f"✓ Scenario 5 Passed: Confirmed booking #{b1['id']} persists and returns Screen {conf_data['show']['screen_number']} on refresh")

# =====================================================================
# Scenario 6: Attempting to pay after expiration raises 408
# =====================================================================
print("\n--- Scenario 6: Attempting to pay after expiration ---")
seats_6 = get_available_seats(2)
s6_ids = [s.id for s in seats_6]

client.post("/api/bookings/hold-seats", json={"show_id": show.id, "seat_ids": s6_ids}, headers=headers)
b6 = client.post("/api/bookings/create-pending", json={"show_id": show.id, "seat_ids": s6_ids}, headers=headers).json()

# Artificially expire the locks
db.query(SeatLock).filter(SeatLock.show_id == show.id, SeatLock.seat_id.in_(s6_ids)).update({
    SeatLock.expires_at: datetime.utcnow() - timedelta(seconds=1)
})
db.commit()

# Now attempt payment on the expired booking
pay_exp_res = client.post("/api/payments/process", json={
    "booking_id": b6["id"],
    "payment_method": "UPI",
    "simulate_status": "SUCCESS"
}, headers=headers)
assert pay_exp_res.status_code == 408, f"Expected 408 Timeout, got {pay_exp_res.status_code}: {pay_exp_res.text}"
assert "expired" in pay_exp_res.json()["detail"].lower()
print("✓ Scenario 6 Passed: Payment after lock expiration rejected with HTTP 408 Request Timeout")

# =====================================================================
# Scenario 7: Duplicate payment or booking attempts prevented
# =====================================================================
print("\n--- Scenario 7: Duplicate payment or booking attempts ---")
# 7a. Attempting to pay an already CONFIRMED booking
dup_pay = client.post("/api/payments/process", json={
    "booking_id": b1["id"],
    "payment_method": "UPI",
    "simulate_status": "SUCCESS"
}, headers=headers)
assert dup_pay.status_code == 400
assert "already confirmed" in dup_pay.json()["detail"].lower()

# 7b. Attempting to create pending booking for seats that are now permanently booked by b1
dup_pending = client.post("/api/bookings/create-pending", json={"show_id": show.id, "seat_ids": s1_ids}, headers=headers)
assert dup_pending.status_code == 400
print("✓ Scenario 7 Passed: Duplicate payment and booking attempts rejected with clear HTTP 400")

print("\n=================================================================")
print("ALL 7 BOOKING STATUS & SEAT HOLD FLOW TESTS PASSED 100%!")
print("=================================================================")
