"""Run Horizon's native fetch and cross-source dedupe for one exact window."""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import math
import re
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[2]
INTEGRATION_ROOT = Path(__file__).resolve().parent
DEFAULT_CONFIG = INTEGRATION_ROOT / "horizon.config.json"
DEFAULT_DISCOVERY_QUERIES = INTEGRATION_ROOT / "discovery-queries.json"
SHANGHAI = timezone(timedelta(hours=8), name="Asia/Shanghai")
MAX_LOOKBACK_HOURS = 168
QUERY_ID_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")

sys.path.insert(0, str(REPO_ROOT))
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

from src.mcp.service import HorizonPipelineService  # noqa: E402
from src.mcp.horizon_adapter import (  # noqa: E402
    dicts_to_items,
    get_source_counts,
    items_to_dicts,
    load_config,
    load_runtime,
    make_orchestrator,
    make_storage,
)
from src.models import GoogleNewsConfig  # noqa: E402
from src.scrapers.google_news import GoogleNewsScraper  # noqa: E402
from src.scrapers.rss import RSSScraper  # noqa: E402

import httpx  # noqa: E402


class RssFailureRecorder(logging.Handler):
    """Capture per-feed failures that Horizon currently reports through logging."""

    pattern = re.compile(r"Error (?:fetching|parsing) RSS feed ([^:]+):")

    def __init__(self) -> None:
        super().__init__(level=logging.WARNING)
        self.feed_names: set[str] = set()

    def emit(self, record: logging.LogRecord) -> None:
        match = self.pattern.search(record.getMessage())
        if match:
            self.feed_names.add(match.group(1).strip())


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Fetch AI-news candidates through Horizon for one exact time window."
    )
    parser.add_argument(
        "--date",
        dest="report_date",
        default=None,
        help="Report label in YYYY-MM-DD form; defaults to the window's Shanghai date.",
    )
    parser.add_argument(
        "--start",
        default=None,
        help="Inclusive ISO 8601 window start; a timezone offset is required.",
    )
    parser.add_argument(
        "--end",
        default=None,
        help="Exclusive ISO 8601 window end; a timezone offset is required.",
    )
    parser.add_argument(
        "--hours",
        type=int,
        default=48,
        help="Minimum Horizon lookback window before the exact-window filter.",
    )
    parser.add_argument(
        "--config",
        default=str(DEFAULT_CONFIG),
        help="Horizon configuration path.",
    )
    parser.add_argument(
        "--discovery-queries",
        default=str(DEFAULT_DISCOVERY_QUERIES),
        help="Multi-topic Google News discovery query configuration path.",
    )
    return parser.parse_args(argv)


def parse_iso_datetime(value: str, option_name: str) -> datetime:
    """Parse one timezone-aware ISO 8601 timestamp."""

    try:
        timestamp = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError(f"{option_name} must be a valid ISO 8601 timestamp") from exc
    if timestamp.tzinfo is None or timestamp.utcoffset() is None:
        raise ValueError(f"{option_name} must include a timezone offset")
    return timestamp


def resolve_window(
    report_date: str | None,
    start_value: str | None,
    end_value: str | None,
    *,
    now: datetime | None = None,
) -> tuple[date, datetime, datetime]:
    """Resolve either an explicit interval or a backward-compatible Shanghai day."""

    if bool(start_value) != bool(end_value):
        raise ValueError("--start and --end must be supplied together")

    if start_value and end_value:
        window_start = parse_iso_datetime(start_value, "--start")
        window_end = parse_iso_datetime(end_value, "--end")
        derived_date = (window_end.astimezone(SHANGHAI) - timedelta(microseconds=1)).date()
        target_date = date.fromisoformat(report_date) if report_date else derived_date
    else:
        target_date = (
            date.fromisoformat(report_date)
            if report_date
            else (now or datetime.now(SHANGHAI)).astimezone(SHANGHAI).date()
        )
        window_start = datetime.combine(target_date, datetime.min.time(), SHANGHAI)
        window_end = window_start + timedelta(days=1)

    duration = window_end.astimezone(timezone.utc) - window_start.astimezone(timezone.utc)
    if duration <= timedelta(0):
        raise ValueError("--end must be later than --start")
    if duration > timedelta(hours=MAX_LOOKBACK_HOURS):
        raise ValueError(
            f"the requested window must not exceed {MAX_LOOKBACK_HOURS} hours"
        )
    return target_date, window_start, window_end


def required_lookback_hours(
    requested_hours: int,
    window_start: datetime,
    *,
    now: datetime | None = None,
) -> int:
    """Ensure Horizon looks back far enough to include the exact window start."""

    if requested_hours < 1 or requested_hours > MAX_LOOKBACK_HOURS:
        raise ValueError(f"--hours must be between 1 and {MAX_LOOKBACK_HOURS}")
    current = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    elapsed_hours = math.ceil(
        max(
            0.0,
            (
                current - window_start.astimezone(timezone.utc)
            ).total_seconds()
            / 3600,
        )
    )
    effective_hours = max(requested_hours, elapsed_hours)
    if effective_hours > MAX_LOOKBACK_HOURS:
        raise ValueError(
            f"the window starts more than {MAX_LOOKBACK_HOURS} hours ago"
        )
    return effective_hours


