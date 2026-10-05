"""Project storage. SQLite file by default; set DATABASE_URL to a Postgres URL for hosts with an ephemeral disk."""
import json
import os
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from sqlalchemy import Column, MetaData, String, Table, Text, create_engine, delete, insert, select

from .schemas import LocalizedDraft, Project, ScriptDraft

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
    project = Project.model_validate(stored["project"])
    for sid, draft in stored["drafts"].items():
        script = project.scripts[sid]
        script.draft = (LocalizedDraft if script.localized_from else ScriptDraft).model_validate(draft)
    return project
