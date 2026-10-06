"""The video spec: a quoted text is recited from a recording or shown in silence, never synthesized."""
import asyncio
from pathlib import Path

import pytest

from app.video import media, recitation, spec
from tests.conftest import make_scene, make_script, quoted_ref


def test_quoted_reference_matches_without_ayah_marks(quran_evidence):
    ref = quoted_ref(quran_evidence)
    plain = "«فَإِنَّ مَعَ ٱلۡعُسۡرِ يُسۡرًا إِنَّ مَعَ ٱلۡعُسۡرِ يُسۡرٗا»"
    assert spec.quoted_reference(plain, [ref]) is ref


def test_quoted_reference_matches_a_sub_range(quran_evidence):
    ref = quoted_ref(quran_evidence)
    one_verse = "«" + list(__import__("app.sources", fromlist=["x"]).verse_parts("94:5-6", "ar").values())[0] + "»"
    assert spec.quoted_reference(one_verse, [ref]) is ref


def test_quoted_reference_rejects_other_text(quran_evidence):
    assert spec.quoted_reference("«كلام ليس من المرجع»", [quoted_ref(quran_evidence)]) is None


def test_quoted_ayahs_follow_the_scene_text(quran_evidence):
    ref = quoted_ref(quran_evidence)
    assert recitation.quoted_ayahs(ref) == ["94:5", "94:6"]
    assert recitation.quoted_ayahs(ref, "فإن مع العسر يسرا") == ["94:5"]


@pytest.fixture
def no_network(monkeypatch, tmp_path):
    """Stands in for the paid or networked media: records what was asked for."""
    calls = {"speak": [], "recite": []}

    async def speak(text, who="narr"):
        calls["speak"].append(text)
        p = tmp_path / f"s{len(calls['speak'])}.mp3"; p.write_bytes(b"x")
        return media.Clip(p, 1.0, new=False)

    async def quran_recording(ref, quoted_text=None):
        calls["recite"].append(quoted_text)
        p = tmp_path / "q.mp3"; p.write_bytes(b"x")
        return media.Clip(p, 3.0, new=False)

    monkeypatch.setattr(media, "speak", speak)
    monkeypatch.setattr(recitation, "quran_recording", quran_recording)
    monkeypatch.setattr(spec.Build, "take", lambda self, clip, ext: clip.path.name)
    return calls


def test_captions_recite_the_quote_and_speak_only_the_explanation(quran_evidence, no_network):
    ref = quoted_ref(quran_evidence)
    plain = "فَإِنَّ مَعَ ٱلۡعُسۡرِ يُسۡرًا إِنَّ مَعَ ٱلۡعُسۡرِ يُسۡرٗا"
    script = make_script([make_scene(0, 10, f"تأمل هذا الوعد: «{plain}»", ["Q1"])], [ref])
    build = spec.Build(public=Path("/tmp"))
    props = asyncio.run(spec.build_captions(script, {"uses_images": False}, build))
    assert no_network["speak"] == ["تأمل هذا الوعد:"]
    assert len(no_network["recite"]) == 1
    assert len(props["audio"]) == 2 and build.notes == []


def test_a_quote_that_matches_nothing_is_never_spoken(quran_evidence, no_network):
    script = make_script([make_scene(0, 10, "قال: «نص غريب لا يطابق المرجع أبدا»", ["Q1"])], [quoted_ref(quran_evidence)])
    build = spec.Build(public=Path("/tmp"))
    props = asyncio.run(spec.build_captions(script, {"uses_images": False}, build))
    assert no_network["speak"] == ["قال:"]
    assert no_network["recite"] == []
    assert any("لم يُطابق" in n for n in build.notes)
    assert any(c.get("sub") for c in props["cues"])   # the viewer is told the silence is deliberate


def test_hadith_without_recording_is_silent_with_a_note(hadith_evidence, no_network, monkeypatch):
    monkeypatch.setattr(recitation, "hadith_recording", lambda ref: None)
    ref = quoted_ref(hadith_evidence, "لا يؤمن أحدكم حتى يحب لأخيه ما يحب لنفسه")
    script = make_script([make_scene(0, 10, "قال النبي ﷺ: «لا يؤمن أحدكم حتى يحب لأخيه ما يحب لنفسه»", ["H1"])], [ref])
    build = spec.Build(public=Path("/tmp"))
    props = asyncio.run(spec.build_captions(script, {"uses_images": False}, build))
    assert no_network["speak"] == ["قال النبي ﷺ:"]
    assert any("لا يوجد تسجيل" in n for n in build.notes)
    assert len(props["audio"]) == 1
