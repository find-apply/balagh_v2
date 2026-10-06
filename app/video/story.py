"""Writes the children's dialogue story a script is played as in the story templates (kids, chalk).

The story is new generated text, so the script's approvals are reset when it is written. The verse or hadith
it shows is never written by the model: the `text` scene names a quoted reference of the script and the
system inserts that reference's text."""
from typing import Optional

from ..generator import COMMON_RULES, LANGUAGE, _generate
from ..schemas import EvidenceKind, Language, ReferenceUsage, Script, Story, StoryDraft, StoryScene, StorySceneKind
from . import catalog

STORY_SYSTEM = f"""You turn a verified short-video script into a short dialogue story for children aged 6 to 10, \
played as an animated picture story with a fixed cast.

Cast (always these, by key; never add characters, never give them another name):
- salim: Salim, {catalog.CHARACTERS['salim']['look']}. Curious, sometimes hasty, always willing to do better.
- maryam: Maryam, {catalog.CHARACTERS['maryam']['look']}. Gentle and observant.
- nour: Nour, {catalog.CHARACTERS['nour']['look']}. She explains the text and asks the question.
- narr: the narrator, one short sentence to set a scene or tell what happened.

Shape, in this order:
1. 2 to 4 `story` scenes: a small everyday situation from a child's life where the lesson of the script is needed \
(Salim and Maryam, at home, school or outside). 1 to 3 lines each.
2. one `story` scene where Nour arrives or is already there and says they will remember what the Quran or the \
Prophet ﷺ says about it. Its lines must not say the text itself.
3. one `text` scene: set evidence_id to the id of one quoted reference from the list. No lines; the system shows \
the exact text.
4. one `words` scene: Nour explains the text in one or two simple lines, and 2 cards each taking one word from \
the quoted text with its meaning. When the reference carries `<tafsir>` or `<sharh>` (an approved commentary), \
Nour's explanation and the card meanings say what that commentary says, in a child's words: nothing beyond it, \
nothing against it, and never its words presented as the verse or hadith.
5. 1 or 2 `story` scenes: the children apply the lesson and it ends well.
6. one `quiz` scene: Nour asks the question in her line, Maryam or Salim answer with the right choice in a second \
line, a third line may say why. Exactly 2 choices, the right one first.
7. one `outro` scene: one line by Nour with the lesson in a child's words, plus an image_prompt.

Language: write every line, card, question and choice in the script's language ({{language}}), in plain, short, \
warm sentences a 7-year-old follows. Arabic is fully vowelled (tashkeel) because the lines are read aloud by \
speech synthesis. No slang.

Children's rules:
- Encourage, never frighten: no hellfire, punishment, death or illness details.
- No child is mocked or wins by doing wrong; a mistake is corrected in the same story, kindly.
- Characters never recite or quote a verse or hadith, never say "Allah said ..." followed by words: they only \
point to it, and the `text` scene shows it. Do not write any religious text yourself.
- Never ask the child to like, subscribe, comment, buy or send anything.
- Keep the script's claims: the story illustrates the script's lesson, adds nothing to it, and contradicts nothing in it.

image_prompt (story and outro scenes): an English description of one illustration in the picture-book style, \
naming the setting and what each present character does. Describe characters by their appearance exactly as \
written in the cast above, not by name, and list their keys in `present` in the same order (the renderer \
attaches each one's reference drawing so they look the same in every scene). Never ask for text, letters, \
faces of prophets or companions, or symbols of other faiths.

{COMMON_RULES}"""


def _references_block(script: Script) -> str:
    quoted = [r for r in script.references if r.usage == ReferenceUsage.quoted]
    if not quoted:
        return "<references>none</references>"
    def item(r) -> str:
        tafsir = "".join(f'\n<tafsir source="{t.source}">{t.text}</tafsir>' for t in r.tafsir)
        sharh = f'\n<sharh source="{r.sharh.source}">{r.sharh.text}</sharh>' if r.sharh else ""
        return f'<item id="{r.evidence_id}" kind="{r.kind.value}" source="{r.source}">{r.text}{tafsir}{sharh}</item>'

    items = "\n".join(item(r) for r in quoted)
    return f"<references>\n{items}\n</references>"


