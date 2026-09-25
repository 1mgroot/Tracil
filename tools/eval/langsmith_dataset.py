#!/usr/bin/env python3
"""Local-only LangSmith example export. No Client, uploads, credentials or model calls."""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import sys
from uuid import NAMESPACE_URL, UUID, uuid5

try:
    from . import dataset_tool as dataset
except ImportError:
    import dataset_tool as dataset

ADAPTER_VERSION = "tracil-langsmith-v1"
SDK_VERSION = "0.12.4"  # Existing backend requirements lock; no dependency change.


def project_example(inp, ref, manifest, manifest_hash):
    """Map one canonical case to Client.create_examples(examples=[...]) fields."""
    dataset.check_pair(inp, ref)
    sources = {s["source_id"]: s["sha256"] for s in manifest["sources"]}
    cid = inp["case_id"]
    return {
        "id": str(uuid5(NAMESPACE_URL, f"urn:tracil:eval:{ADAPTER_VERSION}:{manifest_hash}:{cid}")),
        "inputs": {
            "case_id": cid,
            "request": inp["request"],
            "source_bundle_id": inp["split_group"],
            "source_ids": inp["source_ids"],
            "source_hashes": {sid: sources[sid] for sid in inp["source_ids"]},
        },
        # LangSmith outputs is a dict even when our answer is a list or scalar.
        # It becomes reference_outputs in the evaluator, never target inputs.
        "outputs": {
            "answer": ref["expected_output"],
            "evidence": ref["evidence"],
            "grading": ref["grading"],
            "notes": ref["notes"],
        },
        "metadata": {
            "case_id": cid, "category": inp["category"], "task_type": inp["task_type"],
            "split_group": inp["split_group"], "variant_group": inp["variant_group"],
            "dataset_version": manifest["dataset_version"], "dataset_manifest_sha256": manifest_hash,
            "adapter_version": ADAPTER_VERSION, "review": ref["review"],
            "requirement_ids": ref["requirement_ids"],
        },
        "split": inp["split"],
    }


def expected_examples(bundle):
    dataset.validate(bundle)
    manifest = dataset.read_json(bundle / "manifest.json")
    manifest_hash = dataset.digest(bundle / "manifest.json")
    return {
        category: [project_example(inp, ref, manifest, manifest_hash) for inp, ref in zip(
            dataset.read_lines(bundle / "inputs" / f"{category}.jsonl"),
            dataset.read_lines(bundle / "references" / f"{category}.jsonl"))]
        for category in dataset.CATEGORIES
    }


def export_examples(bundle):
    examples = expected_examples(bundle)
    root = bundle / "exports" / "langsmith"
    root.mkdir(parents=True, exist_ok=True)
    manifest_hash = dataset.digest(bundle / "manifest.json")
    files = {}
    for category, rows in examples.items():
        name = f"{category}.examples.jsonl"
        path = root / name
        path.write_text("".join(json.dumps(row, ensure_ascii=False, allow_nan=False) + "\n" for row in rows), encoding="utf-8")
        files[category] = {
            "file": name, "count": len(rows), "sha256": dataset.digest(path),
            "dataset_name": f"tracil-candidate-{category}-{manifest_hash[:12]}",
            "local_dataset_id": str(uuid5(NAMESPACE_URL, f"urn:tracil:dataset:{ADAPTER_VERSION}:{manifest_hash}:{category}")),
        }
    dataset.write_json(root / "export-manifest.json", {
        "adapter_version": ADAPTER_VERSION, "sdk_version_in_repository_lock": SDK_VERSION,
        "canonical_manifest_sha256": manifest_hash, "format": "LangSmith CreateExample JSONL",
        "split": "dev", "contains_reference_answers": True, "upload_performed": False,
        "files": files,
        "documentation": ["https://docs.langchain.com/langsmith/manage-datasets-programmatically",
                          "https://docs.langchain.com/langsmith/local"],
    })
    return verify_export(bundle)


