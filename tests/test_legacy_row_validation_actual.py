from pathlib import Path

from core.diagnostic_engine import diagnose_file, is_unpriced_request_file
from core.parser import parse_workbook


ROOT = Path("/mnt/data/PI_NC2049_complete")


def test_ir2012_price_only_rows_are_kept():
    path = ROOT / "IR 2012 단가확인요청 201218.xlsx"
    rows = parse_workbook(path)
    assert len(rows) == 4
    assert [row.price for row in rows] == [7.14, 5.71, 5.71, 10.0]
    assert all(row.qty is None for row in rows)
    assert all("price_only_legacy_row" in row.extraction_method for row in rows)


def test_ka2012_price_only_row_is_kept():
    path = ROOT / "KA 2012 단가확인요청 201216.xlsx"
    rows = parse_workbook(path)
    assert len(rows) == 1
    assert rows[0].model == "K1000"
    assert rows[0].price == 6.5
    assert rows[0].qty is None


def test_xc201105_is_unpriced_request_not_parse_error():
    path = ROOT / "5. XC단가확인 파일 201105.xlsx"
    unpriced, reason = is_unpriced_request_file(path)
    assert unpriced
    assert "단가 0행" in reason
    result = diagnose_file(path)
    assert result.category == "D"
    assert result.action == "단가 미회신 요청서 보관"


def test_xc2012_is_unpriced_request_not_parse_error():
    path = ROOT / "XC 2012유상발주건 단가요청 201216.xlsx"
    unpriced, reason = is_unpriced_request_file(path)
    assert unpriced
    result = diagnose_file(path)
    assert result.action == "단가 미회신 요청서 보관"
