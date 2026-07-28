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
            "anthropic-claude-en",
            "anthropic-product-operations-en",
            "frontier-product-operations-en",
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
            "meituan-models-zh",
            "wechat-welm-zh",
            "sensetime-models-zh",
            "stepfun-models-zh",
            "lingyi-models-zh",
            "baichuan-models-zh",
            "xiaomi-mimo-zh",
            "china-models-zh",
            "china-models-en",
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

        for supplemental_id in [
            "ai-general-en",
            "frontier-labs-people-en",
            "frontier-labs-people-ja",
            "frontier-labs-people-ko",
            "openai-people-products-en",
            "anthropic-claude-en",
            "gemini-deepmind-en",
            "frontier-product-operations-en",
            "developer-ai-en",
            "developer-products-en",
            "open-models-en",
            "china-models-zh",
            "china-models-en",
            "china-models-ja",
            "china-models-ko",
            "other-china-models-zh",
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
        self.assertTrue(any(
            entry["name"] == "Bing Web - Tibo Codex"
            and "thsottiaux" in entry["url"]
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
            ["china-product-releases"],
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

    def test_direct_rss_and_reddit_candidates_are_mandatory_review(self) -> None:
        rss_item = SimpleNamespace(
            url="https://openrouter.ai/blog/example",
            metadata={"feed_name": "OpenRouter Blog"},
        )
        reddit_item = SimpleNamespace(
            url="https://www.reddit.com/r/codex/comments/example",
            metadata={"subreddit": "codex"},
        )

        MODULE.apply_direct_source_review_provenance([rss_item, reddit_item])

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
            ["reddit-codex"],
        )
        self.assertEqual(
            reddit_item.metadata["review_lanes"],
            ["developer-product-operations"],
        )
        self.assertTrue(reddit_item.metadata["must_review"])

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
                    "review_lanes": ["china-product-releases"],
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
                    "review_lanes": ["developer-product-releases"],
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
