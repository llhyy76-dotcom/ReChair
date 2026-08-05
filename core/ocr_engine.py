from __future__ import annotations

import csv
import os
import shutil
import subprocess
import tempfile
import multiprocessing as mp
import threading
import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Callable, Iterable


ProgressCallback = Callable[[int, int, str], None]


@dataclass(frozen=True)
class OcrHealth:
    available: bool
    executable: str
    version: str
    languages: tuple[str, ...]
    requested_language: str
    language_ready: bool
    message: str

    @property
    def display_status(self) -> str:
        if not self.available:
            return "미설치"
        if not self.language_ready:
            return "언어팩 확인 필요"
        return "정상"


@dataclass(frozen=True)
class PdfClassification:
    mode: str
    native_characters: int
    page_count: int
    reason: str


@dataclass(frozen=True)
class OcrPageResult:
    page_number: int
    text: str
    elapsed_seconds: float
    status: str
    message: str = ""


@dataclass(frozen=True)
class OcrFileLog:
    filename: str
    classification: str
    status: str
    extraction_mode: str
    page_count: int
    extracted_rows: int
    elapsed_seconds: float
    tesseract: str
    language: str
    message: str


def _common_windows_candidates() -> list[Path]:
    candidates: list[Path] = []
    for base in (
        os.environ.get("ProgramFiles"),
        os.environ.get("ProgramFiles(x86)"),
        os.environ.get("LOCALAPPDATA"),
    ):
        if not base:
            continue
        candidates.extend(
            [
                Path(base) / "Tesseract-OCR" / "tesseract.exe",
                Path(base) / "Programs" / "Tesseract-OCR" / "tesseract.exe",
            ]
        )
    return candidates


def find_tesseract(configured_path: str | Path | None = None) -> Path | None:
    configured = str(configured_path or "").strip().strip('"')
    candidates: list[Path] = []
    if configured:
        path = Path(configured)
        candidates.append(path / "tesseract.exe" if path.is_dir() else path)

    which = shutil.which("tesseract")
    if which:
        candidates.append(Path(which))
    candidates.extend(_common_windows_candidates())

    seen: set[str] = set()
    for candidate in candidates:
        key = str(candidate).casefold()
        if key in seen:
            continue
        seen.add(key)
        if candidate.exists() and candidate.is_file():
            return candidate
    return None


def check_ocr_health(
    configured_path: str | Path | None = None,
    language: str = "eng",
    timeout_seconds: int = 8,
) -> OcrHealth:
    executable = find_tesseract(configured_path)
    if executable is None:
        return OcrHealth(
            available=False,
            executable="",
            version="",
            languages=(),
            requested_language=language,
            language_ready=False,
            message=(
                "Tesseract OCR을 찾지 못했습니다. 텍스트형 PDF는 계속 처리되지만 "
                "스캔 PDF는 검토대기 파일만 생성됩니다."
            ),
        )

    version = ""
    languages: tuple[str, ...] = ()
    messages: list[str] = []
    try:
        with _WindowsChildErrorMode():
            result = subprocess.run(
                [str(executable), "--version"],
                stdin=subprocess.DEVNULL,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                timeout=timeout_seconds,
                check=False,
                creationflags=_windows_creation_flags(),
            )
        version = (result.stdout or result.stderr or "").splitlines()[0].strip()
    except Exception as exc:
        messages.append(f"버전 확인 실패: {exc}")

    try:
        with _WindowsChildErrorMode():
            result = subprocess.run(
                [str(executable), "--list-langs"],
                stdin=subprocess.DEVNULL,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                timeout=timeout_seconds,
                check=False,
                creationflags=_windows_creation_flags(),
            )
        lines = [line.strip() for line in (result.stdout or "").splitlines()]
        languages = tuple(
            line for line in lines
            if line and not line.lower().startswith("list of available")
        )
    except Exception as exc:
        messages.append(f"언어팩 확인 실패: {exc}")

    requested = [token.strip() for token in language.split("+") if token.strip()]
    language_ready = bool(languages) and all(token in languages for token in requested)
    if not language_ready:
        messages.append(
            f"요청 언어({language}) 중 일부가 없습니다. 설치 언어: {', '.join(languages) or '확인 불가'}"
        )

    return OcrHealth(
        available=True,
        executable=str(executable),
        version=version,
        languages=languages,
        requested_language=language,
        language_ready=language_ready,
        message=" / ".join(messages) if messages else "OCR 실행 준비 완료",
    )


