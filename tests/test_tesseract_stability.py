from pathlib import Path
import stat
import sys

import pytest

from core.ocr_engine import run_tesseract_png


@pytest.mark.skipif(sys.platform == "win32", reason="POSIX fake executable test")
def test_file_based_tesseract_runner(tmp_path):
    fake = tmp_path / "fake_tesseract.py"
    fake.write_text(
        """#!/usr/bin/env python3
import pathlib, sys
input_path = pathlib.Path(sys.argv[1])
output_base = pathlib.Path(sys.argv[2])
assert input_path.read_bytes() == b'PNGDATA'
output_base.with_suffix('.txt').write_text('hello OCR', encoding='utf-8')
""",
        encoding="utf-8",
    )
    fake.chmod(fake.stat().st_mode | stat.S_IEXEC)

    text, elapsed = run_tesseract_png(
        b"PNGDATA",
        fake,
        timeout_seconds=5,
        retries=0,
    )

    assert text == "hello OCR"
    assert elapsed >= 0


@pytest.mark.skipif(sys.platform == "win32", reason="POSIX fake executable test")
def test_runner_retries_nonzero_exit(tmp_path):
    fake = tmp_path / "fake_fail.py"
    fake.write_text(
        """#!/usr/bin/env python3
import pathlib, sys
counter = pathlib.Path(__file__).with_suffix('.count')
value = int(counter.read_text() or '0') if counter.exists() else 0
counter.write_text(str(value + 1))
if value < 1:
    print('temporary initialization failure', file=sys.stderr)
    raise SystemExit(1)
pathlib.Path(sys.argv[2]).with_suffix('.txt').write_text('retry ok', encoding='utf-8')
""",
        encoding="utf-8",
    )
    fake.chmod(fake.stat().st_mode | stat.S_IEXEC)

    text, _ = run_tesseract_png(
        b"PNGDATA",
        fake,
        timeout_seconds=5,
        retries=2,
    )

    assert text == "retry ok"
