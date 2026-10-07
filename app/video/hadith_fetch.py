"""Hadith recordings fetched on demand from the Internet Archive's "Sahih Bukhari MP3 Arabic" items
(one file per hadith number, 1-7563). The items need a logged-in archive.org account, so the creator puts
their account in the environment; without it nothing is fetched and the hadith stays silent.

A fetched file carries the whole hadith with its chain of narrators, so the quoted words are located in
it by the model, cut out, and then checked: the cut is transcribed and must match the quoted text word
for word (without diacritics) before it is kept. A cut that does not match is thrown away. Kept cuts
land in data/recitations/ like the creator's own recordings, with their provenance in index.json."""
import asyncio
import json
import logging
import os
import re
import subprocess
from pathlib import Path
from typing import Optional

from google import genai
from google.genai import types
from pydantic import BaseModel, Field

from .. import sources
from ..schemas import Reference
from . import media

logger = logging.getLogger("balagh.hadith_fetch")

ITEMS = [(1, 1000, "Bukhari_MP3_0001-1000"), (1001, 2000, "Bukhari_MP3_1001-2000"), (2001, 3000, "Bukhari_MP3_2001-3000"),
         (3001, 4000, "Bukhari_MP3_3001-4000"), (4001, 5000, "Bukhari_MP3_4001-5000"), (5001, 6000, "Bukhari_MP3_5001-6000"),
         (6001, 7563, "Bukhari_MP3_6001-7563")]
SOURCE_CACHE = media.MEDIA / "cache" / "hadith_src"
RECITATIONS = media.ROOT / "data" / "recitations"
IA_CONFIG = media.ROOT / "data" / ".archive_org.ini"
MATCH_MIN = 0.85          # share of the quoted words the cut's transcript must contain, in order
MARGIN = (0.35, 0.45)     # seconds added before and after the located words
LOCATE_MODEL = os.getenv("VIDEO_LOCATE_MODEL", "gemini-flash-latest")


def enabled() -> bool:
    return bool(os.getenv("ARCHIVE_ORG_EMAIL") and os.getenv("ARCHIVE_ORG_PASSWORD"))


def archive_file(number: int) -> Optional[tuple[str, str]]:
    """The item and file name holding this Bukhari hadith; the first thousand are zero-padded."""
    for lo, hi, item in ITEMS:
        if lo <= number <= hi:
            return item, (f"{number:04d}.mp3" if hi == 1000 else f"{number}.mp3")
    return None


def _session():
    import internetarchive as ia
    if not IA_CONFIG.exists():
        IA_CONFIG.parent.mkdir(parents=True, exist_ok=True)
        ia.configure(os.environ["ARCHIVE_ORG_EMAIL"], os.environ["ARCHIVE_ORG_PASSWORD"], config_file=str(IA_CONFIG))
    return ia.get_session(config_file=str(IA_CONFIG))


def download(number: int) -> Optional[Path]:
    """The whole hadith's file from the archive, cached; None when the account cannot get it."""
    where = archive_file(number)
    if where is None or not enabled():
        return None
    item, name = where
    SOURCE_CACHE.mkdir(parents=True, exist_ok=True)
    out = SOURCE_CACHE / f"bukhari-{number}.mp3"
    if out.exists() and out.stat().st_size > 2000:
        return out
    try:
        f = _session().get_item(item).get_file(name)
        f.download(str(out), verbose=False, ignore_existing=False)
    except Exception as e:  # network, login, or a file that is not there
        logger.warning("archive.org %s/%s: %s", item, name, e)
        out.unlink(missing_ok=True)
        return None
    if not out.exists() or out.stat().st_size < 2000 or out.read_bytes()[:5] == b"<html":
        out.unlink(missing_ok=True)
        return None
    return out


class Span(BaseModel):
    found: bool = Field(description="Whether the given words are spoken in the audio.")
    start: float = Field(description="Second at which the first given word begins.")
    end: float = Field(description="Second at which the last given word ends.")


class Transcript(BaseModel):
    text: str = Field(description="Exactly what is said, in Arabic, nothing else.")


