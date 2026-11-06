from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from app.database import Base

class Show(Base):
    __tablename__ = "shows"

    id = Column(Integer, primary_key=True, index=True)
    movie_id = Column(Integer, ForeignKey("movies.id", ondelete="CASCADE"), nullable=False)
    theatre_id = Column(Integer, ForeignKey("theatres.id", ondelete="CASCADE"), nullable=False)
    screen_id = Column(Integer, ForeignKey("screens.id", ondelete="CASCADE"), nullable=False)
    show_time = Column(DateTime, nullable=False)
    screen_format = Column(String(50), default="2D")  # 2D, 3D, IMAX
    silver_price = Column(Float, default=180.0)
    gold_price = Column(Float, default=280.0)
    platinum_price = Column(Float, default=420.0)

    movie = relationship("Movie", back_populates="shows")
    theatre = relationship("Theatre", back_populates="shows")
    screen = relationship("Screen", back_populates="shows")
    bookings = relationship("Booking", back_populates="show", cascade="all, delete-orphan")
    seat_locks = relationship("SeatLock", back_populates="show", cascade="all, delete-orphan")

