from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

class NavigationBookingInfoResponse(BaseModel):
    booking_id: int
    booking_code: str
    movie_title: str
    movie_poster: Optional[str] = None
    theatre_name: str
    theatre_city: str
    screen_id: int
    screen_name: str
    screen_format: str
    show_time: datetime
    booked_seats: List[Dict[str, Any]]
    default_seat_id: int

class SeatCoordinate(BaseModel):
    id: int
    row_label: str
    seat_number: int
    label: str
    tier: str
    x: float
    y: float
    is_accessible: bool = False
    is_booked_by_user: bool = False

class ScreenMapResponse(BaseModel):
    screen_id: int
    screen_name: str
    screen_format: str
    theatre_name: str
    dimensions: Dict[str, float]
    screen_element: Dict[str, Any]
    entrance: Dict[str, Any]
    exit: Dict[str, Any]
    aisles: List[Dict[str, Any]]
    seats: List[SeatCoordinate]
    rows: List[str]
    row_positions: Dict[str, float]
    checkpoints: List[Dict[str, Any]]

class StartSessionRequest(BaseModel):
    booking_id: int
    target_seat_id: Optional[int] = None

class Point2D(BaseModel):
    x: float
    y: float

class NavigationSessionResponse(BaseModel):
    session_id: str
    booking_id: int
    show_id: int
    screen_id: int
    target_seat_id: int
    target_seat_label: str
    current_x: float
    current_y: float
    navigation_status: str
    status_message: str
    route: List[Dict[str, float]]
    remaining_distance: float
    remaining_steps: int
    current_instruction: str
    positioning_source: str
    is_target_row_active: bool
    is_seat_reached: bool

class UpdateLocationRequest(BaseModel):
    x: float = Field(..., ge=0.0, le=100.0)
    y: float = Field(..., ge=0.0, le=100.0)
    source: Optional[str] = "SIMULATION"

class CompleteSessionResponse(BaseModel):
    session_id: str
    status: str
    message: str
    completed_at: datetime

