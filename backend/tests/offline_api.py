"""Explicit local UI harness: python -m tests.offline_api (never main:app)."""

import argparse
import json
from contextlib import contextmanager
from copy import deepcopy
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Iterator, cast
from unittest.mock import patch

import httpx
import uvicorn
from fastapi import FastAPI
from langgraph.graph.state import CompiledStateGraph

import main
from services.lineage_workflow import (
    FilesContext,
    LineageResponse,
    ResolvedTarget,
    create_lineage_workflow,
)

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "lineage_response.json"
# These are named scenarios, deliberately not a second natural-language router.
SCENARIOS = {
    "offline variable": ("ADTEST", "SYNTHETIC_VALUE"),
    "offline endpoint": ("Protocol", "SYNTHETIC_ENDPOINT"),
    "offline table": ("TLF", "SYNTHETIC_TABLE"),
    "offline cell": ("TLF", "SYNTHETIC_TABLE|ROW|COLUMN|VALUE"),
    "offline error": ("ADSL", "__OFFLINE_ERROR__"),
}


def create_offline_workflow(evidence_fixture: Path | None = None) -> CompiledStateGraph:
    evidence = json.loads(evidence_fixture.read_text()) if evidence_fixture else None
    evidence_routes = {}
    if evidence is not None:
        for entry in evidence.get("responses", [evidence]):
            for node in entry["lineage"]["nodes"]:
                if node["type"] in {"adam variable", "sdtm variable"}:
                    dataset, variable = node["id"].split(".", 1)
                    evidence_routes[(dataset.upper(), variable.upper())] = entry
                elif node["type"] in {"tlf display", "tlf cell"}:
                    evidence_routes[("TABLE", node["id"].split(".", 1)[0].upper())] = (
                        entry
                    )
    template = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))

    def response(dataset: str, variable: str, kind: str) -> LineageResponse:
        if variable == "__OFFLINE_ERROR__":
            raise RuntimeError("OFFLINE FIXTURE: intentional builder failure")
        if evidence is not None:
            key = (dataset.upper(), variable.upper())
            if key not in evidence_routes:
                raise ValueError(
                    "Evidence fixture only covers "
                    + ", ".join(".".join(k) for k in evidence_routes)
                )
            result = deepcopy(evidence_routes[key])
            result.update(dataset=dataset, variable=variable)
            return cast(LineageResponse, result)
        result = deepcopy(template)
        result.update(dataset=dataset, variable=variable)
        result["lineage"]["nodes"][1].update(
            type=kind, label=f"[SYNTHETIC] {dataset}.{variable}"
        )
        return cast(LineageResponse, result)

    def variable_builder(
        *, dataset: str, variable: str, files_ctx: FilesContext
    ) -> LineageResponse:
        return response(dataset, variable, "adam variable")

    def endpoint_builder(
        *, endpoint_term: str, files_ctx: FilesContext
    ) -> LineageResponse:
        return response("endpoint", endpoint_term, "protocol endpoint")

    def table_builder(*, display_spec: str, files_ctx: FilesContext) -> LineageResponse:
        return response(
            "table", display_spec, "tlf cell" if "|" in display_spec else "tlf display"
        )

    def normalize_freeform(query: str) -> ResolvedTarget:
        if evidence is not None:
            return {".".join(key).casefold(): key for key in evidence_routes}.get(
                query.casefold()
            )
        return SCENARIOS.get(query.casefold())

    return create_lineage_workflow(
        normalize_freeform=normalize_freeform,
        normalize_cell=lambda query, session: None,
        latest_session=lambda: None,
        variable_builder=variable_builder,
        endpoint_builder=endpoint_builder,
        table_builder=table_builder,
        prune=main.prune_orphan_near_duplicates,
    )


@contextmanager
def offline_api(evidence_fixture: Path | None = None) -> Iterator[FastAPI]:
    """Scoped test replacement; imports alone do not alter the real application.

    Keep the real HTTP handler, workflow, pruning and upload parsers. Substitute
    only the injected resolution/builders. Restore everything when leaving.
    Upload output is temporary and cannot become the real latest session.
    """
    with (
        patch.dict(
            "os.environ",
            {"LANGSMITH_TRACING": "false", "LANGCHAIN_TRACING_V2": "false"},
        ),
        TemporaryDirectory(prefix="tracil-offline-") as output,
        patch.object(
            main, "lineage_workflow", create_offline_workflow(evidence_fixture)
        ),
        patch.object(main, "OUTPUT", Path(output)),
        patch.object(
            main.app,
            "title",
            (
                "Tracil OFFLINE — evidence fixtures"
                if evidence_fixture
                else "Tracil OFFLINE — synthetic fixtures only"
            ),
        ),
        patch.object(
            httpx.HTTPTransport,
            "handle_request",
            side_effect=RuntimeError("OFFLINE mode blocks outbound HTTP/model calls"),
        ),
        patch.object(
            httpx.AsyncHTTPTransport,
            "handle_async_request",
            side_effect=RuntimeError("OFFLINE mode blocks outbound HTTP/model calls"),
        ),
    ):
        yield main.app


if __name__ == "__main__":
    print("OFFLINE FIXTURES ONLY — no clinical inference, no model calls.", flush=True)
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--evidence-fixture",
        type=Path,
        help="Locally generated, source-backed response JSON",
    )
    args = parser.parse_args()
    with offline_api(args.evidence_fixture) as app:
        uvicorn.run(app, host="127.0.0.1", port=8001)
