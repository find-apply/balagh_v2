"""Build the Ayat al-Kursi lesson: the recitation cut phrase by phrase, the narration, and the scene spec for the
Explainer composition.

    uv run python -m lessons.build_kursi          # cut, verify and synthesize what is missing, write the spec
    cd video && npx remotion render src/index.ts Kursi out/kursi.mp4

The script comes from lessons/kursi_script.json (written by gpt-6.1-sol, checked in code), with two editorial
changes: Ubayy's answer in the hadith is heard from the reciter, as the hadith gives it, and the explanation of
«العليّ» keeps to the tafsir's words without «بذاته وصفاته». The first two phrases are one scene: the reciter
joins «هُوَ ٱلۡحَيُّ» without a pause, so a cut between them would split a word.

Nothing is synthesized from the Quran: the verse is Mishary Alafasy's recitation (everyayah.com), cut at his
breaths, and every cut is transcribed and compared with its phrase before it is used. The narrator never
recites; every explanation is a passage of Tafsir al-Muyassar, and the hadith is Muslim 810.
"""
import array
import asyncio
import difflib
import hashlib
import json
import subprocess
import sys
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))

import build_explainer as bx  # noqa: E402
from build_explainer import TAIL, card, edge, media, pill, text  # noqa: E402
from google.genai import types  # noqa: E402

from app import sources  # noqa: E402

PUBLIC = bx.PUBLIC
DIR = PUBLIC / "lessons" / "kursi"
bx.VOICE_DIR = DIR / "voice"
SPEC = ROOT / "video" / "samples" / "kursi.json"
AYAH = DIR / "ayah.mp3"  # https://everyayah.com/data/Alafasy_128kbps/002255.mp3
LEAD = 0.45
GAP = 0.45  # silence between the recitation and the narration in a scene
TOTAL = 9

# The verse's phrases: word counts into the verse as the corpus gives it, and where each is recited in ayah.mp3
# (seconds, at the reciter's breaths). The text is sliced from the corpus, never retyped.
_WORDS = sources.get_verses(2, 255, 255).text.split()
_CUTS = [(7, 0.0, 7.9), (5, 7.9, 13.65), (7, 13.65, 17.9), (7, 17.9, 25.65), (6, 25.65, 30.15),
         (8, 30.15, 39.9), (4, 39.9, 44.2), (3, 44.2, 47.7), (3, 47.7, 51.95)]
PHRASES, _n = [], 0
for _count, _a, _b in _CUTS:
    PHRASES.append((" ".join(_WORDS[_n:_n + _count]), _a, _b))
    _n += _count
assert _n == len(_WORDS), "the phrases must cover the verse"


# ---------- audio ----------

async def recitation(i: int) -> Path:
    """Phrase i of the recitation, checked by a transcription against the phrase before it is kept."""
    phrase, a, b = PHRASES[i]
    out = DIR / f"rec_{i + 1}.mp3"
    if out.exists():
        return out
    dur = b - a
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(a), "-to", str(b), "-i", str(AYAH), "-af",
                    f"afade=t=in:d=0.03,afade=t=out:st={dur - 0.2:.2f}:d=0.2,loudnorm=I=-16:TP=-1.5",
                    "-ar", "44100", "-ac", "1", "-b:a", "128k", str(out)], check=True)
    r = await media.client.aio.models.generate_content(model=bx.CHECK_MODEL, contents=[
        types.Part.from_bytes(data=out.read_bytes(), mime_type="audio/mpeg"),
        "This is a Quran recitation. Transcribe exactly the Arabic words recited, without diacritics. Output the words only."])
    heard = sources.normalize(r.text or "")
    ratio = difflib.SequenceMatcher(None, sources.normalize(phrase), heard).ratio()
    if ratio < 0.8:
        out.unlink()
        raise RuntimeError(f"phrase {i + 1} does not match its cut ({ratio:.2f}): heard «{heard}»")
    print(f"  recitation {i + 1} ok ({ratio:.2f})")
    return out


