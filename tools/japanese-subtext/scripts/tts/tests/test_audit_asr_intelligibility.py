from __future__ import annotations

import hashlib
import json
import os
import sys
import types
import unittest
from unittest import mock
from pathlib import Path


TTS_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(TTS_DIR))

import audit_asr_intelligibility as audit_module  # noqa: E402
from audit_asr_intelligibility import (  # noqa: E402
    FasterWhisperTranscriber,
    Thresholds,
    _model_fingerprint,
    check_today_reading,
    detect_extra_i_tail,
    evaluate_transcript,
    japanese_similarity,
    normalize_japanese,
    select_manifest_items,
    summarize_results,
)


class DestinationSafetyTests(unittest.TestCase):
    def test_report_destination_rejects_inputs_protected_roots_and_existing_files(self) -> None:
        test_root = TTS_DIR.parents[1] / "audio" / ".work" / "tests"
        test_root.mkdir(parents=True, exist_ok=True)
        root = test_root / "asr-destination-safety"
        audio_root = root / "audio"
        model_root = root / "model"
        reports_root = root / "reports"
        audio_root.mkdir(parents=True, exist_ok=False)
        model_root.mkdir()
        reports_root.mkdir()
        manifest = audio_root / "manifest.json"
        existing = reports_root / "existing.json"
        try:
            manifest.write_text("{}", encoding="utf-8")
            existing.write_text("keep", encoding="utf-8")

            rejected = (
                manifest,
                audio_root / "report.json",
                model_root / "report.json",
                existing,
            )
            for destination in rejected:
                with self.subTest(destination=destination), self.assertRaises(ValueError):
                    audit_module._validate_report_destination(
                        destination,
                        manifest_path=manifest,
                        audio_root=audio_root,
                        model_path=model_root,
                    )

            allowed = reports_root / "new-report.json"
            self.assertEqual(
                audit_module._validate_report_destination(
                    allowed,
                    manifest_path=manifest,
                    audio_root=audio_root,
                    model_path=model_root,
                ),
                allowed.resolve(),
            )
            with self.assertRaisesRegex(ValueError, "checkpoint.*report"):
                audit_module._validate_checkpoint_destination(
                    allowed / "checkpoint",
                    manifest_path=manifest,
                    audio_root=audio_root,
                    model_path=model_root,
                    report_path=allowed,
                )
        finally:
            manifest.unlink(missing_ok=True)
            existing.unlink(missing_ok=True)
            reports_root.rmdir()
            model_root.rmdir()
            audio_root.rmdir()
            root.rmdir()


class ExitSemanticsTests(unittest.TestCase):
    def test_main_returns_one_when_report_contains_infrastructure_failures(self) -> None:
        report = {
            "summary": {
                "totals": {
                    "infraFailures": 1,
                    "strictCandidates": 0,
                }
            }
        }
        argv = [
            "--manifest",
            "manifest.json",
            "--model",
            "model",
            "--output",
            "report.json",
            "--all",
        ]
        with (
            mock.patch.object(audit_module, "run_audit", return_value=report),
            mock.patch.object(audit_module, "_write_json"),
        ):
            self.assertEqual(audit_module.main(argv), 1)

    def test_report_verdict_distinguishes_incomplete_from_review_candidates(self) -> None:
        self.assertEqual(
            audit_module._report_verdict(
                {"infraFailures": 1, "strictCandidates": 0, "reviewCandidates": 0}
            ),
            "audit-incomplete",
        )
        self.assertEqual(
            audit_module._report_verdict(
                {"infraFailures": 0, "strictCandidates": 0, "reviewCandidates": 2}
            ),
            "manual-review-candidates",
        )
        self.assertEqual(
            audit_module._report_verdict(
                {"infraFailures": 0, "strictCandidates": 0, "reviewCandidates": 0}
            ),
            "audit-passed",
        )

    def test_cli_accepts_checkpoint_directory_and_resume(self) -> None:
        report = {
            "summary": {
                "totals": {
                    "infraFailures": 0,
                    "strictCandidates": 0,
                }
            }
        }
        argv = [
            "--manifest",
            "manifest.json",
            "--model",
            "model",
            "--output",
            "report.json",
            "--all",
            "--checkpoint-dir",
            "checkpoint",
            "--resume",
        ]
        with (
            mock.patch.object(audit_module, "run_audit", return_value=report) as run,
            mock.patch.object(audit_module, "_write_json"),
        ):
            self.assertEqual(audit_module.main(argv), 0)
        parsed = run.call_args.args[0]
        self.assertEqual(parsed.checkpoint_dir, Path("checkpoint"))
        self.assertTrue(parsed.resume)


