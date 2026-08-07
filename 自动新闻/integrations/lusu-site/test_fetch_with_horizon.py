from __future__ import annotations

import importlib.util
import asyncio
import json
import logging
import re
import unittest
from datetime import datetime, timedelta
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch


MODULE_PATH = Path(__file__).with_name("fetch-with-horizon.py")
SPEC = importlib.util.spec_from_file_location("lusu_fetch_with_horizon", MODULE_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError(f"cannot import {MODULE_PATH}")
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)

from src.models import SourceType


class ArtifactWriteTests(unittest.TestCase):
    def test_utf8_artifact_hash_matches_written_bytes_on_windows(self) -> None:
        text = '{\n  "标题": "每日 AI 新闻"\n}\n'
        path = Mock()
        written = MODULE.write_utf8_artifact(path, text)

        path.write_bytes.assert_called_once_with(text.encode("utf-8"))
        self.assertNotIn(b"\r\n", written)


class FetchWindowTests(unittest.TestCase):
    def test_explicit_window_uses_requested_half_open_interval(self) -> None:
        report_date, window_start, window_end = MODULE.resolve_window(
            None,
            "2026-07-26T23:00:00+08:00",
            "2026-07-27T23:00:00+08:00",
        )

        self.assertEqual(report_date.isoformat(), "2026-07-27")
        self.assertEqual(window_start.isoformat(), "2026-07-26T23:00:00+08:00")
        self.assertEqual(window_end.isoformat(), "2026-07-27T23:00:00+08:00")

    def test_explicit_window_requires_timezone_offsets(self) -> None:
        with self.assertRaisesRegex(ValueError, "timezone offset"):
            MODULE.resolve_window(
                None,
                "2026-07-26T23:00:00",
                "2026-07-27T23:00:00+08:00",
            )

    def test_window_is_left_closed_and_right_open(self) -> None:
        _, window_start, window_end = MODULE.resolve_window(
            None,
            "2026-07-26T23:00:00+08:00",
            "2026-07-27T23:00:00+08:00",
        )

        self.assertTrue(
            MODULE.published_at_in_window(
                "2026-07-26T23:00:00+08:00",
                window_start,
                window_end,
            )
        )
        self.assertTrue(
            MODULE.published_at_in_window(
                "2026-07-27T14:59:59Z",
                window_start,
                window_end,
            )
        )
        self.assertFalse(
            MODULE.published_at_in_window(
                "2026-07-27T23:00:00+08:00",
                window_start,
                window_end,
            )
        )

    def test_lookback_expands_to_cover_window_start(self) -> None:
        window_start = datetime.fromisoformat("2026-07-26T23:00:00+08:00")
        now = datetime.fromisoformat("2026-07-27T23:16:00+08:00")

        self.assertEqual(
            MODULE.required_lookback_hours(24, window_start, now=now),
            25,
        )
        self.assertEqual(
            MODULE.required_lookback_hours(48, window_start, now=now),
            48,
        )

    def test_default_lookback_only_expands_as_needed_for_exact_window(
        self,
    ) -> None:
        self.assertEqual(MODULE.parse_args([]).hours, 24)

    def test_date_mode_remains_available(self) -> None:
        report_date, window_start, window_end = MODULE.resolve_window(
            "2026-07-27",
            None,
            None,
        )

        self.assertEqual(report_date.isoformat(), "2026-07-27")
        self.assertEqual(window_start.utcoffset(), timedelta(hours=8))
        self.assertEqual(window_end - window_start, timedelta(days=1))


