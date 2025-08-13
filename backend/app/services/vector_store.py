# app/services/vector_store.py
from __future__ import annotations

from pathlib import Path
from typing import List, Tuple, Optional, Dict

from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain.schema import Document

# ---- Config ----
PERSIST_DIR = Path("vector_store")
COLLECTION_NAME = "docs"
EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"  # local, fast, good quality

# ---- Singletons ----
_embeddings: Optional[HuggingFaceEmbeddings] = None
_store: Optional[Chroma] = None


def get_embeddings() -> HuggingFaceEmbeddings:
    """Create (or reuse) the embeddings model."""
    global _embeddings
    if _embeddings is None:
        _embeddings = HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL)
        print(f"[vector_store] Using embeddings model: {EMBEDDING_MODEL}")
    return _embeddings


def get_store() -> Chroma:
    """
    Create (or reuse) the Chroma store with persistence.
    NOTE: With langchain-chroma, persistence happens automatically when
    `persist_directory` is set. There is no `.persist()` method to call.
    """
    global _store
    if _store is None:
        PERSIST_DIR.mkdir(parents=True, exist_ok=True)
        _store = Chroma(
            collection_name=COLLECTION_NAME,
            embedding_function=get_embeddings(),
            persist_directory=str(PERSIST_DIR),
        )
        print(f"[vector_store] Using vector store at: {PERSIST_DIR.resolve()}")
    return _store


def add_texts(texts: List[str], metadatas: Optional[List[Dict]] = None) -> None:
    """
    Add pre-chunked texts into the vector store.
    Each `metadatas[i]` is attached to `texts[i]` if provided.
    """
    store = get_store()
    store.add_texts(texts=texts, metadatas=metadatas or [{}])
    ids = store.add_texts(texts=texts, metadatas=metadatas)

    print(f"[vector_store] Added {len(ids)} chunks.")

def search_with_scores(query: str, k: int = 4) -> List[Tuple[Document, float]]:
    """
    Retrieve top-k documents with **distance** scores.
    Lower distance = better match.

    Returns:
        List of (Document, distance) tuples.
    """
    store = get_store()
    return store.similarity_search_with_score(query, k=k)


# (Optional) Simple convenience wrapper if you ever need docs only (no scores)
def retrieve(query: str, k: int = 4) -> List[Document]:
    store = get_store()
    return store.similarity_search(query, k=k)

def count_docs() -> int:
    store = get_store()
    # chroma collection under the hood
    return store._collection.count()  # type: ignore[attr-defined]

def peek_docs(n: int = 5):
    """
    Return the first n docs (ids, documents, metadatas) from the underlying Chroma collection.
    Useful to verify what was ingested.
    """
    store = get_store()
    # peek returns a small sample from the collection
    return store._collection.peek(n)  # type: ignore[attr-defined]

def raw_query_with_scores(query: str, n: int = 5):
    """
    Use the underlying Chroma collection to get raw distances/similarities
    (depending on backend settings). This lets us see actual numbers.
    """
    store = get_store()
    return store._collection.query(  # type: ignore[attr-defined]
        query_texts=[query],
        n_results=n,
        include=["documents", "metadatas", "distances"]  # distances present for cosine metric
    )

def clear_index():
    """Danger: wipe local index on disk (useful if you ingested multiple times)."""
    import shutil
    if PERSIST_DIR.exists():
        shutil.rmtree(PERSIST_DIR)
    # reset singletons
    global _store
    _store = None
    # re-create empty store
    get_store()
