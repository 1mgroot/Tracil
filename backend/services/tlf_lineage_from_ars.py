#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
services/tlf_lineage_from_ars.py

Generalized, deterministic lineage for a specific TLF cell using ARS/ARD + session_summary.json.
- Works for AE/LB/TTE/RS/QS/etc. because it asks an LLM to parse ARS/ARD structure and normalize
  ADaM signals (dataset, value variables, filters, PARAM/PARAMCD, AVISIT, denominator source).
- Produces *only* TLF -> ADaM graph (no SDTM/CRF/Protocol heuristics). Your llm_lineage_define.py
  can then backfill ADaM -> SDTM -> CRF -> Protocol via LLM.

Inputs
------
display_id : e.g., "FDA_AE_T06" or "ARS_LB_T01"
section_label : row/section label, e.g., "Week 8 Change from Baseline"
treatment_label : column/arm label, e.g., "Xanomeline Low Dose"
measure : statistic label, e.g., "Mean", "%", "n", "Median", etc.

Output (unified shape)
----------------------
{
  "variable": "<display_id | section_label | treatment_label | measure>",
  "dataset": "table",
  "summary": "<1-line summary>",
  "lineage": {
    "nodes": [ { id, type, file?, label?, description?, explanation? } ],
    "edges": [ { from, to, label?, explanation? } ],
    "gaps":  [ { source?, target?, explanation } ]
  }
}
"""

from __future__ import annotations

import os
import re
import json
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

# LLM client
from openai import OpenAI
from openai import APIError, RateLimitError

# --------- Paths ---------
BASE_DIR   = Path(__file__).resolve().parents[1]   # backend/
OUTPUT_DIR = BASE_DIR / "output"

# --------- LLM config (ars parser) ---------
DEFAULT_MODEL = "gpt-4o-mini"
MAX_TOKENS    = 900
RETRY_TRIES   = 5
RETRY_BASE    = 1.5


# =======================
# Utilities
# =======================

def _latest_session() -> Path:
    sessions = sorted(
        [p for p in OUTPUT_DIR.glob("session_*") if p.is_dir()],
        key=lambda p: p.stat().st_mtime,
        reverse=True
    )
    if not sessions:
        raise RuntimeError("No session_* folder found under backend/output.")
    return sessions[0]


def _load_session_summary(sess_dir: Path) -> Dict[str, Any]:
    ss = sess_dir / "session_summary.json"
    if not ss.exists():
        raise RuntimeError(f"session_summary.json not found in {sess_dir}")
    return json.loads(ss.read_text(encoding="utf-8", errors="ignore"))


def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", (s or "").lower()).strip()


def _dedup_nodes(nodes: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    out, seen = [], set()
    for n in nodes:
        nid = n.get("id")
        if nid and nid not in seen:
            seen.add(nid)
            out.append(n)
    return out


def _ensure_edge_nodes_exist(edges: List[Dict[str, Any]], nodes: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    node_ids = {n["id"] for n in nodes if "id" in n}
    clean = [e for e in edges if e.get("from") in node_ids and e.get("to") in node_ids]
    return clean


def _retry(fn, *args, **kwargs):
    last = None; delay = RETRY_BASE
    for _ in range(RETRY_TRIES):
        try:
            return fn(*args, **kwargs)
        except (APIError, RateLimitError) as e:
            last = e; time.sleep(delay); delay *= 2
        except Exception as e:
            last = e; break
    if last: raise last


def _make_client() -> OpenAI:
    key = os.getenv("OPENAI_API_KEY")
    if not key:
        raise RuntimeError("OPENAI_API_KEY not set")
    return OpenAI(api_key=key)


def _safe_json_dumps(obj: Any, max_len: int = 20000) -> str:
    try:
        s = json.dumps(obj, indent=2)
    except Exception:
        s = str(obj)
    return s[:max_len]


# =======================
# LLM ARS/ARD PARSER
# =======================

def _llm_extract_ars_signals(
    *,
    ars_texts: List[str],
    analysis_map_text: Optional[str],
    display_id: str,
    section_label: str,
    treatment_label: str,
    measure: str,
    model: str = DEFAULT_MODEL
) -> Dict[str, Any]:
    """
    Ask the LLM to read ARS/ARD JSON fragments + the specific display's analysisMap
    and normalize what powers THIS cell.

    Returns a dict like:
    {
      "dataset": "ADLB",
      "value_vars": ["ADLB.CHG", "ADLB.AVAL"],
      "filters": {
        "analysis_set": "ADSL.SAFFL='Y'",
        "treatment_var": "ADSL.TRT01AN",
        "subset": ["PARAMCD=ALT", "AVISIT=Week 8"]
      },
      "row_logic": ["CHG from baseline", "Baseline=AVAL at Visit=Week 0"],
      "denominator": {"type": "%", "source": "An_30"},
      "evidence": {
        "methods": ["An_82","An_85"],
        "groupings": ["AnlsGrouping_51_Chg","AnlsGrouping_47_Trt01An"],
        "quotes": ["short literal cites from ARS..."]
      }
    }
    """
    # Trim big blobs to keep tokens sane
    limited_ars = [txt[:18000] for txt in (ars_texts or [])]
    am_txt = (analysis_map_text or "")[:10000]

    client = _make_client()

    SYSTEM = (
        "You are a senior CDISC/ADaM expert. Read ARS/ARD JSON fragments and the display's analysisMap "
        "to identify ADaM signals for a single TLF cell. Be literal and grounded in the given texts; "
        "do not invent variables that are not implied. Prefer PARAM/PARAMCD, AVISIT/AVISITN, TRTxxAN, "
        "SAFFL, analysis method ids (An_xx), grouping ids, and short literal quotes for evidence. "
        "If not enough evidence exists, return best candidates and mark ambiguity with short quotes."
    )

    SCHEMA = (
        "{"
        "  'dataset': '<ADaM dataset name or null>',"
        "  'value_vars': ['<DS.VAR>', ...],"
        "  'filters': {"
        "     'analysis_set': '<ADSL flag expr or null>',"
        "     'treatment_var': '<ADSL.TRTxxAN or null>',"
        "     'subset': ['<key=value or expr>', ...]"
        "  },"
        "  'row_logic': ['<expr>', ...],"
        "  'denominator': {'type': '<N|%|other|null>', 'source': '<An_xx/description or null>'},"
        "  'evidence': {"
        "     'methods': ['An_xx', ...],"
        "     'groupings': ['<GroupingId>', ...],"
        "     'quotes': ['<short literal cites from ARS/ARD or analysisMap>', ...]"
        "  }"
        "}"
    )

    USER = (
        f"Display: {display_id}\n"
        f"Row/Section: {section_label}\n"
        f"Column/Treatment: {treatment_label}\n"
        f"Measure/Statistic: {measure}\n\n"
        f"analysisMap (for this display):\n{am_txt}\n\n"
        f"ARS/ARD FRAGMENTS (each truncated):\n" +
        "\n\n".join(f"[ARS_{i}]\n{t}" for i, t in enumerate(limited_ars))
    )

    resp = _retry(
        client.chat.completions.create,
        model=model,
        temperature=0.0,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": "Return ONLY JSON matching this schema:\n" + SCHEMA + "\n\n" + USER}
        ],
        max_tokens=MAX_TOKENS,
    )

    parsed = json.loads(resp.choices[0].message.content)

    # light normalization
    parsed["dataset"] = (parsed.get("dataset") or "").strip() or None
    parsed["value_vars"] = [v.strip() for v in (parsed.get("value_vars") or []) if v and isinstance(v, str)]
    flt = parsed.get("filters") or {}
    parsed["filters"] = {
        "analysis_set": (flt.get("analysis_set") or "").strip() or None,
        "treatment_var": (flt.get("treatment_var") or "").strip() or None,
        "subset": [s.strip() for s in (flt.get("subset") or []) if s and isinstance(s, str)]
    }
    den = parsed.get("denominator") or {}
    parsed["denominator"] = {
        "type": (den.get("type") or "").strip() or None,
        "source": (den.get("source") or "").strip() or None
    }
    ev = parsed.get("evidence") or {}
    parsed["evidence"] = {
        "methods": [m.strip() for m in (ev.get("methods") or []) if m],
        "groupings": [g.strip() for g in (ev.get("groupings") or []) if g],
        "quotes": [q.strip() for q in (ev.get("quotes") or []) if q]
    }
    parsed["row_logic"] = [r.strip() for r in (parsed.get("row_logic") or []) if r]

    return parsed


# =======================
# Main builder
# =======================

def build_table_lineage_from_ars(
    *,
    display_id: str,
    section_label: str,
    treatment_label: str,
    measure: str,
    session_dir: Optional[Path] = None,
    model: str = DEFAULT_MODEL
) -> Dict[str, Any]:
    """
    Deterministic lineage for a TLF cell using ARS/ARD + tlfIndex.displays.

    Returns unified lineage JSON where TLF→ADaM nodes/edges are grounded by ARS/ARD.
    No SDTM/CRF/Protocol bridges are added here (LLM backfill handles that later).
    """
    sess = session_dir or _latest_session()
    summary = _load_session_summary(sess)

    tlf_meta = (summary.get("standards", {})
                      .get("TLF", {})
                      .get("metadata", {}) or {})
    displays = (tlf_meta.get("tlfIndex", {}) or {}).get("displays", []) or []

    # 1) locate display
    did_norm = _norm(display_id)
    disp = None
    for d in displays:
        if _norm(d.get("id", "")) == did_norm:
            disp = d; break
    if not disp:
        for d in displays:
            if did_norm in _norm(d.get("id", "")) or did_norm in _norm(d.get("title", "")):
                disp = d; break
    if not disp:
        raise RuntimeError(f"Display '{display_id}' not found in tlfIndex.displays.")

    # 2) collect ARS/ARD texts that mention this display and the display's analysisMap
    ars_texts: List[str] = []
    for p in sorted(sess.glob("*.json")):
        nm = p.name.lower()
        if nm.endswith(("-ars.json", "-ard.json")):
            txt = p.read_text(encoding="utf-8", errors="ignore")
            if did_norm in _norm(txt):
                ars_texts.append(txt)

    analysis_map = (disp.get("analysisMap") or {})
    analysis_map_text = _safe_json_dumps(analysis_map)

    # 3) LLM normalize signals from ARS/ARD
    try:
        signals = _llm_extract_ars_signals(
            ars_texts=ars_texts,
            analysis_map_text=analysis_map_text,
            display_id=disp.get("id"),
            section_label=section_label,
            treatment_label=treatment_label,
            measure=measure,
            model=model
        )
    except Exception as e:
        # fall back: return minimal cell with gap
        cell_label = f"{disp.get('id')} | {section_label} | {treatment_label} | {measure}"
        return {
            "variable": cell_label,
            "dataset": "table",
            "summary": f"{cell_label}: ARS/ARD parsing error.",
            "lineage": {
                "nodes": [
                    {
                        "id": "tlf_cell",
                        "type": "display",
                        "file": "TLF",
                        "label": cell_label,
                        "explanation": "[direct] Cell defined by display id, row/section, column/treatment, and measure."
                    },
                    { "id": cell_label, "type": "target" }
                ],
                "edges": [],
                "gaps": [ { "explanation": f"ARS/ARD parse error: {e}" } ]
            }
        }

    # 4) Build nodes/edges deterministically from signals
    nodes: List[Dict[str, Any]] = []
    edges: List[Dict[str, Any]] = []
    gaps : List[Dict[str, Any]] = []

    cell_label = f"{disp.get('id')} | {section_label} | {treatment_label} | {measure}"
    nodes.append({
        "id": "tlf_cell",
        "type": "display",
        "file": "TLF",
        "label": cell_label,
        "explanation": "[direct] Cell defined by display id, row/section, column/treatment, and measure."
    })

    # Evidence node (optional, for UI transparency)
    ev = signals.get("evidence") or {}
    ev_methods   = ", ".join(ev.get("methods") or [])
    ev_groupings = ", ".join(ev.get("groupings") or [])
    ev_quotes    = "; ".join(ev.get("quotes") or [])[:600]
    if ev_methods or ev_groupings or ev_quotes:
        nodes.append({
            "id": "ars_context",
            "type": "source",
            "file": "ARS",
            "label": f"Methods: {ev_methods} | Groupings: {ev_groupings}",
            "explanation": "[direct] Evidence from ARS/ARD and analysisMap: " + (ev_quotes or "no quotes")
        })
        edges.append({
            "from": "ars_context",
            "to": "tlf_cell",
            "label": "Planned analysis/evidence",
            "explanation": "[direct] Methods/groupings referenced by ARS/ARD for this display."
        })

    # Value variables
    value_vars = signals.get("value_vars") or []
    for vv in value_vars:
        nodes.append({
            "id": vv,
            "type": "ADaM variable",
            "file": "ADaM",
            "label": vv,
            "explanation": "[direct] Referenced by ARS/ARD for this cell."
        })
        edges.append({
            "from": vv,
            "to": "tlf_cell",
            "label": f"Compute {measure}",
            "explanation": "[direct] Aggregation/statistic applied to the value variable."
        })

    # Filters: analysis set flag, treatment var, subset selectors
    flt = signals.get("filters") or {}
    if flt.get("analysis_set"):
        # If it mentions ADSL.SAFFL='Y', add node ADSL.SAFFL (not the whole expr)
        if "adsl.saffl" in _norm(flt["analysis_set"]):
            nodes.append({
                "id": "ADSL.SAFFL",
                "type": "ADaM variable",
                "file": "ADaM",
                "label": "ADSL.SAFFL",
                "explanation": "[direct] Analysis set specified in ARS/ARD."
            })
            for vv in value_vars or ["tlf_cell"]:
                edges.append({
                    "from": "ADSL.SAFFL",
                    "to": vv if vv != "tlf_cell" else "tlf_cell",
                    "label": "Population filter",
                    "explanation": "[direct] From ARS AnalysisSet."
                })
        else:
            # keep generic analysis_set expression as its own node
            nid = f"analysis_set::{flt['analysis_set']}"
            nodes.append({
                "id": nid,
                "type": "ADaM subset",
                "file": "ADaM",
                "label": flt["analysis_set"],
                "explanation": "[direct] Analysis set specification from ARS/ARD."
            })
            for vv in value_vars or ["tlf_cell"]:
                edges.append({"from": nid, "to": vv, "label": "Population filter",
                              "explanation": "[direct] From ARS AnalysisSet."})

    if flt.get("treatment_var"):
        tvar = flt["treatment_var"]
        nodes.append({
            "id": tvar,
            "type": "ADaM variable",
            "file": "ADaM",
            "label": tvar,
            "explanation": "[direct] Treatment grouping used by ARS/ARD."
        })
        for vv in value_vars or ["tlf_cell"]:
            edges.append({
                "from": tvar,
                "to": vv,
                "label": "Treatment subset",
                "explanation": "[direct] From ARS grouping."
            })

    for sel in (flt.get("subset") or []):
        nid = f"subset::{sel}"
        nodes.append({
            "id": nid,
            "type": "ADaM subset",
            "file": "ADaM",
            "label": sel,
            "explanation": "[direct] Selector derived from ARS/ARD (e.g., PARAMCD/AVISIT)."
        })
        for vv in value_vars or ["tlf_cell"]:
            edges.append({
                "from": nid,
                "to": vv,
                "label": "Subset",
                "explanation": "[direct] From ARS/ARD grouping."
            })

    # Denominator (for %)
    den = signals.get("denominator") or {}
    meas_norm = (measure or "").strip()
    if (meas_norm == "%") or (den.get("type") == "%"):
        nodes.append({
            "id": "denominator",
            "type": "calc",
            "label": f"N source={den.get('source') or 'unspecified'}",
            "explanation": "[direct] Denominator source per ARS/ARD (e.g., An_30)."
        })
        # show relation n -> N -> cell
        for vv in value_vars or []:
            edges.append({
                "from": vv,
                "to": "denominator",
                "label": "n feeds N",
                "explanation": "[reasoned] For percent, numerator contributes to denominator context."
            })
        edges.append({
            "from": "denominator",
            "to": "tlf_cell",
            "label": "Compute %",
            "explanation": "[reasoned] % = n / N."
        })

    # Target id (for unified schema)
    nodes.append({
        "id": cell_label,
        "type": "target"
    })

    nodes = _dedup_nodes(nodes)
    edges = _ensure_edge_nodes_exist(edges, nodes)

    # 5) Summary & gaps
    if not value_vars:
        gaps = [{"explanation": "No ADaM variables referenced by ARS/ARD for this row were detected."}]

    ds = signals.get("dataset") or "ADaM"
    vv_txt = ", ".join(value_vars) if value_vars else "unspecified"
    methods_txt = ", ".join(ev.get("methods") or []) or "not specified"
    summary_txt = (
        f"{cell_label}: ARS/ARD indicate the cell is computed using {ds} variable(s) [{vv_txt}] "
        f"with measure '{measure}'. Methods: {methods_txt}."
    )

    return {
        "variable": cell_label,
        "dataset": "table",
        "summary": summary_txt,
        "lineage": {
            "nodes": nodes,
            "edges": edges,
            "gaps": gaps
        }
    }