def shanghai_date(value: str) -> date:
    timestamp = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if timestamp.tzinfo is None:
        timestamp = timestamp.replace(tzinfo=SHANGHAI)
    return timestamp.astimezone(SHANGHAI).date()


def published_at_in_window(
    value: object,
    window_start: datetime,
    window_end: datetime,
) -> bool:
    """Return whether a publication time is in [window_start, window_end)."""

    if not isinstance(value, str) or not value.strip():
        return False
    try:
        timestamp = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return False
    if timestamp.tzinfo is None or timestamp.utcoffset() is None:
        timestamp = timestamp.replace(tzinfo=SHANGHAI)
    return window_start <= timestamp < window_end


def load_topic_queries(path: Path) -> list[dict[str, Any]]:
    """Load and validate integration-owned Google News topic queries."""

    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise ValueError(f"discovery query file does not exist: {path}") from exc
    except json.JSONDecodeError as exc:
        raise ValueError(f"discovery query file is invalid JSON: {path}") from exc

    if not isinstance(payload, dict) or payload.get("schemaVersion") != 1:
        raise ValueError("discovery query file must use schemaVersion 1")
    queries = payload.get("queries")
    if not isinstance(queries, list) or not queries:
        raise ValueError("discovery query file must contain a non-empty queries list")

    validated: list[dict[str, Any]] = []
    seen_ids: set[str] = set()
    for index, entry in enumerate(queries):
        if not isinstance(entry, dict):
            raise ValueError(f"discovery query #{index + 1} must be an object")
        query_id = entry.get("id")
        query = entry.get("query")
        if not isinstance(query_id, str) or not QUERY_ID_RE.fullmatch(query_id):
            raise ValueError(
                f"discovery query #{index + 1} has an invalid id"
            )
        if query_id in seen_ids:
            raise ValueError(f"duplicate discovery query id: {query_id}")
        if not isinstance(query, str) or not query.strip():
            raise ValueError(f"discovery query {query_id} has an empty query")

        max_results = entry.get("maxResults", 100)
        if (
            isinstance(max_results, bool)
            or not isinstance(max_results, int)
            or max_results < 1
            or max_results > 100
        ):
            raise ValueError(
                f"discovery query {query_id} maxResults must be between 1 and 100"
            )

        language = entry.get("language", "en")
        country = entry.get("country", "US")
        if not isinstance(language, str) or not language.strip():
            raise ValueError(f"discovery query {query_id} has an invalid language")
        if not isinstance(country, str) or not country.strip():
            raise ValueError(f"discovery query {query_id} has an invalid country")

        seen_ids.add(query_id)
        validated.append(
            {
                "id": query_id,
                "query": query.strip(),
                "language": language.strip(),
                "country": country.strip(),
                "ceid": entry.get("ceid"),
                "maxResults": max_results,
                "category": entry.get("category") or f"{query_id}-discovery",
            }
        )
    return validated


async def fetch_topic_queries(
    topic_queries: list[dict[str, Any]],
    since: datetime,
) -> tuple[list, list[dict[str, Any]]]:
    """Fetch every configured query through Horizon's native Google scraper."""

    discovered_items = []
    query_report: list[dict[str, Any]] = []
    async with httpx.AsyncClient(timeout=45.0) as client:
        for entry in topic_queries:
            config = GoogleNewsConfig(
                enabled=True,
                query=entry["query"],
                language=entry["language"],
                country=entry["country"],
                ceid=entry["ceid"],
                max_results=entry["maxResults"],
                category=entry["category"],
            )
            report_entry = dict(entry)
            try:
                items = await GoogleNewsScraper(config, client).fetch(since)
                discovered_items.extend(items)
                report_entry.update({"status": "success", "fetched": len(items)})
            except Exception as exc:
                report_entry.update(
                    {
                        "status": "failure",
                        "fetched": 0,
                        "errorType": type(exc).__name__,
                    }
                )
            query_report.append(report_entry)
    return discovered_items, query_report


async def retry_failed_rss(
    failed_feed_names: set[str],
    config,
    since: datetime,
) -> tuple[list, dict]:
    """Retry only RSS feeds that failed, using Horizon's native RSS scraper."""

    if not failed_feed_names:
        return [], {"attempted": [], "recovered": [], "unresolved": []}

    sources_by_name = {source.name: source for source in config.sources.rss}
    recovered_items = []
    recovered = []
    unresolved = []

    for feed_name in sorted(failed_feed_names):
        source = sources_by_name.get(feed_name)
        if source is None:
            unresolved.append(feed_name)
            continue

        feed_recovered = False
        for _ in range(2):
            recorder = RssFailureRecorder()
            logger = logging.getLogger("src.scrapers.rss")
            logger.addHandler(recorder)
            try:
                async with httpx.AsyncClient(timeout=45.0) as client:
                    items = await RSSScraper([source], client).fetch(since)
            finally:
                logger.removeHandler(recorder)
            if feed_name not in recorder.feed_names:
                recovered_items.extend(items)
                recovered.append(feed_name)
                feed_recovered = True
                break

        if not feed_recovered:
            unresolved.append(feed_name)

    return recovered_items, {
        "attempted": sorted(failed_feed_names),
        "recovered": recovered,
        "unresolved": unresolved,
    }


