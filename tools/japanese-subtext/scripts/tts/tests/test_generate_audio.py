from __future__ import annotations

import hashlib
import json
import copy
import sys
import wave
import unittest
from pathlib import Path


TTS_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(TTS_DIR))

from generate_audio import (  # noqa: E402
    _generator_metadata,
    _normalization_filter,
    _timeline_is_current,
    apply_pronunciations,
    assemble_scene_wav,
    build_stage_manifest_entry,
    build_audio_tasks,
    manifest_item_is_current,
    select_stages,
    task_hash,
    validate_runtime_config,
)


class GenerateAudioTests(unittest.TestCase):
    def setUp(self) -> None:
        self.stage = {
            "schemaVersion": 1,
            "contentVersion": "1.0.1",
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

        token = by_id["L1-001-line-001-token-001"]
        self.assertEqual(token.kind, "token")
        self.assertEqual(token.voice_key, "female-soft")
        self.assertEqual(
            token.relative_path,
            "level-1/L1-001/tokens/line-001-token-001.mp3",
        )

        option = by_id["L1-001-q1-a"]
        self.assertEqual(option.kind, "option")
        self.assertEqual(option.voice_key, "male-calm")
        self.assertEqual(option.relative_path, "level-1/L1-001/options/q1-a.mp3")

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

    def test_project_pronunciations_cover_known_kokoro_g2p_edges(self) -> None:
        payload = json.loads(
            (TTS_DIR.parents[1] / "config" / "pronunciations.json").read_text(encoding="utf-8")
        )
        entries = payload["entries"]
        self.assertEqual(
            apply_pronunciations("締切時の指定は八版です。", entries),
            "しめきりのときのしていは八版です。",
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
            "いちらんすーのしゅと出力は正常です。",
        )

    def test_task_hash_changes_when_voice_or_model_changes(self) -> None:
        task = build_audio_tasks(self.stage)[0]
        base = task_hash(
            task,
            voice_settings={"modelVoice": "jf_alpha", "speed": 1.0},
            model_fingerprint="model-a",
            pipeline_fingerprint="pipeline-a",
        )
        other_voice = task_hash(
            task,
            voice_settings={"modelVoice": "jf_gongitsune", "speed": 1.0},
            model_fingerprint="model-a",
            pipeline_fingerprint="pipeline-a",
        )
        other_model = task_hash(
            task,
            voice_settings={"modelVoice": "jf_alpha", "speed": 1.0},
            model_fingerprint="model-b",
            pipeline_fingerprint="pipeline-a",
        )
        self.assertNotEqual(base, other_voice)
        self.assertNotEqual(base, other_model)

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
                wav_file.setframerate(24_000)
                wav_file.writeframes(b"\0\0" * frames)

        write_silence(first, 2_400)  # 0.1 s
        write_silence(second, 4_800)  # 0.2 s
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
            sample_rate=24_000,
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
        }
        audio_root = TTS_DIR.parents[1] / "audio"
        self.assertTrue(manifest_item_is_current(item, "a" * 64, audio_root))
        self.assertFalse(manifest_item_is_current(item, "b" * 64, audio_root))
        artifact.write_bytes(b"corrupt")
        self.assertFalse(manifest_item_is_current(item, "a" * 64, audio_root))
        self.assertFalse(
            manifest_item_is_current(
                {"contentHash": "a" * 64, "path": "../outside.mp3"},
                "a" * 64,
                audio_root,
            )
        )

    def test_runtime_config_requires_the_five_official_japanese_voices(self) -> None:
        voices = {
            "jf-alpha": {"modelVoice": "jf_alpha"},
            "jf-gongitsune": {"modelVoice": "jf_gongitsune"},
            "jf-nezumi": {"modelVoice": "jf_nezumi"},
            "jf-tebukuro": {"modelVoice": "jf_tebukuro"},
            "jm-kumo": {"modelVoice": "jm_kumo"},
        }
        config = {
            "kokoro": {"g2p": "pyopenjtalk", "provider": "CPUExecutionProvider"},
            "output": {"format": "mp3", "sampleRate": 24000, "channels": 1, "bitrate": "64k"},
            "voices": voices,
            "voiceAliases": {"female-soft": "jf-alpha"},
        }
        validate_runtime_config(config)
        invalid = {**config, "voices": {**voices, "extra": {"modelVoice": "jf_alpha"}}}
        with self.assertRaisesRegex(ValueError, "official Japanese voice"):
            validate_runtime_config(invalid)
        invalid_output = {**config, "output": {**config["output"], "sceneGapMs": -1}}
        with self.assertRaisesRegex(ValueError, "sceneGapMs"):
            validate_runtime_config(invalid_output)

    def test_normalization_filter_preserves_internal_pauses(self) -> None:
        audio_filter = _normalization_filter(-18)
        self.assertNotIn("stop_periods=-1", audio_filter)
        self.assertEqual(audio_filter.count("areverse"), 2)
        self.assertIn("loudnorm=I=-18", audio_filter)

    def test_generator_metadata_attests_output_and_pronunciation_table(self) -> None:
        metadata = _generator_metadata(
            {"model": {"sha256": "b" * 64, "bytes": 1}},
            output_settings={"format": "mp3", "sampleRate": 24000},
            pronunciations_sha256="a" * 64,
        )
        self.assertEqual(metadata["output"], {"format": "mp3", "sampleRate": 24000})
        self.assertEqual(metadata["executionProvider"], "CPUExecutionProvider")
        self.assertEqual(metadata["pronunciationsSha256"], "a" * 64)

    def test_stage_manifest_embeds_scene_cues_for_the_browser_player(self) -> None:
        tasks = build_audio_tasks(self.stage)
        timeline = {
            "sampleRate": 24000,
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
                    "sampleRate": 24000,
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


if __name__ == "__main__":
    unittest.main()
