from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from difflib import SequenceMatcher
from typing import Iterable

from core.parser import PartRecord, clean_text, norm_model


_STOP_TOKENS = {
    "ASSY", "ASSEMBLY", "PART", "PARTS", "SPARE", "SET", "EA", "PCS",
    "THE", "OF", "WITH", "FOR",
    "부품", "세트", "조립", "조립품",
}

# Conservative term normalization. These are not used to translate complete
# sentences; they only make common massage-chair part-name variants comparable.
_TOKEN_ALIASES = {
    "PAD": "PAD",
    "패드": "PAD",
    "BACK": "BACK",
    "BACKREST": "BACK",
    "등": "BACK",
    "등받이": "BACK",
    "HEAD": "HEAD",
    "머리": "HEAD",
    "발": "FEET",
    "FEET": "FEET",
    "FOOT": "FEET",
    "CALF": "CALF",
    "종아리": "CALF",
    "ARM": "ARM",
    "팔": "ARM",
    "SHOULDER": "SHOULDER",
    "어깨": "SHOULDER",
    "COVER": "COVER",
    "커버": "COVER",
    "천": "CLOTH",
    "CLOTH": "CLOTH",
    "INNER": "INNER",
    "속": "INNER",
    "PCB": "PCB",
    "BOARD": "BOARD",
    "보드": "BOARD",
    "CABLE": "CABLE",
    "케이블": "CABLE",
    "WIRE": "WIRE",
    "배선": "WIRE",
    "REMOTE": "REMOTE",
    "REMOCON": "REMOTE",
    "리모컨": "REMOTE",
    "MOTOR": "MOTOR",
    "모터": "MOTOR",
    "AIRBAG": "AIRBAG",
    "에어백": "AIRBAG",
    "LEFT": "L",
    "좌": "L",
    "왼쪽": "L",
    "RIGHT": "R",
    "우": "R",
    "오른쪽": "R",
}


@dataclass(frozen=True)
class MatchCandidate:
    record: PartRecord
    score: int
    reason: str
    model: str
    name_score: int


def _strip_accents(value: str) -> str:
    # NFKC keeps complete Hangul syllables intact. NFKD decomposes Korean into
    # Jamo characters, which were then removed by the name-normalization regex.
    normalized = unicodedata.normalize("NFKC", value)
    return "".join(
        ch for ch in normalized
        if not unicodedata.combining(ch)
    )


