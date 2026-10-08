"""Signing in a reviewer's role needs an invitation for that project and role; the creator cannot issue the scholar's."""
from app import store
from tests.conftest import make_project, make_scene, make_script, quoted_ref
from app.schemas import AuthorRole


def _creator_script(client, quran_evidence):
    s = make_script([make_scene(0, 10, "مرحبا", ["Q1"])], [quoted_ref(quran_evidence)], author=AuthorRole.creator)
    store.save(make_project(s, [quran_evidence]))


def test_scholar_signature_without_an_invitation_is_refused(client, quran_evidence):
    _creator_script(client, quran_evidence)
    r = client.post("/projects/p1/scripts/s1/approve", json={"role": "scholar", "name": "أي أحد"})
    assert r.status_code == 403
    r = client.post("/projects/p1/scripts/s1/request-changes", json={"role": "scholar", "name": "أي أحد", "note": "غيّر"})
    assert r.status_code == 403
    assert client.get("/projects/p1").json()["scripts"]["s1"]["approvals"] == []


def test_the_creator_cannot_invite_a_scholar(client):
    assert client.post("/projects/p1/invites", json={"role": "scholar"}).status_code == 403


def test_a_platform_invitation_lets_the_scholar_sign(client, quran_evidence):
    _creator_script(client, quran_evidence)
    token = store.add_invite("p1", "scholar", "admin")
    client.post("/projects/p1/scripts/s1/approve", json={"role": "creator", "name": "يونس"})
    r = client.post("/projects/p1/scripts/s1/approve", json={"role": "scholar", "name": "الشيخ", "invite": token})
    assert r.status_code == 200 and r.json()["approved"] is True


def test_an_invitation_is_bound_to_its_project_and_role(client, quran_evidence):
    _creator_script(client, quran_evidence)
    language = client.post("/projects/p1/invites", json={"role": "language"}).json()["token"]
    assert client.post("/projects/p1/scripts/s1/approve", json={"role": "scholar", "name": "الشيخ", "invite": language}).status_code == 403
    other = store.add_invite("p2", "scholar", "admin")
    assert client.post("/projects/p1/scripts/s1/approve", json={"role": "scholar", "name": "الشيخ", "invite": other}).status_code == 403
