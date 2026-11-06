from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.recommendation import (
    SeatRecommendationRequest,
    SeatRecommendationsResponse,
    ShowPreferencesResponse,
)
from app.services.seat_recommendation_service import (
    recommend_seats_intelligent,
    get_show_preferences,
)

router = APIRouter(prefix="/api/seat-recommendations", tags=["Seat Recommendations"])

@router.post("", response_model=SeatRecommendationsResponse)
def get_seat_recommendations(
    req: SeatRecommendationRequest,
    db: Session = Depends(get_db)
):
    """
    Intelligent weighted multi-factor seat recommendation endpoint.
    Considers central positioning, viewing distance, adjacency, and budget preferences.
    """
    return recommend_seats_intelligent(db, req)

@router.get("/{show_id}/preferences", response_model=ShowPreferencesResponse)
def get_preferences(
    show_id: int,
    db: Session = Depends(get_db)
):
    """
    Returns available seating preference options, category counts, and price bounds for a show.
    """
    return get_show_preferences(db, show_id)
