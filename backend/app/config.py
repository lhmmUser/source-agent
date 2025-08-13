from pydantic_settings import BaseSettings
from pydantic import Field
from functools import lru_cache

class Settings(BaseSettings):
    OPENAI_API_KEY: str
    # DATABASE_URL: str | None = None  # <-- Now optional

    OPENAI_MODEL: str = "gpt-4.1-mini"
    OPENAI_EMBED_MODEL: str = "text-embedding-3-large"

    BACKEND_HOST: str = "127.0.0.1"
    BACKEND_PORT: int = 8000
    CORS_ORIGINS: str = "http://localhost:3000"

    TOP_K: int = 6
    MIN_SCORE: float = 0.15
    CHUNK_SIZE: int = 1200
    CHUNK_OVERLAP: int = 200

    class Config:
        env_file = ".env"

@lru_cache()
def get_settings() -> Settings:
    return Settings()
