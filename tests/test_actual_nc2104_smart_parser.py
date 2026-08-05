from pathlib import Path

from core.parser import (
    diagnose_workbook,
    infer_ir_no,
    infer_manufacturer,
    parse_workbook,
)


ACTUAL = Path("/mnt/data/2.NC부품 단가 확인 요청 2104 - 회신.xlsx")


def test_actual_filename_classification():
    assert ACTUAL.exists()
    assert infer_manufacturer(ACTUAL) == "NC"
    assert infer_ir_no(ACTUAL) == "NC2104"


def test_actual_workbook_extracts_only_price_sheet():
    records = parse_workbook(ACTUAL)

    assert len(records) == 61
    assert sum(row.price is not None for row in records) == 61
    assert all(row.ir_no == "NC2104" for row in records)
    assert all(row.qty and row.qty > 0 for row in records)

    first = records[0]
    assert first.model == "830A"
    assert first.part_name_en == "PCB, Main, 830A"
    assert first.qty == 10
    assert first.price == 20
    assert first.amount == 200
    assert first.parameter == "1년 사용량: 4"


def test_actual_formula_cached_totals_and_models():
    records = parse_workbook(ACTUAL)
    by_name = {row.part_name_en: row for row in records}

    assert by_name["PU Cover, Feet, 730"].amount == 1430
    assert by_name["Remote controller, 880"].amount == 1000
    assert by_name["Inner Cloth, Feet, L30"].model == "L30"


def test_actual_diagnosis():
    result = diagnose_workbook(ACTUAL)
    assert result["manufacturer"] == "NC"
    assert result["request_no"] == "NC2104"
    assert result["total_rows"] == 61
    assert result["priced_rows"] == 61
    assert any(
        sheet["sheet"] == "NC"
        and sheet["parser"] == "legacy_price_request"
        and sheet["extracted_rows"] == 61
        for sheet in result["sheets"]
    )
    assert any(
        sheet["sheet"] == "NC추가 유상발주 (2)"
        and sheet["parser"] == "supplementary_excluded"
        and sheet["extracted_rows"] == 0
        for sheet in result["sheets"]
    )
