from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
import json
from datetime import datetime

from app.main import app
from app.database import SessionLocal, engine, Base
from app.models.user import User
from app.models.theatre import Theatre
from app.models.screen import Screen
from app.models.seat import Seat
from app.models.show import Show
from app.models.booking import Booking, BookingSeat
from app.utils.auth import create_access_token

client = TestClient(app)

def get_admin_auth_headers():
    db = SessionLocal()
    try:
        admin_user = db.query(User).filter(User.email == "admin@cinebook.com").first()
        if not admin_user:
            admin_user = User(
                email="admin@cinebook.com",
                password_hash="mock_hash",
                full_name="Admin User",
                phone="9999999999",
                is_admin=True,
            )
            db.add(admin_user)
            db.commit()
            db.refresh(admin_user)
        token = create_access_token(data={"sub": str(admin_user.id), "role": "admin"})
        return {"Authorization": f"Bearer {token}"}
    finally:
        db.close()


def test_1_create_theatre_with_demo_flag(admin_auth_headers):
    """Admin can create a demo theatre with description and formats."""
    res = client.post(
        "/api/admin/theatres",
        headers=admin_auth_headers,
        json={
            "name": "Custom Classroom Lab",
            "city": "University Campus",
            "address": "Room 302, Computer Science Block",
            "formats": "2D,SmartClass",
            "is_demo": True,
            "description": "Temporary cinema arrangement for testing indoor navigation.",
        }
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["name"] == "Custom Classroom Lab"
    assert data["is_demo"] is True
    assert "Room 302" in data["address"]


def test_2_create_screen_and_save_custom_layout(admin_auth_headers):
    """Admin can create a screen and save custom rows, seats, and aisles."""
    theatre_res = client.post(
        "/api/admin/theatres",
        headers=admin_auth_headers,
        json={
            "name": "Seminar Hall Cinema",
            "city": "Bangalore",
            "address": "Auditorium Level 2",
            "formats": "2D",
            "is_demo": True,
        }
    )
    theatre_id = theatre_res.json()["id"]

    screen_res = client.post(
        f"/api/admin/theatres/{theatre_id}/screens?screen_number=1&name=Classroom+1&total_seats=20",
        headers=admin_auth_headers,
    )
    assert screen_res.status_code == 200
    screen_id = screen_res.json()["id"]

    # Save a 4 rows x 5 seats layout with aisle after seat 2
    save_res = client.put(
        f"/api/admin/screens/{screen_id}/layout",
        headers=admin_auth_headers,
        json={
            "screen_name": "Classroom 1 - Configured",
            "layout": {
                "rows": ["A", "B", "C", "D"],
                "seats_per_row": 5,
                "aisle_after_seat": 2,
                "side_aisles": True,
                "screen_position": "FRONT",
                "entrance_position": "BACK_CENTER",
            }
        }
    )
    assert save_res.status_code == 200, save_res.text
    data = save_res.json()
    assert data["total_seats"] == 20
    assert data["layout_config"]["aisle_after_seat"] == 2
    assert len(data["layout_config"]["custom_seats"]) == 20


def test_3_validation_duplicate_rows_and_invalid_aisle(admin_auth_headers):
    """Validation prevents duplicate row labels or invalid aisle splits."""
    theatre_res = client.post(
        "/api/admin/theatres",
        headers=admin_auth_headers,
        json={
            "name": "Validation Test Hall",
            "city": "Mumbai",
            "address": "Block A",
        }
    )
    theatre_id = theatre_res.json()["id"]
    screen_res = client.post(
        f"/api/admin/theatres/{theatre_id}/screens?screen_number=1&name=Screen+V",
        headers=admin_auth_headers,
    )
    screen_id = screen_res.json()["id"]

    # Duplicate row labels
    dup_res = client.put(
        f"/api/admin/screens/{screen_id}/layout",
        headers=admin_auth_headers,
        json={
            "layout": {
                "rows": ["A", "B", "A"],
                "seats_per_row": 4,
                "aisle_after_seat": 2,
            }
        }
    )
    assert dup_res.status_code == 400
    assert "Duplicate row labels" in dup_res.json()["detail"]

    # Invalid aisle split
    invalid_aisle = client.put(
        f"/api/admin/screens/{screen_id}/layout",
        headers=admin_auth_headers,
        json={
            "layout": {
                "rows": ["A", "B"],
                "seats_per_row": 4,
                "aisle_after_seat": 8,  # > seats_per_row
            }
        }
    )
    assert invalid_aisle.status_code == 400
    assert "Aisle split must be between" in invalid_aisle.json()["detail"]


def test_4_college_demo_classroom_one_click_setup(admin_auth_headers):
    """1-click preset creates College Demo Theatre with 5 rows x 6 seats (30 seats)."""
    res = client.post(
        "/api/admin/theatres/demo-classroom",
        headers=admin_auth_headers,
        json={
            "theatre_name": "College Demo Theatre",
            "city": "Campus Auditorium",
            "address": "Seminar Hall 101 - Temporary Cinema Setup",
            "description": "Physical classroom arrangement for indoor seat navigation demonstration.",
            "screen_name": "Screen 1",
            "num_rows": 5,
            "seats_per_row": 6,
            "aisle_after_seat": 3,
        }
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["theatre_name"] == "College Demo Theatre"
    assert data["is_demo"] is True
    assert data["total_seats"] == 30
    assert data["screen_name"] == "Screen 1"

    # Verify blueprint generation reflects the classroom layout
    screen_id = data["screen_id"]
    map_res = client.get(f"/api/navigation/screen/{screen_id}/map", headers=admin_auth_headers)
    assert map_res.status_code == 200, map_res.text
    blueprint = map_res.json()
    assert len(blueprint["seats"]) == 30
    assert blueprint["rows"] == ["A", "B", "C", "D", "E"]

    # Verify central aisle between seat 3 and 4
    # Seats 1-3 should be on the left (x < 45.0), Seats 4-6 on the right (x > 55.0)
    row_c_seats = [s for s in blueprint["seats"] if s["row_label"] == "C"]
    assert len(row_c_seats) == 6
    s1, s2, s3, s4, s5, s6 = sorted(row_c_seats, key=lambda s: s["seat_number"])
    assert s1["x"] < s2["x"] < s3["x"] < 45.0
    assert 55.0 < s4["x"] < s5["x"] < s6["x"]


def test_5_classroom_navigation_flow_to_seat_c4(admin_auth_headers):
    """
    Simulates booking Row C Seat 4 in the College Demo Theatre,
    verifying A* pathfinding routes along central aisle to Seat C4,
    and row detection triggers properly.
    """
    db = SessionLocal()
    try:
        theatre = db.query(Theatre).filter(Theatre.name == "College Demo Theatre").first()
        assert theatre is not None
        screen = db.query(Screen).filter(Screen.theatre_id == theatre.id, Screen.name == "Screen 1").first()
        assert screen is not None
        seat_c4 = db.query(Seat).filter(Seat.screen_id == screen.id, Seat.row_label == "C", Seat.seat_number == 4).first()
        assert seat_c4 is not None

        # Retrieve or create a show for this screen
        show = db.query(Show).filter(Show.screen_id == screen.id).first()
        assert show is not None

        # Create confirmed test booking for Seat C4
        test_booking = Booking(
            booking_code=f"DEMO-C4-{int(datetime.utcnow().timestamp())}",
            user_id=1,
            show_id=show.id,
            total_amount=220.0,
            convenience_fee=20.0,
            discount_amount=0.0,
            final_amount=240.0,
            status="CONFIRMED",
        )
        db.add(test_booking)
        db.commit()
        db.refresh(test_booking)

        bs = BookingSeat(booking_id=test_booking.id, seat_id=seat_c4.id, tier="GOLD", price=220.0)
        db.add(bs)
        db.commit()

        booking_id = test_booking.id
        seat_id = seat_c4.id
        screen_id = screen.id
    finally:
        db.close()

    # 1. Start navigation session
    start_res = client.post(
        "/api/navigation/session/start",
        headers=admin_auth_headers,
        json={"booking_id": booking_id, "target_seat_id": seat_id}
    )
    assert start_res.status_code == 200, start_res.text
    session_data = start_res.json()
    session_id = session_data["session_id"]
    assert session_data["target_seat_label"] == "C4"
    assert session_data["navigation_status"] == "ENTERING_AUDITORIUM"

    # Route should route to entry_right_C (since seat 4 > split 3)
    route = session_data["route"]
    assert len(route) >= 3
    # Check that route passes through central aisle (x = 50.0) before turning into Row C
    central_pts = [p for p in route if abs(p["x"] - 50.0) < 0.1]
    assert len(central_pts) >= 1

    # 2. Update location approaching Row C (y = 56.0, x = 50.0)
    update_res = client.patch(
        f"/api/navigation/session/{session_id}/location",
        headers=admin_auth_headers,
        json={"x": 50.0, "y": 56.0, "source": "SIMULATION"}
    )
    assert update_res.status_code == 200, f"Step 2 failed: {update_res.text}"
    up_data = update_res.json()
    assert up_data["is_target_row_active"] is True
    assert up_data["navigation_status"] == "APPROACHING_ROW"

    # 3. Enter Row C seating lane (y = 54.0, x = 52.5)
    update_res2 = client.patch(
        f"/api/navigation/session/{session_id}/location",
        headers=admin_auth_headers,
        json={"x": 52.5, "y": 54.0, "source": "SIMULATION"}
    )
    assert update_res2.status_code == 200, f"Step 3 failed: {update_res2.text}"
    up_data2 = update_res2.json()
    assert up_data2["navigation_status"] == "ENTERED_TARGET_ROW"
    assert "Row C" in up_data2["status_message"]
    assert "Seat 4" in up_data2["status_message"]

    # 4. Reach Seat C4 (x around 58.0, y around 54.0)
    # Get exact C4 coordinates from blueprint
    map_res = client.get(f"/api/navigation/screen/{screen_id}/map", headers=admin_auth_headers)
    c4_coord = next(s for s in map_res.json()["seats"] if s["id"] == seat_id)
    reach_res = client.patch(
        f"/api/navigation/session/{session_id}/location",
        headers=admin_auth_headers,
        json={"x": c4_coord["x"], "y": c4_coord["y"], "source": "SIMULATION"}
    )
    assert reach_res.status_code == 200, f"Step 4 failed: {reach_res.text}"
    reach_data = reach_res.json()
    assert reach_data["is_seat_reached"] is True
    assert reach_data["navigation_status"] == "SEAT_REACHED"
    assert "reached your seat" in reach_data["status_message"].lower()


def test_6_protect_booked_seats_during_layout_edit(admin_auth_headers):
    """Admin cannot delete or remove seat C4 because it has a confirmed booking."""
    db = SessionLocal()
    try:
        theatre = db.query(Theatre).filter(Theatre.name == "College Demo Theatre").first()
        screen = db.query(Screen).filter(Screen.theatre_id == theatre.id, Screen.name == "Screen 1").first()
        screen_id = screen.id
    finally:
        db.close()

    res = client.put(
        f"/api/admin/screens/{screen_id}/layout",
        headers=admin_auth_headers,
        json={
            "layout": {
                "rows": ["A", "B"],
                "seats_per_row": 6,
                "aisle_after_seat": 3,
            }
        }
    )
    assert res.status_code == 400
    assert "Cannot remove seats" in res.json()["detail"]
    assert "C4" in res.json()["detail"]


def run_all_tests():
    db = SessionLocal()
    try:
        admin_user = db.query(User).filter(User.email == "admin@cinebook.com").first()
        if not admin_user:
            admin_user = User(
                email="admin@cinebook.com",
                password_hash="mock_hash",
                full_name="Admin User",
                phone="9999999999",
                is_admin=True,
            )
            db.add(admin_user)
            db.commit()
            db.refresh(admin_user)
        token = create_access_token(data={"sub": str(admin_user.id), "role": "admin"})
        headers = {"Authorization": f"Bearer {token}"}
    finally:
        db.close()

    print("Running Test 1: Create Theatre with Demo Flag & Description...")
    test_1_create_theatre_with_demo_flag(headers)
    print("✓ Test 1 Passed!")

    print("Running Test 2: Create Screen and Save Custom Layout...")
    test_2_create_screen_and_save_custom_layout(headers)
    print("✓ Test 2 Passed!")

    print("Running Test 3: Validation on Duplicate Rows & Invalid Aisle...")
    test_3_validation_duplicate_rows_and_invalid_aisle(headers)
    print("✓ Test 3 Passed!")

    print("Running Test 4: 1-Click College Demo Classroom Preset...")
    test_4_college_demo_classroom_one_click_setup(headers)
    print("✓ Test 4 Passed!")

    print("Running Test 5: Classroom Navigation Flow to Seat C4 (A* + Row Detection + Arrival)...")
    test_5_classroom_navigation_flow_to_seat_c4(headers)
    print("✓ Test 5 Passed!")

    print("Running Test 6: Protect Booked Seats During Layout Edit...")
    test_6_protect_booked_seats_during_layout_edit(headers)
    print("✓ Test 6 Passed!")

    print("==================================================")
    print("ALL THEATRE LAYOUT TESTS PASSED 100%!")
    print("==================================================")


if __name__ == "__main__":
    run_all_tests()

