"""Verified religious sources, loaded from local data files.

Quran: King Fahd Complex Hafs text (via quran.com). Hadith: Sahih al-Bukhari and Sahih Muslim.
Nothing the model writes is treated as a quote unless it is found here.
"""
import json
import re
import unicodedata
from collections import defaultdict
from pathlib import Path
from typing import Optional

from .schemas import Evidence, EvidenceKind, Language, TermCheck, TermStatus

DATA = Path(__file__).resolve().parent.parent / "data"

_quran = json.loads((DATA / "quran.json").read_text(encoding="utf-8"))
_hadith = json.loads((DATA / "hadith.json").read_text(encoding="utf-8"))

COLLECTIONS = {"bukhari": "صحيح البخاري", "muslim": "صحيح مسلم"}
MAX_VERSES = 5
MAX_HADITH_CHARS = 2500

_ALEF = str.maketrans({"أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا", "ى": "ي"})


def _normalize_map(text: str) -> tuple[str, list[int]]:
    """Strip diacritics and punctuation; return the normalized text and each char's index in the original."""
    chars: list[str] = []
    index: list[int] = []
    for i, ch in enumerate(text):
        cat = unicodedata.category(ch)
        if cat in ("Mn", "Cf") or ch == "ـ":
            continue
        ch = ch.translate(_ALEF).casefold()
        if not ch.isalnum():
            ch = " "
        if ch == " " and (not chars or chars[-1] == " "):
            continue
        chars.append(ch)
        index.append(i)
    return "".join(chars), index


def normalize(text: str) -> str:
    return _normalize_map(text)[0].strip()


_glossary = json.loads((DATA / "glossary.json").read_text(encoding="utf-8"))
QURAN_EN_SOURCE = "Saheeh International (as listed on quranpedia.net)"
HADITH_EN_SOURCE = {"bukhari": "Sahih al-Bukhari, tr. M. Muhsin Khan", "muslim": "Sahih Muslim, tr. Abdul Hamid Siddiqui"}


def _stem(token: str) -> str:
    if len(token) > 3 and token[0] in "وف":
        token = token[1:]
    if len(token) > 4 and token.startswith("ال"):
        token = token[2:]
    return token


def _token_list(text: str) -> list[str]:
    # Names like عبدالله are written joined or apart; split them so both spellings match.
    plain = re.sub(r"\bعبد(?=ال\w)", "عبد ", normalize(text))
    return [_stem(t) for t in plain.split() if len(t) >= 3]


def _tokens(text: str) -> set[str]:
    return set(_token_list(text))


def _pairs(tokens: list[str]) -> set[tuple[str, str]]:
    return set(zip(tokens, tokens[1:]))


def _hadith_number(h: dict) -> str:
    """The number scholars cite: Fath al-Bari numbering for al-Bukhari, Abd al-Baqi numbering for Muslim."""
    if h.get("a") is None:
        return f"رقم تسلسلي {h['n']}"
    return str(int(float(h["a"])))


_hadith_tokens = [_tokens(h["t"]) for h in _hadith]
_index: dict[str, set[int]] = defaultdict(set)
for _i, _toks in enumerate(_hadith_tokens):
    for _t in _toks:
        _index[_t].add(_i)


def get_verses(surah: int, ayah_start: int, ayah_end: int) -> Optional[Evidence]:
    """Return a verse range from the Quran text, or None if the range does not exist."""
    if not 1 <= surah <= len(_quran["surahs"]):
        return None
    info = _quran["surahs"][surah - 1]
    if not 1 <= ayah_start <= ayah_end <= info["verses"] or ayah_end - ayah_start >= MAX_VERSES:
        return None
    keys = [f"{surah}:{a}" for a in range(ayah_start, ayah_end + 1)]
    ayat = str(ayah_start) if ayah_start == ayah_end else f"{ayah_start}-{ayah_end}"
    return Evidence(
        id="", kind=EvidenceKind.quran,
        text=" ۝ ".join(_quran["verses"][k] for k in keys),
        source=f"سورة {info['name']}، الآية {ayat}",
        translation_en=" ".join(_quran["en"][k] for k in keys),
        translation_source=f"{QURAN_EN_SOURCE}, {surah}:{ayat}",
        quran_key=f"{surah}:{ayah_start}-{ayah_end}",
    )


