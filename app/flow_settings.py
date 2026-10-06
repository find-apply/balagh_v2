"""Settings the admin can change without a redeploy. Stored values override the environment defaults."""
import os

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
        generation_model=os.getenv("REELS_MODEL", "gemini-pro-latest"),
        review_model=os.getenv("REELS_REVIEW_MODEL", "gemini-flash-latest"),
    )


def current() -> FlowSettings:
    stored = store.get_settings()
    return defaults().model_copy(update={k: v for k, v in stored.items() if k in FlowSettings.model_fields})


def save(new: FlowSettings) -> FlowSettings:
    store.put_settings(new.model_dump())
    return new
