from __future__ import annotations

import csv
import json
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path

from openpyxl import Workbook

from core.document_router import RouteItem, route_folder


ROUTE_STATUS = {
    "STANDARD_UPDATE": ("일반 업데이트 대기", "업데이트 시뮬레이션 후 업데이트 시작"),
    "MULTI_DOCUMENT": ("다중문서 승인 대기", "다중문서 안전 분석 → 승인센터"),
    "DEMAND_HISTORY": ("수요이력 대기", "수요이력 전용 기능 개발 전까지 보관"),
    "PDF_REVIEW": ("PDF 검토 대기", "PDF 검토/승인"),
    "REVIEW_REQUIRED": ("수동 검토 필요", "파일 진단 또는 문서 양식 확인"),
    "UNSUPPORTED": ("지원 제외", "지원 형식으로 변환"),
}


@dataclass(frozen=True)
class WorkflowItem:
    filename: str
    status: str
    route: str
    manufacturers: str
    next_action: str
    reason: str
    location: str
    source: str


@dataclass(frozen=True)
class WorkflowReport:
    created_at: str
    counts: dict[str, int]
    items: list[WorkflowItem]
    json_path: str
    excel_path: str

    @property
    def pending(self) -> int:
        return sum(
            value for key, value in self.counts.items()
            if key not in {"처리 완료(Archive)"}
        )

    @property
    def completed(self) -> int:
        return self.counts.get("처리 완료(Archive)", 0)


def _latest(log_dir: Path, pattern: str) -> Path | None:
    files = sorted(log_dir.glob(pattern), key=lambda p: p.stat().st_mtime, reverse=True)
    return files[0] if files else None


def _load_processed(log_dir: Path) -> list[WorkflowItem]:
    path = _latest(log_dir, "processed_manifest_*.csv")
    if path is None:
        return []
    items: list[WorkflowItem] = []
    with path.open("r", encoding="utf-8-sig", newline="") as fp:
        for row in csv.DictReader(fp):
            if str(row.get("status", "")).lower() != "archived":
                continue
            items.append(
                WorkflowItem(
                    filename=row.get("filename", ""),
                    status="처리 완료(Archive)",
                    route="STANDARD_UPDATE",
                    manufacturers=row.get("manufacturer", ""),
                    next_action="완료",
                    reason=f"요청번호 {row.get('request_no', '')} / 추출 {row.get('parsed_rows', '0')}행",
                    location=row.get("archived_to", ""),
                    source=path.name,
                )
            )
    return items


def _route_to_item(route: RouteItem) -> WorkflowItem:
    status, next_action = ROUTE_STATUS.get(route.route, (route.route, "검토"))
    return WorkflowItem(
        filename=route.filename,
        status=status,
        route=route.route,
        manufacturers=", ".join(route.manufacturers) or "-",
        next_action=next_action,
        reason=route.reason,
        location=route.path,
        source="Update",
    )


def build_workflow_report(root: Path, write_files: bool = True) -> WorkflowReport:
    root = Path(root)
    update_dir = root / "Update"
    log_dir = root / "Log"
    update_dir.mkdir(parents=True, exist_ok=True)
    log_dir.mkdir(parents=True, exist_ok=True)

    route_report = route_folder(update_dir, log_dir if write_files else None)
    current_items = [_route_to_item(item) for item in route_report.items]
    completed_items = _load_processed(log_dir)

    current_names = {item.filename for item in current_items}
    completed_items = [item for item in completed_items if item.filename not in current_names]
    items = current_items + completed_items

    counts: dict[str, int] = {}
    for item in items:
        counts[item.status] = counts.get(item.status, 0) + 1

    created_at = datetime.now().isoformat(timespec="seconds")
    json_path = ""
    excel_path = ""
    if write_files:
        json_target = log_dir / "Workflow_Status_Latest.json"
        excel_target = log_dir / "Workflow_Status_Latest.xlsx"
        payload = {
            "created_at": created_at,
            "counts": counts,
            "items": [asdict(item) for item in items],
        }
        json_target.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

        wb = Workbook()
        ws = wb.active
        ws.title = "업무흐름"
        ws.append(["파일명", "상태", "문서경로", "제조사", "다음 조치", "판정 사유", "현재 위치", "근거"])
        for item in items:
            ws.append([
                item.filename, item.status, item.route, item.manufacturers,
                item.next_action, item.reason, item.location, item.source,
            ])
        summary = wb.create_sheet("요약")
        summary.append(["상태", "건수"])
        for key, value in sorted(counts.items()):
            summary.append([key, value])
        for column, width in {"A": 42, "B": 22, "C": 20, "D": 14, "E": 34, "F": 45, "G": 65, "H": 24}.items():
            ws.column_dimensions[column].width = width
        summary.column_dimensions["A"].width = 28
        summary.column_dimensions["B"].width = 12
        wb.save(excel_target)
        json_path = str(json_target)
        excel_path = str(excel_target)

    return WorkflowReport(created_at, counts, items, json_path, excel_path)
