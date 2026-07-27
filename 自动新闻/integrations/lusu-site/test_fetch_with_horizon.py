from __future__ import annotations

import importlib.util
import unittest
from datetime import datetime, timedelta
from pathlib import Path


MODULE_PATH = Path(__file__).with_name("fetch-with-horizon.py")
SPEC = importlib.util.spec_from_file_location("lusu_fetch_with_horizon", MODULE_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError(f"cannot import {MODULE_PATH}")
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


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
        queries = MODULE.load_topic_queries(
            Path(__file__).with_name("discovery-queries.json")
        )

        self.assertEqual(
            {entry["id"] for entry in queries},
            {
                "ai",
                "chips-storage",
                "robotics",
                "ai-devices",
                "autonomous-driving",
                "data-centers",
                "tech-finance",
            },
        )
        self.assertEqual(len({entry["query"] for entry in queries}), len(queries))
        self.assertTrue(all(1 <= entry["maxResults"] <= 100 for entry in queries))


if __name__ == "__main__":
    unittest.main()
