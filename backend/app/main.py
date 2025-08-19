# app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.routers import ingest, chat
from app.routers import debug as debug_router
from app.db import ensure_extensions, engine, Base

app = FastAPI(title="LLM Agent Backend")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(ingest.router)
app.include_router(chat.router)
app.include_router(debug_router.router)

# Static file serving
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

@app.get("/health")
def health():
    return {"status": "ok"}

@app.on_event("startup")
def on_startup():
    # Ensure pgvector is enabled
    ensure_extensions()
    # Create tables if not already present
    Base.metadata.create_all(bind=engine)  
    # ⚠️ In real production, you’d typically use Alembic migrations instead
