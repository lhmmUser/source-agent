# app/services/chunking.py
from typing import List, Dict, Optional, Tuple
from langchain.text_splitter import (
    RecursiveCharacterTextSplitter,
    MarkdownHeaderTextSplitter,
    TokenTextSplitter
)
import tiktoken
import re
import hashlib

# ---- Helpers ----

def _token_len(text: str, model: str = "gpt-4o-mini") -> int:
    enc = tiktoken.encoding_for_model(model)
    length = len(enc.encode(text))
    print(f"[chunking.py] Token length for text[:40]={text[:40]!r}... → {length}")
    return length

def _hash(text: str) -> str:
    h = hashlib.sha256(text.encode("utf-8")).hexdigest()
    return h

def _clean(text: str) -> str:
    before = len(text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    after = len(text)
    print(f"[chunking.py] Cleaned text length {before} → {after}")
    return text.strip()

# ---- Main API ----

def chunk_text(
    text: str,
    *,
    is_markdown: bool = False,
    target_tokens: int = 350,
    overlap_tokens: int = 50,
    token_model: str = "gpt-4o-mini",
    carry_headings: bool = True,
    max_tokens_hard: int = 480,
) -> List[Dict]:
    """
    Returns a list of chunks with metadata
    """
    print(f"[chunking.py] Starting chunk_text, input length={len(text)}")

    text = _clean(text)

    # --- 1) Markdown split ---
    sections: List[Tuple[str, str]] = [("", text)]
    if is_markdown:
        print("[chunking.py] Markdown mode enabled")
        md = MarkdownHeaderTextSplitter(headers_to_split_on=[("#", "h1"), ("##", "h2"), ("###", "h3")])
        splits = md.split_text(text)
        sections = []
        for doc in splits:
            title = " / ".join([v for k, v in doc.metadata.items() if k in ("h1","h2","h3")])
            print(f"[chunking.py] Section: title={title}, length={len(doc.page_content)}")
            sections.append((title, doc.page_content))

    # --- 2) Token-based splitting ---
    enc = tiktoken.encoding_for_model(token_model)
    chunks: List[Dict] = []

    for section_title, body in sections:
        print(f"[chunking.py] Splitting section '{section_title}' len={len(body)}")
        token_splitter = TokenTextSplitter(
            encoding_name=enc.name,
            chunk_size=target_tokens,
            chunk_overlap=overlap_tokens,
        )
        parts = token_splitter.split_text(body)
        print(f"[chunking.py] Got {len(parts)} parts from TokenTextSplitter")

        # merge code blocks / tables
        merged: List[str] = []
        buf = []
        def _flush():
            if buf:
                merged.append("\n".join(buf).strip())
                buf.clear()

        for p in parts:
            if re.search(r"(^|\n)\s*(```|(\|.*\|))", p):
                buf.append(p)
                _flush()
            else:
                if buf:
                    _flush()
                merged.append(p)

        print(f"[chunking.py] After merge → {len(merged)} merged parts")

        # enforce hard cap
        for m in merged:
            tok_len = _token_len(m, token_model)
            if tok_len > max_tokens_hard:
                print(f"[chunking.py] Chunk too big ({tok_len}), splitting recursively")
                rc = RecursiveCharacterTextSplitter(
                    separators=["\n\n", "\n", ". ", " ", ""],
                    chunk_size=max_tokens_hard * 4,
                    chunk_overlap=0
                )
                for sub in rc.split_text(m):
                    tlen = _token_len(sub, token_model)
                    if tlen == 0:
                        continue
                    chunks.append({
                        "text": sub.strip(),
                        "hash": _hash(sub),
                        "section_title": section_title if carry_headings else "",
                        "token_len": tlen,
                    })
                    print(f"[chunking.py] Added recursive chunk len={tlen}")
            else:
                if tok_len == 0:
                    continue
                chunks.append({
                    "text": m.strip(),
                    "hash": _hash(m),
                    "section_title": section_title if carry_headings else "",
                    "token_len": tok_len,
                })
                print(f"[chunking.py] Added chunk len={tok_len}")

    # --- 3) Deduplicate ---
    seen = set()
    deduped = []
    for c in chunks:
        if c["hash"] in seen:
            print(f"[chunking.py] Skipping duplicate hash {c['hash'][:8]}")
            continue
        seen.add(c["hash"])
        deduped.append(c)

    print(f"[chunking.py] Finished chunk_text: {len(deduped)} unique chunks")
    return deduped
