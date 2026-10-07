"""Hadith recordings fetched from the archive: file naming, the match check, and that nothing runs without an account."""
import asyncio

from app.video import hadith_fetch as hf
from tests.conftest import quoted_ref


def test_archive_file_names():
    assert hf.archive_file(13) == ("Bukhari_MP3_0001-1000", "0013.mp3")
    assert hf.archive_file(1000) == ("Bukhari_MP3_0001-1000", "1000.mp3")
    assert hf.archive_file(2110) == ("Bukhari_MP3_2001-3000", "2110.mp3")
    assert hf.archive_file(7563) == ("Bukhari_MP3_6001-7563", "7563.mp3")
    assert hf.archive_file(7564) is None and hf.archive_file(0) is None


def test_match_share_tolerates_one_dropped_word_but_not_other_text():
    words = "إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ، وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى، فَمَنْ كَانَتْ هِجْرَتُهُ إِلَى دُنْيَا يُصِيبُهَا أَوْ إِلَى امْرَأَةٍ يَنْكِحُهَا"
    good = "إنما الأعمال بالنيات وإنما لكل امرئ ما نوى فمن كانت هجرته إلى دنيا يصيبها أو امرأة ينكحها"
    assert hf.match_share(good, words) >= hf.MATCH_MIN
    assert hf.match_share("حدثنا الحميدي عبد الله بن الزبير قال حدثنا سفيان", words) < 0.2
    assert hf.match_share("", words) == 0.0


def test_nothing_is_fetched_without_an_account(monkeypatch, hadith_evidence):
    monkeypatch.delenv("ARCHIVE_ORG_EMAIL", raising=False)
    monkeypatch.delenv("ARCHIVE_ORG_PASSWORD", raising=False)
    assert not hf.enabled()
    assert hf.download(13) is None
    assert asyncio.run(hf.obtain(quoted_ref(hadith_evidence))) is None


def test_only_bukhari_is_fetched(monkeypatch, hadith_evidence):
    monkeypatch.setenv("ARCHIVE_ORG_EMAIL", "x"); monkeypatch.setenv("ARCHIVE_ORG_PASSWORD", "y")
    ref = quoted_ref(hadith_evidence).model_copy(update={"hadith_key": "muslim:102"})
    assert asyncio.run(hf.obtain(ref)) is None
