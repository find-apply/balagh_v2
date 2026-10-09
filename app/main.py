import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from fastapi import Depends, FastAPI, Header, HTTPException, Request, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from google.genai import errors as genai_errors

from . import admin, auth, flow_settings, generator, inspiration, screen, store
from .auth import User, current_user, owner_key
from .schemas import (
    Approval, ApproveIn, BriefIn, ChangeRequest, ChangeRequestIn, Feedback, FeedbackIn, HistoryEntry, InviteIn, InviteOut, LocalizeIn, Project, ReviewReport, ReviewRole, ReviseIn, Script, ScriptIn, StoryIn,
    SourceInfo, TemplateIn, Video, VideoIn, VideoStatus, VideoTemplate,
)
from .video import catalog, render, story

logger = logging.getLogger("balagh")

@asynccontextmanager
async def lifespan(_: FastAPI):
    store.fail_unfinished_videos("انقطع التصيير بإعادة تشغيل الخادم. أعد إنشاء الفيديو.")

    inspiration.sweep()  # uploads older than their TTL are leftovers
    yield


# Behind nginx the API lives under /api (the prefix is stripped before proxying); the docs page and the
# OpenAPI document must know that prefix or Swagger fetches /openapi.json from the web app instead.
app = FastAPI(title="بلاغ", description="Brief -> 3 video ideas -> verified script -> localization -> review -> video.",
              lifespan=lifespan, root_path=os.getenv("ROOT_PATH", ""))
render.VIDEOS.mkdir(parents=True, exist_ok=True)
app.mount("/media/videos", StaticFiles(directory=render.VIDEOS), name="videos")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(admin.public)
app.include_router(admin.router)


def generation_open() -> None:
    cfg = flow_settings.current()
    if cfg.paused:
        raise HTTPException(status_code=503, detail=cfg.paused_message or "التوليد متوقف مؤقتا للصيانة، حاول لاحقا.")


@app.exception_handler(generator.GenerationRefused)
async def refused_handler(request: Request, exc: generator.GenerationRefused):
    return JSONResponse(status_code=422, content={"detail": "تعذّر توليد هذا الطلب: امتنع النموذج عن الاستجابة له. جرّب صياغة أخرى للموضوع."})


@app.exception_handler(generator.Referral)
async def referral_handler(request: Request, exc: generator.Referral):
    return JSONResponse(status_code=422, content={"detail": str(exc), "content_level": "D", "referral": True})


@app.exception_handler(RuntimeError)
async def generation_failed_handler(request: Request, exc: RuntimeError):
    # These are our own guards firing: a quote that did not match its source, or an incomplete answer.
    logger.warning("generation failed: %s", exc)
    return JSONResponse(status_code=502, content={
        "detail": "لم يكتمل التوليد: لم تطابق الاقتباسات مصادرها بعد محاولتين. فضّلنا ألا نعطيك نصا غير موثّق. أعد المحاولة.",
    })


@app.exception_handler(genai_errors.APIError)
async def model_api_handler(request: Request, exc: genai_errors.APIError):
    if "spending cap" in (exc.message or ""):
        # The platform's own budget, not the user's request: say so instead of asking them to retry.
        logger.error("model spending cap reached: %s", exc.message)
        return JSONResponse(status_code=503, content={
            "detail": "توقف التوليد مؤقتا: بلغ حساب المنصة سقف إنفاقه الشهري لدى مزوّد النموذج. المشرف يرى هذا في سجل التشغيل ويرفعه؛ لا علاقة لطلبك بذلك، وسيعمل عند رفعه.",
        })
    logger.warning("model API error %s: %s", exc.code, exc.message)
    if exc.code in (429, 503):
        return JSONResponse(status_code=429, content={
            "detail": "الخدمة مشغولة الآن أو بلغت حدّها. انتظر دقيقة ثم أعد المحاولة. طلبك محفوظ.",
        })
    return JSONResponse(status_code=502, content={
        "detail": "تعذّر الوصول إلى خدمة التوليد. أعد المحاولة بعد قليل.",
    })


