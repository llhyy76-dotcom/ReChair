from __future__ import annotations

import os
from pathlib import Path

from PySide6.QtCore import QObject, QThread, Qt, Signal, Slot
from PySide6.QtWidgets import (
    QAbstractItemView, QDialog, QHBoxLayout, QLabel, QMessageBox,
    QPushButton, QTableWidget, QTableWidgetItem, QVBoxLayout,
)

from core.diagnostic_engine import (
    DiagnosticItem, diagnose_folder, quarantine_excluded, simulate_update,
    write_diagnostic_csv,
)


class DiagnosticWorker(QObject):
    finished = Signal(object)
    failed = Signal(str)

    def __init__(self, update_dir: Path) -> None:
        super().__init__()
        self.update_dir = update_dir

    @Slot()
    def run(self) -> None:
        try:
            self.finished.emit(diagnose_folder(self.update_dir))
        except Exception as exc:
            self.failed.emit(str(exc))


HEADERS = [
    "등급", "조치", "파일명", "제조사", "요청번호",
    "추출행", "단가행", "신뢰도", "판정사유",
]


class FileDiagnosticDialog(QDialog):
    def __init__(self, root: Path, parent=None) -> None:
        super().__init__(parent)
        self.root = root
        self.update_dir = root / "Update"
        self.items: list[DiagnosticItem] = []
        self.worker_thread: QThread | None = None
        self.worker: DiagnosticWorker | None = None

        self.setWindowTitle("CPMS 파일 진단")
        self.resize(1250, 720)

        layout = QVBoxLayout(self)
        title = QLabel("FILE DIAGNOSTIC")
        title.setAlignment(Qt.AlignmentFlag.AlignCenter)
        title.setStyleSheet("font-size: 22px; font-weight: 700;")
        layout.addWidget(title)

        self.summary = QLabel("Update 폴더의 파일을 진단합니다.")
        layout.addWidget(self.summary)

        self.table = QTableWidget(0, len(HEADERS))
        self.table.setHorizontalHeaderLabels(HEADERS)
        self.table.setEditTriggers(QAbstractItemView.EditTrigger.NoEditTriggers)
        self.table.setSelectionBehavior(QAbstractItemView.SelectionBehavior.SelectRows)
        self.table.setAlternatingRowColors(True)
        layout.addWidget(self.table, stretch=1)

        buttons = QHBoxLayout()
        self.btn_scan = QPushButton("진단 실행")
        self.btn_report = QPushButton("진단 CSV 열기")
        self.btn_simulate = QPushButton("업데이트 예상")
        self.btn_clean = QPushButton("D등급 제외파일 정리")
        self.btn_close = QPushButton("닫기")
        buttons.addWidget(self.btn_scan)
        buttons.addWidget(self.btn_report)
        buttons.addWidget(self.btn_simulate)
        buttons.addWidget(self.btn_clean)
        buttons.addStretch(1)
        buttons.addWidget(self.btn_close)
        layout.addLayout(buttons)

        self.btn_scan.clicked.connect(self.run_scan)
        self.btn_report.clicked.connect(self.open_report)
        self.btn_simulate.clicked.connect(self.show_simulation)
        self.btn_clean.clicked.connect(self.clean_excluded)
        self.btn_close.clicked.connect(self.accept)
        self.report_path: Path | None = None

        self.summary.setText("진단 실행을 누르면 별도 작업 스레드에서 검사합니다. 대용량 파일은 시간이 걸릴 수 있습니다.")

    @Slot()
    def run_scan(self) -> None:
        if self.worker_thread is not None and self.worker_thread.isRunning():
            QMessageBox.information(self, "파일 진단", "이미 진단이 진행 중입니다.")
            return
        self.btn_scan.setEnabled(False)
        self.summary.setText("진단 중입니다. 창은 계속 사용할 수 있습니다.")
        self.worker_thread = QThread(self)
        self.worker = DiagnosticWorker(self.update_dir)
        self.worker.moveToThread(self.worker_thread)
        self.worker_thread.started.connect(self.worker.run)
        self.worker.finished.connect(self._scan_finished)
        self.worker.failed.connect(self._scan_failed)
        self.worker.finished.connect(self.worker_thread.quit)
        self.worker.failed.connect(self.worker_thread.quit)
        self.worker_thread.finished.connect(self.worker_thread.deleteLater)
        self.worker_thread.finished.connect(self._clear_worker)
        self.worker_thread.start()

    @Slot(object)
    def _scan_finished(self, items: object) -> None:
        self.items = list(items)
        self.populate()
        self.report_path = write_diagnostic_csv(self.items, self.root / "Log")
        self.btn_scan.setEnabled(True)

    @Slot(str)
    def _scan_failed(self, message: str) -> None:
        self.btn_scan.setEnabled(True)
        self.summary.setText("진단 실패")
        QMessageBox.critical(self, "진단 실패", message)

    @Slot()
    def _clear_worker(self) -> None:
        self.worker = None
        self.worker_thread = None

    def populate(self) -> None:
        self.table.setRowCount(len(self.items))
        counts = {grade: 0 for grade in "ABCD"}
        for row, item in enumerate(self.items):
            counts[item.category] = counts.get(item.category, 0) + 1
            values = [
                item.category, item.action, item.path.name,
                item.manufacturer, item.request_no,
                item.extracted_rows, item.priced_rows,
                f"{item.confidence}%", item.reason,
            ]
            for col, value in enumerate(values):
                cell = QTableWidgetItem(str(value))
                cell.setToolTip(item.sheet_summary or item.reason)
                self.table.setItem(row, col, cell)

        widths = [55, 165, 300, 75, 130, 70, 70, 70, 360]
        for col, width in enumerate(widths):
            self.table.setColumnWidth(col, width)
        self.summary.setText(
            f"전체 {len(self.items)}건 | "
            f"A 자동반영 {counts.get('A',0)} | "
            f"B 수정/검토 {counts.get('B',0)} | "
            f"C OCR검토 {counts.get('C',0)} | "
            f"D 반영제외 {counts.get('D',0)}"
        )

    @Slot()
    def open_report(self) -> None:
        if not self.report_path or not self.report_path.exists():
            self.run_scan()
        if not self.report_path:
            return
        try:
            os.startfile(str(self.report_path))  # type: ignore[attr-defined]
        except Exception:
            QMessageBox.information(self, "진단 보고서", str(self.report_path))

    @Slot()
    def show_simulation(self) -> None:
        try:
            results = simulate_update(self.root, self.items)
        except Exception as exc:
            QMessageBox.critical(self, "업데이트 예상 실패", str(exc))
            return

        if not results:
            QMessageBox.information(
                self, "업데이트 예상",
                "자동 반영 가능한 A등급 제조사 파일이 없습니다."
            )
            return

        lines = ["Master를 변경하지 않은 사전 예상 결과입니다.", ""]
        total_files = total_rows = total_new = total_price = total_dup = 0
        for result in results:
            lines.append(
                f"[{result.manufacturer}] 파일 {result.files} / "
                f"추출 {result.parsed_rows} / 예상 신규 {result.expected_new_parts} / "
                f"예상 가격변동 {result.expected_price_changes} / "
                f"예상 중복 {result.expected_duplicates}"
            )
            if result.note:
                lines.append(f"  확인: {result.note}")
            total_files += result.files
            total_rows += result.parsed_rows
            total_new += result.expected_new_parts
            total_price += result.expected_price_changes
            total_dup += result.expected_duplicates

        lines.extend([
            "",
            f"합계 파일: {total_files}",
            f"합계 추출행: {total_rows}",
            f"예상 신규부품: {total_new}",
            f"예상 가격변동: {total_price}",
            f"예상 중복: {total_dup}",
            "",
            "이 기능은 Master·History·Archive를 변경하지 않습니다.",
        ])
        QMessageBox.information(self, "업데이트 예상", "\n".join(lines))

    @Slot()
    def clean_excluded(self) -> None:
        targets = [item for item in self.items if item.safe_to_exclude]
        if not targets:
            QMessageBox.information(self, "제외파일 정리", "이동할 D등급 파일이 없습니다.")
            return

        reply = QMessageBox.question(
            self,
            "D등급 파일 정리",
            f"단가 Master 반영 제외 판정 파일 {len(targets)}개를\n"
            "Excluded\\날짜 폴더로 이동합니다.\n\n"
            "파일은 삭제하지 않고 보관합니다. 계속할까요?",
        )
        if reply != QMessageBox.StandardButton.Yes:
            return

        moved, errors = quarantine_excluded(targets, self.root / "Excluded")
        message = f"이동 완료: {len(moved)}개"
        if errors:
            message += "\n\n실패:\n" + "\n".join(errors)
        QMessageBox.information(self, "제외파일 정리 결과", message)
        self.run_scan()
