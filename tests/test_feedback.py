"""A finished video can be rated with stars, the rater's standing and name, and a remark of ten words or more; the admin sees each template's average."""
from datetime import datetime, timezone

from app import store
from app.schemas import Video, VideoStatus

NOTE = "الفيديو واضح والتلاوة جميلة والشرح مناسب للشباب لكن الخط صغير قليلا"


def _video(vid: str, status=VideoStatus.done, template="captions") -> Video:
    v = Video(id=vid, project_id="p1", script_id="s1", template=template, status=status, created_at=datetime.now(timezone.utc))
    store.save_video(v)
    return v


def test_a_finished_video_takes_a_rating(client):
    _video("v1")
    r = client.post("/videos/v1/feedback", json={"stars": 5, "role": "sheikh", "name": "الشيخ أحمد", "comment": NOTE})
    assert r.status_code == 201
    assert r.json()["template"] == "captions"
    rows = client.get("/videos/v1/feedback").json()
    assert [(f["stars"], f["role"], f["name"]) for f in rows] == [(5, "sheikh", "الشيخ أحمد")]


def test_a_rating_needs_valid_stars_role_and_name(client):
    _video("v1")
    for bad in ({"stars": 0, "role": "student", "name": "علي", "comment": NOTE}, {"stars": 6, "role": "student", "name": "علي", "comment": NOTE},
                {"stars": 3, "role": "mufti", "name": "علي", "comment": NOTE}, {"stars": 3, "role": "student", "name": "", "comment": NOTE},
                {"stars": 3, "role": "student", "name": "علي"}, {"stars": 3, "role": "student", "name": "علي", "comment": "جيد جدا بارك الله فيكم"}):
        assert client.post("/videos/v1/feedback", json=bad).status_code == 422


def test_an_unfinished_or_missing_video_cannot_be_rated(client):
    _video("v2", status=VideoStatus.rendering)
    body = {"stars": 4, "role": "student", "name": "علي", "comment": NOTE}
    assert client.post("/videos/v2/feedback", json=body).status_code == 409
    assert client.post("/videos/nope/feedback", json=body).status_code == 404


def test_the_admin_sees_each_templates_average(client, monkeypatch):
    monkeypatch.setenv("ADMIN_TOKEN", "t")
    # the test database is shared, so this test rates templates no other test rates
    _video("fa", template="chalk")
    _video("fb", template="teaser")
    for stars, role in ((5, "scholar"), (3, "student")):
        client.post("/videos/fa/feedback", json={"stars": stars, "role": role, "name": "فلان", "comment": NOTE})
    client.post("/videos/fb/feedback", json={"stars": 2, "role": "other", "name": "فلان", "comment": NOTE})
    report = client.get("/admin/feedback", headers={"Authorization": "Bearer t"}).json()
    by = {t["template"]: t for t in report["templates"]}
    assert by["chalk"]["average"] == 4 and by["chalk"]["ratings"] == 2
    assert by["chalk"]["by_role"] == {"scholar": 1, "student": 1}
    assert by["teaser"]["average"] == 2
    assert by["kids"]["ratings"] == 0 and by["kids"]["average"] is None


def test_the_library_lists_this_clients_finished_videos_newest_first(client):
    from datetime import timedelta
    store.remember("lib-client", "p1", shared=False)
    now = datetime.now(timezone.utc)
    for vid, status, age in (("lib-old", VideoStatus.done, 2), ("lib-new", VideoStatus.done, 1), ("lib-running", VideoStatus.rendering, 0)):
        store.save_video(Video(id=vid, project_id="p1", script_id="s1", template="captions", status=status,
                               url=f"/media/{vid}.mp4", created_at=now - timedelta(hours=age)))
    rows = client.get("/library", headers={"X-Client-Id": "lib-client"}).json()
    ids = [r["video"]["id"] for r in rows]
    assert ids.index("lib-new") < ids.index("lib-old") and "lib-running" not in ids
    assert client.get("/library").json() == []
    assert client.get("/library", headers={"X-Client-Id": "someone-else"}).json() == []
