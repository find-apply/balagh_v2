from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, computed_field

from ..schemas import Language, QuranRequest, Reference


class AgeBand(str, Enum):
    young = "4-6"
    middle = "7-9"
    older = "10-12"


class GuardianRole(str, Enum):
    educator = "educator"
    parent = "parent"


# ---- Requests ----

class CharacterIn(BaseModel):
    name: str = Field(min_length=1, max_length=40)
    trait: str = Field(min_length=2, max_length=120, description="Who they are and what they are like.")


class StoryIn(BaseModel):
    topic: Optional[str] = Field(
        default=None, min_length=3, max_length=500, examples=["الصدق"],
        description="Leave null to let the AI pick a topic suited to the age.",
    )
    age_band: AgeBand
    language: Language
    dialect: Optional[str] = Field(default=None, max_length=60)
    characters: Optional[list[CharacterIn]] = Field(
        default=None, max_length=4,
        description="Recurring characters to use. Leave null to let the AI create them.",
    )
    duration_seconds: Optional[int] = Field(default=None, ge=60, le=600, description="Leave null for a length suited to the age.")


class ApproveIn(BaseModel):
    role: GuardianRole
    name: str = Field(min_length=2, max_length=80)


# ---- Model output ----

class Character(BaseModel):
    name: str
    age: str = Field(description="Age, or role such as grandfather.")
    trait: str
    catchphrase: str = Field(description="A short phrase this character tends to say. Empty if none.")


class PlanDraft(BaseModel):
    suitable: bool = Field(description="False if the topic is not suitable for a children's story.")
    unsuitable_message: str = Field(description="Only when unsuitable: a short message to the creator, with a suitable angle if one exists.")
    title: str
    moral: str = Field(description="The one thing the child should take away, in one simple sentence.")
    synopsis: str = Field(description="3-4 sentences: the everyday problem, what the child character does, how it resolves.")
    characters: list[Character]
    quran_requests: list[QuranRequest] = Field(description="At most one short verse the story would rely on. Empty if none.")
    hadith_queries: list[str] = Field(description="At most one short hadith, as a distinctive run of its Arabic wording. Empty if none.")


class Line(BaseModel):
    speaker: str
    line: str


class StoryScene(BaseModel):
    start_second: int
    end_second: int
    setting: str = Field(description="Where we are and what we see, for the illustrator or animator.")
    narration: str = Field(description="The narrator's words. Empty string if none.")
    dialogue: list[Line]
    evidence_ids: list[str] = Field(description="Ids of the evidence this scene quotes, relies on, or introduces. Empty if none.")


class HadithExcerpt(BaseModel):
    evidence_id: str
    excerpt: str


class Teaser(BaseModel):
    """A 20-30 second announcement addressed to parents, for short-video platforms."""
    hook: str
    voiceover: str
    caption: str


class StoryDraft(BaseModel):
    scenes: list[StoryScene]
    hadith_excerpts: list[HadithExcerpt] = Field(description="One entry per hadith placeholder used. Empty if none.")
    closing_question: str = Field(description="A question the parent can ask the child after watching.")
    parent_note: str = Field(description="For the parent or educator: what the story teaches and how to follow it up.")
    teaser: Teaser


# ---- Responses ----

class Approval(BaseModel):
    role: GuardianRole
    name: str
    at: datetime


class Story(BaseModel):
    id: str
    request: StoryIn
    duration_seconds: int
    title: str
    moral: str
    characters: list[Character]
    scenes: list[StoryScene]
    closing_question: str
    parent_note: str
    teaser: Teaser
    references: list[Reference]
    unverified: list[str] = Field(description="Texts the AI wanted but that were not found in the sources, so they are not used.")
    warnings: list[str] = Field(description="Automatic checks that need the guardian's attention.")
    approval: Optional[Approval] = None
    notice: str = (
        "تجريبي. هذه القصة مولَّدة بالذكاء الاصطناعي ولم يراجعها مربٍّ بعد. النصوص الشرعية المقتبسة مأخوذة حرفيا "
        "من مصادرها، وكل ما عداها يحتاج مراجعة مربٍّ أو ولي أمر قبل عرضها على طفل."
    )

    @computed_field(description="True once an educator or parent has signed off. Required before export.")
    @property
    def approved(self) -> bool:
        return self.approval is not None
