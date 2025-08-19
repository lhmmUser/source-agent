# app/db.py
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from app.config import get_settings

# Load settings (DATABASE_URL should come from env or Secrets Manager)
settings = get_settings()

# SQLAlchemy engine
engine = create_engine(
    settings.DATABASE_URL,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
)

# ✅ Debug print (masking password for safety)
url = engine.url
print(f"[DB] Connected engine -> host={url.host}, db={url.database}, user={url.username}")

# Session factory
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)

# Base class for models
Base = declarative_base()

def ensure_extensions():
    """Make sure pgvector extension is installed."""
    with engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        conn.commit()

# Dependency for FastAPI routes
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
