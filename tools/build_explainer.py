"""Build the product explainer: narration, cue times and the scene spec for the Explainer composition.

    uv run python tools/build_explainer.py          # synthesize what is missing, write the spec
    cd video && npx remotion render src/index.ts Explainer out/explainer.mp4

The script is docs/explainer-script.md; this file is its production form. Each canvas scene has a narration
split into cues with "|"; an element enters on cue `at` (plus `dt` seconds) and may leave on cue `out`.
The narration of a scene is synthesized in one piece (cached by its text), and the cue times are found by
snapping each split point, placed by its share of the characters, to the nearest pause in the audio.

Nothing shown is invented: the screens are captures of a real project on balagh.space
(video/public/explainer/site), the hadith comparison and the numbers come from eval/results.json and
eval/RESULTS.md, and the clips are the showcase videos. The narrator never reads a verse or a hadith.
"""
import asyncio
import difflib
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from app.video import media  # noqa: E402
from google.genai import errors as genai_errors, types  # noqa: E402

PUBLIC = ROOT / "video" / "public"
VOICE_DIR = PUBLIC / "explainer" / "voice"
SPEC = ROOT / "video" / "samples" / "explainer.json"
VOICE = "Charon"
CHAPTER_SECONDS = 2.7
TAIL = 0.7

BOX = json.loads((PUBLIC / "explainer" / "site" / "boxes.json").read_text())
AYAH = "وَلَنَبۡلُوَنَّكُم بِشَيۡءٖ مِّنَ ٱلۡخَوۡفِ وَٱلۡجُوعِ وَنَقۡصٖ مِّنَ ٱلۡأَمۡوَٰلِ وَٱلۡأَنفُسِ وَٱلثَّمَرَٰتِۗ وَبَشِّرِ ٱلصَّٰبِرِينَ"


# ---------- element helpers ----------

def card(id, x, y, label, sub=None, icon=None, tone="light", at=0, dt=0, w=None, h=None, **kw):
    return {"k": "card", "id": id, "x": x, "y": y, "label": label, "sub": sub, "icon": icon, "tone": tone, "at": at, "dt": dt, "w": w, "h": h, **kw}

def edge(a, b, at=0, dt=0, tone="green", **kw):
    return {"k": "edge", "a": a, "b": b, "at": at, "dt": dt, "tone": tone, **kw}

def pill(x, y, text, at=0, dt=0, tone="green", icon=None, **kw):
    return {"k": "pill", "x": x, "y": y, "text": text, "at": at, "dt": dt, "tone": tone, "icon": icon, **kw}

def text(x, y, t, at=0, dt=0, **kw):
    return {"k": "text", "x": x, "y": y, "text": t, "at": at, "dt": dt, **kw}

def stat(x, y, value, label, at=0, dt=0, **kw):
    return {"k": "stat", "x": x, "y": y, "value": value, "label": label, "at": at, "dt": dt, **kw}

def scene(label, title, say, els, sub=None, **kw):
    return {"kind": "canvas", "label": label, "title": title, "sub": sub, "say": say, "els": els, **kw}

def chapter(n, title, sub=None):
    return {"kind": "chapter", "n": n, "title": title, "sub": sub, "seconds": CHAPTER_SECONDS}

def mark(at, box, label=None, dt=0, out=None, tone="green", **kw):
    return {"at": at, "dt": dt, "out": out, "box": box, "label": label, "tone": tone, **kw}

def cam(at, cx, cy, z, dt=0, dur=1.1):
    return {"at": at, "dt": dt, "cx": cx, "cy": cy, "z": z, "dur": dur}

def shot(name, cams, marks=(), cursor=(), at=0, url="balagh.space", y=210, h=840):
    b = BOX[name]
    return {"k": "shot", "src": f"explainer/site/{name}.png", "pageW": 1600, "pageH": b["h"], "x": 110, "y": y, "w": 1700, "h": h,
            "url": url, "cam": list(cams), "marks": list(marks), "cursor": list(cursor), "at": at}

def center(b):
    return b[0] + b[2] / 2, b[1] + b[3] / 2

STEPS = ["الموضوع", "الأفكار", "السيناريو", "التوطين", "المراجعة", "الاعتماد"]

def stepper(done):
    return {"k": "stepper", "y": 112, "steps": STEPS, "done": done, "at": 0, "sfx": None}


# ---------- the scenes ----------

P = "balagh.space/#/p/b9a85c8e…"
REPLY = [
    "هل تظن أن طلب العلم مجرد شهادة ووظيفة؟",
    "﴿يَرْفَعِ اللَّهُ الَّذِينَ آمَنُوا مِنكُمْ وَالَّذِينَ أُوتُوا الْعِلْمَ دَرَجَاتٍ﴾ (المجادلة: 11)",
    "«مَنْ سَلَكَ طَرِيقًا يَلْتَمِسُ فِيهِ عِلْمًا، سَهَّلَ اللَّهُ لَهُ بِهِ طَرِيقًا إِلَى الْجَنَّةِ» (صحيح مسلم: 2699)",
    "كل علم نافع.. عبادة!",
]

