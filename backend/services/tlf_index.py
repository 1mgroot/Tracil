# services/tlf_index.py
# -*- coding: utf-8 -*-

from __future__ import annotations
from pathlib import Path
from typing import Dict, Any, List, Tuple, Optional
import os, json, re
from collections import defaultdict, Counter

# -----------------------
# Basic helpers
# -----------------------

def _read_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8", errors="ignore"))
    except Exception:
        raw = path.read_text(errors="ignore")
        return json.loads(raw)

def _uc(s: Optional[str]) -> str:
    return (s or "").strip()

def _norm_id_from_filename(path: Path) -> str:
    stem = path.stem
    stem = stem.replace("_", "-").lower()
    stem = re.sub(r"-(ard|ard_fix|ars)$", "", stem)
    parts = [p for p in stem.split("-") if p]
    return "_".join([p.upper() for p in parts])

def _safe_list(val) -> List[Any]:
    if isinstance(val, list):
        return val
    if val is None:
        return []
    return [val]

def _unique_preserve_order(xs: List[Any]) -> List[Any]:
    seen, out = set(), []
    for x in xs:
        if x not in seen:
            out.append(x); seen.add(x)
    return out

def _as_var_list_from_ard_columns(columns: List[Any]) -> List[Dict[str, Any]]:
    out = []
    for col in (columns or []):
        if isinstance(col, dict):
            nm = (col.get("name") or col.get("itemOID") or "VAR").upper()
            lbl = col.get("label") or col.get("name") or nm
            dt  = (col.get("dataType") or col.get("type") or "character").lower()
            vtype = "numeric" if dt in ("integer","int","float","double","number","decimal","numeric") else "character"
            out.append({"name": nm,"label": lbl,"type": vtype,"length": col.get("length"),"role": None,"mandatory": None})
        else:
            nm = str(col).upper()
            out.append({"name": nm,"label": nm,"type": "character","length": None,"role": None,"mandatory": None})
    return out

# -----------------------
# ARD parsing / normalization
# -----------------------

_HEADER_HINTS = {"OUTPUTID","ANALYSISID","GROUP1","GROUP2","GROUP3","GROUPING1","GROUPING2","GROUPING3","DISP","DISPLAY","PATTERN"}

def _rows_to_dicts_using_header(rows: List[List[Any]], header: List[str], start_idx: int = 1) -> List[Dict[str, Any]]:
    dicts = []
    H = [str(h).strip() for h in header]
    for r in rows[start_idx:]:
        r = list(r)
        dicts.append({ H[i]: (r[i] if i < len(r) else None) for i in range(len(H)) })
    return dicts