def _get_project(project_id: str) -> Project:
    project = store.load(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


def _get_script(project: Project, script_id: str) -> Script:
    script = project.scripts.get(script_id)
    if script is None:
        raise HTTPException(status_code=404, detail="Script not found")
    return script


def _get_idea(project: Project, idea_id: str):
    idea = next((i for i in project.ideas if i.id == idea_id), None)
    if idea is None:
        raise HTTPException(status_code=404, detail="Idea not found")
    return idea


def _check_template(template_id: str) -> None:
    template = catalog.get(template_id)
    if template is None:
        raise HTTPException(status_code=422, detail="Unknown video template")
    if not template["ready"]:
        raise HTTPException(status_code=409, detail="This video template is not ready yet")


def _drop_story_template(script: Script) -> None:
    """A new version's text differs, so a story written for the old one does not carry over: the template
    is chosen again and the story rewritten from the new text."""
    if catalog.is_story(script.template):
        script.template = None


@app.get("/", include_in_schema=False)
async def root(request: Request) -> RedirectResponse:
    return RedirectResponse(f"{request.scope.get('root_path', '')}/docs")


@app.get("/video/templates", response_model=list[VideoTemplate])
async def list_templates() -> list[dict]:
    """The video template library. A template is chosen for a script once it is written."""
    typical = store.typical_render_seconds()
    return [{**t, "typical_seconds": typical.get(t["id"])} for t in catalog.TEMPLATES]


@app.post("/projects", response_model=Project, status_code=201, dependencies=[Depends(generation_open)])
async def create_project(brief: BriefIn, x_client_id: Optional[str] = Header(default=None),
                         user: Optional[User] = Depends(current_user)) -> Project:
    """Step 1: submit the brief, get back 3 video ideas with their verified evidence. With `source_url` or
    `source_file`, the ideas take their angles from that source; the texts are verified all the same."""
    try:
        source = await inspiration.resolve(brief.source_url, brief.source_file)
    except inspiration.SourceError as e:
        raise HTTPException(status_code=400, detail=str(e))
    try:
        digest = await inspiration.digest(source, "Arabic" if brief.language == "ar" else "English") if source else None
    finally:
        inspiration.discard(source)  # read once; the digest is what is kept
    ideas, summary = await generator.generate_ideas_from(brief, digest)
    info = SourceInfo(kind=source.kind, label=source.label, url=source.url, summary=summary or (digest.summary if digest else ""), digest=digest) if source else None
    project = Project(id=uuid4().hex, brief=brief.model_copy(update={"source_file": None}), ideas=ideas, source=info)
    store.save(project)
    if key := owner_key(user, x_client_id):
        store.remember(key, project.id, shared=False)
    return project


@app.post("/uploads", status_code=201, dependencies=[Depends(generation_open)])
async def upload_source(file: UploadFile) -> dict:
    """A PDF, image or text file (up to 10 MB) to draw the ideas from. Returns an id for `source_file` in
    POST /projects. The file is read once for that brief and then deleted; it is never kept."""
    data = await file.read()
    try:
        upload_id = inspiration.save_upload(data, file.content_type or "", file.filename or "")
    except inspiration.SourceError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"id": upload_id, "name": file.filename}


@app.get("/projects", response_model=list[HistoryEntry])
async def list_projects(x_client_id: Optional[str] = Header(default=None),
                        user: Optional[User] = Depends(current_user)) -> list[HistoryEntry]:
    """The caller's history, newest first: projects created or opened from a review link. A signed-in user's
    history is their account's, the same on every device; a visitor's is this device's."""
    key = owner_key(user, x_client_id)
    return store.list_history(key) if key else []


@app.get("/projects/{project_id}", response_model=Project)
async def get_project(project_id: str) -> Project:
    return _get_project(project_id)


@app.post("/projects/{project_id}/open", response_model=Project)
async def open_project(project_id: str, shared: bool = False, x_client_id: Optional[str] = Header(default=None),
                       user: Optional[User] = Depends(current_user)) -> Project:
    """Adds the project to the calling client's history: its own project (registered from an earlier browser
    history) or, with shared=true, one that arrived through someone's review link. Reading never records."""
    project = _get_project(project_id)
    if key := owner_key(user, x_client_id):
        store.remember(key, project_id, shared=shared)
    return project


@app.delete("/projects/{project_id}", status_code=204)
async def hide_project(project_id: str, x_client_id: Optional[str] = Header(default=None),
                       user: Optional[User] = Depends(current_user)) -> Response:
    """Removes a project from the client's history only; the project and its review link keep working."""
    if key := owner_key(user, x_client_id):
        store.forget(key, project_id)
    return Response(status_code=204)


@app.post("/projects/{project_id}/ideas/{idea_id}/script", response_model=Script, status_code=201, dependencies=[Depends(generation_open)])
async def create_script(project_id: str, idea_id: str, body: ScriptIn) -> Script:
    """Step 2: pick an idea, get the full script for the brief's audience."""
    project = _get_project(project_id)
    idea = _get_idea(project, idea_id)
    if body.template is not None:
        _check_template(body.template)
    script = await generator.generate_script(
        project.brief, idea, body.duration_seconds or idea.duration_seconds, body.notes, body.template,
        digest=project.source.digest if project.source else None,
    )
    project.scripts[script.id] = script
    store.save(project)
    return script