class DiscoveryQueryTests(unittest.TestCase):
    def test_query_catalog_covers_every_required_topic(self) -> None:
        catalog = MODULE.load_discovery_catalog(
            Path(__file__).with_name("discovery-queries.json")
        )
        queries = catalog["queries"]

        query_ids = {entry["id"] for entry in queries}
        self.assertTrue({
            "openai-people-products-en",
            "openai-product-operations-en",
            "openai-product-operations-ja",
            "anthropic-claude-en",
            "anthropic-product-operations-en",
            "anthropic-product-operations-ja",
            "frontier-product-operations-en",
            "gemini-product-operations-ja",
            "frontier-labs-people-en",
            "ai-policy-lobbying-en",
            "ai-lobbying-en",
            "codex-operations-en",
            "developer-products-en",
            "qoder-product-en",
            "openrouter-product-en",
            "gpt-live-product-en",
            "developer-ai-en",
            "open-model-policy-en",
            "open-weight-releases-en",
            "open-models-en",
            "moonshot-kimi-zh",
            "zhipu-glm-zh",
            "qwen-products-zh",
            "alibaba-ai-ecosystem-zh",
            "minimax-products-zh",
            "deepseek-products-zh",
            "hunyuan-products-zh",
            "ernie-products-zh",
            "bytedance-models-zh",
            "bytedance-doubao-zh",
            "bytedance-doubao-en",
            "bytedance-seed-models-zh",
            "bytedance-seed-speech-zh",
            "bytedance-seed-speech-en",
            "meituan-models-zh",
            "wechat-welm-zh",
            "sensetime-models-zh",
            "stepfun-models-zh",
            "lingyi-models-zh",
            "baichuan-models-zh",
            "xiaomi-mimo-zh",
            "china-models-zh",
            "china-models-en",
            "bytedance-creative-models-zh",
            "bytedance-seedance-en",
            "bytedance-seedream-en",
            "bytedance-dreamina-en",
            "bytedance-creative-models-ja",
            "bytedance-creative-models-ko",
            "china-video-models-zh",
            "china-video-models-en",
            "global-video-models-en-primary",
            "global-video-models-en-creative",
            "global-video-models-ja",
            "global-video-models-ko",
            "image-models-zh",
            "image-models-en",
            "voice-models-zh",
            "voice-models-en",
            "china-lithography-zh",
            "china-memory-chips-zh",
            "china-semiconductor-zh",
            "china-semiconductor-en",
            "sovereign-ai-en",
            "sovereign-ai-ko",
            "chip-partnerships-en",
            "chip-partnerships-ko",
            "tech-finance-zh",
        }.issubset(query_ids))
        self.assertEqual(catalog["queryConcurrency"], 2)
        self.assertEqual(catalog["lowVolumeTrigger"], 5)
        self.assertEqual(catalog["languagePolicy"], "any-reliable-language")
        self.assertTrue(
            {"en", "zh-CN", "ja", "ko"}.issubset(set(catalog["seedLanguages"]))
        )
        self.assertEqual(
            {entry["language"] for entry in queries},
            {"en", "zh-CN", "ja", "ko"},
        )
        self.assertTrue(all(entry["coverageGroup"] for entry in queries))
        by_id = {entry["id"]: entry for entry in queries}
        groups_by_id = {
            entry["id"]: entry for entry in catalog["coverageGroups"]
        }
        self.assertTrue(groups_by_id["multimodal-models"]["required"])
        self.assertEqual(
            groups_by_id["multimodal-models"]["priority"],
            "priority",
        )
        multimodal_query_ids = {
            "bytedance-seed-speech-zh",
            "bytedance-seed-speech-en",
            "bytedance-creative-models-zh",
            "bytedance-seedance-en",
            "bytedance-seedream-en",
            "bytedance-dreamina-en",
            "bytedance-creative-models-ja",
            "bytedance-creative-models-ko",
            "china-video-models-zh",
            "china-video-models-en",
            "global-video-models-en-primary",
            "global-video-models-en-creative",
            "global-video-models-ja",
            "global-video-models-ko",
            "image-models-zh",
            "image-models-en",
            "voice-models-zh",
            "voice-models-en",
        }
        for query_id in multimodal_query_ids:
            entry = by_id[query_id]
            self.assertEqual(entry["coverageGroup"], "multimodal-models")
            self.assertEqual(entry["priority"], "priority")
            self.assertTrue(entry["required"])
            self.assertTrue(entry["mustReview"])
            self.assertEqual(
                entry["maxResults"],
                MODULE.GOOGLE_NEWS_SAFE_RESULT_LIMIT,
            )
        self.assertEqual(
            {
                by_id[query_id]["language"]
                for query_id in multimodal_query_ids
            },
            {"en", "zh-CN", "ja", "ko"},
        )
        multimodal_query_text = "\n".join(
            by_id[query_id]["query"] for query_id in multimodal_query_ids
        )
        for alias in [
            "Seedance",
            "Seedream",
            "Dreamina AI",
            "可灵AI",
            "Kling AI",
            "海螺AI",
            "Hailuo AI",
            "Vidu AI",
            "Google Veo",
            "OpenAI Sora",
            "Runway AI",
            "Luma AI",
            "PixVerse",
            "Grok Voice",
            "SeedRealtime",
            "full duplex speech",
        ]:
            self.assertIn(alias, multimodal_query_text)
        for query_id, product_query in {
            "bytedance-seedance-en": "Seedance",
            "bytedance-seedream-en": "Seedream",
            "bytedance-dreamina-en": "\"Dreamina AI\"",
        }.items():
            self.assertEqual(by_id[query_id]["query"], product_query)
        alibaba_ecosystem = by_id["alibaba-ai-ecosystem-zh"]
        self.assertTrue(alibaba_ecosystem["required"])
        self.assertEqual(alibaba_ecosystem["priority"], "priority")
        self.assertTrue(alibaba_ecosystem["mustReview"])
        self.assertEqual(
            alibaba_ecosystem["reviewLane"],
            "alibaba-ai-ecosystem",
        )
        self.assertEqual(
            alibaba_ecosystem["maxResults"],
            MODULE.GOOGLE_NEWS_SAFE_RESULT_LIMIT,
        )
        for alias in [
            "阿里云 AI",
            "通义实验室",
            "阿里通义",
            "百炼",
            "魔搭",
            "ModelScope",
        ]:
            self.assertIn(alias, alibaba_ecosystem["query"])
        for action in ["发布", "上线", "开源", "更新", "模型", "产品", "API"]:
            self.assertIn(action, alibaba_ecosystem["query"])

        bytedance_required_queries = {
            "bytedance-doubao-zh": (
                "bytedance-doubao-products",
                ["豆包", "发布", "上线", "API", "价格", "额度"],
            ),
            "bytedance-doubao-en": (
                "bytedance-doubao-products",
                ["Doubao", "launch", "availability", "API", "quota"],
            ),
            "bytedance-seed-models-zh": (
                "bytedance-seed-models",
                ["字节跳动 Seed", "Seed-Prover", "发布", "权重", "API"],
            ),
            "bytedance-seed-speech-zh": (
                "bytedance-seed-speech",
                ["SeedRealtime", "全双工", "原生音视频", "发布", "API"],
            ),
            "bytedance-seed-speech-en": (
                "bytedance-seed-speech",
                ["SeedRealtime", "full duplex speech", "release", "API"],
            ),
        }
        for query_id, (review_lane, required_terms) in (
            bytedance_required_queries.items()
        ):
            entry = by_id[query_id]
            self.assertTrue(entry["required"])
            self.assertTrue(entry["mustReview"])
            self.assertEqual(entry["priority"], "priority")
            self.assertEqual(entry["reviewLane"], review_lane)
            self.assertEqual(
                entry["maxResults"],
                MODULE.GOOGLE_NEWS_SAFE_RESULT_LIMIT,
            )
            for term in required_terms:
                self.assertIn(term, entry["query"])

        focused_japanese_product_queries = {
            "openai-product-operations-ja": "openai-product-operations",
            "anthropic-product-operations-ja": "anthropic-products-policy",
            "gemini-product-operations-ja": "google-ai-products",
        }
        self.assertNotIn("frontier-product-operations-ja", by_id)
        for query_id, review_lane in focused_japanese_product_queries.items():
            entry = by_id[query_id]
            self.assertEqual(entry["language"], "ja")
            self.assertEqual(entry["country"], "JP")
            self.assertEqual(entry["coverageGroup"], "global-frontier")
            self.assertEqual(
                entry["maxResults"],
                MODULE.GOOGLE_NEWS_SAFE_RESULT_LIMIT,
            )
            self.assertTrue(entry["required"])
            self.assertTrue(entry["mustReview"])
            self.assertEqual(entry["reviewLane"], review_lane)

        demis_query = by_id["demis-hassabis-en"]
        self.assertTrue(demis_query["required"])
        self.assertTrue(demis_query["mustReview"])
        self.assertEqual(demis_query["reviewLane"], "google-ai-products")
        self.assertNotIn("(DeepMind OR AI)", demis_query["query"])
        for term in [
            "Demis Hassabis",
            "DeepMind",
            "-Gemini",
            "-AlphaFold",
        ]:
            self.assertIn(term, demis_query["query"])

        demis_gemini_query = by_id["demis-hassabis-gemini-en"]
        demis_science_query = by_id["demis-hassabis-science-en"]
        for entry in [demis_gemini_query, demis_science_query]:
            self.assertTrue(entry["required"])
            self.assertTrue(entry["mustReview"])
            self.assertEqual(entry["reviewLane"], "google-ai-products")
        self.assertIn('"Demis Hassabis" Gemini', demis_gemini_query["query"])
        self.assertIn("AlphaFold OR Isomorphic", demis_science_query["query"])

        demis_strategy_query = by_id["demis-hassabis-strategy-en"]
        self.assertTrue(demis_strategy_query["required"])
        self.assertTrue(demis_strategy_query["mustReview"])
        self.assertEqual(demis_strategy_query["reviewLane"], "google-ai-products")
        for term in ["Demis Hassabis", "safety", "regulation", "policy", "investment"]:
            self.assertIn(term, demis_strategy_query["query"])

        demis_broad_query = by_id["demis-hassabis-broad-en"]
        self.assertFalse(demis_broad_query["required"])
        self.assertFalse(demis_broad_query["mustReview"])
        self.assertEqual(
            demis_broad_query["query"],
            '"Demis Hassabis" (DeepMind OR AI)',
        )

        deepseek_model_query = by_id["deepseek-model-releases-zh"]
        self.assertTrue(deepseek_model_query["required"])
        self.assertTrue(deepseek_model_query["mustReview"])
        self.assertEqual(deepseek_model_query["reviewLane"], "china-model-releases")
        for term in ["DeepSeek OR 深度求索", "新模型", "开源权重", "模型更新"]:
            self.assertIn(term, deepseek_model_query["query"])

        deepseek_query = by_id["deepseek-products-zh"]
        self.assertTrue(deepseek_query["required"])
        self.assertTrue(deepseek_query["mustReview"])
        self.assertEqual(deepseek_query["reviewLane"], "china-product-releases")
        self.assertNotIn("发布 OR 上线 OR 开源", deepseek_query["query"])
        for term in [
            "DeepSeek OR 深度求索",
            "产品上线",
            "开放 API",
            "可用范围",
            "价格调整",
            "额度调整",
            "用量规则",
        ]:
            self.assertIn(term, deepseek_query["query"])

        deepseek_broad_query = by_id["deepseek-broad-zh"]
        self.assertFalse(deepseek_broad_query["required"])
        self.assertFalse(deepseek_broad_query["mustReview"])
        self.assertIn("发布 OR 上线 OR 开源", deepseek_broad_query["query"])

        for supplemental_id in [
            "ai-general-en",
            "frontier-labs-people-en",
            "frontier-labs-people-ja",
            "frontier-labs-people-ko",
            "openai-people-products-en",
            "anthropic-claude-en",
            "gemini-deepmind-en",
            "frontier-product-operations-en",
            "demis-hassabis-broad-en",
            "developer-ai-en",
            "developer-products-en",
            "open-models-en",
            "china-models-zh",
            "china-models-en",
            "china-models-ja",
            "china-models-ko",
            "other-china-models-zh",
            "bytedance-models-zh",
            "deepseek-broad-zh",
            "china-semiconductor-zh",
            "china-semiconductor-en",
            "china-semiconductor-ja",
            "china-semiconductor-ko",
        ]:
            self.assertFalse(by_id[supplemental_id]["required"])
            self.assertFalse(by_id[supplemental_id]["mustReview"])

        must_review_queries = [
            entry for entry in queries if entry["mustReview"]
        ]
        self.assertTrue(must_review_queries)
        self.assertTrue(all(entry["required"] for entry in must_review_queries))
        self.assertTrue(all(
            re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", entry["reviewLane"])
            for entry in must_review_queries
        ))
        tibo_query = by_id["codex-operations-en"]
        self.assertTrue(tibo_query["required"])
        self.assertTrue(tibo_query["mustReview"])
        self.assertEqual(
            tibo_query["reviewLane"],
            "developer-product-operations",
        )
        self.assertIn("thsottiaux", tibo_query["query"])
        self.assertEqual(
            {
                entry["language"]
                for entry in queries
                if entry["required"]
            },
            {"en", "zh-CN", "ja", "ko"},
        )
        query_text = "\n".join(entry["query"] for entry in queries)
        for required_alias in [
            "Anthropic",
            "OpenAI",
            "GPT",
            "Sam Altman",
            "Codex",
            "Tibo Codex",
            "Qoder",
            "OpenRouter",
            "Kimi",
            "智谱",
            "GLM",
            "千问",
            "Qwen Work",
            "MiniMax",
            "混元",
            "美团龙猫",
            "LongCat",
            "CatPaw",
            "WeLM",
            "字节跳动 Seed",
            "豆包",
            "光刻机",
            "DUV",
            "HBM",
            "存储芯片",
            "半导体设备",
            "data center power",
            "AI networking",
            "AI funding",
            "AI lobbying",
            "OpenAI lobbying",
            "sovereign AI",
            "주권 AI",
            "AI partnership",
            "AI 반도체 협력",
        ]:
            self.assertIn(required_alias, query_text)
        self.assertNotIn(
            "Seed",
            {
                entry["query"].strip()
                for entry in queries
            },
        )
        self.assertTrue(all(
            " OR Seed " not in f" {entry['query']} "
            for entry in queries
        ))
        self.assertEqual(len({entry["query"] for entry in queries}), len(queries))
        self.assertTrue(all(
            1 <= entry["maxResults"] <= MODULE.GOOGLE_NEWS_SAFE_RESULT_LIMIT
            for entry in queries
        ))

    def test_korean_open_model_queries_are_required_non_overlapping_shards(
        self,
    ) -> None:
        catalog = MODULE.load_discovery_catalog(
            Path(__file__).with_name("discovery-queries.json")
        )
        by_id = {entry["id"]: entry for entry in catalog["queries"]}
        shard_ids = {
            "lg-exaone-open-ko",
            "lg-exaone-release-ko",
            "lg-ai-research-other-ko",
            "naver-hyperclova-model-releases-ko",
            "upstage-solar-model-releases-ko",
        }

        self.assertNotIn("korean-model-releases-ko", by_id)
        self.assertTrue(shard_ids.issubset(by_id))
        for query_id in shard_ids:
            with self.subTest(query_id=query_id):
                entry = by_id[query_id]
                self.assertEqual(entry["language"], "ko")
                self.assertEqual(entry["country"], "KR")
                self.assertEqual(
                    entry["maxResults"],
                    MODULE.GOOGLE_NEWS_SAFE_RESULT_LIMIT,
                )
                self.assertEqual(entry["category"], "open-model-watch")
                self.assertEqual(entry["coverageGroup"], "open-models")
                self.assertTrue(entry["required"])
                self.assertEqual(entry["priority"], "priority")
                self.assertTrue(entry["mustReview"])
                self.assertEqual(
                    entry["reviewLane"],
                    "open-weight-releases",
                )

        shard_text = "\n".join(by_id[query_id]["query"] for query_id in shard_ids)
        for alias in [
            "K-EXAONE",
            "EXAONE",
            "엑사원",
            "LG AI연구원",
            "HyperCLOVA",
            "하이퍼클로바",
            "네이버",
            "Solar",
            "업스테이지",
            "Upstage",
        ]:
            self.assertIn(alias, shard_text)
        for action in [
            "신규",
            "출시",
            "발표",
            "공개",
            "오픈소스",
            "오픈 소스",
            "가중치",
            "라이선스",
            "라이센스",
            "API",
        ]:
            self.assertIn(action, shard_text)

        exaone_open_query = by_id["lg-exaone-open-ko"]["query"]
        exaone_release_query = by_id["lg-exaone-release-ko"]["query"]
        lg_other_query = by_id["lg-ai-research-other-ko"]["query"]
        self.assertNotIn("출시", exaone_open_query)
        self.assertNotIn("발표", exaone_open_query)
        for exclusion in [
            "-오픈소스",
            '-"오픈 소스"',
            "-가중치",
            "-라이선스",
            "-라이센스",
            "-API",
        ]:
            self.assertIn(exclusion, exaone_release_query)
        for exclusion in ["-K-EXAONE", "-EXAONE", "-엑사원"]:
            self.assertIn(exclusion, lg_other_query)

        naver_query = by_id["naver-hyperclova-model-releases-ko"]["query"]
        upstage_query = by_id["upstage-solar-model-releases-ko"]["query"]
        self.assertNotIn("업스테이지", naver_query)
        self.assertNotIn("Solar", naver_query)
        self.assertNotIn("네이버", upstage_query)
        self.assertNotIn("HyperCLOVA", upstage_query)

    def test_source_config_adds_official_feeds_and_discovery_reddit(self) -> None:
        config = json.loads(
            Path(__file__).with_name("horizon.config.json").read_text(
                encoding="utf-8"
            )
        )
        rss_urls = {
            entry["url"] for entry in config["sources"]["rss"]
            if entry["enabled"]
        }
        for rss_url in [
            "https://www.qbitai.com/feed",
            "https://openrouter.ai/blog/feed.xml",
            "https://forum.qoder.com/c/announcements/7.rss",
            "https://techcrunch.com/category/artificial-intelligence/feed/",
            "https://venturebeat.com/category/ai/feed/",
            "https://feeds.arstechnica.com/arstechnica/technology-lab",
            "https://www.leiphone.com/feed",
            "https://36kr.com/feed",
        ]:
            self.assertIn(rss_url, rss_urls)
        self.assertFalse(any(
            "Tibo" in entry["name"]
            for entry in config["sources"]["rss"]
        ))
        subreddits = {
            entry["subreddit"]: entry
            for entry in config["sources"]["reddit"]["subreddits"]
            if entry["enabled"]
        }
        self.assertEqual(config["sources"]["reddit"]["fetch_comments"], 0)
        for subreddit in ["codex", "OpenAI"]:
            self.assertIn(subreddit, subreddits)
            self.assertEqual(subreddits[subreddit]["min_score"], 0)
            self.assertEqual(
                subreddits[subreddit]["category"],
                "ai-community-lead",
            )


