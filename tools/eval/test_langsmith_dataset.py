"""Synthetic export/evaluator contracts; no application or external service calls."""
import copy
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from uuid import UUID

import dataset_tool as dataset
import langsmith_dataset as adapter


def pair(category="deterministic"):
    cid = "DET-SYN-001" if category == "deterministic" else "SEM-SYN-001"
    inp = {"case_id": cid, "category": category, "task_type": "exact_extraction",
           "source_ids": ["usdm"], "request": {"question": "Read the requested field.", "output_contract": "Return an array."},
           "split": "dev", "split_group": "supplied_testdata_bundle_01", "variant_group": "synthetic"}
    ref = {"case_id": cid, "expected_output": ["ORACLE_ONLY", True],
           "evidence": [{"source_id": "usdm", "locator": {"type": "json_pointer", "pointer": "/field"},
                         "excerpt": "ORACLE_ONLY", "rationale": "synthetic"}],
           "grading": {"method": "exact_json"} if category == "deterministic" else {
               "method": "rubric", "required_claims": ["ORACLE_ONLY"], "forbidden_claims": ["invented fact"],
               "uncertainty_requirements": ["retain uncertainty"]},
           "review": {"status": "candidate", "clinical_review": "pending", "independent_review": "pending", "author": "test"},
           "requirement_ids": ["EVD-01"], "notes": ["REFERENCE_NOTE_ONLY"]}
    return inp, ref


class LangSmithDatasetContracts(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.bundle = Path(self.temp.name)
        self.manifest = {"dataset_version": "test-candidate", "sources": [{"source_id": "usdm", "sha256": "a" * 64}]}
        dataset.write_json(self.bundle / "manifest.json", self.manifest)
        for category in dataset.CATEGORIES:
            inp, ref = pair(category)
            for folder, value in (("inputs", inp), ("references", ref)):
                path = self.bundle / folder / f"{category}.jsonl"
                path.parent.mkdir(exist_ok=True)
                path.write_text(json.dumps(value) + "\n")

    def test_native_fields_and_no_answer_in_target_inputs(self):
        inp, ref = pair()
        row = adapter.project_example(inp, ref, self.manifest, "snapshot")
        self.assertEqual(set(row), {"id", "inputs", "outputs", "metadata", "split"})
        UUID(row["id"])
        self.assertEqual(row["split"], "dev")
        self.assertEqual(set(row["inputs"]), {"case_id", "request", "source_bundle_id", "source_ids", "source_hashes"})
        self.assertNotIn("ORACLE_ONLY", json.dumps(row["inputs"]))
        self.assertNotIn("REFERENCE_NOTE_ONLY", json.dumps(row["inputs"]))
        self.assertNotIn("REFERENCE_NOTE_ONLY", json.dumps(row["metadata"]))
        self.assertEqual(row["outputs"]["notes"], ["REFERENCE_NOTE_ONLY"])
        self.assertEqual(row["outputs"]["answer"], ["ORACLE_ONLY", True])
        self.assertEqual(row["metadata"]["review"]["clinical_review"], "pending")

    def test_ids_stable_per_snapshot_and_distinct_between_cases(self):
        inp, ref = pair()
        first = adapter.project_example(inp, ref, self.manifest, "snapshot")
        again = adapter.project_example(inp, ref, self.manifest, "snapshot")
        changed = adapter.project_example(inp, ref, self.manifest, "new-snapshot")
        self.assertEqual(first["id"], again["id"])
        self.assertNotEqual(first["id"], changed["id"])
        inp["case_id"] = ref["case_id"] = "DET-SYN-002"
        self.assertNotEqual(first["id"], adapter.project_example(inp, ref, self.manifest, "snapshot")["id"])

    def test_roundtrip_and_tampering(self):
        # Source verifier is covered separately; this tiny fixture tests export packaging.
        with patch.object(dataset, "validate", return_value={}):
            self.assertEqual(adapter.export_examples(self.bundle)["examples"], 2)
            rows = adapter.load_create_examples(self.bundle, "deterministic")
            self.assertEqual(len(rows), 1)
            path = self.bundle / "exports/langsmith/deterministic.examples.jsonl"
            row = copy.deepcopy(rows[0])
            row["inputs"]["leaked_answer"] = "ORACLE_ONLY"
            path.write_text(json.dumps(row) + "\n")
            with self.assertRaisesRegex(ValueError, "hash mismatch"):
                adapter.verify_export(self.bundle)
            manifest_path = self.bundle / "exports/langsmith/export-manifest.json"
            export_manifest = dataset.read_json(manifest_path)
            export_manifest["files"]["deterministic"]["sha256"] = dataset.digest(path)
            dataset.write_json(manifest_path, export_manifest)
            with self.assertRaisesRegex(ValueError, "lossy or modified"):
                adapter.verify_export(self.bundle)

    def test_stale_snapshot_rejected(self):
        with patch.object(dataset, "validate", return_value={}):
            adapter.export_examples(self.bundle)
            self.manifest["dataset_version"] = "next"
            dataset.write_json(self.bundle / "manifest.json", self.manifest)
            with self.assertRaisesRegex(ValueError, "stale export"):
                adapter.verify_export(self.bundle)

    def test_evaluator_missing_error_and_json_types(self):
        reference = {"answer": {"v": True, "items": [1, 2]}, "grading": {"method": "exact_json"}}
        good = {"answer": {"items": [1, 2], "v": True}}
        self.assertEqual(adapter.exact_json_evaluator(good, reference)["score"], 1)
        for bad in (None, {}, {"error": "failed"}, {"answer": {"v": 1, "items": [1, 2]}},
                    {"answer": {"v": True, "items": [2, 1]}}):
            self.assertEqual(adapter.exact_json_evaluator(bad, reference)["score"], 0)

    def test_semantic_does_not_receive_exact_match_score(self):
        with self.assertRaisesRegex(ValueError, "rubric review"):
            adapter.exact_json_evaluator({"answer": "x"}, {"answer": "x", "grading": {"method": "rubric"}})


if __name__ == "__main__":
    unittest.main()