def parse_ard(path: Path) -> Dict[str, Any]:
    """
    Robust ARD normalizer with strong fallbacks:
      - dict rows with 'data'/'rows'/'table'
      - list-of-lists using header row or 'columns'
      - computes outputs/axes even if we cannot fully dict-ify rows
    """
    raw = _read_json(path)

    # 1) pull candidate rows and columns
    if isinstance(raw, list):
        data = raw
        meta = {}
        columns = []
    else:
        data = raw.get("data") if isinstance(raw.get("data"), list) else \
               raw.get("rows") if isinstance(raw.get("rows"), list) else \
               raw.get("table") if isinstance(raw.get("table"), list) else []
        meta = raw
        columns = _safe_list(raw.get("columns"))

    # 2) normalize to list-of-dicts in data_rows
    data_rows: List[Dict[str, Any]] = []
    columns_names: Optional[List[str]] = None

    # columns → names (if present)
    if columns:
        if isinstance(columns[0], dict):
            columns_names = [ (c.get("name") or c.get("itemOID") or str(i)).strip() for i,c in enumerate(columns) ]
        else:
            columns_names = [ str(c).strip() for c in columns ]

    if data:
        first = data[0]
        # dict rows → use as-is
        if isinstance(first, dict):
            data_rows = [r for r in data if isinstance(r, dict)]
        # list rows
        elif isinstance(first, list):
            header = None
            start_idx = 0
            if columns_names:
                header = columns_names
                start_idx = 0
            else:
                cand_hdr = [str(x).strip() for x in first]
                if any(h.upper() in _HEADER_HINTS for h in cand_hdr):
                    header = cand_hdr
                    start_idx = 1
            if header:
                data_rows = _rows_to_dicts_using_header(data, header, start_idx=start_idx)
            else:
                data_rows = []  # cannot infer a clean dict structure
        else:
            data_rows = []

    # 3) build variables (prefer columns metadata; otherwise infer from keys)
    if columns:
        variables = _as_var_list_from_ard_columns(columns)
    else:
        keys = _unique_preserve_order([k for r in data_rows for k in r.keys()])[:200]
        variables = [{"name": k.upper(),"label": k,"type": "character","length": None,"role": None,"mandatory": None} for k in keys]

    # 4) find important keys (case-insensitive)
    def _find_key(candidates: List[str]) -> Optional[str]:
        keys: List[str]
        if variables:
            keys = [v["name"] for v in variables]
        elif data_rows:
            keys = list(data_rows[0].keys())
        else:
            keys = []
        keyset = {k.upper(): k for k in keys}
        for cand in candidates:
            if cand.upper() in keyset:
                return keyset[cand.upper()]
        return None

    k_output    = _find_key(["OUTPUTID","OutputId","outputId"])
    k_group1    = _find_key(["GROUP1"])
    k_group2    = _find_key(["GROUP2"])
    k_group3    = _find_key(["GROUP3"])
    k_grouping1 = _find_key(["GROUPING1"])
    k_grouping2 = _find_key(["GROUPING2"])
    k_grouping3 = _find_key(["GROUPING3"])

    label_map = {v["name"]: v.get("label") or v["name"] for v in variables}
    group_labels = {}
    if k_group1:    group_labels["GROUP1"] = label_map.get(k_group1.upper(), "Group 1")
    if k_group2:    group_labels["GROUP2"] = label_map.get(k_group2.upper(), "Group 2")
    if k_group3:    group_labels["GROUP3"] = label_map.get(k_group3.upper(), "Group 3")
    if k_grouping1: group_labels.setdefault("GROUPING1", label_map.get(k_grouping1.upper(), "Grouping 1"))
    if k_grouping2: group_labels.setdefault("GROUPING2", label_map.get(k_grouping2.upper(), "Grouping 2"))
    if k_grouping3: group_labels.setdefault("GROUPING3", label_map.get(k_grouping3.upper(), "Grouping 3"))
    groups_order = [g for g in ["GROUP1","GROUP2","GROUP3"] if g in group_labels]

    # 5) compute outputs + axis values (try both dict rows and raw matrix rows)
    outputs: List[Dict[str, Any]] = []
    row_values, col_values = [], []

    # helper to count outputs from list-of-lists using column indices
    def _matrix_counts(colname: Optional[str]) -> Counter:
        if not (isinstance(data, list) and data and isinstance(data[0], list) and columns_names and colname):
            return Counter()
        try:
            idx = [c.upper() for c in columns_names].index(colname.upper())
        except ValueError:
            return Counter()
        vals = [str(r[idx]) for r in data if isinstance(r, list) and idx < len(r) and r[idx] not in (None, "None", "")]
        return Counter(vals)

    def _matrix_values(colname: Optional[str]) -> List[str]:
        if not (isinstance(data, list) and data and isinstance(data[0], list) and columns_names and colname):
            return []
        try:
            idx = [c.upper() for c in columns_names].index(colname.upper())
        except ValueError:
            return []
        vals = [_uc(r[idx]) for r in data if isinstance(r, list) and idx < len(r) and r[idx] not in (None, "None", "")]
        return _unique_preserve_order(vals)

    if data_rows and k_output:
        cnt = Counter([str(r.get(k_output)) for r in data_rows if r.get(k_output) not in (None, "", "None")])
        for oid, n in cnt.items():
            outputs.append({"id": oid, "label": None, "rowCount": n})
        # pick a label for each output if present
        for o in outputs:
            oid = o["id"]
            sample = next((r for r in data_rows if str(r.get(k_output)) == oid), None)
            if sample:
                for cand in ["DISP","DISPLAY","LABEL","PATTERN"]:
                    if cand in sample and str(sample[cand]).strip():
                        o["label"] = str(sample[cand]).strip()
                        break

    # fallback: matrix counting (list-of-lists)
    if not outputs and k_output:
        mcnt = _matrix_counts(k_output)
        for oid, n in mcnt.items():
            outputs.append({"id": oid, "label": None, "rowCount": n})

    # axis values
    if data_rows and k_group2:
        row_values = _unique_preserve_order([_uc(r.get(k_group2)) for r in data_rows if r.get(k_group2) not in (None, "", "None")])
    if data_rows and k_group1:
        col_values = _unique_preserve_order([_uc(r.get(k_group1)) for r in data_rows if r.get(k_group1) not in (None, "", "None")])

    # fallback from matrix
    if not row_values:
        row_values = _matrix_values(k_group2)
    if not col_values:
        col_values = _matrix_values(k_group1)

    records_n = len(data_rows) if data_rows else (len(data) if isinstance(data, list) else int(meta.get("records") or 0))
    display_key = (meta.get("displayKey") if isinstance(meta, dict) else None) or _norm_id_from_filename(path)
    title = meta.get("title") if isinstance(meta, dict) else None

    entity_name = f"{display_key}_ARD_FIX"
    entity = {
        "name": entity_name,
        "label": f"ARD {entity_name}",
        "type": "tlf_ard",
        "variables": variables,
        "sourceFiles": [{
            "fileId": path.name,
            "role": "primary",
            "extractedData": ["data","variables","metadata"]
        }],
        "metadata": {
            "records": records_n,
            "structure": None,
            "validationStatus": "unknown",
            "displayKey": display_key,
            "displayId": meta.get("displayId") if isinstance(meta, dict) else None,
            "analysisId": meta.get("analysisId") if isinstance(meta, dict) else None,
            "title": title,
            "groupLabels": group_labels,
            "groupsOrder": groups_order,
            "outputs": outputs
        }
    }

    axes = {
        "rows":    {"source": "ARD", "groupKey": ("GROUP2" if k_group2 else None), "values": [{"id": v, "label": v} for v in row_values][:400]},
        "columns": {"source": "ARD", "groupKey": ("GROUP1" if k_group1 else None), "values": [{"id": v, "label": v} for v in col_values][:400]},
    }

    # realized questions from ARD (if both axes present)
    questions: List[Dict[str, Any]] = []
    if axes["rows"]["groupKey"] and axes["columns"]["groupKey"]:
        # if outputs empty, synthesize one generic so questions are still usable
        outs = outputs or [{"id": "Out_1", "label": None, "rowCount": records_n}]
        for o in outs:
            for rv in row_values[:500]:
                for cv in col_values[:50]:
                    questions.append({
                        "displayKey": display_key,
                        "outputId": str(o["id"]),
                        "rowLabel": rv,
                        "treatment": cv
                    })
        if len(questions) > 5000:
            questions = questions[:5000]

    return {
        "entity": entity,
        "displayKey": display_key,
        "title": title,
        "groupLabels": group_labels,
        "groupsOrder": groups_order,
        "axes": axes,
        "outputs": outputs,
        "questions": questions
    }