class DiscoveryFetchTests(unittest.IsolatedAsyncioTestCase):
    async def test_empty_query_results_are_reported_as_empty(self) -> None:
        catalog = MODULE.load_discovery_catalog(
            Path(__file__).with_name("discovery-queries.json")
        )

        class EmptyScraper:
            def __init__(self, config, client) -> None:
                self.config = config

            async def fetch(self, since):
                return []

        window_start = datetime.fromisoformat("2026-07-27T07:00:00+08:00")
        window_end = datetime.fromisoformat("2026-07-28T07:00:00+08:00")
        with patch.object(MODULE, "GoogleNewsScraper", EmptyScraper):
            items, report = await MODULE.fetch_topic_queries(
                catalog["queries"][:2],
                window_start,
                window_start,
                window_end,
                concurrency=2,
            )

        self.assertEqual(items, [])
        self.assertEqual([entry["status"] for entry in report], ["empty", "empty"])
        self.assertEqual([entry["windowFetched"] for entry in report], [0, 0])
        self.assertEqual([entry["attempts"] for entry in report], [1, 1])

    async def test_logged_fetch_error_returning_empty_is_reported_as_failure(
        self,
    ) -> None:
        catalog = MODULE.load_discovery_catalog(
            Path(__file__).with_name("discovery-queries.json")
        )
        calls = 0

        class SwallowedFailureScraper:
            def __init__(self, config, client) -> None:
                self.config = config

            async def fetch(self, since):
                nonlocal calls
                calls += 1
                logging.getLogger("src.scrapers.google_news").warning(
                    "Error fetching Google News feed: simulated swallowed failure"
                )
                return []

        window_start = datetime.fromisoformat("2026-07-27T07:00:00+08:00")
        window_end = datetime.fromisoformat("2026-07-28T07:00:00+08:00")
        with (
            patch.object(MODULE, "GoogleNewsScraper", SwallowedFailureScraper),
            patch.object(MODULE, "GOOGLE_NEWS_RETRY_DELAY_SECONDS", 0),
        ):
            items, report = await MODULE.fetch_topic_queries(
                catalog["queries"][:1],
                window_start,
                window_start,
                window_end,
                concurrency=1,
            )

        self.assertEqual(items, [])
        self.assertEqual(calls, 3)
        self.assertEqual(report[0]["status"], "failure")
        self.assertEqual(report[0]["attempts"], 3)
        self.assertEqual(
            report[0]["errorType"],
            "GoogleNewsScraperLoggedFailure",
        )

    async def test_query_fetch_uses_bounded_concurrency(self) -> None:
        catalog = MODULE.load_discovery_catalog(
            Path(__file__).with_name("discovery-queries.json")
        )
        active = 0
        peak = 0

        class TrackingScraper:
            def __init__(self, config, client) -> None:
                self.config = config

            async def fetch(self, since):
                nonlocal active, peak
                active += 1
                peak = max(peak, active)
                await asyncio.sleep(0.02)
                active -= 1
                return [
                    SimpleNamespace(
                        id=f"item-{self.config.category}",
                        url=f"https://example.test/{self.config.category}",
                        published_at=datetime.fromisoformat(
                            "2026-07-27T12:00:00+08:00"
                        ),
                        metadata={},
                    )
                ]

        window_start = datetime.fromisoformat("2026-07-27T07:00:00+08:00")
        window_end = datetime.fromisoformat("2026-07-28T07:00:00+08:00")
        with patch.object(MODULE, "GoogleNewsScraper", TrackingScraper):
            items, report = await MODULE.fetch_topic_queries(
                catalog["queries"][:4],
                window_start,
                window_start,
                window_end,
                concurrency=2,
            )

        self.assertEqual(len(items), 4)
        self.assertEqual(len(report), 4)
        self.assertEqual(peak, 2)
        self.assertTrue(all(entry["status"] == "success" for entry in report))

    async def test_discovery_budget_timeout_stops_the_run(self) -> None:
        catalog = MODULE.load_discovery_catalog(
            Path(__file__).with_name("discovery-queries.json")
        )

        class SlowScraper:
            def __init__(self, config, client) -> None:
                self.config = config

            async def fetch(self, since):
                await asyncio.sleep(0.1)
                return []

        window_start = datetime.fromisoformat("2026-07-27T07:00:00+08:00")
        window_end = datetime.fromisoformat("2026-07-28T07:00:00+08:00")
        with (
            patch.object(MODULE, "GoogleNewsScraper", SlowScraper),
            patch.object(MODULE, "DISCOVERY_QUERY_BUDGET_SECONDS", 0.01),
        ):
            with self.assertRaisesRegex(
                RuntimeError,
                "discovery query time budget exceeded",
            ):
                await MODULE.fetch_topic_queries(
                    catalog["queries"][:1],
                    window_start,
                    window_start,
                    window_end,
                    concurrency=1,
                )

    async def test_exact_requested_count_is_not_misreported_as_truncated(
        self,
    ) -> None:
        catalog = MODULE.load_discovery_catalog(
            Path(__file__).with_name("discovery-queries.json")
        )
        entry = next(
            item for item in catalog["queries"] if item["mustReview"]
        ).copy()
        entry["maxResults"] = 2

        class CappedScraper:
            def __init__(self, config, client) -> None:
                self.config = config

            async def fetch(self, since):
                return [
                    SimpleNamespace(
                        id="inside-window",
                        url="https://example.test/inside-window",
                        published_at=datetime.fromisoformat(
                            "2026-07-27T12:00:00+08:00"
                        ),
                        metadata={},
                    ),
                    SimpleNamespace(
                        id="outside-window",
                        url="https://example.test/outside-window",
                        published_at=datetime.fromisoformat(
                            "2026-07-27T06:00:00+08:00"
                        ),
                        metadata={},
                    ),
                ]

        window_start = datetime.fromisoformat("2026-07-27T07:00:00+08:00")
        window_end = datetime.fromisoformat("2026-07-28T07:00:00+08:00")
        with patch.object(MODULE, "GoogleNewsScraper", CappedScraper):
            items, report = await MODULE.fetch_topic_queries(
                [entry],
                window_start,
                window_start,
                window_end,
                concurrency=1,
            )

        self.assertEqual(len(items), 2)
        self.assertEqual(report[0]["fetched"], 2)
        self.assertEqual(report[0]["windowFetched"], 1)
        self.assertFalse(report[0]["resultLimitReached"])
        self.assertEqual(report[0]["status"], "success")
        self.assertEqual(MODULE.required_query_failure_ids(report), [])
        self.assertEqual(
            MODULE.finalized_fetch_status("success", [], report),
            "success",
        )

    async def test_required_query_result_overflow_fails_closed(
        self,
    ) -> None:
        catalog = MODULE.load_discovery_catalog(
            Path(__file__).with_name("discovery-queries.json")
        )
        entry = next(
            item for item in catalog["queries"] if item["mustReview"]
        ).copy()
        entry["maxResults"] = 2

        class OverflowScraper:
            def __init__(self, config, client) -> None:
                self.config = config

            async def fetch(self, since):
                self_test.assertEqual(self.config.max_results, 3)
                return [
                    SimpleNamespace(
                        id=f"overflow-{index}",
                        url=f"https://example.test/overflow-{index}",
                        published_at=datetime.fromisoformat(
                            "2026-07-27T12:00:00+08:00"
                        ),
                        metadata={},
                    )
                    for index in range(3)
                ]

        self_test = self
        window_start = datetime.fromisoformat("2026-07-27T07:00:00+08:00")
        window_end = datetime.fromisoformat("2026-07-28T07:00:00+08:00")
        with patch.object(MODULE, "GoogleNewsScraper", OverflowScraper):
            items, report = await MODULE.fetch_topic_queries(
                [entry],
                window_start,
                window_start,
                window_end,
                concurrency=1,
            )

        self.assertEqual(len(items), 2)
        self.assertEqual(report[0]["fetched"], 2)
        self.assertTrue(report[0]["resultLimitReached"])
        self.assertEqual(report[0]["status"], "failure")
        self.assertEqual(
            report[0]["errorType"],
            "GoogleNewsResultLimitReached",
        )
        self.assertEqual(
            MODULE.required_query_failure_ids(report),
            [entry["id"]],
        )
        self.assertEqual(
            MODULE.finalized_fetch_status("success", [], report),
            "partial",
        )

    async def test_supplemental_query_overflow_is_reported_but_not_blocking(
        self,
    ) -> None:
        catalog = MODULE.load_discovery_catalog(
            Path(__file__).with_name("discovery-queries.json")
        )
        entry = next(
            item for item in catalog["queries"] if not item["required"]
        ).copy()
        entry["maxResults"] = 1

        class CappedScraper:
            def __init__(self, config, client) -> None:
                self.config = config

            async def fetch(self, since):
                return [
                    SimpleNamespace(
                        id="supplemental",
                        url="https://example.test/supplemental",
                        published_at=datetime.fromisoformat(
                            "2026-07-27T12:00:00+08:00"
                        ),
                        metadata={},
                    ),
                    SimpleNamespace(
                        id="supplemental-overflow",
                        url="https://example.test/supplemental-overflow",
                        published_at=datetime.fromisoformat(
                            "2026-07-27T13:00:00+08:00"
                        ),
                        metadata={},
                    ),
                ]

        window_start = datetime.fromisoformat("2026-07-27T07:00:00+08:00")
        window_end = datetime.fromisoformat("2026-07-28T07:00:00+08:00")
        with patch.object(MODULE, "GoogleNewsScraper", CappedScraper):
            items, report = await MODULE.fetch_topic_queries(
                [entry],
                window_start,
                window_start,
                window_end,
                concurrency=1,
            )

        self.assertEqual(len(items), 1)
        self.assertEqual(report[0]["status"], "truncated")
        self.assertTrue(report[0]["resultLimitReached"])
        self.assertEqual(MODULE.required_query_failure_ids(report), [])
        self.assertEqual(
            MODULE.finalized_fetch_status("success", [], report),
            "success",
        )

    async def test_optional_supplemental_rss_failure_is_non_blocking(self) -> None:
        self.assertEqual(
            MODULE.finalized_fetch_status(
                "success",
                [
                    "OpenRouter Blog",
                    "Qoder Announcements",
                    "量子位官网",
                    "雷峰网",
                    "36氪",
                ],
                [],
            ),
            "success",
        )
        self.assertEqual(
            MODULE.finalized_fetch_status(
                "success",
                ["OpenAI News"],
                [],
            ),
            "partial",
        )
        self.assertEqual(
            MODULE.finalized_fetch_status(
                "success",
                ["TechCrunch AI", "OpenAI News"],
                [],
            ),
            "partial",
        )

    async def test_optional_rss_has_one_retry_and_required_has_two(self) -> None:
        calls: dict[str, int] = {}

        class LoggedFailureScraper:
            def __init__(self, sources, client) -> None:
                self.sources = sources

            async def fetch(self, since):
                feed_name = self.sources[0].name
                calls[feed_name] = calls.get(feed_name, 0) + 1
                logging.getLogger("src.scrapers.rss").warning(
                    "Error parsing RSS feed %s: simulated failure",
                    feed_name,
                )
                return []

        config = SimpleNamespace(
            sources=SimpleNamespace(
                rss=[
                    SimpleNamespace(name="TechCrunch AI"),
                    SimpleNamespace(name="OpenAI News"),
                ]
            )
        )
        with patch.object(MODULE, "RSSScraper", LoggedFailureScraper):
            items, report = await MODULE.retry_failed_rss(
                {"TechCrunch AI", "OpenAI News"},
                config,
                datetime.fromisoformat("2026-07-27T07:00:00+08:00"),
            )

        self.assertEqual(items, [])
        self.assertEqual(calls["TechCrunch AI"], 1)
        self.assertEqual(calls["OpenAI News"], 2)
        self.assertEqual(
            report["unresolved"],
            ["OpenAI News", "TechCrunch AI"],
        )


