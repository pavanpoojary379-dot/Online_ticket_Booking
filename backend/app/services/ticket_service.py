from pathlib import Path
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch

from app.config import TICKETS_DIR, QRCODES_DIR, BASE_DIR

def generate_pdf_ticket(booking, movie, theatre, show, seats) -> str:
    """
    Generates a professional cinema ticket PDF with dark accents, QR code,
    movie details, theatre details, and booking metadata.
    Returns relative path to PDF.
    """
    filename = f"ticket_{booking.booking_code}.pdf"
    filepath = TICKETS_DIR / filename

    doc = SimpleDocTemplate(
        str(filepath),
        pagesize=letter,
        rightMargin=40,
        leftMargin=40,
        topMargin=40,
        bottomMargin=40
    )

    story = []
    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        'TicketHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=24,
        leading=28,
        textColor=colors.HexColor('#f97316'), # Amber cinema accent
        alignment=0
    )

    subtitle_style = ParagraphStyle(
        'TicketSubHeader',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#64748b')
    )

    movie_title_style = ParagraphStyle(
        'MovieTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=colors.HexColor('#0f172a')
    )

    label_style = ParagraphStyle(
        'Label',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#64748b')
    )

    value_style = ParagraphStyle(
        'Value',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=11,
        leading=15,
        textColor=colors.HexColor('#0f172a')
    )

    badge_style = ParagraphStyle(
        'Badge',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=14,
        textColor=colors.white,
        alignment=1
    )

    # Header section: Brand & Booking Reference
    header_data = [
        [
            Paragraph("CINEBOOK", title_style),
            Paragraph(f"<b>BOOKING ID</b><br/>{booking.booking_code}", value_style)
        ],
        [
            Paragraph("SMART CINEMA TICKET & ENTRY PASS", subtitle_style),
            Paragraph(f"Status: <font color='#16a34a'><b>CONFIRMED</b></font>", value_style)
        ]
    ]

    header_table = Table(header_data, colWidths=[4.5 * inch, 2.5 * inch])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(header_table)

    story.append(Spacer(1, 15))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#f97316'), spaceAfter=15))

    # Movie & Showtime section
    show_time_str = show.show_time.strftime("%A, %d %B %Y | %I:%M %p")
    seat_labels = ", ".join([f"{s.seat.row_label}{s.seat.seat_number}" if hasattr(s, 'seat') and s.seat else f"Seat {s.seat_id}" for s in seats])

    # QR Code image
    qr_filename = f"qr_{booking.booking_code}.png"
    qr_path = QRCODES_DIR / qr_filename

    info_data = [
        [
            Paragraph(movie.title, movie_title_style),
            ""
        ],
        [
            Paragraph(f"<b>Genre:</b> {movie.genre} | <b>Language:</b> {movie.language} | <b>Certificate:</b> {movie.certificate}", subtitle_style),
            ""
        ],
        [
            Paragraph("THEATRE & AUDITORIUM", label_style),
            Paragraph("FORMAT", label_style)
        ],
        [
            Paragraph(f"<b>{theatre.name}</b><br/>{theatre.address}, {theatre.city}", value_style),
            Paragraph(f"<b>{show.screen_format}</b>", value_style)
        ],
        [
            Paragraph("DATE & TIME", label_style),
            Paragraph("SEATS BOOKED", label_style)
        ],
        [
            Paragraph(f"<b>{show_time_str}</b>", value_style),
            Paragraph(f"<b>{seat_labels}</b> ({len(seats)} Ticket{'s' if len(seats) > 1 else ''})", value_style)
        ],
    ]

    info_table = Table(info_data, colWidths=[4.5 * inch, 2.5 * inch])
    info_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('SPAN', (0, 0), (1, 0)),
        ('SPAN', (0, 1), (1, 1)),
        ('TOPPADDING', (0, 2), (-1, 2), 10),
        ('TOPPADDING', (0, 4), (-1, 4), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(info_table)

    story.append(Spacer(1, 15))
    story.append(HRFlowable(width="100%", thickness=0.8, color=colors.HexColor('#e2e8f0'), spaceAfter=15))

    # Pricing & QR Code layout
    qr_img = None
    if qr_path.exists():
        qr_img = Image(str(qr_path), width=1.6 * inch, height=1.6 * inch)

    price_summary = [
        [Paragraph("TICKETS SUMMARY", label_style), ""],
        [Paragraph(f"Tickets Subtotal: Rs. {booking.total_amount:.2f}", value_style), ""],
        [Paragraph(f"Convenience Fee: Rs. {booking.convenience_fee:.2f}", value_style), ""],
        [Paragraph(f"Discount Applied: Rs. -{booking.discount_amount:.2f}", value_style), ""],
        [Paragraph(f"<b>TOTAL PAID: Rs. {booking.final_amount:.2f}</b>", ParagraphStyle('Total', parent=value_style, fontName='Helvetica-Bold', fontSize=13, textColor=colors.HexColor('#ea580c'))), ""]
    ]

    price_table = Table(price_summary, colWidths=[3.2 * inch, 1.3 * inch])
    price_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))

    qr_block = [
        [qr_img if qr_img else Paragraph("QR CODE", label_style)],
        [Paragraph("<font size=7 color='#64748b'>Scan at cinema gate for entry</font>", ParagraphStyle('Scan', alignment=1))]
    ]
    qr_table = Table(qr_block, colWidths=[2.5 * inch])
    qr_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))

    lower_data = [[price_table, qr_table]]
    lower_table = Table(lower_data, colWidths=[4.5 * inch, 2.5 * inch])
    lower_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    story.append(lower_table)

    story.append(Spacer(1, 20))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#e2e8f0'), spaceAfter=10))

    # Terms & Important Notice
    terms_text = (
        "<b>Important Instructions:</b> Please present this e-ticket along with a valid ID at the cinema entrance. "
        "Entry is permitted 20 minutes before showtime. Outside food and beverages are not allowed. "
        "Tickets once booked can be cancelled up to 2 hours before the showtime according to CineBook cancellation policy."
    )
    story.append(Paragraph(terms_text, ParagraphStyle('Terms', fontName='Helvetica', fontSize=8, leading=11, textColor=colors.HexColor('#94a3b8'))))

    doc.build(story)
    return f"/uploads/tickets/{filename}"

