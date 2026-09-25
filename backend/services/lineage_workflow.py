"""Request orchestration only; evidence and model work stay in legacy builders."""

from copy import deepcopy
from pathlib import Path
from typing import Any, Callable, Literal, NotRequired, Protocol, TypedDict, cast

from langgraph.graph import END, START, StateGraph
from langgraph.graph.state import CompiledStateGraph

FilesContext = list[dict[str, Any]]
ResolvedTarget = tuple[str, str] | None
BuilderKind = Literal["variable", "endpoint", "table", "unresolved"]


class LineageResult(TypedDict):
    # Legacy nodes/edges have varying optional properties. Do not coerce them.
    nodes: list[dict[str, Any]]
    edges: list[dict[str, Any]]
    gaps: list[str | dict[str, Any]]


class LineageResponse(TypedDict):
    variable: str
    dataset: str
    summary: str
    lineage: LineageResult


class LineageRequest(TypedDict):
    dataset: str
    variable: str
    files: NotRequired[FilesContext]


class WorkflowState(TypedDict):
    original_dataset: str
    original_variable: str
    files_ctx: FilesContext
    resolved_dataset: NotRequired[str]
    resolved_variable: NotRequired[str]
    builder_kind: NotRequired[BuilderKind]
    response: NotRequired[LineageResponse]


class VariableBuilder(Protocol):
    def __call__(
        self, *, dataset: str, variable: str, files_ctx: FilesContext
    ) -> LineageResponse: ...


class EndpointBuilder(Protocol):
    def __call__(
        self, *, endpoint_term: str, files_ctx: FilesContext
    ) -> LineageResponse: ...


class TableBuilder(Protocol):
    def __call__(
        self, *, display_spec: str, files_ctx: FilesContext
    ) -> LineageResponse: ...


def create_lineage_workflow(
    *,
    normalize_freeform: Callable[[str], ResolvedTarget],
    normalize_cell: Callable[[str, Path | None], ResolvedTarget],
    latest_session: Callable[[], Path | None],
    variable_builder: VariableBuilder,
    endpoint_builder: EndpointBuilder,
    table_builder: TableBuilder,
    prune: Callable[[LineageResponse], LineageResponse],
) -> CompiledStateGraph:
    """Compile once with services only; every invocation supplies fresh state."""

    def resolve_request(state: WorkflowState) -> dict[str, Any]:
        ds = state["original_dataset"].strip()
        var = state["original_variable"].strip()
        if not ds:
            routed = normalize_freeform(var)
            if not routed:
                routed = normalize_cell(var, latest_session())
            if not routed:
                return {
                    "builder_kind": "unresolved",
                    "response": {
                        "variable": state["original_variable"],
                        "dataset": state["original_dataset"],
                        "summary": "",
                        "lineage": {
                            "nodes": [
                                {
                                    "id": f"{ds}.{var}".lower() or "target",
                                    "type": "target",
                                    "explanation": "[general] Could not classify the freeform request into a dataset/variable.",
                                }
                            ],
                            "edges": [],
                            "gaps": [
                                "Freeform router could not determine dataset/variable; please reference a table id (e.g., 'table ars_vs_t01'), an ADaM/SDTM variable (e.g., 'ADSL.AGE' or 'DM.BRTHDTC'), or an endpoint description."
                            ],
                        },
                    },
                }
            ds, var = routed

        kind: BuilderKind = "variable"
        if ds.lower() in {"endpoint", "protocol", "soa"}:
            kind = "endpoint"
        elif ds.lower() in {"table", "tlf", "display"}:
            kind = "table"
        return {"resolved_dataset": ds, "resolved_variable": var, "builder_kind": kind}

    def legacy_variable(state: WorkflowState) -> dict[str, Any]:
        return {
            "response": variable_builder(
                dataset=state["resolved_dataset"],
                variable=state["resolved_variable"],
                files_ctx=state["files_ctx"],
            )
        }

    def legacy_endpoint(state: WorkflowState) -> dict[str, Any]:
        return {
            "response": endpoint_builder(
                endpoint_term=state["resolved_variable"], files_ctx=state["files_ctx"]
            )
        }

    def legacy_table(state: WorkflowState) -> dict[str, Any]:
        return {
            "response": table_builder(
                display_spec=state["resolved_variable"], files_ctx=state["files_ctx"]
            )
        }

    def finalize_response(state: WorkflowState) -> dict[str, Any]:
        return {"response": prune(state["response"])}

    def select_builder(state: WorkflowState) -> BuilderKind:
        return state["builder_kind"]

    graph = StateGraph(WorkflowState)
    graph.add_node("resolve_request", resolve_request)
    graph.add_node("legacy_variable", legacy_variable)
    graph.add_node("legacy_endpoint", legacy_endpoint)
    graph.add_node("legacy_table", legacy_table)
    graph.add_node("finalize_response", finalize_response)
    graph.add_edge(START, "resolve_request")
    graph.add_conditional_edges(
        "resolve_request",
        select_builder,
        {
            "unresolved": END,
            "variable": "legacy_variable",
            "endpoint": "legacy_endpoint",
            "table": "legacy_table",
        },
    )
    for node in ("legacy_variable", "legacy_endpoint", "legacy_table"):
        graph.add_edge(node, "finalize_response")
    graph.add_edge("finalize_response", END)
    return graph.compile()


def invoke_lineage_workflow(
    workflow: CompiledStateGraph, request: LineageRequest
) -> LineageResponse:
    """Invoke once, returning only the legacy envelope; errors belong to the API."""
    state: WorkflowState = {
        "original_dataset": request["dataset"],
        "original_variable": request["variable"],
        "files_ctx": deepcopy(request.get("files", [])),
    }
    return cast(LineageResponse, workflow.invoke(state)["response"])