def classify_document(document, native_text: str, minimum_native_chars: int = 80) -> PdfClassification:
    native_characters = len("".join(native_text.split()))
    page_count = len(document)
    if native_characters >= minimum_native_chars:
        return PdfClassification(
            mode="TEXT",
            native_characters=native_characters,
            page_count=page_count,
            reason=f"내장 텍스트 {native_characters:,}자 감지",
        )
    return PdfClassification(
        mode="SCAN",
        native_characters=native_characters,
        page_count=page_count,
        reason=f"내장 텍스트가 부족함({native_characters:,}자)",
    )



_TESSERACT_LOCK = threading.Lock()


class TesseractStartError(RuntimeError):
    """Raised when Windows cannot initialize the Tesseract process."""


class _WindowsChildErrorMode:
    """Temporarily suppress Windows child-process crash dialog boxes.

    Error mode is inherited by child processes. This prevents 0xc0000142 and
    similar initialization failures from blocking the unattended CPMS update
    with a modal Windows error popup.
    """

    SEM_FAILCRITICALERRORS = 0x0001
    SEM_NOGPFAULTERRORBOX = 0x0002
    SEM_NOOPENFILEERRORBOX = 0x8000

    def __init__(self) -> None:
        self._kernel32 = None
        self._previous = None

    def __enter__(self):
        if os.name != "nt":
            return self
        try:
            import ctypes
            self._kernel32 = ctypes.windll.kernel32
            mode = (
                self.SEM_FAILCRITICALERRORS
                | self.SEM_NOGPFAULTERRORBOX
                | self.SEM_NOOPENFILEERRORBOX
            )
            self._previous = self._kernel32.SetErrorMode(mode)
        except Exception:
            self._kernel32 = None
            self._previous = None
        return self

    def __exit__(self, exc_type, exc, tb):
        if self._kernel32 is not None and self._previous is not None:
            try:
                self._kernel32.SetErrorMode(self._previous)
            except Exception:
                pass


def _windows_creation_flags() -> int:
    if os.name != "nt":
        return 0
    return int(
        getattr(subprocess, "CREATE_NO_WINDOW", 0)
        | getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
    )


def _decode_process_output(value: bytes | str | None) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    for encoding in ("utf-8", "cp949", "mbcs"):
        try:
            return value.decode(encoding).strip()
        except Exception:
            continue
    return value.decode("utf-8", errors="replace").strip()


def _is_initialization_failure(returncode: int, stderr: str) -> bool:
    # Windows converts NTSTATUS 0xC0000142 to either the unsigned or signed form.
    return (
        returncode in {3221225794, -1073741502}
        or "0xc0000142" in stderr.lower()
        or "failed to initialize" in stderr.lower()
        or "응용 프로그램을 제대로 시작" in stderr
    )

