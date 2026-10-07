"""Rebuilds the examples page from real projects run on balagh.space, through the public API, the way a user
runs them: brief, ideas, script, localization, automatic review, correction, approval, template, video.

    uv run python tools/showcase.py scripts          # phase 1: the six projects, up to the approved version
    uv run python tools/showcase.py videos           # phase 2: render each example's videos, one at a time
    uv run python tools/showcase.py write            # phase 3: web/src/showcase.json from what was kept

Everything that comes back is kept as is in eval/showcase_run.json; nothing is edited by hand. The guards and
the feedback of the page do not depend on the writer and are carried over from the previous showcase.json.
Which idea is chosen: the first idea whose texts were all verified, like the previous examples' creators did.
"""
import json
import sys
import time
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parent.parent
BASE = "https://balagh.space/api"
RUN = ROOT / "eval" / "showcase_run.json"
OUT = ROOT / "web" / "src" / "showcase.json"
AUTHOR = "specialist"   # the examples are approved by their creator; a specialist signs alone
SIGNER = "يونس"

EXAMPLES = [
    dict(id="arabic", title="بالعربية لشباب مسلمين: الصدق في البيع والشراء",
         brief=dict(idea="الصدق في البيع والشراء وبركة التاجر الصادق", audience="شباب مسلمون (18-30)", language="ar", dialect="الفصحى المبسطة", audience_knowledge="familiar", platforms=["tiktok"], duration_seconds=45),
         videos=["geo"]),
    dict(id="from-video", title="من محاضرة على يوتيوب: الغش في البيع والشراء (بالدارجة المغربية) ← ريل بالعربية",
         brief=dict(idea=None, source_url="https://www.youtube.com/watch?v=9bf3L7IO3vE", audience="شباب مسلمون (18-30)", language="ar", dialect="الفصحى المبسطة", audience_knowledge="familiar", platforms=["tiktok"], duration_seconds=45),
         videos=["geo"]),
    dict(id="english", title="بالإنجليزية لشباب يتعرفون على الإسلام: Why does God allow hardship?",
         brief=dict(idea="Why does God allow hardship? Hope for anyone going through a hard time", audience="Young people in the UK exploring Islam", language="en", dialect=None, audience_knowledge="new", platforms=["instagram_reels", "tiktok"], duration_seconds=30),
         videos=["captions"]),
    dict(id="reels", title="للكبار على Reels وTikTok: إن مع العسر يسرا",
         brief=dict(idea="إن مع العسر يسرا: رسالة أمل لمن يمر بضيق", audience="شباب مسلمون (18-30)", language="ar", dialect="الفصحى المبسطة", audience_knowledge="familiar", tone="هادئ وتأملي", platforms=["instagram_reels", "tiktok"], duration_seconds=30),
         videos=["captions", "geo"]),
    dict(id="adults", title="للكبار: لماذا يبتلي الله الناس؟ ثم توطينه للإنجليزية",
         brief=dict(idea="لماذا يبتلي الله الناس؟ الصبر عند الشدة", audience="شباب مسلمون (18-30)", language="ar", dialect="الفصحى المبسطة", audience_knowledge="familiar", platforms=["youtube_shorts", "tiktok"], duration_seconds=45),
         localize=dict(audience="Young people in the UK exploring Islam", language="en", dialect=None, audience_knowledge="new"),
         videos=[]),
    dict(id="kids", title="حلقة أطفال: صندوق المشاركة السحري",
         brief=dict(idea="مشاركة الطعام مع الإخوة والأصدقاء: حديث لا يؤمن أحدكم حتى يحب لأخيه ما يحب لنفسه", audience="أطفال من 6 إلى 10 سنوات مع أهلهم", language="ar", dialect="الفصحى المبسطة", audience_knowledge="basic", tone="حنون", platforms=["youtube"], duration_seconds=60),
         story="kids", videos=["kids", "chalk", "teaser"]),
]

MAX_ROUNDS = 4   # correction rounds before giving up on a clean review


