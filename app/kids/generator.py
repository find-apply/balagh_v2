"""Children's stories. Separate prompts and rules from the main flow; only the verified sources are shared."""
import re
from uuid import uuid4

from .. import sources
from ..generator import LANGUAGE, PLACEHOLDER, _evidence_block, _evidence_text, _generate
from ..schemas import Evidence, EvidenceKind, Language, Reference, ReferenceUsage
from .schemas import AgeBand, PlanDraft, Story, StoryDraft, StoryIn, StoryScene


class Unsuitable(Exception):
    """The topic is not suitable for a children's story; nothing is generated."""


DEFAULT_DURATION = {AgeBand.young: 180, AgeBand.middle: 240, AgeBand.older: 300}
# A verse is quoted whole or not at all, so long verses are left out of children's stories.
MAX_VERSE_WORDS = {AgeBand.young: 12, AgeBand.middle: 18, AgeBand.older: 25}

AGES = """Age bands:
- 4-6: very short sentences, one idea at a time, lots of repetition, concrete things the child can see and touch.
- 7-9: short sentences, a clear small problem and a clear solution, a little humour.
- 10-12: can follow a reason ("because...") and a feeling that changes; still concrete, never abstract lectures."""

CHILD_RULES = """Rules for children's content. These protect the child and are not negotiable:
- Only settled, core teachings: good character, gratitude, honesty, kindness, the basics of worship, love of \
Allah and His Messenger. Nothing disputed among scholars, no rulings, no detailed creed.
- Encourage, never frighten. No hell, punishment, torment, graves, death in any detail, devils, or threats. \
Motivation comes from love, kindness and the good that follows.
- The characters are fictional, present-day children and their family or teachers. No prophet, companion or \
angel appears as a character or is depicted; an elder may tell the child what the Prophet taught.
- The child character is a model. If they make a mistake, it is corrected within this same story, gently and \
without humiliation, and the mistake is never shown as funny, clever or rewarded.
- Adults in the story are kind and patient. No shouting, hitting, shaming or scaring.
- Never ask the child viewer to like, subscribe, comment, buy, send or share anything.
- No instrumental music. Voices, optionally vocal-only nasheed or natural sounds."""

PLAN_SYSTEM = f"""You plan one short Islamic story for children, to be narrated or animated.

First decide whether the topic suits a children's story under the rules below. It is unsuitable if it is a \
disputed or sensitive matter, a personal ruling, or cannot be told without frightening content (punishment, \
death, violence, war, marriage and divorce, politics, sectarian differences). If unsuitable, say so with a short \
message to the creator and, when one exists, a gentle angle on the same theme that would suit children; \
nothing is generated in that case, so only suggest the angle. \
If no topic is given, choose one everyday good-character topic that fits the age.

The story is built on a small everyday situation in the child's own world (home, school, play), not on a \
lecture. Use the given characters exactly as described; if none are given, create two or three: a child about \
the age of the audience, a sibling or friend, and one kind elder.

Religious texts are verified separately against the Quran and the two Sahihs (al-Bukhari and Muslim), so do not \
write any verse or hadith out. Request at most one short verse (by surah and ayah number) and at most one short \
hadith (by a distinctive run of its Arabic wording, in Arabic whatever the story's language). Choose texts a \
child can hold in mind: a single short verse, a one-sentence hadith. The story must still work if a requested \
text is not found.

Write in the story's language.

{AGES}

{CHILD_RULES}"""

