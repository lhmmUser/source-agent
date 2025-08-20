import os
import shutil
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db import get_db
from app.models import Document, Chunk
from app.services.llm import embed_texts
from app.services.chunking import chunk_text
from app.config import get_settings
import fitz  # PyMuPDF
from sqlalchemy import select

UPLOAD_DIR = "uploads"   # relative path, or use absolute if preferred
os.makedirs(UPLOAD_DIR, exist_ok=True)

router = APIRouter(prefix="/ingest", tags=["ingest"])


def extract_pdf_texts(file_path: str):
    """Extract plain text per page using PyMuPDF."""
    print(f"[ingest.py] Starting PDF extraction: {file_path}")

    doc = fitz.open(file_path)
    print(f"[ingest.py] Opened PDF with {doc.page_count} pages")

    extracted = []
    for i, page in enumerate(doc, start=1):
        text = page.get_text("text")
        print(f"[ingest.py] Extracted page {i}, {len(text)} chars")
        extracted.append({"page": i, "text": text, "section_title": ""})

    print(f"[ingest.py] Extraction complete, total pages={len(extracted)}")
    return extracted


@router.post("/pdf")
def ingest_pdf(file: UploadFile = File(...), db: Session = Depends(get_db)):
    print(f"[ingest.py] Ingest request received for: {file.filename}")

    if not file.filename.lower().endswith(".pdf"):
        print(f"[ingest.py] ERROR: Unsupported file type: {file.filename}")
        raise HTTPException(400, "Only PDF supported")

    # --- Save file to uploads/ ---
    save_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(save_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    print(f"[ingest.py] Saved PDF to {save_path}")

    # --- Extract text from saved file ---
    extracted = extract_pdf_texts(save_path)

    # --- Create Document row ---
    doc = Document(source=file.filename, meta=None)
    db.add(doc)
    db.flush()
    print(f"[ingest.py] Created Document entry with ID={doc.id}")

    # --- Chunk + embed ---
    settings = get_settings()
    chunks_to_add = []
    batch_texts, batch_meta = [], []
    ordinal = 0

    for page_item in extracted:
        page = page_item["page"]
        text = page_item["text"] or ""
        sect = page_item.get("section_title", "")

        for ch in chunk_text(text, is_markdown=False):
            body = ch["text"]
            if not body.strip():
                continue
            batch_texts.append(body)
            batch_meta.append((page, ch.get("section_title") or sect, ordinal))
            ordinal += 1

            if len(batch_texts) >= 64:
                print(f"[ingest.py] Embedding batch of {len(batch_texts)} chunks")
                vecs = embed_texts(batch_texts)
                print(f"[ingest.py] Got {len(vecs)} embeddings")

                for (page_no, section, ordno), emb, body_text in zip(batch_meta, vecs, batch_texts):
                    chunks_to_add.append(Chunk(
                        document_id=doc.id,
                        ordinal=ordno,
                        text=body_text,
                        embedding=emb,
                        page=page_no,
                        section_title=section,
                        source=file.filename,
                    ))
                print(f"[ingest.py] Added {len(batch_meta)} chunks to queue")

                batch_texts.clear()
                batch_meta.clear()

    # --- Final flush ---
    if batch_texts:
        print(f"[ingest.py] Final batch embedding {len(batch_texts)} chunks")
        vecs = embed_texts(batch_texts)
        for (page_no, section, ordno), emb, body_text in zip(batch_meta, vecs, batch_texts):
            chunks_to_add.append(Chunk(
                document_id=doc.id,
                ordinal=ordno,
                text=body_text,
                embedding=emb,
                page=page_no,
                section_title=section,
                source=file.filename,
            ))
        print(f"[ingest.py] Added final {len(batch_texts)} chunks to queue")

    # --- Save to DB ---
    db.add_all(chunks_to_add)
    db.commit()
    print(f"[ingest.py] Ingestion complete: {len(chunks_to_add)} chunks committed for doc_id={doc.id}")

    return {"document_id": doc.id, "chunks": len(chunks_to_add), "file_path": save_path}

@router.get("/documents")
def all_documents(limit: int = 1000, db: Session = Depends(get_db)):
    """Return recent documents for admin UI."""
    docs = db.execute(
        select(Document).order_by(Document.created_at.desc()).limit(limit)
    ).scalars().all()
    return [{"id": d.id, "source": d.source, "created_at": d.created_at} for d in docs]

# --- delete a document (rows + file) ---
@router.delete("/document/{doc_id}")
def delete_document(doc_id: int, db: Session = Depends(get_db)):
    """Delete a document, its chunks, and the saved PDF."""
    doc = db.get(Document, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Delete chunks first
    db.query(Chunk).filter(Chunk.document_id == doc_id).delete(synchronize_session=False)

    # Remove the saved file (if present)
    try:
        if doc.source:
            path = os.path.join(UPLOAD_DIR, doc.source)
            if os.path.exists(path):
                os.remove(path)
    except Exception as e:
        # Non-fatal: log and continue
        print(f"[ingest.py] WARN: Failed to remove file for doc_id={doc_id}: {e}")

    # Delete the document row
    db.delete(doc)
    db.commit()
    return {"status": "ok", "deleted_id": doc_id}