"""A tafsir lesson for any passage: the writer plans it, code checks it, the reciter's recording is cut to its
phrases, the narration is synthesized, and the scenes are laid out from a few fixed patterns.

    uv run python -m lessons.lesson lessons/fatiha.json            # plan (if missing), audio, spec
    cd video && npx remotion render src/index.ts Explainer out/<slug>.mp4 --props=samples/<slug>.json

A lesson file names the passage (surah, first and last ayah), the hadith the hook stands on (a passage of its text,
to find the right narration), the reciter, and a note for the writer. The plan is written once by gpt-6.1-sol and
kept in lessons/<slug>.plan.json, so it can be read and edited before any audio is made.

What code guarantees, whatever the writer does:
- the recited spans, taken in order, are the passage word for word, sliced from the corpus;
- every explanation quotes the passage of Tafsir al-Muyassar (or of the hadith) it rests on, and every quote of
  the hadith on screen is in its text;
- each cut of the recording is transcribed and compared with its words before it is used;
- the narrator never recites: the verses are heard from the reciter only.
The layout is not the writer's: it picks one of a few patterns per scene and fills in short texts; code places them.
"""
import asyncio
import difflib
import json
import subprocess
import sys
from pathlib import Path
from typing import Literal, Optional

import httpx
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))

import build_explainer as bx  # noqa: E402
from build_explainer import TAIL, card, edge, media, pill, text  # noqa: E402
from google.genai import types  # noqa: E402

from app import sources  # noqa: E402
from app.generator import _call_openai  # noqa: E402

from .build_kursi import GAP, LEAD, shown, trimmed  # noqa: E402

MODEL = "gpt-6.1-sol"
PUBLIC = bx.PUBLIC
EVERYAYAH = "https://everyayah.com/data"


# ---------- the plan ----------

class Item(BaseModel):
    label: str = Field(description="A short label (one to four words).")
    sub: Optional[str] = Field(description="An optional short line under the label, or null.")


class Layout(BaseModel):
    pattern: Literal["statement", "pair", "term", "chips", "flow", "dialogue"] = Field(description=(
        "statement: one sentence on screen (`text`, mark one key phrase with <b>…</b>). "
        "pair: two cards side by side (`items`, 2; a third item becomes a card both lead to). "
        "term: a word of the verse and its meaning (`items`[0]: label = the word, sub = its meaning), with `text` under it if given. "
        "chips: a sentence (`text`) and up to four short tags (`items`, labels only). "
        "flow: one card leading to another (`items`, 2). "
        "dialogue: up to four lines of a conversation, in order (`items`: label = the words, sub = who says them)."))
    text: Optional[str]
    items: list[Item]


class Aside(BaseModel):
    quote: str = Field(description="Words of the hadith, copied exactly as the hadith gives them (without its diacritics is fine).")
    source: str = Field(description="Who says it and where, e.g. «قال الله تعالى · صحيح مسلم 395».")


class PlanScene(BaseModel):
    kind: Literal["hook", "hadith", "recite", "summary", "close"]
    ayah: Optional[int] = Field(description="recite only: the ayah this scene starts in.")
    to_ayah: Optional[int] = Field(description="recite only: when the scene recites whole ayahs, the last one (same as `ayah` for one whole ayah); null when it recites part of `ayah`.")
    words: Optional[int] = Field(description="recite only, when `to_ayah` is null: how many words of `ayah` this scene recites, continuing where the previous scene stopped.")
    say: list[str] = Field(description="The narration in short parts (one to five), each a sentence or a clause; elements appear on each part.")
    layout: Layout
    aside: Optional[Aside] = Field(description="Optional: a quote of the hadith shown with this scene (e.g. what Allah answers to this ayah).")
    grounding: str = Field(description="The exact words of the tafsir or of the hadith the explanation rests on; empty for the hook and the close.")


class Plan(BaseModel):
    title: str
    scenes: list[PlanScene]
    notes_for_reviewer: list[str]


