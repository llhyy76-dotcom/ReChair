from __future__ import annotations

from pathlib import Path
import sys

from PySide6.QtCore import QObject, QThread, Signal, Slot
from PySide6.QtWidgets import QMainWindow, QMessageBox

from core.updater import UpdateResult, Updater
from core.ocr_engine import check_ocr_health
from core.version import APP_NAME, APP_VERSION
from gui.ui_main import UiMainWindow
from gui.history_explorer import HistoryExplorerDialog
from gui.purchase_analyzer import PurchaseAnalyzerDialog
from gui.pdf_review_manager import PdfReviewManagerDialog
from gui.file_diagnostic import FileDiagnosticDialog
from gui.review_center import ReviewCenterDialog
from gui.workflow_wizard import WorkflowWizardDialog
from core.safety import build_safety_report
from core.simulator import SimulationReport, UpdateSimulator
from core.multidoc_analyzer import analyze_multidoc_folder
from core.document_router import route_folder
from core.workflow_manager import build_workflow_report


class UpdateWorker(QObject):
    progress = Signal(int, str)
    finished = Signal(object)
    failed = Signal(str)

    def __init__(self, root: Path, mode: str = "update") -> None:
        super().__init__(); self.root = root; self.mode = mode

    @Slot()
    def run(self) -> None:
        try:
            updater = Updater(self.root)
            if self.mode == "rebuild":
                self.finished.emit(updater.rebuild_from_archive(self.progress.emit))
            elif self.mode == "simulate":
                self.finished.emit(UpdateSimulator(self.root).run(self.progress.emit))
            else:
                self.finished.emit(updater.run(self.progress.emit))
        except Exception as exc:
            self.failed.emit(str(exc))


