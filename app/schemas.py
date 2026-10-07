from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, computed_field, field_validator


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


class AuthorRole(str, Enum):
    """Who is making the content. It decides who must sign a version: a religious specialist reviews their own
    content, an ordinary creator's content goes to a specialist. The role is declared, not verified."""
    creator = "creator"        # an ordinary content creator
    specialist = "specialist"  # a qualified religious specialist: a shaykh, a student of knowledge


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
    author: AuthorRole = Field(
        default=AuthorRole.creator,
        description="Who is making the content. A specialist approves their own versions; a creator's versions need a specialist's signature.",
    )
    idea: Optional[str] = Field(
        default=None, min_length=3, max_length=2000, examples=["فضل صلاة الفجر"],
        description="Leave null to let the AI pick the topics itself.",
    )
    source_url: Optional[str] = Field(
        default=None, max_length=300, examples=["https://www.youtube.com/watch?v=9bf3L7IO3vE"],
        description="Optional: a public YouTube video (up to 20 minutes) the ideas take their angles from. "
                    "The model reads it; every religious text is still verified against the sources.",
    )
    source_file: Optional[str] = Field(
        default=None, max_length=40,
        description="Optional: the id returned by POST /uploads for a PDF, image or text file to take the angles from.",
    )
    platforms: list[Platform] = Field(min_length=1)
    duration_seconds: Optional[int] = Field(
        default=None, ge=5, le=600,
        description="Leave null to let the AI suggest a duration for each idea.",
    )


class ScriptIn(BaseModel):
    template: Optional[str] = Field(
        default=None, max_length=40, examples=["captions"],
        description="Video template the script is written for (GET /video/templates). Leave null to choose later.",
    )
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


class ReviewRole(str, Enum):
    creator = "creator"    # the content creator
    scholar = "scholar"    # a qualified religious reviewer
    language = "language"  # a native speaker of the target language and culture


class ApproveIn(BaseModel):
    role: ReviewRole
    name: str = Field(min_length=2, max_length=80, description="Who is approving, in their own name.")
    note: Optional[str] = Field(default=None, max_length=1000, description="Optional remark recorded with the signature.")


class ReviseIn(BaseModel):
    notes: Optional[str] = Field(default=None, max_length=1000, description="Extra corrections from the human reviewer.")


# ---- Shared ----

class EvidenceKind(str, Enum):
    quran = "quran"
    hadith = "hadith"


class Tafsir(BaseModel):
    """An approved commentary on a verse range. Grounds the explanation; never quoted as scripture."""
    text: str
    source: str = Field(description="The tafsir's name and the verses this entry comments on.")


class Sharh(BaseModel):
    """An approved explanation of a hadith. Grounds the explanation; never quoted as the hadith."""
    text: str
    grade: str = Field(description="The grading the encyclopedia gives this hadith.")
    attribution: str = Field(description="Who narrated it, as the encyclopedia states.")
    source: str = Field(description="The encyclopedia and its entry, for the reviewer to check.")


class Evidence(BaseModel):
    """A text found in the verified sources. Only these may be quoted or attributed."""
    id: str
    kind: EvidenceKind
    text: str
    source: str
    translation_en: Optional[str] = None
    translation_source: Optional[str] = None
    quran_key: Optional[str] = Field(default=None, description="Quran only: surah:first-last ayah, e.g. 112:1-4.")
    hadith_key: Optional[str] = Field(default=None, description="Hadith only: collection:number, e.g. bukhari:13.")
    tafsir: list[Tafsir] = Field(default_factory=list, description="Quran only: approved commentary on these verses.")
    sharh: Optional[Sharh] = Field(default=None, description="Hadith only: approved explanation, when one was matched.")


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


class ArtKind(str, Enum):
    """What the animated video template draws for a scene. Mirrors art_kinds in video/catalog.json."""
    word = "word"
    meter_down = "meter_down"
    meter_up = "meter_up"
    compare = "compare"
    medallions = "medallions"
    lock = "lock"
    warning = "warning"
    dua = "dua"
    storm = "storm"
    door = "door"
    verse = "verse"
    phones = "phones"
    image = "image"