def _run_tesseract_png_direct(
    png_bytes: bytes,
    executable: str | Path,
    language: str = "eng",
    timeout_seconds: int = 45,
    psm: int = 6,
    retries: int = 2,
) -> tuple[str, float]:
    """Run Tesseract in a serialized, retryable and popup-free way.

    Large batches previously launched a new Tesseract process immediately for
    every page and every specialized OCR pass. On some Windows systems this can
    intermittently produce application initialization error 0xc0000142.
    """
    executable = Path(executable)
    if not executable.exists():
        raise FileNotFoundError(f"Tesseract 실행파일이 없습니다: {executable}")

    started = time.perf_counter()
    last_error = ""

    # Serialize child launches. This also protects the Windows-wide temporary
    # error mode and reduces DLL initialization pressure during PDF batches.
    with _TESSERACT_LOCK:
        with tempfile.TemporaryDirectory(prefix="cpms_ocr_") as temp_dir:
            temp_path = Path(temp_dir)
            input_path = temp_path / "page.png"
            output_base = temp_path / "result"
            input_path.write_bytes(png_bytes)

            command = [
                str(executable),
                str(input_path),
                str(output_base),
                "-l",
                language,
                "--psm",
                str(psm),
            ]

            for attempt in range(retries + 1):
                try:
                    with _WindowsChildErrorMode():
                        completed = subprocess.run(
                            command,
                            stdin=subprocess.DEVNULL,
                            stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE,
                            timeout=timeout_seconds,
                            check=False,
                            creationflags=_windows_creation_flags(),
                            close_fds=(os.name != "nt"),
                        )
                except subprocess.TimeoutExpired:
                    if attempt < retries:
                        time.sleep(0.6 * (attempt + 1))
                        continue
                    raise
                except OSError as exc:
                    last_error = f"Tesseract 시작 실패: {exc}"
                    if attempt < retries:
                        time.sleep(0.8 * (attempt + 1))
                        continue
                    raise TesseractStartError(last_error) from exc

                stderr = _decode_process_output(completed.stderr)
                if completed.returncode == 0:
                    output_path = output_base.with_suffix(".txt")
                    if not output_path.exists():
                        raise RuntimeError("Tesseract 결과 텍스트 파일이 생성되지 않았습니다.")
                    text = output_path.read_text(encoding="utf-8", errors="replace")
                    return text, time.perf_counter() - started

                last_error = stderr or f"Tesseract 종료코드 {completed.returncode}"
                if _is_initialization_failure(completed.returncode, stderr):
                    last_error = (
                        "Tesseract 초기화 실패(0xc0000142). "
                        "자동 재시도 후에도 시작되지 않았습니다."
                    )
                if attempt < retries:
                    time.sleep(0.8 * (attempt + 1))
                    continue

            raise TesseractStartError(last_error or "Tesseract를 시작하지 못했습니다.")



def _ocr_worker_entry(
    connection,
    png_bytes: bytes,
    executable: str,
    language: str,
    timeout_seconds: int,
    psm: int,
    retries: int,
) -> None:
    """Dedicated OCR process entry. Never touches the GUI process."""
    try:
        # Set the child process error mode before Tesseract is launched.
        with _WindowsChildErrorMode():
            text, elapsed = _run_tesseract_png_direct(
                png_bytes,
                executable,
                language=language,
                timeout_seconds=timeout_seconds,
                psm=psm,
                retries=retries,
            )
        connection.send(("ok", text, elapsed))
    except BaseException as exc:
        connection.send(("error", f"{type(exc).__name__}: {exc}", 0.0))
    finally:
        connection.close()


def run_tesseract_png(
    png_bytes: bytes,
    executable: str | Path,
    language: str = "eng",
    timeout_seconds: int = 45,
    psm: int = 6,
    retries: int = 2,
) -> tuple[str, float]:
    """Run OCR in a separate worker process.

    A Tesseract DLL/startup crash can terminate only the worker. The CPMS GUI
    remains alive and can continue with the next PDF.
    """
    executable = str(Path(executable))

    # The worker isolation is needed for Windows DLL/startup failures.
    # On non-Windows systems direct execution is more reliable and keeps
    # existing command-line tests deterministic.
    if os.name != "nt":
        return _run_tesseract_png_direct(
            png_bytes,
            executable,
            language=language,
            timeout_seconds=timeout_seconds,
            psm=psm,
            retries=retries,
        )

    context = mp.get_context("spawn")
    parent, child = context.Pipe(duplex=False)
    process = context.Process(
        target=_ocr_worker_entry,
        args=(
            child, png_bytes, executable, language,
            timeout_seconds, psm, retries,
        ),
        name="CPMS-OCR-Worker",
        daemon=False,
    )

    process.start()
    child.close()
    overall_timeout = max(10, timeout_seconds * (retries + 2) + 10)
    process.join(overall_timeout)

    if process.is_alive():
        process.terminate()
        process.join(5)
        parent.close()
        raise TimeoutError(
            f"OCR Worker 제한시간 초과({overall_timeout}초). 해당 페이지만 건너뜁니다."
        )

    if parent.poll():
        status, payload, elapsed = parent.recv()
        parent.close()
        if status == "ok":
            return str(payload), float(elapsed)
        raise TesseractStartError(str(payload))

    exit_code = process.exitcode
    parent.close()
    if exit_code in {3221225794, -1073741502}:
        raise TesseractStartError(
            "OCR Worker에서 Tesseract 초기화 실패(0xc0000142). "
            "CPMS 본체는 계속 실행됩니다."
        )
    raise TesseractStartError(
        f"OCR Worker 비정상 종료(exit={exit_code}). 해당 페이지만 건너뜁니다."
    )


