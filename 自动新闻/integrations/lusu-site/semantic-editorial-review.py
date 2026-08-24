"""Create a checkpointed, semantic editorial ledger for Daily AI News.

The language model judges candidate content. Candidate identifiers are used only
to correlate model output with the immutable candidate index; they are never
used as classification or scoring inputs.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime, time as datetime_time, timedelta, timezone
from pathlib import Path
from typing import Any


ALLOWED_CLASSES = {
    "major-model-product",
    "capability-availability",
    "usage-policy",
    "developer-tool",
    "material-price-quota",
    "strategic-hardware-infrastructure",
    "major-tech-finance",
    "ai-policy-safety",
    "other",
}
PROTECTED_CLASSES = ALLOWED_CLASSES - {"other"}
SCORE_MAXIMA = {
    "reach": 2,
    "magnitude": 3,
    "practicalValue": 3,
    "evidence": 2,
}
SIGNAL_CLASS_RULES = (
    ("usage-policy-change", {"usage-policy", "material-price-quota"}),
    ("material-price-quota-change", {"material-price-quota"}),
    ("major-tech-finance-change", {"major-tech-finance"}),
    ("ai-policy-safety-change", {"ai-policy-safety"}),
    (
        "strategic-hardware-infrastructure-change",
        {"strategic-hardware-infrastructure"},
    ),
)
PRODUCT_SIGNAL_CLASSES = {
    "developer-tool-change": "developer-tool",
    "major-model-product-change": "major-model-product",
    "capability-availability-change": "capability-availability",
}
CLASS_STAGE = {
    "major-model-product": "model-product-release",
    "capability-availability": "capability-availability",
    "usage-policy": "usage-policy-change",
    "developer-tool": "developer-tool-release",
    "material-price-quota": "pricing-quota-change",
    "strategic-hardware-infrastructure": "hardware-infrastructure-change",
    "major-tech-finance": "finance-transaction",
    "ai-policy-safety": "policy-safety-change",
    "other": "reported-development",
}
AGGREGATOR_HOSTS = {
    "news.google.com",
    "www.reddit.com",
    "reddit.com",
    "news.ycombinator.com",
    "www.bing.com",
    "bing.com",
}
DEFAULT_SERVER = Path(
    r"F:\AI\Apps\llama.cpp\llama.cpp-b9484\llama-server.exe"
)
DEFAULT_MODEL_PATH = Path(
    r"F:\AI\Models\GGUF\unsloth\gemma-4-12b-it-GGUF\gemma-4-12b-it-Q4_K_M.gguf"
)
DEFAULT_MODEL_NAME = "gemma-4-12b-it-Q4_K_M.gguf"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run-dir", required=True)
    parser.add_argument(
        "--endpoint",
        default=os.environ.get(
            "DAILY_AI_NEWS_REVIEW_ENDPOINT", "http://127.0.0.1:11435/v1"
        ),
    )
    parser.add_argument(
        "--model",
        default=os.environ.get("DAILY_AI_NEWS_REVIEW_MODEL", DEFAULT_MODEL_NAME),
    )
    parser.add_argument("--classification-batch-size", type=int, default=32)
    parser.add_argument("--event-batch-size", type=int, default=8)
    parser.add_argument("--concurrency", type=int, default=4)
    parser.add_argument("--max-attempts", type=int, default=3)
    parser.add_argument(
        "--automatic-deadline",
        action="store_true",
        help="Fail closed at 07:50 Asia/Shanghai for the manifest report date.",
    )
    parser.add_argument("--no-start-local-model", action="store_true")
    parser.add_argument("--restart", action="store_true")
    parser.add_argument("--restart-event-reviews", action="store_true")
    return parser.parse_args()


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def automatic_review_deadline(report_date: str) -> datetime:
    parsed_date = date.fromisoformat(report_date)
    return datetime.combine(
        parsed_date,
        datetime_time(hour=7, minute=50),
        tzinfo=timezone(timedelta(hours=8), name="Asia/Shanghai"),
    )


def ensure_before_deadline(deadline: datetime | None, stage: str) -> None:
    if deadline is not None and datetime.now(timezone.utc) >= deadline.astimezone(timezone.utc):
        raise RuntimeError(
            f"semantic review reached the automatic 07:50 deadline during {stage}; "
            "the scheduled run must fail closed before the 08:00 publication cutoff"
        )


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: Any) -> None:
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    temporary.replace(path)


def sha256_bytes(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def slug(value: Any, fallback: str) -> str:
    normalized = str(value or "").strip().lower().replace("_", "-")
    normalized = re.sub(r"[^a-z0-9\u4e00-\u9fff-]+", "-", normalized)
    normalized = re.sub(r"-+", "-", normalized).strip("-")
    return normalized[:120] or fallback


def visible_text(value: Any, maximum: int = 280) -> str:
    text = re.sub(r"\s+", " ", str(value or "")).strip()
    return text[:maximum]


def endpoint_request(url: str, payload: dict[str, Any] | None = None) -> Any:
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    data = None
    headers = {}
    if payload is not None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(url, data=data, headers=headers)
    try:
        with opener.open(request, timeout=180) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", errors="replace").strip()
        detail = visible_text(body, 800) or error.reason
        raise RuntimeError(f"semantic review endpoint HTTP {error.code}: {detail}") from error


def endpoint_ready(endpoint: str) -> bool:
    root = endpoint.removesuffix("/v1").rstrip("/")
    try:
        health = endpoint_request(root + "/health")
        return health.get("status") == "ok"
    except (OSError, RuntimeError, ValueError, urllib.error.URLError):
        return False


def start_local_server(
    endpoint: str, parallelism: int = 1
) -> subprocess.Popen[bytes] | None:
    if endpoint_ready(endpoint):
        return None
    server = Path(os.environ.get("DAILY_AI_NEWS_LLAMA_SERVER", DEFAULT_SERVER))
    model_path = Path(
        os.environ.get("DAILY_AI_NEWS_REVIEW_MODEL_PATH", DEFAULT_MODEL_PATH)
    )
    if not server.is_file() or not model_path.is_file():
        raise RuntimeError(
            "Semantic review endpoint is unavailable and the configured local "
            "llama.cpp runtime/model could not be found."
        )
    creationflags = 0
    if os.name == "nt":
        creationflags = subprocess.CREATE_NO_WINDOW | subprocess.DETACHED_PROCESS
    local_parallelism = min(max(1, parallelism), 4)
    process = subprocess.Popen(
        [
            str(server),
            "-m",
            str(model_path),
            "--host",
            "127.0.0.1",
            "--port",
            "11435",
            "-c",
            str(max(32768, local_parallelism * 16384)),
            "-ngl",
            "99",
            "--parallel",
            str(local_parallelism),
            "--cache-type-k",
            "q8_0",
            "--cache-type-v",
            "q8_0",
            "--jinja",
            "--reasoning",
            "off",
            "--reasoning-budget",
            "0",
        ],
        stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        creationflags=creationflags,
    )
    for _ in range(90):
        if endpoint_ready(endpoint):
            return process
        if process.poll() is not None:
            raise RuntimeError("Local semantic review model exited during startup.")
        time.sleep(2)
    process.terminate()
    raise RuntimeError("Local semantic review model did not become ready in time.")


def parse_model_json(content: str) -> dict[str, Any]:
    value = content.strip()
    if value.startswith("```"):
        value = re.sub(r"^```(?:json)?\s*", "", value, flags=re.I)
        value = re.sub(r"\s*```$", "", value)
    parsed = json.loads(value)
    if not isinstance(parsed, dict):
        raise ValueError("Model response must be a JSON object.")
    return parsed


def complete_json(
    endpoint: str,
    model: str,
    system: str,
    user: str,
    max_tokens: int,
) -> dict[str, Any]:
    response = endpoint_request(
        endpoint.rstrip("/") + "/chat/completions",
        {
            "model": model,
            "temperature": 0.1,
            "max_tokens": max_tokens,
            "reasoning_budget": 0,
            "reasoning_effort": "none",
            "chat_template_kwargs": {"enable_thinking": False},
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        },
    )
    choices = response.get("choices") or []
    if not choices:
        raise ValueError("Model response did not contain choices.")
    content = choices[0].get("message", {}).get("content", "")
    if not content:
        raise ValueError("Model response did not contain final content.")
    return parse_model_json(content)


def compatible_classes(signals: list[str]) -> set[str] | None:
    signal_set = set(signals)
    for signal, classes in SIGNAL_CLASS_RULES:
        if signal in signal_set:
            return set(classes)
    product = {
        editorial_class
        for signal, editorial_class in PRODUCT_SIGNAL_CLASSES.items()
        if signal in signal_set
    }
    return product or None


def required_signal_class(signals: list[str]) -> str | None:
    """Return the validator-mandated class for an incompatible model label.

    This is a policy normalization over semantic signals already stored in the
    candidate index, not a title/ID classifier. More specific product stages
    take precedence when a candidate carries several compatible product signals.
    """
    signal_set = set(signals)
    for signal, classes in SIGNAL_CLASS_RULES:
        if signal in signal_set:
            return sorted(classes)[0]
    for signal in (
        "developer-tool-change",
        "major-model-product-change",
        "capability-availability-change",
    ):
        if signal in signal_set:
            return PRODUCT_SIGNAL_CLASSES[signal]
    return None


def validate_scores(value: Any) -> dict[str, int]:
    if not isinstance(value, dict):
        raise ValueError("scores must be an object")
    scores: dict[str, int] = {}
    for field, maximum in SCORE_MAXIMA.items():
        score = value.get(field)
        if isinstance(score, str) and re.fullmatch(r"\s*\d+\s*", score):
            score = int(score.strip())
        if isinstance(score, bool) or not isinstance(score, (int, float)):
            raise ValueError(f"scores.{field} must be numeric")
        rounded = int(score)
        if rounded != score or rounded < 0 or rounded > 3:
            raise ValueError(f"scores.{field} is outside its allowed range")
        # Some local models use the familiar 0..3 scale for every component
        # despite the explicit rubric. Preserve the ordinal judgment while
        # normalizing reach/evidence to the validator's 0..2 ceiling.
        scores[field] = min(rounded, maximum)
    scores["total"] = sum(scores.values())
    return scores


def validate_classification(
    raw: Any, expected_ref: int, candidate: dict[str, Any]
) -> dict[str, Any]:
    if isinstance(raw, list) and len(raw) == 8:
        component_scores = raw[5]
        if not isinstance(component_scores, list) or len(component_scores) != 4:
            raise ValueError("compact classification scores must have four components")
        raw = {
            "ref": raw[0],
            "topicKey": raw[1],
            "eventStage": raw[2],
            "editorialClass": raw[3],
            "substantiveChange": raw[4],
            "scores": dict(zip(SCORE_MAXIMA, component_scores, strict=True)),
            "status": raw[6],
            "note": raw[7],
        }
    if not isinstance(raw, dict) or raw.get("ref") != expected_ref:
        raise ValueError("classification ref mismatch")
    editorial_class = str(raw.get("editorialClass") or "")
    if editorial_class not in ALLOWED_CLASSES:
        raise ValueError("invalid editorial class")
    compatible = compatible_classes(candidate.get("editorialSignals") or [])
    if compatible and editorial_class not in compatible:
        editorial_class = required_signal_class(
            candidate.get("editorialSignals") or []
        ) or editorial_class
    scores = validate_scores(raw.get("scores"))
    status = str(raw.get("status") or "").strip().lower()
    status_aliases = {
        "verified": "confirmed",
        "official": "confirmed",
        "released": "confirmed",
        "published": "confirmed",
        "launched": "confirmed",
        "available": "confirmed",
        "announcement": "confirmed",
        "unverified": "rumor",
        "reported": "rumor",
        "talks": "rumor",
        "planned": "rumor",
        "rumour": "rumor",
        "opinion": "analysis",
        "research": "analysis",
        "explainer": "analysis",
        "unknown": "unclear",
    }
    status = status_aliases.get(status, status)
    if status not in {"confirmed", "rumor", "analysis", "unclear"}:
        if any(token in status for token in ("confirm", "official", "publish", "release", "launch", "availab")):
            status = "confirmed"
        elif any(token in status for token in ("rumor", "rumour", "report", "talk", "plan", "leak", "preview", "expect")):
            status = "rumor"
        elif any(token in status for token in ("analysis", "opinion", "research", "review", "explain", "background")):
            status = "analysis"
        else:
            status = "unclear"
    note = visible_text(raw.get("note"), 360)
    if len(note) < 18:
        raise ValueError("classification note is not specific enough")
    return {
        "candidateId": str(candidate["id"]),
        "topicKey": slug(raw.get("topicKey"), "unclassified-event"),
        "eventStage": slug(raw.get("eventStage"), "reported-development"),
        "editorialClass": editorial_class,
        "substantiveChange": raw.get("substantiveChange") is True,
        "score": scores,
        "status": status,
        "note": note,
    }


CLASSIFICATION_SYSTEM = """You are the semantic intake editor for Daily AI News.
Judge each candidate from its title, publisher, source type, discovery signals,
and short content excerpt. Never use the candidate's ref number to classify,
score, or invent facts. Treat Google News, Reddit, and Hacker News as discovery
only. A report of talks, plans, leaks, previews, or expectations is a rumor, not
a confirmed release. Opinion, explainers, reviews, old background, and generic
company promotion normally are not substantive daily-news events.

