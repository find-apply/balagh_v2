"""The local source layer: the only place religious text comes from."""
from app import sources
from app.schemas import Language


def test_normalize_drops_diacritics_and_ayah_marks():
    a = "فَإِنَّ مَعَ ٱلۡعُسۡرِ يُسۡرًا ۝ إِنَّ مَعَ ٱلۡعُسۡرِ يُسۡرٗا"
    b = "فإن مع العسر يسرا إن مع العسر يسرا"
    assert sources.normalize(a) == sources.normalize(b)


def test_verse_lookup_and_parts(quran_evidence):
    assert quran_evidence.quran_key == "94:5-6"
    assert quran_evidence.source.startswith("سورة الشرح")
    parts = sources.verse_parts("94:5-6", Language.ar)
    assert sorted(parts) == [5, 6]
    assert sources.normalize(parts[5]) in sources.normalize(quran_evidence.text)


def test_verse_lookup_outside_surah_is_none():
    assert sources.get_verses(94, 9, 9) is None
    assert sources.get_verses(200, 1, 1) is None


def test_english_translation_is_attached(quran_evidence):
    assert quran_evidence.translation_en
    assert "Saheeh" in (quran_evidence.translation_source or "")


def test_hadith_search_finds_bukhari_13(hadith_evidence):
    assert hadith_evidence.hadith_key == "bukhari:13"
    assert "صحيح البخاري" in hadith_evidence.source and "13" in hadith_evidence.source


def test_hadith_search_needs_distinctive_words():
    assert sources.search_hadith("قال") == []


def test_build_evidence_marks_unknown_texts_unverified():
    from app.schemas import QuranRequest
    evidence, unverified = sources.build_evidence(
        [QuranRequest(surah=94, ayah_start=5, ayah_end=6), QuranRequest(surah=94, ayah_start=40, ayah_end=41)],
        ["لا يؤمن أحدكم حتى يحب لأخيه ما يحب لنفسه", "كلام لا وجود له في الصحيحين البتة زقزقة عصافير"],
    )
    assert [e.id for e in evidence][:2] == ["Q1", "H1"]
    assert len(unverified) == 2


def test_verify_excerpt_returns_source_spelling(hadith_evidence):
    # The model types it without diacritics; the inserted text comes back as the source writes it.
    run = sources.verify_excerpt("لا يؤمن أحدكم حتى يحب لأخيه ما يحب لنفسه", hadith_evidence.text)
    assert run is not None
    assert sources.normalize(run) == "لا يؤمن احدكم حتي يحب لاخيه ما يحب لنفسه"
    assert run != "لا يؤمن أحدكم حتى يحب لأخيه ما يحب لنفسه"  # diacritics restored


def test_verify_excerpt_rejects_altered_or_short(hadith_evidence):
    assert sources.verify_excerpt("لا يؤمن أحدكم حتى يحب لأخيه ما يكره لنفسه", hadith_evidence.text) is None
    assert sources.verify_excerpt("لا يؤمن", hadith_evidence.text) is None


def test_clean_hadith_strips_typesetting_marks():
    assert sources.clean_hadith('‏ "قال" ‏') == "قال"


def test_sharh_is_linked_for_bukhari_13():
    sharh = sources.get_sharh("bukhari", 13)
    assert sharh is not None and sharh.text


def test_tafsir_for_verses():
    tafsir = sources.get_tafsir(94, 5, 6)
    assert tafsir and all(t.text for t in tafsir)


def test_glossary_terms_are_checked_in_localization():
    src = "التوحيد أساس الدين"
    assert [t.status.value for t in sources.check_terms(src, Language.ar, "Faith matters", Language.en)] == ["missing"]
    assert [t.status.value for t in sources.check_terms(src, Language.ar, "Tawhid matters", Language.en)] == ["used"]
