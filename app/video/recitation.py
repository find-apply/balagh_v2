"""Real recitations for the religious texts in a video. Nothing here is synthesized: the Quran comes
verse by verse from everyayah.com, hadiths from recordings the creator puts in data/recitations/."""
import json
import os
import subprocess
from pathlib import Path
from typing import Optional

import httpx

from .. import sources
from ..schemas import Language, Reference
from . import media

RECITATIONS = media.ROOT / "data" / "recitations"
QURAN_CACHE = media.MEDIA / "cache" / "quran"
RECITER = os.getenv("VIDEO_QURAN_RECITER", "Alafasy_128kbps")
EVERYAYAH = "https://everyayah.com/data"
AUDIO_EXTS = (".mp3", ".m4a", ".wav", ".ogg")


def _to_mp3(src: Path, out: Path, start: float = 0.0, end: Optional[float] = None) -> None:
    cmd = ["ffmpeg", "-v", "error", "-y", "-ss", str(start), "-i", str(src)]
    if end is not None:
        cmd += ["-to", str(end)]
    cmd += ["-ar", "44100", "-ac", "1", "-b:a", "96k", str(out)]
    subprocess.run(cmd, check=True, capture_output=True)


# ---- Hadith: the creator's recordings ----

def hadith_recording(ref: Reference) -> Optional[media.Clip]:
    """The recording for this hadith, trimmed as index.json says, or None when the creator has not added one."""
    if not ref.hadith_key:
        return None
    name = ref.hadith_key.replace(":", "-")
    src = next((RECITATIONS / f"{name}{ext}" for ext in AUDIO_EXTS if (RECITATIONS / f"{name}{ext}").exists()), None)
    if src is None:
        return None
    index = RECITATIONS / "index.json"
    entry = (json.loads(index.read_text(encoding="utf-8")) if index.exists() else {}).get(name, {})
    start, end = float(entry.get("start") or 0), entry.get("end")
    media.AUDIO_CACHE.mkdir(parents=True, exist_ok=True)
    out = media.AUDIO_CACHE / f"{media._hash('recording', name, str(src.stat().st_mtime), str(start), str(end))}.mp3"
    if not out.exists():
        _to_mp3(src, out, start, end)
    return media.Clip(out, media.seconds_of(out), new=False)


# ---- Quran: verse by verse from everyayah.com ----

def quoted_ayahs(ref: Reference) -> list[str]:
    """Which verses of the reference's range were actually quoted (the script may quote a few of them)."""
    if not ref.quran_key:
        return []
    surah = ref.quran_key.split(":")[0]
    parts = sources.verse_parts(ref.quran_key, Language.ar)
    quoted = [f"{surah}:{a}" for a, text in parts.items() if text in ref.arabic and text in ref.text]
    if not quoted:  # an English script quotes the translation: take the whole range
        quoted = [f"{surah}:{a}" for a in parts]
    return quoted


async def quran_recording(ref: Reference) -> Optional[media.Clip]:
    """The quoted verses recited one after another. None when they cannot be fetched."""
    keys = quoted_ayahs(ref)
    if not keys:
        return None
    QURAN_CACHE.mkdir(parents=True, exist_ok=True)
    out = QURAN_CACHE / f"{media._hash(RECITER, *keys)}.mp3"
    if out.exists():
        return media.Clip(out, media.seconds_of(out), new=False)
    files = []
    try:
        async with httpx.AsyncClient(timeout=60, follow_redirects=True) as http:
            for key in keys:
                surah, ayah = map(int, key.split(":"))
                f = QURAN_CACHE / f"{RECITER}_{surah:03d}{ayah:03d}.mp3"
                if not f.exists():
                    r = await http.get(f"{EVERYAYAH}/{RECITER}/{surah:03d}{ayah:03d}.mp3")
                    if r.status_code != 200 or not r.content:
                        return None
                    f.write_bytes(r.content)
                files.append(f)
    except httpx.HTTPError:
        return None
    listing = out.with_suffix(".txt")
    listing.write_text("".join(f"file '{f}'\n" for f in files), encoding="utf-8")
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", str(listing),
         "-ar", "44100", "-ac", "1", "-b:a", "96k", str(out)],
        check=True, capture_output=True,
    )
    listing.unlink(missing_ok=True)
    return media.Clip(out, media.seconds_of(out), new=False)
