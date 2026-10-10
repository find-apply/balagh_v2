"""Signing in: a valid Firebase token makes the history the account's, the device's history moves over at the
first sign-in, an invalid token is a visitor, and an account rates a video once. A new account waits for the
admin: until approved its token opens nothing but /me."""
from datetime import datetime, timezone

import pytest

from app import auth, firebase, main, store
from app.schemas import Video, VideoStatus

NOTE = "الفيديو واضح والتلاوة جميلة والشرح مناسب للشباب لكن الخط صغير قليلا"
PROFILE = {"full_name": "أحمد بن علي", "specialization": "علوم شرعية", "phone": "+213 555 12 34 56"}
ROOT = {"Authorization": "Bearer root"}

USERS = {"tok-a": auth.User(uid="uid-a", email="a@example.com", name="أ", provider="google.com"),
         "tok-b": auth.User(uid="uid-b", email="b@example.com", name="ب", provider="password"),
         "tok-c": auth.User(uid="uid-c", email="c@example.com", name="ج", provider="password"),
         "tok-new": auth.User(uid="uid-new", email="new@example.com", name="جديد", provider="google.com")}


def _approve(uid: str) -> None:
    u = next(u for u in USERS.values() if u.uid == uid)
    store.save_user(u.uid, u.email, u.name, u.picture, u.provider)
    store.set_user_status(uid, "approved")


@pytest.fixture
def signed(monkeypatch):
    """Accounts a, b and c are already approved; `tok-new` belongs to an account that has not signed up yet."""
    monkeypatch.setattr(auth, "verify", lambda token: USERS.get(token))
    for uid in ("uid-a", "uid-b", "uid-c"):
        _approve(uid)
    with store.engine.begin() as conn:
        conn.execute(store.users.delete().where(store.users.c.uid == "uid-new"))
    return lambda token: {"Authorization": f"Bearer {token}"}


@pytest.fixture
def disabled(monkeypatch):
    """Firebase is never called from tests: the calls are recorded instead."""
    calls = []
    monkeypatch.setattr(firebase, "set_disabled", lambda uid, off: calls.append((uid, off)) or True)
    return calls


@pytest.fixture
def admin_headers(monkeypatch):
    monkeypatch.setenv("ADMIN_TOKEN", "root")
    return ROOT


def test_signing_in_moves_the_devices_history_to_the_account(client, signed):
    store.remember("phone-1", "p1", shared=False)
    r = client.post("/me", headers={**signed("tok-a"), "X-Client-Id": "phone-1"})
    assert r.status_code == 200 and r.json()["moved"] == 1 and r.json()["email"] == "a@example.com"
    assert r.json()["status"] == "approved"
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


def test_a_new_account_signs_up_and_waits_for_review(client, signed):
    store.remember("phone-new", "p1", shared=False)
    r = client.post("/me", headers={**signed("tok-new"), "X-Client-Id": "phone-new"}, json={"profile": PROFILE})
    assert r.status_code == 200
    me = r.json()
    assert me["status"] == "pending" and me["moved"] == 0
    assert (me["full_name"], me["specialization"], me["phone"]) == (PROFILE["full_name"], PROFILE["specialization"], PROFILE["phone"])
    # the token opens nothing else, and the device keeps its own history
    blocked = client.get("/projects", headers={**signed("tok-new"), "X-Client-Id": "phone-new"})
    assert blocked.status_code == 403 and "المراجعة" in blocked.json()["detail"]
    assert [p["id"] for p in client.get("/projects", headers={"X-Client-Id": "phone-new"}).json()] == ["p1"]
    # signing in again later neither forgets the details nor lets the account in
    again = client.post("/me", headers=signed("tok-new")).json()
    assert again["status"] == "pending" and again["phone"] == PROFILE["phone"]


def test_a_token_of_an_account_that_never_signed_up_is_refused(client, signed):
    assert client.get("/projects", headers=signed("tok-new")).status_code == 403


