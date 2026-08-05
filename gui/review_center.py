from __future__ import annotations

from pathlib import Path

from PySide6.QtCore import Qt
from PySide6.QtGui import QDesktopServices
from PySide6.QtWidgets import (
    QAbstractItemView, QComboBox, QDialog, QFileDialog, QHBoxLayout, QHeaderView,
    QLabel, QMessageBox, QPushButton, QTableWidget, QTableWidgetItem, QVBoxLayout,
)
from PySide6.QtCore import QUrl

from core.approval_queue import find_latest_analysis, load_approval_queue, save_approval_queue
from core.approval_apply import simulate_approval_apply, commit_approval_apply


class ReviewCenterDialog(QDialog):
    def __init__(self, root: str | Path, parent=None) -> None:
        super().__init__(parent)
        self.root = Path(root)
        self.queue = None
        self.report_path: Path | None = None
        self.last_simulation_json: Path | None = None
        self.setWindowTitle("CPMS 다중문서 승인센터")
        self.resize(1180, 720)
        self._build_ui()
        self._load_latest()

    def _build_ui(self) -> None:
        layout = QVBoxLayout(self)
        title = QLabel("다중문서 승인센터")
        title.setAlignment(Qt.AlignCenter)
        title.setStyleSheet("font-size: 24px; font-weight: 700;")
        layout.addWidget(title)

        self.summary = QLabel("분석 보고서를 불러오는 중입니다.")
        self.summary.setWordWrap(True)
        layout.addWidget(self.summary)

        self.table = QTableWidget(0, 9)
        self.table.setHorizontalHeaderLabels(["결정", "파일", "시트", "제조사", "문서유형", "행수", "안전조치", "사유", "검토의견"])
        self.table.setSelectionBehavior(QAbstractItemView.SelectRows)
        self.table.setAlternatingRowColors(True)
        self.table.verticalHeader().setVisible(False)
        header = self.table.horizontalHeader()
        header.setSectionResizeMode(0, QHeaderView.ResizeToContents)
        header.setSectionResizeMode(1, QHeaderView.Stretch)
        header.setSectionResizeMode(2, QHeaderView.ResizeToContents)
        header.setSectionResizeMode(3, QHeaderView.ResizeToContents)
        header.setSectionResizeMode(4, QHeaderView.ResizeToContents)
        header.setSectionResizeMode(5, QHeaderView.ResizeToContents)
        header.setSectionResizeMode(6, QHeaderView.ResizeToContents)
        header.setSectionResizeMode(7, QHeaderView.Stretch)
        header.setSectionResizeMode(8, QHeaderView.Stretch)
        layout.addWidget(self.table, stretch=1)

        note = QLabel("안전 원칙: 이 화면에서는 승인 결정만 저장합니다. Master와 Archive는 변경하지 않습니다. 반영은 다음 단계에서 별도 검증 후 수행합니다.")
        note.setStyleSheet("font-weight: 600;")
        note.setWordWrap(True)
        layout.addWidget(note)

        buttons = QHBoxLayout()
        self.btn_choose = QPushButton("분석 보고서 선택")
        self.btn_select_all = QPushButton("승인 가능 항목 모두 선택")
        self.btn_hold_all = QPushButton("전체 보류")
        self.btn_save = QPushButton("승인 결정 저장")
        self.btn_open = QPushButton("원본 분석보고서 열기")
        self.btn_simulate_apply = QPushButton("승인 반영 시뮬레이션")
        self.btn_commit_apply = QPushButton("최종 Master 반영")
        self.btn_commit_apply.setEnabled(False)
        self.btn_close = QPushButton("닫기")
        for button in (self.btn_choose, self.btn_select_all, self.btn_hold_all, self.btn_save, self.btn_open, self.btn_simulate_apply, self.btn_commit_apply, self.btn_close):
            buttons.addWidget(button)
        layout.addLayout(buttons)

        self.btn_choose.clicked.connect(self._choose_report)
        self.btn_select_all.clicked.connect(self._select_all_approvable)
        self.btn_hold_all.clicked.connect(self._hold_all)
        self.btn_save.clicked.connect(self._save)
        self.btn_open.clicked.connect(self._open_report)
        self.btn_simulate_apply.clicked.connect(self._simulate_apply)
        self.btn_commit_apply.clicked.connect(self._commit_apply)
        self.btn_close.clicked.connect(self.close)

    def _load_latest(self) -> None:
        latest = find_latest_analysis(self.root)
        if latest is None:
            self.summary.setText("다중문서 분석 보고서가 없습니다. 먼저 메인 화면에서 '다중문서 안전 분석'을 실행해 주세요.")
            self.btn_save.setEnabled(False)
            return
        self._load_report(latest)

    def _choose_report(self) -> None:
        path, _ = QFileDialog.getOpenFileName(self, "다중문서 분석 JSON 선택", str(self.root / "Log"), "JSON (*.json)")
        if path:
            self._load_report(Path(path))

    def _load_report(self, path: Path) -> None:
        try:
            self.queue = load_approval_queue(path)
            self.report_path = path
            self._populate()
            self.btn_save.setEnabled(True)
        except Exception as exc:
            QMessageBox.critical(self, "보고서 읽기 실패", str(exc))

    def _populate(self) -> None:
        assert self.queue is not None
        self.table.setRowCount(len(self.queue.items))
        approvable = 0
        for row, item in enumerate(self.queue.items):
            combo = QComboBox()
            if item.approvable:
                combo.addItems(["보류", "승인", "반려"])
                approvable += 1
            else:
                combo.addItems(["반려"])
                combo.setEnabled(False)
            combo.setCurrentText(item.decision)
            self.table.setCellWidget(row, 0, combo)
            values = [item.file, item.sheet, item.manufacturer or "-", item.document_type, str(item.rows_estimated), item.safe_action, item.reason, item.comment]
            for col, value in enumerate(values, start=1):
                cell = QTableWidgetItem(value)
                if col != 8:
                    cell.setFlags(cell.flags() & ~Qt.ItemIsEditable)
                self.table.setItem(row, col, cell)
        self.summary.setText(
            f"분석보고서: {Path(self.queue.source_report).name}  |  전체 {len(self.queue.items)}개 시트  |  승인 가능 {approvable}개  |  "
            "반영금지 항목은 자동으로 반려되고 승인할 수 없습니다."
        )

    def _select_all_approvable(self) -> None:
        for row in range(self.table.rowCount()):
            combo = self.table.cellWidget(row, 0)
            if isinstance(combo, QComboBox) and combo.isEnabled():
                combo.setCurrentText("승인")

    def _hold_all(self) -> None:
        for row in range(self.table.rowCount()):
            combo = self.table.cellWidget(row, 0)
            if isinstance(combo, QComboBox) and combo.isEnabled():
                combo.setCurrentText("보류")

    def _sync_from_table(self) -> None:
        assert self.queue is not None
        for row, item in enumerate(self.queue.items):
            combo = self.table.cellWidget(row, 0)
            item.decision = combo.currentText() if isinstance(combo, QComboBox) else "반려"
            comment_item = self.table.item(row, 8)
            item.comment = comment_item.text().strip() if comment_item else ""

    def _save(self) -> None:
        if self.queue is None:
            return
        self._sync_from_table()
        try:
            json_path, excel_path = save_approval_queue(self.root, self.queue)
        except Exception as exc:
            QMessageBox.critical(self, "승인 결정 저장 실패", str(exc))
            return
        QMessageBox.information(
            self,
            "승인 결정 저장 완료",
            f"Master는 변경하지 않았습니다.\n\n승인: {self.queue.approved_count}\n보류: {self.queue.pending_count}\n반려: {self.queue.rejected_count}\n\nExcel: {excel_path}\nJSON: {json_path}",
        )


    def _simulate_apply(self) -> None:
        latest = self.root / "Log" / "MultiDoc_Approval_Latest.json"
        if not latest.exists():
            QMessageBox.warning(self, "승인명세 없음", "먼저 승인 결정을 저장해 주세요.")
            return
        try:
            report = simulate_approval_apply(self.root, latest)
            self.last_simulation_json = Path(report.report_json)
            self.btn_commit_apply.setEnabled(report.passed)
            lines = [
                f"승인 항목: {report.approved_items}",
                f"실제 Master 무변경: {'확인' if report.real_master_unchanged else '실패'}",
            ]
            for item in report.manufacturers:
                lines.append(
                    f"[{item.manufacturer}] 승인시트 {item.approved_sheets} / 추출 {item.extracted_rows} / "
                    f"신규 {item.new_parts} / 보정 {item.updated_rows} / 가격변동 {item.price_changes} / {item.status}"
                )
                lines.extend(f"  오류: {x}" for x in item.errors)
            lines.append(f"보고서: {report.report_excel}")
            QMessageBox.information(
                self, "승인 반영 시뮬레이션" if report.passed else "시뮬레이션 실패",
                f"결과: {report.summary}\n\n" + "\n".join(lines),
            )
        except Exception as exc:
            self.btn_commit_apply.setEnabled(False)
            QMessageBox.critical(self, "승인 반영 시뮬레이션 실패", str(exc))

    def _commit_apply(self) -> None:
        if self.last_simulation_json is None or not self.last_simulation_json.exists():
            QMessageBox.warning(self, "시뮬레이션 필요", "먼저 승인 반영 시뮬레이션을 PASS해 주세요.")
            return
        reply = QMessageBox.warning(
            self, "최종 Master 반영",
            "승인된 시트의 데이터를 실제 제조사 Master에 반영합니다.\n"
            "반영 전 제조사별 Master가 자동 백업됩니다.\n\n계속할까요?",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
            QMessageBox.StandardButton.No,
        )
        if reply != QMessageBox.StandardButton.Yes:
            return
        try:
            report = commit_approval_apply(self.root, self.last_simulation_json)
            self.btn_commit_apply.setEnabled(False)
            QMessageBox.information(
                self, "최종 반영 완료",
                f"승인 항목 {report.approved_items}개를 실제 Master에 반영했습니다.\n"
                f"원본 파일은 삭제하지 않고 Archive/ApprovedMultiDoc에 사본을 보관했습니다.\n\n"
                f"보고서: {report.report_excel}",
            )
        except Exception as exc:
            QMessageBox.critical(self, "최종 Master 반영 실패", str(exc))

    def _open_report(self) -> None:
        if self.queue is None:
            return
        source = Path(self.queue.source_report)
        excel = source.with_suffix(".xlsx")
        target = excel if excel.exists() else source
        QDesktopServices.openUrl(QUrl.fromLocalFile(str(target)))
