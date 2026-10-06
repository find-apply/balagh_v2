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
        "teaser_intro": "حَلْقَةٌ جَدِيدَةٌ لِأَطْفَالِكُمْ", "teaser_lesson": "الدَّرْسُ", "teaser_from": "النَّصُّ الشَّرْعِيُّ فِي الْحَلْقَةِ",
        "teaser_cta": "شَاهِدُوا الْحَلْقَةَ كَامِلَةً مَعَ أَطْفَالِكُمْ",
    },
    Language.en: {
        "story": "Listen and learn", "board": "Lesson board", "words": "Let's understand", "quiz": "Question",
        "hadith": "A hadith", "quran": "A verse",
        "said_hadith": "The Prophet ﷺ said:", "said_quran": "Allah says (translation of the meaning):",
        "teaser_intro": "A new episode for your children", "teaser_lesson": "The lesson", "teaser_from": "The text in this episode",
        "teaser_cta": "Watch the full episode with your children",
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
                prompt, refs = _cast_prompt(s.image_prompt, s.present, lang)
                spec["image"] = build.take(await media.illustrate(prompt, "16:9", "story", refs), "jpg")
            if s.kind == StorySceneKind.words:
                spec["cards"] = [c.model_dump() for c in s.cards]
            if s.kind == StorySceneKind.quiz:
                spec.update(question=s.question, choices=s.choices, answer=0, revealAt=lines[1]["t0"])
        scenes.append(spec)
    return {"lang": lang.value, "title": script.story.title, "scenes": scenes}


def _cast_prompt(prompt: str, present: list[str], lang: Language) -> tuple[str, list[Path]]:
    """Attaches each present character's reference drawing and tells the model which is which."""
    refs = [catalog.VIDEO_DIR / "characters" / catalog.CHARACTERS[who]["sheet"] for who in present]
    if not refs:
        return prompt, []
    who_is = "; ".join(
        f"reference image {i} is {catalog.CHARACTERS[who]['en']} ({catalog.CHARACTERS[who]['look']})"
        for i, who in enumerate(present, start=1)
    )
    return (f"{prompt} {who_is}. Keep each character's face, hair, hijab and clothes exactly as in their "
            f"reference image."), refs


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


# ---- Parents' teaser: cut from the story, nothing new generated ----

async def build_teaser(script: Script, template: dict, build: Build) -> dict:
    """20-30 vertical seconds for the parents' feeds: two story shots, the lesson, the text's source and a call
    to watch the whole episode. Every clip and image is the story's own, so after the episode it costs nothing."""
    if script.story is None:
        raise ValueError("This script has no story yet; choose a children's template to write one.")
    lang = script.target.language
    labels = LABELS[lang]
    name = lambda who: catalog.CHARACTERS[who][lang.value]  # noqa: E731
    story = [s for s in script.story.scenes if s.kind == StorySceneKind.story and s.lines]
    outro = next((s for s in script.story.scenes if s.kind == StorySceneKind.outro and s.lines), None)
    picks = story[:2] + ([outro] if outro else story[2:3])

    async def shot(s: StoryScene) -> dict:
        line = s.lines[0]
        clip = await media.speak(line.text, line.who)
        prompt, refs = _cast_prompt(s.image_prompt, s.present, lang)
        image = build.take(await media.illustrate(prompt, "16:9", "story", refs), "jpg")
        return {"image": image, "duration": round(LEAD + clip.seconds + TAIL, 2),
                "lines": [{"who": line.who, "name": name(line.who), "text": line.text,
                           "audio": build.take(clip, "mp3"), "t0": LEAD, "d": round(clip.seconds, 2)}]}

    shots = [await shot(s) for s in picks]
    text = next((s for s in script.story.scenes if s.kind == StorySceneKind.text), None)
    return {
        "lang": lang.value, "title": script.story.title, "intro": labels["teaser_intro"],
        "lesson": labels["teaser_lesson"], "shots": shots,
        "source": f"{labels['teaser_from']}: {text.source}" if text else "",
        "cta": labels["teaser_cta"], "introSeconds": 3.0, "ctaSeconds": 4.0,
    }


async def build(script: Script, template: dict, b: Build) -> dict:
    if template["id"] == "teaser":
        return await build_teaser(script, template, b)
    if template["story"]:
        return await build_story(script, template, b)
    return await build_captions(script, template, b)