Return JSON only as {"items":[...]}. Every input ref must appear exactly once.
Each item must have: ref; topicKey (stable semantic lowercase-kebab-case subject,
for example deepseek-v4-pro or apple-siri-news-licensing); eventStage (specific
stage such as model-release, developer-preview, pricing-change, acquisition-
talks, ipo-talks, or research-publication); editorialClass; substantiveChange;
scores; status; note. Keep note to one candidate-specific concise sentence.

Allowed editorialClass values: major-model-product, capability-availability,
usage-policy, developer-tool, material-price-quota,
strategic-hardware-infrastructure, major-tech-finance, ai-policy-safety, other.
Scores are integers: reach 0..2, magnitude 0..3, practicalValue 0..3, evidence
0..2. A discovery-only or unclear claim must have evidence 0 and must not total
above 5. A score of 6 is the publication threshold, not a target. The note must
state the candidate-specific editorial judgment in one concise sentence.

Signal compatibility is mandatory: usage-policy-change => usage-policy or
material-price-quota; material-price-quota-change => material-price-quota;
major-tech-finance-change => major-tech-finance; ai-policy-safety-change =>
ai-policy-safety; strategic-hardware-infrastructure-change =>
strategic-hardware-infrastructure. Otherwise product signals map only to their
matching product classes."""


def classification_prompt(batch: list[dict[str, Any]]) -> str:
    lines = ["Review all candidates below. Content, not ref, controls judgment."]
    for ref, candidate in enumerate(batch, 1):
        signals = ",".join(candidate.get("editorialSignals") or []) or "none"
        allowed = compatible_classes(candidate.get("editorialSignals") or [])
        allowed_text = ",".join(sorted(allowed)) if allowed else ",".join(sorted(ALLOWED_CLASSES))
        content = visible_text(candidate.get("content"), 220)
        lines.append(
            f"REF {ref}\n"
            f"title: {visible_text(candidate.get('title'), 260)}\n"
            f"publisher: {visible_text(candidate.get('sourceName'), 100)}\n"
            f"sourceType: {candidate.get('sourceType')}\n"
            f"signals: {signals}\n"
            f"allowedClasses: {allowed_text}\n"
            f"excerpt: {content or 'none'}"
        )
    return "\n\n".join(lines)


def classify_batch(
    endpoint: str,
    model: str,
    batch: list[dict[str, Any]],
    attempts: int,
) -> list[dict[str, Any]]:
    error: Exception | None = None
    for attempt in range(1, attempts + 1):
        try:
            parsed = complete_json(
                endpoint,
                model,
                CLASSIFICATION_SYSTEM,
                classification_prompt(batch),
                max_tokens=max(2400, len(batch) * 180),
            )
            items = parsed.get("items")
            if not isinstance(items, list) or len(items) != len(batch):
                raise ValueError("classification response did not cover the batch")
            by_ref = {
                (item[0] if isinstance(item, list) and item else item.get("ref")): item
                for item in items
                if isinstance(item, (dict, list))
            }
            if len(by_ref) != len(batch):
                raise ValueError("classification refs are missing or duplicated")
            return [
                validate_classification(by_ref[ref], ref, candidate)
                for ref, candidate in enumerate(batch, 1)
            ]
        except Exception as exc:  # noqa: BLE001 - bounded retry, then fail closed
            error = exc
            print(
                f"classification batch attempt {attempt}/{attempts} failed: {exc}",
                file=sys.stderr,
            )
    raise RuntimeError(f"semantic classification failed after retries: {error}")


def reliable_rss_evidence(candidate: dict[str, Any]) -> bool:
    if str(candidate.get("sourceType") or "").lower() != "rss":
        return False
    url = str(candidate.get("url") or "")
    if not url.startswith("https://"):
        return False
    host = re.sub(r"^www\.", "", urllib.parse.urlparse(url).hostname or "")
    return host not in AGGREGATOR_HOSTS


def build_event_groups(
    index_items: list[dict[str, Any]], decisions: dict[str, dict[str, Any]]
) -> list[dict[str, Any]]:
    by_id = {str(item["id"]): item for item in index_items}
    required_ids = {
        candidate_id
        for candidate_id, decision in decisions.items()
        if (by_id[candidate_id].get("editorialSignals") or [])
        or str(by_id[candidate_id].get("sourceType") or "").lower() == "rss"
        or decision["editorialClass"] in PROTECTED_CLASSES
    }
    raw_groups: dict[tuple[str, str, str], list[str]] = defaultdict(list)
    for candidate_id in required_ids:
        decision = decisions[candidate_id]
        raw_groups[
            (
                decision["topicKey"],
                decision["eventStage"],
                decision["editorialClass"],
            )
        ].append(candidate_id)

    identities: Counter[tuple[str, str]] = Counter(
        (topic, stage) for topic, stage, _editorial_class in raw_groups
    )
    groups: list[dict[str, Any]] = []
    for (topic, stage, editorial_class), candidate_ids in sorted(raw_groups.items()):
        event_stage = stage
        if identities[(topic, stage)] > 1:
            semantic_stage = CLASS_STAGE[editorial_class]
            event_stage = (
                semantic_stage
                if stage == semantic_stage
                else slug(f"{stage}-{semantic_stage}", semantic_stage)
            )
        groups.append(
            {
                "eventKey": topic,
                "eventStage": event_stage,
                "editorialClass": editorial_class,
                "candidateIds": sorted(candidate_ids),
            }
        )
    return groups


def batch_event_groups(
    groups: list[dict[str, Any]], batch_size: int
) -> list[list[dict[str, Any]]]:
    """Build deterministic batches with one stage per event key in each batch.

    Some local models return a semantic event key instead of the numeric ref.
    Keeping duplicate event keys out of one batch preserves unambiguous semantic
    correlation without ever falling back to response order.
    """
    remaining = list(groups)
    batches: list[list[dict[str, Any]]] = []
    while remaining:
        batch: list[dict[str, Any]] = []
        event_keys: set[str] = set()
        deferred: list[dict[str, Any]] = []
        for group in remaining:
            event_key = str(group["eventKey"])
            if len(batch) < batch_size and event_key not in event_keys:
                batch.append(group)
                event_keys.add(event_key)
            else:
                deferred.append(group)
        batches.append(batch)
        remaining = deferred
    return batches


def load_recent_published_events(run_dir: Path, report_date: str) -> list[dict[str, str]]:
    recent: dict[tuple[str, str], dict[str, str]] = {}
    for run_path in run_dir.parent.glob("run-*/daily_run.json"):
        try:
            prior = read_json(run_path)
        except (OSError, ValueError):
            continue
        prior_date = str(prior.get("reportDate") or "")
        if not prior_date or prior_date >= report_date:
            continue
        for candidate in prior.get("candidates") or []:
            if candidate.get("selected") is not True:
                continue
            event_key = str(candidate.get("eventKey") or "")
            event_stage = str(candidate.get("eventStage") or "")
            if event_key and event_stage:
                recent[(event_key, event_stage)] = {
                    "reportDate": prior_date,
                    "eventKey": event_key,
                    "eventStage": event_stage,
                    "storyKey": str(candidate.get("storyKey") or ""),
                    "summary": visible_text(candidate.get("whyWorth"), 240),
                }
    return sorted(recent.values(), key=lambda entry: entry["reportDate"], reverse=True)[:160]


EVENT_REVIEW_SYSTEM = """You are completing the evidence-backed protected-event
review for Daily AI News. Each event is already semantically clustered. Judge
the event from its actual headlines, publishers, source types, signals, and
available direct publisher evidence. Never use ref numbers or candidate IDs as
editorial inputs. Return JSON only as {"events":[...]} with every ref exactly
once.

