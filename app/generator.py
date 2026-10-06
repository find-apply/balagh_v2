import asyncio
import logging
import os
import re
import time
from pathlib import Path
from typing import Optional, TypeVar
from uuid import uuid4

from dotenv import load_dotenv
from google import genai
from google.genai import errors as genai_errors, types
from pydantic import BaseModel

from . import flow_settings, sources, store
from .video import catalog
from .schemas import (
    AudienceKnowledge, AudienceSpec, BriefIn, ClaimsDraft, ClaimStatus, ContentLevel, Evidence, EvidenceKind,
    Finding, FindingsDraft, Idea, IdeasDraft, Language, LocalizedDraft, Platform, Reference, ReferenceUsage,
    Reviewer, ReviewReport, Scene, Script, ScriptDraft, Severity,
)

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

# When the main model's quota runs out mid-session, fall back rather than fail the request.
FALLBACK_MODEL = os.getenv("REELS_FALLBACK_MODEL", "gemini-flash-latest")

logger = logging.getLogger("balagh")

client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

T = TypeVar("T", bound=BaseModel)


class GenerationRefused(Exception):
    pass


class Referral(Exception):
    """The brief asks for a personal ruling (level D): no content is generated, the user is referred."""


LEVELS = """Content levels (from the challenge's scientific reference):
- A: settled core knowledge (Quran, authentic hadith, pillars of Islam and faith, basic seerah, ethics and values).
- B: explanation and reasoning (explaining concepts, comparisons, wisdom behind rulings, common questions and misconceptions).
- C: disputed or highly sensitive matters (fiqh disagreements, detailed creed issues, contested history).
- D: a personal fatwa or an individual case (a ruling on someone's specific situation, validity of a particular \
contract or act of worship, family disputes, legal or medical matters with a religious consequence)."""

COMMON_RULES = """The creator makes Islamic religious content, so accuracy matters more than virality:

- On matters where scholars differ, do not present one opinion as the only one, and do not issue rulings.
- Do not quote or name scholars: there is no verified source for their statements here.
- No depiction of prophets, angels, or companions, and no acted-out portrayals of them.
- Hooks may raise curiosity but must not mislead, exaggerate rewards or punishments, or use clickbait that the \
video does not honour. The tone is respectful and sincere, never mocking or sensational.
- No instrumental music. Audio is the speaker's voice, optionally with vocal-only nasheed, recitation where \
fitting, or natural ambience."""

AUDIENCE_RULES = """Write in the target language. If a dialect is given, write in that dialect, not in the formal \
standard. If no dialect is given, write in the standard language (Modern Standard Arabic for Arabic), in a plain \
register that audience follows easily; never pick a regional dialect yourself. If a tone is given, deliver the \
script in it.

Audience knowledge of Islam shapes the explanation, never the content:
- familiar: use Islamic terms directly.
- basic: use the terms, each with a few words of explanation the first time.
- new: the viewer is discovering Islam. Start from the meaning in plain words and from a question they already \
ask, bring in the term afterwards, assume no prior knowledge, and never talk down to them."""

GLOSSARY = "Approved terminology (binding when writing in English; the rule applies in any language):\n" + "\n".join(
    f"- {g['ar']} = {g['display']}. {g['rule']}" for g in sources.glossary()
)

IDEAS_SYSTEM = f"""You are a short-form video strategist for Islamic content. Given a creator's brief, propose exactly 3 video ideas.

The three ideas must take clearly different angles on the brief (for example: a story, a how-to, a myth-buster), \
not three variations of one idea. Each must be shootable by a solo creator with a phone unless the brief says otherwise.

If the brief gives no idea, choose the topics yourself: three different topics this audience genuinely needs or \
asks about, specific enough to fill one video (not broad themes like "prayer" or "patience"), all at level A or B.

{AUDIENCE_RULES}

Duration: if the brief fixes a duration, design every idea for it. Otherwise pick the duration that suits each idea \
and the target platforms (short-form feeds reward tight videos; long-form platforms allow more), and explain the choice.

{LEVELS}

First classify the creator's own idea. If it is level D, do not propose ideas: return an empty list and a short, \
kind referral message saying this needs a qualified scholar or fatwa body who can hear the details, and that you \
can help with a general educational video on the topic instead. Do not mention level letters in that message. Never propose a level D idea yourself. \
A level C idea is allowed only if it presents that scholars differ without picking a side.

Religious texts are verified separately against the Quran and the two Sahihs (al-Bukhari and Muslim), so do not \
write out any verse or hadith in the idea. Describe it ("a hadith about ...") and request it: verses by surah and \
ayah number, hadiths by a distinctive run of their Arabic wording as you remember it (the Prophet's words, not the \
chain of narrators), in Arabic whatever the brief's language. Request only hadiths you believe are in al-Bukhari \
or Muslim. An idea must still make sense if a requested text turns out not to be found.

{GLOSSARY}

{COMMON_RULES}"""

