"""Measures the 'source for inspiration' feature before and after changes: public YouTube videos of different
lengths and languages, a PDF (text or scanned) and an image, each run twice, with the timestamps checked
against a separate transcription of that window. Run: `uv run python -m eval.inspiration [ar_short_206s|
ar_short_109s|en_25min|ar_59min|scan|pdf|image]`. Costs a few cents; the hour-long video alone is ~10 cents.
Results of 6 October 2026 are in README (مصدر للإلهام)."""
import asyncio, json, os, re, sys, time
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from dotenv import load_dotenv; load_dotenv(ROOT / '.env')
os.environ['REELS_PLAIN'] = '1'
from google import genai
from google.genai import types
from pydantic import BaseModel, Field
from app import generator as g, sources
from app.schemas import IdeaDraft, ContentLevel, AudienceSpec, Platform, Language
D = str(ROOT / 'eval' / 'inspiration')

class SourcedIdea(IdeaDraft):
    source_locus: str = Field(description="Where in the source this angle comes from: a timestamp mm:ss for a video, a page or heading for a document, 'the image' for an image. Empty if not from the source.")
    source_claims: list[str] = Field(description="Every religious text the SOURCE itself cites that this idea leans on, as the source words it.")

class SourcedIdeas(BaseModel):
    brief_level: ContentLevel
    referral_message: str
    ideas: list[SourcedIdea]
    source_summary: str

SYSTEM = g.IDEAS_SYSTEM + """

A SOURCE is attached (a video, a document or an image). Use it for the angle, the examples and the questions \
the audience has, and say where in the source each idea comes from. Do not copy the source's wording. Religious \
texts work exactly as without a source: request them (quran_requests / hadith_queries) and the system verifies \
them; a text the source cites is not verified by being in the source."""

client = genai.Client()
def prompt_for(lang):
    t = AudienceSpec(audience="شباب مسلمون (18-30)" if lang == "ar" else "Young Muslims (18-30)", language=lang, dialect=None, audience_knowledge="familiar", tone=None)
    return "<idea>not given: take the topics from the attached source</idea>\n\n" + g._target_block(t, [Platform.tiktok], "45 seconds")

def mmss(s):
    m = re.search(r"(\d{1,2}):(\d{2})", s); return int(m.group(1))*60+int(m.group(2)) if m else None

async def transcribe_window(uri, sec):
    a, b = max(0, sec-20), sec+25
    r = await client.aio.models.generate_content(model="gemini-flash-latest", contents=[types.Content(role="user", parts=[
        types.Part(file_data=types.FileData(file_uri=uri), video_metadata=types.VideoMetadata(start_offset=f"{a}s", end_offset=f"{b}s")),
        types.Part.from_text(text="Transcribe exactly what is said in this clip, in its original language. Output the transcript only.")])])
    return r.text or ""

async def run(name, part, lang="ar", uri=None, check_ts=False):
    t0 = time.time()
    r = await client.aio.models.generate_content(model="gemini-flash-latest",
        contents=[types.Content(role="user", parts=[part, types.Part.from_text(text=prompt_for(lang))])],
        config=types.GenerateContentConfig(system_instruction=SYSTEM, response_mime_type="application/json", response_schema=SourcedIdeas))
    out = SourcedIdeas.model_validate_json(r.text); u = r.usage_metadata
    rows = []; ver = unv = 0
    for d in out.ideas:
        evidence, unverified = sources.build_evidence(d.quran_requests, d.hadith_queries)
        ver += len(evidence); unv += len(unverified)
        ts_ok = ""
        if check_ts and uri and mmss(d.source_locus) is not None:
            tr = await transcribe_window(uri, mmss(d.source_locus))
            trn = sources.normalize(tr)
            hits = [c for c in d.source_claims if any(w in trn for w in [" ".join(sources.normalize(c).split()[i:i+3]) for i in range(0, max(1, len(sources.normalize(c).split())-2))][:6])]
            ts_ok = f"transcript@{d.source_locus}: {'MATCH' if hits else 'no match'} ({len(hits)}/{len(d.source_claims)}) :: {tr[:90]!r}"
        rows.append((d.title[:40], d.content_level.value, d.source_locus, d.hook[:70], [e.source for e in evidence], unverified, ts_ok))
    print(f"\n=== {name}: {time.time()-t0:.0f}s, in={u.prompt_token_count} out={u.candidates_token_count} | verified {ver}, unverified {unv}")
    print("   summary:", out.source_summary[:160])
    for row in rows:
        print("   -", row[0], "|", row[1], "|", row[2]); print("     hook:", row[3]); print("     ok:", row[4]); 
        if row[5]: print("     UNVERIFIED:", row[5])
        if row[6]: print("     ", row[6])

async def main():
    which = sys.argv[1:]
    vids = {"ar_short_206s": ("https://www.youtube.com/watch?v=Gdoh6RpNeXY", "ar"),
            "ar_short_109s": ("https://www.youtube.com/watch?v=9bf3L7IO3vE", "ar"),
            "en_25min": ("https://www.youtube.com/watch?v=5wZbj0RbkJI", "en"),
            "ar_59min": ("https://www.youtube.com/watch?v=c3mB1EcHuFA", "ar")}
    for key, (uri, lang) in vids.items():
        if which and key not in which: continue
        for rep in (1, 2) if key != "ar_59min" else (1,):
            try:
                await run(f"{key} run{rep}", types.Part(file_data=types.FileData(file_uri=uri)), lang, uri, check_ts=(rep == 1))
            except Exception as e:
                print(f"\n=== {key} run{rep} FAILED: {str(e)[:200]}")
    if not which or "pdf" in which:
        for rep in (1, 2):
            await run(f"pdf run{rep}", types.Part.from_bytes(data=open(f"{D}/khutba.pdf","rb").read(), mime_type="application/pdf"))
    if not which or "image" in which:
        for rep in (1, 2):
            await run(f"image run{rep}", types.Part.from_bytes(data=open(f"{D}/post.png","rb").read(), mime_type="image/png"))
asyncio.run(main())
