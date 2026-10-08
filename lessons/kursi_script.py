"""Ayat al-Kursi lesson: the script written by the default writer (gpt-6.1-sol) from the verse, its Tafsir
al-Muyassar and Muslim 810, then checked in code: the recited phrases rebuild the verse word for word, and every
explanation quotes the passage of the tafsir or hadith it rests on.

    uv run python lessons/kursi_script.py      # writes lessons/kursi_script.json and prints it
"""
import asyncio
import json
from pathlib import Path
from typing import Literal, Optional

from dotenv import load_dotenv
from pydantic import BaseModel, Field

from app import sources

from app.generator import _call_openai

load_dotenv(Path(__file__).resolve().parent.parent / ".env")
OUT = Path(__file__).with_suffix(".json")
MODEL = "gpt-6.1-sol"


class LessonScene(BaseModel):
    kind: Literal["hook", "hadith", "recite_explain", "summary", "close"]
    recitation: Optional[str] = Field(description="recite_explain only: the exact phrase of the verse recited by the reciter in this scene, copied from the verse with its diacritics; null otherwise.")
    voiceover: str = Field(description="What the narrator says (Modern Standard Arabic, plain and warm). Never recites Quran: the verse is heard from the reciter.")
    on_screen: str = Field(description="The short text shown on screen (a name of Allah, a key word, a short phrase).")
    visual: str = Field(description="What the canvas shows: cards, the names of Allah gathering, the verse phrase highlighted… in one or two sentences.")
    grounding: str = Field(description="The words of the tafsir or of the hadith this scene's explanation rests on, copied exactly; empty for the hook and the close.")
    seconds: int


class Lesson(BaseModel):
    title: str
    hook: str
    scenes: list[LessonScene]
    call_to_action: str
    notes_for_reviewer: list[str] = Field(description="Anything the scholar should look at: sensitive points, wording choices.")


SYSTEM = """You write an explainer lesson video, in the style of a clean animated explainer (cards and words appearing \
on a canvas, a calm narrator), on Ayat al-Kursi (Al-Baqarah 255). Audience: Arabic-speaking Muslims who recite it \
daily but do not know its meaning. Length about 150 seconds.

Structure:
1. hook (≈5 s): grounded in the hadith of Ubayy ibn Ka'b: the greatest verse, recited every day, but is its meaning known?
2. hadith (≈12 s): the story of Ubayy, told faithfully from the given text, ending with «لِيَهْنِكَ الْعِلْمُ أَبَا الْمُنْذِرِ».
3. recite_explain scenes: the verse cut into its natural phrases, in order, covering the WHOLE verse with no word left out \
or added. Each scene: the reciter recites the phrase, then the narrator explains it.
4. summary (≈10 s): the attributes of Allah the verse gathered, as words collected on screen.
5. close (≈8 s): a practical call: recite it knowing its meaning.

Rules:
- The explanation stays INSIDE the given Tafsir al-Muyassar: no meaning, story or virtue that is not in the given texts. \
Each explaining scene's `grounding` copies the tafsir words it rests on.
- The Kursi: say only what is needed and do not elaborate on its nature beyond «لا يعلم كيفيته إلا الله»; note it for \
the reviewer, since it is a detailed creed matter.
- No other hadith, no other virtue (e.g. reading it before sleep) since it is not in the given texts.
- The narrator never recites the verse, and says ﷺ after the Prophet's name.
- Natural spoken Arabic (فصحى ميسرة), short sentences, no filler."""


def main() -> None:
    verse = sources.get_verses(2, 255, 255)
    hadith = next(h for h in sources.search_hadith("أي آية من كتاب الله معك أعظم") if h.hadith_key == "muslim:810")
    prompt = (f"<verse source=\"البقرة 255\">{verse.text}</verse>\n\n"
              f"<tafsir source=\"{verse.tafsir[0].source}\">{verse.tafsir[0].text}</tafsir>\n\n"
              f"<hadith source=\"{hadith.source}\">{hadith.text}</hadith>")
    lesson = asyncio.run(_call_openai(SYSTEM, prompt, Lesson, MODEL))
    OUT.write_text(json.dumps(lesson.model_dump(), ensure_ascii=False, indent=2))
    print(json.dumps(lesson.model_dump(), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
