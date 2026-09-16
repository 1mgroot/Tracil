"""Optional private-source integration; no model calls."""

import json
from pathlib import Path
import shutil

import pytest
from fastapi.testclient import TestClient
from tests.build_ae_fixtures import build_fixture
from tests.offline_api import offline_api

SOURCE = Path(__file__).resolve().parents[2] / "local-test-data"
pytestmark = pytest.mark.skipif(
    not (SOURCE / "fda-ae-t06-ars.json").exists(), reason="Local TestData not supplied"
)


def test_both_examples_upload_and_route_without_cross_contamination():
    folder = build_fixture(SOURCE)
    manifest = json.loads((folder / "lineage_responses.json").read_text())
    assert manifest["responses"][0] == json.loads(
        (SOURCE / "adae-aerel/lineage_response.json").read_text()
    )
    with (
        offline_api(folder / "lineage_responses.json") as app,
        TestClient(app) as client,
    ):
        uploaded = client.post(
            "/process-files",
            files=[
                ("files", (p.name, p.read_bytes()))
                for p in sorted((folder / "uploads").iterdir())
            ],
        ).json()
        for standard, dataset in [("ADaM", "ADAE"), ("SDTM", "AE")]:
            assert {
                v["name"]
                for v in uploaded["standards"][standard]["datasetEntities"][dataset][
                    "variables"
                ]
            } == {"AEREL", "AESDISAB"}
        assert "FDA_AE_T06" in uploaded["standards"]["TLF"]["datasetEntities"]
        assert "aCRF" in uploaded["standards"]["CRF"]["datasetEntities"]
        for expected in manifest["responses"]:
            for dataset in ["ADAE", "AE", ""]:
                variable = (
                    expected["variable"] if dataset else "ADAE." + expected["variable"]
                )
                body = client.post(
                    "/analyze-variable", json={"dataset": dataset, "variable": variable}
                ).json()
                assert body["lineage"] == expected["lineage"]
                assert len(body["lineage"]["nodes"]) == (
                    3 if expected["variable"] == "AEREL" else 8
                )
                assert len(body["lineage"]["edges"]) == (
                    2 if expected["variable"] == "AEREL" else 7
                )
        table = client.post(
            "/analyze-variable", json={"dataset": "TLF", "variable": "FDA_AE_T06"}
        ).json()
        assert table["lineage"] == manifest["responses"][1]["lineage"]
        aesdisab = manifest["responses"][1]["lineage"]
        assert [(x["from"], x["to"]) for x in aesdisab["edges"]] == [
            *[(f"CRF.AESDISAB.PAGE{page}", "AE.AESDISAB") for page in (121, 122, 123)],
            ("AE.AESDISAB", "ADAE.AESDISAB"),
            *[
                ("ADAE.AESDISAB", "FDA_AE_T06." + analysis)
                for analysis in ("An_39", "An_40", "An_40_1")
            ],
        ]
        from collections import Counter

        assert Counter(n["type"] for n in aesdisab["nodes"]) == {
            "crf page": 3,
            "sdtm variable": 1,
            "adam variable": 1,
            "tlf cell": 3,
        }


def test_rejects_broken_ars_reference(tmp_path):
    for filename in [
        "define.xml",
        "define-sdtm.xml",
        "blankcrf.pdf",
        "combined_tlf.pdf",
        "fda-ae-t06-ars.json",
    ]:
        shutil.copy2(SOURCE / filename, tmp_path / filename)
    path = tmp_path / "fda-ae-t06-ars.json"
    ars = json.loads(path.read_text())
    next(x for x in ars["analyses"] if x["id"] == "An_39")["dataSubsetId"] = "Dss_10"
    path.write_text(json.dumps(ars))
    with pytest.raises(ValueError, match="subset/output linkage changed"):
        build_fixture(tmp_path)