class AuditItemFailureTests(unittest.TestCase):
    def test_missing_audio_is_an_infrastructure_failure_not_a_review_candidate(self) -> None:
        class UnexpectedTranscriber:
            def transcribe(self, _path: Path):
                raise AssertionError("missing input must be rejected before ASR")

        result = audit_module._audit_one_item(
            _item("missing", "ありがとう"),
            TTS_DIR.parents[1] / "audio" / ".work" / "tests",
            UnexpectedTranscriber(),
            Thresholds(),
            reading_converter=None,
        )
        self.assertEqual(result["status"], "infra-error")
        self.assertTrue(result["infraFailure"])
        self.assertFalse(result["reviewCandidate"])
        self.assertEqual(result["failureKind"], "input")

    def test_manifest_hash_mismatch_is_an_integrity_failure(self) -> None:
        audio_root = TTS_DIR.parents[1] / "audio" / ".work" / "tests" / "asr-integrity"
        audio_path = audio_root / "level-1" / "L1-001" / "line.mp3"

        class UnexpectedTranscriber:
            def transcribe(self, _path: Path):
                raise AssertionError("hash mismatch must be rejected before ASR")

        try:
            audio_path.parent.mkdir(parents=True, exist_ok=False)
            audio_path.write_bytes(b"different")
            item = {
                **_item("line", "ありがとう"),
                "path": "level-1/L1-001/line.mp3",
            }
            result = audit_module._audit_one_item(
                item,
                audio_root,
                UnexpectedTranscriber(),
                Thresholds(),
                reading_converter=None,
            )
            self.assertEqual(result["status"], "integrity-error")
            self.assertEqual(result["failureKind"], "integrity")
            self.assertFalse(result["audio"]["manifestSha256Matches"])
        finally:
            audio_path.unlink(missing_ok=True)
            if audio_path.parent.exists():
                audio_path.parent.rmdir()
                audio_path.parent.parent.rmdir()
                audio_root.rmdir()


