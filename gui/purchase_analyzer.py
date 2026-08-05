from __future__ import annotations

from pathlib import Path
import os

from PySide6.QtCore import QObject, QThread, Signal, Slot
from PySide6.QtWidgets import (
    QDialog, QFileDialog, QGridLayout, QGroupBox, QLabel, QMessageBox,
    QPlainTextEdit, QProgressBar, QPushButton, QVBoxLayout,
)

from core.purchase_analyzer import analyze_purchase, write_purchase_analysis
from core.updater import Updater


class PurchaseWorker(QObject):
    progress = Signal(int, str)
    finished = Signal(object)
    failed = Signal(str)

    def __init__(self, root: Path, source_path: Path) -> None:
        super().__init__()
        self.root = root
        self.source_path = source_path

    @Slot()
    def run(self) -> None:
        try:
            updater = Updater(self.root)
            master_paths = {m: updater.master_path(m) for m in updater.manufacturers}
            result = analyze_purchase(self.source_path, master_paths, self.progress.emit)
            self.progress.emit(85, "분석 보고서 작성 중")
            output_dir = self.root / updater.config.get("purchase_output", "Purchase_Analysis")
            write_purchase_analysis(result, output_dir)
            self.progress.emit(100, "발주 분석 완료")
            self.finished.emit(result)
        except Exception as exc:
            self.failed.emit(str(exc))


class PurchaseAnalyzerDialog(QDialog):
    def __init__(self, root: Path, parent=None) -> None:
        super().__init__(parent)
        self.root = root
        self.source_path: Path | None = None
        self.worker_thread: QThread | None = None
        self.worker: PurchaseWorker | None = None
        self.output_path: Path | None = None
        self.negotiation_output_path: Path | None = None

        self.setWindowTitle("CPMS 발주 분석기")
        self.resize(780, 540)
        layout = QVBoxLayout(self)

        source_box = QGroupBox("발주서")
        source_layout = QGridLayout(source_box)
        self.path_label = QLabel("발주서를 선택하세요.")
        self.path_label.setWordWrap(True)
        self.btn_select = QPushButton("발주서 선택")
        self.btn_run = QPushButton("분석 시작")
        self.btn_run.setEnabled(False)
        source_layout.addWidget(QLabel("파일"), 0, 0)
        source_layout.addWidget(self.path_label, 0, 1)
        source_layout.addWidget(self.btn_select, 1, 0)
        source_layout.addWidget(self.btn_run, 1, 1)
        layout.addWidget(source_box)

        result_box = QGroupBox("분석 결과")
        result_layout = QGridLayout(result_box)
        self.labels = {}
        keys = ["총 품목", "상승", "하락", "동일", "신규", "확인필요", "순영향(USD)"]
        for index, key in enumerate(keys):
            value = QLabel("0")
            value.setStyleSheet("font-size: 16px; font-weight: 700;")
            self.labels[key] = value
            result_layout.addWidget(QLabel(key), index // 4 * 2, index % 4)
            result_layout.addWidget(value, index // 4 * 2 + 1, index % 4)
        layout.addWidget(result_box)

        self.progress = QProgressBar()
        self.progress.setRange(0, 100)
        layout.addWidget(self.progress)
        self.log = QPlainTextEdit()
        self.log.setReadOnly(True)
        layout.addWidget(self.log, stretch=1)
        self.btn_open = QPushButton("발주 분석 결과 열기")
        self.btn_open.setEnabled(False)
        layout.addWidget(self.btn_open)
        self.btn_open_negotiation = QPushButton("공급사 협상자료 열기")
        self.btn_open_negotiation.setEnabled(False)
        layout.addWidget(self.btn_open_negotiation)

        self.btn_select.clicked.connect(self.select_file)
        self.btn_run.clicked.connect(self.run_analysis)
        self.btn_open.clicked.connect(self.open_result)
        self.btn_open_negotiation.clicked.connect(self.open_negotiation_result)

    @Slot()
    def select_file(self) -> None:
        filename, _ = QFileDialog.getOpenFileName(
            self, "발주서 선택", str(self.root),
            "Excel Files (*.xlsx *.xlsm *.xltx);;All Files (*.*)",
        )
        if filename:
            self.source_path = Path(filename)
            self.path_label.setText(filename)
            self.btn_run.setEnabled(True)

    @Slot()
    def run_analysis(self) -> None:
        if not self.source_path:
            return
        self.btn_run.setEnabled(False)
        self.btn_select.setEnabled(False)
        self.btn_open.setEnabled(False)
        self.btn_open_negotiation.setEnabled(False)
        self.progress.setValue(0)
        self.log.clear()
        self.worker_thread = QThread(self)
        self.worker = PurchaseWorker(self.root, self.source_path)
        self.worker.moveToThread(self.worker_thread)
        self.worker_thread.started.connect(self.worker.run)
        self.worker.progress.connect(self.on_progress)
        self.worker.finished.connect(self.on_finished)
        self.worker.failed.connect(self.on_failed)
        self.worker.finished.connect(self.worker_thread.quit)
        self.worker.failed.connect(self.worker_thread.quit)
        self.worker_thread.finished.connect(self.worker_thread.deleteLater)
        self.worker_thread.start()

    @Slot(int, str)
    def on_progress(self, value: int, message: str) -> None:
        self.progress.setValue(value)
        self.log.appendPlainText(message)

    @Slot(object)
    def on_finished(self, result) -> None:
        self.btn_run.setEnabled(True)
        self.btn_select.setEnabled(True)
        self.output_path = result.output_path
        self.negotiation_output_path = result.negotiation_output_path
        self.btn_open.setEnabled(bool(self.output_path))
        self.btn_open_negotiation.setEnabled(bool(self.negotiation_output_path))
        self.labels["총 품목"].setText(str(result.total_items))
        self.labels["상승"].setText(str(result.increased_items))
        self.labels["하락"].setText(str(result.decreased_items))
        self.labels["동일"].setText(str(result.unchanged_items))
        self.labels["신규"].setText(str(result.new_items))
        self.labels["확인필요"].setText(str(result.review_items))
        self.labels["순영향(USD)"].setText(f"{result.net_impact:,.2f}")
        self.log.appendPlainText(f"발주금액: {result.total_order_amount:,.2f} USD")
        self.log.appendPlainText(f"결과 파일: {result.output_path}")
        self.log.appendPlainText(f"공급사 협상자료: {result.negotiation_output_path}")
        for error in result.errors:
            self.log.appendPlainText(f"확인: {error}")

    @Slot(str)
    def on_failed(self, message: str) -> None:
        self.btn_run.setEnabled(True)
        self.btn_select.setEnabled(True)
        QMessageBox.critical(self, "발주 분석 실패", message)

    @Slot()
    def open_result(self) -> None:
        if self.output_path and self.output_path.exists():
            os.startfile(self.output_path)

    @Slot()
    def open_negotiation_result(self) -> None:
        if self.negotiation_output_path and self.negotiation_output_path.exists():
            os.startfile(self.negotiation_output_path)
