"""The HTTP layer around a seeded project: everything that does not need the model."""
import pytest
from fastapi.testclient import TestClient

from app import main, store
from app.schemas import Video, VideoStatus
from tests.conftest import NOW, make_project, make_scene, make_script, quoted_ref


@pytest.fixture
def client(quran_evidence, monkeypatch):
    script = make_script([make_scene(0, 10, "مرحبا", ["Q1"])], [quoted_ref(quran_evidence)])
    store.save(make_project(script, [quran_evidence]))
    started = []

    def fake_start(project_id, script, template_id, preview=False):
        v = Video(id=f"v{len(started)+1}", project_id=project_id, script_id=script.id, template=template_id,
                  preview=preview, status=VideoStatus.queued, created_at=NOW)
        store.save_video(v); started.append(v)
        return v

    monkeypatch.setattr(main.render, "start", fake_start)
    c = TestClient(main.app)
    c.started = started
    return c


def test_docs_and_templates(client):
    assert client.get("/openapi.json").status_code == 200
    templates = client.get("/video/templates").json()
    assert {t["id"] for t in templates} >= {"captions", "geo", "kids", "chalk", "teaser"}
    assert all("typical_seconds" in t for t in templates)


def test_project_round_trip(client):
    p = client.get("/projects/p1").json()
    assert p["id"] == "p1" and "s1" in p["scripts"]
    assert p["scripts"]["s1"]["references"][0]["source"].startswith("سورة")


def test_admin_is_disabled_without_a_token(client):
    assert client.get("/admin/settings").status_code == 503


def test_story_template_needs_a_story_before_rendering(client):
    r = client.post("/projects/p1/scripts/s1/videos", json={"template": "kids"})
    assert r.status_code == 409


def test_video_before_approval_is_a_watermarked_preview(client):
    r = client.post("/projects/p1/scripts/s1/videos", json={"template": "captions"})
    assert r.status_code == 202 and r.json()["preview"] is True
    assert client.get("/projects/p1/scripts/s1/videos").json()[0]["id"] == r.json()["id"]


def test_change_request_locks_the_version_and_blocks_that_role(client):
    r = client.post("/projects/p1/scripts/s1/request-changes", json={"role": "creator", "name": "يونس", "note": "عدّل المشهد 2"})
    assert r.status_code == 200 and r.json()["approved"] is False
    assert client.post("/projects/p1/scripts/s1/approve", json={"role": "creator", "name": "يونس"}).status_code == 409


def test_approval_unlocks_the_final_video(client):
    r = client.post("/projects/p1/scripts/s1/approve", json={"role": "creator", "name": "يونس", "note": "تمام"})
    assert r.status_code == 200 and r.json()["approved"] is True
    assert r.json()["approvals"][0]["note"] == "تمام"
    v = client.post("/projects/p1/scripts/s1/videos", json={"template": "captions"}).json()
    assert v["preview"] is False


def test_unknown_template_is_rejected(client):
    assert client.put("/projects/p1/scripts/s1/template", json={"template": "nope"}).status_code in (400, 404, 422)


def test_missing_project_is_404(client):
    assert client.get("/projects/none").status_code == 404
