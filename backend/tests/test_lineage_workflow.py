from copy import deepcopy
from pathlib import Path
from unittest.mock import Mock

import pytest
from fastapi.testclient import TestClient

import main
from services.lineage_workflow import create_lineage_workflow, invoke_lineage_workflow


@pytest.fixture
def services():
    response = {
        "variable": "AGE",
        "dataset": "ADSL",
        "summary": "Legacy summary",
        "lineage": {
            "nodes": [{"id": "b", "optional": [1]}, {"id": "a", "type": "target"}],
            "edges": [{"from": "b", "to": "a", "confidence": 0.8}],
            "gaps": ["string gap", {"reason": "object gap", "nodeId": "a"}],
        },
    }
    return {
        "normalize_freeform": Mock(return_value=None),
        "normalize_cell": Mock(return_value=None),
        "latest_session": Mock(return_value=Path("session")),
        "variable_builder": Mock(return_value=deepcopy(response)),
        "endpoint_builder": Mock(return_value=deepcopy(response)),
        "table_builder": Mock(return_value=deepcopy(response)),
        "prune": Mock(side_effect=lambda result: {**result, "summary": "Pruned"}),
    }


@pytest.mark.parametrize(
    "dataset,variable,kind,kwargs",
    [
        (" ADSL ", " AGE ", "variable", {"dataset": "ADSL", "variable": "AGE"}),
        (" Unknown ", " X ", "variable", {"dataset": "Unknown", "variable": "X"}),
        *[
            (alias, " Primary ", "endpoint", {"endpoint_term": "Primary"})
            for alias in ("endpoint", " SOA ", "Protocol")
        ],
        *[
            (alias, " table_1 ", "table", {"display_spec": "table_1"})
            for alias in ("table", " TLF ", "Display")
        ],
        (
            "TLF",
            " table_1|any flexible cell ",
            "table",
            {"display_spec": "table_1|any flexible cell"},
        ),
    ],
)
def test_routes(services, dataset, variable, kind, kwargs):
    request = {"dataset": dataset, "variable": variable, "files": [{"id": "one"}]}
    original = deepcopy(request)
    graph = create_lineage_workflow(**services)
    result = invoke_lineage_workflow(graph, request)
    for builder in ("variable", "endpoint", "table"):
        spy = services[f"{builder}_builder"]
        if builder == kind:
            spy.assert_called_once_with(**kwargs, files_ctx=request["files"])
            services["prune"].assert_called_once_with(spy.return_value)
            assert result == {**spy.return_value, "summary": "Pruned"}
        else:
            spy.assert_not_called()
    services["normalize_freeform"].assert_not_called()
    services["normalize_cell"].assert_not_called()
    services["latest_session"].assert_not_called()
    assert request == original


@pytest.mark.parametrize("fallback", [False, True])
def test_freeform_preserves_router_output_and_order(services, fallback):
    calls = Mock()
    for name, service in services.items():
        calls.attach_mock(service, name)
    target = ("adam", "ADSL.AGE") if not fallback else ("table", " t01|Mean ")
    services["normalize_cell" if fallback else "normalize_freeform"].return_value = (
        target
    )
    graph = create_lineage_workflow(**services)
    invoke_lineage_workflow(graph, {"dataset": " ", "variable": " query ", "files": []})
    services["normalize_freeform"].assert_called_once_with("query")
    if fallback:
        services["normalize_cell"].assert_called_once_with("query", Path("session"))
        services["table_builder"].assert_called_once_with(
            display_spec=target[1], files_ctx=[]
        )
        services["variable_builder"].assert_not_called()
    else:
        services["normalize_cell"].assert_not_called()
        services["latest_session"].assert_not_called()
        services["variable_builder"].assert_called_once_with(
            dataset="adam", variable="ADSL.AGE", files_ctx=[]
        )
        services["table_builder"].assert_not_called()
    services["endpoint_builder"].assert_not_called()
    assert [c[0] for c in calls.mock_calls] == (
        [
            "normalize_freeform",
            "latest_session",
            "normalize_cell",
            "table_builder",
            "prune",
        ]
        if fallback
        else ["normalize_freeform", "variable_builder", "prune"]
    )


def test_unresolved_preserves_original_strings_and_skips_prune(services):
    graph = create_lineage_workflow(**services)
    result = invoke_lineage_workflow(graph, {"dataset": " ", "variable": " What? "})
    assert result == {
        "variable": " What? ",
        "dataset": " ",
        "summary": "",
        "lineage": {
            "nodes": [
                {
                    "id": ".what?",
                    "type": "target",
                    "explanation": "[general] Could not classify the freeform request into a dataset/variable.",
                }
            ],
            "edges": [],
            "gaps": [
                "Freeform router could not determine dataset/variable; please reference a table id (e.g., 'table ars_vs_t01'), an ADaM/SDTM variable (e.g., 'ADSL.AGE' or 'DM.BRTHDTC'), or an endpoint description."
            ],
        },
    }
    services["normalize_freeform"].assert_called_once_with("What?")
    services["normalize_cell"].assert_called_once_with("What?", Path("session"))
    for name in ("variable_builder", "endpoint_builder", "table_builder", "prune"):
        services[name].assert_not_called()


