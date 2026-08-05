from pathlib import Path

from openpyxl import Workbook

from core.parser import infer_ir_no, infer_manufacturer, parse_workbook


def test_nc_cozyma_paid_order_language_columns_are_not_swapped(tmp_path: Path):
    path = tmp_path / "[COZYMA] NC_유상발주 요청 리스트 최종_230216 [해외사업팀 검토].xlsx"
    wb = Workbook()
    ws = wb.active
    ws.title = "NC"
    ws.append(["부품명", "부품명(Eng)", "발주수량", "단가", "합계", "비고"])
    ws.append(["PU커버, 발, L30", "PU Cover, Foot, L30", 20, 8, 160, ""])
    wb.save(path)

    assert infer_manufacturer(path) == "NC"
    assert infer_ir_no(path) == "NC230216"
    rows = parse_workbook(path)
    assert len(rows) == 1
    assert rows[0].part_name_kr == "PU커버, 발, L30"
    assert rows[0].part_name_en == "PU Cover, Foot, L30"
    assert rows[0].qty == 20
    assert rows[0].price == 8
    assert rows[0].amount == 160
