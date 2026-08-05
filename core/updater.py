from __future__ import annotations

import csv
import json
import shutil
import time
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Callable

from core.backup import backup_master
from core.compare import build_kr_lookup, compare_records, complete_korean_names, merge_records
from core.logger import AppLogger
from core.parser import PartRecord, choose_preferred_files, diagnose_workbook, infer_ir_no, infer_manufacturer, parse_master, parse_workbook, revision_rank
from core.report_builder import rebuild_all_sheets
from core.update_result_report import write_update_result_report
from core.history_engine import (
    append_history, make_history_run, make_run_id, summarize_events,
)
from core.comparison_engine import compare_master
from core.pdf_parser import create_pdf_review
from core.ocr_engine import OcrFileLog, check_ocr_health, write_ocr_log
from core.diagnostic_engine import diagnose_file
from core.header_fingerprint import classify_file

ProgressCallback = Callable[[int, str], None]

SUPPORTED_EXCEL_SUFFIXES = {".xls", ".xlsx", ".xlsm", ".xltx", ".xltm"}
AUDIT_ONLY_SUFFIXES = {".pdf"}


def _is_supported_excel_file(path: Path) -> bool:
    return (
        path.is_file()
        and not path.name.startswith("~$")
        and path.suffix.lower() in SUPPORTED_EXCEL_SUFFIXES
    )


class MasterFileLockedError(RuntimeError):
    pass


@dataclass
class ManufacturerResult:
    manufacturer: str
    scanned_files: int = 0
    selected_files: int = 0
    duplicates: int = 0
    revisions: int = 0
    new_parts: int = 0
    updated_rows: int = 0
    kr_completed: int = 0
    price_changes: int = 0
    cumulative_price_variations: int = 0
    history_events: int = 0
    history_runs: int = 0
    actual_new_parts: int = 0
    actual_deleted_parts: int = 0
    actual_field_changes: int = 0
    reprocessed_rows: int = 0
    history_path: Path | None = None
    backup_path: Path | None = None
    status: str = ""
    errors: list[str] = field(default_factory=list)


@dataclass
class RejectedFileEntry:
    filename: str
    manufacturer: str = ""
    request_no: str = ""
    stage: str = ""
    reason_code: str = ""
    reason: str = ""
    action: str = ""
    file_path: str = ""


@dataclass
class FileAuditEntry:
    filename: str
    manufacturer: str = ""
    request_no: str = ""
    status: str = ""
    extracted_rows: int = 0
    priced_rows: int = 0
    qty_rows: int = 0
    amount_rows: int = 0
    models: str = ""
    source_path: str = ""
    archive_path: str = ""
    note: str = ""


@dataclass
class UpdateResult:
    scanned_files: int
    selected_files: int
    duplicates: int
    revisions: int
    new_parts: int
    updated_rows: int
    kr_completed: int
    price_changes: int
    backup_path: Path
    log_path: Path
    manifest_path: Path
    cumulative_price_variations: int = 0
    skipped_over_limit: int = 0
    by_manufacturer: dict[str, ManufacturerResult] = field(default_factory=dict)
    history_events: int = 0
    history_runs: int = 0
    actual_new_parts: int = 0
    actual_deleted_parts: int = 0
    actual_field_changes: int = 0
    reprocessed_rows: int = 0
    history_path: Path | None = None


