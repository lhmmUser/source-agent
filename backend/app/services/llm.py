# app/services/llm.py
import os
from typing import Generator, Optional
from app.config import get_settings
from dotenv import load_dotenv
from openai import OpenAI, OpenAIError

# ---------- env + client ----------

def load_env() -> None:
    """
    Load .env and hard-fail if OPENAI_API_KEY is not set.
    Call this before creating the client.
    """
    print("[llm.py] Loading environment variables...")
    load_dotenv()
    if not os.getenv("OPENAI_API_KEY"):
        raise RuntimeError("OPENAI_API_KEY is not set. Add it to your .env or environment.")
    print("[llm.py] OPENAI_API_KEY found.")

_client: Optional[OpenAI] = None

def get_client() -> OpenAI:
    global _client
    if _client is None:
        print("[llm.py] Creating new OpenAI client...")
        load_env()
        _client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    else:
        print("[llm.py] Reusing existing OpenAI client.")
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
    print(f"[llm.py] [generate_answer] Using model={model}, temperature={temperature}")
    print(f"[llm.py] [generate_answer] Final prompt:\n{user_prompt[:500]}...")  # show first 500 chars

    try:
        resp = client.chat.completions.create(
            model=model,
            temperature=temperature,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
        )
        answer = (resp.choices[0].message.content or "").strip()
        print(f"[llm.py] [generate_answer] Got answer length={len(answer)}")
        return answer
    except OpenAIError as e:
        print(f"[llm.py] [generate_answer] ERROR: {e}")
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
    Yield incremental text chunks (suitable for FastAPI SSE).
    """
    client = get_client()
    model = model or os.getenv("OPENAI_CHAT_MODEL", "gpt-4.1-mini")

    user_prompt = f"Context:\n{context}\n\nQuestion: {question}"
    print(f"[llm.py] [stream_answer] Using model={model}, temperature={temperature}")
    print(f"[llm.py] [stream_answer] Final prompt:\n{user_prompt[:500]}...")

    try:
        stream = client.chat.completions.create(
            model=model,
            temperature=temperature,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            stream=True,
        )

        for event in stream:
            if not event.choices:
                continue
            delta = event.choices[0].delta
            if delta and getattr(delta, "content", None):
                
                yield delta.content

    except OpenAIError as e:
        print(f"[llm.py] [stream_answer] ERROR: {e}")
        yield f"[LLM error] {e}"

# ---------- embeddings + simple call wrappers ----------

settings = get_settings()
client = OpenAI(api_key=settings.OPENAI_API_KEY)

def embed_texts(texts: list[str]) -> list[list[float]]:
    print(f"[llm.py] [embed_texts] Embedding {len(texts)} texts using {settings.OPENAI_EMBED_MODEL}")
    response = client.embeddings.create(
        model=settings.OPENAI_EMBED_MODEL,  # "text-embedding-3-small"
        input=texts
    )
    vectors = [d.embedding for d in response.data]
    print(f"[llm.py] [embed_texts] Got {len(vectors)} vectors")
    return vectors

def call_llm(prompt: str) -> str:
    """
    Call OpenAI chat/completion model with a prompt (no streaming).
    """
    print(f"[llm.py] [call_llm] Calling LLM with prompt[:100]={prompt[:100]!r}...")
    resp = client.chat.completions.create(
        model=settings.OPENAI_MODEL,
        messages=[{"role": "user", "content": prompt}],
    )
    answer = resp.choices[0].message.content
    print(f"[llm.py] [call_llm] Got answer length={len(answer) if answer else 0}")
    return answer

def call_llm_stream(prompt: str):
    """
    Stream tokens from OpenAI ChatCompletion API.
    Yields text chunks one by one.
    """
    print(f"[llm.py] [call_llm_stream] Streaming LLM with prompt[:100]={prompt[:100]!r}...")
    stream = client.chat.completions.create(
        model=settings.OPENAI_MODEL,
        messages=[{"role": "user", "content": prompt}],
        stream=True,
    )

    for event in stream:
        if event.choices and event.choices[0].delta:
            delta = event.choices[0].delta
            if delta.content:
                yield delta.content
