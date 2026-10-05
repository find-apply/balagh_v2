from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, field_validator


class Platform(str, Enum):
    tiktok = "tiktok"
    instagram_reels = "instagram_reels"
    youtube_shorts = "youtube_shorts"
    facebook_reels = "facebook_reels"
    snapchat = "snapchat"
    youtube = "youtube"
    linkedin = "linkedin"
    x = "x"


class Language(str, Enum):
    ar = "ar"
    en = "en"


class AudienceKnowledge(str, Enum):
    familiar = "familiar"  # knows Islamic terms
    basic = "basic"        # some acquaintance, few terms
    new = "new"            # discovering Islam


class ContentLevel(str, Enum):
    """Content levels from the challenge's scientific reference."""
    A = "A"  # settled core knowledge: answer directly with the source
    B = "B"  # explanation and reasoning: answer from approved material, no certainty where scholars differ
    C = "C"  # disputed or highly sensitive: state the disagreement, refer to a specialist
    D = "D"  # personal fatwa or individual case: no ruling, refer to a qualified body


# ---- Requests ----

class AudienceSpec(BaseModel):
    audience: str = Field(min_length=2, max_length=500, examples=["شباب 18-30"])
    language: Language
    dialect: Optional[str] = Field(
        default=None, max_length=60, examples=["الدارجة الجزائرية"],
        description="Optional variety or register of the language.",
    )
    audience_knowledge: AudienceKnowledge = Field(
        default=AudienceKnowledge.familiar,
        description="How much the audience already knows about Islam.",
    )
    tone: Optional[str] = Field(
        default=None, max_length=60, examples=["قصصي"],
        description="Optional tone of delivery. Leave null to let the AI choose.",
    )


class BriefIn(AudienceSpec):
    idea: Optional[str] = Field(
        default=None, min_length=3, max_length=2000, examples=["فضل صلاة الفجر"],
        description="Leave null to let the AI pick the topics itself.",
    )
    platforms: list[Platform] = Field(min_length=1)
    duration_seconds: Optional[int] = Field(
        default=None, ge=5, le=600,
        description="Leave null to let the AI suggest a duration for each idea.",
    )


class ScriptIn(BaseModel):
    duration_seconds: Optional[int] = Field(
        default=None, ge=5, le=600,
        description="Overrides the idea's duration. Leave null to keep it.",
    )
    notes: Optional[str] = Field(
        default=None, max_length=1000,
        description="Extra direction for the script (tone, things to include or avoid).",
    )


class LocalizeIn(AudienceSpec):
    platforms: Optional[list[Platform]] = Field(default=None, description="Leave null to keep the source script's platforms.")
    duration_seconds: Optional[int] = Field(default=None, ge=5, le=600, description="Leave null to keep the source duration.")
    notes: Optional[str] = Field(default=None, max_length=1000)


class ReviseIn(BaseModel):
    notes: Optional[str] = Field(default=None, max_length=1000, description="Extra corrections from the human reviewer.")


# ---- Shared ----

class EvidenceKind(str, Enum):
    quran = "quran"
    hadith = "hadith"


class Evidence(BaseModel):
    """A text found in the verified sources. Only these may be quoted or attributed."""
    id: str
    kind: EvidenceKind
    text: str
    source: str
    translation_en: Optional[str] = None
    translation_source: Optional[str] = None
    quran_key: Optional[str] = Field(default=None, description="Quran only: surah:first-last ayah, e.g. 112:1-4.")


class PlatformPost(BaseModel):
    platform: Platform
    caption: str = Field(description="The post text, without hashtags.")
    hashtags: list[str] = Field(description="Each starting with #.")

    @field_validator("hashtags")
    @classmethod
    def _hash_prefix(cls, tags: list[str]) -> list[str]:
        return ["#" + t.strip().lstrip("#") for t in tags if t.strip().lstrip("#")]


# ---- Model output (kept free of numeric/length constraints for structured outputs) ----

class QuranRequest(BaseModel):
    surah: int = Field(description="Surah number, 1-114.")
    ayah_start: int
    ayah_end: int = Field(description="Same as ayah_start for a single verse.")


class IdeaCore(BaseModel):
    title: str
    hook: str = Field(description="The first 1-3 seconds: what is said or shown to stop the scroll.")
    concept: str = Field(description="2-3 sentences on what happens in the video. Describe texts, do not quote them.")
    why_it_works: str = Field(description="Why this fits the audience and the chosen platforms.")
    duration_seconds: int
    duration_reason: str = Field(description="One sentence justifying the duration.")
    content_level: ContentLevel
    level_reason: str = Field(description="One sentence on why the idea sits at this level.")


class IdeaDraft(IdeaCore):
    quran_requests: list[QuranRequest] = Field(description="Verses the video would rely on. Empty if none.")
    hadith_queries: list[str] = Field(
        description="For each hadith the video would rely on, a distinctive run of its Arabic wording to search for. Empty if none.",
    )


class IdeasDraft(BaseModel):
    brief_level: ContentLevel = Field(description="Level of the creator's own idea. A if no idea was given.")
    referral_message: str = Field(description="Only when brief_level is D: a short, kind message in the brief's language. Otherwise empty.")
    ideas: list[IdeaDraft] = Field(description="Exactly 3 ideas, or empty when brief_level is D.")


