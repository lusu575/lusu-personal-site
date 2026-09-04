from __future__ import annotations

import copy
import importlib.util
import unittest
from pathlib import Path
from unittest.mock import patch


MODULE_PATH = Path(__file__).with_name("codex-editorial-review.py")
SPEC = importlib.util.spec_from_file_location("codex_editorial_review", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(MODULE)


class CodexEditorialReviewTests(unittest.TestCase):
    def candidate(self, candidate_id: str, **values):
        return {
            "id": candidate_id,
            "title": values.pop("title", "Generic weekly roundup"),
            "url": values.pop("url", "https://news.google.com/articles/example"),
            "sourceType": values.pop("sourceType", "google-news"),
            "sourceName": "Example",
            "publishedAt": values.pop("publishedAt", "2026-08-28T12:00:00Z"),
            "queryIds": [],
            "coverageGroups": [],
            "editorialSignals": values.pop("editorialSignals", []),
            **values,
        }

    def fixture(self):
        items = [
            self.candidate("low"),
            self.candidate(
                "signal",
                title="OpenAI launches a new coding agent",
                editorialSignals=["developer-tool-change"],
            ),
            self.candidate(
                "direct",
                title="Qwen releases open weights for a new model",
                url="https://qwen.example/releases/model",
                sourceType="official",
            ),
        ]
        manifest = {
            "reportDate": "2026-08-29",
            "windowStart": "2026-08-28T07:00:00+08:00",
            "windowEnd": "2026-08-29T07:00:00+08:00",
            "candidateIndexSha256": "a" * 64,
        }
        return Path("candidate_index.json"), manifest, {"items": items}, items

    def valid_finalize_response(self):
        score = {
            "reach": 1,
            "magnitude": 1,
            "practicalValue": 1,
            "evidence": 2,
            "total": 5,
        }
        return {
            "schemaVersion": 1,
            "candidateIndexSha256": "",
            "reviewer": {"provider": "codex-task", "model": "test-codex"},
            "completedAt": "2026-08-29T23:10:00Z",
            "decisions": [{
                "ref": 1,
                "editorialClass": "major-tech-finance",
                "eventKey": "example-acquisition",
                "eventStage": "acquisition-talks",
                "status": "confirmed",
                "substantiveChange": False,
                "score": score,
                "note": "The report repeats an already reviewed acquisition discussion without a new signed transaction.",
                "recommendedRejectionReason": "no-material-change",
                "recommendedDisposition": "rejected",
            }],
            "events": [{
                "eventKey": "example-acquisition",
                "eventStage": "acquisition-talks",
                "refs": [1],
                "editorialClass": "major-tech-finance",
                "substantiveChange": False,
                "reliableSourceUrls": ["https://example.com/reliable-report"],
                "firstReliablePublishedAt": "2026-08-29T12:00:00Z",
                "evidenceSummary": "A direct report exists inside the exact window but adds no signed or completed acquisition stage.",
                "score": score,
                "scoreRationale": {
                    "reach": "The companies have a meaningful but bounded market audience.",
                    "magnitude": "No completed transaction or newly signed agreement was reported.",
                    "practicalValue": "Readers receive little new actionable information from the repeat.",
                    "evidence": "A reliable direct report establishes timing and the unchanged stage.",
                },
                "recommendedDisposition": "rejected",
                "recommendedRejectionReason": "no-material-change",
            }],
        }

    def run_finalize(self, response):
        digest = "b" * 64
        candidate = self.candidate(
            "signal",
            title="A company remains in acquisition talks",
            editorialSignals=["major-tech-finance-change"],
        )
        index = {"schemaVersion": 1, "items": [candidate]}
        manifest = {
            "reportDate": "2026-08-30",
            "windowStart": "2026-08-28T23:00:00Z",
            "windowEnd": "2026-08-29T23:00:00Z",
            "candidateIndexSha256": digest,
        }
        queue = {
            "schemaVersion": 1,
            "candidateIndexSha256": digest,
            "batches": [{"batch": 1, "items": [{
                "ref": 1,
                "candidateIds": ["signal"],
                "editorialSignals": ["major-tech-finance-change"],
                "sourceTypes": ["google-news"],
            }]}],
        }
        prescreen = {
            "schemaVersion": 1,
            "candidateIndexSha256": digest,
            "decisions": [],
        }
        response["candidateIndexSha256"] = digest
        payloads = {
            "codex_editorial_review.queue.json": queue,
            "codex_editorial_review.prescreen.json": prescreen,
            "response.json": response,
        }
        writes = {}
        with patch.object(
            MODULE,
            "load_inputs",
            return_value=(Path("candidate_index.json"), manifest, index, [candidate]),
        ), patch.object(MODULE, "sha256_bytes", return_value=digest), patch.object(
            MODULE,
            "read_json",
            side_effect=lambda path: payloads[path.name],
        ), patch.object(
            MODULE,
            "write_json",
            side_effect=lambda path, value: writes.__setitem__(path.name, value),
        ):
            MODULE.finalize(Path("run"), Path("response.json"))
        return writes["semantic_editorial_review.json"]

    def test_prepare_prescreens_only_objective_low_signal_candidates(self):
        writes = {}
        with patch.object(MODULE, "load_inputs", return_value=self.fixture()), \
                patch.object(MODULE, "sha256_bytes", return_value="a" * 64), \
                patch.object(MODULE, "write_json", side_effect=lambda path, value: writes.__setitem__(path.name, value)):
            MODULE.prepare(Path("run"), 200)
            queue = writes["codex_editorial_review.queue.json"]
            prescreen = writes["codex_editorial_review.prescreen.json"]
            self.assertEqual(queue["candidateCount"], 3)
            self.assertEqual(queue["programmaticDispositionCount"], 1)
            self.assertEqual(queue["codexReviewCandidateCount"], 2)
            self.assertEqual(prescreen["decisions"][0]["candidateId"], "low")
            queued_ids = {
                candidate_id
                for batch in queue["batches"]
                for item in batch["items"]
                for candidate_id in item["candidateIds"]
            }
            self.assertEqual(queued_ids, {"signal", "direct"})
            self.assertTrue(any(
                "scope as additive" in instruction
                and "graphics/GPU" in instruction
                and "applied-AI industry" in instruction
                for instruction in queue["instructions"]
            ))

    def test_signaled_candidate_cannot_be_programmatically_prescreened(self):
        candidate = self.candidate(
            "signal",
            title="Unclear title",
            editorialSignals=["usage-policy-change"],
        )
        start = MODULE.parse_time("2026-08-27T23:00:00Z")
        end = MODULE.parse_time("2026-08-28T23:00:00Z")
        self.assertIsNone(MODULE.prescreen_reason(candidate, start, end))

    def test_public_x_candidate_cannot_be_programmatically_prescreened(self):
        candidate = self.candidate(
            "public-x",
            title="A deliberately vague first-party teaser",
            url="https://x.com/example/status/123",
            sourceType="twitter",
            mustReviewQueryIds=["example-focused-query"],
            mustReviewSourceIds=["public-x-example"],
        )
        start = MODULE.parse_time("2026-08-27T23:00:00Z")
        end = MODULE.parse_time("2026-08-28T23:00:00Z")
        self.assertIsNone(MODULE.prescreen_reason(candidate, start, end))

    def test_prepare_keeps_public_x_review_provenance_in_queue(self):
        public_x = self.candidate(
            "public-x",
            title="A deliberately vague first-party teaser",
            url="https://x.com/example/status/123",
            sourceType="twitter",
            mustReviewQueryIds=["example-focused-query"],
            mustReviewSourceIds=["public-x-example"],
        )
        fixture = self.fixture()
        candidates = [*fixture[3], public_x]
        writes = {}
        with patch.object(
            MODULE,
            "load_inputs",
            return_value=(fixture[0], fixture[1], {"items": candidates}, candidates),
        ), patch.object(MODULE, "sha256_bytes", return_value="a" * 64), patch.object(
            MODULE,
            "write_json",
            side_effect=lambda path, value: writes.__setitem__(path.name, value),
        ):
            MODULE.prepare(Path("run"), 200)
        queued_item = next(
            item
            for batch in writes["codex_editorial_review.queue.json"]["batches"]
            for item in batch["items"]
            if "public-x" in item["candidateIds"]
        )
        self.assertEqual(queued_item["mustReviewQueryIds"], ["example-focused-query"])
        self.assertEqual(queued_item["mustReviewSourceIds"], ["public-x-example"])

    def test_candidate_class_normalization_honors_a_unique_narrower_signal(self):
        self.assertEqual(
            MODULE.normalize_candidate_editorial_class(
                "strategic-hardware-infrastructure",
                ["capability-availability-change"],
                "candidate-capability-only",
            ),
            "capability-availability",
        )

    def test_candidate_class_normalization_fails_closed_on_multiple_choices(self):
        with self.assertRaisesRegex(ValueError, "explicit Codex choice"):
            MODULE.normalize_candidate_editorial_class(
                "strategic-hardware-infrastructure",
                ["major-model-product-change", "capability-availability-change"],
                "candidate-multiple-classes",
            )

    def test_title_signature_groups_exact_cross_source_duplicates(self):
        self.assertEqual(
            MODULE.title_signature("Qwen releases Model X | Example News"),
            MODULE.title_signature("Qwen releases Model X - Another Source"),
        )

    def test_prepare_separates_incompatible_signal_contracts_for_same_title(self):
        candidates = [
            self.candidate(
                "specialized",
                title="Company launches one AI product",
                editorialSignals=[
                    "strategic-hardware-infrastructure-change",
                    "capability-availability-change",
                ],
            ),
            self.candidate(
                "product-choice",
                title="Company launches one AI product",
                editorialSignals=[
                    "major-model-product-change",
                    "capability-availability-change",
                ],
            ),
        ]
        fixture = self.fixture()
        writes = {}
        with patch.object(
            MODULE,
            "load_inputs",
            return_value=(fixture[0], fixture[1], {"items": candidates}, candidates),
        ), patch.object(MODULE, "sha256_bytes", return_value="a" * 64), patch.object(
            MODULE,
            "write_json",
            side_effect=lambda path, value: writes.__setitem__(path.name, value),
        ):
            MODULE.prepare(Path("run"), 200)
        queue_items = [
            item
            for batch in writes["codex_editorial_review.queue.json"]["batches"]
            for item in batch["items"]
        ]
        self.assertEqual(len(queue_items), 2)
        self.assertEqual(
            {tuple(item["candidateIds"]) for item in queue_items},
            {("specialized",), ("product-choice",)},
        )

    def test_finalize_accepts_consistent_signal_event_and_window_contract(self):
        output = self.run_finalize(self.valid_finalize_response())
        self.assertEqual(output["protectedEvents"][0]["status"], "confirmed")
        self.assertEqual(
            output["protectedEvents"][0]["recommendedRejectionReason"],
            "no-material-change",
        )

    def test_finalize_rejects_signal_class_mismatch(self):
        response = self.valid_finalize_response()
        response["decisions"][0]["editorialClass"] = "ai-policy-safety"
        response["events"][0]["editorialClass"] = "ai-policy-safety"
        with self.assertRaisesRegex(ValueError, "conflicts with editorialSignals"):
            self.run_finalize(response)

    def test_finalize_rejects_event_decision_class_mismatch(self):
        response = self.valid_finalize_response()
        response["events"][0]["editorialClass"] = "ai-policy-safety"
        with self.assertRaisesRegex(ValueError, "does not match all member decisions"):
            self.run_finalize(response)

    def test_finalize_rejects_invalid_event_identity_before_assembly(self):
        response = self.valid_finalize_response()
        response["decisions"][0]["eventKey"] = "invalid-trailing-hyphen-"
        response["events"][0]["eventKey"] = "invalid-trailing-hyphen-"
        with self.assertRaisesRegex(ValueError, "valid lowercase internal identifier"):
            self.run_finalize(response)

    def test_finalize_rejects_outside_time_with_no_material_change_reason(self):
        response = self.valid_finalize_response()
        response["events"][0]["firstReliablePublishedAt"] = "2026-08-27T12:00:00Z"
        with self.assertRaisesRegex(ValueError, "must use outside-publication-window"):
            self.run_finalize(response)

    def test_finalize_accepts_explicit_outside_window_rejection(self):
        response = self.valid_finalize_response()
        response["decisions"][0]["recommendedRejectionReason"] = "outside-publication-window"
        response["events"][0]["recommendedRejectionReason"] = "outside-publication-window"
        response["events"][0]["firstReliablePublishedAt"] = "2026-08-27T12:00:00Z"
        output = self.run_finalize(response)
        self.assertEqual(
            output["protectedEvents"][0]["recommendedRejectionReason"],
            "outside-publication-window",
        )

    def test_finalize_applies_five_point_rumor_threshold(self):
        response = copy.deepcopy(self.valid_finalize_response())
        response["decisions"][0]["status"] = "rumor"
        response["decisions"][0]["substantiveChange"] = True
        response["decisions"][0]["recommendedRejectionReason"] = "below-importance-threshold"
        response["events"][0]["substantiveChange"] = True
        response["events"][0]["recommendedRejectionReason"] = "below-importance-threshold"
        with self.assertRaisesRegex(ValueError, "threshold-clearing rumor event"):
            self.run_finalize(response)


if __name__ == "__main__":
    unittest.main()
