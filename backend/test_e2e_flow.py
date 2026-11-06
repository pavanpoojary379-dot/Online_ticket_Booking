import os
import sys
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_full_e2e_booking_lifecycle():
    print("--- 1. Testing Health & Home Endpoints ---")
    res = client.get("/")
    assert res.status_code == 200
    print("✓ Health root response:", res.json())

    print("\n--- 2. User Authentication ---")
    login_res = client.post("/api/auth/login", json={
        "email": "user@cinebook.com",
        "password": "User@123"
    })
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    token = login_res.json()["access_token"]
    user = login_res.json()["user"]
    print(f"✓ Logged in as: {user['full_name']} ({user['email']})")

    auth_headers = {"Authorization": f"Bearer {token}"}

    print("\n--- 3. Fetching Movies & Shows ---")
    movies_res = client.get("/api/movies")
    assert movies_res.status_code == 200
    movies = movies_res.json()
    movie = movies[0]
    print(f"✓ Selected Movie: '{movie['title']}' (ID: {movie['id']}, Rating: {movie['rating']})")

    shows_res = client.get(f"/api/shows?movie_id={movie['id']}")
    assert shows_res.status_code == 200
    shows = shows_res.json()
    assert len(shows) > 0, "No shows found"
    show = shows[0]
    print(f"✓ Selected Show: ID {show['id']} at {show['theatre']['name']} ({show['screen_format']})")

    print("\n--- 4. Seat Map & Smart Seat Recommendation ---")
    rec_res = client.post(f"/api/shows/{show['id']}/recommend-seats", json={
        "num_seats": 2,
        "preferred_tier": "GOLD"
    })
    assert rec_res.status_code == 200
    rec = rec_res.json()
    seat_ids = [s["id"] for s in rec["seats"]]
    seat_labels = [f"{s['row_label']}{s['seat_number']}" for s in rec["seats"]]
    print(f"✓ Smart AI Recommendation: {rec['reason']} -> Seats: {seat_labels} (Total: Rs. {rec['total_price']})")

    print("\n--- 5. Temporary Seat Locking (5-minute TTL) ---")
    hold_res = client.post("/api/bookings/hold-seats", json={
        "show_id": show["id"],
        "seat_ids": seat_ids
    }, headers=auth_headers)
    assert hold_res.status_code == 200, f"Hold failed: {hold_res.text}"
    hold_data = hold_res.json()
    print(f"✓ Seats locked successfully! Expires at: {hold_data['expires_at']} (TTL: {hold_data['duration_seconds']}s)")

    # Verify that seat layout reflects 'SELECTED' for current user
    seats_res = client.get(f"/api/shows/{show['id']}/seats", headers=auth_headers)
    assert seats_res.status_code == 200
    layout = seats_res.json()
    locked_seats = [s for s in layout if s["id"] in seat_ids]
    for ls in locked_seats:
        assert ls["status"] == "SELECTED", f"Expected SELECTED, got {ls['status']}"
    print(f"✓ Seat status verified dynamically as 'SELECTED' for current user.")

    print("\n--- 6. Coupon Code Validation ---")
    coupon_res = client.post("/api/coupons/validate", json={
        "code": "CINE20",
        "amount": rec["total_price"]
    })
    assert coupon_res.status_code == 200
    coupon_data = coupon_res.json()
    print(f"✓ Coupon Applied: {coupon_data['message']} (Discount: Rs. {coupon_data['discount_amount']})")

    print("\n--- 7. Create Pending Booking ---")
    create_res = client.post("/api/bookings/create-pending", json={
        "show_id": show["id"],
        "seat_ids": seat_ids,
        "coupon_code": "CINE20"
    }, headers=auth_headers)
    assert create_res.status_code == 200, f"Create pending failed: {create_res.text}"
    booking = create_res.json()
    print(f"✓ Pending Booking Created! Code: {booking['booking_code']} (Final Payable: Rs. {booking['final_amount']})")

    print("\n--- 8. Simulated Payment Processing ---")
    pay_res = client.post("/api/payments/process", json={
        "booking_id": booking["id"],
        "payment_method": "UPI",
        "simulate_status": "SUCCESS"
    }, headers=auth_headers)
    assert pay_res.status_code == 200, f"Payment failed: {pay_res.text}"
    pay_data = pay_res.json()
    assert pay_data["success"] is True
    print(f"✓ Payment Confirmed! Txn ID: {pay_data['transaction_id']}")
    print(f"✓ QR Code Path Generated: {pay_data['qr_code_url']}")
    print(f"✓ PDF Ticket Generated: {pay_data['pdf_ticket_url']}")

    print("\n--- 9. Downloadable PDF Ticket Verification ---")
    ticket_pdf_res = client.get(f"/api/tickets/{booking['id']}/download")
    assert ticket_pdf_res.status_code == 200
    assert ticket_pdf_res.headers["content-type"] == "application/pdf"
    assert len(ticket_pdf_res.content) > 1000
    print(f"✓ Official PDF Ticket downloaded successfully! Size: {len(ticket_pdf_res.content)} bytes")

    print("\n--- 10. User 'My Bookings' Verification ---")
    my_bookings_res = client.get("/api/bookings/my-bookings", headers=auth_headers)
    assert my_bookings_res.status_code == 200
    my_bookings = my_bookings_res.json()
    found = any(b["id"] == booking["id"] for b in my_bookings)
    assert found, "Created booking not found in my-bookings"
    print(f"✓ Booking confirmed in customer's My Bookings! Total customer bookings: {len(my_bookings)}")

    print("\n--- 11. Admin Dashboard Analytics Verification ---")
    admin_login = client.post("/api/auth/login", json={
        "email": "admin@cinebook.com",
        "password": "Admin@123"
    }).json()
    admin_headers = {"Authorization": f"Bearer {admin_login['access_token']}"}

    dash_res = client.get("/api/admin/dashboard", headers=admin_headers)
    assert dash_res.status_code == 200
    dash = dash_res.json()
    print(f"✓ Admin Dashboard Metrics:")
    print(f"    Total Confirmed Revenue: Rs. {dash['total_revenue']}")
    print(f"    Total Bookings Count:    {dash['total_bookings']}")
    print(f"    Seat Occupancy Rate:     {dash['occupancy_rate']}%")
    print(f"    Revenue by Top Movies:   {[m['movie_title'] + ': Rs.' + str(m['revenue']) for m in dash['revenue_by_movie'][:2]]}")

    print("\n=======================================================")
    print("🎉 ALL 11 END-TO-END WORKFLOWS PASSED WITH 100% SUCCESS!")
    print("=======================================================")

if __name__ == "__main__":
    test_full_e2e_booking_lifecycle()