def _finalize(draft: StoryDraft, script: Script) -> Story:
    quoted = {r.evidence_id: r for r in script.references if r.usage == ReferenceUsage.quoted}
    scenes: list[StoryScene] = []
    kinds = [s.kind for s in draft.scenes]
    for n, s in enumerate(draft.scenes, start=1):
        scene = StoryScene(**s.model_dump())
        if s.kind == StorySceneKind.text:
            ref = quoted.get(s.evidence_id)
            if ref is None:
                raise ValueError(f"Scene {n} names evidence {s.evidence_id!r}, which is not a quoted reference of the script.")
            scene.quote, scene.source, scene.quote_kind = ref.text, ref.source, ref.kind
        else:
            if any("«" in line.text or "{{" in line.text for line in s.lines):
                raise ValueError(f"Scene {n} quotes a religious text in a line; only the text scene may show it.")
            if s.kind in (StorySceneKind.story, StorySceneKind.outro) and not s.image_prompt.strip():
                raise ValueError(f"Scene {n} ({s.kind.value}) needs an image_prompt.")
            if any(who not in catalog.CHARACTERS or not catalog.CHARACTERS[who]["sheet"] for who in s.present):
                raise ValueError(f"Scene {n} lists an unknown character in present: {s.present}.")
            if s.kind == StorySceneKind.quiz and (len(s.choices) != 2 or len(s.lines) < 2):
                raise ValueError(f"Scene {n} (quiz) needs exactly 2 choices and at least 2 lines.")
            if s.kind == StorySceneKind.words and len(s.cards) != 2:
                raise ValueError(f"Scene {n} (words) needs exactly 2 cards.")
            if not s.lines:
                raise ValueError(f"Scene {n} ({s.kind.value}) has no lines.")
            for line in s.lines:
                if line.who not in catalog.CHARACTERS:
                    raise ValueError(f"Scene {n} has an unknown character {line.who!r}.")
        scenes.append(scene)
    if quoted and StorySceneKind.text not in kinds:
        raise ValueError("The story has no text scene although the script quotes a verified text.")
    if kinds.count(StorySceneKind.text) > 1:
        raise ValueError("Only one text scene is allowed.")
    return Story(title=draft.title, scenes=scenes, review_note=draft.review_note)


async def write_story(script: Script, notes: Optional[str] = None) -> Story:
    system = STORY_SYSTEM.replace("{language}", LANGUAGE[script.target.language])
    prompt = (
        f"<script lang=\"{script.target.language.value}\">\n"
        f"<title>{script.title}</title>\n<hook>{script.hook}</hook>\n"
        + "".join(f"<scene>{s.voiceover} {s.on_screen_text}</scene>\n" for s in script.scenes)
        + f"<lesson>{script.call_to_action}</lesson>\n</script>\n\n{_references_block(script)}"
    )
    if not any(r.usage == ReferenceUsage.quoted for r in script.references):
        prompt += "\n\nThe script quotes no verified text, so write no text scene and no words scene: Nour explains the lesson in her own words."
    if script.story is not None:
        prompt += f"\n\n<previous_story>{script.story.model_dump_json(include={'title', 'scenes'})}</previous_story>\nWrite a different story (another situation, not a rewrite of this one)."
    if notes:
        prompt += f"\n\n<creator_notes>{notes}</creator_notes>"
    error: Optional[ValueError] = None
    for _ in range(2):
        attempt = prompt if error is None else f"{prompt}\n\nYour previous attempt was rejected: {error} Fix it."
        draft = await _generate(system, attempt, StoryDraft)
        try:
            return _finalize(draft, script)
        except ValueError as e:
            error = e
    raise RuntimeError(f"Could not write a story that keeps the religious text to the verified reference: {error}")
