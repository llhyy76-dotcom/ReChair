from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from core.excel_reader import open_workbook
from core.parser import parse_workbook


def inspect(path: Path) -> dict:
    with open_workbook(path) as wb:
        info = wb.info
        result = {
            "file": path.name,
            "format": info.source_format,
            "sheets": wb.sheetnames,
            "hidden_sheets": list(info.hidden_sheets),
            "hidden_columns": {k: list(v) for k, v in info.hidden_columns.items() if v},
        }
    rows = parse_workbook(path)
    result["parsed_rows"] = len(rows)
    result["priced_rows"] = sum(r.price is not None for r in rows)
    result["qty_rows"] = sum(r.qty is not None for r in rows)
    result["amount_rows"] = sum(r.amount is not None for r in rows)
    return result


if __name__ == "__main__":
    for arg in sys.argv[1:]:
        print(inspect(Path(arg)))
