# app/routers/chat.py
from typing import List, Tuple

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.services.vector_store import search_with_scores  # -> returns List[(Document, distance)]
from app.services.llm import stream_answer                 # -> yields text chunks

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatRequest(BaseModel):
    query: str


# Retrieval tuning
TOP_K = 4
# Distance: lower is better. Anything above this is treated as "not relevant".
MAX_DISTANCE = 1.40

SYSTEM_GUARDRAIL = (
    "You are a document-grounded assistant. Use ONLY the provided context. "
    "If the context is missing or irrelevant, say exactly: "
    "\"I don't know based on the provided document.\" Do not use outside knowledge."
)


@router.post("")  # POST /chat
async def chat_endpoint(req: ChatRequest):
    """
    Streams SSE lines ("data: <text>\\n\\n") so your frontend shows live output.
    If retrieval finds nothing under the threshold, we stream the fixed refusal line.
    """
    # 1) Retrieve top-K with scores
    results: List[Tuple] = search_with_scores(req.query, k=TOP_K)
    print("---- Retrieval results ----")
    for i, (doc, dist) in enumerate(results, start=1):
        print(f"{i}. dist={dist:.4f} | meta={doc.metadata} | snippet={(doc.page_content or '')[:120]}")
    print("---------------------------")

    # 2) Filter by distance threshold (lower = better)
    filtered = [(doc, dist) for (doc, dist) in results if dist is not None and dist <= MAX_DISTANCE]

    def event_stream():
        try:
            # No relevant chunks -> stream refusal text and finish
            if not filtered:
                yield "data: I don't know based on the provided document.\n\n"
                yield "data: [DONE]\n\n"
                return

            # 3) Build compact context with numbered chunks
            context = "\n\n".join(
                f"[{i+1}] {doc.page_content.strip()}"
                for i, (doc, _) in enumerate(filtered[:TOP_K])
            )

            # 4) Prefix guardrail into the context we send to the model
            full_context = f"{SYSTEM_GUARDRAIL}\n\nContext:\n{context}\n"

            # 5) Stream LLM answer as SSE lines
            for piece in stream_answer(full_context, req.query, model="gpt-4.1-mini", temperature=0.0):
                if piece:
                    yield f"data: {piece}\n\n"

            yield "data: [DONE]\n\n"

        except Exception as e:
            # Surface errors to the UI as a streamed line
            yield f"data: [server error] {str(e)}\n\n"
            yield "data: [DONE]\n\n"

    # Anti-buffering headers for SSE
    headers = {
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }
    return StreamingResponse(event_stream(), media_type="text/event-stream", headers=headers)
