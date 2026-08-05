from __future__ import annotations

import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path


NS = {
    "a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}


def load_shared_strings(zip_file: zipfile.ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in zip_file.namelist():
        return []
    root = ET.fromstring(zip_file.read("xl/sharedStrings.xml"))
    return [
        "".join(text.text or "" for text in item.findall(".//a:t", NS))
        for item in root.findall("a:si", NS)
    ]


def cell_value(cell: ET.Element, shared_strings: list[str]) -> str:
    value = cell.find("a:v", NS)
    cell_type = cell.attrib.get("t")
    if cell_type == "s" and value is not None:
        return shared_strings[int(value.text or "0")]
    if cell_type == "inlineStr":
        return "".join(text.text or "" for text in cell.findall(".//a:t", NS))
    return value.text if value is not None else ""


def main() -> int:
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("Master/IR_Master.xlsx")
    with zipfile.ZipFile(path) as zip_file:
        shared_strings = load_shared_strings(zip_file)
        workbook = ET.fromstring(zip_file.read("xl/workbook.xml"))
        rels = ET.fromstring(zip_file.read("xl/_rels/workbook.xml.rels"))
        relmap = {rel.attrib["Id"]: rel.attrib["Target"].lstrip("/") for rel in rels}

        print(f"Workbook: {path}")
        for sheet in workbook.findall("a:sheets/a:sheet", NS):
            name = sheet.attrib["name"]
            rel_id = sheet.attrib["{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"]
            target = relmap[rel_id]
            root = ET.fromstring(zip_file.read(target))
            dimension = root.find("a:dimension", NS)
            print(f"\n## {name} ({dimension.attrib.get('ref') if dimension is not None else ''})")
            for row in root.findall("a:sheetData/a:row", NS)[:12]:
                values = []
                for cell in row.findall("a:c", NS)[:16]:
                    value = cell_value(cell, shared_strings)
                    if value:
                        values.append(f"{cell.attrib.get('r')}={value}")
                if values:
                    print(f"row {row.attrib.get('r')}: " + " | ".join(values))

        print("\n## Tables")
        for table_name in sorted(name for name in zip_file.namelist() if name.startswith("xl/tables/")):
            table = ET.fromstring(zip_file.read(table_name))
            columns = [
                column.attrib.get("name", "")
                for column in table.findall("a:tableColumns/a:tableColumn", NS)
            ]
            print(f"{table_name}: {table.attrib.get('name')} {table.attrib.get('ref')} {columns}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
