from __future__ import annotations
import json, threading
from pathlib import Path

_PROMPT_PATH = Path("app/utils/system_prompt.json")
_LOCK = threading.Lock()

def load_prompt_template() -> str:
    with _LOCK:
        if not _PROMPT_PATH.exists():
            _PROMPT_PATH.parent.mkdir(parents=True, exist_ok=True)
            _PROMPT_PATH.write_text(json.dumps({"template": ""}, ensure_ascii=False), encoding="utf-8")
        data = json.loads(_PROMPT_PATH.read_text(encoding="utf-8"))
        return data.get("template", "")

def save_prompt_template(template: str) -> None:
    with _LOCK:
        _PROMPT_PATH.parent.mkdir(parents=True, exist_ok=True)
        _PROMPT_PATH.write_text(json.dumps({"template": template}, ensure_ascii=False, indent=2), encoding="utf-8")
