from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class TheatreCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=255)
    city: str = Field(..., min_length=2, max_length=100)
    address: str = Field(..., min_length=3, max_length=500)
    formats: str = Field(default="2D,3D,IMAX")
    is_demo: bool = Field(default=False)
    description: Optional[str] = None

class TheatreUpdate(BaseModel):
    name: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None
    formats: Optional[str] = None
    is_demo: Optional[bool] = None
    description: Optional[str] = None

class ScreenBrief(BaseModel):
    id: int
    screen_number: int
    name: str
    total_seats: int
    has_custom_layout: bool = False

    class Config:
        from_attributes = True

class TheatreAdminResponse(BaseModel):
    id: int
    name: str
    city: str
    address: str
    formats: str
    is_demo: bool
    description: Optional[str] = None
    screens_count: int = 0
    screens: List[ScreenBrief] = []

    class Config:
        from_attributes = True

class CustomSeatConfig(BaseModel):
    row_label: str
    seat_number: int
    tier: str = "SILVER"
    x: Optional[float] = None
    y: Optional[float] = None
    is_accessible: bool = False

class AisleConfig(BaseModel):
    id: str
    name: str
    type: str  # "VERTICAL" or "HORIZONTAL"
    x: Optional[float] = None
    y: Optional[float] = None
    width: Optional[float] = None
    height: Optional[float] = None
    x1: Optional[float] = None
    x2: Optional[float] = None
    y1: Optional[float] = None
    y2: Optional[float] = None

class ScreenLayoutConfig(BaseModel):
    rows: List[str] = ["A", "B", "C", "D", "E"]
    seats_per_row: int = 6
    aisle_after_seat: int = 3
    side_aisles: bool = True
    screen_position: str = "FRONT"  # "FRONT" | "BACK"
    entrance_position: str = "BACK_CENTER"  # "BACK_CENTER" | "BACK_LEFT" | "BACK_RIGHT" | "FRONT_LEFT" | "FRONT_RIGHT"
    exit_position: str = "FRONT_LEFT"
    aisles: Optional[List[AisleConfig]] = None
    custom_seats: Optional[List[CustomSeatConfig]] = None
    row_positions: Optional[Dict[str, float]] = None
    is_demo_preset: bool = False
    preset_name: Optional[str] = None

class SaveLayoutRequest(BaseModel):
    screen_name: Optional[str] = None
    layout: ScreenLayoutConfig

class ScreenLayoutDetailResponse(BaseModel):
    screen_id: int
    screen_name: str
    screen_number: int
    theatre_id: int
    theatre_name: str
    is_demo: bool
    total_seats: int
    layout_config: Optional[Dict[str, Any]] = None
    seats: List[Dict[str, Any]]
    booked_seats_count: int = 0

class DemoClassroomPresetRequest(BaseModel):
    theatre_name: str = "College Demo Theatre"
    city: str = "Campus Auditorium"
    address: str = "Seminar Hall 101 - Temporary Cinema Setup"
    description: str = "Temporary classroom arrangement for indoor seat navigation demonstration."
    screen_name: str = "Screen 1"
    num_rows: int = 5
    seats_per_row: int = 6
    aisle_after_seat: int = 3

