# app/routers/debug.py
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from app.db import get_db, engine
from app.models import Document, Chunk
from app.services.vector_store import search_chunks


router = APIRouter(prefix="/debug", tags=["debug"])


@router.get("/db-info")
def db_info():
    """Quick check of which DB we are connected to."""
    url = engine.url
    return {
        "driver": url.drivername,
        "host": url.host,
        "database": url.database,
        "user": url.username,
    }


@router.get("/documents")
def list_documents(limit: int = 5, db: Session = Depends(get_db)):
    """Peek into the documents table."""
    docs = db.execute(select(Document).limit(limit)).scalars().all()
    return [
        {"id": d.id, "source": d.source, "meta": d.meta, "created_at": d.created_at}
        for d in docs
    ]


@router.get("/chunks")
def list_chunks(limit: int = 5, db: Session = Depends(get_db)):
    """Peek into the chunks table."""
    chks = db.execute(select(Chunk).limit(limit)).scalars().all()
    return [
        {
            "id": c.id,
            "document_id": c.document_id,
            "ordinal": c.ordinal,
            "text": (c.text[:200] + "...") if c.text and len(c.text) > 200 else c.text,
            "page": c.page,
            "source": c.source,
        }
        for c in chks
    ]


@router.get("/counts")
def count_tables(db: Session = Depends(get_db)):
    """Row counts for sanity check."""
    doc_count = db.scalar(select(func.count()).select_from(Document))
    chunk_count = db.scalar(select(func.count()).select_from(Chunk))
    return {"documents": doc_count, "chunks": chunk_count}

@router.get("/query")
def debug_query(q: str = Query(...), n: int = 5, db: Session = Depends(get_db)):
    results = search_chunks(db, q, top_k=n)
    if not results:
        raise HTTPException(status_code=404, detail="No results")
    return {"query": q, "results": results}