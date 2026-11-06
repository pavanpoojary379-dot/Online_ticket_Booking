from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models.theatre import Theatre
from app.schemas.theatre import TheatreOut

router = APIRouter(prefix="/api/theatres", tags=["Theatres"])

@router.get("", response_model=List[TheatreOut])
def list_theatres(city: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(Theatre)
    if city and city.lower() != "all":
        query = query.filter(Theatre.city.ilike(f"%{city}%"))
    theatres = query.all()
    # parse comma-separated formats into list
    result = []
    for t in theatres:
        result.append(TheatreOut(
            id=t.id,
            name=t.name,
            city=t.city,
            address=t.address,
            formats=[f.strip() for f in (t.formats or "2D").split(",")]
        ))
    return result

@router.get("/{theatre_id}", response_model=TheatreOut)
def get_theatre(theatre_id: int, db: Session = Depends(get_db)):
    t = db.query(Theatre).filter(Theatre.id == theatre_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Theatre not found")
    return TheatreOut(
        id=t.id,
        name=t.name,
        city=t.city,
        address=t.address,
        formats=[f.strip() for f in (t.formats or "2D").split(",")]
    )

