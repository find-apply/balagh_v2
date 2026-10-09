"""The admin signs in with a username and password; featured ratings and published projects reach the public showcase."""
from datetime import datetime, timezone

import pytest

from app import admin, store
from app.schemas import Video, VideoStatus
from tests.conftest import make_project, make_scene, make_script, quoted_ref

NOTE = "الفيديو واضح والتلاوة جميلة والشرح مناسب للشباب لكن الخط صغير قليلا"
ROOT = {"Authorization": "Bearer root"}


@pytest.fixture
def admin_client(client, monkeypatch):
    monkeypatch.setenv("ADMIN_TOKEN", "root")
    admin._failures.clear()
    assert client.put("/admin/account", json={"username": "admin", "password": "correct horse"}, headers=ROOT).status_code == 200
    return client


def _login(client, password="correct horse"):
    return client.post("/admin/login", json={"username": "admin", "password": password})


def test_a_username_and_password_open_a_session(admin_client):
    r = _login(admin_client)
    assert r.status_code == 200
    session = {"Authorization": f"Bearer {r.json()['token']}"}
    assert admin_client.get("/admin/session", headers=session).status_code == 200
    assert admin_client.get("/admin/session", headers={"Authorization": "Bearer forged.abc"}).status_code == 401


def test_a_wrong_password_is_refused_and_repeated_tries_are_locked_out(admin_client):
    for _ in range(5):
        assert _login(admin_client, "wrong").status_code == 401
    assert _login(admin_client).status_code == 429


def test_changing_the_password_ends_old_sessions(admin_client):
    old = {"Authorization": f"Bearer {_login(admin_client).json()['token']}"}
    admin_client.put("/admin/account", json={"username": "admin", "password": "another long one"}, headers=old)
    assert admin_client.get("/admin/session", headers=old).status_code == 401
    assert _login(admin_client, "another long one").status_code == 200


def test_a_short_password_is_refused(admin_client):
    assert admin_client.put("/admin/account", json={"username": "admin", "password": "short"}, headers=ROOT).status_code == 422


def test_featured_ratings_and_published_projects_reach_the_showcase(admin_client, quran_evidence):
    # a project of its own: the test database is shared, and other tests count the videos of p1/s1
    script = make_script([make_scene(0, 10, "مرحبا", ["Q1"])], [quoted_ref(quran_evidence)], script_id="pubs")
    store.save(make_project(script, [quran_evidence]).model_copy(update={"id": "pub1"}))
    store.save_video(Video(id="sv1", project_id="pub1", script_id="pubs", template="captions", status=VideoStatus.done,
                           url="/media/sv1.mp4", created_at=datetime.now(timezone.utc)))
    shown = admin_client.post("/videos/sv1/feedback", json={"stars": 5, "role": "sheikh", "name": "الشيخ", "comment": NOTE}).json()
    admin_client.post("/videos/sv1/feedback", json={"stars": 1, "role": "other", "name": "مشاهد", "comment": NOTE})
    assert admin_client.get("/showcase").json() == {"ratings": [], "projects": []}

    assert admin_client.put(f"/admin/feedback/{shown['id']}/featured", json={"featured": True}, headers=ROOT).status_code == 200
    assert admin_client.put("/admin/projects/pub1/published", json={"published": True}, headers=ROOT).status_code == 200
    pub = admin_client.get("/showcase").json()
    assert [r["name"] for r in pub["ratings"]] == ["الشيخ"]
    assert [(p["project_id"], p["script_id"], p["video_url"]) for p in pub["projects"]] == [("pub1", "pubs", "/media/sv1.mp4")]
    assert [p["published"] for p in admin_client.get("/admin/projects", headers=ROOT).json() if p["id"] == "pub1"] == [True]

    admin_client.put("/admin/projects/pub1/published", json={"published": False}, headers=ROOT)
    assert admin_client.get("/showcase").json()["projects"] == []
    assert admin_client.put("/admin/projects/nope/published", json={"published": True}, headers=ROOT).status_code == 404