class MustReviewProvenanceTests(unittest.TestCase):
    def test_focused_multilingual_material_changes_receive_editorial_signals(
        self,
    ) -> None:
        items = [
            SimpleNamespace(
                title="Kimi K3 完整权重正式发布并开源",
                summary="",
                content="",
                metadata={
                    "must_review": True,
                    "review_lanes": ["china-model-releases"],
                },
            ),
            SimpleNamespace(
                title="Claude Code update adds wider team availability",
                summary="",
                content="",
                metadata={
                    "must_review": True,
                    "review_lanes": ["developer-product-releases"],
                },
            ),
            SimpleNamespace(
                title="OpenAI lowers ChatGPT plan price",
                summary="",
                content="",
                metadata={
                    "must_review": True,
                    "review_lanes": ["openai-product-operations"],
                },
            ),
            SimpleNamespace(
                title="Seedance 2.5の公開を延期",
                summary="",
                content="",
                metadata={
                    "must_review": True,
                    "review_lanes": ["bytedance-creative-models"],
                },
            ),
            SimpleNamespace(
                title="EXAONE 모델 가중치 공개",
                summary="",
                content="",
                metadata={
                    "must_review": True,
                    "review_lanes": ["open-weight-releases"],
                },
            ),
            SimpleNamespace(
                title="Microsoft previews MAI-Realtime bidirectional voice model",
                summary="",
                content="",
                metadata={
                    "must_review": True,
                    "review_lanes": ["voice-model-releases"],
                },
            ),
        ]

        MODULE.apply_editorial_signals(items)

        self.assertEqual(
            items[0].metadata["editorial_signals"],
            [
                "capability-availability-change",
                "major-model-product-change",
            ],
        )
        self.assertEqual(
            items[1].metadata["editorial_signals"],
            ["capability-availability-change", "developer-tool-change"],
        )
        self.assertEqual(
            items[2].metadata["editorial_signals"],
            ["material-price-quota-change"],
        )
        self.assertEqual(
            items[3].metadata["editorial_signals"],
            [
                "capability-availability-change",
                "major-model-product-change",
            ],
        )
        self.assertEqual(
            items[4].metadata["editorial_signals"],
            [
                "capability-availability-change",
                "major-model-product-change",
            ],
        )
        self.assertEqual(
            items[5].metadata["editorial_signals"],
            [
                "capability-availability-change",
                "major-model-product-change",
            ],
        )

    def test_priority_topics_beyond_models_receive_deep_review_signals(
        self,
    ) -> None:
        cases = [
            (
                "长鑫存储LPDDR6接近研发验证尾声",
                ["china-semiconductor-breakthroughs"],
                ["china-semiconductor"],
                "strategic-hardware-infrastructure-change",
            ),
            (
                "BYD confirms plan to unveil humanoid robot in August",
                ["robotics-device-releases"],
                ["robotics-devices"],
                "strategic-hardware-infrastructure-change",
            ),
            (
                "Galaxy Digital buys Texas site for AI data center campus",
                ["data-center-infrastructure"],
                ["data-centers"],
                "strategic-hardware-infrastructure-change",
            ),
            (
                "AI robotics startup raises $300 million Series C",
                ["major-tech-finance"],
                ["tech-finance"],
                "major-tech-finance-change",
            ),
            (
                "Anthropic says Claude breached companies during safety test",
                ["complete-discovery-review"],
                ["global-frontier"],
                "ai-policy-safety-change",
            ),
            (
                "Minnesota AI ban takes effect after judge rejects xAI bid",
                ["complete-discovery-review"],
                ["global-frontier"],
                "ai-policy-safety-change",
            ),
        ]
        for title, review_lanes, coverage_groups, expected_signal in cases:
            item = SimpleNamespace(
                title=title,
                summary="",
                content="",
                metadata={
                    "must_review": True,
                    "review_lanes": review_lanes,
                    "coverage_groups": coverage_groups,
                },
            )
            MODULE.apply_editorial_signals([item])
            self.assertIn(
                expected_signal,
                item.metadata["editorial_signals"],
                title,
            )

    def test_media_rss_model_and_tool_releases_receive_product_signals(
        self,
    ) -> None:
        items = [
            SimpleNamespace(
                title="阿里22B实时数字人模型开源",
                summary="",
                content="",
                metadata={
                    "must_review": True,
                    "review_lanes": ["china-ai-media"],
                },
            ),
            SimpleNamespace(
                title="华为诺亚开源MindMemOS让Agent记忆持续进化",
                summary="",
                content="",
                metadata={
                    "must_review": True,
                    "review_lanes": ["china-ai-media"],
                },
            ),
        ]
        MODULE.apply_editorial_signals(items)
        self.assertIn(
            "major-model-product-change",
            items[0].metadata["editorial_signals"],
        )
        self.assertIn(
            "capability-availability-change",
            items[1].metadata["editorial_signals"],
        )

    def test_context_window_and_free_model_do_not_become_price_signals(
        self,
    ) -> None:
        items = [
            SimpleNamespace(
                title="Claude increases context window availability",
                summary="",
                content="",
                metadata={
                    "must_review": True,
                    "review_lanes": ["anthropic-products-policy"],
                },
            ),
            SimpleNamespace(
                title="Company releases free open-weight model",
                summary="",
                content="",
                metadata={
                    "must_review": True,
                    "review_lanes": ["open-weight-releases"],
                },
            ),
        ]
        MODULE.apply_editorial_signals(items)
        for item in items:
            self.assertNotIn(
                "material-price-quota-change",
                item.metadata["editorial_signals"],
            )

    def test_generic_complete_review_lane_does_not_create_material_signal(
        self,
    ) -> None:
        item = SimpleNamespace(
            title="Company releases quarterly earnings",
            summary="",
            content="",
            metadata={
                "must_review": True,
                "review_lanes": ["complete-discovery-review"],
            },
        )

        MODULE.apply_editorial_signals([item])

        self.assertNotIn("editorial_signals", item.metadata)

    def test_multilingual_must_review_usage_policy_change_is_marked(
        self,
    ) -> None:
        item = SimpleNamespace(
            url="https://example.test/codex-limit",
            title=(
                "ChatGPT WorkとCodexの5時間制限「明日から再開」 "
                "GPT-5.6 Solのトークン消費問題を改善"
            ),
            content="",
            metadata={"must_review": True},
        )

        MODULE.apply_editorial_signals([item])

        self.assertEqual(
            item.metadata["editorial_signals"],
            ["usage-policy-change"],
        )

    def test_usage_signal_never_creates_orphan_must_review_provenance(
        self,
    ) -> None:
        item = SimpleNamespace(
            url="https://example.test/unfocused-limit-story",
            title="OpenAI restores the five-hour Codex usage limit",
            content="",
            metadata={},
        )

        MODULE.apply_editorial_signals([item])

        self.assertNotIn("editorial_signals", item.metadata)
        self.assertNotIn("must_review", item.metadata)

    def test_generic_token_or_model_efficiency_news_is_not_usage_policy(
        self,
    ) -> None:
        items = [
            SimpleNamespace(
                url="https://example.test/gemma-engine",
                title=(
                    "OpenAI-compatible engine runs Gemma 4 26B "
                    "in 2 GB RAM on a Mac"
                ),
                content="reduces token memory and improves performance",
                metadata={"must_review": True},
            ),
            SimpleNamespace(
                url="https://example.test/model-router",
                title=(
                    "Tokenless automatically switches OpenAI models "
                    "to save money"
                ),
                content="",
                metadata={"must_review": True},
            ),
        ]

        MODULE.apply_editorial_signals(items)

        self.assertTrue(all(
            "editorial_signals" not in item.metadata
            for item in items
        ))

    def test_focus_query_metadata_survives_url_merge_and_compaction(self) -> None:
        url = "https://example.test/focus-story"
        topic_items = [
            SimpleNamespace(
                url=url,
                metadata={
                    "discovery_query_id": "qwen-products-zh",
                    "coverage_group": "china-models",
                    "coverage_priority": "priority",
                    "required_query": True,
                    "must_review_query": True,
                    "review_lane": "china-product-releases",
                },
            ),
            SimpleNamespace(
                url=url,
                metadata={
                    "discovery_query_id": "china-models-zh",
                    "coverage_group": "china-models",
                    "coverage_priority": "priority",
                    "required_query": False,
                    "must_review_query": False,
                },
            ),
        ]
        merged_item = SimpleNamespace(url=url, metadata={})

        MODULE.apply_query_provenance([merged_item], topic_items)
        merged_item.metadata["editorial_signals"] = [
            "major-model-product-change"
        ]
        compact = MODULE.compact_candidate(
            {
                "id": "candidate-focus",
                "title": "千问办公发布",
                "url": url,
                "source_type": "google_news",
                "published_at": "2026-07-27T12:00:00+08:00",
                "metadata": merged_item.metadata,
            }
        )

        self.assertEqual(
            compact["queryIds"],
            ["china-models-zh", "qwen-products-zh"],
        )
        self.assertTrue(compact["mustReview"])
        self.assertEqual(
            compact["mustReviewQueryIds"],
            ["qwen-products-zh"],
        )
        self.assertEqual(
            compact["reviewLanes"],
            [
                "china-product-releases",
                "complete-discovery-review",
            ],
        )
        self.assertEqual(
            compact["editorialSignals"],
            ["major-model-product-change"],
        )

    def test_priority_supplemental_candidate_is_mandatory_review(self) -> None:
        url = "https://example.test/priority-story"
        topic_item = SimpleNamespace(
            url=url,
            metadata={
                "discovery_query_id": "china-models-en",
                "coverage_group": "china-models",
                "coverage_priority": "priority",
                "required_query": False,
                "must_review_query": False,
            },
        )
        merged_item = SimpleNamespace(url=url, metadata={})

        MODULE.apply_query_provenance([merged_item], [topic_item])
        compact = MODULE.compact_candidate(
            {
                "id": "candidate-priority",
                "title": "Seedance 2.5 availability update",
                "url": url,
                "source_type": "google_news",
                "published_at": "2026-07-30T08:47:46Z",
                "metadata": merged_item.metadata,
            }
        )

        self.assertTrue(compact["mustReview"])
        self.assertEqual(compact["mustReviewQueryIds"], [])
        self.assertEqual(
            compact["reviewLanes"],
            ["complete-discovery-review"],
        )

    def test_complete_candidate_review_policy_marks_every_candidate(self) -> None:
        standard_item = SimpleNamespace(
            url="https://example.test/standard",
            metadata={},
        )
        focused_item = SimpleNamespace(
            url="https://example.test/focused",
            metadata={
                "must_review": True,
                "review_lanes": ["china-product-releases"],
            },
        )

        MODULE.apply_complete_candidate_review_policy(
            [standard_item, focused_item]
        )

        self.assertTrue(standard_item.metadata["must_review"])
        self.assertEqual(
            standard_item.metadata["review_lanes"],
            ["complete-discovery-review"],
        )
        self.assertTrue(focused_item.metadata["must_review"])
        self.assertEqual(
            focused_item.metadata["review_lanes"],
            ["china-product-releases", "complete-discovery-review"],
        )

    def test_focus_query_provenance_survives_tracking_url_normalization(
        self,
    ) -> None:
        topic_item = SimpleNamespace(
            url="https://example.test/story?utm_source=google",
            metadata={
                "discovery_query_id": "qwen-products-zh",
                "coverage_group": "china-models",
                "coverage_priority": "priority",
                "required_query": True,
                "must_review_query": True,
                "review_lane": "china-product-releases",
            },
        )
        merged_item = SimpleNamespace(
            url="https://example.test/story",
            metadata={},
        )

        MODULE.apply_query_provenance([merged_item], [topic_item])

        self.assertEqual(
            merged_item.metadata["must_review_query_ids"],
            ["qwen-products-zh"],
        )
        self.assertTrue(merged_item.metadata["must_review"])

    def test_direct_rss_reddit_and_hackernews_candidates_are_mandatory_review(
        self,
    ) -> None:
        rss_item = SimpleNamespace(
            url="https://openrouter.ai/blog/example",
            source_type="rss",
            metadata={"feed_name": "OpenRouter Blog"},
        )
        reddit_item = SimpleNamespace(
            url="https://huggingface.co/example/model",
            source_type="reddit",
            metadata={"subreddit": "LocalLLaMA"},
        )
        hackernews_item = SimpleNamespace(
            url="https://github.blog/changelog/example",
            source_type=SourceType.HACKERNEWS,
            metadata={},
        )

        MODULE.apply_direct_source_review_provenance(
            [rss_item, reddit_item, hackernews_item]
        )

        self.assertEqual(
            rss_item.metadata["must_review_source_ids"],
            ["rss-openrouter-blog"],
        )
        self.assertEqual(
            rss_item.metadata["review_lanes"],
            ["developer-product-releases"],
        )
        self.assertTrue(rss_item.metadata["must_review"])
        self.assertEqual(
            reddit_item.metadata["must_review_source_ids"],
            ["reddit-local-llama"],
        )
        self.assertEqual(
            reddit_item.metadata["review_lanes"],
            ["ai-community-discovery"],
        )
        self.assertTrue(reddit_item.metadata["must_review"])
        self.assertEqual(
            hackernews_item.metadata["must_review_source_ids"],
            ["hackernews-top-stories"],
        )
        self.assertEqual(
            hackernews_item.metadata["review_lanes"],
            ["developer-community-discovery"],
        )
        self.assertTrue(hackernews_item.metadata["must_review"])
        self.assertEqual(
            MODULE.DIRECT_REVIEW_SUBREDDITS["Seedance_AI"],
            (
                "reddit-seedance-ai",
                "multimodal-community-discovery",
            ),
        )

    def test_review_source_survives_premerged_feed_name_conflict(self) -> None:
        merged_item = SimpleNamespace(
            url="https://example.test/shared-story",
            metadata={
                "feed_name": "General Feed",
                "feed_names": ["General Feed", "OpenRouter Blog"],
                "subreddits": ["codex"],
            },
        )

        MODULE.apply_direct_source_review_provenance([merged_item])

        self.assertEqual(
            merged_item.metadata["must_review_source_ids"],
            ["reddit-codex", "rss-openrouter-blog"],
        )
        self.assertEqual(
            merged_item.metadata["review_lanes"],
            [
                "developer-product-operations",
                "developer-product-releases",
            ],
        )
        self.assertTrue(merged_item.metadata["must_review"])

    def test_manifest_declares_exact_must_review_candidate_set(self) -> None:
        window_start = datetime.fromisoformat("2026-07-27T07:00:00+08:00")
        window_end = datetime.fromisoformat("2026-07-28T07:00:00+08:00")
        catalog = {
            "languagePolicy": "any-reliable-language",
            "seedLanguages": ["en", "zh-CN", "ja", "ko"],
            "lowVolumeTrigger": 5,
            "coverageGroups": [
                {
                    "id": "china-models",
                    "label": "中国模型厂商",
                    "required": True,
                    "priority": "priority",
                }
            ],
            "queries": [
                {
                    "id": "qwen-products-zh",
                    "coverageGroup": "china-models",
                    "required": True,
                    "priority": "priority",
                    "mustReview": True,
                    "reviewLane": "china-product-releases",
                    "language": "zh-CN",
                    "country": "CN",
                    "maxResults": 30,
                }
            ],
        }
        window_items = [
            {
                "id": "candidate-focus",
                "title": "千问办公发布",
                "url": "https://example.test/focus",
                "source_type": "google_news",
                "published_at": "2026-07-27T12:00:00+08:00",
                "metadata": {
                    "discovery_query_ids": ["qwen-products-zh"],
                    "coverage_groups": ["china-models"],
                    "coverage_priority": "priority",
                    "must_review": True,
                    "must_review_query_ids": ["qwen-products-zh"],
                    "review_lanes": [
                        "china-product-releases",
                        "complete-discovery-review",
                    ],
                },
            },
            {
                "id": "candidate-general",
                "title": "一般新闻",
                "url": "https://example.test/general",
                "source_type": "rss",
                "published_at": "2026-07-27T13:00:00+08:00",
                "metadata": {
                    "feed_name": "OpenRouter Blog",
                    "must_review": True,
                    "must_review_source_ids": ["rss-openrouter-blog"],
                    "review_lanes": [
                        "complete-discovery-review",
                        "developer-product-releases",
                    ],
                },
            },
        ]
        manifest = MODULE.build_coverage_manifest(
            run_id="run-test",
            target_date=window_start.date(),
            window_start=window_start,
            window_end=window_end,
            fetch_status="success",
            catalog=catalog,
            query_report=[
                {
                    "id": "qwen-products-zh",
                    "status": "success",
                    "fetched": 1,
                    "windowFetched": 1,
                    "attempts": 1,
                    "resultLimitReached": False,
                }
            ],
            window_items=window_items,
            candidate_index_path=(
                MODULE.REPO_ROOT
                / "data"
                / "mcp-runs"
                / "run-test"
                / "candidate_index.json"
            ),
            candidate_index_sha256="0" * 64,
        )

        self.assertEqual(
            manifest["mustReviewCandidateIds"],
            ["candidate-focus", "candidate-general"],
        )
        self.assertEqual(manifest["schemaVersion"], 2)
        self.assertEqual(
            manifest["priorityReviewPolicy"],
            "all-discovered-candidates",
        )
        self.assertEqual(
            manifest["protectedEventReviewPolicy"],
            "evidence-backed-protected-events-v1",
        )
        review_lanes = {
            entry["id"]: entry
            for entry in manifest["reviewLanes"]
        }
        self.assertEqual(
            review_lanes["china-product-releases"],
            {
                "id": "china-product-releases",
                "queryIds": ["qwen-products-zh"],
                "sourceIds": [],
                "candidateIds": ["candidate-focus"],
            },
        )
        self.assertEqual(
            review_lanes["complete-discovery-review"],
            {
                "id": "complete-discovery-review",
                "queryIds": [],
                "sourceIds": [],
                "candidateIds": ["candidate-focus", "candidate-general"],
            },
        )
        self.assertIn("reviewSources", manifest)
        self.assertTrue(
            all(
                {
                    "id",
                    "sourceType",
                    "sourceName",
                    "reviewLane",
                    "candidateIds",
                }.issubset(entry)
                for entry in manifest["reviewSources"]
            )
        )
        review_sources = {
            entry["id"]: entry
            for entry in manifest["reviewSources"]
        }
        self.assertEqual(
            review_sources["rss-openrouter-blog"]["candidateIds"],
            ["candidate-general"],
        )


if __name__ == "__main__":
    unittest.main()
