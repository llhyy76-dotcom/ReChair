from core.matching_engine import select_match
from core.parser import PartRecord


def record(model, en, kr="", price=18.0, part_no=""):
    return PartRecord(
        base_year="2024",
        base_date="2024-01-01",
        ir_no="XC2401",
        model=model,
        part_no=part_no,
        part_name_en=en,
        part_name_kr=kr,
        price=price,
        source_file="master.xlsx",
        source_row=2,
    )


def test_xl400_punctuation_and_korean_match():
    records = [
        record("XL400", "Pad Back XL400", "패드, 등, XL400", 18),
        record("XL500", "Pad, Back, XL500", "패드, 등, XL500", 22),
    ]
    method, confidence, matched = select_match(
        records,
        item_model="XL400",
        part_name_en="Pad, Back, XL400",
        part_name_kr="패드, 등, XL400",
    )
    assert matched
    assert all(row.model == "XL400" for row in matched)
    assert matched[-1].price == 18
    assert confidence >= 95
    assert "모델일치" in method


def test_different_model_is_hard_rejected():
    records = [record("XL500", "Pad, Back, XL500", "패드, 등, XL500", 22)]
    method, confidence, matched = select_match(
        records,
        item_model="XL400",
        part_name_en="Pad, Back, XL400",
        part_name_kr="패드, 등, XL400",
    )
    assert method == "미매칭"
    assert confidence == 0
    assert matched == ()


def test_korean_only_matches_english_alias_tokens():
    records = [record("XL400", "Pad, Back, XL400", "", 18)]
    method, confidence, matched = select_match(
        records,
        item_model="XL400",
        part_name_kr="패드, 등, XL400",
    )
    assert matched
    assert confidence >= 90


def test_exact_part_number_has_priority():
    records = [
        record("XL400", "Different part, XL400", price=18, part_no="XC-P-100"),
        record("XL400", "Pad Back XL400", price=20, part_no="XC-P-200"),
    ]
    method, confidence, matched = select_match(
        records,
        item_model="XL400",
        part_no="XC-P-100",
        part_name_en="Pad Back XL400",
    )
    assert matched
    assert matched[0].part_no == "XC-P-100"
    assert confidence == 100
    assert "부품코드" in method


def test_missing_model_does_not_auto_match_high_confidence():
    records = [record("XL400", "Pad, Back, XL400", "패드, 등, XL400", 18)]
    method, confidence, matched = select_match(
        records,
        item_model="",
        part_name_en="Pad Back",
    )
    assert confidence < 82
    assert matched == ()
