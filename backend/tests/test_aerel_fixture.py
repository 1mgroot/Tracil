"""Optional integration test: private files stay outside the repository."""

from pathlib import Path
import json

import pytest
from fastapi.testclient import TestClient
from tests.build_aerel_fixture import build_fixture
from tests.offline_api import offline_api

SOURCE = Path(__file__).resolve().parents[2] / "local-test-data"


@pytest.mark.skipif(
    not (SOURCE / "define.xml").exists(), reason="Local TestData not supplied"
)
def test_source_backed_aerel_fixture():
    folder = build_fixture(SOURCE)
    body = json.loads((folder / "lineage_response.json").read_text())
    assert [n["id"] for n in body["lineage"]["nodes"]] == [
        "CRF.AEREL.PAGE121",
        "AE.AEREL",
        "ADAE.AEREL",
    ]
    assert [(e["from"], e["to"]) for e in body["lineage"]["edges"]] == [
        ("CRF.AEREL.PAGE121", "AE.AEREL"),
        ("AE.AEREL", "ADAE.AEREL"),
    ]
    assert not any(n["type"].startswith("tlf") for n in body["lineage"]["nodes"])
    with (
        offline_api(folder / "lineage_response.json") as app,
        TestClient(app) as client,
    ):
        uploaded = client.post(
            "/process-files",
            files=[
                ("files", (p.name, p.read_bytes()))
                for p in sorted((folder / "uploads").iterdir())
            ],
        ).json()
        for standard, dataset in (("ADaM", "ADAE"), ("SDTM", "AE")):
            assert [
                v["name"]
                for v in uploaded["standards"][standard]["datasetEntities"][dataset][
                    "variables"
                ]
            ] == ["AEREL"]
        assert "aCRF" in uploaded["standards"]["CRF"]["datasetEntities"]
        actual = client.post(
            "/analyze-variable", json={"dataset": "ADAE", "variable": "AEREL"}
        ).json()
        assert actual == body
        unknown = client.post(
            "/analyze-variable", json={"dataset": "ADAE", "variable": "OTHER"}
        ).json()
        assert "only covers" in unknown["lineage"]["gaps"][0]
