#!/usr/bin/env python3
"""Local eval candidate packaging/verification; never imports the application or calls a model."""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import sys
import xml.etree.ElementTree as ET

SOURCE_FILES = {
    "define_adam": "define.xml", "define_sdtm": "define-sdtm.xml",
    "usdm": "usdm.json", "ars_lb": "ars-lb-t01-ars.json",
    "ars_vs": "ars-vs-t01-ars.json", "ars_ae": "fda-ae-t06-ars.json",
    "protocol": "protocol.pdf", "acrf": "blankcrf.pdf", "tlf": "combined_tlf.pdf",
}
NS = {"odm": "http://www.cdisc.org/ns/odm/v1.2", "def": "http://www.cdisc.org/ns/def/v1.0",
      "adamref": "http://www.cdisc.org/ns/ADaMRes/DRAFT", "xlink": "http://www.w3.org/1999/xlink"}
INPUT_KEYS = {"case_id", "category", "task_type", "source_ids", "request", "split", "split_group", "variant_group"}
CATEGORIES = ("deterministic", "semantic")


def require(condition, message):
    if not condition:
        raise ValueError(message)


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + "\n", encoding="utf-8")


def read_lines(path):
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def canonical(value):
    # Unlike Python ==, JSON true is not 1; arrays retain their specified order.
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False)


def normalize(text):
    return " ".join(text.split())


def pointer_value(obj, pointer):
    require(pointer == "" or pointer.startswith("/"), "invalid JSON pointer")
    if pointer == "":
        return obj
    for raw in pointer[1:].split("/"):
        key = raw.replace("~1", "/").replace("~0", "~")
        if isinstance(obj, list):
            require(key.isdigit() and str(int(key)) == key, "invalid array index")
            obj = obj[int(key)]
        else:
            obj = obj[key]
    return obj


class Sources:
    def __init__(self, root, manifest):
        self.paths = {}
        self.cache = {}
        for source in manifest["sources"]:
            path = (root / source["file"]).resolve()
            require(path.is_relative_to(root.resolve()), "source escapes bundle")
            require(digest(path) == source["sha256"], f"source hash mismatch: {source['source_id']}")
            require(path.stat().st_size == source["bytes"], "source size mismatch")
            require(source["source_id"] not in self.paths, "duplicate source ID")
            self.paths[source["source_id"]] = path

    def evidence(self, evidence):
        sid = evidence["source_id"]
        path = self.paths[sid]
        loc = evidence["locator"]
        kind = loc["type"]
        if sid not in self.cache:
            if path.suffix == ".json":
                self.cache[sid] = read_json(path)
            elif path.suffix == ".xml":
                self.cache[sid] = ET.parse(path).getroot()
            else:
                from pypdf import PdfReader
                self.cache[sid] = PdfReader(path)
        source = self.cache[sid]
        if kind == "json_pointer":
            value = pointer_value(source, loc["pointer"])
        elif kind == "xml_xpath":
            nodes = [source] if loc["path"] == "." else source.findall(loc["path"], NS)
            require(len(nodes) == 1, f"XML locator must identify one node, got {len(nodes)}")
            value = nodes[0].attrib[loc["attribute"]] if "attribute" in loc else " ".join(nodes[0].itertext())
        elif kind in ("pdf_page", "pdf_annotation"):
            require(type(loc["page"]) is int and 1 <= loc["page"] <= len(source.pages), "invalid PDF page")
            page = source.pages[loc["page"] - 1]
            if kind == "pdf_page":
                require(loc.get("text_layer") == "pypdf", "unsupported PDF text layer")
                value = page.extract_text() or ""
            else:
                index = loc["annotation_index"]
                annotations = page.get("/Annots", [])
                if hasattr(annotations, "get_object"):
                    annotations = annotations.get_object()
                require(type(index) is int and 0 <= index < len(annotations), "invalid annotation index")
                value = str(annotations[index].get_object()[loc["field"]])
        else:
            raise ValueError(f"unsupported locator type: {kind}")
        excerpt = evidence["excerpt"]
        require(isinstance(excerpt, str), "evidence excerpt must be a string")
        require(bool(evidence["rationale"]), "missing evidence rationale")
        if not normalize(excerpt):
            # A blank Comment attribute is itself a useful source fact. Never let
            # an empty substring count as evidence for a whole element or PDF page.
            literal_field = kind == "json_pointer" or (kind == "xml_xpath" and "attribute" in loc)
            require(literal_field and isinstance(value, str) and excerpt == value, "invalid empty evidence excerpt")
            return
        if isinstance(value, str):
            require(normalize(excerpt) in normalize(value), "excerpt not found at locator")
        else:
            require(canonical(json.loads(excerpt)) == canonical(value), "JSON evidence value mismatch")


