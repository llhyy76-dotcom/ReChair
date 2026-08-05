from pathlib import Path
import shutil

from core.history_repository import load_history_rows


SAMPLE = Path("/mnt/data/History_2026.xlsx")


def test_uploaded_history_file_loads_expected_rows(tmp_path):
    if not SAMPLE.exists():
        return
    history_dir = tmp_path / "History"
    history_dir.mkdir()
    shutil.copy2(SAMPLE, history_dir / SAMPLE.name)

    rows = load_history_rows(history_dir)

    assert len(rows) == 4577
    assert sum(row.category == "가격이력" for row in rows) == 133
    assert sum(row.category == "변경이력" for row in rows) == 4444
