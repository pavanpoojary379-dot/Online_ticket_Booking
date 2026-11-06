from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import json

from app.database import get_db
from app.models.user import User
from app.models.movie import Movie
from app.models.theatre import Theatre
from app.models.screen import Screen
from app.models.show import Show
from app.models.seat import Seat
from app.models.booking import Booking, BookingSeat
from app.models.payment import Payment
from app.utils.auth import get_current_admin
from app.routers.bookings import _format_booking_out
from app.schemas.theatre_layout import (
    TheatreCreate,
    TheatreUpdate,
    SaveLayoutRequest,
    DemoClassroomPresetRequest,
    ScreenLayoutConfig
)
from app.services.theatre_layout_service import (
    save_screen_layout_config,
    create_demo_classroom_theatre,
    compute_layout_geometry,
    validate_layout_config
)

router = APIRouter(prefix="/api/admin", tags=["Admin"])

@router.get("/dashboard")
def get_admin_dashboard(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
) -> Dict[str, Any]:
    total_movies = db.query(func.count(Movie.id)).scalar() or 0
    total_bookings = db.query(func.count(Booking.id)).filter(Booking.status == "CONFIRMED").scalar() or 0
    total_revenue = db.query(func.sum(Booking.final_amount)).filter(Booking.status == "CONFIRMED").scalar() or 0.0
    total_users = db.query(func.count(User.id)).scalar() or 0

    # Calculate average seat occupancy rate
    total_seats_all_shows = 0
    booked_seats_all_shows = 0
    shows = db.query(Show).all()
    for s in shows:
        screen_seats = db.query(func.count(Seat.id)).filter(Seat.screen_id == s.screen_id).scalar() or 0
        total_seats_all_shows += screen_seats
        # booked seats
        confirmed_b_ids = [b.id for b in db.query(Booking.id).filter(Booking.show_id == s.id, Booking.status == "CONFIRMED").all()]
        if confirmed_b_ids:
            b_seats = db.query(func.count(BookingSeat.id)).filter(BookingSeat.booking_id.in_(confirmed_b_ids)).scalar() or 0
            booked_seats_all_shows += b_seats

    occupancy_rate = round((booked_seats_all_shows / total_seats_all_shows * 100), 1) if total_seats_all_shows > 0 else 0.0

    # Revenue by Movie breakdown
    movies = db.query(Movie).all()
    revenue_by_movie = []
    for m in movies:
        movie_shows = [s.id for s in m.shows]
        if movie_shows:
            rev = db.query(func.sum(Booking.final_amount)).filter(
                Booking.show_id.in_(movie_shows),
                Booking.status == "CONFIRMED"
            ).scalar() or 0.0
            count = db.query(func.count(Booking.id)).filter(
                Booking.show_id.in_(movie_shows),
                Booking.status == "CONFIRMED"
            ).scalar() or 0
            revenue_by_movie.append({
                "movie_title": m.title,
                "revenue": round(rev, 2),
                "bookings_count": count
            })

    # Sort revenue by movie descending
    revenue_by_movie.sort(key=lambda x: x["revenue"], reverse=True)

    # Daily booking analytics for last 7 days
    daily_analytics = []
    today = datetime.utcnow().date()
    for i in range(6, -1, -1):
        d = today - timedelta(days=i)
        start_d = datetime.combine(d, datetime.min.time())
        end_d = datetime.combine(d, datetime.max.time())
        d_bookings = db.query(func.count(Booking.id)).filter(
            Booking.created_at >= start_d,
            Booking.created_at <= end_d,
            Booking.status == "CONFIRMED"
        ).scalar() or 0
        d_rev = db.query(func.sum(Booking.final_amount)).filter(
            Booking.created_at >= start_d,
            Booking.created_at <= end_d,
            Booking.status == "CONFIRMED"
        ).scalar() or 0.0
        daily_analytics.append({
            "date": d.strftime("%d %b"),
            "bookings": d_bookings,
            "revenue": round(d_rev, 2)
        })

    # Recent 10 bookings
    recent_bookings = db.query(Booking).order_by(Booking.created_at.desc()).limit(10).all()

    return {
        "total_movies": total_movies,
        "total_bookings": total_bookings,
        "total_revenue": round(total_revenue, 2),
        "total_users": total_users,
        "occupancy_rate": occupancy_rate,
        "revenue_by_movie": revenue_by_movie[:6],
        "daily_analytics": daily_analytics,
        "recent_bookings": [_format_booking_out(b) for b in recent_bookings]
    }

