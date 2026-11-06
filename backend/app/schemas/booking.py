from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from app.schemas.show import ShowOut

class HoldSeatsRequest(BaseModel):
    show_id: int
    seat_ids: List[int]

class ReleaseSeatsRequest(BaseModel):
    show_id: int
    seat_ids: List[int]

class VerifyLockRequest(BaseModel):
    show_id: int
    seat_ids: List[int]

class VerifyLockResponse(BaseModel):
    is_locked_by_user: bool
    expires_at: Optional[str] = None
    remaining_seconds: int = 0
    reason: Optional[str] = None
    seat_ids: Optional[List[int]] = None

class CreateBookingRequest(BaseModel):
    show_id: int
    seat_ids: List[int]
    coupon_code: Optional[str] = None

class BookingSeatOut(BaseModel):
    id: Optional[int] = None
    seat_id: int
    seat_label: str
    tier: str
    price: float

    class Config:
        from_attributes = True

class PaymentOut(BaseModel):
    id: int
    payment_method: str
    transaction_id: str
    amount: float
    status: str
    failure_reason: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class BookingOut(BaseModel):
    id: int
    booking_code: str
    user_id: int
    show_id: int
    status: str
    total_amount: float
    convenience_fee: float
    discount_amount: float
    final_amount: float
    coupon_code: Optional[str] = None
    created_at: datetime
    qr_code_path: Optional[str] = None
    pdf_ticket_path: Optional[str] = None
    show: Optional[ShowOut] = None
    seats: List[BookingSeatOut] = []
    payment: Optional[PaymentOut] = None

    class Config:
        from_attributes = True