def verse_parts(quran_key: str, lang: Language) -> dict[int, str]:
    """The verses of a Quran evidence item, one by one, keyed by ayah number."""
    surah, ayat = quran_key.split(":")
    start, end = map(int, ayat.split("-"))
    texts = _quran["en"] if lang == Language.en else _quran["verses"]
    return {a: texts[f"{surah}:{a}"] for a in range(start, end + 1)}


def search_hadith(query: str, limit: int = 2) -> list[Evidence]:
    """Find hadiths in the two Sahihs matching a remembered Arabic wording."""
    q = _tokens(query)
    if len(q) < 3:
        return []
    counts: dict[int, int] = defaultdict(int)
    for t in q:
        for i in _index.get(t, ()):
            counts[i] += 1
    # Shared words are not enough: chains of narrators repeat the same names. The wording must also
    # run in the same order, so at least half of the query's adjacent word pairs must appear.
    wanted = _pairs(_token_list(query))
    hits = []
    for i, n in counts.items():
        if n / len(q) < 0.75 or len(_hadith[i]["t"]) > MAX_HADITH_CHARS:
            continue
        order = len(wanted & _pairs(_token_list(_hadith[i]["t"]))) / len(wanted)
        if order >= 0.5:
            hits.append((order, n / len(q), i))
    hits.sort(key=lambda x: (-x[0], -x[1], len(_hadith[x[2]]["t"])))
    found = []
    for _, _, i in hits[:limit]:
        h = _hadith[i]
        found.append(Evidence(
            id="", kind=EvidenceKind.hadith, text=h["t"],
            source=f"{COLLECTIONS[h['c']]}، حديث رقم {_hadith_number(h)}",
            translation_en=h.get("e"),
            translation_source=f"{HADITH_EN_SOURCE[h['c']]}, no. {_hadith_number(h)}" if h.get("e") else None,
        ))
    return found


def verify_excerpt(excerpt: str, source_text: str) -> Optional[str]:
    """If the excerpt is a verbatim run of the source (ignoring diacritics and punctuation),
    return that run exactly as the source writes it. Otherwise None."""
    needle = normalize(excerpt)
    if len(needle.split()) < 3:
        return None
    haystack, index = _normalize_map(source_text)
    match = re.search(rf"(?<![^ ]){re.escape(needle)}(?![^ ])", haystack)
    if match is None:
        return None
    start, end = index[match.start()], index[match.end() - 1] + 1
    while end < len(source_text) and unicodedata.category(source_text[end]) == "Mn":
        end += 1
    return source_text[start:end].strip()


def build_evidence(quran_requests, hadith_queries: list[str]) -> tuple[list[Evidence], list[str]]:
    """Resolve the model's requested texts against the sources. Returns (verified evidence, unverified requests)."""
    evidence: list[Evidence] = []
    unverified: list[str] = []
    seen: set[str] = set()

    def add(e: Evidence, prefix: str) -> None:
        if e.source not in seen:
            seen.add(e.source)
            n = sum(x.kind == e.kind for x in evidence) + 1
            evidence.append(e.model_copy(update={"id": f"{prefix}{n}"}))

    for r in quran_requests:
        found = get_verses(r.surah, r.ayah_start, r.ayah_end)
        if found is None:
            unverified.append(f"قرآن {r.surah}:{r.ayah_start}-{r.ayah_end}")
        else:
            add(found, "Q")
    for query in hadith_queries:
        results = search_hadith(query)
        if not results:
            unverified.append(f"حديث: {query}")
        for e in results:
            add(e, "H")
    return evidence, unverified


def glossary() -> list[dict]:
    return _glossary


def _has_term(entry: dict, text: str, lang: Language) -> bool:
    if lang == Language.ar:
        term = normalize(entry["ar"]).removeprefix("ال")
        return any(re.fullmatch(rf"[وف]?[بلك]?(ال|ل)?{term}", token) for token in normalize(text).split())
    plain = normalize(text)
    return any(normalize(form) in plain for form in entry["en"])


def check_terms(source_text: str, source_lang: Language, target_text: str, target_lang: Language) -> list[TermCheck]:
    """For each glossary term the source uses, report whether the target uses the approved equivalent."""
    return [
        TermCheck(
            term_ar=g["ar"], approved_en=g["display"], rule=g["rule"],
            status=TermStatus.used if _has_term(g, target_text, target_lang) else TermStatus.missing,
        )
        for g in _glossary if _has_term(g, source_text, source_lang)
    ]
