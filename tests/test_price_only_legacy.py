from pathlib import Path
from openpyxl import Workbook

from core.parser import parse_workbook


def test_price_only_supplier_reply_is_kept(tmp_path):
    path = tmp_path / "IR 2012 단가확인요청 201218.xlsx"
    wb = Workbook()
    ws = wb.active
    ws.title = "CMC-"
    ws.append(["Spare Parts Request"])
    ws.append(["2020-12-16"])
    ws.append(["NO", "PART NAME", "PART NAME(korean)", "IMAGE", "QTY(PCS)", "Price(USD)", "Total"])
    ws.append([1, "Inner Cloth, Feet, A383", "속천, 발, A383", None, None, 7.14, None])
    wb.save(path)

    rows = parse_workbook(path)
    assert len(rows) == 1
    assert rows[0].model == "A383"
    assert rows[0].qty is None
    assert rows[0].price == 7.14
    assert rows[0].amount is None
    assert "price_only_legacy_row" in rows[0].extraction_method
