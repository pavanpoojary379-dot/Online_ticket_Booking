from pydantic import BaseModel

class CouponValidateRequest(BaseModel):
    code: str
    amount: float

class CouponValidateResponse(BaseModel):
    valid: bool
    code: str
    discount_percent: float
    discount_amount: float
    final_amount: float
    message: str

