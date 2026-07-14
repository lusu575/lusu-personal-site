from __future__ import annotations

import hashlib
import json
import copy
import array
import os
import shutil
import subprocess
import sys
import wave
import unittest
from pathlib import Path
from unittest import mock


TTS_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(TTS_DIR))

import generate_audio as generator_module  # noqa: E402
from aivis_adapter import PreparedAivisQuery  # noqa: E402
from generate_audio import (  # noqa: E402
    CLARITY_SCHEMA_VERSION,
    AudioRootBusyError,
    ClarityAuditError,
    PIPELINE_VERSION,
    SOURCE_BOUNDARY_SCHEMA_VERSION,
    SourceBoundaryAuditError,
    _audio_item,
    _bound_existing_scene_hash,
    _canonical_json,
    _ensure_normalized_cache,
    _generator_metadata,
    _line_generation_metadata_matches,
    _manifest_needs_full_content_migration,
    _normalization_filter,
    _promote_normalized_cache,
    _publish_validated_audio,
    _scene_hash,
    _scene_reuse_is_allowed,
    _timeline_is_current,
    _verified_lossless_line_cache,
    apply_speech_rate_audit,
    audio_root_generation_lock,
    apply_pronunciations,
    audit_audio_clarity,
    audit_source_boundaries,
    assemble_scene_wav,
    build_stage_manifest_entry,
    build_audio_tasks,
    begin_stage_media_snapshot,
    commit_stage_media,
    count_spoken_moras,
    encode_mp3,
    manifest_item_is_current,
    measure_integrated_loudness,
    plan_loudness_correction,
    load_retry_audio_ids,
    prepare_spoken_text,
    rate_policy_evidence,
    render_audio_with_clarity_retries,
    resolve_rate_limited_task,
    select_stages,
    snapshot_manifest_stage,
    stage_audio_source_projection,
    stage_audio_source_hash,
    stage_audio_ids,
    stage_scene_source_hash,
    stage_scene_source_projection,
    task_hash,
    task_artifact_identity,
    validate_runtime_config,
    write_json_atomic,
    restore_manifest_stage,
    restore_stage_media,
)