@app.post("/projects/{project_id}/scripts/{script_id}/localize", response_model=Script, status_code=201, dependencies=[Depends(generation_open)])
async def localize_script(project_id: str, script_id: str, body: LocalizeIn) -> Script:
    """Step 3: adapt a script for another language, culture or level of knowledge, keeping its meaning."""
    project = _get_project(project_id)
    source = _get_script(project, script_id)
    target = generator.AudienceSpec(**body.model_dump(include=set(generator.AudienceSpec.model_fields)))
    script = await generator.localize_script(
        source, _get_idea(project, source.idea_id), target,
        body.platforms or source.platforms, body.duration_seconds or source.duration_seconds, body.notes,
    )
    _drop_story_template(script)
    project.scripts[script.id] = script
    store.save(project)
    return script


@app.post("/projects/{project_id}/scripts/{script_id}/review", response_model=ReviewReport, dependencies=[Depends(generation_open)])
async def review_script(project_id: str, script_id: str) -> ReviewReport:
    """Step 4: AI pre-review (scholarly, audience, and meaning preservation for localized scripts)."""
    project = _get_project(project_id)
    script = _get_script(project, script_id)
    source = project.scripts.get(script.localized_from) if script.localized_from else None
    script.review = await generator.review_script(script, _get_idea(project, script.idea_id), source)
    store.save(project)
    return script.review


@app.post("/projects/{project_id}/scripts/{script_id}/revise", response_model=Script, status_code=201, dependencies=[Depends(generation_open)])
async def revise_script(project_id: str, script_id: str, body: ReviseIn) -> Script:
    """Step 5: one correction pass applying the review's blocking findings and the human reviewer's notes."""
    project = _get_project(project_id)
    script = _get_script(project, script_id)
    try:
        # The chain of versions this one corrects, so fixes made earlier are not undone.
        earlier, cursor = [], script
        while cursor.revised_from and cursor.revised_from in project.scripts and len(earlier) < 6:
            cursor = project.scripts[cursor.revised_from]
            earlier.append(cursor)
        revised = await generator.revise_script(script, _get_idea(project, script.idea_id), body.notes, earlier)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    _drop_story_template(revised)
    project.scripts[revised.id] = revised
    store.save(project)
    return revised


def _check_invite(project_id: str, role: ReviewRole, token: Optional[str]) -> None:
    """The creator signs in their own workspace; every other role signs only from an invitation link for this
    project and role. The scholar's invitations are issued by the platform, never by the creator, so whoever
    wrote the script cannot sign it in the scholar's place."""
    if role == ReviewRole.creator:
        return
    if not store.invite_valid(token or "", project_id, role.value):
        raise HTTPException(status_code=403, detail="التوقيع بهذه الصفة يحتاج رابط دعوة صالحا لهذا المشروع. "
                            + ("روابط المراجع الشرعي تصدرها المنصة لمختصيها." if role == ReviewRole.scholar else "اطلب من صانع المحتوى رابط الدعوة."))


@app.post("/projects/{project_id}/invites", response_model=InviteOut, status_code=201)
async def invite(project_id: str, body: InviteIn) -> InviteOut:
    """The creator invites the language reviewer they chose. The scholar's invitation is not theirs to issue:
    the platform assigns one of its specialists (admin)."""
    _get_project(project_id)
    if body.role != ReviewRole.language:
        raise HTTPException(status_code=403, detail="روابط المراجع الشرعي تصدرها المنصة لمختصيها؛ النسخة تظهر لهم في قائمة الانتظار.")
    return InviteOut(role=body.role, token=store.add_invite(project_id, body.role.value, "creator"))


@app.post("/projects/{project_id}/scripts/{script_id}/approve", response_model=Script)
async def approve_script(project_id: str, script_id: str, body: ApproveIn) -> Script:
    """Step 6: a named human signs off on this exact version in one role. Export opens once every
    role the version requires has signed off."""
    project = _get_project(project_id)
    script = _get_script(project, script_id)
    _check_invite(project_id, body.role, body.invite)
    if any(c.role == body.role for c in script.change_requests):
        raise HTTPException(status_code=409, detail="هذا الدور طلب تعديلا على هذه النسخة؛ يُصحَّح في نسخة جديدة ثم يُراجع من جديد.")
    script.approvals = [a for a in script.approvals if a.role != body.role]
    script.approvals.append(Approval(role=body.role, name=body.name.strip(), at=datetime.now(timezone.utc), note=(body.note or "").strip()))
    store.save(project)
    return script