STORY_SYSTEM = f"""You write one short Islamic story for children from a plan, as scenes for narration or animation.

Shape: we meet the child in their everyday world; a small problem or question appears; the child tries \
something, perhaps makes a mistake; a kind elder or a friend helps them see; the child puts it right; a warm \
ending. One idea only. Use each character's way of speaking, and their catchphrase where it fits naturally.

Pace it for children: roughly 1.5 to 2 spoken words per second, counting narration and dialogue together. \
The scenes cover the story from second 0 to the target duration with no gaps or overlaps. Keep scenes short, \
20 to 40 seconds each, so the picture changes often.

Write in the story's language, in the simple register children of this age understand. If a dialect is given, \
the characters speak it.

Religious texts. You are given the texts already verified in the sources. They are the only religious text you \
may use:
- Never type a verse or hadith yourself. To quote one, write its placeholder where the words belong, for \
example {{{{Q1}}}} or {{{{H1}}}}; the system inserts the exact source text.
- The Quran is only ever quoted, never paraphrased or reworded, and never in part of a verse. {{{{Q1}}}} inserts \
every verse of that item; {{{{Q1:2}}}} inserts only that verse.
- For a hadith placeholder, add an entry to `hadith_excerpts` with the exact run of words to insert, copied \
character for character from the evidence text (the Prophet's words, without the chain of narrators). You may \
instead have the elder convey a hadith's meaning in simple words: then do not use the placeholder, but list the \
evidence id on that scene.
- A quote is spoken by an elder or the narrator, introduced as what Allah says or what the Prophet taught, \
and followed by one simple sentence of what it means for the child.
- List on every scene the ids of the evidence it quotes, relies on, or introduces.
- Attribute nothing to Allah or the Prophet beyond the evidence. If there is no evidence, tell the story without \
any attribution.

Also write: a closing question a parent can ask the child afterwards; a note for the parent or educator on what \
the story teaches and how to follow it up; and a 20-30 second teaser addressed to parents (not to children) \
announcing the story, for short-video platforms.

{AGES}

{CHILD_RULES}"""

# Words that should not reach a children's story. A hit does not block; it is flagged for the guardian.
FRIGHTENING = re.compile(
    r"النار|جهنم|عذاب|يعذب|تعذب|القبر|الموت|يموت|تموت|مات |الشيطان|شيطان|عقاب|يعاقب"
    r"|\bhell\b|\bpunish|\btorment|\bgrave\b|\bdeath\b|\bdie[sd]?\b|\bdevil|\bsatan\b",
    re.IGNORECASE,
)
SOLICITING = re.compile(r"اشترك|لايك|اضغط|علّق|علق في|شارك الفيديو|\bsubscribe\b|\blike and\b|\bcomment below\b", re.IGNORECASE)
ATTRIBUTION = re.compile(r"قال الله|قال تعالى|الآية|النبي|رسول الله|الرسول|ﷺ|حديث|\bprophet\b|\bhadith\b|\bquran\b|\bmessenger\b", re.IGNORECASE)


def _request_block(req: StoryIn, duration: int) -> str:
    language = LANGUAGE[req.language] + (f" ({req.dialect})" if req.dialect else "")
    characters = "\n".join(f"- {c.name}: {c.trait}" for c in req.characters) if req.characters else "none given, create them"
    return (
        f"<story_request>\n"
        f"<topic>{req.topic or 'not given, choose one'}</topic>\n"
        f"<age>{req.age_band.value}</age>\n"
        f"<language>{language}</language>\n"
        f"<duration>{duration} seconds</duration>\n"
        f"<characters>\n{characters}\n</characters>\n"
        f"</story_request>"
    )


