"""Admin API: oversight of projects, approvals and model runs, plus the flow settings.
Protected by the ADMIN_TOKEN environment variable; without it the admin is disabled."""
import base64
import hashlib
import hmac
import os
import time
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, Response
from pydantic import BaseModel, Field

from . import flow_settings, generator, sources, store
from .flow_settings import FlowSettings
from .schemas import AuthorRole, ContentLevel, Feedback, Project, ReviewRole
from .video import catalog


# The admin signs in with a username and password; the API answers with a session token signed with
# ADMIN_TOKEN. ADMIN_TOKEN itself still works as a bearer token for scripts (tools/review_pack.py).
ACCOUNT_KEY = "admin_account"
SESSION_HOURS = 12
_ITERATIONS = 200_000


def _server_key() -> bytes:
    token = os.getenv("ADMIN_TOKEN", "")
    if not token:
        raise HTTPException(status_code=503, detail="الإدارة غير مفعّلة: عرّف ADMIN_TOKEN على الخادم.")
    return token.encode()


def _hash(password: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), _ITERATIONS).hex()


def _sign(payload: str) -> str:
    return hmac.new(_server_key(), payload.encode(), hashlib.sha256).hexdigest()


def issue_session(username: str) -> str:
    # The password's salt is part of what is signed, so changing the password ends every open session.
    salt = store.get_settings().get(ACCOUNT_KEY, {}).get("salt", "")
    payload = f"{username}|{int(time.time()) + SESSION_HOURS * 3600}|{salt}"
    return base64.urlsafe_b64encode(payload.encode()).decode() + "." + _sign(payload)


def _session_user(token: str) -> Optional[str]:
    try:
        body, sig = token.split(".", 1)
        payload = base64.urlsafe_b64decode(body.encode()).decode()
        username, expires, salt = payload.split("|", 2)
    except ValueError:
        return None
    if not hmac.compare_digest(sig, _sign(payload)) or int(expires) < time.time():
        return None
    account = store.get_settings().get(ACCOUNT_KEY)
    if not account or account.get("username") != username or account.get("salt") != salt:
        return None
    return username


def require_admin(authorization: Optional[str] = Header(default=None)) -> None:
    key = _server_key()
    given = authorization[7:] if authorization and authorization.lower().startswith("bearer ") else ""
    if given and secrets.compare_digest(given.encode(), key):
        return
    if given and _session_user(given):
        return
    raise HTTPException(status_code=401, detail="انتهت الجلسة أو بيانات الدخول غير صحيحة.")


class LoginIn(BaseModel):
    username: str = Field(min_length=1, max_length=60)
    password: str = Field(min_length=1, max_length=200)


class AccountIn(BaseModel):
    username: str = Field(min_length=3, max_length=60)
    password: str = Field(min_length=10, max_length=200, description="Ten characters at least.")


# Failed sign-ins per client address: five in fifteen minutes lock that address out for the rest of the window.
_failures: dict[str, list[float]] = {}
_WINDOW, _MAX_FAILURES = 15 * 60, 5

public = APIRouter(prefix="/admin", tags=["admin"])


@public.post("/login")
async def login(body: LoginIn, request: Request) -> dict:
    """Sign in with the admin's username and password; returns a session token valid for twelve hours."""
    _server_key()
    ip = request.headers.get("x-real-ip") or (request.client.host if request.client else "?")
    now = time.time()
    recent = [t for t in _failures.get(ip, []) if now - t < _WINDOW]
    if len(recent) >= _MAX_FAILURES:
        raise HTTPException(status_code=429, detail="محاولات كثيرة خاطئة. أعد المحاولة بعد ربع ساعة.")
    account = store.get_settings().get(ACCOUNT_KEY)
    ok = bool(account) and hmac.compare_digest(body.username, account["username"]) and hmac.compare_digest(
        _hash(body.password, account["salt"]), account["hash"])
    if not ok:
        _failures[ip] = recent + [now]
        raise HTTPException(status_code=401, detail="اسم المستخدم أو كلمة المرور غير صحيحة.")
    _failures.pop(ip, None)
    return {"token": issue_session(account["username"]), "username": account["username"], "hours": SESSION_HOURS}


router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])


@router.get("/account")
async def account() -> dict:
    found = store.get_settings().get(ACCOUNT_KEY)
    return {"username": found["username"] if found else None}


@router.put("/account")
async def set_account(body: AccountIn) -> dict:
    """Sets the admin's username and password. Every session opened with the old password ends."""
    salt = secrets.token_hex(16)
    store.put_settings({ACCOUNT_KEY: {"username": body.username.strip(), "salt": salt, "hash": _hash(body.password, salt)}})
    return {"username": body.username.strip(), "token": issue_session(body.username.strip())}


class ProjectRow(BaseModel):
    id: str
    title: str
    audience: str
    language: str
    created_at: Optional[datetime]
    ideas: int
    scripts: int
    approved: int
    awaiting: int
    levels: list[str]
    published: bool = False


class PendingApproval(BaseModel):
    project_id: str
    script_id: str
    title: str
    version: int
    content_level: ContentLevel
    author: AuthorRole
    localized: bool
    missing: list[ReviewRole]
    signed: list[ReviewRole]