For each event return: ref; substantiveChange; scores (integer reach 0..2,
magnitude 0..3, practicalValue 0..3, evidence 0..2); scoreRationale with a
specific sentence of at least 12 visible characters for each of reach,
magnitude, practicalValue, evidence; evidenceSummary with at least 24 visible
characters; and recommendation.

recommendation is one of select, insufficient-evidence,
below-importance-threshold, routine-or-promotional, outside-editorial-scope,
no-material-change. Use select only for an independent event scoring at least 6
with reliable direct evidence. Use insufficient-evidence when only discovery/aggregator
evidence exists; such an event must score evidence 0 and total at most 5. Use
below-importance-threshold only for a real substantive change scoring below 6.
Use no-material-change only when substantiveChange is false. A confirmed direct
publisher/RSS item may score evidence 1 or 2. Reports of talks, leaks, plans, or
expectations remain unverified even when two outlets report them. Do not inflate
scores to satisfy a quota, and do not reuse generic rationale templates. If the
same event and stage already appears in the supplied recent publication ledger,
use no-material-change unless this candidate contains a clearly new stage.

Apply these anchors strictly. Reach 2 requires broad global or major-market impact;
a regional, niche, single-company, or specialist audience is normally 0 or 1.
Magnitude 3 is reserved for a frontier model/product release, industry-wide policy
or price change, completed multibillion strategic transaction, or comparable
structural shift. A minor feature, promotion, survey, commentary, research paper,
single customer order, or regional launch is normally 0 or 1. Practical value 3
requires immediate broad workflow or user impact; niche utility is 0 or 1.
Evidence 2 requires an official/primary record or two independent reliable direct
reports; one secondary RSS publisher is evidence 1. A story must independently
earn six points after these anchors.

