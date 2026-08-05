from pathlib import Path

from openpyxl import Workbook

from core.pdf_auto_approval import evaluate


def make_empty_review(path: Path) -> None:
    wb = Workbook()
    ws = wb.active
    ws.title = "PDF_검토대기"
    ws.append([
        "검토상태", "요청 No.", "제조사", "적용모델", "부품명(영어)",
        "수량", "단가(USD)", "금액(USD)", "신뢰도", "행검증",
    ])
    wb.save(path)


def test_empty_pdf_review_is_d_and_zero_score(tmp_path: Path):
    path = tmp_path / "PDF_검토대기_AC2061.xlsx"
    make_empty_review(path)

    decision = evaluate(path, 95)

    assert decision.grade == "D"
    assert decision.decision == "반영금지"
    assert decision.score == 0
    assert "추출된 부품 행 없음" in decision.reason
    assert "요청번호 불일치" in decision.reason
    assert "제조사 불일치" in decision.reason
