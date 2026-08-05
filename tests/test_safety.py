from pathlib import Path
from openpyxl import Workbook

from core.safety import build_safety_report, create_simulation_workspace, sha256_file


def _make_master(root: Path, manufacturer: str = "IR") -> Path:
    master = root / "Manufacturers" / manufacturer / "Master" / "Master.xlsx"
    master.parent.mkdir(parents=True, exist_ok=True)
    wb = Workbook()
    wb.active.title = "원본상세"
    wb.save(master)
    return master


def test_sha256_is_stable(tmp_path: Path):
    p = tmp_path / "a.bin"
    p.write_bytes(b"cpms")
    assert sha256_file(p) == sha256_file(p)


def test_safety_report_and_simulation_workspace(tmp_path: Path):
    for name in ["Config", "Update", "Archive", "History", "PDF_Review"]:
        (tmp_path / name).mkdir(parents=True)
    _make_master(tmp_path)
    report = build_safety_report(tmp_path, ["IR"])
    assert report.passed
    assert report.master_snapshots[0].sheets["원본상세"] == 1
    assert report.score >= 90
    sim = create_simulation_workspace(tmp_path)
    assert (sim / "Manufacturers" / "IR" / "Master" / "Master.xlsx").exists()


def test_keep_and_windows_metadata_are_ignored(tmp_path: Path):
    archive = tmp_path / "Archive"
    archive.mkdir(parents=True)
    for name in [".keep", "Thumbs.db", "desktop.ini", ".DS_Store"]:
        (archive / name).write_bytes(b"")
    _make_master(tmp_path)
    report = build_safety_report(tmp_path, ["IR"])
    assert report.passed
    assert report.checks["Archive"] == "PASS"
    assert len(report.ignored_archive_files) == 4


def test_real_empty_archive_file_fails(tmp_path: Path):
    archive = tmp_path / "Archive"
    archive.mkdir(parents=True)
    (archive / "broken.xlsx").write_bytes(b"")
    _make_master(tmp_path)
    report = build_safety_report(tmp_path, ["IR"])
    assert not report.passed
    assert report.checks["Archive"] == "FAIL"
    assert report.score <= 60
