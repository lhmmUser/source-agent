# app/routers/ingest.py
from fastapi import APIRouter, UploadFile, File, HTTPException
from PyPDF2 import PdfReader
from app.services.chunking import chunk_text
from app.services.vector_store import add_texts

router = APIRouter()

@router.post("/ingest/file")
async def ingest_file(file: UploadFile = File(...)):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files supported.")

    reader = PdfReader(file.file)
    raw_text = ""
    for page in reader.pages:
        raw_text += page.extract_text() or ""

    if not raw_text.strip():
        raise HTTPException(status_code=400, detail="No extractable text found in PDF.")

    chunks = chunk_text(raw_text)
    metadatas = [{"source": file.filename, "page": i} for i, _ in enumerate(chunks, start=1)]
    add_texts(chunks, metadatas)

    return {"status": "success", "chunks_added": len(chunks)}
