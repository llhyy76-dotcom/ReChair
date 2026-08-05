from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Iterable


SCHEMA = """
CREATE TABLE IF NOT EXISTS Parts(
    id INTEGER PRIMARY KEY,
    model TEXT,
    part_no TEXT,
    part_name_en TEXT,
    part_name_kr TEXT,
    price REAL,
    currency TEXT,
    ir_no TEXT,
    updated DATE,
    UNIQUE(model, part_no, part_name_en)
);

CREATE TABLE IF NOT EXISTS PriceHistory(
    id INTEGER PRIMARY KEY,
    part_no TEXT,
    old_price REAL,
    new_price REAL,
    ir_no TEXT,
    changed_date DATE
);

CREATE TABLE IF NOT EXISTS IRFiles(
    id INTEGER PRIMARY KEY,
    ir_no TEXT,
    filename TEXT UNIQUE,
    revision INTEGER,
    processed INTEGER DEFAULT 0
);
"""


class Database:
    def __init__(self, path: str | Path) -> None:
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.connection = sqlite3.connect(self.path)
        self.connection.row_factory = sqlite3.Row
        self.init_schema()

    def init_schema(self) -> None:
        self.connection.executescript(SCHEMA)
        self.connection.commit()

    def upsert_parts(self, records: Iterable[dict]) -> None:
        sql = """
        INSERT INTO Parts(model, part_no, part_name_en, part_name_kr, price, currency, ir_no, updated)
        VALUES(:model, :part_no, :part_name_en, :part_name_kr, :price, :currency, :ir_no, :updated)
        ON CONFLICT(model, part_no, part_name_en) DO UPDATE SET
            part_name_kr=excluded.part_name_kr,
            price=excluded.price,
            currency=excluded.currency,
            ir_no=excluded.ir_no,
            updated=excluded.updated
        """
        self.connection.executemany(sql, records)
        self.connection.commit()

    def insert_price_history(self, changes: Iterable[dict]) -> None:
        sql = """
        INSERT INTO PriceHistory(part_no, old_price, new_price, ir_no, changed_date)
        VALUES(:part_no, :old_price, :new_price, :ir_no, :changed_date)
        """
        self.connection.executemany(sql, changes)
        self.connection.commit()

    def mark_ir_file(self, ir_no: str, filename: str, revision: int, processed: int = 1) -> None:
        self.connection.execute(
            """
            INSERT INTO IRFiles(ir_no, filename, revision, processed)
            VALUES(?, ?, ?, ?)
            ON CONFLICT(filename) DO UPDATE SET
                ir_no=excluded.ir_no,
                revision=excluded.revision,
                processed=excluded.processed
            """,
            (ir_no, filename, revision, processed),
        )
        self.connection.commit()

    def close(self) -> None:
        self.connection.close()
