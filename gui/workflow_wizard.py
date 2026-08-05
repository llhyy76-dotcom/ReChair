from __future__ import annotations

from pathlib import Path

from PySide6.QtCore import Qt
from PySide6.QtWidgets import (
    QDialog, QGridLayout, QGroupBox, QHBoxLayout, QLabel, QMessageBox,
    QPushButton, QVBoxLayout,
)

from core.workflow_wizard import build_workflow_wizard_state
from core.processed_originals import inspect_processed_originals, move_processed_originals


class WorkflowWizardDialog(QDialog):
    def __init__(self, root: str | Path, main_window, parent=None) -> None:
        super().__init__(parent)
        self.root = Path(root)
        self.main_window = main_window
        self.setWindowTitle("CPMS 업무 흐름 마법사")
        self.resize(900, 620)
        self._rows: list[tuple[QLabel, QLabel, QPushButton]] = []
        self._build_ui()
        self.refresh()

    def _build_ui(self) -> None:
        layout = QVBoxLayout(self)
        title = QLabel("CPMS 업무 흐름 마법사")
        title.setAlignment(Qt.AlignCenter)
        title.setStyleSheet("font-size: 24px; font-weight: 700;")
        layout.addWidget(title)
        self.summary = QLabel("")
        self.summary.setWordWrap(True)
        self.summary.setStyleSheet("font-size: 14px; font-weight: 600; padding: 8px;")
        layout.addWidget(self.summary)

        self.steps_box = QGroupBox("처리 단계")
        self.steps_layout = QGridLayout(self.steps_box)
        self.steps_layout.setColumnStretch(2, 1)
        layout.addWidget(self.steps_box, stretch=1)

        note = QLabel(
            "중요: 복합문서는 승인된 시트만 Master에 반영합니다. 혼합문서 원본은 증빙과 재검토를 위해 "
            "Update에 남을 수 있으며, 반영된 사본은 Archive/ApprovedMultiDoc에 보관됩니다."
        )
        note.setWordWrap(True)
        note.setStyleSheet("padding: 8px; background: #fff7d6; border: 1px solid #d7b85c;")
        layout.addWidget(note)

        buttons = QHBoxLayout()
        self.btn_next = QPushButton("권장 다음 단계 실행")
        self.btn_next.setStyleSheet("font-weight: 700; padding: 8px;")
        self.btn_refresh = QPushButton("상태 새로고침")
        self.btn_close = QPushButton("닫기")
        buttons.addWidget(self.btn_next)
        buttons.addWidget(self.btn_refresh)
        buttons.addStretch(1)
        buttons.addWidget(self.btn_close)
        layout.addLayout(buttons)
        self.btn_next.clicked.connect(self._run_next)
        self.btn_refresh.clicked.connect(self.refresh)
        self.btn_close.clicked.connect(self.close)

    def refresh(self) -> None:
        while self.steps_layout.count():
            item = self.steps_layout.takeAt(0)
            widget = item.widget()
            if widget is not None:
                widget.deleteLater()
        self._rows.clear()
        try:
            self.state = build_workflow_wizard_state(self.root)
        except Exception as exc:
            QMessageBox.critical(self, "업무 흐름 확인 실패", str(exc))
            return
        self.summary.setText(self.state.summary)
        self.btn_next.setText(self.state.next_action_label)
        for row, step in enumerate(self.state.steps):
            number = QLabel(f"STEP {step.number}")
            number.setStyleSheet("font-weight: 700;")
            title = QLabel(step.title)
            status = QLabel(step.status)
            status.setAlignment(Qt.AlignCenter)
            if step.status == "완료":
                status.setStyleSheet("font-weight: 700; color: #176b2c;")
            elif step.status in {"필요", "대기"}:
                status.setStyleSheet("font-weight: 700; color: #9a4d00;")
            else:
                status.setStyleSheet("font-weight: 700; color: #1d4f91;")
            detail = QLabel(step.detail)
            detail.setWordWrap(True)
            action = QPushButton(step.action_label)
            action.setEnabled(step.enabled)
            action.clicked.connect(lambda _checked=False, key=step.action_key: self._run_action(key))
            self.steps_layout.addWidget(number, row, 0)
            self.steps_layout.addWidget(title, row, 1)
            self.steps_layout.addWidget(detail, row, 2)
            self.steps_layout.addWidget(status, row, 3)
            self.steps_layout.addWidget(action, row, 4)

    def _run_next(self) -> None:
        self._run_action(self.state.next_action_key)

    def _run_action(self, key: str) -> None:
        actions = {
            "safety": self.main_window.run_safety_check,
            "route": self.main_window.run_document_route,
            "simulate": self.main_window.start_simulation,
            "multidoc": self.main_window.run_multidoc_analysis,
            "review": self.main_window.open_review_center,
            "pdf": self.main_window.open_pdf_review_manager,
            "diagnostic": self.main_window.open_file_diagnostic,
            "workflow": self.main_window.show_workflow_status,
            "cleanup": self._cleanup_processed_originals,
        }
        action = actions.get(key)
        if action is None:
            QMessageBox.warning(self, "실행 불가", f"지원하지 않는 단계입니다: {key}")
            return
        action()
        self.refresh()

    def _cleanup_processed_originals(self) -> None:
        preview = inspect_processed_originals(self.root)
        if preview.eligible <= 0:
            QMessageBox.information(self, "처리 완료 원본 정리", preview.summary)
            return
        blocked = [x for x in preview.items if x.status == "정리 차단"]
        lines = [
            f"정리 가능: {preview.eligible}개",
            f"차단/건너뜀: {preview.skipped}개",
            "",
            "정리 가능한 파일은 Archive/ApprovedMultiDoc 사본과 SHA-256이 일치합니다.",
            "원본은 삭제하지 않고 Processed_Originals 폴더로 이동합니다.",
        ]
        if blocked:
            lines.extend(["", "차단 파일:"] + [f"- {x.file}: {x.reason}" for x in blocked[:8]])
        reply = QMessageBox.question(
            self, "처리 완료 원본 정리", "\n".join(lines) + "\n\n계속할까요?",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
            QMessageBox.StandardButton.No,
        )
        if reply != QMessageBox.StandardButton.Yes:
            return
        report = move_processed_originals(self.root)
        QMessageBox.information(
            self, "원본 정리 완료" if report.passed else "원본 정리 결과",
            f"{report.summary}\n\n원본 보관 위치: Processed_Originals\n보고서: {report.report_json}",
        )
        self.refresh()
