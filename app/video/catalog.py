"""The video template catalog, shared with the Remotion project in video/."""
import json
from pathlib import Path
from typing import Optional

from ..schemas import ArtKind

VIDEO_DIR = Path(__file__).resolve().parent.parent.parent / "video"
_catalog = json.loads((VIDEO_DIR / "catalog.json").read_text(encoding="utf-8"))

TEMPLATES: list[dict] = _catalog["templates"]
ART_KINDS: dict[str, str] = _catalog["art_kinds"]
# The fixed cast of the children's story templates: key -> {ar, en, look}.
CHARACTERS: dict[str, dict] = _catalog["characters"]

if set(ART_KINDS) != {k.value for k in ArtKind}:
    raise RuntimeError("video/catalog.json art_kinds and schemas.ArtKind disagree")


def get(template_id: str) -> Optional[dict]:
    return next((t for t in TEMPLATES if t["id"] == template_id), None)


def is_story(template_id: Optional[str]) -> bool:
    template = get(template_id) if template_id else None
    return bool(template and template["story"])


def art_rules(template_id: Optional[str]) -> str:
    """Instructions for the per-scene `art` field, for the given template."""
    template = get(template_id) if template_id else None
    kinds = {k: v for k, v in ART_KINDS.items() if k != "image" or (template is None or template["uses_images"])}
    lines = "\n".join(f"- {k}: {v}" for k, v in kinds.items())
    return f"""Animated video. The script is also rendered as an animated video without a presenter, so give every \
scene an `art`: the one picture the video draws behind the captions for that scene. Pick the kind that carries the \
scene's idea from this list, preferring drawn kinds over `image`:
{lines}
The keyword and detail are short words in the script's language, never a verse or hadith or part of one. An \
image_prompt never asks for text, letters, faces of prophets or companions, or symbols of other faiths."""