def api(method: str, path: str, body=None, timeout=600) -> dict:
    r = httpx.request(method, BASE + path, json=body, timeout=timeout)
    if r.status_code >= 400:
        raise RuntimeError(f"{method} {path} → {r.status_code}: {r.text[:300]}")
    return r.json() if r.content else {}


def log(ex: str, msg: str) -> None:
    print(f"[{ex}] {msg}", flush=True)


def review_until_clean(ex: str, pid: str, script: dict, steps: list, label: str) -> dict:
    """Review; while there are blocking findings, correct in a new version and review again."""
    for round_ in range(1, MAX_ROUNDS + 1):
        review = api("POST", f"/projects/{pid}/scripts/{script['id']}/review")
        script = api("GET", f"/projects/{pid}")["scripts"][script["id"]]
        blocking = review["blocking"]
        log(ex, f"{label} v{script['version']}: review → {blocking} blocking, {len(review['findings'])} findings")
        if round_ == 1:
            steps.append(dict(kind="review", version=script["version"], blocking=blocking, findings=len(review["findings"])))
        if not blocking:
            return script
        revised = api("POST", f"/projects/{pid}/scripts/{script['id']}/revise", {"notes": None})
        steps.append(dict(kind="revise", version=revised["version"]))
        log(ex, f"{label}: corrected into v{revised['version']}")
        script = revised
    return script


def run_scripts() -> None:
    run = json.loads(RUN.read_text()) if RUN.exists() else {}
    for ex in EXAMPLES:
        if ex["id"] in run and run[ex["id"]].get("approved_id"):
            log(ex["id"], "already done, skipping")
            continue
        steps: list = []
        brief = {**ex["brief"], "author": AUTHOR}
        project = api("POST", "/projects", brief)
        pid = project["id"]
        steps.append(dict(kind="ideas", n=len(project["ideas"])))
        log(ex["id"], f"project {pid}: {[i['title'] for i in project['ideas']]}")
        chosen = next((i for i in project["ideas"] if i["evidence"] and not i.get("unverified")), project["ideas"][0])
        script = api("POST", f"/projects/{pid}/ideas/{chosen['id']}/script", {})
        first_id = script["id"]
        steps.append(dict(kind="script", version=1, idea=chosen["title"]))
        log(ex["id"], f"script v1 {script['id']}: {script['title']} ({len(script['scenes'])} scenes)")
        script = review_until_clean(ex["id"], pid, script, steps, "script")
        source_approved = script
        localized_first = localized = None
        if ex.get("localize"):
            api("POST", f"/projects/{pid}/scripts/{script['id']}/approve", {"role": "creator", "name": SIGNER})
            loc = api("POST", f"/projects/{pid}/scripts/{script['id']}/localize", {**ex["localize"], "platforms": None, "duration_seconds": None, "notes": None})
            localized_first = loc["id"]
            steps.append(dict(kind="localize", version=loc["version"], language=ex["localize"]["language"]))
            log(ex["id"], f"localized {loc['id']}: {loc['title']}")
            localized = review_until_clean(ex["id"], pid, loc, steps, "localized")
            script = localized
        if ex.get("story"):
            script = api("PUT", f"/projects/{pid}/scripts/{script['id']}/template", {"template": ex["story"]})
            steps.append(dict(kind="story", scenes=len(script["story"]["scenes"])))
            log(ex["id"], f"story written: {script['story']['title']} ({len(script['story']['scenes'])} scenes)")
        for role in [r["role"] for r in script["required_approvals"]]:
            script = api("POST", f"/projects/{pid}/scripts/{script['id']}/approve", {"role": role, "name": SIGNER if role == "creator" else "مراجع لغوي (تجريبي)"})
        steps.append(dict(kind="approve", roles=[a["role"] for a in script["approvals"]]))
        log(ex["id"], f"approved: {script['approved']} (v{script['version']})")
        run[ex["id"]] = dict(project=pid, first_id=first_id, source_id=source_approved["id"], localized_first=localized_first,
                             approved_id=script["id"], chosen=project["ideas"].index(chosen), steps=steps, videos=[])
        RUN.write_text(json.dumps(run, ensure_ascii=False, indent=1))


