"""Run Horizon's native fetch and cross-source dedupe for one exact window."""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import logging
import math
import re
import sys
from contextvars import ContextVar
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
REVIEW_LANE_RE = QUERY_ID_RE
DISCOVERY_SCHEMA_VERSION = 2
MAX_QUERY_CONCURRENCY = 8
GOOGLE_NEWS_SAFE_RESULT_LIMIT = 99
EXPECTED_LOW_VOLUME_TRIGGER = 5
GOOGLE_NEWS_MAX_RETRIES = 2
GOOGLE_NEWS_RETRY_DELAY_SECONDS = 0.25
GOOGLE_NEWS_REQUEST_TIMEOUT_SECONDS = 10.0
DISCOVERY_QUERY_BUDGET_SECONDS = 15 * 60
RSS_RETRY_REQUEST_TIMEOUT_SECONDS = 15.0
REQUIRED_RSS_RETRY_ATTEMPTS = 2
OPTIONAL_RSS_RETRY_ATTEMPTS = 1
OPTIONAL_RSS_FEED_NAMES = {
    "Ars Technica AI",
    "OpenRouter Blog",
    "Qoder Announcements",
    "TechCrunch AI",
    "VentureBeat AI",
    "36氪",
    "量子位官网",
    "雷峰网",
}
DIRECT_REVIEW_FEEDS = {
    "OpenAI News": ("rss-openai-news", "openai-product-operations"),
    "Google DeepMind": ("rss-google-deepmind", "google-ai-products"),
    "NVIDIA Newsroom": ("rss-nvidia-newsroom", "chips-storage-releases"),
    "TechCrunch AI": ("rss-techcrunch-ai", "global-ai-media"),
    "VentureBeat AI": ("rss-venturebeat-ai", "global-ai-media"),
    "Ars Technica AI": ("rss-ars-technica-ai", "global-ai-media"),
    "雷峰网": ("rss-leiphone", "china-ai-media"),
    "36氪": ("rss-36kr", "china-ai-media"),
    "OpenRouter Blog": (
        "rss-openrouter-blog",
        "developer-product-releases",
    ),
    "Qoder Announcements": (
        "rss-qoder-announcements",
        "developer-product-releases",
    ),
    "量子位": ("rss-qbitai", "china-ai-media"),
    "量子位官网": ("rss-qbitai-website", "china-ai-media"),
    "新智元": ("rss-ainews", "china-ai-media"),
}
DIRECT_REVIEW_SUBREDDITS = {
    "codex": ("reddit-codex", "developer-product-operations"),
    "OpenAI": ("reddit-openai", "openai-product-operations"),
}
CURRENT_DISCOVERY_QUERY_ID: ContextVar[str | None] = ContextVar(
    "current_discovery_query_id",
    default=None,
)
AI_PRODUCT_TERM_RE = re.compile(
    r"(?:\bCodex\b|\bChatGPT\s+Work\b|\bOpenAI\b|\bGPT(?:-\d+(?:\.\d+)?)?\b)",
    re.IGNORECASE,
)
USAGE_POLICY_SUBJECT_RE = re.compile(
    r"(?:"
    r"\busage\b|\bquota\b|\brate[\s-]?limit\b|\busage[\s-]?limit\b|"
    r"\b(?:5|five)[\s-]?hour\b|\btoken[\s-]?(?:limit|quota|budget|usage)\b|"
    r"利用枠|使用量|レート制限|クォータ|5時間|五時間|"
    r"用量|配额|額度|额度|限额|限額|速率限制|五小时|5小时|"
    r"사용량|할당량|한도|5시간"
    r")",
    re.IGNORECASE,
)
USAGE_POLICY_CHANGE_RE = re.compile(
    r"(?:"
    r"\breset(?:s|ting)?\b|\brestore(?:s|d|ing)?\b|"
    r"\breturn(?:s|ed|ing)?\b|\bresume(?:s|d|ing)?\b|"
    r"\bpause(?:s|d|ing)?\b|\bsuspend(?:s|ed|ing)?\b|"
    r"\bremove(?:s|d|ing)?\b|\blift(?:s|ed|ing)?\b|"
    r"\bincrease(?:s|d|ing)?\b|\bdecrease(?:s|d|ing)?\b|"
    r"\breduc(?:e|es|ed|ing|tion)\b|\bimprov(?:e|es|ed|ing|ement)\b|"
    r"\bchang(?:e|es|ed|ing)\b|"
    r"リセット|復活|再開|解除|停止|一時停止|改善|変更|増加|減少|"
    r"重置|恢复|恢復|重啟|重启|重新启用|重新啟用|解除|暂停|暫停|"
    r"调整|調整|提高|降低|增加|减少|減少|改善|变化|變化|"
    r"초기화|복원|재개|중단|해제|개선|변경|상향|하향"
    r")",
    re.IGNORECASE,
)

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
from src.orchestrator import _deduplication_url_key  # noqa: E402
from src.scrapers.google_news import GoogleNewsScraper  # noqa: E402
from src.scrapers.rss import RSSScraper  # noqa: E402