class CheckpointTests(unittest.TestCase):
    def test_atomic_per_item_checkpoint_can_resume_a_completed_result(self) -> None:
        test_root = TTS_DIR.parents[1] / "audio" / ".work" / "tests"
        test_root.mkdir(parents=True, exist_ok=True)
        checkpoint_dir = test_root / "asr-checkpoint"
        result = {
            "audioId": "L1-001-line-001",
            "status": "ok",
            "audio": {"sha256": "b" * 64},
            "reviewCandidate": False,
            "strictCandidate": False,
        }
        try:
            first = audit_module.CheckpointStore(
                checkpoint_dir,
                run_fingerprint="a" * 64,
                resume=False,
            )
            first.save_result(result)

            resumed = audit_module.CheckpointStore(
                checkpoint_dir,
                run_fingerprint="a" * 64,
                resume=True,
            )
            self.assertEqual(
                resumed.load_result("L1-001-line-001", actual_sha256="b" * 64),
                result,
            )
            self.assertEqual(list(checkpoint_dir.rglob("*.tmp")), [])
        finally:
            if checkpoint_dir.exists():
                for path in sorted(checkpoint_dir.rglob("*"), reverse=True):
                    if path.is_file():
                        path.unlink()
                    elif path.is_dir():
                        path.rmdir()
                checkpoint_dir.rmdir()

    def test_run_audit_resume_reuses_completed_unchanged_audio(self) -> None:
        test_root = TTS_DIR.parents[1] / "audio" / ".work" / "tests"
        test_root.mkdir(parents=True, exist_ok=True)
        root = test_root / "asr-resume-integration"
        audio_root = root / "audio"
        model_root = root / "model"
        reports_root = root / "reports"
        checkpoint_dir = reports_root / "checkpoint"
        audio_path = audio_root / "level-1" / "L1-001" / "line.mp3"
        manifest_path = audio_root / "manifest.json"
        output_path = reports_root / "report.json"
        calls = {"transcribe": 0}

        class FakeTranscriber:
            def __init__(self, *_args, **_kwargs) -> None:
                pass

            def transcribe(self, _path: Path):
                calls["transcribe"] += 1
                return "ありがとう", {"detectedLanguage": "ja"}

        try:
            audio_path.parent.mkdir(parents=True)
            model_root.mkdir(parents=True)
            reports_root.mkdir(parents=True)
            audio_path.write_bytes(b"stable-audio")
            audio_sha = hashlib.sha256(audio_path.read_bytes()).hexdigest()
            manifest_path.write_text(
                json.dumps(
                    {
                        "contentVersion": "test",
                        "items": {
                            "line": {
                                **_item("line", "ありがとう"),
                                "path": "level-1/L1-001/line.mp3",
                                "sha256": audio_sha,
                            }
                        },
                    },
                    ensure_ascii=False,
                ),
                encoding="utf-8",
            )
            for filename in ("config.json", "model.bin", "tokenizer.json", "vocabulary.txt"):
                (model_root / filename).write_bytes(filename.encode("ascii"))

            base_argv = [
                "--manifest",
                str(manifest_path),
                "--audio-root",
                str(audio_root),
                "--model",
                str(model_root),
                "--output",
                str(output_path),
                "--all",
                "--quiet",
                "--checkpoint-dir",
                str(checkpoint_dir),
            ]
            with (
                mock.patch.object(audit_module, "FasterWhisperTranscriber", FakeTranscriber),
                mock.patch.object(audit_module, "_discover_offline_reading_converter", return_value=None),
            ):
                first = audit_module.run_audit(audit_module._build_parser().parse_args(base_argv))
                resumed = audit_module.run_audit(
                    audit_module._build_parser().parse_args([*base_argv, "--resume"])
                )

            self.assertEqual(calls["transcribe"], 1)
            self.assertEqual(resumed["checkpoint"]["reusedCount"], 1)
            self.assertEqual(first["items"][0]["audioId"], resumed["items"][0]["audioId"])
        finally:
            if root.exists():
                for path in sorted(root.rglob("*"), reverse=True):
                    if path.is_file():
                        path.unlink()
                    elif path.is_dir():
                        path.rmdir()
                root.rmdir()


class JapaneseNormalizationTests(unittest.TestCase):
    def test_normalizes_width_katakana_case_and_punctuation(self) -> None:
        self.assertEqual(normalize_japanese(" ＫＹＯ、ｷｮｳ！ "), "kyoきょう")

    def test_similarity_folds_common_long_vowel_spellings(self) -> None:
        similarity = japanese_similarity("きょうです", "キョーデス。")
        self.assertLess(similarity["character"], 1.0)
        self.assertEqual(similarity["phonetic"], 1.0)
        self.assertEqual(similarity["score"], 1.0)

    def test_similarity_is_zero_for_unrelated_nonempty_text(self) -> None:
        similarity = japanese_similarity("きょうです", "まったくちがう")
        self.assertEqual(similarity["score"], 0.0)

    def test_discovers_and_uses_an_existing_offline_pykakasi_converter(self) -> None:
        class FakeKakasi:
            def convert(self, text: str):
                self.last_text = text
                return [{"hira": "とうきょうとちよだく"}]

        fake_engine = FakeKakasi()
        fake_module = types.SimpleNamespace(kakasi=lambda: fake_engine)
        with mock.patch.dict(sys.modules, {"pykakasi": fake_module}):
            converter = audit_module._discover_offline_reading_converter()

        self.assertIsNotNone(converter)
        self.assertEqual(converter.backend, "pykakasi")
        similarity = japanese_similarity(
            "とうきょうとちよだく",
            "東京都千代田区",
            reading_converter=converter,
        )
        self.assertEqual(similarity["score"], 1.0)
        self.assertTrue(similarity["comparisonAvailable"])

    def test_falls_back_to_existing_offline_fugashi_dictionary(self) -> None:
        token = types.SimpleNamespace(
            surface="東京都",
            feature=types.SimpleNamespace(kana="トウキョウト"),
        )

        class FakeTagger:
            def __call__(self, _text: str):
                return [token]

        fake_module = types.SimpleNamespace(Tagger=lambda: FakeTagger())
        with mock.patch.dict(
            sys.modules,
            {"pykakasi": None, "fugashi": fake_module},
        ):
            converter = audit_module._discover_offline_reading_converter()

        self.assertIsNotNone(converter)
        self.assertEqual(converter.backend, "fugashi")
        self.assertEqual(normalize_japanese(converter("東京都")), "とうきょうと")


