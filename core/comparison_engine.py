from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from typing import Iterable, Sequence

from core.history_engine import HistoryEvent, compare_snapshots
from core.parser import PartRecord, norm_model, norm_txt


@dataclass(frozen=True)
class PriceHistoryEvent:
    event_id: str
    manufacturer: str
    model: str
    part_no: str
    part_name_en: str
    part_name_kr: str
    previous_price: float
    latest_price: float
    difference: float
    change_rate: float | None
    previous_request_no: str
    latest_request_no: str
    previous_source_file: str
    latest_source_file: str
    previous_base_date: str
    latest_base_date: str
    currency: str

    def as_row(self) -> list[object]:
        return [
            self.event_id, self.manufacturer, self.model, self.part_no,
            self.part_name_en, self.part_name_kr, self.previous_price,
            self.latest_price, self.difference, self.change_rate,
            self.previous_request_no, self.latest_request_no,
            self.previous_source_file, self.latest_source_file,
            self.previous_base_date, self.latest_base_date, self.currency,
        ]


@dataclass(frozen=True)
class ComparisonResult:
    snapshot_events: list[HistoryEvent]
    price_history_events: list[PriceHistoryEvent]

    @property
    def cumulative_price_variations(self) -> int:
        return len(self.price_history_events)


def _group_key(record: PartRecord) -> tuple[str, str, str, str]:
    return (
        norm_model(record.model),
        norm_txt(record.part_name_en),
        norm_txt(record.part_name_kr),
        norm_txt(record.part_no),
    )


def _record_sort_key(record: PartRecord) -> tuple[str, int, str, int]:
    return (
        str(record.base_date or ""),
        int(record.base_year or 0),
        str(record.ir_no or ""),
        int(record.source_row or 0),
    )


def _price_event_id(manufacturer: str, old: PartRecord, new: PartRecord) -> str:
    payload = {
        "manufacturer": manufacturer,
        "part_key": _group_key(new),
        "old_price": round(float(old.price), 8),
        "new_price": round(float(new.price), 8),
        "old_request": old.ir_no,
        "new_request": new.ir_no,
        "old_source": old.source_file,
        "new_source": new.source_file,
    }
    raw = json.dumps(payload, ensure_ascii=False, sort_keys=True, default=str)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:24]


def build_price_history(
    manufacturer: str,
    records: Iterable[PartRecord],
) -> list[PriceHistoryEvent]:
    """Build the latest distinct price transition per part, matching Dashboard's KPI concept."""
    groups: dict[tuple[str, str, str, str], list[PartRecord]] = {}
    for record in records:
        if record.price is not None:
            groups.setdefault(_group_key(record), []).append(record)

    events: list[PriceHistoryEvent] = []
    for recs in groups.values():
        ordered = sorted(recs, key=_record_sort_key)
        distinct: list[PartRecord] = []
        for record in ordered:
            price = round(float(record.price), 8)
            if not distinct or round(float(distinct[-1].price), 8) != price:
                distinct.append(record)

        if len(distinct) < 2:
            continue

        old, new = distinct[-2], distinct[-1]
        old_price = float(old.price)
        new_price = float(new.price)
        difference = new_price - old_price
        rate = None if old_price == 0 else difference / old_price * 100
        events.append(PriceHistoryEvent(
            event_id=_price_event_id(manufacturer, old, new),
            manufacturer=manufacturer,
            model=new.model or old.model,
            part_no=new.part_no or old.part_no,
            part_name_en=new.part_name_en or old.part_name_en,
            part_name_kr=new.part_name_kr or old.part_name_kr,
            previous_price=old_price,
            latest_price=new_price,
            difference=difference,
            change_rate=rate,
            previous_request_no=old.ir_no,
            latest_request_no=new.ir_no,
            previous_source_file=old.source_file,
            latest_source_file=new.source_file,
            previous_base_date=str(old.base_date or old.base_year or ""),
            latest_base_date=str(new.base_date or new.base_year or ""),
            currency=new.currency or old.currency or "USD",
        ))
    return sorted(events, key=lambda e: (e.manufacturer, e.model, e.part_name_en, e.part_no))


def compare_master(
    manufacturer: str,
    before: Sequence[PartRecord],
    after: Sequence[PartRecord],
    *,
    run_id: str,
    recorded_at: str | None = None,
) -> ComparisonResult:
    return ComparisonResult(
        snapshot_events=compare_snapshots(
            manufacturer, before, after, run_id=run_id, recorded_at=recorded_at
        ),
        price_history_events=build_price_history(manufacturer, after),
    )
