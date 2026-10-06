"""Project storage. SQLite file by default; set DATABASE_URL to a Postgres URL for hosts with an ephemeral disk."""
import json
import os
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from sqlalchemy import Column, MetaData, String, Table, Text, create_engine, delete, insert, select, update

from .schemas import DEFAULT_ART, LocalizedDraft, Project, ScriptDraft, Video, VideoStatus

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")


def _url() -> str:
    url = os.getenv("DATABASE_URL") or f"sqlite:///{ROOT / 'data' / 'balagh.db'}"
    # Hosts hand out postgres:// or postgresql:// URLs; SQLAlchemy needs the driver named.
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url[len(prefix):]
    return url


engine = create_engine(_url(), pool_pre_ping=True)
metadata = MetaData()
projects = Table("projects", metadata, Column("id", String(32), primary_key=True), Column("data", Text, nullable=False))
# Videos live in their own table: render jobs update them while requests rewrite whole projects.
videos = Table(
    "videos", metadata,
    Column("id", String(32), primary_key=True),
    Column("script_id", String(32), nullable=False, index=True),
    Column("data", Text, nullable=False),
)
metadata.create_all(engine)


def save(project: Project) -> None:
    # Script drafts are excluded from API output, so they are stored alongside the project.
    data = json.dumps({
        "project": project.model_dump(mode="json"),
        "drafts": {sid: s.draft.model_dump(mode="json") for sid, s in project.scripts.items() if s.draft},
    }, ensure_ascii=False)
    with engine.begin() as conn:
        conn.execute(delete(projects).where(projects.c.id == project.id))
        conn.execute(insert(projects).values(id=project.id, data=data))


def load(project_id: str) -> Optional[Project]:
    with engine.connect() as conn:
        row = conn.execute(select(projects.c.data).where(projects.c.id == project_id)).first()
    if row is None:
        return None
    stored = json.loads(row[0])
    _add_scene_art(stored)
    project = Project.model_validate(stored["project"])
    for sid, draft in stored["drafts"].items():
        script = project.scripts[sid]
        script.draft = (LocalizedDraft if script.localized_from else ScriptDraft).model_validate(draft)
    return project


def _add_scene_art(stored: dict) -> None:
    """Scripts written before scenes carried `art` get the default, so they still load."""
    default = DEFAULT_ART.model_dump(mode="json")
    scenes = [s for script in stored["project"]["scripts"].values() for s in script["scenes"]]
    scenes += [s for draft in stored["drafts"].values() for s in draft["scenes"]]
    for scene in scenes:
        scene.setdefault("art", default)


def save_video(video: Video) -> None:
    data = video.model_dump_json()
    with engine.begin() as conn:
        if conn.execute(update(videos).where(videos.c.id == video.id).values(data=data)).rowcount == 0:
            conn.execute(insert(videos).values(id=video.id, script_id=video.script_id, data=data))


def load_video(video_id: str) -> Optional[Video]:
    with engine.connect() as conn:
        row = conn.execute(select(videos.c.data).where(videos.c.id == video_id)).first()
    return Video.model_validate_json(row[0]) if row else None


def videos_for(script_id: str) -> list[Video]:
    with engine.connect() as conn:
        rows = conn.execute(select(videos.c.data).where(videos.c.script_id == script_id)).all()
    return sorted((Video.model_validate_json(r[0]) for r in rows), key=lambda v: v.created_at, reverse=True)


def fail_unfinished_videos(reason: str) -> None:
    """Called at startup: a render that was running when the server stopped will never finish."""
    with engine.begin() as conn:
        for vid, data in conn.execute(select(videos.c.id, videos.c.data)).all():
            video = Video.model_validate_json(data)
            if video.status not in (VideoStatus.done, VideoStatus.failed):
                video.status, video.error = VideoStatus.failed, reason
                conn.execute(update(videos).where(videos.c.id == vid).values(data=video.model_dump_json()))