class FocusedCandidateTests(unittest.TestCase):
    def test_today_accepts_hiragana_or_kanji_without_claiming_acoustic_proof(self) -> None:
        kana = check_today_reading("きょうのおひる", "きょうのお昼")
        kanji = check_today_reading("きょうのおひる", "今日のお昼")
        self.assertTrue(kana["applicable"])
        self.assertEqual(kana["status"], "recognized-kana")
        self.assertEqual(kanji["status"], "recognized-orthography")
        self.assertFalse(kanji["acousticallyProven"])

    def test_today_flags_a_dropped_ky_candidate(self) -> None:
        result = check_today_reading("きょうのおひる", "おうのおひる")
        self.assertEqual(result["status"], "possible-dropped-ky")
        self.assertTrue(result["reviewCandidate"])

    def test_today_checks_each_expected_occurrence(self) -> None:
        result = check_today_reading("きょうときょう", "きょうとおう")
        self.assertEqual(result["expectedCount"], 2)
        self.assertEqual(
            [occurrence["status"] for occurrence in result["occurrences"]],
            ["recognized-kana", "possible-dropped-ky"],
        )
        self.assertEqual(result["status"], "partially-recognized")
        self.assertTrue(result["reviewCandidate"])
        evaluated = evaluate_transcript(
            _item("L1-001-line-001", "きょうときょう"),
            "きょうとおう",
            Thresholds(),
        )
        self.assertIn("possible-dropped-ky", evaluated["candidateReasons"])

    def test_unrelated_ou_does_not_hide_a_correct_kyou_occurrence(self) -> None:
        result = check_today_reading("きょうとおもう", "おう、でもきょうとおもう")
        self.assertEqual(result["expectedCount"], 1)
        self.assertEqual(result["status"], "recognized-kana")
        self.assertFalse(result["reviewCandidate"])

    def test_tail_detection_is_strict_only_when_the_prefix_matches_exactly(self) -> None:
        exact = detect_extra_i_tail("きょうはちょっと", "きょうはちょっといい")
        latin = detect_extra_i_tail("きょうです", "きょうですi")
        near = detect_extra_i_tail("きょうはちょっと", "きょうわちょっといい")
        none = detect_extra_i_tail("おねがい", "おねがい")
        expected_i = detect_extra_i_tail(
            "ありがとうございますしょうひんをおえらびください",
            "ありがとうございますしょうひんをえらびください",
        )
        explicit_expected_i = detect_extra_i_tail("おねがい", "おねがいい")
        inserted_before_expected_i = detect_extra_i_tail(
            "ありがとうございますしょうひんをおえらびください",
            "ありがとうございますしょうひんをおおえらびください",
        )
        missing_prefix_with_extra = detect_extra_i_tail(
            "きょうはちょっと",
            "きょうはちょといい",
        )
        self.assertEqual(exact["extra"], "いい")
        self.assertTrue(exact["explicit"])
        self.assertEqual(latin["extra"], "i")
        self.assertTrue(latin["explicit"])
        self.assertFalse(near["explicit"])
        self.assertGreaterEqual(near["prefixSimilarity"], 0.8)
        self.assertIsNone(none)
        self.assertIsNone(expected_i)
        self.assertTrue(explicit_expected_i["explicit"])
        self.assertIsNone(inserted_before_expected_i)
        self.assertFalse(missing_prefix_with_extra["explicit"])
        self.assertEqual(missing_prefix_with_extra["extra"], "いい")

    def test_converted_kanji_reading_can_expose_an_explicit_extra_i_tail(self) -> None:
        class Converter:
            backend = "test-offline"

            def __call__(self, _text: str) -> str:
                return "きょうはちょっといい"

        result = evaluate_transcript(
            _item("L1-001-line-001", "きょうはちょっと"),
            "今日はちょっと良い",
            Thresholds(),
            reading_converter=Converter(),
        )
        self.assertTrue(result["strictCandidate"])
        self.assertIn("explicit-extra-i-tail", result["strictReasons"])

    def test_expected_today_disambiguates_pykakasi_konnichiwa_and_keeps_extra_tail(self) -> None:
        class AmbiguousTodayConverter:
            backend = "pykakasi"

            def __call__(self, text: str) -> str:
                return text.replace("今日は", "こんにちは")

        result = evaluate_transcript(
            _item("L1-001-line-001", "きょうはちょっと"),
            "今日はちょっといい",
            Thresholds(),
            reading_converter=AmbiguousTodayConverter(),
        )

        self.assertEqual(result["similarity"]["comparisonTranscript"], "きょうはちょっといい")
        self.assertEqual(result["todayReading"]["status"], "recognized-orthography")
        self.assertTrue(result["strictCandidate"])
        self.assertIn("explicit-extra-i-tail", result["strictReasons"])

    def test_today_disambiguation_preserves_an_earlier_native_konnichiwa(self) -> None:
        class ContextConverter:
            backend = "pykakasi"

            def __call__(self, text: str) -> str:
                return text.replace("今日は", "こんにちは")

        result = evaluate_transcript(
            _item("L1-001-line-001", "こんにちはきょうはちょっと"),
            "こんにちは。今日はちょっといい",
            Thresholds(),
            reading_converter=ContextConverter(),
        )

        self.assertEqual(
            result["similarity"]["comparisonTranscript"],
            "こんにちはきょうはちょっといい",
        )
        self.assertTrue(result["strictCandidate"])
        self.assertIn("explicit-extra-i-tail", result["strictReasons"])

    def test_today_disambiguation_does_not_rewrite_kyoukasho_prefix(self) -> None:
        class ContextConverter:
            backend = "pykakasi"

            def __call__(self, text: str) -> str:
                return text.replace("今日は", "こんにちは")

        result = evaluate_transcript(
            _item("L1-001-line-001", "きょうかしょをよむ"),
            "今日はしょをよむ",
            Thresholds(),
            reading_converter=ContextConverter(),
        )

        self.assertEqual(
            result["similarity"]["comparisonTranscript"],
            "こんにちはしょをよむ",
        )

    def test_only_explicit_tail_or_very_low_similarity_are_strict_candidates(self) -> None:
        thresholds = Thresholds(review_similarity=0.75, very_low_similarity=0.2, minimum_low_chars=5)
        moderate = evaluate_transcript(
            _item("L1-001-line-001", "きょうはちょっと"),
            "きょうはちがう",
            thresholds,
        )
        very_low = evaluate_transcript(
            _item("L1-001-line-002", "きょうはちょっと"),
            "まるでちがう",
            thresholds,
        )
        tail = evaluate_transcript(
            _item("L1-001-line-003", "きょうはちょっと"),
            "きょうはちょっといい",
            thresholds,
        )
        self.assertTrue(moderate["reviewCandidate"])
        self.assertFalse(moderate["strictCandidate"])
        self.assertTrue(very_low["strictCandidate"])
        self.assertIn("very-low-normalized-similarity", very_low["candidateReasons"])
        self.assertTrue(tail["strictCandidate"])
        self.assertIn("explicit-extra-i-tail", tail["candidateReasons"])

    def test_short_tokens_do_not_trigger_the_very_low_strict_rule(self) -> None:
        result = evaluate_transcript(
            _item("L1-001-line-001-token-001", "はい", kind="token"),
            "え",
            Thresholds(review_similarity=0.75, very_low_similarity=0.2, minimum_low_chars=5),
        )
        self.assertTrue(result["reviewCandidate"])
        self.assertFalse(result["strictCandidate"])

    def test_kanji_transcript_without_offline_reading_never_triggers_low_similarity_strict(self) -> None:
        result = evaluate_transcript(
            _item("L1-001-line-001", "とうきょうとちよだく"),
            "東京都千代田区",
            Thresholds(review_similarity=0.75, very_low_similarity=0.2, minimum_low_chars=5),
            reading_converter=None,
        )
        self.assertTrue(result["reviewCandidate"])
        self.assertFalse(result["strictCandidate"])
        self.assertFalse(result["similarity"]["comparisonAvailable"])
        self.assertIn("kanji-reading-unavailable", result["candidateReasons"])