import httpx  # noqa: E402


class GoogleNewsFailureRecorder(logging.Handler):
    """Capture swallowed Google News fetch failures for the current query."""

    pattern = re.compile(r"Error (?:fetching|parsing) Google News feed:")

    def __init__(self) -> None:
        super().__init__(level=logging.WARNING)
        self.query_failures: dict[str, int] = {}

    def emit(self, record: logging.LogRecord) -> None:
        if not self.pattern.search(record.getMessage()):
            return
        query_id = CURRENT_DISCOVERY_QUERY_ID.get()
        if query_id:
            self.query_failures[query_id] = (
                self.query_failures.get(query_id, 0) + 1
            )

    def clear(self, query_id: str) -> None:
        self.query_failures.pop(query_id, None)

    def failed(self, query_id: str) -> bool:
        return self.query_failures.get(query_id, 0) > 0


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
        default=24,
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


def content_item_in_window(
    item: Any,
    window_start: datetime,
    window_end: datetime,
) -> bool:
    """Return whether a Horizon ContentItem belongs to the exact window."""

    value = getattr(item, "published_at", None)
    if isinstance(value, datetime):
        if value.tzinfo is None or value.utcoffset() is None:
            value = value.replace(tzinfo=SHANGHAI)
        return window_start <= value < window_end
    return published_at_in_window(value, window_start, window_end)


def apply_query_provenance(merged_items: list, topic_items: list) -> None:
    """Preserve all discovery-query and coverage-group matches after URL merge."""

    provenance_by_url: dict[Any, dict[str, set[str] | bool]] = {}
    for item in topic_items:
        metadata = item.metadata
        url = _deduplication_url_key(str(item.url))
        provenance = provenance_by_url.setdefault(
            url,
            {
                "queryIds": set(),
                "coverageGroups": set(),
                "priorities": set(),
                "mustReviewQueryIds": set(),
                "reviewLanes": set(),
                "required": False,
            },
        )
        query_id = metadata.get("discovery_query_id")
        coverage_group = metadata.get("coverage_group")
        priority = metadata.get("coverage_priority")
        if query_id:
            provenance["queryIds"].add(str(query_id))
        if coverage_group:
            provenance["coverageGroups"].add(str(coverage_group))
        if priority:
            provenance["priorities"].add(str(priority))
        if metadata.get("must_review_query") and query_id:
            provenance["mustReviewQueryIds"].add(str(query_id))
        review_lane = metadata.get("review_lane")
        if metadata.get("must_review_query") and review_lane:
            provenance["reviewLanes"].add(str(review_lane))
        provenance["required"] = bool(
            provenance["required"] or metadata.get("required_query")
        )

    for item in merged_items:
        provenance = provenance_by_url.get(
            _deduplication_url_key(str(item.url))
        )
        if not provenance:
            continue
        item.metadata["discovery_query_ids"] = sorted(provenance["queryIds"])
        item.metadata["coverage_groups"] = sorted(provenance["coverageGroups"])
        item.metadata["coverage_priority"] = (
            "priority"
            if "priority" in provenance["priorities"]
            else "standard"
        )
        item.metadata["must_review"] = bool(provenance["mustReviewQueryIds"])
        item.metadata["must_review_query_ids"] = sorted(
            provenance["mustReviewQueryIds"]
        )
        item.metadata["review_lanes"] = sorted(provenance["reviewLanes"])
        item.metadata["required_query"] = bool(provenance["required"])


