from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Dict, Any
from app.schemas.show import SeatOut

class SeatRecommendationRequest(BaseModel):
    show_id: int
    number_of_seats: int = Field(default=2, ge=1, le=10, description="Number of tickets required (1 to 10)")
    preferred_category: Optional[str] = Field(default="ANY", description="Preferred seat category: SILVER, GOLD, PLATINUM, ANY")
    maximum_budget: Optional[float] = Field(default=None, description="Maximum budget per ticket (in INR)")
    seating_preference: Optional[str] = Field(
        default="best_view",
        description="Seating preference: best_view, centre, front, back, adjacent"
    )
    adjacent_required: bool = Field(default=True, description="Whether all seats must be strictly adjacent")

    @field_validator("preferred_category")
    @classmethod
    def normalize_category(cls, v: Optional[str]) -> Optional[str]:
        if not v or v.strip().upper() in ["ANY", "ALL", "NONE"]:
            return "ANY"
        val = v.strip().upper()
        if val not in ["SILVER", "GOLD", "PLATINUM"]:
            raise ValueError(f"Invalid seat category '{v}'. Allowed: Silver, Gold, Platinum, Any")
        return val

    @field_validator("seating_preference")
    @classmethod
    def normalize_preference(cls, v: Optional[str]) -> str:
        if not v:
            return "best_view"
        val = v.strip().lower()
        allowed = ["best_view", "centre", "front", "back", "adjacent"]
        if val not in allowed:
            raise ValueError(f"Invalid seating preference '{v}'. Allowed: {', '.join(allowed)}")
        return val


class SeatScoreBreakdown(BaseModel):
    central_position_score: float
    viewing_distance_score: float
    adjacent_seating_score: float
    budget_score: float


class SeatRecommendationItem(BaseModel):
    rank: int
    score: float
    seat_ids: List[int]
    seat_labels: List[str]
    seats: List[SeatOut]
    seat_category: str
    row: str
    individual_price: float
    total_price: float
    score_breakdown: SeatScoreBreakdown
    explanation: List[str]
    summary_reason: str


class SeatRecommendationsResponse(BaseModel):
    show_id: int
    number_of_seats: int
    total_recommendations: int
    recommendations: List[SeatRecommendationItem]
    message: Optional[str] = None


class TierPreferenceInfo(BaseModel):
    name: str
    label: str
    price: float
    available_count: int


class ShowPreferencesResponse(BaseModel):
    show_id: int
    movie_title: str
    theatre_name: str
    screen_name: str
    screen_format: str
    available_seats_count: int
    total_seats_count: int
    tiers: List[TierPreferenceInfo]
    min_price: float
    max_price: float
    seating_preferences: List[Dict[str, str]]
    max_tickets_allowed: int = 10
