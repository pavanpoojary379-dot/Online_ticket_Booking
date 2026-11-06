from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class NavigationSession(Base):
    __tablename__ = "navigation_sessions"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(50), unique=True, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    booking_id = Column(Integer, ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False)
    show_id = Column(Integer, ForeignKey("shows.id", ondelete="CASCADE"), nullable=False)
    screen_id = Column(Integer, ForeignKey("screens.id", ondelete="CASCADE"), nullable=False)
    target_seat_id = Column(Integer, ForeignKey("seats.id", ondelete="CASCADE"), nullable=False)
    current_x = Column(Float, default=50.0)
    current_y = Column(Float, default=95.0)
    navigation_status = Column(String(50), default="ENTERING_AUDITORIUM")
    positioning_source = Column(String(50), default="SIMULATION")
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    user = relationship("User")
    booking = relationship("Booking")
    show = relationship("Show")
    screen = relationship("Screen")
    target_seat = relationship("Seat")