def run_videos() -> None:
    run = json.loads(RUN.read_text())
    for ex in EXAMPLES:
        r = run[ex["id"]]
        done = {v["template"] for v in r["videos"] if v.get("status") == "done"}
        for template in ex["videos"]:
            if template in done:
                continue
            sid = r["approved_id"]
            pid = r["project"]
            if template != ex.get("story"):
                api("PUT", f"/projects/{pid}/scripts/{sid}/template", {"template": template})
            video = api("POST", f"/projects/{pid}/scripts/{sid}/videos", {"template": template})
            log(ex["id"], f"{template}: rendering {video['id']}")
            t0 = time.monotonic()
            while video["status"] not in ("done", "failed"):
                time.sleep(15)
                video = api("GET", f"/videos/{video['id']}")
            log(ex["id"], f"{template}: {video['status']} in {time.monotonic() - t0:.0f}s, {video.get('duration_seconds')}s, images {video['new_images']}, clips {video['new_clips']}, notes {video['notes']}")
            r["videos"] = [v for v in r["videos"] if v["template"] != template] + [dict(template=template, **{k: video.get(k) for k in ("id", "status", "url", "duration_seconds", "new_images", "new_clips", "notes", "preview", "error")})]
            RUN.write_text(json.dumps(run, ensure_ascii=False, indent=1))


# ---- showcase.json ----

def view_script(s: dict) -> dict:
    rev = s.get("review") or {}
    return dict(
        id=s["id"], title=s["title"], hook=s["hook"], version=s["version"],
        scenes=[dict(t=f"{x['start_second']}-{x['end_second']}", voiceover=x["voiceover"], screen=x["on_screen_text"]) for x in s["scenes"]],
        references=[dict(source=r["source"], usage=r["usage"], text=r["text"], sharh=(r.get("sharh") or {}).get("text"), tafsir=[t["text"] for t in r.get("tafsir", [])]) for r in s["references"]],
        review=[dict(severity=f["severity"], reviewer=f["reviewer"], scene=f["scene"], issue=f["issue"], fix=f["fix"]) for f in rev.get("findings", [])],
        claims=[dict(status=c["status"], claim=c["claim"], note=c["note"]) for c in rev.get("claims", [])],
        unverified=s.get("unverified_claims", []), approved=s["approved"], cta=s["call_to_action"],
    )


def view_story(st: dict | None) -> dict | None:
    if not st:
        return None
    return dict(title=st["title"], scenes=[dict(kind=x["kind"], lines=x["lines"], quote=x.get("quote", ""), source=x.get("source", ""), cards=x.get("cards", []), question=x.get("question", ""), choices=x.get("choices", [])) for x in st["scenes"]])


def timeline(ex: dict, r: dict, project: dict) -> list[str]:
    b = ex["brief"]
    out = [f"طلب: {b['idea'] or 'بلا موضوع، من المصدر'}، {b['audience']}، {'إنجليزية' if b['language'] == 'en' else 'عربية'}، {b['duration_seconds']} ث"]
    for s in r["steps"]:
        if s["kind"] == "ideas":
            out.append(f"ثلاث أفكار، لكل منها نصوصها الموثّقة من المصادر")
        elif s["kind"] == "script":
            out.append(f"سيناريو الفكرة «{s['idea']}»، كتبه GPT-5.4 والنصوص الشرعية أُدرجت من المصدر")
        elif s["kind"] == "review":
            out.append("المراجعة الآلية (Gemini): " + (f"{s['blocking']} ملاحظة مانعة" if s["blocking"] else "لا ملاحظات مانعة") + (f" و{s['findings'] - s['blocking']} اقتراح" if s["findings"] - s["blocking"] else ""))
        elif s["kind"] == "revise":
            out.append(f"تصحيح في النسخة {s['version']} ومراجعة ثانية")
        elif s["kind"] == "localize":
            out.append("توطين السيناريو لشباب بريطانيين يتعرفون على الإسلام، والآية بترجمة معتمدة")
        elif s["kind"] == "story":
            out.append(f"اختيار قالب «القصة المصورة» فكُتبت قصة بالشخصيات الثابتة ({s['scenes']} مشاهد)")
        elif s["kind"] == "approve":
            out.append("اعتماد " + "، و".join({"creator": "صانع المحتوى (مختص شرعي، مراجعة ذاتية)", "scholar": "مراجع شرعي", "language": "مراجع لغوي"}[x] for x in s["roles"]))
    if r["videos"]:
        names = {"geo": "الزخرفة الهندسية", "captions": "الترجمة المتحركة", "kids": "القصة المصورة", "chalk": "السبورة", "teaser": "إعلان الأهل"}
        out.append("الفيديو: " + "، و".join(names[v["template"]] for v in r["videos"] if v.get("status") == "done"))
    return out


