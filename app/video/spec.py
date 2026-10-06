"""Builds the input a Remotion composition reads (video/src/spec.ts) from a script: synthesizes every spoken
line, generates the illustrations, and times the scenes by the real audio lengths.

The caption templates (captions, geo) play the script's scenes; the story templates (kids, chalk) play the
script's story. Religious texts are never synthesized: the Quran is recited from a real recording, a hadith
from the creator's recording in data/recitations/, and without one the text is shown in silence."""
import asyncio
import re
import shutil
from dataclasses import dataclass, field
from pathlib import Path

from ..schemas import EvidenceKind, Language, Reference, ReferenceUsage, Script, StoryScene, StorySceneKind
from . import catalog, media, recitation

LEAD = 0.3      # silence before the first line of a scene
GAP = 0.5       # between lines
TAIL = 0.7      # after the last line
QUOTE = re.compile(r"«[^»]*»")
PHRASE_END = re.compile(r"(?<=[.!?؟،,;؛:])\s+")

LABELS = {
    Language.ar: {
        "story": "اسْتَمِعْ وَتَعَلَّمْ", "board": "سَبُّورَةُ الدَّرْسِ", "words": "نَفْهَمُ مَعًا", "quiz": "سُؤَالٌ",
        "hadith": "حَدِيثٌ شَرِيفٌ", "quran": "آيَةٌ كَرِيمَةٌ",
        "said_hadith": "قَالَ النَّبِيُّ ﷺ:", "said_quran": "قَالَ اللهُ تَعَالَى:",
    },
    Language.en: {
        "story": "Listen and learn", "board": "Lesson board", "words": "Let's understand", "quiz": "Question",
        "hadith": "A hadith", "quran": "A verse",
        "said_hadith": "The Prophet ﷺ said:", "said_quran": "Allah says (translation of the meaning):",
    },
}


def reading_seconds(text: str) -> float:
    return max(3.0, 0.5 * len(text.split()) + 1.0)


@dataclass
class Build:
    """Where a video's files go and what it cost. `public` is the Remotion public dir for this render."""
    public: Path
    new_images: int = 0
    new_clips: int = 0
    notes: list[str] = field(default_factory=list)
    _n: int = field(default=0)

    def take(self, clip: media.Clip, ext: str) -> str:
        """Copies a cached file into the public dir and returns its name for the spec."""
        self._n += 1
        name = f"{self._n:03d}.{ext}"
        shutil.copyfile(clip.path, self.public / name)
        if clip.new:
            if ext == "mp3":
                self.new_clips += 1
            else:
                self.new_images += 1
        return name


def _quoted(script: Script) -> list[Reference]:
    return [r for r in script.references if r.usage == ReferenceUsage.quoted]


async def recite(ref: Reference, build: Build) -> media.Clip | None:
    """A real recording of the quoted text, or None (with a note) when there is none."""
    if ref.kind == EvidenceKind.quran:
        clip = await recitation.quran_recording(ref)
        if clip is None:
            build.notes.append(f"تعذر جلب تلاوة {ref.source}، فعُرضت الآية بصمت.")
        return clip
    clip = recitation.hadith_recording(ref)
    if clip is None:
        name = (ref.hadith_key or "").replace(":", "-") or "الحديث"
        build.notes.append(
            f"لا يوجد تسجيل للحديث ({ref.source})، فعُرض بصمت. لإسماعه ضع تسجيلا باسم data/recitations/{name}.mp3."
        )
    return clip


def _cues(text: str, t0: float, t1: float, emph: bool = False, max_words: int = 9) -> list[dict]:
    """Splits text into short caption lines and spreads them over [t0, t1] by length."""
    chunks: list[str] = []
    for phrase in PHRASE_END.split(text.strip()):
        words = phrase.split()
        while words:
            chunks.append(" ".join(words[:max_words]))
            words = words[max_words:]
    chunks = [c for c in chunks if c]
    if not chunks:
        return []
    total = sum(len(c) for c in chunks)
    cues, t = [], t0
    for c in chunks:
        d = (t1 - t0) * len(c) / total
        cues.append({"t0": round(t, 2), "t1": round(t + d, 2), "text": c, "emph": emph})
        t += d
    return cues


# ---- Caption templates ----

