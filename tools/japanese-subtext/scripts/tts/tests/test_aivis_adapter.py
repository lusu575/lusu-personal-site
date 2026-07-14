from __future__ import annotations

import sys
import unittest
from pathlib import Path
from typing import Any
from unittest import mock


TTS_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(TTS_DIR))

from aivis_adapter import (  # noqa: E402
    AivisAdapter,
    PIPELINE_FINGERPRINT,
    mora_phoneme_sequence,
    restore_prepared_query_rate,
    retime_prepared_query,
    validate_kana_reading,
)


MODEL_UUIDS = (
    "22e8ed77-94fe-4ef2-871f-a86f94e9a579",
    "a59cb814-0083-4369-8542-f51a29e72af7",
    "71e72188-2726-4739-9aa9-39567396fb2a",
    "47e53151-a378-46f3-abee-ce13aa07feb1",
)


def model_config() -> list[dict[str, str]]:
    return [
        {
            "uuid": uuid,
            "version": f"1.{index}.0",
            "sha256": str(index + 1) * 64,
            "license": "ACML-1.0",
        }
        for index, uuid in enumerate(MODEL_UUIDS)
    ]


def accent_phrases(*phonemes: tuple[str | None, str]) -> list[dict[str, Any]]:
    return [
        {
            "moras": [
                {
                    "text": f"mora-{index}",
                    "consonant": consonant,
                    "consonant_length": 0.05 if consonant else None,
                    "vowel": vowel,
                    "vowel_length": 0.1,
                    "pitch": 5.5,
                }
                for index, (consonant, vowel) in enumerate(phonemes)
            ],
            "accent": 1,
            "pause_mora": None,
            "is_interrogative": False,
        }
    ]


class FakeAivisApi:
    def __init__(self) -> None:
        self.calls: list[tuple[str, str, dict[str, Any], Any]] = []
        self.reading_phrases = accent_phrases(("ky", "o"), (None, "o"), ("w", "a"))
        self.surface_phrases = accent_phrases(("x", "x"))

    def __call__(
        self,
        method: str,
        path: str,
        *,
        params: dict[str, Any] | None = None,
        body: Any = None,
        expect_binary: bool = False,
    ) -> Any:
        self.calls.append((method, path, dict(params or {}), body))
        if path == "/version":
            return "1.2.0"
        if path == "/supported_devices":
            return {"cpu": True, "cuda": False, "dml": True}
        if path == "/aivm_models":
            return {
                item["uuid"]: {
                    "is_loaded": True,
                    "file_size": 100 + index,
                    "manifest": {
                        "name": f"model-{index}",
                        "version": item["version"],
                        "license": "# Aivis Common Model License (ACML) 1.0",
                        "speakers": [{"uuid": f"speaker-{index}"}],
                    },
                }
                for index, item in enumerate(model_config())
            }
        if path == "/speakers":
            return [
                {
                    "speaker_uuid": f"speaker-{index}",
                    "styles": [
                        {"name": "ノーマル", "id": index * 10 + 1},
                        {"name": "Calm", "id": index * 10 + 2},
                    ],
                }
                for index in range(4)
            ]
        if path == "/audio_query":
            return {
                "accent_phrases": self.surface_phrases,
                "speedScale": 1.0,
                "pitchScale": 0.0,
                "intonationScale": 1.0,
                "volumeScale": 1.0,
                "prePhonemeLength": 0.1,
                "postPhonemeLength": 0.1,
                "pauseLength": None,
                "pauseLengthScale": 1.0,
                "outputSamplingRate": 44100,
                "outputStereo": False,
                "kana": "surface-kana",
            }
        if path == "/accent_phrases":
            return self.reading_phrases
        if path == "/synthesis" and expect_binary:
            return b"RIFF-test-wave"
        raise AssertionError(f"unexpected Aivis API request: {method} {path}")


