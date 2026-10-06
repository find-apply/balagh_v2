import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from fastapi import Depends, FastAPI, Header, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from google.genai import errors as genai_errors

from . import admin, flow_settings, generator, store
from .schemas import (
    Approval, ApproveIn, BriefIn, HistoryEntry, LocalizeIn, Project, ReviewReport, ReviseIn, Script, ScriptIn, StoryIn,
    TemplateIn, Video, VideoIn, VideoTemplate,
)
from .video import catalog, render, story

logger = logging.getLogger("balagh")

@asynccontextmanager
async def lifespan(_: FastAPI):
    store.fail_unfinished_videos("انقطع التصيير بإعادة تشغيل الخادم. أعد إنشاء الفيديو.")
    yield


app = FastAPI(title="بلاغ", description="Brief -> 3 video ideas -> verified script -> localization -> review -> video.",
              lifespan=lifespan)
render.VIDEOS.mkdir(parents=True, exist_ok=True)
app.mount("/media/videos", StaticFiles(directory=render.VIDEOS), name="videos")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

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
async def root() -> RedirectResponse:
    return RedirectResponse("/docs")


@app.get("/video/templates", response_model=list[VideoTemplate])
async def list_templates() -> list[dict]:
    """The video template library. A template is chosen for a script once it is written."""
    return catalog.TEMPLATES


@app.post("/projects", response_model=Project, status_code=201, dependencies=[Depends(generation_open)])
async def create_project(brief: BriefIn, x_client_id: Optional[str] = Header(default=None)) -> Project:
    """Step 1: submit the brief, get back 3 video ideas with their verified evidence."""
    ideas = await generator.generate_ideas(brief)
    project = Project(id=uuid4().hex, brief=brief, ideas=ideas)
    store.save(project)
    if x_client_id:
        store.remember(x_client_id[:64], project.id, shared=False)
    return project


@app.get("/projects", response_model=list[HistoryEntry])
async def list_projects(x_client_id: Optional[str] = Header(default=None)) -> list[HistoryEntry]:
    """The calling client's history, newest first: projects it created or opened from a review link."""
    return store.list_history(x_client_id[:64]) if x_client_id else []


@app.get("/projects/{project_id}", response_model=Project)
async def get_project(project_id: str) -> Project:
    return _get_project(project_id)


@app.post("/projects/{project_id}/open", response_model=Project)
async def open_project(project_id: str, shared: bool = False, x_client_id: Optional[str] = Header(default=None)) -> Project:
    """Adds the project to the calling client's history: its own project (registered from an earlier browser
    history) or, with shared=true, one that arrived through someone's review link. Reading never records."""
    project = _get_project(project_id)
    if x_client_id:
        store.remember(x_client_id[:64], project_id, shared=shared)
    return project


@app.delete("/projects/{project_id}", status_code=204)
async def hide_project(project_id: str, x_client_id: Optional[str] = Header(default=None)) -> Response:
    """Removes a project from the client's history only; the project and its review link keep working."""
    if x_client_id:
        store.forget(x_client_id[:64], project_id)
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
        revised = await generator.revise_script(script, _get_idea(project, script.idea_id), body.notes)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    _drop_story_template(revised)
    project.scripts[revised.id] = revised
    store.save(project)
    return revised


@app.post("/projects/{project_id}/scripts/{script_id}/approve", response_model=Script)
async def approve_script(project_id: str, script_id: str, body: ApproveIn) -> Script:
    """Step 6: a named human signs off on this exact version in one role. Export opens once every
    role the version requires has signed off."""
    project = _get_project(project_id)
    script = _get_script(project, script_id)
    script.approvals = [a for a in script.approvals if a.role != body.role]
    script.approvals.append(Approval(role=body.role, name=body.name.strip(), at=datetime.now(timezone.utc)))
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
    """Step 7: render the approved script as a video with the given template. Runs in the background:
    poll GET /videos/{id} until status is done or failed."""
    project = _get_project(project_id)
    script = _get_script(project, script_id)
    _check_template(body.template)
    if not script.approved:
        raise HTTPException(status_code=409, detail="التصدير مقفل: يلزم اعتماد هذه النسخة أولا.")
    if catalog.is_story(body.template) and script.story is None:
        raise HTTPException(status_code=409, detail="اختر هذا القالب أولا حتى تُكتب القصة، ثم اعتمدها.")
    return render.start(project_id, script, body.template)


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
