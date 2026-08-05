from __future__ import annotations

import json
import shutil
from pathlib import Path

from openpyxl import Workbook

from core.simulator import UpdateSimulator, _snapshot_master


def _make_root(tmp_path: Path) -> Path:
    root = tmp_path / "CPMS"
    (root / "Config").mkdir(parents=True)
    (root / "Update").mkdir()
    (root / "History").mkdir()
    (root / "Archive").mkdir()
    (root / "Backup").mkdir()
    (root / "Log").mkdir()
    (root / "Config" / "config.json").write_text(
        json.dumps({
            "manufacturer_root": "Manufacturers",
            "manufacturers": ["IR"],
            "update": "Update",
            "archive": "Archive",
            "backup": "Backup",
            "log": "Log",
            "history": "History",
            "max_files_per_run": 0,
            "fuzzy_threshold": 99,
        }),
        encoding="utf-8",
    )
    master = root / "Manufacturers" / "IR" / "Master" / "Master.xlsx"
    master.parent.mkdir(parents=True)
    wb = Workbook()
    ws = wb.active
    ws.title = "원본상세"
    ws.append(["MODEL", "PART NAME", "PRICE", "SOURCE FILE"])
    wb.save(master)
    return root


def test_simulator_does_not_change_real_master(tmp_path: Path) -> None:
    root = _make_root(tmp_path)
    master = root / "Manufacturers" / "IR" / "Master" / "Master.xlsx"
    before = _snapshot_master(master)["sha256"]
    report = UpdateSimulator(root).run()
    after = _snapshot_master(master)["sha256"]
    assert before == after
    assert report.real_master_unchanged is True
    assert Path(report.report_json).exists()
    assert Path(report.report_excel).exists()