SYSTEM = """You plan a tafsir lesson video in the style of a clean animated explainer: a calm narrator, words and \
cards appearing on a light canvas. The reciter recites the passage phrase by phrase; after each phrase the narrator \
explains it. Length does not matter: clarity does.

Scenes, in order:
1. hook: a question or a striking fact, grounded in the given hadith. Two or three short parts.
2. hadith: the given hadith told faithfully and briefly (layout `dialogue` suits a conversation).
3. recite scenes: the WHOLE passage, in order, no word left out or added. Split a long ayah at its natural pauses \
(waqf marks) with `words`; give short ayahs whole with `to_ayah`. Each recite scene explains what was just recited.
4. summary: what the passage gathered, as tags (layout `chips`).
5. close: a practical call, two or three short parts.

Rules:
- Explain only from the given Tafsir al-Muyassar; `grounding` copies the tafsir words each explanation rests on.
- The narrator never recites a verse. Write «صلى الله عليه وسلم» in the narration, never the ligature.
- Screen texts are short; they show the gist, the narration carries the rest.
- Detailed creed matters and naming groups of people: keep to the tafsir's descriptions, do not elaborate, and \
note them for the reviewer.
- Modern Standard Arabic, plain and warm, short sentences, no filler."""


class Lesson(BaseModel):
    slug: str
    surah: int
    first: int
    last: int
    hadith: str = Field(description="A passage of the hadith's text, to find the right narration.")
    reciter: str = "Alafasy_128kbps"
    reciter_name: str = "مشاري راشد العفاسي"
    note: str = ""


def words_of(lesson: Lesson) -> dict[int, list[str]]:
    return {a: sources.get_verses(lesson.surah, a, a).text.split() for a in range(lesson.first, lesson.last + 1)}


def hadith_of(lesson: Lesson):
    found = sources.search_hadith(lesson.hadith)
    if not found:
        raise SystemExit("the hadith was not found in the corpus")
    return found[0]


def spans(plan: Plan, words: dict[int, list[str]]) -> list[tuple[int, int, int]]:
    """(ayah, first word, last word) for each recite scene, checking that together they are the passage in order."""
    out, ayah, at = [], min(words), 0
    for n, s in enumerate(plan.scenes, 1):
        if s.kind != "recite":
            continue
        if s.ayah != ayah:
            raise ValueError(f"scene {n} starts at ayah {s.ayah}, but the passage continues at ayah {ayah}")
        if s.to_ayah is not None:
            if at != 0:
                raise ValueError(f"scene {n} recites whole ayahs but ayah {ayah} was begun by the previous scene")
            for a in range(s.ayah, s.to_ayah + 1):
                out.append((a, 0, len(words[a])))
            ayah, at = s.to_ayah + 1, 0
        else:
            if not s.words or at + s.words > len(words[ayah]):
                raise ValueError(f"scene {n}: ayah {ayah} has {len(words[ayah])} words, {at} already recited")
            out.append((ayah, at, at + s.words))
            at += s.words
            if at == len(words[ayah]):
                ayah, at = ayah + 1, 0
    if ayah != max(words) + 1:
        raise ValueError(f"the recite scenes stop before the end of the passage (at ayah {ayah}, word {at})")
    return out


def check(plan: Plan, lesson: Lesson) -> list[str]:
    """Everything code can verify in a plan; an empty list means it passed."""
    words, problems = words_of(lesson), []
    try:
        spans(plan, words)
    except ValueError as e:
        problems.append(str(e))
    tafsir = " ".join(sources.get_verses(lesson.surah, a, a).tafsir[0].text for a in words)
    hadith = hadith_of(lesson).text
    within = lambda t: sources.normalize(t) in sources.normalize(tafsir) or sources.normalize(t) in sources.normalize(hadith)
    for n, s in enumerate(plan.scenes, 1):
        if s.kind in ("hadith", "recite") and not s.grounding.strip():
            problems.append(f"scene {n} ({s.kind}) has no grounding")
        # A grounding may gather several passages, one per line (or joined by «…»): each must be there as given.
        for part in (p.strip() for p in s.grounding.replace("…", "\n").splitlines()):
            if part and not within(part):
                problems.append(f"scene {n}: its grounding is not in the tafsir or the hadith as given: «{part[:80]}»")
        if s.aside and sources.normalize(s.aside.quote) not in sources.normalize(hadith):
            problems.append(f"scene {n}: the quote «{s.aside.quote}» is not in the hadith as given")
        if not 1 <= len(s.say) <= 5:
            problems.append(f"scene {n}: the narration needs one to five parts")
        if "ﷺ" in " ".join(s.say):
            problems.append(f"scene {n}: write «صلى الله عليه وسلم» in the narration")
    return problems