class RunRow(BaseModel):
    id: int
    at: datetime
    kind: str
    model: str
    seconds: float
    ok: bool
    error: Optional[str]


_projects_cache: tuple[float, list] | None = None


def _all_projects() -> list:
    """store.all_projects() parses every stored project; the admin views call it on every keystroke,
    so the parsed list is kept for a few seconds."""
    global _projects_cache
    now = time.monotonic()
    if _projects_cache and now - _projects_cache[0] < 10:
        return _projects_cache[1]
    rows = store.all_projects()
    _projects_cache = (now, rows)
    return rows


def _title(p: Project) -> str:
    return (p.brief.idea or "").strip() or (p.ideas[0].title if p.ideas else "")


def _row(p: Project, created: Optional[datetime]) -> ProjectRow:
    scripts = list(p.scripts.values())
    return ProjectRow(
        id=p.id, title=_title(p), audience=p.brief.audience, language=p.brief.language.value, created_at=created,
        ideas=len(p.ideas), scripts=len(scripts), approved=sum(s.approved for s in scripts),
        awaiting=sum(not s.approved for s in scripts),
        levels=sorted({s.content_level.value for s in scripts} or {i.content_level.value for i in p.ideas}),
    )


@router.get("/session")
async def session() -> dict:
    """Lets the login screen check a token."""
    return {"ok": True}


@router.get("/overview")
async def overview() -> dict:
    projects = _all_projects()
    scripts = [s for p, _ in projects for s in p.scripts.values()]
    now = datetime.now(timezone.utc)
    day = now - timedelta(hours=24)
    stats = store.run_stats(day)
    total = sum(r["total"] for r in stats)
    failed = sum(r["failed"] for r in stats)
    days = store.run_days(now - timedelta(days=13))
    created: dict[str, int] = {}
    for _, c in projects:
        if c and c >= now - timedelta(days=13):
            created[c.date().isoformat()] = created.get(c.date().isoformat(), 0) + 1
    series = []
    for n in range(13, -1, -1):
        d = (now - timedelta(days=n)).date().isoformat()
        series.append({"day": d, "projects": created.get(d, 0), "runs": days.get(d, 0)})
    return {
        "totals": {
            "projects": len(projects),
            "scripts": len(scripts),
            "approved": sum(s.approved for s in scripts),
            "awaiting": sum(not s.approved for s in scripts),
            "specialist": sum(s.needs_specialist_review for s in scripts),
            "localized": sum(s.localized_from is not None for s in scripts),
        },
        "by_language": {l: sum(p.brief.language.value == l for p, _ in projects) for l in ("ar", "en")},
        "by_level": {l.value: sum(s.content_level == l for s in scripts) for l in ContentLevel},
        "runs_24h": {"total": total, "failed": failed, "by_kind": stats},
        "series": series,
        "paused": flow_settings.current().paused,
    }


@router.get("/projects", response_model=list[ProjectRow])
async def projects(q: str = "", limit: int = Query(50, ge=1, le=200), offset: int = Query(0, ge=0)) -> list[ProjectRow]:
    shown = set(store.published_ids())
    rows = [_row(p, c).model_copy(update={"published": p.id in shown}) for p, c in _all_projects()]
    needle = q.strip().lower()
    if needle:
        rows = [r for r in rows if needle in f"{r.title} {r.audience} {r.id}".lower()]
    return rows[offset:offset + limit]


@router.get("/projects/{project_id}", response_model=Project)
async def project(project_id: str) -> Project:
    found = store.load(project_id)
    if found is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return found


@router.delete("/projects/{project_id}", status_code=204)
async def delete_project(project_id: str, confirm: bool = Query(False, description="Must be true: deletion is final.")) -> Response:
    """Permanently removes a project and every review link to it."""
    global _projects_cache
    if not confirm:
        raise HTTPException(status_code=400, detail="أضف confirm=true لتأكيد الحذف؛ الحذف نهائي.")
    _projects_cache = None
    if not store.delete_project(project_id):
        raise HTTPException(status_code=404, detail="Project not found")
    return Response(status_code=204)


@router.get("/approvals", response_model=list[PendingApproval])
async def approvals() -> list[PendingApproval]:
    """Script versions that still lack a sign-off, most recent project first."""
    out = []
    for p, _ in _all_projects():
        for s in p.scripts.values():
            if s.approved:
                continue
            signed = {a.role for a in s.approvals}
            out.append(PendingApproval(
                project_id=p.id, script_id=s.id, title=s.title, version=s.version, content_level=s.content_level, author=s.author,
                localized=s.localized_from is not None, signed=sorted(signed),
                missing=[r.role for r in s.required_approvals if r.role not in signed],
            ))
    return out


class InviteRow(BaseModel):
    role: ReviewRole
    token: str


