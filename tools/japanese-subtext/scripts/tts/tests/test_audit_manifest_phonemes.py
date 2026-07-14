from __future__ import annotations

import hashlib
import sys
import unittest
from pathlib import Path
from unittest import mock


TTS_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(TTS_DIR))

from audit_manifest_phonemes import (  # noqa: E402
    audit_manifest_media,
    audit_scene_timeline,
    compare_published_item,
    recompute_published_item,
    recompute_scene_content_hash,
)


class PublishedMediaAuditTests(unittest.TestCase):
    def setUp(self) -> None:
        self.root = TTS_DIR.parents[1] / "audio" / ".work" / "tests" / "published-audit"
        self.root.mkdir(parents=True, exist_ok=True)
        self.media = self.root / "line.mp3"
        self.media.write_bytes(b"fresh-final-mp3")
        self.probe = {
            "codec": "mp3",
            "sampleRate": 44_100,
            "channels": 1,
            "bitrate": 96_000,
            "durationSeconds": 0.7,
            "bytes": len(b"fresh-final-mp3"),
        }
        self.clarity = {
            "pass": True,
            "voicedDurationSeconds": 0.4,
            "speechRateDurationSeconds": 0.4,
            "detachedTailRisk": False,
        }

    def tearDown(self) -> None:
        self.media.unlink(missing_ok=True)

    def test_recompute_hashes_final_bytes_and_redecodes_task_media(self) -> None:
        item = {
            "id": "L1-001-line-001",
            "type": "line",
            "path": "line.mp3",
            "sha256": "0" * 64,
        }
        with (
            mock.patch("audit_manifest_phonemes.probe_audio", return_value=self.probe),
            mock.patch(
                "audit_manifest_phonemes.audit_audio_clarity",
                return_value=dict(self.clarity),
            ) as clarity_mock,
        ):
            fresh = recompute_published_item(
                item,
                audio_root=self.root,
                ffmpeg="ffmpeg",
                ffprobe="ffprobe",
                expected_mora_phonemes=("ky:o", "u"),
            )

        self.assertEqual(fresh["sha256"], hashlib.sha256(b"fresh-final-mp3").hexdigest())
        self.assertTrue(fresh["clarityAudit"]["speechRatePass"])
        clarity_mock.assert_called_once_with(
            self.media,
            "ffmpeg",
            sample_rate=44_100,
            expected_mora_phonemes=("ky:o", "u"),
            check_detached_tail=True,
        )
        self.assertTrue(any("sha256 mismatch" in error for error in compare_published_item(item, fresh)))

    def test_live_redecode_preserves_the_reviewed_hesitation_rate_band(self) -> None:
        item = {
            "id": "L4-001-line-004",
            "type": "line",
            "path": "line.mp3",
            "readingKana": "ん……。",
        }
        clarity = {
            "pass": True,
            "voicedDurationSeconds": 0.714444,
            "speechRateDurationSeconds": 0.714444,
            "detachedTailRisk": False,
        }
        with (
            mock.patch("audit_manifest_phonemes.probe_audio", return_value=self.probe),
            mock.patch("audit_manifest_phonemes.audit_audio_clarity", return_value=clarity),
        ):
            fresh = recompute_published_item(
                item,
                audio_root=self.root,
                ffmpeg="ffmpeg",
                ffprobe="ffprobe",
                expected_mora_phonemes=("N",),
            )

        self.assertEqual(fresh["clarityAudit"]["speechRateBand"], "hesitation")
        self.assertEqual(fresh["clarityAudit"]["speechRateMinimum"], 1.2)
        self.assertTrue(fresh["clarityAudit"]["speechRatePass"])

        stored = {
            **item,
            "claritySchemaVersion": 3,
            "clarityAudit": {
                **fresh["clarityAudit"],
                "speechRateBand": "short",
                "speechRateMinimum": 1.5,
            },
        }
        self.assertTrue(
            any(
                "fresh speech-rate evidence mismatch" in error
                for error in compare_published_item(stored, fresh)
            )
        )

    def test_stored_pass_cannot_hide_a_fresh_clarity_failure(self) -> None:
        stored = {
            "id": "L1-001-line-001",
            "sha256": hashlib.sha256(b"fresh-final-mp3").hexdigest(),
            "clarityAudit": {"pass": True},
        }
        fresh = {
            "sha256": stored["sha256"],
            "clarityAudit": {"pass": False},
        }
        errors = compare_published_item(stored, fresh)
        self.assertTrue(any("fresh clarity audit failed" in error for error in errors))

    def test_stored_speech_rate_claim_must_match_fresh_media(self) -> None:
        stored = {
            "id": "L1-001-line-001",
            "type": "line",
            "claritySchemaVersion": 3,
            "clarityAudit": {
                "pass": True,
                "speechRateDurationSeconds": 1.0,
                "excludedSpeechPauseMs": 0.0,
                "speechRateMoraPerSecond": 6.0,
            },
        }
        fresh = {
            "claritySchemaVersion": 3,
            "clarityAudit": {
                "pass": True,
                "speechRateDurationSeconds": 0.8,
                "excludedSpeechPauseMs": 250.0,
                "speechRateMoraPerSecond": 7.5,
            },
        }

        errors = compare_published_item(stored, fresh)

        self.assertTrue(any("fresh speech-rate evidence mismatch" in error for error in errors))

    def test_scene_redecode_disables_detached_tail_and_uses_timeline(self) -> None:
        self.media = self.root / "scene.mp3"
        self.media.write_bytes(b"scene-final-mp3")
        item = {"id": "L1-001-scene", "type": "scene", "path": "scene.mp3"}
        timeline = {
            "sampleRate": 44_100,
            "duration": 0.7,
            "cues": [
                {"audioId": "L1-001-line-001", "start": 0.06, "end": 0.25},
                {"audioId": "L1-001-line-002", "start": 0.5, "end": 0.6},
            ],
        }
        with (
            mock.patch("audit_manifest_phonemes.probe_audio", return_value=self.probe),
            mock.patch(
                "audit_manifest_phonemes.audit_audio_clarity",
                return_value=dict(self.clarity),
            ) as clarity_mock,
        ):
            fresh = recompute_published_item(
                item,
                audio_root=self.root,
                ffmpeg="ffmpeg",
                ffprobe="ffprobe",
                timeline=timeline,
            )

        clarity_mock.assert_called_once_with(
            self.media,
            "ffmpeg",
            sample_rate=44_100,
            expected_mora_phonemes=None,
            check_detached_tail=False,
        )
        self.assertTrue(fresh["clarityAudit"]["timelineAudit"]["pass"])
        self.assertTrue(fresh["clarityAudit"]["pass"])

    def test_scene_timeline_rejects_overlap_and_duration_mismatch(self) -> None:
        overlap = audit_scene_timeline(
            {
                "sampleRate": 44_100,
                "duration": 1.0,
                "cues": [
                    {"start": 0.1, "end": 0.6},
                    {"start": 0.5, "end": 0.9},
                ],
            },
            decoded_duration_seconds=1.0,
        )
        self.assertFalse(overlap["pass"])
        mismatch = audit_scene_timeline(
            {
                "sampleRate": 44_100,
                "duration": 1.0,
                "cues": [{"start": 0.1, "end": 0.9}],
            },
            decoded_duration_seconds=1.3,
        )
        self.assertFalse(mismatch["pass"])

    def test_scene_identity_recomputes_from_final_lossless_line_sources(self) -> None:
        stage = {
            "id": "L1-001",
            "contentHash": "d" * 64,
            "audio": {"sceneAudioId": "L1-001-scene"},
            "lines": [
                {
                    "id": "line-001",
                    "audioId": "L1-001-line-001",
                    "pauseAfterMs": 180,
                }
            ],
        }
        items = {
            "L1-001-line-001": {
                "contentHash": "a" * 64,
                "sourceBoundaryAudit": {"normalizedSha256": "b" * 64},
            },
            "L1-001-scene": {
                "postProcessing": {"profile": "audited-loudness-gain-v3"},
            },
        }
        first = recompute_scene_content_hash(
            stage,
            items=items,
            output_settings={"sampleRate": 44_100},
            model_fingerprint="model",
        )
        items["L1-001-line-001"]["sourceBoundaryAudit"]["normalizedSha256"] = "c" * 64
        changed = recompute_scene_content_hash(
            stage,
            items=items,
            output_settings={"sampleRate": 44_100},
            model_fingerprint="model",
        )
        self.assertNotEqual(first, changed)

    def test_manifest_media_reaudits_every_task_and_scene(self) -> None:
        timeline_path = self.root / "timeline.json"
        timeline_path.write_text(
            '{"sampleRate":44100,"duration":0.7,"cues":[{"audioId":"L1-001-line-001","start":0.06,"end":0.6}]}',
            encoding="utf-8",
        )
        manifest = {
            "items": {
                "L1-001-line-001": {
                    "id": "L1-001-line-001",
                    "type": "line",
                    "path": "line.mp3",
                },
                "L1-001-scene": {
                    "id": "L1-001-scene",
                    "type": "scene",
                    "path": "scene.mp3",
                    "contentHash": "a" * 64,
                },
            },
            "stages": {
                "L1-001": {
                    "contentHash": "a" * 64,
                    "sceneAudioId": "L1-001-scene",
                    "timelinePath": "timeline.json",
                }
            },
        }
        fresh = {"sha256": None, "clarityAudit": {"pass": True}}
        try:
            with (
                mock.patch("audit_manifest_phonemes._timeline_is_current", return_value=True),
                mock.patch(
                    "audit_manifest_phonemes.recompute_published_item",
                    return_value=fresh,
                ) as recompute,
                mock.patch("audit_manifest_phonemes.compare_published_item", return_value=[]),
            ):
                errors, failed, checked = audit_manifest_media(
                    manifest,
                    audio_root=self.root,
                    ffmpeg="ffmpeg",
                    ffprobe="ffprobe",
                    expected_mora_phonemes={"L1-001-line-001": ("ky:o", "u")},
                )

            self.assertEqual(errors, [])
            self.assertEqual(failed, set())
            self.assertEqual(checked, 2)
            self.assertEqual(recompute.call_count, 2)
            task_call, scene_call = recompute.call_args_list
            self.assertEqual(task_call.kwargs["expected_mora_phonemes"], ("ky:o", "u"))
            self.assertIsNone(task_call.kwargs["timeline"])
            self.assertIsInstance(scene_call.kwargs["timeline"], dict)
            self.assertIsNone(scene_call.kwargs["expected_mora_phonemes"])
        finally:
            timeline_path.unlink(missing_ok=True)


if __name__ == "__main__":
    unittest.main()
