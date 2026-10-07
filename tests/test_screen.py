"""The code-side screen of the brief: personal cases are referred before any model runs, disputed matters are
raised to level C; and a reviewer who asked for changes stays required on the corrected versions."""
from datetime import datetime, timezone

from app import screen
from app.schemas import Approval, AuthorRole, ChangeRequest, ContentLevel, ReviewRole
from tests.conftest import make_scene, make_script

NOW = datetime.now(timezone.utc)


def test_a_personal_case_is_caught_however_it_is_spelled():
    assert screen.personal_case("طلّقت زوجتي ثلاثا في مجلس واحد، هل يقع الطلاق؟")
    assert screen.personal_case("هل يجوز لي أن أفطر لأني مريض؟")
    assert screen.personal_case("Is my marriage valid if the wali was absent?")
    assert screen.personal_case("نَذَرْتُ أن أصوم شهرا ولم أستطع، هل عليّ كفارة؟")


def test_a_general_topic_is_not_a_personal_case():
    assert screen.personal_case("فضل صلاة الفجر") is None
    assert screen.personal_case("لماذا يبتلي الله الناس؟") is None
    assert screen.personal_case("أحكام الطلاق في الإسلام بشكل عام") is None
    assert screen.personal_case(None) is None


def test_a_disputed_matter_is_flagged():
    assert screen.disputed("ما حكم الموسيقى في الإسلام؟")
    assert screen.disputed("Is crypto halal?")
    assert screen.disputed("الصدق في البيع والشراء") is None


def test_a_role_that_asked_for_changes_must_sign_the_correction():
    s = make_script([make_scene(0, 5, "مرحبا")], [], author=AuthorRole.specialist)
    assert [r.role for r in s.required_approvals] == [ReviewRole.creator]
    s.must_recheck = [ReviewRole.scholar]
    assert [r.role for r in s.required_approvals] == [ReviewRole.creator, ReviewRole.scholar]
    s.approvals = [Approval(role=ReviewRole.creator, name="شيخ", at=NOW)]
    assert not s.approved
    s.approvals.append(Approval(role=ReviewRole.scholar, name="مراجع", at=NOW))
    assert s.approved


def test_export_is_refused_until_approved(client):
    r = client.get("/projects/p1/scripts/s1/export")
    assert r.status_code == 423 and "مقفل" in r.json()["detail"]
    client.post("/projects/p1/scripts/s1/approve", json={"role": "creator", "name": "يونس"})
    assert client.get("/projects/p1/scripts/s1/export").status_code == 200
