import json
from pathlib import Path

import pytest

from core.approval_queue import load_approval_queue, save_approval_queue


def _report(tmp_path: Path) -> Path:
    log = tmp_path / "Log"
    log.mkdir()
    path = log / "MultiDoc_Analysis_20260804_000000.json"
    path.write_text(json.dumps({
        "items": [
            {"file": "a.xlsx", "sheet": "IR", "manufacturer": "IR", "document_type": "제조사 발주/회신", "rows_estimated": 10, "mapped_fields": ["part_kr", "price"], "safe_action": "검토 후 단가 반영 가능", "reason": "ok"},
            {"file": "a.xlsx", "sheet": "종합", "manufacturer": "", "document_type": "참고/원시데이터", "rows_estimated": 3, "mapped_fields": [], "safe_action": "Master 반영 금지", "reason": "blocked"},
        ]
    }, ensure_ascii=False), encoding="utf-8")
    return path


def test_queue_blocks_non_approvable_and_saves_without_master(tmp_path: Path):
    report = _report(tmp_path)
    queue = load_approval_queue(report)
    assert queue.items[0].approvable is True
    assert queue.items[1].approvable is False
    queue.items[0].decision = "승인"
    json_path, excel_path = save_approval_queue(tmp_path, queue)
    assert json_path.exists() and excel_path.exists()
    payload = json.loads(json_path.read_text(encoding="utf-8"))
    assert payload["master_changed"] is False
    assert payload["approved_count"] == 1


def test_queue_rejects_illegal_approval(tmp_path: Path):
    queue = load_approval_queue(_report(tmp_path))
    queue.items[1].decision = "승인"
    with pytest.raises(ValueError):
        save_approval_queue(tmp_path, queue)
