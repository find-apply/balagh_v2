"""Fetch hadith explanations from the Hadith Encyclopedia (hadeethenc.com) into data/hadith_sharh.json.

Run when preparing the data:  uv run python tools/fetch_hadith_sharh.py
Safe to interrupt and re-run: finished hadiths are kept in data/hadith_sharh.partial.json
and skipped on the next run, and progress is written to data/hadith_sharh.progress so it can
be read while the fetch is going.

Only the explanation, the grading and the citation are taken, and each is stored whole and
unaltered, as the encyclopedia's republication terms require. The hadith text we quote still
comes from data/hadith.json; this file only grounds the explanation that surrounds a quote.
"""
import json
import sys
import time
import urllib.request
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data"
PARTIAL = DATA / "hadith_sharh.partial.json"
PROGRESS = DATA / "hadith_sharh.progress"
BASE = "https://hadeethenc.com/api/v1"
HEADERS = {"User-Agent": "balagh/1.0 (research prototype)"}
SAVE_EVERY = 25


def get(url: str) -> dict | list:
    for attempt in range(4):
        try:
            request = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(request, timeout=60) as response:
                return json.loads(response.read())
        except Exception as error:  # noqa: BLE001 - one-off fetch script
            if attempt == 3:
                raise
            print(f"\n  retry {attempt + 1} on {url}: {error}", file=sys.stderr)
            time.sleep(3 * (attempt + 1))
    raise AssertionError


def note(line: str) -> None:
    PROGRESS.write_text(f"{time.strftime('%H:%M:%S')} · {line}\n", encoding="utf-8")
    print(f"\r{line}", end="", file=sys.stderr)


def main() -> None:
    categories = [c for c in get(f"{BASE}/categories/list/?language=ar") if c["parent_id"] is None]
    ids: list[str] = []
    for category in categories:
        page, last = 1, 1
        while page <= last:
            body = get(f"{BASE}/hadeeths/list/?language=ar&category_id={category['id']}&page={page}&per_page=100")
            ids += [row["id"] for row in body["data"]]
            last = body["meta"]["last_page"]
            page += 1
            time.sleep(0.2)
        note(f"listing · {len(ids)} ids")
    ids = list(dict.fromkeys(ids))

    done: dict[str, dict] = {}
    if PARTIAL.exists():
        done = {e["id"]: e for e in json.loads(PARTIAL.read_text(encoding="utf-8"))}
    skipped = set(done)
    todo = [i for i in ids if i not in skipped]
    note(f"{len(ids)} hadiths · {len(done)} already fetched · {len(todo)} to go")

    def save_partial() -> None:
        PARTIAL.write_text(json.dumps(list(done.values()), ensure_ascii=False, separators=(",", ":")),
                           encoding="utf-8")

    for n, hadith_id in enumerate(todo, start=1):
        d = get(f"{BASE}/hadeeths/one/?language=ar&id={hadith_id}")
        if d.get("explanation"):
            done[d["id"]] = {
                "id": d["id"],
                "text": d.get("hadeeth", ""),
                "grade": d.get("grade", ""),
                "attribution": d.get("attribution", ""),
                "explanation": d["explanation"],
                "hints": d.get("hints", []),
                "reference": d.get("reference", ""),
                "languages": d.get("translations", []),
            }
        if n % SAVE_EVERY == 0 or n == len(todo):
            save_partial()
            note(f"fetched {len(skipped) + n}/{len(ids)} · kept {len(done)}")
        time.sleep(0.15)

    save_partial()
    (DATA / "hadith_sharh.json").write_text(
        json.dumps({
            "name": "الموسوعة الحديثية",
            "publisher": "IslamHouse",
            "source": "hadeethenc.com API",
            "fetched": time.strftime("%Y-%m-%d"),
            "entries": [done[i] for i in ids if i in done],
        }, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    note(f"done · wrote {len(done)} entries to hadith_sharh.json")
    print(file=sys.stderr)


if __name__ == "__main__":
    main()
