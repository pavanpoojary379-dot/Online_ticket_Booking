from sqlalchemy import Column, Integer, String, Text, Float, Boolean, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class Movie(Base):
    __tablename__ = "movies"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), index=True, nullable=False)
    description = Column(Text, nullable=False)
    poster_url = Column(String(500), nullable=False)
    backdrop_url = Column(String(500), nullable=True)
    trailer_url = Column(String(500), nullable=True)
    genre = Column(String(255), nullable=False)
    duration_minutes = Column(Integer, nullable=False)
    release_date = Column(String(50), nullable=False)
    language = Column(String(50), nullable=False)
    rating = Column(Float, default=8.0)
    certificate = Column(String(10), default="UA")
    is_now_showing = Column(Boolean, default=True)
    is_upcoming = Column(Boolean, default=False)
    is_popular = Column(Boolean, default=False)
    cast = Column(String(500), nullable=True)
    director = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    shows = relationship("Show", back_populates="movie", cascade="all, delete-orphan")

