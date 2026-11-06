from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.models.user import User
from app.utils.auth import get_current_user
from app.schemas.navigation import (
    NavigationBookingInfoResponse,
    ScreenMapResponse,
    StartSessionRequest,
    NavigationSessionResponse,
    UpdateLocationRequest,
    CompleteSessionResponse,
)
from app.services.indoor_navigation_service import (
    generate_screen_blueprint,
    get_navigation_booking_info,
    start_or_resume_session,
    update_session_location,
    complete_session,
)
from app.models.navigation import NavigationSession
from app.models.booking import Booking

router = APIRouter(prefix="/api/navigation", tags=["Indoor Navigation"])

@router.get("/booking/{booking_id}", response_model=NavigationBookingInfoResponse)
def get_booking_nav_info(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Validates user booking for navigation, retrieving screen, theatre, and booked seat details.
    """
    return get_navigation_booking_info(
        db=db,
        booking_id=booking_id,
        user_id=current_user.id,
        is_admin=current_user.is_admin,
    )

@router.get("/screen/{screen_id}/map", response_model=ScreenMapResponse)
def get_screen_map(
    screen_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieves the complete 2D cinema auditorium blueprint for the requested screen.
    """
    return generate_screen_blueprint(db=db, screen_id=screen_id)

@router.post("/session/start", response_model=NavigationSessionResponse)
def start_navigation_session(
    req: StartSessionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Starts or resumes an indoor navigation session to guide the user to their seat.
    """
    return start_or_resume_session(
        db=db,
        booking_id=req.booking_id,
        user_id=current_user.id,
        target_seat_id=req.target_seat_id,
        is_admin=current_user.is_admin,
    )

@router.get("/session/{session_id}", response_model=NavigationSessionResponse)
def get_navigation_session(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieves the current state and path of an active navigation session.
    """
    session = db.query(NavigationSession).filter(NavigationSession.session_id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Navigation session not found.")

    if not current_user.is_admin and session.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Unauthorized access to navigation session.")

    return update_session_location(
        db=db,
        session_id=session_id,
        x=session.current_x,
        y=session.current_y,
        user_id=current_user.id,
        source=session.positioning_source,
        is_admin=current_user.is_admin,
    )

@router.patch("/session/{session_id}/location", response_model=NavigationSessionResponse)
def update_location(
    session_id: str,
    req: UpdateLocationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Updates the customer's estimated position (x, y) and recalculates the navigation state & route.
    """
    return update_session_location(
        db=db,
        session_id=session_id,
        x=req.x,
        y=req.y,
        user_id=current_user.id,
        source=req.source or "SIMULATION",
        is_admin=current_user.is_admin,
    )

@router.post("/session/{session_id}/complete", response_model=CompleteSessionResponse)
def finish_session(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Marks the navigation session as completed upon reaching the seat.
    """
    return complete_session(
        db=db,
        session_id=session_id,
        user_id=current_user.id,
        is_admin=current_user.is_admin,
    )

