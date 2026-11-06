from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.payment import Payment
from app.schemas.payment import ProcessPaymentRequest
from app.services.payment_service import process_simulated_payment
from app.utils.auth import get_current_user

router = APIRouter(prefix="/api/payments", tags=["Payments"])

@router.post("/process")
def make_payment(
    req: ProcessPaymentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = process_simulated_payment(
        db=db,
        booking_id=req.booking_id,
        user_id=current_user.id,
        payment_method=req.payment_method,
        simulate_status=req.simulate_status or "SUCCESS",
        failure_reason=req.failure_reason
    )
    return result

@router.get("/{payment_id}")
def get_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment record not found")
    if payment.booking.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
    return payment

