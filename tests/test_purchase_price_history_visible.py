from core.parser import PartRecord
from core.purchase_analyzer import PurchaseItem, _analyze_item


def test_history_expands_when_part_code_changed_but_name_and_model_match():
    item = PurchaseItem(
        manufacturer="AC", source_sheet="AC", source_row=2,
        part_no="NEW-100", part_name_kr="패드, 등, L500",
        part_name_en="", model="L500", order_unit_price=31.0,
        order_qty=10, order_amount=310.0, usage_type="", note="",
    )
    records = [
        PartRecord(
            base_date="2023-01-01", ir_no="AC2301", model="L500",
            part_no="OLD-100", part_name_kr="패드, 등, L500", price=25.0,
            source_file="old.xlsx", source_row=2,
        ),
        PartRecord(
            base_date="2025-01-01", ir_no="AC2501", model="L500",
            part_no="NEW-100", part_name_kr="패드, 등, L500", price=29.0,
            source_file="new.xlsx", source_row=3,
        ),
    ]
    row = _analyze_item(item, records)
    assert row.master_latest_price == 29.0
    assert row.previous_price == 25.0
    assert row.price_change_count == 1
    assert row.price_history_summary == "25.0000 → 29.0000"
    assert "이력확장" in row.match_method