# -----------------------
# ARS parsing (richer)
# -----------------------

def _find_groupings(obj: Any) -> List[Dict[str, Any]]:
    """Recursively collect grouping objects that look like {'id':..., 'levels':[{'id':..., 'label':...}, ...]}"""
    found = []
    if isinstance(obj, dict):
        # direct pattern
        if "id" in obj and any(k in obj for k in ("levels","items","values","categories")):
            levels = obj.get("levels") or obj.get("items") or obj.get("values") or obj.get("categories")
            if isinstance(levels, list) and levels and isinstance(levels[0], dict) and ("id" in levels[0] or "code" in levels[0]):
                found.append({
                    "id": obj.get("id") or obj.get("groupingId"),
                    "levels": [{"id": (it.get("id") or it.get("code") or it.get("value")),
                                "label": (it.get("label") or it.get("name") or str(it.get("id") or it.get("code") or it.get("value")))}
                               for it in levels if isinstance(it, dict)]
                })
        for v in obj.values():
            found.extend(_find_groupings(v))
    elif isinstance(obj, list):
        for it in obj:
            found.extend(_find_groupings(it))
    return found

def _find_outputs_in_ars(obj: Any) -> List[Dict[str, Any]]:
    """Heuristic: any list of dicts with 'id' and maybe 'title'/'label' is an outputs list."""
    outs = []
    if isinstance(obj, dict):
        for k, v in obj.items():
            if isinstance(v, list) and v and isinstance(v[0], dict) and ("id" in v[0] or "outputId" in v[0]):
                for it in v:
                    oid = it.get("id") or it.get("outputId")
                    if oid is None: continue
                    lab = it.get("label") or it.get("title") or it.get("name")
                    outs.append({"id": str(oid), "label": lab, "rowCount": None})
        for v in obj.values():
            outs.extend(_find_outputs_in_ars(v))
    elif isinstance(obj, list):
        for it in obj:
            outs.extend(_find_outputs_in_ars(it))
    # dedupe by id
    uniq, seen = [], set()
    for o in outs:
        if o["id"] not in seen:
            uniq.append(o); seen.add(o["id"])
    return uniq[:50]

