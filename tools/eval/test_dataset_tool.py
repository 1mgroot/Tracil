"""Synthetic guard tests for the offline verifier; these are not application evals."""
import copy
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import dataset_tool as tool


class DatasetToolGuards(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.source = self.root / "data.json"
        self.source.write_text('{"a/b":{"~field":[true,"literal evidence"]}}')
        self.manifest = {"sources": [{"source_id": "usdm", "file": "data.json",
            "sha256": tool.digest(self.source), "bytes": self.source.stat().st_size}]}

    def test_hash_tamper_rejected(self):
        self.source.write_text('{"changed":true}')
        with self.assertRaisesRegex(ValueError, "hash mismatch"):
            tool.Sources(self.root, self.manifest)

    def test_json_pointer_escape_and_type(self):
        sources = tool.Sources(self.root, self.manifest)
        ev = {"source_id": "usdm", "locator": {"type": "json_pointer", "pointer": "/a~1b/~0field/0"},
              "excerpt": "true", "rationale": "synthetic"}
        sources.evidence(ev)
        ev["excerpt"] = "1"
        with self.assertRaisesRegex(ValueError, "value mismatch"):
            sources.evidence(ev)

    def test_wrong_excerpt_rejected(self):
        with self.assertRaisesRegex(ValueError, "not found"):
            tool.Sources(self.root, self.manifest).evidence({"source_id": "usdm",
                "locator": {"type": "json_pointer", "pointer": "/a~1b/~0field/1"},
                "excerpt": "invented evidence", "rationale": "synthetic"})

    def test_nonunique_xml_locator_rejected(self):
        path = self.root / "data.xml"
        path.write_text('<ODM xmlns="http://www.cdisc.org/ns/odm/v1.2"><ItemDef OID="X"/><ItemDef OID="X"/></ODM>')
        manifest = {"sources": [{"source_id": "define_adam", "file": path.name,
            "sha256": tool.digest(path), "bytes": path.stat().st_size}]}
        with self.assertRaisesRegex(ValueError, "one node"):
            tool.Sources(self.root, manifest).evidence({"source_id": "define_adam",
                "locator": {"type": "xml_xpath", "path": ".//odm:ItemDef[@OID='X']", "attribute": "OID"},
                "excerpt": "X", "rationale": "synthetic"})

    def test_blank_literal_is_exact_and_not_empty_substring(self):
        path = self.root / "data.xml"
        path.write_text('<ODM><Item Comment=" " Name="X">nonempty</Item></ODM>')
        manifest = {"sources": [{"source_id": "define_adam", "file": path.name,
            "sha256": tool.digest(path), "bytes": path.stat().st_size}]}
        sources = tool.Sources(self.root, manifest)
        ev = {"source_id": "define_adam", "locator": {"type": "xml_xpath", "path": "./Item", "attribute": "Comment"},
              "excerpt": " ", "rationale": "explicit whitespace fact"}
        sources.evidence(ev)
        ev["excerpt"] = ""
        with self.assertRaisesRegex(ValueError, "empty evidence"):
            sources.evidence(ev)
        del ev["locator"]["attribute"]
        with self.assertRaisesRegex(ValueError, "empty evidence"):
            sources.evidence(ev)

    def test_escape_source_root_rejected(self):
        manifest = copy.deepcopy(self.manifest)
        manifest["sources"][0]["file"] = "../outside.json"
        with self.assertRaisesRegex(ValueError, "escapes bundle"):
            tool.Sources(self.root, manifest)

    def test_missing_predictions_remain_in_denominator(self):
        refs = self.root / "references"
        refs.mkdir()
        (refs / "deterministic.jsonl").write_text('\n'.join(json.dumps(r) for r in [
            {"case_id": "a", "expected_output": {"x": 1, "y": True}},
            {"case_id": "b", "expected_output": "missing"}]))
        predictions = self.root / "predictions.jsonl"
        predictions.write_text('{"case_id":"a","output":{"y":true,"x":1}}\n')
        with patch.object(tool, "validate", return_value={}):
            result = tool.score(self.root, predictions)
        self.assertEqual((result["passed"], result["total"], result["missing"], result["score"]), (1, 2, 1, 0.5))
        predictions.write_text('{"case_id":"a","output":{"x":1,"y":1}}\n')
        with patch.object(tool, "validate", return_value={}):
            self.assertEqual(tool.score(self.root, predictions)["passed"], 0)

    def test_duplicate_predictions_rejected(self):
        refs = self.root / "references"
        refs.mkdir()
        (refs / "deterministic.jsonl").write_text('{"case_id":"a","expected_output":1}\n')
        predictions = self.root / "predictions.jsonl"
        predictions.write_text('{"case_id":"a","output":1}\n' * 2)
        with patch.object(tool, "validate", return_value={}):
            with self.assertRaisesRegex(ValueError, "duplicate"):
                tool.score(self.root, predictions)

    def test_canonical_arrays_and_boolean(self):
        self.assertNotEqual(tool.canonical(True), tool.canonical(1))
        self.assertNotEqual(tool.canonical([1, 2]), tool.canonical([2, 1]))
        self.assertEqual(tool.canonical({"b": 2, "a": 1}), tool.canonical({"a": 1, "b": 2}))


if __name__ == "__main__":
    unittest.main()