def apply_direct_source_review_provenance(
    merged_items: list,
    source_items: list | None = None,
) -> None:
    """Mark trusted direct/source-monitor candidates for mandatory review."""

    review_by_url: dict[Any, dict[str, set[str]]] = {}
    for item in source_items or merged_items:
        metadata = item.metadata
        source_ids: set[str] = set()
        review_lanes: set[str] = set()

        feed_names = metadata_string_list(
            metadata,
            "feed_names",
            "feed_name",
        )
        for feed_name in feed_names:
            feed_review = DIRECT_REVIEW_FEEDS.get(feed_name)
            if feed_review:
                source_id, review_lane = feed_review
                source_ids.add(source_id)
                review_lanes.add(review_lane)

        subreddits = metadata_string_list(
            metadata,
            "subreddits",
            "subreddit",
        )
        for subreddit in subreddits:
            subreddit_review = DIRECT_REVIEW_SUBREDDITS.get(subreddit)
            if subreddit_review:
                source_id, review_lane = subreddit_review
                source_ids.add(source_id)
                review_lanes.add(review_lane)

        if not source_ids:
            continue
        provenance = review_by_url.setdefault(
            _deduplication_url_key(str(item.url)),
            {"sourceIds": set(), "reviewLanes": set()},
        )
        provenance["sourceIds"].update(source_ids)
        provenance["reviewLanes"].update(review_lanes)

    for item in merged_items:
        metadata = item.metadata
        source_ids = set(
            metadata_string_list(
                metadata,
                "must_review_source_ids",
                "must_review_source_id",
            )
        )
        review_lanes = set(
            metadata_string_list(metadata, "review_lanes", "review_lane")
        )
        provenance = review_by_url.get(
            _deduplication_url_key(str(item.url))
        )
        if provenance:
            source_ids.update(provenance["sourceIds"])
            review_lanes.update(provenance["reviewLanes"])

        if source_ids:
            metadata["must_review_source_ids"] = sorted(source_ids)
            metadata["review_lanes"] = sorted(review_lanes)
            metadata["must_review"] = True


def metadata_string_list(metadata: dict[str, Any], plural: str, singular: str) -> list[str]:
    """Read a normalized, unique list from plural or legacy singular metadata."""

    values = metadata.get(plural)
    if isinstance(values, list):
        return sorted({str(value) for value in values if str(value).strip()})
    value = metadata.get(singular)
    return [str(value)] if value else []


def item_search_text(item: Any) -> str:
    """Return bounded discovery text used only for relevance and editorial signals."""

    return " ".join(
        str(value or "")
        for value in (
            getattr(item, "title", ""),
            getattr(item, "content", ""),
            getattr(item, "summary", ""),
        )
    )


def is_material_usage_policy_change(text: str) -> bool:
    """Identify an explicit AI-product usage or quota change in multiple languages."""

    return bool(
        AI_PRODUCT_TERM_RE.search(text)
        and USAGE_POLICY_SUBJECT_RE.search(text)
        and USAGE_POLICY_CHANGE_RE.search(text)
    )


def apply_editorial_signals(items: list) -> None:
    """Mark must-review usage-policy changes before editorial scoring."""

    for item in items:
        metadata = item.metadata
        signals = set(
            metadata_string_list(
                metadata,
                "editorial_signals",
                "editorial_signal",
            )
        )
        if metadata.get("must_review") and is_material_usage_policy_change(
            item_search_text(item)
        ):
            signals.add("usage-policy-change")
        if signals:
            metadata["editorial_signals"] = sorted(signals)


def compact_candidate(item: dict[str, Any]) -> dict[str, Any]:
    """Build the bounded review index row without article bodies or comments."""

    metadata = item.get("metadata")
    metadata = metadata if isinstance(metadata, dict) else {}
    must_review_query_ids = metadata_string_list(
        metadata, "must_review_query_ids", "must_review_query_id"
    )
    must_review_source_ids = metadata_string_list(
        metadata, "must_review_source_ids", "must_review_source_id"
    )
    review_lanes = metadata_string_list(
        metadata, "review_lanes", "review_lane"
    )
    editorial_signals = metadata_string_list(
        metadata, "editorial_signals", "editorial_signal"
    )
    return {
        "id": str(item.get("id") or ""),
        "title": str(item.get("title") or ""),
        "url": str(item.get("url") or ""),
        "sourceType": str(item.get("source_type") or ""),
        "sourceName": str(
            metadata.get("source_name")
            or metadata.get("feed_name")
            or item.get("author")
            or ""
        ),
        "publishedAt": str(item.get("published_at") or ""),
        "category": str(metadata.get("category") or ""),
        "queryIds": metadata_string_list(
            metadata, "discovery_query_ids", "discovery_query_id"
        ),
        "coverageGroups": metadata_string_list(
            metadata, "coverage_groups", "coverage_group"
        ),
        "priority": str(metadata.get("coverage_priority") or "standard"),
        "mustReview": bool(
            metadata.get("must_review")
            or must_review_query_ids
            or must_review_source_ids
        ),
        "mustReviewQueryIds": must_review_query_ids,
        "mustReviewSourceIds": must_review_source_ids,
        "reviewLanes": review_lanes,
        "editorialSignals": editorial_signals,
    }


