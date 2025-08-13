from pydantic import BaseModel, Field
from typing import List, Optional

class ChatRequest(BaseModel):
    query: str = Field(..., min_length=1)

class ChatChunk(BaseModel):
    text: str
    score: float
    source: str

class ChatResponse(BaseModel):
    answer: str
    contexts: List[ChatChunk]