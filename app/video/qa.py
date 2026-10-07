"""Checks every finished video before it is called done: sound level, silences that were not meant,
black frames, and the length against the spec. Loudness outside the social-feed range is corrected;
everything else is reported next to the video for the reviewer. Four frames are saved for a glance."""
import asyncio
import json
import re
import shutil
from dataclasses import dataclass
from pathlib import Path

from ..schemas import VideoCheck

TARGET_LUFS = -16.0
LOUDNESS_RANGE = (-19.0, -13.0)     # what TikTok, Reels and Shorts play without pumping
SILENCE_DB = -35
SILENCE_MIN = 4.0                    # a pause longer than this is a fault unless the spec meant it
BLACK_MIN = 1.0
LENGTH_TOLERANCE = 2.0
FRAMES = 4
OUTRO_SECONDS = 3.5     # the caption templates close on a silent call-to-action card (video/src/spec.tsx)


@dataclass
class Inspection:
    loudness: float | None
    silences: list[tuple[float, float]]
    black: list[tuple[float, float]]
    duration: float


def expected_silences(template_id: str, props: dict) -> list[tuple[float, float]]:
    """Where the spec itself keeps quiet: a quoted text shown for reading without a recording, and the
    teaser's silent title and call-to-action cards."""
    out: list[tuple[float, float]] = []
    if template_id == "teaser":
        total = props.get("introSeconds", 0) + props.get("ctaSeconds", 0) + sum(s["duration"] for s in props.get("shots", []))
        out.append((0.0, props.get("introSeconds", 0)))
        out.append((total - props.get("ctaSeconds", 0), total))
        return out
    if "scenes" in props and "cues" not in props:   # a story: scenes play one after another
        t = 0.0
        for s in props["scenes"]:
            if s.get("silentNote"):
                out.append((t + s.get("quoteLead", 0), t + s.get("quoteEnd", s["duration"])))
            t += s["duration"]
        return out
    for c in props.get("cues", []):                  # captions and geo: a cue with a note is a silent quote
        if c.get("sub"):
            out.append((c["t0"], c["t1"]))
    if "duration" in props:                          # and the closing card is silent by design
        out.append((props["duration"], props["duration"] + OUTRO_SECONDS))
    return out


async def _ffmpeg(*args: str) -> str:
    proc = await asyncio.create_subprocess_exec("ffmpeg", "-nostats", "-hide_banner", *args, "-f", "null", "-",
                                                stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT)
    out, _ = await proc.communicate()
    return out.decode("utf-8", "replace")


async def inspect(path: Path) -> Inspection:
    log = await _ffmpeg("-i", str(path), "-af", f"ebur128=peak=none,silencedetect=n={SILENCE_DB}dB:d={SILENCE_MIN}",
                        "-vf", f"blackdetect=d={BLACK_MIN}:pic_th=0.98")
    lufs = re.search(r"I:\s+(-?\d+(?:\.\d+)?) LUFS", log.split("Summary:")[-1]) if "Summary:" in log else None
    silences = [(float(a), float(a) + float(d)) for a, d in
                re.findall(r"silence_start: (-?\d+(?:\.\d+)?)[\s\S]*?silence_duration: (\d+(?:\.\d+)?)", log)]
    black = [(float(a), float(b)) for a, b in re.findall(r"black_start:(\d+(?:\.\d+)?) black_end:(\d+(?:\.\d+)?)", log)]
    duration = 0.0
    m = re.search(r"Duration: (\d+):(\d+):(\d+(?:\.\d+)?)", log)
    if m:
        duration = int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3))
    loud = float(lufs.group(1)) if lufs else None
    if loud is not None and loud < -60:   # ebur128 reports -70 for a file without sound
        loud = None
    return Inspection(loud, silences, black, duration)


async def normalize(path: Path) -> None:
    """Brings the mix to the target loudness without touching the picture."""
    tmp = path.with_name(path.stem + ".norm.mp4")
    proc = await asyncio.create_subprocess_exec(
        "ffmpeg", "-v", "error", "-y", "-i", str(path), "-c:v", "copy",
        "-af", f"loudnorm=I={TARGET_LUFS}:TP=-1.5:LRA=11", "-c:a", "aac", "-b:a", "160k", str(tmp))
    await proc.communicate()
    if proc.returncode == 0 and tmp.exists():
        shutil.move(tmp, path)
    else:
        tmp.unlink(missing_ok=True)


