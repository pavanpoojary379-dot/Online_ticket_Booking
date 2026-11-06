from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pathlib import Path

from app.database import get_db
from app.models.booking import Booking
from app.models.user import User
from app.config import TICKETS_DIR, BASE_DIR
from app.utils.auth import get_current_user
from app.services.ticket_service import generate_pdf_ticket

router = APIRouter(prefix="/api/tickets", tags=["Tickets"])

@router.get("/{booking_id}")
def get_ticket_data(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if booking.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")

    return {
        "booking_id": booking.id,
        "booking_code": booking.booking_code,
        "status": booking.status,
        "qr_code_url": booking.qr_code_path,
        "pdf_download_url": f"/api/tickets/{booking.id}/download"
    }

@router.get("/{booking_id}/download")
def download_ticket_pdf(
    booking_id: int,
    db: Session = Depends(get_db)
):
    # Public or tokenized download for ticket PDF
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    pdf_filename = f"ticket_{booking.booking_code}.pdf"
    pdf_path = TICKETS_DIR / pdf_filename

    # If file doesn't exist on disk, regenerate it on the fly
    if not pdf_path.exists():
        show = booking.show
        movie = show.movie
        theatre = show.theatre
        generate_pdf_ticket(booking, movie, theatre, show, booking.seats)

    if not pdf_path.exists():
        raise HTTPException(status_code=500, detail="Could not generate PDF ticket")

    return FileResponse(
        path=str(pdf_path),
        filename=f"CineBook_Ticket_{booking.booking_code}.pdf",
        media_type="application/pdf"
    )

