from typing import Optional

from sqlalchemy import Column, String, Table, Text, delete, insert, select

from ..store import engine, metadata
from .schemas import Story

stories = Table("kids_stories", metadata, Column("id", String(32), primary_key=True), Column("data", Text, nullable=False))
metadata.create_all(engine)


def save(story: Story) -> None:
    with engine.begin() as conn:
        conn.execute(delete(stories).where(stories.c.id == story.id))
        conn.execute(insert(stories).values(id=story.id, data=story.model_dump_json()))


def load(story_id: str) -> Optional[Story]:
    with engine.connect() as conn:
        row = conn.execute(select(stories.c.data).where(stories.c.id == story_id)).first()
    return Story.model_validate_json(row[0]) if row else None
