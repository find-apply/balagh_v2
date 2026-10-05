#!/usr/bin/env python3
"""Generate one image with Magnific (Flux 2 Klein). Key is read from ../../.env (never printed).

  magnific.py "<prompt>" out.png [aspect] [ref1.png ref2.png ...]
"""
import json, os, sys, time, base64, urllib.request, urllib.error

BASE = "https://api.magnific.com"
ENV = os.path.join(os.path.dirname(__file__), "..", "..", "..", ".env")

def key():
    for l in open(ENV):
        if l.startswith("MAGNIFIC_API_KEY="):
            return l.split("=", 1)[1].strip()
    sys.exit("MAGNIFIC_API_KEY missing in .env")

def call(method, path, body=None):
    req = urllib.request.Request(BASE + path, method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={"x-magnific-api-key": key(), "Content-Type": "application/json", "Accept": "application/json", "User-Agent": "reel-kids/1.0"})
    try:
        return json.loads(urllib.request.urlopen(req, timeout=60).read())
    except urllib.error.HTTPError as e:
        sys.exit(f"HTTP {e.code}: {e.read().decode()[:400]}")

def main():
    prompt, out = sys.argv[1], sys.argv[2]
    aspect = sys.argv[3] if len(sys.argv) > 3 else "widescreen_16_9"
    refs = sys.argv[4:]
    body = {"prompt": prompt, "aspect_ratio": aspect, "resolution": "1k"}
    for i, r in enumerate(refs[:4]):
        body["input_image" if i == 0 else f"input_image_{i+1}"] = base64.b64encode(open(r, "rb").read()).decode()
    path = "/v1/ai/text-to-image/flux-2-klein"
    d = call("POST", path, body)
    tid = d["data"]["task_id"]; print("task", tid, d["data"].get("status"), flush=True)
    for _ in range(60):
        time.sleep(3)
        s = call("GET", f"{path}/{tid}")["data"]
        st = s.get("status"); print("status", st, flush=True)
        if st == "COMPLETED":
            url = (s.get("generated") or [None])[0]
            if isinstance(url, dict): url = url.get("url")
            urllib.request.urlretrieve(url, out); print("saved", out); return
        if st in ("FAILED", "ERROR"):
            sys.exit("failed: " + json.dumps(s)[:300])
    sys.exit("timeout")
main()