async def _locate(client: genai.Client, audio: Path, words: str) -> Optional[Span]:
    r = await client.aio.models.generate_content(
        model=LOCATE_MODEL,
        contents=[types.Content(role="user", parts=[
            types.Part.from_bytes(data=audio.read_bytes(), mime_type="audio/mpeg"),
            types.Part.from_text(text=f"In this Arabic recording, find where exactly these words are spoken and give their start "
                                      f"and end in seconds: «{words}». They are the Prophet's words, after the chain of narrators.")])],
        config=types.GenerateContentConfig(response_mime_type="application/json", response_schema=Span, temperature=0),
    )
    span = Span.model_validate_json(r.text)
    return span if span.found and span.end > span.start else None


async def _transcribe(client: genai.Client, audio: Path) -> str:
    r = await client.aio.models.generate_content(
        model=LOCATE_MODEL,
        contents=[types.Content(role="user", parts=[
            types.Part.from_bytes(data=audio.read_bytes(), mime_type="audio/mpeg"),
            types.Part.from_text(text="Transcribe exactly what is said in this Arabic clip, word for word.")])],
        config=types.GenerateContentConfig(response_mime_type="application/json", response_schema=Transcript, temperature=0),
    )
    return Transcript.model_validate_json(r.text).text


def match_share(transcript: str, words: str) -> float:
    """How much of the quoted text the transcript contains in order: the longest common subsequence of
    words, over the quoted words. A dropped or variant word costs one word, not the rest of the text."""
    want = sources.normalize(words).split()
    have = sources.normalize(transcript).split()
    if not want:
        return 0.0
    prev = [0] * (len(have) + 1)
    for w in want:
        cur = [0]
        for j, h in enumerate(have, start=1):
            cur.append(prev[j - 1] + 1 if h == w else max(prev[j], cur[j - 1]))
        prev = cur
    return prev[-1] / len(want)


def _cut(src: Path, out: Path, start: float, end: float) -> None:
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{max(0.0, start):.2f}", "-to", f"{end:.2f}", "-i", str(src),
                    "-ar", "44100", "-ac", "1", "-b:a", "96k", str(out)], check=True, capture_output=True)


async def obtain(ref: Reference) -> Optional[media.Clip]:
    """A verified cut of the quoted words for a Bukhari reference, fetched and checked on first use."""
    if not ref.hadith_key or not ref.hadith_key.startswith("bukhari:") or not enabled():
        return None
    try:
        number = int(ref.hadith_key.split(":")[1])
    except ValueError:
        return None
    name = f"bukhari-{number}"
    kept = RECITATIONS / f"{name}.mp3"
    if kept.exists():
        return None   # the creator's own recording wins; recitation.hadith_recording serves it
    src = await asyncio.to_thread(download, number)
    if src is None:
        return None
    client = genai.Client()
    span = await _locate(client, src, ref.text)
    if span is None:
        logger.info("%s: quoted words not located in the recording", name)
        return None
    tmp = SOURCE_CACHE / f"{name}.cut.mp3"
    _cut(src, tmp, span.start - MARGIN[0], span.end + MARGIN[1])
    share = match_share(await _transcribe(client, tmp), ref.text)
    if share < MATCH_MIN:
        logger.info("%s: cut matched only %.0f%% of the quoted words; discarded", name, share * 100)
        tmp.unlink(missing_ok=True)
        return None
    RECITATIONS.mkdir(parents=True, exist_ok=True)
    tmp.replace(kept)
    index_path = RECITATIONS / "index.json"
    index = json.loads(index_path.read_text(encoding="utf-8")) if index_path.exists() else {}
    index[name] = {"start": 0, "end": None, "reciter": "غير مسمّى", "licence": "غير مبيّنة: للتقييم، يُستأذن قبل النشر التجاري",
                   "source": f"archive.org/{archive_file(number)[0]}/{archive_file(number)[1]}، قُصّ وتُحقق آليا ({share:.0%} من الكلمات)",
                   "verified_share": round(share, 2)}
    index_path.write_text(json.dumps(index, ensure_ascii=False, indent=1), encoding="utf-8")
    return media.Clip(kept, media.seconds_of(kept), new=True)