TEXT_RULES = """Religious texts. You are given an evidence list of texts already verified in the sources, shown in \
the target language (for English, from an approved translation). It is the only religious text you may use:
- Never type out a verse or hadith yourself. To quote one, write its placeholder where the words belong, \
for example {{Q1}} or {{H1}}; the system inserts the exact source text.
- The Quran is only ever quoted, never paraphrased, summarized or reworded, and never in part of a verse. \
{{Q1}} inserts every verse of that item; {{Q1:2}} or {{Q1:2-3}} inserts only those verses, by the ayah numbers \
shown in the evidence. If the verses are too long for the time available, quote fewer verses or give the quote \
more seconds. After a quote you may add a short explanation, clearly as your own words and not as what the \
Quran says.
- For a hadith placeholder, also add an entry to `hadith_excerpts` with the exact run of words to insert, copied \
character for character from the evidence text (the Prophet's words, without the chain of narrators). You may \
instead convey a hadith's meaning in your own words: then do not use the placeholder, but still list the \
evidence id on that scene.
- List on every scene the ids of the evidence it quotes, relies on, or introduces (a scene that only says \
"the Prophet told us something" still lists the id of the text it leads into).
- Do not attribute anything to Allah, the Quran, or the Prophet that is not backed by an evidence item. If the \
evidence list is empty or lacks what the idea hoped for, build the script without it rather than filling the gap \
from memory.
- Keep the generated explanation clearly separate from the quoted text: introduce a quote as a quote.
- A hadith item may carry `<sharh>`: an approved explanation of that hadith. Explain the hadith as the \
`<sharh>` explains it, in your own simple words for this audience; do not go beyond it and do not contradict \
it. It is prose written about the hadith, not the hadith itself: never quote it and never attribute its words \
to the Prophet. Where a hadith has no `<sharh>`, keep the explanation to what its words plainly say.
- A Quran item may carry `<tafsir>`: an approved commentary on those verses. When you explain what a verse \
means, say what the commentary says, in your own simple words for this audience. Do not go beyond it, and do \
not contradict it. The commentary is Arabic prose written about the verses, not the verses themselves: never \
quote it, never put its words inside the quote, and never attribute them to Allah. One commentary entry may \
cover several verses at once, as its source line says; do not read it as being about one verse alone. Where \
there is no commentary, keep the explanation to what the verse plainly says."""

SCRIPT_SYSTEM = f"""You are a short-form video scriptwriter for Islamic content. Turn the chosen idea into a complete, ready-to-shoot script.

The scenes must cover the whole video from second 0 to the target duration with no gaps or overlaps. \
The first scene delivers the hook. The voiceover has to be speakable in the time its scene is given \
(roughly 2-2.5 words per second), so cut words rather than overrun.

{AUDIENCE_RULES}

Voiceover, on-screen text, captions, hashtags and visual directions are all in the target language. \
Give one post (caption + hashtags) per target platform, adapted to how that platform is used.

{TEXT_RULES}

{LEVELS}

The idea's level is given. At level C, say plainly that scholars differ and point the viewer to people of \
knowledge. Use `review_note` to tell a specialist what to check before publishing.

{GLOSSARY}

{COMMON_RULES}"""