@router.post("/projects/{project_id}/invites", response_model=InviteRow, status_code=201)
async def invite(project_id: str, role: ReviewRole = Query(ReviewRole.scholar)) -> InviteRow:
    """An invitation link for one of the platform's reviewers, in any role but the creator's."""
    if store.load(project_id) is None:
        raise HTTPException(status_code=404, detail="المشروع غير موجود.")
    if role == ReviewRole.creator:
        raise HTTPException(status_code=400, detail="صانع المحتوى يوقّع من مساحة عمله دون دعوة.")
    return InviteRow(role=role, token=store.add_invite(project_id, role.value, "admin"))


class FeatureIn(BaseModel):
    featured: bool


@router.put("/feedback/{feedback_id}/featured")
async def feature(feedback_id: int, body: FeatureIn) -> dict:
    """Shows a rating on the landing page, or takes it off."""
    if not store.set_featured(feedback_id, body.featured):
        raise HTTPException(status_code=404, detail="التقييم غير موجود.")
    return {"id": feedback_id, "featured": body.featured}


class PublishIn(BaseModel):
    published: bool


@router.put("/projects/{project_id}/published")
async def publish(project_id: str, body: PublishIn) -> dict:
    """Makes a project public: it is listed on the landing page and opens read-only. Or takes it off."""
    global _projects_cache
    if store.load(project_id) is None:
        raise HTTPException(status_code=404, detail="المشروع غير موجود.")
    store.set_published(project_id, body.published)
    _projects_cache = None
    return {"id": project_id, "published": body.published}


class TemplateRating(BaseModel):
    template: str
    name: str
    ratings: int
    average: Optional[float]
    by_role: dict[str, int]


class FeedbackReport(BaseModel):
    templates: list[TemplateRating]
    items: list[Feedback]


@router.get("/feedback", response_model=FeedbackReport)
async def feedback() -> FeedbackReport:
    """Ratings of finished videos, newest first, with each template's average so templates can be compared."""
    items = store.feedback_for(limit=500)
    rows = []
    for t in catalog.TEMPLATES:
        mine = [f for f in items if f.template == t["id"]]
        by_role: dict[str, int] = {}
        for f in mine:
            by_role[f.role.value] = by_role.get(f.role.value, 0) + 1
        rows.append(TemplateRating(template=t["id"], name=t.get("name", t["id"]), ratings=len(mine),
                                   average=round(sum(f.stars for f in mine) / len(mine), 2) if mine else None, by_role=by_role))
    rows.sort(key=lambda r: (r.average is None, -(r.average or 0)))
    return FeedbackReport(templates=rows, items=items)


@router.get("/runs", response_model=list[RunRow])
async def runs(limit: int = Query(100, ge=1, le=500), failed: bool = False) -> list[RunRow]:
    return [RunRow(**r) for r in store.recent_runs(limit, failed)]


@router.get("/settings", response_model=FlowSettings)
async def get_settings() -> FlowSettings:
    return flow_settings.current()


@router.put("/settings", response_model=FlowSettings)
async def put_settings(body: FlowSettings) -> FlowSettings:
    return flow_settings.save(body)


@router.get("/flow")
async def flow() -> dict:
    """The generation pipeline as it is built: stages, which model and prompt each uses, and the sources behind it."""
    cfg = flow_settings.current()
    return {
        "stages": [
            {"key": "ideas", "model": cfg.generation_model, "prompt": "ideas", "detail": "يصنّف مستوى المحتوى ويقترح ثلاث أفكار، ثم يوثّق آياتها وأحاديثها من المصادر."},
            {"key": "script", "model": cfg.generation_model, "prompt": "script", "detail": "يكتب السيناريو بنصوص مرجعية، ثم تُستبدل المراجع بنصوص المصدر الحرفية."},
            {"key": "localize", "model": cfg.generation_model, "prompt": "localize", "detail": "يوطّن السيناريو للغة أو جمهور آخر مع الحفاظ على المعنى والمصطلحات المعتمدة."},
            {"key": "review", "model": cfg.review_model, "prompt": "scholarly · audience · meaning", "detail": "ثلاثة مراجعين آليين بالتوازي: علمي، وجمهور، ومعنى (للموطّنة)."},
            {"key": "revise", "model": cfg.generation_model, "prompt": "script", "detail": "تصحيح واحد يطبّق الملاحظات المانعة وملاحظات المراجع البشري."},
            {"key": "approve", "model": None, "prompt": None, "detail": "اعتماد بشري باسم صريح؛ الأدوار المطلوبة تتناسب مع مستوى الخطورة."},
        ],
        "prompts": {
            "levels": generator.LEVELS, "rules": generator.COMMON_RULES, "ideas": generator.IDEAS_SYSTEM,
            "script": generator.SCRIPT_SYSTEM, "localize": generator.LOCALIZE_SYSTEM,
            "scholarly": generator.SCHOLARLY_SYSTEM, "audience": generator.AUDIENCE_SYSTEM, "meaning": generator.MEANING_SYSTEM,
        },
        "sources": {"glossary_terms": len(sources.glossary()), "max_verses": sources.MAX_VERSES, "collections": sources.COLLECTIONS},
        "approval_roles": {
            "creator": "كل نسخة",
            "scholar": "مستوى (ج) أو ملاحظات مانعة أو نص شرعي دون دليل",
            "language": "كل نسخة موطّنة",
        },
    }
