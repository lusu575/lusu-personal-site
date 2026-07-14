"""Batch generator for the Japanese Subtext Trainer audio library."""

from __future__ import annotations

import argparse
import array
import copy
import hashlib
import json
import math
import os
import re
import shutil
import subprocess
import sys
import time
import wave
from contextlib import contextmanager
from dataclasses import asdict, dataclass, replace
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Iterator, Mapping, Sequence

from aivis_adapter import (
    AivisAdapter,
    PreparedAivisQuery,
    RATE_ADJUSTMENT_POLICY,
    RATE_ADJUSTMENT_TARGET_MORA_RATE,
    restore_prepared_query_rate,
    retime_prepared_query,
    validate_kana_reading,
)


PIPELINE_VERSION = "aivisspeech-1.2.0-aivmx-v3"
CLARITY_SCHEMA_VERSION = 3
SOURCE_BOUNDARY_SCHEMA_VERSION = 1
SCRIPT_DIR = Path(__file__).resolve().parent
TOOL_ROOT = SCRIPT_DIR.parents[1]
DEFAULT_CONFIG = TOOL_ROOT / "config" / "tts.local.json"
DEFAULT_CONTENT_ROOT = TOOL_ROOT / "content"
DEFAULT_AUDIO_ROOT = TOOL_ROOT / "audio"
DEFAULT_PRONUNCIATIONS = TOOL_ROOT / "config" / "pronunciations.json"
MIN_CLEAR_MORA_RATE = 2.5
MAX_CLEAR_MORA_RATE = 7.2
TARGET_CLEAR_MORA_RATE = RATE_ADJUSTMENT_TARGET_MORA_RATE
MAX_CALIBRATED_MORA_RATE = 6.6
MAX_RATE_CALIBRATION_ATTEMPTS = 6
MIN_SHORT_CLEAR_MORA_RATE = 1.5
MIN_HESITATION_CLEAR_MORA_RATE = 1.2
MAX_SHORT_CLEAR_MORA_RATE = MAX_CLEAR_MORA_RATE
LONG_INTERNAL_SPEECH_PAUSE_MS = 250
TARGET_INTEGRATED_LUFS_TOLERANCE = 1.5
MAX_TRUE_PEAK_DBTP = -2.0
MAX_SAFE_LOUDNESS_BOOST_DB = 4.5
LIMITER_OUTPUT_DBFS = -2.2
MIN_LIMITER_OUTPUT_DBFS = -12.0
ENCODED_TRUE_PEAK_GUARD_DB = 0.2
LOUDNESS_POST_PROCESSING_PROFILE = "audited-loudness-gain-v3"
HAN_CHARACTER_CLASS = "\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff"


def rate_policy_evidence() -> dict[str, Any]:
    """Return the release-locked teaching-rate policy for every spoken item."""

    return {
        "policy": RATE_ADJUSTMENT_POLICY,
        "targetMoraPerSecond": TARGET_CLEAR_MORA_RATE,
        "maximumCalibratedMoraPerSecond": MAX_CALIBRATED_MORA_RATE,
        "maximumMoraPerSecond": MAX_CLEAR_MORA_RATE,
        "maximumCalibrationAttempts": MAX_RATE_CALIBRATION_ATTEMPTS,
    }


class AudioRootBusyError(RuntimeError):
    """Raised when another process owns the same audio-root writer lock."""


@dataclass(frozen=True)
class StageMediaSnapshot:
    """Same-volume backup used to roll one public stage directory back."""

    stage_directory: Path
    backup_directory: Path
    existed: bool


def _try_lock_file(handle: Any) -> None:
    handle.seek(0)
    if os.name == "nt":
        import msvcrt

        msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
        return
    import fcntl

    fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)


def _unlock_file(handle: Any) -> None:
    handle.seek(0)
    if os.name == "nt":
        import msvcrt

        msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
        return
    import fcntl

    fcntl.flock(handle.fileno(), fcntl.LOCK_UN)


@contextmanager
def audio_root_generation_lock(audio_root: str | Path) -> Iterator[Path]:
    """Hold a crash-safe OS lock for exactly one audio publication root.

    The metadata file intentionally remains after exit. Kernel file locks are
    released automatically on normal exit and crashes, so stale text can never
    block a future run and must never be deleted by a competing process.
    """

    root = Path(audio_root).resolve()
    lock_path = root / ".work" / "generator.lock"
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    handle = lock_path.open("a+b")
    if lock_path.stat().st_size == 0:
        handle.write(b"\0")
        handle.flush()
    try:
        _try_lock_file(handle)
    except OSError as error:
        handle.close()
        raise AudioRootBusyError(
            f"another process is already generating audio in {root}"
        ) from error
    try:
        owner = {
            "pid": os.getpid(),
            "startedAt": datetime.now(timezone.utc).isoformat(),
            "audioRoot": str(root),
        }
        handle.seek(0)
        handle.truncate()
        handle.write(_canonical_json(owner))
        handle.flush()
        os.fsync(handle.fileno())
        yield lock_path
    finally:
        _unlock_file(handle)
        handle.close()


@dataclass(frozen=True)
class AudioTask:
    audio_id: str
    kind: str
    stage_id: str
    level: int
    text: str
    surface: str
    voice_key: str
    relative_path: str
    line_id: str | None = None
    token_id: str | None = None
    question_id: str | None = None
    option_id: str | None = None


def apply_pronunciations(text: str, entries: Sequence[Mapping[str, Any]]) -> str:
    """Apply longest-first overrides without matching a suffix inside a kanji compound."""

    result = text
    normalized = sorted(
        (
            (str(entry.get("surface", "")), str(entry.get("tts", "")))
            for entry in entries
            if entry.get("surface") and entry.get("tts")
        ),
        key=lambda pair: len(pair[0]),
        reverse=True,
    )
    for surface, replacement in normalized:
        if re.match(f"^[{HAN_CHARACTER_CLASS}]", surface):
            pattern = re.compile(
                rf"(?<![{HAN_CHARACTER_CLASS}]){re.escape(surface)}"
            )
            result = pattern.sub(replacement, result)
        else:
            result = result.replace(surface, replacement)
    return result


def prepare_spoken_text(text: str, entries: Sequence[Mapping[str, Any]]) -> str:
    """Apply reviewed overrides and reject anything outside pure reviewed kana."""

    return validate_kana_reading(apply_pronunciations(text, entries))


def build_audio_tasks(stage: Mapping[str, Any]) -> list[AudioTask]:
    """Expand one locked stage into line, token and option audio tasks."""

    stage_id = str(stage["id"])
    level = int(stage["level"])
    if not re.fullmatch(r"L[1-5]-[0-9]{3}", stage_id):
        raise ValueError(f"invalid stage ID: {stage_id!r}")
    if stage_id[1] != str(level):
        raise ValueError(f"stage ID/level mismatch: {stage_id}")
    prefix = f"level-{level}/{stage_id}"
    cast_voices = {
        str(member["id"]): str(member["voiceKey"])
        for member in stage.get("cast", [])
    }
    tasks: list[AudioTask] = []

    for line in stage.get("lines", []):
        line_id = str(line["id"])
        if not re.fullmatch(r"line-[0-9]{3}", line_id):
            raise ValueError(f"invalid line ID: {line_id!r}")
        if str(line.get("audioId")) != f"{stage_id}-{line_id}":
            raise ValueError(f"invalid line audioId: {line.get('audioId')!r}")
        voice_key = cast_voices[str(line["speaker"])]
        reading = line.get("readingJa")
        if not isinstance(reading, str) or not reading.strip():
            raise ValueError(f"{stage_id}/{line_id} is missing its reviewed readingJa")
        surface = line.get("ttsTextJa")
        if not isinstance(surface, str) or not surface.strip():
            raise ValueError(f"{stage_id}/{line_id} is missing its surface ttsTextJa")
        tasks.append(
            AudioTask(
                audio_id=str(line["audioId"]),
                kind="line",
                stage_id=stage_id,
                level=level,
                text=reading,
                surface=surface,
                voice_key=voice_key,
                relative_path=f"{prefix}/lines/{line_id}.mp3",
                line_id=line_id,
            )
        )
        for token in line.get("tokens", []):
            token_id = str(token["id"])
            if not re.fullmatch(r"token-[0-9]{3}", token_id):
                raise ValueError(f"invalid token ID: {token_id!r}")
            if str(token.get("audioId")) != f"{stage_id}-{line_id}-{token_id}":
                raise ValueError(f"invalid token audioId: {token.get('audioId')!r}")
            reading = token.get("reading")
            if not isinstance(reading, str) or not reading.strip():
                raise ValueError(f"{stage_id}/{line_id}/{token_id} is missing its reviewed reading")
            surface = token.get("text")
            if not isinstance(surface, str) or not surface.strip():
                raise ValueError(f"{stage_id}/{line_id}/{token_id} is missing its surface text")
            tasks.append(
                AudioTask(
                    audio_id=str(token["audioId"]),
                    kind="token",
                    stage_id=stage_id,
                    level=level,
                    text=reading,
                    surface=surface,
                    voice_key=voice_key,
                    relative_path=f"{prefix}/tokens/{line_id}-{token_id}.mp3",
                    line_id=line_id,
                    token_id=token_id,
                )
            )

    option_voice = str(stage["audio"]["optionVoiceKey"])
    for question in stage.get("questions", []):
        question_id = str(question["id"])
        if not re.fullmatch(r"q[1-5]", question_id):
            raise ValueError(f"invalid question ID: {question_id!r}")
        for option in question.get("options", []):
            option_id = str(option["id"])
            if not re.fullmatch(r"[a-f]", option_id):
                raise ValueError(f"invalid option ID: {option_id!r}")
            if str(option.get("audioId")) != f"{stage_id}-{question_id}-{option_id}":
                raise ValueError(f"invalid option audioId: {option.get('audioId')!r}")
            reading = option.get("readingJa")
            if not isinstance(reading, str) or not reading.strip():
                raise ValueError(f"{stage_id}/{question_id}/{option_id} is missing its reviewed readingJa")
            surface = option.get("ttsTextJa")
            if not isinstance(surface, str) or not surface.strip():
                raise ValueError(f"{stage_id}/{question_id}/{option_id} is missing its surface ttsTextJa")
            tasks.append(
                AudioTask(
                    audio_id=str(option["audioId"]),
                    kind="option",
                    stage_id=stage_id,
                    level=level,
                    text=reading,
                    surface=surface,
                    voice_key=option_voice,
                    relative_path=f"{prefix}/options/{question_id}-{option_id}.mp3",
                    question_id=question_id,
                    option_id=option_id,
                )
            )
    return tasks


def _canonical_json(value: object) -> bytes:
    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")


def task_hash(
    task: AudioTask,
    *,
    phonemes: str,
    voice_settings: Mapping[str, Any],
    model_fingerprint: str,
    pipeline_fingerprint: str = PIPELINE_VERSION,
) -> str:
    """Hash every input that can affect a single audio artifact."""

    payload = {
        "task": asdict(task),
        "phonemes": phonemes,
        "voice": dict(voice_settings),
        "model": model_fingerprint,
        "pipeline": pipeline_fingerprint,
    }
    return hashlib.sha256(_canonical_json(payload)).hexdigest()


def task_artifact_identity(
    task: AudioTask,
    prepared: PreparedAivisQuery,
    *,
    resolved_voice_key: str,
    output_settings: Mapping[str, Any],
    model_fingerprint: str,
    post_processing: Mapping[str, Any] | None = None,
) -> dict[str, str]:
    """Return the query and artifact hashes for one exact prepared query."""

    phonemes = "\n".join(prepared.mora_phonemes)
    query_sha256 = hashlib.sha256(_canonical_json(prepared.query)).hexdigest()
    identity_settings: dict[str, Any] = {
        "voiceKey": resolved_voice_key,
        "engineVersion": "1.2.0",
        "modelUuid": prepared.model_uuid,
        "modelVersion": prepared.model_version,
        "modelSha256": prepared.model_sha256,
        "styleName": prepared.style_name,
        "styleId": prepared.style_id,
        "queryParameters": prepared.query_parameters,
        "querySha256": query_sha256,
        "ratePolicy": rate_policy_evidence(),
        "output": dict(output_settings),
    }
    if post_processing:
        identity_settings["postProcessing"] = dict(post_processing)
    artifact_hash = task_hash(
        task,
        phonemes=phonemes,
        voice_settings=identity_settings,
        model_fingerprint=model_fingerprint,
    )
    return {
        "artifactHash": artifact_hash,
        "querySha256": query_sha256,
        "phonemeSha256": hashlib.sha256(phonemes.encode("utf-8")).hexdigest(),
    }


class RateCalibrationError(RuntimeError):
    """Raised when an adjusted query still exceeds the teaching rate limit."""


def _observed_rate(clarity: Mapping[str, Any], mora_count: int) -> float:
    if clarity.get("spokenMoraCount") != mora_count:
        raise ValueError("mora-rate audit count does not match the prepared Aivis query")
    rate = clarity.get("speechRateMoraPerSecond")
    if not isinstance(rate, (int, float)) or not math.isfinite(float(rate)) or rate <= 0:
        raise ValueError("mora-rate audit is missing a finite positive rate")
    return float(rate)


