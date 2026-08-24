from __future__ import annotations

import importlib.util
import io
import sys
import unittest
import urllib.error
from datetime import timedelta
from pathlib import Path
from unittest.mock import patch


MODULE_PATH = Path(__file__).with_name("semantic-editorial-review.py")
SPEC = importlib.util.spec_from_file_location("semantic_editorial_review", MODULE_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError(f"cannot import {MODULE_PATH}")
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class SemanticSchedulingTests(unittest.TestCase):
    def test_defaults_fit_event_review_inside_each_parallel_context(self) -> None:
        with patch.object(sys, "argv", ["semantic-editorial-review.py", "--run-dir", "run"]):
            args = MODULE.parse_args()

        self.assertEqual(args.event_batch_size, 8)
        self.assertEqual(args.concurrency, 4)

    def test_endpoint_error_includes_local_response_detail(self) -> None:
        error = urllib.error.HTTPError(
            "http://127.0.0.1:11435/v1/chat/completions",
            400,
            "Bad Request",
            {},
            io.BytesIO(b'{"error":{"message":"request exceeds context size"}}'),
        )
        with patch("urllib.request.OpenerDirector.open", side_effect=error):
            with self.assertRaisesRegex(RuntimeError, "request exceeds context size"):
                MODULE.endpoint_request("http://127.0.0.1:11435/v1/chat/completions", {})

    def test_model_loading_response_is_not_ready_yet(self) -> None:
        with patch.object(
            MODULE,
            "endpoint_request",
            side_effect=RuntimeError('semantic review endpoint HTTP 503: Loading model'),
        ):
            self.assertFalse(MODULE.endpoint_ready("http://127.0.0.1:11435/v1"))

    def test_automatic_deadline_reserves_ten_minutes_before_publication_cutoff(self) -> None:
        deadline = MODULE.automatic_review_deadline("2026-08-14")

        self.assertEqual(deadline.isoformat(), "2026-08-14T07:50:00+08:00")
        self.assertEqual(
            (deadline + timedelta(minutes=10)).isoformat(),
            "2026-08-14T08:00:00+08:00",
        )


class SemanticClassificationTests(unittest.TestCase):
    def test_signal_class_normalization_uses_manifest_signal_not_title_or_id(self) -> None:
        candidate = {
            "id": "opaque-candidate-17",
            "editorialSignals": ["usage-policy-change"],
        }
        raw = {
            "ref": 1,
            "topicKey": "codex-reset",
            "eventStage": "usage-reset",
            "editorialClass": "other",
            "substantiveChange": True,
            "scores": {
                "reach": 2,
                "magnitude": 2,
                "practicalValue": 2,
                "evidence": 2,
            },
            "status": "official",
            "note": "A first-party account announced a material paid-usage reset.",
        }

        result = MODULE.validate_classification(raw, 1, candidate)

        self.assertEqual(result["editorialClass"], "material-price-quota")
        self.assertEqual(result["status"], "confirmed")

    def test_reach_and_evidence_are_normalized_to_schema_ceiling(self) -> None:
        self.assertEqual(
            MODULE.validate_scores(
                {
                    "reach": 3,
                    "magnitude": 3,
                    "practicalValue": 3,
                    "evidence": 3,
                }
            ),
            {
                "reach": 2,
                "magnitude": 3,
                "practicalValue": 3,
                "evidence": 2,
                "total": 10,
            },
        )

    def test_score_components_accept_integer_strings_only(self) -> None:
        self.assertEqual(
            MODULE.validate_scores(
                {
                    "reach": "1",
                    "magnitude": "2",
                    "practicalValue": "2",
                    "evidence": "1",
                }
            )["total"],
            6,
        )


class SemanticEventTests(unittest.TestCase):
    def test_event_prompt_keeps_full_ledgers_with_bounded_summaries(self) -> None:
        batch = [
            {
                "eventKey": "current-event",
                "eventStage": "release",
                "editorialClass": "other",
                "candidateIds": ["candidate"],
            }
        ]
        candidate = {
            "id": "candidate",
            "title": "Candidate title",
            "sourceName": "Publisher",
            "sourceType": "google_news",
            "editorialSignals": [],
        }
        recent = [
            {
                "reportDate": "2026-08-14",
                "eventKey": f"prior-{index}",
                "eventStage": "release",
                "storyKey": f"story-{index}",
                "summary": "x" * 500,
            }
            for index in range(160)
        ]
        reviewed = {
            f"selected-{index}/release": {
                "eventKey": f"selected-{index}",
                "eventStage": "release",
                "evidenceSummary": "y" * 500,
                "recommendedDisposition": "selected",
            }
            for index in range(120)
        }

        prompt = MODULE.event_review_prompt(
            batch,
            {"candidate": candidate},
            {"candidate": {"status": "analysis"}},
            recent,
            reviewed,
        )

        self.assertIn("prior-0", prompt)
        self.assertIn("selected-119", prompt)
        self.assertLess(len(prompt), 50000)

    def test_event_review_splits_a_batch_that_exhausts_structured_output_retries(self) -> None:
        groups = [
            {
                "eventKey": "event-a",
                "eventStage": "release",
                "editorialClass": "other",
                "candidateIds": ["a"],
            },
            {
                "eventKey": "event-b",
                "eventStage": "release",
                "editorialClass": "other",
                "candidateIds": ["b"],
            },
        ]
        candidates = {
            key: {
                "id": key,
                "title": f"Candidate {key}",
                "sourceName": "Publisher",
                "sourceType": "google_news",
                "editorialSignals": [],
            }
            for key in ("a", "b")
        }
        decisions = {
            key: {"status": "analysis"}
            for key in ("a", "b")
        }
        valid_single = {
            "events": [
                {
                    "ref": 1,
                    "substantiveChange": False,
                    "scores": {"reach": 0, "magnitude": 0, "practicalValue": 0, "evidence": 0},
                    "scoreRationale": {
                        "reach": "The item has no demonstrated audience impact.",
                        "magnitude": "The item contains no substantive new change.",
                        "practicalValue": "The item changes no current user workflow.",
                        "evidence": "No reliable direct evidence supports a new event.",
                    },
                    "evidenceSummary": "The discovery item does not establish a new evidence-backed event stage.",
                    "recommendation": "no-material-change",
                }
            ]
        }

        def complete_side_effect(_endpoint, _model, _system, user, max_tokens):
            self.assertGreater(max_tokens, 0)
            if user.count("EVENT REF") > 1:
                raise ValueError("malformed batch JSON")
            return valid_single

        with patch.object(MODULE, "complete_json", side_effect=complete_side_effect):
            result = MODULE.review_event_batch(
                "http://127.0.0.1:11435/v1",
                "model",
                groups,
                candidates,
                decisions,
                [],
                {},
                3,
            )

        self.assertEqual(len(result), 2)

    def test_event_batches_separate_stages_with_the_same_semantic_key(self) -> None:
        groups = [
            {"eventKey": "dji-osmo-360-ii", "eventStage": "product-release"},
            {"eventKey": "dji-osmo-360-ii", "eventStage": "availability-change"},
            {"eventKey": "other-event", "eventStage": "release"},
        ]

        batches = MODULE.batch_event_groups(groups, 2)

        self.assertEqual(sum(len(batch) for batch in batches), 3)
        self.assertTrue(
            all(len({group["eventKey"] for group in batch}) == len(batch) for batch in batches)
        )
        self.assertEqual(len(batches), 2)

    def test_model_ref_normalization_accepts_event_prefix_only(self) -> None:
        self.assertEqual(MODULE.normalize_model_ref("EVENT REF 7"), 7)
        self.assertEqual(MODULE.normalize_model_ref("REF 7"), 7)
        self.assertEqual(MODULE.normalize_model_ref(7.0), 7)
        self.assertIsNone(MODULE.normalize_model_ref("the seventh event"))

    def test_event_ref_resolves_exact_semantic_identity_without_position_fallback(self) -> None:
        batch = [
            {"eventKey": "alpha-release", "eventStage": "model-release"},
            {"eventKey": "beta-pricing", "eventStage": "pricing-change"},
        ]

        self.assertEqual(MODULE.resolve_event_ref("beta-pricing", batch), 2)
        self.assertEqual(
            MODULE.resolve_event_ref("alpha-release/model-release", batch), 1
        )
        self.assertIsNone(MODULE.resolve_event_ref("unrelated-event", batch))

    def test_single_event_request_allows_unambiguous_semantic_ref_rewrite(self) -> None:
        batch = [{"eventKey": "deepseek-api-pricing", "eventStage": "pricing-change"}]

        self.assertEqual(MODULE.resolve_event_ref("deepseek-api-price-hike", batch), 1)

    def test_event_review_accepts_numeric_string_ref(self) -> None:
        result = MODULE.validate_event_review(
            {
                "ref": "1",
                "substantiveChange": True,
                "scores": {
                    "reach": 2,
                    "magnitude": 2,
                    "practicalValue": 1,
                    "evidence": 1,
                },
                "scoreRationale": {
                    "reach": "This affects a broad group of active developers.",
                    "magnitude": "The release changes a core production capability.",
                    "practicalValue": "Teams can use the capability in current workflows.",
                    "evidence": "A direct publisher RSS item verifies the release.",
                },
                "evidenceSummary": "The direct publisher announced an in-window production release.",
                "recommendation": "select",
            },
            1,
        )

        self.assertEqual(result["recommendedDisposition"], "selected")

    def test_event_review_accepts_ordered_score_and_rationale_arrays(self) -> None:
        result = MODULE.validate_event_review(
            {
                "ref": "EVENT REF 2",
                "substantiveChange": True,
                "scores": [1, 2, 1, 2],
                "scoreRationale": [
                    "The affected audience is a focused developer segment.",
                    "The release materially changes the available workflow.",
                    "Teams can apply the change in real production work.",
                    "Two direct publisher records verify this exact stage.",
                ],
                "evidenceSummary": "Direct publisher records verify a distinct in-window release stage.",
                "recommendation": "select",
            },
            2,
        )

        self.assertEqual(result["score"]["total"], 6)

    def test_event_review_accepts_four_explicit_labeled_rationales(self) -> None:
        result = MODULE.validate_event_review(
            {
                "ref": 3,
                "substantiveChange": True,
                "scores": ["1", "2", "2", "1"],
                "scoreRationale": (
                    "Reach: The change affects a focused developer audience. "
                    "Magnitude: It introduces a distinct production capability. "
                    "PracticalValue: Teams can apply it in current workflows. "
                    "Evidence: A direct publisher RSS item confirms the stage."
                ),
                "evidenceSummary": "A direct publisher item verifies a distinct in-window capability release.",
                "recommendation": "select",
            },
            3,
        )

        self.assertEqual(result["scoreRationale"]["practicalValue"], "Teams can apply it in current workflows")

    def test_below_threshold_select_is_downgraded_without_inflating_score(self) -> None:
        result = MODULE.validate_event_review(
            {
                "ref": 4,
                "substantiveChange": True,
                "scores": [1, 1, 2, 1],
                "scoreRationale": [
                    "The item reaches a focused security developer audience.",
                    "It discloses a limited security workflow concern.",
                    "The warning is useful for credential handling reviews.",
                    "A direct security publisher post supports the claim.",
                ],
                "evidenceSummary": "A security publisher described a focused credential-handling concern.",
                "recommendation": "select",
            },
            4,
        )

        self.assertEqual(result["score"]["total"], 5)
        self.assertEqual(result["recommendedRejectionReason"], "below-importance-threshold")

    def test_non_substantive_below_threshold_result_becomes_no_material_change(self) -> None:
        result = MODULE.validate_event_review(
            {
                "ref": 5,
                "substantiveChange": False,
                "scores": {"reach": 1, "magnitude": 1, "practicalValue": 2, "evidence": 1},
                "scoreRationale": (
                    "Reach is limited to a focused legal audience. "
                    "Magnitude is low because no product changed. "
                    "Practical value is moderate for forensic reviews. "
                    "Evidence is supported by a direct legal publication."
                ),
                "evidenceSummary": "The article is analysis and does not identify a new product or policy stage.",
                "recommendation": "below-importance-threshold",
            },
            5,
        )

        self.assertEqual(result["recommendedRejectionReason"], "no-material-change")

    def test_non_substantive_event_has_zero_normalized_magnitude(self) -> None:
        result = MODULE.validate_event_review(
            {
                "ref": 6,
                "substantiveChange": False,
                "scores": {"reach": 2, "magnitude": 1, "practicalValue": 2, "evidence": 1},
                "scoreRationale": [
                    "The commentary appeared in a broadly read publication.",
                    "The item itself describes no new product or policy stage.",
                    "The discussion has some practical consumer relevance.",
                    "A direct publication supports the existence of the commentary.",
                ],
                "evidenceSummary": "The direct article is commentary without a new underlying event stage.",
                "recommendation": "no-material-change",
            },
            6,
        )

        self.assertEqual(result["score"]["magnitude"], 0)
        self.assertEqual(result["score"]["practicalValue"], 0)
        self.assertEqual(result["score"]["total"], 3)

    def test_short_component_reason_is_grounded_with_event_summary(self) -> None:
        result = MODULE.validate_event_review(
            {
                "ref": 7,
                "substantiveChange": False,
                "scores": {"reach": 1, "magnitude": 1, "practicalValue": 1, "evidence": 1},
                "scoreRationale": [
                    "Niche audience",
                    "Low",
                    "Low for AI",
                    "Trade report",
                ],
                "evidenceSummary": "A trade publication reported insurance limits for new AI data centers.",
                "recommendation": "no-material-change",
            },
            7,
        )

        self.assertIn("insurance limits", result["scoreRationale"]["magnitude"])

    def test_evidenced_threshold_score_overrides_below_threshold_label(self) -> None:
        result = MODULE.validate_event_review(
            {
                "ref": 8,
                "substantiveChange": True,
                "scores": {"reach": 1, "magnitude": 2, "practicalValue": 2, "evidence": 1},
                "scoreRationale": [
                    "The event reaches a focused regional business audience.",
                    "It is a distinct but moderate new platform launch.",
                    "The product has practical value for marketing teams.",
                    "A direct regional publisher verifies the launch stage.",
                ],
                "evidenceSummary": "A regional publisher verified a distinct in-window platform launch.",
                "recommendation": "below-importance-threshold",
            },
            8,
        )

        self.assertEqual(result["recommendedDisposition"], "selected")

    def test_substantive_low_score_cannot_be_no_material_change(self) -> None:
        result = MODULE.validate_event_review(
            {
                "ref": 9,
                "substantiveChange": True,
                "scores": {"reach": 1, "magnitude": 1, "practicalValue": 1, "evidence": 1},
                "scoreRationale": [
                    "The financing reaches a focused developer-tool audience.",
                    "The funding round is a modest company-level change.",
                    "It has limited immediate value for general users.",
                    "One direct business publisher supports the funding report.",
                ],
                "evidenceSummary": "A business publisher reported a distinct but modest startup funding round.",
                "recommendation": "no-material-change",
            },
            9,
        )

        self.assertEqual(result["recommendedRejectionReason"], "below-importance-threshold")

    def test_missing_score_object_can_use_four_explicit_labeled_numbers(self) -> None:
        result = MODULE.validate_event_review(
            {
                "ref": 10,
                "substantiveChange": False,
                "scoreRationale": (
                    "Reach is 1 for a regional audience. "
                    "Magnitude is 1 for a research note. "
                    "Practical value is 1 for specialists. "
                    "Evidence is 1 from a trade publication."
                ),
                "evidenceSummary": "A trade publication covered a regional specialist research note.",
                "recommendation": "no-material-change",
            },
            10,
        )

        self.assertEqual(result["score"]["reach"], 1)
        self.assertEqual(result["score"]["total"], 2)

    def test_insufficient_evidence_cannot_retain_high_practical_score(self) -> None:
        result = MODULE.validate_event_review(
            {
                "ref": 11,
                "substantiveChange": True,
                "scores": {"reach": 2, "magnitude": 2, "practicalValue": 3, "evidence": 0},
                "scoreRationale": [
                    "The claimed pricing change would affect a global audience.",
                    "The alleged price shift would be material if verified.",
                    "Developers could change usage if the claim were confirmed.",
                    "No reliable direct source verifies this specific pricing claim.",
                ],
                "evidenceSummary": "The pricing claim lacks any reliable direct source in the exact window.",
                "recommendation": "insufficient-evidence",
            },
            11,
        )

        self.assertEqual(result["score"]["evidence"], 0)
        self.assertLessEqual(result["score"]["total"], 5)

    def test_event_groups_cover_rss_signal_and_semantic_protected_candidates(self) -> None:
        items = [
            {"id": "rss", "sourceType": "rss", "editorialSignals": []},
            {
                "id": "signal",
                "sourceType": "google_news",
                "editorialSignals": ["major-model-product-change"],
            },
            {"id": "semantic", "sourceType": "google_news", "editorialSignals": []},
            {"id": "other", "sourceType": "google_news", "editorialSignals": []},
        ]
        decisions = {
            "rss": {
                "topicKey": "rss-event",
                "eventStage": "release",
                "editorialClass": "other",
            },
            "signal": {
                "topicKey": "signal-event",
                "eventStage": "release",
                "editorialClass": "major-model-product",
            },
            "semantic": {
                "topicKey": "semantic-event",
                "eventStage": "tool-release",
                "editorialClass": "developer-tool",
            },
            "other": {
                "topicKey": "unrelated",
                "eventStage": "commentary",
                "editorialClass": "other",
            },
        }

        covered = {
            candidate_id
            for group in MODULE.build_event_groups(items, decisions)
            for candidate_id in group["candidateIds"]
        }

        self.assertEqual(covered, {"rss", "signal", "semantic"})

    def test_recent_event_ledger_only_reads_earlier_selected_stages(self) -> None:
        current = Path("runs/run-current")
        earlier_run = Path("runs/run-earlier/daily_run.json")
        prior = {
            "reportDate": "2026-08-13",
            "candidates": [
                {
                    "selected": True,
                    "eventKey": "deepseek-v4-pro",
                    "eventStage": "model-release",
                },
                {
                    "selected": False,
                    "eventKey": "ignored",
                    "eventStage": "rumor",
                },
            ],
        }
        with (
            patch.object(Path, "glob", return_value=[earlier_run]),
            patch.object(MODULE, "read_json", return_value=prior),
        ):
            result = MODULE.load_recent_published_events(current, "2026-08-14")

        self.assertEqual(
            result,
            [
                {
                    "reportDate": "2026-08-13",
                    "eventKey": "deepseek-v4-pro",
                    "eventStage": "model-release",
                    "storyKey": "",
                    "summary": "",
                }
            ],
        )


if __name__ == "__main__":
    unittest.main()
