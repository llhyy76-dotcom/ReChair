from pathlib import Path

from openpyxl import Workbook

from core.workflow_wizard import build_workflow_wizard_state


def _save_book(path: Path, sheet: str, headers: list[str]):
    wb = Workbook()
    ws = wb.active
    ws.title = sheet
    ws.append(headers)
    ws.append(["P1", "부품", 1, 2] if len(headers) == 4 else ["P1", "부품", 1])
    wb.save(path)


def test_wizard_recommends_safety_first(tmp_path: Path):
    (tmp_path / "Update").mkdir()
    (tmp_path / "Log").mkdir()
    _save_book(tmp_path / "Update" / "IR260101.xlsx", "IR", ["부품코드", "부품명", "수량", "단가"])
    state = build_workflow_wizard_state(tmp_path)
    assert state.next_action_key == "safety"
    assert state.steps[0].status == "필요"


def test_wizard_recommends_standard_simulation_after_safety(tmp_path: Path):
    (tmp_path / "Update").mkdir()
    (tmp_path / "Log").mkdir()
    _save_book(tmp_path / "Update" / "IR260101.xlsx", "IR", ["부품코드", "부품명", "수량", "단가"])
    (tmp_path / "Log" / "Safety_Check_Latest.json").write_text('{"passed": true, "score": 100}', encoding="utf-8")
    state = build_workflow_wizard_state(tmp_path)
    assert state.next_action_key == "simulate"
    assert "일반 업데이트" in state.next_action_label