class SceneArt(BaseModel):
    kind: ArtKind
    keyword: str = Field(description="1-3 words in the script's language, shown large. Never a verse or hadith.")
    detail: str = Field(description="1-3 more words where the kind uses them. Empty string otherwise.")
    emoji: str = Field(description="One emoji where the kind uses one. Empty string otherwise.")
    image_prompt: str = Field(description="Only for kind image: an English description of a still photo. Empty string otherwise.")


DEFAULT_ART = SceneArt(kind=ArtKind.word, keyword="", detail="", emoji="", image_prompt="")


class SceneDraft(BaseModel):
    start_second: int
    end_second: int
    visual: str = Field(description="What the viewer sees: shot, framing, action, b-roll.")
    art: SceneArt = Field(description="What the animated video template draws for this scene.")
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
    historical_claims: list[str] = Field(default_factory=list, description="Every fact of seerah, history or biography the script states that is not in the evidence list, one per entry, as stated. The system cannot verify these, so the human reviewer checks them. Empty if none.")
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

class SourcedIdeaDraft(IdeaDraft):
    """An idea drawn from an attached source (a video, a document or an image)."""
    source_locus: str = Field(description="Where in the source this angle comes from: a timestamp mm:ss for a video, a page or heading for a document, 'the image' for an image. Empty if not from the source.")
    source_claims: list[str] = Field(description="Every religious text the SOURCE itself cites that this idea leans on, as the source words it, one per entry. Empty if none.")


class SourcedIdeasDraft(IdeasDraft):
    ideas: list[SourcedIdeaDraft] = Field(description="Exactly 3 ideas, or empty when brief_level is D.")
    source_summary: str = Field(description="Two sentences in the brief's language: what the source is about and which religious texts it cites.")


class Idea(IdeaCore):
    id: str
    needs_specialist_review: bool
    evidence: list[Evidence] = Field(description="Texts verified in the sources. The script may only quote these.")
    unverified: list[str] = Field(description="Texts the AI wanted but that were not found in the sources, so they are not used.")
    source_locus: str = Field(default="", description="For ideas drawn from an attached source: where in it (about a minute, a page, a heading).")
    source_mentions: list[str] = Field(default_factory=list, description="Texts the source cites that are outside the verified sources (not the two Sahihs or the Quran); shown, never used.")


class SourceInfo(BaseModel):
    """What the ideas were inspired by, kept with the project for the record."""
    kind: str = Field(examples=["youtube", "file"])
    label: str = Field(description="The video title or the file name.")
    url: Optional[str] = None
    summary: str = Field(default="", description="The model's two-sentence summary of the source.")


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
    quran_key: Optional[str] = None
    hadith_key: Optional[str] = None
    tafsir: list[Tafsir] = Field(default_factory=list, description="The approved commentary the explanation had to follow. For the reviewer to check against.")
    sharh: Optional[Sharh] = Field(default=None, description="Hadith only: the approved explanation the script had to follow.")


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


class Approval(BaseModel):
    role: ReviewRole
    name: str
    at: datetime
    note: str = Field(default="", description="What the reviewer wanted noted when signing. Empty if nothing.")


class ChangeRequest(BaseModel):
    """A reviewer declined to sign this version and said what must change. It closes that role's approval
    on this version: the fix goes into a new version, which the reviewer looks at again."""
    role: ReviewRole
    name: str
    note: str
    at: datetime


class ChangeRequestIn(BaseModel):
    role: ReviewRole
    name: str = Field(min_length=2, max_length=80)
    note: str = Field(min_length=3, max_length=2000, description="What must change before this reviewer signs.")


