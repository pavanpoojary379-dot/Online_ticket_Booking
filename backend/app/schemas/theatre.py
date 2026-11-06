from pydantic import BaseModel
from typing import List, Optional

class ScreenOut(BaseModel):
    id: int
    theatre_id: int
    screen_number: int
    name: str
    total_seats: int

    class Config:
        from_attributes = True

class TheatreOut(BaseModel):
    id: int
    name: str
    city: str
    address: str
    formats: List[str]

    class Config:
        from_attributes = True
