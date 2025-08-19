# app/services/vector_store.py

from __future__ import annotations
from sqlalchemy.orm import Session
from app.models import Chunk
from app.services.llm import embed_texts
from typing import List, Dict


def search_chunks(db: Session, query: str, top_k: int = 5) -> List[Dict]:
    """
    Search the chunks table using pgvector cosine distance.
    """

    print(f"[vector_store.py] [search_chunks] Incoming query: {query!r}")
    print(f"[vector_store.py] [search_chunks] Top_k = {top_k}")

    # 1. Embed the query
    try:
        q_emb = embed_texts([query])[0]  # returns a list of floats
        print(f"[vector_store.py] [search_chunks] Got embedding length={len(q_emb)}")
    except Exception as e:
        print(f"[vector_store.py] [search_chunks] ERROR while embedding query: {e}")
        return []

    # 2. Run similarity search with pgvector's ORM helpers
    try:
        rows = (
            db.query(Chunk)
            .order_by(Chunk.embedding.cosine_distance(q_emb))  # use cosine similarity
            .limit(top_k)
            .all()
        )
        print(f"[vector_store.py] [search_chunks] Retrieved {len(rows)} rows from DB")
    except Exception as e:
        print(f"[vector_store.py] [search_chunks] ERROR while querying DB: {e}")
        return []

    # 3. Convert results to dicts for JSON response
    results = [
        {
            "id": r.id,
            "text": r.text,
            "source": r.source,
            "page": r.page,
            "section_title": r.section_title,
        }
        for r in rows
    ]

    # Print some sample results for debugging
    for i, r in enumerate(results[:3]):  # only show first 3 for brevity
        print(f"[vector_store.py] [search_chunks] Result {i+1}: id={r['id']}, page={r['page']}, source={r['source']}")
        print(f"    Text snippet: {r['text'][:120]}...")  # show first 120 chars

    return results
