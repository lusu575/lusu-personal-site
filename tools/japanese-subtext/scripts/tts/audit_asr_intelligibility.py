"""Advisory, offline Japanese ASR intelligibility audit for published MP3 files.

The report deliberately never deletes audio.  ASR output is fallible, especially for
short tokens and alternative Japanese orthography, so even strict candidates are only
inputs to a human listening/re-recording decision.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import statistics
import sys
import unicodedata
import uuid
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Iterable, Mapping, Sequence


SCHEMA_VERSION = 2
TOOL_VERSION = "1.1.0"
DEFAULT_TYPES = ("line", "token", "option")
HIRAGANA_START = 0x3041
HIRAGANA_END = 0x3096
KATAKANA_START = 0x30A1
KATAKANA_END = 0x30F6
KANJI_RANGES = (
    (0x3400, 0x4DBF),
    (0x4E00, 0x9FFF),
    (0xF900, 0xFAFF),
    (0x20000, 0x2FA1F),
)


@dataclass(frozen=True)
class Thresholds:
    """Candidate thresholds; they never authorize automatic file deletion."""

    review_similarity: float = 0.60
    very_low_similarity: float = 0.18
    minimum_low_chars: int = 5

    def validate(self) -> None:
        if not 0.0 <= self.very_low_similarity <= self.review_similarity <= 1.0:
            raise ValueError(
                "thresholds must satisfy 0 <= very-low-similarity <= review-similarity <= 1"
            )
        if self.minimum_low_chars < 1:
            raise ValueError("minimum-low-chars must be at least 1")


def _katakana_to_hiragana(character: str) -> str:
    codepoint = ord(character)
    if KATAKANA_START <= codepoint <= KATAKANA_END:
        return chr(codepoint - 0x60)
    if character == "ヽ":
        return "ゝ"
    if character == "ヾ":
        return "ゞ"
    return character


def normalize_japanese(text: str) -> str:
    """NFKC-fold Japanese text while preserving pronunciation-bearing characters."""

    normalized = unicodedata.normalize("NFKC", str(text)).lower()
    output: list[str] = []
    for character in normalized:
        category = unicodedata.category(character)
        if category.startswith("P") or category.startswith("Z") or character.isspace():
            continue
        output.append(_katakana_to_hiragana(character))
    return "".join(output)


_KANA_VOWELS = {
    **{character: "a" for character in "あかがさざただなはばぱまゃやらわぁゎ"},
    **{character: "i" for character in "いきぎしじちぢにひびぴみりゐぃ"},
    **{character: "u" for character in "うくぐすずつづぬふぶぷむゅゆるゔぅ"},
    **{character: "e" for character in "えけげせぜてでねへべぺめれゑぇ"},
    **{character: "o" for character in "おこごそぞとどのほぼぽもょよろをぉ"},
}


def _phonetic_fold(normalized_text: str) -> str:
    """Fold common kana long-vowel spellings to a shared length marker."""

    output: list[str] = []
    previous_kana: str | None = None
    for character in normalized_text:
        previous_vowel = _KANA_VOWELS.get(previous_kana or "")
        current_vowel = _KANA_VOWELS.get(character)
        is_common_long_vowel = (
            character == "う" and previous_vowel == "o"
        ) or (
            character == "い" and previous_vowel == "e"
        ) or (
            current_vowel is not None
            and current_vowel == previous_vowel
            and character in {"あ", "い", "う", "え", "お"}
        )
        if character == "ー" or is_common_long_vowel:
            if output and output[-1] != "ː":
                output.append("ː")
            continue
        output.append(character)
        if current_vowel is not None:
            previous_kana = character
        elif HIRAGANA_START <= ord(character) <= HIRAGANA_END:
            previous_kana = character
        else:
            previous_kana = None
    return "".join(output)


def _levenshtein_distance(left: str, right: str) -> int:
    if len(left) < len(right):
        left, right = right, left
    previous = list(range(len(right) + 1))
    for left_index, left_character in enumerate(left, start=1):
        current = [left_index]
        for right_index, right_character in enumerate(right, start=1):
            current.append(
                min(
                    current[-1] + 1,
                    previous[right_index] + 1,
                    previous[right_index - 1] + (left_character != right_character),
                )
            )
        previous = current
    return previous[-1]


def _similarity(left: str, right: str) -> float:
    if not left and not right:
        return 1.0
    denominator = max(len(left), len(right))
    if denominator == 0:
        return 0.0
    return round(max(0.0, 1.0 - (_levenshtein_distance(left, right) / denominator)), 6)


ReadingConverter = Callable[[str], str | None]


@dataclass(frozen=True)
class OfflineReadingConverter:
    backend: str
    convert: ReadingConverter

    def __call__(self, text: str) -> str | None:
        return self.convert(text)


def _discover_offline_reading_converter() -> OfflineReadingConverter | None:
    """Use only already-installed, dictionary-backed local reading converters."""

    try:
        import pykakasi  # type: ignore[import-not-found]
    except ImportError:
        pykakasi = None
    if pykakasi is not None:
        try:
            engine = pykakasi.kakasi()
        except Exception:
            engine = None
        if engine is not None:

            def convert_with_pykakasi(text: str) -> str | None:
                chunks = engine.convert(text)
                if not isinstance(chunks, Sequence):
                    return None
                reading = "".join(
                    str(chunk.get("hira") or chunk.get("orig") or "")
                    for chunk in chunks
                    if isinstance(chunk, Mapping)
                )
                return reading or None

            return OfflineReadingConverter("pykakasi", convert_with_pykakasi)

    try:
        import fugashi  # type: ignore[import-not-found]
    except ImportError:
        return None
    try:
        tagger = fugashi.Tagger()
    except Exception:
        return None

    def convert_with_fugashi(text: str) -> str | None:
        output: list[str] = []
        for token in tagger(text):
            surface = str(getattr(token, "surface", ""))
            feature = getattr(token, "feature", None)
            reading = next(
                (
                    str(value)
                    for name in ("kana", "pron", "pronBase", "reading")
                    if (value := getattr(feature, name, None)) not in (None, "", "*")
                ),
                None,
            )
            if reading is None:
                if _contains_kanji(surface):
                    return None
                reading = surface
            output.append(reading)
        result = "".join(output)
        return result or None

    return OfflineReadingConverter("fugashi", convert_with_fugashi)


def _prepare_today_reading_conversion_input(
    expected_normalized: str,
    transcript: str,
) -> str:
    """Give only reviewed 今日+は occurrences to the converter as kana."""

    expected_forms = re.findall(r"きょう[はわ]|きょー[はわ]", expected_normalized)
    result = transcript
    for expected_form in expected_forms:
        if "今日は" not in result:
            break
        result = result.replace("今日は", expected_form, 1)
    return result


def japanese_similarity(
    expected: str,
    transcript: str,
    *,
    reading_converter: ReadingConverter | None = None,
) -> dict[str, Any]:
    expected_normalized = normalize_japanese(expected)
    transcript_normalized = normalize_japanese(transcript)
    comparison_transcript = transcript_normalized
    conversion_backend: str | None = None
    comparison_available = True
    if _contains_kanji(transcript_normalized):
        conversion_input = _prepare_today_reading_conversion_input(
            expected_normalized,
            transcript,
        )
        converted = (
            reading_converter(conversion_input)
            if reading_converter is not None
            else None
        )
        converted_normalized = normalize_japanese(converted or "")
        if converted_normalized and not _contains_kanji(converted_normalized):
            comparison_transcript = converted_normalized
            conversion_backend = getattr(reading_converter, "backend", "injected-offline")
        else:
            comparison_available = False
    character_score = _similarity(expected_normalized, comparison_transcript)
    phonetic_score = _similarity(
        _phonetic_fold(expected_normalized),
        _phonetic_fold(comparison_transcript),
    )
    return {
        "character": character_score,
        "phonetic": phonetic_score,
        "score": max(character_score, phonetic_score),
        "comparisonAvailable": comparison_available,
        "comparisonTranscript": comparison_transcript,
        "readingConversionBackend": conversion_backend,
    }


def _contains_kanji(text: str) -> bool:
    return any(start <= ord(character) <= end for character in text for start, end in KANJI_RANGES)


def check_today_reading(expected: str, transcript: str) -> dict[str, Any]:
    """Report each expected きょう occurrence without claiming acoustic proof."""

    expected_normalized = normalize_japanese(expected)
    transcript_normalized = normalize_japanese(transcript)
    expected_folded = _phonetic_fold(expected_normalized)
    expected_count = expected_folded.count("きょː")
    base = {
        "applicable": expected_count > 0,
        "expectedCount": expected_count,
        "acousticallyProven": False,
        "reviewCandidate": False,
    }
    if expected_count == 0:
        return {**base, "status": "not-applicable", "occurrences": []}

    event_details = {
        "きょう": ("recognized-kana", "asr-kana"),
        "きょー": ("recognized-kana", "asr-kana"),
        "今日": ("recognized-orthography", "asr-kanji-orthography"),
        "おう": ("possible-dropped-ky", "asr-output-candidate"),
        "おー": ("possible-dropped-ky", "asr-output-candidate"),
        "王": ("possible-dropped-ky", "asr-output-candidate"),
    }
    events = [
        {
            "status": event_details[match.group(0)][0],
            "evidence": event_details[match.group(0)][1],
            "recognizedAs": match.group(0),
        }
        for match in re.finditer(r"きょう|きょー|今日|おう|おー|王", transcript_normalized)
    ]
    recognized_events = [
        event for event in events if event["status"].startswith("recognized-")
    ]
    dropped_events = [event for event in events if event["status"] == "possible-dropped-ky"]
    occurrence_events = [*recognized_events, *dropped_events]
    occurrences: list[dict[str, Any]] = []
    for index in range(expected_count):
        event = occurrence_events[index] if index < len(occurrence_events) else {
            "status": "unconfirmed",
            "evidence": "asr-output-candidate",
            "recognizedAs": None,
        }
        occurrences.append({"index": index + 1, **event})
    unresolved_statuses = {"possible-dropped-ky", "unconfirmed"}
    review_candidate = any(
        occurrence["status"] in unresolved_statuses for occurrence in occurrences
    )
    if expected_count == 1:
        status = occurrences[0]["status"]
        evidence = occurrences[0]["evidence"]
    elif review_candidate:
        status = "partially-recognized"
        evidence = "per-occurrence-asr-evidence"
    else:
        status = "recognized-all"
        evidence = "per-occurrence-asr-evidence"
    return {
        **base,
        "status": status,
        "evidence": evidence,
        "reviewCandidate": review_candidate,
        "occurrences": occurrences,
        "extraTranscriptCandidates": occurrence_events[expected_count:],
    }


def detect_extra_i_tail(expected: str, transcript: str) -> dict[str, Any] | None:
    """Find a conservative ASR suffix candidate for an extra i/ii or い/いい."""

    expected_normalized = normalize_japanese(expected)
    transcript_normalized = normalize_japanese(transcript)
    if not expected_normalized or transcript_normalized == expected_normalized:
        return None
    for tail_character in ("い", "i"):
        transcript_tail_count = len(transcript_normalized) - len(
            transcript_normalized.rstrip(tail_character)
        )
        expected_tail_count = len(expected_normalized) - len(
            expected_normalized.rstrip(tail_character)
        )
        extra_tail_count = transcript_tail_count - expected_tail_count
        if extra_tail_count <= 0:
            continue
        extra = tail_character * extra_tail_count
        prefix = transcript_normalized[:-extra_tail_count]
        prefix_similarity = japanese_similarity(expected_normalized, prefix)["score"]
        if prefix_similarity < 0.80:
            continue
        return {
            "extra": extra,
            "explicit": prefix == expected_normalized,
            "prefixSimilarity": prefix_similarity,
            "expectedTailCount": expected_tail_count,
            "transcriptTailCount": transcript_tail_count,
            "evidence": "normalized-asr-suffix",
        }
    return None


def evaluate_transcript(
    item: Mapping[str, Any],
    transcript: str,
    thresholds: Thresholds,
    *,
    reading_converter: ReadingConverter | None = None,
) -> dict[str, Any]:
    thresholds.validate()
    expected = str(item.get("readingKana") or "")
    expected_normalized = normalize_japanese(expected)
    transcript_normalized = normalize_japanese(transcript)
    similarity = japanese_similarity(
        expected,
        transcript,
        reading_converter=reading_converter,
    )
    comparison_transcript = (
        str(similarity["comparisonTranscript"])
        if similarity["comparisonAvailable"]
        else transcript
    )
    today = check_today_reading(expected, transcript)
    tail = detect_extra_i_tail(expected, comparison_transcript)
    candidate_reasons: list[str] = []
    strict_reasons: list[str] = []

    if not similarity["comparisonAvailable"]:
        candidate_reasons.append("kanji-reading-unavailable")
    if similarity["score"] < thresholds.review_similarity:
        candidate_reasons.append("low-normalized-similarity")
    if today["reviewCandidate"]:
        occurrence_statuses = {
            occurrence.get("status")
            for occurrence in today.get("occurrences", [])
            if isinstance(occurrence, Mapping)
        }
        if "possible-dropped-ky" in occurrence_statuses:
            candidate_reasons.append("possible-dropped-ky")
        if "unconfirmed" in occurrence_statuses:
            candidate_reasons.append("today-reading-unconfirmed")
    if tail is not None:
        reason = "explicit-extra-i-tail" if tail["explicit"] else "possible-extra-i-tail"
        candidate_reasons.append(reason)
        if tail["explicit"]:
            strict_reasons.append(reason)

    low_similarity_is_strict = (
        similarity["comparisonAvailable"]
        and len(expected_normalized) >= thresholds.minimum_low_chars
        and similarity["score"] < thresholds.very_low_similarity
    )
    if low_similarity_is_strict:
        strict_reasons.append("very-low-normalized-similarity")
        if "low-normalized-similarity" not in candidate_reasons:
            candidate_reasons.append("low-normalized-similarity")
        candidate_reasons.append("very-low-normalized-similarity")

    return {
        "audioId": str(item.get("id") or ""),
        "stageId": item.get("stageId"),
        "type": str(item.get("type") or "unknown"),
        "voiceKey": str(item.get("voiceKey") or "unknown"),
        "modelVoice": item.get("modelVoice"),
        "status": "ok",
        "expectedReadingKana": expected,
        "transcript": transcript,
        "normalizedExpected": expected_normalized,
        "normalizedTranscript": transcript_normalized,
        "normalizedComparisonTranscript": normalize_japanese(comparison_transcript),
        "transcriptContainsKanji": _contains_kanji(transcript_normalized),
        "similarity": similarity,
        "todayReading": today,
        "extraITail": tail,
        "reviewCandidate": bool(candidate_reasons),
        "strictCandidate": bool(strict_reasons),
        "candidateReasons": candidate_reasons,
        "strictReasons": strict_reasons,
        "disposition": "manual-review-only" if candidate_reasons else "no-candidate",
    }


def _validated_manifest_audio_path(audio_id: str, value: Any) -> str:
    if not isinstance(value, str) or not value or value != value.strip():
        raise ValueError(f"{audio_id}: invalid manifest audio path")
    if (
        "\\" in value
        or "\0" in value
        or ":" in value
        or value.startswith("/")
        or any(part in {"", ".", ".."} for part in value.split("/"))
        or not value.lower().endswith(".mp3")
    ):
        raise ValueError(f"{audio_id}: invalid manifest audio path")
    return value


def _auditable_manifest_items(
    manifest: Mapping[str, Any],
    include_types: Iterable[str],
) -> dict[str, dict[str, Any]]:
    allowed_types = set(include_types)
    unsupported_types = allowed_types.difference(DEFAULT_TYPES)
    if unsupported_types:
        raise ValueError(f"unsupported manifest audio types: {', '.join(sorted(unsupported_types))}")
    raw_items = manifest.get("items")
    if not isinstance(raw_items, Mapping):
        raise ValueError("manifest.items must be an object")
    items: dict[str, dict[str, Any]] = {}
    seen_ids: set[str] = set()
    seen_paths: dict[str, tuple[str, str]] = {}
    for manifest_id, raw_item in raw_items.items():
        if not isinstance(raw_item, Mapping):
            raise ValueError(f"{manifest_id}: manifest item must be an object")
        raw_id = raw_item.get("id")
        if not isinstance(raw_id, str) or not raw_id.strip():
            raise ValueError(f"{manifest_id}: id must be a non-empty string")
        audio_id = raw_id.strip()
        if audio_id != str(manifest_id):
            raise ValueError(f"{manifest_id}: id must match its manifest key ({audio_id})")
        if audio_id in seen_ids:
            raise ValueError(f"duplicate manifest audio id: {audio_id}")
        seen_ids.add(audio_id)
        kind = raw_item.get("type")
        if not isinstance(kind, str) or not kind:
            raise ValueError(f"{audio_id}: type must be a non-empty string")
        if kind not in {*DEFAULT_TYPES, "scene"}:
            raise ValueError(f"{audio_id}: unsupported manifest audio type: {kind}")
        normalized_path = _validated_manifest_audio_path(audio_id, raw_item.get("path"))
        path_key = normalized_path.casefold()
        if path_key in seen_paths:
            first_path, first_audio_id = seen_paths[path_key]
            raise ValueError(
                f"duplicate manifest audio path: {first_path} / {normalized_path} "
                f"({first_audio_id}, {audio_id})"
            )
        seen_paths[path_key] = (normalized_path, audio_id)
        sha256 = raw_item.get("sha256")
        if (
            not isinstance(sha256, str)
            or len(sha256) != 64
            or any(character not in "0123456789abcdef" for character in sha256)
        ):
            raise ValueError(f"{audio_id}: sha256 must be 64 lowercase hexadecimal characters")
        if kind in DEFAULT_TYPES:
            for field in ("voiceKey", "modelVoice"):
                value = raw_item.get(field)
                if not isinstance(value, str) or not value.strip():
                    raise ValueError(f"{audio_id}: {field} must be a non-empty string")
            reading = raw_item.get("readingKana")
            if not isinstance(reading, str) or not reading.strip():
                raise ValueError(f"{audio_id}: readingKana must be a non-empty string")
        if kind not in allowed_types:
            continue
        item = dict(raw_item)
        item["id"] = audio_id
        items[audio_id] = item
    return items


def _seeded_rank(seed: str, value: str) -> str:
    return hashlib.sha256(f"{seed}\0{value}".encode("utf-8")).hexdigest()


def select_manifest_items(
    manifest: Mapping[str, Any],
    *,
    sample_size: int | None = None,
    seed: str = "japanese-subtext-asr-v1",
    audio_ids: Sequence[str] | None = None,
    include_types: Iterable[str] = DEFAULT_TYPES,
) -> list[dict[str, Any]]:
    """Select all, explicit IDs, or a deterministic voice/type-stratified sample."""

    items = _auditable_manifest_items(manifest, include_types)
    if audio_ids:
        selected: list[dict[str, Any]] = []
        seen: set[str] = set()
        for audio_id in audio_ids:
            if audio_id in seen:
                raise ValueError(f"duplicate requested audioId: {audio_id}")
            seen.add(audio_id)
            if audio_id not in items:
                raise ValueError(f"unknown or unauditable audioId: {audio_id}")
            selected.append(items[audio_id])
        return selected
    if sample_size is None:
        return [items[audio_id] for audio_id in sorted(items)]
    if sample_size < 1:
        raise ValueError("sample-size must be at least 1")
    if sample_size >= len(items):
        return [items[audio_id] for audio_id in sorted(items)]

    strata: dict[tuple[str, str], list[dict[str, Any]]] = {}
    for item in items.values():
        key = (str(item.get("voiceKey") or "unknown"), str(item.get("type") or "unknown"))
        strata.setdefault(key, []).append(item)
    for key, values in strata.items():
        values.sort(key=lambda item: _seeded_rank(seed, str(item["id"])))
    stratum_order = sorted(
        strata,
        key=lambda key: _seeded_rank(seed, f"{key[0]}|{key[1]}"),
    )
    selected = []
    offsets = {key: 0 for key in stratum_order}
    while len(selected) < sample_size:
        made_progress = False
        for key in stratum_order:
            offset = offsets[key]
            values = strata[key]
            if offset >= len(values):
                continue
            selected.append(values[offset])
            offsets[key] += 1
            made_progress = True
            if len(selected) == sample_size:
                break
        if not made_progress:
            break
    return selected


def _round_stat(value: float) -> float:
    return round(float(value), 6)


def _aggregate_results(results: Sequence[Mapping[str, Any]]) -> dict[str, Any]:
    similarities = [
        float(result["similarity"]["score"])
        for result in results
        if result.get("status") == "ok" and isinstance(result.get("similarity"), Mapping)
    ]
    today = [
        result.get("todayReading")
        for result in results
        if isinstance(result.get("todayReading"), Mapping)
        and result["todayReading"].get("applicable") is True
    ]
    return {
        "count": len(results),
        "successfulCount": sum(result.get("status") == "ok" for result in results),
        "asrErrorCount": sum(
            result.get("status") == "asr-error" or result.get("failureKind") == "asr"
            for result in results
        ),
        "infraFailureCount": sum(
            result.get("infraFailure") is True
            or result.get("status") in {"infra-error", "integrity-error", "asr-error"}
            for result in results
        ),
        "reviewCandidateCount": sum(result.get("reviewCandidate") is True for result in results),
        "strictCandidateCount": sum(result.get("strictCandidate") is True for result in results),
        "extraITailCandidateCount": sum(result.get("extraITail") is not None for result in results),
        "todayApplicableCount": len(today),
        "todayReviewCandidateCount": sum(check.get("reviewCandidate") is True for check in today),
        "similarity": {
            "count": len(similarities),
            "mean": _round_stat(statistics.fmean(similarities)) if similarities else None,
            "median": _round_stat(statistics.median(similarities)) if similarities else None,
            "minimum": _round_stat(min(similarities)) if similarities else None,
        },
    }


def summarize_results(results: Sequence[Mapping[str, Any]]) -> dict[str, Any]:
    by_voice: dict[str, list[Mapping[str, Any]]] = {}
    by_model_voice: dict[str, list[Mapping[str, Any]]] = {}
    by_type: dict[str, list[Mapping[str, Any]]] = {}
    by_combination: dict[str, list[Mapping[str, Any]]] = {}
    for result in results:
        voice = str(result.get("voiceKey") or "unknown")
        model_voice = str(result.get("modelVoice") or "unknown")
        kind = str(result.get("type") or "unknown")
        by_voice.setdefault(voice, []).append(result)
        by_model_voice.setdefault(model_voice, []).append(result)
        by_type.setdefault(kind, []).append(result)
        by_combination.setdefault(f"{voice}|{kind}", []).append(result)
    total = _aggregate_results(results)
    return {
        "totals": {
            "audited": total["count"],
            "successful": total["successfulCount"],
            "asrErrors": total["asrErrorCount"],
            "infraFailures": total["infraFailureCount"],
            "reviewCandidates": total["reviewCandidateCount"],
            "strictCandidates": total["strictCandidateCount"],
            "extraITailCandidates": total["extraITailCandidateCount"],
            "todayApplicable": total["todayApplicableCount"],
            "todayReviewCandidates": total["todayReviewCandidateCount"],
            "similarity": total["similarity"],
        },
        "byVoice": {key: _aggregate_results(by_voice[key]) for key in sorted(by_voice)},
        "byModelVoice": {
            key: _aggregate_results(by_model_voice[key]) for key in sorted(by_model_voice)
        },
        "byType": {key: _aggregate_results(by_type[key]) for key in sorted(by_type)},
        "byVoiceAndType": {
            key: _aggregate_results(by_combination[key]) for key in sorted(by_combination)
        },
    }


def _report_verdict(totals: Mapping[str, Any]) -> str:
    if int(totals.get("infraFailures") or 0) > 0:
        return "audit-incomplete"
    if int(totals.get("strictCandidates") or 0) > 0:
        return "manual-review-required"
    if int(totals.get("reviewCandidates") or 0) > 0:
        return "manual-review-candidates"
    return "audit-passed"


def _file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def _model_fingerprint(model_path: Path) -> tuple[str, list[dict[str, Any]]]:
    required_files = {"config.json", "model.bin", "tokenizer.json", "vocabulary.txt"}
    missing_files = sorted(name for name in required_files if not (model_path / name).is_file())
    if missing_files:
        raise ValueError(
            "missing required faster-whisper model files: " + ", ".join(missing_files)
        )
    files: list[dict[str, Any]] = []
    for path in sorted((path for path in model_path.rglob("*") if path.is_file())):
        files.append(
            {
                "path": path.relative_to(model_path).as_posix(),
                "bytes": path.stat().st_size,
                "sha256": _file_sha256(path),
            }
        )
    if not files:
        raise ValueError("the local faster-whisper model directory contains no files")
    return hashlib.sha256(_canonical_json(files).encode("utf-8")).hexdigest(), files


def _resolve_audio_path(audio_root: Path, item: Mapping[str, Any]) -> Path:
    audio_id = str(item.get("id") or "")
    relative = _validated_manifest_audio_path(audio_id, item.get("path"))
    root = audio_root.resolve()
    candidate = (root / relative).resolve()
    if not candidate.is_relative_to(root) or not candidate.is_file():
        raise ValueError(f"{item.get('id')}: audio file is missing or escapes audio root")
    return candidate


class FasterWhisperTranscriber:
    """Small adapter that pins faster-whisper to local CPU int8 inference."""

    def __init__(self, model_path: Path, *, cpu_threads: int = 0, beam_size: int = 5) -> None:
        os.environ["HF_HUB_OFFLINE"] = "1"
        os.environ["TRANSFORMERS_OFFLINE"] = "1"
        try:
            from faster_whisper import WhisperModel
        except ImportError as error:  # pragma: no cover - exercised only in the local ASR runtime
            raise RuntimeError(
                "faster-whisper is not available in this Python runtime; use the existing local runtime, do not install or download anything"
            ) from error
        kwargs: dict[str, Any] = {
            "device": "cpu",
            "compute_type": "int8",
            "local_files_only": True,
        }
        if cpu_threads > 0:
            kwargs["cpu_threads"] = cpu_threads
        self.model = WhisperModel(str(model_path), **kwargs)
        self.beam_size = beam_size

    def transcribe(self, audio_path: Path) -> tuple[str, dict[str, Any]]:
        segments, info = self.model.transcribe(
            str(audio_path),
            language="ja",
            task="transcribe",
            beam_size=self.beam_size,
            temperature=0.0,
            condition_on_previous_text=False,
            vad_filter=False,
            word_timestamps=False,
        )
        transcript = "".join(str(segment.text) for segment in segments).strip()
        metadata = {
            "detectedLanguage": getattr(info, "language", None),
            "languageProbability": (
                round(float(getattr(info, "language_probability")), 6)
                if getattr(info, "language_probability", None) is not None
                else None
            ),
            "durationSeconds": (
                round(float(getattr(info, "duration")), 6)
                if getattr(info, "duration", None) is not None
                else None
            ),
        }
        return transcript, metadata


def _write_json_atomic(path: Path, value: Mapping[str, Any], *, overwrite: bool) -> None:
    payload = json.dumps(value, ensure_ascii=False, indent=2) + "\n"
    path.parent.mkdir(parents=True, exist_ok=True)
    if not overwrite and path.exists():
        raise ValueError(f"refusing to overwrite existing JSON file: {path}")
    temporary = path.with_name(f".{path.name}.{os.getpid()}.{uuid.uuid4().hex}.tmp")
    try:
        with temporary.open("x", encoding="utf-8", newline="\n") as handle:
            handle.write(payload)
            handle.flush()
            os.fsync(handle.fileno())
        if not overwrite and path.exists():
            raise ValueError(f"refusing to overwrite existing JSON file: {path}")
        if overwrite:
            os.replace(temporary, path)
        else:
            os.link(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


class CheckpointStore:
    """O(N) resumable store with one atomic JSON result per audio item."""

    def __init__(self, root: Path, *, run_fingerprint: str, resume: bool) -> None:
        self.root = root.resolve()
        self.state_path = self.root / "state.json"
        self.items_path = self.root / "items"
        self.run_fingerprint = run_fingerprint
        if resume:
            if not self.state_path.is_file() or not self.items_path.is_dir():
                raise ValueError("resume requested but checkpoint state is incomplete")
            state = json.loads(self.state_path.read_text(encoding="utf-8"))
            if not isinstance(state, Mapping):
                raise ValueError("checkpoint state must be a JSON object")
            if state.get("runFingerprint") != run_fingerprint:
                raise ValueError("checkpoint run fingerprint does not match this audit")
            if state.get("schemaVersion") != 1:
                raise ValueError("unsupported checkpoint schema version")
            return

        if self.root.exists() and any(self.root.iterdir()):
            raise ValueError("checkpoint directory is not empty; use --resume or a new directory")
        self.items_path.mkdir(parents=True, exist_ok=True)
        _write_json_atomic(
            self.state_path,
            {
                "schemaVersion": 1,
                "toolVersion": TOOL_VERSION,
                "runFingerprint": run_fingerprint,
            },
            overwrite=False,
        )

    @staticmethod
    def _result_path(items_path: Path, audio_id: str) -> Path:
        filename = hashlib.sha256(audio_id.encode("utf-8")).hexdigest() + ".json"
        return items_path / filename

    def save_result(self, result: Mapping[str, Any]) -> None:
        audio_id = result.get("audioId")
        if not isinstance(audio_id, str) or not audio_id:
            raise ValueError("checkpoint result is missing audioId")
        _write_json_atomic(
            self._result_path(self.items_path, audio_id),
            dict(result),
            overwrite=True,
        )

    def load_result(self, audio_id: str, *, actual_sha256: str) -> dict[str, Any] | None:
        path = self._result_path(self.items_path, audio_id)
        if not path.is_file():
            return None
        result = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(result, Mapping) or result.get("audioId") != audio_id:
            raise ValueError(f"invalid checkpoint result for {audio_id}")
        if result.get("status") != "ok":
            return None
        audio = result.get("audio")
        if not isinstance(audio, Mapping) or audio.get("sha256") != actual_sha256:
            return None
        return dict(result)


def _validate_report_destination(
    path: Path,
    *,
    manifest_path: Path,
    audio_root: Path,
    model_path: Path,
) -> Path:
    resolved = path.resolve()
    manifest_resolved = manifest_path.resolve()
    audio_resolved = audio_root.resolve()
    model_resolved = model_path.resolve()
    if resolved.suffix.lower() != ".json":
        raise ValueError("report output must use a .json suffix")
    if resolved.exists():
        raise ValueError(f"report output already exists and will not be overwritten: {resolved}")
    if resolved == manifest_resolved:
        raise ValueError("report output cannot overwrite the input manifest")
    if resolved.is_relative_to(audio_resolved):
        raise ValueError("report output must be outside the audio root")
    if resolved.is_relative_to(model_resolved):
        raise ValueError("report output must be outside the ASR model directory")
    return resolved


def _validate_checkpoint_destination(
    path: Path,
    *,
    manifest_path: Path,
    audio_root: Path,
    model_path: Path,
    report_path: Path | None,
) -> Path:
    resolved = path.resolve()
    if resolved == manifest_path.resolve():
        raise ValueError("checkpoint directory cannot replace the input manifest")
    if resolved.is_relative_to(audio_root.resolve()):
        raise ValueError("checkpoint directory must be outside the audio root")
    if resolved.is_relative_to(model_path.resolve()):
        raise ValueError("checkpoint directory must be outside the ASR model directory")
    if resolved.exists() and not resolved.is_dir():
        raise ValueError("checkpoint destination exists and is not a directory")
    if report_path is not None:
        report_resolved = report_path.resolve()
        if report_resolved.is_relative_to(resolved) or resolved.is_relative_to(report_resolved):
            raise ValueError("checkpoint and report paths must not contain one another")
    return resolved


def _write_json(path: Path, report: Mapping[str, Any]) -> None:
    if str(path) == "-":
        sys.stdout.write(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
        return
    _write_json_atomic(path, report, overwrite=False)


def _audit_run_fingerprint(
    *,
    manifest_sha256: str,
    model_sha256: str,
    audio_root: Path,
    selected: Sequence[Mapping[str, Any]],
    thresholds: Thresholds,
    args: argparse.Namespace,
    reading_converter: OfflineReadingConverter | None,
) -> str:
    payload = {
        "toolVersion": TOOL_VERSION,
        "manifestSha256": manifest_sha256,
        "modelFingerprintSha256": model_sha256,
        "audioRoot": str(audio_root.resolve()),
        "audioIds": [str(item["id"]) for item in selected],
        "types": list(args.types or DEFAULT_TYPES),
        "seed": args.seed,
        "sampleSize": args.sample_size,
        "thresholds": asdict(thresholds),
        "beamSize": args.beam_size,
        "cpuThreads": args.cpu_threads,
        "readingConverterBackend": reading_converter.backend if reading_converter else None,
    }
    return hashlib.sha256(_canonical_json(payload).encode("utf-8")).hexdigest()


def _infrastructure_failure_result(
    item: Mapping[str, Any],
    *,
    failure_kind: str,
    error: Exception | str,
    status: str = "infra-error",
) -> dict[str, Any]:
    message = error if isinstance(error, str) else f"{type(error).__name__}: {error}"
    return {
        "audioId": str(item.get("id") or ""),
        "stageId": item.get("stageId"),
        "type": str(item.get("type") or "unknown"),
        "voiceKey": str(item.get("voiceKey") or "unknown"),
        "modelVoice": item.get("modelVoice"),
        "status": status,
        "infraFailure": True,
        "failureKind": failure_kind,
        "error": message,
        "reviewCandidate": False,
        "strictCandidate": False,
        "candidateReasons": [],
        "strictReasons": [],
        "disposition": "audit-incomplete",
    }


def _prepare_audio_input(audio_root: Path, item: Mapping[str, Any]) -> tuple[Path, str]:
    audio_path = _resolve_audio_path(audio_root, item)
    return audio_path, _file_sha256(audio_path)


def _audit_one_item(
    item: Mapping[str, Any],
    audio_root: Path,
    transcriber: Any,
    thresholds: Thresholds,
    *,
    reading_converter: ReadingConverter | None,
    prepared_audio: tuple[Path, str] | None = None,
) -> dict[str, Any]:
    try:
        audio_path, actual_sha256 = prepared_audio or _prepare_audio_input(audio_root, item)
    except Exception as error:
        return _infrastructure_failure_result(item, failure_kind="input", error=error)

    manifest_sha256 = str(item.get("sha256") or "")
    if actual_sha256 != manifest_sha256:
        result = _infrastructure_failure_result(
            item,
            failure_kind="integrity",
            error=(
                f"manifest sha256 mismatch: expected {manifest_sha256}, "
                f"found {actual_sha256}"
            ),
            status="integrity-error",
        )
        result["audio"] = {
            "path": str(item["path"]),
            "sha256": actual_sha256,
            "manifestSha256": manifest_sha256,
            "manifestSha256Matches": False,
        }
        return result

    try:
        transcript, asr_metadata = transcriber.transcribe(audio_path)
        result = evaluate_transcript(
            item,
            transcript,
            thresholds,
            reading_converter=reading_converter,
        )
    except Exception as error:
        return _infrastructure_failure_result(item, failure_kind="asr", error=error)
    result["infraFailure"] = False
    result["audio"] = {
        "path": str(item["path"]),
        "sha256": actual_sha256,
        "manifestSha256": manifest_sha256,
        "manifestSha256Matches": True,
    }
    result["asr"] = asr_metadata
    return result


def run_audit(args: argparse.Namespace) -> dict[str, Any]:
    manifest_path = args.manifest.resolve()
    model_path = args.model.resolve()
    audio_root = (args.audio_root or manifest_path.parent).resolve()
    if not manifest_path.is_file():
        raise ValueError(f"manifest does not exist: {manifest_path}")
    if not model_path.is_dir():
        raise ValueError(f"local faster-whisper model directory does not exist: {model_path}")
    report_path = None
    if str(args.output) != "-":
        report_path = _validate_report_destination(
            args.output,
            manifest_path=manifest_path,
            audio_root=audio_root,
            model_path=model_path,
        )
    checkpoint_path = None
    if getattr(args, "checkpoint_dir", None) is not None:
        checkpoint_path = _validate_checkpoint_destination(
            args.checkpoint_dir,
            manifest_path=manifest_path,
            audio_root=audio_root,
            model_path=model_path,
            report_path=report_path,
        )
    if getattr(args, "resume", False) and checkpoint_path is None:
        raise ValueError("resume requires a checkpoint directory")
    manifest_payload = manifest_path.read_bytes()
    manifest_sha256 = hashlib.sha256(manifest_payload).hexdigest()
    manifest = json.loads(manifest_payload.decode("utf-8"))
    if not isinstance(manifest, Mapping):
        raise ValueError("manifest root must be an object")
    thresholds = Thresholds(
        review_similarity=args.review_similarity,
        very_low_similarity=args.very_low_similarity,
        minimum_low_chars=args.minimum_low_chars,
    )
    thresholds.validate()
    selected = select_manifest_items(
        manifest,
        sample_size=args.sample_size,
        seed=args.seed,
        audio_ids=args.audio_id,
        include_types=args.types or DEFAULT_TYPES,
    )
    if not selected:
        raise ValueError("selection contains no auditable manifest items with readingKana")
    model_sha256, model_files = _model_fingerprint(model_path)
    reading_converter = _discover_offline_reading_converter()
    run_fingerprint = _audit_run_fingerprint(
        manifest_sha256=manifest_sha256,
        model_sha256=model_sha256,
        audio_root=audio_root,
        selected=selected,
        thresholds=thresholds,
        args=args,
        reading_converter=reading_converter,
    )
    checkpoint_store = (
        CheckpointStore(
            checkpoint_path,
            run_fingerprint=run_fingerprint,
            resume=bool(getattr(args, "resume", False)),
        )
        if checkpoint_path is not None
        else None
    )
    transcriber: FasterWhisperTranscriber | None = None
    results: list[dict[str, Any]] = []
    checkpoint_reused = 0
    checkpoint_written = 0
    for index, item in enumerate(selected, start=1):
        audio_id = str(item["id"])
        if not args.quiet:
            print(f"[{index}/{len(selected)}] {audio_id}", file=sys.stderr, flush=True)
        try:
            prepared_audio = _prepare_audio_input(audio_root, item)
        except Exception as error:
            result = _infrastructure_failure_result(
                item,
                failure_kind="input",
                error=error,
            )
        else:
            cached = None
            if checkpoint_store is not None and getattr(args, "resume", False):
                cached = checkpoint_store.load_result(
                    audio_id,
                    actual_sha256=prepared_audio[1],
                )
            if cached is not None:
                result = dict(cached)
                result["checkpointReused"] = True
                checkpoint_reused += 1
            else:
                if prepared_audio[1] == str(item.get("sha256") or "") and transcriber is None:
                    transcriber = FasterWhisperTranscriber(
                        model_path,
                        cpu_threads=args.cpu_threads,
                        beam_size=args.beam_size,
                    )
                result = _audit_one_item(
                    item,
                    audio_root,
                    transcriber,
                    thresholds,
                    reading_converter=reading_converter,
                    prepared_audio=prepared_audio,
                )
        if checkpoint_store is not None and not result.get("checkpointReused"):
            checkpoint_store.save_result(result)
            checkpoint_written += 1
        results.append(result)
    summary = summarize_results(results)
    selection_mode = "explicit-audio-ids" if args.audio_id else "sample" if args.sample_size else "all"
    return {
        "schemaVersion": SCHEMA_VERSION,
        "tool": {
            "name": "japanese-subtext-offline-asr-intelligibility-audit",
            "version": TOOL_VERSION,
        },
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "policy": {
            "advisoryOnly": True,
            "automaticDeletionAllowed": False,
            "defaultExitFailsOnCandidates": False,
            "infrastructureFailuresExitNonzero": True,
            "strictCandidateRules": [
                "normalized ASR transcript has an explicit extra i/ii/い/いい suffix after an exact expected prefix",
                "offline-comparable normalized similarity is below the configured very-low threshold and the expected reading meets the minimum length",
            ],
            "note": "ASR spelling and recognition errors require human listening; no report field authorizes deleting or replacing audio automatically.",
        },
        "source": {
            "manifestPath": str(manifest_path),
            "manifestSha256": manifest_sha256,
            "contentVersion": manifest.get("contentVersion"),
            "audioRoot": str(audio_root),
        },
        "asrConfiguration": {
            "backend": "faster-whisper",
            "modelDirectoryName": model_path.name,
            "modelFingerprintSha256": model_sha256,
            "modelFiles": model_files,
            "device": "cpu",
            "computeType": "int8",
            "localFilesOnly": True,
            "language": "ja",
            "task": "transcribe",
            "beamSize": args.beam_size,
            "temperature": 0.0,
            "conditionOnPreviousText": False,
            "vadFilter": False,
            "readingConversion": {
                "available": reading_converter is not None,
                "backend": reading_converter.backend if reading_converter else None,
                "offlineOnly": True,
                "kanjiLowSimilarityCanBeStrict": reading_converter is not None,
            },
        },
        "selection": {
            "mode": selection_mode,
            "seed": args.seed,
            "requestedSampleSize": args.sample_size,
            "types": list(args.types or DEFAULT_TYPES),
            "count": len(selected),
            "audioIds": [str(item["id"]) for item in selected],
        },
        "thresholds": asdict(thresholds),
        "checkpoint": {
            "enabled": checkpoint_store is not None,
            "directory": str(checkpoint_path) if checkpoint_path is not None else None,
            "resume": bool(getattr(args, "resume", False)),
            "runFingerprint": run_fingerprint,
            "reusedCount": checkpoint_reused,
            "writtenCount": checkpoint_written,
            "layout": "atomic-per-item-json-v1" if checkpoint_store is not None else None,
        },
        "summary": summary,
        "verdict": _report_verdict(summary["totals"]),
        "items": results,
    }


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Run an advisory offline Japanese faster-whisper intelligibility audit."
    )
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--audio-root", type=Path)
    parser.add_argument(
        "--model",
        type=Path,
        required=True,
        help="Existing local faster-whisper-base snapshot directory; downloads are disabled.",
    )
    parser.add_argument("--output", type=Path, required=True, help="JSON report path, or '-' for stdout")
    selection = parser.add_mutually_exclusive_group(required=True)
    selection.add_argument("--all", action="store_true", help="Audit every auditable non-scene item")
    selection.add_argument("--sample-size", type=int, help="Deterministic voice/type-stratified sample")
    selection.add_argument("--audio-id", action="append", help="Audit one audioId; repeat for more IDs")
    parser.add_argument("--seed", default="japanese-subtext-asr-v1")
    parser.add_argument("--type", dest="types", action="append", choices=DEFAULT_TYPES)
    parser.add_argument("--review-similarity", type=float, default=0.60)
    parser.add_argument("--very-low-similarity", type=float, default=0.18)
    parser.add_argument("--minimum-low-chars", type=int, default=5)
    parser.add_argument("--beam-size", type=int, default=5)
    parser.add_argument("--cpu-threads", type=int, default=0)
    parser.add_argument(
        "--checkpoint-dir",
        type=Path,
        help="External checkpoint directory; stores one atomic JSON result per audioId.",
    )
    parser.add_argument(
        "--resume",
        action="store_true",
        help="Resume a matching --checkpoint-dir without rerunning completed unchanged items.",
    )
    parser.add_argument("--quiet", action="store_true")
    parser.add_argument(
        "--fail-on-strict-candidates",
        action="store_true",
        help="Return exit code 2 when strict manual-review candidates exist; never deletes audio.",
    )
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)
    if args.beam_size < 1:
        parser.error("--beam-size must be at least 1")
    if args.cpu_threads < 0:
        parser.error("--cpu-threads cannot be negative")
    if args.resume and args.checkpoint_dir is None:
        parser.error("--resume requires --checkpoint-dir")
    try:
        report = run_audit(args)
        _write_json(args.output, report)
    except (OSError, ValueError, RuntimeError, json.JSONDecodeError) as error:
        print(f"ASR audit failed: {error}", file=sys.stderr)
        return 1
    if report["summary"]["totals"].get("infraFailures", 0):
        return 1
    if args.fail_on_strict_candidates and report["summary"]["totals"]["strictCandidates"]:
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
