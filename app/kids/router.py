"""Experimental children's stories. Mounted only when KIDS_ENABLED=1."""
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

from . import generator, store
from .schemas import Approval, ApproveIn, Story, StoryIn

router = APIRouter(prefix="/kids", tags=["kids (experimental)"])


def _get(story_id: str) -> Story:
    story = store.load(story_id)
    if story is None:
        raise HTTPException(status_code=404, detail="Story not found")
    return story


@router.post("/stories", response_model=Story, status_code=201)
async def create_story(body: StoryIn):
    """A children's story with fixed characters, its religious text verified in the sources."""
    try:
        story = await generator.generate_story(body)
    except generator.Unsuitable as e:
        return JSONResponse(status_code=422, content={"detail": str(e), "unsuitable": True})
    store.save(story)
    return story


@router.get("/stories/{story_id}", response_model=Story)
async def get_story(story_id: str) -> Story:
    return _get(story_id)


@router.post("/stories/{story_id}/approve", response_model=Story)
async def approve_story(story_id: str, body: ApproveIn) -> Story:
    """An educator or parent signs off in their own name. Required before export."""
    story = _get(story_id)
    story.approval = Approval(role=body.role, name=body.name.strip(), at=datetime.now(timezone.utc))
    store.save(story)
    return story