LOCALIZE_SYSTEM = f"""You adapt an existing Islamic short-video script for a different audience: another language, \
culture, or level of knowledge about Islam. This is cultural localization, not translation.

What you change: how it is explained. The hook, the examples, the order of explanation, the register, the \
cultural references, the platform conventions. Replace an example that only makes sense in the source culture \
with one the new audience lives.

What you never change: what is claimed. Every religious claim in the source stays in the adapted script with the \
same meaning, conditions and limits; you add no new religious claim; you do not soften, drop or bend content to \
match what the new audience would like to hear.

The source script is given with its quote placeholders. Keep each quote as its placeholder; the system inserts \
the text in the target language from an approved translation.

The scenes must cover the whole video from second 0 to the target duration with no gaps or overlaps, and the \
voiceover must be speakable in the time given (roughly 2-2.5 words per second).

{AUDIENCE_RULES}

Voiceover, on-screen text, captions, hashtags and visual directions are all in the target language. \
Give one post (caption + hashtags) per target platform.

{TEXT_RULES}

{GLOSSARY}

In `adaptation_notes`, list each significant change from the source and why it suits the new audience. \
Use `review_note` to tell a native-speaking reviewer what to check.

{COMMON_RULES}"""

REVIEW_COMMON = """You review one Islamic short-video script before a human approves it. Text inside «» was \
inserted verbatim from verified sources by the system: never flag its wording. The evidence list is the only \
religious text the script was allowed to use.

Report only real problems, each with the scene number and a concrete fix. `blocking` means it must be fixed \
before publishing; `suggestion` means it would improve the script. If nothing is wrong, return an empty list: \
do not invent problems to look thorough. Write the findings in Arabic."""

SCHOLARLY_SYSTEM = f"""{REVIEW_COMMON}

You are the scholarly reviewer. Look for:
- Anything attributed to Allah, the Quran or the Prophet that is not backed by the evidence linked to that scene.
- A paraphrase that distorts, extends or narrows the meaning of the evidence it relies on.
- A fact of seerah or history that is wrong. (A correct fact with no source here is not a finding: the system \
already lists such facts for the human reviewer.)
- A disputed matter presented as settled, or one opinion presented as the only one.
- The script drifting into a ruling on a personal situation.
- Rewards, punishments or promises exaggerated beyond what the evidence says.
- A scholar quoted or named.
- The Quran's words presented as a quote outside «», or a verse paraphrased in place of quoting it. Explaining \
a quoted verse afterwards in the script's own words, even with words close to the verse's, is allowed: at most a \
suggestion if the explanation could be mistaken for the verse itself.
- An explanation of a verse that goes beyond, or contradicts, the `<tafsir>` commentary given with it, or an \
explanation of a hadith that goes beyond or contradicts its `<sharh>`. Where a text has commentary, the \
script's explanation of it must be traceable to that commentary.
- Words of a commentary presented as the verse or the hadith itself, or attributed to Allah or the Prophet.
- A content level that looks wrong for what the script actually says: always a suggestion, unless the script \
has drifted into a personal ruling (level D), which is blocking.

Religious errors and misattributions are blocking.

{LEVELS}"""

AUDIENCE_SYSTEM = f"""{REVIEW_COMMON}

You are the audience reviewer. Read the script as the target audience would. Look for:
- A term this audience would not know, used without the explanation their knowledge level needs.
- A term that breaks the approved terminology rules.
- Tone that scolds, mocks, talks down, or disrespects the viewer or their background.
- Examples or references that do not fit this audience's culture or daily life.
- A hook that promises something the video does not deliver.
- Language that is not the requested language, dialect or register.
- For a children's audience: fear (hellfire, punishment, death, illness), any ask to like, subscribe, comment, \
share or buy, or a mistake shown as funny or rewarded. These are blocking.

Disrespect and broken terminology rules are blocking; the rest are usually suggestions.

{AUDIENCE_RULES}

{GLOSSARY}"""