def test_sign_up_details_are_checked(client, signed):
    bad = {**PROFILE, "phone": "call me"}
    assert client.post("/me", headers=signed("tok-new"), json={"profile": bad}).status_code == 422
    assert client.post("/me", headers=signed("tok-new"), json={"profile": {**PROFILE, "full_name": ""}}).status_code == 422


def test_the_admin_approves_an_account_and_its_history_moves_over(client, signed, disabled, admin_headers):
    store.remember("phone-ok", "p1", shared=False)
    client.post("/me", headers=signed("tok-new"), json={"profile": PROFILE})
    waiting = client.get("/admin/accounts?status=pending", headers=admin_headers).json()
    assert [a["uid"] for a in waiting] == ["uid-new"] and waiting[0]["specialization"] == PROFILE["specialization"]
    refused = client.put("/admin/accounts/uid-new/status", headers=admin_headers, json={"status": "approved"})
    assert refused.status_code == 400 and "الصفة" in refused.json()["detail"]
    r = client.put("/admin/accounts/uid-new/status", headers=admin_headers, json={"status": "approved", "role": "creator"})
    assert r.status_code == 200 and r.json()["status"] == "approved" and r.json()["role"] == "creator"
    assert disabled[-1] == ("uid-new", False)
    assert client.post("/me", headers={**signed("tok-new"), "X-Client-Id": "phone-ok"}).json()["moved"] == 1
    assert client.get("/projects", headers=signed("tok-new")).status_code == 200


def test_the_admin_rejects_an_account(client, signed, disabled, admin_headers):
    client.post("/me", headers=signed("tok-new"), json={"profile": PROFILE})
    assert client.put("/admin/accounts/uid-new/status", headers=admin_headers, json={"status": "rejected"}).status_code == 200
    assert disabled == [("uid-new", True)]
    assert client.post("/me", headers=signed("tok-new")).json()["status"] == "rejected"
    r = client.get("/projects", headers=signed("tok-new"))
    assert r.status_code == 403 and r.json()["detail"] == auth.NOT_APPROVED["rejected"]
    assert client.put("/admin/accounts/nobody/status", headers=admin_headers, json={"status": "approved"}).status_code == 404
    assert client.get("/admin/accounts").status_code == 401


BRIEF = {"idea": "الصدق", "audience": "شباب", "language": "ar", "dialect": None, "audience_knowledge": "familiar",
         "tone": None, "platforms": ["tiktok"], "duration_seconds": 45, "author": "specialist"}


def test_the_role_comes_from_the_account_not_the_form(client, signed, monkeypatch, admin_headers, disabled):
    seen = []

    async def fake_ideas(brief, digest):
        seen.append(brief.author.value); return ([], "")

    monkeypatch.setattr(main.generator, "generate_ideas_from", fake_ideas)
    client.post("/me", headers=signed("tok-new"), json={"profile": PROFILE})
    client.put("/admin/accounts/uid-new/status", headers=admin_headers, json={"status": "approved", "role": "creator"})
    r = client.post("/projects", headers=signed("tok-new"), json=BRIEF)
    assert r.status_code == 201 and r.json()["brief"]["author"] == "creator" and seen == ["creator"]
    client.put("/admin/accounts/uid-new/status", headers=admin_headers, json={"status": "approved", "role": "specialist"})
    assert client.post("/me", headers=signed("tok-new")).json()["role"] == "specialist"
    assert client.post("/projects", headers=signed("tok-new"), json={**BRIEF, "author": "creator"}).json()["brief"]["author"] == "specialist"


def test_editing_the_profile_flags_a_new_specialization(client, signed):
    r = client.put("/me/profile", headers=signed("tok-a"), json=PROFILE)
    assert r.status_code == 200 and r.json()["specialization_changed"] is True
    again = client.put("/me/profile", headers=signed("tok-a"), json={**PROFILE, "phone": "+213 666 00 00 00"})
    assert again.json()["phone"] == "+213 666 00 00 00"
    assert client.put("/me/profile", headers=signed("tok-a"), json={**PROFILE, "phone": "x"}).status_code == 422
    assert client.put("/me/profile", json=PROFILE).status_code == 401


