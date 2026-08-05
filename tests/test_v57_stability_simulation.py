from pathlib import Path
import stat
import sys

import pytest
from openpyxl import Workbook

from core.diagnostic_engine import diagnose_file, simulate_update
from core.ocr_engine import run_tesseract_png


@pytest.mark.skipif(sys.platform == "win32", reason="POSIX fake executable")
def test_ocr_runs_in_isolated_worker(tmp_path):
    fake = tmp_path / "fake_tesseract.py"
    fake.write_text(
        """#!/usr/bin/env python3
import pathlib, sys
pathlib.Path(sys.argv[2]).with_suffix('.txt').write_text(
    'worker ok', encoding='utf-8'
)
""",
        encoding="utf-8",
    )
    fake.chmod(fake.stat().st_mode | stat.S_IEXEC)

    text, elapsed = run_tesseract_png(
        b"PNGDATA", fake, timeout_seconds=5, retries=0
    )
    assert text == "worker ok"
    assert elapsed >= 0


def make_unpriced(path: Path):
    wb = Workbook()
    ws = wb.active
    ws.title = "CMC-"
    ws.append(["Spare Parts Request"])
    ws.append(["2020-12-16"])
    ws.append([
        "NO", "PART NAME", "PART NAME(korean)",
        "IMAGE", "QTY(PCS)", "Price(USD)", "Total",
    ])
    ws.append([1, "Pad Back X8000", "패드 등 X8000", None, None, None, None])
    wb.save(path)


def test_unpriced_request_has_clear_action(tmp_path):
    path = tmp_path / "XC 2012유상발주건 단가요청 201216.xlsx"
    make_unpriced(path)
    item = diagnose_file(path)
    assert item.category == "D"
    assert item.action == "단가 미회신 요청서 보관"
    assert item.safe_to_exclude


def test_simulation_is_empty_without_a_grade_files(tmp_path):
    (tmp_path / "Update").mkdir()
    assert simulate_update(tmp_path, []) == []