def _finalize(draft: StoryDraft, evidence: list[Evidence], lang: Language) -> tuple[list[StoryScene], list[Reference], list[str]]:
    """Insert verified source text and build references. Raises ValueError when a quote cannot be backed."""
    by_id = {e.id: e for e in evidence}
    inserts = {e.id: _evidence_text(e, lang) for e in evidence if e.kind == EvidenceKind.quran}
    for x in draft.hadith_excerpts:
        source = by_id.get(x.evidence_id)
        if source is None or source.kind != EvidenceKind.hadith:
            continue
        verified = sources.verify_excerpt(x.excerpt, _evidence_text(source, lang))
        if verified is None:
            raise ValueError(f"The excerpt given for {x.evidence_id} is not a verbatim run of that hadith's evidence text.")
        inserts[x.evidence_id] = verified

    quoted: set[str] = set()

    def fill(text: str) -> str:
        def sub(m: re.Match) -> str:
            key, first, last = m.group(1), m.group(2), m.group(3)
            if key not in inserts:
                raise ValueError(f"Placeholder {key} has no verified text (unknown id, or a hadith without an excerpt).")
            text = inserts[key]
            if first:
                parts = sources.verse_parts(by_id[key].quran_key, lang) if by_id[key].quran_key else {}
                wanted = range(int(first), int(last or first) + 1)
                if not wanted or any(a not in parts for a in wanted):
                    raise ValueError(f"{m.group(0)} asks for verses outside {key}: it holds ayahs {sorted(parts)}.")
                text = " ".join(parts[a] for a in wanted)
            quoted.add(key)
            return f"«{text}»"
        return PLACEHOLDER.sub(sub, text)

    warnings: list[str] = []
    relied: set[str] = set()
    scenes: list[StoryScene] = []
    for n, s in enumerate(draft.scenes, start=1):
        raw = " ".join([s.narration, *(d.line for d in s.dialogue)])
        ids = [i for i in s.evidence_ids if i in by_id]
        ids += [m.group(1) for m in PLACEHOLDER.finditer(raw) if m.group(1) in by_id and m.group(1) not in ids]
        relied.update(ids)
        plain = PLACEHOLDER.sub(" ", raw)
        if not ids and ATTRIBUTION.search(plain):
            warnings.append(f"المشهد {n} ينسب قولا أو يذكر نصا شرعيا دون دليل موثق مرتبط به.")
        if FRIGHTENING.search(plain):
            warnings.append(f"المشهد {n} فيه لفظ قد يخيف الطفل. راجعه.")
        if SOLICITING.search(plain):
            warnings.append(f"المشهد {n} يطلب من الطفل تفاعلا (اشتراك أو تعليق). احذفه.")
        scenes.append(s.model_copy(update={
            "narration": fill(s.narration),
            "dialogue": [d.model_copy(update={"line": fill(d.line)}) for d in s.dialogue],
            "evidence_ids": ids,
        }))

    for i in relied - quoted:
        if by_id[i].kind == EvidenceKind.quran:
            raise ValueError(f"{i} is relied on but never quoted. The Quran may only be used by quoting it with its placeholder.")

    references = [
        Reference(
            evidence_id=i, kind=e.kind, source=e.source, arabic=e.text,
            usage=ReferenceUsage.quoted if i in quoted else ReferenceUsage.paraphrased,
            text=inserts.get(i, _evidence_text(e, lang)),
            translation_source=e.translation_source if lang == Language.en else None,
        )
        for i, e in by_id.items() if i in quoted or i in relied
    ]
    return scenes, references, warnings


async def generate_story(req: StoryIn) -> Story:
    duration = req.duration_seconds or DEFAULT_DURATION[req.age_band]
    request = _request_block(req, duration)

    plan = await _generate(PLAN_SYSTEM, request, PlanDraft)
    if not plan.suitable:
        raise Unsuitable(plan.unsuitable_message or "هذا الموضوع لا يناسب قصة للأطفال.")
    evidence, unverified = sources.build_evidence(plan.quran_requests[:1], plan.hadith_queries[:1])
    for e in list(evidence):
        if e.kind == EvidenceKind.quran and len(e.text.split()) > MAX_VERSE_WORDS[req.age_band]:
            evidence.remove(e)
            unverified.append(f"{e.source}: آية أطول من أن تُقتبس كاملة لهذا العمر")

    characters = "\n".join(f"- {c.name} ({c.age}): {c.trait}. Says: {c.catchphrase or '-'}" for c in plan.characters)
    prompt = (
        f"{request}\n\n"
        f"<plan>\n<title>{plan.title}</title>\n<moral>{plan.moral}</moral>\n<synopsis>{plan.synopsis}</synopsis>\n"
        f"<characters>\n{characters}\n</characters>\n</plan>\n\n"
        f"{_evidence_block(evidence, req.language)}"
    )
    error = None
    for _ in range(2):
        attempt = prompt if error is None else f"{prompt}\n\nYour previous attempt was rejected: {error} Fix it."
        draft = await _generate(STORY_SYSTEM, attempt, StoryDraft)
        try:
            scenes, references, warnings = _finalize(draft, evidence, req.language)
            break
        except ValueError as e:
            error = e
    else:
        raise RuntimeError(f"Could not produce a story whose quotes verify against the sources: {error}")

    return Story(
        id=uuid4().hex[:12], request=req, duration_seconds=duration, title=plan.title, moral=plan.moral,
        characters=plan.characters, scenes=scenes, closing_question=draft.closing_question,
        parent_note=draft.parent_note, teaser=draft.teaser, references=references,
        unverified=unverified, warnings=warnings,
    )
