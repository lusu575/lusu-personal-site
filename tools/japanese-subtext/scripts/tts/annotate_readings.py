"""Create reviewable kana readings for every spoken question-bank string."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any, Mapping, Sequence

from generate_audio import apply_pronunciations
from kokoro_adapter import prepare_japanese_reading


SCRIPT_DIR = Path(__file__).resolve().parent
TOOL_ROOT = SCRIPT_DIR.parents[1]
DEFAULT_CONTENT_ROOT = TOOL_ROOT / "content"
DEFAULT_PRONUNCIATIONS = TOOL_ROOT / "config" / "pronunciations.json"
KANJI_RE = re.compile(r"[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]")


def katakana_to_hiragana(value: str) -> str:
    return "".join(
        chr(ord(char) - 0x60) if "ァ" <= char <= "ヶ" else char
        for char in value
    )


def reviewed_reading(text: str, entries: Sequence[Mapping[str, Any]]) -> str:
    prepared = prepare_japanese_reading(apply_pronunciations(text, entries))
    reading = katakana_to_hiragana(prepared).strip()
    if not reading or KANJI_RE.search(reading):
        raise ValueError(f"unresolved Japanese reading: {text!r} -> {reading!r}")
    return reading


def annotate_batch(payload: Mapping[str, Any], entries: Sequence[Mapping[str, Any]]) -> tuple[dict[str, Any], int, list[str]]:
    output = json.loads(json.dumps(payload, ensure_ascii=False))
    changed = 0
    errors: list[str] = []
    for stage in output.get("stages", []):
        for line in stage.get("lines", []):
            if not line.get("readingJa"):
                line["readingJa"] = reviewed_reading(str(line["ttsTextJa"]), entries)
                changed += 1
            for token in line.get("tokens", []):
                if not token.get("reading"):
                    token["reading"] = reviewed_reading(str(token["text"]), entries)
                    changed += 1
        for question in stage.get("questions", []):
            for option in question.get("options", []):
                if not option.get("readingJa"):
                    try:
                        option["readingJa"] = reviewed_reading(str(option["ttsTextJa"]), entries)
                        changed += 1
                    except ValueError as error:
                        errors.append(f"{stage.get('id')}/{question.get('id')}/{option.get('id')}: {error}")
    return output, changed, errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--content-root", default=str(DEFAULT_CONTENT_ROOT))
    parser.add_argument("--pronunciations", default=str(DEFAULT_PRONUNCIATIONS))
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()

    content_root = Path(args.content_root).resolve()
    pronunciation_payload = json.loads(Path(args.pronunciations).read_text(encoding="utf-8"))
    entries = pronunciation_payload.get("entries", [])
    total_changes = 0
    changed_files = 0
    errors: list[str] = []
    pending: list[tuple[Path, dict[str, Any]]] = []
    for path in sorted(content_root.glob("level-*/batch-*.json")):
        payload = json.loads(path.read_text(encoding="utf-8"))
        annotated, changes, batch_errors = annotate_batch(payload, entries)
        errors.extend(batch_errors)
        if not changes:
            continue
        total_changes += changes
        changed_files += 1
        pending.append((path, annotated))

    if args.write and not errors:
        for path, annotated in pending:
            path.write_text(json.dumps(annotated, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(json.dumps({"files": changed_files, "readings": total_changes, "written": args.write and not errors, "errors": errors}, ensure_ascii=False, indent=2))
    return 2 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