MEANING_SYSTEM = """You check that a localized Islamic video script preserved the meaning of its source. \
The two scripts are for different audiences and may differ freely in hook, examples, order and wording. \
Only religious content matters here: what is said about Allah, the Prophet, beliefs, acts of worship, rulings, \
rewards, and what a text means.

List every religious claim the source makes and what became of it in the localized script:
- preserved: same meaning, conditions and limits.
- altered: present but the meaning, strength, conditions or scope changed.
- dropped: absent.
Then list any religious claim the localized script makes that the source does not, as `added`.

A quote shown inside «» comes from the same verified text in both scripts, in each one's language: treat it as \
preserved. Be exact: a claim stated more strongly or more weakly is altered. Write claims and notes in Arabic."""

CHILDREN = re.compile(r"أطفال|طفل|صغار|ناشئة|\bchild|\bkids?\b|\byoung (?:children|kids)", re.IGNORECASE)

CHILDREN_RULES = """The audience is children. Binding rules on top of everything else:
- Plain short sentences, examples from a child's day, a warm voice; never talk down.
- Encourage, never frighten: no hellfire, punishment, death or illness details.
- Level A topics only; no disputed matters.
- Never ask the child to like, subscribe, comment, share, buy or send anything. The call to action is something \
the child does in real life (with family), and any posting advice goes to the parents in the platform posts.
- No depiction of prophets or companions as characters; their stories are told, not acted."""


def is_children(audience: str) -> bool:
    return bool(CHILDREN.search(audience))


PLACEHOLDER = re.compile(r"\{\{\s*([QH]\d+)(?:\s*:\s*(\d+)(?:\s*-\s*(\d+))?)?\s*\}\}")
ATTRIBUTION = re.compile(
    r"قال الله|قال تعالى|قوله تعالى|الآية|الاية|النبي|نبينا|نبيّنا|رسول الله|الرسول|ﷺ|الحديث|حديث"
    r"|\bprophet\b|\bhadith\b|\bquran\b|\bverse\b|\bmessenger\b",
    re.IGNORECASE,
)
REPORTED = re.compile(r"\bقال|يقول|قالت|أخبر|أمر|نهى|وعد|«|\bsaid\b|\bsays\b|\btold\b|\btaught\b|\bpromis", re.IGNORECASE)
KNOWLEDGE = {
    AudienceKnowledge.familiar: "familiar (knows Islamic terms)",
    AudienceKnowledge.basic: "basic (some acquaintance, few terms)",
    AudienceKnowledge.new: "new (discovering Islam)",
}
LANGUAGE = {Language.ar: "Arabic", Language.en: "English"}


WIDE_PLATFORMS = {Platform.youtube, Platform.linkedin, Platform.x}


def frame_of(platforms: list[Platform]) -> str:
    """The platform decides the frame: short-video feeds are vertical, the rest wide."""
    return "16:9" if platforms and all(p in WIDE_PLATFORMS for p in platforms) else "9:16"


def _target_block(t: AudienceSpec, platforms: list[Platform], duration: str) -> str:
    language = LANGUAGE[t.language] + (f" ({t.dialect})" if t.dialect else "")
    frame = frame_of(platforms)
    frame_rule = ("vertical 9:16 on a phone: on-screen text is 2-4 words per card, one idea per scene"
                  if frame == "9:16" else "wide 16:9: on-screen text may be a full sentence, scenes can hold two ideas")
    return (
        f"<target>\n"
        f"<audience>{t.audience}</audience>\n"
        f"<language>{language}</language>\n"
        f"<knowledge_of_islam>{KNOWLEDGE[t.audience_knowledge]}</knowledge_of_islam>\n"
        f"<tone>{t.tone or 'your choice, whatever suits this audience and topic'}</tone>\n"
        f"<platforms>{', '.join(p.value for p in platforms)}</platforms>\n"
        f"<frame>{frame_rule}</frame>\n"
        f"<duration>{duration}</duration>\n"
        f"</target>"
        + (f"\n\n<children_rules>\n{CHILDREN_RULES}\n</children_rules>" if is_children(t.audience) else "")
    )


def _evidence_text(e: Evidence, lang: Language) -> str:
    return e.translation_en if lang == Language.en and e.translation_en else e.text


