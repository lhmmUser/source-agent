from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from app.utils.prompt_store import load_prompt_template, save_prompt_template

router = APIRouter(prefix="/prompt", tags=["prompt"])

class PromptUpdate(BaseModel):
    template: str = Field(min_length=1, description="Prompt template with {context} and {question}")

@router.get("", response_model=PromptUpdate)
def get_prompt():
    return PromptUpdate(template=load_prompt_template())

@router.put("", response_model=PromptUpdate)
def update_prompt(payload: PromptUpdate):
    tpl = payload.template
    # quick sanity checks
    if "{context}" not in tpl or "{question}" not in tpl:
        raise HTTPException(status_code=400, detail="Template must include {context} and {question}.")
    save_prompt_template(tpl)
    return PromptUpdate(template=tpl)