def write_plan(lesson: Lesson) -> Plan:
    words, h = words_of(lesson), hadith_of(lesson)
    verses = "\n".join(f'<ayah n="{a}" words="{len(w)}">{" ".join(w)}</ayah>' for a, w in words.items())
    tafsir = "\n".join(f'<tafsir ayah="{a}">{sources.get_verses(lesson.surah, a, a).tafsir[0].text}</tafsir>' for a in words)
    prompt = (f"<passage surah=\"{lesson.surah}\">\n{verses}\n</passage>\n\n{tafsir}\n\n"
              f"<hadith source=\"{h.source}\">{h.text}</hadith>\n\n<note>{lesson.note}</note>")
    async def attempts() -> Plan:
        feedback = ""
        for _ in range(3):
            plan = await _call_openai(SYSTEM, prompt + feedback, Plan, MODEL)
            problems = check(plan, lesson)
            if not problems:
                return plan
            print(f"  plan rejected ({len(problems)}):", *problems, sep="\n    ")
            (ROOT / "lessons" / f"{lesson.slug}.rejected.json").write_text(json.dumps(plan.model_dump(), ensure_ascii=False, indent=2))
            feedback = "\n\n<previous_attempt_problems>\n" + "\n".join(problems) + "\n</previous_attempt_problems>"
        raise SystemExit("the writer could not produce a plan that passes the checks")
    return asyncio.run(attempts())


# ---------- the recitation ----------

def ayah_file(lesson: Lesson, ayah: int, folder: Path) -> Path:
    out = folder / f"ayah_{ayah:03d}.mp3"
    if not out.exists():
        url = f"{EVERYAYAH}/{lesson.reciter}/{lesson.surah:03d}{ayah:03d}.mp3"
        out.write_bytes(httpx.get(url, timeout=60, follow_redirects=True).raise_for_status().content)
    return out


def _envelope(path: Path, start: float = 0.0) -> list[float]:
    """Loudness in dB per 50 ms."""
    import array, math
    pcm = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-ac", "1", "-ar", "8000", "-f", "s16le", "-"], capture_output=True, check=True).stdout
    a, w = array.array("h", pcm), 400
    return [20 * math.log10(max(1, (sum(x * x for x in a[i:i + w]) / w) ** 0.5) / 32768) for i in range(0, len(a) - w, w)]


def _dips(env: list[float]) -> list[float]:
    """Candidate cut points: the middle of every quiet stretch (and every local minimum), deepest first."""
    out = []
    for th in (-40, -33, -27):
        k = 0
        while k < len(env):
            if env[k] < th:
                j = k
                while j < len(env) and env[j] < th:
                    j += 1
                out.append(((k + j) / 2 * 0.05, min(env[k:j])))
                k = j
            k += 1
    out += [(k * 0.05, env[k]) for k in range(1, len(env) - 1) if env[k] < env[k - 1] and env[k] < env[k + 1]]
    seen, best = set(), []
    for t, d in sorted(out, key=lambda x: x[1]):
        if all(abs(t - s) > 0.15 for s in seen):
            seen.add(t)
            best.append(t)
    return best


async def _heard(path: Path) -> str:
    r = await media.client.aio.models.generate_content(model=bx.CHECK_MODEL, contents=[
        types.Part.from_bytes(data=path.read_bytes(), mime_type="audio/mpeg"),
        "This is a Quran recitation. Transcribe exactly the Arabic words recited, without diacritics. Output the words only."])
    return sources.normalize(r.text or "")


def _match(words: str, heard: str) -> float:
    return difflib.SequenceMatcher(None, sources.normalize(words), heard).ratio()


async def _cut(src: Path, a: float, b: float, out: Path) -> Path:
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{a:.2f}", "-to", f"{b:.2f}", "-i", str(src), "-af",
                    f"afade=t=in:d=0.03,afade=t=out:st={max(0.0, b - a - 0.2):.2f}:d=0.2,loudnorm=I=-16:TP=-1.5",
                    "-ar", "44100", "-ac", "1", "-b:a", "128k", str(out)], check=True)
    return out


