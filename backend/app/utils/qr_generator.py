import qrcode
from pathlib import Path
from app.config import QRCODES_DIR

def generate_booking_qr(booking_code: str, show_id: int, movie_title: str) -> str:
    """
    Generates a unique QR code for the booking ticket.
    Content contains the booking reference verification URL/data.
    Returns the relative path from BASE_DIR or static uploads.
    """
    qr_payload = f"CINEBOOK-TICKET|{booking_code}|SHOW:{show_id}|MOVIE:{movie_title}|VERIFIED"
    
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=8,
        border=3,
    )
    qr.add_data(qr_payload)
    qr.make(fit=True)

    img = qr.make_image(fill_color="#090a0f", back_color="#ffffff")
    filename = f"qr_{booking_code}.png"
    filepath = QRCODES_DIR / filename
    img.save(str(filepath))

    # Return relative URL path for web access
    return f"/uploads/qrcodes/{filename}"

