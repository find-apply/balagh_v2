"""Generated media for videos: speech (Gemini TTS) and illustrations (Magnific). Everything is cached under
media/cache by a hash of what produced it, so re-rendering a video does not pay for the same clip or image twice."""
import asyncio
import base64
import hashlib
import json
import os
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import httpx
from google.genai import types

from ..generator import client

ROOT = Path(__file__).resolve().parent.parent.parent
MEDIA = ROOT / "media"
AUDIO_CACHE = MEDIA / "cache" / "audio"
IMAGE_CACHE = MEDIA / "cache" / "images"

TTS_MODEL = os.getenv("VIDEO_TTS_MODEL", "gemini-2.5-flash-preview-tts")
READ_ALOUD = os.getenv("VIDEO_TTS_INSTRUCTION", "Read the following text aloud exactly as written, warmly and clearly. Do not add, answer or translate anything:")
# Prebuilt Gemini voices for the story cast, and one narrator for the caption templates.
VOICES = {"narr": "Sulafat", "salim": "Puck", "maryam": "Leda", "nour": "Kore"}

MAGNIFIC_BASE = "https://api.magnific.com"
# classic-fast is the cheapest Magnific model (synchronous). z-image and flux-2-klein are the async task models.
IMAGE_MODEL = os.getenv("MAGNIFIC_IMAGE_MODEL", "classic-fast")
IMAGE_STYLES = {"story": "vector", "photo": "photo"}
STORY_STYLE = "Children's picture book illustration, flat soft pastel colours, rounded shapes, friendly, clean. "
NEGATIVE = "text, letters, words, watermark, logo, scary, realistic photo, deformed hands"

_tts_limit = asyncio.Semaphore(4)
_image_limit = asyncio.Semaphore(3)


class MediaError(RuntimeError):
    pass


@dataclass
class Clip:
    path: Path
    seconds: float
    new: bool  # generated now (paid for), not served from the cache


def _hash(*parts: str) -> str:
    return hashlib.sha256("\x1f".join(parts).encode("utf-8")).hexdigest()[:24]


def seconds_of(path: Path) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", str(path)],
        capture_output=True, text=True, check=True,
    ).stdout
    return float(json.loads(out)["format"]["duration"])


# ---- Speech ----

async def speak(text: str, who: str = "narr") -> Clip:
    """One spoken line as an mp3. `who` picks the voice."""
    voice = VOICES[who]
    AUDIO_CACHE.mkdir(parents=True, exist_ok=True)
    out = AUDIO_CACHE / f"{_hash(TTS_MODEL, voice, READ_ALOUD, text)}.mp3"
    if out.exists():
        return Clip(out, seconds_of(out), new=False)
    async with _tts_limit:
        pcm, mime = await _tts(text, voice)
    rate = next((int(t.split("=")[1]) for t in mime.split(";") if t.strip().startswith("rate=")), 24000)
    raw = out.with_suffix(".pcm")
    raw.write_bytes(pcm)
    try:
        subprocess.run(
            ["ffmpeg", "-v", "error", "-y", "-f", "s16le", "-ar", str(rate), "-ac", "1", "-i", str(raw),
             "-ar", "44100", "-ac", "1", "-b:a", "96k", str(out)],
            check=True, capture_output=True,
        )
    finally:
        raw.unlink(missing_ok=True)
    return Clip(out, seconds_of(out), new=True)


async def _tts(text: str, voice: str) -> tuple[bytes, str]:
    last: Optional[Exception] = None
    for attempt in range(3):
        try:
            response = await client.aio.models.generate_content(
                model=TTS_MODEL,
                # Without the instruction the model sometimes answers a question instead of reading it.
                contents=f"{READ_ALOUD}\n\n{text}",
                config=types.GenerateContentConfig(
                    response_modalities=["AUDIO"],
                    speech_config=types.SpeechConfig(
                        voice_config=types.VoiceConfig(prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=voice)),
                    ),
                ),
            )
            part = response.candidates[0].content.parts[0] if response.candidates else None
            if part is None or part.inline_data is None or not part.inline_data.data:
                raise MediaError(f"No audio returned for: {text[:60]}")
            return part.inline_data.data, part.inline_data.mime_type or ""
        except MediaError:
            raise
        except Exception as e:  # transient API errors: retry with backoff
            last = e
            await asyncio.sleep(2 * (attempt + 1))
    raise MediaError(f"Speech synthesis failed: {last}")


# ---- Images ----

async def illustrate(prompt: str, aspect: str, look: str = "story") -> Clip:
    """One generated image. aspect is '16:9' or '9:16'; look is 'story' (picture-book) or 'photo'."""
    key = os.getenv("MAGNIFIC_API_KEY")
    if not key:
        raise MediaError("MAGNIFIC_API_KEY is not set, so images cannot be generated.")
    full = (STORY_STYLE if look == "story" else "") + prompt
    style = IMAGE_STYLES[look]
    IMAGE_CACHE.mkdir(parents=True, exist_ok=True)
    out = IMAGE_CACHE / f"{_hash(IMAGE_MODEL, aspect, style, full)}.jpg"
    if out.exists():
        return Clip(out, 0.0, new=False)
    size = {"16:9": "widescreen_16_9", "9:16": "social_story_9_16"}[aspect]
    headers = {"x-magnific-api-key": key, "Content-Type": "application/json", "Accept": "application/json"}
    async with _image_limit, httpx.AsyncClient(base_url=MAGNIFIC_BASE, headers=headers, timeout=90) as http:
        if IMAGE_MODEL == "classic-fast":
            data = await _classic_fast(http, full, size, style)
        else:
            data = await _task_model(http, full, size)
    out.write_bytes(data)
    return Clip(out, 0.0, new=True)


async def _post(http: httpx.AsyncClient, path: str, body: dict) -> dict:
    """Magnific answers 5xx now and then ("Error consuming credits"); those calls are retried."""
    last = ""
    for attempt in range(4):
        r = await http.post(path, json=body)
        if r.status_code < 500:
            if r.status_code >= 400:
                raise MediaError(f"Magnific {r.status_code}: {r.text[:200]}")
            return r.json()
        last = r.text[:200]
        await asyncio.sleep(2 * (attempt + 1))
    raise MediaError(f"Magnific kept failing: {last}")


async def _classic_fast(http: httpx.AsyncClient, prompt: str, size: str, style: str) -> bytes:
    body = {"prompt": prompt, "negative_prompt": NEGATIVE, "image": {"size": size}, "styling": {"style": style},
            "num_images": 1, "seed": 7}
    d = await _post(http, "/v1/ai/text-to-image", body)
    try:
        return base64.b64decode(d["data"][0]["base64"])
    except (KeyError, IndexError, TypeError):
        raise MediaError(f"Unexpected Magnific response: {json.dumps(d)[:200]}")


async def _task_model(http: httpx.AsyncClient, prompt: str, size: str) -> bytes:
    path = f"/v1/ai/text-to-image/{IMAGE_MODEL}"
    d = await _post(http, path, {"prompt": prompt, "aspect_ratio": size})
    task = d["data"]["task_id"]
    for _ in range(60):
        await asyncio.sleep(3)
        s = (await http.get(f"{path}/{task}")).json()["data"]
        if s.get("status") == "COMPLETED":
            url = (s.get("generated") or [None])[0]
            url = url.get("url") if isinstance(url, dict) else url
            r = await http.get(url)
            r.raise_for_status()
            return r.content
        if s.get("status") in ("FAILED", "ERROR"):
            raise MediaError(f"Magnific task failed: {json.dumps(s)[:200]}")
    raise MediaError("Magnific task timed out")
