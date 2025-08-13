# app/services/llm.py
import os
from typing import Generator, Optional

from dotenv import load_dotenv
from openai import OpenAI, OpenAIError


# ---------- env + client ----------

def load_env() -> None:
    """
    Load .env and hard-fail if OPENAI_API_KEY is not set.
    Call this before creating the client.
    """
    load_dotenv()
    if not os.getenv("OPENAI_API_KEY"):
        raise RuntimeError("OPENAI_API_KEY is not set. Add it to your .env or environment.")


# Single, module-level client (created after env is loaded)
_client: Optional[OpenAI] = None


def get_client() -> OpenAI:
    global _client
    if _client is None:
        load_env()
        _client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    return _client


# ---------- prompts ----------

SYSTEM_PROMPT = (
    "You are a helpful assistant that answers questions strictly based on the provided context. "
    'If the answer is not in the context, reply exactly: "I don\'t know based on the provided document." '
    "Do not use outside knowledge."
)


# ---------- non-streaming ----------

def generate_answer(
    context: str,
    question: str,
    *,
    model: Optional[str] = None,
    temperature: float = 0.0,
) -> str:
    """
    Get a single, final answer (no streaming).
    """
    client = get_client()
    model = model or os.getenv("OPENAI_CHAT_MODEL", "gpt-4.1-mini")

    user_prompt = f"Context:\n{context}\n\nQuestion: {question}"

    try:
        resp = client.chat.completions.create(
            model=model,
            temperature=temperature,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
        )
        return (resp.choices[0].message.content or "").strip()
    except OpenAIError as e:
        # Return a sane, visible error for the UI; also re-raise if you prefer
        return f"[LLM error] {e}"


# ---------- streaming (server-side) ----------

def stream_answer(
    context: str,
    question: str,
    *,
    model: Optional[str] = None,
    temperature: float = 0.0,
) -> Generator[str, None, None]:
    """
    Yield incremental text chunks (suitable for FastAPI SSE: `data: <chunk>\\n\\n`).

    Usage in your /chat endpoint:
        for piece in stream_answer(context, question):
            yield f"data: {piece}\\n\\n"
        yield "data: [DONE]\\n\\n"
    """
    client = get_client()
    model = model or os.getenv("OPENAI_CHAT_MODEL", "gpt-4.1-mini")

    user_prompt = f"Context:\n{context}\n\nQuestion: {question}"

    try:
        stream = client.chat.completions.create(
            model=model,
            temperature=temperature,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            stream=True,  # <- server-side streaming
        )

        # Each event contains a delta; accumulate & yield as they arrive
        for event in stream:
            if not event.choices:
                continue
            delta = event.choices[0].delta
            if delta and getattr(delta, "content", None):
                yield delta.content

    except OpenAIError as e:
        # Surface the failure to the client in a visible way
        yield f"[LLM error] {e}"
