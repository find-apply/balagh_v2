"""The checks on a finished video, on small synthetic clips made with ffmpeg."""
import asyncio
import subprocess

import pytest

from app.video import qa


def clip(path, seconds=8, audio="sine=frequency=440:sample_rate=48000", video="color=c=blue:s=320x240:r=25", gain_db=0):
    af = f"volume={gain_db}dB" if gain_db else "anull"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", f"{video}", "-f", "lavfi", "-i", audio,
                    "-t", str(seconds), "-af", af, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", str(path)],
                   check=True)
    return path


def test_quiet_clip_is_normalized(tmp_path):
    p = clip(tmp_path / "quiet.mp4", gain_db=-25)
    before = asyncio.run(qa.inspect(p)).loudness
    checks, after, stills = asyncio.run(qa.run(p, "captions", {"cues": [], "duration": 8}, 8, tmp_path, "quiet"))
    assert before < qa.LOUDNESS_RANGE[0]
    assert qa.LOUDNESS_RANGE[0] <= after <= qa.LOUDNESS_RANGE[1]
    assert next(c for c in checks if c.name == "loudness").ok and "سُوّي" in next(c for c in checks if c.name == "loudness").detail
    assert len(stills) == qa.FRAMES and all((tmp_path / s).exists() for s in stills)


def test_unintended_silence_is_flagged_but_a_silent_quote_is_not(tmp_path):
    # sound for 3 s, then nothing for 5 s
    p = clip(tmp_path / "gap.mp4", audio="sine=frequency=440:sample_rate=48000,volume='if(lt(t,3),1,0)':eval=frame")
    checks, _, _ = asyncio.run(qa.run(p, "captions", {"cues": [], "duration": 8}, 8, tmp_path, "gap"))
    silence = next(c for c in checks if c.name == "silence")
    assert not silence.ok and "3-8" in silence.detail
    # the same gap, declared by the spec as a quote shown for reading
    checks, _, _ = asyncio.run(qa.run(p, "captions", {"cues": [{"t0": 3, "t1": 8, "text": "آية", "sub": "يُعرض للقراءة"}], "duration": 8}, 8, tmp_path, "gap2"))
    assert next(c for c in checks if c.name == "silence").ok


def test_black_frames_and_wrong_length_are_flagged(tmp_path):
    p = clip(tmp_path / "black.mp4", seconds=6, video="color=c=black:s=320x240:r=25")
    checks, _, _ = asyncio.run(qa.run(p, "captions", {"cues": [], "duration": 10}, 10, tmp_path, "black"))
    assert not next(c for c in checks if c.name == "black").ok
    assert not next(c for c in checks if c.name == "length").ok


def test_expected_silences_follow_each_template():
    story = {"scenes": [{"duration": 5}, {"duration": 9, "quoteLead": 1, "quoteEnd": 7, "silentNote": "x"}, {"duration": 4}]}
    assert qa.expected_silences("kids", story) == [(6, 12)]
    teaser = {"introSeconds": 3, "ctaSeconds": 4, "shots": [{"duration": 10}, {"duration": 8}]}
    assert qa.expected_silences("teaser", teaser) == [(0.0, 3), (21, 25)]
    assert qa.spec_duration("teaser", teaser) == 25 and qa.spec_duration("kids", story) == 18
