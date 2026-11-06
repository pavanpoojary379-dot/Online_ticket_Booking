from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.coupon import Coupon
from app.schemas.coupon import CouponValidateRequest, CouponValidateResponse

router = APIRouter(prefix="/api/coupons", tags=["Coupons"])

@router.get("")
def list_available_coupons(db: Session = Depends(get_db)):
    coupons = db.query(Coupon).filter(Coupon.is_active == True).all()
    return coupons

@router.post("/validate", response_model=CouponValidateResponse)
def validate_coupon(req: CouponValidateRequest, db: Session = Depends(get_db)):
    code_clean = req.code.upper().strip()
    coupon = db.query(Coupon).filter(
        Coupon.code == code_clean,
        Coupon.is_active == True
    ).first()

    if not coupon:
        raise HTTPException(status_code=400, detail="Invalid coupon code. Try FIRST10, CINE20, or STUDENT15.")

    if req.amount < coupon.min_amount:
        raise HTTPException(
            status_code=400,
            detail=f"Coupon requires a minimum booking subtotal of Rs. {coupon.min_amount:.0f}"
        )

    discount_amount = round((req.amount * coupon.discount_percent) / 100.0, 2)
    final_amount = max(0.0, req.amount - discount_amount)

    return CouponValidateResponse(
        valid=True,
        code=coupon.code,
        discount_percent=coupon.discount_percent,
        discount_amount=discount_amount,
        final_amount=final_amount,
        message=f"{coupon.discount_percent:.0f}% discount applied successfully ({coupon.description})!"
    )

