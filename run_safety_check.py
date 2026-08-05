from pathlib import Path
from core.safety import build_safety_report
from core.updater import Updater

root = Path(__file__).resolve().parent
updater = Updater(root)
report = build_safety_report(root, updater.manufacturers)
out = root / "Log" / "Safety_Check_Latest.json"
report.to_json(out)
print("PASS" if report.passed else "FAIL")
print(out)
for note in report.notes:
    print(note)
for error in report.archive_errors:
    print(error)
raise SystemExit(0 if report.passed else 1)