def test_same_graph_isolates_requests_responses_and_failures(services):
    def build(*, dataset, variable, files_ctx):
        files_ctx[0]["nested"].append(variable)
        if variable == "FAIL":
            raise RuntimeError("failure")
        return {
            "dataset": dataset,
            "variable": variable,
            "summary": "",
            "lineage": {"nodes": files_ctx, "edges": [], "gaps": []},
        }

    services["variable_builder"].side_effect = build
    graph = create_lineage_workflow(**services)
    first = {"dataset": "ADSL", "variable": "AGE", "files": [{"nested": []}]}
    second = {"dataset": "DM", "variable": "SEX", "files": [{"nested": []}]}
    originals = deepcopy([first, second])
    one = invoke_lineage_workflow(graph, first)
    with pytest.raises(RuntimeError, match="failure"):
        invoke_lineage_workflow(graph, {**first, "variable": "FAIL"})
    two = invoke_lineage_workflow(graph, second)
    assert [first, second] == originals
    assert (one["dataset"], one["variable"], one["lineage"]["nodes"]) == (
        "ADSL",
        "AGE",
        [{"nested": ["AGE"]}],
    )
    assert (two["dataset"], two["variable"], two["lineage"]["nodes"]) == (
        "DM",
        "SEX",
        [{"nested": ["SEX"]}],
    )
    two["lineage"]["nodes"].clear()
    assert one["lineage"]["nodes"] == [{"nested": ["AGE"]}]
    unresolved = invoke_lineage_workflow(graph, {"dataset": "", "variable": "unknown"})
    assert unresolved["variable"] == "unknown"
    assert unresolved["lineage"]["edges"] == []
    assert services["prune"].call_count == 2


@pytest.mark.parametrize("dataset", ["ADSL", ""])
def test_api_success_or_unresolved_invokes_graph_once(services, monkeypatch, dataset):
    graph = create_lineage_workflow(**services)
    invoke = Mock(wraps=graph.invoke)
    monkeypatch.setattr(graph, "invoke", invoke)
    monkeypatch.setattr(main, "lineage_workflow", graph)
    with TestClient(main.app) as client:
        response = client.post(
            "/analyze-variable", json={"dataset": dataset, "variable": "AGE"}
        )
    assert response.status_code == 200
    invoke.assert_called_once()
    body = response.json()
    assert set(body) == {"dataset", "variable", "summary", "lineage"}
    if dataset:
        assert body == {
            **services["variable_builder"].return_value,
            "summary": "Pruned",
        }
    else:
        assert body["lineage"]["nodes"][0]["id"] == ".age"
        services["prune"].assert_not_called()


@pytest.mark.parametrize(
    "stage",
    [
        "normalize_freeform",
        "latest_session",
        "normalize_cell",
        "variable_builder",
        "endpoint_builder",
        "table_builder",
        "prune",
        "invoke",
    ],
)
def test_api_errors_never_replay_or_reprune(services, monkeypatch, stage):
    dataset = {
        "variable_builder": "ADSL",
        "endpoint_builder": "Protocol",
        "table_builder": "TLF",
        "prune": "ADSL",
        "invoke": "ADSL",
    }.get(stage, " ")
    if stage != "invoke":
        services[stage].side_effect = RuntimeError("boom")
    graph = create_lineage_workflow(**services)
    invoke = Mock(wraps=graph.invoke)
    if stage == "invoke":
        invoke.side_effect = RuntimeError("boom")
    monkeypatch.setattr(graph, "invoke", invoke)
    monkeypatch.setattr(main, "lineage_workflow", graph)
    with TestClient(main.app) as client:
        response = client.post(
            "/analyze-variable", json={"dataset": dataset, "variable": " AGE "}
        )
    assert response.status_code == 200
    assert response.json() == {
        "dataset": dataset,
        "variable": " AGE ",
        "summary": "",
        "lineage": {
            "nodes": [
                {
                    "id": f"{dataset.strip()}.age".lower(),
                    "type": "target",
                    "explanation": "[general] Error path.",
                }
            ],
            "edges": [],
            "gaps": ["Lineage service error: boom"],
        },
    }
    invoke.assert_called_once()
    assert services["prune"].call_count == (1 if stage == "prune" else 0)
    for name in ("variable_builder", "endpoint_builder", "table_builder"):
        expected = stage == name or (stage == "prune" and name == "variable_builder")
        assert services[name].call_count == int(expected)


def test_api_validation_stays_outside_graph(monkeypatch):
    graph = Mock()
    monkeypatch.setattr(main, "lineage_workflow", graph)
    with TestClient(main.app) as client:
        for body in (
            {"variable": "AGE"},
            {"dataset": "ADSL"},
            {"dataset": None, "variable": "AGE"},
        ):
            assert client.post("/analyze-variable", json=body).status_code == 422
    graph.invoke.assert_not_called()
