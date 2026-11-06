from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config import DATABASE_URL

connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    echo=False
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def ensure_schema_migrations():
    """
    Applies non-destructive schema migrations for existing databases (e.g. SQLite).
    Ensures new columns added to models are present in tables.
    """
    with engine.begin() as conn:
        # Check columns for theatres table
        try:
            theatre_cols = [row[1] for row in conn.execute(text("PRAGMA table_info(theatres);")).fetchall()]
            if theatre_cols and "is_demo" not in theatre_cols:
                conn.execute(text("ALTER TABLE theatres ADD COLUMN is_demo BOOLEAN DEFAULT 0;"))
            if theatre_cols and "description" not in theatre_cols:
                conn.execute(text("ALTER TABLE theatres ADD COLUMN description TEXT;"))
        except Exception as e:
            pass

        # Check columns for screens table
        try:
            screen_cols = [row[1] for row in conn.execute(text("PRAGMA table_info(screens);")).fetchall()]
            if screen_cols and "layout_config" not in screen_cols:
                conn.execute(text("ALTER TABLE screens ADD COLUMN layout_config TEXT;"))
        except Exception as e:
            pass

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


