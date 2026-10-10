"""Project storage. SQLite file by default; set DATABASE_URL to a Postgres URL for hosts with an ephemeral disk."""
import json
import secrets
import statistics
import os
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional

from dotenv import load_dotenv
from sqlalchemy.exc import IntegrityError
from sqlalchemy import Boolean, cast, Column, DateTime, Float, Integer, MetaData, String, Table, Text, create_engine, delete, func, insert, inspect, select, text, update

from . import sources
from .schemas import DEFAULT_ART, Feedback, FeedbackIn, HistoryEntry, LocalizedDraft, Project, ScriptDraft, Video, VideoStatus

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
# Videos live in their own table: render jobs update them while requests rewrite whole projects.
videos = Table(
    "videos", metadata,
    Column("id", String(32), primary_key=True),
    Column("script_id", String(32), nullable=False, index=True),
    Column("data", Text, nullable=False),
)
# Reviewer invitations: a signature in a reviewer's role needs the token of an invitation for that project and role.
invites = Table(
    "invites", metadata,
    Column("token", String(64), primary_key=True),
    Column("project_id", String(32), nullable=False, index=True),
    Column("role", String(20), nullable=False),
    Column("issued_by", String(20), nullable=False),
    Column("created_at", DateTime(timezone=True), nullable=False),
)
# Ratings of finished videos: stars, the rater's standing and name, kept with the template so templates can be compared.
feedback = Table(
    "feedback", metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("video_id", String(32), nullable=False, index=True),
    Column("project_id", String(32), nullable=False, index=True),
    Column("script_id", String(32), nullable=False),
    Column("template", String(40), nullable=False),
    Column("stars", Integer, nullable=False),
    Column("role", String(20), nullable=False),
    Column("name", String(80), nullable=False),
    Column("comment", Text),
    Column("created_at", DateTime(timezone=True), nullable=False),
    Column("featured", Boolean, nullable=False, default=False),
    Column("user_id", String(128)),
)
# Accounts, as Firebase identifies them: the profile is refreshed from the token at each sign-in.
users = Table(
    "users", metadata,
    Column("uid", String(128), primary_key=True),
    Column("email", String(320)),
    Column("name", String(200)),
    Column("picture", Text),
    Column("provider", String(40)),
    Column("created_at", DateTime(timezone=True), nullable=False),
    Column("last_seen", DateTime(timezone=True), nullable=False),
    # What the person gave when signing up, and whether the admin has let the account in.
    Column("full_name", String(200)),
    Column("specialization", String(120)),
    Column("phone", String(40)),
    Column("status", String(20), nullable=False, default="pending"),
    # Set by the admin after checking who the person is: it decides who signs their content.
    Column("role", String(20)),
    Column("specialization_changed", Boolean, nullable=False, default=False),
)
USER_STATUSES = ("pending", "approved", "rejected")
USER_ROLES = ("specialist", "creator")
# Projects the admin has made public: they are listed on the landing page and open read-only.
published = Table(
    "published", metadata,
    Column("project_id", String(32), primary_key=True),
    Column("at", DateTime(timezone=True), nullable=False),
)
# What people flag in generated content (an offensive line, a wrong text): the admin reads and closes each one.
reports = Table(
    "reports", metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("project_id", String(32), nullable=False, index=True),
    Column("script_id", String(32)),
    Column("video_id", String(32)),
    Column("reason", String(30), nullable=False),
    Column("note", Text),
    Column("user_id", String(128)),
    Column("status", String(20), nullable=False, default="open"),
    Column("created_at", DateTime(timezone=True), nullable=False),
)
REPORT_REASONS = ("offensive", "religious_error", "wrong_text", "other")
metadata.create_all(engine)
# Ratings stored before the admin could feature them get the column added in place.
if "featured" not in {c["name"] for c in inspect(engine).get_columns("feedback")}:
    with engine.begin() as _conn:
        _conn.execute(text("ALTER TABLE feedback ADD COLUMN featured BOOLEAN NOT NULL DEFAULT FALSE"))
# Ratings given while signed in carry the account, so one account rates a video once.
if "user_id" not in {c["name"] for c in inspect(engine).get_columns("feedback")}:
    with engine.begin() as _conn:
        _conn.execute(text("ALTER TABLE feedback ADD COLUMN user_id VARCHAR(128)"))