@app.get("/projects/{project_id}/scripts/{script_id}/export", response_model=Script)
async def export_script(project_id: str, script_id: str) -> Script:
    """The approved version for publishing. Refused until every role the version requires has signed it: the
    lock is on the server, not only in the interface."""
    project = _get_project(project_id)
    script = _get_script(project, script_id)
    if not script.approved:
        missing = [r.role.value for r in script.required_approvals if r.role not in {a.role for a in script.approvals}]
        raise HTTPException(status_code=423, detail=f"التصدير مقفل حتى يكتمل الاعتماد. ينقص: {'، '.join(missing) or 'طلب تعديل مفتوح'}.")
    return script


@app.post("/projects/{project_id}/scripts/{script_id}/request-changes", response_model=Script)
async def request_changes(project_id: str, script_id: str, body: ChangeRequestIn) -> Script:
    """A reviewer declines this version and says what must change. The version cannot be approved any more:
    the creator corrects it in a new version (the note feeds the correction) and the reviewer signs that one."""
    project = _get_project(project_id)
    script = _get_script(project, script_id)
    _check_invite(project_id, body.role, body.invite)
    script.change_requests = [c for c in script.change_requests if c.role != body.role]
    script.change_requests.append(ChangeRequest(role=body.role, name=body.name.strip(), note=body.note.strip(), at=datetime.now(timezone.utc)))
    script.approvals = [a for a in script.approvals if a.role != body.role]
    store.save(project)
    return script


@app.put("/projects/{project_id}/scripts/{script_id}/template", response_model=Script)
async def choose_template(project_id: str, script_id: str, body: TemplateIn) -> Script:
    """Pick the video template this script will be rendered with. The script's text does not change, so its
    approvals stand, except that choosing a children's template for the first time writes the dialogue story:
    that is new text, so the approvals are reset until a human signs off on it too."""
    project = _get_project(project_id)
    script = _get_script(project, script_id)
    _check_template(body.template)
    if catalog.is_story(body.template) and not screen.children(script.target.audience):
        raise HTTPException(status_code=409, detail="هذا قالب للأطفال: يكتب قصة حوار بشخصيات ثابتة (سالم ومريم والمعلمة نور) وتقدَّم للأطفال مع أهلهم. جمهور هذه النسخة ليس أطفالا، فاختر قالبا من قوالب الكبار، أو وطّن السيناريو لجمهور من الأطفال أولا.")
    if catalog.is_story(body.template) and script.story is None:
        script.story = await story.write_story(script)
        script.approvals = []
    script.template = body.template
    store.save(project)
    return script


@app.post("/projects/{project_id}/scripts/{script_id}/story", response_model=Script, status_code=201)
async def rewrite_story(project_id: str, script_id: str, body: StoryIn) -> Script:
    """Write another children's story for this script (a different situation, with the creator's notes).
    New text: the approvals are reset."""
    project = _get_project(project_id)
    script = _get_script(project, script_id)
    if not catalog.is_story(script.template):
        raise HTTPException(status_code=409, detail="اختر قالب أطفال أولا.")
    script.story = await story.write_story(script, body.notes)
    script.approvals = []
    store.save(project)
    return script


@app.post("/projects/{project_id}/scripts/{script_id}/videos", response_model=Video, status_code=202)
async def create_video(project_id: str, script_id: str, body: VideoIn) -> Video:
    """Step 7: render the script as a video with the given template. Before the version is approved the
    video is a watermarked preview for the reviewers to watch; once approved, the final video has no
    watermark. Runs in the background: poll GET /videos/{id} until status is done or failed."""
    project = _get_project(project_id)
    script = _get_script(project, script_id)
    _check_template(body.template)
    if catalog.is_story(body.template) and script.story is None:
        raise HTTPException(status_code=409, detail="اختر هذا القالب أولا حتى تُكتب القصة.")
    return render.start(project_id, script, body.template, preview=not script.approved)


@app.get("/projects/{project_id}/scripts/{script_id}/videos", response_model=list[Video])
async def list_videos(project_id: str, script_id: str) -> list[Video]:
    _get_script(_get_project(project_id), script_id)
    return store.videos_for(script_id)


@app.get("/videos/{video_id}", response_model=Video)
async def get_video(video_id: str) -> Video:
    video = store.load_video(video_id)
    if video is None:
        raise HTTPException(status_code=404, detail="Video not found")
    return video