def parse_ars(path: Path) -> Dict[str, Any]:
    raw = _read_json(path)
    display_key = (raw.get("displayKey") or _norm_id_from_filename(path))
    title = raw.get("title") or None

    # treatment grouping
    treatment_grouping_id = None
    # quick pass
    for k, v in raw.items():
        if isinstance(v, str) and re.search(r"(TRT01AN|TREATMENT|TRT)", v, re.I):
            if "group" in k.lower():
                treatment_grouping_id = v; break
    # deep pass if needed
    if not treatment_grouping_id:
        def _walk(d):
            nonlocal treatment_grouping_id
            if isinstance(d, dict):
                for k, v in d.items():
                    if isinstance(v, str) and re.search(r"(TRT01AN|TREATMENT|TRT)", v, re.I):
                        if "group" in k.lower():
                            treatment_grouping_id = v; return
                    _walk(v)
            elif isinstance(d, list):
                for it in d: _walk(it)
        _walk(raw)

    # methods (analysis id → dataset/variable/operation/name)
    methods: Dict[str, Any] = {}
    candidates = []
    for k, v in raw.items():
        if isinstance(v, list) and re.search(r"analys|result", k, re.I):
            candidates.extend(v)
    for item in candidates:
        if not isinstance(item, dict): continue
        aid = item.get("id") or item.get("analysisId") or item.get("ANALYSISID")
        if not aid: continue
        meth = item.get("method") or item.get("operationId") or item.get("METHODID") or item.get("OPERATIONID")
        ds   = item.get("dataset") or item.get("datasetId") or item.get("DATASET")
        var  = item.get("variable") or item.get("VARIABLE")
        name = item.get("name") or item.get("label") or item.get("ANALYSIS_NAME")
        methods[str(aid)] = {"operationId": meth, "dataset": ds, "variable": var, "name": name}

    # groupings (rows/cols)
    groupings = _find_groupings(raw)
    # make a map id -> levels
    grouping_levels = {g["id"]: g["levels"] for g in groupings if g.get("id")}

    # rows → try to find a non-treatment grouping with meaningful labels
    row_group_id = None
    for gid in grouping_levels.keys():
        if gid != treatment_grouping_id:
            row_group_id = gid; break
    row_values = [{"id": str(l["id"]), "label": _uc(l["label"])} for l in grouping_levels.get(row_group_id, []) if _uc(l.get("label"))][:400]
    col_values = [{"id": str(l["id"]), "label": _uc(l["label"])} for l in grouping_levels.get(treatment_grouping_id, []) if _uc(l.get("label"))][:50]

    # outputs (if ARD doesn't give them)
    outputs = _find_outputs_in_ars(raw)

    axes = {
        "rows":    {"source": "ARS", "groupKey": row_group_id, "values": row_values},
        "columns": {"source": "ARS", "groupKey": treatment_grouping_id, "values": col_values},
    }

    # questions (cross product, capped)
    questions: List[Dict[str, Any]] = []
    outs = outputs or [{"id":"Out_1","label":None,"rowCount":None}]
    for o in outs:
        for rv in row_values[:500]:
            for cv in col_values[:50]:
                questions.append({
                    "displayKey": display_key,
                    "outputId": str(o["id"]),
                    "rowLabel": rv["label"],
                    "treatment": cv["label"]
                })
    if len(questions) > 5000:
        questions = questions[:5000]

    return {
        "displayKey": display_key,
        "title": title,
        "treatmentGroupingId": treatment_grouping_id,
        "methods": methods,
        "axes": axes,
        "outputs": outputs,
        "questions": questions
    }

# -----------------------
# Orchestrator used by main
# -----------------------

