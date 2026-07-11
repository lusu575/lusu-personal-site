"""Recompute every published reading, phoneme, and task hash without loading ONNX."""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from dataclasses import replace
from pathlib import Path
from typing import Any, Mapping

from generate_audio import (
    PIPELINE_VERSION,
    _canonical_json,
    build_audio_tasks,
    discover_stages,
    load_local_config,
    prepare_spoken_text,
    resolve_voice,
    task_hash,
)
from kokoro_adapter import MAX_KOKORO_PHONEMES, phonemize_japanese_reading


SCRIPT_DIR = Path(__file__).resolve().parent
TOOL_ROOT = SCRIPT_DIR.parents[1]


def sha_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", required=True)
    parser.add_argument("--content-root", default=str(TOOL_ROOT / "content"))
    parser.add_argument("--manifest", default=str(TOOL_ROOT / "audio" / "manifest.json"))
    parser.add_argument("--pronunciations", default=str(TOOL_ROOT / "config" / "pronunciations.json"))
    args = parser.parse_args()

    config, config_path = load_local_config(args.config)
    manifest = json.loads(Path(args.manifest).read_text(encoding="utf-8"))
    pronunciations = json.loads(Path(args.pronunciations).read_text(encoding="utf-8")).get("entries", [])
    vocab_path = (config_path.parent / str(config["kokoro"]["config"])).resolve()
    if Path(str(config["kokoro"]["config"])).is_absolute():
        vocab_path = Path(str(config["kokoro"]["config"])).resolve()
    vocab = json.loads(vocab_path.read_text(encoding="utf-8")).get("vocab", {})
    if not isinstance(vocab, Mapping) or not vocab:
        raise ValueError("Kokoro vocabulary is missing")

    from misaki.ja import JAG2P

    g2p = JAG2P(version="pyopenjtalk")
    generator = manifest.get("generator", {})
    errors: list[str] = []
    if generator.get("pipelineVersion") != PIPELINE_VERSION:
        errors.append(f"pipeline mismatch: {generator.get('pipelineVersion')!r} != {PIPELINE_VERSION!r}")
    model_fingerprint = hashlib.sha256(
        _canonical_json({"files": generator.get("files"), "runtime": generator.get("runtime")})
    ).hexdigest()

    checked = 0
    for stage in discover_stages(args.content_root):
        for task in build_audio_tasks(stage):
            spoken_text = prepare_spoken_text(task.text, pronunciations)
            phonemes = phonemize_japanese_reading(spoken_text, g2p=g2p)
            unsupported = sorted(set(phonemes).difference(vocab))
            if unsupported:
                errors.append(f"{task.audio_id}: unsupported phonemes {unsupported!r}")
                continue
            if len(phonemes) > MAX_KOKORO_PHONEMES:
                errors.append(f"{task.audio_id}: {len(phonemes)} phonemes exceeds {MAX_KOKORO_PHONEMES}")
                continue
            resolved_key, settings = resolve_voice(config, task.voice_key)
            spoken_task = replace(task, text=spoken_text)
            expected_content_hash = task_hash(
                spoken_task,
                phonemes=phonemes,
                voice_settings={
                    "voiceKey": resolved_key,
                    **settings,
                    "output": dict(config["output"]),
                },
                model_fingerprint=model_fingerprint,
            )
            item = manifest.get("items", {}).get(task.audio_id)
            if not isinstance(item, Mapping):
                errors.append(f"{task.audio_id}: manifest item is missing")
                continue
            expected = {
                "readingSha256": sha_text(spoken_text),
                "phonemeSha256": sha_text(phonemes),
                "contentHash": expected_content_hash,
            }
            for key, value in expected.items():
                if item.get(key) != value:
                    errors.append(f"{task.audio_id}: {key} mismatch")
            checked += 1

    result: dict[str, Any] = {
        "ok": not errors,
        "pipelineVersion": PIPELINE_VERSION,
        "checkedTasks": checked,
        "errors": errors[:100],
        "errorCount": len(errors),
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if not errors else 1


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"ERROR: {type(error).__name__}: {error}", file=sys.stderr)
        raise SystemExit(1)