class SceneDraft(BaseModel):
    start_second: int
    end_second: int
    visual: str = Field(description="What the viewer sees: shot, framing, action, b-roll.")
    voiceover: str = Field(description="Exact words spoken. Empty string if none.")
    on_screen_text: str = Field(description="Text overlay. Empty string if none.")
    evidence_ids: list[str] = Field(description="Ids of the evidence this scene quotes, relies on, or introduces. Empty if none.")


class HadithExcerpt(BaseModel):
    evidence_id: str
    excerpt: str = Field(description="A verbatim run of the hadith's own words, copied from the evidence text.")


class AdaptationNote(BaseModel):
    change: str = Field(description="What was changed from the source script.")
    reason: str = Field(description="Why it suits the new audience.")


class ScriptDraft(BaseModel):
    title: str
    hook: str
    scenes: list[SceneDraft]
    call_to_action: str
    audio: str = Field(description="Background audio direction, without instrumental music.")
    hadith_excerpts: list[HadithExcerpt] = Field(description="One entry per hadith placeholder used. Empty if none.")
    review_note: str = Field(description="What a specialist should check before publishing. Empty if nothing.")
    posts: list[PlatformPost] = Field(description="One entry per target platform.")


class LocalizedDraft(ScriptDraft):
    adaptation_notes: list[AdaptationNote] = Field(description="Each significant change from the source and why.")


class Severity(str, Enum):
    blocking = "blocking"
    suggestion = "suggestion"


class FindingDraft(BaseModel):
    scene: int = Field(description="Scene number starting at 1, or 0 if it concerns the whole script.")
    severity: Severity
    issue: str
    fix: str = Field(description="The concrete correction.")


class FindingsDraft(BaseModel):
    findings: list[FindingDraft] = Field(description="Empty if nothing is wrong.")


class ClaimStatus(str, Enum):
    preserved = "preserved"
    altered = "altered"
    dropped = "dropped"
    added = "added"


class ClaimCheck(BaseModel):
    claim: str = Field(description="One religious claim, stated briefly.")
    status: ClaimStatus
    note: str = Field(description="For anything not preserved: what differs. Otherwise empty.")


class ClaimsDraft(BaseModel):
    claims: list[ClaimCheck]


# ---- Responses ----

class Idea(IdeaCore):
    id: str
    needs_specialist_review: bool
    evidence: list[Evidence] = Field(description="Texts verified in the sources. The script may only quote these.")
    unverified: list[str] = Field(description="Texts the AI wanted but that were not found in the sources, so they are not used.")


class Scene(SceneDraft):
    pass


class ReferenceUsage(str, Enum):
    quoted = "quoted"
    paraphrased = "paraphrased"


class Reference(BaseModel):
    evidence_id: str
    kind: EvidenceKind
    usage: ReferenceUsage
    text: str = Field(description="The source text as used in the script's language: the full text, or the quoted run of a hadith.")
    arabic: str = Field(description="The original Arabic text in full.")
    source: str
    translation_source: Optional[str] = Field(default=None, description="Set when `text` comes from an approved translation.")


class TermStatus(str, Enum):
    used = "used"
    missing = "missing"


class TermCheck(BaseModel):
    term_ar: str
    approved_en: str
    rule: str
    status: TermStatus = Field(description="Whether the localized script uses the approved equivalent of a term the source used.")


class Reviewer(str, Enum):
    scholarly = "scholarly"
    audience = "audience"
    meaning = "meaning"


class Finding(FindingDraft):
    reviewer: Reviewer


class ReviewReport(BaseModel):
    findings: list[Finding]
    claims: list[ClaimCheck] = Field(description="Localized scripts only: each religious claim of the source and what became of it.")
    blocking: int = Field(description="Number of issues to fix before publishing.")
    note: str = "مراجعة أولية آلية بالذكاء الاصطناعي، لا تغني عن مراجعة مختص قبل النشر."


AI_DISCLOSURE = "هذا المحتوى مولَّد بالذكاء الاصطناعي. النصوص الشرعية المقتبسة مأخوذة حرفيا من المصادر المذكورة، والباقي شرح مولَّد يحتاج مراجعة بشرية قبل النشر."


class Script(BaseModel):
    id: str
    idea_id: str
    version: int = 1
    localized_from: Optional[str] = Field(default=None, description="Id of the script this one adapts for another audience.")
    revised_from: Optional[str] = Field(default=None, description="Id of the script this one corrects.")
    target: AudienceSpec
    platforms: list[Platform]
    title: str
    duration_seconds: int
    hook: str
    scenes: list[Scene]
    call_to_action: str
    audio: str
    references: list[Reference] = Field(description="Every verified text the script uses, with its source.")
    content_level: ContentLevel
    needs_specialist_review: bool
    review_note: str
    warnings: list[str] = Field(description="Scenes that mention a religious text without linked evidence.")
    posts: list[PlatformPost]
    adaptation_notes: list[AdaptationNote] = Field(default_factory=list, description="Localized scripts only.")
    terminology: list[TermCheck] = Field(default_factory=list, description="Localized scripts only.")
    review: Optional[ReviewReport] = None
    approved: bool = Field(default=False, description="Set by the human reviewer. Required before export.")
    ai_disclosure: str = AI_DISCLOSURE
    # The model's draft with quote placeholders, kept for localization and revision.
    draft: Optional[ScriptDraft] = Field(default=None, exclude=True)


class Project(BaseModel):
    id: str
    brief: BriefIn
    ideas: list[Idea]
    scripts: dict[str, Script] = Field(default_factory=dict, description="Keyed by script id.")