def check_pair(inp, ref):
    cid = inp["case_id"]
    require(set(inp) == INPUT_KEYS, f"{cid}: unexpected/missing input fields")
    require(set(inp["request"]) == {"question", "output_contract"}, f"{cid}: request fields")
    require(all(isinstance(x, str) and x.strip() for x in inp["request"].values()), f"{cid}: empty request")
    require(inp["category"] in CATEGORIES, f"{cid}: category")
    require(inp["split"] == "dev" and inp["split_group"] == "supplied_testdata_bundle_01", f"{cid}: split leakage")
    require(inp["source_ids"] and len(inp["source_ids"]) == len(set(inp["source_ids"])), f"{cid}: invalid source set")
    require(set(inp["source_ids"]) <= set(SOURCE_FILES), f"{cid}: unknown source")
    require(ref["case_id"] == cid and "expected_output" in ref, f"{cid}: reference mismatch")
    require(ref["evidence"] and ref["requirement_ids"], f"{cid}: missing provenance")
    require(ref["review"]["status"] == "candidate", f"{cid}: v0 cannot be promoted automatically")
    require(ref["review"]["clinical_review"] == "pending", f"{cid}: unsupported clinical approval")
    grading = ref["grading"]
    expected_method = "exact_json" if inp["category"] == "deterministic" else "rubric"
    require(grading["method"] == expected_method, f"{cid}: grader/category mismatch")
    if expected_method == "rubric":
        for field in ("required_claims", "forbidden_claims", "uncertainty_requirements"):
            require(isinstance(grading[field], list) and grading[field], f"{cid}: empty rubric {field}")
    for ev in ref["evidence"]:
        require(ev["source_id"] in inp["source_ids"], f"{cid}: evidence outside query sources")


def assemble(bundle):
    pairs = []
    for family in ("define", "json", "pdf"):
        pairs.extend(read_json(bundle / "work" / f"{family}-cases.json"))
    ids = set()
    for pair in pairs:
        check_pair(pair["input"], pair["reference"])
        cid = pair["input"]["case_id"]
        require(cid not in ids, f"duplicate case ID {cid}")
        ids.add(cid)
    for category in CATEGORIES:
        selected = sorted((p for p in pairs if p["input"]["category"] == category), key=lambda p: p["input"]["case_id"])
        require(selected, f"empty category: {category}")
        for folder, key in (("inputs", "input"), ("references", "reference")):
            path = bundle / folder / f"{category}.jsonl"
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text("".join(json.dumps(p[key], ensure_ascii=False, allow_nan=False) + "\n" for p in selected), encoding="utf-8")
    manifest = {
        "schema_version": "tracil-eval-candidate-v0.1", "dataset_version": "0.1.0-candidate",
        "status": "candidate_not_clinically_adjudicated", "split": "dev", "holdout_cases": 0,
        "split_group": "supplied_testdata_bundle_01", "source_root_relative_to_bundle": "..",
        "origin": "User-supplied local TestData copy; public redistribution license not established",
        "scope": "Selected metadata, explicit references, and source-grounded semantic lineage candidates; no production evaluation run",
        "sources": [{"source_id": sid, "file": name, "bytes": (bundle.parent / name).stat().st_size,
                     "sha256": digest(bundle.parent / name)} for sid, name in SOURCE_FILES.items()],
        "artifacts": {f"{folder}/{cat}.jsonl": digest(bundle / folder / f"{cat}.jsonl")
                      for folder in ("inputs", "references") for cat in CATEGORIES},
        "counts": dict(Counter(p["input"]["category"] for p in pairs)),
    }
    write_json(bundle / "manifest.json", manifest)
    return manifest["counts"]


def validate(bundle):
    manifest = read_json(bundle / "manifest.json")
    require({s["source_id"]: s["file"] for s in manifest["sources"]} == SOURCE_FILES, "source inventory mismatch")
    expected_artifacts = {f"{folder}/{category}.jsonl" for folder in ("inputs", "references") for category in CATEGORIES}
    require(set(manifest["artifacts"]) == expected_artifacts, "artifact inventory mismatch")
    require(manifest["split"] == "dev" and manifest["holdout_cases"] == 0, "manifest split mismatch")
    sources = Sources(bundle.parent, manifest)
    for path, sha in manifest["artifacts"].items():
        require(digest(bundle / path) == sha, f"artifact hash mismatch: {path}")
    ids, evidence_count, coverage = set(), 0, Counter()
    counts = {}
    for category in CATEGORIES:
        inputs = read_lines(bundle / "inputs" / f"{category}.jsonl")
        refs = read_lines(bundle / "references" / f"{category}.jsonl")
        require(len(inputs) == len(refs), f"{category}: input/reference count")
        counts[category] = len(inputs)
        for inp, ref in zip(inputs, refs):
            check_pair(inp, ref)
            cid = inp["case_id"]
            require(inp["category"] == category and cid not in ids, f"{cid}: duplicated or misplaced")
            ids.add(cid)
            for ev in ref["evidence"]:
                try:
                    sources.evidence(ev)
                except Exception as error:
                    raise ValueError(f"{cid}: {ev['source_id']}: {error}") from error
                evidence_count += 1
            coverage.update(set(e["source_id"] for e in ref["evidence"]))
    require(counts == manifest["counts"], "manifest case counts mismatch")
    require(set(coverage) == set(SOURCE_FILES), "not all nine sources covered")
    return {"result": "pass", "checks": "packaging, source hashes and evidence locator/excerpt round-trip only",
            "counts": counts, "evidence_records": evidence_count, "source_case_coverage": dict(coverage),
            "clinical_gold_approved": False, "application_evaluated": False}