def _evidence_block(evidence: list[Evidence], lang: Language) -> str:
    if not evidence:
        return "<evidence>none: do not quote or attribute any religious text</evidence>"
    def body(e: Evidence) -> str:
        if e.quran_key:
            text = " ".join(f"({ayah}) {t}" for ayah, t in sources.verse_parts(e.quran_key, lang).items())
        else:
            text = _evidence_text(e, lang)
        # The commentary is in Arabic whatever the script's language: it grounds the meaning, it is not quoted.
        tafsir = "".join(f'\n<tafsir source="{t.source}">{t.text}</tafsir>' for t in e.tafsir)
        sharh = (f'\n<sharh grade="{e.sharh.grade}" narrated="{e.sharh.attribution}" source="{e.sharh.source}">'
                 f'{e.sharh.text}</sharh>') if e.sharh else ""
        return f"{text}{tafsir}{sharh}"

    items = "\n".join(f'<item id="{e.id}" kind="{e.kind.value}" source="{e.source}">{body(e)}</item>' for e in evidence)
    return f"<evidence>\n{items}\n</evidence>"


# The evaluation sets this so its calls get the plain defaults (no admin rules) and stay out of the admin's run log.
PLAIN = os.getenv("REELS_PLAIN") == "1"


def models() -> tuple[str, str]:
    """(generation model, review model) in effect: the admin's settings, or the environment defaults."""
    flow = flow_settings.defaults() if PLAIN else flow_settings.current()
    return flow.generation_model, flow.review_model


async def _generate(system: str, prompt: str, output: type[T], role: str = "generation") -> T:
    """Runs one model call with the admin's current settings, and records it for the admin's run log."""
    flow = flow_settings.defaults() if PLAIN else flow_settings.current()
    model = flow.review_model if role == "review" else flow.generation_model
    if flow.extra_rules.strip():
        system += f"\n\nAdditional editorial rules from the platform's administrators (binding):\n{flow.extra_rules.strip()}"
    started = time.monotonic()
    error = None
    try:
        try:
            return await _call_model(system, prompt, output, model)
        except genai_errors.APIError as unavailable:
            # 429 is the quota or rate limit; 503 is the model being overloaded. Both are the model
            # being unavailable rather than the request being wrong, so try the smaller model once.
            if unavailable.code not in (429, 503) or model == FALLBACK_MODEL:
                raise
            logger.warning("model %s unavailable (%s); falling back to %s", model, unavailable.code, FALLBACK_MODEL)
            model = FALLBACK_MODEL
            return await _call_model(system, prompt, output, model)
    except Exception as e:
        error = f"{type(e).__name__}: {e}"
        raise
    finally:
        if not PLAIN:
            store.log_run(output.__name__, model, time.monotonic() - started, error)


async def _call_model(system: str, prompt: str, output: type[T], model: str) -> T:
    response = await client.aio.models.generate_content(
        model=model,
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=system,
            response_mime_type="application/json",
            response_schema=output,
            automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
        ),
    )
    if response.prompt_feedback and response.prompt_feedback.block_reason:
        raise GenerationRefused("The model declined this brief.")
    candidate = response.candidates[0] if response.candidates else None
    if candidate is None or candidate.finish_reason != types.FinishReason.STOP:
        reason = candidate.finish_reason if candidate else "no candidates"
        if candidate and candidate.finish_reason in (types.FinishReason.SAFETY, types.FinishReason.PROHIBITED_CONTENT):
            raise GenerationRefused("The model declined this brief.")
        raise RuntimeError(f"Incomplete model output (finish_reason={reason})")
    return output.model_validate_json(response.text)


# ---- Ideas ----