SCENES = [
    # ---- opening
    scene("", "طلبتَ من الذكاء الاصطناعي سيناريو دعويًّا؟", "أكيد جرّبت تطلب من الذكاء الاصطناعي سيناريو لفيديو دعوي.|في ثوانٍ يعطيك نصًّا مرتّبًا،|فيه آية، وحديث، ومصادر،|وخاتمة مؤثرة.", [
        {"k": "chat", "x": 110, "y": 270, "w": 1000, "h": 600, "prompt": "اكتب سيناريو فيديو قصير (45 ثانية) عن فضل طلب العلم، مدعوما بآيات وأحاديث مع مصادرها.", "reply": REPLY, "until": 3, "at": 0, "dt": 0.4, "tilt": 8, "caption": "ردّ حقيقي من نموذج لغوي، دون بلاغ"},
        pill(1500, 560, "في ثوانٍ", 1, icon="spark"),
        pill(1520, 650, "آية", 2, tone="mint", icon="book"),
        pill(1650, 650, "حديث", 2, 0.35, tone="mint", icon="scroll"),
        pill(1395, 650, "مصادر", 2, 0.7, tone="mint", icon="link"),
    ], sub="في ثوانٍ… نص كامل", chrome=False),

    scene("", "لكن… من يضمن؟", "لكن السؤال:|هل الآية بلفظها؟|هل الحديث في مصدره، وبنصّه؟|وإذا نقلت المحتوى لجمهور آخر بلغة أخرى،|هل بقي المعنى كما هو؟", [
        {"k": "marquee", "y": 30, "rows": [["هل الآية بلفظها؟", "من أي كتاب؟", "ما رقم الحديث؟", "هل هو في الصحيحين؟", "هل الترجمة دقيقة؟"], ["هل تغيّر المعنى؟", "من راجع النص؟", "هل هذه فتوى؟", "هل اللفظ مطابق؟", "ما المصدر؟"], ["هل الآية بلفظها؟", "هل حُذف شيء؟", "هل أُضيف شيء؟", "من يعتمد النشر؟", "ما المصدر؟"], ["هل الترجمة معتمدة؟", "هل الشرح صحيح؟", "من راجع النص؟", "هل هو في الصحيحين؟", "هل تغيّر المعنى؟"]], "at": 0, "sfx": None},
        card("q1", 1440, 760, "هل الآية بلفظها؟", icon="book", at=1, w=400, h=150),
        card("q2", 960, 760, "هل الحديث في مصدره؟", sub="وبنصّه", icon="scroll", at=2, w=400, h=150),
        card("q3", 480, 760, "هل بقي المعنى؟", sub="بعد نقله لجمهور آخر", icon="globe", at=4, w=400, h=150),
    ], center=True, chrome=False),

    scene("", None, "هنا يأتي بلاغ:|مساعد لصناعة محتوى يعرّف بالإسلام،|كل نص شرعي فيه مربوط بمصدره،|ويصل لجمهور آخر،|دون أن يتغير ما يقوله.", [
        {"k": "logo", "x": 960, "y": 400, "size": 190, "at": 0},
        text(960, 535, "بلاغ", 0, 0.25, font="title", size=110, align="center", w=800, color="#0c9365"),
        text(960, 700, "مساعد لصناعة محتوى موثّق يعرّف بالإسلام", 1, font="title", size=34, align="center", w=1100, weight=700),
        card("hub", 960, 400, "", w=230, h=230, at=-1, sfx=None, hidden=True),
        card("s1", 1600, 300, "القرآن الكريم", icon="book", at=2, w=230),
        card("s2", 1680, 520, "الصحيحان", icon="scroll", at=2, dt=0.25, w=230),
        card("s3", 1600, 740, "التفسير والشرح", icon="quote", at=2, dt=0.5, w=230),
        card("a1", 320, 300, "لغات", icon="globe", at=3, w=230),
        card("a2", 240, 520, "جماهير", icon="users", at=3, dt=0.25, w=230),
        card("a3", 320, 740, "فيديو", icon="video", at=3, dt=0.5, w=230),
        edge("s1", "hub", 2, 0.2, bend=0), edge("s2", "hub", 2, 0.45), edge("s3", "hub", 2, 0.7),
        edge("hub", "a1", 3, 0.2), edge("hub", "a2", 3, 0.45), edge("hub", "a3", 3, 0.7),
        pill(960, 880, "ما يُقال لا يتغيّر", 4, icon="check"),
    ], chrome=False),

    scene("", "في هذا الفيديو", "في هذا الفيديو نشوف|لماذا لا نستطيع أن نثق بالنص المولَّد كما هو،|وكيف يحل بلاغ هذا الأمر،|ثم مثالًا عمليًّا، من فكرة إلى فيديو جاهز.", [
        card("g1", 1430, 600, "لماذا لا نثق بالنص المولَّد؟", sub="المشكلة", icon="question", at=0, dt=0.5, w=420, h=260, tone="light", size=1.3),
        card("g2", 960, 600, "كيف يعمل بلاغ؟", sub="الحل", icon="shield", at=0, dt=0.8, w=420, h=260, size=1.3),
        card("g3", 490, 600, "مثال عملي", sub="من فكرة إلى فيديو", icon="play", at=0, dt=1.1, w=420, h=260, size=1.3),
        text(1600, 400, "01", 0, 0.5, font="mono", size=30, color="#25c089", align="left", w=100, weight=800),
        text(1130, 400, "02", 0, 0.8, font="mono", size=30, color="#25c089", align="left", w=100, weight=800),
        text(660, 400, "03", 0, 1.1, font="mono", size=30, color="#25c089", align="left", w=100, weight=800),
        {"k": "ring", "target": "g1", "at": 1, "out": 2}, {"k": "ring", "target": "g2", "at": 2, "out": 3}, {"k": "ring", "target": "g3", "at": 3},
    ], sub="شرح مبسط في ثلاث محطات"),

    # ---- 01
    chapter("01", "كيف يكتب النموذج؟", "من الذاكرة، لا من المصدر"),
    scene("01 كيف يكتب النموذج؟", "رحلة السيناريو", "خلونا نبدأ القصة من الأول.|لما تكتب موضوعًا،|النموذج اللغوي|يكتب السيناريو.|لكن من أين يأتي بالآية والحديث؟|من ذاكرته.|هو لا يفتح المصحف، ولا صحيح البخاري،|بل يكتب ما يتوقّع أنه النص.|وأغلب الوقت يكون قريبًا، أو مطابقًا،|لكن «قريب» لا يكفي،|حين تنسب الكلام إلى الله، أو إلى رسوله صلى الله عليه وسلم.", [
        card("topic", 1560, 560, "الموضوع", sub="فضل طلب العلم", icon="pen", at=1),
        card("llm", 960, 560, "النموذج اللغوي", sub="LLM", icon="chip", tone="dark", at=2, w=240, h=150),
        card("out", 360, 560, "السيناريو", icon="doc", at=3, w=220),
        edge("topic", "llm", 2, 0.1), edge("llm", "out", 3, 0.1),
        card("mem", 960, 320, "ذاكرة التدريب", icon="brain", tone="ghost", at=5, w=260, h=110),
        edge("mem", "llm", 5, 0.2, tone="grey", dashed=True),
        card("mushaf", 1390, 330, "المصحف", icon="book", tone="ghost", at=6, w=210, h=100),
        card("bukhari", 530, 330, "صحيح البخاري", icon="scroll", tone="ghost", at=6, dt=0.3, w=290, h=100),
        pill(1390, 400, "لا يفتحه", 6, 0.2, tone="red", icon="cross", size=0.8),
        pill(530, 400, "لا يفتحه", 6, 0.5, tone="red", icon="cross", size=0.8),
        {"k": "list", "x": 360, "y": 690, "w": 330, "items": [{"text": "آية", "icon": "book", "tag": "؟", "tagTone": "gold", "at": 4}, {"text": "حديث", "icon": "scroll", "tag": "؟", "tagTone": "gold", "at": 4, "dt": 0.3}, {"text": "شرح", "icon": "quote", "tag": "؟", "tagTone": "gold", "at": 4, "dt": 0.6}], "at": 4},
        pill(960, 940, "«قريب» لا يكفي", 9, tone="red", icon="alert", size=1.2),
    ], sub="ماذا يحدث حين تطلب سيناريو؟"),

    # ---- 02
    chapter("02", "تجربة حية", "النموذج وحده أمام المصدر"),
    scene("02 تجربة حية", "الحديث نفسه… مرتين", "خلونا نجرّب بشكل عملي.|في السيناريو الذي رأيناه في البداية،|نقل النموذج الحديث بلفظه، كما هو في صحيح مسلم.|لكن في تقييمنا،|طلبنا منه الموضوع نفسه،|فنقل الحديث نفسه،|بكلمة ناقصة.|فرق صغير،|والمعنى قريب،|لكنه ليس لفظ الحديث.", [
        card("src", 960, 330, "صحيح مسلم، حديث رقم 6853", sub="ترقيم عبد الباقي: 2699", icon="scroll", tone="dark", at=0, dt=0.6, w=520, h=96),
        text(1720, 440, "اليوم", 1, font="title", size=26, color="#64746f", w=200),
        text(1720, 480, "«مَنْ سَلَكَ طَرِيقًا يَلْتَمِسُ فِيهِ عِلْمًا، سَهَّلَ اللَّهُ لَهُ <g>بِهِ</g> طَرِيقًا إِلَى الْجَنَّةِ»", 1, 0.3, font="amiri", size=44, w=1380, weight=700),
        pill(260, 515, "مطابق", 2, icon="check"),
        text(1720, 640, "في التقييم", 3, font="title", size=26, color="#64746f", w=200),
        text(1720, 680, "«مَنْ سَلَكَ طَرِيقًا يَلْتَمِسُ فِيهِ عِلْمًا سَهَّلَ اللَّهُ لَهُ <r>    </r> طَرِيقًا إِلَى الْجَنَّةِ»", 5, font="amiri", size=44, w=1380, weight=700),
        pill(260, 715, "كلمة ناقصة: «بِهِ»", 6, tone="red", icon="alert"),
        text(960, 860, "المصدر: eval/results.json · موضوع «فضل طلب العلم» · النموذج وحده", 7, font="body", size=21, color="#64746f", align="center", w=1200),
        pill(960, 950, "قريب… لكنه ليس لفظ الحديث", 9, tone="dark", icon="alert", size=1.1),
    ], sub="الطلب نفسه: سيناريو عن فضل طلب العلم"),

    scene("02 تجربة حية", "النموذج وحده: 16 موضوعًا", "وفي تقييمنا على ستة عشر موضوعًا،|عشرة أحاديث من خمسة عشر فقط طابقت نص الصحيحين حرفيًّا.|ثلاثة اختلف لفظها اختلافًا صغيرًا،|واثنان من خارج الصحيحين، فلا نستطيع التحقق منهما في مصادرنا.|ولم يختلق نصًّا واحدًا.|المشكلة ليست أن النموذج يخطئ دائمًا،|بل أنك لا تعرف متى يخطئ.", [
        stat(1350, 340, "10/15", "حديثًا طابقت نص الصحيحين حرفيًّا", 1, size=1.25, w=700),
        stat(760, 360, "3", "لفظ مخالف قليلًا", 2, tone="gold", size=0.9, w=300),
        stat(420, 360, "2", "من خارج الصحيحين", 3, tone="red", size=0.9, w=300),
        pill(960, 700, "لم يختلق نصًّا", 4, tone="mint", icon="check"),
        text(960, 790, "لكنك <b>لا تعرف متى يخطئ</b>", 5, font="title", size=58, align="center", w=1500),
        text(960, 960, "eval/RESULTS.md · عينة صغيرة، تشغيل واحد", 0, 1, font="body", size=20, color="#64746f", align="center", w=1000),
    ], sub="ماذا وجدنا حين قارنّا كل اقتباس بالمصدر"),

    # ---- 03
    chapter("03", "المشكلة", "كل جمهور بلغته وثقافته"),
    scene("03 المشكلة", "تخيّل عشرات النسخ", "والأمر يكبر أكثر.|المحتوى الدعوي لا يصل لجمهور واحد.|الشاب في بريطانيا ليس مثل الطفل العربي،|ولا مثل من يتعرّف على الإسلام لأول مرة.|وكل نسخة تحتاج من يتحقق من كل اقتباس، وكل ترجمة.|والتحقق اليدوي يأخذ وقتًا أطول من الكتابة نفسها.", [
        card("orig", 1620, 580, "السيناريو", sub="الأصل", icon="doc", tone="green", at=0, dt=0.4, w=230, h=160),
        *[card(f"au{i}", 420 + (i % 3) * 300, 380 + (i // 3) * 190, lab, sub=sub, at=a, dt=(i % 3) * 0.2, w=260, h=120, bar=col)
          for i, (lab, sub, col, a) in enumerate([
              ("شباب عرب", "العربية", "#0c9365", 1), ("أطفال", "قصة وحوار", "#d39b20", 2), ("آباء وأمهات", "إعلان الحلقة", "#3b6fd8", 1),
              ("شباب بريطانيون", "English", "#d64545", 2), ("مسلمون جدد", "معرفة أولية", "#8a5cd6", 3), ("الدارجة", "الجزائر والمغرب", "#e07b39", 3),
              ("طلاب جامعات", "غير مسلمين", "#2a9db8", 3), ("أمريكا الشمالية", "English", "#b8478a", 3), ("الخليج العربي", "العربية", "#5c8a2a", 3)])],
        *[edge("orig", f"au{i}", 4, i * 0.12, tone="red", bend=(i - 4) * 18, width=2.5, dot=False) for i in range(9)],
        pill(1620, 760, "تحقق يدوي × 9", 4, 1.2, tone="red", icon="search"),
        text(960, 960, "أطول من الكتابة نفسها!!", 5, font="title", size=52, color="#d64545", align="center", w=1200),
    ], sub="لكل جمهور لغته، وأمثلته، وطريقة شرحه"),

    scene("03 المشكلة", "والمعنى ينزلق", "وحين يُنقل النص لجمهور آخر، ينزلق المعنى.|في أحد أمثلتنا، كانت أول نسخة إنجليزية سلسة ومقنعة،|لكن ادعاءين تغيّرا،|وادعاء حُذف،|وادعاء أُضيف،|ولا تنتبه لذلك وأنت تقرأ.", [
        {"k": "list", "x": 960, "y": 270, "w": 1300, "title": "الأصل العربي مقابل أول نسخة إنجليزية: ادعاءً ادعاءً", "at": 1, "items": [
            {"text": "الابتلاء ليس عقوبة أو دليلًا على غضب الله، بل هو تمحيص ورفع للدرجات.", "tag": "محفوظ", "tagTone": "mint", "at": 1, "dt": 0.4},
            {"text": "النبي ﷺ هو أحب خلق الله إلى الله.", "sub": "صار «God's chosen messenger» دون أنه أحب الخلق إليه", "tag": "تغيّر", "tagTone": "red", "at": 2},
            {"text": "تحمّل النبي ﷺ الابتلاءات كان في سبيل الدعوة وتبليغ التوحيد.", "sub": "ذُكر ما أصابه، وسقطت غايته", "tag": "تغيّر", "tagTone": "red", "at": 2, "dt": 0.5},
            {"text": "الصابرون يوقنون بأنهم لله وإليه راجعون عند المصيبة.", "tag": "محفوظ", "tagTone": "mint", "at": 2, "dt": 0.9},
            {"text": "الله يجازي الصابرين أحسن الجزاء.", "tag": "حُذف", "tagTone": "gold", "at": 3},
            {"text": "الصبر عند الفقد يقرّب العبد إلى الله، ولا يكابد وحده.", "sub": "معنى لم يذكره الأصل", "tag": "أُضيف", "tagTone": "blue", "at": 4},
        ]},
        text(960, 990, "من مراجعة حقيقية في بلاغ: المشروع «لماذا يبتلي الله الناس؟»، النسخة الإنجليزية الأولى", 5, font="body", size=20, color="#64746f", align="center", w=1400),
    ], sub="مثال حقيقي: أول نسخة إنجليزية من أحد أمثلتنا"),

    # ---- 04
    chapter("04", "الحل", "النص الشرعي لا يكتبه النموذج"),
    scene("04 الحل", "النموذج يطلب… والنظام يُدرج", "فكرة بلاغ بسيطة:|النموذج لا يكتب النص الشرعي،|بل يطلبه:|الآية برقمها،|والحديث بجزء من لفظه.|والنظام هو الذي يبحث.", [
        card("m", 1560, 600, "النموذج اللغوي", icon="chip", tone="dark", at=0, dt=0.4, w=250, h=160),
        card("s", 360, 600, "السيناريو", icon="doc", at=0, dt=0.6, w=230, h=160),
        edge("m", "s", 0, 0.9, tone="red", label="من ذاكرته", out=2, bend=-120),
        card("src", 960, 600, "المصادر", sub="القرآن · الصحيحان", icon="db", tone="green", at=2, w=200, h=470),
        edge("m", "src", 2, 0.4), edge("src", "s", 5, 0.5),
        pill(1270, 470, "الآية برقمها", 3, tone="mint", icon="book"),
        pill(1270, 740, "الحديث بجزء من لفظه", 4, tone="mint", icon="scroll"),
        pill(960, 900, "النظام يبحث ويُدرج", 5, icon="search"),
    ], sub="الآية والحديث لا يُكتبان من الذاكرة"),

    scene("04 الحل", "أين يبحث النظام؟", "يبحث في القرآن الكريم،|وفي الصحيحين.|ما وُجد يصير دليلًا موثّقًا مع موضعه،|وما لم يوجد يُسقَط ولا يُستعمل، حتى لو طلبه النموذج.|والشرح نفسه مسنود:|مع كل آية تفسيرها من تفسير الميسر،|ومع كل حديث شرحه من الموسوعة الحديثية.", [
        card("c1", 1530, 410, "القرآن الكريم", sub="6236 آية", icon="book", at=0, w=320, h=170),
        card("c2", 1150, 410, "الصحيحان", sub="14940 حديثًا", icon="scroll", at=1, w=320, h=170),
        card("c3", 770, 410, "تفسير الميسر", sub="5278 مدخلًا", icon="quote", at=5, w=320, h=170, tone="mint"),
        card("c4", 390, 410, "الموسوعة الحديثية", sub="1947 شرحًا", icon="quote", at=6, w=320, h=170, tone="mint"),
        card("ok", 1340, 760, "موثّق", sub="يُستعمل، مع موضعه", icon="check", tone="green", at=2, w=420, h=150),
        card("no", 580, 760, "غير موثّق", sub="يُسقَط ولا يُستعمل", icon="cross", tone="ghost", at=3, w=420, h=150),
        edge("c1", "ok", 2, 0.3, fromSide="b", toSide="t"), edge("c2", "ok", 2, 0.5, fromSide="b", toSide="t"),
        pill(770, 520, "يُعطى للنموذج وللمراجع", 4, tone="mint", size=0.8), pill(390, 520, "ولا يُقتبس", 6, 0.4, tone="mint", size=0.8),
    ], sub="بحث ومطابقة محليان، دون نموذج"),

    scene("04 الحل", "علامة بدل النص", "وفي السيناريو، يضع النموذج علامة فقط،|والنظام يضع مكانها النص حرفيًّا من المصدر،|مع السورة ورقم الآية، أو رقم الحديث.|وهذا ضابط في الكود، لا تعليمة نرجو أن يلتزم بها النموذج.", [
        {"k": "code", "x": 860, "y": 270, "w": 1250, "title": "script · المشهد 4 · 22–33 ث", "at": 0, "lines": [
            {"t": "الله يختبرنا بأنواع من الفقد، لكنه وعد الصابرين ببشارة عظيمة:", "tone": "plain"},
            {"t": "{{Q1}}", "tone": "token", "out": 1},
            {"t": f"«{AYAH}»", "tone": "quran", "at": 1, "dt": 0.3},
            {"t": "سورة البقرة، الآية 155-156 · اقتباس حرفي", "tone": "green", "at": 2},
        ]},
        card("guard", 1680, 820, "الكود، لا النموذج", sub="ضابط مطبّق", icon="shield", tone="dark", at=3, w=330, h=150),
        pill(1680, 330, "يكتبها النموذج", 0, 1.0, tone="gold", icon="pen", size=0.85, out=1),
        pill(1680, 330, "يُدرجها النظام", 1, 0.3, icon="db", size=0.85),
    ], sub="النظام يُدرج النص، لا النموذج"),

    # ---- 05
    chapter("05", "التوطين", "يتغير الشرح… ولا يتغير الادعاء"),
    scene("05 التوطين", "ثلاث طبقات", "لما نوطّن السيناريو لجمهور آخر،|نفكّر فيه كثلاث طبقات.|في الأسفل النص الشرعي، ولا يُمسّ:|في الإنجليزية يُدرج بترجمة معتمدة جاهزة، ولا يترجمه النموذج.|فوقه المصطلحات،|يضبطها قاموس ملزم.|وفي الأعلى الخطاب:|البداية، والأمثلة، وطريقة الشرح،|وهذا فقط ما يكيّفه النموذج.", [
        {"k": "layers", "x": 760, "y": 780, "items": [
            {"label": "النص الشرعي", "sub": "لا يُمسّ · ترجمة معتمدة جاهزة", "tone": "dark", "at": 2},
            {"label": "المصطلحات", "sub": "قاموس ملزم", "tone": "green", "at": 4},
            {"label": "الخطاب", "sub": "البداية · الأمثلة · طريقة الشرح", "tone": "light", "at": 6},
        ]},
        pill(1640, 800, "Saheeh International للقرآن", 3, tone="mint", icon="book", size=0.85),
        pill(1640, 680, "التوحيد = Tawhid", 5, tone="mint", icon="tag", size=0.85),
        pill(1640, 560, "هذا فقط ما يكيّفه النموذج", 8, icon="pen", size=0.85),
    ], sub="ما يتغير يمرّ بالنموذج، وما لا يتغير يمرّ بالكود"),

    scene("05 التوطين", "البداية تتغير…", "وهذا مثال حقيقي من بلاغ.|للشباب المسلم، يبدأ الفيديو بسؤال عن غضب الله.|وللشاب البريطاني الذي يتعرّف على الإسلام،|يبدأ بالسؤال الذي يطرحه هو عادة:|إذا كان الله يحبنا، فلماذا نتألم؟|الأسلوب تغيّر،|والآية والادعاء بقيا كما هما.", [
        card("ar", 1360, 470, "لو كان الابتلاء دليلًا على غضب الله، فكيف تفسر أن أحب خلق الله إليه عانى أكثر منا جميعًا؟", sub="شباب مسلمون · العربية", at=1, w=640, h=230, size=1.05),
        card("en", 560, 470, "If God loves us, why do we suffer?", sub="شباب بريطانيون يتعرفون على الإسلام · English", at=2, w=640, h=230, size=1.3),
        pill(1360, 640, "الخطاب: تغيّر", 5, tone="gold", icon="pen"),
        pill(560, 640, "الخطاب: تغيّر", 5, 0.2, tone="gold", icon="pen"),
        card("verse", 960, 840, "سورة البقرة 155-156", sub="الآية نفسها · Saheeh International في الإنجليزية", icon="book", tone="dark", at=6, w=640, h=130),
        pill(960, 950, "الادعاء: نفسه", 6, 0.5, icon="check"),
    ], sub="مثال حقيقي: «لماذا يبتلي الله الناس؟»"),

    # ---- 06
    chapter("06", "المراجعة", "ثلاثة مراجعين… ثم الإنسان"),
    scene("06 المراجعة", "ثلاثة مراجعين آليين", "قبل أن يصل السيناريو للإنسان،|يفحصه ثلاثة مراجعين آليين.|المراجع العلمي: هل هناك نسبة بلا دليل، أو انزلاق نحو الفتوى؟|ومراجع الجمهور: هل هناك مصطلح لم يُشرح، أو خطاب لا يليق؟|ومراجع المعنى يقارن النسخة الموطّنة بالأصل، ادعاءً ادعاءً.|في مثالنا، أمسك المراجعون خمس ملاحظات مانعة،|فصُحّحت في نسخ جديدة،|حتى لم تبق ملاحظة مانعة.", [
        card("sc", 960, 560, "السيناريو", icon="doc", tone="green", at=0, dt=0.4, w=230, h=170),
        card("r1", 1520, 350, "المراجع العلمي", sub="نسبة بلا دليل · فتوى", icon="scale", at=2, w=330, h=150),
        card("r2", 1520, 770, "مراجع الجمهور", sub="مصطلح لم يُشرح · خطاب", icon="users", at=3, w=330, h=150),
        card("r3", 400, 560, "مراجع المعنى", sub="ادعاءً ادعاءً", icon="layers", at=4, w=330, h=150),
        edge("r1", "sc", 2, 0.3), edge("r2", "sc", 3, 0.3), edge("r3", "sc", 4, 0.3),
        pill(960, 790, "5 ملاحظات مانعة", 5, tone="red", icon="alert"),
        pill(960, 870, "النسخة 2 · 3 · 4 · 5 · 6", 6, tone="light", icon="pen", size=0.9),
        pill(960, 950, "لا توجد ملاحظات مانعة", 7, icon="check", sfx="chime"),
    ], sub="علمي، وجمهور، ومعنى"),

    scene("06 المراجعة", "والقرار للإنسان", "ثم يأتي الإنسان، على قدر الخطر.|في السيناريو العادي، يكفي صانع المحتوى.|وفي المسألة الخلافية، يلزم مراجع شرعي.|وفي النسخة الموطّنة، مراجع يتكلم لغة الجمهور.|وكل اعتماد باسم وصفة،|والتصدير يبقى مقفلًا حتى يوقّع كل من يلزم توقيعه.", [
        {"k": "list", "x": 1080, "y": 290, "w": 1050, "at": 0, "items": [
            {"text": "سيناريو عادي بلا ملاحظات", "icon": "doc", "tag": "صانع المحتوى", "tagTone": "mint", "at": 1},
            {"text": "مسألة خلافية أو ملاحظة مانعة", "icon": "scale", "tag": "+ مراجع شرعي", "tagTone": "gold", "at": 2},
            {"text": "نسخة موطّنة لجمهور آخر", "icon": "globe", "tag": "+ مراجع لغوي وثقافي", "tagTone": "blue", "at": 3},
            {"text": "كل اعتماد: الاسم، والصفة، والوقت", "icon": "pen", "at": 4},
        ]},
        card("lock", 300, 520, "التصدير", sub="مقفل", icon="lock", tone="dark", at=0, dt=0.6, w=260, h=200, out=5, outDt=1.4),
        card("unlock", 300, 520, "التصدير", sub="بعد اكتمال التوقيعات", icon="unlock", tone="green", at=5, dt=1.5, w=260, h=200, sfx="chime"),
    ], sub="المراجعة على قدر الخطر"),

    scene("06 المراجعة", "وإذا كان السؤال فتوى؟", "وإذا كان الطلب فتوى شخصية،|لا يولّد بلاغ محتوى أصلًا،|بل يحيل صاحبه إلى مختص.|وفي تقييمنا، أُحيلت الأسئلة الستة كلها.", [
        card("ask", 1550, 560, "سؤال شخصي", sub="طلاق · قرض · نذر…", icon="question", tone="gold", at=0, dt=0.3, w=300, h=170),
        card("b", 960, 560, "بلاغ", icon="shield", tone="dark", at=0, dt=0.6, w=220, h=170),
        card("noscript", 370, 400, "سيناريو", icon="doc", tone="ghost", at=1, w=260, h=130),
        pill(370, 470, "لا يُولَّد", 1, 0.3, tone="red", icon="cross", size=0.85),
        card("ref", 370, 720, "يُحال إلى مختص", icon="person", tone="green", at=2, w=300, h=150),
        edge("ask", "b", 0, 0.8, tone="gold"), edge("b", "ref", 2, 0.2),
        stat(960, 760, "6/6", "أسئلة فتوى أُحيلت", 3, size=0.8, w=360),
    ], sub="المستوى (د): لا محتوى، بل إحالة"),

    # ---- 07
    chapter("07", "مثال عملي", "من فكرة إلى سيناريو معتمد"),
    scene("07 مثال عملي", None, "خلونا نشوف هذا كله على الموقع.|نكتب الموضوع: لماذا يبتلي الله الناس؟|ونختار الجمهور، واللغة، والمنصة.|ثم نطلب ثلاث أفكار.", [
        stepper([3, None, None, None, None, None]),
        shot("new", [cam(0, 800, 380, 1.06), cam(1, 830, 330, 1.7), cam(2, 830, 760, 1.35), cam(3, 360, 330, 1.4)],
             marks=[mark(1, [520, 238, 614, 116], "الموضوع", dt=0.5, out=2), mark(2, [532, 700, 602, 100], "الجمهور", dt=0.6, out=3), mark(3, [172, 440, 270, 54], "اقترح عليّ 3 أفكار", dt=0.9)],
             cursor=[{"at": 1, "dt": 0.2, "x": 860, "y": 376, "click": True}, {"at": 2, "dt": 0.4, "x": 1050, "y": 730, "click": True}, {"at": 3, "dt": 0.7, "x": 310, "y": 466, "click": True}],
             url="balagh.space/#/new"),
    ]),
    scene("07 مثال عملي", None, "يقترح بلاغ ثلاث أفكار،|ومع كل واحدة نصوصها الموثّقة.|نختار الثالثة: أحباء الله والابتلاء،|ودليلها آيتا سورة البقرة، موثّقتان.", [
        stepper([-1, 2, None, None, None, None]),
        shot("ideas", [cam(0, 800, 500, 1.06), cam(1, 660, 560, 1.12), cam(2, 310, 560, 1.75), cam(3, 375, 600, 2.2)],
             marks=[mark(1, [836, 378, 326, 406], dt=0.2, out=2, dim=False), mark(1, [492, 378, 326, 406], dt=0.4, out=2, dim=False), mark(1, [148, 378, 326, 406], dt=0.6, out=2, dim=False),
                    mark(2, [148, 378, 326, 406], "أحباء الله والابتلاء", dt=0.6, out=3), mark(3, [299, 584, 151, 25], "موثّق: البقرة 155-156", dt=0.8)],
             cursor=[{"at": 2, "dt": 0.6, "x": 330, "y": 700, "click": True}], url=P),
    ]),
    scene("07 مثال عملي", None, "فيكتب بلاغ السيناريو بمشاهد موقّتة.|والآية في مشهدها بين قوسين،|ومعها موضعها، وتفسيرها من تفسير الميسر.|وهنا تنبيه آلي:|مشهد ينسب قولًا دون دليل موثّق مرتبط به.", [
        stepper([-1, -1, None, None, None, None]),
        shot("ar", [cam(0, 655, 650, 1.06), cam(1, 655, 1065, 1.45), cam(2, 655, 1590, 1.45), cam(3, 655, 520, 1.5)],
             marks=[mark(1, [172, 962, 966, 206], "النص من المصدر", dt=0.4, out=2), mark(2, [147, 1463, 1016, 279], "الموضع والتفسير", dt=0.5, out=3),
                    mark(3, [172, 436, 966, 82], "تنبيه آلي", dt=0.9, tone="red")], url=P + "/45c4507a"),
    ]),
    scene("07 مثال عملي", None, "ثم نوطّنه لشباب بريطانيين يتعرفون على الإسلام.|الأصل والنسخة جنبًا إلى جنب،|والآية بترجمة معتمدة جاهزة،|وفي الأسفل: ما الذي تغيّر في التوطين، ولماذا،|وجدول المصطلحات المعتمدة.", [
        stepper([-1, -1, -1, None, None, None]),
        shot("compare", [cam(0, 655, 600, 1.06), cam(1, 655, 940, 1.45), cam(2, 655, 2330, 1.45), cam(3, 655, 2700, 1.4), cam(4, 655, 2980, 1.4)],
             marks=[mark(1, [172, 830, 966, 200], "الأصل والنسخة", dt=0.4, out=2), mark(2, [147, 2153, 1016, 365], "ترجمة معتمدة: Saheeh International", dt=0.5, out=3),
                    mark(3, [147, 2534, 1016, 300], "ما الذي تغيّر ولماذا", dt=0.5, out=4), mark(4, [147, 2840, 1016, 260], "المصطلحات المعتمدة", dt=0.4)],
             cursor=[{"at": 0, "dt": 0.6, "x": 1080, "y": 754, "click": True}], url=P + "/80b1216c"),
    ]),
    scene("07 مثال عملي", None, "ثم المراجعة.|خمس ملاحظات مانعة في النسخة الأولى،|ولكل ملاحظة سببها وطريقة تصحيحها.|وهنا جدول حفظ المعنى: ثلاثة ادعاءات من ستة فقط بقيت كما هي.|فنصحّح في نسخة جديدة.", [
        stepper([-1, -1, -1, -1, None, None]),
        shot("review", [cam(0, 655, 560, 1.06), cam(1, 655, 520, 1.5), cam(2, 655, 720, 1.45), cam(3, 655, 1800, 1.3), cam(4, 900, 2200, 1.7)],
             marks=[mark(1, [172, 490, 966, 53], "5 ملاحظات مانعة", dt=0.4, out=2, tone="red"), mark(2, [172, 724, 966, 157], "السبب والتصحيح", dt=0.5, out=3),
                    mark(3, [147, 1570, 1016, 560], "حفظ المعنى: 3 من 6", dt=0.6, out=4), mark(4, [836, 2195, 159, 46], "صحّح في نسخة جديدة", dt=0.8)],
             cursor=[{"at": 4, "dt": 0.6, "x": 915, "y": 2218, "click": True}], url=P + "/80b1216c"),
    ]),
    scene("07 مثال عملي", None, "وبعد جولات التصحيح،|لم تبق ملاحظة مانعة،|واعتُمدت النسخة،|وانفتح الطريق إلى الفيديو النهائي.", [
        stepper([-1, -1, -1, -1, 1, 2]),
        shot("approved", [cam(0, 655, 400, 1.06), cam(1, 655, 515, 1.6), cam(2, 655, 300, 1.25), cam(3, 655, 2000, 1.2)],
             marks=[mark(1, [172, 490, 966, 51], "لا توجد ملاحظات مانعة", dt=0.4, out=2), mark(2, [148, 146, 1015, 54], "النسخة 6 · معتمدة", dt=0.4, out=3),
                    mark(3, [147, 1880, 1016, 76], "الفيديو النهائي", dt=0.6)], url=P + "/a231c01d"),
    ]),

    # ---- 08
    chapter("08", "الفيديو", "النص الشرعي بصوت قارئ"),
    scene("08 الفيديو", "من السيناريو إلى الفيديو", "بعد الاعتماد، يصير السيناريو فيديو:|للفيديو القصير بالعربية،|أو بالإنجليزية،|أو حلقة للأطفال بشخصيات ثابتة،|ومعها إعلان قصير للأهل.", [
        {"k": "video", "src": "explainer/clips/7f3fbb3fa87e.mp4", "x": 1500, "y": 280, "w": 300, "h": 533, "caption": "الزخرفة الهندسية", "at": 1, "startFrom": 8, "tilt": -6},
        {"k": "video", "src": "explainer/clips/e5f5bde9e559.mp4", "x": 1160, "y": 280, "w": 300, "h": 533, "caption": "الترجمة المتحركة · English", "at": 2, "startFrom": 6, "tilt": -3},
        {"k": "video", "src": "explainer/clips/74e33c47148c.mp4", "x": 330, "y": 330, "w": 780, "h": 439, "caption": "القصة المصورة للأطفال", "at": 3, "startFrom": 20},
        {"k": "video", "src": "explainer/clips/3406cb16b5c0.mp4", "x": 90, "y": 610, "w": 220, "h": 391, "caption": "إعلان للأهل", "at": 4, "startFrom": 3, "tilt": 6},
    ], sub="فيديوهات حقيقية من صفحة الأمثلة"),
    scene("08 الفيديو", "صوت كل جزء", "الحوار والشرح والصور تُولَّد تلقائيًّا.|أما الآية، فبصوت قارئ حقيقي،|والحديث من تسجيل حقيقي.|لا صوت اصطناعيًّا للنص الشرعي.", [
        card("v1", 1500, 380, "الحوار والشرح", icon="chat", at=0, dt=0.3, w=320, h=130),
        card("v2", 1500, 590, "الآية", icon="book", at=1, w=320, h=130),
        card("v3", 1500, 800, "الحديث", icon="scroll", at=2, w=320, h=130),
        card("o1", 520, 380, "توليد الكلام", sub="Gemini TTS", icon="wave", tone="ghost", at=0, dt=0.6, w=340, h=130),
        card("o2", 520, 590, "تلاوة قارئ", sub="آيةً آية", icon="mic", tone="green", at=1, dt=0.4, w=340, h=130),
        card("o3", 520, 800, "تسجيل حقيقي", sub="أو عرض صامت للقراءة", icon="mic", tone="green", at=2, dt=0.4, w=340, h=130),
        edge("v1", "o1", 0, 0.8, tone="grey"), edge("v2", "o2", 1, 0.6), edge("v3", "o3", 2, 0.6),
        pill(960, 960, "لا صوت اصطناعي للنص الشرعي", 3, tone="dark", icon="shield", size=1.1),
    ], sub="ما يُولَّد، وما لا يُولَّد"),

    # ---- 09
    chapter("09", "الخلاصة"),
    scene("09 الخلاصة", "في تقييمنا", "في تقييمنا،|كل اقتباسات بلاغ طابقت مصادرها حرفيًّا،|وكشف المراجعون ثمانية وعشرين خطأً مزروعًا من ثمانية وعشرين،|وأُحيلت كل أسئلة الفتوى.|العينة صغيرة، والتشغيل واحد،|ولم يراجع مختص شرعي المخرجات بعد، وهذا ما نعمل عليه الآن.", [
        stat(1450, 370, "10/10", "اقتباسات بلاغ طابقت المصدر حرفيًّا", 1, size=0.95, w=480),
        stat(960, 370, "28/28", "خطأً مزروعًا كشفه المراجعون", 2, size=0.95, w=480),
        stat(470, 370, "6/6", "أسئلة فتوى أُحيلت إلى مختص", 3, size=0.95, w=480),
        pill(960, 800, "عينة صغيرة · تشغيل واحد · لم يراجعها مختص شرعي بعد", 4, tone="gold", icon="alert", size=0.95),
        text(960, 960, "eval/RESULTS.md", 4, font="mono", size=20, color="#64746f", align="center", w=600),
    ], sub="16 موضوعًا · 6 أسئلة فتوى · 28 خطأً مزروعًا"),
    scene("09 الخلاصة", None, "بلاغ:|محتوى يبدأ بفهم الجمهور،|ويستند إلى مصدر موثّق،|ويعتمده الإنسان.", [
        {"k": "wall", "x": 960, "y": 560, "cols": 15, "rows": 7, "hub": "بلاغ", "hubSub": "balagh.space", "at": 0},
        pill(1450, 960, "يفهم الجمهور", 1, tone="light", icon="users"),
        pill(960, 960, "موثّق المصدر", 2, icon="check"),
        pill(470, 960, "يعتمده الإنسان", 3, tone="dark", icon="person"),
    ]),

    # ---- close
    scene("", "جرّبوه بأنفسكم", "التجربة متاحة على بلاغ دوت سبيس.|وإذا عندكم ملاحظات أو اقتراحات، يسعدنا أن نسمعها.", [
        card("l1", 1380, 560, "balagh.space", sub="التجربة الحية", icon="play", tone="green", at=0, dt=0.5, w=400, h=170, mono=True),
        card("l2", 960, 560, "/#/examples", sub="أمثلة حقيقية", icon="film", at=0, dt=0.8, w=400, h=170, mono=True),
        card("l3", 540, 560, "/api/docs", sub="توثيق الـ API", icon="code", at=0, dt=1.1, w=400, h=170, mono=True),
        card("fb", 960, 820, "ملاحظاتكم واقتراحاتكم", icon="chat", tone="mint", at=1, w=520, h=120),
    ], center=False, chrome=False),
    scene("", None, "والسلام عليكم ورحمة الله وبركاته.", [
        text(960, 330, "والسلام عليكم <b>ورحمة الله</b>", 0, font="title", size=96, align="center", w=1700),
        {"k": "logo", "x": 960, "y": 640, "size": 130, "at": 0, "dt": 0.6},
        text(960, 740, "بلاغ", 0, 0.8, font="title", size=54, align="center", w=600, color="#0c9365"),
        text(960, 830, "مساعد لصناعة محتوى موثّق يعرّف بالإسلام · balagh.space", 0, 1.0, font="body", size=26, align="center", w=1400, color="#64746f"),
    ], chrome=False),
]


# ---------- narration ----------

def _silences(path: Path) -> list[tuple[float, float]]:
    err = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(path), "-af", "silencedetect=n=-38dB:d=0.12", "-f", "null", "-"], capture_output=True, text=True).stderr
    starts = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", err)]
    ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", err)]
    return list(zip(starts, ends + [media.seconds_of(path)] * (len(starts) - len(ends))))


