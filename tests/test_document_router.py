from pathlib import Path
from openpyxl import Workbook
from core.document_router import route_folder


def _book(path: Path, sheets: dict[str, list[list[object]]]) -> None:
    wb = Workbook()
    wb.remove(wb.active)
    for name, rows in sheets.items():
        ws = wb.create_sheet(name)
        for row in rows:
            ws.append(row)
    wb.save(path)


def test_routes_standard_multidoc_and_demand(tmp_path: Path):
    update = tmp_path / 'Update'; log = tmp_path / 'Log'; update.mkdir()
    _book(update / 'IR260101.xlsx', {'IR': [['부품명', '단가'], ['모터', 3.2]]})
    _book(update / '통합발주.xlsx', {
        'IR': [['부품명', '단가'], ['모터', 3.2]],
        'XC': [['부품명', '단가'], ['롤러', 4.1]],
    })
    _book(update / '필요 부품 취합.xlsx', {'Sheet1': [['부품명', '필요수량'], ['모터', 2]]})
    report = route_folder(update, log)
    routes = {item.filename: item.route for item in report.items}
    assert routes['IR260101.xlsx'] == 'STANDARD_UPDATE'
    assert routes['통합발주.xlsx'] == 'MULTI_DOCUMENT'
    assert routes['필요 부품 취합.xlsx'] == 'DEMAND_HISTORY'
    assert Path(report.report_json).exists()