def relative_artifact_path(path: Path) -> str:
    """Return a stable path relative to the Horizon repository root."""

    return path.resolve().relative_to(REPO_ROOT.resolve()).as_posix()


def write_utf8_artifact(path: Path, text: str) -> bytes:
    """Write deterministic UTF-8 bytes so hashes are identical on every OS."""

    payload = text.encode("utf-8")
    path.write_bytes(payload)
    return payload


def build_coverage_manifest(
    *,
    run_id: str,
    target_date: date,
    window_start: datetime,
    window_end: datetime,
    fetch_status: str,
    catalog: dict[str, Any],
    query_report: list[dict[str, Any]],
    window_items: list[dict[str, Any]],
    candidate_index_path: Path,
    candidate_index_sha256: str,
) -> dict[str, Any]:
    """Build the machine-checkable discovery coverage contract."""

    candidate_rows = [compact_candidate(item) for item in window_items]
    query_candidate_ids: dict[str, set[str]] = {
        entry["id"]: set() for entry in catalog["queries"]
    }
    group_candidate_ids: dict[str, set[str]] = {
        entry["id"]: set() for entry in catalog["coverageGroups"]
    }
    review_source_candidate_ids: dict[str, set[str]] = {
        source_id: set()
        for source_id, _ in [
            *DIRECT_REVIEW_FEEDS.values(),
            *DIRECT_REVIEW_SUBREDDITS.values(),
        ]
    }
    review_lane_candidate_ids: dict[str, set[str]] = {}
    for row in candidate_rows:
        candidate_id = row["id"]
        for query_id in row["queryIds"]:
            query_candidate_ids.setdefault(query_id, set()).add(candidate_id)
        for group_id in row["coverageGroups"]:
            group_candidate_ids.setdefault(group_id, set()).add(candidate_id)
        for source_id in row["mustReviewSourceIds"]:
            review_source_candidate_ids.setdefault(source_id, set()).add(
                candidate_id
            )
        for review_lane in row["reviewLanes"]:
            review_lane_candidate_ids.setdefault(review_lane, set()).add(
                candidate_id
            )

    report_by_id = {entry["id"]: entry for entry in query_report}
    queries = []
    for entry in catalog["queries"]:
        report = report_by_id.get(entry["id"], {})
        query_summary = {
            "id": entry["id"],
            "coverageGroup": entry["coverageGroup"],
            "required": entry["required"],
            "priority": entry["priority"],
            "mustReview": entry["mustReview"],
            "reviewLane": entry["reviewLane"],
            "language": entry["language"],
            "country": entry["country"],
            "maxResults": entry["maxResults"],
            "status": report.get("status", "failure"),
            "fetched": int(report.get("fetched", 0)),
            "windowFetched": int(report.get("windowFetched", 0)),
            "attempts": int(report.get("attempts", 0)),
            "resultLimitReached": bool(
                report.get("resultLimitReached", False)
            ),
            "candidateIds": sorted(query_candidate_ids.get(entry["id"], set())),
        }
        if report.get("errorType"):
            query_summary["errorType"] = str(report["errorType"])
        queries.append(query_summary)

    groups = []
    for group in catalog["coverageGroups"]:
        query_ids = [
            entry["id"]
            for entry in catalog["queries"]
            if entry["coverageGroup"] == group["id"]
        ]
        groups.append(
            {
                **group,
                "queryIds": query_ids,
                "candidateIds": sorted(
                    group_candidate_ids.get(group["id"], set())
                ),
            }
        )

    review_sources = [
        {
            "id": source_id,
            "sourceType": "rss",
            "sourceName": source_name,
            "reviewLane": review_lane,
            "candidateIds": sorted(
                review_source_candidate_ids.get(source_id, set())
            ),
        }
        for source_name, (source_id, review_lane) in sorted(
            DIRECT_REVIEW_FEEDS.items()
        )
    ] + [
        {
            "id": source_id,
            "sourceType": "reddit",
            "sourceName": subreddit,
            "reviewLane": review_lane,
            "candidateIds": sorted(
                review_source_candidate_ids.get(source_id, set())
            ),
        }
        for subreddit, (source_id, review_lane) in sorted(
            DIRECT_REVIEW_SUBREDDITS.items()
        )
    ]

    review_lanes = []
    catalog_review_lanes = {
        entry["reviewLane"]
        for entry in catalog["queries"]
        if entry["reviewLane"]
    }
    source_review_lanes = {
        review_lane
        for _, review_lane in [
            *DIRECT_REVIEW_FEEDS.values(),
            *DIRECT_REVIEW_SUBREDDITS.values(),
        ]
    }
    for review_lane in sorted(catalog_review_lanes | source_review_lanes):
        review_lanes.append(
            {
                "id": review_lane,
                "queryIds": [
                    entry["id"]
                    for entry in catalog["queries"]
                    if entry["reviewLane"] == review_lane
                ],
                "sourceIds": [
                    entry["id"]
                    for entry in review_sources
                    if entry["reviewLane"] == review_lane
                ],
                "candidateIds": sorted(
                    review_lane_candidate_ids.get(review_lane, set())
                ),
            }
        )

    return {
        "schemaVersion": 2,
        "engine": "Horizon",
        "horizonRunId": run_id,
        "reportDate": target_date.isoformat(),
        "timezone": "Asia/Shanghai",
        "windowStart": window_start.isoformat(),
        "windowEnd": window_end.isoformat(),
        "windowSemantics": "left-closed-right-open",
        "fetchStatus": fetch_status,
        "languagePolicy": catalog["languagePolicy"],
        "seedLanguages": catalog["seedLanguages"],
        "lowVolumeTrigger": catalog["lowVolumeTrigger"],
        "candidateIndexPath": relative_artifact_path(candidate_index_path),
        "candidateIndexSha256": candidate_index_sha256,
        "candidateCount": len(candidate_rows),
        "mustReviewCandidateIds": sorted(
            {
                row["id"]
                for row in candidate_rows
                if row["mustReview"]
            }
        ),
        "requiredQueryIds": [
            entry["id"] for entry in queries if entry["required"]
        ],
        "requiredGroupIds": [
            group["id"] for group in groups if group["required"]
        ],
        "queries": queries,
        "groups": groups,
        "reviewSources": review_sources,
        "reviewLanes": review_lanes,
    }


