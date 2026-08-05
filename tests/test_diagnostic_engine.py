from pathlib import Path
from openpyxl import Workbook

from core.diagnostic_engine import diagnose_file, quarantine_excluded


def make_price_file(path: Path):
    wb = Workbook()
    ws = wb.active
    ws.title = "NC"
    ws.append(["부품명(Eng)", "부품명(Kor)", "요청수량", "단가", "합계"])
    ws.append(["PCB Main 830A", "PCB 메인 830A", 10, 20, 200])
    wb.save(path)


def make_inventory_file(path: Path):
    wb = Workbook()
    ws = wb.active
    ws.append(["부품명", "현재고", "요청수량"])
    ws.append(["PCB 메인 830A", 3, 10])
    wb.save(path)


def test_price_file_is_a(tmp_path):
    path = tmp_path / "2.NC부품 단가 확인 요청 2104.xlsx"
    make_price_file(path)
    result = diagnose_file(path)
    assert result.category == "A"
    assert result.action == "자동 반영 가능"
    assert result.priced_rows == 1


def test_branch_inventory_is_d(tmp_path):
    path = tmp_path / "부산지사_발주요청서.xlsx"
    make_inventory_file(path)
    result = diagnose_file(path)
    assert result.category == "D"
    assert result.safe_to_exclude


def test_hwp_is_d(tmp_path):
    path = tmp_path / "구매품의(NC).hwp"
    path.write_bytes(b"HWP")
    result = diagnose_file(path)
    assert result.category == "D"


def test_quarantine_never_deletes(tmp_path):
    source = tmp_path / "Update" / "부산지사_발주요청서.xlsx"
    source.parent.mkdir()
    make_inventory_file(source)
    item = diagnose_file(source)

    moved, errors = quarantine_excluded([item], tmp_path / "Excluded")
    assert not errors
    assert len(moved) == 1
    assert moved[0].exists()
    assert not source.exists()