class SelectionAndSummaryTests(unittest.TestCase):
    def setUp(self) -> None:
        self.manifest = {
            "items": {
                "a": _item("a", "ありがとう", voice="bright", kind="line"),
                "b": _item("b", "おはよう", voice="bright", kind="token"),
                "c": _item("c", "こんばんは", voice="calm", kind="line"),
                "d": _item("d", "さようなら", voice="calm", kind="option"),
                "scene": {
                    "id": "scene",
                    "type": "scene",
                    "path": "scene.mp3",
                    "sha256": "f" * 64,
                },
            }
        }

    def test_deterministic_sample_spreads_across_voice_type_strata(self) -> None:
        first = select_manifest_items(self.manifest, sample_size=3, seed="fixed-seed")
        second = select_manifest_items(self.manifest, sample_size=3, seed="fixed-seed")
        self.assertEqual([item["id"] for item in first], [item["id"] for item in second])
        self.assertEqual(len(first), 3)
        self.assertGreaterEqual(len({(item["voiceKey"], item["type"]) for item in first}), 3)

    def test_explicit_ids_preserve_request_order_and_reject_unknown_ids(self) -> None:
        selected = select_manifest_items(self.manifest, audio_ids=["d", "a"])
        self.assertEqual([item["id"] for item in selected], ["d", "a"])
        with self.assertRaisesRegex(ValueError, "unknown or unauditable audioId"):
            select_manifest_items(self.manifest, audio_ids=["scene"])
        with self.assertRaisesRegex(ValueError, "duplicate requested audioId"):
            select_manifest_items(self.manifest, audio_ids=["a", "a"])

    def test_missing_reading_kana_is_a_manifest_error_instead_of_a_silent_skip(self) -> None:
        manifest = {
            "items": {
                "legacy": {
                    "id": "legacy",
                    "type": "line",
                    "path": "level-1/L1-001/legacy.mp3",
                    "sha256": "a" * 64,
                    "voiceKey": "female-bright",
                    "modelVoice": "model:style",
                }
            }
        }
        with self.assertRaisesRegex(ValueError, "legacy.*readingKana"):
            select_manifest_items(manifest)

    def test_duplicate_manifest_audio_paths_are_rejected(self) -> None:
        manifest = {
            "items": {
                "a": _item("a", "ありがとう"),
                "b": {
                    **_item("b", "こんばんは"),
                    "path": "level-1/L1-001/a.mp3",
                },
            }
        }
        with self.assertRaisesRegex(ValueError, "duplicate manifest audio path"):
            select_manifest_items(manifest)

        case_variant = {
            "items": {
                "a": _item("a", "ありがとう"),
                "b": {
                    **_item("b", "こんばんは"),
                    "path": "LEVEL-1/L1-001/A.MP3",
                },
            }
        }
        with self.assertRaisesRegex(ValueError, "duplicate manifest audio path"):
            select_manifest_items(case_variant)

    def test_missing_manifest_sha256_is_rejected(self) -> None:
        item = _item("a", "ありがとう")
        item.pop("sha256")
        with self.assertRaisesRegex(ValueError, "a.*sha256"):
            select_manifest_items({"items": {"a": item}})

    def test_missing_voice_metadata_is_rejected(self) -> None:
        for field in ("voiceKey", "modelVoice"):
            item = _item("a", "ありがとう")
            item.pop(field)
            with self.subTest(field=field), self.assertRaisesRegex(ValueError, f"a.*{field}"):
                select_manifest_items({"items": {"a": item}})

    def test_manifest_path_traversal_is_rejected_during_schema_validation(self) -> None:
        item = _item("a", "ありがとう")
        item["path"] = "../outside.mp3"
        with self.assertRaisesRegex(ValueError, "a.*invalid manifest audio path"):
            select_manifest_items({"items": {"a": item}})

    def test_summary_is_stratified_by_voice_type_and_combination(self) -> None:
        thresholds = Thresholds(review_similarity=0.75, very_low_similarity=0.2, minimum_low_chars=5)
        results = [
            evaluate_transcript(_item("a", "ありがとう", voice="bright", kind="line"), "ありがとう", thresholds),
            evaluate_transcript(_item("b", "おはよう", voice="bright", kind="token"), "まったく", thresholds),
            evaluate_transcript(_item("c", "こんばんは", voice="calm", kind="line"), "こんばんはいい", thresholds),
            {
                "audioId": "d",
                "voiceKey": "calm",
                "type": "option",
                "status": "asr-error",
                "reviewCandidate": True,
                "strictCandidate": False,
                "candidateReasons": ["asr-error"],
            },
        ]
        summary = summarize_results(results)
        self.assertEqual(summary["totals"]["audited"], 4)
        self.assertEqual(summary["totals"]["asrErrors"], 1)
        self.assertEqual(summary["byVoice"]["bright"]["count"], 2)
        self.assertEqual(summary["byModelVoice"]["model:style"]["count"], 3)
        self.assertEqual(summary["byType"]["line"]["strictCandidateCount"], 1)
        self.assertIn("bright|token", summary["byVoiceAndType"])

    def test_summary_separates_infrastructure_failures_from_review_candidates(self) -> None:
        summary = summarize_results(
            [
                {
                    "audioId": "broken",
                    "voiceKey": "calm",
                    "type": "line",
                    "status": "infra-error",
                    "infraFailure": True,
                    "failureKind": "asr",
                    "reviewCandidate": False,
                    "strictCandidate": False,
                    "candidateReasons": [],
                }
            ]
        )
        self.assertEqual(summary["totals"]["infraFailures"], 1)
        self.assertEqual(summary["totals"]["asrErrors"], 1)
        self.assertEqual(summary["totals"]["reviewCandidates"], 0)
        self.assertEqual(summary["totals"]["successful"], 0)