def load_discovery_catalog(path: Path) -> dict[str, Any]:
    """Load and validate the multilingual discovery and coverage catalog."""

    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise ValueError(f"discovery query file does not exist: {path}") from exc
    except json.JSONDecodeError as exc:
        raise ValueError(f"discovery query file is invalid JSON: {path}") from exc

    if (
        not isinstance(payload, dict)
        or payload.get("schemaVersion") != DISCOVERY_SCHEMA_VERSION
    ):
        raise ValueError(
            f"discovery query file must use schemaVersion {DISCOVERY_SCHEMA_VERSION}"
        )
    query_concurrency = payload.get("queryConcurrency")
    if (
        isinstance(query_concurrency, bool)
        or not isinstance(query_concurrency, int)
        or query_concurrency < 1
        or query_concurrency > MAX_QUERY_CONCURRENCY
    ):
        raise ValueError(
            f"queryConcurrency must be between 1 and {MAX_QUERY_CONCURRENCY}"
        )
    low_volume_trigger = payload.get("lowVolumeTrigger")
    if low_volume_trigger != EXPECTED_LOW_VOLUME_TRIGGER:
        raise ValueError(
            f"lowVolumeTrigger must be {EXPECTED_LOW_VOLUME_TRIGGER}"
        )
    language_policy = payload.get("languagePolicy")
    if language_policy != "any-reliable-language":
        raise ValueError("languagePolicy must be any-reliable-language")
    seed_languages = payload.get("seedLanguages")
    if (
        not isinstance(seed_languages, list)
        or any(
            not isinstance(value, str) or not value.strip()
            for value in seed_languages
        )
        or len(set(seed_languages)) != len(seed_languages)
        or not {"en", "zh-CN", "ja", "ko"}.issubset(set(seed_languages))
    ):
        raise ValueError("seedLanguages must include en, zh-CN, ja, and ko")

    raw_groups = payload.get("coverageGroups")
    if not isinstance(raw_groups, list) or not raw_groups:
        raise ValueError("discovery query file must contain coverageGroups")
    groups: list[dict[str, Any]] = []
    groups_by_id: dict[str, dict[str, Any]] = {}
    for index, entry in enumerate(raw_groups):
        if not isinstance(entry, dict):
            raise ValueError(f"coverage group #{index + 1} must be an object")
        group_id = entry.get("id")
        if not isinstance(group_id, str) or not QUERY_ID_RE.fullmatch(group_id):
            raise ValueError(f"coverage group #{index + 1} has an invalid id")
        if group_id in groups_by_id:
            raise ValueError(f"duplicate coverage group id: {group_id}")
        label = entry.get("label")
        required = entry.get("required")
        priority = entry.get("priority")
        if not isinstance(label, str) or not label.strip():
            raise ValueError(f"coverage group {group_id} has an invalid label")
        if not isinstance(required, bool):
            raise ValueError(f"coverage group {group_id} required must be boolean")
        if priority not in {"priority", "standard"}:
            raise ValueError(
                f"coverage group {group_id} priority must be priority or standard"
            )
        group = {
            "id": group_id,
            "label": label.strip(),
            "required": required,
            "priority": priority,
        }
        groups.append(group)
        groups_by_id[group_id] = group

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

        configured_max_results = entry.get(
            "maxResults",
            GOOGLE_NEWS_SAFE_RESULT_LIMIT,
        )
        if (
            isinstance(configured_max_results, bool)
            or not isinstance(configured_max_results, int)
            or configured_max_results < 1
            or configured_max_results > 100
        ):
            raise ValueError(
                f"discovery query {query_id} maxResults must be between 1 and 100"
            )
        max_results = min(
            configured_max_results,
            GOOGLE_NEWS_SAFE_RESULT_LIMIT,
        )

        language = entry.get("language", "en")
        country = entry.get("country", "US")
        if not isinstance(language, str) or not language.strip():
            raise ValueError(f"discovery query {query_id} has an invalid language")
        if not isinstance(country, str) or not country.strip():
            raise ValueError(f"discovery query {query_id} has an invalid country")
        coverage_group = entry.get("coverageGroup")
        if (
            not isinstance(coverage_group, str)
            or coverage_group not in groups_by_id
        ):
            raise ValueError(
                f"discovery query {query_id} has an unknown coverageGroup"
            )
        required = entry.get("required")
        if not isinstance(required, bool):
            raise ValueError(
                f"discovery query {query_id} required must be boolean"
            )
        priority = entry.get("priority")
        if priority not in {"priority", "standard"}:
            raise ValueError(
                f"discovery query {query_id} priority must be priority or standard"
            )
        must_review = entry.get("mustReview", False)
        if not isinstance(must_review, bool):
            raise ValueError(
                f"discovery query {query_id} mustReview must be boolean"
            )
        review_lane = entry.get("reviewLane")
        if must_review:
            if not required:
                raise ValueError(
                    f"discovery query {query_id} mustReview requires required"
                )
            if (
                not isinstance(review_lane, str)
                or not REVIEW_LANE_RE.fullmatch(review_lane)
            ):
                raise ValueError(
                    f"discovery query {query_id} must have a hyphen-id reviewLane"
                )
        elif review_lane is not None:
            raise ValueError(
                f"discovery query {query_id} reviewLane requires mustReview"
            )

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
                "coverageGroup": coverage_group,
                "required": required,
                "priority": priority,
                "mustReview": must_review,
                "reviewLane": review_lane,
            }
        )

    required_group_ids = {
        group["id"] for group in groups if group["required"]
    }
    groups_with_required_queries = {
        entry["coverageGroup"] for entry in validated if entry["required"]
    }
    missing_required_groups = sorted(
        required_group_ids - groups_with_required_queries
    )
    if missing_required_groups:
        raise ValueError(
            "required coverage groups have no required query: "
            + ", ".join(missing_required_groups)
        )

    return {
        "schemaVersion": DISCOVERY_SCHEMA_VERSION,
        "queryConcurrency": query_concurrency,
        "lowVolumeTrigger": low_volume_trigger,
        "languagePolicy": language_policy,
        "seedLanguages": seed_languages,
        "coverageGroups": groups,
        "queries": validated,
    }


