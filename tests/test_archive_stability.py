import json
from pathlib import Path

from core.updater import Updater


def _updater(tmp_path: Path) -> Updater:
    config_dir = tmp_path / "Config"
    config_dir.mkdir()
    (config_dir / "config.json").write_text(
        json.dumps({
            "manufacturers": ["IR", "XC", "AC", "KA", "NC"],
            "update": "Update",
            "archive": "Archive",
            "backup": "Backup",
            "log": "Log",
            "manufacturer_root": "Manufacturers",
            "history": "History",
        }),
        encoding="utf-8",
    )
    return Updater(tmp_path)


def test_archive_moves_and_verifies_file(tmp_path):
    updater = _updater(tmp_path)
    updater.update_dir.mkdir()
    source = updater.update_dir / "IR2601_CMC-A100_FOC_Spare_Parts_Request.xlsx"
    source.write_bytes(b"test workbook bytes")

    archived = updater._archive_files([source])

    assert source in archived
    assert not source.exists()
    assert archived[source].exists()
    assert archived[source].read_bytes() == b"test workbook bytes"
    assert updater.last_archive_errors == {}


def test_archive_missing_file_is_reported_without_crash(tmp_path):
    updater = _updater(tmp_path)
    source = updater.update_dir / "IR_missing.xlsx"

    archived = updater._archive_files([source])

    assert archived == {}
    assert source in updater.last_archive_errors
