from pathlib import Path
from openpyxl import Workbook

from core.pdf_auto_approval import evaluate
from core.pdf_approval import _review_rows


HEADERS = [
    "검토상태", "요청 No.", "제조사", "적용모델", "부품명(영어)",
    "수량", "단가(USD)", "금액(USD)", "신뢰도", "행검증", "원본PDF",
]


def make_review(path: Path, values):
    wb = Workbook()
    ws = wb.active
    ws.title = "PDF_검토대기"
    ws.append(HEADERS)
    ws.append(values)
    wb.save(path)


def test_header_text_is_blocked(tmp_path):
    path = tmp_path / "PDF_검토대기_NC1930.xlsx"
    make_review(path, [
        "미확인", "NC1930", "NC", "1930",
        "ORDER NO. 1930 DATE 19 5 28", 2, 8, 8, 92, "금액불일치", "x.pdf",
    ])
    decision = evaluate(path, 95)
    assert decision.grade == "D"
    assert "문서 제목" in decision.reason or "불일치" in decision.reason


def test_cross_manufacturer_is_blocked(tmp_path):
    path = tmp_path / "PDF_검토대기_NC1911.xlsx"
    make_review(path, [
        "승인", "NC1911", "IR", "NL500",
        "Main board PCB, NL500", 50, 26, 1300, 99, "정상", "x.pdf",
    ])
    decision = evaluate(path, 95)
    assert decision.grade == "D"
    assert "제조사" in decision.reason


def test_zero_price_is_blocked(tmp_path):
    path = tmp_path / "PDF_검토대기_NC1909.xlsx"
    make_review(path, [
        "승인", "NC1909", "NC", "900",
        "Back pad, Gray, 900", 50, 0, 0, 99, "정상", "x.pdf",
    ])
    decision = evaluate(path, 95)
    assert decision.grade == "D"
    assert "단가 오류" in decision.reason


def test_valid_approved_row_passes_final_review(tmp_path):
    path = tmp_path / "PDF_검토대기_NC1911.xlsx"
    make_review(path, [
        "승인", "NC1911", "NC", "NL500",
        "Main board PCB, NL500", 50, 26, 1300, 99, "정상", "x.pdf",
    ])
    records, meta = _review_rows(path)
    assert len(records) == 1
    assert meta["manufacturer"] == "NC"
    assert records[0].model == "NL500"