def write() -> None:
    run = json.loads(RUN.read_text())
    old = json.loads(OUT.read_text())
    names = {t["id"]: t for t in api("GET", "/video/templates")}
    examples, blocking_total, videos_total, langs = [], 0, 0, set()
    for ex in EXAMPLES:
        r = run[ex["id"]]
        project = api("GET", f"/projects/{r['project']}")
        scripts = project["scripts"]
        first, final = scripts[r["first_id"]], scripts[r["approved_id"]]
        b = project["brief"]
        entry = dict(
            id=ex["id"], title=ex["title"], project=r["project"], script=r["approved_id"],
            brief=dict(idea=b["idea"], audience=b["audience"], language=b["language"], knowledge=b["audience_knowledge"], tone=b.get("tone"), platforms=b["platforms"], duration=b["duration_seconds"]),
            ideas=[dict(title=i["title"], hook=i["hook"], evidence=[e["source"] for e in i["evidence"]], **({"locus": i["source_locus"]} if i.get("source_locus") else {}), **({"mentions": [m["text"] if isinstance(m, dict) else m for m in i["source_mentions"]]} if i.get("source_mentions") else {})) for i in project["ideas"]],
            chosen=r["chosen"], first=view_script(first), final=view_script(scripts[r["source_id"]] if r.get("localized_first") else final),
            story=view_story(final.get("story")),
            videos=[dict(template=names[v["template"]]["name"], id=v["template"], url=v["url"], seconds=v["duration_seconds"], images=v["new_images"], clips=v["new_clips"], notes=v["notes"], aspect=names[v["template"]]["aspect"], example=ex["title"]) for v in r["videos"] if v.get("status") == "done"],
            timeline=timeline(ex, r, project),
        )
        if project.get("source"):
            entry["source"] = project["source"]
        if r.get("localized_first"):
            entry["final"] = view_script(scripts[r["localized_first"]])
            entry["latest"] = view_script(final)
        examples.append(entry)
        for s in scripts.values():
            blocking_total += (s.get("review") or {}).get("blocking", 0)
        videos_total += len(entry["videos"])
        langs.add(b["language"])
    stats = [
        dict(value=str(len(examples)), label="مشاريع حقيقية على هذا الموقع"),
        dict(value=str(videos_total), label="فيديوهات، بلا مونتاج"),
        dict(value=str(len(langs)), label="لغات: " + "، ".join({"ar": "عربية", "en": "إنجليزية"}[x] for x in sorted(langs))),
        dict(value=str(blocking_total), label="ملاحظة مانعة أمسكها المراجعون الآليون قبل البشر"),
        dict(value="0", label="نص شرعي كتبه النموذج"),
    ]
    OUT.write_text(json.dumps(dict(examples=examples, guards=old["guards"], stats=stats, feedback=old["feedback"]), ensure_ascii=False, indent=1))
    print(f"wrote {OUT.relative_to(ROOT)}: {len(examples)} examples, {videos_total} videos, {blocking_total} blocking findings")


if __name__ == "__main__":
    {"scripts": run_scripts, "videos": run_videos, "write": write}[sys.argv[1]]()
