"""A second, code-side look at the brief before any model sees it. The model classifies the content level;
this file catches what it may miss: a brief that reads like a personal case (level D) is referred before
generation, and one that touches a disputed matter is raised to level C so a scholar's signature is required.
Pattern lists, not judgement: they err on the side of asking a human."""
import re
from typing import Optional

# Ways of asking about one's own situation: first person plus a request for a ruling, or a formula a
# questioner uses with a mufti. Normalised text (no diacritics, alef/ta marbuta folded) is matched.
PERSONAL = [
    r"\bهل يجوز لي\b", r"\bهل يجوز ل(?:زوجي|زوجتي|ابي|امي|اخي|اختي|ابني|بنتي)\b", r"\bحكم حالتي\b", r"\bما حكم ما فعلت\b",
    r"\bهل (?:صلاتي|صيامي|زكاتي|حجي|عمرتي|نذري|يميني|طلاقي|زواجي|عقدي) (?:صحيح|باطل|صحيحه|باطله)\b",
    r"\bطلقت زوجتي\b", r"\bقلت لزوجتي\b", r"\bقال لي زوجي\b", r"\bحلفت (?:ان|الا|بالله)\b", r"\bنذرت (?:ان|الا|لله)\b",
    r"\bهل علي كفاره\b", r"\bهل علي (?:قضاء|فديه|دم|زكاه)\b", r"\bكم (?:زكاه|كفاره) (?:مالي|ذهبي|راتبي|ديني)\b",
    r"\bورثت\b", r"\bتركه (?:ابي|امي|والدي|زوجي)\b", r"\bنصيبي من الميراث\b", r"\bقرض (?:من البنك|بفائده) (?:لي|اخذته)\b",
    r"\bافتوني\b", r"\bافتني\b", r"\bاريد فتوى\b", r"\bاستفتي\b", r"\bسؤالي (?:هو|للشيخ)\b",
    r"\bi (?:took|made|swore|divorced|borrowed|broke)\b.*\b(?:is it valid|do i have to|what should i do|is my)\b",
    r"\bis my (?:prayer|fast|marriage|divorce|nikah|oath|vow|hajj) (?:valid|void)\b", r"\bfatwa for me\b", r"\bmy (?:husband|wife) said\b",
]

# Matters on which scholars differ, or that are commonly asked as rulings: level C at least.
DISPUTED = [
    r"\bحكم (?:الموسيقى|الاغاني|الغناء|المعازف|التصوير|الصور|النقاب|كشف الوجه|الاحتفال بالمولد|المولد النبوي|التدخين|الشيشه|"
    r"الاسبال|اللحيه|حلق اللحيه|التامين|البنوك|الفوائد البنكيه|القروض|الربا|البيتكوين|العملات الرقميه|الاسهم|التورق|البطاقه الائتمانيه|"
    r"المصافحه|الاختلاط|سفر المراه|قياده المراه|الدف|التصفيق|السبحه|التوسل|زياره القبور|قراءه القران على الميت|الاحتفال براس السنه|"
    r"عيد الام|اعياد الميلاد|تهنئه (?:النصارى|غير المسلمين)|الدراسه المختلطه|العمل في البنوك|الذبح|التدخين)\b",
    r"\b(?:الموسيقى|المعازف) (?:حرام|حلال)\b", r"\b(?:النقاب|الحجاب) (?:فرض|واجب|سنه)\b", r"\bعذاب القبر\b", r"\bالمهدي\b",
    r"\bالخلافه\b", r"\bالصحابه (?:و|في) (?:الفتنه|معركه|الجمل|صفين)\b", r"\bمعاويه\b", r"\bيزيد\b", r"\bالتكفير\b", r"\bالصوفيه\b",
    r"\bالاشاعره\b", r"\bالسلفيه\b", r"\bالشيعه\b", r"\bالمذاهب\b", r"\bاختلاف (?:العلماء|الفقهاء|المذاهب)\b", r"\bالفرق (?:الاسلاميه|الضاله)\b",
    r"\bruling on (?:music|photos|niqab|hijab|smoking|insurance|mortgages?|crypto|bitcoin|stocks|shaking hands|celebrating)\b",
    r"\b(?:is|are) (?:music|mortgages?|crypto|bitcoin|insurance|photography|birthdays?) (?:haram|halal|permissible|allowed)\b",
    r"\bsects?\b", r"\bsufis?m?\b", r"\bsalafis?m?\b", r"\bshi'?a\b", r"\bcaliphate\b", r"\bmahdi\b",
]

def _fold(pattern: str) -> str:
    # the patterns go through the same letter folding as the text they are matched against
    return pattern.translate(str.maketrans("أإآةى", "اااهي"))


_PERSONAL = [re.compile(_fold(p), re.IGNORECASE) for p in PERSONAL]
_DISPUTED = [re.compile(_fold(p), re.IGNORECASE) for p in DISPUTED]

REFERRAL = ("يبدو أن سؤالك عن حالة شخصية بعينها. هذا يحتاج إلى مفتٍ أو جهة إفتاء مؤهلة تسمع تفاصيلها، "
            "ولا يصلح له فيديو عام. يمكنك طلب فيديو عن الحكم العام للمسألة دون ذكر حالتك.")


# An audience of children: the templates that tell a dialogue story with the fixed cast are for them alone.
CHILDREN = [r"\bاطفال\b", r"\bطفل\b", r"\bاولاد\b", r"\bصغار\b", r"\bبراعم\b", r"\bkids?\b", r"\bchildren\b", r"\bchild\b", r"\btoddlers?\b",
            r"\b(?:[3-9]|1[0-2])\s*(?:الى|-|–|to)\s*(?:[4-9]|1[0-2])\s*(?:سنوات|سنه|years?)\b", r"\bages? [3-9]\b", r"\bages? 1[0-2]\b"]
_CHILDREN = [re.compile(p.translate(str.maketrans("أإآةى", "اااهي")), re.IGNORECASE) for p in CHILDREN]


def children(audience: Optional[str]) -> bool:
    """Whether the audience, as the brief words it, is children."""
    if not audience:
        return False
    t = normalise(audience)
    return any(p.search(t) for p in _CHILDREN)


def normalise(text: str) -> str:
    text = re.sub(r"[ً-ْٰـ]", "", text)       # diacritics, tatweel
    text = text.translate(str.maketrans("أإآةى", "اااهي"))
    text = re.sub(r"[^\w\s']", " ", text)
    return re.sub(r"\s+", " ", text).strip().lower()


def personal_case(text: Optional[str]) -> Optional[str]:
    """The phrase that makes the brief read like a personal case, or None."""
    if not text:
        return None
    t = normalise(text)
    for p in _PERSONAL:
        m = p.search(t)
        if m:
            return m.group(0)
    return None


def disputed(text: Optional[str]) -> Optional[str]:
    """The phrase that puts the brief on a disputed matter, or None."""
    if not text:
        return None
    t = normalise(text)
    for p in _DISPUTED:
        m = p.search(t)
        if m:
            return m.group(0)
    return None
