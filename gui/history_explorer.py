from __future__ import annotations

import os
import traceback
from pathlib import Path

from PySide6.QtCore import QTimer, Qt, Slot
from PySide6.QtGui import QColor
from PySide6.QtWidgets import (
    QAbstractItemView, QComboBox, QDialog, QGridLayout, QHBoxLayout,
    QLabel, QLineEdit, QMessageBox, QPushButton, QTableWidget,
    QTableWidgetItem, QVBoxLayout,
)

from core.history_repository import (
    HistoryRow, available_history_files, filter_history_rows, load_history_rows,
)


TABLE_HEADERS = [
    "구분", "일자", "제조사", "요청번호", "모델", "부품번호",
    "부품명(영문)", "부품명(한글)", "이전값", "최근값",
    "변동액", "변동률", "변경유형", "변경항목", "원본파일", "통화",
]

DEFAULT_DISPLAY_ROWS = 200
MAX_SEARCH_DISPLAY_ROWS = 1000


class HistoryExplorerDialog(QDialog):
    """Safe History viewer for Excel-backed history data.

    History_2026.xlsx is small enough to read synchronously, but rendering thousands
    of QTableWidget cells at once can freeze or crash a packaged Qt application.
    The dialog therefore opens first, loads on the next event-loop tick and renders
    only a bounded number of rows.
    """

    def __init__(self, root: Path, parent=None) -> None:
        super().__init__(parent)
        self.root = root
        self.history_dir = root / "History"
        self.all_rows: list[HistoryRow] = []
        self._loading = False

        self.setWindowTitle("CPMS History Explorer")
        self.resize(1380, 760)
        self.setMinimumSize(1000, 600)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(16, 16, 16, 16)
        layout.setSpacing(10)

        title = QLabel("HISTORY EXPLORER")
        title.setAlignment(Qt.AlignmentFlag.AlignCenter)
        title.setStyleSheet("font-size: 22px; font-weight: 700;")
        layout.addWidget(title)

        description = QLabel(
            "요청번호, 모델, 부품번호, 한글·영문 부품명, 원본파일 또는 날짜로 검색할 수 있습니다."
        )
        description.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(description)

        controls = QGridLayout()
        controls.setHorizontalSpacing(8)

        self.search_input = QLineEdit()
        self.search_input.setPlaceholderText(
            "예: AC2502, L500, Cable, 케이블, 원본파일명, 2026-07-22"
        )
        self.manufacturer_combo = QComboBox()
        self.category_combo = QComboBox()
        self.manufacturer_combo.addItem("전체")
        self.category_combo.addItems(["전체", "가격이력", "변경이력"])

        self.btn_search = QPushButton("검색")
        self.btn_reset = QPushButton("초기화")
        self.btn_reload = QPushButton("새로고침")
        self.btn_open_excel = QPushButton("History Excel 열기")
        self.btn_close = QPushButton("닫기")

        controls.addWidget(QLabel("검색어"), 0, 0)
        controls.addWidget(self.search_input, 0, 1, 1, 5)
        controls.addWidget(QLabel("제조사"), 0, 6)
        controls.addWidget(self.manufacturer_combo, 0, 7)
        controls.addWidget(QLabel("구분"), 0, 8)
        controls.addWidget(self.category_combo, 0, 9)
        controls.addWidget(self.btn_search, 0, 10)
        controls.addWidget(self.btn_reset, 0, 11)
        layout.addLayout(controls)

        summary = QHBoxLayout()
        self.summary_label = QLabel("History 조회창 준비 중")
        self.file_label = QLabel("")
        self.file_label.setAlignment(
            Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter
        )
        summary.addWidget(self.summary_label)
        summary.addStretch(1)
        summary.addWidget(self.file_label)
        layout.addLayout(summary)

        self.table = QTableWidget(0, len(TABLE_HEADERS))
        self.table.setHorizontalHeaderLabels(TABLE_HEADERS)
        self.table.setAlternatingRowColors(True)
        self.table.setSortingEnabled(False)
        self.table.setEditTriggers(QAbstractItemView.EditTrigger.NoEditTriggers)
        self.table.setSelectionBehavior(QAbstractItemView.SelectionBehavior.SelectRows)
        self.table.setSelectionMode(QAbstractItemView.SelectionMode.SingleSelection)
        self.table.verticalHeader().setVisible(False)
        layout.addWidget(self.table, stretch=1)

        bottom = QHBoxLayout()
        bottom.addWidget(self.btn_reload)
        bottom.addWidget(self.btn_open_excel)
        bottom.addStretch(1)
        bottom.addWidget(self.btn_close)
        layout.addLayout(bottom)

        self.search_input.returnPressed.connect(self.apply_filter)
        self.btn_search.clicked.connect(self.apply_filter)
        self.btn_reset.clicked.connect(self.reset_filter)
        self.btn_reload.clicked.connect(self.schedule_reload)
        self.btn_open_excel.clicked.connect(self.open_history_excel)
        self.btn_close.clicked.connect(self.accept)
        self.manufacturer_combo.currentTextChanged.connect(self.apply_filter)
        self.category_combo.currentTextChanged.connect(self.apply_filter)

        # Open the dialog first. Loading starts after Qt has painted the window.
        QTimer.singleShot(0, self.schedule_reload)

    @Slot()
    def schedule_reload(self) -> None:
        if self._loading:
            return
        self._loading = True
        self.btn_reload.setEnabled(False)
        self.btn_search.setEnabled(False)
        self.btn_reset.setEnabled(False)
        self.summary_label.setText("History를 불러오는 중입니다. 잠시 기다려 주세요.")
        self.table.setRowCount(0)
        QTimer.singleShot(25, self.reload_data)

    @Slot()
    def reload_data(self) -> None:
        try:
            rows = load_history_rows(self.history_dir)
            self.all_rows = rows
            self._refresh_manufacturers()

            files = available_history_files(self.history_dir)
            price_count = sum(row.category == "가격이력" for row in rows)
            change_count = sum(row.category == "변경이력" for row in rows)
            self.file_label.setText(
                f"History 파일 {len(files)}개 | 가격 {price_count:,} | 변경 {change_count:,}"
                if files else "History 파일 없음"
            )

            # Initial screen shows the most recent bounded slice only.
            initial_rows = rows[:DEFAULT_DISPLAY_ROWS]
            self.populate_table(
                initial_rows,
                total_count=len(rows),
                prefix=f"최근 {len(initial_rows):,}건 표시",
            )
        except Exception as exc:
            self.all_rows = []
            self.table.setRowCount(0)
            self.summary_label.setText("History 읽기 실패")
            self._write_crash_log(exc)
            QMessageBox.critical(
                self,
                "History 읽기 실패",
                f"History 파일을 읽지 못했습니다.\n\n{exc}\n\n"
                "Parts Manager는 종료되지 않습니다. Log 폴더의 "
                "history_explorer_error.log를 확인해 주세요.",
            )
        finally:
            self._loading = False
            self.btn_reload.setEnabled(True)
            self.btn_search.setEnabled(True)
            self.btn_reset.setEnabled(True)

    def _refresh_manufacturers(self) -> None:
        current = self.manufacturer_combo.currentText()
        manufacturers = sorted({row.manufacturer for row in self.all_rows if row.manufacturer})
        self.manufacturer_combo.blockSignals(True)
        self.manufacturer_combo.clear()
        self.manufacturer_combo.addItem("전체")
        self.manufacturer_combo.addItems(manufacturers)
        index = self.manufacturer_combo.findText(current)
        self.manufacturer_combo.setCurrentIndex(index if index >= 0 else 0)
        self.manufacturer_combo.blockSignals(False)

    @Slot()
    def apply_filter(self) -> None:
        if self._loading:
            return
        try:
            rows = filter_history_rows(
                self.all_rows,
                keyword=self.search_input.text(),
                manufacturer=self.manufacturer_combo.currentText(),
                category=self.category_combo.currentText(),
            )
            visible = rows[:MAX_SEARCH_DISPLAY_ROWS]
            self.populate_table(
                visible,
                total_count=len(rows),
                prefix="검색 결과",
            )
        except Exception as exc:
            self._write_crash_log(exc)
            QMessageBox.warning(
                self,
                "History 검색 오류",
                f"검색 중 오류가 발생했습니다.\n\n{exc}",
            )

    @Slot()
    def reset_filter(self) -> None:
        self.search_input.clear()
        self.manufacturer_combo.blockSignals(True)
        self.manufacturer_combo.setCurrentIndex(0)
        self.manufacturer_combo.blockSignals(False)
        self.category_combo.blockSignals(True)
        self.category_combo.setCurrentIndex(0)
        self.category_combo.blockSignals(False)
        initial_rows = self.all_rows[:DEFAULT_DISPLAY_ROWS]
        self.populate_table(
            initial_rows,
            total_count=len(self.all_rows),
            prefix=f"최근 {len(initial_rows):,}건 표시",
        )

    def populate_table(
        self,
        rows: list[HistoryRow],
        *,
        total_count: int | None = None,
        prefix: str = "조회",
    ) -> None:
        total_count = len(rows) if total_count is None else total_count
        self.table.setUpdatesEnabled(False)
        self.table.setSortingEnabled(False)
        try:
            self.table.clearContents()
            self.table.setRowCount(len(rows))

            for row_index, row in enumerate(rows):
                values = [
                    row.category, row.date, row.manufacturer, row.request_no,
                    row.model, row.part_no, row.part_name_en, row.part_name_kr,
                    row.previous_value, row.latest_value, row.difference,
                    row.change_rate, row.change_type, row.field_name,
                    row.source_file, row.currency,
                ]
                for column_index, value in enumerate(values):
                    text = "" if value is None else str(value)
                    item = QTableWidgetItem(text)
                    item.setToolTip(text)
                    if column_index in {8, 9, 10, 11}:
                        item.setTextAlignment(
                            Qt.AlignmentFlag.AlignRight | Qt.AlignmentFlag.AlignVCenter
                        )
                    self.table.setItem(row_index, column_index, item)

                if row.category == "가격이력":
                    difference = self._float(row.difference)
                    color = (
                        QColor(255, 235, 235)
                        if difference > 0
                        else QColor(235, 244, 255)
                    )
                    for column_index in range(len(TABLE_HEADERS)):
                        item = self.table.item(row_index, column_index)
                        if item is not None:
                            item.setBackground(color)

            widths = [
                85, 145, 70, 130, 100, 105, 260, 250,
                90, 90, 90, 85, 90, 110, 330, 60,
            ]
            for index, width in enumerate(widths):
                self.table.setColumnWidth(index, width)

            shown = len(rows)
            price_count = sum(row.category == "가격이력" for row in rows)
            change_count = sum(row.category == "변경이력" for row in rows)
            truncated = (
                f" | 화면표시 {shown:,}건"
                if total_count > shown else ""
            )
            self.summary_label.setText(
                f"{prefix}: 전체 {total_count:,}건{truncated} | "
                f"표시 중 가격 {price_count:,}건 / 변경 {change_count:,}건"
            )
        finally:
            self.table.setSortingEnabled(True)
            self.table.setUpdatesEnabled(True)
            self.table.viewport().update()

    @staticmethod
    def _float(value: str) -> float:
        try:
            return float(value)
        except (TypeError, ValueError):
            return 0.0

    def _write_crash_log(self, exc: Exception) -> None:
        try:
            log_dir = self.root / "Log"
            log_dir.mkdir(parents=True, exist_ok=True)
            with (log_dir / "history_explorer_error.log").open(
                "a", encoding="utf-8"
            ) as fp:
                fp.write("\n" + "=" * 80 + "\n")
                fp.write(traceback.format_exc())
                fp.write(f"\nException: {exc}\n")
        except Exception:
            pass

    @Slot()
    def open_history_excel(self) -> None:
        files = available_history_files(self.history_dir)
        if not files:
            QMessageBox.information(self, "History", "열 수 있는 History 파일이 없습니다.")
            return

        latest = files[0]
        try:
            os.startfile(str(latest))  # type: ignore[attr-defined]
        except AttributeError:
            QMessageBox.information(self, "History 파일", str(latest))
        except OSError as exc:
            QMessageBox.warning(self, "파일 열기 실패", f"{latest}\n\n{exc}")
