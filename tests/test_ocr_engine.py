from pathlib import Path

from core.ocr_engine import (
    OcrFileLog,
    check_ocr_health,
    find_tesseract,
    write_ocr_log,
)


def test_missing_tesseract_is_a_safe_health_result(tmp_path):
    missing = tmp_path / "does-not-exist" / "tesseract.exe"
    health = check_ocr_health(missing, "eng")
    # PATH may contain Tesseract on a developer PC; either result must be non-throwing.
    assert health.display_status in {"정상", "언어팩 확인 필요", "미설치"}
    assert isinstance(health.message, str)


def test_find_tesseract_accepts_configured_executable(tmp_path):
    executable = tmp_path / "tesseract.exe"
    executable.write_text("", encoding="utf-8")
    assert find_tesseract(executable) == executable


def test_ocr_log_is_written(tmp_path):
    path = write_ocr_log(
        tmp_path,
        [
            OcrFileLog(
                filename="sample.pdf",
                classification="SCAN",
                status="검토대기 생성",
                extraction_mode="OCR 미설치 - 수동 입력 필요",
                page_count=2,
                extracted_rows=0,
                elapsed_seconds=1.2,
                tesseract="",
                language="eng",
                message="미설치",
            )
        ],
    )
    assert path.exists()
    text = path.read_text(encoding="utf-8-sig")
    assert "sample.pdf" in text
    assert "검토대기 생성" in text