async def split_ayah(src: Path, parts: list[str], folder: Path, stem: str) -> list[Path]:
    """The ayah's recording cut into its parts: each boundary starts at the quiet point nearest to where the words
    before it end (by their share of letters), and moves to the next candidates until every cut is heard as its words."""
    total = media.seconds_of(src)
    if len(parts) == 1:
        out = await _cut(src, 0, total, folder / f"{stem}_1.mp3")
        score = _match(parts[0], await _heard(out))
        if score < 0.8:
            out.unlink()
            raise RuntimeError(f"{stem}: the recording is not heard as its ayah ({score:.2f})")
        print(f"  {stem}: whole ({score:.2f})")
        return [out]
    env, dips = _envelope(src), None
    dips = _dips(env)
    letters = [len(sources.normalize(p).replace(" ", "")) for p in parts]
    estimates = [total * sum(letters[:k]) / sum(letters) for k in range(1, len(parts))]
    choices = [sorted(dips, key=lambda t: abs(t - e))[:4] for e in estimates]
    bounds = [c[0] for c in choices]
    for _ in range(12):
        edges = [0.0, *bounds, total]
        cuts = [await _cut(src, edges[k], edges[k + 1], folder / f"{stem}_{k + 1}.mp3") for k in range(len(parts))]
        heard = await asyncio.gather(*(_heard(c) for c in cuts))
        scores = [_match(p, h) for p, h in zip(parts, heard)]
        if min(scores) >= 0.8:
            print(f"  {stem}: cut at {[round(b, 2) for b in bounds]} ({', '.join(f'{s:.2f}' for s in scores)})")
            return cuts
        k = scores.index(min(scores))  # move a boundary of the worst part to its next candidate
        b = k if k < len(bounds) else k - 1
        nxt = [c for c in choices[b] if c != bounds[b]]
        if not nxt:
            break
        choices[b] = nxt
        bounds[b] = nxt[0]
    raise RuntimeError(f"{stem}: no cut matches its words; set the cut points by hand")


async def recitations(lesson: Lesson, plan: Plan, folder: Path) -> list[Path]:
    """One clip per recite scene, in order."""
    words = words_of(lesson)
    by_scene, per_ayah = [], {}
    for a, i, j in spans(plan, words):
        per_ayah.setdefault(a, []).append((i, j))
    clips: dict[tuple[int, int, int], Path] = {}
    for a, ranges in per_ayah.items():
        src = ayah_file(lesson, a, folder)
        stem = f"rec_{a:03d}"
        if all((folder / f"{stem}_{k + 1}.mp3").exists() for k in range(len(ranges))):
            cuts = [folder / f"{stem}_{k + 1}.mp3" for k in range(len(ranges))]
        else:
            cuts = await split_ayah(src, [" ".join(words[a][i:j]) for i, j in ranges], folder, stem)
        for (i, j), c in zip(ranges, cuts):
            clips[(a, i, j)] = c
    # a scene with several whole ayahs gets them one after another
    k = 0
    for s in plan.scenes:
        if s.kind != "recite":
            continue
        n = (s.to_ayah - s.ayah + 1) if s.to_ayah is not None else 1
        keys = spans(plan, words)[k:k + n]
        k += n
        if n == 1:
            by_scene.append(clips[keys[0]])
        else:
            out = folder / f"rec_{keys[0][0]:03d}-{keys[-1][0]:03d}.mp3"
            if not out.exists():
                args = [x for key in keys for x in ("-i", str(clips[key]))]
                subprocess.run(["ffmpeg", "-v", "error", "-y", *args, "-filter_complex",
                                "".join(f"[{m}:a]" for m in range(n)) + f"concat=n={n}:v=0:a=1[o]", "-map", "[o]", str(out)], check=True)
            by_scene.append(out)
    return by_scene


# ---------- audio of a scene ----------

