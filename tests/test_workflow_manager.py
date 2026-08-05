from pathlib import Path

from openpyxl import Workbook

from core.workflow_manager import build_workflow_report


def _save_book(path: Path, sheet: str, headers: list[str]):
    wb = Workbook()
    ws = wb.active
    ws.title = sheet
    ws.append(headers)
    ws.append(["P1", "부품", 1, 2] if len(headers) == 4 else ["P1", "부품", 1])
    wb.save(path)


def test_workflow_classifies_pending_and_completed(tmp_path: Path):
    (tmp_path / "Update").mkdir()
    (tmp_path / "Log").mkdir()
    _save_book(tmp_path / "Update" / "필요 부품 취합.xlsx", "Sheet1", ["부품코드", "부품명", "수량"])
    _save_book(tmp_path / "Update" / "IR260101.xlsx", "IR", ["부품코드", "부품명", "수량", "단가"])
    manifest = tmp_path / "Log" / "processed_manifest_20260101_010101.csv"
    manifest.write_text(
        "manufacturer,filename,request_no,revision_rank,parsed_rows,new_raw_rows,price_changes_by_request,archived_to,status\n"
        "XC,XC260101.xlsx,XC260101,0,3,3,0,Archive/XC/XC260101.xlsx,archived\n",
        encoding="utf-8",
    )
    report = build_workflow_report(tmp_path, write_files=True)
    assert report.counts["일반 업데이트 대기"] == 1
    assert report.counts["수요이력 대기"] == 1
    assert report.counts["처리 완료(Archive)"] == 1
    assert Path(report.json_path).exists()
    assert Path(report.excel_path).exists()
