"""Offline Japanese Kokoro ONNX adapter.

The module deliberately keeps the local model paths outside the public audio
manifest.  The paths enter only through ``tts.local.json`` or explicit CLI
arguments.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Callable, Mapping, Sequence


MISAKI_TO_KOKORO = (
    ("G", "gw"),
    # Order matters: raw Misaki j is the /y/ glide, while ʥ becomes Kokoro j.
    ("j", "y"),
    ("K", "kw"),
    ("ç", "hy"),
    ("ƫ", "ty"),
    ("ɕ", "sh"),
    ("ɲ", "ny"),
    ("ʥ", "j"),
    ("ʦ", "ts"),
    ("ʨ", "ch"),
    ("ᶀ", "by"),
    ("ᶁ", "dy"),
    ("ᶃ", "gy"),
    ("ᶄ", "ky"),
    ("ᶆ", "my"),
    ("ᶈ", "py"),
    ("ᶉ", "ry"),
    ("g", "ɡ"),
)
MAX_KOKORO_PHONEMES = 510


def kokoro_phonemes_from_misaki(combined: str) -> str:
    """Extract real phonemes, normalize symbols, and discard Misaki pitch metadata."""

    if not isinstance(combined, str) or not combined:
        raise ValueError("Japanese G2P returned no phonemes")
    if len(combined) % 2:
        raise ValueError("Misaki Japanese G2P returned an unbalanced phoneme/pitch sequence")
    midpoint = len(combined) // 2
    phonemes = combined[:midpoint]
    pitch = combined[midpoint:]
    if any(char not in "_^-j" for char in pitch):
        raise ValueError("Misaki Japanese G2P returned invalid pitch metadata")
    for source, replacement in MISAKI_TO_KOKORO:
        phonemes = phonemes.replace(source, replacement)
    return phonemes


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


def phonemize_japanese_reading(
    text: str,
    *,
    g2p: Callable[[str], tuple[str, object]],
    reading_resolver: Callable[[str], str] = prepare_japanese_reading,
) -> str:
    """Apply the exact shared reading/G2P/P2R path used for synthesis and audits."""

    prepared_text = reading_resolver(text)
    combined, _ = g2p(prepared_text)
    return kokoro_phonemes_from_misaki(combined)


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
        audio_trimmer: Callable[[object], object] | None = None,
        provider: str = "CPUExecutionProvider",
    ) -> None:
        self.model_path = Path(model_path)
        self.voices_path = Path(voices_path)
        self.vocab_path = Path(vocab_path)
        self.voices = {key: dict(value) for key, value in voices.items()}

        if provider != "CPUExecutionProvider":
            raise ValueError("Kokoro adapter only permits CPUExecutionProvider")
        if backend is None:
            from kokoro_onnx import Kokoro

            previous_provider = os.environ.get("ONNX_PROVIDER")
            os.environ["ONNX_PROVIDER"] = provider
            try:
                backend = Kokoro(
                    str(self.model_path),
                    str(self.voices_path),
                    vocab_config=str(self.vocab_path),
                )
            finally:
                if previous_provider is None:
                    os.environ.pop("ONNX_PROVIDER", None)
                else:
                    os.environ["ONNX_PROVIDER"] = previous_provider
        if g2p is None:
            from misaki.ja import JAG2P

            g2p = JAG2P(version="pyopenjtalk")
        if writer is None:
            import soundfile

            writer = soundfile.write
        if audio_trimmer is None:
            from kokoro_onnx.trim import trim

            audio_trimmer = trim

        self.backend = backend
        session = getattr(backend, "sess", None)
        actual_providers = session.get_providers() if session and hasattr(session, "get_providers") else [provider]
        if actual_providers != [provider]:
            raise RuntimeError(f"Kokoro runtime provider mismatch: {actual_providers!r}")
        self.execution_provider = actual_providers[0]
        self.g2p = g2p
        self.writer = writer
        self.reading_resolver = reading_resolver or prepare_japanese_reading
        self.audio_trimmer = audio_trimmer

    def prepare_reading(self, text: str) -> str:
        return self.reading_resolver(text)

    def phonemize(self, text: str) -> str:
        """Resolve a reviewed reading to the exact, validated model phonemes."""

        phonemes = phonemize_japanese_reading(
            text,
            g2p=self.g2p,
            reading_resolver=self.prepare_reading,
        )
        vocab = getattr(getattr(self.backend, "tokenizer", None), "vocab", None)
        if not isinstance(vocab, Mapping):
            raise RuntimeError("Kokoro backend does not expose its tokenizer vocabulary")
        unsupported = sorted(set(phonemes).difference(vocab))
        if unsupported:
            rendered = ", ".join(repr(char) for char in unsupported)
            raise ValueError(f"Kokoro model vocabulary has unsupported phoneme characters: {rendered}")
        if len(phonemes) > MAX_KOKORO_PHONEMES:
            raise ValueError(
                f"Kokoro phoneme input exceeds the single-batch limit: "
                f"{len(phonemes)} > {MAX_KOKORO_PHONEMES}"
            )
        return phonemes

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
        phonemes = self.phonemize(text)
        # kokoro-onnx 0.5.0's public ``create`` helper splits on ASCII
        # punctuation. Misaki's Japanese representation is one indivisible
        # ``phonemes + pitch`` sequence, so that split inserts a space before
        # the pitch suffix and makes the model emit a detached vowel after a
        # long pause. Every trainer utterance is safely below Kokoro's single
        # batch limit; use the backend's one-batch primitive to preserve the
        # sequence exactly.
        if not hasattr(self.backend, "get_voice_style") or not hasattr(self.backend, "_create_audio"):
            raise RuntimeError("Kokoro backend does not expose the required single-batch API")
        voice_style = self.backend.get_voice_style(model_voice)
        samples, sample_rate = self.backend._create_audio(
            phonemes,
            voice_style,
            float(speed),
        )
        trimmed = self.audio_trimmer(samples)
        samples = trimmed[0] if isinstance(trimmed, tuple) else trimmed
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
