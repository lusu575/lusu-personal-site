from __future__ import annotations

import sys
import unittest
from pathlib import Path


TTS_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(TTS_DIR))

from kokoro_adapter import (  # noqa: E402
    KokoroAdapter,
    kokoro_phonemes_from_misaki,
    phonemize_japanese_reading,
    prepare_japanese_reading,
)


class _FakeBackend:
    def __init__(self) -> None:
        self.create_calls: list[dict[str, object]] = []
        self.direct_calls: list[dict[str, object]] = []
        self.tokenizer = type("Tokenizer", (), {"vocab": {char: index for index, char in enumerate("kyoː?", 1)}})()
        self.sess = type("Session", (), {"get_providers": lambda _self: ["CPUExecutionProvider"]})()

    def create(self, text: str, **kwargs: object):
        self.create_calls.append({"text": text, **kwargs})
        return [0.0, 0.25, -0.25, 0.0], 24_000

    def get_voice_style(self, voice: str) -> str:
        return f"STYLE:{voice}"

    def _create_audio(self, text: str, voice: object, speed: float):
        self.direct_calls.append({"text": text, "voice": voice, "speed": speed})
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
            g2p=lambda _text: ("ᶄoː?^___", []),
            writer=lambda *_: None,
            reading_resolver=lambda text: text,
            audio_trimmer=lambda samples: (samples, None),
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
            g2p=lambda _text: ("ᶄoː?^___", []),
            writer=lambda path, samples, rate: writes.append(
                (Path(path), list(samples), rate)
            ),
            reading_resolver=lambda text: text,
            audio_trimmer=lambda samples: (samples, None),
        )

        adapter.synthesize(
            "今日はいい天気ですね。",
            "female-soft",
            output,
            speed=1.05,
        )

        self.assertEqual(
            backend.direct_calls,
            [
                {
                    "text": "kyoː?",
                    "voice": "STYLE:jf_alpha",
                    "speed": 1.05,
                }
            ],
        )
        self.assertEqual(backend.create_calls, [])
        self.assertEqual(writes[0][0], output)
        self.assertEqual(writes[0][2], 24_000)

    def test_phonemize_exposes_the_exact_validated_model_input(self) -> None:
        self.assertEqual(self._adapter().phonemize("きょう"), "kyoː?")

    def test_shared_phonemizer_applies_the_reading_resolver_before_g2p(self) -> None:
        observed: list[str] = []

        def g2p(text: str):
            observed.append(text)
            return "ᶄoː?^___", []

        self.assertEqual(
            phonemize_japanese_reading(
                "今日",
                g2p=g2p,
                reading_resolver=lambda _text: "きょう",
            ),
            "kyoː?",
        )
        self.assertEqual(observed, ["きょう"])

    def test_misaki_y_glide_is_mapped_before_affricate_j(self) -> None:
        self.assertEqual(kokoro_phonemes_from_misaki("jaʥa____"), "yaja")

    def test_prepare_japanese_reading_resolves_kanji_before_g2p(self) -> None:
        nodes = [
            {"string": "今日", "pron": "キョー", "pos": "名詞"},
            {"string": "は", "pron": "ワ’", "pos": "助詞"},
            {"string": "。", "pron": "、", "pos": "記号"},
        ]
        self.assertEqual(
            prepare_japanese_reading("今日は。", frontend=lambda _text: nodes),
            "キョーワ。",
        )

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

    def test_synthesize_rejects_any_phoneme_not_supported_by_the_model_vocab(self) -> None:
        adapter = self._adapter()
        adapter.g2p = lambda _text: ("❓a__", [])
        output = TTS_DIR.parents[1] / "audio" / ".work" / "tests" / "unknown.wav"
        with self.assertRaisesRegex(ValueError, "unsupported phoneme"):
            adapter.synthesize("未知語", "female-soft", output)

    def test_adapter_rejects_a_runtime_that_did_not_use_cpu(self) -> None:
        backend = _FakeBackend()
        backend.sess = type("Session", (), {"get_providers": lambda _self: ["CUDAExecutionProvider", "CPUExecutionProvider"]})()
        fixture_dir = TTS_DIR.parents[1] / "audio" / ".work" / "tests"
        with self.assertRaisesRegex(RuntimeError, "provider mismatch"):
            KokoroAdapter(
                model_path=fixture_dir / "model.onnx",
                voices_path=fixture_dir / "voices.bin",
                vocab_path=fixture_dir / "config.json",
                voices={"female-soft": {"modelVoice": "jf_alpha"}},
                backend=backend,
                g2p=lambda _text: ("ᶄoː?^___", []),
                writer=lambda *_: None,
                reading_resolver=lambda text: text,
                audio_trimmer=lambda samples: (samples, None),
            )

    def test_phonemize_rejects_input_the_backend_would_silently_truncate(self) -> None:
        adapter = self._adapter()
        adapter.backend.tokenizer.vocab["a"] = 99
        adapter.g2p = lambda _text: ("a" * 511 + "_" * 511, [])
        with self.assertRaisesRegex(ValueError, "single-batch limit"):
            adapter.phonemize("long")


if __name__ == "__main__":
    unittest.main()
