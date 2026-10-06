"""Evaluation of the children's stories. Run from the repo root: uv run python -m eval.stories

For each topic: brief for children -> ideas -> script -> story, then automatic checks of what the story
templates promise. Cached in eval/cache/ like eval/run.py; results in eval/stories.json.
"""
import asyncio
import json
import re

from app import generator as g
from app.schemas import BriefIn, ReferenceUsage, Script
from app.video import story as st
from app.video import catalog
from eval.run import HERE, cached, call, squash

AUDIENCE = "أطفال من 6 إلى 10 سنوات مع أهلهم"
TOPICS = [
    "مشاركة الطعام مع الإخوة والأصدقاء",
    "الصدق ولو كان صعبا",
    "بر الوالدين: مساعدة الأم في البيت",
    "الرفق بالحيوان",
    "إفشاء السلام",
]
# Words a children's story must not use (fear, punishment, death, illness) and asks it must not make.
FEAR = ["النار", "جهنم", "العذاب", "يعذب", "الموت", "القبر", "المرض", "hell", "punish", "death", "grave"]
ASKS = ["اشترك", "لايك", "إعجاب", "علّق", "تعليق", "شارك الفيديو", "subscribe", "like", "comment"]


def brief(idea: str) -> BriefIn:
    return BriefIn(idea=idea, audience=AUDIENCE, language="ar", audience_knowledge="basic", tone="حنون",
                   platforms=["youtube"], duration_seconds=60)


async def make(topic: str) -> dict:
    ideas = await call(lambda: g.generate_ideas(brief(topic)))
    idea = max(ideas, key=lambda i: len(i.evidence))
    script = await call(lambda: g.generate_script(brief(topic), idea, 60, None))
    script.story = await call(lambda: st.write_story(script))
    return {"script": script.model_dump(mode="json")}


def check(run: dict) -> dict:
    """What the templates promise: the only religious text is the verified one, in the text scene."""
    script = Script.model_validate(run["script"])
    story = script.story
    quoted = {r.evidence_id: r for r in script.references if r.usage == ReferenceUsage.quoted}
    lines = [line.text for s in story.scenes for line in s.lines]
    raw = " ".join(lines)
    spoken = squash(raw)
    text_scenes = [s for s in story.scenes if s.kind.value == "text"]
    # A 6-word run of a quoted text inside a character's line would be the model reciting it.
    leaked = 0
    for r in quoted.values():
        words = squash(r.text).split()
        for i in range(max(0, len(words) - 5)):
            if " ".join(words[i:i + 6]) in spoken:
                leaked += 1
                break
    return {
        "scenes": len(story.scenes),
        "lines": len(lines),
        "quoted_refs": len(quoted),
        "text_scenes": len(text_scenes),
        "text_matches_reference": all(s.quote == quoted[s.evidence_id].text for s in text_scenes if s.evidence_id in quoted),
        "quote_marks_in_lines": sum("«" in t or "»" in t for t in lines),
        "reference_leaked_into_lines": leaked,
        "fear_words": [w for w in FEAR if w in spoken],
        "asks": [w for w in ASKS if w in spoken],
        "unknown_characters": sorted({line.who for s in story.scenes for line in s.lines} - set(catalog.CHARACTERS)),
        "has_quiz": any(s.kind.value == "quiz" for s in story.scenes),
        "has_outro": any(s.kind.value == "outro" for s in story.scenes),
        "tashkeel_ratio": round(len(re.findall(r"[ً-ْ]", raw)) / max(1, len(re.findall(r"[ء-ي]", raw))), 2),
    }


async def main() -> None:
    runs = await asyncio.gather(*(cached(f"s_story_{i}", lambda t=t: make(t)) for i, t in enumerate(TOPICS)))
    rows = [{"topic": t, "title": r["script"]["story"]["title"], **check(r)} for t, r in zip(TOPICS, runs)]
    (HERE / "stories.json").write_text(json.dumps(rows, ensure_ascii=False, indent=1), encoding="utf-8")
    for r in rows:
        print(json.dumps(r, ensure_ascii=False))
    n = len(rows)
    print(f"\nstories: {n}")
    print(f"text scene shows exactly the verified reference: {sum(r['text_matches_reference'] and r['text_scenes'] == min(1, r['quoted_refs']) for r in rows)} / {n}")
    print(f"no reference recited by a character: {sum(r['reference_leaked_into_lines'] == 0 and r['quote_marks_in_lines'] == 0 for r in rows)} / {n}")
    print(f"no fear words: {sum(not r['fear_words'] for r in rows)} / {n}; no asks: {sum(not r['asks'] for r in rows)} / {n}")
    print(f"only the fixed cast: {sum(not r['unknown_characters'] for r in rows)} / {n}")
    print(f"quiz and outro present: {sum(r['has_quiz'] and r['has_outro'] for r in rows)} / {n}")


if __name__ == "__main__":
    asyncio.run(main())
