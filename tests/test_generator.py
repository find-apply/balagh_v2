"""Assembling a script from the model's draft: placeholders become verified text, or the draft is rejected."""
import pytest

from app import generator as g
from app.schemas import HadithExcerpt, Language, Platform, PlatformPost, SceneDraft, ScriptDraft
from tests.conftest import art, make_idea


def draft(scenes: list[SceneDraft], excerpts: list[HadithExcerpt] = ()) -> ScriptDraft:
    return ScriptDraft(title="ع", hook="خ", scenes=scenes, call_to_action="شارك", audio="بلا موسيقى",
                       hadith_excerpts=list(excerpts), review_note="", historical_claims=[],
                       posts=[PlatformPost(platform=Platform.tiktok, caption="م", hashtags=["#x"])])


def scene(voiceover: str, ids: list[str] = (), start: int = 0, end: int = 10) -> SceneDraft:
    return SceneDraft(start_second=start, end_second=end, visual="لقطة", art=art(), voiceover=voiceover,
                      on_screen_text="", evidence_ids=list(ids))


def test_quran_placeholder_inserts_the_source_text(quran_evidence):
    out = g._finalize(draft([scene("قال الله: {{Q1}}", ["Q1"])]), make_idea([quran_evidence]), Language.ar)
    vo = out["scenes"][0].voiceover
    assert vo.startswith("قال الله: «") and vo.endswith("»")
    assert quran_evidence.text in vo
    ref = out["references"][0]
    assert ref.usage.value == "quoted" and ref.source == quran_evidence.source


def test_quran_sub_range_quotes_only_those_verses(quran_evidence):
    out = g._finalize(draft([scene("{{Q1:5}}", ["Q1"])]), make_idea([quran_evidence]), Language.ar)
    vo = out["scenes"][0].voiceover
    assert "۝" not in vo  # a single verse carries no ayah separator
    assert len(vo) < len(quran_evidence.text)


def test_quran_sub_range_outside_the_evidence_is_rejected(quran_evidence):
    with pytest.raises(ValueError):
        g._finalize(draft([scene("{{Q1:9}}", ["Q1"])]), make_idea([quran_evidence]), Language.ar)


def test_quran_relied_on_but_paraphrased_is_rejected(quran_evidence):
    with pytest.raises(ValueError, match="never quoted"):
        g._finalize(draft([scene("الله يقول إن مع العسر يسرا", ["Q1"])]), make_idea([quran_evidence]), Language.ar)


def test_unknown_placeholder_is_rejected(quran_evidence):
    with pytest.raises(ValueError):
        g._finalize(draft([scene("{{H9}}", [])]), make_idea([quran_evidence]), Language.ar)


def test_hadith_needs_a_verbatim_excerpt(hadith_evidence):
    wrong = HadithExcerpt(evidence_id="H1", excerpt="لا يؤمن أحدكم حتى يحب لأخيه ما يكره لنفسه")
    with pytest.raises(ValueError, match="verbatim"):
        g._finalize(draft([scene("{{H1}}", ["H1"])], [wrong]), make_idea([hadith_evidence]), Language.ar)


def test_hadith_excerpt_is_inserted_and_labelled_as_a_part(hadith_evidence):
    ok = HadithExcerpt(evidence_id="H1", excerpt="لا يؤمن أحدكم حتى يحب لأخيه ما يحب لنفسه")
    out = g._finalize(draft([scene("قال النبي ﷺ: {{H1}}", ["H1"])], [ok]), make_idea([hadith_evidence]), Language.ar)
    ref = out["references"][0]
    assert "جزء من الحديث" in ref.source           # the matn alone is shorter than the hadith with its chain
    assert ref.arabic == hadith_evidence.text        # the full text stays available to the reviewer
    assert "«" in out["scenes"][0].voiceover


def test_attribution_without_evidence_is_flagged(quran_evidence):
    out = g._finalize(draft([scene("قال النبي ﷺ إن الصدق منجاة", [])]), make_idea([quran_evidence]), Language.ar)
    assert out["warnings"]


def test_defining_a_word_is_not_an_attribution(quran_evidence):
    out = g._finalize(draft([scene("الإسلام يعلمنا الصدق", [])]), make_idea([quran_evidence]), Language.ar)
    assert out["warnings"] == []


def test_english_script_quotes_the_approved_translation(quran_evidence):
    out = g._finalize(draft([scene("Allah says: {{Q1}}", ["Q1"])]), make_idea([quran_evidence]), Language.en)
    assert quran_evidence.translation_en in out["scenes"][0].voiceover
    assert out["references"][0].translation_source


def test_frame_follows_the_platform():
    assert g.frame_of([Platform.tiktok]) == "9:16"
    assert g.frame_of([Platform.youtube]) == "16:9"
    assert g.frame_of([Platform.youtube, Platform.tiktok]) == "9:16"
    assert g.frame_of([]) == "9:16"


def test_children_audience_detection():
    assert g.is_children("أطفال من 6 إلى 10 سنوات مع أهلهم")
    assert not g.is_children("شباب مسلمون (18-30)")


def test_a_scene_that_explains_a_text_names_its_passage_in_the_commentary(quran_evidence):
    quran_evidence.tafsir = [type(quran_evidence).model_fields["tafsir"].annotation.__args__[0](text="أي أن مع كل شدة فرجا قريبا، وهذا وعد من الله لعباده", source="تفسير الميسر، الشرح 5-6")]
    good = scene("الله يقول {{Q1}}. يعني أن مع كل شدة فرجا قريبا", ["Q1"])
    good.grounding = "مع كل شدة فرجا قريبا"
    out = g._finalize(draft([good]), make_idea([quran_evidence]), Language.ar)
    assert out["scenes"][0].grounded is True and not out["warnings"]

    made_up = scene("الله يقول {{Q1}}. يعني أن الصبر يفتح أبواب الرزق", ["Q1"])
    made_up.grounding = "الصبر يفتح أبواب الرزق"
    out = g._finalize(draft([made_up]), make_idea([quran_evidence]), Language.ar)
    assert out["scenes"][0].grounded is False and any("لم يوجد" in w for w in out["warnings"])

    silent = scene("الله يقول {{Q1}}. ومعنى ذلك أن الفرج قريب", ["Q1"])
    out = g._finalize(draft([silent]), make_idea([quran_evidence]), Language.ar)
    assert out["scenes"][0].grounded is False and any("دون أن يسند" in w for w in out["warnings"])
