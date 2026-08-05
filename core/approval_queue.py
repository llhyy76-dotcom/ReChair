from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Iterable

from openpyxl import Workbook

APPROVABLE_ACTIONS = {"검토 후 단가 반영 가능"}
DECISIONS = {"승인", "보류", "반려"}


@dataclass
class ApprovalItem:
    file: str
    sheet: str
    manufacturer: str
    document_type: str
    rows_estimated: int
    mapped_fields: list[str] = field(default_factory=list)
    safe_action: str = ""
    reason: str = ""
    decision: str = "보류"
    comment: str = ""

    @property
    def approvable(self) -> bool:
        return self.safe_action in APPROVABLE_ACTIONS and bool(self.manufacturer)


@dataclass
class ApprovalQueue:
    source_report: str
    created_at: str
    items: list[ApprovalItem]

    @property
    def approved_count(self) -> int:
        return sum(item.decision == "승인" for item in self.items)

    @property
    def pending_count(self) -> int:
        return sum(item.decision == "보류" for item in self.items)

    @property
    def rejected_count(self) -> int:
        return sum(item.decision == "반려" for item in self.items)

    def validate(self) -> list[str]:
        errors: list[str] = []
        for item in self.items:
            if item.decision not in DECISIONS:
                errors.append(f"허용되지 않은 결정: {item.file} / {item.sheet} / {item.decision}")
            if item.decision == "승인" and not item.approvable:
                errors.append(f"승인 차단 항목: {item.file} / {item.sheet} / {item.safe_action or '제조사 없음'}")
        return errors


def find_latest_analysis(root: str | Path) -> Path | None:
    log_dir = Path(root) / "Log"
    candidates = sorted(log_dir.glob("MultiDoc_Analysis_*.json"), key=lambda p: p.stat().st_mtime, reverse=True)
    return candidates[0] if candidates else None


def load_approval_queue(report_path: str | Path) -> ApprovalQueue:
    report_path = Path(report_path)
    data = json.loads(report_path.read_text(encoding="utf-8"))
    items: list[ApprovalItem] = []
    for row in data.get("items", []):
        safe_action = str(row.get("safe_action", ""))
        manufacturer = str(row.get("manufacturer", ""))
        default_decision = "보류" if safe_action in APPROVABLE_ACTIONS and manufacturer else "반려"
        items.append(ApprovalItem(
            file=str(row.get("file", "")),
            sheet=str(row.get("sheet", "")),
            manufacturer=manufacturer,
            document_type=str(row.get("document_type", "")),
            rows_estimated=int(row.get("rows_estimated", 0) or 0),
            mapped_fields=list(row.get("mapped_fields", []) or []),
            safe_action=safe_action,
            reason=str(row.get("reason", "")),
            decision=default_decision,
        ))
    return ApprovalQueue(source_report=str(report_path), created_at=datetime.now().isoformat(timespec="seconds"), items=items)


def save_approval_queue(root: str | Path, queue: ApprovalQueue) -> tuple[Path, Path]:
    errors = queue.validate()
    if errors:
        raise ValueError("\n".join(errors))

    root = Path(root)
    approval_dir = root / "Approval"
    log_dir = root / "Log"
    approval_dir.mkdir(parents=True, exist_ok=True)
    log_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    json_path = approval_dir / f"MultiDoc_Approval_{stamp}.json"
    excel_path = approval_dir / f"MultiDoc_Approval_{stamp}.xlsx"

    payload = {
        "created_at": queue.created_at,
        "saved_at": datetime.now().isoformat(timespec="seconds"),
        "source_report": queue.source_report,
        "master_changed": False,
        "approved_count": queue.approved_count,
        "pending_count": queue.pending_count,
        "rejected_count": queue.rejected_count,
        "items": [asdict(item) | {"approvable": item.approvable} for item in queue.items],
    }
    json_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    wb = Workbook()
    summary = wb.active
    summary.title = "승인요약"
    summary.append(["생성일", payload["saved_at"]])
    summary.append(["원본 분석보고서", queue.source_report])
    summary.append(["승인", queue.approved_count])
    summary.append(["보류", queue.pending_count])
    summary.append(["반려", queue.rejected_count])
    summary.append(["Master 변경", "없음"])

    detail = wb.create_sheet("승인대기목록")
    detail.append(["결정", "파일", "시트", "제조사", "문서유형", "추정행수", "인식필드", "안전조치", "사유", "검토의견"])
    for item in queue.items:
        detail.append([
            item.decision, item.file, item.sheet, item.manufacturer, item.document_type,
            item.rows_estimated, ", ".join(item.mapped_fields), item.safe_action, item.reason, item.comment,
        ])
    detail.freeze_panes = "A2"
    detail.auto_filter.ref = detail.dimensions
    widths = {"A": 10, "B": 48, "C": 24, "D": 10, "E": 20, "F": 11, "G": 30, "H": 24, "I": 48, "J": 35}
    for column, width in widths.items():
        detail.column_dimensions[column].width = width
    wb.save(excel_path)

    latest = log_dir / "MultiDoc_Approval_Latest.json"
    latest.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return json_path, excel_path
