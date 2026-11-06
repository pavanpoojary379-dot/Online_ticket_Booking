from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

from app.database import get_db
from app.models.booking import Booking, BookingSeat
from app.models.user import User
from app.models.show import Show
from app.schemas.booking import (
    HoldSeatsRequest,
    ReleaseSeatsRequest,
    VerifyLockRequest,
    VerifyLockResponse,
    CreateBookingRequest,
    BookingOut,
    BookingSeatOut,
    PaymentOut
)
from app.schemas.show import ShowOut
from app.schemas.movie import MovieOut
from app.schemas.theatre import TheatreOut
from app.services.booking_service import (
    hold_seats,
    release_seats,
    create_pending_booking,
    verify_user_seat_locks
)
from app.utils.auth import get_current_user

router = APIRouter(prefix="/api/bookings", tags=["Bookings"])

def _format_booking_out(b: Booking) -> BookingOut:
    seat_outs = []
    for s in b.seats:
        label = f"{s.seat.row_label}{s.seat.seat_number}" if s.seat else f"Seat {s.seat_id}"
        seat_outs.append(BookingSeatOut(
            id=s.id,
            seat_id=s.seat_id,
            seat_label=label,
            tier=s.tier,
            price=s.price
        ))

    show_out = None
    if b.show:
        theatre_out = None
        if b.show.theatre:
            theatre_out = TheatreOut(
                id=b.show.theatre.id,
                name=b.show.theatre.name,
                city=b.show.theatre.city,
                address=b.show.theatre.address,
                formats=[f.strip() for f in (b.show.theatre.formats or "2D").split(",")]
            )
        movie_out = MovieOut.from_orm(b.show.movie) if b.show.movie else None
        show_out = ShowOut(
            id=b.show.id,
            movie_id=b.show.movie_id,
            theatre_id=b.show.theatre_id,
            screen_id=b.show.screen_id,
            screen_number=b.show.screen.screen_number if b.show.screen else b.show.screen_id,
            screen_name=b.show.screen.name if b.show.screen else f"Screen {b.show.screen_id}",
            show_time=b.show.show_time,
            screen_format=b.show.screen_format,
            silver_price=b.show.silver_price,
            gold_price=b.show.gold_price,
            platinum_price=b.show.platinum_price,
            movie=movie_out,
            theatre=theatre_out
        )

    payment_out = None
    if b.payment:
        payment_out = PaymentOut(
            id=b.payment.id,
            payment_method=b.payment.payment_method,
            transaction_id=b.payment.transaction_id,
            amount=b.payment.amount,
            status=b.payment.status,
            failure_reason=b.payment.failure_reason,
            created_at=b.payment.created_at
        )

    return BookingOut(
        id=b.id,
        booking_code=b.booking_code,
        user_id=b.user_id,
        show_id=b.show_id,
        status=b.status,
        total_amount=b.total_amount,
        convenience_fee=b.convenience_fee,
        discount_amount=b.discount_amount,
        final_amount=b.final_amount,
        coupon_code=b.coupon_code,
        created_at=b.created_at,
        qr_code_path=b.qr_code_path,
        pdf_ticket_path=b.pdf_ticket_path,
        show=show_out,
        seats=seat_outs,
        payment=payment_out
    )

@router.post("/hold-seats")
def api_hold_seats(
    req: HoldSeatsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return hold_seats(db, req.show_id, req.seat_ids, current_user.id)

@router.post("/release-seats")
def api_release_seats(
    req: ReleaseSeatsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return release_seats(db, req.show_id, req.seat_ids, current_user.id)

@router.post("/verify-lock", response_model=VerifyLockResponse)
def api_verify_lock(
    req: VerifyLockRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Verifies that the requested seats are currently locked by the authenticated user and have not expired.
    """
    return verify_user_seat_locks(db, req.show_id, req.seat_ids, current_user.id)

@router.post("/create-pending", response_model=BookingOut)
def api_create_pending(
    req: CreateBookingRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    booking = create_pending_booking(
        db,
        show_id=req.show_id,
        seat_ids=req.seat_ids,
        user_id=current_user.id,
        coupon_code=req.coupon_code
    )
    return _format_booking_out(booking)

@router.get("/my-bookings", response_model=List[BookingOut])
def get_my_bookings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    bookings = db.query(Booking).filter(
        Booking.user_id == current_user.id
    ).order_by(Booking.created_at.desc()).all()
    return [_format_booking_out(b) for b in bookings]

@router.get("/{booking_id}", response_model=BookingOut)
def get_booking_details(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    # Authorize user or admin
    if booking.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to view this booking")

    return _format_booking_out(booking)

@router.post("/{booking_id}/cancel")
def cancel_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if booking.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to cancel this booking")

    if booking.status == "CANCELLED":
        raise HTTPException(status_code=400, detail="Booking is already cancelled")

    # Rule: cannot cancel show in the past
    if booking.show and booking.show.show_time < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Cannot cancel a show that has already started or completed")

    booking.status = "CANCELLED"
    if booking.payment:
        booking.payment.status = "CANCELLED"
        booking.payment.failure_reason = "Customer cancelled booking; refund simulated to source"

    db.commit()
    return {
        "message": "Booking cancelled successfully. Simulated refund of Rs. {:.2f} has been credited to your payment method.".format(booking.final_amount),
        "booking_id": booking.id,
        "status": "CANCELLED"
    }