# Databases created before projects had a date get the column added in place.
if "created_at" not in {c["name"] for c in inspect(engine).get_columns("projects")}:
    with engine.begin() as _conn:
        tz = "TIMESTAMP WITH TIME ZONE" if engine.dialect.name == "postgresql" else "TIMESTAMP"
        _conn.execute(text(f"ALTER TABLE projects ADD COLUMN created_at {tz}"))
# Accounts from before sign-ups were reviewed get the profile columns; they were already in, so they stay approved.
_user_cols = {c["name"] for c in inspect(engine).get_columns("users")}
with engine.begin() as _conn:
    for _name, _type in (("full_name", "VARCHAR(200)"), ("specialization", "VARCHAR(120)"), ("phone", "VARCHAR(40)")):
        if _name not in _user_cols:
            _conn.execute(text(f"ALTER TABLE users ADD COLUMN {_name} {_type}"))
    if "status" not in _user_cols:
        _conn.execute(text("ALTER TABLE users ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'approved'"))
    if "role" not in _user_cols:
        _conn.execute(text("ALTER TABLE users ADD COLUMN role VARCHAR(20)"))
    if "specialization_changed" not in _user_cols:
        _conn.execute(text("ALTER TABLE users ADD COLUMN specialization_changed BOOLEAN NOT NULL DEFAULT FALSE"))


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
    _add_scene_art(stored)
    _clean_quotes(stored)
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
    for script in stored["project"]["scripts"].values():
        for scene in (script.get("story") or {}).get("scenes", []):
            scene.setdefault("present", [])


def _clean_quotes(stored: dict) -> None:
    """Scripts written before hadith texts were cleaned carry the files' quote marks inside their quotes."""
    marks = "\u200f"
    for script in stored["project"]["scripts"].values():
        for r in script["references"]:
            if r["kind"] == "hadith":
                r["text"], r["arabic"] = sources.clean_hadith(r["text"]), sources.clean_hadith(r["arabic"])
        for field in ("hook", "call_to_action"):
            if marks in script[field]:
                script[field] = sources.clean_hadith(script[field])
        for sc in script["scenes"]:
            for field in ("voiceover", "on_screen_text"):
                if marks in sc[field]:
                    sc[field] = sources.clean_hadith(sc[field])
        for sc in (script.get("story") or {}).get("scenes", []):
            if marks in sc.get("quote", ""):
                sc["quote"] = sources.clean_hadith(sc["quote"])


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


def typical_render_seconds() -> dict[str, float]:
    """Median job time per template over the last finished renders, for the waiting screen."""
    with engine.connect() as conn:
        rows = conn.execute(select(videos.c.data)).all()
    times: dict[str, list[float]] = {}
    for (data,) in rows:
        video = Video.model_validate_json(data)
        if video.status == VideoStatus.done and video.render_seconds:
            times.setdefault(video.template, []).append(video.render_seconds)
    return {t: statistics.median(sorted(s)[-10:]) for t, s in times.items()}


def fail_unfinished_videos(reason: str) -> None:
    """Called at startup: a render that was running when the server stopped will never finish."""
    with engine.begin() as conn:
        for vid, data in conn.execute(select(videos.c.id, videos.c.data)).all():
            video = Video.model_validate_json(data)
            if video.status not in (VideoStatus.done, VideoStatus.failed):
                video.status, video.error = VideoStatus.failed, reason
                conn.execute(update(videos).where(videos.c.id == vid).values(data=video.model_dump_json()))


def remember(client_id: str, project_id: str, shared: bool) -> None:
    """Adds a project to a client's history; an entry that already exists keeps its date and origin.
    Two requests may race for the same row (the web app opens and lists at once), so the duplicate is ignored."""
    with engine.begin() as conn:
        try:
            with conn.begin_nested():
                conn.execute(insert(history).values(
                    client_id=client_id, project_id=project_id, shared=shared, created_at=datetime.now(timezone.utc)
                ))
        except IntegrityError:
            pass


def move_history(from_key: str, to_key: str) -> int:
    """Carries a device's history over to an account at its first sign-in there; projects already in the
    account's history keep their entry. Returns how many projects were added."""
    moved = 0
    with engine.begin() as conn:
        mine = {r[0] for r in conn.execute(select(history.c.project_id).where(history.c.client_id == to_key))}
        for pid, shared, created in conn.execute(
                select(history.c.project_id, history.c.shared, history.c.created_at).where(history.c.client_id == from_key)).all():
            if pid not in mine:
                conn.execute(insert(history).values(client_id=to_key, project_id=pid, shared=shared, created_at=created))
                moved += 1
        conn.execute(delete(history).where(history.c.client_id == from_key))
    return moved


