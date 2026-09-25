"""Build private AEREL + AESDISAB examples from the supplied TestData.

Run: python -m tests.build_ae_fixtures ../local-test-data
"""

import argparse
from copy import deepcopy
import hashlib
import json
from pathlib import Path
import shutil

import fitz
from lxml import etree
from tests.build_aerel_fixture import build_fixture as build_aerel


def descendants(value):
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from descendants(child)
    elif isinstance(value, list):
        for child in value:
            yield from descendants(child)


def build_fixture(source: Path) -> Path:
    source = source.resolve()
    aerel = build_aerel(source)
    ars_path = source / "fda-ae-t06-ars.json"
    ars = json.loads(ars_path.read_text())
    subsets = {x["id"]: x for x in ars["dataSubsets"]}
    analyses = {x["id"]: x for x in ars["analyses"]}
    output = next(x for x in ars["outputs"] if x["id"] == "Out_04")
    toc = next(
        x
        for x in descendants(ars["mainListOfContents"])
        if x.get("outputId") == "Out_04"
    )
    toc_analyses = {x.get("analysisId") for x in descendants(toc)}
    expected = {
        "dataset": "ADAE",
        "variable": "AESDISAB",
        "comparator": "EQ",
        "value": ["Y"],
    }
    paths = []
    for subset_id, analysis_id in [
        ("Dss_11", "An_39"),
        ("Dss_59", "An_40"),
        ("Dss_60", "An_40_1"),
    ]:
        subset = subsets[subset_id]
        if expected not in [x.get("condition") for x in descendants(subset)]:
            raise ValueError(f"{subset_id}: AESDISAB filter changed; review evidence")
        if subset_id in {"Dss_59", "Dss_60"}:
            expression = subset.get("compoundExpression", {})
            treatment = {
                "dataset": "ADAE",
                "variable": "TRTAN",
                "comparator": "IN",
                "value": ["1", "3"] if subset_id == "Dss_59" else ["2", "3"],
            }
            if expression.get("logicalOperator") != "AND" or treatment not in [
                x.get("condition") for x in descendants(expression)
            ]:
                raise ValueError(f"{subset_id}: treatment filter changed")
        analysis = analyses[analysis_id]
        if analysis.get("dataset") != "ADAE" or analysis.get("variable") != "USUBJID":
            raise ValueError(f"{analysis_id}: analysis measure changed")
        if analysis.get("dataSubsetId") != subset_id or analysis_id not in toc_analyses:
            raise ValueError(f"{analysis_id}: subset/output linkage changed")
        paths.append({"subset": subset, "analysis": analysis, "outputId": output["id"]})
    display = next(
        x["display"] for x in output["displays"] if x["display"]["id"] == "Disp_04"
    )
    if "FDA-AE-T06" not in [x.get("text") for x in descendants(display)]:
        raise ValueError("Display title evidence changed")

    # Validate the direct SDTM source before writing any AESDISAB artifacts.
    items = {}
    for filename, oid in [
        ("define.xml", "ADAE.AESDISAB"),
        ("define-sdtm.xml", "AE.AESDISAB"),
    ]:
        tree = etree.parse(str(source / filename))
        item = tree.xpath('//*[local-name()="ItemDef" and @OID=$oid]', oid=oid)[0]
        items[filename] = (tree, item)
    if items["define.xml"][1].get("Comment", "").strip() != "AE.AESDISAB":
        raise ValueError("ADAE.AESDISAB source mapping changed")

    if items["define-sdtm.xml"][1].get("Origin") != "CRF Page 121, 122, 123":
        raise ValueError("AESDISAB CRF origin changed")
    crf_evidence = []
    with fitz.open(source / "blankcrf.pdf") as crf:
        for number in (121, 122, 123):
            page = crf[number - 1]
            annotations = [
                a.info.get("content", "").replace("\r", "\n")
                for a in (page.annots() or [])
            ]
            expected_annotation = 'AESDISAB\nwhen AESER="3"'
            if (
                expected_annotation not in annotations
                or "3 = Permanently disabling" not in page.get_text()
            ):
                raise ValueError(f"CRF page {number}: AESDISAB evidence changed")
            crf_evidence.append(
                {
                    "file": "blankcrf.pdf",
                    "physicalPage": number,
                    "annotation": expected_annotation,
                    "field": "Serious Codes: 3 = Permanently disabling",
                }
            )

    target = source / "ae-lineage-examples"
    uploads = target / "uploads"
    uploads.mkdir(parents=True, exist_ok=True)
    for filename, (tree, item) in items.items():
        excerpt = etree.parse(str(aerel / "uploads" / filename))
        metadata = excerpt.xpath('//*[local-name()="MetaDataVersion"]')[0]
        group = excerpt.xpath('//*[local-name()="ItemGroupDef"]')[0]
        ref = tree.xpath(
            '//*[local-name()="ItemGroupDef"]/*[local-name()="ItemRef" and @ItemOID=$oid]',
            oid=item.get("OID"),
        )[0]
        group.append(deepcopy(ref))
        metadata.append(deepcopy(item))
        for ref in item.xpath('./*[local-name()="CodeListRef"]'):
            oid = ref.get("CodeListOID")
            if not excerpt.xpath('//*[local-name()="CodeList" and @OID=$oid]', oid=oid):
                metadata.append(
                    deepcopy(
                        tree.xpath(
                            '//*[local-name()="CodeList" and @OID=$oid]', oid=oid
                        )[0]
                    )
                )
        excerpt.write(str(uploads / filename), encoding="utf-8", xml_declaration=True)
    for filename in ["blankcrf.pdf", ars_path.name]:
        # Retain the complete ARS so its references remain intact, and original CRF page numbering.
        shutil.copy2(source / filename, uploads / filename)

    crf_nodes = [
        {
            "id": f'CRF.AESDISAB.PAGE{x["physicalPage"]}',
            "type": "crf page",
            "label": f'CRF p.{x["physicalPage"]}: Permanently disabling',
            "file": "blankcrf.pdf",
            "explanation": f'[direct] Physical page {x["physicalPage"]}, Serious Codes: 3 = Permanently disabling. Annotation: AESDISAB when AESER="3". This is the source CRF code annotation, not a claim that SDTM AESER takes value 3.',
        }
        for x in crf_evidence
    ]
    tlf_nodes = []
    downstream_edges = []
    for path in paths:
        subset, analysis = path["subset"], path["analysis"]
        node_id = "FDA_AE_T06." + analysis["id"]
        condition = json.dumps(
            subset.get("condition") or subset["compoundExpression"], ensure_ascii=False
        )
        explanation = (
            f'[direct] {subset["id"]} is referenced by {analysis["id"]}. '
            f'Analysis: {analysis["name"]}. Filter: {condition}. '
            "The main list of contents nests this analysis under Out_04; its display Disp_04 is titled FDA-AE-T06. "
            "This node is one analysis in that display, not a separate table. Analysis variable: ADAE.USUBJID."
        )
        tlf_nodes.append(
            {
                "id": node_id,
                "type": "tlf cell",
                "label": analysis["name"],
                "file": ars_path.name,
                "explanation": explanation,
            }
        )
        downstream_edges.append(
            {
                "from": "ADAE.AESDISAB",
                "to": node_id,
                "label": subset["id"] + ": AESDISAB = Y",
                "explanation": explanation,
            }
        )
    response = {
        "dataset": "ADAE",
        "variable": "AESDISAB",
        "summary": "[EVIDENCE FIXTURE — no model call] CRF pages 121, 122, 123 → AE.AESDISAB → ADAE.AESDISAB → three analyses in FDA-AE-T06: An_39 (summary), An_40 (low dose vs placebo), An_40_1 (high dose vs placebo). AESDISAB = Y is a subset selection criterion; the analyses count subjects using USUBJID. At most three nodes per category.",
        "lineage": {
            "nodes": crf_nodes
            + [
                {
                    "id": "AE.AESDISAB",
                    "type": "sdtm variable",
                    "label": "AE.AESDISAB",
                    "file": "define-sdtm.xml",
                    "explanation": "[direct] ItemDef AE.AESDISAB: Persist or Signif Disability/Incapacity; Origin=CRF Page 121, 122, 123.",
                },
                {
                    "id": "ADAE.AESDISAB",
                    "type": "adam variable",
                    "label": "ADAE.AESDISAB",
                    "file": "define.xml",
                    "explanation": "[direct] ItemDef ADAE.AESDISAB: Origin=Derived; Comment=AE.AESDISAB.",
                },
            ]
            + tlf_nodes,
            "edges": [
                {
                    "from": node["id"],
                    "to": "AE.AESDISAB",
                    "label": "Annotated CRF origin",
                    "explanation": node["explanation"]
                    + " SDTM ItemDef explicitly cites this CRF page.",
                }
                for node in crf_nodes
            ]
            + [
                {
                    "from": "AE.AESDISAB",
                    "to": "ADAE.AESDISAB",
                    "label": "Documented source mapping",
                    "explanation": "[direct] define.xml ItemDef ADAE.AESDISAB Comment=AE.AESDISAB.",
                },
            ]
            + downstream_edges,
            "gaps": [
                {
                    "explanation": "Three TLF nodes represent analyses in one display, not three different tables or individual result cells. Other analysis dependencies are omitted for scope. No subject-level recomputation or rendered-table value validation was performed."
                }
            ],
        },
    }
    original = json.loads((aerel / "lineage_response.json").read_text())
    (target / "lineage_responses.json").write_text(
        json.dumps({"responses": [original, response]}, indent=2)
    )
    evidence = {
        "sources": {
            p.name: hashlib.sha256(p.read_bytes()).hexdigest()
            for p in [
                source / "define.xml",
                source / "define-sdtm.xml",
                source / "blankcrf.pdf",
                ars_path,
            ]
        },
        "locators": {
            filename: f'ItemDef {item.get("OID")}, line {item.sourceline}'
            for filename, (_, item) in items.items()
        },
        "crf_evidence": crf_evidence,
        "ars_paths": paths,
        "output": output,
        "listOfContents": toc,
        "scope": "At most three nodes per category; the complete ARS is retained for reference integrity. AEREL fixture preserved unchanged.",
    }
    (target / "aesdisab_evidence.json").write_text(json.dumps(evidence, indent=2))
    shutil.copy2(aerel / "evidence.json", target / "aerel_evidence.json")
    (target / "README.md").write_text(
        "# AE lineage examples\n\nUpload all four files in uploads/. Select ADAE then AEREL or AESDISAB.\n\nAEREL: CRF p121 → AE.AEREL → ADAE.AEREL; downstream unconfirmed.\n\nAESDISAB: CRF p121/p122/p123 → AE.AESDISAB → ADAE.AESDISAB → FDA-AE-T06 analyses An_39 / An_40 / An_40_1. ARS subset filters link through analyses and the list of contents to Out_04 / Disp_04. See aesdisab_evidence.json for full reference paths.\n\nThese source-backed responses are replayed offline without API calls. AEREL retains 3 nodes / 2 edges. AESDISAB has 8 nodes / 7 edges: 3 CRF, 1 SDTM, 1 ADaM, 3 TLF analyses in one display. All private artifacts remain gitignored.\n"
    )
    return target


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    print(build_fixture(parser.parse_args().source))
