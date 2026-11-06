import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

# Database configuration: defaults to SQLite fallback, or PostgreSQL if configured
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR}/cinebook.db")

# Security
SECRET_KEY = os.getenv("SECRET_KEY", "cinebook-hackathon-super-secret-jwt-key-2026")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

# Seat locking duration in seconds (5 minutes)
SEAT_LOCK_DURATION_SECONDS = 300

# File storage
UPLOADS_DIR = BASE_DIR / "uploads"
QRCODES_DIR = UPLOADS_DIR / "qrcodes"
TICKETS_DIR = UPLOADS_DIR / "tickets"

QRCODES_DIR.mkdir(parents=True, exist_ok=True)
TICKETS_DIR.mkdir(parents=True, exist_ok=True)

# TMDB API (Optional fallback)
TMDB_API_KEY = os.getenv("TMDB_API_KEY", "")

