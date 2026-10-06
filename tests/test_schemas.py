from app.schemas import Approval, ChangeRequest, ContentLevel, ReviewRole
from tests.conftest import NOW, make_scene, make_script


def test_creator_alone_is_required_for_a_plain_script():
    s = make_script([make_scene(0, 5, "مرحبا")], [])
    assert [r.role for r in s.required_approvals] == [ReviewRole.creator]
    assert not s.approved


def test_level_c_or_warnings_require_a_scholar():
    s = make_script([make_scene(0, 5, "مرحبا")], [], level=ContentLevel.C)
    assert ReviewRole.scholar in [r.role for r in s.required_approvals]
    w = make_script([make_scene(0, 5, "مرحبا")], [], warnings=["تنبيه"])
    assert ReviewRole.scholar in [r.role for r in w.required_approvals]


def test_approved_once_every_required_role_signed():
    s = make_script([make_scene(0, 5, "مرحبا")], [])
    s.approvals = [Approval(role=ReviewRole.creator, name="يونس", at=NOW)]
    assert s.approved


def test_a_change_request_blocks_approval():
    s = make_script([make_scene(0, 5, "مرحبا")], [])
    s.approvals = [Approval(role=ReviewRole.creator, name="يونس", at=NOW)]
    s.change_requests = [ChangeRequest(role=ReviewRole.scholar, name="مراجع", at=NOW, note="صحّح")]
    assert not s.approved
