"""Match the encyclopedia's explanations to our hadith corpus, offline.

Run after tools/fetch_hadith_sharh.py:  uv run python tools/match_sharh.py

The encyclopedia and our corpus are different editions, so an entry is tied to one of our
hadiths only when their wording agrees closely: the entry's words must nearly all appear in
our text, and in the same order. Anything weaker is left unmatched rather than guessed, so an
explanation is never shown against a hadith it was not written about.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app import sources  # noqa: E402

DATA = Path(__file__).resolve().parent.parent / "data"
WORD_MIN = 0.85   # share of the entry's words that must appear in our text
ORDER_MIN = 0.70  # share of its adjacent word pairs that must appear in the same order


def main() -> None:
    sharh = json.loads((DATA / "hadith_sharh.json").read_text(encoding="utf-8"))
    corpus = json.loads((DATA / "hadith.json").read_text(encoding="utf-8"))

    # Our corpus keeps the chain of narrators; the encyclopedia gives the Prophet's words alone,
    # so match the entry into our longer text, not the other way round.
    corpus_tokens = [sources._token_list(h["t"]) for h in corpus]
    corpus_sets = [set(t) for t in corpus_tokens]
    corpus_pairs = [sources._pairs(t) for t in corpus_tokens]
    word_index: dict[str, set[int]] = {}
    for i, words in enumerate(corpus_sets):
        for w in words:
            word_index.setdefault(w, set()).add(i)

    index: dict[str, int] = {}
    matched = 0
    for n, entry in enumerate(sharh["entries"]):
        tokens = sources._token_list(entry["text"])
        if len(tokens) < 5:
            continue
        words, pairs = set(tokens), sources._pairs(tokens)
        counts: dict[int, int] = {}
        for w in words:
            for i in word_index.get(w, ()):
                counts[i] = counts.get(i, 0) + 1
        best, best_score = None, 0.0
        for i, hits in counts.items():
            if hits / len(words) < WORD_MIN:
                continue
            order = len(pairs & corpus_pairs[i]) / len(pairs) if pairs else 0.0
            if order >= ORDER_MIN and order > best_score:
                best, best_score = i, order
        if best is not None:
            h = corpus[best]
            key = f"{h['c']}:{h['n']}"
            if key not in index:
                index[key] = n
                matched += 1
        if (n + 1) % 200 == 0:
            print(f"\rmatching · {n + 1}/{len(sharh['entries'])} · matched {matched}", end="", file=sys.stderr)

    sharh["index"] = index
    sharh["match"] = {"word_min": WORD_MIN, "order_min": ORDER_MIN, "matched": matched,
                      "entries": len(sharh["entries"]), "corpus": len(corpus)}
    (DATA / "hadith_sharh.json").write_text(
        json.dumps(sharh, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"\nmatched {matched} of {len(sharh['entries'])} entries to our corpus", file=sys.stderr)


if __name__ == "__main__":
    main()
