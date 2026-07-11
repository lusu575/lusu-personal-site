"""Batch generator for the Japanese Subtext Trainer audio library."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import time
import wave
from dataclasses import asdict, dataclass, replace
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Mapping, Sequence

from kokoro_adapter import KokoroAdapter, prepare_japanese_reading


PIPELINE_VERSION = "kokoro-ja-mp3-v2"
SCRIPT_DIR = Path(__file__).resolve().parent
TOOL_ROOT = SCRIPT_DIR.parents[1]
DEFAULT_CONFIG = TOOL_ROOT / "config" / "tts.local.json"
DEFAULT_CONTENT_ROOT = TOOL_ROOT / "content"
DEFAULT_AUDIO_ROOT = TOOL_ROOT / "audio"
DEFAULT_PRONUNCIATIONS = TOOL_ROOT / "config" / "pronunciations.json"
OFFICIAL_JAPANESE_VOICES = {
    "jf-alpha": "jf_alpha",
    "jf-gongitsune": "jf_gongitsune",
    "jf-nezumi": "jf_nezumi",
    "jf-tebukuro": "jf_tebukuro",
    "jm-kumo": "jm_kumo",
}


@dataclass(frozen=True)
class AudioTask:
    audio_id: str
    kind: str
    stage_id: str
    level: int
    text: str
    voice_key: str
    relative_path: str
    line_id: str | None = None
    token_id: str | None = None
    question_id: str | None = None
    option_id: str | None = None


def apply_pronunciations(text: str, entries: Sequence[Mapping[str, Any]]) -> str:
    """Apply longest-first literal overrides to text before Japanese G2P."""

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
        result = result.replace(surface, replacement)
    return result


def prepare_spoken_text(text: str, entries: Sequence[Mapping[str, Any]]) -> str:
    """Apply reviewed overrides, then resolve every Japanese surface to kana."""

    return prepare_japanese_reading(apply_pronunciations(text, entries))


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
        tasks.append(
            AudioTask(
                audio_id=str(line["audioId"]),
                kind="line",
                stage_id=stage_id,
                level=level,
                text=str(line.get("readingJa") or line["ttsTextJa"]),
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
            tasks.append(
                AudioTask(
                    audio_id=str(token["audioId"]),
                    kind="token",
                    stage_id=stage_id,
                    level=level,
                    text=str(token.get("reading") or token["text"]),
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
            tasks.append(
                AudioTask(
                    audio_id=str(option["audioId"]),
                    kind="option",
                    stage_id=stage_id,
                    level=level,
                    text=str(option["ttsTextJa"]),
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
    voice_settings: Mapping[str, Any],
    model_fingerprint: str,
    pipeline_fingerprint: str = PIPELINE_VERSION,
) -> str:
    """Hash every input that can affect a single audio artifact."""

    payload = {
        "task": asdict(task),
        "voice": dict(voice_settings),
        "model": model_fingerprint,
        "pipeline": pipeline_fingerprint,
    }
    return hashlib.sha256(_canonical_json(payload)).hexdigest()


def count_tasks(tasks: Iterable[AudioTask]) -> dict[str, int]:
    counts = {"line": 0, "option": 0, "token": 0}
    for task in tasks:
        counts[task.kind] = counts.get(task.kind, 0) + 1
    return counts


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

    if not item or item.get("contentHash") != expected_hash:
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
    temporary = destination.with_suffix(destination.suffix + ".tmp")
    with temporary.open("w", encoding="utf-8", newline="\n") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    os.replace(temporary, destination)


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
    if config.get("adapter") != "kokoro-onnx":
        raise ValueError("this generator requires adapter='kokoro-onnx'")
    for key in ("ffmpeg", "ffprobe", "kokoro", "output", "voices"):
        if key not in config:
            raise ValueError(f"local TTS config is missing {key!r}")
    validate_runtime_config(config)
    return config, config_path


def validate_runtime_config(config: Mapping[str, Any]) -> None:
    kokoro = config.get("kokoro", {})
    output = config.get("output", {})
    voices = config.get("voices", {})
    if kokoro.get("g2p") != "pyopenjtalk":
        raise ValueError("Kokoro Japanese G2P must be pyopenjtalk")
    if kokoro.get("provider") != "CPUExecutionProvider":
        raise ValueError("Kokoro provider must be CPUExecutionProvider")
    expected_output = {
        "format": "mp3",
        "sampleRate": 24_000,
        "channels": 1,
        "bitrate": "64k",
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
    if not isinstance(voices, Mapping) or set(voices) != set(OFFICIAL_JAPANESE_VOICES):
        raise ValueError("voices must contain exactly the five official Japanese voice keys")
    for key, model_voice in OFFICIAL_JAPANESE_VOICES.items():
        settings = voices[key]
        if not isinstance(settings, Mapping) or settings.get("modelVoice") != model_voice:
            raise ValueError(f"official Japanese voice mapping is invalid: {key}")
        speed = float(settings.get("speed", 1.0))
        if not 0.5 <= speed <= 2.0:
            raise ValueError(f"voice speed is invalid: {key}")
        if float(settings.get("pitch", 0.0)) != 0.0:
            raise ValueError(f"voice pitch must be zero: {key}")
        if settings.get("emotion", "neutral") != "neutral":
            raise ValueError(f"voice emotion must be neutral: {key}")
    aliases = config.get("voiceAliases", {})
    if not isinstance(aliases, Mapping) or any(
        target not in OFFICIAL_JAPANESE_VOICES for target in aliases.values()
    ):
        raise ValueError("every voice alias must target an official Japanese voice key")


def verify_model_files(
    config: Mapping[str, Any],
    config_path: str | Path,
) -> tuple[dict[str, dict[str, Any]], str]:
    """Verify local model assets against the checked-in SHA-256 manifest."""

    base = Path(config_path).resolve().parent
    kokoro = config["kokoro"]
    hash_manifest_path = _resolve_path(str(kokoro["hashManifest"]), base)
    hash_manifest = read_json(hash_manifest_path)
    expected_files = hash_manifest.get("files", {})
    results: dict[str, dict[str, Any]] = {}
    for role in ("model", "voices", "config"):
        local_path = _resolve_path(str(kokoro[role]), base)
        expected = expected_files.get(role)
        if not isinstance(expected, Mapping):
            raise ValueError(f"hash manifest is missing role {role!r}")
        if not local_path.is_file():
            raise FileNotFoundError(f"Kokoro {role} file not found: {local_path}")
        actual_size = local_path.stat().st_size
        actual_hash = file_sha256(local_path)
        expected_hash = str(expected.get("sha256", "")).lower()
        expected_size = int(expected.get("bytes", -1))
        if actual_hash != expected_hash or actual_size != expected_size:
            raise ValueError(
                f"Kokoro {role} integrity mismatch: {local_path.name} "
                f"(sha256={actual_hash}, bytes={actual_size})"
            )
        results[role] = {
            "file": str(expected.get("file") or local_path.name),
            "sha256": actual_hash,
            "bytes": actual_size,
            "license": expected.get("license"),
        }
    fingerprint = hashlib.sha256(_canonical_json(results)).hexdigest()
    return results, fingerprint


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


def encode_mp3(
    source: str | Path,
    destination: str | Path,
    *,
    ffmpeg: str | Path,
    sample_rate: int,
    bitrate: str,
    leading_silence_ms: int = 0,
    trailing_silence_ms: int = 0,
) -> None:
    output = Path(destination)
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_suffix(".part.mp3")
    command: list[str | Path] = [
        ffmpeg,
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        source,
    ]
    if leading_silence_ms or trailing_silence_ms:
        command.extend(
            [
                "-af",
                (
                    f"adelay={leading_silence_ms}:all=1,"
                    f"apad=pad_dur={trailing_silence_ms / 1000:.6f}"
                ),
            ]
        )
    command.extend(
        [
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
            temporary,
        ]
    )
    run_command(command, label="MP3 encoding")
    if not temporary.is_file() or temporary.stat().st_size <= 0:
        raise RuntimeError(f"MP3 encoder produced no output: {temporary}")
    os.replace(temporary, output)


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


def _public_voice_manifest(config: Mapping[str, Any]) -> dict[str, Any]:
    voices: dict[str, Any] = {}
    aliases = config.get("voiceAliases", {})
    for requested in sorted(set(config.get("voices", {})) | set(aliases)):
        target, settings = resolve_voice(config, requested)
        voices[requested] = {
            "voiceKey": target,
            "modelVoice": settings.get("modelVoice"),
            "speed": float(settings.get("speed", 1.0)),
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
    ffprobe: str | Path,
) -> dict[str, Any]:
    metadata = probe_audio(absolute_path, ffprobe)
    if metadata["codec"] != "mp3":
        raise RuntimeError(f"expected MP3 output for {audio_id}; got {metadata['codec']}")
    if metadata["sampleRate"] != 24_000 or metadata["channels"] != 1:
        raise RuntimeError(f"invalid output format for {audio_id}: {metadata}")
    return {
        "id": audio_id,
        "type": kind,
        "stageId": stage_id,
        "level": level,
        "voiceKey": voice_key,
        "modelVoice": model_voice,
        "path": relative_path.replace("\\", "/"),
        "contentHash": content_hash,
        "sha256": file_sha256(absolute_path),
        **metadata,
    }


def _ensure_normalized_cache(
    *,
    text: str,
    resolved_voice_key: str,
    voice_settings: Mapping[str, Any],
    artifact_hash: str,
    adapter: KokoroAdapter,
    work_root: Path,
    output_settings: Mapping[str, Any],
    ffmpeg: str | Path,
    keep_raw: bool,
    force: bool = False,
) -> Path:
    sample_rate = int(output_settings["sampleRate"])
    cache = work_root / "cache" / f"{artifact_hash}.wav"
    if not force and _valid_pcm_wav(cache, sample_rate):
        return cache
    raw = work_root / "raw" / f"{artifact_hash}.wav"
    adapter.synthesize(
        text,
        resolved_voice_key,
        raw,
        speed=float(voice_settings.get("speed", 1.0)),
        pitch=float(voice_settings.get("pitch", 0.0)),
        emotion=voice_settings.get("emotion"),
        seed=voice_settings.get("seed"),
    )
    normalize_wav(
        raw,
        cache,
        ffmpeg=ffmpeg,
        sample_rate=sample_rate,
        target_lufs=float(output_settings.get("targetLufs", -18)),
    )
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
) -> str:
    payload = {
        "stageId": stage["id"],
        "contentHash": stage.get("contentHash"),
        "lines": [
            {
                "id": line["id"],
                "audioId": line["audioId"],
                "pauseAfterMs": line.get("pauseAfterMs"),
                "artifactHash": line_hash,
            }
            for line, line_hash in zip(stage.get("lines", []), line_hashes, strict=True)
        ],
        "output": dict(output_settings),
        "model": model_fingerprint,
        "pipeline": PIPELINE_VERSION,
    }
    return hashlib.sha256(_canonical_json(payload)).hexdigest()


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
    adapter: KokoroAdapter,
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
    contexts: list[dict[str, Any]] = []
    line_hashes: list[str] = []

    for task in tasks:
        resolved_key, voice_settings = resolve_voice(config, task.voice_key)
        spoken_text = prepare_spoken_text(task.text, pronunciations)
        spoken_task = replace(task, text=spoken_text)
        artifact_hash = task_hash(
            spoken_task,
            voice_settings={
                "voiceKey": resolved_key,
                **voice_settings,
                "output": dict(output_settings),
            },
            model_fingerprint=model_fingerprint,
        )
        context = {
            "task": spoken_task,
            "requestedVoiceKey": task.voice_key,
            "resolvedVoiceKey": resolved_key,
            "voice": voice_settings,
            "hash": artifact_hash,
        }
        contexts.append(context)
        if task.kind == "line":
            line_hashes.append(artifact_hash)

    scene_hash = _scene_hash(stage, line_hashes, output_settings, model_fingerprint)
    scene_id = str(stage["audio"]["sceneAudioId"])
    prefix = f"level-{level}/{stage_id}"
    scene_relative = f"{prefix}/scene.mp3"
    timeline_relative = f"{prefix}/timeline.json"
    need_scene = force or not (
        manifest_item_is_current(items.get(scene_id), scene_hash, audio_root)
        and _timeline_is_current(stage_entries.get(stage_id), scene_hash, audio_root)
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
        current = not force and manifest_item_is_current(existing, artifact_hash, audio_root)
        needs_cache = task.kind == "line" and need_scene
        cache = work_root / "cache" / f"{artifact_hash}.wav"
        if current and (not needs_cache or _valid_pcm_wav(cache, sample_rate)):
            if task.kind == "line" and needs_cache:
                line_wavs[task.audio_id] = cache
            reused += 1
            logger.write("reused", audioId=task.audio_id, stageId=stage_id)
            continue

        def create_cache() -> Path:
            return _ensure_normalized_cache(
                text=task.text,
                resolved_voice_key=context["resolvedVoiceKey"],
                voice_settings=context["voice"],
                artifact_hash=artifact_hash,
                adapter=adapter,
                work_root=work_root,
                output_settings=output_settings,
                ffmpeg=ffmpeg,
                keep_raw=keep_raw,
                force=force,
            )

        cache = with_retries(
            create_cache,
            retries=retries,
            logger=logger,
            audio_id=task.audio_id,
        )
        if task.kind == "line":
            line_wavs[task.audio_id] = cache
        if current:
            reused += 1
            logger.write("reused-after-cache", audioId=task.audio_id, stageId=stage_id)
            continue

        output_path = audio_root / task.relative_path

        def create_mp3() -> None:
            encode_mp3(
                cache,
                output_path,
                ffmpeg=ffmpeg,
                sample_rate=sample_rate,
                bitrate=str(output_settings["bitrate"]),
                leading_silence_ms=leading_ms,
                trailing_silence_ms=trailing_ms,
            )

        with_retries(
            create_mp3,
            retries=retries,
            logger=logger,
            audio_id=task.audio_id,
        )
        items[task.audio_id] = _audio_item(
            audio_id=task.audio_id,
            kind=task.kind,
            stage_id=stage_id,
            level=level,
            voice_key=context["requestedVoiceKey"],
            model_voice=str(context["voice"]["modelVoice"]),
            relative_path=task.relative_path,
            content_hash=artifact_hash,
            absolute_path=output_path,
            ffprobe=ffprobe,
        )
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

        def create_scene_mp3() -> None:
            encode_mp3(
                scene_wav,
                scene_path,
                ffmpeg=ffmpeg,
                sample_rate=sample_rate,
                bitrate=str(output_settings["bitrate"]),
            )

        with_retries(
            create_scene_mp3,
            retries=retries,
            logger=logger,
            audio_id=scene_id,
        )
        write_json_atomic(timeline_path, timeline_data)
        model_voices = sorted(
            {
                str(context["voice"]["modelVoice"])
                for context in contexts
                if context["task"].kind == "line"
            }
        )
        items[scene_id] = _audio_item(
            audio_id=scene_id,
            kind="scene",
            stage_id=stage_id,
            level=level,
            voice_key="mixed",
            model_voice=model_voices,
            relative_path=scene_relative,
            content_hash=scene_hash,
            absolute_path=scene_path,
            ffprobe=ffprobe,
        )
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
    verified_files: Mapping[str, Mapping[str, Any]],
    *,
    output_settings: Mapping[str, Any],
    pronunciations_sha256: str,
) -> dict[str, Any]:
    return {
        "name": "kokoro-onnx-offline",
        "pipelineVersion": PIPELINE_VERSION,
        "executionProvider": "CPUExecutionProvider",
        "output": dict(output_settings),
        "pronunciationsSha256": pronunciations_sha256,
        "files": dict(verified_files),
        "licenses": [
            "../scripts/tts/licenses/LICENSE-kokoro-onnx-MIT.txt",
            "../scripts/tts/licenses/LICENSE-kokoro-model-Apache-2.0.txt",
            "../scripts/tts/licenses/NOTICE-japanese-voices.md",
        ],
    }


def create_adapter(config: Mapping[str, Any], config_path: str | Path) -> KokoroAdapter:
    base = Path(config_path).resolve().parent
    kokoro = config["kokoro"]
    provider = str(kokoro.get("provider", "CPUExecutionProvider"))
    if provider != "CPUExecutionProvider":
        raise ValueError("only CPUExecutionProvider is supported by this local pipeline")
    return KokoroAdapter(
        model_path=_resolve_path(str(kokoro["model"]), base),
        voices_path=_resolve_path(str(kokoro["voices"]), base),
        vocab_path=_resolve_path(str(kokoro["config"]), base),
        voices=config["voices"],
    )


def run_smoke(
    *,
    config: Mapping[str, Any],
    config_path: Path,
    verified_files: Mapping[str, Mapping[str, Any]],
    model_fingerprint: str,
    audio_root: Path,
    text: str,
    retries: int,
    keep_raw: bool,
    force: bool,
    logger: EventLogger,
) -> dict[str, Any]:
    adapter = create_adapter(config, config_path)
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
        artifact_hash = hashlib.sha256(
            _canonical_json(
                {
                    "text": text,
                    "voiceKey": voice_key,
                    "voice": settings,
                    "output": dict(output_settings),
                    "model": model_fingerprint,
                    "pipeline": PIPELINE_VERSION,
                }
            )
        ).hexdigest()

        def create_cache() -> Path:
            return _ensure_normalized_cache(
                text=text,
                resolved_voice_key=voice_key,
                voice_settings=settings,
                artifact_hash=artifact_hash,
                adapter=adapter,
                work_root=work_root,
                output_settings=output_settings,
                ffmpeg=ffmpeg,
                keep_raw=keep_raw,
                force=force,
            )

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
        if wav_probe["codec"] not in {"pcm_s16le", "pcm_s16be"}:
            raise RuntimeError(f"smoke WAV codec is invalid for {voice_key}: {wav_probe}")
        if mp3_probe["codec"] != "mp3":
            raise RuntimeError(f"smoke MP3 codec is invalid for {voice_key}: {mp3_probe}")
        if wav_probe["sampleRate"] != sample_rate or wav_probe["channels"] != 1:
            raise RuntimeError(f"smoke WAV format is invalid for {voice_key}: {wav_probe}")
        if mp3_probe["sampleRate"] != sample_rate or mp3_probe["channels"] != 1:
            raise RuntimeError(f"smoke MP3 format is invalid for {voice_key}: {mp3_probe}")
        results[voice_key] = {
            "modelVoice": settings["modelVoice"],
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
        logger.write("smoke-generated", voiceKey=voice_key, modelVoice=settings["modelVoice"])
        print(f"SMOKE {voice_key}: {mp3_probe['durationSeconds']:.3f}s MP3")

    report = {
        "schemaVersion": 1,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "pipelineVersion": PIPELINE_VERSION,
        "text": text,
        "files": dict(verified_files),
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
) -> dict[str, Any]:
    counts = {"scene": len(stages), "line": 0, "option": 0, "token": 0}
    current = 0
    for stage in stages:
        for task in build_audio_tasks(stage):
            counts[task.kind] += 1
            resolved_key, settings = resolve_voice(config, task.voice_key)
            spoken = replace(task, text=prepare_spoken_text(task.text, pronunciations))
            artifact_hash = task_hash(
                spoken,
                voice_settings={
                    "voiceKey": resolved_key,
                    **settings,
                    "output": dict(config["output"]),
                },
                model_fingerprint=model_fingerprint,
            )
            if manifest_item_is_current(
                manifest.get("items", {}).get(task.audio_id),
                artifact_hash,
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


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate the Japanese Subtext Trainer's offline Kokoro audio library."
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
    args = parser.parse_args(argv)
    if args.retries < 0 or args.retries > 10:
        parser.error("--retries must be between 0 and 10")
    if args.smoke and (args.stage or args.level or args.batch or args.all or args.dry_run):
        parser.error("--smoke cannot be combined with stage selection or --dry-run")
    if not args.smoke and not (args.stage or args.level or args.batch or args.all):
        parser.error("choose --stage, --level, --batch, --all, or --smoke")
    return args


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)
    config, config_path = load_local_config(args.config)
    verified_files, model_fingerprint = verify_model_files(config, config_path)
    audio_root = Path(args.audio_root).resolve()
    work_root = audio_root / ".work"
    run_stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    logger = EventLogger(TOOL_ROOT / "logs" / f"tts-{run_stamp}-{os.getpid()}.jsonl")
    logger.write("start", mode="smoke" if args.smoke else "batch", pipeline=PIPELINE_VERSION)

    if args.smoke:
        run_smoke(
            config=config,
            config_path=config_path,
            verified_files=verified_files,
            model_fingerprint=model_fingerprint,
            audio_root=audio_root,
            text=args.smoke_text,
            retries=args.retries,
            keep_raw=args.keep_raw,
            force=args.force,
            logger=logger,
        )
        logger.write("complete", mode="smoke", voices=len(config["voices"]))
        print(f"PASS: five-voice smoke report: {audio_root / '.work' / 'smoke' / 'report.json'}")
        return 0

    stages = discover_stages(args.content_root)
    selected = select_stages(
        stages,
        stage_ids=args.stage,
        levels=args.level,
        batch_ranges=args.batch,
        all_stages=args.all,
    )
    if not selected:
        raise ValueError("no stages matched the selection")
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
    existing_version = str(manifest.get("contentVersion", ""))
    if manifest["items"] and existing_version != content_version:
        if not args.all or len(selected) != len(stages):
            raise ValueError(
                "audio manifest contentVersion changed; regenerate every stage with --all "
                "before publishing a mixed-version manifest"
            )
        manifest = _new_manifest(content_version, str(config.get("audioBaseUrl", "./")))
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
    adapter = create_adapter(config, config_path)
    total_generated = 0
    total_reused = 0
    for index, stage in enumerate(selected, start=1):
        print(f"[{index}/{len(selected)}] {stage['id']}")
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
        )
        total_generated += result["generated"]
        total_reused += result["reused"]
        manifest.update(
            {
                "schemaVersion": 1,
                "contentVersion": content_version,
                "generatedAt": datetime.now(timezone.utc).isoformat(),
                "audioBaseUrl": str(config.get("audioBaseUrl", "./")),
                "generator": _generator_metadata(
                    verified_files,
                    output_settings=config["output"],
                    pronunciations_sha256=pronunciations_sha256,
                ),
                "voices": _public_voice_manifest(config),
            }
        )
        _update_stats(manifest)
        write_json_atomic(manifest_path, manifest)

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


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("Interrupted.", file=sys.stderr)
        raise SystemExit(130)
    except Exception as error:
        print(f"ERROR: {type(error).__name__}: {error}", file=sys.stderr)
        raise SystemExit(1)
