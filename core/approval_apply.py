from __future__ import annotations

import hashlib
import json
import shutil
import tempfile
from dataclasses import asdict, dataclass, field, replace
from datetime import datetime
from pathlib import Path

from openpyxl import Workbook

from core.approval_queue import ApprovalItem
from core.backup import backup_master
from core.compare import build_kr_lookup, complete_korean_names, merge_records
from core.comparison_engine import compare_master
from core.parser import PartRecord, parse_master, parse_workbook
from core.report_builder import rebuild_all_sheets


@dataclass
class ManufacturerApprovalResult:
    manufacturer: str
    approved_sheets: int = 0
    extracted_rows: int = 0
    priced_rows: int = 0
    new_parts: int = 0
    updated_rows: int = 0
    price_changes: int = 0
    duplicates: int = 0
    before_rows: int = 0
    after_rows: int = 0
    status: str = ""
    errors: list[str] = field(default_factory=list)
    temp_master: str = ""


@dataclass
class ApprovalApplyReport:
    created_at: str
    approval_file: str
    mode: str
    passed: bool
    summary: str
    approved_items: int
    real_master_unchanged: bool
    manufacturers: list[ManufacturerApprovalResult]
    report_json: str = ""
    report_excel: str = ""
    staging_dir: str = ""
    approval_sha256: str = ""
    master_hashes_before: dict[str, str] = field(default_factory=dict)
    master_hashes_after: dict[str, str] = field(default_factory=dict)


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fp:
        for chunk in iter(lambda: fp.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def find_latest_approval(root: str | Path) -> Path | None:
    root = Path(root)
    latest = root / "Log" / "MultiDoc_Approval_Latest.json"
    if latest.exists():
        return latest
    candidates = sorted((root / "Approval").glob("MultiDoc_Approval_*.json"), key=lambda p: p.stat().st_mtime, reverse=True) if (root / "Approval").exists() else []
    return candidates[0] if candidates else None


def _load_approved_items(path: Path) -> list[ApprovalItem]:
    data = json.loads(path.read_text(encoding="utf-8"))
    items: list[ApprovalItem] = []
    for row in data.get("items", []):
        if row.get("decision") != "승인":
            continue
        item = ApprovalItem(
            file=str(row.get("file", "")), sheet=str(row.get("sheet", "")),
            manufacturer=str(row.get("manufacturer", "")), document_type=str(row.get("document_type", "")),
            rows_estimated=int(row.get("rows_estimated", 0) or 0), mapped_fields=list(row.get("mapped_fields", []) or []),
            safe_action=str(row.get("safe_action", "")), reason=str(row.get("reason", "")),
            decision="승인", comment=str(row.get("comment", "")),
        )
        if not item.approvable:
            raise ValueError(f"승인 차단 항목이 포함되어 있습니다: {item.file} / {item.sheet}")
        items.append(item)
    return items


def _records_for_item(root: Path, item: ApprovalItem) -> list[PartRecord]:
    source = root / "Update" / item.file
    if not source.exists():
        raise FileNotFoundError(f"Update 원본 파일 없음: {item.file}")
    records = parse_workbook(source, sheet_names=[item.sheet])
    fixed: list[PartRecord] = []
    for record in records:
        fixed.append(replace(
            record,
            source_file=item.file,
            extraction_method=(record.extraction_method + " | MultiDoc 승인").strip(" |"),
        ))
    return fixed


def _write_report(root: Path, report: ApprovalApplyReport) -> ApprovalApplyReport:
    log_dir = root / "Log"; log_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    json_path = log_dir / f"Approval_Apply_{report.mode}_{stamp}.json"
    xlsx_path = log_dir / f"Approval_Apply_{report.mode}_{stamp}.xlsx"
    report.report_json = str(json_path); report.report_excel = str(xlsx_path)
    json_path.write_text(json.dumps(asdict(report), ensure_ascii=False, indent=2), encoding="utf-8")

    wb = Workbook(); ws = wb.active; ws.title = "요약"
    ws.append(["생성일", report.created_at]); ws.append(["모드", report.mode]); ws.append(["결과", report.summary])
    ws.append(["승인항목", report.approved_items]); ws.append(["실제 Master 무변경", report.real_master_unchanged])
    ws.append(["승인파일", report.approval_file]); ws.append(["승인파일 SHA256", report.approval_sha256])
    detail = wb.create_sheet("제조사별_변경예정")
    detail.append(["제조사", "승인시트", "추출행", "단가행", "신규", "보정", "가격변동", "중복", "이전행", "이후행", "상태", "오류"])
    for x in report.manufacturers:
        detail.append([x.manufacturer, x.approved_sheets, x.extracted_rows, x.priced_rows, x.new_parts, x.updated_rows, x.price_changes, x.duplicates, x.before_rows, x.after_rows, x.status, " | ".join(x.errors)])
    detail.freeze_panes = "A2"; detail.auto_filter.ref = detail.dimensions
    for col, width in {"A":10,"B":12,"C":12,"D":12,"E":10,"F":10,"G":12,"H":10,"I":12,"J":12,"K":28,"L":55}.items(): detail.column_dimensions[col].width = width
    wb.save(xlsx_path)
    return report


def simulate_approval_apply(root: str | Path, approval_path: str | Path | None = None, progress=None) -> ApprovalApplyReport:
    root = Path(root)
    approval = Path(approval_path) if approval_path else find_latest_approval(root)
    if approval is None or not approval.exists():
        raise FileNotFoundError("저장된 다중문서 승인명세가 없습니다.")
    items = _load_approved_items(approval)
    if not items:
        raise ValueError("승인된 항목이 없습니다. 승인센터에서 승인 결정을 저장해 주세요.")

    manufacturers = sorted({x.manufacturer for x in items})
    before_hashes = {m: _sha256(root / "Manufacturers" / m / "Master" / "Master.xlsx") for m in manufacturers}
    staging = Path(tempfile.mkdtemp(prefix="cpms_approval_stage_"))
    results: list[ManufacturerApprovalResult] = []
    passed = True
    try:
        for idx, m in enumerate(manufacturers, start=1):
            if progress: progress(int((idx-1)/max(len(manufacturers),1)*85), f"[승인 시뮬레이션] {m} 임시 Master 준비")
            source_master = root / "Manufacturers" / m / "Master" / "Master.xlsx"
            temp_master = staging / m / "Master.xlsx"; temp_master.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source_master, temp_master)
            result = ManufacturerApprovalResult(manufacturer=m, temp_master=str(temp_master))
            selected = [x for x in items if x.manufacturer == m]; result.approved_sheets = len(selected)
            try:
                before = parse_master(temp_master); result.before_rows = len(before)
                incoming: list[PartRecord] = []
                for item in selected:
                    if progress: progress(min(80, 5 + int(idx/max(len(manufacturers),1)*70)), f"[승인 시뮬레이션] {m}: {item.file} / {item.sheet}")
                    rows = _records_for_item(root, item)
                    if not rows:
                        raise ValueError(f"승인 시트에서 부품 행을 추출하지 못했습니다: {item.file} / {item.sheet}")
                    incoming.extend(rows)
                result.extracted_rows = len(incoming); result.priced_rows = sum(r.price is not None for r in incoming)
                incoming, _ = complete_korean_names(incoming, build_kr_lookup(before), 95)
                merged, new_records, price_changes, duplicates, updated_rows = merge_records(before, incoming)
                result.new_parts = len(new_records); result.price_changes = len(price_changes); result.duplicates = duplicates; result.updated_rows = updated_rows; result.after_rows = len(merged)
                rebuild_all_sheets(temp_master, records=merged, appended_count=len(new_records), selected_count=len(selected), manufacturer=m)
                saved = parse_master(temp_master)
                if len(saved) < len(merged):
                    raise RuntimeError(f"임시 Master 저장 검증 실패: 저장 {len(saved)} / 예상 {len(merged)}")
                result.status = "시뮬레이션 PASS"
            except Exception as exc:
                result.status = "시뮬레이션 FAIL"; result.errors.append(str(exc)); passed = False
            results.append(result)
        after_hashes = {m: _sha256(root / "Manufacturers" / m / "Master" / "Master.xlsx") for m in manufacturers}
        unchanged = before_hashes == after_hashes
        passed = passed and unchanged
        report = ApprovalApplyReport(
            created_at=datetime.now().isoformat(timespec="seconds"), approval_file=str(approval), mode="SIMULATION",
            passed=passed, summary="PASS" if passed else "FAIL", approved_items=len(items), real_master_unchanged=unchanged,
            manufacturers=results, staging_dir=str(staging), approval_sha256=_sha256(approval), master_hashes_before=before_hashes, master_hashes_after=after_hashes,
        )
        return _write_report(root, report)
    except Exception:
        shutil.rmtree(staging, ignore_errors=True)
        raise


