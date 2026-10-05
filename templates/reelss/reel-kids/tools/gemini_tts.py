#!/usr/bin/env python3
"""Gemini TTS -> mp3.  gemini_tts.py <model> <voice> "<style>" "<text>" out.mp3
Key: AI_Studio_API_KEY from ../../../.env (never printed)."""
import base64, json, os, subprocess, sys, urllib.request, urllib.error
ENV = os.path.join(os.path.dirname(__file__), "..", "..", "..", ".env")
def key():
    for l in open(ENV):
        if l.startswith("AI_Studio_API_KEY="): return l.split("=", 1)[1].strip().strip('"\'')
    sys.exit("AI_Studio_API_KEY missing")
model, voice, style, text, out = sys.argv[1:6]
body = {"contents": [{"parts": [{"text": f"{style}: {text}" if style else text}]}],
        "generationConfig": {"responseModalities": ["AUDIO"],
            "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": voice}}}}}
req = urllib.request.Request(f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
    data=json.dumps(body).encode(), headers={"Content-Type": "application/json", "x-goog-api-key": key()})
try:
    d = json.loads(urllib.request.urlopen(req, timeout=120).read())
except urllib.error.HTTPError as e:
    sys.exit(f"HTTP {e.code}: {e.read().decode()[:500]}")
try:
    part = d["candidates"][0]["content"]["parts"][0]["inlineData"]
except Exception:
    sys.exit("no audio: " + json.dumps(d, ensure_ascii=False)[:500])
pcm = base64.b64decode(part["data"])
rate = 24000
for tok in part.get("mimeType", "").split(";"):
    if tok.strip().startswith("rate="): rate = int(tok.split("=")[1])
raw = out + (".wav" if pcm[:4] == b"RIFF" else ".pcm"); open(raw, "wb").write(pcm)
fmt = [] if raw.endswith(".wav") else ["-f", "s16le", "-ar", str(rate), "-ac", "1"]
subprocess.run(["ffmpeg", "-v", "error", *fmt, "-i", raw, "-ar", "44100", "-ac", "1", "-b:a", "128k", out, "-y"], check=True)
os.remove(raw); print("saved", out, part.get("mimeType"), len(pcm), "bytes")