def resolve_rate_limited_task(
    task: AudioTask,
    prepared: PreparedAivisQuery,
    *,
    resolved_voice_key: str,
    output_settings: Mapping[str, Any],
    model_fingerprint: str,
    existing_item: Mapping[str, Any] | None,
    item_is_current: Any,
    audit_current: Any,
    calibrate: Any,
    existing_post_processing: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    """Select or calibrate the exact per-item query needed for <= 7.2 mora/s.

    Existing clear media is audited and retained with its original identity.
    Fast media changes ``speedScale`` before synthesis, and the resulting query
    is calibrated once before it can become a publishable artifact.
    """

    mora_count = count_spoken_moras(prepared.mora_phonemes)
    base_identity = task_artifact_identity(
        task,
        prepared,
        resolved_voice_key=resolved_voice_key,
        output_settings=output_settings,
        model_fingerprint=model_fingerprint,
    )

    recorded_adjustment = (
        existing_item.get("rateAdjustment")
        if isinstance(existing_item, Mapping)
        else None
    )
    if isinstance(recorded_adjustment, Mapping) and (
        recorded_adjustment.get("baseArtifactHash") != base_identity["artifactHash"]
        or recorded_adjustment.get("baseQuerySha256") != base_identity["querySha256"]
        or recorded_adjustment.get("policy") != RATE_ADJUSTMENT_POLICY
        or recorded_adjustment.get("targetMoraPerSecond") != TARGET_CLEAR_MORA_RATE
        or recorded_adjustment.get("maximumMoraPerSecond") != MAX_CLEAR_MORA_RATE
    ):
        recorded_adjustment = None

    candidate = (
        restore_prepared_query_rate(prepared, recorded_adjustment)
        if recorded_adjustment is not None
        else prepared
    )
    candidate_identity = task_artifact_identity(
        task,
        candidate,
        resolved_voice_key=resolved_voice_key,
        output_settings=output_settings,
        model_fingerprint=model_fingerprint,
    )
    published_candidate_identity = task_artifact_identity(
        task,
        candidate,
        resolved_voice_key=resolved_voice_key,
        output_settings=output_settings,
        model_fingerprint=model_fingerprint,
        post_processing=existing_post_processing,
    )
    if item_is_current(published_candidate_identity["artifactHash"]):
        fresh_clarity: Mapping[str, Any] | None = audit_current(candidate)
        observed_rate = _observed_rate(fresh_clarity, mora_count)
    else:
        fresh_clarity = None
        observed_rate = float(calibrate(candidate, candidate_identity))
    if fresh_clarity is not None:
        acceptance_limit = (
            MAX_CLEAR_MORA_RATE
            if candidate.rate_adjustment is not None
            else TARGET_CLEAR_MORA_RATE
        )
    else:
        acceptance_limit = (
            MAX_CALIBRATED_MORA_RATE
            if candidate.rate_adjustment is not None
            else TARGET_CLEAR_MORA_RATE
        )
    if observed_rate <= acceptance_limit:
        return {
            "prepared": candidate,
            "identity": (
                published_candidate_identity
                if fresh_clarity is not None
                else candidate_identity
            ),
            "freshClarity": fresh_clarity,
        }

    adjusted = retime_prepared_query(candidate, observed_rate)
    for _calibration_attempt in range(MAX_RATE_CALIBRATION_ATTEMPTS):
        adjusted = replace(
            adjusted,
            rate_adjustment={
                **dict(adjusted.rate_adjustment or {}),
                "baseArtifactHash": base_identity["artifactHash"],
                "baseQuerySha256": base_identity["querySha256"],
            },
        )
        adjusted_identity = task_artifact_identity(
            task,
            adjusted,
            resolved_voice_key=resolved_voice_key,
            output_settings=output_settings,
            model_fingerprint=model_fingerprint,
        )
        published_adjusted_identity = task_artifact_identity(
            task,
            adjusted,
            resolved_voice_key=resolved_voice_key,
            output_settings=output_settings,
            model_fingerprint=model_fingerprint,
            post_processing=existing_post_processing,
        )
        if item_is_current(published_adjusted_identity["artifactHash"]):
            adjusted_clarity: Mapping[str, Any] | None = audit_current(adjusted)
            adjusted_rate = _observed_rate(adjusted_clarity, mora_count)
        else:
            adjusted_clarity = None
            adjusted_rate = float(calibrate(adjusted, adjusted_identity))
        if adjusted_rate <= MAX_CALIBRATED_MORA_RATE:
            return {
                "prepared": adjusted,
                "identity": (
                    published_adjusted_identity
                    if adjusted_clarity is not None
                    else adjusted_identity
                ),
                "freshClarity": adjusted_clarity,
            }
        adjusted = retime_prepared_query(adjusted, adjusted_rate)

    raise RateCalibrationError(
        f"adjusted query still renders at {adjusted_rate:.6f} mora/s after "
        f"{MAX_RATE_CALIBRATION_ATTEMPTS} calibrations"
    )


def count_tasks(tasks: Iterable[AudioTask]) -> dict[str, int]:
    counts = {"line": 0, "option": 0, "token": 0}
    for task in tasks:
        counts[task.kind] = counts.get(task.kind, 0) + 1
    return counts


def count_spoken_moras(phonemes: Sequence[str]) -> int:
    """Count articulated moras, excluding punctuation-derived pause moras."""

    return sum(phoneme not in {"pau", "sil"} for phoneme in phonemes)


def is_nonlexical_hesitation(reading_kana: str | None, mora_count: int) -> bool:
    """Recognize the one-mora filled pause that naturally sustains longer than a word."""

    return (
        mora_count == 1
        and isinstance(reading_kana, str)
        and re.fullmatch(r"ん[、。…！？!?・〜～ー\s]*", reading_kana.strip()) is not None
    )


def apply_speech_rate_audit(
    clarity: dict[str, Any],
    mora_count: int,
    *,
    reading_kana: str | None = None,
) -> dict[str, Any]:
    """Attach a mora-rate gate based on articulated time, not punctuation pauses."""

    if not isinstance(mora_count, int) or mora_count <= 0:
        raise ValueError("spoken mora count must be a positive integer")
    rate_duration = clarity.get("speechRateDurationSeconds")
    if not isinstance(rate_duration, (int, float)) or rate_duration <= 0:
        raise ValueError("clarity audit must include a positive speech-rate duration")
    hesitation = is_nonlexical_hesitation(reading_kana, mora_count)
    short = mora_count <= 5
    if hesitation:
        band = "hesitation"
        minimum = MIN_HESITATION_CLEAR_MORA_RATE
        maximum = MAX_SHORT_CLEAR_MORA_RATE
    elif short:
        band = "short"
        minimum = MIN_SHORT_CLEAR_MORA_RATE
        maximum = MAX_SHORT_CLEAR_MORA_RATE
    else:
        band = "standard"
        minimum = MIN_CLEAR_MORA_RATE
        maximum = MAX_CLEAR_MORA_RATE
    speech_rate = mora_count / float(rate_duration)
    passed = minimum <= speech_rate <= maximum
    clarity.update(
        {
            "speechRateMoraPerSecond": round(speech_rate, 6),
            "spokenMoraCount": mora_count,
            "speechRateBand": band,
            "speechRateMinimum": minimum,
            "speechRateMaximum": maximum,
            "speechRatePass": passed,
            "pass": clarity.get("pass") is True and passed,
        }
    )
    return clarity


def _stage_sort_key(stage: Mapping[str, Any]) -> tuple[int, int]:
    return int(stage["level"]), int(stage["stage"])


def select_stages(
    stages: Sequence[Mapping[str, Any]],
    *,
    stage_ids: Sequence[str] = (),
    levels: Sequence[int] = (),
    batch_ranges: Sequence[str] = (),
    all_stages: bool = False,
) -> list[Mapping[str, Any]]:
    """Select stages for the CLI using stable IDs or inclusive ranges."""

    requested_ids = {
        value.strip()
        for group in stage_ids
        for value in str(group).split(",")
        if value.strip()
    }
    requested_levels = {int(level) for level in levels}
    numeric_ranges: list[tuple[int, int]] = []
    id_ranges: list[tuple[str, str]] = []
    for value in batch_ranges:
        match = re.fullmatch(r"\s*([^:]+)\s*:\s*([^:]+)\s*", value)
        if not match:
            raise ValueError(f"invalid batch range: {value!r}")
        start, end = match.groups()
        if start.isdigit() and end.isdigit():
            bounds = int(start), int(end)
            numeric_ranges.append((min(bounds), max(bounds)))
        elif re.fullmatch(r"L[1-5]-[0-9]{3}", start) and re.fullmatch(
            r"L[1-5]-[0-9]{3}", end
        ):
            id_ranges.append((min(start, end), max(start, end)))
        else:
            raise ValueError(f"invalid batch range: {value!r}")

    has_narrow_selector = bool(requested_ids or numeric_ranges or id_ranges)
    selected: list[Mapping[str, Any]] = []
    for stage in sorted(stages, key=_stage_sort_key):
        stage_id = str(stage["id"])
        level = int(stage["level"])
        number = int(stage["stage"])
        if requested_levels and level not in requested_levels:
            continue
        matches_narrow = (
            stage_id in requested_ids
            or any(start <= number <= end for start, end in numeric_ranges)
            or any(start <= stage_id <= end for start, end in id_ranges)
        )
        if has_narrow_selector and not matches_narrow:
            continue
        if all_stages or requested_levels or has_narrow_selector:
            selected.append(stage)
    return selected


def manifest_item_is_current(
    item: Mapping[str, Any] | None,
    expected_hash: str,
    audio_root: str | Path,
) -> bool:
    """Return whether a manifest item can be safely reused from disk."""

    if (
        not item
        or item.get("contentHash") != expected_hash
        or item.get("claritySchemaVersion") != CLARITY_SCHEMA_VERSION
    ):
        return False
    relative = item.get("path")
    if not isinstance(relative, str) or not relative or "\\" in relative:
        return False
    if relative.startswith("/") or re.match(r"^[A-Za-z]:", relative):
        return False
    root = Path(audio_root).resolve()
    artifact = (root / relative).resolve()
    if not artifact.is_relative_to(root):
        return False
    try:
        expected_file_hash = item.get("sha256")
        return (
            artifact.is_file()
            and artifact.stat().st_size > 0
            and isinstance(expected_file_hash, str)
            and re.fullmatch(r"[a-f0-9]{64}", expected_file_hash) is not None
            and file_sha256(artifact) == expected_file_hash
        )
    except OSError:
        return False


def _seconds(frame_count: int, sample_rate: int) -> float:
    return round(frame_count / sample_rate, 6)


def assemble_scene_wav(
    stage: Mapping[str, Any],
    line_wavs: Mapping[str, str | Path],
    output_path: str | Path,
    *,
    sample_rate: int,
    leading_silence_ms: int,
    trailing_silence_ms: int,
    default_gap_ms: int,
) -> dict[str, Any]:
    """Concatenate normalized line WAVs and return an exact cue timeline."""

    destination = Path(output_path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    silence_frame = b"\0\0"
    leading_frames = round(sample_rate * leading_silence_ms / 1000)
    trailing_frames = round(sample_rate * trailing_silence_ms / 1000)
    cursor = leading_frames
    cues: list[dict[str, Any]] = []

    with wave.open(str(destination), "wb") as scene:
        scene.setnchannels(1)
        scene.setsampwidth(2)
        scene.setframerate(sample_rate)
        scene.writeframes(silence_frame * leading_frames)

        lines = list(stage.get("lines", []))
        for index, line in enumerate(lines):
            audio_id = str(line["audioId"])
            source_path = Path(line_wavs[audio_id])
            with wave.open(str(source_path), "rb") as source:
                if source.getnchannels() != 1:
                    raise ValueError(f"line WAV must be mono: {source_path}")
                if source.getsampwidth() != 2:
                    raise ValueError(f"line WAV must be 16-bit PCM: {source_path}")
                if source.getframerate() != sample_rate:
                    raise ValueError(
                        f"line WAV sample rate mismatch ({source.getframerate()} != {sample_rate}): "
                        f"{source_path}"
                    )
                frame_count = source.getnframes()
                frames = source.readframes(frame_count)

            start = cursor
            scene.writeframes(frames)
            cursor += frame_count
            cues.append(
                {
                    "lineId": str(line["id"]),
                    "audioId": audio_id,
                    "start": _seconds(start, sample_rate),
                    "end": _seconds(cursor, sample_rate),
                }
            )

            if index < len(lines) - 1:
                gap_ms = int(line.get("pauseAfterMs", default_gap_ms))
                if gap_ms < 0:
                    raise ValueError(f"pauseAfterMs must not be negative: {audio_id}")
                gap_frames = round(sample_rate * gap_ms / 1000)
                scene.writeframes(silence_frame * gap_frames)
                cursor += gap_frames

        scene.writeframes(silence_frame * trailing_frames)
        cursor += trailing_frames

    return {
        "stageId": str(stage["id"]),
        "sampleRate": sample_rate,
        "duration": _seconds(cursor, sample_rate),
        "cues": cues,
    }


def read_json(path: str | Path) -> Any:
    with Path(path).open("r", encoding="utf-8-sig") as handle:
        return json.load(handle)


def write_json_atomic(path: str | Path, payload: Any) -> None:
    destination = Path(path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_name(
        f".{destination.name}.{os.getpid()}.{time.time_ns()}.tmp"
    )
    try:
        with temporary.open("w", encoding="utf-8", newline="\n") as handle:
            json.dump(payload, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        # Windows Defender/indexers can briefly hold the destination between
        # close and ReplaceFile. Bounded retry preserves a long synthesis run.
        _replace_file_atomic(temporary, destination)
    finally:
        temporary.unlink(missing_ok=True)


def file_sha256(path: str | Path) -> str:
    digest = hashlib.sha256()
    with Path(path).open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def discover_stages(content_root: str | Path) -> list[Mapping[str, Any]]:
    """Load the canonical ``level-N/batch-XXX-YYY.json`` stage batches."""

    stages: list[Mapping[str, Any]] = []
    root = Path(content_root)
    for level in range(1, 6):
        directory = root / f"level-{level}"
        if not directory.is_dir():
            continue
        for path in sorted(directory.glob("batch-[0-9][0-9][0-9]-[0-9][0-9][0-9].json")):
            payload = read_json(path)
            batch_stages = payload.get("stages") if isinstance(payload, Mapping) else None
            if not isinstance(batch_stages, list):
                raise ValueError(f"batch has no stages array: {path}")
            for stage in batch_stages:
                if not isinstance(stage, Mapping):
                    raise ValueError(f"batch contains a non-object stage: {path}")
                stages.append(stage)
    duplicate_ids = {
        stage_id
        for stage_id in (str(stage.get("id", "")) for stage in stages)
        if sum(str(item.get("id", "")) == stage_id for item in stages) > 1
    }
    if duplicate_ids:
        raise ValueError(f"duplicate stage IDs: {', '.join(sorted(duplicate_ids))}")
    return sorted(stages, key=_stage_sort_key)


def _resolve_path(value: str, base: Path) -> Path:
    candidate = Path(value).expanduser()
    return candidate if candidate.is_absolute() else (base / candidate).resolve()


def load_local_config(path: str | Path) -> tuple[dict[str, Any], Path]:
    config_path = Path(path).resolve()
    if not config_path.is_file():
        raise FileNotFoundError(
            f"local TTS config not found: {config_path}\n"
            "Copy config/tts.local.example.json to config/tts.local.json and set local paths."
        )
    config = read_json(config_path)
    if not isinstance(config, dict):
        raise ValueError("local TTS config must be a JSON object")
    if config.get("adapter") != "aivisspeech-engine":
        raise ValueError("this generator requires adapter='aivisspeech-engine'")
    for key in ("ffmpeg", "ffprobe", "aivis", "output", "voices"):
        if key not in config:
            raise ValueError(f"local TTS config is missing {key!r}")
    validate_runtime_config(config)
    return config, config_path


def validate_runtime_config(config: Mapping[str, Any]) -> None:
    if config.get("adapter") != "aivisspeech-engine":
        raise ValueError("adapter must be 'aivisspeech-engine'")
    aivis = config.get("aivis", {})
    output = config.get("output", {})
    voices = config.get("voices", {})
    if not isinstance(aivis, Mapping):
        raise ValueError("aivis must be an object")
    if aivis.get("engineVersion") != "1.2.0":
        raise ValueError("aivis.engineVersion must be '1.2.0'")
    if aivis.get("provider") != "CPU":
        raise ValueError("aivis.provider must be 'CPU'")
    base_url = str(aivis.get("baseUrl", ""))
    if base_url not in {"http://127.0.0.1:10103", "http://localhost:10103"}:
        raise ValueError("aivis.baseUrl must be the local AivisSpeech Engine on port 10103")
    models = aivis.get("models")
    if not isinstance(models, list) or len(models) != 4:
        raise ValueError("aivis.models must contain exactly four models")
    model_uuids: set[str] = set()
    for model in models:
        if not isinstance(model, Mapping):
            raise ValueError("every AIVM model must be an object")
        uuid = str(model.get("uuid", "")).lower()
        if not re.fullmatch(r"[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}", uuid):
            raise ValueError(f"AIVM model UUID is invalid: {uuid!r}")
        model_uuids.add(uuid)
        if not isinstance(model.get("version"), str) or not model["version"]:
            raise ValueError(f"AIVM model version is missing: {uuid}")
        if not re.fullmatch(r"[0-9a-f]{64}", str(model.get("sha256", "")).lower()):
            raise ValueError(f"AIVM model SHA-256 is invalid: {uuid}")
        if model.get("license") != "ACML-1.0":
            raise ValueError(f"AIVM model license must be ACML-1.0: {uuid}")
    if len(model_uuids) != 4:
        raise ValueError("aivis.models must contain exactly four unique UUIDs")
    expected_output = {
        "format": "mp3",
        "sampleRate": 44_100,
        "channels": 1,
        "bitrate": "96k",
    }
    for key, expected in expected_output.items():
        if output.get(key) != expected:
            raise ValueError(f"output.{key} must be {expected!r}")
    numeric_bounds = {
        "targetLufs": (-30, -10, -18),
        "leadingSilenceMs": (0, 500, 60),
        "trailingSilenceMs": (0, 500, 100),
        "sceneGapMs": (0, 3000, 180),
    }
    for key, (minimum, maximum, default) in numeric_bounds.items():
        value = output.get(key, default)
        if not isinstance(value, (int, float)) or not minimum <= value <= maximum:
            raise ValueError(f"output.{key} must be between {minimum} and {maximum}")
    if not isinstance(voices, Mapping) or not voices:
        raise ValueError("voices must contain at least one Aivis voice")
    query_bounds = {
        "speedScale": (0.5, 2.0, 1.0),
        "pitchScale": (-0.15, 0.15, 0.0),
        "intonationScale": (0.0, 2.0, 1.0),
        "volumeScale": (0.0, 2.0, 1.0),
        "prePhonemeLength": (0.0, 1.5, 0.1),
        "postPhonemeLength": (0.0, 1.5, 0.1),
        "pauseLengthScale": (0.0, 2.0, 1.0),
    }
    for key, settings in voices.items():
        if not isinstance(settings, Mapping):
            raise ValueError(f"Aivis voice settings must be an object: {key}")
        if str(settings.get("modelUuid", "")).lower() not in model_uuids:
            raise ValueError(f"Aivis voice references an unconfigured model: {key}")
        if not isinstance(settings.get("styleName"), str) or not settings["styleName"]:
            raise ValueError(f"Aivis voice styleName is missing: {key}")
        for field, (minimum, maximum, default) in query_bounds.items():
            value = settings.get(field, default)
            if not isinstance(value, (int, float)) or not minimum <= float(value) <= maximum:
                raise ValueError(f"voice {key}.{field} must be between {minimum} and {maximum}")
        pause_length = settings.get("pauseLength")
        if pause_length is not None and (
            not isinstance(pause_length, (int, float)) or not 0 <= float(pause_length) <= 2
        ):
            raise ValueError(f"voice {key}.pauseLength must be null or between 0 and 2")
    aliases = config.get("voiceAliases", {})
    if not isinstance(aliases, Mapping) or any(
        target not in voices for target in aliases.values()
    ):
        raise ValueError("every voice alias must target a configured Aivis voice key")


def verify_model_files(
    adapter: AivisAdapter,
) -> tuple[dict[str, Any], str]:
    """Verify the live engine, all four AIVM files and their ACML provenance."""

    provenance = adapter.verify_provenance()
    fingerprint = hashlib.sha256(_canonical_json(provenance)).hexdigest()
    return provenance, fingerprint


def resolve_voice(
    config: Mapping[str, Any],
    requested_key: str,
) -> tuple[str, dict[str, Any]]:
    aliases = config.get("voiceAliases", {})
    voices = config.get("voices", {})
    key = requested_key
    seen: set[str] = set()
    while key not in voices:
        if key in seen:
            raise ValueError(f"voice alias cycle at {requested_key!r}")
        seen.add(key)
        target = aliases.get(key) if isinstance(aliases, Mapping) else None
        if not isinstance(target, str):
            raise ValueError(f"voice key is not configured: {requested_key}")
        key = target
    settings = voices[key]
    if not isinstance(settings, Mapping):
        raise ValueError(f"voice settings must be an object: {key}")
    return key, dict(settings)


def run_command(command: Sequence[str | Path], *, label: str) -> subprocess.CompletedProcess[str]:
    process = subprocess.run(
        [str(part) for part in command],
        check=False,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if process.returncode:
        detail = (process.stderr or process.stdout or "").strip()[-3000:]
        raise RuntimeError(f"{label} failed with exit code {process.returncode}:\n{detail}")
    return process


def _valid_pcm_wav(path: str | Path, sample_rate: int) -> bool:
    try:
        with wave.open(str(path), "rb") as source:
            return (
                source.getnchannels() == 1
                and source.getsampwidth() == 2
                and source.getframerate() == sample_rate
                and source.getnframes() > 0
            )
    except (OSError, EOFError, wave.Error):
        return False


def _normalization_filter(target_lufs: float) -> str:
    """Trim only the outer silence; keep meaningful pauses inside a sentence."""

    return (
        "silenceremove=start_periods=1:start_silence=0.02:start_threshold=-50dB,"
        "areverse,"
        "silenceremove=start_periods=1:start_silence=0.04:start_threshold=-50dB,"
        "areverse,"
        f"loudnorm=I={target_lufs}:TP=-2:LRA=11"
    )


def normalize_wav(
    source: str | Path,
    destination: str | Path,
    *,
    ffmpeg: str | Path,
    sample_rate: int,
    target_lufs: float,
) -> None:
    output = Path(destination)
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_suffix(".part.wav")
    audio_filter = _normalization_filter(target_lufs)
    run_command(
        [
            ffmpeg,
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-i",
            source,
            "-af",
            audio_filter,
            "-ar",
            str(sample_rate),
            "-ac",
            "1",
            "-c:a",
            "pcm_s16le",
            temporary,
        ],
        label="WAV normalization",
    )
    if not _valid_pcm_wav(temporary, sample_rate):
        raise RuntimeError(f"normalized WAV is invalid: {temporary}")
    os.replace(temporary, output)


def render_padded_wav(
    source: str | Path,
    destination: str | Path,
    *,
    ffmpeg: str | Path,
    sample_rate: int,
    leading_silence_ms: int,
    trailing_silence_ms: int,
) -> None:
    output = Path(destination)
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_suffix(".part.wav")
    audio_filter = (
        f"adelay={leading_silence_ms}:all=1,"
        f"apad=pad_dur={trailing_silence_ms / 1000:.6f}"
    )
    run_command(
        [
            ffmpeg,
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-i",
            source,
            "-af",
            audio_filter,
            "-ar",
            str(sample_rate),
            "-ac",
            "1",
            "-c:a",
            "pcm_s16le",
            temporary,
        ],
        label="WAV padding",
    )
    if not _valid_pcm_wav(temporary, sample_rate):
        raise RuntimeError(f"padded WAV is invalid: {temporary}")
    os.replace(temporary, output)


def plan_loudness_correction(
    loudness: Mapping[str, Any],
    *,
    target_lufs: float,
    tolerance_lufs: float = TARGET_INTEGRATED_LUFS_TOLERANCE,
    maximum_boost_db: float = MAX_SAFE_LOUDNESS_BOOST_DB,
) -> dict[str, Any]:
    """Plan deterministic gain correction while protecting true-peak headroom."""

    integrated = loudness.get("integratedLufs")
    true_peak = loudness.get("truePeakDbtp")
    if not isinstance(integrated, (int, float)) or not math.isfinite(float(integrated)):
        raise ValueError("loudness correction requires finite integrated LUFS")
    if not isinstance(true_peak, (int, float)) or not math.isfinite(float(true_peak)):
        raise ValueError("loudness correction requires finite true peak")
    gain = float(target_lufs) - float(integrated)
    if abs(gain) <= float(tolerance_lufs):
        return {
            "gainDb": 0.0,
            "limiterRequired": float(true_peak) > MAX_TRUE_PEAK_DBTP,
        }
    if gain > float(maximum_boost_db):
        raise RuntimeError(
            f"unsafe loudness boost required: {gain:.3f} dB exceeds {maximum_boost_db:.3f} dB"
        )
    gain = round(gain, 3)
    return {
        "gainDb": gain,
        "limiterRequired": float(true_peak) + gain > MAX_TRUE_PEAK_DBTP,
    }


def encode_mp3(
    source: str | Path,
    destination: str | Path,
    *,
    ffmpeg: str | Path,
    sample_rate: int,
    bitrate: str,
    leading_silence_ms: int = 0,
    trailing_silence_ms: int = 0,
    adaptive_loudness: bool = False,
    target_lufs: float = -18.0,
) -> dict[str, Any]:
    output = Path(destination)
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_suffix(".part.mp3")

    def render(target: Path, extra_filters: Sequence[str] = ()) -> None:
        command: list[str | Path] = [
            ffmpeg,
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-i",
            source,
        ]
        filters: list[str] = []
        if leading_silence_ms or trailing_silence_ms:
            filters.extend(
                [
                    f"adelay={leading_silence_ms}:all=1",
                    f"apad=pad_dur={trailing_silence_ms / 1000:.6f}",
                ]
            )
        filters.extend(extra_filters)
        if filters:
            command.extend(["-af", ",".join(filters)])
        command.extend([
            "-map_metadata",
            "-1",
            "-ar",
            str(sample_rate),
            "-ac",
            "1",
            "-c:a",
            "libmp3lame",
            "-b:a",
            bitrate,
            target,
        ])
        run_command(command, label="MP3 encoding")

    render(temporary)
    if not temporary.is_file() or temporary.stat().st_size <= 0:
        raise RuntimeError(f"MP3 encoder produced no output: {temporary}")
    os.replace(temporary, output)
    no_correction = {"gainDb": 0.0, "limiterRequired": False}
    if not adaptive_loudness:
        return no_correction

    initial_loudness = measure_integrated_loudness(
        output,
        ffmpeg,
        target_lufs=target_lufs,
    )
    correction = plan_loudness_correction(
        initial_loudness,
        target_lufs=target_lufs,
    )
    if correction["gainDb"] == 0 and not correction["limiterRequired"]:
        return correction

    adjusted = output.with_suffix(".adjusted.part.mp3")
    try:
        gain_db = float(correction["gainDb"])
        limiter_output_dbfs = LIMITER_OUTPUT_DBFS
        for adjustment_attempt in range(3):
            limiter_required = (
                float(initial_loudness["truePeakDbtp"]) + gain_db
                > MAX_TRUE_PEAK_DBTP
                or limiter_output_dbfs < LIMITER_OUTPUT_DBFS
            )
            correction = {
                "gainDb": round(gain_db, 3),
                "limiterRequired": limiter_required,
            }
            filters: list[str] = []
            if correction["gainDb"] != 0:
                filters.append(f"volume={correction['gainDb']:.3f}dB")
            if limiter_required:
                # Keep a small encoded-media guard below -2 dBTP and verify the
                # decoded MP3. If codec overshoot still crosses the hard limit,
                # lower the limiter ceiling by the measured excess and retry.
                limiter_linear_limit = round(10 ** (limiter_output_dbfs / 20), 6)
                filters.append(
                    f"alimiter=limit={limiter_linear_limit:.6f}:level=false"
                )
            render(adjusted, filters)
            if not adjusted.is_file() or adjusted.stat().st_size <= 0:
                raise RuntimeError(f"adaptive MP3 encoder produced no output: {adjusted}")
            final_loudness = measure_integrated_loudness(
                adjusted,
                ffmpeg,
                target_lufs=target_lufs,
            )
            if final_loudness["truePeakDbtp"] > MAX_TRUE_PEAK_DBTP:
                if adjustment_attempt >= 2:
                    raise RuntimeError(
                        f"adaptive loudness correction exceeded true peak for {destination}: "
                        f"{final_loudness['truePeakDbtp']:.3f} dBTP > "
                        f"{MAX_TRUE_PEAK_DBTP:.3f} dBTP"
                    )
                overshoot_db = (
                    float(final_loudness["truePeakDbtp"]) - MAX_TRUE_PEAK_DBTP
                )
                requested_ceiling = round(
                    limiter_output_dbfs - overshoot_db - ENCODED_TRUE_PEAK_GUARD_DB,
                    3,
                )
                limiter_output_dbfs = max(MIN_LIMITER_OUTPUT_DBFS, requested_ceiling)
                adjusted.unlink(missing_ok=True)
                continue
            loudness_error = final_loudness["integratedLufs"] - float(target_lufs)
            if abs(loudness_error) <= TARGET_INTEGRATED_LUFS_TOLERANCE:
                _replace_file_atomic(adjusted, output)
                return correction
            requested_gain = round(gain_db - loudness_error, 3)
            if requested_gain > MAX_SAFE_LOUDNESS_BOOST_DB:
                requested_gain = MAX_SAFE_LOUDNESS_BOOST_DB
            if requested_gain == gain_db:
                break
            gain_db = requested_gain
            adjusted.unlink(missing_ok=True)
        raise RuntimeError(
            f"adaptive loudness correction missed target for {destination}: {final_loudness}"
        )
    finally:
        adjusted.unlink(missing_ok=True)


def probe_audio(path: str | Path, ffprobe: str | Path) -> dict[str, Any]:
    process = run_command(
        [
            ffprobe,
            "-v",
            "error",
            "-select_streams",
            "a:0",
            "-show_entries",
            "stream=codec_name,sample_rate,channels,bit_rate:format=duration,size,bit_rate",
            "-of",
            "json",
            path,
        ],
        label="audio probe",
    )
    payload = json.loads(process.stdout)
    streams = payload.get("streams") or []
    if not streams:
        raise RuntimeError(f"audio file has no audio stream: {path}")
    stream = streams[0]
    file_format = payload.get("format") or {}
    return {
        "codec": stream.get("codec_name"),
        "sampleRate": int(stream.get("sample_rate") or 0),
        "channels": int(stream.get("channels") or 0),
        "bitrate": int(stream.get("bit_rate") or file_format.get("bit_rate") or 0),
        "durationSeconds": round(float(file_format.get("duration") or 0), 6),
        "bytes": int(file_format.get("size") or Path(path).stat().st_size),
    }


def audit_source_boundaries(
    path: str | Path,
    ffmpeg: str | Path,
    *,
    sample_rate: int = 44_100,
    boundary_kind: str,
    minimum_leading_silence_ms: float | None = None,
    minimum_trailing_silence_ms: float | None = None,
    raw_audit: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    """Audit raw margins or normalized integrity before artificial MP3 padding."""

    if boundary_kind not in {"raw", "normalized"}:
        raise ValueError("boundary_kind must be 'raw' or 'normalized'")
    default_minimums = (15.0, 30.0)
    if minimum_leading_silence_ms is None:
        minimum_leading_silence_ms = default_minimums[0]
    if minimum_trailing_silence_ms is None:
        minimum_trailing_silence_ms = default_minimums[1]

    process = subprocess.run(
        [
            str(ffmpeg), "-hide_banner", "-loglevel", "error", "-i", str(path),
            "-ar", str(sample_rate), "-ac", "1", "-f", "s16le", "pipe:1",
        ],
        check=False,
        capture_output=True,
    )


    if process.returncode or not process.stdout:
        detail = process.stderr.decode("utf-8", errors="replace")[-2000:]
        raise RuntimeError(f"source boundary decode failed for {path}: {detail}")
    samples = array.array("h")
    samples.frombytes(process.stdout[: len(process.stdout) - len(process.stdout) % 2])
    if sys.byteorder != "little":
        samples.byteswap()
    if not samples:
        raise RuntimeError(f"source boundary decode returned no samples: {path}")
    boundary_threshold_dbfs = -50.0
    active_span_db_below_peak = 40.0
    boundary_threshold = 32768 * (10 ** (boundary_threshold_dbfs / 20))
    absolute = [abs(sample) for sample in samples]
    boundary_active = [
        index for index, value in enumerate(absolute) if value > boundary_threshold
    ]
    if not boundary_active:
        raise RuntimeError(f"source boundary audit found only silence: {path}")
    peak = max(absolute)
    active_span_threshold = max(
        boundary_threshold,
        peak * (10 ** (-active_span_db_below_peak / 20)),
    )
    active = [
        index for index, value in enumerate(absolute) if value > active_span_threshold
    ]
    leading_ms = boundary_active[0] * 1000 / sample_rate
    trailing_ms = (len(samples) - boundary_active[-1] - 1) * 1000 / sample_rate
    absolute_active_span_ms = (
        boundary_active[-1] - boundary_active[0] + 1
    ) * 1000 / sample_rate
    active_span_ms = (active[-1] - active[0] + 1) * 1000 / sample_rate
    clipping_ratio = sum(value >= 32760 for value in absolute) / len(absolute)
    edge_length = max(1, int(sample_rate * 0.01))
    edge = [*absolute[:edge_length], *absolute[-edge_length:]]
    edge_clipping_ratio = sum(value >= 32760 for value in edge) / len(edge)
    result: dict[str, Any] = {
        "boundaryKind": boundary_kind,
        "leadingSilenceMs": round(leading_ms, 3),
        "trailingSilenceMs": round(trailing_ms, 3),
        "absoluteActiveSpanMs": round(absolute_active_span_ms, 3),
        "activeSpanMs": round(active_span_ms, 3),
        "peakDbfs": round(20 * math.log10(peak / 32768), 3),
        "boundaryThresholdDbfs": boundary_threshold_dbfs,
        "activeSpanThresholdDbfs": round(
            20 * math.log10(active_span_threshold / 32768),
            3,
        ),
        "activeSpanDbBelowPeak": active_span_db_below_peak,
        "clippingSampleRatio": round(clipping_ratio, 9),
        "edgeClippingSampleRatio": round(edge_clipping_ratio, 9),
    }
    if boundary_kind == "raw":
        truncation_risk = (
            leading_ms < minimum_leading_silence_ms
            or trailing_ms < minimum_trailing_silence_ms
        )
        result.update(
            {
                "minimumLeadingSilenceMs": minimum_leading_silence_ms,
                "minimumTrailingSilenceMs": minimum_trailing_silence_ms,
                "truncationRisk": truncation_risk,
                "pass": not truncation_risk and clipping_ratio <= 0.0001,
            }
        )
        return result
    if not isinstance(raw_audit, Mapping) or not isinstance(raw_audit.get("activeSpanMs"), (int, float)):
        raise ValueError("normalized boundary audit requires a raw active-span audit")
    raw_active_span_ms = float(raw_audit["activeSpanMs"])
    if raw_active_span_ms <= 0:
        raise ValueError("raw active span must be positive")
    active_span_ratio = active_span_ms / raw_active_span_ms
    active_span_collapse_risk = not 0.65 <= active_span_ratio <= 1.35
    edge_clipping_risk = edge_clipping_ratio > 0.0001 or clipping_ratio > 0.0001
    result.update(
        {
            "rawActiveSpanMs": round(raw_active_span_ms, 3),
            "activeSpanRatio": round(active_span_ratio, 6),
            "minimumActiveSpanRatio": 0.65,
            "maximumActiveSpanRatio": 1.35,
            "activeSpanCollapseRisk": active_span_collapse_risk,
            "edgeClippingRisk": edge_clipping_risk,
            "pass": not active_span_collapse_risk and not edge_clipping_risk,
        }
    )
    return result


def measure_integrated_loudness(
    path: str | Path,
    ffmpeg: str | Path,
    *,
    target_lufs: float,
) -> dict[str, Any]:
    """Re-measure encoded media with FFmpeg's EBU R128 loudnorm analysis."""

    def analyze(audio_filter: str, *, duration: float | None = None) -> tuple[float, float, float]:
        command = [
            str(ffmpeg),
            "-hide_banner",
            "-nostats",
            "-i",
            str(path),
            "-af",
            audio_filter,
        ]
        if duration is not None:
            command.extend(["-t", str(duration)])
        command.extend([
            "-f",
            "null",
            "-",
        ])
        process = subprocess.run(command, check=False, capture_output=True)
        stderr = process.stderr.decode("utf-8", errors="replace")
        if process.returncode:
            raise RuntimeError(f"loudness measurement failed for {path}: {stderr[-2000:]}")
        matches = re.findall(r"\{\s*\"input_i\"\s*:.*?\}", stderr, flags=re.DOTALL)
        if not matches:
            raise RuntimeError(f"loudness measurement returned no JSON for {path}")
        try:
            report = json.loads(matches[-1])
            return (
                float(report["input_i"]),
                float(report["input_tp"]),
                float(report["input_lra"]),
            )
        except (KeyError, TypeError, ValueError, json.JSONDecodeError) as error:
            raise RuntimeError(f"loudness measurement returned invalid JSON for {path}") from error

    loudnorm = f"loudnorm=I={target_lufs}:TP=-2:LRA=11:print_format=json"
    integrated, true_peak, loudness_range = analyze(loudnorm)
    mode = "integrated-lufs"
    if not math.isfinite(integrated):
        trim = (
            "silenceremove=start_periods=1:start_silence=0.02:start_threshold=-50dB,"
            "areverse,"
            "silenceremove=start_periods=1:start_silence=0.04:start_threshold=-50dB,"
            "areverse"
        )
        integrated, true_peak, loudness_range = analyze(
            f"{trim},aloop=loop=20:size=44100,{loudnorm}",
            duration=3.0,
        )
        mode = "short-active-loop-lufs"
    if not all(math.isfinite(value) for value in (integrated, true_peak, loudness_range)):
        raise RuntimeError(f"loudness measurement returned a non-finite value for {path}")
    return {
        "integratedLufs": round(integrated, 3),
        "truePeakDbtp": round(true_peak, 3),
        "loudnessRangeLu": round(loudness_range, 3),
        "targetLufs": float(target_lufs),
        "loudnessMeasurementMode": mode,
    }


def audit_audio_clarity(
    path: str | Path,
    ffmpeg: str | Path,
    *,
    sample_rate: int = 44_100,
    expected_mora_phonemes: Sequence[str] | None = None,
    check_detached_tail: bool = True,
    target_lufs: float = -18.0,
    loudness_tolerance_lufs: float = TARGET_INTEGRATED_LUFS_TOLERANCE,
) -> dict[str, Any]:
    """Measure final-media silence, level, clipping and suspicious detached tails."""

    process = subprocess.run(
        [
            str(ffmpeg), "-hide_banner", "-loglevel", "error", "-i", str(path),
            "-ar", str(sample_rate), "-ac", "1", "-f", "s16le", "pipe:1",
        ],
        check=False,
        capture_output=True,
    )
    if process.returncode or not process.stdout:
        detail = process.stderr.decode("utf-8", errors="replace")[-2000:]
        raise RuntimeError(f"clarity decode failed for {path}: {detail}")
    samples = array.array("h")
    samples.frombytes(process.stdout[: len(process.stdout) - len(process.stdout) % 2])
    if sys.byteorder != "little":
        samples.byteswap()
    if not samples:
        raise RuntimeError(f"clarity decode returned no samples: {path}")

    absolute = [abs(sample) for sample in samples]
    peak = max(absolute)
    rms = math.sqrt(sum(sample * sample for sample in samples) / len(samples))
    silence_threshold = 32768 * (10 ** (-50 / 20))
    active = [index for index, value in enumerate(absolute) if value > silence_threshold]
    if not active:
        raise RuntimeError(f"clarity audit found only silence: {path}")
    first_active, last_active = active[0], active[-1]
    sample_internal_gaps_ms = [
        (next_index - previous_index - 1) * 1000 / sample_rate
        for previous_index, next_index in zip(active, active[1:])
        if next_index > previous_index + 1
    ]
    leading_ms = first_active * 1000 / sample_rate
    trailing_ms = (len(samples) - last_active - 1) * 1000 / sample_rate
    voiced_duration = (last_active - first_active + 1) / sample_rate
    clipping_ratio = sum(value >= 32760 for value in absolute) / len(samples)
    voiced = samples[first_active : last_active + 1]
    voiced_rms = math.sqrt(sum(sample * sample for sample in voiced) / len(voiced))
    tail = voiced[-max(1, int(sample_rate * 0.12)) :]
    tail_rms = math.sqrt(sum(sample * sample for sample in tail) / len(tail))
    tail_energy_ratio = tail_rms / voiced_rms if voiced_rms else 0.0
    silence_samples = [*samples[:first_active], *samples[last_active + 1 :]]
    noise_rms = (
        math.sqrt(sum(sample * sample for sample in silence_samples) / len(silence_samples))
        if silence_samples
        else 32768.0
    )

    activity_frame_size = max(1, int(sample_rate * 0.01))
    activity_frames = [
        max(absolute[start : start + activity_frame_size], default=0) > silence_threshold
        for start in range(first_active, last_active + 1, activity_frame_size)
    ]
    activity_islands: list[tuple[int, int]] = []
    island_start: int | None = None
    for frame_index, is_active in enumerate(activity_frames):
        if is_active and island_start is None:
            island_start = frame_index
        elif not is_active and island_start is not None:
            activity_islands.append((island_start, frame_index - 1))
            island_start = None
    if island_start is not None:
        activity_islands.append((island_start, len(activity_frames) - 1))

    frame_ms = activity_frame_size * 1000 / sample_rate
    internal_gaps_ms = [
        (next_start - previous_end - 1) * frame_ms
        for (_, previous_end), (next_start, _) in zip(
            activity_islands,
            activity_islands[1:],
        )
    ]
    final_island_ms = (
        (activity_islands[-1][1] - activity_islands[-1][0] + 1) * frame_ms
        if activity_islands
        else 0.0
    )
    final_gap_ms = internal_gaps_ms[-1] if internal_gaps_ms else 0.0
    preceding_activity_ms = (
        sum(end - start + 1 for start, end in activity_islands[:-1]) * frame_ms
    )
    expected_sokuon = any(
        phoneme == "cl" or phoneme.endswith(":cl")
        for phoneme in (expected_mora_phonemes or ())
    )
    detached_gap_threshold_ms = 220 if expected_sokuon or expected_mora_phonemes is None else 180
    excluded_speech_pause_ms = sum(
        gap_ms
        for gap_ms in sample_internal_gaps_ms
        if gap_ms >= LONG_INTERNAL_SPEECH_PAUSE_MS
    )
    speech_rate_duration = max(
        1 / sample_rate,
        voiced_duration - excluded_speech_pause_ms / 1000,
    )
    detached_tail_observed = (
        len(activity_islands) >= 2
        and final_gap_ms >= detached_gap_threshold_ms
        and final_island_ms <= 180
        and preceding_activity_ms >= 180
    )
    detached_tail = bool(check_detached_tail and detached_tail_observed)
    truncation_risk = leading_ms < 20 or trailing_ms < 40
    loudness = measure_integrated_loudness(
        path,
        ffmpeg,
        target_lufs=target_lufs,
    )
    loudness_error = abs(loudness["integratedLufs"] - float(target_lufs))
    loudness_pass = loudness_error <= float(loudness_tolerance_lufs)

    def dbfs(value: float) -> float:
        return round(20 * math.log10(max(value, 1) / 32768), 3)

    result = {
        "leadingSilenceMs": round(leading_ms, 3),
        "trailingSilenceMs": round(trailing_ms, 3),
        "voicedDurationSeconds": round(voiced_duration, 6),
        "speechRateDurationSeconds": round(speech_rate_duration, 6),
        "speechRateDurationPolicy": "exclude-long-internal-pauses-v1",
        "excludedSpeechPauseMs": round(excluded_speech_pause_ms, 3),
        "speechPauseThresholdMs": LONG_INTERNAL_SPEECH_PAUSE_MS,
        "peakDbfs": dbfs(peak),
        "rmsDbfs": dbfs(rms),
        "noiseFloorDbfs": dbfs(noise_rms),
        "clippingSampleRatio": round(clipping_ratio, 9),
        "tailEnergyRatio": round(tail_energy_ratio, 6),
        "activityIslandCount": len(activity_islands),
        "longestInternalSilenceMs": round(max(internal_gaps_ms, default=0.0), 3),
        "finalActivityIslandMs": round(final_island_ms, 3),
        "finalInternalSilenceMs": round(final_gap_ms, 3),
        "expectedSokuonClosure": expected_sokuon,
        "detachedTailGapThresholdMs": detached_gap_threshold_ms,
        "detachedTailCheckEnabled": bool(check_detached_tail),
        "detachedTailObserved": detached_tail_observed,
        "detachedTailRisk": detached_tail,
        "truncationRisk": truncation_risk,
        **loudness,
        "loudnessErrorLufs": round(loudness_error, 3),
        "loudnessToleranceLufs": float(loudness_tolerance_lufs),
        "loudnessPass": loudness_pass,
    }
    result["crestFactorDb"] = round(result["peakDbfs"] - result["rmsDbfs"], 3)
    result["pass"] = (
        result["rmsDbfs"] > -45
        and result["noiseFloorDbfs"] <= -45
        and result["crestFactorDb"] >= 6
        and result["peakDbfs"] <= -0.5
        and result["truePeakDbtp"] <= MAX_TRUE_PEAK_DBTP
        and clipping_ratio <= 0.0001
        and not detached_tail
        and not truncation_risk
        and loudness_pass
    )
    return result


class EventLogger:
    def __init__(self, path: str | Path) -> None:
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)

    def write(self, event: str, **fields: Any) -> None:
        payload = {
            "at": datetime.now(timezone.utc).isoformat(),
            "event": event,
            **fields,
        }
        with self.path.open("a", encoding="utf-8", newline="\n") as handle:
            handle.write(json.dumps(payload, ensure_ascii=False, sort_keys=True) + "\n")


class ClarityAuditError(RuntimeError):
    """Raised when an encoded artifact fails the final clarity gate."""

    def __init__(self, audio_id: str, audit: Mapping[str, Any]) -> None:
        self.audio_id = audio_id
        self.audit = dict(audit)
        super().__init__(f"clarity audit failed for {audio_id}: {self.audit}")


class SourceBoundaryAuditError(RuntimeError):
    """Raised when the unpadded AI or normalized source reaches a media edge."""

    def __init__(self, source: str, audit: Mapping[str, Any]) -> None:
        self.source = source
        self.audit = dict(audit)
        super().__init__(f"source boundary audit failed for {source}: {self.audit}")


def with_retries(
    operation: Any,
    *,
    retries: int,
    logger: EventLogger,
    audio_id: str,
) -> Any:
    for attempt in range(1, retries + 2):
        try:
            return operation()
        except Exception as error:
            if attempt > retries:
                logger.write(
                    "failed",
                    audioId=audio_id,
                    attempt=attempt,
                    error=f"{type(error).__name__}: {error}",
                )
                raise
            logger.write(
                "retry",
                audioId=audio_id,
                attempt=attempt,
                error=f"{type(error).__name__}: {error}",
            )
            time.sleep(min(2 ** (attempt - 1), 4))


def prepare_aivis_query_with_retries(
    *,
    adapter: AivisAdapter,
    surface: str,
    reading: str,
    voice_key: str,
    retries: int,
    logger: EventLogger,
    audio_id: str,
) -> PreparedAivisQuery:
    """Prepare one local Aivis query with the batch retry policy."""

    return with_retries(
        lambda: adapter.prepare_query(surface, reading, voice_key),
        retries=retries,
        logger=logger,
        audio_id=audio_id,
    )


def _replace_file_atomic(source: Path, destination: Path) -> None:
    for attempt in range(8):
        try:
            os.replace(source, destination)
            return
        except PermissionError:
            if attempt == 7:
                raise
            time.sleep(min(0.05 * (2**attempt), 0.5))


def _publish_validated_audio(
    output_path: Path,
    *,
    render_candidate: Any,
    validate_candidate: Any,
) -> Any:
    """Validate a same-directory candidate before atomically replacing media."""

    output_path.parent.mkdir(parents=True, exist_ok=True)
    candidate_path = output_path.with_name(
        f".{output_path.stem}.{os.getpid()}.{time.time_ns()}.candidate{output_path.suffix}"
    )
    candidate_path.unlink(missing_ok=True)
    try:
        render_candidate(candidate_path)
        result = validate_candidate(candidate_path)
        _replace_file_atomic(candidate_path, output_path)
        return result
    finally:
        candidate_path.unlink(missing_ok=True)


def render_audio_with_clarity_retries(
    *,
    create_cache: Any,
    encode_output: Any,
    build_item: Any,
    cache_path: Path,
    raw_path: Path,
    output_path: Path,
    retries: int,
    logger: EventLogger,
    audio_id: str,
    stage_id: str,
) -> tuple[Path, dict[str, Any]]:
    """Render and audit one artifact, forcing fresh AI output after clarity failures."""

    if retries < 0:
        raise ValueError("retries must be non-negative")
    boundary_path = cache_path.with_suffix(".boundary.json")
    max_attempts = retries + 1
    for clarity_attempt in range(1, max_attempts + 1):
        force_regenerate = clarity_attempt > 1
        cache = with_retries(
            lambda: create_cache(force_regenerate),
            retries=retries,
            logger=logger,
            audio_id=audio_id,
        )
        def render_candidate(candidate_path: Path) -> None:
            with_retries(
                lambda: encode_output(cache, candidate_path),
                retries=retries,
                logger=logger,
                audio_id=audio_id,
            )

        try:
            item = _publish_validated_audio(
                output_path,
                render_candidate=render_candidate,
                validate_candidate=build_item,
            )
        except (ClarityAuditError, SourceBoundaryAuditError) as error:
            if clarity_attempt >= max_attempts:
                cache_path.unlink(missing_ok=True)
                raw_path.unlink(missing_ok=True)
                boundary_path.unlink(missing_ok=True)
                logger.write(
                    "clarity-failed",
                    audioId=audio_id,
                    stageId=stage_id,
                    attempt=clarity_attempt,
                    maxAttempts=max_attempts,
                    clarityAudit=error.audit,
                    error=f"{type(error).__name__}: {error}",
                )
                raise
            cache_path.unlink(missing_ok=True)
            raw_path.unlink(missing_ok=True)
            boundary_path.unlink(missing_ok=True)
            logger.write(
                "clarity-retry",
                audioId=audio_id,
                stageId=stage_id,
                attempt=clarity_attempt,
                nextAttempt=clarity_attempt + 1,
                maxAttempts=max_attempts,
                clarityAudit=error.audit,
            )
            continue
        return cache, item

    raise AssertionError("clarity retry loop terminated without a result")


def _public_voice_manifest(config: Mapping[str, Any], adapter: AivisAdapter) -> dict[str, Any]:
    voices: dict[str, Any] = {}
    aliases = config.get("voiceAliases", {})
    for requested in sorted(set(config.get("voices", {})) | set(aliases)):
        target, settings = resolve_voice(config, requested)
        voices[requested] = {
            "voiceKey": target,
            **adapter.voice_descriptor(target),
            "queryParameters": {
                key: value
                for key, value in settings.items()
                if key not in {"modelUuid", "styleName"}
            },
        }
    return voices


def _audio_item(
    *,
    audio_id: str,
    kind: str,
    stage_id: str,
    level: int,
    voice_key: str,
    model_voice: str | Sequence[str],
    relative_path: str,
    content_hash: str,
    absolute_path: Path,
    source_boundary_audit: Mapping[str, Any] | None = None,
    ffmpeg: str | Path,
    ffprobe: str | Path,
    reading_sha256: str | None = None,
    phoneme_sha256: str | None = None,
    reading_kana: str | None = None,
    mora_sha256: str | None = None,
    query_sha256: str | None = None,
    query_parameters: Mapping[str, Any] | None = None,
    rate_adjustment: Mapping[str, Any] | None = None,
    post_processing: Mapping[str, Any] | None = None,
    mora_count: int | None = None,
    expected_mora_phonemes: Sequence[str] | None = None,
) -> dict[str, Any]:
    metadata = probe_audio(absolute_path, ffprobe)
    if metadata["codec"] != "mp3":
        raise RuntimeError(f"expected MP3 output for {audio_id}; got {metadata['codec']}")
    if metadata["sampleRate"] != 44_100 or metadata["channels"] != 1:
        raise RuntimeError(f"invalid output format for {audio_id}: {metadata}")
    clarity = audit_audio_clarity(
        absolute_path,
        ffmpeg,
        sample_rate=44_100,
        expected_mora_phonemes=expected_mora_phonemes,
        check_detached_tail=kind != "scene",
    )
    if kind != "scene":
        if not isinstance(mora_count, int) or mora_count <= 0:
            raise ValueError(f"missing mora count for {audio_id}")
        apply_speech_rate_audit(clarity, mora_count, reading_kana=reading_kana)
        if not isinstance(source_boundary_audit, Mapping):
            raise ValueError(f"missing source boundary audit for {audio_id}")
        if source_boundary_audit.get("pass") is not True:
            raise SourceBoundaryAuditError(audio_id, source_boundary_audit)
    if clarity["pass"] is not True:
        raise ClarityAuditError(audio_id, clarity)
    item = {
        "id": audio_id,
        "type": kind,
        "stageId": stage_id,
        "level": level,
        "voiceKey": voice_key,
        "modelVoice": model_voice,
        "path": relative_path.replace("\\", "/"),
        "contentHash": content_hash,
        "sha256": file_sha256(absolute_path),
        "claritySchemaVersion": CLARITY_SCHEMA_VERSION,
        "clarityAudit": clarity,
        **metadata,
    }
    if kind != "scene":
        if not reading_sha256 or not phoneme_sha256 or not mora_sha256 or not query_sha256:
            raise ValueError(f"missing reading/mora/query hashes for {audio_id}")
        item["readingSha256"] = reading_sha256
        item["phonemeSha256"] = phoneme_sha256
        item["moraSha256"] = mora_sha256
        item["querySha256"] = query_sha256
        item["queryParameters"] = dict(query_parameters or {})
        item["ratePolicy"] = rate_policy_evidence()
        item["readingKana"] = reading_kana
        item["sourceBoundaryAudit"] = dict(source_boundary_audit)
        if rate_adjustment is not None:
            item["rateAdjustment"] = dict(rate_adjustment)
    if post_processing is not None:
        item["postProcessing"] = dict(post_processing)
    return item


def _boundary_sidecar_path(work_root: Path, artifact_hash: str) -> Path:
    return work_root / "cache" / f"{artifact_hash}.boundary.json"


def _promote_normalized_cache(
    work_root: Path,
    *,
    source_hash: str,
    target_hash: str,
) -> Path:
    """Bind an already calibrated WAV to a post-processing-only identity."""

    if not re.fullmatch(r"[a-f0-9]{64}", source_hash) or not re.fullmatch(
        r"[a-f0-9]{64}", target_hash
    ):
        raise ValueError("cache promotion requires SHA-256 artifact identities")
    source = work_root / "cache" / f"{source_hash}.wav"
    target = work_root / "cache" / f"{target_hash}.wav"
    source_sidecar = _boundary_sidecar_path(work_root, source_hash)
    target_sidecar = _boundary_sidecar_path(work_root, target_hash)
    if not source.is_file() or not source_sidecar.is_file():
        raise FileNotFoundError("calibrated cache or boundary sidecar is missing")
    payload = read_json(source_sidecar)
    normalized_sha256 = file_sha256(source)
    if (
        not isinstance(payload, Mapping)
        or payload.get("artifactHash") != source_hash
        or payload.get("normalizedSha256") != normalized_sha256
        or payload.get("pass") is not True
    ):
        raise ValueError("calibrated cache boundary sidecar is invalid")
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_suffix(".promote.part.wav")
    temporary.unlink(missing_ok=True)
    try:
        shutil.copyfile(source, temporary)
        _replace_file_atomic(temporary, target)
    finally:
        temporary.unlink(missing_ok=True)
    write_json_atomic(
        target_sidecar,
        {
            **dict(payload),
            "artifactHash": target_hash,
            "normalizedSha256": normalized_sha256,
        },
    )
    return target


def _load_current_boundary_sidecar(
    sidecar_path: Path,
    *,
    cache_path: Path,
    artifact_hash: str,
) -> dict[str, Any] | None:
    try:
        payload = read_json(sidecar_path)
    except (OSError, UnicodeError, json.JSONDecodeError):
        return None
    if not isinstance(payload, Mapping):
        return None
    if (
        payload.get("schemaVersion") != SOURCE_BOUNDARY_SCHEMA_VERSION
        or payload.get("claritySchemaVersion") != CLARITY_SCHEMA_VERSION
        or payload.get("artifactHash") != artifact_hash
        or payload.get("normalizedSha256") != file_sha256(cache_path)
        or payload.get("pass") is not True
    ):
        return None
    raw = payload.get("raw")
    normalized = payload.get("normalized")
    if (
        not isinstance(raw, Mapping)
        or raw.get("boundaryKind") != "raw"
        or raw.get("activeSpanDbBelowPeak") != 40.0
        or raw.get("pass") is not True
        or not isinstance(normalized, Mapping)
        or normalized.get("boundaryKind") != "normalized"
        or normalized.get("activeSpanDbBelowPeak") != 40.0
        or normalized.get("pass") is not True
    ):
        return None
    return dict(payload)


def _lossless_source_sha256(item: Mapping[str, Any] | None) -> str | None:
    if not isinstance(item, Mapping):
        return None
    boundary = item.get("sourceBoundaryAudit")
    value = boundary.get("normalizedSha256") if isinstance(boundary, Mapping) else None
    return str(value) if isinstance(value, str) and re.fullmatch(r"[a-f0-9]{64}", value) else None


def _normalized_cache_is_current(
    work_root: Path,
    *,
    artifact_hash: str,
    sample_rate: int,
) -> bool:
    cache = work_root / "cache" / f"{artifact_hash}.wav"
    return bool(
        _valid_pcm_wav(cache, sample_rate)
        and _load_current_boundary_sidecar(
            _boundary_sidecar_path(work_root, artifact_hash),
            cache_path=cache,
            artifact_hash=artifact_hash,
        )
        is not None
    )


def _verified_lossless_line_cache(
    work_root: Path,
    *,
    artifact_hash: str,
    existing_item: Mapping[str, Any] | None,
    sample_rate: int,
) -> Path | None:
    """Return only a verified lossless cache; a published MP3 is never input."""

    if not _normalized_cache_is_current(
        work_root,
        artifact_hash=artifact_hash,
        sample_rate=sample_rate,
    ):
        return None
    cache = work_root / "cache" / f"{artifact_hash}.wav"
    sidecar = read_json(_boundary_sidecar_path(work_root, artifact_hash))
    if sidecar.get("normalizedSha256") != _lossless_source_sha256(existing_item):
        return None
    return cache


def _ensure_normalized_cache(
    *,
    prepared: PreparedAivisQuery,
    artifact_hash: str,
    adapter: AivisAdapter,
    work_root: Path,
    output_settings: Mapping[str, Any],
    ffmpeg: str | Path,
    keep_raw: bool,
    force: bool = False,
) -> Path:
    sample_rate = int(output_settings["sampleRate"])
    cache = work_root / "cache" / f"{artifact_hash}.wav"
    sidecar = _boundary_sidecar_path(work_root, artifact_hash)
    if not force and _valid_pcm_wav(cache, sample_rate):
        if _load_current_boundary_sidecar(
            sidecar,
            cache_path=cache,
            artifact_hash=artifact_hash,
        ) is not None:
            return cache
    raw = work_root / "raw" / f"{artifact_hash}.wav"
    cache.unlink(missing_ok=True)
    raw.unlink(missing_ok=True)
    sidecar.unlink(missing_ok=True)
    adapter.synthesize_prepared(prepared, raw)
    raw_audit = audit_source_boundaries(
        raw,
        ffmpeg,
        sample_rate=sample_rate,
        boundary_kind="raw",
    )
    if raw_audit.get("pass") is not True:
        raw.unlink(missing_ok=True)
        cache.unlink(missing_ok=True)
        sidecar.unlink(missing_ok=True)
        raise SourceBoundaryAuditError(f"raw:{artifact_hash}", raw_audit)
    try:
        normalize_wav(
            raw,
            cache,
            ffmpeg=ffmpeg,
            sample_rate=sample_rate,
            target_lufs=float(output_settings.get("targetLufs", -18)),
        )
        cache_audit = audit_source_boundaries(
            cache,
            ffmpeg,
            sample_rate=sample_rate,
            boundary_kind="normalized",
            raw_audit=raw_audit,
        )
        if cache_audit.get("pass") is not True:
            raise SourceBoundaryAuditError(f"normalized:{artifact_hash}", cache_audit)
        boundary_audit = {
            "schemaVersion": SOURCE_BOUNDARY_SCHEMA_VERSION,
            "claritySchemaVersion": CLARITY_SCHEMA_VERSION,
            "artifactHash": artifact_hash,
            "normalizedSha256": file_sha256(cache),
            "raw": raw_audit,
            "normalized": cache_audit,
            "pass": raw_audit.get("pass") is True and cache_audit.get("pass") is True,
        }
        write_json_atomic(sidecar, boundary_audit)
    except Exception:
        raw.unlink(missing_ok=True)
        cache.unlink(missing_ok=True)
        sidecar.unlink(missing_ok=True)
        raise
    if not keep_raw:
        raw.unlink(missing_ok=True)
    return cache


def _timeline_is_current(
    stage_entry: Mapping[str, Any] | None,
    scene_hash: str,
    audio_root: Path,
) -> bool:
    if not stage_entry or stage_entry.get("contentHash") != scene_hash:
        return False
    relative = stage_entry.get("timelinePath")
    if (
        not isinstance(relative, str)
        or not relative
        or "\\" in relative
        or relative.startswith("/")
        or re.match(r"^[A-Za-z]:", relative)
    ):
        return False
    root = audio_root.resolve()
    candidate = (root / relative).resolve()
    if not candidate.is_relative_to(root) or not candidate.is_file() or candidate.stat().st_size <= 0:
        return False
    try:
        timeline = read_json(candidate)
    except (OSError, UnicodeError, json.JSONDecodeError):
        return False
    if not isinstance(timeline, Mapping):
        return False
    if (
        timeline.get("schemaVersion") != 1
        or timeline.get("contentHash") != scene_hash
        or timeline.get("sourceContentHash") != stage_entry.get("sourceContentHash")
        or timeline.get("stageId") != stage_entry.get("stageId")
        or timeline.get("timelineId") != stage_entry.get("timelineId")
        or timeline.get("sceneAudioId") != stage_entry.get("sceneAudioId")
    ):
        return False
    sample_rate = timeline.get("sampleRate")
    duration = timeline.get("duration")
    if (
        not isinstance(sample_rate, int)
        or sample_rate <= 0
        or not isinstance(duration, (int, float))
        or duration <= 0
        or not isinstance(timeline.get("cues"), list)
    ):
        return False
    expected_audio_ids = list(stage_entry.get("lineAudioIds") or [])
    cues = timeline["cues"]
    if [cue.get("audioId") for cue in cues if isinstance(cue, Mapping)] != expected_audio_ids:
        return False
    return all(
        isinstance(cue, Mapping)
        and isinstance(cue.get("lineId"), str)
        and isinstance(cue.get("start"), (int, float))
        and isinstance(cue.get("end"), (int, float))
        and 0 <= cue["start"] < cue["end"] <= timeline["duration"]
        for cue in cues
    )


def _scene_hash(
    stage: Mapping[str, Any],
    line_hashes: Sequence[str],
    output_settings: Mapping[str, Any],
    model_fingerprint: str,
    post_processing: Mapping[str, Any] | None = None,
    *,
    line_source_sha256s: Sequence[str],
) -> str:
    source_sha256s = list(line_source_sha256s)
    if len(source_sha256s) != len(line_hashes):
        raise ValueError("scene lossless-source hash count must match its line artifact count")
    if any(re.fullmatch(r"[a-f0-9]{64}", value) is None for value in source_sha256s):
        raise ValueError("scene lossless-source hashes must be SHA-256 values")
    payload = {
        "stageId": stage["id"],
        "contentHash": stage.get("contentHash"),
        "lines": [
            {
                "id": line["id"],
                "audioId": line["audioId"],
                "pauseAfterMs": line.get("pauseAfterMs"),
                "artifactHash": line_hash,
                "losslessSourceSha256": source_sha256s[index],
            }
            for index, (line, line_hash) in enumerate(
                zip(stage.get("lines", []), line_hashes, strict=True)
            )
        ],
        "output": dict(output_settings),
        "model": model_fingerprint,
        "pipeline": PIPELINE_VERSION,
    }
    if post_processing:
        payload["postProcessing"] = dict(post_processing)
    return hashlib.sha256(_canonical_json(payload)).hexdigest()


def _scene_reuse_is_allowed(
    *,
    force: bool,
    retry_line: bool,
    retry_scene: bool,
    line_current_states: Sequence[bool],
    scene_manifest_current: bool,
    scene_clarity: Mapping[str, Any] | None,
) -> bool:
    """Only reuse a scene when every one of its lossless line sources is current."""

    return bool(
        not force
        and not retry_line
        and not retry_scene
        and line_current_states
        and all(line_current_states)
        and scene_manifest_current
        and isinstance(scene_clarity, Mapping)
        and scene_clarity.get("pass") is True
    )


def _line_generation_metadata_matches(
    existing_item: Mapping[str, Any] | None,
    *,
    query_parameters: Mapping[str, Any],
    rate_adjustment: Mapping[str, Any] | None,
    post_processing: Mapping[str, Any] | None,
) -> bool:
    if not isinstance(existing_item, Mapping):
        return False
    return bool(
        existing_item.get("queryParameters") == dict(query_parameters)
        and existing_item.get("rateAdjustment")
        == (dict(rate_adjustment) if rate_adjustment is not None else None)
        and existing_item.get("postProcessing")
        == (dict(post_processing) if post_processing is not None else None)
    )


def _update_stats(manifest: dict[str, Any]) -> None:
    stats = {"scene": 0, "line": 0, "option": 0, "token": 0}
    duration = 0.0
    byte_count = 0
    for item in manifest.get("items", {}).values():
        kind = str(item.get("type", ""))
        stats[kind] = stats.get(kind, 0) + 1
        duration += float(item.get("durationSeconds") or 0)
        byte_count += int(item.get("bytes") or 0)
    manifest["stats"] = {
        **stats,
        "durationSeconds": round(duration, 3),
        "bytes": byte_count,
    }


def _new_manifest(content_version: str, audio_base_url: str) -> dict[str, Any]:
    return {
        "schemaVersion": 1,
        "contentVersion": content_version,
        "generatedAt": None,
        "audioBaseUrl": audio_base_url,
        "generator": None,
        "voices": {},
        "items": {},
        "stages": {},
        "stats": {
            "scene": 0,
            "line": 0,
            "option": 0,
            "token": 0,
            "durationSeconds": 0,
            "bytes": 0,
        },
    }


def build_stage_manifest_entry(
    stage: Mapping[str, Any],
    tasks: Sequence[AudioTask],
    timeline: Mapping[str, Any],
    *,
    scene_hash: str,
    timeline_relative: str,
) -> dict[str, Any]:
    """Build the stage index, embedding cues required by the browser player."""

    return {
        "stageId": str(stage["id"]),
        "level": int(stage["level"]),
        "contentVersion": str(stage["contentVersion"]),
        "sceneAudioId": str(stage["audio"]["sceneAudioId"]),
        "timelineId": str(stage["audio"]["timelineId"]),
        "timelinePath": timeline_relative,
        "contentHash": scene_hash,
        "sourceContentHash": str(stage["contentHash"]),
        "sampleRate": int(timeline["sampleRate"]),
        "duration": float(timeline["duration"]),
        "cues": [dict(cue) for cue in timeline.get("cues", [])],
        "lineAudioIds": [task.audio_id for task in tasks if task.kind == "line"],
        "optionAudioIds": [task.audio_id for task in tasks if task.kind == "option"],
        "tokenAudioIds": [task.audio_id for task in tasks if task.kind == "token"],
    }


def generate_stage(
    stage: Mapping[str, Any],
    *,
    config: Mapping[str, Any],
    manifest: dict[str, Any],
    adapter: AivisAdapter,
    audio_root: Path,
    work_root: Path,
    pronunciations: Sequence[Mapping[str, Any]],
    model_fingerprint: str,
    ffmpeg: str | Path,
    ffprobe: str | Path,
    retries: int,
    force: bool,
    keep_raw: bool,
    logger: EventLogger,
    retry_audio_ids: set[str] | None = None,
) -> dict[str, int]:
    stage_id = str(stage["id"])
    level = int(stage["level"])
    output_settings = config["output"]
    sample_rate = int(output_settings["sampleRate"])
    leading_ms = int(output_settings.get("leadingSilenceMs", 60))
    trailing_ms = int(output_settings.get("trailingSilenceMs", 100))
    scene_gap_ms = int(output_settings.get("sceneGapMs", 180))
    items = manifest.setdefault("items", {})
    stage_entries = manifest.setdefault("stages", {})
    tasks = build_audio_tasks(stage)
    retry_audio_ids = retry_audio_ids or set()
    contexts: list[dict[str, Any]] = []
    line_hashes: list[str] = []

    for task in tasks:
        resolved_key, voice_settings = resolve_voice(config, task.voice_key)
        spoken_text = prepare_spoken_text(task.text, pronunciations)
        spoken_task = replace(task, text=spoken_text)
        base_prepared = prepare_aivis_query_with_retries(
            adapter=adapter,
            surface=task.surface,
            reading=spoken_text,
            voice_key=resolved_key,
            retries=retries,
            logger=logger,
            audio_id=task.audio_id,
        )
        existing = items.get(task.audio_id)

        def item_is_current(expected_hash: str) -> bool:
            return manifest_item_is_current(existing, expected_hash, audio_root)

        def audit_current(candidate: PreparedAivisQuery) -> dict[str, Any]:
            if not isinstance(existing, Mapping):
                raise ValueError(f"missing current manifest item for {task.audio_id}")
            relative = existing.get("path")
            if not isinstance(relative, str):
                raise ValueError(f"invalid current manifest path for {task.audio_id}")
            clarity = audit_audio_clarity(
                audio_root / relative,
                ffmpeg,
                sample_rate=sample_rate,
                expected_mora_phonemes=candidate.mora_phonemes,
                target_lufs=float(output_settings.get("targetLufs", -18)),
            )
            apply_speech_rate_audit(
                clarity,
                count_spoken_moras(candidate.mora_phonemes),
                reading_kana=candidate.reading,
            )
            return clarity

        def calibrate(
            candidate: PreparedAivisQuery,
            identity: Mapping[str, str],
        ) -> float:
            calibration_cache = with_retries(
                lambda: _ensure_normalized_cache(
                    prepared=candidate,
                    artifact_hash=identity["artifactHash"],
                    adapter=adapter,
                    work_root=work_root,
                    output_settings=output_settings,
                    ffmpeg=ffmpeg,
                    keep_raw=keep_raw,
                ),
                retries=retries,
                logger=logger,
                audio_id=task.audio_id,
            )
            clarity = audit_audio_clarity(
                calibration_cache,
                ffmpeg,
                sample_rate=sample_rate,
                expected_mora_phonemes=candidate.mora_phonemes,
                target_lufs=float(output_settings.get("targetLufs", -18)),
            )
            apply_speech_rate_audit(
                clarity,
                count_spoken_moras(candidate.mora_phonemes),
                reading_kana=candidate.reading,
            )
            rate = float(clarity["speechRateMoraPerSecond"])
            logger.write(
                "rate-calibrated",
                audioId=task.audio_id,
                stageId=stage_id,
                contentHash=identity["artifactHash"],
                speedScale=candidate.query.get("speedScale"),
                speechRateMoraPerSecond=rate,
            )
            return rate

        rate_result = resolve_rate_limited_task(
            spoken_task,
            base_prepared,
            resolved_voice_key=resolved_key,
            output_settings=output_settings,
            model_fingerprint=model_fingerprint,
            existing_item=existing,
            item_is_current=item_is_current,
            audit_current=audit_current,
            calibrate=calibrate,
            existing_post_processing=(
                {"profile": LOUDNESS_POST_PROCESSING_PROFILE}
                if isinstance(existing, Mapping)
                and existing.get("postProcessing") == {"profile": LOUDNESS_POST_PROCESSING_PROFILE}
                else None
            ),
        )
        prepared = rate_result["prepared"]
        identity = rate_result["identity"]
        logical_identity = identity
        fresh_clarity = rate_result["freshClarity"]
        post_processing: dict[str, Any] | None = None
        existing_post_processing = (
            {"profile": LOUDNESS_POST_PROCESSING_PROFILE}
            if isinstance(existing, Mapping)
            and existing.get("postProcessing") == {"profile": LOUDNESS_POST_PROCESSING_PROFILE}
            else None
        )
        if (
            force
            or task.audio_id in retry_audio_ids
            or existing_post_processing is not None
            or not isinstance(fresh_clarity, Mapping)
            or fresh_clarity.get("pass") is not True
        ):
            post_processing = existing_post_processing or {"profile": LOUDNESS_POST_PROCESSING_PROFILE}
            identity = task_artifact_identity(
                spoken_task,
                prepared,
                resolved_voice_key=resolved_key,
                output_settings=output_settings,
                model_fingerprint=model_fingerprint,
                post_processing=post_processing,
            )
            if (
                identity["artifactHash"] != logical_identity["artifactHash"]
                and not manifest_item_is_current(existing, identity["artifactHash"], audio_root)
            ):
                source_cache = with_retries(
                    lambda: _ensure_normalized_cache(
                        prepared=prepared,
                        artifact_hash=logical_identity["artifactHash"],
                        adapter=adapter,
                        work_root=work_root,
                        output_settings=output_settings,
                        ffmpeg=ffmpeg,
                        keep_raw=keep_raw,
                    ),
                    retries=retries,
                    logger=logger,
                    audio_id=task.audio_id,
                )
                source_clarity = audit_audio_clarity(
                    source_cache,
                    ffmpeg,
                    sample_rate=sample_rate,
                    expected_mora_phonemes=prepared.mora_phonemes,
                    target_lufs=float(output_settings.get("targetLufs", -18)),
                )
                apply_speech_rate_audit(
                    source_clarity,
                    count_spoken_moras(prepared.mora_phonemes),
                    reading_kana=prepared.reading,
                )
                if source_clarity["speechRateMoraPerSecond"] > MAX_CLEAR_MORA_RATE:
                    raise RateCalibrationError(
                        f"post-processing source for {task.audio_id} renders at "
                        f"{source_clarity['speechRateMoraPerSecond']:.6f} mora/s"
                    )
                _promote_normalized_cache(
                    work_root,
                    source_hash=logical_identity["artifactHash"],
                    target_hash=identity["artifactHash"],
                )
            if manifest_item_is_current(existing, identity["artifactHash"], audio_root):
                fresh_clarity = audit_current(prepared)
            else:
                fresh_clarity = None
        artifact_hash = identity["artifactHash"]
        query_sha256 = identity["querySha256"]
        phonemes = "\n".join(prepared.mora_phonemes)
        if prepared.rate_adjustment is not None:
            logger.write(
                "rate-adjusted",
                audioId=task.audio_id,
                stageId=stage_id,
                **prepared.rate_adjustment,
            )
        context = {
            "task": spoken_task,
            "existing": existing,
            "requestedVoiceKey": task.voice_key,
            "resolvedVoiceKey": resolved_key,
            "voice": voice_settings,
            "prepared": prepared,
            "hash": artifact_hash,
            "readingSha256": hashlib.sha256(spoken_text.encode("utf-8")).hexdigest(),
            "phonemeSha256": hashlib.sha256(phonemes.encode("utf-8")).hexdigest(),
            "moraSha256": prepared.mora_sha256,
            "querySha256": query_sha256,
            "freshClarity": fresh_clarity,
            "postProcessing": post_processing,
        }
        contexts.append(context)
        if task.kind == "line":
            line_hashes.append(artifact_hash)

    for context in contexts:
        task = context["task"]
        existing = context.get("existing")
        current = (
            not force
            and task.audio_id not in retry_audio_ids
            and manifest_item_is_current(existing, context["hash"], audio_root)
            and isinstance(context.get("freshClarity"), Mapping)
            and context["freshClarity"].get("pass") is True
        )
        if task.kind == "line":
            if _lossless_source_sha256(existing) is None or not _line_generation_metadata_matches(
                existing,
                query_parameters=context["prepared"].query_parameters,
                rate_adjustment=context["prepared"].rate_adjustment,
                post_processing=context.get("postProcessing"),
            ):
                current = False
        context["current"] = current

    scene_id = str(stage["audio"]["sceneAudioId"])
    prefix = f"level-{level}/{stage_id}"
    scene_relative = f"{prefix}/scene.mp3"
    timeline_relative = f"{prefix}/timeline.json"
    retry_line = any(
        task.audio_id in retry_audio_ids and task.kind == "line" for task in tasks
    )
    retry_scene = scene_id in retry_audio_ids or str(stage["audio"]["timelineId"]) in retry_audio_ids
    scene_existing = items.get(scene_id)
    existing_scene_post_processing = (
        {"profile": LOUDNESS_POST_PROCESSING_PROFILE}
        if isinstance(scene_existing, Mapping)
        and scene_existing.get("postProcessing") == {"profile": LOUDNESS_POST_PROCESSING_PROFILE}
        else None
    )
    scene_post_processing = existing_scene_post_processing
    line_contexts = [context for context in contexts if context["task"].kind == "line"]
    line_current_states = [bool(context.get("current")) for context in line_contexts]
    initial_line_source_hashes = [
        _lossless_source_sha256(context.get("existing")) or "0" * 64
        for context in line_contexts
    ]
    scene_hash = _scene_hash(
        stage,
        line_hashes,
        output_settings,
        model_fingerprint,
        post_processing=scene_post_processing,
        line_source_sha256s=initial_line_source_hashes,
    )
    scene_manifest_current = (
        all(line_current_states)
        and manifest_item_is_current(scene_existing, scene_hash, audio_root)
        and _timeline_is_current(stage_entries.get(stage_id), scene_hash, audio_root)
    )
    scene_fresh_clarity: dict[str, Any] | None = None
    if scene_manifest_current:
        scene_fresh_clarity = audit_audio_clarity(
            audio_root / scene_relative,
            ffmpeg,
            sample_rate=sample_rate,
            check_detached_tail=False,
            target_lufs=float(output_settings.get("targetLufs", -18)),
        )
    if not _scene_reuse_is_allowed(
        force=force,
        retry_line=retry_line,
        retry_scene=retry_scene,
        line_current_states=line_current_states,
        scene_manifest_current=scene_manifest_current,
        scene_clarity=scene_fresh_clarity,
    ):
        scene_post_processing = {"profile": LOUDNESS_POST_PROCESSING_PROFILE}
        scene_hash = _scene_hash(
            stage,
            line_hashes,
            output_settings,
            model_fingerprint,
            post_processing=scene_post_processing,
            line_source_sha256s=initial_line_source_hashes,
        )
        scene_manifest_current = (
            all(line_current_states)
            and manifest_item_is_current(scene_existing, scene_hash, audio_root)
            and _timeline_is_current(stage_entries.get(stage_id), scene_hash, audio_root)
        )
        if scene_manifest_current and not (force or retry_line or retry_scene):
            scene_fresh_clarity = audit_audio_clarity(
                audio_root / scene_relative,
                ffmpeg,
                sample_rate=sample_rate,
                check_detached_tail=False,
                target_lufs=float(output_settings.get("targetLufs", -18)),
            )
        else:
            scene_fresh_clarity = None
    need_scene = not _scene_reuse_is_allowed(
        force=force,
        retry_line=retry_line,
        retry_scene=retry_scene,
        line_current_states=line_current_states,
        scene_manifest_current=scene_manifest_current,
        scene_clarity=scene_fresh_clarity,
    )
    expected_ids = {context["task"].audio_id for context in contexts} | {scene_id}
    for stale_id in [
        audio_id
        for audio_id, item in items.items()
        if item.get("stageId") == stage_id and audio_id not in expected_ids
    ]:
        del items[stale_id]

    generated = 0
    reused = 0
    line_wavs: dict[str, Path] = {}
    for context in contexts:
        task: AudioTask = context["task"]
        artifact_hash = context["hash"]
        existing = items.get(task.audio_id)
        current = bool(context.get("current"))
        needs_cache = task.kind == "line" and need_scene
        cache = work_root / "cache" / f"{artifact_hash}.wav"
        if current and needs_cache:
            verified_cache = _verified_lossless_line_cache(
                work_root,
                artifact_hash=artifact_hash,
                existing_item=existing,
                sample_rate=sample_rate,
            )
            if verified_cache is None:
                # A published MP3 is never a lossless scene source. Rebuild the
                # exact Aivis WAV and republish this line before assembling scene.
                current = False
                context["current"] = False
            else:
                cache = verified_cache
        if current:
            existing["clarityAudit"] = dict(context["freshClarity"])
            existing["readingKana"] = task.text
            existing["readingSha256"] = context["readingSha256"]
            existing["phonemeSha256"] = context["phonemeSha256"]
            existing["moraSha256"] = context["moraSha256"]
            existing["querySha256"] = context["querySha256"]
            existing["queryParameters"] = dict(context["prepared"].query_parameters)
            existing["ratePolicy"] = rate_policy_evidence()
            if context["prepared"].rate_adjustment is not None:
                existing["rateAdjustment"] = dict(context["prepared"].rate_adjustment)
            else:
                existing.pop("rateAdjustment", None)
            if context.get("postProcessing") is not None:
                existing["postProcessing"] = dict(context["postProcessing"])
            else:
                existing.pop("postProcessing", None)
            if task.kind == "line" and needs_cache:
                line_wavs[task.audio_id] = cache
            reused += 1
            logger.write("reused", audioId=task.audio_id, stageId=stage_id)
            continue

        def create_cache(force_regenerate: bool) -> Path:
            return _ensure_normalized_cache(
                prepared=context["prepared"],
                artifact_hash=artifact_hash,
                adapter=adapter,
                work_root=work_root,
                output_settings=output_settings,
                ffmpeg=ffmpeg,
                keep_raw=keep_raw,
                force=force or force_regenerate,
            )

        generation_started = time.perf_counter()
        output_path = audio_root / task.relative_path
        cache_path = work_root / "cache" / f"{artifact_hash}.wav"
        raw_path = work_root / "raw" / f"{artifact_hash}.wav"
        boundary_path = _boundary_sidecar_path(work_root, artifact_hash)

        loudness_correction: dict[str, Any] = {
            "gainDb": 0.0,
            "limiterRequired": False,
        }

        def create_mp3(cache_to_encode: Path, candidate_path: Path) -> None:
            nonlocal loudness_correction
            loudness_correction = encode_mp3(
                cache_to_encode,
                candidate_path,
                ffmpeg=ffmpeg,
                sample_rate=sample_rate,
                bitrate=str(output_settings["bitrate"]),
                leading_silence_ms=leading_ms,
                trailing_silence_ms=trailing_ms,
                adaptive_loudness=context.get("postProcessing") is not None,
                target_lufs=float(output_settings.get("targetLufs", -18)),
            )

        def build_item(candidate_path: Path) -> dict[str, Any]:
            return _audio_item(
                audio_id=task.audio_id,
                kind=task.kind,
                stage_id=stage_id,
                level=level,
                voice_key=context["requestedVoiceKey"],
                model_voice=context["prepared"].model_voice,
                relative_path=task.relative_path,
                content_hash=artifact_hash,
                absolute_path=candidate_path,
                source_boundary_audit=read_json(boundary_path),
                ffmpeg=ffmpeg,
                ffprobe=ffprobe,
                reading_sha256=context["readingSha256"],
                phoneme_sha256=context["phonemeSha256"],
                reading_kana=task.text,
                mora_sha256=context["moraSha256"],
                query_sha256=context["querySha256"],
                query_parameters=context["prepared"].query_parameters,
                rate_adjustment=context["prepared"].rate_adjustment,
                post_processing=context.get("postProcessing"),
                mora_count=count_spoken_moras(context["prepared"].mora_phonemes),
                expected_mora_phonemes=context["prepared"].mora_phonemes,
            )

        cache, item = render_audio_with_clarity_retries(
            create_cache=create_cache,
            encode_output=create_mp3,
            build_item=build_item,
            cache_path=cache_path,
            raw_path=raw_path,
            output_path=output_path,
            retries=retries,
            logger=logger,
            audio_id=task.audio_id,
            stage_id=stage_id,
        )
        if task.kind == "line":
            line_wavs[task.audio_id] = cache
        generation_wall = time.perf_counter() - generation_started
        item["generationAudit"] = {
            "wallSeconds": round(generation_wall, 6),
            "realTimeFactor": round(generation_wall / item["durationSeconds"], 6),
        }
        if context.get("postProcessing") is not None:
            item["loudnessCorrection"] = dict(loudness_correction)
        items[task.audio_id] = item
        generated += 1
        logger.write(
            "generated",
            audioId=task.audio_id,
            stageId=stage_id,
            type=task.kind,
            contentHash=artifact_hash,
        )

    timeline_data: dict[str, Any]
    if need_scene:
        final_line_source_hashes: list[str] = []
        for context in line_contexts:
            artifact_hash = context["hash"]
            cache_path = line_wavs.get(context["task"].audio_id)
            if cache_path is None:
                raise RuntimeError(
                    f"lossless scene source is missing for {context['task'].audio_id}"
                )
            boundary = _load_current_boundary_sidecar(
                _boundary_sidecar_path(work_root, artifact_hash),
                cache_path=cache_path,
                artifact_hash=artifact_hash,
            )
            source_sha = boundary.get("normalizedSha256") if boundary else None
            if not isinstance(source_sha, str) or not re.fullmatch(r"[a-f0-9]{64}", source_sha):
                raise RuntimeError(
                    f"lossless scene source audit is missing for {context['task'].audio_id}"
                )
            final_line_source_hashes.append(source_sha)
        scene_hash = _scene_hash(
            stage,
            line_hashes,
            output_settings,
            model_fingerprint,
            post_processing=scene_post_processing,
            line_source_sha256s=final_line_source_hashes,
        )
        scene_wav = work_root / "scenes" / f"{stage_id}-{scene_hash}.wav"
        timeline_data = assemble_scene_wav(
            stage,
            line_wavs,
            scene_wav,
            sample_rate=sample_rate,
            leading_silence_ms=leading_ms,
            trailing_silence_ms=trailing_ms,
            default_gap_ms=scene_gap_ms,
        )
        timeline_data.update(
            {
                "schemaVersion": 1,
                "timelineId": str(stage["audio"]["timelineId"]),
                "sceneAudioId": scene_id,
                "contentHash": scene_hash,
                "sourceContentHash": str(stage["contentHash"]),
            }
        )
        timeline_path = audio_root / timeline_relative
        scene_path = audio_root / scene_relative

        scene_loudness_correction: dict[str, Any] = {
            "gainDb": 0.0,
            "limiterRequired": False,
        }

        def create_scene_mp3(candidate_path: Path) -> None:
            nonlocal scene_loudness_correction
            scene_loudness_correction = encode_mp3(
                scene_wav,
                candidate_path,
                ffmpeg=ffmpeg,
                sample_rate=sample_rate,
                bitrate=str(output_settings["bitrate"]),
                adaptive_loudness=scene_post_processing is not None,
                target_lufs=float(output_settings.get("targetLufs", -18)),
            )

        model_voices = sorted(
            {
                context["prepared"].model_voice
                for context in contexts
                if context["task"].kind == "line"
            }
        )

        def validate_scene_mp3(candidate_path: Path) -> dict[str, Any]:
            return _audio_item(
                audio_id=scene_id,
                kind="scene",
                stage_id=stage_id,
                level=level,
                voice_key="mixed",
                model_voice=model_voices,
                relative_path=scene_relative,
                content_hash=scene_hash,
                absolute_path=candidate_path,
                ffmpeg=ffmpeg,
                ffprobe=ffprobe,
                post_processing=scene_post_processing,
            )

        items[scene_id] = with_retries(
            lambda: _publish_validated_audio(
                scene_path,
                render_candidate=create_scene_mp3,
                validate_candidate=validate_scene_mp3,
            ),
            retries=retries,
            logger=logger,
            audio_id=scene_id,
        )
        write_json_atomic(timeline_path, timeline_data)
        if scene_post_processing is not None:
            items[scene_id]["loudnessCorrection"] = dict(scene_loudness_correction)
        generated += 1
        logger.write(
            "generated",
            audioId=scene_id,
            stageId=stage_id,
            type="scene",
            contentHash=scene_hash,
        )
    else:
        reused += 1
        logger.write("reused", audioId=scene_id, stageId=stage_id)
        items[scene_id]["clarityAudit"] = dict(scene_fresh_clarity or {})
        if scene_post_processing is not None:
            items[scene_id]["postProcessing"] = dict(scene_post_processing)
        else:
            items[scene_id].pop("postProcessing", None)
        timeline_data = read_json(audio_root / timeline_relative)
        if timeline_data.get("sourceContentHash") != stage.get("contentHash"):
            timeline_data["sourceContentHash"] = str(stage["contentHash"])
            write_json_atomic(audio_root / timeline_relative, timeline_data)

    stage_entries[stage_id] = build_stage_manifest_entry(
        stage,
        [context["task"] for context in contexts],
        timeline_data,
        scene_hash=scene_hash,
        timeline_relative=timeline_relative,
    )
    return {"generated": generated, "reused": reused}


def _generator_metadata(
    provenance: Mapping[str, Any],
    *,
    output_settings: Mapping[str, Any],
    pronunciations_sha256: str,
) -> dict[str, Any]:
    return {
        "name": "aivisspeech-engine-local-ai",
        "pipelineVersion": PIPELINE_VERSION,
        "claritySchemaVersion": CLARITY_SCHEMA_VERSION,
        "ratePolicy": rate_policy_evidence(),
        "executionProvider": provenance["executionProvider"],
        "output": dict(output_settings),
        "pronunciationsSha256": pronunciations_sha256,
        "engine": dict(provenance["engine"]),
        "models": [dict(model) for model in provenance["models"]],
        "license": "ACML-1.0",
    }


def _manifest_needs_full_content_migration(
    manifest: Mapping[str, Any],
    content_version: str,
) -> bool:
    """Detect both a new migration and an interrupted per-stage migration."""

    items = manifest.get("items")
    if not isinstance(items, Mapping) or not items:
        return False
    if str(manifest.get("contentVersion", "")) != content_version:
        return True
    stage_entries = manifest.get("stages")
    if not isinstance(stage_entries, Mapping):
        return True
    return any(
        not isinstance(entry, Mapping)
        or str(entry.get("contentVersion", "")) != content_version
        for entry in stage_entries.values()
    )


def create_adapter(config: Mapping[str, Any], config_path: str | Path) -> AivisAdapter:
    del config_path
    aivis = config["aivis"]
    return AivisAdapter(
        base_url=str(aivis["baseUrl"]),
        engine_version=str(aivis["engineVersion"]),
        models=aivis["models"],
        voices=config["voices"],
        timeout_seconds=float(aivis.get("timeoutSeconds", 120)),
        verify_model_files=bool(aivis.get("verifyModelFiles", True)),
    )


def run_smoke(
    *,
    config: Mapping[str, Any],
    config_path: Path,
    provenance: Mapping[str, Any],
    model_fingerprint: str,
    adapter: AivisAdapter,
    audio_root: Path,
    text: str,
    reading: str,
    retries: int,
    keep_raw: bool,
    force: bool,
    logger: EventLogger,
) -> dict[str, Any]:
    output_settings = config["output"]
    ffmpeg = _resolve_path(str(config["ffmpeg"]), config_path.parent)
    ffprobe = _resolve_path(str(config["ffprobe"]), config_path.parent)
    work_root = audio_root / ".work"
    smoke_root = work_root / "smoke"
    sample_rate = int(output_settings["sampleRate"])
    leading_ms = int(output_settings.get("leadingSilenceMs", 60))
    trailing_ms = int(output_settings.get("trailingSilenceMs", 100))
    results: dict[str, Any] = {}

    for voice_key in sorted(config["voices"]):
        settings = dict(config["voices"][voice_key])
        prepared = adapter.prepare_query(text, reading, voice_key)
        query_sha256 = hashlib.sha256(_canonical_json(prepared.query)).hexdigest()
        artifact_hash = hashlib.sha256(
            _canonical_json(
                {
                    "text": text,
                    "voiceKey": voice_key,
                    "voice": settings,
                    "modelUuid": prepared.model_uuid,
                    "modelVersion": prepared.model_version,
                    "modelSha256": prepared.model_sha256,
                    "styleName": prepared.style_name,
                    "styleId": prepared.style_id,
                    "queryParameters": prepared.query_parameters,
                    "querySha256": query_sha256,
                    "output": dict(output_settings),
                    "model": model_fingerprint,
                    "pipeline": PIPELINE_VERSION,
                }
            )
        ).hexdigest()

        def create_cache() -> Path:
            return _ensure_normalized_cache(
                prepared=prepared,
                artifact_hash=artifact_hash,
                adapter=adapter,
                work_root=work_root,
                output_settings=output_settings,
                ffmpeg=ffmpeg,
                keep_raw=keep_raw,
                force=force,
            )

        started = time.perf_counter()
        cache = with_retries(
            create_cache,
            retries=retries,
            logger=logger,
            audio_id=f"smoke-{voice_key}",
        )
        wav_path = smoke_root / f"{voice_key}.wav"
        mp3_path = smoke_root / f"{voice_key}.mp3"
        render_padded_wav(
            cache,
            wav_path,
            ffmpeg=ffmpeg,
            sample_rate=sample_rate,
            leading_silence_ms=leading_ms,
            trailing_silence_ms=trailing_ms,
        )
        encode_mp3(
            wav_path,
            mp3_path,
            ffmpeg=ffmpeg,
            sample_rate=sample_rate,
            bitrate=str(output_settings["bitrate"]),
        )
        wav_probe = probe_audio(wav_path, ffprobe)
        mp3_probe = probe_audio(mp3_path, ffprobe)
        clarity = audit_audio_clarity(
            mp3_path,
            ffmpeg,
            sample_rate=sample_rate,
            expected_mora_phonemes=prepared.mora_phonemes,
        )
        spoken_moras = count_spoken_moras(prepared.mora_phonemes)
        apply_speech_rate_audit(clarity, spoken_moras, reading_kana=prepared.reading)
        wall_seconds = time.perf_counter() - started
        if wav_probe["codec"] not in {"pcm_s16le", "pcm_s16be"}:
            raise RuntimeError(f"smoke WAV codec is invalid for {voice_key}: {wav_probe}")
        if mp3_probe["codec"] != "mp3":
            raise RuntimeError(f"smoke MP3 codec is invalid for {voice_key}: {mp3_probe}")
        if wav_probe["sampleRate"] != sample_rate or wav_probe["channels"] != 1:
            raise RuntimeError(f"smoke WAV format is invalid for {voice_key}: {wav_probe}")
        if mp3_probe["sampleRate"] != sample_rate or mp3_probe["channels"] != 1:
            raise RuntimeError(f"smoke MP3 format is invalid for {voice_key}: {mp3_probe}")
        if clarity["pass"] is not True:
            raise RuntimeError(f"smoke clarity audit failed for {voice_key}: {clarity}")
        results[voice_key] = {
            "modelVoice": prepared.model_voice,
            "modelUuid": prepared.model_uuid,
            "styleName": prepared.style_name,
            "styleId": prepared.style_id,
            "readingKana": prepared.reading,
            "moraSha256": prepared.mora_sha256,
            "querySha256": query_sha256,
            "queryParameters": prepared.query_parameters,
            "wallSeconds": round(wall_seconds, 6),
            "realTimeFactor": round(wall_seconds / mp3_probe["durationSeconds"], 6),
            "clarityAudit": clarity,
            "wav": {
                "path": wav_path.relative_to(work_root).as_posix(),
                "sha256": file_sha256(wav_path),
                **wav_probe,
            },
            "mp3": {
                "path": mp3_path.relative_to(work_root).as_posix(),
                "sha256": file_sha256(mp3_path),
                **mp3_probe,
            },
        }
        logger.write(
            "smoke-generated",
            voiceKey=voice_key,
            modelVoice=prepared.model_voice,
            wallSeconds=round(wall_seconds, 6),
            realTimeFactor=round(wall_seconds / mp3_probe["durationSeconds"], 6),
        )
        print(
            f"SMOKE {voice_key}: {mp3_probe['durationSeconds']:.3f}s MP3, "
            f"{wall_seconds:.3f}s wall, RTF={wall_seconds / mp3_probe['durationSeconds']:.3f}"
        )

    report = {
        "schemaVersion": 1,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "pipelineVersion": PIPELINE_VERSION,
        "text": text,
        "readingKana": reading,
        "provenance": dict(provenance),
        "voices": results,
    }
    write_json_atomic(smoke_root / "report.json", report)
    return report


def _dry_run_report(
    stages: Sequence[Mapping[str, Any]],
    *,
    config: Mapping[str, Any],
    manifest: Mapping[str, Any],
    pronunciations: Sequence[Mapping[str, Any]],
    model_fingerprint: str,
    audio_root: Path,
    adapter: AivisAdapter,
) -> dict[str, Any]:
    counts = {"scene": len(stages), "line": 0, "option": 0, "token": 0}
    current = 0
    for stage in stages:
        for task in build_audio_tasks(stage):
            counts[task.kind] += 1
            resolved_key, _settings = resolve_voice(config, task.voice_key)
            spoken = replace(task, text=prepare_spoken_text(task.text, pronunciations))
            prepared = adapter.prepare_query(task.surface, spoken.text, resolved_key)
            base_identity = task_artifact_identity(
                spoken,
                prepared,
                resolved_voice_key=resolved_key,
                output_settings=config["output"],
                model_fingerprint=model_fingerprint,
            )
            item = manifest.get("items", {}).get(task.audio_id)
            adjustment = item.get("rateAdjustment") if isinstance(item, Mapping) else None
            if (
                isinstance(adjustment, Mapping)
                and adjustment.get("baseArtifactHash") == base_identity["artifactHash"]
                and adjustment.get("baseQuerySha256") == base_identity["querySha256"]
            ):
                prepared = restore_prepared_query_rate(prepared, adjustment)
            elif manifest_item_is_current(item, base_identity["artifactHash"], audio_root):
                clarity = item.get("clarityAudit") if isinstance(item, Mapping) else None
                if isinstance(clarity, Mapping):
                    observed = clarity.get("speechRateMoraPerSecond")
                    if isinstance(observed, (int, float)) and observed > TARGET_CLEAR_MORA_RATE:
                        prepared = retime_prepared_query(prepared, float(observed))
            identity = task_artifact_identity(
                spoken,
                prepared,
                resolved_voice_key=resolved_key,
                output_settings=config["output"],
                model_fingerprint=model_fingerprint,
                post_processing=(
                    {"profile": LOUDNESS_POST_PROCESSING_PROFILE}
                    if isinstance(item, Mapping)
                    and item.get("postProcessing") == {
                        "profile": LOUDNESS_POST_PROCESSING_PROFILE
                    }
                    else None
                ),
            )
            if manifest_item_is_current(
                item,
                identity["artifactHash"],
                audio_root,
            ):
                current += 1
    total = sum(counts.values())
    return {
        "mode": "dry-run",
        "stageCount": len(stages),
        "counts": counts,
        "artifactCount": total,
        "currentTaskArtifacts": current,
        "toGenerateAtMost": total - current,
    }


def load_retry_audio_ids(path: str | Path) -> set[str]:
    """Load an audit failure list as JSON array or ``{"audioIds": [...]}``."""

    payload = read_json(path)
    values = payload.get("audioIds") if isinstance(payload, Mapping) else payload
    if not isinstance(values, list) or not values:
        raise ValueError("retry list must contain a non-empty audioIds array")
    audio_ids = {str(value) for value in values}
    invalid = sorted(
        audio_id
        for audio_id in audio_ids
        if not re.fullmatch(
            r"L[1-5]-[0-9]{3}-(?:line-[0-9]{3}(?:-token-[0-9]{3})?|q[1-5]-[a-f]|scene|timeline)",
            audio_id,
        )
    )
    if invalid:
        raise ValueError(f"retry list contains invalid audio IDs: {invalid[:20]}")
    return audio_ids


def stage_audio_ids(stage: Mapping[str, Any]) -> list[str]:
    """Return every retryable artifact ID owned by one stage."""

    return [
        *(task.audio_id for task in build_audio_tasks(stage)),
        str(stage["audio"]["sceneAudioId"]),
        str(stage["audio"]["timelineId"]),
    ]


def snapshot_manifest_stage(
    manifest: Mapping[str, Any],
    stage_id: str,
) -> dict[str, Any]:
    """Capture only the manifest records one stage is allowed to mutate."""

    items = manifest.get("items")
    stages = manifest.get("stages")
    stage_items = {
        audio_id: copy.deepcopy(item)
        for audio_id, item in (items.items() if isinstance(items, Mapping) else [])
        if isinstance(item, Mapping) and item.get("stageId") == stage_id
    }
    stage_present = isinstance(stages, Mapping) and stage_id in stages
    return {
        "items": stage_items,
        "stagePresent": stage_present,
        "stage": (
            copy.deepcopy(stages[stage_id])
            if stage_present and isinstance(stages, Mapping)
            else None
        ),
    }


def restore_manifest_stage(
    manifest: dict[str, Any],
    stage_id: str,
    snapshot: Mapping[str, Any],
) -> None:
    """Roll back partial in-memory mutations after one stage fails."""

    items = manifest.setdefault("items", {})
    stages = manifest.setdefault("stages", {})
    if not isinstance(items, dict) or not isinstance(stages, dict):
        raise ValueError("audio manifest items/stages must be mutable objects")
    for audio_id, item in list(items.items()):
        if isinstance(item, Mapping) and item.get("stageId") == stage_id:
            del items[audio_id]
    items.update(copy.deepcopy(dict(snapshot.get("items") or {})))
    if snapshot.get("stagePresent") is True:
        stages[stage_id] = copy.deepcopy(snapshot.get("stage"))
    else:
        stages.pop(stage_id, None)


def _remove_tree_with_retries(path: Path) -> None:
    for attempt in range(8):
        try:
            shutil.rmtree(path)
            return
        except FileNotFoundError:
            return
        except PermissionError:
            if attempt == 7:
                raise
            time.sleep(min(0.05 * (2**attempt), 0.5))


def begin_stage_media_snapshot(
    audio_root: str | Path,
    work_root: str | Path,
    stage: Mapping[str, Any],
    *,
    run_token: str,
) -> StageMediaSnapshot:
    """Back up one stage with same-volume hard links before publication starts."""

    stage_id = str(stage.get("id", ""))
    level = stage.get("level")
    if not re.fullmatch(r"L[1-5]-[0-9]{3}", stage_id) or not isinstance(level, int):
        raise ValueError("stage media snapshot requires a valid stage id and level")
    root = Path(audio_root).resolve()
    work = Path(work_root).resolve()
    stage_directory = (root / f"level-{level}" / stage_id).resolve()
    backup_directory = (work / "stage-rollback" / run_token / stage_id).resolve()
    if not stage_directory.is_relative_to(root) or not backup_directory.is_relative_to(work):
        raise ValueError("stage media snapshot escaped its configured root")
    if backup_directory.exists():
        _remove_tree_with_retries(backup_directory)
    backup_directory.mkdir(parents=True, exist_ok=False)
    if stage_directory.exists() and not stage_directory.is_dir():
        _remove_tree_with_retries(backup_directory)
        raise ValueError("stage media publication path must be a directory")
    existed = stage_directory.is_dir()
    try:
        if existed:
            for source in stage_directory.rglob("*"):
                if source.is_symlink():
                    raise ValueError(f"stage media snapshot rejects links: {source}")
                relative = source.relative_to(stage_directory)
                destination = backup_directory / relative
                if source.is_dir():
                    destination.mkdir(parents=True, exist_ok=True)
                    continue
                if not source.is_file():
                    raise ValueError(f"stage media snapshot found a non-file: {source}")
                destination.parent.mkdir(parents=True, exist_ok=True)
                try:
                    os.link(source, destination)
                except OSError:
                    shutil.copy2(source, destination)
    except Exception:
        _remove_tree_with_retries(backup_directory)
        raise
    return StageMediaSnapshot(
        stage_directory=stage_directory,
        backup_directory=backup_directory,
        existed=existed,
    )


def restore_stage_media(snapshot: StageMediaSnapshot) -> None:
    """Atomically restore the public stage directory captured before a failure."""

    stage_directory = snapshot.stage_directory
    backup_directory = snapshot.backup_directory
    stage_directory.parent.mkdir(parents=True, exist_ok=True)
    quarantine = stage_directory.with_name(
        f".{stage_directory.name}.failed-{os.getpid()}-{time.time_ns()}"
    )
    moved_current = False
    restored = False
    try:
        if stage_directory.exists():
            _replace_file_atomic(stage_directory, quarantine)
            moved_current = True
        if snapshot.existed:
            if not backup_directory.is_dir():
                raise FileNotFoundError("stage media rollback backup is missing")
            _replace_file_atomic(backup_directory, stage_directory)
        else:
            _remove_tree_with_retries(backup_directory)
        restored = True
    except Exception:
        if not stage_directory.exists() and moved_current and quarantine.exists():
            _replace_file_atomic(quarantine, stage_directory)
        raise
    finally:
        if restored and quarantine.exists():
            _remove_tree_with_retries(quarantine)


def commit_stage_media(snapshot: StageMediaSnapshot) -> None:
    """Drop the pre-stage backup after media and manifest are both durable."""

    _remove_tree_with_retries(snapshot.backup_directory)


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate the Japanese Subtext Trainer's local AivisSpeech audio library."
    )
    parser.add_argument("--config", default=str(DEFAULT_CONFIG))
    parser.add_argument("--content-root", default=str(DEFAULT_CONTENT_ROOT))
    parser.add_argument("--audio-root", default=str(DEFAULT_AUDIO_ROOT))
    parser.add_argument("--pronunciations", default=str(DEFAULT_PRONUNCIATIONS))
    parser.add_argument("--stage", action="append", default=[], help="Stage ID; repeat or comma-separate.")
    parser.add_argument("--level", action="append", type=int, default=[], choices=range(1, 6))
    parser.add_argument(
        "--batch",
        action="append",
        default=[],
        help="Inclusive stage-number (1:10) or ID (L1-001:L1-010) range.",
    )
    parser.add_argument("--all", action="store_true", help="Generate every discovered locked stage.")
    parser.add_argument(
        "--retry-list",
        help="JSON failure list; regenerate only listed items and any dependent scene.",
    )
    parser.add_argument("--allow-unlocked", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--retries", type=int, default=2)
    parser.add_argument("--keep-raw", action="store_true")
    parser.add_argument("--smoke", action="store_true", help="Generate five local WAV/MP3 smoke samples only.")
    parser.add_argument(
        "--smoke-text",
        default="今日は日本語の裏側で、言葉に隠れた気持ちを一緒に考えましょう。",
    )
    parser.add_argument(
        "--smoke-reading",
        default="きょうはにほんごのうらがわで、ことばにかくれたきもちをいっしょにかんがえましょう。",
    )
    args = parser.parse_args(argv)
    if args.retries < 0 or args.retries > 10:
        parser.error("--retries must be between 0 and 10")
    if args.smoke and (
        args.stage or args.level or args.batch or args.all or args.retry_list or args.dry_run
    ):
        parser.error("--smoke cannot be combined with stage selection or --dry-run")
    if args.retry_list and (args.stage or args.level or args.batch or args.all or args.force):
        parser.error("--retry-list cannot be combined with selectors or --force")
    if not args.smoke and not (args.stage or args.level or args.batch or args.all or args.retry_list):
        parser.error("choose --stage, --level, --batch, --all, --retry-list, or --smoke")
    return args


def _main_locked(args: argparse.Namespace, audio_root: Path) -> int:
    config, config_path = load_local_config(args.config)
    adapter = create_adapter(config, config_path)
    provenance, model_fingerprint = verify_model_files(adapter)
    work_root = audio_root / ".work"
    run_stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    logger = EventLogger(TOOL_ROOT / "logs" / f"tts-{run_stamp}-{os.getpid()}.jsonl")
    logger.write("start", mode="smoke" if args.smoke else "batch", pipeline=PIPELINE_VERSION)

    if args.smoke:
        run_smoke(
            config=config,
            config_path=config_path,
            provenance=provenance,
            model_fingerprint=model_fingerprint,
            adapter=adapter,
            audio_root=audio_root,
            text=args.smoke_text,
            reading=args.smoke_reading,
            retries=args.retries,
            keep_raw=args.keep_raw,
            force=args.force,
            logger=logger,
        )
        logger.write("complete", mode="smoke", voices=len(config["voices"]))
        print(
            f"PASS: configured-voice smoke report: "
            f"{audio_root / '.work' / 'smoke' / 'report.json'}"
        )
        return 0

    stages = discover_stages(args.content_root)
    retry_audio_ids = load_retry_audio_ids(args.retry_list) if args.retry_list else set()
    retry_stage_ids = sorted({audio_id[:6] for audio_id in retry_audio_ids})
    selected = select_stages(
        stages,
        stage_ids=[*args.stage, *retry_stage_ids],
        levels=args.level,
        batch_ranges=args.batch,
        all_stages=args.all,
    )
    if not selected:
        raise ValueError("no stages matched the selection")
    if retry_audio_ids:
        known_audio_ids = {
            audio_id
            for stage in selected
            for audio_id in [
                *(task.audio_id for task in build_audio_tasks(stage)),
                str(stage["audio"]["sceneAudioId"]),
                str(stage["audio"]["timelineId"]),
            ]
        }
        missing_retry_ids = sorted(retry_audio_ids - known_audio_ids)
        if missing_retry_ids:
            raise ValueError(f"retry list references unknown audio IDs: {missing_retry_ids[:20]}")
    unlocked = [str(stage.get("id")) for stage in selected if stage.get("textLocked") is not True]
    if unlocked and not args.allow_unlocked:
        raise ValueError(
            "audio generation requires textLocked=true; unlocked stages: "
            + ", ".join(unlocked[:20])
        )

    pronunciation_payload = read_json(args.pronunciations)
    pronunciations = pronunciation_payload.get("entries", [])
    pronunciations_sha256 = hashlib.sha256(_canonical_json(pronunciation_payload)).hexdigest()
    manifest_path = audio_root / "manifest.json"
    content_versions = {str(stage.get("contentVersion")) for stage in selected}
    if len(content_versions) != 1:
        raise ValueError(f"selected stages have mixed content versions: {sorted(content_versions)}")
    content_version = next(iter(content_versions))
    manifest = (
        read_json(manifest_path)
        if manifest_path.is_file()
        else _new_manifest(content_version, str(config.get("audioBaseUrl", "./")))
    )
    if not isinstance(manifest, dict):
        raise ValueError("audio manifest must be a JSON object")
    manifest.setdefault("items", {})
    manifest.setdefault("stages", {})
    existing_pipeline = str((manifest.get("generator") or {}).get("pipelineVersion", ""))
    if manifest["items"] and existing_pipeline != PIPELINE_VERSION:
        if not args.all or len(selected) != len(stages):
            raise ValueError(
                "audio pipeline changed; replace the complete old library with --all "
                "(use --force for a mandatory no-reuse rebuild)"
            )
        manifest = _new_manifest(content_version, str(config.get("audioBaseUrl", "./")))
    existing_version = str(manifest.get("contentVersion", ""))
    migration_incomplete = _manifest_needs_full_content_migration(
        manifest,
        content_version,
    )
    if migration_incomplete:
        if not args.all or len(selected) != len(stages):
            raise ValueError(
                "audio manifest contentVersion migration is new or incomplete; "
                "regenerate every stage with --all before publishing a mixed-version manifest"
            )
        # Keep hash-addressed Aivis task entries during a content-version
        # migration. Image-only or metadata-only changes then rebuild stage
        # timelines/scenes without spending AI inference on unchanged lines,
        # tokens, or options. A pipeline change is handled above and still
        # resets any legacy or incompatible manifest completely.
    elif manifest["items"] and not args.all:
        discovered_versions = {str(stage.get("contentVersion")) for stage in stages}
        if discovered_versions != {existing_version}:
            raise ValueError(
                "discovered content versions are mixed; finish the content migration and use --all"
            )

    if args.dry_run:
        print(
            json.dumps(
                _dry_run_report(
                    selected,
                    config=config,
                    manifest=manifest,
                    pronunciations=pronunciations,
                    model_fingerprint=model_fingerprint,
                    audio_root=audio_root,
                    adapter=adapter,
                ),
                ensure_ascii=False,
                indent=2,
            )
        )
        return 0

    ffmpeg = _resolve_path(str(config["ffmpeg"]), config_path.parent)
    ffprobe = _resolve_path(str(config["ffprobe"]), config_path.parent)
    if not ffmpeg.is_file() or not ffprobe.is_file():
        raise FileNotFoundError(f"ffmpeg/ffprobe not found: {ffmpeg}, {ffprobe}")
    total_generated = 0
    total_reused = 0
    failures: list[dict[str, Any]] = []
    failure_audio_ids: set[str] = set()
    stage_snapshot_run = f"{run_stamp}-{os.getpid()}"
    for index, stage in enumerate(selected, start=1):
        print(f"[{index}/{len(selected)}] {stage['id']}")
        stage_id = str(stage["id"])
        manifest_snapshot = snapshot_manifest_stage(manifest, stage_id)
        media_snapshot = begin_stage_media_snapshot(
            audio_root,
            work_root,
            stage,
            run_token=stage_snapshot_run,
        )
        try:
            result = generate_stage(
                stage,
                config=config,
                manifest=manifest,
                adapter=adapter,
                audio_root=audio_root,
                work_root=work_root,
                pronunciations=pronunciations,
                model_fingerprint=model_fingerprint,
                ffmpeg=ffmpeg,
                ffprobe=ffprobe,
                retries=args.retries,
                force=args.force,
                keep_raw=args.keep_raw,
                logger=logger,
                retry_audio_ids=retry_audio_ids,
            )
            manifest.update(
                {
                    "schemaVersion": 1,
                    "contentVersion": content_version,
                    "generatedAt": datetime.now(timezone.utc).isoformat(),
                    "audioBaseUrl": str(config.get("audioBaseUrl", "./")),
                    "generator": _generator_metadata(
                        provenance,
                        output_settings=config["output"],
                        pronunciations_sha256=pronunciations_sha256,
                    ),
                    "voices": _public_voice_manifest(config, adapter),
                }
            )
            _update_stats(manifest)
            write_json_atomic(manifest_path, manifest)
        except Exception as error:
            restore_manifest_stage(manifest, stage_id, manifest_snapshot)
            try:
                restore_stage_media(media_snapshot)
            except Exception as rollback_error:
                logger.write(
                    "stage-rollback-failed",
                    stageId=stage_id,
                    errorType=type(error).__name__,
                    error=str(error),
                    rollbackErrorType=type(rollback_error).__name__,
                    rollbackError=str(rollback_error),
                )
                raise RuntimeError(
                    f"media rollback failed for {stage_id}: {rollback_error}"
                ) from rollback_error
            failed_ids = stage_audio_ids(stage)
            failure_audio_ids.update(failed_ids)
            failure = {
                "stageId": stage_id,
                "errorType": type(error).__name__,
                "message": str(error),
                "audioIds": failed_ids,
            }
            failures.append(failure)
            logger.write("stage-failed", **failure)
            print(
                f"FAILED: {stage_id}: {type(error).__name__}: {error}; continuing",
                file=sys.stderr,
            )
            continue
        commit_stage_media(media_snapshot)
        total_generated += result["generated"]
        total_reused += result["reused"]

    if failures:
        failure_report_path = logger.path.with_name(
            f"{logger.path.stem}-failures.json"
        )
        write_json_atomic(
            failure_report_path,
            {
                "schemaVersion": 1,
                "pipelineVersion": PIPELINE_VERSION,
                "generatedAt": datetime.now(timezone.utc).isoformat(),
                "audioIds": sorted(failure_audio_ids),
                "failures": failures,
            },
        )
        logger.write(
            "incomplete",
            mode="batch",
            stages=len(selected),
            failedStages=len(failures),
            generated=total_generated,
            reused=total_reused,
            failureReport=failure_report_path.name,
        )
        print(
            f"INCOMPLETE: {len(failures)} of {len(selected)} stage(s) failed; "
            f"retry list: {failure_report_path}",
            file=sys.stderr,
        )
        return 1

    logger.write(
        "complete",
        mode="batch",
        stages=len(selected),
        generated=total_generated,
        reused=total_reused,
    )
    print(
        f"PASS: {len(selected)} stage(s), {total_generated} generated, "
        f"{total_reused} reused; manifest: {manifest_path}"
    )
    return 0


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)
    audio_root = Path(args.audio_root).resolve()
    with audio_root_generation_lock(audio_root):
        return _main_locked(args, audio_root)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("Interrupted.", file=sys.stderr)
        raise SystemExit(130)
    except Exception as error:
        print(f"ERROR: {type(error).__name__}: {error}", file=sys.stderr)
        raise SystemExit(1)
