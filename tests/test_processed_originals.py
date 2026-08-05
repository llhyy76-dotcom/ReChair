import json
from pathlib import Path

from core.processed_originals import inspect_processed_originals, move_processed_originals


def test_processed_original_cleanup_requires_verified_archive(tmp_path: Path):
    root = tmp_path
    (root / "Update").mkdir()
    (root / "Log").mkdir()
    (root / "Approval").mkdir()
    src = root / "Update" / "mixed.xlsx"
    src.write_bytes(b"same-data")

    approval = root / "Approval" / "approval.json"
    approval.write_text(json.dumps({"items": [{"file": "mixed.xlsx", "decision": "승인"}]}), encoding="utf-8")
    commit = root / "Log" / "Approval_Apply_COMMIT_20260805_120000.json"
    commit.write_text(json.dumps({"passed": True, "mode": "COMMIT", "approval_file": str(approval)}), encoding="utf-8")

    preview = inspect_processed_originals(root)
    assert preview.eligible == 0
    assert preview.items[0].status == "정리 차단"

    archive = root / "Archive" / "ApprovedMultiDoc" / "20260805_120000"
    archive.mkdir(parents=True)
    (archive / "mixed.xlsx").write_bytes(b"same-data")

    preview = inspect_processed_originals(root)
    assert preview.eligible == 1
    report = move_processed_originals(root)
    assert report.passed
    assert report.moved == 1
    assert not src.exists()
    assert list((root / "Processed_Originals").glob("*/mixed.xlsx"))