def save_user(uid: str, email: Optional[str], name: Optional[str], picture: Optional[str], provider: Optional[str],
              profile: Optional[dict] = None) -> bool:
    """Records a signed-in account, or refreshes its profile. A new account waits for the admin's approval.
    `profile` (full_name, specialization, phone) fills in the sign-up details; it never changes the status.
    True the first time the account is seen."""
    now = datetime.now(timezone.utc)
    values = dict(email=email, name=name, picture=picture, provider=provider, last_seen=now, **(profile or {}))
    with engine.begin() as conn:
        if conn.execute(update(users).where(users.c.uid == uid).values(**values)).rowcount:
            return False
        conn.execute(insert(users).values(uid=uid, created_at=now, status="pending", **values))
        return True


_ACCOUNT_COLS = (users.c.uid, users.c.email, users.c.name, users.c.picture, users.c.provider, users.c.full_name,
                 users.c.specialization, users.c.phone, users.c.status, users.c.role, users.c.specialization_changed,
                 users.c.created_at, users.c.last_seen)


def _account(row) -> dict:
    return dict(row._mapping, created_at=_aware(row.created_at), last_seen=_aware(row.last_seen))


def get_user(uid: str) -> Optional[dict]:
    with engine.connect() as conn:
        row = conn.execute(select(*_ACCOUNT_COLS).where(users.c.uid == uid)).first()
    return _account(row) if row else None


def user_status(uid: str) -> Optional[str]:
    """The account's review status, or None when the account has never called /me."""
    with engine.connect() as conn:
        return conn.execute(select(users.c.status).where(users.c.uid == uid)).scalar()


def list_users(status: Optional[str] = None) -> list[dict]:
    """Accounts, newest first; only those with `status` when given."""
    q = select(*_ACCOUNT_COLS).order_by(users.c.created_at.desc())
    if status:
        q = q.where(users.c.status == status)
    with engine.connect() as conn:
        return [_account(r) for r in conn.execute(q)]


def user_role(uid: str) -> Optional[str]:
    with engine.connect() as conn:
        return conn.execute(select(users.c.role).where(users.c.uid == uid)).scalar()


def set_user_status(uid: str, status: str, role: Optional[str] = None) -> bool:
    """The admin's decision. A role given with it is the one the admin settled on after checking the person;
    a reviewed account no longer carries a pending change of specialization."""
    values: dict = dict(status=status, specialization_changed=False)
    if role:
        values["role"] = role
    with engine.begin() as conn:
        return conn.execute(update(users).where(users.c.uid == uid).values(**values)).rowcount > 0


def update_profile(uid: str, full_name: str, phone: str, specialization: str) -> Optional[dict]:
    """The person corrects their details. A new specialization is flagged for the admin, who may change the
    role; the account stays open meanwhile."""
    with engine.begin() as conn:
        old = conn.execute(select(users.c.specialization, users.c.specialization_changed).where(users.c.uid == uid)).first()
        if old is None:
            return None
        changed = bool(old.specialization_changed) or (old.specialization or "") != specialization
        conn.execute(update(users).where(users.c.uid == uid).values(
            full_name=full_name, phone=phone, specialization=specialization, specialization_changed=changed))
    return get_user(uid)


ANONYMOUS_CREATOR = "صانع محتوى"


def delete_user(uid: str) -> bool:
    """Deletes an account and its personal data. Its history and its ratings' names go; what it signed on
    published versions stays, signed «صانع محتوى» without a name."""
    with engine.begin() as conn:
        removed = conn.execute(delete(users).where(users.c.uid == uid)).rowcount
        conn.execute(delete(history).where(history.c.client_id == f"u:{uid}"))
        conn.execute(update(feedback).where(feedback.c.user_id == uid).values(name="مشاهد", user_id=None))
        conn.execute(update(reports).where(reports.c.user_id == uid).values(user_id=None))
        for pid, data in conn.execute(select(projects.c.id, projects.c.data)).all():
            stored = json.loads(data)
            touched = False
            for script in stored["project"]["scripts"].values():
                for entry in script.get("approvals", []) + script.get("change_requests", []):
                    if entry.get("uid") == uid:
                        entry["name"], entry["uid"] = ANONYMOUS_CREATOR, None
                        touched = True
            if touched:
                conn.execute(update(projects).where(projects.c.id == pid).values(data=json.dumps(stored, ensure_ascii=False)))
    return bool(removed)


