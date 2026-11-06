from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, date
from app.database import get_db
from app.models.show import Show
from app.models.theatre import Theatre
from app.models.user import User
from app.schemas.show import ShowOut, SeatOut, SeatRecommendationRequest, SeatRecommendationResponse
from app.schemas.movie import MovieOut
from app.schemas.theatre import TheatreOut
from app.services.booking_service import get_seat_layout_with_status, smart_seat_recommendation
from app.utils.auth import get_optional_current_user

router = APIRouter(prefix="/api/shows", tags=["Shows"])

def _build_show_out(s: Show, db: Session) -> ShowOut:
    theatre_out = None
    if s.theatre:
        theatre_out = TheatreOut(
            id=s.theatre.id,
            name=s.theatre.name,
            city=s.theatre.city,
            address=s.theatre.address,
            formats=[f.strip() for f in (s.theatre.formats or "2D").split(",")]
        )
    movie_out = MovieOut.from_orm(s.movie) if s.movie else None
    
    # Calculate available seats count
    layout = get_seat_layout_with_status(db, s.id)
    avail = sum(1 for seat in layout if seat["status"] == "AVAILABLE")
    total = len(layout)

    return ShowOut(
        id=s.id,
        movie_id=s.movie_id,
        theatre_id=s.theatre_id,
        screen_id=s.screen_id,
        screen_number=s.screen.screen_number if s.screen else s.screen_id,
        screen_name=s.screen.name if s.screen else f"Screen {s.screen_id}",
        show_time=s.show_time,
        screen_format=s.screen_format,
        silver_price=s.silver_price,
        gold_price=s.gold_price,
        platinum_price=s.platinum_price,
        movie=movie_out,
        theatre=theatre_out,
        available_seats=avail,
        total_seats=total
    )

@router.get("", response_model=List[ShowOut])
def list_shows(
    movie_id: Optional[int] = None,
    theatre_id: Optional[int] = None,
    city: Optional[str] = None,
    show_date: Optional[str] = None, # YYYY-MM-DD
    format: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Show)
    if movie_id:
        query = query.filter(Show.movie_id == movie_id)
    if theatre_id:
        query = query.filter(Show.theatre_id == theatre_id)
    if city and city.lower() != "all":
        query = query.join(Theatre).filter(Theatre.city.ilike(f"%{city}%"))
    if format and format.lower() != "all":
        query = query.filter(Show.screen_format.ilike(f"%{format}%"))
    if show_date:
        try:
            target_date = datetime.strptime(show_date, "%Y-%m-%d").date()
            start_dt = datetime.combine(target_date, datetime.min.time())
            end_dt = datetime.combine(target_date, datetime.max.time())
            query = query.filter(Show.show_time >= start_dt, Show.show_time <= end_dt)
        except ValueError:
            pass

    shows = query.order_by(Show.show_time.asc()).all()
    return [_build_show_out(s, db) for s in shows]

@router.get("/{show_id}", response_model=ShowOut)
def get_show(show_id: int, db: Session = Depends(get_db)):
    show = db.query(Show).filter(Show.id == show_id).first()
    if not show:
        raise HTTPException(status_code=404, detail="Show not found")
    return _build_show_out(show, db)

@router.get("/{show_id}/seats", response_model=List[SeatOut])
def get_seats(
    show_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    user_id = current_user.id if current_user else None
    return get_seat_layout_with_status(db, show_id, current_user_id=user_id)

@router.post("/{show_id}/recommend-seats", response_model=SeatRecommendationResponse)
def recommend_seats(
    show_id: int,
    req: SeatRecommendationRequest,
    db: Session = Depends(get_db)
):
    rec = smart_seat_recommendation(db, show_id, num_seats=req.num_seats, preferred_tier=req.preferred_tier)
    return rec

