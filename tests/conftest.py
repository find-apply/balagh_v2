"""Tests run without a model and without the production database: the environment is set before any
app module is imported, because the store opens its database at import time."""
import os
import tempfile
from datetime import datetime, timezone

os.environ.setdefault("REELS_PLAIN", "1")
os.environ.setdefault("GEMINI_API_KEY", "test-key-not-used")
os.environ.setdefault("MAGNIFIC_API_KEY", "test-key-not-used")
os.environ["DATABASE_URL"] = f"sqlite:///{tempfile.mkdtemp()}/test.db"
os.environ.pop("ADMIN_TOKEN", None)

import pytest  # noqa: E402

from app import sources  # noqa: E402
from app.schemas import (  # noqa: E402
    AudienceSpec, BriefIn, ContentLevel, Evidence, EvidenceKind, Idea, Platform, PlatformPost, Project,
    Reference, ReferenceUsage, Scene, SceneArt, ArtKind, Script,
)


def art() -> SceneArt:
    return SceneArt(kind=ArtKind.word, keyword="كلمة", detail="", emoji="", image_prompt="")


@pytest.fixture(scope="session")
def quran_evidence() -> Evidence:
    """Surah 94, verses 5-6: two short verses, so a scene can quote one or both."""
    e = sources.get_verses(94, 5, 6)
    assert e is not None
    return e.model_copy(update={"id": "Q1"})


@pytest.fixture(scope="session")
def hadith_evidence() -> Evidence:
    """Bukhari 13: «لا يؤمن أحدكم حتى يحب لأخيه ما يحب لنفسه»."""
    found = sources.search_hadith("لا يؤمن أحدكم حتى يحب لأخيه ما يحب لنفسه")
    assert found, "the hadith index should find Bukhari 13"
    e = next((x for x in found if x.hadith_key == "bukhari:13"), found[0])
    return e.model_copy(update={"id": "H1"})


def make_idea(evidence: list[Evidence], unverified: list[str] = ()) -> Idea:
    return Idea(
        id="idea1", title="فكرة", hook="خطاف", concept="مفهوم", why_it_works="لأن", duration_seconds=30,
        duration_reason="قصير", content_level=ContentLevel.A, level_reason="عام", needs_specialist_review=False,
        evidence=evidence, unverified=list(unverified),
    )


def make_scene(start: int, end: int, voiceover: str, ids: list[str] = (), screen: str = "") -> Scene:
    return Scene(start_second=start, end_second=end, visual="لقطة", art=art(), voiceover=voiceover,
                 on_screen_text=screen, evidence_ids=list(ids))


def make_script(scenes: list[Scene], references: list[Reference], *, level: ContentLevel = ContentLevel.A,
                warnings: list[str] = (), script_id: str = "s1", platforms: list[Platform] = (Platform.tiktok,),
                dialect: str | None = None) -> Script:
    return Script(
        id=script_id, idea_id="idea1", target=AudienceSpec(audience="شباب", language="ar", dialect=dialect,
                                                           audience_knowledge="familiar", tone=None),
        platforms=list(platforms), title="عنوان", duration_seconds=30, hook="خطاف", scenes=scenes,
        call_to_action="شارك", audio="بلا موسيقى", references=references, content_level=level,
        needs_specialist_review=False, review_note="", warnings=list(warnings),
        posts=[PlatformPost(platform=Platform.tiktok, caption="منشور", hashtags=["#بلاغ"])],
    )


def quoted_ref(e: Evidence, text: str | None = None) -> Reference:
    return Reference(evidence_id=e.id, kind=e.kind, usage=ReferenceUsage.quoted, text=text or e.text,
                     arabic=e.text, source=e.source, quran_key=e.quran_key, hadith_key=e.hadith_key)


def make_project(script: Script, evidence: list[Evidence]) -> Project:
    brief = BriefIn(idea="الصدق", audience="شباب", language="ar", dialect=None, audience_knowledge="familiar",
                    tone=None, platforms=[Platform.tiktok], duration_seconds=30)
    return Project(id="p1", brief=brief, ideas=[make_idea(evidence)], scripts={script.id: script})


NOW = datetime.now(timezone.utc)
