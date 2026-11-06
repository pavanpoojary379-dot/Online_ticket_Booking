from sqlalchemy import Column, Integer, String, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from app.database import Base

class Seat(Base):
    __tablename__ = "seats"

    id = Column(Integer, primary_key=True, index=True)
    screen_id = Column(Integer, ForeignKey("screens.id", ondelete="CASCADE"), nullable=False)
    row_label = Column(String(5), nullable=False)  # "A", "B", "C", ...
    seat_number = Column(Integer, nullable=False)   # 1, 2, 3, ...
    tier = Column(String(20), nullable=False, default="SILVER")  # SILVER, GOLD, PLATINUM

    screen = relationship("Screen", back_populates="seats")
    booking_seats = relationship("BookingSeat", back_populates="seat", cascade="all, delete-orphan")
    seat_locks = relationship("SeatLock", back_populates="seat", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("screen_id", "row_label", "seat_number", name="uq_screen_row_seat"),
    )

