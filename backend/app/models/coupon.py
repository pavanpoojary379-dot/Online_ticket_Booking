from sqlalchemy import Column, Integer, String, Float, Boolean
from app.database import Base

class Coupon(Base):
    __tablename__ = "coupons"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, index=True, nullable=False)
    discount_percent = Column(Float, nullable=False)
    description = Column(String(255), nullable=False)
    min_amount = Column(Float, default=200.0)
    is_active = Column(Boolean, default=True)

