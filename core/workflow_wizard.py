from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass
from pathlib import Path

from core.document_router import route_folder
from core.processed_originals import inspect_processed_originals


def _latest(folder: Path, pattern: str) -> Path | None:
    files = sorted(folder.glob(pattern), key=lambda p: p.stat().st_mtime, reverse=True)
    return files[0] if files else None


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fp:
        for chunk in iter(lambda: fp.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


@dataclass(frozen=True)
class WizardStep:
    number: int
    title: str
    status: str
    detail: str
    action_key: str
    action_label: str
    enabled: bool


@dataclass(frozen=True)
class WorkflowWizardState:
    steps: list[WizardStep]
    next_action_key: str
    next_action_label: str
    summary: str
    committed_files: list[str]
    update_files: int
    route_counts: dict[str, int]


def _read_json(path: Path | None) -> dict:
    if path is None or not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}


def build_workflow_wizard_state(root: str | Path) -> WorkflowWizardState:
    root = Path(root)
    log_dir = root / "Log"
    update_dir = root / "Update"
    log_dir.mkdir(parents=True, exist_ok=True)
    update_dir.mkdir(parents=True, exist_ok=True)

    safety_path = log_dir / "Safety_Check_Latest.json"
    safety = _read_json(safety_path)
    safety_ok = bool(safety.get("passed"))

    route = route_folder(update_dir, None)
    route_counts = dict(route.counts)
    update_files = len(route.items)

    analysis_path = _latest(log_dir, "MultiDoc_Analysis_*.json")
    analysis = _read_json(analysis_path)
    analysis_ok = bool(analysis) and int(analysis.get("files_scanned", 0) or 0) > 0

    approval_path = log_dir / "MultiDoc_Approval_Latest.json"
    approval = _read_json(approval_path)
    approved_count = sum(1 for item in approval.get("items", []) if item.get("decision") == "승인")
    pending_decisions = sum(1 for item in approval.get("items", []) if item.get("decision") == "보류")
    approval_ok = approved_count > 0

    sim_path = _latest(log_dir, "Approval_Apply_SIMULATION_*.json")
    simulation = _read_json(sim_path)
    simulation_ok = bool(simulation.get("passed"))
    if simulation_ok and approval_path.exists():
        expected = simulation.get("approval_sha256", "")
        if expected and expected != _sha256(approval_path):
            simulation_ok = False

    commit_path = _latest(log_dir, "Approval_Apply_COMMIT_*.json")
    commit = _read_json(commit_path)
    commit_ok = bool(commit.get("passed")) and commit.get("mode") == "COMMIT"
    committed_files: list[str] = []
    commit_approval = Path(commit.get("approval_file", "")) if commit else None
    commit_approval_data = _read_json(commit_approval) if commit_approval else {}
    for item in commit_approval_data.get("items", []):
        if item.get("decision") == "승인" and item.get("file"):
            committed_files.append(str(item["file"]))
    committed_files = sorted(set(committed_files))

    multidoc_count = route_counts.get("MULTI_DOCUMENT", 0)
    standard_count = route_counts.get("STANDARD_UPDATE", 0)
    pdf_count = route_counts.get("PDF_REVIEW", 0)
    demand_count = route_counts.get("DEMAND_HISTORY", 0)
    manual_count = route_counts.get("REVIEW_REQUIRED", 0)

    steps: list[WizardStep] = []
    steps.append(WizardStep(
        1, "안전 점검", "완료" if safety_ok else "필요",
        f"{'PASS · ' + str(safety.get('score', '-')) + '점' if safety_ok else 'Master와 Archive 상태를 먼저 확인합니다.'}",
        "safety", "안전 점검 실행", True,
    ))
    route_done = update_files == 0 or bool(route_counts)
    steps.append(WizardStep(
        2, "문서 자동 분류", "완료" if route_done else "필요",
        f"일반 {standard_count} · 다중문서 {multidoc_count} · PDF {pdf_count} · 수요이력 {demand_count} · 수동검토 {manual_count}",
        "route", "문서 자동 분류", safety_ok,
    ))
    steps.append(WizardStep(
        3, "다중문서 안전 분석", "완료" if (multidoc_count == 0 or analysis_ok) else "필요",
        "다중문서가 없습니다." if multidoc_count == 0 else (
            f"최근 분석 완료 · 승인 가능 {analysis.get('safe_import_sheets', '-')}개" if analysis_ok else f"다중문서 {multidoc_count}개를 시트별로 분석해야 합니다."
        ),
        "multidoc", "다중문서 안전 분석", safety_ok and multidoc_count > 0,
    ))
    approval_status = "완료" if (multidoc_count == 0 or approval_ok) else "필요"
    approval_detail = "승인 대상 없음" if multidoc_count == 0 else (
        f"승인 {approved_count} · 보류 {pending_decisions}" if approval_ok or approval else "분석 결과에서 승인·보류·반려를 결정합니다."
    )
    steps.append(WizardStep(
        4, "승인센터", approval_status, approval_detail,
        "review", "다중문서 승인센터", analysis_ok and multidoc_count > 0,
    ))
    apply_status = "완료" if commit_ok else ("시뮬레이션 완료" if simulation_ok else "대기")
    if commit_ok:
        apply_detail = f"Master 최종 반영 완료 · 승인 원본 {len(committed_files)}개는 Update에 보존될 수 있습니다."
    elif simulation_ok:
        apply_detail = "시뮬레이션 PASS · 승인센터에서 최종 Master 반영을 실행하세요."
    elif approval_ok:
        apply_detail = f"승인 {approved_count}개 · 승인센터에서 반영 시뮬레이션을 실행하세요."
    else:
        apply_detail = "승인 결정 저장 후 진행합니다."
    steps.append(WizardStep(
        5, "시뮬레이션 및 Master 반영", apply_status, apply_detail,
        "review", "승인센터에서 반영 진행", approval_ok,
    ))

    cleanup = inspect_processed_originals(root)
    preserved = cleanup.eligible

    remaining_actionable = standard_count + pdf_count + manual_count
    complete = commit_ok and remaining_actionable == 0
    if complete:
        finish_detail = "승인 데이터 반영이 끝났습니다. Update에 남은 혼합문서 원본은 기록 보존용입니다."
    elif commit_ok:
        finish_detail = f"다중문서 반영 완료. 일반 업데이트 {standard_count}, PDF {pdf_count}, 수동검토 {manual_count}건이 남았습니다."
    else:
        finish_detail = "최종 반영 후 완료 상태와 Archive 사본을 확인합니다."
    steps.append(WizardStep(
        6, "완료 확인", "완료" if complete else "대기", finish_detail,
        "workflow", "업무 흐름 현황 새로고침", True,
    ))
    cleanup_status = "필요" if preserved > 0 else "완료"
    cleanup_detail = (
        f"Master 반영과 Archive 사본 검증이 끝난 원본 {preserved}개가 Update에 남아 있습니다."
        if preserved > 0 else "정리 가능한 처리 완료 원본이 없습니다."
    )
    steps.append(WizardStep(
        7, "처리 완료 원본 정리", cleanup_status, cleanup_detail,
        "cleanup", "처리 완료 원본 정리", commit_ok and preserved > 0,
    ))

    if not safety_ok:
        next_key, next_label = "safety", "안전 점검 실행"
    elif standard_count > 0:
        next_key, next_label = "simulate", f"일반 업데이트 시뮬레이션 ({standard_count}건)"
    elif multidoc_count > 0 and not analysis_ok:
        next_key, next_label = "multidoc", "다중문서 안전 분석"
    elif multidoc_count > 0 and not approval_ok:
        next_key, next_label = "review", "다중문서 승인센터"
    elif approval_ok and not commit_ok:
        next_key, next_label = "review", "승인센터에서 시뮬레이션·최종 반영"
    elif commit_ok and preserved > 0:
        next_key, next_label = "cleanup", f"처리 완료 원본 정리 ({preserved}개)"
    elif pdf_count > 0:
        next_key, next_label = "pdf", f"PDF 검토/승인 ({pdf_count}건)"
    elif manual_count > 0:
        next_key, next_label = "diagnostic", f"수동 검토 ({manual_count}건)"
    else:
        next_key, next_label = "workflow", "완료 상태 새로고침"

    summary = (
        f"Update {update_files}개 · 다음 작업: {next_label}"
        + (f" · Master 반영 완료 원본 보존 {preserved}개" if preserved else "")
    )
    return WorkflowWizardState(steps, next_key, next_label, summary, committed_files, update_files, route_counts)
