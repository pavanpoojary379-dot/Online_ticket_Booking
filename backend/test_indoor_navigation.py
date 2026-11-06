from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.database import SessionLocal
from app.models.booking import Booking, BookingSeat
from app.models.show import Show
from app.models.seat import Seat
from app.models.user import User

client = TestClient(app)

def test_navigation_flow():
    db: Session = SessionLocal()
    try:
        # Get users
        user = db.query(User).filter(User.email == "user@cinebook.com").first()
        admin = db.query(User).filter(User.email == "admin@cinebook.com").first()
        assert user is not None and admin is not None

        # Authenticate user
        login_res = client.post("/api/auth/login", json={"email": "user@cinebook.com", "password": "User@123"})
        assert login_res.status_code == 200
        user_token = login_res.json()["access_token"]
        user_headers = {"Authorization": f"Bearer {user_token}"}

        # Authenticate admin
        admin_login = client.post("/api/auth/login", json={"email": "admin@cinebook.com", "password": "Admin@123"})
        assert admin_login.status_code == 200
        admin_token = admin_login.json()["access_token"]
        admin_headers = {"Authorization": f"Bearer {admin_token}"}

        # Get or create a CONFIRMED booking for user
        booking = db.query(Booking).filter(Booking.user_id == user.id, Booking.status == "CONFIRMED").first()
        if not booking:
            show = db.query(Show).first()
            seat_f10 = db.query(Seat).filter(Seat.screen_id == show.screen_id, Seat.row_label == "F", Seat.seat_number == 10).first()
            booking = Booking(
                booking_code="CB-NAVTEST01",
                user_id=user.id,
                show_id=show.id,
                status="CONFIRMED",
                total_amount=420.0,
                convenience_fee=30.0,
                discount_amount=0.0,
                final_amount=450.0,
            )
            db.add(booking)
            db.flush()
            bs = BookingSeat(booking_id=booking.id, seat_id=seat_f10.id, tier="PLATINUM", price=420.0)
            db.add(bs)
            db.commit()

        booking_id = booking.id
        screen_id = booking.show.screen_id

        # ----------------------------------------------------
        # TEST 1: Customer starts navigation for a confirmed booking
        # ----------------------------------------------------
        nav_info_res = client.get(f"/api/navigation/booking/{booking_id}", headers=user_headers)
        assert nav_info_res.status_code == 200, f"Nav info failed: {nav_info_res.text}"
        nav_info = nav_info_res.json()
        assert nav_info["booking_id"] == booking_id
        assert len(nav_info["booked_seats"]) >= 1
        target_seat_id = nav_info["booked_seats"][0]["seat_id"]
        target_seat_label = nav_info["booked_seats"][0]["label"]
        print(f"✓ Test 1 Passed: Navigation booking info retrieved for {target_seat_label} ({booking.booking_code})")

        # ----------------------------------------------------
        # TEST 2: Customer cannot navigate to another user's booking
        # ----------------------------------------------------
        # Admin creates a private booking
        admin_booking = db.query(Booking).filter(Booking.user_id == admin.id, Booking.status == "CONFIRMED").first()
        if not admin_booking:
            show = db.query(Show).first()
            seat_a1 = db.query(Seat).filter(Seat.screen_id == show.screen_id, Seat.row_label == "A", Seat.seat_number == 1).first()
            admin_booking = Booking(
                booking_code="CB-ADMIN001",
                user_id=admin.id,
                show_id=show.id,
                status="CONFIRMED",
                total_amount=180.0,
                convenience_fee=30.0,
                discount_amount=0.0,
                final_amount=210.0,
            )
            db.add(admin_booking)
            db.flush()
            db.add(BookingSeat(booking_id=admin_booking.id, seat_id=seat_a1.id, tier="SILVER", price=180.0))
            db.commit()

        # Regular user tries to access admin's booking
        unauth_res = client.get(f"/api/navigation/booking/{admin_booking.id}", headers=user_headers)
        assert unauth_res.status_code == 403, f"Expected 403, got {unauth_res.status_code}"
        print("✓ Test 2 Passed: Cross-user booking navigation prevented with 403 Forbidden")

        # ----------------------------------------------------
        # TEST 3: Correct theatre and screen blueprint loads
        # ----------------------------------------------------
        map_res = client.get(f"/api/navigation/screen/{screen_id}/map", headers=user_headers)
        assert map_res.status_code == 200, f"Screen map failed: {map_res.text}"
        screen_map = map_res.json()
        assert screen_map["screen_id"] == screen_id
        assert len(screen_map["seats"]) >= 60
        assert len(screen_map["rows"]) >= 6
        assert len(screen_map["aisles"]) >= 3
        assert screen_map["entrance"]["x"] == 50.0
        print(f"✓ Test 3 Passed: Blueprint generated for {screen_map['screen_name']} with {len(screen_map['seats'])} seats")

        # ----------------------------------------------------
        # TEST 4: Start navigation session & location updates
        # ----------------------------------------------------
        start_res = client.post("/api/navigation/session/start", json={
            "booking_id": booking_id,
            "target_seat_id": target_seat_id,
        }, headers=user_headers)
        assert start_res.status_code == 200, f"Start session failed: {start_res.text}"
        session_data = start_res.json()
        session_id = session_data["session_id"]
        assert session_data["navigation_status"] == "ENTERING_AUDITORIUM"
        assert len(session_data["route"]) >= 2
        print(f"✓ Test 4 Passed: Session {session_id} started at ({session_data['current_x']}, {session_data['current_y']})")

        # Target seat coordinates from screen map
        target_seat_coord = next(s for s in screen_map["seats"] if s["id"] == target_seat_id)
        target_x = target_seat_coord["x"]
        target_y = target_seat_coord["y"]
        target_row = target_seat_coord["row_label"]

        # ----------------------------------------------------
        # TEST 5: Target row turns green when approaching it
        # ----------------------------------------------------
        # Move user along central aisle near target row (within approaching threshold: y = target_y + 4.0)
        approach_res = client.patch(f"/api/navigation/session/{session_id}/location", json={
            "x": 50.0,
            "y": target_y + 4.0,
        }, headers=user_headers)
        assert approach_res.status_code == 200
        appr_data = approach_res.json()
        assert appr_data["navigation_status"] == "APPROACHING_ROW"
        assert appr_data["is_target_row_active"] == True, "Target row must turn GREEN when approaching!"
        print(f"✓ Test 5 Passed: Approaching Row {target_row} detected -> Target row highlighted GREEN")

        # ----------------------------------------------------
        # TEST 6: Target row notification appears when entering row
        # ----------------------------------------------------
        # Move user inside the target row entry from central aisle (x = 46.0 if left, 54.0 if right)
        lane_x = 54.0 if target_seat_coord["seat_number"] > 5 else 46.0
        enter_row_res = client.patch(f"/api/navigation/session/{session_id}/location", json={
            "x": lane_x,
            "y": target_y,
        }, headers=user_headers)
        assert enter_row_res.status_code == 200
        enter_data = enter_row_res.json()
        assert enter_data["navigation_status"] in ["ENTERED_TARGET_ROW", "APPROACHING_SEAT"]
        assert f"Row {target_row}" in enter_data["status_message"]
        print(f"✓ Test 6 Passed: Entered Row {target_row} detected -> '{enter_data['status_message']}'")

        # ----------------------------------------------------
        # TEST 7 & 8: Seat arrival notification at threshold
        # ----------------------------------------------------
        # Move user right next to the exact seat (within 2 units)
        at_seat_res = client.patch(f"/api/navigation/session/{session_id}/location", json={
            "x": target_x,
            "y": target_y,
        }, headers=user_headers)
        assert at_seat_res.status_code == 200
        seat_reached_data = at_seat_res.json()
        assert seat_reached_data["navigation_status"] == "SEAT_REACHED"
        assert seat_reached_data["is_seat_reached"] == True
        assert "Enjoy your movie" in seat_reached_data["status_message"]
        print(f"✓ Tests 7 & 8 Passed: Arrived at Seat {target_seat_label} -> '{seat_reached_data['status_message']}'")

        # ----------------------------------------------------
        # TEST 9: Complete session
        # ----------------------------------------------------
        finish_res = client.post(f"/api/navigation/session/{session_id}/complete", headers=user_headers)
        assert finish_res.status_code == 200
        assert finish_res.json()["status"] == "COMPLETED"
        print("✓ Test 9 Passed: Session marked as completed")

        # ----------------------------------------------------
        # TEST 10: Missing screen returns 404
        # ----------------------------------------------------
        err_screen = client.get("/api/navigation/screen/99999/map", headers=user_headers)
        assert err_screen.status_code == 404
        print("✓ Test 10 Passed: Non-existent screen correctly returns 404")

    finally:
        db.close()

if __name__ == "__main__":
    print("==================================================")
    print("RUNNING SMART INDOOR SEAT NAVIGATION TEST SUITE")
    print("==================================================")
    test_navigation_flow()
    print("==================================================")
    print("ALL INDOOR NAVIGATION BACKEND TESTS PASSED 100%!")
    print("==================================================")