class GenerateAudioTests(unittest.TestCase):
    def setUp(self) -> None:
        self.stage = {
            "schemaVersion": 1,
            "contentVersion": "1.0.2",
            "contentHash": "d" * 64,
            "id": "L1-001",
            "revision": 1,
            "level": 1,
            "textLocked": True,
            "cast": [
                {"id": "speaker-a", "voiceKey": "female-soft"},
                {"id": "speaker-b", "voiceKey": "male-calm"},
            ],
            "lines": [
                {
                    "id": "line-001",
                    "speaker": "speaker-a",
                    "readingJa": "ぶいあーるちゃっとであいましょう。",
                    "ttsTextJa": "VRChatで会いましょう。",
                    "audioId": "L1-001-line-001",
                    "pauseAfterMs": 240,
                    "tokens": [
                        {
                            "id": "token-001",
                            "text": "VRChatで",
                            "reading": "ブイアールチャットで",
                            "audioId": "L1-001-line-001-token-001",
                        }
                    ],
                }
            ],
            "questions": [
                {
                    "id": "q1",
                    "options": [
                        {
                            "id": "a",
                            "readingJa": "いきたいです。",
                            "ttsTextJa": "行きたいです。",
                            "audioId": "L1-001-q1-a",
                        }
                    ],
                }
            ],
            "audio": {
                "sceneAudioId": "L1-001-scene",
                "timelineId": "L1-001-timeline",
                "optionVoiceKey": "male-calm",
            },
        }

    def test_build_audio_tasks_uses_stable_ids_paths_and_role_voices(self) -> None:
        tasks = build_audio_tasks(self.stage)
        by_id = {task.audio_id: task for task in tasks}

        line = by_id["L1-001-line-001"]
        self.assertEqual(line.kind, "line")
        self.assertEqual(line.text, "ぶいあーるちゃっとであいましょう。")
        self.assertEqual(line.voice_key, "female-soft")
        self.assertEqual(line.relative_path, "level-1/L1-001/lines/line-001.mp3")
        self.assertEqual(line.surface, "VRChatで会いましょう。")

        token = by_id["L1-001-line-001-token-001"]
        self.assertEqual(token.kind, "token")
        self.assertEqual(token.voice_key, "female-soft")
        self.assertEqual(
            token.relative_path,
            "level-1/L1-001/tokens/line-001-token-001.mp3",
        )
        self.assertEqual(token.surface, "VRChatで")

        option = by_id["L1-001-q1-a"]
        self.assertEqual(option.kind, "option")
        self.assertEqual(option.text, "いきたいです。")
        self.assertEqual(option.voice_key, "male-calm")
        self.assertEqual(option.relative_path, "level-1/L1-001/options/q1-a.mp3")
        self.assertEqual(option.surface, "行きたいです。")

    def test_audio_source_hash_matches_the_javascript_rebind_contract(self) -> None:
        contract = TTS_DIR.parent / "audio-source-contract.mjs"
        script = """
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
const { serializeStageAudioSource, serializeStageSceneSource } = await import(pathToFileURL(process.argv[1]).href);
const stage = JSON.parse(readFileSync(0, "utf8"));
process.stdout.write(`${serializeStageAudioSource(stage)}\n${serializeStageSceneSource(stage)}`);
"""
        result = subprocess.run(
            ["node", "--input-type=module", "-e", script, str(contract)],
            input=json.dumps(self.stage, ensure_ascii=False).encode("utf-8"),
            capture_output=True,
            check=True,
        )
        audio_actual, scene_actual = result.stdout.decode("utf-8").splitlines()
        audio_expected = _canonical_json(stage_audio_source_projection(self.stage)).decode("utf-8")
        scene_expected = _canonical_json(stage_scene_source_projection(self.stage)).decode("utf-8")
        self.assertEqual(audio_actual, audio_expected)
        self.assertEqual(scene_actual, scene_expected)
        self.assertEqual(
            hashlib.sha256(audio_actual.encode("utf-8")).hexdigest(),
            stage_audio_source_hash(self.stage),
        )
        self.assertEqual(
            hashlib.sha256(scene_actual.encode("utf-8")).hexdigest(),
            stage_scene_source_hash(self.stage),
        )

    def test_audio_source_hash_rejects_ambiguous_pause_values(self) -> None:
        for invalid in ("240", -0.5, None, True):
            changed = copy.deepcopy(self.stage)
            changed["lines"][0]["pauseAfterMs"] = invalid
            with self.assertRaisesRegex(ValueError, "non-negative integer"):
                stage_audio_source_hash(changed)
        implicit = copy.deepcopy(self.stage)
        implicit["lines"][0].pop("pauseAfterMs")
        explicit_default = copy.deepcopy(implicit)
        explicit_default["lines"][0]["pauseAfterMs"] = 180
        self.assertNotEqual(
            stage_audio_source_hash(implicit),
            stage_audio_source_hash(explicit_default),
        )

    def test_legacy_scene_identity_is_reused_only_for_the_same_scene_source(self) -> None:
        entry = {
            "contentHash": "c" * 64,
            "sceneSourceHash": stage_scene_source_hash(self.stage),
        }
        delivery_only = copy.deepcopy(self.stage)
        delivery_only["contentHash"] = "e" * 64
        delivery_only["contentVersion"] = "1.0.3"
        self.assertEqual(
            _bound_existing_scene_hash(delivery_only, entry),
            "c" * 64,
        )
        delivery_only["lines"][0]["pauseAfterMs"] += 1
        self.assertIsNone(_bound_existing_scene_hash(delivery_only, entry))

    def test_pipeline_fingerprint_identifies_aivis_engine_and_aivmx_contract(self) -> None:
        self.assertEqual(PIPELINE_VERSION, "aivisspeech-1.2.0-aivmx-v3")
        self.assertEqual(CLARITY_SCHEMA_VERSION, 3)

    def test_speech_rate_excludes_punctuation_pause_moras(self) -> None:
        self.assertEqual(count_spoken_moras(("ky:o", "o", "pau", "pau", "w:a")), 3)

    def test_build_audio_tasks_never_falls_back_from_missing_reviewed_readings(self) -> None:
        for label, mutate in [
            ("line", lambda stage: stage["lines"][0].pop("readingJa")),
            ("token", lambda stage: stage["lines"][0]["tokens"][0].pop("reading")),
            ("option", lambda stage: stage["questions"][0]["options"][0].pop("readingJa")),
        ]:
            damaged = json.loads(json.dumps(self.stage, ensure_ascii=False))
            mutate(damaged)
            with self.subTest(label=label), self.assertRaisesRegex(ValueError, "reviewed reading"):
                build_audio_tasks(damaged)

    def test_pronunciation_overrides_prefer_longest_surface(self) -> None:
        entries = [
            {"surface": "AI", "tts": "エーアイ"},
            {"surface": "VRChat", "tts": "ブイアールチャット"},
            {"surface": "VR", "tts": "ブイアール"},
        ]
        self.assertEqual(
            apply_pronunciations("VRChatとAI", entries),
            "ブイアールチャットとエーアイ",
        )

    def test_prepare_query_retries_one_transient_engine_failure(self) -> None:
        prepared = object()

        class FlakyAdapter:
            calls = 0

            def prepare_query(self, surface: str, reading: str, voice_key: str) -> object:
                self.calls += 1
                if self.calls == 1:
                    raise RuntimeError("transient local timeout")
                self.args = (surface, reading, voice_key)
                return prepared

        adapter = FlakyAdapter()
        logger = mock.Mock()
        with mock.patch("generate_audio.time.sleep") as sleep:
            result = generator_module.prepare_aivis_query_with_retries(
                adapter=adapter,
                surface="今日。",
                reading="きょう。",
                voice_key="voice-a",
                retries=3,
                logger=logger,
                audio_id="L1-001-line-001",
            )

        self.assertIs(result, prepared)
        self.assertEqual(adapter.calls, 2)
        self.assertEqual(adapter.args, ("今日。", "きょう。", "voice-a"))
        logger.write.assert_called_once()
        self.assertEqual(logger.write.call_args.args, ("retry",))
        sleep.assert_called_once_with(1)

    def test_project_today_reading_keeps_the_reviewed_kana_for_aivis(self) -> None:
        payload = json.loads(
            (TTS_DIR.parents[1] / "config" / "pronunciations.json").read_text(encoding="utf-8")
        )
        self.assertEqual(
            prepare_spoken_text("きょうのおひる", payload["entries"]),
            "きょうのおひる",
        )

    def test_project_pronunciations_cover_known_japanese_reading_edges(self) -> None:
        payload = json.loads(
            (TTS_DIR.parents[1] / "config" / "pronunciations.json").read_text(encoding="utf-8")
        )
        entries = payload["entries"]
        self.assertEqual(
            apply_pronunciations("締切時の指定は八版です。", entries),
            "しめきりじのしていは八版です。",
        )
        self.assertEqual(
            apply_pronunciations("締切時刻を誤って設定した。", entries),
            "締切時刻をあやまって設定した。",
        )
        self.assertEqual(
            apply_pronunciations("容器も後から用意した。", entries),
            "容器もあとから用意した。",
        )
        self.assertEqual(
            apply_pronunciations("午後から雨だって。", entries),
            "午後から雨だって。",
        )
        self.assertEqual(
            apply_pronunciations("しかも後の反対発言より、先のタグを優先した。", entries),
            "しかものちのはんたいはつげんより、先のタグを優先した。",
        )
        self.assertEqual(
            apply_pronunciations("昼だべ、塔の下で待ってる。", entries),
            "昼だべ、とーのもとで待ってる。",
        )
        self.assertEqual(
            apply_pronunciations("声の主は私を知らない。", entries),
            "こえのぬしは私を知らない。",
        )
        self.assertEqual(
            apply_pronunciations("座標は偽装されている。後を追うな。", entries),
            "座標は偽装されている。あとをおうな。",
        )
        self.assertEqual(
            apply_pronunciations("位置乱数の種と出力は正常です。", entries),
            "いちらんすーのたねと出力は正常です。",
        )

    def test_task_hash_changes_when_engine_model_style_or_query_changes(self) -> None:
        task = build_audio_tasks(self.stage)[0]
        base = task_hash(
            task,
            phonemes="kyoː",
            voice_settings={"modelVoice": "jf_alpha", "speed": 1.0},
            model_fingerprint="model-a",
            pipeline_fingerprint="pipeline-a",
        )
        other_voice = task_hash(
            task,
            phonemes="kyoː",
            voice_settings={"modelVoice": "jf_gongitsune", "speed": 1.0},
            model_fingerprint="model-a",
            pipeline_fingerprint="pipeline-a",
        )
        other_model = task_hash(
            task,
            phonemes="kyoː",
            voice_settings={"modelVoice": "jf_alpha", "speed": 1.0},
            model_fingerprint="model-b",
            pipeline_fingerprint="pipeline-a",
        )
        self.assertNotEqual(base, other_voice)
        self.assertNotEqual(base, other_model)
        other_query = task_hash(
            task,
            phonemes="kyoː",
            voice_settings={
                "modelVoice": "jf_alpha",
                "speed": 1.0,
                "queryParameters": {"speedScale": 0.94},
            },
            model_fingerprint="model-a",
            pipeline_fingerprint="pipeline-a",
        )
        self.assertNotEqual(base, other_query)
        other_phonemes = task_hash(
            task,
            phonemes="oː",
            voice_settings={"modelVoice": "jf_alpha", "speed": 1.0},
            model_fingerprint="model-a",
            pipeline_fingerprint="pipeline-a",
        )
        self.assertNotEqual(base, other_phonemes)

    def test_rate_limited_task_changes_only_a_fast_query_hash_and_verifies_the_result(self) -> None:
        task = build_audio_tasks(self.stage)[0]
        prepared = PreparedAivisQuery(
            surface=task.surface,
            reading=task.text,
            voice_key="kohaku-normal",
            model_uuid="22e8ed77-94fe-4ef2-871f-a86f94e9a579",
            model_version="1.1.0",
            model_sha256="a" * 64,
            style_name="normal",
            style_id=1,
            query={"speedScale": 0.88, "accent_phrases": [], "kana": task.text},
            query_parameters={"speedScale": 0.88, "kanaSource": "reviewed-reading-fallback"},
            mora_phonemes=("b:u", "i", "a", "r:u"),
            mora_sha256="b" * 64,
        )
        output = {"sampleRate": 44_100, "targetLufs": -18}
        base = task_artifact_identity(
            task,
            prepared,
            resolved_voice_key="kohaku-normal",
            output_settings=output,
            model_fingerprint="model",
        )
        post_processed = task_artifact_identity(
            task,
            prepared,
            resolved_voice_key="kohaku-normal",
            output_settings=output,
            model_fingerprint="model",
            post_processing={"profile": "audited-loudness-gain-v3"},
        )
        self.assertNotEqual(post_processed["artifactHash"], base["artifactHash"])
        self.assertEqual(post_processed["querySha256"], base["querySha256"])
        current_hashes = {base["artifactHash"]}
        calibration_calls: list[str] = []

        def audit_current(_prepared: PreparedAivisQuery) -> dict[str, object]:
            return {
                "pass": False,
                "spokenMoraCount": 4,
                "speechRateMoraPerSecond": 8.0,
                "speechRatePass": False,
            }

        def calibrate(_prepared: PreparedAivisQuery, identity: dict[str, str]) -> float:
            calibration_calls.append(identity["artifactHash"])
            return 6.55

        result = resolve_rate_limited_task(
            task,
            prepared,
            resolved_voice_key="kohaku-normal",
            output_settings=output,
            model_fingerprint="model",
            existing_item=None,
            item_is_current=lambda expected: expected in current_hashes,
            audit_current=audit_current,
            calibrate=calibrate,
        )

        self.assertNotEqual(result["identity"]["artifactHash"], base["artifactHash"])
        self.assertEqual(result["prepared"].query["speedScale"], 0.715)
        self.assertEqual(calibration_calls, [result["identity"]["artifactHash"]])
        self.assertIsNone(result["freshClarity"])

    def test_every_spoken_artifact_identity_binds_the_complete_rate_policy(self) -> None:
        task = build_audio_tasks(self.stage)[0]
        prepared = PreparedAivisQuery(
            surface=task.surface,
            reading=task.text,
            voice_key="kohaku-normal",
            model_uuid="22e8ed77-94fe-4ef2-871f-a86f94e9a579",
            model_version="1.1.0",
            model_sha256="a" * 64,
            style_name="normal",
            style_id=1,
            query={"speedScale": 0.88, "accent_phrases": [], "kana": task.text},
            query_parameters={"speedScale": 0.88, "kanaSource": "surface"},
            mora_phonemes=("b:u", "i", "a", "r:u"),
            mora_sha256="b" * 64,
        )
        kwargs = {
            "resolved_voice_key": "kohaku-normal",
            "output_settings": {"sampleRate": 44_100, "targetLufs": -18},
            "model_fingerprint": "model",
        }
        current = task_artifact_identity(task, prepared, **kwargs)
        self.assertEqual(
            rate_policy_evidence(),
            {
                "policy": "post-synthesis-active-mora-rate-v3",
                "targetMoraPerSecond": 6.5,
                "maximumCalibratedMoraPerSecond": 6.6,
                "maximumMoraPerSecond": 7.2,
                "maximumCalibrationAttempts": 6,
            },
        )
        with mock.patch.object(
            generator_module,
            "RATE_ADJUSTMENT_POLICY",
            "post-synthesis-active-mora-rate-v4",
        ):
            changed = task_artifact_identity(task, prepared, **kwargs)
        self.assertNotEqual(current["artifactHash"], changed["artifactHash"])
        self.assertEqual(current["querySha256"], changed["querySha256"])

    def test_rate_limited_task_keeps_a_current_query_at_or_below_headroom_target(self) -> None:
        task = build_audio_tasks(self.stage)[0]
        prepared = PreparedAivisQuery(
            surface=task.surface,
            reading=task.text,
            voice_key="kohaku-normal",
            model_uuid="22e8ed77-94fe-4ef2-871f-a86f94e9a579",
            model_version="1.1.0",
            model_sha256="a" * 64,
            style_name="normal",
            style_id=1,
            query={"speedScale": 0.88, "accent_phrases": [], "kana": task.text},
            query_parameters={"speedScale": 0.88, "kanaSource": "reviewed-reading-fallback"},
            mora_phonemes=("b:u", "i", "a", "r:u"),
            mora_sha256="b" * 64,
        )
        output = {"sampleRate": 44_100, "targetLufs": -18}
        base = task_artifact_identity(
            task,
            prepared,
            resolved_voice_key="kohaku-normal",
            output_settings=output,
            model_fingerprint="model",
        )
        clarity = {
            "pass": True,
            "spokenMoraCount": 4,
            "speechRateMoraPerSecond": 6.49,
            "speechRatePass": True,
        }

        result = resolve_rate_limited_task(
            task,
            prepared,
            resolved_voice_key="kohaku-normal",
            output_settings=output,
            model_fingerprint="model",
            existing_item=None,
            item_is_current=lambda expected: expected == base["artifactHash"],
            audit_current=lambda _prepared: clarity,
            calibrate=lambda *_args: self.fail("clear current media must not be recalibrated"),
        )

        self.assertIs(result["prepared"], prepared)
        self.assertEqual(result["identity"], base)
        self.assertIs(result["freshClarity"], clarity)

    def test_rate_limited_task_retimes_current_unadjusted_media_above_headroom(self) -> None:
        task = build_audio_tasks(self.stage)[0]
        prepared = PreparedAivisQuery(
            surface=task.surface,
            reading=task.text,
            voice_key="kohaku-normal",
            model_uuid="22e8ed77-94fe-4ef2-871f-a86f94e9a579",
            model_version="1.1.0",
            model_sha256="a" * 64,
            style_name="normal",
            style_id=1,
            query={"speedScale": 0.88, "accent_phrases": [], "kana": task.text},
            query_parameters={"speedScale": 0.88, "kanaSource": "reviewed-reading-fallback"},
            mora_phonemes=("b:u", "i", "a", "r:u"),
            mora_sha256="b" * 64,
        )
        output = {"sampleRate": 44_100, "targetLufs": -18}
        base = task_artifact_identity(
            task,
            prepared,
            resolved_voice_key="kohaku-normal",
            output_settings=output,
            model_fingerprint="model",
        )
        calibrated_speeds: list[float] = []

        def calibrate(candidate: PreparedAivisQuery, _identity: dict[str, str]) -> float:
            calibrated_speeds.append(float(candidate.query["speedScale"]))
            return 6.55

        result = resolve_rate_limited_task(
            task,
            prepared,
            resolved_voice_key="kohaku-normal",
            output_settings=output,
            model_fingerprint="model",
            existing_item=None,
            item_is_current=lambda expected: expected == base["artifactHash"],
            audit_current=lambda _prepared: {
                "pass": True,
                "spokenMoraCount": 4,
                "speechRateMoraPerSecond": 6.9,
                "speechRatePass": True,
            },
            calibrate=calibrate,
        )

        self.assertEqual(calibrated_speeds, [0.828985])
        self.assertEqual(result["prepared"].query["speedScale"], 0.828985)
        self.assertNotEqual(result["identity"], base)
        self.assertIsNone(result["freshClarity"])

    def test_missing_adjusted_media_recalibrates_to_the_headroom_band(self) -> None:
        task = build_audio_tasks(self.stage)[0]
        prepared = PreparedAivisQuery(
            surface=task.surface,
            reading=task.text,
            voice_key="kohaku-normal",
            model_uuid="22e8ed77-94fe-4ef2-871f-a86f94e9a579",
            model_version="1.1.0",
            model_sha256="a" * 64,
            style_name="normal",
            style_id=1,
            query={"speedScale": 0.88, "accent_phrases": [], "kana": task.text},
            query_parameters={"speedScale": 0.88, "kanaSource": "reviewed-reading-fallback"},
            mora_phonemes=("b:u", "i", "a", "r:u"),
            mora_sha256="b" * 64,
        )
        output = {"sampleRate": 44_100, "targetLufs": -18}
        base = task_artifact_identity(
            task,
            prepared,
            resolved_voice_key="kohaku-normal",
            output_settings=output,
            model_fingerprint="model",
        )
        adjusted = generator_module.retime_prepared_query(prepared, 8.0)
        adjustment = {
            **adjusted.rate_adjustment,
            "baseArtifactHash": base["artifactHash"],
            "baseQuerySha256": base["querySha256"],
        }
        calibrated_speeds: list[float] = []
        rates = iter([6.9, 6.55])

        def calibrate(candidate: PreparedAivisQuery, _identity: dict[str, str]) -> float:
            calibrated_speeds.append(float(candidate.query["speedScale"]))
            return next(rates)

        result = resolve_rate_limited_task(
            task,
            prepared,
            resolved_voice_key="kohaku-normal",
            output_settings=output,
            model_fingerprint="model",
            existing_item={"rateAdjustment": adjustment},
            item_is_current=lambda _expected: False,
            audit_current=lambda _prepared: self.fail("missing media cannot be audited"),
            calibrate=calibrate,
        )

        self.assertEqual(calibrated_speeds, [0.715, 0.67355])
        self.assertEqual(result["prepared"].query["speedScale"], 0.67355)
        self.assertIsNone(result["freshClarity"])

    def test_recorded_adjustment_with_a_stale_hard_maximum_is_not_restored(self) -> None:
        task = build_audio_tasks(self.stage)[0]
        prepared = PreparedAivisQuery(
            surface=task.surface,
            reading=task.text,
            voice_key="kohaku-normal",
            model_uuid="22e8ed77-94fe-4ef2-871f-a86f94e9a579",
            model_version="1.1.0",
            model_sha256="a" * 64,
            style_name="normal",
            style_id=1,
            query={"speedScale": 0.88, "accent_phrases": [], "kana": task.text},
            query_parameters={"speedScale": 0.88, "kanaSource": "surface"},
            mora_phonemes=("b:u", "i", "a", "r:u"),
            mora_sha256="b" * 64,
        )
        output = {"sampleRate": 44_100, "targetLufs": -18}
        base = task_artifact_identity(
            task,
            prepared,
            resolved_voice_key="kohaku-normal",
            output_settings=output,
            model_fingerprint="model",
        )
        adjusted = generator_module.retime_prepared_query(prepared, 8.0)
        stale_adjustment = {
            **adjusted.rate_adjustment,
            "baseArtifactHash": base["artifactHash"],
            "baseQuerySha256": base["querySha256"],
            "maximumMoraPerSecond": 8.0,
        }
        calibrated_speeds: list[float] = []

        result = resolve_rate_limited_task(
            task,
            prepared,
            resolved_voice_key="kohaku-normal",
            output_settings=output,
            model_fingerprint="model",
            existing_item={"rateAdjustment": stale_adjustment},
            item_is_current=lambda _expected: False,
            audit_current=lambda _prepared: self.fail("missing media cannot be audited"),
            calibrate=lambda candidate, _identity: (
                calibrated_speeds.append(float(candidate.query["speedScale"])) or 6.4
            ),
        )

        self.assertEqual(calibrated_speeds, [0.88])
        self.assertIs(result["prepared"], prepared)
        self.assertIsNone(result["prepared"].rate_adjustment)

    def test_unadjusted_7_199_baseline_retimes_before_publish_variance(self) -> None:
        task = build_audio_tasks(self.stage)[0]
        prepared = PreparedAivisQuery(
            surface=task.surface,
            reading=task.text,
            voice_key="kohaku-normal",
            model_uuid="22e8ed77-94fe-4ef2-871f-a86f94e9a579",
            model_version="1.1.0",
            model_sha256="a" * 64,
            style_name="normal",
            style_id=1,
            query={"speedScale": 0.74, "accent_phrases": [], "kana": task.text},
            query_parameters={"speedScale": 0.74, "kanaSource": "surface"},
            mora_phonemes=("b:u", "i", "a", "r:u"),
            mora_sha256="b" * 64,
        )
        observed_rates = iter([7.199, 6.55])
        calibrated_speeds: list[float] = []

        def calibrate(candidate: PreparedAivisQuery, _identity: dict[str, str]) -> float:
            calibrated_speeds.append(float(candidate.query["speedScale"]))
            return next(observed_rates)

        result = resolve_rate_limited_task(
            task,
            prepared,
            resolved_voice_key="kohaku-normal",
            output_settings={"sampleRate": 44_100, "targetLufs": -18},
            model_fingerprint="model",
            existing_item=None,
            item_is_current=lambda _expected: False,
            audit_current=lambda _prepared: self.fail("no current artifact should be audited"),
            calibrate=calibrate,
        )

        self.assertEqual(calibrated_speeds, [0.74, 0.668148])
        self.assertLessEqual(6.55, 6.6)
        self.assertEqual(result["prepared"].query["speedScale"], 0.668148)
        self.assertEqual(result["prepared"].rate_adjustment["observedMoraPerSecond"], 7.199)
        self.assertIsNone(result["freshClarity"])
        base_identity = task_artifact_identity(
            task,
            prepared,
            resolved_voice_key="kohaku-normal",
            output_settings={"sampleRate": 44_100, "targetLufs": -18},
            model_fingerprint="model",
        )
        self.assertEqual(
            result["prepared"].rate_adjustment["baseArtifactHash"],
            base_identity["artifactHash"],
        )
        self.assertEqual(
            result["prepared"].rate_adjustment["baseQuerySha256"],
            base_identity["querySha256"],
        )

        restored = resolve_rate_limited_task(
            task,
            prepared,
            resolved_voice_key="kohaku-normal",
            output_settings={"sampleRate": 44_100, "targetLufs": -18},
            model_fingerprint="model",
            existing_item={"rateAdjustment": result["prepared"].rate_adjustment},
            item_is_current=lambda expected: expected == result["identity"]["artifactHash"],
            audit_current=lambda _prepared: {
                "pass": True,
                "spokenMoraCount": 4,
                "speechRateMoraPerSecond": 7.19,
                "speechRatePass": True,
            },
            calibrate=lambda *_args: self.fail("a restored current adjustment must not recalibrate"),
        )
        self.assertEqual(restored["identity"], result["identity"])
        self.assertEqual(restored["prepared"].query, result["prepared"].query)
        self.assertEqual(
            restored["prepared"].rate_adjustment,
            result["prepared"].rate_adjustment,
        )

    def test_rate_limited_task_retimes_again_when_the_first_calibrated_query_is_still_fast(self) -> None:
        task = build_audio_tasks(self.stage)[0]
        prepared = PreparedAivisQuery(
            surface=task.surface,
            reading=task.text,
            voice_key="kohaku-normal",
            model_uuid="22e8ed77-94fe-4ef2-871f-a86f94e9a579",
            model_version="1.1.0",
            model_sha256="a" * 64,
            style_name="normal",
            style_id=1,
            query={"speedScale": 0.74, "accent_phrases": [], "kana": task.text},
            query_parameters={"speedScale": 0.74, "kanaSource": "surface"},
            mora_phonemes=("b:u", "i", "a", "r:u"),
            mora_sha256="b" * 64,
        )
        rates = iter([6.8, 6.75, 6.65, 6.55])
        current_checks = 0

        def current_once(_expected: str) -> bool:
            nonlocal current_checks
            current_checks += 1
            return current_checks == 1

        result = resolve_rate_limited_task(
            task,
            prepared,
            resolved_voice_key="kohaku-normal",
            output_settings={"sampleRate": 44_100, "targetLufs": -18},
            model_fingerprint="model",
            existing_item=None,
            item_is_current=current_once,
            audit_current=lambda _prepared: {
                "pass": False,
                "spokenMoraCount": 4,
                "speechRateMoraPerSecond": 8.0,
                "speechRatePass": False,
            },
            calibrate=lambda *_args: next(rates),
        )

        self.assertEqual(result["prepared"].query["speedScale"], 0.540953)
        self.assertEqual(result["prepared"].rate_adjustment["configuredSpeedScale"], 0.74)
        self.assertEqual(result["prepared"].rate_adjustment["calibrationSpeedScale"], 0.553437)

    def test_scene_assembly_writes_exact_gaps_and_line_cues(self) -> None:
        fixture_dir = TTS_DIR.parents[1] / "audio" / ".work" / "tests"
        fixture_dir.mkdir(parents=True, exist_ok=True)
        first = fixture_dir / "line-first.wav"
        second = fixture_dir / "line-second.wav"
        output = fixture_dir / "scene.wav"

        def write_silence(path: Path, frames: int) -> None:
            with wave.open(str(path), "wb") as wav_file:
                wav_file.setnchannels(1)
                wav_file.setsampwidth(2)
                wav_file.setframerate(44_100)
                wav_file.writeframes(b"\0\0" * frames)

        write_silence(first, 4_410)  # 0.1 s
        write_silence(second, 8_820)  # 0.2 s
        stage = {
            "id": "L1-001",
            "lines": [
                {"id": "line-001", "audioId": "L1-001-line-001", "pauseAfterMs": 250},
                {"id": "line-002", "audioId": "L1-001-line-002"},
            ],
        }

        result = assemble_scene_wav(
            stage,
            {
                "L1-001-line-001": first,
                "L1-001-line-002": second,
            },
            output,
            sample_rate=44_100,
            leading_silence_ms=60,
            trailing_silence_ms=100,
            default_gap_ms=180,
        )

        self.assertEqual(
            result["cues"],
            [
                {"lineId": "line-001", "audioId": "L1-001-line-001", "start": 0.06, "end": 0.16},
                {"lineId": "line-002", "audioId": "L1-001-line-002", "start": 0.41, "end": 0.61},
            ],
        )
        self.assertEqual(result["duration"], 0.71)

    def test_scene_hash_binds_each_final_lossless_line_source(self) -> None:
        output = {
            "format": "mp3",
            "sampleRate": 44_100,
            "channels": 1,
            "bitrate": "96k",
            "targetLufs": -18,
            "leadingSilenceMs": 60,
            "trailingSilenceMs": 100,
            "sceneGapMs": 180,
        }
        first = _scene_hash(
            self.stage,
            ["a" * 64],
            output,
            "model-fingerprint",
            line_source_sha256s=["b" * 64],
        )
        changed_source = _scene_hash(
            self.stage,
            ["a" * 64],
            output,
            "model-fingerprint",
            line_source_sha256s=["c" * 64],
        )
        self.assertNotEqual(first, changed_source)

    def test_scene_reuse_is_rejected_when_any_line_will_be_regenerated(self) -> None:
        self.assertFalse(
            _scene_reuse_is_allowed(
                force=False,
                retry_line=False,
                retry_scene=False,
                line_current_states=[True, False, True],
                scene_manifest_current=True,
                scene_clarity={"pass": True},
            )
        )

    def test_line_rate_or_post_processing_metadata_change_forces_regeneration(self) -> None:
        existing = {
            "queryParameters": {"speedScale": 0.72},
            "rateAdjustment": {"adjustedSpeedScale": 0.72},
            "postProcessing": {"profile": "audited-loudness-gain-v3"},
        }
        self.assertTrue(
            _line_generation_metadata_matches(
                existing,
                query_parameters={"speedScale": 0.72},
                rate_adjustment={"adjustedSpeedScale": 0.72},
                post_processing={"profile": "audited-loudness-gain-v3"},
            )
        )
        self.assertFalse(
            _line_generation_metadata_matches(
                existing,
                query_parameters={"speedScale": 0.70},
                rate_adjustment={"adjustedSpeedScale": 0.70},
                post_processing={"profile": "audited-loudness-gain-v3"},
            )
        )

    def test_stage_selectors_support_ids_levels_and_inclusive_ranges(self) -> None:
        stages = [
            {"id": "L1-001", "level": 1, "stage": 1},
            {"id": "L1-002", "level": 1, "stage": 2},
            {"id": "L2-001", "level": 2, "stage": 1},
            {"id": "L2-002", "level": 2, "stage": 2},
        ]
        self.assertEqual(
            [item["id"] for item in select_stages(stages, stage_ids=["L1-002"])],
            ["L1-002"],
        )
        self.assertEqual(
            [item["id"] for item in select_stages(stages, levels=[2])],
            ["L2-001", "L2-002"],
        )
        self.assertEqual(
            [
                item["id"]
                for item in select_stages(
                    stages,
                    levels=[2],
                    batch_ranges=["1:2"],
                )
            ],
            ["L2-001", "L2-002"],
        )
        self.assertEqual(
            [
                item["id"]
                for item in select_stages(
                    stages,
                    batch_ranges=["L1-002:L2-001"],
                )
            ],
            ["L1-002", "L2-001"],
        )

    def test_task_builder_rejects_path_traversal_ids(self) -> None:
        malicious = copy.deepcopy(self.stage)
        malicious["lines"][0]["id"] = "../../escape"
        with self.assertRaisesRegex(ValueError, "line ID"):
            build_audio_tasks(malicious)

    def test_resume_requires_matching_hash_and_nonempty_safe_output(self) -> None:
        fixture_dir = TTS_DIR.parents[1] / "audio" / ".work" / "tests" / "resume"
        fixture_dir.mkdir(parents=True, exist_ok=True)
        artifact = fixture_dir / "line.mp3"
        artifact.write_bytes(b"mp3")
        item = {
            "contentHash": "a" * 64,
            "path": ".work/tests/resume/line.mp3",
            "sha256": hashlib.sha256(b"mp3").hexdigest(),
            "claritySchemaVersion": CLARITY_SCHEMA_VERSION,
        }
        audio_root = TTS_DIR.parents[1] / "audio"
        self.assertTrue(manifest_item_is_current(item, "a" * 64, audio_root))
        self.assertFalse(manifest_item_is_current(item, "b" * 64, audio_root))
        stale_clarity = {**item, "claritySchemaVersion": CLARITY_SCHEMA_VERSION - 1}
        self.assertFalse(manifest_item_is_current(stale_clarity, "a" * 64, audio_root))
        artifact.write_bytes(b"corrupt")
        self.assertFalse(manifest_item_is_current(item, "a" * 64, audio_root))
        self.assertFalse(
            manifest_item_is_current(
                {"contentHash": "a" * 64, "path": "../outside.mp3"},
                "a" * 64,
                audio_root,
            )
        )

    def test_runtime_config_requires_four_acml_models_and_44100_mono_96k_output(self) -> None:
        model_uuids = [
            "22e8ed77-94fe-4ef2-871f-a86f94e9a579",
            "a59cb814-0083-4369-8542-f51a29e72af7",
            "71e72188-2726-4739-9aa9-39567396fb2a",
            "47e53151-a378-46f3-abee-ce13aa07feb1",
        ]
        models = [
            {"uuid": uuid, "version": "1.0.0", "sha256": "a" * 64, "license": "ACML-1.0"}
            for uuid in model_uuids
        ]
        voices = {
            "kohaku-normal": {
                "modelUuid": model_uuids[0],
                "styleName": "ノーマル",
                "speedScale": 1.0,
                "pitchScale": 0.0,
                "intonationScale": 1.0,
                "volumeScale": 1.0,
                "prePhonemeLength": 0.08,
                "postPhonemeLength": 0.12,
            },
        }
        config = {
            "adapter": "aivisspeech-engine",
            "aivis": {
                "baseUrl": "http://127.0.0.1:10103",
                "engineVersion": "1.2.0",
                "provider": "CPU",
                "models": models,
            },
            "output": {"format": "mp3", "sampleRate": 44100, "channels": 1, "bitrate": "96k"},
            "voices": voices,
            "voiceAliases": {"female-soft": "kohaku-normal"},
        }
        validate_runtime_config(config)
        invalid = copy.deepcopy(config)
        invalid["aivis"]["models"] = models[:3]
        with self.assertRaisesRegex(ValueError, "exactly four"):
            validate_runtime_config(invalid)
        invalid_output = {**config, "output": {**config["output"], "sampleRate": 24000}}
        with self.assertRaisesRegex(ValueError, "sampleRate"):
            validate_runtime_config(invalid_output)
        invalid_output = {**config, "output": {**config["output"], "sceneGapMs": -1}}
        with self.assertRaisesRegex(ValueError, "sceneGapMs"):
            validate_runtime_config(invalid_output)

    def test_normalization_filter_preserves_internal_pauses(self) -> None:
        audio_filter = _normalization_filter(-18)
        self.assertNotIn("stop_periods=-1", audio_filter)
        self.assertEqual(audio_filter.count("areverse"), 2)
        self.assertIn("loudnorm=I=-18", audio_filter)

    def test_clarity_audit_measures_padding_levels_clipping_and_tail_risk(self) -> None:
        sample_rate = 44_100
        samples = array.array(
            "h",
            [0] * int(sample_rate * 0.06)
            + ([1000, -1000] * 9 + [6000, -6000]) * int(sample_rate * 0.015)
            + [0] * int(sample_rate * 0.10),
        )
        completed = mock.Mock(returncode=0, stdout=samples.tobytes(), stderr=b"")
        with (
            mock.patch("generate_audio.subprocess.run", return_value=completed),
            mock.patch(
                "generate_audio.measure_integrated_loudness",
                return_value={
                    "integratedLufs": -18.2,
                    "truePeakDbtp": -2.5,
                    "loudnessRangeLu": 0.1,
                    "targetLufs": -18.0,
                },
            ),
        ):
            result = audit_audio_clarity("sample.mp3", "ffmpeg", sample_rate=sample_rate)

        self.assertTrue(result["pass"])
        self.assertGreaterEqual(result["leadingSilenceMs"], 59)
        self.assertGreaterEqual(result["trailingSilenceMs"], 99)
        self.assertEqual(result["clippingSampleRatio"], 0)
        self.assertGreaterEqual(result["crestFactorDb"], 6)
        self.assertFalse(result["detachedTailRisk"])
        self.assertFalse(result["truncationRisk"])
        self.assertTrue(result["loudnessPass"])
        self.assertEqual(result["integratedLufs"], -18.2)

    def test_clarity_audit_allows_a_147ms_sokuon_closure(self) -> None:
        sample_rate = 44_100

        def voiced(milliseconds: int) -> list[int]:
            length = int(sample_rate * milliseconds / 1000)
            return [
                6000 if index % 200 == 0 else (1000 if index % 2 == 0 else -1000)
                for index in range(length)
            ]

        samples = array.array(
            "h",
            [0] * int(sample_rate * 0.06)
            + voiced(350)
            + [0] * int(sample_rate * 0.147)
            + voiced(280)
            + [0] * int(sample_rate * 0.10),
        )
        completed = mock.Mock(returncode=0, stdout=samples.tobytes(), stderr=b"")
        with (
            mock.patch("generate_audio.subprocess.run", return_value=completed),
            mock.patch(
                "generate_audio.measure_integrated_loudness",
                return_value={
                    "integratedLufs": -18.0,
                    "truePeakDbtp": -2.5,
                    "loudnessRangeLu": 0.1,
                    "targetLufs": -18.0,
                },
            ),
        ):
            result = audit_audio_clarity(
                "sokuon.mp3",
                "ffmpeg",
                sample_rate=sample_rate,
                expected_mora_phonemes=("m:o", "o", "cl", "i", "p:a", "i"),
            )

        self.assertTrue(result["pass"])
        self.assertFalse(result["detachedTailRisk"])
        self.assertTrue(result["expectedSokuonClosure"])

    def test_clarity_audit_rejects_an_isolated_tail_after_250ms_silence(self) -> None:
        sample_rate = 44_100

        def voiced(milliseconds: int) -> list[int]:
            length = int(sample_rate * milliseconds / 1000)
            return [
                6000 if index % 200 == 0 else (1000 if index % 2 == 0 else -1000)
                for index in range(length)
            ]

        samples = array.array(
            "h",
            [0] * int(sample_rate * 0.06)
            + voiced(420)
            + [0] * int(sample_rate * 0.25)
            + voiced(70)
            + [0] * int(sample_rate * 0.10),
        )
        completed = mock.Mock(returncode=0, stdout=samples.tobytes(), stderr=b"")
        with (
            mock.patch("generate_audio.subprocess.run", return_value=completed),
            mock.patch(
                "generate_audio.measure_integrated_loudness",
                return_value={
                    "integratedLufs": -18.0,
                    "truePeakDbtp": -2.5,
                    "loudnessRangeLu": 0.1,
                    "targetLufs": -18.0,
                },
            ),
        ):
            result = audit_audio_clarity(
                "detached-tail.mp3",
                "ffmpeg",
                sample_rate=sample_rate,
                expected_mora_phonemes=("m:o", "o", "cl", "i"),
            )

        self.assertFalse(result["pass"])
        self.assertTrue(result["detachedTailRisk"])
        self.assertTrue(result["expectedSokuonClosure"])

    def test_scene_clarity_disables_detached_tail_for_timeline_pauses(self) -> None:
        sample_rate = 44_100

        def voiced(milliseconds: int) -> list[int]:
            length = int(sample_rate * milliseconds / 1000)
            return [
                6000 if index % 200 == 0 else (1000 if index % 2 == 0 else -1000)
                for index in range(length)
            ]

        samples = array.array(
            "h",
            [0] * int(sample_rate * 0.06)
            + voiced(420)
            + [0] * int(sample_rate * 0.25)
            + voiced(70)
            + [0] * int(sample_rate * 0.10),
        )
        completed = mock.Mock(returncode=0, stdout=samples.tobytes(), stderr=b"")
        with (
            mock.patch("generate_audio.subprocess.run", return_value=completed),
            mock.patch(
                "generate_audio.measure_integrated_loudness",
                return_value={
                    "integratedLufs": -18.0,
                    "truePeakDbtp": -2.5,
                    "loudnessRangeLu": 0.1,
                    "targetLufs": -18.0,
                },
            ),
        ):
            result = audit_audio_clarity(
                "scene.mp3",
                "ffmpeg",
                sample_rate=sample_rate,
                check_detached_tail=False,
            )

        self.assertTrue(result["pass"])
        self.assertFalse(result["detachedTailCheckEnabled"])
        self.assertTrue(result["detachedTailObserved"])
        self.assertFalse(result["detachedTailRisk"])

    def test_clarity_audit_rejects_encoded_media_outside_the_lufs_tolerance(self) -> None:
        sample_rate = 44_100
        samples = array.array(
            "h",
            [0] * int(sample_rate * 0.06)
            + ([1000, -1000] * 9 + [6000, -6000]) * int(sample_rate * 0.015)
            + [0] * int(sample_rate * 0.10),
        )
        completed = mock.Mock(returncode=0, stdout=samples.tobytes(), stderr=b"")
        with (
            mock.patch("generate_audio.subprocess.run", return_value=completed),
            mock.patch(
                "generate_audio.measure_integrated_loudness",
                return_value={
                    "integratedLufs": -20.5,
                    "truePeakDbtp": -4.0,
                    "loudnessRangeLu": 0.2,
                    "targetLufs": -18.0,
                },
            ),
        ):
            result = audit_audio_clarity("quiet.mp3", "ffmpeg", sample_rate=sample_rate)

        self.assertFalse(result["pass"])
        self.assertFalse(result["loudnessPass"])
        self.assertEqual(result["loudnessToleranceLufs"], 1.5)

    def test_clarity_audit_rejects_true_peak_above_minus_two_dbtp(self) -> None:
        sample_rate = 44_100
        samples = array.array(
            "h",
            [0] * int(sample_rate * 0.06)
            + ([1000, -1000] * 9 + [6000, -6000]) * int(sample_rate * 0.015)
            + [0] * int(sample_rate * 0.10),
        )
        completed = mock.Mock(returncode=0, stdout=samples.tobytes(), stderr=b"")
        with (
            mock.patch("generate_audio.subprocess.run", return_value=completed),
            mock.patch(
                "generate_audio.measure_integrated_loudness",
                return_value={
                    "integratedLufs": -18.0,
                    "truePeakDbtp": -1.0,
                    "loudnessRangeLu": 0.2,
                    "targetLufs": -18.0,
                },
            ),
        ):
            result = audit_audio_clarity("hot.mp3", "ffmpeg", sample_rate=sample_rate)

        self.assertTrue(result["loudnessPass"])
        self.assertFalse(result["pass"])

    def test_every_teaching_utterance_including_short_tokens_has_a_7_2_mora_limit(self) -> None:
        too_fast = {
            "pass": True,
            "voicedDurationSeconds": 0.1,
            "speechRateDurationSeconds": 0.1,
        }
        apply_speech_rate_audit(too_fast, 2)
        self.assertEqual(too_fast["speechRateBand"], "short")
        self.assertEqual(too_fast["speechRateMaximum"], 7.2)
        self.assertFalse(too_fast["speechRatePass"])
        self.assertFalse(too_fast["pass"])

        acceptable = {
            "pass": True,
            "voicedDurationSeconds": 0.3,
            "speechRateDurationSeconds": 0.3,
        }
        apply_speech_rate_audit(acceptable, 2)
        self.assertEqual(acceptable["speechRateBand"], "short")
        self.assertEqual(acceptable["speechRateMaximum"], 7.2)
        self.assertTrue(acceptable["speechRatePass"])
        self.assertTrue(acceptable["pass"])

        five_mora_token = {
            "pass": True,
            "voicedDurationSeconds": 2.22,
            "speechRateDurationSeconds": 2.22,
        }
        apply_speech_rate_audit(five_mora_token, 5)
        self.assertEqual(five_mora_token["speechRateBand"], "short")
        self.assertTrue(five_mora_token["speechRatePass"])

        six_mora_utterance = {
            "pass": True,
            "voicedDurationSeconds": 2.5,
            "speechRateDurationSeconds": 2.5,
        }
        apply_speech_rate_audit(six_mora_utterance, 6)
        self.assertEqual(six_mora_utterance["speechRateBand"], "standard")
        self.assertEqual(six_mora_utterance["speechRateMaximum"], 7.2)
        self.assertFalse(six_mora_utterance["speechRatePass"])

        l1_036_line_006 = {
            "pass": True,
            "voicedDurationSeconds": 3.682653,
            "speechRateDurationSeconds": 3.022653,
        }
        apply_speech_rate_audit(l1_036_line_006, 23)
        self.assertGreater(l1_036_line_006["speechRateMoraPerSecond"], 7.6)
        self.assertFalse(l1_036_line_006["speechRatePass"])

    def test_one_mora_hesitation_has_a_narrow_natural_lower_rate_band(self) -> None:
        hesitation = {
            "pass": True,
            "voicedDurationSeconds": 0.714444,
            "speechRateDurationSeconds": 0.714444,
        }
        apply_speech_rate_audit(hesitation, 1, reading_kana="ん……。")
        self.assertEqual(hesitation["speechRateBand"], "hesitation")
        self.assertEqual(hesitation["speechRateMinimum"], 1.2)
        self.assertEqual(hesitation["speechRateMaximum"], 7.2)
        self.assertTrue(hesitation["speechRatePass"])
        self.assertTrue(hesitation["pass"])

        ordinary_short_word = {
            "pass": True,
            "voicedDurationSeconds": 0.714444,
            "speechRateDurationSeconds": 0.714444,
        }
        apply_speech_rate_audit(ordinary_short_word, 1, reading_kana="め。")
        self.assertEqual(ordinary_short_word["speechRateBand"], "short")
        self.assertEqual(ordinary_short_word["speechRateMinimum"], 1.5)
        self.assertFalse(ordinary_short_word["speechRatePass"])

        two_mora_interjection = {
            "pass": True,
            "voicedDurationSeconds": 1.5,
            "speechRateDurationSeconds": 1.5,
        }
        apply_speech_rate_audit(two_mora_interjection, 2, reading_kana="うん。")
        self.assertEqual(two_mora_interjection["speechRateBand"], "short")
        self.assertEqual(two_mora_interjection["speechRateMinimum"], 1.5)
        self.assertFalse(two_mora_interjection["speechRatePass"])

        too_slow_hesitation = {
            "pass": True,
            "voicedDurationSeconds": 0.9,
            "speechRateDurationSeconds": 0.9,
        }
        apply_speech_rate_audit(too_slow_hesitation, 1, reading_kana="ん……。")
        self.assertFalse(too_slow_hesitation["speechRatePass"])

    def test_speech_rate_excludes_long_internal_pauses_that_hide_fast_delivery(self) -> None:
        sample_rate = 44_100
        active = [1800, -1800] * int(sample_rate * 0.2)
        samples = array.array(
            "h",
            [0] * int(sample_rate * 0.06)
            + active
            + [0] * int(sample_rate * 0.66)
            + active
            + [0] * int(sample_rate * 0.10),
        )
        completed = mock.Mock(returncode=0, stdout=samples.tobytes(), stderr=b"")
        with (
            mock.patch("generate_audio.subprocess.run", return_value=completed),
            mock.patch(
                "generate_audio.measure_integrated_loudness",
                return_value={
                    "integratedLufs": -18.0,
                    "truePeakDbtp": -3.0,
                    "loudnessRangeLu": 0.2,
                    "targetLufs": -18.0,
                    "loudnessMeasurementMode": "integrated-lufs",
                },
            ),
        ):
            clarity = audit_audio_clarity(
                "paused.mp3",
                "ffmpeg",
                sample_rate=sample_rate,
                expected_mora_phonemes=["k", "a", "k", "a", "k", "a"],
            )

        self.assertGreaterEqual(clarity["excludedSpeechPauseMs"], 650)
        self.assertEqual(clarity["speechPauseThresholdMs"], 250)
        self.assertAlmostEqual(
            clarity["speechRateDurationSeconds"],
            clarity["voicedDurationSeconds"] - clarity["excludedSpeechPauseMs"] / 1000,
            places=3,
        )
        apply_speech_rate_audit(clarity, 6)
        self.assertGreater(clarity["speechRateMoraPerSecond"], 7.2)
        self.assertFalse(clarity["speechRatePass"])
        self.assertFalse(clarity["pass"])

    def test_speech_rate_pause_policy_keeps_240ms_and_excludes_250ms(self) -> None:
        sample_rate = 44_100
        active = [1800, -1800] * int(sample_rate * 0.15)
        loudness = {
            "integratedLufs": -18.0,
            "truePeakDbtp": -3.0,
            "loudnessRangeLu": 0.2,
            "targetLufs": -18.0,
            "loudnessMeasurementMode": "integrated-lufs",
        }
        for gap_ms, should_exclude in ((240, False), (250, True)):
            with self.subTest(gap_ms=gap_ms):
                samples = array.array(
                    "h",
                    [0] * int(sample_rate * 0.06)
                    + active
                    + [0] * int(sample_rate * gap_ms / 1000)
                    + active
                    + [0] * int(sample_rate * 0.10),
                )
                completed = mock.Mock(returncode=0, stdout=samples.tobytes(), stderr=b"")
                with (
                    mock.patch("generate_audio.subprocess.run", return_value=completed),
                    mock.patch(
                        "generate_audio.measure_integrated_loudness",
                        return_value=loudness,
                    ),
                ):
                    clarity = audit_audio_clarity(
                        "pause-boundary.mp3",
                        "ffmpeg",
                        sample_rate=sample_rate,
                        expected_mora_phonemes=["k", "a"],
                    )

                self.assertEqual(clarity["speechPauseThresholdMs"], 250)
                if should_exclude:
                    self.assertGreaterEqual(clarity["excludedSpeechPauseMs"], 250)
                else:
                    self.assertEqual(clarity["excludedSpeechPauseMs"], 0)

    def test_speech_rate_detects_a_250ms_pause_misaligned_with_10ms_frames(self) -> None:
        sample_rate = 44_100
        left = [1800, -1800] * int(sample_rate * 0.1525)
        right = [1800, -1800] * int(sample_rate * 0.15)
        samples = array.array(
            "h",
            [0] * int(sample_rate * 0.06)
            + left
            + [0] * int(sample_rate * 0.25)
            + right
            + [0] * int(sample_rate * 0.10),
        )
        completed = mock.Mock(returncode=0, stdout=samples.tobytes(), stderr=b"")
        with (
            mock.patch("generate_audio.subprocess.run", return_value=completed),
            mock.patch(
                "generate_audio.measure_integrated_loudness",
                return_value={
                    "integratedLufs": -18.0,
                    "truePeakDbtp": -3.0,
                    "loudnessRangeLu": 0.2,
                    "targetLufs": -18.0,
                    "loudnessMeasurementMode": "integrated-lufs",
                },
            ),
        ):
            clarity = audit_audio_clarity(
                "misaligned-pause.mp3",
                "ffmpeg",
                sample_rate=sample_rate,
                expected_mora_phonemes=["k", "a"],
            )

        self.assertGreaterEqual(clarity["excludedSpeechPauseMs"], 250)

    def test_loudness_measurement_parses_ffmpeg_loudnorm_json(self) -> None:
        report = b'''\n[Parsed_loudnorm_0] {
            "input_i" : "-18.65",
            "input_tp" : "-4.67",
            "input_lra" : "0.20",
            "input_thresh" : "-29.03",
            "output_i" : "-17.98",
            "target_offset" : "-0.02"
        }
'''
        completed = mock.Mock(returncode=0, stdout=b"", stderr=report)
        with mock.patch("generate_audio.subprocess.run", return_value=completed):
            result = measure_integrated_loudness("sample.mp3", "ffmpeg", target_lufs=-18)

        self.assertEqual(result["integratedLufs"], -18.65)
        self.assertEqual(result["truePeakDbtp"], -4.67)
        self.assertEqual(result["loudnessRangeLu"], 0.2)
        self.assertEqual(result["targetLufs"], -18.0)
        self.assertEqual(result["loudnessMeasurementMode"], "integrated-lufs")

    def test_loudness_measurement_rechecks_sub_400ms_media_as_repeated_active_speech(self) -> None:
        too_short = b'''{
            "input_i": "-inf", "input_tp": "-2.4", "input_lra": "0.0"
        }'''
        repeated_active = b'''{
            "input_i": "-19.3", "input_tp": "-2.4", "input_lra": "0.4"
        }'''
        first = mock.Mock(returncode=0, stdout=b"", stderr=too_short)
        second = mock.Mock(returncode=0, stdout=b"", stderr=repeated_active)
        with mock.patch(
            "generate_audio.subprocess.run",
            side_effect=[first, second],
        ) as run:
            result = measure_integrated_loudness("short.mp3", "ffmpeg", target_lufs=-18)

        self.assertEqual(result["integratedLufs"], -19.3)
        self.assertEqual(result["loudnessMeasurementMode"], "short-active-loop-lufs")
        self.assertIn("aloop=loop=20:size=44100", " ".join(run.call_args_list[1].args[0]))

    def test_loudness_correction_is_deterministic_and_caps_unsafe_boosts(self) -> None:
        self.assertEqual(
            plan_loudness_correction(
                {"integratedLufs": -18.8, "truePeakDbtp": -3.0},
                target_lufs=-18,
            ),
            {"gainDb": 0.0, "limiterRequired": False},
        )
        self.assertEqual(
            plan_loudness_correction(
                {"integratedLufs": -15.0, "truePeakDbtp": -2.4},
                target_lufs=-18,
            ),
            {"gainDb": -3.0, "limiterRequired": False},
        )
        self.assertEqual(
            plan_loudness_correction(
                {"integratedLufs": -20.0, "truePeakDbtp": -2.5},
                target_lufs=-18,
            ),
            {"gainDb": 2.0, "limiterRequired": True},
        )
        self.assertEqual(
            plan_loudness_correction(
                {"integratedLufs": -21.39, "truePeakDbtp": -5.0},
                target_lufs=-18,
            ),
            {"gainDb": 3.39, "limiterRequired": True},
        )
        self.assertEqual(
            plan_loudness_correction(
                {"integratedLufs": -22.5, "truePeakDbtp": -5.0},
                target_lufs=-18,
            ),
            {"gainDb": 4.5, "limiterRequired": True},
        )
        self.assertEqual(
            plan_loudness_correction(
                {"integratedLufs": -18.2, "truePeakDbtp": -0.8},
                target_lufs=-18,
            ),
            {"gainDb": 0.0, "limiterRequired": True},
        )
        with self.assertRaisesRegex(RuntimeError, "unsafe loudness boost"):
            plan_loudness_correction(
                {"integratedLufs": -22.501, "truePeakDbtp": -8.0},
                target_lufs=-18,
            )

    def test_adaptive_mp3_encoding_reencodes_only_media_outside_the_lufs_band(self) -> None:
        root = TTS_DIR.parents[1] / "audio" / ".work" / "tests" / "adaptive-loudness"
        source = root / "source.wav"
        output = root / "output.mp3"
        root.mkdir(parents=True, exist_ok=True)
        source.write_bytes(b"wav")
        commands: list[list[object]] = []

        def fake_run(command: list[object], *, label: str) -> mock.Mock:
            del label
            commands.append(command)
            Path(command[-1]).write_bytes(b"mp3")
            return mock.Mock(returncode=0)

        try:
            with (
                mock.patch("generate_audio.run_command", side_effect=fake_run),
                mock.patch(
                    "generate_audio.measure_integrated_loudness",
                    side_effect=[
                        {
                            "integratedLufs": -15.0,
                            "truePeakDbtp": -2.4,
                            "loudnessRangeLu": 0.2,
                            "targetLufs": -18.0,
                            "loudnessMeasurementMode": "integrated-lufs",
                        },
                        {
                            "integratedLufs": -18.0,
                            "truePeakDbtp": -5.4,
                            "loudnessRangeLu": 0.2,
                            "targetLufs": -18.0,
                            "loudnessMeasurementMode": "integrated-lufs",
                        },
                    ],
                ),
            ):
                correction = encode_mp3(
                    source,
                    output,
                    ffmpeg="ffmpeg",
                    sample_rate=44_100,
                    bitrate="96k",
                    leading_silence_ms=60,
                    trailing_silence_ms=100,
                    adaptive_loudness=True,
                    target_lufs=-18,
                )

            self.assertEqual(correction, {"gainDb": -3.0, "limiterRequired": False})
            self.assertEqual(len(commands), 2)
            self.assertIn("volume=-3.000dB", " ".join(map(str, commands[1])))
            self.assertEqual(output.read_bytes(), b"mp3")
        finally:
            source.unlink(missing_ok=True)
            output.unlink(missing_ok=True)
            output.with_suffix(".part.mp3").unlink(missing_ok=True)
            output.with_suffix(".adjusted.part.mp3").unlink(missing_ok=True)

    def test_adaptive_mp3_encoding_safely_boosts_quiet_media_before_limiting(self) -> None:
        root = TTS_DIR.parents[1] / "audio" / ".work" / "tests" / "adaptive-positive-gain"
        source = root / "source.wav"
        output = root / "output.mp3"
        root.mkdir(parents=True, exist_ok=True)
        source.write_bytes(b"wav")
        commands: list[list[object]] = []

        def fake_run(command: list[object], *, label: str) -> mock.Mock:
            del label
            commands.append(command)
            Path(command[-1]).write_bytes(b"mp3")
            return mock.Mock(returncode=0)

        try:
            with (
                mock.patch("generate_audio.run_command", side_effect=fake_run),
                mock.patch(
                    "generate_audio.measure_integrated_loudness",
                    side_effect=[
                        {
                            "integratedLufs": -21.39,
                            "truePeakDbtp": -5.0,
                            "loudnessRangeLu": 0.2,
                            "targetLufs": -18.0,
                            "loudnessMeasurementMode": "integrated-lufs",
                        },
                        {
                            "integratedLufs": -18.1,
                            "truePeakDbtp": -2.3,
                            "loudnessRangeLu": 0.2,
                            "targetLufs": -18.0,
                            "loudnessMeasurementMode": "integrated-lufs",
                        },
                    ],
                ),
            ):
                correction = encode_mp3(
                    source,
                    output,
                    ffmpeg="ffmpeg",
                    sample_rate=44_100,
                    bitrate="96k",
                    adaptive_loudness=True,
                    target_lufs=-18,
                )

            self.assertEqual(correction, {"gainDb": 3.39, "limiterRequired": True})
            self.assertEqual(len(commands), 2)
            self.assertIn(
                "volume=3.390dB,alimiter=limit=0.776247:level=false",
                " ".join(map(str, commands[1])),
            )
            self.assertEqual(output.read_bytes(), b"mp3")
        finally:
            shutil.rmtree(root, ignore_errors=True)

    def test_adaptive_mp3_encoding_lowers_limiter_ceiling_after_codec_overshoot(self) -> None:
        root = TTS_DIR.parents[1] / "audio" / ".work" / "tests" / "adaptive-codec-overshoot"
        source = root / "source.wav"
        output = root / "output.mp3"
        root.mkdir(parents=True, exist_ok=True)
        source.write_bytes(b"wav")
        commands: list[list[object]] = []

        def fake_run(command: list[object], *, label: str) -> mock.Mock:
            del label
            commands.append(command)
            Path(command[-1]).write_bytes(b"mp3")
            return mock.Mock(returncode=0)

        try:
            with (
                mock.patch("generate_audio.run_command", side_effect=fake_run),
                mock.patch(
                    "generate_audio.measure_integrated_loudness",
                    side_effect=[
                        {
                            "integratedLufs": -17.52,
                            "truePeakDbtp": -0.76,
                            "loudnessRangeLu": 0.3,
                            "targetLufs": -18.0,
                            "loudnessMeasurementMode": "integrated-lufs",
                        },
                        {
                            "integratedLufs": -17.48,
                            "truePeakDbtp": -0.92,
                            "loudnessRangeLu": 0.3,
                            "targetLufs": -18.0,
                            "loudnessMeasurementMode": "integrated-lufs",
                        },
                        {
                            "integratedLufs": -17.70,
                            "truePeakDbtp": -3.59,
                            "loudnessRangeLu": 0.4,
                            "targetLufs": -18.0,
                            "loudnessMeasurementMode": "integrated-lufs",
                        },
                    ],
                ),
            ):
                correction = encode_mp3(
                    source,
                    output,
                    ffmpeg="ffmpeg",
                    sample_rate=44_100,
                    bitrate="96k",
                    adaptive_loudness=True,
                    target_lufs=-18,
                )

            self.assertEqual(correction, {"gainDb": 0.0, "limiterRequired": True})
            self.assertEqual(len(commands), 3)
            self.assertIn(
                "alimiter=limit=0.776247:level=false",
                " ".join(map(str, commands[1])),
            )
            self.assertIn(
                "alimiter=limit=0.669885:level=false",
                " ".join(map(str, commands[2])),
            )
            self.assertEqual(output.read_bytes(), b"mp3")
        finally:
            shutil.rmtree(root, ignore_errors=True)

    def test_adaptive_mp3_encoding_uses_remaining_safe_gain_after_limiter_loss(self) -> None:
        root = TTS_DIR.parents[1] / "audio" / ".work" / "tests" / "adaptive-limiter-loss"
        source = root / "source.wav"
        output = root / "output.mp3"
        root.mkdir(parents=True, exist_ok=True)
        source.write_bytes(b"wav")
        commands: list[list[object]] = []

        def fake_run(command: list[object], *, label: str) -> mock.Mock:
            del label
            commands.append(command)
            Path(command[-1]).write_bytes(b"mp3")
            return mock.Mock(returncode=0)

        try:
            with (
                mock.patch("generate_audio.run_command", side_effect=fake_run),
                mock.patch(
                    "generate_audio.measure_integrated_loudness",
                    side_effect=[
                        {
                            "integratedLufs": -21.98,
                            "truePeakDbtp": -2.37,
                            "loudnessRangeLu": 0.0,
                            "targetLufs": -18.0,
                            "loudnessMeasurementMode": "integrated-lufs",
                        },
                        {
                            "integratedLufs": -19.70,
                            "truePeakDbtp": -2.56,
                            "loudnessRangeLu": 0.0,
                            "targetLufs": -18.0,
                            "loudnessMeasurementMode": "integrated-lufs",
                        },
                        {
                            "integratedLufs": -19.41,
                            "truePeakDbtp": -2.56,
                            "loudnessRangeLu": 0.0,
                            "targetLufs": -18.0,
                            "loudnessMeasurementMode": "integrated-lufs",
                        },
                    ],
                ),
            ):
                correction = encode_mp3(
                    source,
                    output,
                    ffmpeg="ffmpeg",
                    sample_rate=44_100,
                    bitrate="96k",
                    adaptive_loudness=True,
                    target_lufs=-18,
                )

            self.assertEqual(correction, {"gainDb": 4.5, "limiterRequired": True})
            self.assertEqual(len(commands), 3)
            self.assertIn(
                "volume=3.980dB,alimiter=limit=0.776247:level=false",
                " ".join(map(str, commands[1])),
            )
            self.assertIn(
                "volume=4.500dB,alimiter=limit=0.776247:level=false",
                " ".join(map(str, commands[2])),
            )
        finally:
            shutil.rmtree(root, ignore_errors=True)

    def test_adaptive_mp3_encoding_rejects_final_loudness_outside_tolerance(self) -> None:
        root = TTS_DIR.parents[1] / "audio" / ".work" / "tests" / "adaptive-final-loudness"
        source = root / "source.wav"
        output = root / "output.mp3"
        root.mkdir(parents=True, exist_ok=True)
        source.write_bytes(b"wav")

        def fake_run(command: list[object], *, label: str) -> mock.Mock:
            del label
            Path(command[-1]).write_bytes(b"mp3")
            return mock.Mock(returncode=0)

        try:
            with (
                mock.patch("generate_audio.run_command", side_effect=fake_run),
                mock.patch(
                    "generate_audio.measure_integrated_loudness",
                    side_effect=[
                        {
                            "integratedLufs": -21.39,
                            "truePeakDbtp": -5.0,
                            "loudnessRangeLu": 0.2,
                            "targetLufs": -18.0,
                            "loudnessMeasurementMode": "integrated-lufs",
                        },
                        {
                            "integratedLufs": -20.0,
                            "truePeakDbtp": -2.3,
                            "loudnessRangeLu": 0.2,
                            "targetLufs": -18.0,
                            "loudnessMeasurementMode": "integrated-lufs",
                        },
                        {
                            "integratedLufs": -20.0,
                            "truePeakDbtp": -2.3,
                            "loudnessRangeLu": 0.2,
                            "targetLufs": -18.0,
                            "loudnessMeasurementMode": "integrated-lufs",
                        },
                    ],
                ),
            ):
                with self.assertRaisesRegex(RuntimeError, "missed target"):
                    encode_mp3(
                        source,
                        output,
                        ffmpeg="ffmpeg",
                        sample_rate=44_100,
                        bitrate="96k",
                        adaptive_loudness=True,
                        target_lufs=-18,
                    )
        finally:
            shutil.rmtree(root, ignore_errors=True)

    def test_adaptive_mp3_encoding_rejects_final_true_peak_above_minus_two_dbtp(self) -> None:
        root = TTS_DIR.parents[1] / "audio" / ".work" / "tests" / "adaptive-true-peak"
        source = root / "source.wav"
        output = root / "output.mp3"
        root.mkdir(parents=True, exist_ok=True)
        source.write_bytes(b"wav")

        def fake_run(command: list[object], *, label: str) -> mock.Mock:
            del label
            Path(command[-1]).write_bytes(b"mp3")
            return mock.Mock(returncode=0)

        try:
            with (
                mock.patch("generate_audio.run_command", side_effect=fake_run),
                mock.patch(
                    "generate_audio.measure_integrated_loudness",
                    side_effect=[
                        {
                            "integratedLufs": -18.2,
                            "truePeakDbtp": -0.8,
                            "loudnessRangeLu": 0.2,
                            "targetLufs": -18.0,
                            "loudnessMeasurementMode": "integrated-lufs",
                        },
                        {
                            "integratedLufs": -18.1,
                            "truePeakDbtp": -1.0,
                            "loudnessRangeLu": 0.2,
                            "targetLufs": -18.0,
                            "loudnessMeasurementMode": "integrated-lufs",
                        },
                        {
                            "integratedLufs": -18.1,
                            "truePeakDbtp": -1.0,
                            "loudnessRangeLu": 0.2,
                            "targetLufs": -18.0,
                            "loudnessMeasurementMode": "integrated-lufs",
                        },
                        {
                            "integratedLufs": -18.1,
                            "truePeakDbtp": -1.0,
                            "loudnessRangeLu": 0.2,
                            "targetLufs": -18.0,
                            "loudnessMeasurementMode": "integrated-lufs",
                        },
                    ],
                ),
            ):
                with self.assertRaisesRegex(RuntimeError, "true peak"):
                    encode_mp3(
                        source,
                        output,
                        ffmpeg="ffmpeg",
                        sample_rate=44_100,
                        bitrate="96k",
                        adaptive_loudness=True,
                        target_lufs=-18,
                    )
        finally:
            shutil.rmtree(root, ignore_errors=True)

    def test_source_boundary_audit_rejects_truncation_before_padding(self) -> None:
        sample_rate = 44_100
        samples = array.array(
            "h",
            ([1000, -1000] * int(sample_rate * 0.2))
            + [0] * int(sample_rate * 0.04),
        )
        completed = mock.Mock(returncode=0, stdout=samples.tobytes(), stderr=b"")
        with mock.patch("generate_audio.subprocess.run", return_value=completed):
            result = audit_source_boundaries(
                "raw.wav",
                "ffmpeg",
                sample_rate=sample_rate,
                boundary_kind="raw",
            )

        self.assertFalse(result["pass"])
        self.assertTrue(result["truncationRisk"])
        self.assertLess(result["leadingSilenceMs"], result["minimumLeadingSilenceMs"])

    def test_normalized_boundary_allows_zero_silence_when_active_span_is_preserved(self) -> None:
        sample_rate = 44_100
        leading = 0
        trailing = int(sample_rate * 0.022426)
        samples = array.array(
            "h",
            [0] * leading
            + ([1000, -1000] * int(sample_rate * 0.2))
            + [0] * trailing,
        )
        completed = mock.Mock(returncode=0, stdout=samples.tobytes(), stderr=b"")
        raw_reference = {"pass": True, "activeSpanMs": 400}
        with mock.patch("generate_audio.subprocess.run", return_value=completed):
            normalized = audit_source_boundaries(
                "normalized.wav",
                "ffmpeg",
                sample_rate=sample_rate,
                boundary_kind="normalized",
                raw_audit=raw_reference,
            )
        self.assertTrue(normalized["pass"])
        self.assertEqual(normalized["boundaryKind"], "normalized")
        self.assertEqual(normalized["leadingSilenceMs"], 0)
        self.assertGreaterEqual(normalized["activeSpanRatio"], 0.65)
        self.assertFalse(normalized["edgeClippingRisk"])

        with mock.patch("generate_audio.subprocess.run", return_value=completed):
            raw = audit_source_boundaries(
                "raw.wav",
                "ffmpeg",
                sample_rate=sample_rate,
                boundary_kind="raw",
            )
        self.assertFalse(raw["pass"])
        self.assertEqual(raw["boundaryKind"], "raw")

    def test_active_span_comparison_ignores_low_energy_raw_model_tail(self) -> None:
        sample_rate = 44_100
        raw_samples = array.array(
            "h",
            [0] * int(sample_rate * 0.02)
            + ([20_000, -20_000] * int(sample_rate * 0.25))
            + ([150, -150] * int(sample_rate * 0.16))
            + [0] * int(sample_rate * 0.04),
        )
        normalized_samples = array.array(
            "h",
            ([20_000, -20_000] * int(sample_rate * 0.255))
            + [0] * int(sample_rate * 0.02),
        )
        raw_completed = mock.Mock(returncode=0, stdout=raw_samples.tobytes(), stderr=b"")
        normalized_completed = mock.Mock(
            returncode=0,
            stdout=normalized_samples.tobytes(),
            stderr=b"",
        )
        with mock.patch("generate_audio.subprocess.run", return_value=raw_completed):
            raw = audit_source_boundaries(
                "raw.wav",
                "ffmpeg",
                sample_rate=sample_rate,
                boundary_kind="raw",
            )
        with mock.patch("generate_audio.subprocess.run", return_value=normalized_completed):
            normalized = audit_source_boundaries(
                "normalized.wav",
                "ffmpeg",
                sample_rate=sample_rate,
                boundary_kind="normalized",
                raw_audit=raw,
            )

        old_absolute_ratio = normalized["absoluteActiveSpanMs"] / raw["absoluteActiveSpanMs"]
        self.assertGreater(old_absolute_ratio, 0.60)
        self.assertLess(old_absolute_ratio, 0.64)
        self.assertAlmostEqual(normalized["activeSpanRatio"], 1.02, places=2)
        self.assertGreater(raw["activeSpanThresholdDbfs"], raw["boundaryThresholdDbfs"])
        self.assertTrue(raw["pass"])
        self.assertTrue(normalized["pass"])

    def test_failed_raw_boundary_deletes_raw_and_cache_for_ai_retry(self) -> None:
        work_root = TTS_DIR.parents[1] / "audio" / ".work" / "tests" / "boundary-retry"
        artifact_hash = "f" * 64
        cache = work_root / "cache" / f"{artifact_hash}.wav"
        raw = work_root / "raw" / f"{artifact_hash}.wav"
        cache.parent.mkdir(parents=True, exist_ok=True)
        raw.parent.mkdir(parents=True, exist_ok=True)
        cache.write_bytes(b"stale-cache")
        raw.write_bytes(b"stale-raw")
        adapter = mock.Mock()

        def synthesize(_prepared: object, path: Path) -> None:
            Path(path).write_bytes(b"fresh-raw")

        adapter.synthesize_prepared.side_effect = synthesize
        try:
            with (
                mock.patch("generate_audio._valid_pcm_wav", return_value=False),
                mock.patch(
                    "generate_audio.audit_source_boundaries",
                    return_value={"pass": False, "truncationRisk": True},
                ),
                self.assertRaises(SourceBoundaryAuditError),
            ):
                _ensure_normalized_cache(
                    prepared=mock.Mock(),
                    artifact_hash=artifact_hash,
                    adapter=adapter,
                    work_root=work_root,
                    output_settings={"sampleRate": 44_100, "targetLufs": -18},
                    ffmpeg="ffmpeg",
                    keep_raw=False,
                )

            self.assertFalse(raw.exists())
            self.assertFalse(cache.exists())
        finally:
            raw.unlink(missing_ok=True)
            cache.unlink(missing_ok=True)

    def test_audio_item_keeps_the_normalized_source_boundary_audit(self) -> None:
        artifact = TTS_DIR.parents[1] / "audio" / ".work" / "tests" / "item.mp3"
        source = artifact.with_suffix(".wav")
        artifact.parent.mkdir(parents=True, exist_ok=True)
        artifact.write_bytes(b"mp3")
        source.write_bytes(b"wav")
        clarity = {
            "pass": True,
            "voicedDurationSeconds": 0.5,
            "speechRateDurationSeconds": 0.5,
            "detachedTailRisk": False,
        }
        source_boundary = {
            "schemaVersion": SOURCE_BOUNDARY_SCHEMA_VERSION,
            "claritySchemaVersion": CLARITY_SCHEMA_VERSION,
            "artifactHash": "a" * 64,
            "normalizedSha256": "f" * 64,
            "pass": True,
            "raw": {"boundaryKind": "raw", "pass": True, "truncationRisk": False},
            "normalized": {
                "boundaryKind": "normalized",
                "pass": True,
                "edgeClippingRisk": False,
                "activeSpanRatio": 1,
            },
        }
        try:
            with (
                mock.patch(
                    "generate_audio.probe_audio",
                    return_value={
                        "codec": "mp3",
                        "sampleRate": 44_100,
                        "channels": 1,
                        "bitrate": 96_000,
                        "durationSeconds": 0.7,
                        "bytes": 3,
                    },
                ),
                mock.patch("generate_audio.audit_audio_clarity", return_value=clarity),
            ):
                item = _audio_item(
                    audio_id="L1-001-line-001",
                    kind="line",
                    stage_id="L1-001",
                    level=1,
                    voice_key="female-soft",
                    model_voice="model:style",
                    relative_path="level-1/L1-001/lines/line-001.mp3",
                    content_hash="a" * 64,
                    absolute_path=artifact,
                    source_boundary_audit=source_boundary,
                    ffmpeg="ffmpeg",
                    ffprobe="ffprobe",
                    reading_sha256="b" * 64,
                    phoneme_sha256="c" * 64,
                    reading_kana="きょう",
                    mora_sha256="d" * 64,
                    query_sha256="e" * 64,
                    mora_count=2,
                    expected_mora_phonemes=("ky:o", "u"),
                )

            self.assertEqual(item["sourceBoundaryAudit"], source_boundary)
            self.assertEqual(item["claritySchemaVersion"], CLARITY_SCHEMA_VERSION)
            self.assertEqual(item["ratePolicy"], rate_policy_evidence())
        finally:
            artifact.unlink(missing_ok=True)
            source.unlink(missing_ok=True)

    def test_normalized_cache_hit_requires_a_matching_boundary_sidecar(self) -> None:
        work_root = TTS_DIR.parents[1] / "audio" / ".work" / "tests" / "boundary-sidecar"
        artifact_hash = "9" * 64
        cache = work_root / "cache" / f"{artifact_hash}.wav"
        sidecar = work_root / "cache" / f"{artifact_hash}.boundary.json"
        cache.parent.mkdir(parents=True, exist_ok=True)
        cache.write_bytes(b"normalized-cache")
        sidecar.write_text(
            json.dumps(
                {
                    "schemaVersion": SOURCE_BOUNDARY_SCHEMA_VERSION,
                    "claritySchemaVersion": CLARITY_SCHEMA_VERSION,
                    "artifactHash": artifact_hash,
                    "normalizedSha256": hashlib.sha256(b"normalized-cache").hexdigest(),
                    "pass": True,
                    "raw": {
                        "boundaryKind": "raw",
                        "activeSpanDbBelowPeak": 40.0,
                        "pass": True,
                    },
                    "normalized": {
                        "boundaryKind": "normalized",
                        "activeSpanDbBelowPeak": 40.0,
                        "pass": True,
                    },
                }
            ),
            encoding="utf-8",
        )
        adapter = mock.Mock()
        try:
            with mock.patch("generate_audio._valid_pcm_wav", return_value=True):
                result = _ensure_normalized_cache(
                    prepared=mock.Mock(),
                    artifact_hash=artifact_hash,
                    adapter=adapter,
                    work_root=work_root,
                    output_settings={"sampleRate": 44_100, "targetLufs": -18},
                    ffmpeg="ffmpeg",
                    keep_raw=False,
                )
            self.assertEqual(result, cache)
            adapter.synthesize_prepared.assert_not_called()
        finally:
            cache.unlink(missing_ok=True)
            sidecar.unlink(missing_ok=True)

    def test_missing_lossless_scene_cache_never_falls_back_to_published_mp3(self) -> None:
        work_root = TTS_DIR.parents[1] / "audio" / ".work" / "tests" / "no-mp3-fallback"
        shutil.rmtree(work_root, ignore_errors=True)
        existing = {
            "sourceBoundaryAudit": {
                "normalizedSha256": "a" * 64,
            }
        }
        try:
            with mock.patch("generate_audio.normalize_wav") as normalize:
                result = _verified_lossless_line_cache(
                    work_root,
                    artifact_hash="b" * 64,
                    existing_item=existing,
                    sample_rate=44_100,
                )
            self.assertIsNone(result)
            normalize.assert_not_called()
        finally:
            shutil.rmtree(work_root, ignore_errors=True)

    def test_post_processing_identity_reuses_the_exact_calibrated_wav(self) -> None:
        work_root = TTS_DIR.parents[1] / "audio" / ".work" / "tests" / "cache-promotion"
        source_hash = "8" * 64
        target_hash = "7" * 64
        cache_dir = work_root / "cache"
        source = cache_dir / f"{source_hash}.wav"
        source_sidecar = cache_dir / f"{source_hash}.boundary.json"
        target = cache_dir / f"{target_hash}.wav"
        target_sidecar = cache_dir / f"{target_hash}.boundary.json"
        cache_dir.mkdir(parents=True, exist_ok=True)
        source.write_bytes(b"calibrated-wav")
        source_sidecar.write_text(
            json.dumps(
                {
                    "schemaVersion": SOURCE_BOUNDARY_SCHEMA_VERSION,
                    "claritySchemaVersion": CLARITY_SCHEMA_VERSION,
                    "artifactHash": source_hash,
                    "normalizedSha256": hashlib.sha256(b"calibrated-wav").hexdigest(),
                    "raw": {"pass": True},
                    "normalized": {"pass": True},
                    "pass": True,
                }
            ),
            encoding="utf-8",
        )
        try:
            promoted = _promote_normalized_cache(
                work_root,
                source_hash=source_hash,
                target_hash=target_hash,
            )
            self.assertEqual(promoted, target)
            self.assertEqual(target.read_bytes(), b"calibrated-wav")
            payload = json.loads(target_sidecar.read_text(encoding="utf-8"))
            self.assertEqual(payload["artifactHash"], target_hash)
            self.assertEqual(payload["normalizedSha256"], hashlib.sha256(b"calibrated-wav").hexdigest())
        finally:
            for path in (source, source_sidecar, target, target_sidecar):
                path.unlink(missing_ok=True)

    def test_cache_promotion_retries_a_transient_windows_replace_lock(self) -> None:
        work_root = TTS_DIR.parents[1] / "audio" / ".work" / "tests" / "cache-promotion-lock"
        source_hash = "6" * 64
        target_hash = "5" * 64
        cache_dir = work_root / "cache"
        source = cache_dir / f"{source_hash}.wav"
        source_sidecar = cache_dir / f"{source_hash}.boundary.json"
        target = cache_dir / f"{target_hash}.wav"
        target_sidecar = cache_dir / f"{target_hash}.boundary.json"
        temporary = target.with_suffix(".promote.part.wav")
        cache_dir.mkdir(parents=True, exist_ok=True)
        source.write_bytes(b"calibrated-wav")
        source_sidecar.write_text(
            json.dumps(
                {
                    "schemaVersion": SOURCE_BOUNDARY_SCHEMA_VERSION,
                    "claritySchemaVersion": CLARITY_SCHEMA_VERSION,
                    "artifactHash": source_hash,
                    "normalizedSha256": hashlib.sha256(b"calibrated-wav").hexdigest(),
                    "raw": {"pass": True},
                    "normalized": {"pass": True},
                    "pass": True,
                }
            ),
            encoding="utf-8",
        )
        real_replace = os.replace
        target_attempts = 0

        def transient_replace(source_path: str | Path, destination_path: str | Path) -> None:
            nonlocal target_attempts
            if Path(destination_path) == target:
                target_attempts += 1
                if target_attempts == 1:
                    raise PermissionError("simulated Defender sharing violation")
            real_replace(source_path, destination_path)

        try:
            with (
                mock.patch("generate_audio.os.replace", side_effect=transient_replace),
                mock.patch("generate_audio.time.sleep"),
            ):
                promoted = _promote_normalized_cache(
                    work_root,
                    source_hash=source_hash,
                    target_hash=target_hash,
                )
            self.assertEqual(promoted, target)
            self.assertEqual(target_attempts, 2)
            self.assertFalse(temporary.exists())
            self.assertEqual(target.read_bytes(), b"calibrated-wav")
        finally:
            shutil.rmtree(work_root, ignore_errors=True)

    def test_clarity_failure_regenerates_without_reusing_failed_cache(self) -> None:
        root = TTS_DIR.parents[1] / "audio" / ".work" / "tests" / "clarity-retry-success"
        root.mkdir(parents=True, exist_ok=True)
        cache = root / "artifact.wav"
        raw = root / "artifact-raw.wav"
        output = root / "artifact.mp3"
        cache.write_bytes(b"cached-bad")
        raw.write_bytes(b"raw-bad")
        output.unlink(missing_ok=True)
        create_calls: list[bool] = []
        encoded: list[bytes] = []
        audit_attempts = 0

        class MemoryLogger:
            def __init__(self) -> None:
                self.events: list[tuple[str, dict[str, object]]] = []

            def write(self, event: str, **fields: object) -> None:
                self.events.append((event, fields))

        logger = MemoryLogger()

        def create_cache(force_regenerate: bool) -> Path:
            create_calls.append(force_regenerate)
            if force_regenerate:
                self.assertFalse(cache.exists())
                self.assertFalse(raw.exists())
                cache.write_bytes(b"fresh-good")
            return cache

        def encode(cache_path: Path, candidate_path: Path) -> None:
            payload = cache_path.read_bytes()
            encoded.append(payload)
            candidate_path.write_bytes(payload)

        def build_item(candidate_path: Path) -> dict[str, object]:
            nonlocal audit_attempts
            self.assertNotEqual(candidate_path, output)
            audit_attempts += 1
            if audit_attempts == 1:
                raise ClarityAuditError(
                    "L1-005-line-001-token-003",
                    {"pass": False, "detachedTailRisk": True},
                )
            return {"clarityAudit": {"pass": True}}

        try:
            final_cache, item = render_audio_with_clarity_retries(
                create_cache=create_cache,
                encode_output=encode,
                build_item=build_item,
                cache_path=cache,
                raw_path=raw,
                output_path=output,
                retries=1,
                logger=logger,
                audio_id="L1-005-line-001-token-003",
                stage_id="L1-005",
            )

            self.assertEqual(create_calls, [False, True])
            self.assertEqual(encoded, [b"cached-bad", b"fresh-good"])
            self.assertEqual(final_cache, cache)
            self.assertEqual(item["clarityAudit"], {"pass": True})
            self.assertEqual(output.read_bytes(), b"fresh-good")
            self.assertEqual([event for event, _ in logger.events], ["clarity-retry"])
            self.assertTrue(logger.events[0][1]["clarityAudit"]["detachedTailRisk"])
        finally:
            cache.unlink(missing_ok=True)
            raw.unlink(missing_ok=True)
            output.unlink(missing_ok=True)

    def test_validated_publication_keeps_previous_bytes_until_validation_passes(self) -> None:
        root = TTS_DIR.parents[1] / "audio" / ".work" / "tests" / "atomic-media"
        root.mkdir(parents=True, exist_ok=True)
        output = root / "scene.mp3"
        output.write_bytes(b"previous-good")

        def render(candidate: Path) -> None:
            candidate.write_bytes(b"candidate-bad")

        def reject(_candidate: Path) -> dict[str, object]:
            raise ClarityAuditError("L1-001-scene", {"pass": False})

        try:
            with self.assertRaises(ClarityAuditError):
                _publish_validated_audio(
                    output,
                    render_candidate=render,
                    validate_candidate=reject,
                )
            self.assertEqual(output.read_bytes(), b"previous-good")
            self.assertEqual(list(root.glob("*.candidate*.mp3")), [])

            item = _publish_validated_audio(
                output,
                render_candidate=lambda candidate: candidate.write_bytes(b"candidate-good"),
                validate_candidate=lambda _candidate: {"ok": True},
            )
            self.assertEqual(item, {"ok": True})
            self.assertEqual(output.read_bytes(), b"candidate-good")
        finally:
            shutil.rmtree(root, ignore_errors=True)

    def test_exhausted_clarity_retries_remove_bad_cache_and_log_final_audit(self) -> None:
        root = TTS_DIR.parents[1] / "audio" / ".work" / "tests" / "clarity-retry-failed"
        root.mkdir(parents=True, exist_ok=True)
        cache = root / "artifact.wav"
        raw = root / "artifact-raw.wav"
        output = root / "artifact.mp3"
        output.write_bytes(b"previous-good")
        create_calls: list[bool] = []

        class MemoryLogger:
            def __init__(self) -> None:
                self.events: list[tuple[str, dict[str, object]]] = []

            def write(self, event: str, **fields: object) -> None:
                self.events.append((event, fields))

        logger = MemoryLogger()

        def create_cache(force_regenerate: bool) -> Path:
            create_calls.append(force_regenerate)
            cache.write_bytes(f"bad-{len(create_calls)}".encode("ascii"))
            raw.write_bytes(b"raw-bad")
            return cache

        def encode(cache_path: Path, candidate_path: Path) -> None:
            candidate_path.write_bytes(cache_path.read_bytes())

        def build_item(candidate_path: Path) -> dict[str, object]:
            self.assertNotEqual(candidate_path, output)
            raise ClarityAuditError(
                "L1-005-line-001-token-003",
                {"pass": False, "detachedTailRisk": True},
            )

        try:
            with self.assertRaises(ClarityAuditError):
                render_audio_with_clarity_retries(
                    create_cache=create_cache,
                    encode_output=encode,
                    build_item=build_item,
                    cache_path=cache,
                    raw_path=raw,
                    output_path=output,
                    retries=1,
                    logger=logger,
                    audio_id="L1-005-line-001-token-003",
                    stage_id="L1-005",
                )

            self.assertEqual(create_calls, [False, True])
            self.assertFalse(cache.exists())
            self.assertFalse(raw.exists())
            self.assertEqual(output.read_bytes(), b"previous-good")
            self.assertEqual(list(root.glob("*.candidate*.mp3")), [])
            self.assertEqual(
                [event for event, _ in logger.events],
                ["clarity-retry", "clarity-failed"],
            )
            self.assertTrue(logger.events[-1][1]["clarityAudit"]["detachedTailRisk"])
        finally:
            cache.unlink(missing_ok=True)
            raw.unlink(missing_ok=True)
            output.unlink(missing_ok=True)

    def test_atomic_json_write_retries_a_transient_windows_file_lock(self) -> None:
        real_replace = generator_module.os.replace
        attempts = 0

        def replace_after_two_locks(source: str, destination: str) -> None:
            nonlocal attempts
            attempts += 1
            if attempts < 3:
                raise PermissionError(5, "transient sharing violation")
            real_replace(source, destination)

        test_root = TTS_DIR.parents[1] / "audio" / ".work" / "tests"
        test_root.mkdir(parents=True, exist_ok=True)
        destination = test_root / "atomic-manifest.json"
        destination.unlink(missing_ok=True)
        try:
            with (
                mock.patch("generate_audio.os.replace", side_effect=replace_after_two_locks),
                mock.patch("generate_audio.time.sleep"),
            ):
                write_json_atomic(destination, {"ok": True})

            self.assertEqual(json.loads(destination.read_text(encoding="utf-8")), {"ok": True})
            self.assertEqual(attempts, 3)
        finally:
            destination.unlink(missing_ok=True)

    def test_audio_root_lock_rejects_same_root_but_allows_another_root(self) -> None:
        test_root = TTS_DIR.parents[1] / "audio" / ".work" / "tests" / "root-lock"
        first_root = test_root / "first"
        second_root = test_root / "second"
        shutil.rmtree(test_root, ignore_errors=True)
        child_code = (
            "import sys\n"
            "from pathlib import Path\n"
            "from generate_audio import audio_root_generation_lock\n"
            "with audio_root_generation_lock(Path(sys.argv[1])):\n"
            "    print('LOCKED', flush=True)\n"
            "    sys.stdin.readline()\n"
        )
        environment = os.environ.copy()
        environment["PYTHONPATH"] = str(TTS_DIR)
        child = subprocess.Popen(
            [sys.executable, "-c", child_code, str(first_root)],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            env=environment,
        )
        try:
            self.assertEqual(child.stdout.readline().strip(), "LOCKED")
            with self.assertRaisesRegex(AudioRootBusyError, "already generating"):
                with audio_root_generation_lock(first_root):
                    pass
            with audio_root_generation_lock(second_root):
                pass
        finally:
            if child.stdin:
                child.stdin.write("\n")
                child.stdin.flush()
            child.wait(timeout=10)
            if child.returncode != 0:
                self.fail(child.stderr.read())
            if child.stdin:
                child.stdin.close()
            if child.stdout:
                child.stdout.close()
            if child.stderr:
                child.stderr.close()

        try:
            # The lock file remains as owner metadata after normal exit (and
            # may remain after a crash); only the released OS lock matters.
            self.assertTrue((first_root / ".work" / "generator.lock").is_file())
            with audio_root_generation_lock(first_root):
                pass
        finally:
            shutil.rmtree(test_root, ignore_errors=True)

    def test_generator_metadata_attests_output_and_pronunciation_table(self) -> None:
        metadata = _generator_metadata(
            {
                "engine": {"name": "AivisSpeech Engine", "version": "1.2.0"},
                "executionProvider": "CPU",
                "models": [
                    {
                        "uuid": "22e8ed77-94fe-4ef2-871f-a86f94e9a579",
                        "version": "1.1.0",
                        "sha256": "b" * 64,
                        "license": "ACML-1.0",
                    }
                ],
            },
            output_settings={"format": "mp3", "sampleRate": 44100},
            pronunciations_sha256="a" * 64,
        )
        self.assertEqual(metadata["output"], {"format": "mp3", "sampleRate": 44100})
        self.assertEqual(metadata["executionProvider"], "CPU")
        self.assertEqual(metadata["models"][0]["license"], "ACML-1.0")
        self.assertEqual(metadata["pronunciationsSha256"], "a" * 64)
        self.assertEqual(metadata["claritySchemaVersion"], CLARITY_SCHEMA_VERSION)
        self.assertEqual(metadata["ratePolicy"], rate_policy_evidence())

    def test_stage_manifest_embeds_scene_cues_for_the_browser_player(self) -> None:
        tasks = build_audio_tasks(self.stage)
        timeline = {
            "sampleRate": 44100,
            "duration": 1.25,
            "cues": [
                {
                    "lineId": "line-001",
                    "audioId": "L1-001-line-001",
                    "start": 0.06,
                    "end": 1.15,
                }
            ],
        }
        entry = build_stage_manifest_entry(
            self.stage,
            tasks,
            timeline,
            scene_hash="c" * 64,
            timeline_relative="level-1/L1-001/timeline.json",
        )
        self.assertEqual(entry["cues"], timeline["cues"])
        self.assertEqual(entry["duration"], 1.25)
        self.assertEqual(entry["sceneAudioId"], "L1-001-scene")

    def test_interrupted_content_migration_still_requires_a_full_run(self) -> None:
        interrupted = {
            "contentVersion": "1.0.3",
            "items": {"L1-001-scene": {"id": "L1-001-scene"}},
            "stages": {
                "L1-001": {"contentVersion": "1.0.3"},
                "L1-002": {"contentVersion": "1.0.2"},
            },
        }
        self.assertTrue(
            _manifest_needs_full_content_migration(interrupted, "1.0.3")
        )
        interrupted["stages"]["L1-002"]["contentVersion"] = "1.0.3"
        self.assertFalse(
            _manifest_needs_full_content_migration(interrupted, "1.0.3")
        )

    def test_resume_rebuilds_a_corrupt_timeline(self) -> None:
        audio_root = TTS_DIR.parents[1] / "audio" / ".work" / "tests" / "timeline-resume"
        timeline_path = audio_root / "level-1" / "L1-001" / "timeline.json"
        timeline_path.parent.mkdir(parents=True, exist_ok=True)
        scene_hash = "c" * 64
        entry = {
            "contentHash": scene_hash,
            "sourceContentHash": self.stage["contentHash"],
            "timelinePath": "level-1/L1-001/timeline.json",
            "stageId": "L1-001",
            "timelineId": "L1-001-timeline",
            "sceneAudioId": "L1-001-scene",
            "lineAudioIds": [],
        }
        timeline_path.write_text(
            json.dumps(
                {
                    "schemaVersion": 1,
                    "contentHash": scene_hash,
                    "sourceContentHash": self.stage["contentHash"],
                    "stageId": "L1-001",
                    "timelineId": "L1-001-timeline",
                    "sceneAudioId": "L1-001-scene",
                    "sampleRate": 44100,
                    "cues": [],
                    "duration": 1,
                }
            ),
            encoding="utf-8",
        )
        self.assertTrue(_timeline_is_current(entry, scene_hash, audio_root))
        stale_source = json.loads(timeline_path.read_text(encoding="utf-8"))
        stale_source["sourceContentHash"] = "e" * 64
        timeline_path.write_text(json.dumps(stale_source), encoding="utf-8")
        self.assertFalse(_timeline_is_current(entry, scene_hash, audio_root))
        stale_source["sourceContentHash"] = self.stage["contentHash"]
        timeline_path.write_text(json.dumps(stale_source), encoding="utf-8")
        timeline_path.write_text("not json", encoding="utf-8")
        self.assertFalse(_timeline_is_current(entry, scene_hash, audio_root))

    def test_retry_list_accepts_audit_json_and_rejects_unknown_shapes(self) -> None:
        root = TTS_DIR.parents[1] / "audio" / ".work" / "tests"
        root.mkdir(parents=True, exist_ok=True)
        path = root / "retry-list.json"
        try:
            path.write_text(
                json.dumps(
                    {
                        "audioIds": [
                            "L1-001-line-001",
                            "L1-001-line-001-token-001",
                            "L1-001-scene",
                        ]
                    }
                ),
                encoding="utf-8",
            )
            self.assertEqual(
                load_retry_audio_ids(path),
                {
                    "L1-001-line-001",
                    "L1-001-line-001-token-001",
                    "L1-001-scene",
                },
            )
            path.write_text(json.dumps({"audioIds": ["../../escape"]}), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "invalid audio IDs"):
                load_retry_audio_ids(path)
        finally:
            path.unlink(missing_ok=True)

    def test_failed_stage_manifest_mutations_roll_back_without_touching_other_stages(self) -> None:
        manifest = {
            "items": {
                "L1-001-line-001": {
                    "id": "L1-001-line-001",
                    "stageId": "L1-001",
                    "sha256": "a" * 64,
                },
                "L1-002-line-001": {
                    "id": "L1-002-line-001",
                    "stageId": "L1-002",
                    "sha256": "b" * 64,
                },
            },
            "stages": {
                "L1-001": {"contentHash": "c" * 64},
                "L1-002": {"contentHash": "d" * 64},
            },
        }
        snapshot = snapshot_manifest_stage(manifest, "L1-001")
        manifest["items"]["L1-001-line-001"]["sha256"] = "e" * 64
        manifest["items"]["L1-001-q1-a"] = {
            "id": "L1-001-q1-a",
            "stageId": "L1-001",
            "sha256": "f" * 64,
        }
        manifest["stages"]["L1-001"] = {"contentHash": "0" * 64}
        manifest["stages"]["L1-002"] = {"contentHash": "1" * 64}

        restore_manifest_stage(manifest, "L1-001", snapshot)

        self.assertEqual(manifest["items"]["L1-001-line-001"]["sha256"], "a" * 64)
        self.assertNotIn("L1-001-q1-a", manifest["items"])
        self.assertEqual(manifest["stages"]["L1-001"]["contentHash"], "c" * 64)
        self.assertEqual(manifest["stages"]["L1-002"]["contentHash"], "1" * 64)

    def test_stage_failure_retry_list_includes_all_tasks_scene_and_timeline(self) -> None:
        audio_ids = stage_audio_ids(self.stage)
        self.assertEqual(len(audio_ids), len(set(audio_ids)))
        self.assertIn("L1-001-line-001", audio_ids)
        self.assertIn("L1-001-line-001-token-001", audio_ids)
        self.assertIn("L1-001-scene", audio_ids)
        self.assertIn("L1-001-timeline", audio_ids)

    def test_failed_stage_media_is_atomically_restored_from_the_pre_stage_snapshot(self) -> None:
        root = TTS_DIR.parents[1] / "audio" / ".work" / "tests" / "stage-media-rollback"
        audio_root = root / "audio"
        work_root = audio_root / ".work"
        stage_directory = audio_root / "level-1" / "L1-001"
        original = stage_directory / "lines" / "line-001.mp3"
        replacement = original.with_suffix(".replacement.mp3")
        added = stage_directory / "options" / "q1-a.mp3"
        shutil.rmtree(root, ignore_errors=True)
        original.parent.mkdir(parents=True, exist_ok=True)
        original.write_bytes(b"old-media")
        try:
            snapshot = begin_stage_media_snapshot(
                audio_root,
                work_root,
                self.stage,
                run_token="test-run",
            )
            replacement.write_bytes(b"new-media")
            os.replace(replacement, original)
            added.parent.mkdir(parents=True, exist_ok=True)
            added.write_bytes(b"partial-new-media")

            restore_stage_media(snapshot)

            self.assertEqual(original.read_bytes(), b"old-media")
            self.assertFalse(added.exists())
            self.assertFalse(snapshot.backup_directory.exists())
        finally:
            shutil.rmtree(root, ignore_errors=True)

    def test_committed_stage_media_discards_the_backup_without_changing_public_files(self) -> None:
        root = TTS_DIR.parents[1] / "audio" / ".work" / "tests" / "stage-media-commit"
        audio_root = root / "audio"
        work_root = audio_root / ".work"
        stage_directory = audio_root / "level-1" / "L1-001"
        artifact = stage_directory / "scene.mp3"
        shutil.rmtree(root, ignore_errors=True)
        stage_directory.mkdir(parents=True, exist_ok=True)
        artifact.write_bytes(b"published")
        try:
            snapshot = begin_stage_media_snapshot(
                audio_root,
                work_root,
                self.stage,
                run_token="test-run",
            )
            commit_stage_media(snapshot)
            self.assertEqual(artifact.read_bytes(), b"published")
            self.assertFalse(snapshot.backup_directory.exists())
        finally:
            shutil.rmtree(root, ignore_errors=True)

    def test_failed_new_stage_removes_every_partially_published_file(self) -> None:
        root = TTS_DIR.parents[1] / "audio" / ".work" / "tests" / "new-stage-media-rollback"
        audio_root = root / "audio"
        work_root = audio_root / ".work"
        stage_directory = audio_root / "level-1" / "L1-001"
        shutil.rmtree(root, ignore_errors=True)
        try:
            snapshot = begin_stage_media_snapshot(
                audio_root,
                work_root,
                self.stage,
                run_token="test-run",
            )
            partial = stage_directory / "scene.mp3"
            partial.parent.mkdir(parents=True, exist_ok=True)
            partial.write_bytes(b"partial")

            restore_stage_media(snapshot)

            self.assertFalse(stage_directory.exists())
            self.assertFalse(snapshot.backup_directory.exists())
            self.assertEqual(
                list((audio_root / "level-1").glob(".L1-001.failed-*")),
                [],
            )
        finally:
            shutil.rmtree(root, ignore_errors=True)


if __name__ == "__main__":
    unittest.main()