@router.get("/bookings")
def get_all_bookings(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    bookings = db.query(Booking).order_by(Booking.created_at.desc()).limit(100).all()
    return [_format_booking_out(b) for b in bookings]

@router.get("/users")
def get_all_users(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    users = db.query(User).order_by(User.created_at.desc()).all()
    return [{
        "id": u.id,
        "email": u.email,
        "full_name": u.full_name,
        "phone": u.phone,
        "is_admin": u.is_admin,
        "created_at": u.created_at.isoformat()
    } for u in users]

@router.get("/payments")
def get_all_payments(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    payments = db.query(Payment).order_by(Payment.created_at.desc()).limit(100).all()
    return payments


# =========================================================================
# THEATRE & SCREEN LAYOUT MANAGER ENDPOINTS
# =========================================================================

@router.get("/theatres")
def get_admin_theatres(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
) -> List[Dict[str, Any]]:
    """
    List all theatres with screen counts, formats, and demo theatre flags.
    """
    theatres = db.query(Theatre).order_by(Theatre.is_demo.desc(), Theatre.id.asc()).all()
    result = []
    for t in theatres:
        screens = []
        for s in t.screens:
            screens.append({
                "id": s.id,
                "screen_number": s.screen_number,
                "name": s.name,
                "total_seats": s.total_seats,
                "has_custom_layout": bool(s.layout_config),
            })
        result.append({
            "id": t.id,
            "name": t.name,
            "city": t.city,
            "address": t.address,
            "formats": t.formats,
            "is_demo": bool(t.is_demo),
            "description": t.description,
            "screens_count": len(screens),
            "screens": screens,
        })
    return result


@router.post("/theatres")
def create_theatre(
    req: TheatreCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
) -> Dict[str, Any]:
    """
    Create a new cinema theatre or demo classroom hall.
    """
    new_theatre = Theatre(
        name=req.name,
        city=req.city,
        address=req.address,
        formats=req.formats,
        is_demo=req.is_demo,
        description=req.description,
    )
    db.add(new_theatre)
    db.commit()
    db.refresh(new_theatre)

    return {
        "id": new_theatre.id,
        "name": new_theatre.name,
        "city": new_theatre.city,
        "address": new_theatre.address,
        "formats": new_theatre.formats,
        "is_demo": new_theatre.is_demo,
        "description": new_theatre.description,
        "message": f"Theatre '{new_theatre.name}' created successfully."
    }


@router.get("/theatres/{theatre_id}")
def get_theatre_detail(
    theatre_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
) -> Dict[str, Any]:
    theatre = db.query(Theatre).filter(Theatre.id == theatre_id).first()
    if not theatre:
        raise HTTPException(status_code=404, detail="Theatre not found.")
    
    screens = [
        {
            "id": s.id,
            "screen_number": s.screen_number,
            "name": s.name,
            "total_seats": s.total_seats,
            "has_custom_layout": bool(s.layout_config),
        }
        for s in theatre.screens
    ]

    return {
        "id": theatre.id,
        "name": theatre.name,
        "city": theatre.city,
        "address": theatre.address,
        "formats": theatre.formats,
        "is_demo": bool(theatre.is_demo),
        "description": theatre.description,
        "screens_count": len(screens),
        "screens": screens,
    }


@router.put("/theatres/{theatre_id}")
def update_theatre(
    theatre_id: int,
    req: TheatreUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
) -> Dict[str, Any]:
    theatre = db.query(Theatre).filter(Theatre.id == theatre_id).first()
    if not theatre:
        raise HTTPException(status_code=404, detail="Theatre not found.")

    if req.name is not None:
        theatre.name = req.name
    if req.city is not None:
        theatre.city = req.city
    if req.address is not None:
        theatre.address = req.address
    if req.formats is not None:
        theatre.formats = req.formats
    if req.is_demo is not None:
        theatre.is_demo = req.is_demo
    if req.description is not None:
        theatre.description = req.description

    db.commit()
    db.refresh(theatre)
    return {
        "id": theatre.id,
        "name": theatre.name,
        "city": theatre.city,
        "is_demo": theatre.is_demo,
        "description": theatre.description,
        "message": f"Theatre '{theatre.name}' updated successfully."
    }


@router.delete("/theatres/{theatre_id}")
def delete_theatre(
    theatre_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
) -> Dict[str, str]:
    theatre = db.query(Theatre).filter(Theatre.id == theatre_id).first()
    if not theatre:
        raise HTTPException(status_code=404, detail="Theatre not found.")

    db.delete(theatre)
    db.commit()
    return {"message": f"Theatre '{theatre.name}' deleted successfully."}


@router.post("/theatres/{theatre_id}/screens")
def create_theatre_screen(
    theatre_id: int,
    screen_number: int,
    name: str,
    total_seats: int = 30,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
) -> Dict[str, Any]:
    theatre = db.query(Theatre).filter(Theatre.id == theatre_id).first()
    if not theatre:
        raise HTTPException(status_code=404, detail="Theatre not found.")

    screen = Screen(
        theatre_id=theatre_id,
        screen_number=screen_number,
        name=name,
        total_seats=total_seats
    )
    db.add(screen)
    db.commit()
    db.refresh(screen)

    return {
        "id": screen.id,
        "screen_number": screen.screen_number,
        "name": screen.name,
        "total_seats": screen.total_seats,
        "theatre_id": theatre_id,
        "message": f"Screen '{screen.name}' created successfully."
    }


@router.get("/screens/{screen_id}/layout")
def get_screen_layout_detail(
    screen_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
) -> Dict[str, Any]:
    """
    Retrieves full layout configuration and current seats for visual editing.
    """
    screen = db.query(Screen).filter(Screen.id == screen_id).first()
    if not screen:
        raise HTTPException(status_code=404, detail=f"Screen #{screen_id} not found.")

    # Check confirmed bookings on this screen
    booked_count = (
        db.query(func.count(BookingSeat.id))
        .join(Seat, BookingSeat.seat_id == Seat.id)
        .filter(Seat.screen_id == screen_id)
        .scalar()
        or 0
    )

    # Get booked seat IDs
    booked_seat_ids = set(
        row[0]
        for row in db.query(BookingSeat.seat_id)
        .join(Seat, BookingSeat.seat_id == Seat.id)
        .filter(Seat.screen_id == screen_id)
        .all()
    )

    seats = db.query(Seat).filter(Seat.screen_id == screen_id).order_by(Seat.row_label, Seat.seat_number).all()
    seats_data = [
        {
            "id": s.id,
            "row_label": s.row_label,
            "seat_number": s.seat_number,
            "label": f"{s.row_label}{s.seat_number}",
            "tier": s.tier,
            "is_booked": s.id in booked_seat_ids,
        }
        for s in seats
    ]

    layout_cfg = None
    if screen.layout_config:
        try:
            layout_cfg = json.loads(screen.layout_config)
        except Exception:
            layout_cfg = None

    return {
        "screen_id": screen.id,
        "screen_name": screen.name,
        "screen_number": screen.screen_number,
        "theatre_id": screen.theatre_id,
        "theatre_name": screen.theatre.name if screen.theatre else "Theatre",
        "is_demo": bool(screen.theatre.is_demo) if screen.theatre else False,
        "total_seats": screen.total_seats,
        "layout_config": layout_cfg,
        "seats": seats_data,
        "booked_seats_count": booked_count,
    }


@router.put("/screens/{screen_id}/layout")
def save_screen_layout_endpoint(
    screen_id: int,
    req: SaveLayoutRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
) -> Dict[str, Any]:
    """
    Saves visual layout configuration, updates coordinates & aisles,
    and synchronizes database seat rows while protecting existing bookings.
    """
    screen = save_screen_layout_config(
        db=db,
        screen_id=screen_id,
        layout_data=req.layout.model_dump(),
        screen_name=req.screen_name
    )

    layout_cfg = json.loads(screen.layout_config) if screen.layout_config else None

    return {
        "screen_id": screen.id,
        "screen_name": screen.name,
        "total_seats": screen.total_seats,
        "layout_config": layout_cfg,
        "message": f"Layout for screen '{screen.name}' saved and synced successfully."
    }


@router.post("/screens/{screen_id}/preview")
def preview_layout_geometry(
    screen_id: int,
    req: ScreenLayoutConfig,
    admin: User = Depends(get_current_admin)
) -> Dict[str, Any]:
    """
    Preview layout geometry on the fly without writing to the database.
    """
    layout_dict = req.model_dump()
    validate_layout_config(layout_dict)
    computed = compute_layout_geometry(layout_dict)
    return computed


@router.post("/theatres/demo-classroom")
def setup_college_demo_classroom(
    req: DemoClassroomPresetRequest = DemoClassroomPresetRequest(),
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
) -> Dict[str, Any]:
    """
    1-click instant setup: Creates/reconfigures College Demo Theatre & Screen 1
    with 5 rows (A-E), 6 seats per row, central aisle between 3 & 4.
    """
    res = create_demo_classroom_theatre(db, req)
    return res