def commit_approval_apply(root: str | Path, simulation_report_path: str | Path) -> ApprovalApplyReport:
    root = Path(root); sim_path = Path(simulation_report_path)
    data = json.loads(sim_path.read_text(encoding="utf-8"))
    if data.get("mode") != "SIMULATION" or not data.get("passed"):
        raise ValueError("PASS한 승인 반영 시뮬레이션 보고서만 최종 반영할 수 있습니다.")
    approval = Path(data["approval_file"])
    if not approval.exists() or _sha256(approval) != data.get("approval_sha256"):
        raise ValueError("승인명세가 시뮬레이션 이후 변경되었습니다. 다시 시뮬레이션해 주세요.")
    staging = Path(data.get("staging_dir", ""))
    if not staging.exists():
        raise FileNotFoundError("시뮬레이션 임시 Master가 없습니다. 다시 시뮬레이션해 주세요.")

    results: list[ManufacturerApprovalResult] = []
    for row in data.get("manufacturers", []):
        m = row["manufacturer"]
        real_master = root / "Manufacturers" / m / "Master" / "Master.xlsx"
        if _sha256(real_master) != data.get("master_hashes_before", {}).get(m):
            raise ValueError(f"{m} Master가 시뮬레이션 이후 변경되었습니다. 다시 시뮬레이션해 주세요.")
        staged_master = Path(row["temp_master"])
        if not staged_master.exists():
            raise FileNotFoundError(f"{m} 임시 Master 없음")
        backup_master(real_master, root / "Backup" / m)
        temp_target = real_master.with_suffix(".approval.tmp.xlsx")
        shutil.copy2(staged_master, temp_target)
        parse_master(temp_target)  # readability validation
        temp_target.replace(real_master)
        row = dict(row); row["status"] = "최종 반영 완료"
        results.append(ManufacturerApprovalResult(**row))

    approved_items = _load_approved_items(approval)
    # Move only source files for which all approved sheets were committed. Original files with blocked/demand sheets
    # are retained in Update to avoid losing mixed-purpose data; a committed copy is stored in Archive/ApprovedMultiDoc.
    archive = root / "Archive" / "ApprovedMultiDoc" / datetime.now().strftime("%Y%m%d_%H%M%S")
    archive.mkdir(parents=True, exist_ok=True)
    for file_name in sorted({x.file for x in approved_items}):
        src = root / "Update" / file_name
        if src.exists(): shutil.copy2(src, archive / src.name)

    after_hashes = {r.manufacturer: _sha256(root / "Manufacturers" / r.manufacturer / "Master" / "Master.xlsx") for r in results}
    report = ApprovalApplyReport(
        created_at=datetime.now().isoformat(timespec="seconds"), approval_file=str(approval), mode="COMMIT",
        passed=True, summary="최종 Master 반영 완료", approved_items=len(approved_items), real_master_unchanged=False,
        manufacturers=results, staging_dir=str(staging), approval_sha256=_sha256(approval),
        master_hashes_before=data.get("master_hashes_before", {}), master_hashes_after=after_hashes,
    )
    report = _write_report(root, report)
    shutil.rmtree(staging, ignore_errors=True)
    return report