def build_tlf_index_from_uploads(sess_dir: Path, saved_files: List[Dict[str, Any]]) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    by_kind = defaultdict(list)
    for s in saved_files:
        by_kind[s["kind"]].append(s)

    tlf_entities: Dict[str, Any] = {}
    displays: Dict[str, Dict[str, Any]] = {}

    # ARD first
    for s in by_kind.get("tlf_ard_json", []):
        p = s["path"]
        try:
            ard = parse_ard(p)
            ent_key = f"TLF_ARD_{p.stem.replace('.', '-').lower()}"
            ent = ard["entity"]
            ent["sourceFiles"][0]["fileId"] = s["saved"]
            tlf_entities[ent_key] = ent

            dk = ard["displayKey"]
            displays.setdefault(dk, {
                "id": dk, "title": ard.get("title"),
                "sourceSpec": None,
                "ardFiles": [], "arsFiles": [],
                "outputs": [], "groupLabels": {}, "groupsOrder": [],
                "axes": {"rows":{"source":"ARD","groupKey":None,"values":[]},
                         "columns":{"source":"ARD","groupKey":None,"values":[]}},
                "questions": []
            })
            disp = displays[dk]
            if s["saved"] not in disp["ardFiles"]:
                disp["ardFiles"].append(s["saved"])

            # merge (prefer ARD if present)
            if ard.get("outputs"):
                disp["outputs"] = ard["outputs"]
            if ard.get("groupLabels"):
                disp["groupLabels"] = ard["groupLabels"]
            if ard.get("groupsOrder"):
                disp["groupsOrder"] = ard["groupsOrder"]
            if ard.get("axes"):
                disp["axes"] = ard["axes"]
            if ard.get("questions"):
                cap = 15000
                left = cap - len(disp["questions"])
                if left > 0:
                    disp["questions"].extend(ard["questions"][:left])

        except Exception:
            # minimal entity
            ent_key = f"TLF_ARD_{p.stem.replace('.', '-').lower()}"
            tlf_entities[ent_key] = {
                "name": p.stem.upper(),
                "label": f"ARD {p.name}",
                "type": "tlf_ard",
                "variables": [],
                "sourceFiles": [{"fileId": s["saved"], "role":"primary","extractedData":["metadata"]}],
                "metadata": {"records": 0, "structure": None, "validationStatus": "unknown"}
            }

    # ARS next (fill gaps / add methods)
    for s in by_kind.get("tlf_ars_json", []):
        p = s["path"]
        try:
            ars = parse_ars(p)
        except Exception:
            continue
        dk = ars["displayKey"]
        displays.setdefault(dk, {
            "id": dk, "title": None, "sourceSpec": None,
            "ardFiles": [], "arsFiles": [],
            "outputs": [], "groupLabels": {}, "groupsOrder": [],
            "axes": {"rows":{"source":"ARS","groupKey":None,"values":[]},
                     "columns":{"source":"ARS","groupKey":None,"values":[]}},
            "questions": []
        })
        disp = displays[dk]
        if not disp.get("title"):
            disp["title"] = ars.get("title")
        if s["saved"] not in disp["arsFiles"]:
            disp["arsFiles"].append(s["saved"])

        # prefer ARD axes/outputs, but if they’re empty use ARS
        if not disp.get("outputs"):
            disp["outputs"] = ars.get("outputs", [])
        # if axes values are empty, use ARS axes
        if not (disp.get("axes", {}).get("rows", {}).get("values")):
            disp["axes"]["rows"] = ars.get("axes", {}).get("rows", disp["axes"]["rows"])
        if not (disp.get("axes", {}).get("columns", {}).get("values")):
            disp["axes"]["columns"] = ars.get("axes", {}).get("columns", disp["axes"]["columns"])

        # questions: append if we had none from ARD
        if not disp.get("questions"):
            disp["questions"] = ars.get("questions", [])

        # analysis map
        disp["analysisMap"] = {
            "methods": ars.get("methods", {}),
            "treatmentGroupingId": ars.get("treatmentGroupingId"),
            "rowToAnalyses": disp.get("analysisMap", {}).get("rowToAnalyses", {})
        }

    tlf_index = {"displays": [displays[k] for k in sorted(displays.keys())]}
    return tlf_entities, tlf_index

# -----------------------
# Optional preview helper
# -----------------------

def simple_preview_from_index(tlf_index: Dict[str, Any], display_key: str, output_id: Optional[str]=None, limit:int=50) -> Dict[str, Any]:
    display = next((d for d in tlf_index.get("displays", []) if d.get("id")==display_key), None)
    if not display:
        return {"error": f"displayKey {display_key} not found"}

    rows = (display.get("axes") or {}).get("rows", {})
    cols = (display.get("axes") or {}).get("columns", {})
    outs = display.get("outputs") or []

    if output_id:
        outs = [o for o in outs if str(o.get("id")) == str(output_id)]

    def _shrink(ax):
        vals = _safe_list(ax.get("values"))
        if len(vals) > limit:
            vals = vals[:limit]
        return {k: v for k, v in ax.items() if k != "values"} | {"values": vals}

    return {"displayKey": display_key, "axes": {"rows": _shrink(rows), "columns": _shrink(cols)}, "outputs": outs}
