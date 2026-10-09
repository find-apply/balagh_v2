"""Collects the specialists' decisions on the review sample and compares them with the automatic reviewers.

    uv run python tools/review_report.py          # prints the table, writes eval/review_report.md

For every script of the sample (tools/review_pack.py): who signed in the scholar's role or asked for changes,
with their note, next to what the automatic review found on that version. The notes are quoted as written.
"""
import json
from pathlib import Path

import httpx

from review_pack import SAMPLE, SITE

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "eval" / "review_report.md"


def main() -> None:
    rows, signed, changes = [], 0, 0
    # The specialist against the automatic review: both clean, both flagged, flagged only by the specialist
    # (the machine missed it), flagged only by the machine (the specialist signed anyway).
    clean, flagged, missed, overruled = 0, 0, 0, 0
    for n, (pid, sid, why) in enumerate(SAMPLE, start=1):
        s = httpx.get(f"{SITE}/api/projects/{pid}", timeout=60).json()["scripts"][sid]
        auto = (s.get("review") or {}).get("blocking", 0)
        approvals = [a for a in s["approvals"] if a["role"] == "scholar"]
        requests = [c for c in s["change_requests"] if c["role"] == "scholar"]
        if approvals:
            signed += 1
            decision = "اعتمد: " + "؛ ".join(f"{a['name']}" + (f" ({a['note']})" if a["note"] else "") for a in approvals)
            if auto == 0:
                clean += 1
            else:
                overruled += 1
        elif requests:
            changes += 1
            decision = "طلب تعديلًا: " + "؛ ".join(f"{c['name']}: «{c['note']}»" for c in requests)
            if auto == 0:
                missed += 1
            else:
                flagged += 1
        else:
            decision = "لم يُراجع بعد"
        rows.append(f"| {n} | {s['title']} | {s['content_level']} | {auto} | {decision} |")
    table = "| # | السيناريو | المستوى | مانعة آليًّا | قرار المختص |\n|---|---|---|---|---|\n" + "\n".join(rows)
    summary = (f"\n\nراجع المختصون {signed + changes} من {len(SAMPLE)}: اعتمدوا {signed} وطلبوا تعديل {changes}. "
               f"وافق المختص الآلة في {clean + flagged} (نظيف عند الاثنين {clean}، ومانع عند الاثنين {flagged})، "
               f"وأمسك ما فاتها في {missed}، واعتمد ما منعته في {overruled}.")
    doc = "# ما قاله المختصون الشرعيون\n\n" + table + summary + "\n"
    print(doc)
    OUT.write_text(doc)


if __name__ == "__main__":
    main()
