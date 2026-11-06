from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class MovieBase(BaseModel):
    title: str
    description: str
    poster_url: str
    backdrop_url: Optional[str] = None
    trailer_url: Optional[str] = None
    genre: str
    duration_minutes: int
    release_date: str
    language: str
    rating: float = 8.0
    certificate: str = "UA"
    is_now_showing: bool = True
    is_upcoming: bool = False
    is_popular: bool = False
    cast: Optional[str] = None
    director: Optional[str] = None

class MovieCreate(MovieBase):
    pass

class MovieUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    poster_url: Optional[str] = None
    backdrop_url: Optional[str] = None
    trailer_url: Optional[str] = None
    genre: Optional[str] = None
    duration_minutes: Optional[int] = None
    release_date: Optional[str] = None
    language: Optional[str] = None
    rating: Optional[float] = None
    certificate: Optional[str] = None
    is_now_showing: Optional[bool] = None
    is_upcoming: Optional[bool] = None
    is_popular: Optional[bool] = None
    cast: Optional[str] = None
    director: Optional[str] = None

class MovieOut(MovieBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