Within the current batch and the supplied current-run ledger, treat aliases and
headline variants for the same real event and stage as one event. Select only one
canonical group with the strongest direct evidence and mark the other aliases as
no-material-change; a competitor mentioned in a multi-event headline is not merge
identity. Every input event still requires exactly one output record, including
generic FAQs, promotional posts, irrelevant items, aliases, and events with no
direct evidence; reject them explicitly and never omit a ref."""


def event_review_prompt(
    batch: list[dict[str, Any]],
    by_id: dict[str, dict[str, Any]],
    decisions: dict[str, dict[str, Any]],
    recent_events: list[dict[str, str]],
    reviewed_events: dict[str, dict[str, Any]],
) -> str:
    history_lines = [
        f"- {entry['reportDate']} | {entry['eventKey']} | {entry['eventStage']} | "
        f"{entry.get('storyKey', '')} | {visible_text(entry.get('summary'), 120)}"
        for entry in recent_events
    ]
    current_lines = [
        f"- {event['eventKey']} | {event['eventStage']} | "
        f"{visible_text(event.get('evidenceSummary'), 120)}"
        for event in reviewed_events.values()
        if event.get("recommendedDisposition") == "selected"
    ][-120:]
    blocks = [
        "Review every semantically clustered event below.",
        "Recent already-published event stages (deduplicate semantically):\n"
        + ("\n".join(history_lines) if history_lines else "- none"),
        "Earlier selected current-run events (deduplicate aliases semantically):\n"
        + ("\n".join(current_lines) if current_lines else "- none"),
    ]
    for ref, group in enumerate(batch, 1):
        candidates = [by_id[candidate_id] for candidate_id in group["candidateIds"]]
        direct = [candidate for candidate in candidates if reliable_rss_evidence(candidate)]
        lines = [
            f"EVENT REF {ref}",
            f"subject: {group['eventKey']}",
            f"stage: {group['eventStage']}",
            f"requiredClass: {group['editorialClass']}",
            "candidate evidence:",
        ]
        for candidate in candidates[:10]:
            decision = decisions[str(candidate["id"])]
            lines.append(
                "- "
                + " | ".join(
                    [
                        visible_text(candidate.get("title"), 220),
                        visible_text(candidate.get("sourceName"), 80),
                        str(candidate.get("sourceType")),
                        ",".join(candidate.get("editorialSignals") or []) or "no-signal",
                        decision["status"],
                    ]
                )
            )
        if len(candidates) > 10:
            lines.append(f"- plus {len(candidates) - 10} semantically matched headlines")
        if direct:
            lines.append("direct publisher/RSS evidence available:")
            for candidate in direct[:5]:
                lines.append(
                    f"- {candidate.get('sourceName')} | {candidate.get('publishedAt')} | "
                    f"{candidate.get('url')}"
                )
        else:
            lines.append("direct publisher/RSS evidence available: none")
        blocks.append("\n".join(lines))
    return "\n\n".join(blocks)


def validate_event_review(raw: Any, expected_ref: int) -> dict[str, Any]:
    if not isinstance(raw, dict):
        raise ValueError("event review ref mismatch")
    normalized_ref = normalize_model_ref(raw.get("ref"))
    if normalized_ref is None:
        raise ValueError("event review ref mismatch")
    if normalized_ref != expected_ref:
        raise ValueError("event review ref mismatch")
    raw_scores = raw.get("scores")
    if raw_scores is None and isinstance(raw.get("scoreRationale"), str):
        raw_scores = scores_from_labeled_rationale(raw["scoreRationale"])
    if isinstance(raw_scores, list) and len(raw_scores) == 4:
        raw_scores = dict(zip(SCORE_MAXIMA, raw_scores, strict=True))
    scores = validate_scores(raw_scores)
    rationale = raw.get("scoreRationale")
    if isinstance(rationale, list) and len(rationale) == 4:
        rationale = dict(zip(SCORE_MAXIMA, rationale, strict=True))
    if isinstance(rationale, str):
        label_pattern = re.compile(
            r"(?i)(reach|magnitude|practical\s*value|evidence)\s*(?::|\bis\b)\s*"
        )
        matches = list(label_pattern.finditer(rationale))
        parsed_rationale: dict[str, str] = {}
        key_map = {
            "reach": "reach",
            "magnitude": "magnitude",
            "practicalvalue": "practicalValue",
            "evidence": "evidence",
        }
        for index, match in enumerate(matches):
            raw_key = re.sub(r"\s+", "", match.group(1).casefold())
            key = key_map[raw_key]
            end = matches[index + 1].start() if index + 1 < len(matches) else len(rationale)
            parsed_rationale[key] = rationale[match.end() : end].strip(" .;")
        if set(parsed_rationale) == set(SCORE_MAXIMA):
            rationale = parsed_rationale
    if not isinstance(rationale, dict):
        raise ValueError("scoreRationale must be an object")
    evidence_summary = visible_text(raw.get("evidenceSummary"), 520)
    if len(evidence_summary) < 24:
        raise ValueError("evidenceSummary is not specific enough")
    cleaned_rationale = {}
    for field in SCORE_MAXIMA:
        text = visible_text(rationale.get(field), 360)
        if len(text) < 12:
            text = visible_text(f"{text}. Event context: {evidence_summary}", 360)
        cleaned_rationale[field] = text
    recommendation = str(
        raw.get("recommendation")
        or raw.get("recommendedRejectionReason")
        or ""
    )
    allowed = {
        "select",
        "insufficient-evidence",
        "below-importance-threshold",
        "routine-or-promotional",
        "outside-editorial-scope",
        "no-material-change",
    }
    if recommendation not in allowed:
        raise ValueError("invalid recommendation")
    substantive = raw.get("substantiveChange") is True
    if recommendation == "insufficient-evidence" and scores["evidence"] == 0:
        scores["practicalValue"] = min(scores["practicalValue"], 1)
        scores["magnitude"] = min(scores["magnitude"], 2)
        scores["total"] = sum(scores[field] for field in SCORE_MAXIMA)
    if not substantive and (scores["magnitude"] > 0 or scores["practicalValue"] > 0):
        scores["magnitude"] = 0
        scores["practicalValue"] = 0
        scores["total"] = sum(scores[field] for field in SCORE_MAXIMA)
    if not substantive and scores["total"] < 6:
        recommendation = "no-material-change"
    if recommendation == "select" and substantive:
        if scores["evidence"] == 0:
            recommendation = "insufficient-evidence"
        elif scores["total"] < 6:
            recommendation = "below-importance-threshold"
    if (
        recommendation == "no-material-change"
        and substantive
        and scores["total"] < 6
    ):
        recommendation = "below-importance-threshold"
    if (
        recommendation == "below-importance-threshold"
        and substantive
        and scores["evidence"] > 0
        and scores["total"] >= 6
    ):
        recommendation = "select"
    if recommendation == "no-material-change" and substantive:
        raise ValueError("no-material-change requires substantiveChange false")
    if recommendation == "below-importance-threshold" and not substantive:
        raise ValueError("below-importance-threshold requires substantiveChange true")
    if recommendation == "insufficient-evidence" and (
        scores["evidence"] != 0 or scores["total"] > 5
    ):
        raise ValueError("insufficient evidence must score evidence 0 and total at most 5")
    if recommendation == "select" and (
        not substantive or scores["evidence"] == 0 or scores["total"] < 6
    ):
        raise ValueError("select requires a substantive, evidenced score of at least 6")
    if recommendation != "select" and scores["total"] >= 6:
        raise ValueError("a rejected event may not retain a threshold-clearing score")
    return {
        "substantiveChange": substantive,
        "score": scores,
        "scoreRationale": cleaned_rationale,
        "evidenceSummary": evidence_summary,
        "recommendedDisposition": "selected" if recommendation == "select" else "rejected",
        "recommendedRejectionReason": None if recommendation == "select" else recommendation,
    }


def normalize_model_ref(value: Any) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float) and value.is_integer():
        return int(value)
    match = re.fullmatch(r"\s*(?:(?:event\s+)?ref\s*)?(\d+)\s*", str(value or ""), re.I)
    return int(match.group(1)) if match else None


def scores_from_labeled_rationale(value: str) -> dict[str, int] | None:
    patterns = {
        "reach": r"\breach\s*(?::|\bis\b)\s*(\d)\b",
        "magnitude": r"\bmagnitude\s*(?::|\bis\b)\s*(\d)\b",
        "practicalValue": r"\bpractical\s*value\s*(?::|\bis\b)\s*(\d)\b",
        "evidence": r"\bevidence\s*(?::|\bis\b)\s*(\d)\b",
    }
    parsed: dict[str, int] = {}
    for field, pattern in patterns.items():
        match = re.search(pattern, value, re.I)
        if not match:
            return None
        parsed[field] = int(match.group(1))
    return parsed


def resolve_event_ref(value: Any, batch: list[dict[str, Any]]) -> int | None:
    if len(batch) == 1:
        return 1
    numeric_ref = normalize_model_ref(value)
    if numeric_ref is not None:
        return numeric_ref if 1 <= numeric_ref <= len(batch) else None
    semantic_ref = str(value or "").strip().casefold()
    matches = []
    for expected_ref, group in enumerate(batch, 1):
        event_key = str(group.get("eventKey") or "").strip().casefold()
        identity = f"{event_key}/{str(group.get('eventStage') or '').strip().casefold()}"
        if semantic_ref in {event_key, identity}:
            matches.append(expected_ref)
    return matches[0] if len(matches) == 1 else None


def review_event_batch(
    endpoint: str,
    model: str,
    batch: list[dict[str, Any]],
    by_id: dict[str, dict[str, Any]],
    decisions: dict[str, dict[str, Any]],
    recent_events: list[dict[str, str]],
    reviewed_events: dict[str, dict[str, Any]],
    attempts: int,
) -> list[dict[str, Any]]:
    error: Exception | None = None
    for attempt in range(1, attempts + 1):
        try:
            parsed = complete_json(
                endpoint,
                model,
                EVENT_REVIEW_SYSTEM,
                event_review_prompt(
                    batch, by_id, decisions, recent_events, reviewed_events
                ),
                max_tokens=max(2400, len(batch) * 320),
            )
            events = parsed.get("events")
            if (
                len(batch) == 1
                and not isinstance(events, list)
                and isinstance(parsed, dict)
                and "ref" in parsed
            ):
                events = [parsed]
            if not isinstance(events, list) or len(events) != len(batch):
                compact_parsed = json.dumps(
                    parsed, ensure_ascii=False, separators=(",", ":")
                )[:1200]
                raise ValueError(
                    "event review did not cover the batch: "
                    f"expected={len(batch)} payload={compact_parsed}"
                )
            by_ref: dict[int, dict[str, Any]] = {}
            for event in events:
                if not isinstance(event, dict):
                    continue
                normalized_ref = resolve_event_ref(event.get("ref"), batch)
                if normalized_ref is None:
                    continue
                if normalized_ref in by_ref:
                    raise ValueError("event refs are missing or duplicated")
                by_ref[normalized_ref] = event
            if len(by_ref) != len(batch):
                returned_refs = [
                    event.get("ref") for event in events if isinstance(event, dict)
                ]
                raise ValueError(
                    "event refs are missing or duplicated: "
                    f"expected={len(batch)} returned={returned_refs!r}"
                )
            validated = []
            for ref in range(1, len(batch) + 1):
                try:
                    normalized_event = {**by_ref[ref], "ref": ref}
                    validated.append(validate_event_review(normalized_event, ref))
                except Exception as validation_error:
                    compact_payload = json.dumps(
                        by_ref[ref], ensure_ascii=False, separators=(",", ":")
                    )[:1200]
                    raise ValueError(
                        f"event ref {ref} invalid: {validation_error}; "
                        f"payload={compact_payload}"
                    ) from validation_error
            return validated
        except Exception as exc:  # noqa: BLE001 - bounded retry, then fail closed
            error = exc
            print(
                f"protected-event batch attempt {attempt}/{attempts} failed: {exc}",
                file=sys.stderr,
            )
    if len(batch) > 1:
        midpoint = len(batch) // 2
        print(
            f"protected-event batch is being split after {attempts} failed attempts: "
            f"{len(batch)} -> {midpoint}+{len(batch) - midpoint}",
            file=sys.stderr,
        )
        return review_event_batch(
            endpoint,
            model,
            batch[:midpoint],
            by_id,
            decisions,
            recent_events,
            reviewed_events,
            attempts,
        ) + review_event_batch(
            endpoint,
            model,
            batch[midpoint:],
            by_id,
            decisions,
            recent_events,
            reviewed_events,
            attempts,
        )
    raise RuntimeError(f"protected-event semantic review failed after retries: {error}")


def main() -> int:
    args = parse_args()
    if args.classification_batch_size < 1 or args.event_batch_size < 1:
        raise ValueError("semantic review batch sizes must be positive")
    if args.concurrency < 1 or args.concurrency > 8:
        raise ValueError("semantic review concurrency must be between 1 and 8")
    run_dir = Path(args.run_dir).resolve()
    candidate_index_path = run_dir / "candidate_index.json"
    manifest_path = run_dir / "coverage_manifest.json"
    candidates_path = run_dir / "daily_candidates.json"
    for required in (candidate_index_path, manifest_path, candidates_path):
        if not required.is_file():
            raise FileNotFoundError(required)

    candidate_index = read_json(candidate_index_path)
    manifest = read_json(manifest_path)
    deadline = (
        automatic_review_deadline(str(manifest.get("reportDate") or ""))
        if args.automatic_deadline
        else None
    )
    ensure_before_deadline(deadline, "startup")
    candidates_payload = read_json(candidates_path)
    index_items = candidate_index.get("items") or []
    if not isinstance(index_items, list) or not index_items:
        raise RuntimeError("candidate_index.json has no items")
    expected_hash = str(
        manifest.get("candidateIndexSha256")
        or manifest.get("candidateIndex", {}).get("sha256")
        or ""
    )
    actual_hash = sha256_bytes(candidate_index_path)
    if actual_hash != expected_hash:
        raise RuntimeError("candidate index hash does not match coverage manifest")

    content_by_id = {
        str(item.get("id")): visible_text(item.get("content"), 280)
        for item in candidates_payload.get("items") or []
    }
    candidates = []
    for item in index_items:
        enriched = dict(item)
        enriched["content"] = content_by_id.get(str(item.get("id")), "")
        candidates.append(enriched)
    by_id = {str(item["id"]): item for item in candidates}
    recent_events = load_recent_published_events(
        run_dir, str(manifest.get("reportDate") or "")
    )

    checkpoint_path = run_dir / "semantic_editorial_review.checkpoint.json"
    output_path = run_dir / "semantic_editorial_review.json"
    if args.restart:
        checkpoint = {}
    elif checkpoint_path.is_file():
        checkpoint = read_json(checkpoint_path)
        if checkpoint.get("candidateIndexSha256") != actual_hash:
            raise RuntimeError("semantic review checkpoint belongs to another index")
    else:
        checkpoint = {}
    classifications: dict[str, dict[str, Any]] = checkpoint.get("classifications") or {}
    event_reviews: dict[str, dict[str, Any]] = checkpoint.get("eventReviews") or {}
    if args.restart_event_reviews:
        event_reviews = {}

    started_server: subprocess.Popen[bytes] | None = None
    try:
        if not endpoint_ready(args.endpoint):
            if args.no_start_local_model:
                raise RuntimeError("semantic review endpoint is unavailable")
            started_server = start_local_server(args.endpoint, args.concurrency)
        ensure_before_deadline(deadline, "model startup")

        remaining = [item for item in candidates if str(item["id"]) not in classifications]
        classification_batches = [
            remaining[offset : offset + args.classification_batch_size]
            for offset in range(0, len(remaining), args.classification_batch_size)
        ]
        def save_checkpoint() -> None:
            write_json(
                checkpoint_path,
                {
                    "schemaVersion": 1,
                    "candidateIndexSha256": actual_hash,
                    "model": args.model,
                    "updatedAt": now_iso(),
                    "classifications": classifications,
                    "eventReviews": event_reviews,
                },
            )

        if args.concurrency <= 1:
            for completed_batches, batch in enumerate(classification_batches, 1):
                ensure_before_deadline(deadline, "candidate classification")
                reviewed = classify_batch(
                    args.endpoint, args.model, batch, args.max_attempts
                )
                print(
                    f"semantic classification batch {completed_batches}/"
                    f"{len(classification_batches)}"
                )
                classifications.update(
                    {entry["candidateId"]: entry for entry in reviewed}
                )
                save_checkpoint()
        else:
          completed_batches = 0
          for wave_start in range(0, len(classification_batches), args.concurrency):
            ensure_before_deadline(deadline, "candidate classification")
            wave = classification_batches[wave_start : wave_start + args.concurrency]
            with ThreadPoolExecutor(max_workers=len(wave)) as executor:
              pending = {
                  executor.submit(
                      classify_batch,
                      args.endpoint,
                      args.model,
                      batch,
                      args.max_attempts,
                  ): batch
                  for batch in wave
              }
              for future in as_completed(pending):
                  reviewed = future.result()
                  completed_batches += 1
                  print(
                      f"semantic classification batch {completed_batches}/"
                      f"{len(classification_batches)}"
                  )
                  classifications.update(
                      {entry["candidateId"]: entry for entry in reviewed}
                  )
                  save_checkpoint()
        if set(classifications) != set(by_id):
            raise RuntimeError("semantic classification does not cover every candidate")

        groups = build_event_groups(candidates, classifications)
        group_by_identity = {
            f"{group['eventKey']}/{group['eventStage']}": group for group in groups
        }
        remaining_groups = [
            group
            for identity, group in group_by_identity.items()
            if identity not in event_reviews
        ]
        event_batches = batch_event_groups(remaining_groups, args.event_batch_size)
        if args.concurrency <= 1:
            for completed_batches, batch in enumerate(event_batches, 1):
                ensure_before_deadline(deadline, "protected-event review")
                reviewed = review_event_batch(
                    args.endpoint,
                    args.model,
                    batch,
                    by_id,
                    classifications,
                    recent_events,
                    event_reviews,
                    args.max_attempts,
                )
                print(
                    f"protected-event review batch {completed_batches}/"
                    f"{len(event_batches)}"
                )
                for group, detail in zip(batch, reviewed, strict=True):
                    identity = f"{group['eventKey']}/{group['eventStage']}"
                    event_reviews[identity] = {**group, **detail}
                save_checkpoint()
        else:
          completed_batches = 0
          for wave_start in range(0, len(event_batches), args.concurrency):
            ensure_before_deadline(deadline, "protected-event review")
            wave = event_batches[wave_start : wave_start + args.concurrency]
            ledger_snapshot = dict(event_reviews)
            with ThreadPoolExecutor(max_workers=len(wave)) as executor:
              pending = {
                  executor.submit(
                      review_event_batch,
                      args.endpoint,
                      args.model,
                      batch,
                      by_id,
                      classifications,
                      recent_events,
                      ledger_snapshot,
                      args.max_attempts,
                  ): batch
                  for batch in wave
              }
              for future in as_completed(pending):
                  batch = pending[future]
                  reviewed = future.result()
                  completed_batches += 1
                  print(
                      f"protected-event review batch {completed_batches}/"
                      f"{len(event_batches)}"
                  )
                  for group, detail in zip(batch, reviewed, strict=True):
                      identity = f"{group['eventKey']}/{group['eventStage']}"
                      event_reviews[identity] = {**group, **detail}
                  save_checkpoint()
        if set(event_reviews) != set(group_by_identity):
            raise RuntimeError("protected-event review does not cover every required event")
        ensure_before_deadline(deadline, "final ledger assembly")

        # A protected event's detailed second-pass judgment governs every member.
        for event in event_reviews.values():
            for candidate_id in event["candidateIds"]:
                classifications[candidate_id] = {
                    **classifications[candidate_id],
                    "topicKey": event["eventKey"],
                    "eventStage": event["eventStage"],
                    "editorialClass": event["editorialClass"],
                    "substantiveChange": event["substantiveChange"],
                    "score": event["score"],
                    "note": event["evidenceSummary"],
                    "recommendedRejectionReason": event[
                        "recommendedRejectionReason"
                    ],
                }

        completed_at = now_iso()
        output = {
            "schemaVersion": 1,
            "reportDate": manifest.get("reportDate"),
            "windowStart": manifest.get("windowStart"),
            "windowEnd": manifest.get("windowEnd"),
            "candidateIndexSha256": actual_hash,
            "candidateCount": len(candidates),
            "reviewPolicy": "content-semantic-checkpointed-v1",
            "model": {
                "provider": "local-openai-compatible",
                "name": args.model,
                "candidateIdsUsedForJudgment": False,
                "concurrency": args.concurrency,
                "classificationBatchSize": args.classification_batch_size,
                "eventBatchSize": args.event_batch_size,
            },
            "completedAt": completed_at,
            "decisions": [classifications[str(item["id"])] for item in candidates],
            "protectedEvents": [event_reviews[identity] for identity in sorted(event_reviews)],
        }
        write_json(output_path, output)
        print(
            json.dumps(
                {
                    "status": "reviewed",
                    "output": str(output_path),
                    "candidateCount": len(candidates),
                    "protectedEventCount": len(event_reviews),
                    "thresholdClearingEvents": sum(
                        event["score"]["total"] >= 6
                        for event in event_reviews.values()
                    ),
                },
                ensure_ascii=False,
            )
        )
        return 0
    finally:
        if started_server is not None and started_server.poll() is None:
            started_server.terminate()


if __name__ == "__main__":
    raise SystemExit(main())
