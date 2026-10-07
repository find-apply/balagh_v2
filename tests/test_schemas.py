from app.schemas import Approval, AuthorRole, ChangeRequest, ContentLevel, ReviewRole
from tests.conftest import NOW, make_scene, make_script


def test_a_specialist_approves_their_own_script_alone():
    s = make_script([make_scene(0, 5, "مرحبا")], [], author=AuthorRole.specialist, level=ContentLevel.C, warnings=["تنبيه"])
    assert [r.role for r in s.required_approvals] == [ReviewRole.creator]
    assert not s.approved


def test_a_creator_always_needs_a_scholar():
    s = make_script([make_scene(0, 5, "مرحبا")], [], author=AuthorRole.creator)
    assert [r.role for r in s.required_approvals] == [ReviewRole.creator, ReviewRole.scholar]
    c = make_script([make_scene(0, 5, "مرحبا")], [], author=AuthorRole.creator, level=ContentLevel.C)
    assert "خلافية" in next(r.reason for r in c.required_approvals if r.role == ReviewRole.scholar)


def test_a_localized_version_needs_a_language_reviewer_whoever_wrote_it():
    s = make_script([make_scene(0, 5, "مرحبا")], [], author=AuthorRole.specialist)
    s.localized_from = "s0"
    assert [r.role for r in s.required_approvals] == [ReviewRole.creator, ReviewRole.language]


def test_approved_once_every_required_role_signed():
    s = make_script([make_scene(0, 5, "مرحبا")], [])
    s.approvals = [Approval(role=ReviewRole.creator, name="يونس", at=NOW)]
    assert s.approved


def test_a_change_request_blocks_approval():
    s = make_script([make_scene(0, 5, "مرحبا")], [])
    s.approvals = [Approval(role=ReviewRole.creator, name="يونس", at=NOW)]
    s.change_requests = [ChangeRequest(role=ReviewRole.scholar, name="مراجع", at=NOW, note="صحّح")]
    assert not s.approved
