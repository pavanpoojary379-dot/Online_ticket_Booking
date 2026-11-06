from datetime import datetime, timedelta
from typing import List, Optional, Tuple, Dict
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from fastapi import HTTPException, status
import uuid

from app.models.booking import Booking, BookingSeat, SeatLock
from app.models.show import Show
from app.models.seat import Seat
from app.models.coupon import Coupon
from app.config import SEAT_LOCK_DURATION_SECONDS

def cleanup_expired_locks(db: Session):
    """Removes all seat locks that have passed their expiration timestamp."""
    now = datetime.utcnow()
    db.query(SeatLock).filter(SeatLock.expires_at < now).delete(synchronize_session=False)
    db.commit()

def get_seat_layout_with_status(db: Session, show_id: int, current_user_id: Optional[int] = None) -> List[dict]:
    """
    Returns all seats for the show's screen with their dynamic status:
    AVAILABLE, SELECTED (if locked by current user), LOCKED (if locked by other user), or BOOKED.
    """
    cleanup_expired_locks(db)

    show = db.query(Show).filter(Show.id == show_id).first()
    if not show:
        raise HTTPException(status_code=404, detail="Show not found")

    # Get all seats belonging to the show's screen
    seats = db.query(Seat).filter(Seat.screen_id == show.screen_id).order_by(Seat.row_label, Seat.seat_number).all()

    # Get booked seat IDs for this show (from CONFIRMED bookings)
    confirmed_booking_ids = [
        b.id for b in db.query(Booking.id).filter(
            Booking.show_id == show_id,
            Booking.status == "CONFIRMED"
        ).all()
    ]

    booked_seat_ids = set()
    if confirmed_booking_ids:
        bs_records = db.query(BookingSeat.seat_id).filter(BookingSeat.booking_id.in_(confirmed_booking_ids)).all()
        booked_seat_ids = {bs[0] for bs in bs_records}

    # Get currently active seat locks for this show
    now = datetime.utcnow()
    active_locks = db.query(SeatLock).filter(
        SeatLock.show_id == show_id,
        SeatLock.expires_at > now
    ).all()
    locks_by_seat = {lock.seat_id: lock.user_id for lock in active_locks}

    result = []
    for s in seats:
        seat_status = "AVAILABLE"
        if s.id in booked_seat_ids:
            seat_status = "BOOKED"
        elif s.id in locks_by_seat:
            if current_user_id and locks_by_seat[s.id] == current_user_id:
                seat_status = "SELECTED"
            else:
                seat_status = "LOCKED"

        # Price based on tier
        price = show.silver_price
        if s.tier == "GOLD":
            price = show.gold_price
        elif s.tier == "PLATINUM":
            price = show.platinum_price

        result.append({
            "id": s.id,
            "row_label": s.row_label,
            "seat_number": s.seat_number,
            "tier": s.tier,
            "price": price,
            "status": seat_status
        })

    return result

def hold_seats(db: Session, show_id: int, seat_ids: List[int], user_id: int) -> dict:
    """
    Temporarily locks the requested seats for 5 minutes.
    Releases any existing locks held by this user on other seats for this show first.
    """
    cleanup_expired_locks(db)

    show = db.query(Show).filter(Show.id == show_id).first()
    if not show:
        raise HTTPException(status_code=404, detail="Show not found")

    if not seat_ids:
        raise HTTPException(status_code=400, detail="No seats specified")

    # Check if any seat is already booked for this show
    confirmed_bookings = db.query(Booking.id).filter(
        Booking.show_id == show_id,
        Booking.status == "CONFIRMED"
    ).all()
    if confirmed_bookings:
        conf_ids = [b[0] for b in confirmed_bookings]
        already_booked = db.query(BookingSeat).filter(
            BookingSeat.booking_id.in_(conf_ids),
            BookingSeat.seat_id.in_(seat_ids)
        ).first()
        if already_booked:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Seat ID {already_booked.seat_id} is already booked for this show."
            )

    now = datetime.utcnow()
    # Check if any seat is locked by someone else
    locked_by_others = db.query(SeatLock).filter(
        SeatLock.show_id == show_id,
        SeatLock.seat_id.in_(seat_ids),
        SeatLock.user_id != user_id,
        SeatLock.expires_at > now
    ).first()

    if locked_by_others:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="One or more selected seats are currently reserved by another customer. Please choose different seats."
        )

    # Release any previous locks for this user in this show
    db.query(SeatLock).filter(
        SeatLock.show_id == show_id,
        SeatLock.user_id == user_id
    ).delete(synchronize_session=False)

    # Create new locks
    expires_at = now + timedelta(seconds=SEAT_LOCK_DURATION_SECONDS)
    for sid in seat_ids:
        lock = SeatLock(
            show_id=show_id,
            seat_id=sid,
            user_id=user_id,
            locked_at=now,
            expires_at=expires_at
        )
        db.add(lock)

    db.commit()

    return {
        "message": f"{len(seat_ids)} seats temporarily locked",
        "show_id": show_id,
        "seat_ids": seat_ids,
        "expires_at": expires_at.isoformat(),
        "duration_seconds": SEAT_LOCK_DURATION_SECONDS
    }

def release_seats(db: Session, show_id: int, seat_ids: List[int], user_id: int):
    """Releases locks held by the user."""
    db.query(SeatLock).filter(
        SeatLock.show_id == show_id,
        SeatLock.user_id == user_id,
        SeatLock.seat_id.in_(seat_ids)
    ).delete(synchronize_session=False)
    db.commit()
    return {"message": "Seats released successfully"}

