from pydantic_settings import BaseSettings
from pydantic import Field
from functools import lru_cache

class Settings(BaseSettings):
    OPENAI_API_KEY: str

    # Models
    OPENAI_MODEL: str = "gpt-4.1-mini"
    OPENAI_EMBED_MODEL: str = "text-embedding-3-small"  # <-- 1536 dims
    EMBEDDING_DIM: int = 1536                            # <-- keep in sync

    # Server
    BACKEND_HOST: str = "127.0.0.1"
    BACKEND_PORT: int = 8000
    CORS_ORIGINS: str = "http://localhost:3000"

    # Retrieval
    TOP_K: int = 6
    # pgvector returns smaller distances = better (cosine)
    MAX_DISTANCE: float = 0.35    # tune from data distribution

    # Chunking
    CHUNK_SIZE: int = 1200
    CHUNK_OVERLAP: int = 200

    # Database
    DATABASE_URL: str = "postgresql+psycopg2://postgres:o7rF?.?#5Q:ve[#yR5-!>dGRzkmz@agentdb.cpkaga6akmlt.ap-south-1.rds.amazonaws.com:5432/postgres"

    class Config:
        env_file = ".env"

@lru_cache()
def get_settings() -> Settings:
    return Settings()
