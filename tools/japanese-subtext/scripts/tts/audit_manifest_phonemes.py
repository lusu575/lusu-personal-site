"""Recompute every published Aivis reading, mora, query and task hash."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from dataclasses import replace
from pathlib import Path
from typing import Any, Mapping

from generate_audio import (
    CLARITY_SCHEMA_VERSION,
    PIPELINE_VERSION,
    _canonical_json,
    _scene_hash,
    _resolve_path,
    _timeline_is_current,
    apply_speech_rate_audit,
    audit_audio_clarity,
    build_audio_tasks,
    create_adapter,
    discover_stages,
    load_local_config,
    prepare_spoken_text,
    probe_audio,
    resolve_voice,
    task_artifact_identity,
    verify_model_files,
    file_sha256,
    write_json_atomic,
)
from aivis_adapter import restore_prepared_query_rate


SCRIPT_DIR = Path(__file__).resolve().parent
TOOL_ROOT = SCRIPT_DIR.parents[1]
REQUIRED_BASE_CLARITY_FIELDS = {
    "leadingSilenceMs",
    "trailingSilenceMs",
    "voicedDurationSeconds",
    "speechRateDurationSeconds",
    "speechRateDurationPolicy",
    "excludedSpeechPauseMs",
    "speechPauseThresholdMs",
    "peakDbfs",
    "rmsDbfs",
    "noiseFloorDbfs",
    "crestFactorDb",
    "clippingSampleRatio",
    "tailEnergyRatio",
    "activityIslandCount",
    "longestInternalSilenceMs",
    "finalActivityIslandMs",
    "finalInternalSilenceMs",
    "expectedSokuonClosure",
    "detachedTailGapThresholdMs",
    "detachedTailCheckEnabled",
    "detachedTailObserved",
    "detachedTailRisk",
    "truncationRisk",
    "integratedLufs",
    "truePeakDbtp",
    "loudnessRangeLu",
    "loudnessMeasurementMode",
    "targetLufs",
    "loudnessErrorLufs",
    "loudnessToleranceLufs",
    "loudnessPass",
    "pass",
}
REQUIRED_TASK_RATE_FIELDS = {
    "speechRateMoraPerSecond",
    "spokenMoraCount",
    "speechRateBand",
    "speechRateMinimum",
    "speechRateMaximum",
    "speechRatePass",
}
REQUIRED_SOURCE_BOUNDARY_FIELDS = {
    "schemaVersion",
    "claritySchemaVersion",
    "artifactHash",
    "normalizedSha256",
    "raw",
    "normalized",
    "pass",
}
REQUIRED_RAW_BOUNDARY_FIELDS = {
    "boundaryKind", "leadingSilenceMs", "trailingSilenceMs", "absoluteActiveSpanMs",
    "activeSpanMs", "peakDbfs", "boundaryThresholdDbfs", "activeSpanThresholdDbfs",
    "activeSpanDbBelowPeak",
    "clippingSampleRatio", "edgeClippingSampleRatio", "minimumLeadingSilenceMs",
    "minimumTrailingSilenceMs", "truncationRisk", "pass",
}
REQUIRED_NORMALIZED_BOUNDARY_FIELDS = {
    "boundaryKind", "leadingSilenceMs", "trailingSilenceMs", "absoluteActiveSpanMs",
    "activeSpanMs", "peakDbfs", "boundaryThresholdDbfs", "activeSpanThresholdDbfs",
    "activeSpanDbBelowPeak",
    "clippingSampleRatio", "edgeClippingSampleRatio", "rawActiveSpanMs",
    "activeSpanRatio", "minimumActiveSpanRatio", "maximumActiveSpanRatio",
    "activeSpanCollapseRisk", "edgeClippingRisk", "pass",
}


def sha_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def recompute_scene_content_hash(
    stage: Mapping[str, Any],
    *,
    items: Mapping[str, Any],
    output_settings: Mapping[str, Any],
    model_fingerprint: str,
) -> str:
    """Bind a scene to every task identity and exact normalized line WAV."""

    line_hashes: list[str] = []
    source_hashes: list[str] = []
    for line in stage.get("lines", []):
        item = items.get(line.get("audioId"))
        if not isinstance(item, Mapping):
            raise ValueError(f"{stage.get('id')}: scene line item is missing")
        content_hash = item.get("contentHash")
        boundary = item.get("sourceBoundaryAudit")
        source_hash = boundary.get("normalizedSha256") if isinstance(boundary, Mapping) else None
        if not re.fullmatch(r"[a-f0-9]{64}", str(content_hash or "")):
            raise ValueError(f"{stage.get('id')}: scene line content hash is invalid")
        if not re.fullmatch(r"[a-f0-9]{64}", str(source_hash or "")):
            raise ValueError(f"{stage.get('id')}: scene line lossless-source hash is invalid")
        line_hashes.append(str(content_hash))
        source_hashes.append(str(source_hash))
    scene_id = stage.get("audio", {}).get("sceneAudioId")
    scene_item = items.get(scene_id)
    if not isinstance(scene_item, Mapping):
        raise ValueError(f"{stage.get('id')}: scene manifest item is missing")
    post_processing = scene_item.get("postProcessing")
    if post_processing is not None and post_processing != {
        "profile": "audited-loudness-gain-v3"
    }:
        raise ValueError(f"{stage.get('id')}: scene post-processing profile is invalid")
    return _scene_hash(
        stage,
        line_hashes,
        output_settings,
        model_fingerprint,
        post_processing=post_processing,
        line_source_sha256s=source_hashes,
    )


def source_boundary_audit_is_valid(
    audit: Any,
    *,
    artifact_hash: str,
) -> bool:
    if (
        not isinstance(audit, Mapping)
        or not REQUIRED_SOURCE_BOUNDARY_FIELDS.issubset(audit)
        or audit.get("schemaVersion") != 1
        or audit.get("claritySchemaVersion") != CLARITY_SCHEMA_VERSION
        or audit.get("artifactHash") != artifact_hash
        or not re.fullmatch(r"[0-9a-f]{64}", str(audit.get("normalizedSha256", "")))
        or audit.get("pass") is not True
    ):
        return False
    raw = audit.get("raw")
    normalized = audit.get("normalized")
    return bool(
        isinstance(raw, Mapping)
        and REQUIRED_RAW_BOUNDARY_FIELDS.issubset(raw)
        and raw.get("boundaryKind") == "raw"
        and raw.get("activeSpanDbBelowPeak") == 40.0
        and raw.get("pass") is True
        and isinstance(normalized, Mapping)
        and REQUIRED_NORMALIZED_BOUNDARY_FIELDS.issubset(normalized)
        and normalized.get("boundaryKind") == "normalized"
        and normalized.get("activeSpanDbBelowPeak") == 40.0
        and normalized.get("pass") is True
    )


def audit_scene_timeline(
    timeline: Mapping[str, Any],
    *,
    decoded_duration_seconds: float,
) -> dict[str, Any]:
    """Validate scene cues while allowing the intentional silence between them."""

    errors: list[str] = []
    duration = timeline.get("duration")
    sample_rate = timeline.get("sampleRate")
    cues = timeline.get("cues")
    if not isinstance(sample_rate, int) or sample_rate <= 0:
        errors.append("timeline sampleRate is invalid")
        sample_rate = 44_100
    if not isinstance(duration, (int, float)) or duration <= 0:
        errors.append("timeline duration is invalid")
        duration = 0.0
    if not isinstance(cues, list) or not cues:
        errors.append("timeline cues are missing")
        cues = []
    previous_end = 0.0
    for index, cue in enumerate(cues):
        if not isinstance(cue, Mapping):
            errors.append(f"cue {index} is not an object")
            continue
        start = cue.get("start")
        end = cue.get("end")
        if (
            not isinstance(start, (int, float))
            or not isinstance(end, (int, float))
            or not 0 <= start < end <= duration
        ):
            errors.append(f"cue {index} has invalid bounds")
            continue
        if start < previous_end:
            errors.append(f"cue {index} overlaps the previous cue")
        previous_end = float(end)
    tolerance_seconds = max(0.08, 2 * 1152 / sample_rate)
    duration_delta = abs(float(decoded_duration_seconds) - float(duration))
    if duration_delta > tolerance_seconds:
        errors.append("decoded scene duration does not match timeline")
    return {
        "cueCount": len(cues),
        "timelineDurationSeconds": round(float(duration), 6),
        "decodedDurationSeconds": round(float(decoded_duration_seconds), 6),
        "durationDeltaMs": round(duration_delta * 1000, 3),
        "durationToleranceMs": round(tolerance_seconds * 1000, 3),
        "errors": errors,
        "pass": not errors,
    }


def _published_media_path(item: Mapping[str, Any], audio_root: Path) -> Path:
    relative = item.get("path")
    if (
        not isinstance(relative, str)
        or not relative
        or "\\" in relative
        or relative.startswith("/")
        or re.match(r"^[A-Za-z]:", relative)
    ):
        raise ValueError("published audio path is invalid")
    root = audio_root.resolve()
    candidate = (root / relative).resolve()
    if not candidate.is_relative_to(root) or not candidate.is_file():
        raise ValueError("published audio path is missing or escapes the audio root")
    return candidate


def recompute_published_item(
    item: Mapping[str, Any],
    *,
    audio_root: Path,
    ffmpeg: str | Path,
    ffprobe: str | Path,
    expected_mora_phonemes: tuple[str, ...] | None = None,
    timeline: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    """Re-hash, probe and decode one published MP3 instead of trusting its manifest."""

    media_path = _published_media_path(item, audio_root)
    kind = str(item.get("type", ""))
    is_scene = kind == "scene"
    if not is_scene and not expected_mora_phonemes:
        raise ValueError("task media audit requires expected mora phonemes")
    metadata = probe_audio(media_path, ffprobe)
    clarity = audit_audio_clarity(
        media_path,
        ffmpeg,
        sample_rate=44_100,
        expected_mora_phonemes=None if is_scene else expected_mora_phonemes,
        check_detached_tail=not is_scene,
    )
    if is_scene:
        if not isinstance(timeline, Mapping):
            raise ValueError("scene media audit requires its timeline")
        timeline_audit = audit_scene_timeline(
            timeline,
            decoded_duration_seconds=float(metadata["durationSeconds"]),
        )
        clarity["timelineAudit"] = timeline_audit
        clarity["pass"] = clarity.get("pass") is True and timeline_audit["pass"] is True
    else:
        apply_speech_rate_audit(
            clarity,
            len([p for p in expected_mora_phonemes if p not in {"pau", "sil"}]),
            reading_kana=str(item.get("readingKana") or ""),
        )
    return {
        "sha256": file_sha256(media_path),
        "claritySchemaVersion": CLARITY_SCHEMA_VERSION,
        "clarityAudit": clarity,
        **metadata,
    }


def compare_published_item(stored: Mapping[str, Any], fresh: Mapping[str, Any]) -> list[str]:
    """Report material differences between stored claims and freshly decoded media."""

    audio_id = str(stored.get("id") or "unknown-audio")
    errors: list[str] = []
    kind = str(stored.get("type") or "")
    if stored.get("claritySchemaVersion") != CLARITY_SCHEMA_VERSION:
        errors.append(f"{audio_id}: stored clarity schema mismatch")
    stored_clarity = stored.get("clarityAudit")
    required_clarity = set(REQUIRED_BASE_CLARITY_FIELDS)
    if kind != "scene":
        required_clarity.update(REQUIRED_TASK_RATE_FIELDS)
    if (
        not isinstance(stored_clarity, Mapping)
        or not required_clarity.issubset(stored_clarity)
        or stored_clarity.get("pass") is not True
    ):
        errors.append(f"{audio_id}: stored clarity audit is missing or failed")
    if kind != "scene":
        source_boundary = stored.get("sourceBoundaryAudit")
        if not source_boundary_audit_is_valid(
            source_boundary,
            artifact_hash=str(stored.get("contentHash") or ""),
        ):
            errors.append(f"{audio_id}: normalized source boundary audit is missing or failed")
    if stored.get("sha256") != fresh.get("sha256"):
        errors.append(f"{audio_id}: sha256 mismatch")
    for key in ("codec", "sampleRate", "channels", "bitrate", "durationSeconds", "bytes"):
        if key in stored and stored.get(key) != fresh.get(key):
            errors.append(f"{audio_id}: {key} mismatch")
    if fresh.get("claritySchemaVersion") != CLARITY_SCHEMA_VERSION:
        errors.append(f"{audio_id}: fresh clarity schema mismatch")
    clarity = fresh.get("clarityAudit")
    if not isinstance(clarity, Mapping) or clarity.get("pass") is not True:
        errors.append(f"{audio_id}: fresh clarity audit failed")
    if kind != "scene" and isinstance(stored_clarity, Mapping) and isinstance(clarity, Mapping):
        rate_evidence_matches = (
            stored_clarity.get("speechRateDurationPolicy")
            == clarity.get("speechRateDurationPolicy")
            and stored_clarity.get("speechPauseThresholdMs")
            == clarity.get("speechPauseThresholdMs")
            and stored_clarity.get("speechRateBand") == clarity.get("speechRateBand")
            and stored_clarity.get("speechRateMinimum") == clarity.get("speechRateMinimum")
            and stored_clarity.get("speechRateMaximum") == clarity.get("speechRateMaximum")
            and all(
                isinstance(stored_clarity.get(key), (int, float))
                and isinstance(clarity.get(key), (int, float))
                and abs(float(stored_clarity[key]) - float(clarity[key])) <= 0.001
                for key in (
                    "speechRateDurationSeconds",
                    "excludedSpeechPauseMs",
                    "speechRateMoraPerSecond",
                )
            )
        )
        if not rate_evidence_matches:
            errors.append(f"{audio_id}: fresh speech-rate evidence mismatch")
    return errors


def _published_timeline_path(stage_entry: Mapping[str, Any], audio_root: Path) -> Path:
    relative = stage_entry.get("timelinePath")
    if (
        not isinstance(relative, str)
        or not relative
        or "\\" in relative
        or relative.startswith("/")
        or re.match(r"^[A-Za-z]:", relative)
    ):
        raise ValueError("published timeline path is invalid")
    root = audio_root.resolve()
    candidate = (root / relative).resolve()
    if not candidate.is_relative_to(root) or not candidate.is_file():
        raise ValueError("published timeline is missing or escapes the audio root")
    return candidate


def audit_manifest_media(
    manifest: Mapping[str, Any],
    *,
    audio_root: Path,
    ffmpeg: str | Path,
    ffprobe: str | Path,
    expected_mora_phonemes: Mapping[str, tuple[str, ...]],
) -> tuple[list[str], set[str], int]:
    """Freshly hash and decode every task plus every scene in a manifest."""

    errors: list[str] = []
    failed: set[str] = set()
    checked = 0
    items = manifest.get("items") if isinstance(manifest.get("items"), Mapping) else {}
    for audio_id, phonemes in expected_mora_phonemes.items():
        item = items.get(audio_id)
        if not isinstance(item, Mapping):
            errors.append(f"{audio_id}: manifest item is missing for media audit")
            failed.add(audio_id)
            continue
        try:
            checked += 1
            fresh = recompute_published_item(
                item,
                audio_root=audio_root,
                ffmpeg=ffmpeg,
                ffprobe=ffprobe,
                expected_mora_phonemes=phonemes,
                timeline=None,
            )
            item_errors = compare_published_item(item, fresh)
        except Exception as error:
            item_errors = [f"{audio_id}: published media audit failed: {type(error).__name__}: {error}"]
        if item_errors:
            errors.extend(item_errors)
            failed.add(audio_id)

    stages = manifest.get("stages") if isinstance(manifest.get("stages"), Mapping) else {}
    for stage_id, stage_entry in stages.items():
        if not isinstance(stage_entry, Mapping):
            errors.append(f"{stage_id}: stage manifest entry is invalid")
            continue
        scene_id = str(stage_entry.get("sceneAudioId") or "")
        scene_item = items.get(scene_id)
        if not scene_id or not isinstance(scene_item, Mapping):
            errors.append(f"{stage_id}: scene manifest item is missing")
            if scene_id:
                failed.add(scene_id)
            continue
        try:
            scene_hash = str(scene_item.get("contentHash") or "")
            if not _timeline_is_current(stage_entry, scene_hash, audio_root):
                raise ValueError("scene timeline is stale or invalid")
            timeline_path = _published_timeline_path(stage_entry, audio_root)
            timeline = json.loads(timeline_path.read_text(encoding="utf-8"))
            if not isinstance(timeline, Mapping):
                raise ValueError("scene timeline is not an object")
            checked += 1
            fresh = recompute_published_item(
                scene_item,
                audio_root=audio_root,
                ffmpeg=ffmpeg,
                ffprobe=ffprobe,
                expected_mora_phonemes=None,
                timeline=timeline,
            )
            item_errors = compare_published_item(scene_item, fresh)
        except Exception as error:
            item_errors = [f"{scene_id}: published scene audit failed: {type(error).__name__}: {error}"]
        if item_errors:
            errors.extend(item_errors)
            failed.add(scene_id)
    return errors, failed, checked


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", required=True)
    parser.add_argument("--content-root", default=str(TOOL_ROOT / "content"))
    parser.add_argument("--manifest", default=str(TOOL_ROOT / "audio" / "manifest.json"))
    parser.add_argument("--pronunciations", default=str(TOOL_ROOT / "config" / "pronunciations.json"))
    parser.add_argument(
        "--preflight",
        action="store_true",
        help="Validate all reviewed readings and live Aivis moras without requiring a manifest.",
    )
    parser.add_argument(
        "--failures-out",
        help="Write retry-compatible JSON containing every failed audio ID.",
    )
    args = parser.parse_args()

    config, config_path = load_local_config(args.config)
    adapter = create_adapter(config, config_path)
    provenance, model_fingerprint = verify_model_files(adapter)
    manifest = (
        {}
        if args.preflight
        else json.loads(Path(args.manifest).read_text(encoding="utf-8"))
    )
    pronunciations = json.loads(Path(args.pronunciations).read_text(encoding="utf-8")).get(
        "entries", []
    )

    errors: list[str] = []
    failed_audio_ids: set[str] = set()
    expected_mora_phonemes: dict[str, tuple[str, ...]] = {}
    if not args.preflight:
        generator = manifest.get("generator", {})
        if generator.get("pipelineVersion") != PIPELINE_VERSION:
            errors.append(
                f"pipeline mismatch: {generator.get('pipelineVersion')!r} != {PIPELINE_VERSION!r}"
            )
        if generator.get("claritySchemaVersion") != CLARITY_SCHEMA_VERSION:
            errors.append("manifest generator clarity schema mismatch")
        if generator.get("executionProvider") != "CPU":
            errors.append("manifest executionProvider is not CPU")
        if generator.get("engine") != provenance.get("engine"):
            errors.append("manifest AivisSpeech engine provenance mismatch")
        if generator.get("models") != provenance.get("models"):
            errors.append("manifest AIVM model provenance mismatch")

    checked = 0
    for stage in discover_stages(args.content_root):
        for task in build_audio_tasks(stage):
            spoken_text = prepare_spoken_text(task.text, pronunciations)
            resolved_key, _settings = resolve_voice(config, task.voice_key)
            prepared = adapter.prepare_query(task.surface, spoken_text, resolved_key)
            expected_mora_phonemes[task.audio_id] = prepared.mora_phonemes
            if args.preflight:
                checked += 1
                if checked % 500 == 0:
                    print(f"PREFLIGHT {checked} tasks", file=sys.stderr, flush=True)
                continue
            spoken_task = replace(task, text=spoken_text)
            item = manifest.get("items", {}).get(task.audio_id)
            if not isinstance(item, Mapping):
                errors.append(f"{task.audio_id}: manifest item is missing")
                failed_audio_ids.add(task.audio_id)
                continue
            base_identity = task_artifact_identity(
                spoken_task,
                prepared,
                resolved_voice_key=resolved_key,
                output_settings=config["output"],
                model_fingerprint=model_fingerprint,
            )
            rate_adjustment = item.get("rateAdjustment")
            if rate_adjustment is not None:
                if (
                    not isinstance(rate_adjustment, Mapping)
                    or rate_adjustment.get("baseArtifactHash") != base_identity["artifactHash"]
                    or rate_adjustment.get("baseQuerySha256") != base_identity["querySha256"]
                ):
                    errors.append(f"{task.audio_id}: rateAdjustment base identity mismatch")
                    failed_audio_ids.add(task.audio_id)
                    continue
                prepared = restore_prepared_query_rate(prepared, rate_adjustment)
            post_processing = item.get("postProcessing")
            if post_processing is not None and post_processing != {
                "profile": "audited-loudness-gain-v3"
            }:
                errors.append(f"{task.audio_id}: postProcessing profile is invalid")
                failed_audio_ids.add(task.audio_id)
                continue
            identity = task_artifact_identity(
                spoken_task,
                prepared,
                resolved_voice_key=resolved_key,
                output_settings=config["output"],
                model_fingerprint=model_fingerprint,
                post_processing=post_processing,
            )
            phonemes = "\n".join(prepared.mora_phonemes)
            expected = {
                "readingKana": spoken_text,
                "readingSha256": sha_text(spoken_text),
                "phonemeSha256": identity["phonemeSha256"],
                "moraSha256": prepared.mora_sha256,
                "querySha256": identity["querySha256"],
                "queryParameters": prepared.query_parameters,
                "contentHash": identity["artifactHash"],
                "modelVoice": prepared.model_voice,
            }
            for key, value in expected.items():
                if item.get(key) != value:
                    errors.append(f"{task.audio_id}: {key} mismatch")
                    failed_audio_ids.add(task.audio_id)
            clarity = item.get("clarityAudit")
            required_clarity = REQUIRED_BASE_CLARITY_FIELDS | REQUIRED_TASK_RATE_FIELDS
            if (
                not isinstance(clarity, Mapping)
                or not required_clarity.issubset(clarity)
                or clarity.get("pass") is not True
                or item.get("claritySchemaVersion") != CLARITY_SCHEMA_VERSION
            ):
                errors.append(f"{task.audio_id}: clarityAudit is missing or failed")
                failed_audio_ids.add(task.audio_id)
            source_boundary = item.get("sourceBoundaryAudit")
            if not source_boundary_audit_is_valid(
                source_boundary,
                artifact_hash=identity["artifactHash"],
            ):
                errors.append(f"{task.audio_id}: sourceBoundaryAudit is missing or failed")
                failed_audio_ids.add(task.audio_id)
            checked += 1

        if not args.preflight:
            scene_id = str(stage.get("audio", {}).get("sceneAudioId") or "")
            try:
                expected_scene_hash = recompute_scene_content_hash(
                    stage,
                    items=manifest.get("items", {}),
                    output_settings=config["output"],
                    model_fingerprint=model_fingerprint,
                )
            except (TypeError, ValueError) as error:
                errors.append(str(error))
                if scene_id:
                    failed_audio_ids.add(scene_id)
            else:
                scene_item = manifest.get("items", {}).get(scene_id)
                stage_entry = manifest.get("stages", {}).get(stage.get("id"))
                if not isinstance(scene_item, Mapping) or scene_item.get("contentHash") != expected_scene_hash:
                    errors.append(f"{scene_id}: scene contentHash mismatch")
                    failed_audio_ids.add(scene_id)
                if not isinstance(stage_entry, Mapping) or stage_entry.get("contentHash") != expected_scene_hash:
                    errors.append(f"{stage.get('id')}: stage scene contentHash mismatch")
                    failed_audio_ids.add(scene_id)

    media_checked = 0
    if not args.preflight:
        audio_root = Path(args.manifest).resolve().parent
        ffmpeg = _resolve_path(str(config["ffmpeg"]), config_path.parent)
        ffprobe = _resolve_path(str(config["ffprobe"]), config_path.parent)
        media_errors, media_failures, media_checked = audit_manifest_media(
            manifest,
            audio_root=audio_root,
            ffmpeg=ffmpeg,
            ffprobe=ffprobe,
            expected_mora_phonemes=expected_mora_phonemes,
        )
        errors.extend(media_errors)
        failed_audio_ids.update(media_failures)

    result: dict[str, Any] = {
        "ok": not errors,
        "mode": "preflight" if args.preflight else "manifest-audit",
        "pipelineVersion": PIPELINE_VERSION,
        "claritySchemaVersion": CLARITY_SCHEMA_VERSION,
        "checkedTasks": checked,
        "recheckedMedia": media_checked,
        "errors": errors[:100],
        "errorCount": len(errors),
        "failedAudioIds": sorted(failed_audio_ids),
    }
    if args.failures_out:
        write_json_atomic(
            args.failures_out,
            {
                "pipelineVersion": PIPELINE_VERSION,
                "claritySchemaVersion": CLARITY_SCHEMA_VERSION,
                "audioIds": sorted(failed_audio_ids),
                "errorCount": len(errors),
            },
        )
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if not errors else 1


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"ERROR: {type(error).__name__}: {error}", file=sys.stderr)
        raise SystemExit(1)
