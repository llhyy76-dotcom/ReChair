from __future__ import annotations

from datetime import datetime
from pathlib import Path


class AppLogger:
    def __init__(self, log_dir: str | Path) -> None:
        self.log_dir = Path(log_dir)
        self.log_dir.mkdir(parents=True, exist_ok=True)

    def write_summary(self, lines: list[str]) -> Path:
        today = datetime.now().strftime("%Y-%m-%d")
        path = self.log_dir / f"{today}.log"
        stamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with path.open("a", encoding="utf-8") as fp:
            fp.write(f"[{stamp}]\n")
            for line in lines:
                fp.write(f"{line}\n")
            fp.write("\n")
        return path

    def info(self, message: str) -> None:
        self.write_summary([message])
