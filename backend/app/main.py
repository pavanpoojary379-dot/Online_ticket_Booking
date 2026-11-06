from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from pathlib import Path

from app.database import engine, Base, SessionLocal
from app.config import UPLOADS_DIR
from app.seed_data import seed_database
import app.models
from app.routers import (
    auth,
    movies,
    theatres,
    shows,
    bookings,
    payments,
    tickets,
    coupons,
    admin,
    recommendations,
    navigation
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Create all database tables
    Base.metadata.create_all(bind=engine)
    # 2. Seed initial sample data if empty
    db = SessionLocal()
    try:
        seed_database(db)
    finally:
        db.close()
    yield

app = FastAPI(
    title="CineBook API",
    description="Smart Movie Ticket Booking Platform REST APIs",
    version="1.0.0",
    lifespan=lifespan
)

# CORS setup for frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static uploads directory for QR codes and PDF tickets
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

# Include Routers
app.include_router(auth.router)
app.include_router(movies.router)
app.include_router(theatres.router)
app.include_router(shows.router)
app.include_router(bookings.router)
app.include_router(payments.router)
app.include_router(tickets.router)
app.include_router(coupons.router)
app.include_router(admin.router)
app.include_router(recommendations.router)
app.include_router(navigation.router)

@app.get("/")
def root():
    return {
        "app": "CineBook API",
        "status": "online",
        "docs_url": "/docs",
        "version": "1.0.0"
    }

@app.get("/api/health")
def health():
    return {"status": "healthy"}

