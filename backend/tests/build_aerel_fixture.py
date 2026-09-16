"""Extract a small, evidence-backed local fixture; never invent missing edges.

Run from backend/: python -m tests.build_aerel_fixture ../local-test-data
Generated artifacts stay under the ignored source directory.
"""

import argparse
from copy import deepcopy
import hashlib
import json
from pathlib import Path
import shutil

import fitz
from lxml import etree


def build_fixture(source: Path) -> Path:
    source = source.resolve()
    documents = {}
    for filename, oid in (
        ("define.xml", "ADAE.AEREL"),
        ("define-sdtm.xml", "AE.AEREL"),
    ):
        tree = etree.parse(str(source / filename))
        item = tree.xpath('//*[local-name()="ItemDef" and @OID=$oid]', oid=oid)[0]
        documents[filename] = (tree, item)
    adam = documents["define.xml"][1]
    sdtm = documents["define-sdtm.xml"][1]
    if adam.get("Comment", "").strip() != "AE.AEREL":
        raise ValueError("ADAE.AEREL source mapping changed; review evidence manually")
    if sdtm.get("Origin") != "CRF Page 121, 122, 123":
        raise ValueError("AE.AEREL CRF origin changed; review evidence manually")
    with fitz.open(source / "blankcrf.pdf") as crf:
        page = crf[120]
        if not any(
            a.info.get("content", "").strip() == "AEREL" for a in (page.annots() or [])
        ):
            raise ValueError("CRF page 121 no longer annotates AEREL")
        if "Relationship" not in page.get_text() or "Study Drug" not in page.get_text():
            raise ValueError("CRF field label is not confirmed")
    ars_files = sorted(source.glob("*-ars.json"))
    if not ars_files:
        raise ValueError("No ARS files available for downstream review")
    if any("aerel" in p.read_text().lower() for p in ars_files):
        raise ValueError(
            "ARS now references AEREL; re-review downstream before generating"
        )

    output = source / "adae-aerel"
    uploads = output / "uploads"
    uploads.mkdir(parents=True, exist_ok=True)
    for filename, (tree, item) in documents.items():
        namespace = etree.QName(item).namespace
        tag = lambda name: f"{{{namespace}}}{name}"
        root = etree.Element(tag("ODM"), nsmap=tree.getroot().nsmap)
        study = etree.SubElement(root, tag("Study"), OID="LocalEvidenceExcerpt")
        metadata = etree.SubElement(study, tag("MetaDataVersion"), OID="AEREL.Excerpt")
        oid = item.get("OID")
        group = tree.xpath(
            '//*[local-name()="ItemGroupDef"]/*[local-name()="ItemRef" and @ItemOID=$oid]/..',
            oid=oid,
        )[0]
        excerpt = deepcopy(group)
        for child in list(excerpt):
            if (
                etree.QName(child).localname == "ItemRef"
                and child.get("ItemOID") != oid
            ):
                excerpt.remove(child)
        metadata.append(excerpt)
        metadata.append(deepcopy(item))
        for ref in item.xpath('./*[local-name()="CodeListRef"]'):
            codes = tree.xpath(
                '//*[local-name()="CodeList" and @OID=$oid]', oid=ref.get("CodeListOID")
            )
            for code in codes:
                metadata.append(deepcopy(code))
        etree.ElementTree(root).write(
            str(uploads / filename), encoding="utf-8", xml_declaration=True
        )
    # Retain physical page numbering for the cited annotation.
    shutil.copy2(source / "blankcrf.pdf", uploads / "blankcrf.pdf")
    response = {
        "dataset": "ADAE",
        "variable": "AEREL",
        "summary": "[EVIDENCE FIXTURE — no model call] CRF page 121 → AE.AEREL → ADAE.AEREL. These are documented metadata relationships; downstream TLF use is not established in the supplied files.",
        "lineage": {
            "nodes": [
                {
                    "id": "CRF.AEREL.PAGE121",
                    "type": "crf page",
                    "label": "CRF p.121: Relationship to Study Drug",
                    "file": "blankcrf.pdf",
                    "explanation": "[direct] blankcrf.pdf physical page 121 labels Relationship to Study Drug and annotates that column AEREL. Page 121 is the representative CRF page; SDTM also cites pages 122 and 123.",
                },
                {
                    "id": "AE.AEREL",
                    "type": "sdtm variable",
                    "label": "AE.AEREL",
                    "file": "define-sdtm.xml",
                    "explanation": "[direct] define-sdtm.xml ItemDef OID=AE.AEREL: label Causality; Origin=CRF Page 121, 122, 123.",
                },
                {
                    "id": "ADAE.AEREL",
                    "type": "adam variable",
                    "label": "ADAE.AEREL",
                    "file": "define.xml",
                    "explanation": "[direct] define.xml ItemDef OID=ADAE.AEREL: label Causality; Origin=Derived; Comment=AE.AEREL. This establishes the source mapping, not independently verified row-level equality.",
                },
            ],
            "edges": [
                {
                    "from": "CRF.AEREL.PAGE121",
                    "to": "AE.AEREL",
                    "label": "Annotated CRF origin",
                    "explanation": "[direct] SDTM ItemDef Origin explicitly lists CRF Page 121, 122, 123; page 121 annotation is AEREL.",
                },
                {
                    "from": "AE.AEREL",
                    "to": "ADAE.AEREL",
                    "label": "Documented source mapping",
                    "explanation": "[direct] ADaM ItemDef ADAE.AEREL explicitly references AE.AEREL in Comment.",
                },
            ],
            "gaps": [
                {
                    "explanation": "Downstream TLF use of ADAE.AEREL is not established: no AEREL reference in the supplied ARS JSONs, and the provided TLF output does not identify AEREL usage. A generic AE table is not sufficient evidence for a variable-level edge."
                }
            ],
        },
    }
    (output / "lineage_response.json").write_text(json.dumps(response, indent=2))
    evidence = {
        "scope": "Three-node metadata lineage; no patient records or live model output.",
        "sources": {
            p.name: hashlib.sha256(p.read_bytes()).hexdigest()
            for p in [
                source / "define.xml",
                source / "define-sdtm.xml",
                source / "blankcrf.pdf",
                source / "combined_tlf.pdf",
                *ars_files,
            ]
        },
        "locators": {
            "ADAE.AEREL": f"define.xml:{adam.sourceline} ItemDef/@Comment",
            "AE.AEREL": f"define-sdtm.xml:{sdtm.sourceline} ItemDef/@Origin",
            "CRF": "blankcrf.pdf physical page 121, AEREL annotation",
        },
        "downstream_review": "The supplied ARS files have no AEREL references. Manual review of combined_tlf.pdf found AE tables 14-5.01 and 14-5.02 but no variable-specific causality use. This does not prove no downstream exists outside these files.",
    }
    (output / "evidence.json").write_text(json.dumps(evidence, indent=2))
    (output / "README.md").write_text(
        "# ADAE.AEREL evidence fixture\n\nUpload all three files in uploads/. They contain actual define excerpts and the original annotated CRF. No subject-level records are included.\n\nGraph: CRF p.121 → AE.AEREL → ADAE.AEREL (3 nodes, 2 edges).\n\nDownstream TLF use is unconfirmed and is deliberately not drawn. See evidence.json for source hashes and locators. This is a curated metadata fixture, not a model result or a validation of clinical correctness.\n"
    )
    return output


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    print(build_fixture(parser.parse_args().source))
