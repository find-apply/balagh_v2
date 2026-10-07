import asyncio, json, time
from dotenv import load_dotenv; load_dotenv('/root/balagh_v2/.env')
from app import generator as g, flow_settings, sources
from app.schemas import AudienceSpec, BriefIn, Platform

OUT = 'eval/writers.json'
MODELS = ["gemini-pro-latest", "gpt-5.4"]
CASES = [
    dict(label="الصدق في البيع", brief=dict(idea="الصدق في البيع والشراء وبركة التاجر الصادق", audience="شباب مسلمون (18-30)", language="ar", dialect="الفصحى المبسطة", audience_knowledge="familiar")),
    dict(label="بر الوالدين", brief=dict(idea="بر الوالدين في زمن الانشغال", audience="شباب مسلمون (18-30)", language="ar", dialect="الفصحى المبسطة", audience_knowledge="familiar")),
    dict(label="أطفال: الصدق", brief=dict(idea="لماذا نقول الصدق دائما؟", audience="أطفال من 6 إلى 10 سنوات مع أهلهم", language="ar", dialect="الفصحى المبسطة", audience_knowledge="basic")),
    dict(label="خلافي: الموسيقى", brief=dict(idea="ما حكم الموسيقى في الإسلام؟", audience="شباب مسلمون (18-30)", language="ar", dialect="الفصحى المبسطة", audience_knowledge="familiar")),
    dict(label="إنجليزي: الصلاة", brief=dict(idea="Why do Muslims pray five times a day?", audience="Non-Muslims curious about Islam", language="en", dialect=None, audience_knowledge="new")),
    dict(label="توطين: الابتلاء → EN", brief=dict(idea="لماذا يبتلي الله الناس؟", audience="شباب مسلمون (18-30)", language="ar", dialect="الفصحى المبسطة", audience_knowledge="familiar"), localize=dict(audience="Young British people discovering Islam", language="en", dialect=None, audience_knowledge="new")),
]

def use(model):
    flow_settings.defaults = (lambda m=model: flow_settings.FlowSettings(generation_model=m, review_model="gemini-flash-latest", extra_rules=""))

def summary(s, wrote):
    return dict(seconds=round(wrote, 1), title=s.title, hook=s.hook, level=s.content_level.value, scenes=len(s.scenes),
                words=len(" ".join(x.voiceover for x in s.scenes).split()),
                quoted=[(r.evidence_id, r.usage.value) for r in s.references], warnings=s.warnings,
                grounded=[x.grounded for x in s.scenes if x.grounded is not None],
                blocking=s.review.blocking, findings=[dict(sev=f.severity.value, who=f.reviewer.value, issue=f.issue[:220]) for f in s.review.findings],
                claims=[(c.status.value) for c in s.review.claims] if s.review.claims else None,
                terms=[str(t.model_dump())[:80] for t in s.terminology] if s.terminology else None,
                text="\n".join(f"[{x.start_second}-{x.end_second}] {x.voiceover}" for x in s.scenes), cta=s.call_to_action)

async def run_case(case):
    brief = BriefIn(platforms=[Platform.tiktok], duration_seconds=45, **case["brief"])
    use("gemini-pro-latest")
    try:
        ideas = await g.generate_ideas(brief)
    except g.Referral as e:
        return dict(label=case["label"], referral=str(e))
    idea = next((i for i in ideas if any(e.tafsir or e.sharh for e in i.evidence)), ideas[0])
    res = dict(label=case["label"], idea=idea.title, level=idea.content_level.value, evidence=[e.id for e in idea.evidence], models={})
    for m in MODELS:
        use(m)
        t0 = time.monotonic()
        try:
            s = await g.generate_script(brief, idea, 45, None)
            wrote = time.monotonic() - t0
            s.review = await g.review_script(s, idea, None)
            r = summary(s, wrote)
            if case.get("localize"):
                t1 = time.monotonic()
                loc = await g.localize_script(s, idea, AudienceSpec(**case["localize"]), [Platform.tiktok], 45, None)
                lw = time.monotonic() - t1
                loc.review = await g.review_script(loc, idea, s)
                r["localized"] = summary(loc, lw)
            res["models"][m] = r
        except Exception as e:
            res["models"][m] = dict(error=f"{type(e).__name__}: {str(e)[:300]}")
        print(case["label"], m, "done" if "error" not in res["models"][m] else res["models"][m]["error"], flush=True)
    return res

async def main():
    results = await asyncio.gather(*(run_case(c) for c in CASES))
    json.dump(results, open(OUT, "w"), ensure_ascii=False, indent=1)
    print("saved")
asyncio.run(main())
