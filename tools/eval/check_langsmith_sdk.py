#!/usr/bin/env python3
"""Verify pinned SDK consumption locally; evaluate only two synthetic examples."""
import argparse
from contextlib import ExitStack
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import socket
from unittest.mock import patch
from uuid import uuid4

try:
    from . import dataset_tool as dataset
    from . import langsmith_dataset as adapter
except ImportError:
    import dataset_tool as dataset
    import langsmith_dataset as adapter


def check(bundle):
    import langsmith
    from langsmith import Client, evaluate
    from langsmith.schemas import Example, ExampleCreate

    dataset.require(langsmith.__version__ == adapter.SDK_VERSION, "use the repository-pinned SDK version")
    attempts = []

    def no_network(*args, **kwargs):
        attempts.append("blocked")
        raise RuntimeError("SDK consumption check forbids network")

    with ExitStack() as stack:
        stack.enter_context(patch.object(socket.socket, "connect", no_network))
        stack.enter_context(patch.object(socket.socket, "connect_ex", no_network))
        stack.enter_context(patch.object(socket, "create_connection", no_network))
        stack.enter_context(patch.dict(os.environ, {"LANGSMITH_TRACING": "false", "LANGCHAIN_TRACING_V2": "false"}))
        count = 0
        for category in dataset.CATEGORIES:
            rows = adapter.load_create_examples(bundle, category)
            for row in rows:
                obj = ExampleCreate(**row)
                kept = obj.model_dump(mode="json", include=set(row))
                dataset.require(dataset.canonical(kept) == dataset.canonical(row), "SDK altered example fields")
                count += 1
            local = adapter.load_local_examples(bundle, category)
            dataset.require(len(local) == len(rows), "local SDK example count mismatch")
            for row, obj in zip(rows, local):
                dataset.require(isinstance(obj, Example) and str(obj.id) == row["id"], "local SDK type/ID mismatch")
                dataset.require(obj.inputs == row["inputs"] and obj.outputs == row["outputs"], "local SDK data mismatch")

        # This target never receives the study bundle. One intentionally wrong
        # synthetic reference checks that the evaluator can both pass and fail.
        local_id = uuid4()
        synthetic = [Example(id=uuid4(), dataset_id=local_id, inputs={"value": n},
            outputs={"answer": answer, "grading": {"method": "exact_json"}},
            created_at=datetime(1970, 1, 1, tzinfo=timezone.utc)) for n, answer in [(2, 3), (3, 999)]]

        def target(inputs):
            dataset.require(set(inputs) == {"value"}, "unexpected target fields")
            return {"answer": inputs["value"] + 1}

        client = Client(api_url="http://127.0.0.1:9", api_key="synthetic-unused-key", auto_batch_tracing=False)
        try:
            results = list(evaluate(target, data=synthetic, evaluators=[adapter.exact_json_evaluator],
                                    client=client, upload_results=False, max_concurrency=0))
        finally:
            client.close()
        scores = [r["evaluation_results"]["results"][0].score for r in results]
        dataset.require(scores == [1, 0], "synthetic SDK evaluator dispatch failed")
        dataset.require(not attempts, "SDK attempted network access")
    return {"result": "pass", "sdk_version": langsmith.__version__,
            "dataset_manifest_sha256": dataset.digest(bundle / "manifest.json"),
            "native_example_create_validated": count, "local_example_objects_validated": count,
            "synthetic_runner_cases": 2, "synthetic_expected_scores": scores, "network_attempts": len(attempts),
            "cloud_upload_performed": False, "study_application_runs": 0, "model_calls": 0,
            "note": "SDK format/dispatch verification only; synthetic scores are not Tracil quality scores"}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bundle", type=Path, default=Path("local-test-data/eval-v0"))
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()
    result = check(args.bundle)
    if args.report:
        dataset.write_json(args.report, result)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