async def generate_ideas(brief: BriefIn) -> list[Idea]:
    duration = f"{brief.duration_seconds} seconds (fixed by the creator)" if brief.duration_seconds else "not set, suggest one per idea"
    prompt = (
        f"<idea>{brief.idea or 'not given, choose the topics yourself'}</idea>\n\n"
        f"{_target_block(brief, brief.platforms, duration)}"
    )
    draft = await _generate(IDEAS_SYSTEM, prompt, IdeasDraft)
    if draft.brief_level == ContentLevel.D:
        raise Referral(draft.referral_message or "هذه المسألة تحتاج إلى مفتٍ أو جهة إفتاء مؤهلة تسمع تفاصيلها.")
    if len(draft.ideas) != 3 or any(i.content_level == ContentLevel.D for i in draft.ideas):
        raise RuntimeError("The model did not return 3 usable ideas")
    ideas = []
    for n, d in enumerate(draft.ideas, start=1):
        evidence, unverified = sources.build_evidence(d.quran_requests, d.hadith_queries)
        ideas.append(Idea(
            id=str(n),
            **d.model_dump(exclude={"quran_requests", "hadith_queries", "duration_seconds"}),
            duration_seconds=brief.duration_seconds or d.duration_seconds,
            needs_specialist_review=d.content_level == ContentLevel.C,
            evidence=evidence,
            unverified=unverified,
        ))
    return ideas


# ---- Scripts ----

def _finalize(draft: ScriptDraft, idea: Idea, lang: Language) -> dict:
    """Insert verified source text into the draft and build the reference list. Raises ValueError on any
    placeholder that cannot be backed by the evidence."""
    evidence = {e.id: e for e in idea.evidence}
    inserts: dict[str, str] = {}
    for e in idea.evidence:
        if e.kind == EvidenceKind.quran:
            inserts[e.id] = _evidence_text(e, lang)
    for x in draft.hadith_excerpts:
        source = evidence.get(x.evidence_id)
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
                source = evidence[key]
                parts = sources.verse_parts(source.quran_key, lang) if source.quran_key else {}
                wanted = range(int(first), int(last or first) + 1)
                if not wanted or any(a not in parts for a in wanted):
                    raise ValueError(f"{m.group(0)} asks for verses outside {key}: it holds ayahs {sorted(parts)}.")
                text = " ".join(parts[a] for a in wanted)
            quoted.add(key)
            return f"«{text}»"
        return PLACEHOLDER.sub(sub, text)

    warnings: list[str] = []
    relied: set[str] = set()
    scenes: list[Scene] = []
    for n, s in enumerate(draft.scenes, start=1):
        ids = [i for i in s.evidence_ids if i in evidence]
        ids += [m.group(1) for m in PLACEHOLDER.finditer(s.voiceover + s.on_screen_text)
                if m.group(1) in evidence and m.group(1) not in ids]
        relied.update(ids)
        text = f"{s.voiceover} {s.on_screen_text}"
        # Defining a word ("the hadith is the Prophet's words") is not an attribution; reporting or quoting is.
        if not ids and ATTRIBUTION.search(text) and REPORTED.search(text):
            warnings.append(f"المشهد {n} يذكر نصا شرعيا أو ينسب قولا دون دليل موثق مرتبط به.")
        scenes.append(Scene(
            start_second=s.start_second, end_second=s.end_second, visual=s.visual, art=s.art,
            voiceover=fill(s.voiceover), on_screen_text=fill(s.on_screen_text), evidence_ids=ids,
        ))
    hook, cta = fill(draft.hook), fill(draft.call_to_action)
    posts = [p.model_copy(update={"caption": fill(p.caption)}) for p in draft.posts]

    for i in relied - quoted:
        if evidence[i].kind == EvidenceKind.quran:
            raise ValueError(
                f"{i} is relied on but never quoted. The Quran may only be used by quoting it with its placeholder, "
                f"e.g. {{{{{i}}}}} or a verse of it like {{{{{i}:1}}}}; do not paraphrase it."
            )

    translated = lang == Language.en
    references = [
        Reference(
            evidence_id=i, kind=e.kind, source=e.source, arabic=e.text,
            usage=ReferenceUsage.quoted if i in quoted else ReferenceUsage.paraphrased,
            text=inserts.get(i, _evidence_text(e, lang)),
            translation_source=e.translation_source if translated else None,
            quran_key=e.quran_key, hadith_key=e.hadith_key,
            tafsir=e.tafsir,
            sharh=e.sharh,
        )
        for i, e in evidence.items() if i in quoted or i in relied
    ]
    return dict(
        title=draft.title, hook=hook, scenes=scenes, call_to_action=cta, audio=draft.audio,
        references=references, content_level=idea.content_level,
        needs_specialist_review=idea.needs_specialist_review or bool(warnings),
        review_note=draft.review_note, warnings=warnings, posts=posts, draft=draft,
        unverified_claims=[c.strip() for c in draft.historical_claims if c.strip()],
    )


