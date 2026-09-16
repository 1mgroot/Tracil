from copy import deepcopy

import httpx
import pytest
from fastapi.testclient import TestClient

import main
from tests.offline_api import FIXTURE_PATH, offline_api


@pytest.mark.parametrize(
    "query,expected_dataset,expected_type",
    [
        ("offline variable", "ADTEST", "adam variable"),
        ("offline endpoint", "endpoint", "protocol endpoint"),
        ("offline table", "table", "tlf display"),
        ("offline cell", "table", "tlf cell"),
    ],
)
def test_offline_routes_use_real_http_and_workflow(
    query, expected_dataset, expected_type
):
    with offline_api(), TestClient(main.app) as client:
        result = client.post(
            "/analyze-variable", json={"dataset": "", "variable": query}
        )
        assert result.status_code == 200
        body = result.json()
        assert set(body) == {"dataset", "variable", "summary", "lineage"}
        assert body["dataset"] == expected_dataset
        assert body["summary"].startswith("[OFFLINE FIXTURE]")
        # Two nodes avoid the existing UI's single-node enhancement path.
        assert len(body["lineage"]["nodes"]) == 2
        assert body["lineage"]["nodes"][1]["type"] == expected_type
        ids = {node["id"] for node in body["lineage"]["nodes"]}
        assert all(
            edge["from"] in ids and edge["to"] in ids
            for edge in body["lineage"]["edges"]
        )
        assert isinstance(body["lineage"]["gaps"][0], dict)
        assert isinstance(body["lineage"]["gaps"][1], str)


def test_offline_failure_unknown_and_validation():
    with offline_api(), TestClient(main.app) as client:
        error = client.post(
            "/analyze-variable", json={"dataset": "", "variable": "offline error"}
        ).json()
        assert error["lineage"]["gaps"] == [
            "Lineage service error: OFFLINE FIXTURE: intentional builder failure"
        ]
        unknown = client.post(
            "/analyze-variable",
            json={"dataset": "", "variable": "not a named scenario"},
        ).json()
        assert "Freeform router could not determine" in unknown["lineage"]["gaps"][0]
        assert (
            client.post("/analyze-variable", json={"variable": "RACE"}).status_code
            == 422
        )


def test_offline_is_deterministic_and_restores_production_state():
    original_graph, original_output, original_title = (
        main.lineage_workflow,
        main.OUTPUT,
        main.app.title,
    )
    with offline_api(), TestClient(main.app) as client:
        temporary_output = main.OUTPUT
        assert temporary_output != original_output
        payload = {
            "dataset": "ADSL",
            "variable": "RACE",
            "files": [{"id": "synthetic"}],
        }
        original_payload = deepcopy(payload)
        first = client.post("/analyze-variable", json=payload).json()
        first["lineage"]["nodes"].clear()
        second = client.post("/analyze-variable", json=payload).json()
        assert len(second["lineage"]["nodes"]) == 2
        assert second == client.post("/analyze-variable", json=payload).json()
        assert payload == original_payload
    assert main.lineage_workflow is original_graph
    assert main.OUTPUT == original_output
    assert main.app.title == original_title
    assert not temporary_output.exists()


def test_offline_blocks_accidental_model_network_even_with_a_key(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "synthetic-not-a-real-key")
    with offline_api():
        with pytest.raises(RuntimeError, match="blocks outbound"):
            httpx.get("https://api.openai.com/v1/models")


@pytest.mark.asyncio
async def test_offline_blocks_async_model_network():
    with offline_api(), pytest.raises(RuntimeError, match="blocks outbound"):
        async with httpx.AsyncClient() as client:
            await client.get("https://api.openai.com/v1/models")


def test_synthetic_upload_uses_real_parser_and_then_lineage():
    fixture = FIXTURE_PATH.with_name("ADTEST.json")
    with offline_api(), TestClient(main.app) as client:
        uploaded = client.post(
            "/process-files",
            files={"files": (fixture.name, fixture.read_bytes(), "application/json")},
        )
        assert uploaded.status_code == 200
        data = uploaded.json()
        dataset = data["standards"]["ADaM"]["datasetEntities"]["ADTEST"]
        assert [v["name"] for v in dataset["variables"]] == [
            "SYNTHETIC_VALUE",
            "TEST_LABEL",
        ]
        assert dataset["metadata"]["records"] == 0
        assert data["metadata"]["totalVariables"] == 2
        assert data["metadata"]["sourceFiles"][0]["processingStatus"] == "completed"
        response = client.post(
            "/analyze-variable",
            json={
                "dataset": dataset["name"],
                "variable": dataset["variables"][0]["name"],
                "files": data["metadata"]["sourceFiles"],
            },
        )
        assert response.json()["summary"].startswith("[OFFLINE FIXTURE]")
        assert response.json()["variable"] == "SYNTHETIC_VALUE"
