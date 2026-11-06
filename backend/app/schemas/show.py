from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from app.schemas.movie import MovieOut
from app.schemas.theatre import TheatreOut

class ShowOut(BaseModel):
    id: int
    movie_id: int
    theatre_id: int
    screen_id: int
    show_time: datetime
    screen_format: str
    silver_price: float
    gold_price: float
    platinum_price: float
    movie: Optional[MovieOut] = None
    theatre: Optional[TheatreOut] = None
    available_seats: Optional[int] = None
    total_seats: Optional[int] = None

    class Config:
        from_attributes = True

class SeatOut(BaseModel):
    id: int
    row_label: str
    seat_number: int
    tier: str
    price: float
    status: str  # AVAILABLE, SELECTED, BOOKED, LOCKED

    class Config:
        from_attributes = True

class SeatRecommendationRequest(BaseModel):
    num_seats: int = 2
    preferred_tier: Optional[str] = None  # SILVER, GOLD, PLATINUM

class SeatRecommendationResponse(BaseModel):
    seats: List[SeatOut]
    total_price: float
    reason: str

