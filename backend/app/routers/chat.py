# app/api/chat.py
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.db import get_db
from app.services.vector_store import search_chunks
from app.services.llm import call_llm_stream
from app.config import get_settings

import json

router = APIRouter()

class ChatRequest(BaseModel):
    query: str


@router.post("/chat")
def chat(payload: ChatRequest, db: Session = Depends(get_db)):
    q = payload.query
    settings = get_settings()
    results = search_chunks(db, q, top_k=settings.TOP_K)

    if not results:
        def fallback():
            yield "data: I don't know based on the provided document.\n\n"
            yield "data: [DONE]\n\n"
        return StreamingResponse(fallback(), media_type="text/event-stream")

    context = "\n\n".join(
        f"[{i+1}] {r['text']}" for i, r in enumerate(results)
    )

    prompt = f"""You are a document-grounded assistant. 
Use ONLY the provided context. 
If the context is missing or irrelevant, say: "I don't know based on the provided document."

Context:
{context}

Question: {q}
"""

    def event_stream():
        collected = []  # store chunks for final answer

        # 1) stream tokens as they arrive
        for token in call_llm_stream(prompt):
            collected.append(token)
            yield f"data: {token}\n\n"

        # 2) send final JSON frame with citations
        final_answer = "".join(collected).strip()
        payload = {
            "type": "final",
            "answer": final_answer,
            "citations": [
                {
                    "title": r["source"],  # ✅ show file name
                    "pdf_url": f"/uploads/{r['source']}",
                    "page": r["page"],
                    "snippet": r["text"][:200],  # short preview
                }
                for r in results
            ]
        }
        yield f"data: {json.dumps(payload)}\n\n"

        # 3) send done marker
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
