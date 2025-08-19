from sqlalchemy.orm import Session
from sqlalchemy import text
from app.services.llm import embed_texts
from app.config import get_settings

def search_chunks(db: Session, query: str):
    s = get_settings()
    # 1) Embed the query
    qvec = embed_texts([query])[0]

    # 2) SQL: order by cosine distance (<=>)
    # Note: we bind the vector as a python list; pgvector adapter handles it.
    sql = text(f"""
        SELECT id, text, source, page, section_title, (embedding <=> :qvec) AS distance
        FROM chunks
        ORDER BY embedding <=> :qvec
        LIMIT :k
    """)

    rows = db.execute(sql, {"qvec": qvec, "k": s.TOP_K}).mappings().all()

    # 3) Filter by max distance (optional)
    hits = [r for r in rows if r["distance"] <= s.MAX_DISTANCE]

    # 4) Return normalized dicts
    return [
        {
            "text": r["text"],
            "score": float(r["distance"]),
            "source": r["source"] or "",
            "page": r["page"],
            "section_title": r["section_title"] or "",
            "chunk_id": r["id"],
        }
        for r in hits
    ]