def load_topic_queries(path: Path) -> list[dict[str, Any]]:
    """Backward-compatible helper used by tests and local callers."""

    return load_discovery_catalog(path)["queries"]


async def fetch_topic_queries(
    topic_queries: list[dict[str, Any]],
    since: datetime,
    window_start: datetime,
    window_end: datetime,
    *,
    concurrency: int,
) -> tuple[list, list[dict[str, Any]]]:
    """Fetch configured queries with bounded concurrency and coverage metadata."""

    semaphore = asyncio.Semaphore(concurrency)
    failure_recorder = GoogleNewsFailureRecorder()
    google_news_logger = logging.getLogger("src.scrapers.google_news")

    async def fetch_one(entry: dict[str, Any]) -> tuple[list, dict[str, Any]]:
        async with semaphore:
            requested_max_results = entry["maxResults"]
            config = GoogleNewsConfig(
                enabled=True,
                query=entry["query"],
                language=entry["language"],
                country=entry["country"],
                ceid=entry["ceid"],
                max_results=requested_max_results + 1,
                category=entry["category"],
            )
            report_entry = dict(entry)
            for attempt in range(1, GOOGLE_NEWS_MAX_RETRIES + 2):
                failure_recorder.clear(entry["id"])
                error_type = None
                query_token = CURRENT_DISCOVERY_QUERY_ID.set(entry["id"])
                try:
                    fetched_items = await GoogleNewsScraper(
                        config,
                        client,
                    ).fetch(since)
                except Exception as exc:
                    fetched_items = []
                    error_type = type(exc).__name__
                finally:
                    CURRENT_DISCOVERY_QUERY_ID.reset(query_token)

                logged_failure = failure_recorder.failed(entry["id"])
                if error_type or logged_failure:
                    if attempt <= GOOGLE_NEWS_MAX_RETRIES:
                        await asyncio.sleep(
                            GOOGLE_NEWS_RETRY_DELAY_SECONDS * attempt
                        )
                        continue
                    report_entry.update(
                        {
                            "status": "failure",
                            "fetched": 0,
                            "windowFetched": 0,
                            "attempts": attempt,
                            "errorType": (
                                error_type
                                or "GoogleNewsScraperLoggedFailure"
                            ),
                        }
                    )
                    return [], report_entry

                result_limit_reached = (
                    len(fetched_items) > requested_max_results
                )
                items = fetched_items[:requested_max_results]
                for item in items:
                    item.metadata["discovery_query_id"] = entry["id"]
                    item.metadata["coverage_group"] = entry["coverageGroup"]
                    item.metadata["coverage_priority"] = entry["priority"]
                    item.metadata["required_query"] = entry["required"]
                    item.metadata["must_review_query"] = entry["mustReview"]
                    if entry["reviewLane"]:
                        item.metadata["review_lane"] = entry["reviewLane"]
                window_count = sum(
                    content_item_in_window(item, window_start, window_end)
                    for item in items
                )
                if result_limit_reached and entry["required"]:
                    status = "failure"
                    error_type = "GoogleNewsResultLimitReached"
                elif result_limit_reached:
                    status = "truncated"
                    error_type = None
                else:
                    status = "success" if items else "empty"
                    error_type = None
                report_entry.update(
                    {
                        "status": status,
                        "fetched": len(items),
                        "windowFetched": window_count,
                        "attempts": attempt,
                        "resultLimitReached": result_limit_reached,
                    }
                )
                if error_type:
                    report_entry["errorType"] = error_type
                return items, report_entry

    google_news_logger.addHandler(failure_recorder)
    try:
        async with httpx.AsyncClient(
            timeout=GOOGLE_NEWS_REQUEST_TIMEOUT_SECONDS
        ) as client:
            results = await asyncio.wait_for(
                asyncio.gather(
                    *(fetch_one(entry) for entry in topic_queries)
                ),
                timeout=DISCOVERY_QUERY_BUDGET_SECONDS,
            )
    except asyncio.TimeoutError as exc:
        raise RuntimeError(
            "discovery query time budget exceeded; formal run must stop"
        ) from exc
    finally:
        google_news_logger.removeHandler(failure_recorder)

    discovered_items = [
        item
        for items, _ in results
        for item in items
    ]
    query_report = [report for _, report in results]
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
        retry_attempts = (
            OPTIONAL_RSS_RETRY_ATTEMPTS
            if feed_name in OPTIONAL_RSS_FEED_NAMES
            else REQUIRED_RSS_RETRY_ATTEMPTS
        )
        for _ in range(retry_attempts):
            recorder = RssFailureRecorder()
            logger = logging.getLogger("src.scrapers.rss")
            logger.addHandler(recorder)
            try:
                async with httpx.AsyncClient(
                    timeout=RSS_RETRY_REQUEST_TIMEOUT_SECONDS
                ) as client:
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