async def scene_audio(segments: list, folder: Path) -> tuple[Path, list[float]]:
    """Narration ("say", "a|b") and recitation ("rec", path) segments joined, with the time each cue starts."""
    import hashlib
    raw = await asyncio.gather(*(bx.narrate(v) if k == "say" else asyncio.sleep(0, v) for k, v in segments))
    paths = [trimmed(p) for p in raw]
    cues, t = [], 0.0
    for (k, v), r, p in zip(segments, raw, paths):
        cues += [round(t + c, 2) for c in bx.cue_times(v, r)] if k == "say" else [round(t, 2)]
        t += media.seconds_of(p) + GAP
    # Keyed by the clips' contents as well as their names: a re-voiced clip keeps its name.
    key = "|".join(f"{p}:{p.stat().st_size}:{p.stat().st_mtime_ns}" for p in paths)
    out = folder / f"scene_{hashlib.sha256(key.encode()).hexdigest()[:16]}.mp3"
    if not out.exists():
        gap = folder / "gap.wav"
        if not gap.exists():
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-t", str(GAP), str(gap)], check=True)
        inputs = [x for p in paths for x in (p, gap)][:-1]
        args = [a for p in inputs for a in ("-i", str(p))]
        fade = lambda p: "" if p == gap else ",afade=t=in:d=0.02,areverse,afade=t=in:d=0.1,areverse"
        mix = "".join(f"[{n}:a]aresample=44100,aformat=channel_layouts=mono{fade(p)}[a{n}];" for n, p in enumerate(inputs))
        mix += "".join(f"[a{n}]" for n in range(len(inputs))) + f"concat=n={len(inputs)}:v=0:a=1[out]"
        subprocess.run(["ffmpeg", "-v", "error", "-y", *args, "-filter_complex", mix, "-map", "[out]", "-b:a", "128k", str(out)], check=True)
    return out, cues


# ---------- layout ----------

def _size(t: str, big: int) -> int:
    n = len(t)
    return big if n <= 34 else big - 8 if n <= 48 else big - 16


def layout(lay: Layout, first: int, y0: int = 420, conversation: bool = False) -> list[dict]:
    """The pattern's elements, all entering with the scene's first narration part, a beat apart: the writer's
    cards do not map one to one onto its sentences, so tying each card to a later part put them out of step."""
    it, out = lay.items, []
    if lay.pattern == "statement" and lay.text:
        out.append(text(960, y0, lay.text, first, font="title", size=_size(lay.text, 60), align="center", w=1640))
    elif lay.pattern == "pair" and len(it) >= 2:
        out += [card("p0", 1250, y0 + 170, it[0].label, sub=it[0].sub, at=first, w=520, h=190, size=1.3),
                card("p1", 670, y0 + 170, it[1].label, sub=it[1].sub, at=first, dt=0.6, w=520, h=190, size=1.3)]
        if len(it) >= 3:
            out += [card("p2", 960, y0 + 420, it[2].label, sub=it[2].sub, tone="green", at=first, dt=1.2, w=460, h=130, size=1.2),
                    edge("p0", "p2", first, 1.3), edge("p1", "p2", first, 1.4)]
    elif lay.pattern == "term" and it:
        out.append(card("t0", 960, y0 + 20, it[0].label, sub=it[0].sub, icon="quote", tone="gold", at=first, w=420, h=150, size=1.3))
        if lay.text:
            out.append(text(960, y0 + 190, lay.text, first, 0.6, font="title", size=_size(lay.text, 56), align="center", w=1600))
    elif lay.pattern == "chips":
        if lay.text:
            out.append(text(960, y0, lay.text, first, font="title", size=_size(lay.text, 56), align="center", w=1600))
        xs = {1: [960], 2: [1160, 760], 3: [1260, 960, 660], 4: [1350, 1080, 810, 540]}[min(4, max(1, len(it)))]
        out += [pill(x, y0 + 250, i.label, first, 0.8 + k * 0.35, tone="mint", size=1.2) for k, (x, i) in enumerate(zip(xs, it[:4]))]
    elif lay.pattern == "flow" and len(it) >= 2:
        out += [card("f0", 1260, y0 + 170, it[0].label, sub=it[0].sub, at=first, w=480, h=170, size=1.2),
                card("f1", 660, y0 + 170, it[1].label, sub=it[1].sub, tone="green", at=first, dt=0.7, w=480, h=170, size=1.25),
                edge("f0", "f1", first, 0.8)]
    elif lay.pattern == "dialogue" and not conversation:
        # Outside a conversation the writer's "dialogue" is a set of points: a sentence over a row of cards.
        y = y0
        if lay.text:
            out.append(text(960, y0, lay.text, first, font="title", size=_size(lay.text, 56), align="center", w=1600))
            y = y0 + 130
        row = it[:3]
        xs = {1: [960], 2: [1200, 720], 3: [1420, 960, 500]}[max(1, len(row))]
        out += [card(f"r{k}", x, y + 150, i.label, sub=i.sub, at=first, dt=0.8 + 0.45 * k, w=420, h=150, size=1.15)
                for k, (x, i) in enumerate(zip(xs, row))]
    elif lay.pattern == "dialogue":
        for k, i in enumerate(it[:4]):
            out.append(card(f"d{k}", 1180 if k % 2 == 0 else 740, 250 + k * 165, f"«{i.label}»", sub=i.sub,
                            icon="chat", tone="light" if k % 2 == 0 else "ghost", at=first + 1, dt=1.6 * k, w=900, h=130))
    return out


