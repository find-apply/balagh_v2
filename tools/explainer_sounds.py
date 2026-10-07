"""Synthesize the explainer's interface sounds and its quiet music bed into video/public/explainer/sfx.

Run once:  python3 tools/explainer_sounds.py
Everything is generated here from sine waves and noise, so the sounds carry no licence of their own.
"""
import math
import random
import struct
import wave
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "video" / "public" / "explainer" / "sfx"
RATE = 44100


def write(name: str, samples: list[float], stereo: bool = False) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    peak = max(1e-9, max(abs(s) for s in samples))
    scale = 0.89 / peak if peak > 0.89 else 1.0
    with wave.open(str(OUT / name), "wb") as w:
        w.setnchannels(2 if stereo else 1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(b"".join(struct.pack("<h", int(max(-1, min(1, s * scale)) * 32767)) for s in samples))


def pop() -> list[float]:
    # a soft, round "bubble": a pitch that falls fast, with a quick decay
    n = int(0.16 * RATE)
    out, ph = [], 0.0
    for i in range(n):
        t = i / RATE
        f = 380 + 700 * math.exp(-t * 45)
        ph += 2 * math.pi * f / RATE
        out.append(0.8 * math.sin(ph) * math.exp(-t * 30) * min(1, t * 900))
    return out


def tick() -> list[float]:
    n = int(0.12 * RATE)
    return [0.6 * (math.sin(2 * math.pi * 1760 * i / RATE) + 0.5 * math.sin(2 * math.pi * 2640 * i / RATE)) * math.exp(-i / RATE * 55) * min(1, i / 40) for i in range(n)]


def chime() -> list[float]:
    n = int(0.9 * RATE)
    out = []
    for i in range(n):
        t = i / RATE
        a = math.sin(2 * math.pi * 880 * t) * math.exp(-t * 5)
        b = math.sin(2 * math.pi * 1318.5 * t) * math.exp(-max(0, t - 0.09) * 5) * (t > 0.09)
        out.append(0.45 * (a + b) * min(1, t * 400))
    return out


def whoosh() -> list[float]:
    # filtered noise that swells and fades, its colour rising with it
    random.seed(3)
    n = int(0.7 * RATE)
    out, lp1, lp2 = [], 0.0, 0.0
    for i in range(n):
        t = i / n
        env = math.sin(math.pi * t) ** 2
        cut = 0.02 + 0.12 * t
        x = random.uniform(-1, 1)
        lp1 += cut * (x - lp1)
        lp2 += cut * (lp1 - lp2)
        out.append(lp1 - lp2 * 0.6)
        out[-1] *= env * 2.2
    return out


def key() -> list[float]:
    random.seed(9)
    n = int(0.035 * RATE)
    return [random.uniform(-1, 1) * math.exp(-i / RATE * 260) * 0.7 + 0.3 * math.sin(2 * math.pi * 2200 * i / RATE) * math.exp(-i / RATE * 300) for i in range(n)]


def music(seconds: float = 64.0) -> list[float]:
    """A slow, warm pad (Am – F – C – G, eight seconds a chord) with a soft pulse; stereo, loops cleanly."""
    chords = [[57, 60, 64, 69], [53, 57, 60, 65], [48, 55, 60, 64], [55, 59, 62, 67]]
    hz = lambda m: 440 * 2 ** ((m - 69) / 12)
    n = int(seconds * RATE)
    per = n // 8
    out = []
    lp_l = lp_r = 0.0
    for i in range(n):
        t = i / RATE
        ci = (i // per) % 4
        pos = (i % per) / per
        env = min(1, pos * 4) * min(1, (1 - pos) * 4) * 0.6 + 0.4
        l = r = 0.0
        for j, m in enumerate(chords[ci]):
            f = hz(m)
            l += math.sin(2 * math.pi * f * t + j) + 0.3 * math.sin(2 * math.pi * f * 2.003 * t)
            r += math.sin(2 * math.pi * f * 1.002 * t + j * 1.7) + 0.3 * math.sin(2 * math.pi * f * 1.997 * t)
        bass = math.sin(2 * math.pi * hz(chords[ci][0] - 12) * t)
        beat = (t * 72 / 60) % 1  # 72 bpm, a soft kick-like swell on each beat
        pulse = 0.35 * math.sin(2 * math.pi * 55 * t) * math.exp(-beat * 9)
        trem = 0.85 + 0.15 * math.sin(2 * math.pi * 0.25 * t)
        lp_l += 0.08 * (l - lp_l)
        lp_r += 0.08 * (r - lp_r)
        out.append(0.11 * (lp_l * env * trem + 0.8 * bass) + pulse)
        out.append(0.11 * (lp_r * env * trem + 0.8 * bass) + pulse)
    # fold the last two seconds into the first so the loop has no seam
    fade = 2 * RATE * 2
    for i in range(fade):
        w = i / fade
        out[i] = out[i] * w + out[len(out) - fade + i] * (1 - w)
    return out[: len(out) - fade]


if __name__ == "__main__":
    write("pop.wav", pop())
    write("tick.wav", tick())
    write("chime.wav", chime())
    write("whoosh.wav", whoosh())
    write("type.wav", key())
    write("music.wav", music(), stereo=True)
    print("written to", OUT)
