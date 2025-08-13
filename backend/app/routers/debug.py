# app/routers/debug.py
from fastapi import APIRouter, Query, HTTPException
from app.services.vector_store import count_docs, peek_docs, raw_query_with_scores, clear_index
from app.services.vector_store import get_store
router = APIRouter(prefix="/debug", tags=["debug"])

@router.get("/store")
def debug_store(sample: int = 5):
    total = count_docs()
    peek = peek_docs(sample)
    # Format a light summary
    items = []
    for i in range(min(sample, len(peek.get("ids", [])))):
        items.append({
            "id": peek["ids"][i],
            "meta": peek["metadatas"][i] if "metadatas" in peek else {},
            "snippet": (peek["documents"][i] or "")[:300] if "documents" in peek else ""
        })
    return {"total_docs": total, "sample": items}

@router.get("/query2")
def debug_query(q: str = Query(..., description="Your test query"), n: int = 5):
    result = raw_query_with_scores(q, n=n)
    if not result or not result.get("documents"):
        raise HTTPException(status_code=404, detail="No results from raw query")
    out = []
    for i in range(len(result["documents"][0])):
        out.append({
            "rank": i + 1,
            "distance": (result.get("distances", [[None]])[0][i]),
            "meta": result["metadatas"][0][i],
            "snippet": (result["documents"][0][i] or "")[:300],
        })
    return {"query": q, "results": out}

@router.get("/query")
def debug_query(q: str = Query(..., description="Your test query"), n: int = 5):
    """
    Safe debug using LangChain's similarity_search_with_score (distance: lower is better).
    """
    store = get_store()
    try:
        results = store.similarity_search_with_score(q, k=n)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"search error: {e}")

    if not results:
        raise HTTPException(status_code=404, detail="No results")

    out = []
    for i, (doc, dist) in enumerate(results, start=1):
        out.append({
            "rank": i,
            "distance": dist,  # lower means more similar
            "meta": doc.metadata,
            "snippet": (doc.page_content or "")[:300],
        })
    return {"query": q, "results": out}

@router.post("/reset")
def debug_reset():
    clear_index()
    return {"status": "ok", "message": "Vector store cleared. Re-ingest your PDFs."}