def scene_els(s: PlanScene, n_parts: int, verse: Optional[str]) -> list[dict]:
    first = 1 if verse else 0
    els = []
    if verse:
        els.append(text(960, 170, shown(verse), 0, 0.1, font="quran", size=78 if len(verse) < 60 else 62, align="center", w=1760, color="#0b5e43", sfx=None))
    els += layout(s.layout, first, 400 if verse else 300, conversation=s.kind == "hadith")
    if s.aside:
        last = first + n_parts - 1
        els.append(card("aside", 960, 860, f"«{s.aside.quote}»", sub=s.aside.source, icon="star", tone="dark", at=last, dt=0.2, w=760, h=110))
    if s.kind == "recite":
        els.append(pill(960, 990, "الشرح من التفسير الميسّر", first, 0.8, tone="mint", icon="book", size=0.85))
    return els


def hook_els(s: PlanScene) -> list[dict]:
    """The writer's short screen text as the title, its tags under it; the narration carries the sentences."""
    title = s.layout.text or s.say[0]
    els = [text(960, 330, title, 0, font="title", size=_size(title, 104), align="center", w=1700)]
    for k, i in enumerate(s.layout.items[:2]):
        els.append(pill(960, 600 + k * 100, i.label + (f" · {i.sub}" if i.sub else ""), min(k + 1, len(s.say) - 1), icon="spark", size=1.2))
    return els


