from pathlib import Path

from core.header_fingerprint import classify_file, fingerprint_workbook
from core.parser import parse_workbook


ACTUAL = Path("/mnt/data/CMC-K1000.xlsx")


def test_actual_k1000_fingerprint():
    result = fingerprint_workbook(ACTUAL)
    assert result.parser_type == "LEGACY-C"
    assert result.confidence >= 95
    assert result.header_row == 3


def test_actual_k1000_content_manufacturer():
    result = classify_file(ACTUAL, None)
    assert result["manufacturer"] == "KA"
    assert result["manufacturer_confidence"] >= 90
    assert result["parser_type"] == "LEGACY-C"


def test_actual_k1000_rows_unchanged():
    rows = parse_workbook(ACTUAL)
    assert len(rows) == 2
    assert all(row.model == "K1000" for row in rows)
    assert [row.price for row in rows] == [6.5, 27.9]
    assert all(row.qty is None for row in rows)
