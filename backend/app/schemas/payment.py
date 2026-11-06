from pydantic import BaseModel
from typing import Optional

class ProcessPaymentRequest(BaseModel):
    booking_id: int
    payment_method: str  # UPI, CREDIT_CARD, DEBIT_CARD, NET_BANKING, WALLET
    payment_details: Optional[dict] = None
    simulate_status: Optional[str] = "SUCCESS"  # "SUCCESS", "FAILED", "CANCELLED"
    failure_reason: Optional[str] = None

