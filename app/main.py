import os
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from google.genai import errors as genai_errors

from . import generator, store
from .schemas import Approval, ApproveIn, BriefIn, LocalizeIn, Project, ReviewReport, ReviseIn, Script, ScriptIn

app = FastAPI(title="بلاغ", description="Brief -> 3 video ideas -> verified script -> localization -> review.")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(generator.GenerationRefused)
async def refused_handler(request: Request, exc: generator.GenerationRefused):
    return JSONResponse(status_code=422, content={"detail": str(exc)})


@app.exception_handler(generator.Referral)
async def referral_handler(request: Request, exc: generator.Referral):
    return JSONResponse(status_code=422, content={"detail": str(exc), "content_level": "D", "referral": True})


@app.exception_handler(RuntimeError)
async def generation_failed_handler(request: Request, exc: RuntimeError):
    return JSONResponse(status_code=502, content={"detail": str(exc)})


@app.exception_handler(genai_errors.APIError)
async def model_api_handler(request: Request, exc: genai_errors.APIError):
    if exc.code == 429:
        return JSONResponse(status_code=429, content={"detail": "Model rate limit or quota reached, retry shortly."})
    return JSONResponse(status_code=502, content={"detail": f"Model API error ({exc.code}): {exc.message}"})


if os.getenv("KIDS_ENABLED") == "1":
    from .kids.router import router as kids_router

    app.include_router(kids_router)


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


@app.get("/", include_in_schema=False)
async def root() -> RedirectResponse:
    return RedirectResponse("/docs")


@app.post("/projects", response_model=Project, status_code=201)
async def create_project(brief: BriefIn) -> Project:
    """Step 1: submit the brief, get back 3 video ideas with their verified evidence."""
    ideas = await generator.generate_ideas(brief)
    project = Project(id=uuid4().hex, brief=brief, ideas=ideas)
    store.save(project)
    return project


@app.get("/projects/{project_id}", response_model=Project)
async def get_project(project_id: str) -> Project:
    return _get_project(project_id)


@app.post("/projects/{project_id}/ideas/{idea_id}/script", response_model=Script, status_code=201)
async def create_script(project_id: str, idea_id: str, body: ScriptIn) -> Script:
    """Step 2: pick an idea, get the full script for the brief's audience."""
    project = _get_project(project_id)
    idea = _get_idea(project, idea_id)
    script = await generator.generate_script(project.brief, idea, body.duration_seconds or idea.duration_seconds, body.notes)
    project.scripts[script.id] = script
    store.save(project)
    return script


@app.post("/projects/{project_id}/scripts/{script_id}/localize", response_model=Script, status_code=201)
async def localize_script(project_id: str, script_id: str, body: LocalizeIn) -> Script:
    """Step 3: adapt a script for another language, culture or level of knowledge, keeping its meaning."""
    project = _get_project(project_id)
    source = _get_script(project, script_id)
    target = generator.AudienceSpec(**body.model_dump(include=set(generator.AudienceSpec.model_fields)))
    script = await generator.localize_script(
        source, _get_idea(project, source.idea_id), target,
        body.platforms or source.platforms, body.duration_seconds or source.duration_seconds, body.notes,
    )
    project.scripts[script.id] = script
    store.save(project)
    return script


@app.post("/projects/{project_id}/scripts/{script_id}/review", response_model=ReviewReport)
async def review_script(project_id: str, script_id: str) -> ReviewReport:
    """Step 4: AI pre-review (scholarly, audience, and meaning preservation for localized scripts)."""
    project = _get_project(project_id)
    script = _get_script(project, script_id)
    source = project.scripts.get(script.localized_from) if script.localized_from else None
    script.review = await generator.review_script(script, _get_idea(project, script.idea_id), source)
    store.save(project)
    return script.review


@app.post("/projects/{project_id}/scripts/{script_id}/revise", response_model=Script, status_code=201)
async def revise_script(project_id: str, script_id: str, body: ReviseIn) -> Script:
    """Step 5: one correction pass applying the review's blocking findings and the human reviewer's notes."""
    project = _get_project(project_id)
    script = _get_script(project, script_id)
    try:
        revised = await generator.revise_script(script, _get_idea(project, script.idea_id), body.notes)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
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