def summary_els(title: str, s: PlanScene, n_parts: int) -> list[dict]:
    import math
    items = s.layout.items[:8]
    els = [card("hub", 960, 540, title, icon="book", tone="green", at=0, w=420, h=170, size=1.15)]
    for k, i in enumerate(items):
        ang = math.pi / 2 - 2 * math.pi * k / max(1, len(items))
        x, y = 960 + 640 * math.cos(ang), 540 - 300 * math.sin(ang)
        at = min(n_parts - 1, 1 + k * (n_parts - 1) // max(1, len(items))) if n_parts > 1 else 0
        els += [card(f"g{k}", round(x), round(y), i.label, at=at, dt=0.3 * (k % 2), w=300, h=96, tone="mint"),
                edge(f"g{k}", "hub", at, 0.3 * (k % 2) + 0.1)]
    return els


def close_els(s: PlanScene, credits: str) -> list[dict]:
    last = len(s.say) - 1
    title = s.layout.text or s.say[0]
    pills = s.layout.items[:3]
    xs = {1: [960], 2: [1160, 760], 3: [1260, 960, 660]}.get(len(pills), [])
    return [
        text(960, 300, title, 0, font="title", size=_size(title, 100), align="center", w=1600),
        *[pill(x, 560, i.label, min(k + 1, last), tone="mint", icon="check", size=1.25) for k, (x, i) in enumerate(zip(xs, pills))],
        text(960, 770, credits, last, 0.8, font="body", size=24, align="center", w=1700, color="#64746f"),
        {"k": "logo", "x": 960, "y": 880, "size": 80, "at": last, "dt": 1.2},
        text(960, 940, "بلاغ · balagh.space", last, 1.4, font="title", size=26, align="center", w=600, color="#0c9365"),
    ]


# ---------- build ----------

async def build(lesson: Lesson, plan: Plan) -> dict:
    folder = PUBLIC / "lessons" / lesson.slug
    folder.mkdir(parents=True, exist_ok=True)
    bx.VOICE_DIR = folder / "voice"
    words = words_of(lesson)
    rec = await recitations(lesson, plan, folder)
    texts = [" ".join(words[a][i:j]) for a, i, j in spans(plan, words)]
    h = hadith_of(lesson)
    credits = f"التلاوة: {lesson.reciter_name} · الشرح: التفسير الميسّر · الحديث: {h.source}"
    surah_name = sources.get_verses(lesson.surah, lesson.first, lesson.first).source.split("،")[0]

    built, r, t = [], 0, 0
    total = sum(1 for s in plan.scenes if s.kind == "recite")
    for s in plan.scenes:
        say = "|".join(p.strip().replace("|", "،") for p in s.say)
        if s.kind == "recite":
            n = (s.to_ayah - s.ayah + 1) if s.to_ayah is not None else 1
            verse = " ".join(texts[t:t + n])
            t += n
            r += 1
            built.append(({"kind": "canvas", "label": f"{plan.title} · {r} / {total}", "els": scene_els(s, len(s.say), verse)},
                          [("rec", rec[r - 1]), ("say", say)]))
            continue
        if s.kind == "hook":
            els, extra = hook_els(s), {"chrome": False}
        elif s.kind == "summary":
            els, extra = summary_els(surah_name, s, len(s.say)), {"label": "الخلاصة"}
        elif s.kind == "close":
            els, extra = close_els(s, credits), {"chrome": False}
        else:
            els = scene_els(s, len(s.say), None) + [text(960, 960, h.source, 0, 1.2, font="body", size=24, align="center", w=600, color="#64746f")]
            extra = {"label": "الحديث"}
        built.append(({"kind": "canvas", "els": els, **extra}, [("say", say)]))
        if s.kind == "hadith":
            built.append(({"kind": "chapter", "n": str(lesson.surah), "title": plan.title, "sub": f"{surah_name} · عبارةً عبارة", "seconds": bx.CHAPTER_SECONDS}, None))

    audio = await asyncio.gather(*(scene_audio(seg, folder) for _, seg in built if seg))
    scenes, k = [], 0
    for sc, seg in built:
        if seg is None:
            scenes.append(sc)
            continue
        path, cues = audio[k]
        k += 1
        sc.update({"audio": str(path.relative_to(PUBLIC)), "cues": cues, "seconds": round(LEAD + media.seconds_of(path) + TAIL, 2)})
        sc["els"] = [{key: v for key, v in e.items() if v is not None or key == "sfx"} for e in sc["els"]]
        scenes.append(sc)
    return {"brand": "بلاغ", "site": "balagh.space", "scenes": scenes}


def main(path: str) -> None:
    lesson = Lesson.model_validate_json(Path(path).read_text())
    plan_file = ROOT / "lessons" / f"{lesson.slug}.plan.json"
    if plan_file.exists():
        plan = Plan.model_validate_json(plan_file.read_text())
        problems = check(plan, lesson)
        if problems:
            raise SystemExit("the plan does not pass the checks:\n  " + "\n  ".join(problems))
    else:
        plan = write_plan(lesson)
        plan_file.write_text(json.dumps(plan.model_dump(), ensure_ascii=False, indent=2))
        print(f"plan → {plan_file.relative_to(ROOT)}")
    if "--plan" in sys.argv:
        return
    spec = asyncio.run(build(lesson, plan))
    out = ROOT / "video" / "samples" / f"{lesson.slug}.json"
    out.write_text(json.dumps({"spec": spec}, ensure_ascii=False))
    print(f"{len(spec['scenes'])} scenes, {sum(s['seconds'] for s in spec['scenes']):.0f} s → {out.relative_to(ROOT)}")


if __name__ == "__main__":
    main(sys.argv[1])