async def run() -> dict:
    args = parse_args()
    target_date, window_start, window_end = resolve_window(
        args.report_date,
        args.start,
        args.end,
    )
    effective_hours = required_lookback_hours(args.hours, window_start)

    runs_root = REPO_ROOT / "data" / "mcp-runs"
    config_path = Path(args.config).resolve()
    discovery_queries_path = Path(args.discovery_queries).resolve()
    topic_queries = load_topic_queries(discovery_queries_path)
    service = HorizonPipelineService(runs_root=runs_root)
    rss_failure_recorder = RssFailureRecorder()
    rss_logger = logging.getLogger("src.scrapers.rss")
    rss_logger.addHandler(rss_failure_recorder)
    try:
        fetch_result = await service.fetch_items(
            hours=effective_hours,
            horizon_path=str(REPO_ROOT),
            config_path=str(config_path),
        )
    finally:
        rss_logger.removeHandler(rss_failure_recorder)

    run_id = fetch_result["run_id"]
    raw_items = service.run_store.load_items(run_id, "raw")
    runtime = load_runtime(REPO_ROOT)
    config = load_config(runtime, config_path)
    since = datetime.now(timezone.utc) - timedelta(hours=effective_hours)
    retried_items, rss_retry = await retry_failed_rss(
        rss_failure_recorder.feed_names,
        config,
        since,
    )
    topic_items, topic_query_report = await fetch_topic_queries(topic_queries, since)

    storage = make_storage(runtime, config_path)
    orchestrator = make_orchestrator(runtime, config, storage)
    combined_items = (
        dicts_to_items(runtime, raw_items)
        + retried_items
        + topic_items
    )
    merged_items = orchestrator.merge_cross_source_duplicates(combined_items)
    raw_items = items_to_dicts(merged_items)
    service.run_store.save_items(run_id, "raw", raw_items)

    raw_before_merge = (
        fetch_result["raw_before_merge"]
        + len(retried_items)
        + len(topic_items)
    )
    fetch_result["raw_before_merge"] = raw_before_merge
    fetch_result["fetched"] = len(raw_items)
    fetch_result["source_counts"] = get_source_counts(merged_items)

    topic_failures = [
        entry["id"]
        for entry in topic_query_report
        if entry["status"] == "failure"
    ]
    fetch_status = fetch_result.get("fetch_status")
    if rss_retry["unresolved"] or topic_failures:
        fetch_status = "partial"
    service.run_store.update_meta(
        run_id,
        {
            "raw_count_before_merge": raw_before_merge,
            "raw_count": fetch_result["fetched"],
            "source_counts": fetch_result["source_counts"],
            "rss_retry": rss_retry,
            "topic_queries": topic_query_report,
            "topic_query_failures": topic_failures,
            "window_start": window_start.isoformat(),
            "window_end": window_end.isoformat(),
            "window_semantics": "left-closed-right-open",
            "fetch_status": fetch_status,
        },
    )
    window_items = [
        item
        for item in raw_items
        if published_at_in_window(
            item.get("published_at"),
            window_start,
            window_end,
        )
    ]

    run_dir = service.run_store.run_dir(run_id)
    candidates_path = run_dir / "daily_candidates.json"
    candidates_path.write_text(
        json.dumps(
            {
                "schemaVersion": 1,
                "engine": "Horizon",
                "horizonRunId": run_id,
                "reportDate": target_date.isoformat(),
                "timezone": "Asia/Shanghai",
                "windowStart": window_start.isoformat(),
                "windowEnd": window_end.isoformat(),
                "windowSemantics": "left-closed-right-open",
                "lookbackHours": effective_hours,
                "requestedLookbackHours": args.hours,
                "rawBeforeMerge": raw_before_merge,
                "rawAfterHorizonMerge": fetch_result["fetched"],
                "windowCount": len(window_items),
                "exactDayCount": len(window_items),
                "sourceCounts": fetch_result["source_counts"],
                "fetchStatus": fetch_status,
                "fetchReport": fetch_result.get("fetch_report"),
                "rssRetry": rss_retry,
                "topicQueries": topic_query_report,
                "items": window_items,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    return {
        "engine": "Horizon",
        "horizonRunId": run_id,
        "reportDate": target_date.isoformat(),
        "windowStart": window_start.isoformat(),
        "windowEnd": window_end.isoformat(),
        "rawBeforeMerge": raw_before_merge,
        "rawAfterHorizonMerge": fetch_result["fetched"],
        "windowCount": len(window_items),
        "exactDayCount": len(window_items),
        "topicQueries": topic_query_report,
        "fetchStatus": fetch_status,
        "rssRetry": rss_retry,
        "candidatesPath": str(candidates_path.resolve()),
    }


if __name__ == "__main__":
    print(json.dumps(asyncio.run(run()), ensure_ascii=False, indent=2))
