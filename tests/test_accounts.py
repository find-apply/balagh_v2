"""Signing in: a valid Firebase token makes the history the account's, the device's history moves over at the
first sign-in, an invalid token is a visitor, and an account rates a video once."""
from datetime import datetime, timezone

import pytest

from app import auth, store
from app.schemas import Video, VideoStatus

NOTE = "الفيديو واضح والتلاوة جميلة والشرح مناسب للشباب لكن الخط صغير قليلا"


@pytest.fixture
def signed(monkeypatch):
    users = {"tok-a": auth.User(uid="uid-a", email="a@example.com", name="أ", provider="google.com"),
             "tok-b": auth.User(uid="uid-b", email="b@example.com", name="ب", provider="password"),
             "tok-c": auth.User(uid="uid-c", email="c@example.com", name="ج", provider="password")}
    monkeypatch.setattr(auth, "verify", lambda token: users.get(token))
    return lambda token: {"Authorization": f"Bearer {token}"}


def test_signing_in_moves_the_devices_history_to_the_account(client, signed):
    store.remember("phone-1", "p1", shared=False)
    r = client.post("/me", headers={**signed("tok-a"), "X-Client-Id": "phone-1"})
    assert r.status_code == 200 and r.json()["moved"] == 1 and r.json()["email"] == "a@example.com"
    # the account's history is the same on another device, and the first device's own list is now empty
    assert [p["id"] for p in client.get("/projects", headers={**signed("tok-a"), "X-Client-Id": "laptop"}).json()] == ["p1"]
    assert client.get("/projects", headers={"X-Client-Id": "phone-1"}).json() == []
    # calling it again moves nothing twice
    assert client.post("/me", headers={**signed("tok-a"), "X-Client-Id": "phone-1"}).json()["moved"] == 0


def test_an_invalid_token_is_a_visitor(client, signed):
    store.remember("phone-2", "p1", shared=False)
    assert client.post("/me", headers=signed("forged")).status_code == 401
    assert [p["id"] for p in client.get("/projects", headers={**signed("forged"), "X-Client-Id": "phone-2"}).json()] == ["p1"]


def test_accounts_do_not_see_each_others_history(client, signed):
    client.post("/projects/p1/open", headers=signed("tok-b"))
    assert [p["id"] for p in client.get("/projects", headers=signed("tok-b")).json()] == ["p1"]
    assert client.get("/projects", headers=signed("tok-c")).json() == []


def test_an_account_rates_a_video_once(client, signed):
    store.save_video(Video(id="acc-v", project_id="p1", script_id="acc-s", template="captions", status=VideoStatus.done,
                           url="/media/acc-v.mp4", created_at=datetime.now(timezone.utc)))
    for stars in (2, 5):
        client.post("/videos/acc-v/feedback", headers=signed("tok-a"), json={"stars": stars, "role": "student", "name": "أحمد", "comment": NOTE})
    client.post("/videos/acc-v/feedback", json={"stars": 3, "role": "other", "name": "زائر", "comment": NOTE})
    assert sorted(f["stars"] for f in client.get("/videos/acc-v/feedback").json()) == [3, 5]
