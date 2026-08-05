from __future__ import annotations

from dataclasses import replace
from datetime import date

from rapidfuzz import fuzz

from core.parser import PartRecord, norm_txt


def build_kr_lookup(records: list[PartRecord]) -> dict[str, str]:
    lookup: dict[str, str] = {}
    for record in records:
        if record.part_name_en and record.part_name_kr:
            lookup.setdefault(norm_txt(record.part_name_en), record.part_name_kr)
    return lookup


def complete_korean_names(records: list[PartRecord], lookup: dict[str, str], threshold: int) -> tuple[list[PartRecord], int]:
    completed: list[PartRecord] = []
    count = 0
    keys = list(lookup)
    for record in records:
        if record.part_name_kr:
            completed.append(record)
            continue
        kr = lookup.get(norm_txt(record.part_name_en), "")
        if not kr and record.part_name_en:
            best_key = ""
            best_score = 0
            for key in keys:
                score = fuzz.ratio(norm_txt(record.part_name_en), key)
                if score > best_score:
                    best_key = key
                    best_score = score
            if best_score >= threshold:
                kr = lookup.get(best_key, "")
        if kr:
            count += 1
            completed.append(replace(record, part_name_kr=kr))
        else:
            completed.append(record)
    return completed, count


def compare_records(master: list[PartRecord], incoming: list[PartRecord]) -> tuple[list[PartRecord], list[dict], int]:
    """Return rows that are not already present in 원본상세, price changes, duplicate raw rows."""
    existing_raw = {r.raw_key for r in master}
    existing_prices: dict[tuple, set] = {}
    for r in master:
        if r.price is not None:
            existing_prices.setdefault(r.part_key, set()).add(round(float(r.price), 4))

    new_records: list[PartRecord] = []
    price_changes: list[dict] = []
    duplicates = 0
    seen_incoming = set()
    for record in incoming:
        rk = record.raw_key
        if rk in existing_raw or rk in seen_incoming:
            duplicates += 1
            continue
        seen_incoming.add(rk)
        new_records.append(record)
        old_prices = existing_prices.get(record.part_key, set())
        if record.price is not None and old_prices and round(float(record.price), 4) not in old_prices:
            price_changes.append({
                "part_no": record.part_no,
                "old_price": "/".join(str(p) for p in sorted(old_prices)),
                "new_price": record.price,
                "ir_no": record.ir_no,
                "changed_date": date.today().isoformat(),
            })
    return new_records, price_changes, duplicates


# v2.0.1: update/merge mode
# 기존에는 같은 원본파일/행으로 판단되면 중복으로 건너뛰어, 기존 원본상세에 단가가 비어 있거나 잘못 들어간 경우
# 재실행해도 단가가 보정되지 않는 문제가 있었다. 아래 병합 함수는 중복 행도 단가/수량/금액/기준년도 등 핵심 값이
# 비어 있거나 달라진 경우 기존 행을 보정한 뒤 모든 보고 시트를 재생성하도록 한다.

def _not_empty(value) -> bool:
    return value is not None and str(value).strip() != ""


def raw_identity(record: PartRecord) -> tuple:
    """Same source row identity, ignoring price/qty so reruns can repair missing prices."""
    return (
        record.source_file,
        record.source_row,
        record.ir_no,
        record.part_key,
    )


def _merge_record(old: PartRecord, new: PartRecord) -> tuple[PartRecord, bool]:
    data = old.as_dict()
    changed = False
    # Prefer incoming values for numeric business fields when incoming has a value and differs.
    for field in ["price", "qty", "amount"]:
        nv = getattr(new, field)
        ov = getattr(old, field)
        if nv is not None and nv != ov:
            data[field] = nv
            changed = True
    # Fill/repair core metadata. For model/name/request/source, keep existing unless empty.
    for field in ["base_year", "base_date", "ir_no", "model", "part_name_kr", "part_name_en", "part_name_cn", "part_no", "parameter", "source_file", "source_row", "extraction_method", "currency", "updated"]:
        nv = getattr(new, field)
        ov = getattr(old, field)
        if _not_empty(nv) and (not _not_empty(ov)):
            data[field] = nv
            changed = True
    return PartRecord(**data), changed


def merge_records(master: list[PartRecord], incoming: list[PartRecord]) -> tuple[list[PartRecord], list[PartRecord], list[dict], int, int]:
    """Merge incoming records into master.

    Returns: consolidated_records, new_records, price_changes, duplicates, updated_existing_rows.
    Duplicate rows are not appended, but their missing/wrong price fields are repaired.
    """
    existing_prices: dict[tuple, set] = {}
    for r in master:
        if r.price is not None:
            existing_prices.setdefault(r.part_key, set()).add(round(float(r.price), 4))

    consolidated = list(master)
    index = {raw_identity(r): i for i, r in enumerate(consolidated)}
    new_records: list[PartRecord] = []
    price_changes: list[dict] = []
    duplicates = 0
    updated = 0
    seen_incoming = set()

    for record in incoming:
        ident = raw_identity(record)
        if ident in seen_incoming:
            duplicates += 1
            continue
        seen_incoming.add(ident)

        old_prices = existing_prices.get(record.part_key, set())
        if record.price is not None and old_prices and round(float(record.price), 4) not in old_prices:
            price_changes.append({
                "part_no": record.part_no,
                "old_price": "/".join(str(p) for p in sorted(old_prices)),
                "new_price": record.price,
                "ir_no": record.ir_no,
                "changed_date": date.today().isoformat(),
            })

        if ident in index:
            duplicates += 1
            pos = index[ident]
            merged, did_update = _merge_record(consolidated[pos], record)
            if did_update:
                consolidated[pos] = merged
                updated += 1
            continue

        index[ident] = len(consolidated)
        consolidated.append(record)
        new_records.append(record)
        if record.price is not None:
            existing_prices.setdefault(record.part_key, set()).add(round(float(record.price), 4))

    return consolidated, new_records, price_changes, duplicates, updated