def trimmed(path: Path) -> Path:
    """The clip without the burst of noise the speech model leaves after the last word: cut at the last quiet
    stretch when what follows it is shorter than a third of a second."""
    lesson_dir = path.parent.parent if path.parent.name == "voice" else path.parent
    out = lesson_dir / "clean" / f"{path.stem}.wav"
    if out.exists():
        return out
    out.parent.mkdir(exist_ok=True)
    pcm = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-f", "s16le", "-ac", "1", "-ar", "44100", "-"],
                         capture_output=True, check=True).stdout
    a = array.array("h", pcm)
    w, end = 441, len(a)  # 10 ms windows
    quiet = [max(map(abs, a[i:i + w])) < 400 for i in range(0, len(a) - w, w)]
    for k in range(len(quiet) - 1, 4, -1):
        if all(quiet[k - 4:k + 1]):  # 50 ms of quiet
            if (len(a) - (k + 1) * w) / 44100 < 0.33:
                end = (k + 1) * w
            break
    with wave.open(str(out), "wb") as f:
        f.setnchannels(1), f.setsampwidth(2), f.setframerate(44100)
        f.writeframes(a[:end].tobytes())
    return out


async def scene_audio(segments: list) -> tuple[Path, list[float]]:
    """One audio file for a scene made of narration ("say", "a|b") and recitation ("rec", i) segments, in order,
    and the time each cue starts: one cue per recitation and one per "|" part of a narration."""
    raw = await asyncio.gather(*(bx.narrate(v) if k == "say" else recitation(v) for k, v in segments))
    paths = [trimmed(p) for p in raw]
    cues, t = [], 0.0
    for (k, v), r, p in zip(segments, raw, paths):
        cues += [round(t + c, 2) for c in bx.cue_times(v, r)] if k == "say" else [round(t, 2)]
        t += media.seconds_of(p) + GAP
    key = hashlib.sha256("|".join(["clean", *(p.name for p in paths)]).encode()).hexdigest()[:16]
    out = DIR / f"scene_{key}.mp3"
    if not out.exists():
        gap = DIR / "gap.wav"
        if not gap.exists():
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", f"anullsrc=r=44100:cl=mono", "-t", str(GAP), str(gap)], check=True)
        inputs = [x for p in paths for x in (p, gap)][:-1]
        args = [a for p in inputs for a in ("-i", str(p))]
        # A short fade at both ends of every clip: the synthesized narration stops abruptly and clicks without it.
        # (The fade-out is applied in reverse so it lands on the clip's real end, which the mp3 header overstates.)
        fade = lambda p: "" if p == gap else ",afade=t=in:d=0.02,areverse,afade=t=in:d=0.1,areverse"
        mix = "".join(f"[{n}:a]aresample=44100,aformat=channel_layouts=mono{fade(p)}[a{n}];" for n, p in enumerate(inputs))
        mix += "".join(f"[a{n}]" for n in range(len(inputs))) + f"concat=n={len(inputs)}:v=0:a=1[out]"
        subprocess.run(["ffmpeg", "-v", "error", "-y", *args, "-filter_complex", mix, "-map", "[out]", "-b:a", "128k", str(out)], check=True)
    return out, cues


# ---------- scenes ----------

# The corpus writes the open tanween as the KFGQPC font does (U+065E, U+0656, U+0657); the canvas's Amiri Quran
# draws them from their standard codepoints. Display only: the checks above run on the corpus text.
_SHOWN = str.maketrans({"\u065e": "\u08f1", "\u0656": "\u08f2", "\u0657": "\u08f0"})


def shown(t: str) -> str:
    return t.translate(_SHOWN)


def verse(i: int) -> dict:
    """The phrase being recited, at the top of the canvas, from the first cue."""
    return text(960, 170, shown(PHRASES[i][0]), 0, 0.1, font="quran", size=78, align="center", w=1760, color="#0b5e43", sfx=None)


def tafsir(at: int) -> dict:
    return pill(960, 985, "الشرح من التفسير الميسّر", at, 0.8, tone="mint", icon="book", size=0.85)


