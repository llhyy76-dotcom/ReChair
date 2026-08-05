from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
modules = ("PySide6", "pandas", "openpyxl", "rapidfuzz", "fitz", "PIL")
folders = ("Config", "Manufacturers", "Update", "Archive", "Backup", "History", "Log")

print("CPMS v5.0 Environment Check")
print("=" * 50)
print("Python:", sys.version.split()[0])
for module in modules:
    print(f"{module:12}:", "OK" if importlib.util.find_spec(module) else "MISSING")
for folder in folders:
    print(f"{folder:12}:", "OK" if (ROOT / folder).exists() else "MISSING")
config = ROOT / "Config" / "config.json"
if config.exists():
    try:
        json.loads(config.read_text(encoding="utf-8"))
        print("config.json :", "OK")
    except Exception as exc:
        print("config.json :", f"ERROR - {exc}")
