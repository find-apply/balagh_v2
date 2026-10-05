"""Project storage. SQLite file by default; set DATABASE_URL to a Postgres URL for hosts with an ephemeral disk."""
import json
import os
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional

from dotenv import load_dotenv
from sqlalchemy import Boolean, cast, Column, DateTime, Float, Integer, MetaData, String, Table, Text, create_engine, delete, func, insert, inspect, select, text

from .schemas import HistoryEntry, LocalizedDraft, Project, ScriptDraft

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
projects = Table(
    "projects",
    metadata,
    Column("id", String(32), primary_key=True),
    Column("data", Text, nullable=False),
    Column("created_at", DateTime(timezone=True)),
)
# One row per model call, so the admin can see how the generation flow is behaving.
runs = Table(
    "runs",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("at", DateTime(timezone=True), nullable=False, index=True),
    Column("kind", String(40), nullable=False),
    Column("model", String(80), nullable=False),
    Column("seconds", Float, nullable=False),
    Column("ok", Boolean, nullable=False),
    Column("error", Text),
)
# Admin-edited flow settings, one JSON value per key.
settings = Table("settings", metadata, Column("key", String(40), primary_key=True), Column("value", Text, nullable=False))
# Per-device history. The API has no accounts, so a browser identifies itself with a random client id.
history = Table(
    "history",
    metadata,
    Column("client_id", String(64), primary_key=True),
    Column("project_id", String(32), primary_key=True),
    Column("shared", Boolean, nullable=False, default=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
)
metadata.create_all(engine)
# Databases created before projects had a date get the column added in place.
if "created_at" not in {c["name"] for c in inspect(engine).get_columns("projects")}:
    with engine.begin() as _conn:
        _conn.execute(text("ALTER TABLE projects ADD COLUMN created_at TIMESTAMP"))


def save(project: Project) -> None:
    # Script drafts are excluded from API output, so they are stored alongside the project.
    data = json.dumps({
        "project": project.model_dump(mode="json"),
        "drafts": {sid: s.draft.model_dump(mode="json") for sid, s in project.scripts.items() if s.draft},
    }, ensure_ascii=False)
    with engine.begin() as conn:
        created = conn.execute(select(projects.c.created_at).where(projects.c.id == project.id)).scalar()
        conn.execute(delete(projects).where(projects.c.id == project.id))
        conn.execute(insert(projects).values(id=project.id, data=data, created_at=created or datetime.now(timezone.utc)))


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


def remember(client_id: str, project_id: str, shared: bool) -> None:
    """Adds a project to a client's history; an entry that already exists keeps its date and origin."""
    with engine.begin() as conn:
        exists = conn.execute(
            select(history.c.project_id).where(history.c.client_id == client_id, history.c.project_id == project_id)
        ).first()
        if exists is None:
            conn.execute(insert(history).values(
                client_id=client_id, project_id=project_id, shared=shared, created_at=datetime.now(timezone.utc)
            ))


def forget(client_id: str, project_id: str) -> None:
    """Removes a project from one client's history. The project itself stays reachable by its link."""
    with engine.begin() as conn:
        conn.execute(delete(history).where(history.c.client_id == client_id, history.c.project_id == project_id))


def list_history(client_id: str) -> list[HistoryEntry]:
    with engine.connect() as conn:
        rows = conn.execute(
            select(history.c.project_id, history.c.shared, history.c.created_at, projects.c.data)
            .join(projects, projects.c.id == history.c.project_id)
            .where(history.c.client_id == client_id)
            .order_by(history.c.created_at.desc())
        ).all()
    entries = []
    for project_id, shared, created_at, data in rows:
        project = Project.model_validate(json.loads(data)["project"])
        scripts = list(project.scripts.values())
        idea = (project.brief.idea or "").strip()
        entries.append(HistoryEntry(
            id=project_id,
            title=idea or (project.ideas[0].title if project.ideas else ""),
            audience=project.brief.audience,
            language=project.brief.language,
            at=created_at if created_at.tzinfo else created_at.replace(tzinfo=timezone.utc),
            scripts=len(scripts),
            approved=sum(1 for s in scripts if s.approved),
            shared=bool(shared),
        ))
    return entries


# ---- Admin ----

def _aware(d: Optional[datetime]) -> Optional[datetime]:
    return d if d is None or d.tzinfo else d.replace(tzinfo=timezone.utc)


def all_projects() -> list[tuple[Project, Optional[datetime]]]:
    """Every stored project with its creation date, newest first (undated legacy rows last)."""
    with engine.connect() as conn:
        rows = conn.execute(select(projects.c.data, projects.c.created_at)).all()
    out = [(Project.model_validate(json.loads(d)["project"]), _aware(c)) for d, c in rows]
    out.sort(key=lambda r: r[1] or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
    return out


def created_at(project_id: str) -> Optional[datetime]:
    with engine.connect() as conn:
        return _aware(conn.execute(select(projects.c.created_at).where(projects.c.id == project_id)).scalar())


def delete_project(project_id: str) -> bool:
    with engine.begin() as conn:
        removed = conn.execute(delete(projects).where(projects.c.id == project_id)).rowcount
        conn.execute(delete(history).where(history.c.project_id == project_id))
    return bool(removed)


def log_run(kind: str, model: str, seconds: float, error: Optional[str]) -> None:
    try:
        with engine.begin() as conn:
            conn.execute(insert(runs).values(
                at=datetime.now(timezone.utc), kind=kind, model=model, seconds=seconds, ok=error is None,
                error=error[:500] if error else None,
            ))
    except Exception:
        pass  # Logging must never fail a generation.


def recent_runs(limit: int, only_failed: bool) -> list[dict]:
    query = select(runs).order_by(runs.c.id.desc()).limit(limit)
    if only_failed:
        query = query.where(runs.c.ok.is_(False))
    with engine.connect() as conn:
        return [dict(r._mapping, at=_aware(r.at)) for r in conn.execute(query)]


def run_stats(since: datetime) -> list[dict]:
    """Per kind of model call since a moment: how many, how many failed, average seconds."""
    with engine.connect() as conn:
        rows = conn.execute(
            select(runs.c.kind, func.count(), func.sum(cast(runs.c.ok, Integer)), func.avg(runs.c.seconds))
            .where(runs.c.at >= since).group_by(runs.c.kind)
        ).all()
    return [{"kind": k, "total": n, "failed": n - int(ok or 0), "avg_seconds": round(float(avg or 0), 1)} for k, n, ok, avg in rows]


def run_days(since: datetime) -> dict[str, int]:
    with engine.connect() as conn:
        times = [_aware(t) for (t,) in conn.execute(select(runs.c.at).where(runs.c.at >= since))]
    days: dict[str, int] = {}
    for t in times:
        days[t.date().isoformat()] = days.get(t.date().isoformat(), 0) + 1
    return days


def get_settings() -> dict:
    with engine.connect() as conn:
        return {k: json.loads(v) for k, v in conn.execute(select(settings.c.key, settings.c.value))}


def put_settings(values: dict) -> None:
    with engine.begin() as conn:
        for key, value in values.items():
            conn.execute(delete(settings).where(settings.c.key == key))
            conn.execute(insert(settings).values(key=key, value=json.dumps(value, ensure_ascii=False)))