class Updater:
    def __init__(self, root: str | Path = ".") -> None:
        self.root = Path(root)
        self.config = self._load_config()
        self.manufacturers = list(self.config.get("manufacturers", ["IR", "XC", "AC", "KA", "NC"]))
        self.update_dir = self.root / self.config.get("update", "Update")
        self.archive_dir = self.root / self.config.get("archive", "Archive")
        self.backup_dir = self.root / self.config.get("backup", "Backup")
        self.log_dir = self.root / self.config.get("log", "Log")
        self.logger = AppLogger(self.log_dir)
        self.max_files_per_run = int(self.config.get("max_files_per_run", 0) or 0)  # 0 = unlimited
        self.manufacturer_root = self.root / self.config.get("manufacturer_root", "Manufacturers")
        self.history_dir = self.root / self.config.get("history", "History")
        self.last_archive_errors: dict[Path, str] = {}

    def _load_config(self) -> dict:
        path = self.root / "Config" / "config.json"
        with path.open("r", encoding="utf-8") as fp:
            return json.load(fp)

    def master_path(self, manufacturer: str) -> Path:
        return self.manufacturer_root / manufacturer / "Master" / "Master.xlsx"

    @staticmethod
    def _count_cumulative_price_variations(records: list[PartRecord]) -> int:
        """Count part groups that have two or more distinct historical prices.

        This is the same business meaning used by the Master Dashboard. It is a
        cumulative Master status metric, not the number of rows changed in this run.
        """
        prices: dict[tuple, set[float]] = {}
        for record in records:
            if record.price is None:
                continue
            prices.setdefault(record.part_key, set()).add(round(float(record.price), 6))
        return sum(1 for values in prices.values() if len(values) > 1)

    def scan(self) -> list[Path]:
        self.update_dir.mkdir(parents=True, exist_ok=True)
        # Do not use glob("*.xlsx") here. Legacy XC requests are real .xls files
        # and must reach the unified Excel reader.
        return sorted(
            path for path in self.update_dir.iterdir()
            if _is_supported_excel_file(path)
            or (path.is_file() and not path.name.startswith("~$") and path.suffix.lower() in AUDIT_ONLY_SUFFIXES)
        )

    def scan_by_manufacturer(self) -> dict[str, list[Path]]:
        """Group update files without opening workbooks during the initial scan.

        Opening an unknown workbook here can block the entire worker before any
        file-level progress is shown. Manufacturer inference at this stage is
        therefore filename/request-number based only. Unknown files remain in
        Update and are reported by the diagnostic flow instead of freezing the run.
        """
        grouped = {m: [] for m in self.manufacturers}
        for path in self.scan():
            if not _is_supported_excel_file(path):
                continue
            m = infer_manufacturer(path)
            if m in grouped:
                grouped[m].append(path)
        return grouped

    def scan_archive_by_manufacturer(self) -> dict[str, list[Path]]:
        """Collect archived Excel files (.xls/.xlsx/...) by manufacturer for Full Rebuild."""
        grouped = {m: [] for m in self.manufacturers}
        for m in self.manufacturers:
            base = self.archive_dir / m
            if base.exists():
                grouped[m] = sorted(p for p in base.rglob("*") if _is_supported_excel_file(p))
        return grouped

    def _dedupe_same_source_file(self, records: list[PartRecord]) -> list[PartRecord]:
        """If the same source filename appears more than once, keep the latest parsed copy.

        This mainly protects manual re-import/rebuild cases where a corrected request file
        has the same filename as an old one. The latest version is decided by the largest
        updated date string and then by the parse order.
        """
        by_source: dict[str, int] = {}
        keep_index = set()
        for i, r in enumerate(records):
            sf = r.source_file or f"__row_{i}"
            by_source[sf] = i
        # Keep all rows whose source file's last occurrence belongs to the same file group.
        latest_files = set(by_source)
        return [r for r in records if (r.source_file or "") in latest_files]

    def _replace_existing_source_files(self, master_records: list[PartRecord], incoming: list[PartRecord]) -> tuple[list[PartRecord], int]:
        """Remove existing 원본상세 rows for incoming source filenames before merge.

        This implements 'same filename = overwrite with latest file' and prevents old
        qty/price parsing errors from accumulating after re-upload.
        """
        sources = {r.source_file for r in incoming if r.source_file}
        if not sources:
            return master_records, 0
        filtered = [r for r in master_records if r.source_file not in sources]
        return filtered, len(master_records) - len(filtered)

    def run(self, progress: ProgressCallback | None = None) -> UpdateResult:
        """Run update with safe order.

        v2.0.2 핵심 보정:
        - Master 저장/검증 성공 후에만 Archive 이동
        - 파싱 실패 파일은 Update 폴더에 남김
        - 제조사별 Master 저장 경로를 로그에 명확히 기록
        - Master 저장 후 원본상세 행수 검증
        """
        def emit(value: int, message: str) -> None:
            if progress:
                progress(value, message)

        emit(3, "Update 폴더 검사 중")
        files_all = self.scan()
        emit(4, f"Update 파일 목록 확인 완료: {len(files_all)}개")
        grouped_all = self.scan_by_manufacturer()
        emit(5, "제조사 분류 완료")
        rejected_entries: list[RejectedFileEntry] = []
        audit_by_path: dict[Path, FileAuditEntry] = {}
        for path in files_all:
            manufacturer = infer_manufacturer(path)
            # Do not open unknown workbooks during the initial audit scan.
            # A malformed or legacy workbook can otherwise block both normal
            # update and simulation at "Update 폴더 검사 중".
            audit_by_path[path] = FileAuditEntry(
                filename=path.name,
                manufacturer=manufacturer or "UNKNOWN",
                request_no=infer_ir_no(path),
                status="스캔됨",
                source_path=str(path),
            )
        pdf_files = [p for p in files_all if p.suffix.lower() == ".pdf"]
        pdf_review_dir = self.root / "PDF_Review"
        ocr_language = str(self.config.get("ocr_language", "eng"))
        ocr_timeout = int(self.config.get("ocr_timeout_seconds", 45))
        tesseract_path = self.config.get("tesseract_path", "")
        ocr_health = check_ocr_health(tesseract_path, ocr_language)
        ocr_log_entries: list[OcrFileLog] = []
        if pdf_files:
            emit(4, f"OCR 상태: {ocr_health.display_status} - {ocr_health.message}")

        for pdf_index, path in enumerate(pdf_files, start=1):
            emit(
                4 + int(3 * (pdf_index - 1) / max(len(pdf_files), 1)),
                f"PDF {pdf_index}/{len(pdf_files)} 처리 중: {path.name}",
            )
            try:
                review = create_pdf_review(
                    path,
                    pdf_review_dir,
                    tesseract_path=tesseract_path,
                    ocr_language=ocr_language,
                    timeout_seconds=ocr_timeout,
                    health=ocr_health,
                    progress=lambda page, total, msg, name=path.name: emit(
                        4 + int(3 * pdf_index / max(len(pdf_files), 1)),
                        f"{name} - {msg}",
                    ),
                )
                audit_by_path[path].status = "PDF 검토대기 생성"
                audit_by_path[path].manufacturer = review.manufacturer
                audit_by_path[path].request_no = review.request_no
                audit_by_path[path].extracted_rows = len(review.rows)
                audit_by_path[path].priced_rows = sum(1 for row in review.rows if row.price is not None)
                audit_by_path[path].qty_rows = sum(1 for row in review.rows if row.qty is not None)
                audit_by_path[path].amount_rows = sum(1 for row in review.rows if row.amount is not None)
                audit_by_path[path].models = ", ".join(sorted({row.model for row in review.rows if row.model}))
                audit_by_path[path].note = (
                    f"검토파일 생성: {review.output_xlsx} / "
                    f"{review.note} / OCR: {review.ocr_status}"
                )
                ocr_log_entries.append(OcrFileLog(
                    filename=path.name,
                    classification=review.classification,
                    status="검토대기 생성",
                    extraction_mode=review.note,
                    page_count=review.page_count,
                    extracted_rows=len(review.rows),
                    elapsed_seconds=review.elapsed_seconds,
                    tesseract=ocr_health.executable,
                    language=ocr_language,
                    message=review.ocr_status,
                ))
                rejected_entries.append(RejectedFileEntry(
                    filename=path.name,
                    manufacturer=review.manufacturer,
                    request_no=review.request_no,
                    stage="PDF OCR 검토",
                    reason_code="PDF_REVIEW_REQUIRED",
                    reason="OCR 추출은 완료됐지만 자동 Master 반영 전 사용자 검토가 필요합니다.",
                    action=f"{review.output_xlsx.name}의 검토상태와 합계 검증을 확인하세요.",
                    file_path=str(path),
                ))
            except Exception as exc:
                ocr_log_entries.append(OcrFileLog(
                    filename=path.name,
                    classification="UNKNOWN",
                    status="실패",
                    extraction_mode="",
                    page_count=0,
                    extracted_rows=0,
                    elapsed_seconds=0.0,
                    tesseract=ocr_health.executable,
                    language=ocr_language,
                    message=str(exc),
                ))
                audit_by_path[path].status = "PDF OCR 실패"
                audit_by_path[path].note = str(exc)
                rejected_entries.append(RejectedFileEntry(
                    filename=path.name,
                    manufacturer=infer_manufacturer(path) or "UNKNOWN",
                    request_no=infer_ir_no(path),
                    stage="PDF OCR",
                    reason_code="PDF_OCR_FAILED",
                    reason=str(exc),
                    action="스캔 품질 또는 PDF 양식을 확인하고 원본 Excel을 요청하세요.",
                    file_path=str(path),
                ))

        ocr_log_path = write_ocr_log(self.log_dir, ocr_log_entries) if pdf_files else None
        if ocr_log_path:
            emit(7, f"OCR 로그: {ocr_log_path}")

        classified_excel_files = {
            path
            for paths in grouped_all.values()
            for path in paths
        }
        unknown_files = [
            path for path in files_all
            if _is_supported_excel_file(path)
            and path not in classified_excel_files
        ]
        for path in unknown_files:
            audit_by_path[path].status = "제조사 판정 불가"
            audit_by_path[path].note = "IR/XC/AC/KA/NC 제조사를 판정하지 못했습니다."
            rejected_entries.append(RejectedFileEntry(
                filename=path.name,
                manufacturer="UNKNOWN",
                request_no=infer_ir_no(path),
                stage="제조사 분류",
                reason_code="UNKNOWN_MANUFACTURER",
                reason="파일명과 내부 요청번호에서 IR/XC/AC/KA/NC 제조사를 판정하지 못했습니다.",
                action="파일명에 제조사 요청번호를 추가하거나 Parser 제조사 추론 규칙을 검토하세요.",
                file_path=str(path),
            ))
        if pdf_files:
            emit(7, f"PDF {len(pdf_files)}개 처리 완료 - OCR 검토파일을 확인하세요")
        if unknown_files:
            emit(5, f"제조사 구분 불가 파일 {len(unknown_files)}개는 건너뜁니다")

        grouped_selected: dict[str, list[Path]] = {}
        revisions_total = 0
        selected_all: list[Path] = []
        for m, paths in grouped_all.items():
            preferred = choose_preferred_files(paths)
            revisions_total += len(paths) - len(preferred)
            preferred_set = set(preferred)
            for path in paths:
                if path not in preferred_set:
                    audit_by_path[path].status = "이전 수정본 제외"
                    audit_by_path[path].note = "같은 요청번호의 최신 또는 수정본 파일이 우선 처리됩니다."
                    rejected_entries.append(RejectedFileEntry(
                        filename=path.name,
                        manufacturer=m,
                        request_no=infer_ir_no(path),
                        stage="중복/수정본 선택",
                        reason_code="OLDER_REVISION_EXCLUDED",
                        reason="같은 요청번호의 더 최신 또는 수정된 파일이 있어 이전 파일을 제외했습니다.",
                        action="정상 동작입니다. 최신 수정본만 처리됩니다.",
                        file_path=str(path),
                    ))
            grouped_selected[m] = preferred
            selected_all.extend(preferred)

        skipped_over_limit = 0
        if self.max_files_per_run > 0 and len(selected_all) > self.max_files_per_run:
            allowed = set(selected_all[: self.max_files_per_run])
            held_files = [path for path in selected_all if path not in allowed]
            skipped_over_limit = len(held_files)
            for path in held_files:
                audit_by_path[path].status = "처리 제한 보류"
                audit_by_path[path].note = f"1회 처리 제한({self.max_files_per_run}개) 초과"
                rejected_entries.append(RejectedFileEntry(
                    filename=path.name,
                    manufacturer=infer_manufacturer(path) or "UNKNOWN",
                    request_no=infer_ir_no(path),
                    stage="처리 제한",
                    reason_code="HELD_OVER_LIMIT",
                    reason=f"1회 처리 제한({self.max_files_per_run}개)을 초과해 다음 실행으로 보류됐습니다.",
                    action="다음 업데이트 실행에서 자동 처리됩니다.",
                    file_path=str(path),
                ))
            grouped_selected = {m: [p for p in paths if p in allowed] for m, paths in grouped_selected.items()}
            selected_all = selected_all[: self.max_files_per_run]
            emit(7, f"설정 제한 적용: {len(selected_all)}개 처리, {skipped_over_limit}개 보류")

        total_selected = len(selected_all)
        if total_selected == 0:
            manifest_path = self._write_manifest([], {}, {}, {}, [])
            rejected_manifest_path = self._write_rejected_manifest(rejected_entries)
            file_audit_path = self._write_file_audit_manifest(list(audit_by_path.values()))
            result_report_path = write_update_result_report(
                log_dir=self.log_dir,
                scanned_files=len(files_all),
                selected_files=0,
                duplicates=0,
                revisions=revisions_total,
                new_parts=0,
                updated_rows=0,
                kr_completed=0,
                price_changes=0,
                skipped_over_limit=skipped_over_limit,
                by_manufacturer={},
                rejected_entries=rejected_entries,
                audit_entries=list(audit_by_path.values()),
                manifest_path=manifest_path,
                rejected_manifest_path=rejected_manifest_path,
                file_audit_path=file_audit_path,
                mode="업데이트",
            )
            log_path = self.logger.write_summary([
                "처리 대상 파일 없음",
                f"제조사 구분 불가: {len(unknown_files)}",
                f"PDF 검토대기/수동입력 대상: {len(pdf_files)}",
                f"OCR 상태: {ocr_health.display_status} - {ocr_health.message}",
                f"OCR 로그: {ocr_log_path or ''}",
                f"미반영 진단표: {rejected_manifest_path}",
                f"전체 파일 감사표: {file_audit_path}",
                f"업데이트 결과 보고서: {result_report_path}",
            ])
            return UpdateResult(len(files_all), 0, 0, revisions_total, 0, 0, 0, Path(""), log_path, manifest_path, skipped_over_limit)

        by_m: dict[str, ManufacturerResult] = {}
        total_new = total_updated = total_dup = total_price = total_kr = 0
        backup_paths: list[Path] = []
        parsed_by_file: dict[Path, list[PartRecord]] = {}
        all_new_records: dict[str, list[PartRecord]] = {}
        all_price_changes: list[dict] = []
        successful_files: list[Path] = []
        unpriced_request_files: list[Path] = []
        total_history_events = 0
        history_paths: list[Path] = []

        done_files = 0
        for m in self.manufacturers:
            selected = grouped_selected.get(m, [])
            if not selected:
                continue
            res = ManufacturerResult(
                manufacturer=m,
                scanned_files=len(grouped_all.get(m, [])),
                selected_files=len(selected),
                revisions=len(grouped_all.get(m, [])) - len(selected),
            )
            by_m[m] = res
            master = self.master_path(m)
            emit(8 + int(70 * done_files / max(total_selected, 1)), f"{m} Master 확인 중: {master}")
            parsed_success_files: list[Path] = []
            manufacturer_unpriced = 0
            try:
                self._ensure_master_writable(master)
                backup = backup_master(master, self.backup_dir / m)
                res.backup_path = backup
                backup_paths.append(backup)
                # Immutable pre-update snapshot. Never compare against a Master that has already been overwritten.
                before_snapshot = list(parse_master(master))
                master_records = list(before_snapshot)
                before_count = len(before_snapshot)
                kr_lookup = build_kr_lookup(before_snapshot)
                incoming: list[PartRecord] = []

                for path in selected:
                    emit(10 + int(65 * done_files / max(total_selected, 1)), f"{m} 파싱 중: {path.name}")
                    try:
                        records = parse_workbook(path)
                        if not records:
                            diagnostic = diagnose_file(path)
                            if diagnostic.action == "단가 미회신 요청서 보관":
                                audit_by_path[path].status = "단가 미회신"
                                audit_by_path[path].note = diagnostic.reason
                                rejected_entries.append(RejectedFileEntry(
                                    filename=path.name,
                                    manufacturer=m,
                                    request_no=infer_ir_no(path),
                                    stage="단가 검증",
                                    reason_code="UNPRICED_REQUEST",
                                    reason=diagnostic.reason,
                                    action=(
                                        "공급사 단가가 입력되지 않아 Master 반영에서 제외하고 "
                                        "Excluded/Unpriced_Request에 보관합니다."
                                    ),
                                    file_path=str(path),
                                ))
                                unpriced_request_files.append(path)
                                manufacturer_unpriced += 1
                                emit(
                                    10 + int(65 * done_files / max(total_selected, 1)),
                                    f"{path.name}: 단가 미회신 요청서 - Master 반영 제외",
                                )
                                done_files += 1
                                continue
                            raise ValueError(
                                "추출된 부품 행이 없습니다. 원본 양식/헤더를 확인하세요."
                            )
                    except Exception as exc:
                        error_text = str(exc)
                        audit_by_path[path].status = "파싱 실패"
                        audit_by_path[path].note = error_text
                        res.errors.append(f"{path.name}: 파싱 실패 - {error_text}")
                        rejected_entries.append(RejectedFileEntry(
                            filename=path.name,
                            manufacturer=m,
                            request_no=infer_ir_no(path),
                            stage="Excel 파싱",
                            reason_code="PARSE_FAILED",
                            reason=error_text,
                            action="원본 표의 헤더, 병합셀, 숨김열, 단가/수량 배치를 확인하세요. 파일은 Update에 남아 있습니다.",
                            file_path=str(path),
                        ))
                        done_files += 1
                        continue
                    parsed_by_file[path] = records
                    audit = audit_by_path[path]
                    audit.status = "파싱 성공"
                    audit.extracted_rows = len(records)
                    audit.priced_rows = sum(1 for record in records if record.price is not None)
                    audit.qty_rows = sum(1 for record in records if record.qty is not None)
                    audit.amount_rows = sum(1 for record in records if record.amount is not None)
                    audit.models = ", ".join(sorted({
                        str(record.model).strip()
                        for record in records
                        if str(record.model).strip()
                    }))
                    # Do not reopen and fully parse the same workbook merely to
                    # generate a diagnostic sentence.  That duplicate pass was a
                    # major freeze risk with external-link and legacy workbooks.
                    # The successful parser result already contains everything
                    # needed for the operational audit.
                    audit.note = (
                        f"Smart Parser: 제조사 {m} / 요청번호 {infer_ir_no(path)} / "
                        f"추출 {len(records)}행 / 단가 {audit.priced_rows}행"
                    )
                    emit(
                        10 + int(65 * done_files / max(total_selected, 1)),
                        f"{path.name}: Smart Parser {len(records)}행 "
                        f"(단가 {audit.priced_rows}행)",
                    )
                    incoming.extend(records)
                    parsed_success_files.append(path)
                    done_files += 1

                if not incoming:
                    if manufacturer_unpriced:
                        res.status = (
                            f"단가 미회신 {manufacturer_unpriced}건 보관 - "
                            "Master 반영 제외"
                        )
                        res.errors.append(
                            "공급사 단가가 없는 요청서만 확인되어 Master는 수정하지 않았습니다. "
                            "원본은 Excluded/Unpriced_Request로 이동합니다."
                        )
                    else:
                        res.status = "건너뜀"
                        res.errors.append(
                            "정상 파싱된 파일이 없어 Master를 수정하지 않았습니다. "
                            "Archive 이동도 하지 않았습니다."
                        )
                    continue

                threshold = int(self.config.get("fuzzy_threshold", 95))
                incoming, kr_completed = complete_korean_names(incoming, kr_lookup, threshold)
                # Same filename re-upload means latest file replaces old rows from that source file.
                master_records, replaced_rows = self._replace_existing_source_files(master_records, incoming)
                all_records, new_records, price_changes, duplicates, updated_rows = merge_records(master_records, incoming)
                updated_rows += replaced_rows

                # Build the History diff BEFORE overwriting Master.xlsx. Persist it only after save verification.
                source_names = [p.name for p in parsed_success_files]
                run_id = make_run_id(m, source_names)
                comparison = compare_master(m, before_snapshot, all_records, run_id=run_id)
                history_events = comparison.snapshot_events
                actual_new, actual_deleted, actual_changed = summarize_events(history_events)

                emit(80, f"{m} Master 저장 중: 원본상세 {before_count}행 → {len(all_records)}행 / 동일파일 재처리 {replaced_rows}행")
                rebuild_all_sheets(master, records=all_records, appended_count=actual_new, selected_count=len(parsed_success_files), manufacturer=m)

                # 저장 검증: 저장된 Master에서 원본상세를 다시 읽어 행수와 단가 존재 여부를 확인한다.
                saved_records = parse_master(master)
                if len(saved_records) < len(all_records):
                    raise RuntimeError(f"Master 저장 검증 실패: 저장 후 원본상세 {len(saved_records)}행 / 예상 {len(all_records)}행")
                committed_comparison = compare_master(m, before_snapshot, saved_records, run_id=run_id)
                history_events = committed_comparison.snapshot_events
                cumulative_price_variations = committed_comparison.cumulative_price_variations
                expected_priced = sum(1 for r in all_records if r.price is not None)
                saved_priced = sum(1 for r in saved_records if r.price is not None)
                if saved_priced < expected_priced:
                    raise RuntimeError(f"Master 단가 저장 검증 실패: 저장 후 단가행 {saved_priced} / 예상 {expected_priced}")

                # Commit History only after Master save verification succeeds. Even a zero-change
                # reprocessing run is written to 실행이력 so the engine's execution is auditable.
                history_run = make_history_run(
                    manufacturer=m, run_id=run_id, source_files=source_names,
                    request_nos=[infer_ir_no(p) for p in parsed_success_files],
                    before_rows=len(before_snapshot), after_rows=len(saved_records),
                    events=history_events, reprocessed_rows=replaced_rows,
                    master_path=master, backup_path=backup, status="완료",
                    detected_price_histories=len(price_changes),
                    cumulative_price_variations=cumulative_price_variations,
                )
                history_path, history_added = append_history(
                    self.history_dir,
                    history_events,
                    history_run,
                    committed_comparison.price_history_events,
                )
                res.history_events = history_added
                res.cumulative_price_variations = cumulative_price_variations
                res.history_runs = 1
                res.actual_new_parts = actual_new
                res.actual_deleted_parts = actual_deleted
                res.actual_field_changes = actual_changed
                res.reprocessed_rows = replaced_rows
                res.history_path = history_path
                total_history_events += history_added
                if history_path is not None:
                    history_paths.append(history_path)

                # '신규부품' means a real before/after addition, not rows re-read from a same-name file.
                res.new_parts = actual_new
                res.updated_rows = updated_rows
                res.kr_completed = kr_completed
                res.price_changes = len(price_changes)
                res.duplicates = duplicates
                res.status = f"완료 - Master 저장 검증 OK ({master})"
                total_new += res.new_parts
                total_updated += updated_rows
                total_dup += duplicates
                total_price += res.price_changes
                total_kr += kr_completed
                all_new_records[m] = new_records
                all_price_changes.extend(price_changes)
                successful_files.extend(parsed_success_files)
            except Exception as exc:
                error_text = str(exc)
                if res.backup_path and res.backup_path.exists():
                    try:
                        shutil.copy2(res.backup_path, master)
                    except Exception as restore_exc:
                        res.errors.append(f"Master 자동복구 실패: {restore_exc}")
                res.status = "오류 - Archive 이동 안 함"
                res.errors.append(error_text)
                for path in parsed_success_files:
                    audit_by_path[path].status = "Master 저장 실패"
                    audit_by_path[path].note = error_text
                    rejected_entries.append(RejectedFileEntry(
                        filename=path.name,
                        manufacturer=m,
                        request_no=infer_ir_no(path),
                        stage="Master 저장/검증",
                        reason_code="MASTER_UPDATE_FAILED",
                        reason=error_text,
                        action="Master.xlsx가 열려 있는지와 저장 권한·검증 오류를 확인하세요. 파일은 Update에 남아 있습니다.",
                        file_path=str(path),
                    ))
                emit(80, f"{m} 처리 오류: {error_text}")

        if unpriced_request_files:
            unpriced_dir = (
                self.root / "Excluded" / "Unpriced_Request"
                / datetime.now().strftime("%Y%m%d")
            )
            unpriced_dir.mkdir(parents=True, exist_ok=True)
            for source in unpriced_request_files:
                if not source.exists():
                    continue
                destination = unpriced_dir / source.name
                counter = 1
                while destination.exists():
                    destination = (
                        unpriced_dir
                        / f"{source.stem}_{counter}{source.suffix}"
                    )
                    counter += 1
                try:
                    shutil.move(str(source), str(destination))
                    audit_by_path[source].status = "단가 미회신 보관 완료"
                    audit_by_path[source].archive_path = str(destination)
                    emit(
                        86,
                        f"단가 미회신 보관: {source.name} → {destination.parent}",
                    )
                except Exception as exc:
                    audit_by_path[source].status = "단가 미회신 보관 실패"
                    audit_by_path[source].note = str(exc)
                    emit(86, f"단가 미회신 보관 실패: {source.name} - {exc}")

        emit(88, f"Master 저장 성공 파일 {len(successful_files)}개 Archive 이동 중")
        archived_paths = self._archive_files(successful_files)
        for source, destination in archived_paths.items():
            audit_by_path[source].status = "처리 완료"
            audit_by_path[source].archive_path = str(destination)
            emit(90, f"Archive 완료: {source.name} → {destination.parent}")

        for source, error_text in self.last_archive_errors.items():
            audit = audit_by_path.get(source)
            if audit is not None:
                audit.status = "Archive 이동 실패"
                audit.note = error_text
            rejected_entries.append(RejectedFileEntry(
                filename=source.name,
                manufacturer=infer_manufacturer(source) or "UNKNOWN",
                request_no=infer_ir_no(source),
                stage="Archive 이동",
                reason_code="ARCHIVE_MOVE_FAILED",
                reason=error_text,
                action="파일이 Excel에서 열려 있는지, Archive 폴더 쓰기 권한과 디스크 상태를 확인한 뒤 다시 실행하세요.",
                file_path=str(source),
            ))
            emit(92, f"Archive 실패(파일은 Update에 유지): {source.name} - {error_text}")

        emit(
            94,
            f"Archive 결과: 성공 {len(archived_paths)} / 실패 {len(self.last_archive_errors)}"
        )
        emit(95, "처리 명세 및 로그 작성 중")
        manifest_path = self._write_manifest(successful_files, archived_paths, parsed_by_file, all_new_records, all_price_changes)
        rejected_manifest_path = self._write_rejected_manifest(rejected_entries)
        file_audit_path = self._write_file_audit_manifest(list(audit_by_path.values()))
        result_report_path = write_update_result_report(
            log_dir=self.log_dir,
            scanned_files=len(files_all),
            selected_files=len(successful_files),
            duplicates=total_dup,
            revisions=revisions_total,
            new_parts=total_new,
            updated_rows=total_updated,
            kr_completed=total_kr,
            price_changes=total_price,
            skipped_over_limit=skipped_over_limit,
            by_manufacturer=by_m,
            rejected_entries=rejected_entries,
            audit_entries=list(audit_by_path.values()),
            manifest_path=manifest_path,
            rejected_manifest_path=rejected_manifest_path,
            file_audit_path=file_audit_path,
            history_events=total_history_events,
            history_path=history_paths[0] if history_paths else None,
            mode="업데이트",
        )
        log_path = self._write_log(
            len(files_all), len(successful_files), total_dup, revisions_total, total_new,
            total_updated, total_kr, total_price, backup_paths, manifest_path,
            skipped_over_limit, by_m, unknown_files, rejected_manifest_path,
            file_audit_path, result_report_path,
        )
        emit(100, "완료")
        return UpdateResult(
            scanned_files=len(files_all), selected_files=len(successful_files), duplicates=total_dup, revisions=revisions_total,
            new_parts=total_new, updated_rows=total_updated, kr_completed=total_kr, price_changes=total_price,
            cumulative_price_variations=sum(r.cumulative_price_variations for r in by_m.values()),
            backup_path=backup_paths[0] if backup_paths else Path(""), log_path=log_path, manifest_path=manifest_path,
            skipped_over_limit=skipped_over_limit, by_manufacturer=by_m,
            history_events=total_history_events, history_path=history_paths[0] if history_paths else None,
        )

    def rebuild_from_archive(self, progress: ProgressCallback | None = None) -> UpdateResult:
        """Full rebuild every Manufacturer Master from Archive files.

        This does not move Archive files. It reads archived request files, parses with the
        latest parser/header logic, and recreates each Master from scratch. Use when parser,
        year, model, color, or report rules change.
        """
        def emit(value: int, message: str) -> None:
            if progress:
                progress(value, message)

        emit(3, "Archive 전체 재생성 준비")
        grouped_all = self.scan_archive_by_manufacturer()
        total_files = sum(len(v) for v in grouped_all.values())
        if total_files == 0:
            manifest_path = self._write_manifest([], {}, {}, {}, [])
            log_path = self.logger.write_summary(["Archive 재생성 대상 파일 없음"])
            return UpdateResult(0, 0, 0, 0, 0, 0, 0, Path(""), log_path, manifest_path)

        by_m: dict[str, ManufacturerResult] = {}
        total_new = total_updated = total_dup = total_price = total_kr = 0
        backup_paths: list[Path] = []
        parsed_by_file: dict[Path, list[PartRecord]] = {}
        all_new_records: dict[str, list[PartRecord]] = {}
        all_price_changes: list[dict] = []
        successful_files: list[Path] = []
        revisions_total = 0
        processed_count = 0

        for m in self.manufacturers:
            archive_files = grouped_all.get(m, [])
            if not archive_files:
                continue
            selected = choose_preferred_files(archive_files)
            revisions_total += len(archive_files) - len(selected)
            res = ManufacturerResult(manufacturer=m, scanned_files=len(archive_files), selected_files=len(selected), revisions=len(archive_files) - len(selected))
            by_m[m] = res
            master = self.master_path(m)
            try:
                self._ensure_master_writable(master)
                backup = backup_master(master, self.backup_dir / m)
                res.backup_path = backup
                backup_paths.append(backup)
                incoming: list[PartRecord] = []
                for path in selected:
                    emit(5 + int(70 * processed_count / max(total_files, 1)), f"{m} Archive 파싱 중: {path.name}")
                    try:
                        records = parse_workbook(path)
                        if not records:
                            raise ValueError("추출된 부품 행이 없습니다.")
                    except Exception as exc:
                        res.errors.append(f"{path.name}: 파싱 실패 - {exc}")
                        processed_count += 1
                        continue
                    parsed_by_file[path] = records
                    incoming.extend(records)
                    successful_files.append(path)
                    processed_count += 1
                if not incoming:
                    res.status = "건너뜀"
                    res.errors.append("정상 파싱된 Archive 파일이 없어 Master를 재생성하지 않았습니다.")
                    continue
                # Full rebuild starts from an empty master, so all incoming rows are new.
                all_records, new_records, price_changes, duplicates, updated_rows = merge_records([], incoming)
                emit(80, f"{m} Master 전체 재생성 저장 중: {len(all_records)}행")
                rebuild_all_sheets(master, records=all_records, appended_count=len(new_records), selected_count=len(selected), manufacturer=m)
                saved_records = parse_master(master)
                if len(saved_records) < len(all_records):
                    raise RuntimeError(f"Master 저장 검증 실패: 저장 후 {len(saved_records)}행 / 예상 {len(all_records)}행")
                res.new_parts = len(new_records)
                res.updated_rows = updated_rows
                res.price_changes = len(price_changes)
                res.duplicates = duplicates
                res.status = f"전체 재생성 완료 - Master 저장 검증 OK ({master})"
                total_new += res.new_parts
                total_updated += updated_rows
                total_dup += duplicates
                total_price += res.price_changes
                all_new_records[m] = new_records
                all_price_changes.extend(price_changes)
            except Exception as exc:
                res.status = "오류"
                res.errors.append(str(exc))
                emit(80, f"{m} 전체 재생성 오류: {exc}")

        emit(95, "전체 재생성 명세 및 로그 작성 중")
        manifest_path = self._write_manifest(successful_files, {}, parsed_by_file, all_new_records, all_price_changes)
        result_report_path = write_update_result_report(
            log_dir=self.log_dir,
            scanned_files=total_files,
            selected_files=len(successful_files),
            duplicates=total_dup,
            revisions=revisions_total,
            new_parts=total_new,
            updated_rows=total_updated,
            kr_completed=total_kr,
            price_changes=total_price,
            skipped_over_limit=0,
            by_manufacturer=by_m,
            rejected_entries=[],
            audit_entries=[],
            manifest_path=manifest_path,
            mode="전체 재생성",
        )
        log_path = self._write_log(
            total_files, len(successful_files), total_dup, revisions_total,
            total_new, total_updated, total_kr, total_price, backup_paths,
            manifest_path, 0, by_m, [], None, None, result_report_path,
        )
        emit(100, "전체 재생성 완료")
        return UpdateResult(total_files, len(successful_files), total_dup, revisions_total, total_new, total_updated, total_kr, total_price, backup_paths[0] if backup_paths else Path(""), log_path, manifest_path, 0, by_m)

    def _ensure_master_writable(self, master_path: Path) -> None:
        if not master_path.exists():
            raise FileNotFoundError(f"Master 파일을 찾을 수 없습니다: {master_path}")
        try:
            with master_path.open("r+b"):
                pass
        except PermissionError as exc:
            raise MasterFileLockedError(f"Master 엑셀 파일에 저장할 수 없습니다. 열려 있는 엑셀 창을 닫아 주세요. 파일: {master_path}") from exc

    def _archive_files(self, paths: list[Path]) -> dict[Path, Path]:
        """Move successfully processed files to Archive and verify every move.

        A file-level failure must not cancel the entire update result. The failed file
        remains in Update, is recorded in ``last_archive_errors`` and can be retried on
        the next run.
        """
        archived: dict[Path, Path] = {}
        self.last_archive_errors = {}
        stamp = datetime.now().strftime("%Y%m%d")

        # Preserve order while preventing an accidental second move of the same path.
        unique_paths = list(dict.fromkeys(Path(path) for path in paths))
        for path in unique_paths:
            if not path.exists():
                self.last_archive_errors[path] = "원본 파일이 Update 폴더에 존재하지 않습니다."
                continue

            try:
                m = infer_manufacturer(path)
                if (
                    m not in self.manufacturers
                    and path.suffix.lower() in {".xlsx", ".xlsm", ".xltx", ".xltm"}
                ):
                    try:
                        classification = classify_file(path, m)
                        detected = str(classification.get("manufacturer", "UNKNOWN"))
                        if (
                            detected in self.manufacturers
                            and int(classification.get("manufacturer_confidence", 0)) >= 90
                            and int(classification.get("parser_confidence", 0)) >= 90
                        ):
                            m = detected
                    except Exception:
                        pass
                m = m or "UNKNOWN"
                target_dir = self.archive_dir / m / stamp
                target_dir.mkdir(parents=True, exist_ok=True)
                target = target_dir / path.name
                if target.exists():
                    target = target_dir / (
                        f"{path.stem}_{datetime.now().strftime('%H%M%S_%f')}{path.suffix}"
                    )

                last_error: Exception | None = None
                for attempt in range(3):
                    try:
                        shutil.move(str(path), str(target))
                        last_error = None
                        break
                    except (PermissionError, OSError) as exc:
                        last_error = exc
                        if attempt < 2:
                            time.sleep(0.25 * (attempt + 1))

                # Cross-volume/network-drive fallback: copy, verify size, then delete.
                if last_error is not None and path.exists():
                    try:
                        shutil.copy2(str(path), str(target))
                        if not target.exists() or target.stat().st_size != path.stat().st_size:
                            raise OSError("복사 후 파일 크기 검증에 실패했습니다.")
                        path.unlink()
                        last_error = None
                    except Exception as exc:
                        last_error = exc

                if last_error is not None:
                    raise last_error
                if path.exists():
                    raise OSError("Archive 이동 후에도 원본 파일이 Update 폴더에 남아 있습니다.")
                if not target.exists() or target.stat().st_size <= 0:
                    raise OSError("Archive 대상 파일 검증에 실패했습니다.")

                archived[path] = target
            except Exception as exc:
                self.last_archive_errors[path] = str(exc)

        return archived

    def _write_manifest(self, selected: list[Path], archived_paths: dict[Path, Path], parsed_by_file: dict[Path, list[PartRecord]], new_by_m: dict[str, list[PartRecord]], price_changes: list[dict]) -> Path:
        self.log_dir.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        path = self.log_dir / f"processed_manifest_{stamp}.csv"
        new_by_file: dict[str, int] = {}
        for records in new_by_m.values():
            for record in records:
                new_by_file[record.source_file] = new_by_file.get(record.source_file, 0) + 1
        price_by_req: dict[str, int] = {}
        for change in price_changes:
            req = str(change.get("ir_no", "")); price_by_req[req] = price_by_req.get(req, 0) + 1
        with path.open("w", newline="", encoding="utf-8-sig") as fp:
            writer = csv.DictWriter(fp, fieldnames=["manufacturer", "filename", "request_no", "revision_rank", "parsed_rows", "new_raw_rows", "price_changes_by_request", "archived_to", "status"])
            writer.writeheader()
            for source in selected:
                records = parsed_by_file.get(source, [])
                req = infer_ir_no(source); m = infer_manufacturer(source.name) or "UNKNOWN"
                writer.writerow({"manufacturer": m, "filename": source.name, "request_no": req, "revision_rank": revision_rank(source), "parsed_rows": len(records), "new_raw_rows": new_by_file.get(source.name, 0), "price_changes_by_request": price_by_req.get(req, 0), "archived_to": archived_paths.get(source, ""), "status": "archived" if source in archived_paths else "skipped"})
        return path

    def _write_file_audit_manifest(self, entries: list[FileAuditEntry]) -> Path:
        """Write one CSV row for every Excel file found in Update."""
        self.log_dir.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        path = self.log_dir / f"file_audit_{stamp}.csv"
        fields = [
            "filename", "manufacturer", "request_no", "status",
            "extracted_rows", "priced_rows", "qty_rows", "amount_rows",
            "models", "source_path", "archive_path", "note",
        ]
        with path.open("w", newline="", encoding="utf-8-sig") as fp:
            writer = csv.DictWriter(fp, fieldnames=fields)
            writer.writeheader()
            for entry in sorted(entries, key=lambda item: (item.manufacturer, item.filename)):
                writer.writerow({field: getattr(entry, field) for field in fields})
        return path

    def _write_rejected_manifest(self, entries: list[RejectedFileEntry]) -> Path:
        """Write a human-readable CSV explaining every non-processed file."""
        self.log_dir.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        path = self.log_dir / f"rejected_manifest_{stamp}.csv"
        fields = [
            "filename", "manufacturer", "request_no", "stage",
            "reason_code", "reason", "action", "file_path",
        ]
        with path.open("w", newline="", encoding="utf-8-sig") as fp:
            writer = csv.DictWriter(fp, fieldnames=fields)
            writer.writeheader()
            for entry in entries:
                writer.writerow({
                    "filename": entry.filename,
                    "manufacturer": entry.manufacturer,
                    "request_no": entry.request_no,
                    "stage": entry.stage,
                    "reason_code": entry.reason_code,
                    "reason": entry.reason,
                    "action": entry.action,
                    "file_path": entry.file_path,
                })
        return path

    def _write_log(self, scanned_files: int, selected_files: int, duplicates: int, revisions: int, new_parts: int, updated_rows: int, kr_completed: int, price_changes: int, backup_paths: list[Path], manifest_path: Path, skipped_over_limit: int, by_m: dict[str, ManufacturerResult], unknown_files: list[Path], rejected_manifest_path: Path | None = None, file_audit_path: Path | None = None, result_report_path: Path | None = None) -> Path:
        lines = [
            f"Update 후보: {scanned_files}", f"처리 파일: {selected_files}", f"제한 초과 보류: {skipped_over_limit}",
            f"수정본 우선 제외: {revisions}", f"원본상세 신규행: {new_parts}", f"기존 원본상세 보정행: {updated_rows}", f"KR보완: {kr_completed}",
            f"가격변동: {price_changes}", f"중복 raw row: {duplicates}", f"처리명세: {manifest_path}",
        ]
        if rejected_manifest_path:
            lines.append(f"미반영 진단표: {rejected_manifest_path}")
        if file_audit_path:
            lines.append(f"전체 파일 감사표: {file_audit_path}")
        if result_report_path:
            lines.append(f"업데이트 결과 보고서: {result_report_path}")
        if backup_paths:
            lines.append("백업:")
            lines.extend(f" - {p}" for p in backup_paths)
        if unknown_files:
            lines.append("제조사 구분 불가 파일:")
            lines.extend(f" - {p.name}" for p in unknown_files)
        for m, res in by_m.items():
            lines.append(f"[{m}] 파일 {res.selected_files} / 신규 {res.new_parts} / 보정 {res.updated_rows} / 가격변동 {res.price_changes} / 중복 {res.duplicates} / 상태 {res.status}")
            lines.extend(f"  오류: {e}" for e in res.errors)
        return self.logger.write_summary(lines)
