"""Hold the generator's OS-level publication lock for a parent process."""

from __future__ import annotations

import sys
from pathlib import Path

from generate_audio import audio_root_generation_lock


def main() -> int:
    if len(sys.argv) != 2:
        raise SystemExit("usage: hold_audio_publication_lock.py <audio-root>")
    with audio_root_generation_lock(Path(sys.argv[1])):
        sys.stdout.buffer.write(b"LOCKED\n")
        sys.stdout.buffer.flush()
        sys.stdin.buffer.read(1)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