async def _write(system: str, prompt: str, output: type[ScriptDraft], idea: Idea, lang: Language) -> dict:
    error: Optional[ValueError] = None
    for _ in range(2):
        attempt = prompt if error is None else f"{prompt}\n\nYour previous attempt was rejected: {error} Fix it."
        draft = await _generate(system, attempt, output)
        try:
            return _finalize(draft, idea, lang)
        except ValueError as e:
            error = e
    raise RuntimeError(f"Could not produce a script whose quotes verify against the sources: {error}")


def _idea_block(idea: Idea) -> str:
    return (
        f"<chosen_idea level=\"{idea.content_level.value}\">\n"
        f"<title>{idea.title}</title>\n"
        f"<hook>{idea.hook}</hook>\n"
        f"<concept>{idea.concept}</concept>\n"
        f"</chosen_idea>"
    )


def _new_id() -> str:
    return uuid4().hex[:8]


def _art_block(template: Optional[str]) -> str:
    return f"<video_art>\n{catalog.art_rules(template)}\n</video_art>"


async def generate_script(brief: BriefIn, idea: Idea, duration_seconds: int, notes: Optional[str],
                          template: Optional[str] = None) -> Script:
    target = AudienceSpec(**brief.model_dump(include=set(AudienceSpec.model_fields)))
    prompt = (
        f"{_target_block(target, brief.platforms, f'{duration_seconds} seconds')}\n\n"
        f"{_idea_block(idea)}\n\n"
        f"{_evidence_block(idea.evidence, target.language)}\n\n"
        f"{_art_block(template)}"
    )
    if notes:
        prompt += f"\n\n<creator_notes>{notes}</creator_notes>"
    fields = await _write(SCRIPT_SYSTEM, prompt, ScriptDraft, idea, target.language)
    return Script(id=_new_id(), idea_id=idea.id, target=target, platforms=brief.platforms,
                  duration_seconds=duration_seconds, template=template, **fields)


def _spoken_text(script: Script) -> str:
    parts = [script.hook, script.call_to_action]
    for s in script.scenes:
        parts += [s.voiceover, s.on_screen_text]
    parts += [p.caption for p in script.posts]
    return "\n".join(parts)


async def localize_script(source: Script, idea: Idea, target: AudienceSpec, platforms: list[Platform],
                          duration_seconds: int, notes: Optional[str]) -> Script:
    prompt = (
        f"<source_script language=\"{LANGUAGE[source.target.language]}\" audience=\"{source.target.audience}\">\n"
        f"{source.draft.model_dump_json(exclude={'hadith_excerpts'})}\n"
        f"</source_script>\n\n"
        f"{_target_block(target, platforms, f'{duration_seconds} seconds')}\n\n"
        f"{_evidence_block(idea.evidence, target.language)}\n\n"
        f"{_art_block(source.template)}"
    )
    if notes:
        prompt += f"\n\n<creator_notes>{notes}</creator_notes>"
    fields = await _write(LOCALIZE_SYSTEM, prompt, LocalizedDraft, idea, target.language)
    script = Script(id=_new_id(), idea_id=idea.id, localized_from=source.id, target=target, platforms=platforms,
                    duration_seconds=duration_seconds, template=source.template, adaptation_notes=fields["draft"].adaptation_notes, **fields)
    script.terminology = sources.check_terms(
        _spoken_text(source), source.target.language, _spoken_text(script), target.language,
    )
    return script


# ---- Review ----

def _script_view(script: Script) -> str:
    """The script as reviewers see it: final text with inserted quotes."""
    return script.model_dump_json(include={"title", "hook", "scenes", "call_to_action", "posts", "content_level"})


