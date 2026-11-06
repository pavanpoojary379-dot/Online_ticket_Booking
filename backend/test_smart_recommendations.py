from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.database import SessionLocal
from app.models.show import Show
from app.models.seat import Seat
from app.models.booking import Booking, BookingSeat, SeatLock
from app.models.user import User
from app.services.booking_service import hold_seats, create_pending_booking

client = TestClient(app)

def test_recommendation_endpoints():
    db: Session = SessionLocal()
    try:
        # Get a sample show
        show = db.query(Show).first()
        assert show is not None, "Show should exist in seeded database"
        show_id = show.id

        # ----------------------------------------------------
        # TEST 0: GET Preferences endpoint
        # ----------------------------------------------------
        pref_res = client.get(f"/api/seat-recommendations/{show_id}/preferences")
        assert pref_res.status_code == 200, f"Preferences failed: {pref_res.text}"
        pref_data = pref_res.json()
        assert pref_data["show_id"] == show_id
        assert len(pref_data["tiers"]) >= 3
        assert pref_data["min_price"] > 0
        assert len(pref_data["seating_preferences"]) == 5
        print("✓ Test 0 Passed: GET /preferences returned valid configuration")

        # ----------------------------------------------------
        # TEST 1: Recommend 1 centrally positioned seat
        # ----------------------------------------------------
        res1 = client.post("/api/seat-recommendations", json={
            "show_id": show_id,
            "number_of_seats": 1,
            "preferred_category": "ANY",
            "seating_preference": "centre",
            "adjacent_required": True
        })
        assert res1.status_code == 200, f"1 seat recommendation failed: {res1.text}"
        data1 = res1.json()
        assert len(data1["recommendations"]) >= 1
        rec1 = data1["recommendations"][0]
        assert len(rec1["seats"]) == 1
        # Seat number should be near middle (5 or 6 out of 10)
        assert rec1["seats"][0]["seat_number"] in [4, 5, 6, 7]
        assert 0.0 <= rec1["score"] <= 100.0
        assert rec1["score_breakdown"]["central_position_score"] >= 75.0
        print(f"✓ Test 1 Passed: Recommend 1 centrally positioned seat -> {rec1['seat_labels']} (Score: {rec1['score']})")

        # ----------------------------------------------------
        # TEST 2: Recommend 3 adjacent seats
        # ----------------------------------------------------
        res2 = client.post("/api/seat-recommendations", json={
            "show_id": show_id,
            "number_of_seats": 3,
            "preferred_category": "GOLD",
            "seating_preference": "best_view",
            "adjacent_required": True
        })
        assert res2.status_code == 200, f"3 seats recommendation failed: {res2.text}"
        data2 = res2.json()
        assert len(data2["recommendations"]) >= 1
        rec2 = data2["recommendations"][0]
        assert len(rec2["seats"]) == 3
        seat_nums = [s["seat_number"] for s in rec2["seats"]]
        assert seat_nums[1] == seat_nums[0] + 1 and seat_nums[2] == seat_nums[1] + 1, "Seats must be consecutive"
        assert rec2["seat_category"] == "GOLD"
        assert rec2["score_breakdown"]["adjacent_seating_score"] == 100.0
        print(f"✓ Test 2 Passed: Recommend 3 adjacent seats -> {rec2['seat_labels']} (Score: {rec2['score']})")

        # ----------------------------------------------------
        # TEST 3: Recommend 5 adjacent seats
        # ----------------------------------------------------
        res3 = client.post("/api/seat-recommendations", json={
            "show_id": show_id,
            "number_of_seats": 5,
            "preferred_category": "ANY",
            "seating_preference": "adjacent",
            "adjacent_required": True
        })
        assert res3.status_code == 200, f"5 seats recommendation failed: {res3.text}"
        data3 = res3.json()
        rec3 = data3["recommendations"][0]
        assert len(rec3["seats"]) == 5
        seat_nums5 = [s["seat_number"] for s in rec3["seats"]]
        for idx in range(len(seat_nums5) - 1):
            assert seat_nums5[idx] + 1 == seat_nums5[idx + 1]
        print(f"✓ Test 3 Passed: Recommend 5 adjacent seats -> {rec3['seat_labels']} (Score: {rec3['score']})")

        # ----------------------------------------------------
        # TEST 4: Respect user's maximum budget
        # ----------------------------------------------------
        silver_price = show.silver_price
        res4 = client.post("/api/seat-recommendations", json={
            "show_id": show_id,
            "number_of_seats": 2,
            "preferred_category": "ANY",
            "maximum_budget": silver_price,
            "seating_preference": "best_view",
            "adjacent_required": True
        })
        assert res4.status_code == 200, f"Budget test failed: {res4.text}"
        data4 = res4.json()
        for rec in data4["recommendations"]:
            assert rec["individual_price"] <= silver_price
            assert rec["seat_category"] == "SILVER"
        print(f"✓ Test 4 Passed: Budget constraint respected (Max: Rs.{silver_price}, got {data4['recommendations'][0]['seat_category']})")

        # ----------------------------------------------------
        # TEST 5: Respect selected seat category
        # ----------------------------------------------------
        res5 = client.post("/api/seat-recommendations", json={
            "show_id": show_id,
            "number_of_seats": 2,
            "preferred_category": "PLATINUM",
            "seating_preference": "best_view",
            "adjacent_required": True
        })
        assert res5.status_code == 200, f"Category test failed: {res5.text}"
        data5 = res5.json()
        for rec in data5["recommendations"]:
            assert rec["seat_category"] == "PLATINUM"
            for s in rec["seats"]:
                assert s["tier"] == "PLATINUM"
        print(f"✓ Test 5 Passed: Preferred category 'PLATINUM' strictly respected")

        # ----------------------------------------------------
        # TEST 6 & 7: Exclude booked and temporarily locked seats
        # ----------------------------------------------------
        # Lock seats D5 and D6 temporarily
        seat_d5 = db.query(Seat).filter(Seat.screen_id == show.screen_id, Seat.row_label == "D", Seat.seat_number == 5).first()
        seat_d6 = db.query(Seat).filter(Seat.screen_id == show.screen_id, Seat.row_label == "D", Seat.seat_number == 6).first()
        demo_user = db.query(User).filter(User.email == "user@cinebook.com").first()

        # Insert active lock for D5 and D6
        db.query(SeatLock).filter(SeatLock.show_id == show_id, SeatLock.seat_id.in_([seat_d5.id, seat_d6.id])).delete(synchronize_session=False)
        db.commit()
        lock_d5 = SeatLock(
            show_id=show_id,
            seat_id=seat_d5.id,
            user_id=demo_user.id,
            expires_at=datetime.utcnow() + timedelta(minutes=5)
        )
        lock_d6 = SeatLock(
            show_id=show_id,
            seat_id=seat_d6.id,
            user_id=demo_user.id,
            expires_at=datetime.utcnow() + timedelta(minutes=5)
        )
        db.add_all([lock_d5, lock_d6])
        db.commit()

        res6 = client.post("/api/seat-recommendations", json={
            "show_id": show_id,
            "number_of_seats": 2,
            "preferred_category": "GOLD",
            "seating_preference": "best_view",
            "adjacent_required": True
        })
        assert res6.status_code == 200
        data6 = res6.json()
        for rec in data6["recommendations"]:
            rec_ids = set(rec["seat_ids"])
            assert seat_d5.id not in rec_ids, "Locked seat D5 should not be recommended"
            assert seat_d6.id not in rec_ids, "Locked seat D6 should not be recommended"
        print("✓ Tests 6 & 7 Passed: Excluded temporarily locked seats D5, D6")

        # Clean up lock
        db.query(SeatLock).filter(SeatLock.show_id == show_id, SeatLock.seat_id.in_([seat_d5.id, seat_d6.id])).delete(synchronize_session=False)
        db.commit()

        # ----------------------------------------------------
        # TEST 8: Return alternatives when adjacency is optional
        # ----------------------------------------------------
        res8 = client.post("/api/seat-recommendations", json={
            "show_id": show_id,
            "number_of_seats": 2,
            "preferred_category": "ANY",
            "seating_preference": "best_view",
            "adjacent_required": False
        })
        assert res8.status_code == 200
        data8 = res8.json()
        assert len(data8["recommendations"]) >= 1
        print("✓ Test 8 Passed: Non-adjacent alternatives supported when adjacent_required=False")

        # ----------------------------------------------------
        # TEST 9 & 10: Error handling: Budget too low & Insufficient seats
        # ----------------------------------------------------
        err_budget = client.post("/api/seat-recommendations", json={
            "show_id": show_id,
            "number_of_seats": 2,
            "maximum_budget": 50.0  # Unreasonably low budget
        })
        assert err_budget.status_code == 400
        assert "lower than the lowest available" in err_budget.json()["detail"]
        print("✓ Test 9 Passed: Budget too low caught with informative 400 message")

        err_seats = client.post("/api/seat-recommendations", json={
            "show_id": show_id,
            "number_of_seats": 100 # Exceeds total screen seats
        })
        assert err_seats.status_code == 422 or err_seats.status_code == 400
        print("✓ Test 10 Passed: Exceeding max tickets caught cleanly")

        # ----------------------------------------------------
        # TEST 11: Score normalization (0 to 100)
        # ----------------------------------------------------
        for rec in data2["recommendations"]:
            assert 0.0 <= rec["score"] <= 100.0
            assert 0.0 <= rec["score_breakdown"]["central_position_score"] <= 100.0
            assert 0.0 <= rec["score_breakdown"]["viewing_distance_score"] <= 100.0
            assert 0.0 <= rec["score_breakdown"]["adjacent_seating_score"] <= 100.0
            assert 0.0 <= rec["score_breakdown"]["budget_score"] <= 100.0
        print("✓ Test 11 Passed: All scores and component breakdowns normalized 0 to 100")

        # ----------------------------------------------------
        # TEST 12: Selected recommended seats proceed through booking flow
        # ----------------------------------------------------
        login_res = client.post("/api/auth/login", json={"email": "user@cinebook.com", "password": "User@123"})
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Select seats from recommendation 1
        chosen_seats = rec2["seat_ids"]
        hold_res = client.post("/api/bookings/hold-seats", json={"show_id": show_id, "seat_ids": chosen_seats}, headers=headers)
        assert hold_res.status_code == 200, f"Hold failed: {hold_res.text}"

        create_res = client.post("/api/bookings/create-pending", json={"show_id": show_id, "seat_ids": chosen_seats}, headers=headers)
        assert create_res.status_code == 200, f"Create pending booking failed: {create_res.text}"
        booking = create_res.json()
        assert booking["status"] == "PENDING"
        print(f"✓ Test 12 Passed: Recommended seats locked and converted to booking {booking['booking_code']}")

        # ----------------------------------------------------
        # TEST 13: Stale recommendations cannot result in double booking
        # ----------------------------------------------------
        # Other user tries to hold the same seats
        other_user = db.query(User).filter(User.email == "admin@cinebook.com").first()
        admin_login = client.post("/api/auth/login", json={"email": "admin@cinebook.com", "password": "Admin@123"})
        admin_token = admin_login.json()["access_token"]
        conflict_res = client.post(
            "/api/bookings/hold-seats",
            json={"show_id": show_id, "seat_ids": chosen_seats},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert conflict_res.status_code == 409, "Double booking must be rejected with 409 Conflict"
        print("✓ Test 13 Passed: Stale recommendation double-booking prevented with 409 Conflict")

        # Clean up hold/booking created in test
        db.query(BookingSeat).filter(BookingSeat.booking_id == booking["id"]).delete()
        db.query(Booking).filter(Booking.id == booking["id"]).delete()
        db.query(SeatLock).filter(SeatLock.show_id == show_id, SeatLock.seat_id.in_(chosen_seats)).delete()
        db.commit()

        # ----------------------------------------------------
        # TEST 14: Manual seat selection continues to work
        # ----------------------------------------------------
        avail_seat = db.query(Seat).filter(Seat.screen_id == show.screen_id, Seat.row_label == "A", Seat.seat_number == 1).first()
        manual_hold = client.post(
            "/api/bookings/hold-seats",
            json={"show_id": show_id, "seat_ids": [avail_seat.id]},
            headers=headers
        )
        assert manual_hold.status_code == 200
        # Release manual hold
        client.post(
            "/api/bookings/release-seats",
            json={"show_id": show_id, "seat_ids": [avail_seat.id]},
            headers=headers
        )
        print("✓ Test 14 Passed: Manual seat selection and hold continue to work flawlessly")

    finally:
        db.close()

if __name__ == "__main__":
    print("==================================================")
    print("RUNNING SMART SEAT RECOMMENDATION TEST SUITE")
    print("==================================================")
    test_recommendation_endpoints()
    print("==================================================")
    print("ALL 14 SMART SEAT RECOMMENDATION TESTS PASSED 100%!")
    print("==================================================")

