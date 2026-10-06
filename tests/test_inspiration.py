"""The optional source for the ideas: what is accepted, what the model is given, what is kept."""
import asyncio
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app import generator as g, inspiration, main, sources
from app.schemas import BriefIn, Evidence, EvidenceKind, Platform, QuranRequest, SourcedIdeaDraft, SourcedIdeasDraft, ContentLevel

FIXTURES = Path(__file__).parent / "fixtures"


# ---- the source layer fixes the round-two experiment uncovered ----

def test_short_famous_hadith_is_found():
    found = sources.search_hadith("من غش فليس مني")
    assert found and found[0].hadith_key.startswith("muslim:")
    assert sources.contains_run(found[0].text, "من غش فليس مني")


def test_short_search_needs_two_words():
    assert sources.search_hadith("غش") == []


def test_long_verse_range_is_taken_in_pieces_not_rejected():
    evidence, unverified = sources.build_evidence([QuranRequest(surah=83, ayah_start=1, ayah_end=6)], [])
    assert unverified == []
    assert [e.quran_key for e in evidence] == ["83:1-5", "83:6-6"]


# ---- YouTube links ----

@pytest.mark.parametrize("url", [
    "https://www.youtube.com/watch?v=9bf3L7IO3vE", "https://youtu.be/9bf3L7IO3vE", "youtube.com/watch?v=9bf3L7IO3vE&t=3s",
    "https://m.youtube.com/watch?v=9bf3L7IO3vE", "https://www.youtube.com/shorts/9bf3L7IO3vE",
])
def test_youtube_ids(url):
    assert inspiration.youtube_id(url) == "9bf3L7IO3vE"


def test_other_links_are_not_youtube():
    assert inspiration.youtube_id("https://vimeo.com/123") is None
    assert inspiration.youtube_id("https://www.youtube.com/@channel") is None


def test_long_video_is_refused(monkeypatch):
    async def meta(vid): return "محاضرة", 59 * 60
    monkeypatch.setattr(inspiration, "youtube_meta", meta)
    with pytest.raises(inspiration.SourceError, match="20 دقيقة"):
        asyncio.run(inspiration.resolve("https://youtu.be/c3mB1EcHuFA", None))


def test_short_video_becomes_a_file_part(monkeypatch):
    async def meta(vid): return "درس", 109
    monkeypatch.setattr(inspiration, "youtube_meta", meta)
    src = asyncio.run(inspiration.resolve("https://youtu.be/9bf3L7IO3vE", None))
    assert src.kind == "youtube" and src.label == "درس"
    assert src.part.file_data.file_uri == "https://www.youtube.com/watch?v=9bf3L7IO3vE"


def test_link_and_file_together_are_refused():
    with pytest.raises(inspiration.SourceError):
        asyncio.run(inspiration.resolve("https://youtu.be/9bf3L7IO3vE", "0123456789abcdef"))


# ---- uploads ----

def test_upload_is_read_once_then_discarded(tmp_path, monkeypatch):
    monkeypatch.setattr(inspiration, "UPLOADS", tmp_path)
    upload_id = inspiration.save_upload((FIXTURES / "khutba.pdf").read_bytes(), "application/pdf", "خطبة.pdf")
    src = asyncio.run(inspiration.resolve(None, upload_id))
    assert src.kind == "file" and src.label == "خطبة.pdf" and src.part.inline_data.mime_type == "application/pdf"
    inspiration.discard(src)
    assert list(tmp_path.iterdir()) == []
    with pytest.raises(inspiration.SourceError, match="انتهت"):
        asyncio.run(inspiration.resolve(None, upload_id))


def test_unsupported_or_big_uploads_are_refused(tmp_path, monkeypatch):
    monkeypatch.setattr(inspiration, "UPLOADS", tmp_path)
    with pytest.raises(inspiration.SourceError, match="غير مدعوم"):
        inspiration.save_upload(b"x", "application/zip", "a.zip")
    with pytest.raises(inspiration.SourceError, match="10 ميغابايت"):
        inspiration.save_upload(b"x" * (inspiration.MAX_UPLOAD_BYTES + 1), "image/png", "a.png")