class AivisAdapterTests(unittest.TestCase):
    def make_adapter(self, api: FakeAivisApi) -> AivisAdapter:
        return AivisAdapter(
            base_url="http://127.0.0.1:10103",
            engine_version="1.2.0",
            models=model_config(),
            voices={
                "voice-a": {
                    "modelUuid": MODEL_UUIDS[0],
                    "styleName": "Calm",
                    "speedScale": 0.95,
                    "pitchScale": 0.01,
                    "intonationScale": 1.08,
                    "volumeScale": 1.0,
                    "prePhonemeLength": 0.08,
                    "postPhonemeLength": 0.12,
                }
            },
            request=api,
            verify_model_files=False,
        )

    def test_pipeline_fingerprint_and_checked_model_manifest_are_v3(self) -> None:
        self.assertEqual(PIPELINE_FINGERPRINT, "aivisspeech-1.2.0-aivmx-v3")
        manifest = __import__("json").loads(
            (TTS_DIR / "model-files.sha256.json").read_text(encoding="utf-8")
        )
        self.assertEqual(manifest["pipeline"], PIPELINE_FINGERPRINT)

    def test_resolves_style_from_model_uuid_and_name_then_replaces_surface_accents(self) -> None:
        api = FakeAivisApi()
        adapter = self.make_adapter(api)

        prepared = adapter.prepare_query(
            surface="今日は晴れです。",
            reading="きょうははれです。",
            voice_key="voice-a",
        )

        post_calls = [call for call in api.calls if call[0] == "POST"]
        self.assertEqual([call[1] for call in post_calls], ["/audio_query", "/accent_phrases"])
        self.assertEqual(post_calls[0][2], {"text": "今日は晴れです。", "speaker": 2})
        self.assertEqual(
            post_calls[1][2],
            {"text": "きょうははれです。", "speaker": 2, "is_kana": False},
        )
        self.assertEqual(prepared.query["accent_phrases"], api.reading_phrases)
        self.assertEqual(prepared.query["kana"], prepared.surface)
        self.assertEqual(prepared.query["outputSamplingRate"], 44_100)
        self.assertIs(prepared.query["outputStereo"], False)
        self.assertEqual(prepared.query["speedScale"], 0.95)
        self.assertEqual(prepared.query_parameters["kanaSource"], "surface")
        self.assertEqual(prepared.style_id, 2)
        self.assertEqual(prepared.model_uuid, MODEL_UUIDS[0])
        self.assertEqual(prepared.style_name, "Calm")
        self.assertEqual(prepared.mora_phonemes, ("ky:o", "o", "w:a"))

    def test_punctuation_structure_mismatch_uses_reviewed_reading_as_aivis_kana(self) -> None:
        api = FakeAivisApi()
        adapter = self.make_adapter(api)

        prepared = adapter.prepare_query(
            surface="今日はちょっと……。",
            reading="きょうはちょっと",
            voice_key="voice-a",
        )

        self.assertEqual(prepared.query["kana"], "きょうはちょっと")
        self.assertEqual(
            prepared.query_parameters["kanaSource"],
            "reviewed-reading-fallback",
        )
        output = TTS_DIR.parents[1] / "audio" / ".work" / "tests" / "aivis-punctuation.wav"
        output.unlink(missing_ok=True)
        try:
            adapter.synthesize_prepared(prepared, output)
            self.assertEqual(output.read_bytes(), b"RIFF-test-wave")
        finally:
            output.unlink(missing_ok=True)

    def test_synthesis_uses_the_exact_prepared_query(self) -> None:
        api = FakeAivisApi()
        adapter = self.make_adapter(api)
        prepared = adapter.prepare_query("今日。", "きょう。", "voice-a")
        output = TTS_DIR.parents[1] / "audio" / ".work" / "tests" / "aivis-sample.wav"
        output.unlink(missing_ok=True)
        try:
            self.assertEqual(adapter.synthesize_prepared(prepared, output), output)
            self.assertEqual(output.read_bytes(), b"RIFF-test-wave")
        finally:
            output.unlink(missing_ok=True)

        synthesis = [call for call in api.calls if call[1] == "/synthesis"]
        self.assertEqual(len(synthesis), 1)
        self.assertEqual(synthesis[0][2], {"speaker": 2})
        self.assertIs(synthesis[0][3], prepared.query)

    def test_synthesis_write_failure_preserves_an_existing_lossless_source(self) -> None:
        api = FakeAivisApi()
        adapter = self.make_adapter(api)
        prepared = adapter.prepare_query("\u4eca\u65e5\u3002", "\u304d\u3087\u3046\u3002", "voice-a")
        root = TTS_DIR.parents[1] / "audio" / ".work" / "tests"
        output = root / "aivis-atomic.wav"
        root.mkdir(parents=True, exist_ok=True)
        output.write_bytes(b"previous-good-wave")
        try:
            with (
                mock.patch("aivis_adapter.os.replace", side_effect=OSError("replace failed")),
                self.assertRaisesRegex(OSError, "replace failed"),
            ):
                adapter.synthesize_prepared(prepared, output)
            self.assertEqual(output.read_bytes(), b"previous-good-wave")
            self.assertEqual(list(root.glob("*.aivis-candidate*.wav")), [])
        finally:
            output.unlink(missing_ok=True)

    def test_teaching_rate_retimes_queries_above_the_calibration_target(self) -> None:
        api = FakeAivisApi()
        adapter = self.make_adapter(api)
        prepared = adapter.prepare_query("今日。", "きょう。", "voice-a")

        unchanged = retime_prepared_query(prepared, observed_mora_rate=6.5)
        adjusted = retime_prepared_query(prepared, observed_mora_rate=8.4)

        self.assertIs(unchanged, prepared)
        self.assertEqual(adjusted.query["speedScale"], 0.735119)
        self.assertEqual(adjusted.query_parameters["speedScale"], 0.735119)
        self.assertEqual(adjusted.query_parameters["configuredSpeedScale"], 0.95)
        self.assertEqual(
            adjusted.query_parameters["rateAdjustmentPolicy"],
            "post-synthesis-active-mora-rate-v3",
        )
        self.assertEqual(adjusted.rate_adjustment["observedMoraPerSecond"], 8.4)
        self.assertEqual(adjusted.rate_adjustment["maximumMoraPerSecond"], 7.2)
        self.assertEqual(adjusted.rate_adjustment["targetMoraPerSecond"], 6.5)
        self.assertNotEqual(adjusted.query, prepared.query)

        readjusted = retime_prepared_query(adjusted, observed_mora_rate=7.5)
        self.assertEqual(readjusted.query_parameters["configuredSpeedScale"], 0.95)
        self.assertEqual(readjusted.rate_adjustment["calibrationSpeedScale"], 0.735119)
        self.assertLess(readjusted.query["speedScale"], adjusted.query["speedScale"])
        restored = restore_prepared_query_rate(prepared, readjusted.rate_adjustment)
        self.assertEqual(restored.query, readjusted.query)

    def test_teaching_rate_retimes_a_7_199_baseline_but_not_6_499(self) -> None:
        api = FakeAivisApi()
        adapter = self.make_adapter(api)
        prepared = adapter.prepare_query("\u4eca\u65e5\u3002", "\u304d\u3087\u3046\u3002", "voice-a")

        unchanged = retime_prepared_query(prepared, observed_mora_rate=6.499)
        adjusted = retime_prepared_query(prepared, observed_mora_rate=7.199)

        self.assertIs(unchanged, prepared)
        self.assertIsNot(adjusted, prepared)
        self.assertEqual(adjusted.query["speedScale"], 0.857758)
        self.assertEqual(adjusted.rate_adjustment["observedMoraPerSecond"], 7.199)
        self.assertEqual(adjusted.rate_adjustment["maximumMoraPerSecond"], 7.2)
        self.assertEqual(adjusted.rate_adjustment["targetMoraPerSecond"], 6.5)
        restored = restore_prepared_query_rate(prepared, adjusted.rate_adjustment)
        self.assertEqual(restored.query, adjusted.query)

    def test_teaching_rate_rejects_an_unreachable_limit_instead_of_clamping_silently(self) -> None:
        api = FakeAivisApi()
        adapter = self.make_adapter(api)
        prepared = adapter.prepare_query("今日。", "きょう。", "voice-a")

        with self.assertRaisesRegex(ValueError, "minimum Aivis speedScale"):
            retime_prepared_query(prepared, observed_mora_rate=20.0)

    def test_recorded_rate_adjustment_restores_the_exact_query_without_resynthesis(self) -> None:
        api = FakeAivisApi()
        adapter = self.make_adapter(api)
        prepared = adapter.prepare_query("今日。", "きょう。", "voice-a")
        adjusted = retime_prepared_query(prepared, observed_mora_rate=8.4)

        restored = restore_prepared_query_rate(prepared, adjusted.rate_adjustment)

        self.assertEqual(restored.query, adjusted.query)
        self.assertEqual(restored.query_parameters, adjusted.query_parameters)
        self.assertEqual(restored.rate_adjustment, adjusted.rate_adjustment)

        damaged = {**adjusted.rate_adjustment, "configuredSpeedScale": 0.8}
        with self.assertRaisesRegex(ValueError, "configured speed"):
            restore_prepared_query_rate(prepared, damaged)
        damaged = {**adjusted.rate_adjustment, "calibrationSpeedScale": 0.5}
        with self.assertRaisesRegex(ValueError, "calibration"):
            restore_prepared_query_rate(prepared, damaged)

    def test_surface_annotation_returns_a_review_candidate_without_synthesizing(self) -> None:
        api = FakeAivisApi()
        api.reading_phrases[0]["moras"][0]["text"] = "キョ"
        api.reading_phrases[0]["moras"][1]["text"] = "オ"
        api.reading_phrases[0]["moras"][2]["text"] = "ワ"
        api.reading_phrases[0]["pause_mora"] = {
            "text": ".",
            "consonant": None,
            "consonant_length": None,
            "vowel": "pau",
            "vowel_length": 0.0,
            "pitch": 0.0,
        }
        adapter = self.make_adapter(api)

        self.assertEqual(
            adapter.propose_surface_reading("今日は。", "voice-a"),
            "キョオワ。",
        )
        calls = [call for call in api.calls if call[0] == "POST"]
        self.assertEqual([call[1] for call in calls], ["/accent_phrases"])
        self.assertEqual(
            calls[0][2],
            {"text": "今日は。", "speaker": 2, "is_kana": False},
        )

    def test_reading_rejects_kanji_ascii_and_any_unicode_digit(self) -> None:
        for invalid in ("今日", "きょうA", "きょう2", "きょう２"):
            with self.subTest(invalid=invalid), self.assertRaisesRegex(ValueError, "pure kana"):
                validate_kana_reading(invalid)
        self.assertEqual(validate_kana_reading("きょう／きょー？"), "きょう／きょー？")

    def test_every_mora_must_expose_a_nonempty_phoneme(self) -> None:
        broken = accent_phrases(("k", ""))
        with self.assertRaisesRegex(ValueError, "mora phoneme"):
            mora_phoneme_sequence(broken)

    def test_provenance_attests_four_acml_models_engine_and_cpu(self) -> None:
        api = FakeAivisApi()
        adapter = self.make_adapter(api)
        provenance = adapter.verify_provenance()

        self.assertEqual(provenance["engine"]["version"], "1.2.0")
        self.assertEqual(provenance["executionProvider"], "CPU")
        self.assertEqual(len(provenance["models"]), 4)
        self.assertTrue(all(model["license"] == "ACML-1.0" for model in provenance["models"]))
        self.assertEqual(
            {model["sha256"] for model in provenance["models"]},
            {str(index) * 64 for index in range(1, 5)},
        )

    def test_adapter_rejects_non_loopback_http_endpoints(self) -> None:
        with self.assertRaisesRegex(ValueError, "loopback"):
            AivisAdapter(
                base_url="https://example.com",
                engine_version="1.2.0",
                models=model_config(),
                voices={},
                request=FakeAivisApi(),
                verify_model_files=False,
            )


if __name__ == "__main__":
    unittest.main()
