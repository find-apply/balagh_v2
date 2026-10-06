"""Runs a video job: build the spec (speech, images), render it with Remotion, publish the mp4."""
import asyncio
import json
import os
import shutil
from datetime import datetime, timezone
from uuid import uuid4

from .. import store
from ..schemas import Script, Video, VideoStatus
from . import catalog, media, qa, spec

VIDEOS = media.MEDIA / "videos"
JOBS = media.MEDIA / "jobs"
_render_lock = asyncio.Semaphore(int(os.getenv("VIDEO_PARALLEL_RENDERS", "2")))
_tasks: set[asyncio.Task] = set()


def start(project_id: str, script: Script, template_id: str, preview: bool = False) -> Video:
    """Creates the job and runs it in the background; the caller polls GET /videos/{id}."""
    video = Video(id=uuid4().hex[:12], project_id=project_id, script_id=script.id, template=template_id,
                  preview=preview, created_at=datetime.now(timezone.utc))
    store.save_video(video)
    task = asyncio.create_task(_run(video, script))
    _tasks.add(task)
    task.add_done_callback(_tasks.discard)
    return video


async def _run(video: Video, script: Script) -> None:
    template = catalog.get(video.template)
    job = JOBS / video.id
    waited = 0.0  # time spent in line for a render slot: the job's own duration excludes it
    try:
        job.mkdir(parents=True, exist_ok=True)
        VIDEOS.mkdir(parents=True, exist_ok=True)
        video.status = VideoStatus.voicing
        store.save_video(video)
        # Template assets (video/public, minus the Studio samples) travel with the generated media.
        for asset in catalog.VIDEO_DIR.glob("public/*"):
            if asset.is_file():
                shutil.copyfile(asset, job / asset.name)
        b = spec.Build(public=job)
        props = await spec.build(script, template, b)
        if video.preview:
            # Reviewers watch this one; the mark says it is not the version that gets published.
            props["watermark"] = spec.LABELS[script.target.language]["preview"]
        video.new_images, video.new_clips, video.notes = b.new_images, b.new_clips, b.notes
        (job / "props.json").write_text(json.dumps({"spec": props}, ensure_ascii=False), encoding="utf-8")

        video.status = VideoStatus.rendering
        store.save_video(video)
        out = VIDEOS / f"{video.id}.mp4"
        queued = datetime.now(timezone.utc)
        async with _render_lock:
            waited = (datetime.now(timezone.utc) - queued).total_seconds()
            await _render(template["composition"], job / "props.json", job, out)
        # Quality checks on the file: the sound level is corrected, the rest is reported next to the video.
        video.checks, video.loudness_lufs, stills = await qa.run(
            out, video.template, props, qa.spec_duration(video.template, props), VIDEOS, video.id)
        video.frames = [f"/media/videos/{name}" for name in stills]
        video.duration_seconds = round(media.seconds_of(out), 2)
        video.url = f"/media/videos/{video.id}.mp4"
        video.status = VideoStatus.done
    except Exception as e:  # the job must always end in a stored status
        video.status, video.error = VideoStatus.failed, str(e)[:500]
    finally:
        video.render_seconds = round((datetime.now(timezone.utc) - video.created_at).total_seconds() - waited, 1)
        store.save_video(video)
        shutil.rmtree(job, ignore_errors=True)


async def _render(composition: str, props: media.Path, public: media.Path, out: media.Path) -> None:
    cmd = [
        "npx", "remotion", "render", "src/index.ts", composition, str(out),
        f"--props={props}", f"--public-dir={public}", "--log=error", "--overwrite",
        # crf 24 is visually close to the default 18 at under half the file size; phones load it faster.
        "--crf=24",
        f"--concurrency={os.getenv('VIDEO_RENDER_CONCURRENCY', '2')}",
    ]
    proc = await asyncio.create_subprocess_exec(
        *cmd, cwd=catalog.VIDEO_DIR, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT,
    )
    log, _ = await asyncio.wait_for(proc.communicate(), timeout=float(os.getenv("VIDEO_RENDER_TIMEOUT", "900")))
    if proc.returncode != 0:
        tail = log.decode("utf-8", "replace").strip().splitlines()[-8:]
        raise RuntimeError("Remotion render failed: " + " | ".join(tail))