def score(bundle, predictions):
    validate(bundle)
    refs = read_lines(bundle / "references" / "deterministic.jsonl")
    ids = {r["case_id"] for r in refs}
    actual = {}
    for row in read_lines(predictions):
        cid = row["case_id"]
        require(cid in ids and cid not in actual and "output" in row, f"unknown, duplicate or invalid prediction: {cid}")
        actual[cid] = row["output"]
    results = [{"case_id": r["case_id"], "pass": r["case_id"] in actual and canonical(actual[r["case_id"]]) == canonical(r["expected_output"]),
                "missing": r["case_id"] not in actual} for r in refs]
    passed = sum(r["pass"] for r in results)
    return {"metric": "candidate_exact_json", "passed": passed, "total": len(results),
            "score": passed / len(results), "missing": sum(r["missing"] for r in results),
            "clinical_quality_claim_allowed": False, "results": results}


def catalog(bundle):
    report = validate(bundle)
    for category, title in (("deterministic", "确定性案例"), ("semantic", "语义推断案例")):
        inputs = read_lines(bundle / "inputs" / f"{category}.jsonl")
        refs = read_lines(bundle / "references" / f"{category}.jsonl")
        lines = [f"# {title}", "", "状态：candidate；全部 dev；临床审核 pending。此文件含参考答案，仅供评测编制和审阅，不能作为被测输入。", ""]
        for inp, ref in zip(inputs, refs):
            lines.extend([f"## {inp['case_id']}", "", inp["request"]["question"], "",
                f"来源：{', '.join(inp['source_ids'])} · 类型：{inp['task_type']} · family：{inp['variant_group']}", "",
                "输出契约：" + inp["request"]["output_contract"], "", "参考答案（待裁决）：", "", "```json",
                json.dumps(ref["expected_output"], ensure_ascii=False, indent=2), "```", "", "证据：", ""])
            for ev in ref["evidence"]:
                lines.append(f"- `{ev['source_id']}` · `{json.dumps(ev['locator'], ensure_ascii=False)}`")
                lines.append("  - 摘录：" + normalize(ev["excerpt"]).replace("\n", " "))
                lines.append("  - 作用：" + ev["rationale"])
            if category == "semantic":
                for field, label in (("required_claims", "必要结论"), ("forbidden_claims", "禁止断言"), ("uncertainty_requirements", "不确定性要求")):
                    lines.extend(["", label + "：", ""])
                    lines.extend("- " + claim for claim in ref["grading"][field])
            lines.extend(["", "审阅备注：", ""])
            lines.extend("- " + note for note in ref["notes"])
            lines.extend(["", "审核状态：`" + json.dumps(ref["review"], ensure_ascii=False) + "`", ""])
        (bundle / "review" / f"{category.upper()}.md").write_text("\n".join(lines), encoding="utf-8")
    counts = report["counts"]
    (bundle / "README.md").write_text(
        "# TestData 评测候选集 v0.1\n\n"
        f"已从 9 份原文件整理 {counts['deterministic']} 条确定性案例、{counts['semantic']} 条语义推断案例。全部为 dev，holdout 为 0；临床审核待完成。\n\n"
        "- [确定性案例册](review/DETERMINISTIC.md)：字面字段、原生引用、条件；精确答案与来源。\n"
        "- [语义推断案例册](review/SEMANTIC.md)：跨文档关系、计算规则、冲突/缺证据；逐 claim rubric。\n"
        "- [使用与评分说明](../../docs/evaluation/README.md)\n"
        "- [来源及数据集快照](manifest.json)\n"
        "- [实际完整性检查](review/validation.json)\n\n"
        "机器读取 inputs/*.jsonl 作为问题，references/*.jsonl 只给 evaluator。review/ 和 work/ 同样含答案，不能进入模型检索库。\n\n"
        "校验通过仅说明打包、hash 和证据定位/摘录可回读；不代表应用性能、临床正确性或 C0/E/F 已完成。\n",
        encoding="utf-8")
    return {"catalogs": ["README.md", "review/DETERMINISTIC.md", "review/SEMANTIC.md"], "counts": counts}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("assemble", "validate", "score", "catalog"))
    parser.add_argument("--bundle", type=Path, default=Path("local-test-data/eval-v0"))
    parser.add_argument("--predictions", type=Path)
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()
    try:
        if args.command == "assemble":
            result = assemble(args.bundle)
        elif args.command == "validate":
            result = validate(args.bundle)
        elif args.command == "catalog":
            result = catalog(args.bundle)
        else:
            require(args.predictions is not None, "score requires --predictions")
            result = score(args.bundle, args.predictions)
        if args.report:
            write_json(args.report, result)
        print(json.dumps(result, ensure_ascii=False, indent=2))
    except (ValueError, KeyError, IndexError, TypeError, OSError) as error:
        print(f"FAILED: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