def required_query_failure_ids(
    query_report: list[dict[str, Any]],
) -> list[str]:
    """Return failed required queries, including required result-cap hits."""

    return [
        str(entry["id"])
        for entry in query_report
        if entry.get("required") is True and entry.get("status") == "failure"
    ]


def finalized_fetch_status(
    base_status: str | None,
    unresolved_rss: list[str],
    query_report: list[dict[str, Any]],
) -> str | None:
    """Fail closed when a required discovery query is incomplete."""

    if base_status != "success":
        return base_status
    required_unresolved_rss = [
        feed_name
        for feed_name in unresolved_rss
        if feed_name not in OPTIONAL_RSS_FEED_NAMES
    ]
    if required_unresolved_rss or required_query_failure_ids(query_report):
        return "partial"
    return base_status


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
    discovery_catalog = load_discovery_catalog(discovery_queries_path)
    topic_queries = discovery_catalog["queries"]
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
    topic_items, topic_query_report = await fetch_topic_queries(
        topic_queries,
        since,
        window_start,
        window_end,
        concurrency=discovery_catalog["queryConcurrency"],
    )

    storage = make_storage(runtime, config_path)
    orchestrator = make_orchestrator(runtime, config, storage)
    combined_items = (
        dicts_to_items(runtime, raw_items)
        + retried_items
        + topic_items
    )
    merged_items = orchestrator.merge_cross_source_duplicates(combined_items)
    apply_query_provenance(merged_items, topic_items)
    apply_direct_source_review_provenance(merged_items, combined_items)
    apply_editorial_signals(merged_items)
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
    required_topic_failures = required_query_failure_ids(topic_query_report)
    optional_rss_failures = sorted(
        feed_name
        for feed_name in rss_retry["unresolved"]
        if feed_name in OPTIONAL_RSS_FEED_NAMES
    )
    required_rss_failures = sorted(
        feed_name
        for feed_name in rss_retry["unresolved"]
        if feed_name not in OPTIONAL_RSS_FEED_NAMES
    )
    fetch_status = finalized_fetch_status(
        fetch_result.get("fetch_status"),
        rss_retry["unresolved"],
        topic_query_report,
    )
    service.run_store.update_meta(
        run_id,
        {
            "raw_count_before_merge": raw_before_merge,
            "raw_count": fetch_result["fetched"],
            "source_counts": fetch_result["source_counts"],
            "rss_retry": rss_retry,
            "optional_rss_failures": optional_rss_failures,
            "required_rss_failures": required_rss_failures,
            "topic_queries": topic_query_report,
            "topic_query_failures": topic_failures,
            "required_topic_query_failures": required_topic_failures,
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
    candidate_index_path = run_dir / "candidate_index.json"
    candidate_index_payload = {
        "schemaVersion": 1,
        "engine": "Horizon",
        "horizonRunId": run_id,
        "reportDate": target_date.isoformat(),
        "timezone": "Asia/Shanghai",
        "windowStart": window_start.isoformat(),
        "windowEnd": window_end.isoformat(),
        "windowSemantics": "left-closed-right-open",
        "languagePolicy": discovery_catalog["languagePolicy"],
        "seedLanguages": discovery_catalog["seedLanguages"],
        "itemCount": len(window_items),
        "items": [compact_candidate(item) for item in window_items],
    }
    candidate_index_text = (
        json.dumps(candidate_index_payload, ensure_ascii=False, indent=2) + "\n"
    )
    candidate_index_bytes = write_utf8_artifact(
        candidate_index_path,
        candidate_index_text,
    )
    candidate_index_sha256 = hashlib.sha256(candidate_index_bytes).hexdigest()

    coverage_manifest_path = run_dir / "coverage_manifest.json"
    coverage_manifest = build_coverage_manifest(
        run_id=run_id,
        target_date=target_date,
        window_start=window_start,
        window_end=window_end,
        fetch_status=fetch_status,
        catalog=discovery_catalog,
        query_report=topic_query_report,
        window_items=window_items,
        candidate_index_path=candidate_index_path,
        candidate_index_sha256=candidate_index_sha256,
    )
    write_utf8_artifact(
        coverage_manifest_path,
        json.dumps(coverage_manifest, ensure_ascii=False, indent=2) + "\n",
    )

    candidates_path = run_dir / "daily_candidates.json"
    write_utf8_artifact(
        candidates_path,
        json.dumps(
            {
                "schemaVersion": 2,
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
                "languagePolicy": discovery_catalog["languagePolicy"],
                "seedLanguages": discovery_catalog["seedLanguages"],
                "fetchReport": fetch_result.get("fetch_report"),
                "rssRetry": rss_retry,
                "topicQueries": topic_query_report,
                "candidateIndexPath": relative_artifact_path(candidate_index_path),
                "candidateIndexSha256": candidate_index_sha256,
                "coverageManifestPath": relative_artifact_path(
                    coverage_manifest_path
                ),
                "lowVolumeTrigger": discovery_catalog["lowVolumeTrigger"],
                "items": window_items,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
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
        "candidateIndexPath": str(candidate_index_path.resolve()),
        "coverageManifestPath": str(coverage_manifest_path.resolve()),
    }


if __name__ == "__main__":
    print(json.dumps(asyncio.run(run()), ensure_ascii=False, indent=2))