class RequiredApproval(BaseModel):
    role: ReviewRole
    reason: str


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
    author: AuthorRole = Field(default=AuthorRole.creator, description="Who made this content, from the brief.")
    needs_specialist_review: bool
    review_note: str
    warnings: list[str] = Field(description="Scenes that mention a religious text without linked evidence.")
    unverified_claims: list[str] = Field(default_factory=list, description="Facts of seerah or history the script states that no verified source backs; for the human reviewer to check.")
    posts: list[PlatformPost]
    adaptation_notes: list[AdaptationNote] = Field(default_factory=list, description="Localized scripts only.")
    terminology: list[TermCheck] = Field(default_factory=list, description="Localized scripts only.")
    review: Optional[ReviewReport] = None
    approvals: list[Approval] = Field(default_factory=list, description="Human sign-offs on this exact version.")
    change_requests: list[ChangeRequest] = Field(default_factory=list, description="Reviewers who declined this version and what they asked for.")
    must_recheck: list[ReviewRole] = Field(default_factory=list, description="Roles that asked for changes on a version this one corrects: they sign this one too, whoever wrote it.")
    template: Optional[str] = Field(default=None, description="Video template chosen for this script.")
    story: Optional["Story"] = Field(default=None, description="Dialogue story, written when a children's template is chosen.")
    ai_disclosure: str = AI_DISCLOSURE
    # The model's draft with quote placeholders, kept for localization and revision.
    draft: Optional[ScriptDraft] = Field(default=None, exclude=True)


    @computed_field(description="Who must sign off before export. It depends on who made the content: a specialist "
                                "approves their own versions, a creator's versions also need a religious specialist.")
    @property
    def required_approvals(self) -> list[RequiredApproval]:
        if self.author == AuthorRole.specialist:
            required = [RequiredApproval(role=ReviewRole.creator, reason="مختص شرعي: يراجع محتواه بنفسه ويعتمده. المراجعة الآلية تنبّهه ولا تلزمه.")]
        else:
            required = [RequiredApproval(role=ReviewRole.creator, reason="صاحب المحتوى يعتمد كل نسخة قبل تصديرها.")]
            if self.content_level == ContentLevel.C:
                why = "مسألة خلافية أو عالية الحساسية (المستوى ج)."
            elif self.review and self.review.blocking:
                why = "في المراجعة الآلية ملاحظات مانعة لم تُصحَّح."
            elif self.warnings:
                why = "تنبيه آلي: مشهد يذكر نصا شرعيا دون دليل موثق مرتبط به."
            else:
                why = "الشرح مولَّد، والنصوص الشرعية وحدها هي المضمونة بالنظام."
            required.append(RequiredApproval(role=ReviewRole.scholar, reason=f"صانع المحتوى ليس مختصا: كل نسخة يراجعها مختص شرعي قبل النشر. {why}"))
        if self.localized_from:
            required.append(RequiredApproval(
                role=ReviewRole.language,
                reason="نسخة موطّنة: الملاءمة اللغوية والثقافية لا تُفحص آليا.",
            ))
        for role in self.must_recheck:
            if all(r.role != role for r in required):
                required.append(RequiredApproval(role=role, reason="طلب تعديلا على نسخة سابقة، فيراجع التصحيح بنفسه."))
        return required

    @computed_field(description="True once every required role has signed off. Required before export.")
    @property
    def approved(self) -> bool:
        if self.change_requests:
            return False
        signed = {a.role for a in self.approvals}
        return all(r.role in signed for r in self.required_approvals)


class Project(BaseModel):
    id: str
    brief: BriefIn
    ideas: list[Idea]
    source: Optional[SourceInfo] = Field(default=None, description="The optional source the ideas were drawn from.")
    scripts: dict[str, Script] = Field(default_factory=dict, description="Keyed by script id.")


# ---- Video ----

class VideoTemplate(BaseModel):
    """One entry of the template library in video/catalog.json."""
    id: str
    name: str
    description: str
    aspect: str = Field(examples=["9:16"])
    uses_images: bool = Field(description="Whether scenes may use generated still photos.")
    story: bool = Field(description="True for templates that play a children's dialogue story written from the script.")
    ready: bool = Field(description="False while the template cannot be chosen yet.")
    typical_seconds: Optional[float] = Field(
        default=None, description="Median wall time of this template's recent renders, for the waiting screen; null until one finished.")


# ---- Story (children's templates) ----

class StorySceneKind(str, Enum):
    story = "story"      # characters talk over an illustrated scene
    text = "text"        # the verified verse or hadith, shown alone
    words = "words"      # word cards explaining terms of the text
    quiz = "quiz"        # one question with two choices
    outro = "outro"      # the lesson in one line


