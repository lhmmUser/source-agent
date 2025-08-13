import httpx
from app.config import get_settings

settings = get_settings()

async def embed_texts(texts: list[str]) -> list[list[float]]:
    # Uses OpenAI embeddings; simple HTTP call via httpx
    url = "https://api.openai.com/v1/embeddings"
    headers = {"Authorization": f"Bearer {settings.OPENAI_API_KEY}", "Content-Type": "application/json"}
    json = {"model": settings.OPENAI_EMBED_MODEL, "input": texts}

    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(url, headers=headers, json=json)
        r.raise_for_status()
        data = r.json()
        return [d["embedding"] for d in data["data"]]