@app.post("/videos/{video_id}/feedback", response_model=Feedback, status_code=201)
async def rate_video(video_id: str, body: FeedbackIn, user: Optional[User] = Depends(current_user)) -> Feedback:
    """Rate a finished video: one to five stars, the rater's standing (student of knowledge, scholar, sheikh,
    or viewer) and name, and an optional remark. Kept with the video's template so templates can be compared."""
    video = store.load_video(video_id)
    if video is None:
        raise HTTPException(status_code=404, detail="Video not found")
    if video.status != VideoStatus.done:
        raise HTTPException(status_code=409, detail="يُقيَّم الفيديو بعد اكتماله.")
    return store.add_feedback(video, body, user.uid if user else None)


@app.get("/videos/{video_id}/feedback", response_model=list[Feedback])
async def video_feedback(video_id: str) -> list[Feedback]:
    if store.load_video(video_id) is None:
        raise HTTPException(status_code=404, detail="Video not found")
    return store.feedback_for(video_id)


class PublicRating(BaseModel):
    stars: int
    role: str
    name: str
    comment: str
    template: str


class PublicProject(BaseModel):
    project_id: str
    script_id: str
    title: str
    hook: str
    audience: str
    language: str
    approved: bool
    video_url: Optional[str] = None
    poster: Optional[str] = None
    preview: bool = False


class PublicShowcase(BaseModel):
    ratings: list[PublicRating]
    projects: list[PublicProject]


def _public_project(project: Project) -> Optional[PublicProject]:
    """A published project as the landing page shows it: its newest approved version (or newest version), and that
    version's best finished video, final before preview."""
    scripts = list(project.scripts.values())
    if not scripts:
        return None
    approved = [s for s in scripts if s.approved]
    script = (approved or scripts)[-1]
    done = [v for v in store.videos_for(script.id) if v.status == VideoStatus.done and v.url]
    video = next((v for v in done if not v.preview), done[0] if done else None)
    return PublicProject(
        project_id=project.id, script_id=script.id, title=script.title, hook=script.hook,
        audience=project.brief.audience, language=project.brief.language.value, approved=script.approved,
        video_url=video.url if video else None, poster=video.frames[0] if video and video.frames else None,
        preview=bool(video and video.preview),
    )


@app.get("/showcase", response_model=PublicShowcase)
async def showcase() -> PublicShowcase:
    """What the admin chose to show the public: featured ratings and published projects."""
    ratings = [PublicRating(stars=f.stars, role=f.role.value, name=f.name, comment=f.comment, template=f.template)
               for f in store.feedback_for(limit=24, featured=True)]
    shown = []
    for pid in store.published_ids()[:24]:
        project = store.load(pid)
        item = _public_project(project) if project else None
        if item:
            shown.append(item)
    return PublicShowcase(ratings=ratings, projects=shown)


class LibraryItem(BaseModel):
    video: Video
    project_id: str
    script_id: str
    title: str
    audience: str
    approved: bool


@app.get("/library", response_model=list[LibraryItem])
async def library(x_client_id: Optional[str] = Header(default=None), limit: int = 60,
                  user: Optional[User] = Depends(current_user)) -> list[LibraryItem]:
    """The finished videos of the caller's projects (the account's, or this device's), newest first."""
    key = owner_key(user, x_client_id)
    if not key:
        return []
    items: list[LibraryItem] = []
    for entry in store.list_history(key):
        project = store.load(entry.id)
        if project is None:
            continue
        for script in project.scripts.values():
            for v in store.videos_for(script.id):
                if v.status == VideoStatus.done and v.url:
                    items.append(LibraryItem(video=v, project_id=project.id, script_id=script.id, title=script.title,
                                             audience=project.brief.audience, approved=script.approved))
    items.sort(key=lambda i: i.video.created_at, reverse=True)
    return items[:max(1, min(limit, 200))]


class Me(BaseModel):
    uid: str
    email: Optional[str]
    name: Optional[str]
    picture: Optional[str]
    provider: Optional[str]
    moved: int = 0


@app.post("/me", response_model=Me)
async def sign_in(user: Optional[User] = Depends(current_user), x_client_id: Optional[str] = Header(default=None)) -> Me:
    """Called after signing in: records the account, and carries this device's history over to it, so what was
    made before signing in is not lost. Safe to call at every launch."""
    if user is None:
        raise HTTPException(status_code=401, detail="سجّل الدخول أولا.")
    store.save_user(user.uid, user.email, user.name, user.picture, user.provider)
    moved = store.move_history(x_client_id[:64], owner_key(user, None)) if x_client_id else 0
    return Me(**user.model_dump(), moved=moved)