def cue_times(say: str, path: Path) -> list[float]:
    """Seconds at which each "|"-separated part of the narration starts."""
    parts = [p.strip() for p in say.split("|")]
    total = media.seconds_of(path)
    sil = _silences(path)
    s0 = sil[0][1] if sil and sil[0][0] < 0.05 else 0.0
    s1 = sil[-1][0] if sil and sil[-1][1] >= total - 0.05 else total
    lens = [len(p) for p in parts]
    cues, acc = [0.0], 0
    for i in range(1, len(parts)):
        acc += lens[i - 1]
        est = s0 + (s1 - s0) * acc / sum(lens)
        near = [e for (_, e) in sil if abs(e - est) < 0.9 and e > cues[-1] + 0.2]
        cues.append(round(min(near, key=lambda e: abs(e - est)) if near else est, 2))
    return cues


TTS_MODEL = "gemini-3.8-flash-tts"  # its own quota, apart from the flash TTS the site uses for videos
CHECK_MODEL = "gemini-flash-latest"
_tts_limit = asyncio.Semaphore(2)


async def _speak(text_: str) -> bytes:
    """Raw 24 kHz PCM of the text. This model reads any instruction aloud, so it gets the text alone."""
    for attempt in range(8):
        try:
            r = await media.client.aio.models.generate_content(
                model=TTS_MODEL, contents=text_,
                config=types.GenerateContentConfig(response_modalities=["AUDIO"], speech_config=types.SpeechConfig(
                    voice_config=types.VoiceConfig(prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=VOICE)))))
            return r.candidates[0].content.parts[0].inline_data.data
        except genai_errors.APIError as e:
            if e.code not in (429, 500, 503):
                raise
            m = media.RETRY_IN.search(str(e.message or ""))
            await asyncio.sleep(min(90.0, float(m.group(1)) + 1) if m else 6.0 * (attempt + 1))
    raise RuntimeError("speech synthesis kept failing")