class MainWindow(QMainWindow):
    def __init__(self) -> None:
        super().__init__()
        self.ui = UiMainWindow(); self.ui.setup_ui(self)
        self.setWindowTitle(f"{APP_NAME} {APP_VERSION}")
        self.root = self.resolve_app_root()
        self.worker_thread: QThread | None = None; self.worker: UpdateWorker | None = None
        self.history_dialog: HistoryExplorerDialog | None = None
        self.pdf_review_dialog: PdfReviewManagerDialog | None = None
        self.file_diagnostic_dialog: FileDiagnosticDialog | None = None
        self.review_center_dialog: ReviewCenterDialog | None = None
        self.workflow_wizard_dialog: WorkflowWizardDialog | None = None
        self.ui.btn_simulate.clicked.connect(self.start_simulation)
        self.ui.btn_update.clicked.connect(self.start_update)
        self.ui.btn_rebuild.clicked.connect(self.start_rebuild)
        self.ui.btn_search.clicked.connect(self.open_history_explorer)
        self.ui.btn_log.clicked.connect(self.show_log_location)
        self.ui.btn_ocr.clicked.connect(self.show_ocr_status)
        self.ui.btn_purchase.clicked.connect(self.open_purchase_analyzer)
        self.ui.btn_pdf_review.clicked.connect(self.open_pdf_review_manager)
        self.ui.btn_diagnostic.clicked.connect(self.open_file_diagnostic)
        self.ui.btn_multidoc.clicked.connect(self.run_multidoc_analysis)
        self.ui.btn_review_center.clicked.connect(self.open_review_center)
        self.ui.btn_route.clicked.connect(self.run_document_route)
        self.ui.btn_workflow.clicked.connect(self.show_workflow_status)
        self.ui.btn_wizard.clicked.connect(self.open_workflow_wizard)
        self.ui.btn_safety.clicked.connect(self.run_safety_check)
        self.refresh_scan_count()
        self.refresh_workflow_status(write_files=False)
        self.refresh_ocr_status()

    def resolve_app_root(self) -> Path:
        if getattr(sys, "frozen", False):
            exe_dir = Path(sys.executable).resolve().parent; candidates = [exe_dir, exe_dir.parent, Path.cwd()]
        else:
            candidates = [Path(__file__).resolve().parents[1], Path.cwd()]
        for candidate in candidates:
            if (candidate / "Config" / "config.json").exists(): return candidate
        return candidates[0]

    def refresh_scan_count(self) -> None:
        try:
            updater = Updater(self.root)
            all_files = updater.scan()
            excel_files = [
                path for path in all_files
                if path.suffix.lower() in {".xls", ".xlsx", ".xlsm", ".xltx", ".xltm"}
            ]
            grouped = updater.scan_by_manufacturer()
            total = sum(len(v) for v in grouped.values())
            unclassified = max(len(excel_files) - total, 0)
            pdf_count = sum(path.suffix.lower() == ".pdf" for path in all_files)
            parts = [f"{m}: {len(grouped.get(m, []))}" for m in updater.manufacturers]
            detail = f"Update 대기: 처리대상 {total}건 / 전체 {len(all_files)}건"
            if unclassified:
                detail += f" / 제조사 미분류 {unclassified}건"
            if pdf_count:
                detail += f" / PDF 검토 {pdf_count}건"
            self.ui.update_count_label.setText(detail)
            master_parts = []
            for m in updater.manufacturers:
                master_parts.append(f"{m}: {'정상' if updater.master_path(m).exists() else '없음'}")
            self.ui.manufacturer_status_label.setText(" / ".join(master_parts) + "   |   " + " / ".join(parts))
        except Exception as exc:
            self.ui.update_count_label.setText("Update 대기: 확인 실패")
            self.ui.manufacturer_status_label.setText(str(exc))

    def _start_worker(self, mode: str) -> None:
        self.ui.btn_simulate.setEnabled(False); self.ui.btn_update.setEnabled(False); self.ui.btn_rebuild.setEnabled(False); self.ui.textbox.clear(); self.ui.progressbar.setValue(0)
        self.worker_thread = QThread(self); self.worker = UpdateWorker(self.root, mode=mode); self.worker.moveToThread(self.worker_thread)
        self.worker_thread.started.connect(self.worker.run); self.worker.progress.connect(self.on_progress)
        self.worker.finished.connect(self.on_finished); self.worker.failed.connect(self.on_failed)
        self.worker.finished.connect(self.worker_thread.quit); self.worker.failed.connect(self.worker_thread.quit)
        self.worker_thread.finished.connect(self.worker_thread.deleteLater); self.worker_thread.start()

    @Slot()
    def start_simulation(self) -> None:
        self._start_worker("simulate")

    @Slot()
    def start_update(self) -> None:
        reply = QMessageBox.question(
            self,
            "실제 업데이트",
            "실제 Master를 변경하고 처리 파일을 Archive로 이동합니다.\n\n먼저 업데이트 시뮬레이션을 실행하는 것을 권장합니다. 계속할까요?",
        )
        if reply == QMessageBox.StandardButton.Yes:
            self._start_worker("update")

    @Slot()
    def start_rebuild(self) -> None:
        reply = QMessageBox.question(self, "전체 재생성", "Archive 기준으로 제조사별 Master를 처음부터 다시 생성합니다. 계속할까요?")
        if reply == QMessageBox.StandardButton.Yes:
            self._start_worker("rebuild")

    @Slot(int, str)
    def on_progress(self, value: int, message: str) -> None:
        self.ui.progressbar.setValue(value); self.ui.textbox.appendPlainText(message)

    @Slot(object)
    def on_finished(self, result: object) -> None:
        self.ui.btn_simulate.setEnabled(True); self.ui.btn_update.setEnabled(True); self.ui.btn_rebuild.setEnabled(True)
        if isinstance(result, SimulationReport):
            self.ui.safety_status_label.setText(result.summary)
            self.ui.textbox.appendPlainText(f"시뮬레이션: {result.summary}")
            self.ui.textbox.appendPlainText(f"실제 Master 무변경: {'정상' if result.real_master_unchanged else '실패'}")
            self.ui.textbox.appendPlainText(f"임시환경 안전점검: {result.safety_summary} / {result.safety_score}점")
            for item in result.manufacturers:
                self.ui.textbox.appendPlainText(
                    f"[{item.manufacturer}] 파일 {item.selected_files} / 신규 {item.new_parts} / "
                    f"보정 {item.updated_rows} / 가격변동 {item.price_changes} / {item.status}"
                )
                for error in item.errors:
                    self.ui.textbox.appendPlainText(f"  오류: {error}")
            self.ui.textbox.appendPlainText(f"보고서(JSON): {result.report_json}")
            self.ui.textbox.appendPlainText(f"보고서(Excel): {result.report_excel}")
            QMessageBox.information(
                self,
                "업데이트 시뮬레이션" if result.passed else "시뮬레이션 점검 필요",
                f"{result.summary}\n\n실제 Master 무변경: {'확인' if result.real_master_unchanged else '실패'}\n"
                f"안전점수: {result.safety_score}점\n\n보고서: {result.report_excel}",
            )
            self.refresh_scan_count()
            return
        self.ui.new_parts_label.setText(str(result.new_parts)); self.ui.kr_label.setText(str(result.kr_completed))
        self.ui.price_label.setText(str(result.price_changes)); self.ui.duplicate_label.setText(str(result.duplicates))
        for m, res in result.by_manufacturer.items():
            self.ui.textbox.appendPlainText(f"[{m}] 파일 {res.selected_files} / 실제신규 {res.new_parts} / 이번실행 가격이력검출 {res.price_changes} / 누적 가격변동부품 {res.cumulative_price_variations} / History 실행 {res.history_runs}·변경 {res.history_events} / 동일파일 재처리 {res.reprocessed_rows} / 중복 {res.duplicates} / {res.status}")
            for err in res.errors: self.ui.textbox.appendPlainText(f"  오류: {err}")
        self.ui.textbox.appendPlainText(f"로그: {result.log_path}")
        self.ui.textbox.appendPlainText(f"처리명세: {result.manifest_path}")
        self.ui.textbox.appendPlainText(f"History 실제변경: {result.history_events}건 / 누적 가격변동부품: {result.cumulative_price_variations}건 (실행이력은 제조사별 1건씩 기록)")
        if result.history_path:
            self.ui.textbox.appendPlainText(f"History 파일: {result.history_path}")
        self.refresh_scan_count()
        workflow = self.refresh_workflow_status(write_files=True)
        QMessageBox.information(
            self,
            "업데이트 처리 결과",
            f"정상 반영 후 Archive 이동: {workflow.completed}건\n"
            f"Update 폴더에 남은 파일: {workflow.pending}건\n\n"
            "남은 파일은 미반영 오류가 아니라 문서 유형별 승인·검토 대기 또는 증빙 원본 보존일 수 있습니다. "
            "'업무 흐름 마법사'에서 다음 조치를 확인하세요.",
        )

    @Slot(str)
    def on_failed(self, message: str) -> None:
        self.ui.btn_simulate.setEnabled(True); self.ui.btn_update.setEnabled(True); self.ui.btn_rebuild.setEnabled(True); QMessageBox.critical(self, "업데이트 실패", message)

    @Slot()
    def open_history_explorer(self) -> None:
        try:
            if self.history_dialog is not None and self.history_dialog.isVisible():
                self.history_dialog.raise_()
                self.history_dialog.activateWindow()
                return
            self.history_dialog = HistoryExplorerDialog(self.root, self)
            self.history_dialog.finished.connect(self._clear_history_dialog)
            self.history_dialog.open()
        except Exception as exc:
            self.history_dialog = None
            QMessageBox.critical(
                self,
                "History Explorer 실행 실패",
                f"History 조회창을 열지 못했습니다.\n\n{exc}\n\n"
                "Parts Manager는 계속 사용할 수 있습니다.",
            )

    @Slot()
    def _clear_history_dialog(self) -> None:
        if self.history_dialog is not None:
            self.history_dialog.deleteLater()
        self.history_dialog = None

    @Slot()
    def open_purchase_analyzer(self) -> None:
        dialog = PurchaseAnalyzerDialog(self.root, self)
        dialog.exec()


    @Slot()
    def open_pdf_review_manager(self) -> None:
        try:
            if self.pdf_review_dialog is not None and self.pdf_review_dialog.isVisible():
                self.pdf_review_dialog.raise_()
                self.pdf_review_dialog.activateWindow()
                return
            self.pdf_review_dialog = PdfReviewManagerDialog(self.root, self)
            self.pdf_review_dialog.finished.connect(self._clear_pdf_review_dialog)
            self.pdf_review_dialog.open()
        except Exception as exc:
            self.pdf_review_dialog = None
            QMessageBox.critical(self, "PDF 검토창 실행 실패", str(exc))

    @Slot()
    def _clear_pdf_review_dialog(self) -> None:
        if self.pdf_review_dialog is not None:
            self.pdf_review_dialog.deleteLater()
        self.pdf_review_dialog = None




    @Slot()
    def run_multidoc_analysis(self) -> None:
        try:
            self.ui.textbox.clear()
            report = analyze_multidoc_folder(self.root, lambda value, message: (self.ui.progressbar.setValue(value), self.ui.textbox.appendPlainText(message)))
            self.ui.textbox.appendPlainText(f"분석파일: {report.files_scanned} / 시트: {report.sheets_scanned}")
            self.ui.textbox.appendPlainText(f"검토 후 단가반영 가능: {report.safe_import_sheets}")
            self.ui.textbox.appendPlainText(f"수요이력 전용: {report.demand_only_sheets}")
            self.ui.textbox.appendPlainText(f"Master 반영금지: {report.blocked_sheets}")
            self.ui.textbox.appendPlainText(f"보고서: {report.excel_path}")
            QMessageBox.information(self, "다중문서 안전 분석", f"Master는 변경하지 않았습니다.\n\n분석 파일: {report.files_scanned}\n분석 시트: {report.sheets_scanned}\n검토 후 단가반영 가능: {report.safe_import_sheets}\n수요이력 전용: {report.demand_only_sheets}\n반영금지: {report.blocked_sheets}\n\n보고서: {report.excel_path}")
        except Exception as exc:
            QMessageBox.critical(self, "다중문서 분석 실패", str(exc))


    @Slot()
    def open_review_center(self) -> None:
        try:
            if self.review_center_dialog is not None and self.review_center_dialog.isVisible():
                self.review_center_dialog.raise_()
                self.review_center_dialog.activateWindow()
                return
            self.review_center_dialog = ReviewCenterDialog(self.root, self)
            self.review_center_dialog.finished.connect(self._clear_review_center)
            self.review_center_dialog.open()
        except Exception as exc:
            self.review_center_dialog = None
            QMessageBox.critical(self, "승인센터 실행 실패", str(exc))

    @Slot()
    def _clear_review_center(self) -> None:
        if self.review_center_dialog is not None:
            self.review_center_dialog.deleteLater()
        self.review_center_dialog = None

    @Slot()
    def run_document_route(self) -> None:
        try:
            report = route_folder(self.root / "Update", self.root / "Log")
            labels = {
                "STANDARD_UPDATE": "일반 업데이트",
                "MULTI_DOCUMENT": "다중문서 승인",
                "DEMAND_HISTORY": "수요이력",
                "PDF_REVIEW": "PDF 검토",
                "REVIEW_REQUIRED": "수동 검토",
                "UNSUPPORTED": "지원 제외",
            }
            self.ui.textbox.clear()
            self.ui.textbox.appendPlainText("문서 자동 분류 완료")
            for key, count in sorted(report.counts.items()):
                self.ui.textbox.appendPlainText(f"{labels.get(key, key)}: {count}건")
            for item in report.items:
                makers = ",".join(item.manufacturers) or "-"
                self.ui.textbox.appendPlainText(
                    f"[{labels.get(item.route, item.route)}] {item.filename} / 제조사 {makers} / {item.reason}"
                )
            self.ui.textbox.appendPlainText(f"보고서: {report.report_json}")
            self.refresh_workflow_status(write_files=True)
            QMessageBox.information(
                self, "문서 자동 분류",
                "분류만 완료했습니다. Master와 Archive는 변경하지 않았으며, 파일이 Update 폴더에 남아 있는 것이 정상입니다.\n\n"
                + "\n".join(f"{labels.get(k, k)}: {v}건" for k, v in sorted(report.counts.items()))
                + "\n\n다음 단계는 업무 흐름 현황에서 확인하세요."
                + f"\n보고서: {report.report_json}"
            )
        except Exception as exc:
            QMessageBox.critical(self, "문서 자동 분류 실패", str(exc))

    def refresh_workflow_status(self, write_files: bool = False):
        try:
            report = build_workflow_report(self.root, write_files=write_files)
            pending = sum(
                value for key, value in report.counts.items()
                if key != "처리 완료(Archive)"
            )
            review = sum(
                report.counts.get(key, 0)
                for key in ("다중문서 승인 대기", "PDF 검토 대기", "수동 검토 필요")
            )
            self.ui.workflow_pending_label.setText(str(pending))
            self.ui.workflow_review_label.setText(str(review))
            self.ui.workflow_completed_label.setText(str(report.completed))
            if report.counts.get("다중문서 승인 대기", 0):
                next_step = "다중문서 안전 분석 → 승인센터"
            elif report.counts.get("PDF 검토 대기", 0):
                next_step = "PDF 검토/승인"
            elif report.counts.get("일반 업데이트 대기", 0):
                next_step = "업데이트 시뮬레이션"
            elif pending:
                next_step = "수동 검토"
            else:
                next_step = "처리 완료"
            self.ui.workflow_next_label.setText(next_step)
            return report
        except Exception as exc:
            self.ui.workflow_next_label.setText(f"확인 실패: {exc}")
            return None

    @Slot()
    def show_workflow_status(self) -> None:
        try:
            report = self.refresh_workflow_status(write_files=True)
            if report is None:
                return
            self.ui.textbox.clear()
            self.ui.textbox.appendPlainText("CPMS 업무 흐름 현황")
            for key, value in sorted(report.counts.items()):
                self.ui.textbox.appendPlainText(f"{key}: {value}건")
            self.ui.textbox.appendPlainText("")
            for item in report.items:
                self.ui.textbox.appendPlainText(
                    f"[{item.status}] {item.filename} / 다음: {item.next_action}"
                )
            self.ui.textbox.appendPlainText(f"보고서: {report.excel_path}")
            QMessageBox.information(
                self,
                "업무 흐름 현황",
                f"Update 폴더에 남은 파일: {report.pending}건\n"
                f"최근 처리완료·Archive 이동: {report.completed}건\n\n"
                "Update에 파일이 남아 있어도 실패를 뜻하지 않습니다. "
                "각 파일의 상태와 다음 조치를 보고서에서 확인하세요.\n\n"
                f"보고서: {report.excel_path}",
            )
        except Exception as exc:
            QMessageBox.critical(self, "업무 흐름 현황 실패", str(exc))


    @Slot()
    def open_workflow_wizard(self) -> None:
        try:
            if self.workflow_wizard_dialog is not None and self.workflow_wizard_dialog.isVisible():
                self.workflow_wizard_dialog.raise_()
                self.workflow_wizard_dialog.activateWindow()
                self.workflow_wizard_dialog.refresh()
                return
            self.workflow_wizard_dialog = WorkflowWizardDialog(self.root, self, self)
            self.workflow_wizard_dialog.finished.connect(self._clear_workflow_wizard)
            self.workflow_wizard_dialog.open()
        except Exception as exc:
            self.workflow_wizard_dialog = None
            QMessageBox.critical(self, "업무 흐름 마법사 실행 실패", str(exc))

    @Slot()
    def _clear_workflow_wizard(self) -> None:
        if self.workflow_wizard_dialog is not None:
            self.workflow_wizard_dialog.deleteLater()
        self.workflow_wizard_dialog = None

    @Slot()
    def run_safety_check(self) -> None:
        try:
            updater = Updater(self.root)
            report = build_safety_report(self.root, updater.manufacturers)
            out = self.root / "Log" / "Safety_Check_Latest.json"
            report.to_json(out)
            self.ui.safety_status_label.setText(report.summary)
            lines = [f"안전 점검: {report.summary}"]
            lines.append(" / ".join(f"{name} {state}" for name, state in report.checks.items()))
            for snap in report.master_snapshots:
                if not snap.exists:
                    state = "없음"
                elif snap.error:
                    state = f"읽기 실패 ({snap.error})"
                else:
                    state = "정상"
                lines.append(f"[{snap.manufacturer}] Master {state} / 시트 {len(snap.sheets)}개")
            lines.extend(report.notes)
            lines.extend(report.archive_errors[:20])
            lines.append(f"보고서: {out}")
            self.ui.textbox.appendPlainText("\n".join(lines))
            if report.passed:
                QMessageBox.information(
                    self,
                    "안전 점검",
                    f"안전 점검을 통과했습니다.\n\n품질 점수: {report.score}점\n"
                    f"Master: {report.checks.get('Master')}\nArchive: {report.checks.get('Archive')}",
                )
            else:
                failed = [name for name, status in report.checks.items() if status == "FAIL"]
                detail_lines = []
                if failed:
                    detail_lines.append("실패 항목: " + ", ".join(failed))
                detail_lines.extend(report.notes)
                detail_lines.extend(report.archive_errors[:5])
                detail = "\n".join(f"• {line}" for line in detail_lines if line)
                QMessageBox.warning(
                    self,
                    "안전 점검",
                    f"점검 실패 항목이 있습니다.\n\n품질 점수: {report.score}점\n"
                    f"{detail or '• 상세 내용은 안전 점검 로그를 확인해 주세요.'}\n\n"
                    f"보고서: {out}",
                )
        except Exception as exc:
            QMessageBox.critical(self, "안전 점검 실패", str(exc))

    @Slot()
    def open_file_diagnostic(self) -> None:
        try:
            if (
                self.file_diagnostic_dialog is not None
                and self.file_diagnostic_dialog.isVisible()
            ):
                self.file_diagnostic_dialog.raise_()
                self.file_diagnostic_dialog.activateWindow()
                return
            self.file_diagnostic_dialog = FileDiagnosticDialog(self.root, self)
            self.file_diagnostic_dialog.finished.connect(
                self._clear_file_diagnostic_dialog
            )
            self.file_diagnostic_dialog.open()
        except Exception as exc:
            self.file_diagnostic_dialog = None
            QMessageBox.critical(self, "파일 진단 실행 실패", str(exc))

    @Slot()
    def _clear_file_diagnostic_dialog(self) -> None:
        if self.file_diagnostic_dialog is not None:
            self.file_diagnostic_dialog.deleteLater()
        self.file_diagnostic_dialog = None
        self.refresh_scan_count()

    def _ocr_health(self):
        updater = Updater(self.root)
        return check_ocr_health(
            updater.config.get("tesseract_path", ""),
            str(updater.config.get("ocr_language", "eng")),
        )

    def refresh_ocr_status(self) -> None:
        try:
            health = self._ocr_health()
            text = f"{health.display_status}"
            if health.version:
                text += f" / {health.version}"
            self.ui.ocr_status_label.setText(text)
        except Exception as exc:
            self.ui.ocr_status_label.setText(f"확인 실패: {exc}")

    @Slot()
    def show_ocr_status(self) -> None:
        health = self._ocr_health()
        languages = ", ".join(health.languages) if health.languages else "확인 불가"
        details = (
            f"상태: {health.display_status}\n"
            f"실행파일: {health.executable or '찾지 못함'}\n"
            f"버전: {health.version or '확인 불가'}\n"
            f"설치 언어: {languages}\n"
            f"요청 언어: {health.requested_language}\n\n"
            f"{health.message}"
        )
        QMessageBox.information(self, "OCR 상태", details)

    @Slot()
    def show_log_location(self) -> None:
        QMessageBox.information(self, "Log", str(self.root / "Log"))
