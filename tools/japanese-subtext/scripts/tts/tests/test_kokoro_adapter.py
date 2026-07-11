from __future__ import annotations

import sys
import unittest
from pathlib import Path


TTS_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(TTS_DIR))

from kokoro_adapter import KokoroAdapter  # noqa: E402


class _FakeBackend:
    def __init__(self) -> None:
        self.calls: list[dict[str, object]] = []

    def create(self, text: str, **kwargs: object):
        self.calls.append({"text": text, **kwargs})
        return [0.0, 0.25, -0.25, 0.0], 24_000


class KokoroAdapterTests(unittest.TestCase):
    def _adapter(self) -> KokoroAdapter:
        fixture_dir = TTS_DIR.parents[1] / "audio" / ".work" / "tests"
        fixture_dir.mkdir(parents=True, exist_ok=True)
        return KokoroAdapter(
            model_path=fixture_dir / "model.onnx",
            voices_path=fixture_dir / "voices.bin",
            vocab_path=fixture_dir / "config.json",
            voices={"female-soft": {"modelVoice": "jf_alpha"}},
            backend=_FakeBackend(),
            g2p=lambda text: (f"PHONEMES:{text}", []),
            writer=lambda *_: None,
        )

    def test_synthesize_maps_public_voice_and_uses_phonemes(self) -> None:
        backend = _FakeBackend()
        writes: list[tuple[Path, list[float], int]] = []

        fixture_dir = TTS_DIR.parents[1] / "audio" / ".work" / "tests"
        fixture_dir.mkdir(parents=True, exist_ok=True)
        output = fixture_dir / "sample.wav"
        adapter = KokoroAdapter(
            model_path=fixture_dir / "model.onnx",
            voices_path=fixture_dir / "voices.bin",
            vocab_path=fixture_dir / "config.json",
            voices={"female-soft": {"modelVoice": "jf_alpha"}},
            backend=backend,
            g2p=lambda text: (f"PHONEMES:{text}", []),
            writer=lambda path, samples, rate: writes.append(
                (Path(path), list(samples), rate)
            ),
        )

        adapter.synthesize(
            "今日はいい天気ですね。",
            "female-soft",
            output,
            speed=1.05,
        )

        self.assertEqual(
            backend.calls,
            [
                {
                    "text": "PHONEMES:今日はいい天気ですね。",
                    "voice": "jf_alpha",
                    "speed": 1.05,
                    "is_phonemes": True,
                }
            ],
        )
        self.assertEqual(writes[0][0], output)
        self.assertEqual(writes[0][2], 24_000)

    def test_synthesize_rejects_invalid_request_instead_of_silently_ignoring_it(self) -> None:
        adapter = self._adapter()
        output = TTS_DIR.parents[1] / "audio" / ".work" / "tests" / "invalid.wav"

        invalid_calls = [
            (("", "female-soft", output), {}),
            (("こんにちは", "missing", output), {}),
            (("こんにちは", "female-soft", output), {"speed": 0.49}),
            (("こんにちは", "female-soft", output), {"pitch": 1.0}),
            (("こんにちは", "female-soft", output), {"emotion": "angry"}),
        ]
        for args, kwargs in invalid_calls:
            with self.subTest(args=args, kwargs=kwargs):
                with self.assertRaises(ValueError):
                    adapter.synthesize(*args, **kwargs)


if __name__ == "__main__":
    unittest.main()
