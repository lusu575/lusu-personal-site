from __future__ import annotations

import importlib.util
import asyncio
import logging
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
            "frontier-labs-people-en",
            "ai-policy-lobbying-en",
            "ai-lobbying-en",
            "developer-ai-en",
            "open-models-en",
            "china-models-zh",
            "china-models-en",
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
        self.assertTrue(all(entry["required"] for entry in queries))
        self.assertTrue(all(entry["coverageGroup"] for entry in queries))
        query_text = "\n".join(entry["query"] for entry in queries)
        for required_alias in [
            "Anthropic",
            "OpenAI",
            "GPT",
            "Sam Altman",
            "Codex",
            "Kimi",
            "智谱",
            "GLM",
            "千问",
            "MiniMax",
            "混元",
            "美团龙猫",
            "LongCat",
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
        self.assertTrue(all(1 <= entry["maxResults"] <= 100 for entry in queries))


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


if __name__ == "__main__":
    unittest.main()
