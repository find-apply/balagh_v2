"""Fetch Tafsir al-Muyassar from quran.com into data/tafsir.json.

Run once when preparing the data: uv run python tools/fetch_tafsir.py

The tafsir comments on ranges of verses, not always on single ones: one entry may cover
4:66-68. The endpoint keys each entry by its first verse only, so a chapter's entries are
read in order and each one covers up to the verse before the next entry starts. That
inference was checked against the per-ayah endpoint, which does report the full range.
"""
import json
import re
import sys
import time
import urllib.request
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data"
RESOURCE = 16  # Tafsir Muyassar, as listed by /resources/tafsirs
# The endpoint paginates at 10 rows by default; the longest surah has 286 verses.
URL = f"https://api.quran.com/api/v4/tafsirs/{RESOURCE}/by_chapter/{{}}?per_page=300&page={{}}"
HEADERS = {"User-Agent": "balagh/1.0 (research prototype)"}


def clean(text: str) -> str:
    text = re.sub(r"<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def fetch(surah: int, page: int) -> dict:
    for attempt in range(4):
        try:
            request = urllib.request.Request(URL.format(surah, page), headers=HEADERS)
            with urllib.request.urlopen(request, timeout=60) as response:
                return json.loads(response.read())
        except Exception as error:  # noqa: BLE001 - one-off fetch script
            if attempt == 3:
                raise
            print(f"\n  surah {surah} page {page} retry {attempt + 1}: {error}", file=sys.stderr)
            time.sleep(3 * (attempt + 1))
    raise AssertionError


def main() -> None:
    quran = json.loads((DATA / "quran.json").read_text(encoding="utf-8"))
    entries: list[dict] = []
    index: dict[str, int] = {}

    for surah, info in enumerate(quran["surahs"], start=1):
        rows: list[dict] = []
        page = 1
        while page:
            body = fetch(surah, page)
            rows += body["tafsirs"]
            page = body["pagination"]["next_page"]
            time.sleep(0.2)

        rows.sort(key=lambda r: int(r["verse_key"].split(":")[1]))
        starts = [int(r["verse_key"].split(":")[1]) for r in rows]
        for i, row in enumerate(rows):
            text = clean(row["text"])
            if not text:
                continue
            first = starts[i]
            last = starts[i + 1] - 1 if i + 1 < len(starts) else info["verses"]
            entries.append({"surah": surah, "first": first, "last": last, "text": text})
            for ayah in range(first, last + 1):
                index[f"{surah}:{ayah}"] = len(entries) - 1
        print(f"\rsurah {surah}/114 · {len(index)} verses · {len(entries)} entries", end="", file=sys.stderr)

    missing = [k for k in quran["verses"] if k not in index]
    print(f"\ncovered {len(index)} of {len(quran['verses'])} verses in {len(entries)} entries;"
          f" missing {len(missing)}{' ' + str(missing[:5]) if missing else ''}", file=sys.stderr)

    (DATA / "tafsir.json").write_text(
        json.dumps({
            "name": "تفسير الميسر",
            "publisher": "مجمع الملك فهد لطباعة المصحف الشريف",
            "source": "quran.com API, resource 16",
            "entries": entries,
            "index": index,
        }, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(f"wrote {DATA / 'tafsir.json'}", file=sys.stderr)


if __name__ == "__main__":
    main()
