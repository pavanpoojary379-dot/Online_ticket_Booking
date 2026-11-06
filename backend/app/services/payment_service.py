import uuid
from datetime import datetime
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.booking import Booking, BookingSeat, SeatLock
from app.models.payment import Payment
from app.models.show import Show
from app.models.movie import Movie
from app.models.theatre import Theatre
from app.services.booking_service import cleanup_expired_locks
from app.utils.qr_generator import generate_booking_qr
from app.services.ticket_service import generate_pdf_ticket

def process_simulated_payment(
    db: Session,
    booking_id: int,
    user_id: int,
    payment_method: str,
    simulate_status: str = "SUCCESS",
    failure_reason: str = None
) -> dict:
    """
    Simulates payment execution.
    Handles SUCCESS, FAILED, and CANCELLED scenarios.
    Upon SUCCESS:
      1. Validates that seats are still reserved/locked for this user.
      2. Creates payment record.
      3. Sets booking status to CONFIRMED.
      4. Deletes temporary seat locks.
      5. Generates QR code and ReportLab PDF ticket.
    Upon FAILED / CANCELLED:
      1. Records failed payment.
      2. Releases temporary seat locks.
      3. Leaves booking in CANCELLED/PENDING state.
    """
    cleanup_expired_locks(db)

    # Use database transaction
    booking = db.query(Booking).filter(
        Booking.id == booking_id,
        Booking.user_id == user_id
    ).first()

    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if booking.status == "CONFIRMED":
        raise HTTPException(status_code=400, detail="Booking is already confirmed")

    if booking.status == "CANCELLED":
        raise HTTPException(
            status_code=400,
            detail="This booking has expired or was cancelled. Please select seats again."
        )

    seat_ids = [bs.seat_id for bs in booking.seats]
    now = datetime.utcnow()

    # Re-verify seat lock status
    active_locks = db.query(SeatLock).filter(
        SeatLock.show_id == booking.show_id,
        SeatLock.seat_id.in_(seat_ids),
        SeatLock.user_id == user_id,
        SeatLock.expires_at > now
    ).all()

    if len(active_locks) != len(seat_ids):
        # Seat locks expired before payment was completed!
        raise HTTPException(
            status_code=status.HTTP_408_REQUEST_TIMEOUT,
            detail="Your 5-minute seat reservation has expired. Please select seats and try again."
        )

    # Re-verify no other confirmed booking took these seats
    already_booked = db.query(BookingSeat.seat_id).join(Booking).filter(
        Booking.show_id == booking.show_id,
        Booking.status == "CONFIRMED",
        Booking.id != booking.id,
        BookingSeat.seat_id.in_(seat_ids)
    ).all()
    if already_booked:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="One or more selected seats have already been booked by another customer."
        )

    # Generate a transaction reference
    transaction_id = f"TXN-{uuid.uuid4().hex[:12].upper()}"

    existing_payment = db.query(Payment).filter(Payment.booking_id == booking.id).first()

    if simulate_status != "SUCCESS":
        # Payment Failed / Cancelled flow
        if existing_payment:
            existing_payment.payment_method = payment_method
            existing_payment.transaction_id = transaction_id
            existing_payment.amount = booking.final_amount
            existing_payment.status = simulate_status.upper()
            existing_payment.failure_reason = failure_reason or "Payment declined / cancelled by user"
        else:
            failed_payment = Payment(
                booking_id=booking.id,
                payment_method=payment_method,
                transaction_id=transaction_id,
                amount=booking.final_amount,
                status=simulate_status.upper(),
                failure_reason=failure_reason or "Payment declined / cancelled by user"
            )
            db.add(failed_payment)

        # Release locks immediately so other users can book
        db.query(SeatLock).filter(
            SeatLock.show_id == booking.show_id,
            SeatLock.seat_id.in_(seat_ids),
            SeatLock.user_id == user_id
        ).delete(synchronize_session=False)

        booking.status = "CANCELLED"
        db.commit()

        return {
            "success": False,
            "status": simulate_status.upper(),
            "booking_id": booking.id,
            "booking_code": booking.booking_code,
            "transaction_id": transaction_id,
            "message": failure_reason or "Payment was not successful. Your tickets have not been booked and seats have been released."
        }

    # SUCCESS FLOW: Confirm booking
    if existing_payment:
        existing_payment.payment_method = payment_method
        existing_payment.transaction_id = transaction_id
        existing_payment.amount = booking.final_amount
        existing_payment.status = "SUCCESS"
        existing_payment.failure_reason = None
    else:
        payment = Payment(
            booking_id=booking.id,
            payment_method=payment_method,
            transaction_id=transaction_id,
            amount=booking.final_amount,
            status="SUCCESS",
            failure_reason=None
        )
        db.add(payment)

    booking.status = "CONFIRMED"

    # Remove temporary locks now that seats are permanently booked
    db.query(SeatLock).filter(
        SeatLock.show_id == booking.show_id,
        SeatLock.seat_id.in_(seat_ids),
        SeatLock.user_id == user_id
    ).delete(synchronize_session=False)

    db.commit()
    db.refresh(booking)

    # Generate QR Code and PDF ticket
    try:
        show = db.query(Show).filter(Show.id == booking.show_id).first()
        movie = db.query(Movie).filter(Movie.id == show.movie_id).first() if show else None
        theatre = db.query(Theatre).filter(Theatre.id == show.theatre_id).first() if show else None

        qr_path = generate_booking_qr(booking.booking_code, show.id if show else 0, movie.title if movie else "CineBook Ticket")
        booking.qr_code_path = qr_path

        if movie and theatre and show:
            pdf_path = generate_pdf_ticket(booking, movie, theatre, show, booking.seats)
            booking.pdf_ticket_path = pdf_path

        db.commit()
        db.refresh(booking)
    except Exception as e:
        print(f"Non-fatal error generating ticket visual assets: {e}")
        db.commit()

    return {
        "success": True,
        "status": "CONFIRMED",
        "booking_id": booking.id,
        "booking_code": booking.booking_code,
        "transaction_id": transaction_id,
        "amount_paid": booking.final_amount,
        "qr_code_url": booking.qr_code_path,
        "pdf_ticket_url": booking.pdf_ticket_path,
        "message": "Payment successful! Your tickets have been successfully booked."
    }

