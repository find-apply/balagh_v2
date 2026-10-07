"""Settings the admin can change without a redeploy. Stored values override the environment defaults."""
import os
import time

from pydantic import BaseModel, Field

from . import store


class FlowSettings(BaseModel):
    generation_model: str = Field(min_length=2, max_length=80, description="Model that writes ideas, scripts, localizations and revisions.")
    review_model: str = Field(min_length=2, max_length=80, description="Model used by the three automatic reviewers.")
    extra_rules: str = Field(default="", max_length=3000, description="Editorial rules appended to every prompt, on top of the built-in ones.")
    paused: bool = Field(default=False, description="Stops new generation (ideas, scripts, localizing, review, revision). Approvals and viewing keep working.")
    paused_message: str = Field(default="", max_length=300, description="Shown to users while generation is paused.")


def defaults() -> FlowSettings:
    return FlowSettings(
        generation_model=os.getenv("REELS_MODEL", "gpt-5.4"),
        review_model=os.getenv("REELS_REVIEW_MODEL", "gemini-flash-latest"),
    )


_cache: tuple[float, FlowSettings] | None = None
_TTL = 15.0  # seconds: a save takes effect within this, and the DB is not hit on every model call


def current() -> FlowSettings:
    global _cache
    now = time.monotonic()
    if _cache and now - _cache[0] < _TTL:
        return _cache[1]
    stored = store.get_settings()
    value = defaults().model_copy(update={k: v for k, v in stored.items() if k in FlowSettings.model_fields})
    _cache = (now, value)
    return value


def save(new: FlowSettings) -> FlowSettings:
    global _cache
    store.put_settings(new.model_dump())
    _cache = (time.monotonic(), new)
    return new