class Line(BaseModel):
    who: str = Field(description="Character key: narr, salim, maryam or nour.")
    text: str = Field(description="What the character says, in the script's language. One short sentence or two.")


class WordCard(BaseModel):
    word: str = Field(description="A word from the quoted text, copied as it appears there.")
    meaning: str = Field(description="Its meaning in a few simple words.")


class StorySceneDraft(BaseModel):
    kind: StorySceneKind
    lines: list[Line] = Field(description="Spoken lines. Empty for kind text.")
    image_prompt: str = Field(description="Kinds story and outro: an English description of the illustration. Empty otherwise.")
    present: list[str] = Field(description="Kinds story and outro: keys of the characters drawn in the illustration (salim, maryam, nour), in the order they are described. Empty otherwise.")
    evidence_id: str = Field(description="Kind text only: the id of the quoted reference to show. Empty otherwise.")
    cards: list[WordCard] = Field(description="Kind words only: 2 cards. Empty otherwise.")
    question: str = Field(description="Kind quiz only. Empty otherwise.")
    choices: list[str] = Field(description="Kind quiz only: exactly 2 short choices, the right one first. Empty otherwise.")


class StoryDraft(BaseModel):
    title: str
    scenes: list[StorySceneDraft]
    review_note: str = Field(description="What an educator should check before publishing. Empty if nothing.")


class StoryScene(StorySceneDraft):
    quote: str = Field(default="", description="Kind text: the verified text, inserted by the system.")
    source: str = Field(default="", description="Kind text: where the quote comes from.")
    quote_kind: Optional[EvidenceKind] = Field(default=None, description="Kind text: quran or hadith.")


class Story(BaseModel):
    """A dialogue story for the children's templates, written from an approved-or-not script. Its lines are
    generated, so the script's approvals are reset when it is (re)written."""
    title: str
    scenes: list[StoryScene]
    review_note: str
    ai_disclosure: str = AI_DISCLOSURE


class StoryIn(BaseModel):
    notes: Optional[str] = Field(default=None, max_length=1000, description="What the creator wants different this time.")


class TemplateIn(BaseModel):
    template: str = Field(max_length=40, examples=["captions"], description="A ready template from GET /video/templates.")


class VideoIn(BaseModel):
    template: str = Field(max_length=40, examples=["captions"])


class VideoStatus(str, Enum):
    queued = "queued"
    voicing = "voicing"      # generating speech and recitation
    imaging = "imaging"      # generating images
    rendering = "rendering"
    done = "done"
    failed = "failed"


class VideoCheck(BaseModel):
    """One automatic check on a finished video: loudness, unintended silence, black frames, length."""
    name: str = Field(examples=["loudness", "silence", "black", "length"])
    ok: bool
    detail: str


class Video(BaseModel):
    id: str
    project_id: str
    script_id: str
    template: str
    preview: bool = Field(default=False, description="Rendered before approval, with a watermark; the final video has none.")
    status: VideoStatus = VideoStatus.queued
    url: Optional[str] = Field(default=None, description="Path of the MP4 under the API, once done.")
    error: Optional[str] = None
    duration_seconds: Optional[float] = None
    new_images: int = Field(default=0, description="Images generated (and paid for) for this video.")
    new_clips: int = Field(default=0, description="Speech clips synthesized (and paid for) for this video.")
    notes: list[str] = Field(default_factory=list, description="What the render could not do as intended, e.g. a hadith shown without a recording.")
    created_at: datetime
    render_seconds: Optional[float] = Field(default=None, description="Wall time of the job once it ended, minus any wait for a free render slot.")
    checks: list[VideoCheck] = Field(default_factory=list, description="Automatic quality checks run on the finished file.")
    loudness_lufs: Optional[float] = Field(default=None, description="Integrated loudness of the final file.")
    frames: list[str] = Field(default_factory=list, description="Paths of a few stills under the API, for a glance.")


Script.model_rebuild()

class HistoryEntry(BaseModel):
    """One row of a client's generation history."""
    id: str
    title: str
    audience: str
    language: Language
    at: datetime
    scripts: int
    approved: int
    shared: bool = Field(description="Opened from someone else's review link rather than created by this client.")