def ocr_document(
    document,
    health: OcrHealth,
    *,
    language: str = "eng",
    timeout_seconds: int = 45,
    scale: float = 3.0,
    progress: ProgressCallback | None = None,
) -> tuple[str, list[OcrPageResult]]:
    if not health.available:
        raise RuntimeError(health.message)

    try:
        from PIL import Image, ImageEnhance, ImageOps
        import fitz
        import io
    except ImportError as exc:
        raise RuntimeError(
            "OCR 이미지 처리 모듈이 없습니다: py -m pip install pillow pymupdf"
        ) from exc

    texts: list[str] = []
    results: list[OcrPageResult] = []
    total = len(document)

    for index, page in enumerate(document, start=1):
        if progress:
            progress(index, total, f"{index}/{total}페이지 이미지 생성")
        pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
        image = Image.open(io.BytesIO(pix.tobytes("png")))
        image = ImageOps.grayscale(image)
        image = ImageOps.autocontrast(image)
        image = ImageEnhance.Contrast(image).enhance(1.5)

        buffer = io.BytesIO()
        image.save(buffer, format="PNG")
        try:
            try:
                text, elapsed = run_tesseract_png(
                    buffer.getvalue(),
                    health.executable,
                    language=language,
                    timeout_seconds=timeout_seconds,
                )
            except TesseractStartError:
                # Release large image resources and retry once with a smaller
                # raster. This reduces memory and DLL pressure on older PCs.
                fallback_pix = page.get_pixmap(
                    matrix=fitz.Matrix(max(1.8, scale * 0.7), max(1.8, scale * 0.7)),
                    alpha=False,
                )
                fallback_image = Image.open(io.BytesIO(fallback_pix.tobytes("png")))
                fallback_image = ImageOps.autocontrast(
                    ImageOps.grayscale(fallback_image)
                )
                fallback_buffer = io.BytesIO()
                fallback_image.save(fallback_buffer, format="PNG")
                text, elapsed = run_tesseract_png(
                    fallback_buffer.getvalue(),
                    health.executable,
                    language=language,
                    timeout_seconds=timeout_seconds,
                    retries=1,
                )
            texts.append(text)
            results.append(
                OcrPageResult(index, text, elapsed, "성공", "")
            )
            if progress:
                progress(index, total, f"{index}/{total}페이지 OCR 완료 ({elapsed:.1f}초)")
        except subprocess.TimeoutExpired:
            message = f"{timeout_seconds}초 시간초과"
            results.append(OcrPageResult(index, "", float(timeout_seconds), "시간초과", message))
            if progress:
                progress(index, total, f"{index}/{total}페이지 OCR 시간초과")
        except Exception as exc:
            results.append(OcrPageResult(index, "", 0.0, "실패", str(exc)))
            if progress:
                progress(index, total, f"{index}/{total}페이지 OCR 실패: {exc}")

    successful = [item for item in results if item.status == "성공"]
    if not successful:
        messages = "; ".join(
            f"{item.page_number}p {item.status}: {item.message}" for item in results
        )
        raise RuntimeError(messages or "OCR 성공 페이지가 없습니다.")
    return "\n".join(texts), results


def write_ocr_log(log_dir: str | Path, entries: Iterable[OcrFileLog]) -> Path:
    log_dir = Path(log_dir)
    log_dir.mkdir(parents=True, exist_ok=True)
    path = log_dir / f"ocr_log_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    headers = [
        "파일명", "PDF분류", "상태", "추출방식", "페이지수", "추출행수",
        "소요시간(초)", "Tesseract", "언어", "메시지",
    ]
    with path.open("w", newline="", encoding="utf-8-sig") as stream:
        writer = csv.writer(stream)
        writer.writerow(headers)
        for entry in entries:
            writer.writerow(
                [
                    entry.filename, entry.classification, entry.status,
                    entry.extraction_mode, entry.page_count, entry.extracted_rows,
                    round(entry.elapsed_seconds, 2), entry.tesseract,
                    entry.language, entry.message,
                ]
            )
    return path
