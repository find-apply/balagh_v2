"""An optional source for the ideas: a public YouTube video, or an uploaded PDF, image or text file.

The source only inspires the angles. It is read once, by a model that can watch and read, into a digest
(its argument, its examples with their loci, the texts it cites as it gives them); the digest is kept with the
project and is what the ideas, the script and the localization are written from, by whichever model writes.
The source itself is never stored. Every religious text still goes through the same verification as without a
source, so a text the source cites is used only if it is found in the Quran or the two Sahihs."""
import logging
import re
import shutil
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Optional
from uuid import uuid4

import httpx
from google.genai import types

from .schemas import SourceDigest
from .video import media

logger = logging.getLogger("balagh.inspiration")

UPLOADS = media.MEDIA / "uploads"
MAX_UPLOAD_BYTES = 10 * 1024 * 1024
MAX_VIDEO_SECONDS = 20 * 60
UPLOAD_TTL_SECONDS = 2 * 3600
ACCEPTED = {
    "application/pdf": ".pdf", "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp",
    "text/plain": ".txt", "text/markdown": ".md",
}
YOUTUBE = re.compile(r"^(?:https?://)?(?:www\.|m\.)?(?:youtube\.com/(?:watch\?(?:.*&)?v=|shorts/|live/)|youtu\.be/)([A-Za-z0-9_-]{11})")


class SourceError(ValueError):
    """A source the user gave cannot be used; the message is for them."""


@dataclass
class Source:
    part: types.Part      # what the model reads
    kind: str             # youtube | file
    label: str
    url: Optional[str] = None
    path: Optional[Path] = None   # an upload, deleted once the ideas are written


def youtube_id(url: str) -> Optional[str]:
    m = YOUTUBE.match(url.strip())
    return m.group(1) if m else None


async def youtube_meta(video_id: str) -> tuple[Optional[str], Optional[int]]:
    """Title and length in seconds from the public watch page; (None, None) when the page gives nothing."""
    try:
        async with httpx.AsyncClient(timeout=10, follow_redirects=True, headers={"User-Agent": "Mozilla/5.0"}) as http:
            html = (await http.get(f"https://www.youtube.com/watch?v={video_id}")).text
    except httpx.HTTPError:
        return None, None
    title = re.search(r"<title>(.*?)(?: - YouTube)?</title>", html, re.S)
    length = re.search(r'"lengthSeconds":"(\d+)"', html)
    return (title.group(1).strip() if title else None), (int(length.group(1)) if length else None)


def save_upload(data: bytes, content_type: str, filename: str) -> str:
    """Keeps an upload for the next brief and returns its id."""
    ext = ACCEPTED.get(content_type.split(";")[0].strip())
    if ext is None:
        raise SourceError("نوع الملف غير مدعوم. المقبول: PDF أو صورة (PNG/JPG/WebP) أو نص.")
    if len(data) > MAX_UPLOAD_BYTES:
        raise SourceError("الملف أكبر من 10 ميغابايت.")
    if not data:
        raise SourceError("الملف فارغ.")
    UPLOADS.mkdir(parents=True, exist_ok=True)
    sweep()
    upload_id = uuid4().hex[:16]
    (UPLOADS / f"{upload_id}{ext}").write_bytes(data)
    safe = re.sub(r"[^\w.\- ]", "", filename)[:80] or f"ملف{ext}"
    (UPLOADS / f"{upload_id}.name").write_text(safe, encoding="utf-8")
    return upload_id


def sweep() -> None:
    """Uploads are read once; anything older than the TTL is a leftover."""
    if not UPLOADS.exists():
        return
    cutoff = time.time() - UPLOAD_TTL_SECONDS
    for f in UPLOADS.iterdir():
        if f.stat().st_mtime < cutoff:
            f.unlink(missing_ok=True)


def _find_upload(upload_id: str) -> tuple[Path, str]:
    if not re.fullmatch(r"[0-9a-f]{16}", upload_id or ""):
        raise SourceError("معرّف الملف غير صالح.")
    for ext in set(ACCEPTED.values()):
        p = UPLOADS / f"{upload_id}{ext}"
        if p.exists():
            name_file = UPLOADS / f"{upload_id}.name"
            name = name_file.read_text(encoding="utf-8") if name_file.exists() else p.name
            return p, name
    raise SourceError("انتهت صلاحية الملف المرفوع أو لم يُرفع. ارفعه من جديد.")


async def resolve(source_url: Optional[str], source_file: Optional[str]) -> Optional[Source]:
    """Turns the brief's optional source into something the model can read, after the checks the user
    is told about: a public YouTube video of at most 20 minutes, or an accepted upload."""
    if source_url and source_file:
        raise SourceError("اختر مصدرا واحدا: رابط أو ملف.")
    if source_url:
        vid = youtube_id(source_url)
        if vid is None:
            raise SourceError("الرابط ليس رابط فيديو يوتيوب. المقبول: youtube.com/watch?v=… أو youtu.be/…")
        title, seconds = await youtube_meta(vid)
        if seconds is not None and seconds > MAX_VIDEO_SECONDS:
            raise SourceError(f"الفيديو أطول من 20 دقيقة ({seconds // 60} دقيقة). اختر مقطعا أقصر أو جزءا منه.")
        url = f"https://www.youtube.com/watch?v={vid}"
        return Source(part=types.Part(file_data=types.FileData(file_uri=url)), kind="youtube", label=title or url, url=url)
    if source_file:
        path, name = _find_upload(source_file)
        mime = next(m for m, ext in ACCEPTED.items() if ext == path.suffix)
        return Source(part=types.Part.from_bytes(data=path.read_bytes(), mime_type=mime), kind="file", label=name, path=path)
    return None


DIGEST_SYSTEM = """You read a SOURCE (a video, a document or an image) for a creator of short Islamic videos, and \
write a faithful digest of it. Report what the source says, in its order; do not add, judge or correct. Quote every \
religious text the source cites verbatim as the source gives it, with where it occurs, and say what the source \
attributes it to; do not fix or complete the citation yourself. Give every example, story and question with its \
locus (mm:ss for a video, page or heading for a document). Write the summary, the argument and the examples in \
the language asked for; keep the citations in the language of the source."""


async def digest(source: Source, language: str) -> SourceDigest:
    """One reading of the source, by the model that can watch and read it. The result is text: any writer
    uses it after that, and the source itself is never sent again."""
    from . import generator  # late import: generator imports this module
    return await generator.read_source(DIGEST_SYSTEM, f"Write the digest with summary, argument and examples in {language}.", SourceDigest, source.part)


def discard(source: Optional[Source]) -> None:
    """The upload is read once, for the ideas; it is not kept."""
    if source and source.path:
        source.path.unlink(missing_ok=True)
        (source.path.parent / f"{source.path.stem}.name").unlink(missing_ok=True)


def clear_all() -> None:
    shutil.rmtree(UPLOADS, ignore_errors=True)