def test_deleting_an_account_keeps_its_published_signatures_without_the_name(client, signed, monkeypatch):
    removed = []
    monkeypatch.setattr(firebase, "delete_user", lambda uid: removed.append(uid) or True)
    store.save_user("uid-c", "c@example.com", "ج", None, "password", {**PROFILE, "full_name": "جميل"})
    client.post("/projects/p1/open", headers=signed("tok-c"))
    signed_r = client.post("/projects/p1/scripts/s1/approve", headers=signed("tok-c"), json={"role": "creator", "name": "جميل"})
    assert signed_r.status_code == 200
    assert client.delete("/me", headers=signed("tok-c")).status_code == 204
    assert removed == ["uid-c"] and store.get_user("uid-c") is None
    approvals = client.get("/projects/p1").json()["scripts"]["s1"]["approvals"]
    assert [(a["name"], a["uid"]) for a in approvals if a["role"] == "creator"] == [(store.ANONYMOUS_CREATOR, None)]
    assert store.list_history("u:uid-c") == []


def test_the_app_can_ask_whether_generation_is_paused(client, monkeypatch):
    from app import flow_settings
    assert client.get("/status").json()["paused"] is False
    real = flow_settings.current()
    monkeypatch.setattr(flow_settings, "current", lambda: real.model_copy(update={"paused": True, "paused_message": "صيانة"}))
    assert client.get("/status").json() == {"paused": True, "message": "صيانة"}


def test_a_report_on_generated_content_reaches_the_admin_who_closes_it(client, signed, admin_headers, monkeypatch):
    r = client.post("/reports", headers=signed("tok-a"), json={"project_id": "p1", "script_id": "s1", "reason": "offensive", "note": "عبارة غير لائقة"})
    assert r.status_code == 201 and r.json()["status"] == "open"
    # a visitor can report too; an unknown version or a made-up reason is refused
    assert client.post("/reports", json={"project_id": "p1", "reason": "wrong_text"}).status_code == 201
    assert client.post("/reports", json={"project_id": "p1", "script_id": "nope", "reason": "other"}).status_code == 404
    assert client.post("/reports", json={"project_id": "p1", "reason": "spam"}).status_code == 422
    open_ = client.get("/admin/reports?status=open", headers=admin_headers).json()
    mine = next(x for x in open_ if x["id"] == r.json()["id"])
    assert mine["email"] == "a@example.com" and mine["reason"] == "offensive" and mine["note"] == "عبارة غير لائقة"
    assert client.get("/admin/overview", headers=admin_headers).json()["totals"]["open_reports"] >= 2
    assert client.put(f"/admin/reports/{mine['id']}", headers=admin_headers, json={"status": "closed"}).status_code == 200
    assert all(x["id"] != mine["id"] for x in client.get("/admin/reports?status=open", headers=admin_headers).json())
    # deleting the account keeps the report, without the reporter
    monkeypatch.setattr(firebase, "delete_user", lambda uid: True)
    client.delete("/me", headers=signed("tok-a"))
    kept = next(x for x in client.get("/admin/reports", headers=admin_headers).json() if x["id"] == mine["id"])
    assert kept["email"] is None


def test_a_signed_in_person_signs_with_the_name_given_at_sign_up(client, signed):
    store.save_user("uid-b", "b@example.com", "ب", None, "password", {**PROFILE, "full_name": "بلال الشريف"})
    client.post("/projects/p1/open", headers=signed("tok-b"))
    r = client.post("/projects/p1/scripts/s1/approve", headers=signed("tok-b"), json={"role": "creator", "name": "اسم آخر"})
    assert r.status_code == 200
    assert [a["name"] for a in r.json()["approvals"] if a["role"] == "creator"] == ["بلال الشريف"]
