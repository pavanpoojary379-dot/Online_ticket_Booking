from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.models.movie import Movie
from app.models.user import User
from app.schemas.movie import MovieOut, MovieCreate, MovieUpdate
from app.utils.auth import get_current_admin

router = APIRouter(prefix="/api/movies", tags=["Movies"])

@router.get("", response_model=List[MovieOut])
def list_movies(
    search: Optional[str] = None,
    genre: Optional[str] = None,
    language: Optional[str] = None,
    is_now_showing: Optional[bool] = None,
    is_upcoming: Optional[bool] = None,
    is_popular: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Movie)
    if search:
        query = query.filter(Movie.title.ilike(f"%{search}%"))
    if genre and genre.lower() != "all":
        query = query.filter(Movie.genre.ilike(f"%{genre}%"))
    if language and language.lower() != "all":
        query = query.filter(Movie.language.ilike(f"%{language}%"))
    if is_now_showing is not None:
        query = query.filter(Movie.is_now_showing == is_now_showing)
    if is_upcoming is not None:
        query = query.filter(Movie.is_upcoming == is_upcoming)
    if is_popular is not None:
        query = query.filter(Movie.is_popular == is_popular)

    return query.order_by(Movie.rating.desc(), Movie.id.desc()).all()

@router.get("/{movie_id}", response_model=MovieOut)
def get_movie(movie_id: int, db: Session = Depends(get_db)):
    movie = db.query(Movie).filter(Movie.id == movie_id).first()
    if not movie:
        raise HTTPException(status_code=404, detail="Movie not found")
    return movie

@router.post("", response_model=MovieOut, status_code=status.HTTP_201_CREATED)
def create_movie(
    movie_in: MovieCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    movie = Movie(**movie_in.dict())
    db.add(movie)
    db.commit()
    db.refresh(movie)
    return movie

@router.put("/{movie_id}", response_model=MovieOut)
def update_movie(
    movie_id: int,
    movie_in: MovieUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    movie = db.query(Movie).filter(Movie.id == movie_id).first()
    if not movie:
        raise HTTPException(status_code=404, detail="Movie not found")

    update_data = movie_in.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(movie, key, value)

    db.commit()
    db.refresh(movie)
    return movie

@router.delete("/{movie_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_movie(
    movie_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    movie = db.query(Movie).filter(Movie.id == movie_id).first()
    if not movie:
        raise HTTPException(status_code=404, detail="Movie not found")

    db.delete(movie)
    db.commit()
    return None