async def build_captions(script: Script, template: dict, build: Build) -> dict:
    quoted = _quoted(script)
    lang = script.target.language
    cues, art, audio = [], [], []
    t = 0.0
    for scene in script.scenes:
        start = t
        text = scene.voiceover.strip() or scene.on_screen_text.strip()
        parts = [p for p in re.split(f"({QUOTE.pattern})", text) if p and p.strip()] if scene.voiceover.strip() else []
        if not parts:
            # Nothing spoken: show the on-screen text for reading time.
            d = reading_seconds(text) if text else 2.0
            if text:
                cues += _cues(text, t, t + d, emph=True)
            t += d
        for part in parts:
            ref = next((r for r in quoted if r.text in part), None) if part.startswith("«") else None
            if ref is not None:
                # A quoted text: a real recitation, or silence for reading time.
                clip = await recite(ref, build)
                d = clip.seconds + 0.4 if clip else reading_seconds(part)
                if clip:
                    audio.append({"t0": round(t, 2), "src": build.take(clip, "mp3")})
                cues += _cues(part, t, t + (clip.seconds if clip else d), emph=True, max_words=12)
            else:
                clip = await media.speak(part, "narr")
                d = clip.seconds + 0.25
                audio.append({"t0": round(t, 2), "src": build.take(clip, "mp3")})
                cues += _cues(part, t, t + clip.seconds)
            t += d
        t += 0.4
        a = scene.art
        item = {"t0": round(start, 2), "t1": round(t, 2), "kind": a.kind.value, "keyword": a.keyword,
                "detail": a.detail, "emoji": a.emoji}
        if a.kind.value == "image" and template["uses_images"] and a.image_prompt.strip():
            item["image"] = build.take(await media.illustrate(a.image_prompt, "9:16", "photo"), "jpg")
        art.append(item)
    return {
        "lang": lang.value, "duration": round(t, 2), "hook": script.hook, "cues": cues, "art": art,
        "audio": audio, "outro": [script.call_to_action],
    }


# ---- Story templates ----

async def build_story(script: Script, template: dict, build: Build) -> dict:
    if script.story is None:
        raise ValueError("This script has no story yet; choose a children's template to write one.")
    lang = script.target.language
    labels = LABELS[lang]
    name = lambda who: catalog.CHARACTERS[who][lang.value]  # noqa: E731
    scenes = []
    for n, s in enumerate(script.story.scenes, start=1):
        spec: dict = {"id": f"s{n}", "type": s.kind.value}
        if s.kind == StorySceneKind.text:
            ref = next((r for r in _quoted(script) if r.evidence_id == s.evidence_id), None)
            await _text_scene(s, ref, spec, labels, build)
        else:
            clips = await asyncio.gather(*(media.speak(line.text, line.who) for line in s.lines))
            t = LEAD
            lines = []
            for line, clip in zip(s.lines, clips):
                lines.append({"who": line.who, "name": name(line.who), "text": line.text,
                              "audio": build.take(clip, "mp3"), "t0": round(t, 2), "d": round(clip.seconds, 2)})
                t += clip.seconds + GAP
            spec["lines"] = lines
            spec["duration"] = round(t - GAP + TAIL, 2)
            spec["title"] = labels["story" if s.kind in (StorySceneKind.story, StorySceneKind.outro) else s.kind.value]
            spec["board"] = labels["board"]
            if s.kind in (StorySceneKind.story, StorySceneKind.outro):
                spec["image"] = build.take(await media.illustrate(s.image_prompt, "16:9", "story"), "jpg")
            if s.kind == StorySceneKind.words:
                spec["cards"] = [c.model_dump() for c in s.cards]
            if s.kind == StorySceneKind.quiz:
                spec.update(question=s.question, choices=s.choices, answer=0, revealAt=lines[1]["t0"])
        scenes.append(spec)
    return {"lang": lang.value, "title": script.story.title, "scenes": scenes}


async def _text_scene(s: StoryScene, ref: Reference | None, spec: dict, labels: dict, build: Build) -> None:
    quran = s.quote_kind == EvidenceKind.quran
    spec.update(title=labels["quran" if quran else "hadith"], board=labels["board"],
                text=labels["said_quran" if quran else "said_hadith"], quote=s.quote, source=s.source)
    clip = await recite(ref, build) if ref else None
    if clip:
        spec.update(audio=build.take(clip, "mp3"), audioAt=LEAD, duration=round(LEAD + clip.seconds + 1.0, 2),
                    quoteLead=LEAD, quoteEnd=round(LEAD + clip.seconds, 2))
    else:
        # No recording: shown in silence for reading time, never synthesized.
        d = reading_seconds(s.quote) + 1.5
        spec.update(duration=round(LEAD + d + TAIL, 2), quoteLead=LEAD, quoteEnd=round(LEAD + d, 2))


async def build(script: Script, template: dict, b: Build) -> dict:
    if template["story"]:
        return await build_story(script, template, b)
    return await build_captions(script, template, b)