async def review_script(script: Script, idea: Idea, source: Optional[Script]) -> ReviewReport:
    context = (
        f"{_target_block(script.target, script.platforms, f'{script.duration_seconds} seconds')}\n\n"
        f"{_evidence_block(idea.evidence, script.target.language)}\n\n"
        f"<script>\n{_script_view(script)}\n</script>"
    )
    tasks = [
        _generate(SCHOLARLY_SYSTEM, context, FindingsDraft, "review"),
        _generate(AUDIENCE_SYSTEM, context, FindingsDraft, "review"),
    ]
    if source is not None:
        tasks.append(_generate(
            MEANING_SYSTEM,
            f"<source_script>\n{_script_view(source)}\n</source_script>\n\n<localized_script>\n{_script_view(script)}\n</localized_script>",
            ClaimsDraft, "review",
        ))
    results = await asyncio.gather(*tasks)
    findings = [
        Finding(reviewer=reviewer, **f.model_dump())
        for reviewer, result in zip((Reviewer.scholarly, Reviewer.audience), results)
        for f in result.findings
    ]
    claims = results[2].claims if source is not None else []
    for c in claims:
        if c.status in (ClaimStatus.altered, ClaimStatus.added):
            findings.append(Finding(
                reviewer=Reviewer.meaning, scene=0, severity=Severity.blocking,
                issue=f"ادعاء {'تغيّر معناه' if c.status == ClaimStatus.altered else 'أضيف وليس في الأصل'}: {c.claim}. {c.note}",
                fix="أعد الادعاء إلى معناه في النص الأصلي." if c.status == ClaimStatus.altered else "احذف الادعاء المضاف.",
            ))
        elif c.status == ClaimStatus.dropped:
            findings.append(Finding(
                reviewer=Reviewer.meaning, scene=0, severity=Severity.suggestion,
                issue=f"ادعاء في الأصل لم يرد في النسخة الموطّنة: {c.claim}. {c.note}",
                fix="أعده إن كان من مقصود الفيديو.",
            ))
    findings.sort(key=lambda f: (f.severity != Severity.blocking, f.scene))
    return ReviewReport(findings=findings, claims=claims, blocking=sum(f.severity == Severity.blocking for f in findings))


async def revise_script(script: Script, idea: Idea, notes: Optional[str], earlier: list[Script] = ()) -> Script:
    """One correction pass applying the review's blocking findings and the human reviewer's notes.
    `earlier` are the versions this one corrected, oldest last: what their reviews had fixed must stay fixed,
    or a later pass drifts back to a wording an earlier pass removed (seen in practice)."""
    corrections = [f"- Scene {f.scene}: {f.issue} Fix: {f.fix}" for f in (script.review.findings if script.review else [])
                   if f.severity == Severity.blocking]
    kept = [f"- {f.issue} (fixed in version {e.version}: keep that fix)"
            for e in earlier if e.review for f in e.review.findings if f.severity == Severity.blocking]
    for c in script.change_requests:
        corrections.append(f"- From the human reviewer ({c.role.value}, {c.name}): {c.note}")
    if notes:
        corrections.append(f"- From the human reviewer: {notes}")
    if not corrections:
        raise ValueError("Nothing to correct: no blocking findings and no notes.")
    localized = script.localized_from is not None
    prompt = (
        f"{_target_block(script.target, script.platforms, f'{script.duration_seconds} seconds')}\n\n"
        f"{_evidence_block(idea.evidence, script.target.language)}\n\n"
        f"{_art_block(script.template)}\n\n"
        f"<current_script>\n{script.draft.model_dump_json()}\n</current_script>\n\n"
        f"Reviewers found the problems below in the current script. Return the full script with only these "
        f"corrected: keep everything else, including the quote placeholders, as it is.\n"
        + "\n".join(corrections)
        + (f"\n\nEarlier versions were corrected for the problems below; do not reintroduce any of them:\n" + "\n".join(kept) if kept else "")
    )
    fields = await _write(SCRIPT_SYSTEM, prompt, LocalizedDraft if localized else ScriptDraft, idea, script.target.language)
    return script.model_copy(update=dict(
        id=_new_id(), version=script.version + 1, revised_from=script.id, review=None, approvals=[], change_requests=[],
        adaptation_notes=fields["draft"].adaptation_notes if localized else [], **fields,
    ))
