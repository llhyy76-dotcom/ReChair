from __future__ import annotations

import shutil
from datetime import datetime
from pathlib import Path


def backup_master(master_path: str | Path, backup_dir: str | Path) -> Path:
    master = Path(master_path)
    if not master.exists():
        raise FileNotFoundError(f"Master file not found: {master}")

    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    target_dir = Path(backup_dir) / stamp
    target_dir.mkdir(parents=True, exist_ok=True)
    target = target_dir / master.name
    shutil.copy2(master, target)
    return target