def test_upload_endpoint(tmp_path, monkeypatch):
    monkeypatch.setattr(inspiration, "UPLOADS", tmp_path)
    c = TestClient(main.app)
    r = c.post("/uploads", files={"file": ("post.png", (FIXTURES / "post.png").read_bytes(), "image/png")})
    assert r.status_code == 201 and len(r.json()["id"]) == 16
    r = c.post("/uploads", files={"file": ("a.zip", b"x", "application/zip")})
    assert r.status_code == 400


def test_brief_with_a_bad_link_is_400_before_any_model_call(monkeypatch):
    called = []
    async def no_model(*a, **k): called.append(1)
    monkeypatch.setattr(g, "generate_ideas_from", no_model)
    c = TestClient(main.app)
    body = {"idea": None, "audience": "شباب", "language": "ar", "dialect": None, "audience_knowledge": "familiar",
            "tone": None, "platforms": ["tiktok"], "duration_seconds": 45, "source_url": "https://vimeo.com/1"}
    r = c.post("/projects", json=body)
    assert r.status_code == 400 and "يوتيوب" in r.json()["detail"] and called == []


# ---- what the ideas carry ----

def test_source_mentions_are_the_texts_no_evidence_covers(hadith_evidence):
    claims = ["لا يؤمن أحدكم حتى يحب لأخيه ما يحب لنفسه", "التاجر الصدوق الأمين مع النبيين والصديقين والشهداء"]
    out = g._source_mentions(claims, [hadith_evidence])
    assert out == ["التاجر الصدوق الأمين مع النبيين والصديقين والشهداء"]


def test_sourced_ideas_put_evidence_first_and_keep_the_locus(monkeypatch):
    def idea(title, locus, hadith):
        return SourcedIdeaDraft(title=title, hook="خ", concept="م", why_it_works="ل", duration_seconds=45, duration_reason="ق",
                                content_level=ContentLevel.A, level_reason="ع", quran_requests=[], hadith_queries=hadith,
                                source_locus=locus, source_claims=[])
    draft = SourcedIdeasDraft(brief_level=ContentLevel.A, referral_message="", source_summary="ملخص", ideas=[
        idea("بلا نص", "01:00", []), idea("بنص", "02:30", ["لا يؤمن أحدكم حتى يحب لأخيه ما يحب لنفسه"]), idea("بلا نص 2", "03:00", [])])
    seen = {}
    async def fake(system, prompt, output, role="generation", parts=()):
        seen["parts"] = parts; seen["system"] = system; return draft
    monkeypatch.setattr(g, "_generate", fake)
    brief = BriefIn(idea=None, audience="شباب", language="ar", dialect=None, audience_knowledge="familiar", tone=None,
                    platforms=[Platform.tiktok], duration_seconds=45)
    part = object()
    ideas, summary = asyncio.run(g.generate_ideas_from(brief, part))
    assert seen["parts"] == (part,) and "SOURCE" in seen["system"]
    assert summary == "ملخص"
    assert [i.title for i in ideas] == ["بنص", "بلا نص", "بلا نص 2"]
    assert [i.id for i in ideas] == ["1", "2", "3"]
    assert ideas[0].source_locus == "02:30" and ideas[0].evidence[0].hadith_key == "bukhari:13"


def test_without_a_source_nothing_changes(monkeypatch):
    from app.schemas import IdeaDraft, IdeasDraft
    draft = IdeasDraft(brief_level=ContentLevel.A, referral_message="", ideas=[
        IdeaDraft(title=f"ف{i}", hook="خ", concept="م", why_it_works="ل", duration_seconds=45, duration_reason="ق",
                  content_level=ContentLevel.A, level_reason="ع", quran_requests=[], hadith_queries=[]) for i in range(3)])
    async def fake(system, prompt, output, role="generation", parts=()):
        assert parts == () and "SOURCE" not in system; return draft
    monkeypatch.setattr(g, "_generate", fake)
    brief = BriefIn(idea="الصدق", audience="شباب", language="ar", dialect=None, audience_knowledge="familiar", tone=None,
                    platforms=[Platform.tiktok], duration_seconds=45)
    ideas = asyncio.run(g.generate_ideas(brief))
    assert [i.source_locus for i in ideas] == ["", "", ""] and all(i.source_mentions == [] for i in ideas)