def normalize_name(value: object) -> str:
    text = _strip_accents(clean_text(value)).upper()
    text = text.replace("&", " AND ")
    text = re.sub(r"[\[\]{}()]", " ", text)
    text = re.sub(r"[^0-9A-Z가-힣]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def compact_name(value: object) -> str:
    return re.sub(r"[^0-9A-Z가-힣]+", "", normalize_name(value))


def name_tokens(value: object, *, remove_models: Iterable[str] = ()) -> tuple[str, ...]:
    model_set = {norm_model(model) for model in remove_models if norm_model(model)}
    result: list[str] = []
    for raw in normalize_name(value).split():
        token = _TOKEN_ALIASES.get(raw, raw)
        normalized_model = norm_model(token)
        if normalized_model in model_set:
            continue
        if token in _STOP_TOKENS or len(token) <= 1 and token not in {"L", "R"}:
            continue
        result.append(token)
    return tuple(result)


def infer_record_model(record: PartRecord) -> str:
    direct = norm_model(record.model)
    if direct and re.fullmatch(r"[A-Z]{0,3}\d{2,5}[A-Z]?", direct):
        return direct

    joined = " ".join(
        clean_text(value)
        for value in (record.part_name_en, record.part_name_kr, record.part_no)
        if clean_text(value)
    )
    candidates = re.findall(
        r"(?:CMC-|CMS-|HM-)?([A-Z]{0,3}\d{2,5}[A-Z]?)(?:\(G\))?",
        joined.upper(),
    )
    return norm_model(candidates[-1]) if candidates else ""


def item_model_candidates(model: object, *names: object) -> tuple[str, ...]:
    joined = " ".join(
        clean_text(value) for value in (model, *names) if clean_text(value)
    ).upper()
    result: list[str] = []

    for raw in re.split(r"[/,]", clean_text(model).upper()):
        normalized = norm_model(raw)
        if normalized and re.fullmatch(r"[A-Z]{0,3}\d{2,5}[A-Z]?", normalized):
            result.append(normalized)

    tokens = [token.strip() for token in re.split(r"[,/]", joined) if token.strip()]
    for index, token in enumerate(tokens):
        if re.fullmatch(r"[A-Z]{1,3}", token) and index + 1 < len(tokens):
            nxt = re.sub(r"\(G\)", "", tokens[index + 1]).strip()
            if re.fullmatch(r"\d{2,5}[A-Z]?", nxt):
                result.append(f"{token}{nxt}")

    for match in re.findall(
        r"(?:CMC-|CMS-|HM-)?([A-Z]{0,3}\d{2,5}[A-Z]?)(?:\(G\))?",
        joined,
    ):
        normalized = norm_model(match)
        if normalized:
            result.append(normalized)

    unique: list[str] = []
    for value in result:
        if value not in unique:
            unique.append(value)
    return tuple(unique)


def infer_item_model(model: object, *names: object) -> str:
    candidates = item_model_candidates(model, *names)
    return candidates[0] if candidates else ""


def _token_similarity(left: tuple[str, ...], right: tuple[str, ...]) -> float:
    if not left or not right:
        return 0.0
    a, b = set(left), set(right)
    intersection = len(a & b)
    union = len(a | b)
    jaccard = intersection / union if union else 0.0
    containment = intersection / min(len(a), len(b))
    return max(jaccard, containment * 0.95)


def _name_similarity(left: object, right: object, model: str) -> int:
    left_compact = compact_name(left)
    right_compact = compact_name(right)
    if not left_compact or not right_compact:
        return 0
    if left_compact == right_compact:
        return 100

    left_tokens = name_tokens(left, remove_models=(model,))
    right_tokens = name_tokens(right, remove_models=(model,))
    token_score = _token_similarity(left_tokens, right_tokens)
    sequence_score = SequenceMatcher(None, left_compact, right_compact).ratio()

    # Token equality is especially important for punctuation/order variants.
    if set(left_tokens) == set(right_tokens) and left_tokens:
        return 98
    return round(max(token_score, sequence_score * 0.92) * 100)


def rank_records(
    records: Iterable[PartRecord],
    *,
    item_model: object,
    part_no: object = "",
    part_name_en: object = "",
    part_name_kr: object = "",
) -> list[MatchCandidate]:
    """Rank Master records with manufacturer already scoped by the caller.

    Matching order:
    1. part number,
    2. exact model,
    3. English/Korean normalized names,
    4. token similarity.

    A different known model is a hard rejection, preventing XL400 from matching
    XL500/X5000 even when the generic name is the same.
    """
    target_models = item_model_candidates(item_model, part_name_en, part_name_kr)
    target_model = target_models[0] if target_models else ""
    target_part_no = compact_name(part_no)
    ranked: list[MatchCandidate] = []

    for record in records:
        record_model = infer_record_model(record)

        if target_models and record_model and record_model not in target_models:
            continue

        record_part_no = compact_name(record.part_no)
        if target_part_no and record_part_no and target_part_no == record_part_no:
            score = 100 if not target_model or not record_model or target_model == record_model else 96
            ranked.append(MatchCandidate(record, score, "부품코드+모델", record_model, 100))
            continue

        en_score = _name_similarity(part_name_en, record.part_name_en, target_model)
        kr_score = _name_similarity(part_name_kr, record.part_name_kr, target_model)

        # Also compare either supplied name with both Master language columns.
        # This catches files where English/Korean headers were swapped.
        cross_scores = [
            _name_similarity(part_name_en, record.part_name_kr, target_model),
            _name_similarity(part_name_kr, record.part_name_en, target_model),
        ]
        name_score = max(en_score, kr_score, *cross_scores)

        if name_score < 60:
            continue

        score = name_score
        reasons: list[str] = []
        if target_models and record_model in target_models:
            score = min(99, score + 7)
            reasons.append("모델일치")
        elif target_model and not record_model:
            score = min(89, score)
            reasons.append("Master 모델누락")
        elif not target_model:
            score = min(79, score)
            reasons.append("발주모델누락")

        if en_score >= kr_score and en_score >= max(cross_scores):
            reasons.append("영문명")
        elif kr_score >= max(cross_scores):
            reasons.append("한글명")
        else:
            reasons.append("언어열교차")

        if name_score >= 98:
            reasons.append("정규화일치")
        else:
            reasons.append(f"토큰유사도{name_score}")

        ranked.append(
            MatchCandidate(
                record=record,
                score=score,
                reason="+".join(reasons),
                model=record_model,
                name_score=name_score,
            )
        )

    return sorted(
        ranked,
        key=lambda item: (
            item.score,
            item.name_score,
            str(item.record.base_date or ""),
            int(item.record.base_year or 0),
            str(item.record.ir_no or ""),
        ),
        reverse=True,
    )


def select_match(
    records: Iterable[PartRecord],
    *,
    item_model: object,
    part_no: object = "",
    part_name_en: object = "",
    part_name_kr: object = "",
    minimum_score: int = 82,
    ambiguity_gap: int = 4,
) -> tuple[str, int, tuple[PartRecord, ...]]:
    record_list = list(records)
    target_models = item_model_candidates(item_model, part_name_en, part_name_kr)
    target_model = target_models[0] if target_models else ""
    target_part_no = compact_name(part_no)

    # An exact part number is the strongest identifier. Keep only the requested
    # model when both sides have a model, but do not let similar names create an
    # ambiguity downgrade.
    if target_part_no:
        exact = [
            record for record in record_list
            if compact_name(record.part_no) == target_part_no
            and (
                not target_models
                or not infer_record_model(record)
                or infer_record_model(record) in target_models
            )
        ]
        if exact:
            return "부품코드", 100, tuple(exact)

    ranked = rank_records(
        record_list,
        item_model=item_model,
        part_no=part_no,
        part_name_en=part_name_en,
        part_name_kr=part_name_kr,
    )
    if not ranked or ranked[0].score < minimum_score:
        return "미매칭", 0, ()

    top = ranked[0]
    # Only candidates representing the same model and nearly identical part
    # identity are included in the price history.
    selected = [
        candidate.record
        for candidate in ranked
        if candidate.score >= max(minimum_score, top.score - 2)
        and (not top.model or candidate.model == top.model)
        and candidate.name_score >= max(82, top.name_score - 3)
    ]

    # Ambiguous equal-score candidates with materially different names must be
    # reviewed rather than silently matched.
    if len(ranked) >= 2:
        second = ranked[1]
        top_name = compact_name(top.record.part_name_en or top.record.part_name_kr)
        second_name = compact_name(second.record.part_name_en or second.record.part_name_kr)
        if (
            top.score - second.score < ambiguity_gap
            and top_name != second_name
            and top.model == second.model
        ):
            return f"후보경합:{top.reason}", min(top.score, 79), tuple(selected)

    return top.reason, top.score, tuple(selected)