class OfflineAdapterTests(unittest.TestCase):
    def test_model_fingerprint_rejects_an_incomplete_ct2_directory(self) -> None:
        model = TTS_DIR.parents[1] / "audio" / ".work" / "tests" / "asr-incomplete-model"
        model.mkdir(parents=True, exist_ok=True)
        try:
            (model / "config.json").write_text("{}", encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "missing required faster-whisper model files"):
                _model_fingerprint(model)
        finally:
            (model / "config.json").unlink(missing_ok=True)
            model.rmdir()

    def test_adapter_pins_local_cpu_int8_without_loading_real_asr_in_tests(self) -> None:
        calls: dict[str, object] = {}

        class FakeWhisperModel:
            def __init__(self, model_path: str, **kwargs: object) -> None:
                calls["modelPath"] = model_path
                calls["modelKwargs"] = kwargs

            def transcribe(self, audio_path: str, **kwargs: object):
                calls["audioPath"] = audio_path
                calls["transcribeKwargs"] = kwargs
                segments = [types.SimpleNamespace(text=" きょう"), types.SimpleNamespace(text="です ")]
                info = types.SimpleNamespace(language="ja", language_probability=0.99, duration=1.25)
                return segments, info

        fake_module = types.SimpleNamespace(WhisperModel=FakeWhisperModel)
        with (
            mock.patch.dict(sys.modules, {"faster_whisper": fake_module}),
            mock.patch.dict(
                os.environ,
                {"HF_HUB_OFFLINE": "0", "TRANSFORMERS_OFFLINE": "0"},
                clear=False,
            ),
        ):
            adapter = FasterWhisperTranscriber(Path("local-model"), cpu_threads=3, beam_size=4)
            transcript, metadata = adapter.transcribe(Path("line.mp3"))
            self.assertEqual(os.environ["HF_HUB_OFFLINE"], "1")
            self.assertEqual(os.environ["TRANSFORMERS_OFFLINE"], "1")

        self.assertEqual(calls["modelPath"], "local-model")
        self.assertEqual(
            calls["modelKwargs"],
            {"device": "cpu", "compute_type": "int8", "local_files_only": True, "cpu_threads": 3},
        )
        self.assertEqual(calls["transcribeKwargs"]["language"], "ja")
        self.assertFalse(calls["transcribeKwargs"]["vad_filter"])
        self.assertEqual(transcript, "きょうです")
        self.assertEqual(metadata["detectedLanguage"], "ja")


def _item(
    audio_id: str,
    reading: str,
    *,
    voice: str = "female-bright",
    kind: str = "line",
) -> dict[str, object]:
    return {
        "id": audio_id,
        "type": kind,
        "voiceKey": voice,
        "modelVoice": "model:style",
        "path": f"level-1/L1-001/{audio_id}.mp3",
        "readingKana": reading,
        "sha256": "a" * 64,
    }


if __name__ == "__main__":
    unittest.main()