def lesson(n: int, segments: list, els: list, label: str | None = None, **kw) -> dict:
    return {"kind": "canvas", "label": label or f"آية الكرسي · {n} / {TOTAL}", "segments": segments, "els": els, **kw}


GATHERED = ["الألوهية", "الحياة الكاملة", "القيّومية", "الملك", "العلم المحيط", "العلوّ", "العظمة"]

SCENES = [
    # ---- hook
    lesson(0, [("say", "أعظمُ آيةٍ في كتاب الله…|تقرؤها كلَّ يوم،|فهل تعرف معناها؟")], [
        text(960, 300, "أعظمُ آيةٍ في <b>كتاب الله</b>", 0, font="title", size=104, align="center", w=1700),
        pill(960, 560, "تقرؤها كلَّ يوم", 1, icon="sun", size=1.3),
        text(960, 680, "فهل تعرف <g>معناها</g>؟", 2, font="title", size=76, align="center", w=1500),
    ], label=None, chrome=False),

    # ---- the hadith of Ubayy ibn Ka'b (Muslim 810)
    lesson(0, [
        ("say", "سأل النبيُّ صلى الله عليه وسلم أُبيَّ بنَ كعب:|يا أبا المنذر، أتدري أيُّ آيةٍ من كتاب الله معك أعظم؟|قال: اللهُ ورسولُه أعلم.|فأعاد عليه السؤال،|فقرأ أُبيّ:"),
        ("rec", 0),
        ("say", "فضرب النبيُّ صلى الله عليه وسلم في صدره،|وقال: واللهِ، لِيَهْنِكَ العلمُ أبا المنذر."),
    ], [
        card("q", 960, 300, "«يا أبا المنذر، أتدري أيُّ آيةٍ من كتاب الله معك أعظم؟»", sub="النبيّ ﷺ", icon="question", at=1, w=1240, h=140),
        card("a1", 1380, 520, "«اللهُ ورسولُه أعلم»", sub="أُبيّ بن كعب", icon="chat", tone="ghost", at=2, w=520, h=130),
        pill(960, 520, "أعاد السؤال", 3, tone="gold", icon="question"),
        text(560, 470, shown(PHRASES[0][0]), 5, font="quran", size=50, align="center", w=760, color="#0b5e43", sfx=None),
        text(560, 560, "أُبيّ بن كعب", 5, 0.3, font="body", size=22, align="center", w=400, color="#64746f", sfx=None),
        card("joy", 960, 770, "«واللهِ، لِيَهْنِكَ العلمُ أبا المنذر»", icon="star", tone="green", at=7, w=820, h=130, size=1.15),
        text(960, 900, "صحيح مسلم، 810", 0, 1.2, font="body", size=24, align="center", w=600, color="#64746f"),
    ], label="الحديث"),

    {"kind": "chapter", "n": "255", "title": "آية الكرسي", "sub": "سورة البقرة · عبارةً عبارة", "seconds": bx.CHAPTER_SECONDS},

    # ---- the verse, phrase by phrase
    lesson(1, [("rec", 0), ("say", "اللهُ: الذي لا يستحق الألوهيةَ والعبوديةَ إلا هو.|الحيّ: الذي له جميعُ معاني الحياة الكاملة، كما يليق بجلاله.|القيّوم: القائمُ على كل شيء.")], [
        verse(0),
        text(960, 390, "لا يستحق <b>الألوهية والعبودية</b> إلا هو", 1, font="title", size=56, align="center", w=1600),
        card("hayy", 1250, 690, "الحيّ", sub="له جميع معاني الحياة الكاملة، كما يليق بجلاله", icon="heart", at=2, w=520, h=190, size=1.35),
        card("qayyum", 670, 690, "القيّوم", sub="القائم على كل شيء", icon="layers", at=3, w=520, h=190, size=1.35),
        tafsir(1),
    ]),
    lesson(2, [("rec", 1), ("say", "السِّنة: النعاس.|فاللهُ سبحانه لا يأخذه نعاس،|ولا نوم.")], [
        verse(1),
        card("sina", 960, 430, "سِنَة", sub="أي: نعاس", icon="quote", tone="gold", at=1, w=360, h=150, size=1.3),
        pill(1180, 680, "لا نعاس", 2, tone="dark", icon="cross", size=1.4),
        pill(740, 680, "ولا نوم", 3, tone="dark", icon="cross", size=1.4),
        tafsir(1),
    ]),
    lesson(3, [("rec", 2), ("say", "كلُّ ما في السماوات،|وكلُّ ما في الأرض،|مِلكٌ له سبحانه.")], [
        verse(2),
        card("sky", 1300, 450, "السماوات", sub="كل ما فيها", icon="star", at=1, w=380, h=150),
        card("earth", 620, 450, "الأرض", sub="كل ما فيها", icon="globe", at=2, w=380, h=150),
        card("king", 960, 740, "مِلكٌ لله", icon="key", tone="green", at=3, w=420, h=140, size=1.3),
        edge("sky", "king", 3, 0.1), edge("earth", "king", 3, 0.2),
        tafsir(1),
    ]),
    lesson(4, [("rec", 3), ("say", "لا يتجاسر أحدٌ أن يشفع عنده،|إلا بإذنه.")], [
        verse(3),
        card("shafa", 1260, 560, "الشفاعة عنده", sub="لا يتجاسر أحدٌ أن يشفع", icon="users", at=1, w=460, h=170, size=1.2),
        card("idhn", 660, 560, "إلا بإذنه", icon="key", tone="green", at=2, w=420, h=170, size=1.3),
        edge("shafa", "idhn", 2, 0.1),
        tafsir(1),
    ]),
    lesson(5, [("rec", 4), ("say", "يعلم ما بين أيدي الخلائق من الأمور المستقبلة،|وما خلفهم من الأمور الماضية.|علمُه محيطٌ بجميع الكائنات:|ماضيها، وحاضرها، ومستقبلها.")], [
        verse(4),
        card("ahead", 640, 450, "ما بين أيديهم", sub="الأمور المستقبلة", icon="flag", at=1, w=440, h=150),
        card("behind", 1280, 450, "ما خلفهم", sub="الأمور الماضية", icon="scroll", at=2, w=440, h=150),
        text(960, 600, "علمُه <b>محيطٌ</b> بجميع الكائنات", 3, font="title", size=56, align="center", w=1500),
        pill(1260, 800, "ماضيها", 4, tone="mint", size=1.2),
        pill(960, 800, "حاضرها", 4, 0.4, tone="mint", size=1.2),
        pill(660, 800, "مستقبلها", 4, 0.8, tone="mint", size=1.2),
        tafsir(1),
    ]),
    lesson(6, [("rec", 5), ("say", "ولا يطّلع أحدٌ من الخلق على شيءٍ من علمه،|إلا بما أعلمه اللهُ وأطلعه عليه.")], [
        verse(5),
        text(960, 420, "لا يطّلع أحدٌ من الخلق على شيءٍ من علمه", 1, font="title", size=54, align="center", w=1600),
        card("taught", 960, 680, "إلا بما أعلمه اللهُ وأطلعه عليه", icon="book", tone="green", at=2, w=820, h=150, size=1.25),
        tafsir(1),
    ]),
    lesson(7, [("rec", 6), ("say", "وسع كرسيُّه السماواتِ والأرض،|ولا يعلم كيفيته إلا اللهُ سبحانه.")], [
        verse(6),
        text(960, 430, "وسع كرسيُّه <b>السماوات والأرض</b>", 1, font="title", size=60, align="center", w=1600),
        pill(960, 680, "لا يعلم كيفيته إلا اللهُ سبحانه", 2, tone="dark", icon="lock", size=1.4),
        tafsir(1),
    ]),
    lesson(8, [("rec", 7), ("say", "يَؤودُه: أي يُثقِله.|فلا يُثقله سبحانه حفظُ السماوات والأرض.")], [
        verse(7),
        card("yauduh", 960, 430, "يَؤودُه", sub="أي: يُثقِله", icon="quote", tone="gold", at=1, w=380, h=150, size=1.3),
        text(960, 620, "لا يُثقله <b>حفظُ السماوات والأرض</b>", 2, font="title", size=58, align="center", w=1600),
        tafsir(1),
    ]),
    lesson(9, [("rec", 8), ("say", "وهو العليُّ على جميع مخلوقاته،|الجامعُ لجميع صفات العظمة والكبرياء.")], [
        verse(8),
        card("aliy", 1250, 560, "العليّ", sub="على جميع مخلوقاته", icon="star", at=1, w=500, h=190, size=1.35),
        card("azim", 670, 560, "العظيم", sub="الجامع لجميع صفات العظمة والكبرياء", icon="shield", at=2, w=500, h=190, size=1.35),
        tafsir(1),
    ]),

    # ---- summary and close
    lesson(0, [("say", "في آيةٍ واحدة:|الألوهية، والحياة الكاملة، والقيام على كل شيء،|والملك، والعلم المحيط،|والعلوّ، والعظمة.")], [
        card("hub", 960, 540, "آية الكرسي", sub="أعظم آية في كتاب الله", icon="book", tone="green", at=0, w=380, h=170, size=1.2),
        *[card(f"g{i}", x, y, name, at=a, dt=d, w=300, h=96, tone="mint")
          for i, (name, x, y, a, d) in enumerate([
              ("الألوهية", 960, 260, 1, 0), ("الحياة الكاملة", 1440, 350, 1, 0.4), ("القيّومية", 1560, 620, 1, 0.8),
              ("الملك", 1300, 840, 2, 0), ("العلم المحيط", 620, 840, 2, 0.4),
              ("العلوّ", 360, 620, 3, 0), ("العظمة", 480, 350, 3, 0.4)])],
        *[edge(f"g{i}", "hub", a, d + 0.1, tone="green") for i, a, d in [(0, 1, 0), (1, 1, 0.4), (2, 1, 0.8), (3, 2, 0), (4, 2, 0.4), (5, 3, 0), (6, 3, 0.4)]],
    ], label="الخلاصة"),
    lesson(0, [("say", "فإذا قرأتَ آيةَ الكرسي،|تمهّل،|واستحضر معانيها.")], [
        text(960, 300, "اقرأها…", 0, font="title", size=110, align="center", w=1600),
        text(960, 460, "وأنت <g>تعرف معناها</g>", 2, font="title", size=86, align="center", w=1600),
        text(960, 760, "التلاوة: مشاري راشد العفاسي · الشرح: التفسير الميسّر · الحديث: صحيح مسلم 810", 2, 0.8, font="body", size=24, align="center", w=1600, color="#64746f"),
        {"k": "logo", "x": 960, "y": 880, "size": 80, "at": 2, "dt": 1.2},
        text(960, 940, "بلاغ · balagh.space", 2, 1.4, font="title", size=26, align="center", w=600, color="#0c9365"),
    ], label=None, chrome=False),
]


async def build() -> dict:
    canvases = [s for s in SCENES if s["kind"] == "canvas"]
    audio = await asyncio.gather(*(scene_audio(s["segments"]) for s in canvases))
    scenes = []
    for s in SCENES:
        if s["kind"] == "chapter":
            scenes.append(s)
            continue
        path, cues = audio[canvases.index(s)]
        out = {k: v for k, v in s.items() if k != "segments" and v is not None}
        out.update({"audio": str(path.relative_to(PUBLIC)), "cues": cues, "seconds": round(LEAD + media.seconds_of(path) + TAIL, 2)})
        out["els"] = [{k: v for k, v in e.items() if v is not None or k == "sfx"} for e in s["els"]]
        scenes.append(out)
    return {"brand": "بلاغ", "site": "balagh.space", "scenes": scenes}


if __name__ == "__main__":
    DIR.mkdir(parents=True, exist_ok=True)
    spec = asyncio.run(build())
    SPEC.write_text(json.dumps(spec, ensure_ascii=False))
    total = sum(s["seconds"] for s in spec["scenes"])
    print(f"{len(spec['scenes'])} scenes, {total:.0f} s → {SPEC.relative_to(ROOT)}")
