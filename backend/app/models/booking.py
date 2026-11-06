from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class Booking(Base):
    __tablename__ = "bookings"

    id = Column(Integer, primary_key=True, index=True)
    booking_code = Column(String(50), unique=True, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    show_id = Column(Integer, ForeignKey("shows.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(20), default="PENDING", nullable=False)  # PENDING, CONFIRMED, CANCELLED
    total_amount = Column(Float, nullable=False)
    convenience_fee = Column(Float, default=30.0)
    discount_amount = Column(Float, default=0.0)
    final_amount = Column(Float, nullable=False)
    coupon_code = Column(String(50), nullable=True)
    qr_code_path = Column(String(500), nullable=True)
    pdf_ticket_path = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="bookings")
    show = relationship("Show", back_populates="bookings")
    seats = relationship("BookingSeat", back_populates="booking", cascade="all, delete-orphan")
    payment = relationship("Payment", back_populates="booking", uselist=False, cascade="all, delete-orphan")


class BookingSeat(Base):
    __tablename__ = "booking_seats"

    id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(Integer, ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False)
    seat_id = Column(Integer, ForeignKey("seats.id", ondelete="CASCADE"), nullable=False)
    tier = Column(String(20), nullable=False)
    price = Column(Float, nullable=False)

    booking = relationship("Booking", back_populates="seats")
    seat = relationship("Seat", back_populates="booking_seats")


class SeatLock(Base):
    __tablename__ = "seat_locks"

    id = Column(Integer, primary_key=True, index=True)
    show_id = Column(Integer, ForeignKey("shows.id", ondelete="CASCADE"), nullable=False)
    seat_id = Column(Integer, ForeignKey("seats.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    locked_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)

    show = relationship("Show", back_populates="seat_locks")
    seat = relationship("Seat", back_populates="seat_locks")
    user = relationship("User", back_populates="seat_locks")

    __table_args__ = (
        UniqueConstraint("show_id", "seat_id", name="uq_show_seat_lock"),
    )

