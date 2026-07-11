"""Offline Japanese Kokoro ONNX adapter.

The module deliberately keeps the local model paths outside the public audio
manifest.  The paths enter only through ``tts.local.json`` or explicit CLI
arguments.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Callable, Mapping, Sequence


def prepare_japanese_reading(
    text: str,
    frontend: Callable[[str], Sequence[Mapping[str, Any]]] | None = None,
) -> str:
    """Convert Japanese surface text to an explicit kana reading before G2P."""

    if not isinstance(text, str) or not text.strip():
        raise ValueError("text must not be empty")
    if frontend is None:
        import pyopenjtalk

        frontend = pyopenjtalk.run_frontend
    pieces: list[str] = []
    for node in frontend(text.strip()):
        surface = str(node.get("string") or "")
        pronunciation = str(node.get("pron") or "")
        if str(node.get("pos") or "") == "記号":
            pieces.append(surface)
        elif pronunciation and pronunciation != "*":
            # PyOpenJTalk can append accent-boundary markers such as U+2019.
            # They are frontend metadata, not spoken characters for Misaki.
            pieces.append(pronunciation.replace("’", "").replace("'", ""))
        else:
            pieces.append(surface)
    reading = "".join(pieces).strip()
    if not reading:
        raise ValueError("Japanese reading preparation returned no text")
    return reading


class KokoroAdapter:
    """Expose the project's stable ``synthesize`` interface for Kokoro."""

    def __init__(
        self,
        *,
        model_path: Path,
        voices_path: Path,
        vocab_path: Path,
        voices: Mapping[str, Mapping[str, Any]],
        backend: Any | None = None,
        g2p: Callable[[str], tuple[str, object]] | None = None,
        writer: Callable[[str | Path, object, int], object] | None = None,
        reading_resolver: Callable[[str], str] | None = None,
    ) -> None:
        self.model_path = Path(model_path)
        self.voices_path = Path(voices_path)
        self.vocab_path = Path(vocab_path)
        self.voices = {key: dict(value) for key, value in voices.items()}

        if backend is None:
            from kokoro_onnx import Kokoro

            backend = Kokoro(
                str(self.model_path),
                str(self.voices_path),
                vocab_config=str(self.vocab_path),
            )
        if g2p is None:
            from misaki.ja import JAG2P

            g2p = JAG2P(version="pyopenjtalk")
        if writer is None:
            import soundfile

            writer = soundfile.write

        self.backend = backend
        self.g2p = g2p
        self.writer = writer
        self.reading_resolver = reading_resolver or prepare_japanese_reading

    def prepare_reading(self, text: str) -> str:
        return self.reading_resolver(text)

    def synthesize(
        self,
        text: str,
        voice_key: str,
        output_path: str | Path,
        speed: float = 1.0,
        pitch: float = 0.0,
        emotion: str | None = None,
        seed: int | None = None,
    ) -> Path:
        """Synthesize one Japanese utterance to a PCM WAV file."""

        if not isinstance(text, str) or not text.strip():
            raise ValueError("text must not be empty")
        if voice_key not in self.voices:
            raise ValueError(f"unknown voice key: {voice_key}")
        if not 0.5 <= float(speed) <= 2.0:
            raise ValueError("speed must be between 0.5 and 2.0")
        if float(pitch) != 0.0:
            raise ValueError("Kokoro adapter does not support non-zero pitch")
        if emotion not in (None, "", "neutral"):
            raise ValueError("Kokoro adapter only supports neutral emotion")
        if seed is not None and not isinstance(seed, int):
            raise ValueError("seed must be an integer or null")

        voice = self.voices[voice_key]
        model_voice = voice.get("modelVoice")
        if not isinstance(model_voice, str) or not model_voice:
            raise ValueError(f"voice {voice_key} is missing modelVoice")
        prepared_text = self.prepare_reading(text)
        phonemes, _ = self.g2p(prepared_text)
        if not isinstance(phonemes, str) or not phonemes.strip():
            raise ValueError("Japanese G2P returned no phonemes")
        samples, sample_rate = self.backend.create(
            phonemes,
            voice=model_voice,
            speed=float(speed),
            is_phonemes=True,
        )
        destination = Path(output_path)
        destination.parent.mkdir(parents=True, exist_ok=True)
        self.writer(destination, samples, sample_rate)
        return destination


def synthesize(
    text: str,
    voice_key: str,
    output_path: str,
    speed: float = 1.0,
    pitch: float = 0.0,
    emotion: str | None = None,
    seed: int | None = None,
    *,
    adapter: KokoroAdapter,
) -> Path:
    """Functional wrapper matching the adapter contract from the task brief."""

    return adapter.synthesize(
        text,
        voice_key,
        output_path,
        speed=speed,
        pitch=pitch,
        emotion=emotion,
        seed=seed,
    )