def verify_export(bundle):
    expected = expected_examples(bundle)
    root = bundle / "exports" / "langsmith"
    manifest = dataset.read_json(root / "export-manifest.json")
    dataset.require(manifest["adapter_version"] == ADAPTER_VERSION, "adapter version mismatch")
    dataset.require(manifest["canonical_manifest_sha256"] == dataset.digest(bundle / "manifest.json"), "stale export")
    dataset.require(set(manifest["files"]) == set(dataset.CATEGORIES), "export category mismatch")
    ids = set()
    for category, expected_rows in expected.items():
        spec = manifest["files"][category]
        snapshot = manifest["canonical_manifest_sha256"]
        expected_id = str(uuid5(NAMESPACE_URL, f"urn:tracil:dataset:{ADAPTER_VERSION}:{snapshot}:{category}"))
        dataset.require(spec["local_dataset_id"] == expected_id, "local dataset ID mismatch")
        dataset.require(spec["dataset_name"] == f"tracil-candidate-{category}-{snapshot[:12]}", "dataset name mismatch")
        dataset.require(spec["file"] == f"{category}.examples.jsonl", "unexpected export path")
        path = root / spec["file"]
        dataset.require(dataset.digest(path) == spec["sha256"], "export hash mismatch")
        actual = dataset.read_lines(path)
        dataset.require(len(actual) == spec["count"], "export count mismatch")
        dataset.require(dataset.canonical(actual) == dataset.canonical(expected_rows), "lossy or modified export")
        for row in actual:
            UUID(row["id"])
            dataset.require(row["id"] not in ids, "duplicate example ID")
            ids.add(row["id"])
    return {"result": "pass", "examples": len(ids),
            "counts": {category: len(rows) for category, rows in expected.items()},
            "checks": "canonical round-trip, input/reference separation, hashes, UUIDs and create-example field mapping",
            "sdk_import_tested": False, "cloud_upload_performed": False, "application_evaluated": False}


def load_create_examples(bundle, category):
    """Return native bulk-create dictionaries. The caller owns any cloud action."""
    dataset.require(category in dataset.CATEGORIES, "select deterministic or semantic")
    verify_export(bundle)
    return dataset.read_lines(bundle / "exports" / "langsmith" / f"{category}.examples.jsonl")


def load_local_examples(bundle, category):
    """Create SDK Example objects for evaluate(data=..., upload_results=False)."""
    rows = load_create_examples(bundle, category)
    from langsmith.schemas import Example  # Optional SDK; no network or Client here.
    manifest = dataset.read_json(bundle / "exports" / "langsmith" / "export-manifest.json")
    local_id = UUID(manifest["files"][category]["local_dataset_id"])
    # Stable placeholder for an offline object, not a claim about authoring time.
    created_at = datetime(1970, 1, 1, tzinfo=timezone.utc)
    return [Example(id=UUID(row["id"]), dataset_id=local_id, created_at=created_at,
                    inputs=row["inputs"], outputs=row["outputs"],
                    metadata={**row["metadata"], "dataset_split": [row["split"]]}) for row in rows]


def exact_json_evaluator(outputs, reference_outputs):
    """LangSmith code-evaluator signature; use with the deterministic dataset only."""
    dataset.require(reference_outputs["grading"]["method"] == "exact_json", "semantic cases require rubric review")
    dataset.require("answer" in reference_outputs, "missing reference answer")
    valid = isinstance(outputs, dict) and "answer" in outputs
    try:
        passed = valid and dataset.canonical(outputs["answer"]) == dataset.canonical(reference_outputs["answer"])
    except (TypeError, ValueError):
        passed = False
    return {"key": "candidate_exact_json", "score": int(passed)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("export", "verify"))
    parser.add_argument("--bundle", type=Path, default=Path("local-test-data/eval-v0"))
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()
    try:
        result = export_examples(args.bundle) if args.command == "export" else verify_export(args.bundle)
        if args.report:
            dataset.write_json(args.report, result)
        print(json.dumps(result, ensure_ascii=False, indent=2))
    except (KeyError, ValueError, TypeError, OSError) as error:
        print(f"FAILED: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
