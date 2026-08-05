from pathlib import Path

from openpyxl import Workbook

from core.parser import PartRecord
from core.purchase_analyzer import parse_purchase_workbook, _analyze_item


def build_purchase(path: Path):
    wb = Workbook()
    ws = wb.active
    ws.title = "XC"
    ws.append(["부품명", "부품명", "요청수량", "", "단가", "합계"])
    ws.append(["Pad, Back, 1310", "패드, 등, 1310", 20, None, 31.00, 620.00])
    ws.append(["Pad, Back, BR,1320", "패드, 등, BR,1320", 10, None, 31.00, 310.00])
    ws.append(["Pad, Pillow, BR,1320, 1310", "패드, 베개, BR,1320", 20, None, 7.00, 140.00])
    ws.append(["C101110-0400", "패드, 등, L50", 50, None, 30.00, 1500.00])
    wb.save(path)


def test_duplicate_part_headers_and_code_detection(tmp_path):
    path = tmp_path / "purchase.xlsx"
    build_purchase(path)
    items = parse_purchase_workbook(path)

    assert len(items) == 4
    assert items[0].part_name_en == "Pad, Back, 1310"
    assert items[0].part_name_kr == "패드, 등, 1310"
    assert items[0].model == "1310"

    assert items[1].model.startswith("BR1320")
    assert "1310" in items[2].model
    assert items[3].part_no == "C101110-0400"
    assert items[3].part_name_en == ""
    assert items[3].model == "L50"


def test_mixed_layout_matches_master_prices(tmp_path):
    path = tmp_path / "purchase.xlsx"
    build_purchase(path)
    items = parse_purchase_workbook(path)

    records = [
        PartRecord(base_date="2024-01-01", ir_no="XC2401", model="1310",
                   part_name_en="Pad Back 1310", part_name_kr="패드, 등, 1310",
                   price=31.00, source_file="m.xlsx", source_row=2),
        PartRecord(base_date="2024-01-02", ir_no="XC2402", model="BR1320",
                   part_name_en="Pad Back BR1320", part_name_kr="패드, 등, BR1320",
                   price=31.00, source_file="m.xlsx", source_row=3),
        PartRecord(base_date="2024-01-03", ir_no="XC2403", model="BR1320",
                   part_name_en="Pad Pillow BR1320", part_name_kr="패드, 베개, BR1320",
                   price=7.00, source_file="m.xlsx", source_row=4),
        PartRecord(base_date="2024-01-04", ir_no="XC2404", model="L50",
                   part_no="C101110-0400", part_name_kr="패드, 등, L50",
                   price=30.00, source_file="m.xlsx", source_row=5),
    ]

    analyzed = [_analyze_item(item, records) for item in items]
    assert [row.master_latest_price for row in analyzed] == [31.0, 31.0, 7.0, 30.0]
    assert analyzed[3].match_method == "부품코드"
    assert all(row.match_confidence >= 82 for row in analyzed)