async def frames(path: Path, duration: float, out_dir: Path, stem: str) -> list[str]:
    """A few stills spread over the video, for the panel and the reviewer page."""
    names = []
    for i in range(1, FRAMES + 1):
        at = duration * i / (FRAMES + 1)
        name = f"{stem}_f{i}.jpg"
        proc = await asyncio.create_subprocess_exec(
            "ffmpeg", "-v", "error", "-y", "-ss", f"{at:.2f}", "-i", str(path), "-frames:v", "1",
            "-vf", "scale=-2:360", "-q:v", "5", str(out_dir / name))
        await proc.communicate()
        if proc.returncode == 0 and (out_dir / name).exists():
            names.append(name)
    return names


def _overlaps(a: tuple[float, float], spans: list[tuple[float, float]], slack: float = 1.5) -> bool:
    """A detected silence counts as meant when it sits inside a planned one, give or take the lead and tail
    around a spoken line (a card at the end starts its silence a second early)."""
    return any(a[0] >= s0 - slack and a[1] <= s1 + slack for s0, s1 in spans)


async def run(path: Path, template_id: str, props: dict, expected_duration: float | None,
              out_dir: Path, stem: str) -> tuple[list[VideoCheck], float | None, list[str]]:
    """All checks on a rendered file. Returns the checks, the final loudness, and the saved frame names."""
    checks: list[VideoCheck] = []
    insp = await inspect(path)
    if insp.loudness is None:
        checks.append(VideoCheck(name="loudness", ok=False, detail="لا صوت في الفيديو."))
    elif not LOUDNESS_RANGE[0] <= insp.loudness <= LOUDNESS_RANGE[1]:
        before = insp.loudness
        await normalize(path)
        insp = await inspect(path)
        checks.append(VideoCheck(name="loudness", ok=True,
                                 detail=f"سُوّي الصوت من {before:.1f} إلى {insp.loudness:.1f} LUFS."))
    else:
        checks.append(VideoCheck(name="loudness", ok=True, detail=f"الصوت {insp.loudness:.1f} LUFS، مناسب للمنصات."))

    meant = expected_silences(template_id, props)
    unexpected = [s for s in insp.silences if not _overlaps(s, meant)]
    if unexpected:
        spans = "، ".join(f"{a:.0f}-{b:.0f} ث" for a, b in unexpected[:4])
        checks.append(VideoCheck(name="silence", ok=False, detail=f"صمت غير مقصود أطول من {SILENCE_MIN:.0f} ث عند: {spans}."))
    else:
        checks.append(VideoCheck(name="silence", ok=True, detail="لا صمت غير مقصود." if not meant else
                                 f"لا صمت غير مقصود؛ {len(meant)} فترة صمت مقصودة لقراءة نص شرعي بلا تسجيل."))

    if insp.black:
        spans = "، ".join(f"{a:.0f}-{b:.0f} ث" for a, b in insp.black[:4])
        checks.append(VideoCheck(name="black", ok=False, detail=f"إطارات سوداء عند: {spans}."))
    else:
        checks.append(VideoCheck(name="black", ok=True, detail="لا إطارات سوداء."))

    if expected_duration:
        diff = insp.duration - expected_duration
        ok = abs(diff) <= LENGTH_TOLERANCE
        checks.append(VideoCheck(name="length", ok=ok, detail=(
            f"المدة {insp.duration:.0f} ث كما في المواصفة." if ok else
            f"المدة {insp.duration:.0f} ث تخالف المواصفة ({expected_duration:.0f} ث).")))

    out_dir.mkdir(parents=True, exist_ok=True)
    stills = await frames(path, insp.duration, out_dir, stem)
    return checks, insp.loudness, stills


def spec_duration(template_id: str, props: dict) -> float | None:
    if template_id == "teaser":
        return props.get("introSeconds", 0) + props.get("ctaSeconds", 0) + sum(s["duration"] for s in props.get("shots", []))
    if "scenes" in props and "cues" not in props:
        return sum(s["duration"] for s in props["scenes"])
    return props["duration"] + OUTRO_SECONDS if "duration" in props else None


def load_props(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))["spec"]