def _plain(t: str) -> str:
    t = re.sub(r"[\u064b-\u0652\u0670ـ]", "", t)  # harakat and tatweel
    t = t.translate(str.maketrans("أإآىة", "اااىه"))
    return re.sub(r"[^\w]+", " ", t).strip()


async def _heard(path: Path) -> str:
    r = await media.client.aio.models.generate_content(model=CHECK_MODEL, contents=[
        types.Part.from_bytes(data=path.read_bytes(), mime_type="audio/mpeg"), "Transcribe this Arabic audio verbatim. Output the transcript only."])
    return r.text or ""


async def narrate(say: str) -> Path:
    """The scene's narration as an mp3, checked against its text by a transcription before it is kept."""
    text_ = " ".join(p.strip() for p in say.split("|"))
    VOICE_DIR.mkdir(parents=True, exist_ok=True)
    out = VOICE_DIR / f"{hashlib.sha256(f'{TTS_MODEL}|{VOICE}|{text_}'.encode()).hexdigest()[:16]}.mp3"
    if out.exists():
        return out
    for attempt in range(3):
        async with _tts_limit:
            pcm = await _speak(text_)
        raw = out.with_suffix(".pcm")
        raw.write_bytes(pcm)
        tmp = out.with_suffix(".tmp.mp3")
        try:
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "s16le", "-ar", "24000", "-ac", "1", "-i", str(raw),
                            "-af", "loudnorm=I=-16:TP=-1.5", "-ar", "44100", "-ac", "1", "-b:a", "128k", str(tmp)], check=True)
        finally:
            raw.unlink(missing_ok=True)
        heard = await _heard(tmp)
        ratio = difflib.SequenceMatcher(None, _plain(text_), _plain(heard)).ratio()
        if ratio >= 0.85:
            tmp.rename(out)
            print(f"  voiced {out.name} ({ratio:.2f})", text_[:50])
            return out
        print(f"  retry ({ratio:.2f}): heard «{heard[:80]}»")
        tmp.unlink(missing_ok=True)
    raise RuntimeError(f"the narration never matched its text: {text_[:60]}")


