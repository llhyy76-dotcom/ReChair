from __future__ import annotations

import hashlib
import json
import shutil
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path


def _latest(folder: Path, pattern: str) -> Path | None:
    files = sorted(folder.glob(pattern), key=lambda p: p.stat().st_mtime, reverse=True)
    return files[0] if files else None


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fp:
        for chunk in iter(lambda: fp.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def _read_json(path: Path | None) -> dict:
    if path is None or not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}


@dataclass(frozen=True)
class OriginalFileStatus:
    file: str
    status: str
    reason: str
    update_path: str
    archive_path: str = ""
    destination_path: str = ""


@dataclass(frozen=True)
class OriginalCleanupReport:
    created_at: str
    mode: str
    passed: bool
    summary: str
    eligible: int
    moved: int
    skipped: int
    items: list[OriginalFileStatus]
    report_json: str = ""


def _committed_file_names(root: Path) -> tuple[list[str], Path | None]:
    commit_path = _latest(root / "Log", "Approval_Apply_COMMIT_*.json")
    commit = _read_json(commit_path)
    if not commit or not commit.get("passed") or commit.get("mode") != "COMMIT":
        return [], commit_path
    approval_path = Path(commit.get("approval_file", ""))
    approval = _read_json(approval_path)
    names = sorted({
        str(item.get("file", "")).strip()
        for item in approval.get("items", [])
        if item.get("decision") == "승인" and str(item.get("file", "")).strip()
    })
    return names, commit_path


def _find_archive_copy(root: Path, file_name: str) -> Path | None:
    base = root / "Archive" / "ApprovedMultiDoc"
    if not base.exists():
        return None
    matches = [p for p in base.glob(f"*/{file_name}") if p.is_file()]
    matches.sort(key=lambda p: p.stat().st_mtime, reverse=True)
    return matches[0] if matches else None


def inspect_processed_originals(root: str | Path) -> OriginalCleanupReport:
    root = Path(root)
    update_dir = root / "Update"
    names, commit_path = _committed_file_names(root)
    items: list[OriginalFileStatus] = []
    eligible = 0

    if not names:
        summary = "최종 반영 완료 원본이 없습니다."
        if commit_path is None:
            summary = "최종 Master 반영 기록이 없습니다."
        return OriginalCleanupReport(
            created_at=datetime.now().isoformat(timespec="seconds"), mode="PREVIEW", passed=True,
            summary=summary, eligible=0, moved=0, skipped=0, items=[]
        )

    for file_name in names:
        src = update_dir / file_name
        archive = _find_archive_copy(root, file_name)
        if not src.exists():
            items.append(OriginalFileStatus(file_name, "이미 정리됨", "Update 폴더에 원본이 없습니다.", str(src), str(archive or "")))
            continue
        if archive is None or not archive.exists():
            items.append(OriginalFileStatus(file_name, "정리 차단", "Archive/ApprovedMultiDoc 사본을 찾지 못했습니다.", str(src)))
            continue
        try:
            same = src.stat().st_size == archive.stat().st_size and _sha256(src) == _sha256(archive)
        except Exception as exc:
            items.append(OriginalFileStatus(file_name, "정리 차단", f"사본 검증 실패: {exc}", str(src), str(archive)))
            continue
        if not same:
            items.append(OriginalFileStatus(file_name, "정리 차단", "Update 원본과 Archive 사본의 해시가 다릅니다.", str(src), str(archive)))
            continue
        eligible += 1
        items.append(OriginalFileStatus(file_name, "정리 가능", "Archive 사본과 SHA-256이 일치합니다.", str(src), str(archive)))

    blocked = sum(1 for x in items if x.status == "정리 차단")
    summary = f"정리 가능 {eligible}개 · 차단 {blocked}개 · 이미 정리 {sum(1 for x in items if x.status == '이미 정리됨')}개"
    return OriginalCleanupReport(
        created_at=datetime.now().isoformat(timespec="seconds"), mode="PREVIEW", passed=blocked == 0,
        summary=summary, eligible=eligible, moved=0, skipped=len(items) - eligible, items=items
    )


def move_processed_originals(root: str | Path) -> OriginalCleanupReport:
    root = Path(root)
    preview = inspect_processed_originals(root)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    destination = root / "Processed_Originals" / stamp
    destination.mkdir(parents=True, exist_ok=True)
    result_items: list[OriginalFileStatus] = []
    moved = 0

    for item in preview.items:
        if item.status != "정리 가능":
            result_items.append(item)
            continue
        src = Path(item.update_path)
        target = destination / src.name
        if target.exists():
            target = destination / f"{src.stem}_{datetime.now().strftime('%H%M%S%f')}{src.suffix}"
        try:
            shutil.move(str(src), str(target))
            moved += 1
            result_items.append(OriginalFileStatus(
                item.file, "정리 완료", "Archive 사본 검증 후 Processed_Originals로 이동했습니다.",
                item.update_path, item.archive_path, str(target)
            ))
        except Exception as exc:
            result_items.append(OriginalFileStatus(
                item.file, "정리 실패", str(exc), item.update_path, item.archive_path, str(target)
            ))

    failed = sum(1 for x in result_items if x.status in {"정리 실패", "정리 차단"})
    report = OriginalCleanupReport(
        created_at=datetime.now().isoformat(timespec="seconds"), mode="MOVE", passed=failed == 0,
        summary=f"처리 완료 원본 {moved}개 이동 · 실패/차단 {failed}개",
        eligible=preview.eligible, moved=moved, skipped=len(result_items) - moved, items=result_items
    )
    log_dir = root / "Log"
    log_dir.mkdir(parents=True, exist_ok=True)
    report_path = log_dir / f"Processed_Originals_{stamp}.json"
    data = asdict(report)
    data["report_json"] = str(report_path)
    report_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    return OriginalCleanupReport(**data)