def create_pending_booking(db: Session, show_id: int, seat_ids: List[int], user_id: int, coupon_code: Optional[str] = None) -> Booking:
    """
    Creates a PENDING booking record with calculated price, fees, and discounts.
    Validates that seats are currently held by this user.
    """
    cleanup_expired_locks(db)

    show = db.query(Show).filter(Show.id == show_id).first()
    if not show:
        raise HTTPException(status_code=404, detail="Show not found")

    now = datetime.utcnow()
    # Verify all seats are locked by this user
    user_locks = db.query(SeatLock).filter(
        SeatLock.show_id == show_id,
        SeatLock.seat_id.in_(seat_ids),
        SeatLock.user_id == user_id,
        SeatLock.expires_at > now
    ).all()

    if len(user_locks) != len(seat_ids):
        raise HTTPException(
            status_code=400,
            detail="Your seat reservation has expired or is invalid. Please select seats again."
        )

    # Calculate pricing
    seats = db.query(Seat).filter(Seat.id.in_(seat_ids)).all()
    total_amount = 0.0
    for s in seats:
        if s.tier == "PLATINUM":
            total_amount += show.platinum_price
        elif s.tier == "GOLD":
            total_amount += show.gold_price
        else:
            total_amount += show.silver_price

    convenience_fee = 30.0 * len(seat_ids)
    discount_amount = 0.0

    if coupon_code:
        coupon = db.query(Coupon).filter(
            Coupon.code == coupon_code.upper().strip(),
            Coupon.is_active == True
        ).first()
        if coupon and total_amount >= coupon.min_amount:
            discount_amount = round((total_amount * coupon.discount_percent) / 100.0, 2)

    final_amount = round(total_amount + convenience_fee - discount_amount, 2)
    booking_code = f"CB-{uuid.uuid4().hex[:8].upper()}"

    booking = Booking(
        booking_code=booking_code,
        user_id=user_id,
        show_id=show_id,
        status="PENDING",
        total_amount=total_amount,
        convenience_fee=convenience_fee,
        discount_amount=discount_amount,
        final_amount=final_amount,
        coupon_code=coupon_code.upper().strip() if coupon_code else None
    )
    db.add(booking)
    db.flush()

    for s in seats:
        price = show.silver_price
        if s.tier == "GOLD":
            price = show.gold_price
        elif s.tier == "PLATINUM":
            price = show.platinum_price

        bs = BookingSeat(
            booking_id=booking.id,
            seat_id=s.id,
            tier=s.tier,
            price=price
        )
        db.add(bs)

    db.commit()
    db.refresh(booking)
    return booking

def smart_seat_recommendation(db: Session, show_id: int, num_seats: int = 2, preferred_tier: Optional[str] = None) -> dict:
    """
    Recommends prime middle-row adjacent seats for groups.
    Tier preference is honored if possible (Gold > Platinum > Silver by default).
    """
    seat_layout = get_seat_layout_with_status(db, show_id)

    # Group seats by row
    rows: Dict[str, List[dict]] = {}
    for s in seat_layout:
        rows.setdefault(s["row_label"], []).append(s)

    # Sort each row by seat number
    for r in rows:
        rows[r].sort(key=lambda x: x["seat_number"])

    # Rank rows: middle rows are best cinema viewing (e.g., C, D, E)
    all_row_labels = sorted(list(rows.keys()))
    mid_idx = len(all_row_labels) // 2
    row_priority = sorted(all_row_labels, key=lambda r: abs(all_row_labels.index(r) - mid_idx))

    best_group = []
    best_reason = ""

    # Search for contiguous available seats in prioritized rows
    for row_label in row_priority:
        row_seats = rows[row_label]
        # Filter by tier if specified
        if preferred_tier and row_seats[0]["tier"] != preferred_tier:
            continue

        # Look for contiguous available seats close to center
        row_len = len(row_seats)
        center_seat_num = row_len / 2.0

        for i in range(len(row_seats) - num_seats + 1):
            candidate = row_seats[i : i + num_seats]
            if all(s["status"] == "AVAILABLE" for s in candidate):
                # Ensure sequential numbers
                is_sequential = all(candidate[k]["seat_number"] + 1 == candidate[k+1]["seat_number"] for k in range(num_seats - 1))
                if is_sequential:
                    # Score candidate by closeness to center
                    avg_center_dist = sum(abs(s["seat_number"] - center_seat_num) for s in candidate) / num_seats
                    if not best_group or avg_center_dist < best_group[1]:
                        best_group = (candidate, avg_center_dist, f"Optimal central viewing in Row {row_label}")

        if best_group:
            break

    # If no contiguous found with tier preference, fallback without tier filter
    if not best_group and preferred_tier:
        return smart_seat_recommendation(db, show_id, num_seats, None)

    if not best_group:
        # Fallback: grab any available seats
        avail = [s for s in seat_layout if s["status"] == "AVAILABLE"][:num_seats]
        if avail:
            total_price = sum(s["price"] for s in avail)
            return {
                "seats": avail,
                "total_price": total_price,
                "reason": "Best available scattered seats"
            }
        raise HTTPException(status_code=400, detail="Not enough seats available for this show")

    recommended_seats = best_group[0]
    total_price = sum(s["price"] for s in recommended_seats)
    return {
        "seats": recommended_seats,
        "total_price": total_price,
        "reason": best_group[2]
    }

