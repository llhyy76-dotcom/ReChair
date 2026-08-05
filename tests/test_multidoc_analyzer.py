from pathlib import Path
from openpyxl import Workbook
from core.multidoc_analyzer import analyze_multidoc_folder


def test_multidoc_analysis_does_not_touch_master(tmp_path: Path):
    (tmp_path / 'Update').mkdir()
    (tmp_path / 'Log').mkdir()
    master = tmp_path / 'Manufacturers' / 'IR' / 'Master'
    master.mkdir(parents=True)
    master_file = master / 'Master.xlsx'
    master_file.write_bytes(b'unchanged')
    before = master_file.read_bytes()

    wb = Workbook()
    ws = wb.active
    ws.title = 'IR'
    ws.append(['부품코드', '부품명', '부품명(Eng.)', '부품원가', '신규 발주수량'])
    ws.append(['P1', '모터', 'Motor', 10, 3])
    wb.save(tmp_path / 'Update' / '통합발주.xlsx')

    report = analyze_multidoc_folder(tmp_path)
    assert report.files_scanned == 1
    assert report.safe_import_sheets == 1
    assert master_file.read_bytes() == before
    assert Path(report.excel_path).exists()


def test_demand_sheet_is_never_price_import(tmp_path: Path):
    (tmp_path / 'Update').mkdir()
    wb = Workbook()
    ws = wb.active
    ws.title = '필요 부품 취합'
    ws.append(['부품코드', '부품명', '필요수량'])
    ws.append(['P1', '모터', 5])
    wb.save(tmp_path / 'Update' / '필요 부품 취합.xlsx')
    report = analyze_multidoc_folder(tmp_path)
    assert report.demand_only_sheets == 1
    assert report.safe_import_sheets == 0