def add_report(project_id: str, script_id: Optional[str], video_id: Optional[str], reason: str, note: str,
               user_id: Optional[str]) -> dict:
    row = dict(project_id=project_id, script_id=script_id, video_id=video_id, reason=reason, note=note or None,
               user_id=user_id, status="open", created_at=datetime.now(timezone.utc))
    with engine.begin() as conn:
        row["id"] = conn.execute(insert(reports).values(**row)).inserted_primary_key[0]
    return row


def list_reports(status: Optional[str] = None) -> list[dict]:
    """Reports newest first, with the reporter's email when the account still exists."""
    q = (select(reports, users.c.email).select_from(reports.outerjoin(users, users.c.uid == reports.c.user_id))
         .order_by(reports.c.id.desc()))
    if status:
        q = q.where(reports.c.status == status)
    with engine.connect() as conn:
        return [dict(r._mapping) for r in conn.execute(q)]


def set_report_status(report_id: int, status: str) -> bool:
    with engine.begin() as conn:
        return conn.execute(update(reports).where(reports.c.id == report_id).values(status=status)).rowcount > 0


def count_users() -> int:
    with engine.connect() as conn:
        return conn.execute(select(func.count()).select_from(users)).scalar_one()


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


def delete_project(project_id: str) -> bool:
    with engine.begin() as conn:
        removed = conn.execute(delete(projects).where(projects.c.id == project_id)).rowcount
        conn.execute(delete(history).where(history.c.project_id == project_id))
        conn.execute(delete(invites).where(invites.c.project_id == project_id))
        conn.execute(delete(feedback).where(feedback.c.project_id == project_id))
        conn.execute(delete(published).where(published.c.project_id == project_id))
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


def add_invite(project_id: str, role: str, issued_by: str) -> str:
    token = secrets.token_urlsafe(24)
    with engine.begin() as conn:
        conn.execute(insert(invites).values(token=token, project_id=project_id, role=role, issued_by=issued_by,
                                            created_at=datetime.now(timezone.utc)))
    return token


def invite_valid(token: str, project_id: str, role: str) -> bool:
    if not token:
        return False
    with engine.connect() as conn:
        row = conn.execute(select(invites.c.project_id, invites.c.role).where(invites.c.token == token)).first()
    return row is not None and row[0] == project_id and row[1] == role


def add_feedback(video: Video, body: FeedbackIn, user_id: Optional[str] = None) -> Feedback:
    row = dict(video_id=video.id, project_id=video.project_id, script_id=video.script_id, template=video.template,
               created_at=datetime.now(timezone.utc), featured=False, user_id=user_id, **body.model_dump(mode="json"))
    with engine.begin() as conn:
        # An account rates a video once: rating it again replaces its earlier rating.
        if user_id:
            conn.execute(delete(feedback).where(feedback.c.video_id == video.id, feedback.c.user_id == user_id))
        row["id"] = conn.execute(insert(feedback).values(**row)).inserted_primary_key[0]
    row.pop("user_id")
    return Feedback(**row)


def feedback_for(video_id: Optional[str] = None, limit: int = 500, featured: bool = False) -> list[Feedback]:
    q = select(feedback).order_by(feedback.c.id.desc()).limit(limit)
    if video_id:
        q = q.where(feedback.c.video_id == video_id)
    if featured:
        q = q.where(feedback.c.featured.is_(True))
    with engine.connect() as conn:
        return [Feedback(**{k: v for k, v in r._mapping.items() if k != "user_id"}) for r in conn.execute(q)]


def set_featured(feedback_id: int, on: bool) -> bool:
    with engine.begin() as conn:
        return conn.execute(update(feedback).where(feedback.c.id == feedback_id).values(featured=on)).rowcount > 0


def set_published(project_id: str, on: bool) -> None:
    with engine.begin() as conn:
        conn.execute(delete(published).where(published.c.project_id == project_id))
        if on:
            conn.execute(insert(published).values(project_id=project_id, at=datetime.now(timezone.utc)))


def published_ids() -> list[str]:
    """Published projects, most recently published first."""
    with engine.connect() as conn:
        return [r[0] for r in conn.execute(select(published.c.project_id).order_by(published.c.at.desc()))]
