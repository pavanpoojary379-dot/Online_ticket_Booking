from sqlalchemy import Column, Integer, String, Text
from sqlalchemy.orm import relationship
from app.database import Base

class Theatre(Base):
    __tablename__ = "theatres"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    city = Column(String(100), index=True, nullable=False)
    address = Column(String(500), nullable=False)
    formats = Column(String(255), default="2D,3D,IMAX")  # comma-separated formats

    screens = relationship("Screen", back_populates="theatre", cascade="all, delete-orphan")
    shows = relationship("Show", back_populates="theatre", cascade="all, delete-orphan")