async def build(dry: bool = False) -> dict:
    canvases = [s for s in SCENES if s["kind"] == "canvas"]
    paths = [None] * len(canvases) if dry else await asyncio.gather(*(narrate(s["say"]) for s in canvases))
    scenes = []
    for s in SCENES:
        if s["kind"] == "chapter":
            scenes.append(s)
            continue
        path = paths[canvases.index(s)]
        if path is None:  # --dry: about 2.4 s a cue and no audio, to look at the layout before paying for speech
            n = len(s["say"].split("|"))
            cues, seconds, audio = [round(i * 2.4, 2) for i in range(n)], round(0.45 + n * 2.4 + TAIL, 2), None
        else:
            cues, seconds, audio = cue_times(s["say"], path), round(0.45 + media.seconds_of(path) + TAIL, 2), str(path.relative_to(PUBLIC))
        out = {k: v for k, v in s.items() if k != "say"}
        out.update({"audio": audio, "cues": cues, "seconds": seconds})
        out["els"] = [{k: v for k, v in e.items() if v is not None} for e in s["els"]]
        scenes.append({k: v for k, v in out.items() if v is not None})
    return {"brand": "بلاغ", "site": "balagh.space", "music": "explainer/sfx/music.wav", "scenes": scenes}


if __name__ == "__main__":
    dry = "--dry" in sys.argv
    spec = asyncio.run(build(dry))
    (SPEC.with_name("explainer.dry.json") if dry else SPEC).write_text(json.dumps(spec, ensure_ascii=False))
    total = sum(s["seconds"] for s in spec["scenes"])
    print(f"{len(spec['scenes'])} scenes, {total / 60:.1f} min → {SPEC.relative_to(ROOT)}")
