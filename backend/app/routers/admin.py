from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Dict, Any
from datetime import datetime, timedelta

from app.database import get_db
from app.models.user import User
from app.models.movie import Movie
from app.models.theatre import Theatre
from app.models.show import Show
from app.models.seat import Seat
from app.models.booking import Booking, BookingSeat
from app.models.payment import Payment
from app.utils.auth import get_current_admin
from app.routers.bookings import _format_booking_out

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

