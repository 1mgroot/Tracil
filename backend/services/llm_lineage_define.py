#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
services/llm_lineage_define.py

LLM-driven lineage builder for:
  1) Variable lineage across Protocol → CRF → SDTM → ADaM → TLF
  2) Endpoint/SoA lineage centered on protocol endpoint concepts
  3) Table lineage:
        (a) Titles-only (combined TLF; dataset-level inference)
        (b) define.xml Analysis Results present (variable-level)
        (c) ARS/ARD cell query → ARS-only LLM matching of the requested cell/output,
            then LLM backtrace from identified ADaM parents to SDTM → CRF → Protocol.

Unified output schema (all builders):
{
  "variable": "<name or concept>",
  "dataset": "<DS|'endpoint'|'table'>",
  "summary": "<one-sentence overview>",
  "lineage": {
    "nodes": [ { id, type, file?, label?, description?, explanation? } ],
    "edges": [ { from, to, label?, explanation? } ],
    "gaps":  [ { source?, target?, explanation } ]
  }
}

Notes
- Explanations replace confidence scores. Use:
  [direct] exact file/section/page/field + short snippet
  [reasoned] brief reasoning from nearby evidence
  [general] general CDISC knowledge / conventions
- Evidence assembly reads: define/spec (XML/HTML/XLSX), protocol text,
  aCRF index CSV, TLF titles, USDM design, and ARS/ARD JSONs.

Important: This module avoids heuristic validators and only uses the LLM + uploaded
artifacts. We also de-duplicate nodes by (type, normalized id) and remap edges so
aliases like "Table_14-1.01" vs "table 14-1.01" collapse into one node.
"""

from __future__ import annotations

import os, re, json, time
from pathlib import Path
from typing import Any, Dict, List, Optional, Iterable, Tuple
from contextlib import contextmanager

import numpy as np
from openai import OpenAI
from openai import APIError, RateLimitError

try:
    import pandas as pd
except Exception:
    pd = None

# ---------------- params ----------------
DEFAULT_MODEL   = "gpt-4o"
FALLBACK_MODEL  = "gpt-4o-mini"
EMBED_MODEL     = "text-embedding-3-small"

MAX_CHARS       = 900
OVERLAP         = 100
TOP_K           = 12
EMBED_BATCH     = 64
MAX_INPUTS      = 1500
MAX_TOKENS      = 1400
RETRY_TRIES     = 5
RETRY_BASE_WAIT = 1.5

BASE_DIR   = Path(__file__).resolve().parents[1]
OUTPUT_DIR = BASE_DIR / "output"

# ---------------- utils ----------------

def _retry(fn, *args, **kwargs):
    tries = RETRY_TRIES; delay = RETRY_BASE_WAIT; last = None
    for _ in range(tries):
        try:
            return fn(*args, **kwargs)
        except (RateLimitError, APIError) as e:
            last = e; time.sleep(delay); delay *= 2
        except Exception as e:
            last = e; break
    if last: raise last

def _make_client() -> OpenAI:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY environment variable is not set.")
    return OpenAI(api_key=api_key)

@contextmanager
def _use_embed_model(tmp_model: Optional[str]):
    """Temporarily switch the embedding model; always restore."""
    global EMBED_MODEL
    old = EMBED_MODEL
    if tmp_model:
        EMBED_MODEL = tmp_model
    try:
        yield
    finally:
        EMBED_MODEL = old

def _latest_session() -> Path:
    sessions = sorted([p for p in OUTPUT_DIR.glob("session_*") if p.is_dir()],
                      key=lambda p: p.stat().st_mtime, reverse=True)
    if not sessions:
        raise RuntimeError("No session_* folder found under backend/output.")
    return sessions[0]

def _load_session_summary(sess_dir: Path) -> Dict[str, Any]:
    ss = sess_dir / "session_summary.json"
    if not ss.exists():
        raise RuntimeError(f"session_summary.json not found in {sess_dir}")
    return json.loads(ss.read_text(encoding="utf-8", errors="ignore"))

def _read_text_file(p: Path) -> str:
    try:
        return p.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return p.read_text(errors="ignore")

def _read_json_file_text(p: Path) -> str:
    try:
        return json.dumps(json.loads(p.read_text(encoding="utf-8", errors="ignore")), indent=2)
    except Exception:
        return p.read_text(encoding="utf-8", errors="ignore")

def _read_excel_as_text(p: Path) -> str:
    if pd is None:
        return f"[EXCEL_READ_ERROR: pandas not installed] {p.name}"
    try:
        xl = pd.ExcelFile(p)
        blocks = []
        for sh in xl.sheet_names:
            df = xl.parse(sh, dtype=str).fillna("")
            if df.empty: continue
            df.columns = [str(c).strip() for c in df.columns]
            likely = [c for c in df.columns if re.search(r"(var|variable|name)$", c, re.I)]
            extra  = [c for c in df.columns if c not in likely]
            lines = []
            for _, row in df.iterrows():
                left  = " / ".join([row.get(c, "") for c in likely if row.get(c)]) if likely else ""
                right = "; ".join([f"{c}={row.get(c,'')}" for c in extra if row.get(c)])
                line  = (f"{left} :: {right}").strip(" :")
                if len(line) > 2: lines.append(line)
            if lines:
                blocks.append(f"[SHEET: {sh}]\n" + "\n".join(lines))
        return f"[EXCEL_SPEC: {p.name}]\n" + ("\n\n".join(blocks) if blocks else "[EMPTY]")
    except Exception as e:
        return f"[EXCEL_READ_ERROR {p.name}] {e}"

def _read_define_or_spec_text(p: Path) -> str:
    ext = p.suffix.lower()
    if ext in (".xml", ".html", ".htm"):
        return _read_text_file(p)
    if ext in (".xlsx", ".xlsm", ".xls"):
        return _read_excel_as_text(p)
    return _read_text_file(p)

def _read_crf_index_csv_text(p: Path) -> str:
    if not p.exists():
        return "[CRF_INDEX] [MISSING]"
    import csv
    lines = []
    with open(p, "r", encoding="utf-8", errors="ignore") as f:
        r = csv.DictReader(f)
        for row in r:
            var = (row.get("var") or row.get("VAR") or "").strip()
            page = (row.get("page") or row.get("PAGE") or "").strip()
            ctx = (row.get("context") or row.get("CONTEXT") or "").strip()
            if var:
                lines.append(f"CRF_VAR={var} | PAGE={page} | CONTEXT={ctx}")
    return "[CRF_INDEX]\n" + ("\n".join(lines) if lines else "[EMPTY]")

def _chunk_text(docid: str, text: str, max_chars=MAX_CHARS, overlap=OVERLAP) -> List[Dict[str, str]]:
    chunks=[]; i=0; n=len(text)
    while i < n:
        j = min(n, i+max_chars)
        if j < n:
            k = text.rfind("\n", i, j)
            if k > -1 and (j-k) < 200: j = k
        chunks.append({"id": f"{docid}#{len(chunks)}", "text": text[i:j]})
        i = max(j-overlap, j)
    return chunks

def _prefilter_chunks(chunks: List[Dict[str, str]], target: str) -> List[Dict[str, str]]:
    target_u = target.upper()
    toks = set([t for t in target_u.replace(".", " ").split() if len(t) >= 3])
    toks |= {"CRF","PROTOCOL","SDTM","ADAM","TLF","DERIV","DERIVED","SOURCE","MAP",
             "LINK","VAR","VARIABLE","ENDPOINT","SOA","ANALYSIS","RESULT","TABLE"}
    scored=[]
    for c in chunks:
        T = c["text"].upper()
        score = sum(1 for tok in toks if tok in T)
        scored.append((score, c))
    scored.sort(key=lambda x: x[0], reverse=True)
    keep = min(MAX_INPUTS, max(300, len(scored)))
    return [c for _, c in scored[:keep]]

def _batch(xs: List[Any], n: int) -> Iterable[List[Any]]:
    for i in range(0, len(xs), n):
        yield xs[i:i+n]

def _embed(client: OpenAI, texts: List[str]) -> np.ndarray:
    vecs=[]
    for group in _batch(texts, EMBED_BATCH):
        resp = _retry(client.embeddings.create, model=EMBED_MODEL, input=group)
        vecs.extend([np.array(d.embedding, dtype=np.float32) for d in resp.data])
    return np.vstack(vecs)

def _cosine(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    a = a/(np.linalg.norm(a, axis=1, keepdims=True)+1e-8)
    b = b/(np.linalg.norm(b, axis=1, keepdims=True)+1e-8)
    return a @ b.T

def _retrieve(client: OpenAI, chunks: List[Dict[str,str]], query: str, k:int=TOP_K) -> List[Dict[str,str]]:
    chunks = _prefilter_chunks(chunks, query)
    texts  = [c["text"] for c in chunks]
    if not texts:
        return []
    C = _embed(client, texts)
    q = _embed(client, [query])
    sims = _cosine(q, C).ravel()
    idx = sims.argsort()[::-1][:k]
    return [chunks[i] for i in idx]

def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", (s or "").lower()).strip()

# --------------- evidence assembly ----------------

def _collect_evidence_texts(sess_dir: Path, summary: Dict[str, Any]) -> List[Tuple[str, str]]:
    out: List[Tuple[str,str]] = []
    file_index: Dict[str, Path] = {}
    for sf in summary.get("metadata",{}).get("sourceFiles", []):
        fid = sf.get("filename") or sf.get("id")
        if not fid: continue
        file_index[fid] = sess_dir / fid

    def add_define_block(std_key: str, label: str):
        std = summary.get("standards",{}).get(std_key, {})
        for _, ent in (std.get("datasetEntities") or {}).items():
            if not ent.get("sourceFiles"): continue
            for sf in ent["sourceFiles"]:
                fid = sf.get("fileId")
                if not fid: continue
                p = file_index.get(fid)
                if not p or not p.exists(): continue
                if p.suffix.lower() in (".xml",".html",".htm",".xlsx",".xlsm",".xls"):
                    txt = _read_define_or_spec_text(p)
                    out.append((f"{label}::{p.name}", txt))
                    break
            break

    add_define_block("ADaM", "ADaM")
    add_define_block("SDTM", "SDTM")

    crf = summary.get("standards",{}).get("CRF",{}).get("datasetEntities",{}).get("aCRF")
    if crf:
        meta = crf.get("metadata",{})
        fid  = meta.get("varIndexCsv")
        if fid and (sess_dir / fid).exists():
            txt = _read_crf_index_csv_text(sess_dir / fid)
            out.append((f"CRF_INDEX::{fid}", txt))

    proto = summary.get("standards",{}).get("Protocol",{}).get("datasetEntities",{}).get("Protocol")
    if proto:
        meta = proto.get("metadata",{})
        fid  = meta.get("textFile")
        if fid and (sess_dir / fid).exists():
            txt = _read_text_file(sess_dir / fid)
            out.append((f"PROTOCOL::{fid}", txt))

    for key, ent in (summary.get("standards",{}).get("TLF",{}).get("datasetEntities") or {}).items():
        meta = ent.get("metadata",{})
        titles = meta.get("titles") or []
        if titles:
            joined = "\n".join([f"{t.get('id')}: {t.get('title')}" for t in titles[:200]])
            out.append((f"TLF_TITLES::{key}", "[TLF_TITLES]\n"+joined))

    # USDM/SoA if present
    prot = summary.get("standards",{}).get("Protocol",{})
    usdm_ent = prot.get("datasetEntities",{}).get("StudyDesign_USDM")
    if usdm_ent:
        md = usdm_ent.get("metadata",{}).get("design") or {}
        txt = "[USDM_DESIGN]\n" + json.dumps(md, indent=2)
        out.append(("USDM::design", txt))

    # ARS/ARD JSONs (for retrieval context only)
    for p in sorted(sess_dir.glob("*.json")):
        if p.name.lower().endswith(("-ars.json","-ard.json")):
            out.append((f"ARS::{p.name}", _read_json_file_text(p)))

    return out

def _collect_table_evidence(sess_dir: Path, summary: Dict[str, Any], display_id: str) -> List[Tuple[str,str]]:
    """
    Focused evidence for a specific display id:
      - matching TLF titles / index entry for that display
      - define.xml (ADaM) text
      - protocol text + USDM design
      - matching ARS/ARD JSONs (contains display id substring)
    """
    out = []
    did_norm = _norm(display_id)

    # TLF titles subset
    tlf_meta = (summary.get("standards", {}).get("TLF", {}).get("metadata", {}) or {})
    displays = (tlf_meta.get("tlfIndex", {}) or {}).get("displays", []) or []
    for d in displays:
        if did_norm in _norm(d.get("id","")) or did_norm in _norm(d.get("title","")):
            out.append((f"TLF_INDEX::{d.get('id')}", json.dumps(d, indent=2)))

    # define/spec (ADaM)
    out.extend([b for b in _collect_evidence_texts(sess_dir, summary) if b[0].startswith("ADaM::")])

    # protocol text + USDM
    out.extend([b for b in _collect_evidence_texts(sess_dir, summary) if b[0].startswith("PROTOCOL::") or b[0].startswith("USDM::")])

    # ARS/ARD files that mention the display id
    for p in sorted(sess_dir.glob("*.json")):
        nm = p.name.lower()
        if nm.endswith(("-ars.json","-ard.json")):
            txt = _read_json_file_text(p)
            if did_norm in _norm(txt):
                out.append((f"ARS::{p.name}", txt))

    # General TLF titles block
    for b in _collect_evidence_texts(sess_dir, summary):
        if b[0].startswith("TLF_TITLES::"):
            out.append(b)

    return out

# ---------------- ARS-only helpers ----------------

def _is_cell_spec(s: str) -> bool:
    """Treat any '|' separated string as a user-specified TLF cell/output spec (flexible arity)."""
    return isinstance(s, str) and ("|" in s)

def _collect_ars_texts_only(sess_dir: Path) -> List[Tuple[str, str]]:
    """Collect only ARS/ARD JSONs from the current session."""
    out = []
    for p in sorted(sess_dir.glob("*.json")):
        nm = p.name.lower()
        if nm.endswith(("-ars.json", "-ard.json")):
            out.append((f"ARS::{p.name}", _read_json_file_text(p)))
    return out

# ---------------- prompt schemas ----------------

def _variable_prompt_schema() -> str:
    return (
        "{\n"
        "  'variable': '<VAR>',\n"
        "  'dataset': '<DS>',\n"
        "  'summary': '<one-sentence how/why mapping>',\n"
        "  'lineage': {\n"
        "    'nodes': [ {id, type, file?, label?, description?, explanation?} ],\n"
        "    'edges': [ {from, to, label?, explanation?} ],\n"
        "    'gaps':  [ {source?, target?, explanation} ]\n"
        "  }\n"
        "}\n"
    )

def _endpoint_prompt_schema() -> str:
    return (
        "{\n"
        "  'variable': '<endpoint or soa term>',\n"
        "  'dataset': 'endpoint',\n"
        "  'summary': '<overview of flow from protocol endpoint/SoA → CRF → SDTM → ADaM → TLF>',\n"
        "  'lineage': {\n"
        "    'nodes': [ {id, type, file?, label?, description?, explanation?} ],\n"
        "    'edges': [ {from, to, label?, explanation?} ],\n"
        "    'gaps':  [ {source?, target?, explanation} ]\n"
        "  }\n"
        "}\n"
    )

def _table_prompt_schema() -> str:
    return (
        "{\n"
        "  'variable': '<display id or cell spec>',\n"
        "  'dataset': 'table',\n"
        "  'summary': '<how the TLF maps back to ADaM/SDTM/CRF/Protocol>',\n"
        "  'lineage': {\n"
        "    'nodes': [ {id, type, file?, label?, description?, explanation?} ],\n"
        "    'edges': [ {from, to, label?, explanation?} ],\n"
        "    'gaps':  [ {source?, target?, explanation} ]\n"
        "  }\n"
        "}\n"
    )

# ---------------- prompts (variable/endpoint/table) ----------------

def _build_messages_for_variable(target_ds: str, target_var: str, retrieved: List[Dict[str,str]]) -> List[Dict[str,str]]:
    SYSTEM = (
        "You are a senior CDISC standards expert helping to build a TOOL for TRACEABILITY "
        "across CDISC layers (Protocol → CRF → SDTM → ADaM → TLF).\n"
        "Task: Construct a detailed and EXHAUSTIVE variable lineage graph for an SDTM or ADaM variable.\n\n"
        "Backtrace: Protocol (exact section/page) → CRF (page/field) → SDTM (DOMAIN.VAR)\n"
        "Forward: SDTM → ADaM (dataset.variable) → TLF (table IDs/titles if available)\n\n"
        "Rules:\n"
        "- Always resolve to exact variable level (e.g., SDTM.DM.AGE not SDTM.DM).\n"
        "- For ADaM variables: capture ALL plausible SDTM parents and CRF/Protocol anchors; include intermediate ADaM helpers (e.g., BASE, AVAL, CHG).\n"
        "- For SDTM variables: capture downstream ADaM children, then TLFs.\n"
        "- Provide specific Protocol/SAP sections and CRF page fields if available from evidence; prefer [direct] with file anchors.\n"
        "- Unlimited nodes/edges are allowed; do not truncate related parents/children.\n"
        "- IMPORTANT: Provide an 'explanation' string on EVERY node and edge:\n"
        "   Use: [direct] ... ; [reasoned] ... ; [general] ...\n"
        "- Output STRICT JSON only in this schema:\n"
        + _variable_prompt_schema() +
        "- Use ONLY 'from' and 'to' for edges (NOT 'source'/'target').\n"
        "- Ensure every edge refers to an existing node id; avoid duplicate nodes.\n"
        "- Node 'type' taxonomy: 'protocol section', 'crf page', 'sdtm variable', 'adam variable', 'tlf display'.\n"
    )
    EVIDENCE = "\n\n--- EVIDENCE ---\n"
    for c in retrieved:
        EVIDENCE += f"\n[CHUNK {c['id']}]\n{c['text'][:2400]}\n"
    USER = (
        f"Target variable: {target_ds}.{target_var}\n"
        f"Build the full, exhaustive traceability graph now.\n"
        f"{EVIDENCE}"
    )
    return [{"role":"system","content":SYSTEM},{"role":"user","content":USER}]

def _build_messages_for_endpoint(endpoint_term: str, retrieved: List[Dict[str,str]]) -> List[Dict[str,str]]:
    SYSTEM = (
        "You are a senior CDISC standards expert building a PROTOCOL-ENDPOINT lineage map.\n"
        "Center the graph on the protocol endpoint/SoA concept (not variable-level), then link:\n"
        "  Protocol Endpoint/SoA → CRF Form(s)/Section(s) → SDTM Domain(s) → ADaM Dataset(s) → TLF Display(s).\n\n"
        "Rules:\n"
        "- Nodes should be conceptual except for dataset/domain identifiers.\n"
        "- Provide an 'explanation' on EVERY node and edge with one of: [direct], [reasoned], [general].\n"
        "- Output STRICT JSON only in this schema:\n"
        + _endpoint_prompt_schema() +
        "- Use ONLY 'from' and 'to' for edges; ensure all edge endpoints exist and avoid duplicate nodes.\n"
        "- Node 'type' taxonomy: 'protocol endpoint', 'crf form', 'sdtm domain', 'adam dataset', 'tlf display'.\n"
    )
    EVIDENCE = "\n\n--- EVIDENCE ---\n"
    for c in retrieved:
        EVIDENCE += f"\n[CHUNK {c['id']}]\n{c['text'][:2400]}\n"
    USER = (
        f"Endpoint/SoA term: {endpoint_term}\n"
        f"Build the endpoint-centric lineage graph now.\n"
        f"{EVIDENCE}"
    )
    return [{"role":"system","content":SYSTEM},{"role":"user","content":USER}]

def _build_messages_for_table(display_id: str, mode: str, retrieved: List[Dict[str,str]]) -> List[Dict[str,str]]:
    """
    mode:
      - 'titles_only' : only titles/combined TLF available → dataset-level inference (no var-level)
      - 'define_ar'   : define.xml with Analysis Results present → variable-level
      - 'ars_display' : ARS/ARD present (table-level summary via ARS evidence, not single cell)
    """
    rules_common = (
        "Provide an 'explanation' on EVERY node and edge using one of: [direct], [reasoned], [general]. "
        "[direct] must cite file and exact anchor when possible (e.g., define.xml path, ARS method id, or TLF title id). "
        "Use ONLY 'from' and 'to' in edges; ensure all edge endpoints exist; avoid duplicate nodes. "
        "Node 'type' taxonomy: 'protocol section', 'crf page', 'sdtm variable'/'sdtm domain', 'adam variable'/'adam dataset', 'tlf display'.\n"
        "Enumerate ALL relevant parents/children; unlimited nodes/edges allowed.\n"
    )

    if mode == "titles_only":
        MODE_TXT = (
            "SITUATION: Only combined TLF titles (no define.xml Analysis Results, no ARS).\n"
            "Goal: Infer high-level lineage at the DATASET level (not variable-level):\n"
            "- TLF Display → ADaM dataset(s) likely used\n"
            "- ADaM dataset(s) → SDTM domain(s) likely sourced\n"
            "- SDTM domain(s) → CRF form(s) likely captured\n"
            "- Protocol/SAP endpoint(s) related to the display\n"
            "Avoid specific variable names in this mode. Keep nodes at dataset/domain/form/endpoint level.\n"
        )
    elif mode == "define_ar":
        MODE_TXT = (
            "SITUATION: define.xml contains Analysis Results metadata for the display.\n"
            "Goal: Build variable-level lineage using define evidence:\n"
            "- TLF Display → ADaM variable(s) listed in Analysis Result → SDTM variable parent(s) if identifiable → CRF anchors.\n"
            "- Expand to include ALL related ADaM helpers (e.g., BASE, AVAL, CHG) and show their SDTM parents.\n"
            "- Add specific Protocol/SAP section relevant to the display.\n"
        )
    else:  # ars_display
        MODE_TXT = (
            "SITUATION: ARS/ARD JSONs are available for this display (table-level summary, not a single cell).\n"
            "Goal: Summarize the ADaM variables and filters used across the display per ARS, "
            "then map back to SDTM parents and CRF anchors. Include Protocol/SAP linkage. "
            "Prefer variable-level details when ARS reveals them.\n"
        )

    SYSTEM = (
        "You are a senior CDISC standards expert building a TABLE lineage map for a single display.\n"
        + MODE_TXT +
        "Output STRICT JSON only in this schema:\n"
        + _table_prompt_schema() +
        rules_common
    )
    EVIDENCE = "\n\n--- EVIDENCE (TLF index / define / ARS / protocol / USDM) ---\n"
    for c in retrieved:
        EVIDENCE += f"\n[CHUNK {c['id']}]\n{c['text'][:2400]}\n"
    USER = (
        f"Display id (or title): {display_id}\n"
        f"Build the lineage graph now for mode='{mode}'.\n"
        f"{EVIDENCE}"
    )
    return [{"role":"system","content":SYSTEM},{"role":"user","content":USER}]

# -------- ARS backtrace augmentation prompt (ADaM → SDTM → CRF → Protocol) --------

def _build_messages_for_ars_backtrace(
    tlf_cell_id: str,
    adam_vars: List[str],
    retrieved: List[Dict[str,str]]
) -> List[Dict[str,str]]:
    """
    Ask the model to add upstream mappings for the provided ADaM variables.
    It must produce a fully connected chain:
      Protocol/SAP → CRF (page/field) → SDTM.DOMAIN.VAR → ADaM.DATASET.VAR
    We will merge with the ARS graph that already has TLF → ADaM edges.
    """
    adam_list = ", ".join(adam_vars) if adam_vars else "(none)"
    SYSTEM = (
        "You are a senior CDISC standards expert augmenting a lineage graph for a specific TLF cell.\n"
        "Input: a list of ADaM variables already linked to the TLF cell.\n"
        "Task: For EACH ADaM variable, backtrace to one or more SDTM parent variables; for those, "
        "identify CRF page/field anchors; and provide the related Protocol/SAP section or endpoint.\n\n"
        "STRICT requirements:\n"
        "- Build a CONNECTED path for every ADaM var: Protocol/SAP → CRF → SDTM.DOMAIN.VAR → ADaM.DATASET.VAR.\n"
        "- Use existing ADaM variable IDs EXACTLY as provided; do not rename.\n"
        "- Provide an 'explanation' on EVERY node and edge. Start with one of: [direct], [reasoned], [general].\n"
        "- Prefer [direct] by citing file/section/page/snippet from define.xml/spec, CRF index, protocol text, or USDM.\n"
        "- If multiple SDTM parents are plausible, include them all and add short rationale.\n"
        "- Do NOT create unrelated or orphan nodes. All edges must refer to existing node ids.\n"
        "- Return STRICT JSON ONLY in this schema:\n"
        "{\n"
        "  'variable': '<tlf cell id>',\n"
        "  'dataset': 'table',\n"
        "  'summary': '<brief description of the upstream mapping you added>',\n"
        "  'lineage': {\n"
        "    'nodes': [ {id, type, file?, label?, description?, explanation?} ],\n"
        "    'edges': [ {from, to, label?, explanation?} ],\n"
        "    'gaps':  [ {source?, target?, explanation} ]\n"
        "  }\n"
        "}\n"
    )
    EVIDENCE = "\n\n--- EVIDENCE (define/spec, CRF index, protocol text, USDM, ARS) ---\n"
    for c in retrieved:
        EVIDENCE += f"\n[CHUNK {c['id']}]\n{c['text'][:2200]}\n"
    USER = (
        f"TLF cell id: {tlf_cell_id}\n"
        f"ADaM variables already linked to the cell: {adam_list}\n"
        f"Build ONLY the upstream mappings and return strict JSON as specified.\n"
        f"{EVIDENCE}"
    )
    return [{"role":"system","content":SYSTEM},{"role":"user","content":USER}]

# ---------------- ARS-only LLM cell matcher ----------------

def _build_messages_for_ars_cell(cell_spec: str, retrieved: List[Dict[str,str]]) -> List[Dict[str,str]]:
    SYSTEM = (
        "You are an expert reading ARS/ARD JSON for clinical TLF outputs. "
        "Your ONLY source of truth is the ARS text provided. Do not invent content. "
        "Task: locate the single best-matching output/cell for the user's spec string, "
        "then extract the ADaM parents (dataset.variable), filters/slices (where clauses), "
        "populations/denominators, parameters, and statistical method actually shown in ARS. "
        "Return a lineage graph with:\n"
        "- a TLF cell target node whose id is exactly the input spec string,\n"
        "- one node per ADaM parent (type='adam variable', id like 'ADSL.SAFFL'),\n"
        "- edges from the TLF cell to each ADaM variable with '[direct]' explanations that cite ARS anchors "
        "(e.g., analysisId, outputId, dataset/variable names, whereClause labels). "
        "If multiple candidates remain, pick the strongest and add others under 'gaps' as ambiguity notes. "
        "STRICT JSON only in this schema:\n"
        "{\n"
        "  'variable': '<cell spec>',\n"
        "  'dataset': 'table',\n"
        "  'summary': '<short sentence of what was matched and which ARS anchors>',\n"
        "  'lineage': {\n"
        "    'nodes': [ {id, type, label?, description?, explanation?} ],\n"
        "    'edges': [ {from, to, label?, explanation?} ],\n"
        "    'gaps':  [ {explanation} ]\n"
        "  }\n"
        "}\n"
    )
    EVIDENCE = "\n\n--- EVIDENCE (ARS/ARD ONLY) ---\n"
    for c in retrieved:
        EVIDENCE += f"\n[CHUNK {c['id']}]\n{c['text'][:2400]}\n"
    USER = f"Cell spec to locate and extract from ARS: {cell_spec}\nReturn STRICT JSON now.\n{EVIDENCE}"
    return [{"role":"system","content":SYSTEM},{"role":"user","content":USER}]

# ---------------- graph utilities ----------------

def _validate_and_fix_graph(graph: Dict[str, Any]) -> Dict[str, Any]:
    """
    - De-duplicate nodes by (type, normalized id); keep first as canonical
    - Remap edges to canonical ids; normalize edges (use 'from'/'to')
    - Ensure nodes/edges lists exist; append gaps for dropped items
    - Fill missing explanations
    """
    lineage = graph.setdefault("lineage", {"nodes": [], "edges": [], "gaps": []})
    nodes   = lineage.setdefault("nodes", [])
    edges   = lineage.setdefault("edges", [])
    gaps    = lineage.setdefault("gaps", [])

    # De-dupe by (type, normalized id) and keep alias map for edge remapping
    alias: Dict[str, str] = {}
    key_to_node: Dict[str, Dict[str, Any]] = {}
    order: List[str] = []

    def _node_key(n: Dict[str, Any]) -> str:
        nid = str(n.get("id") or "").strip()
        ntype = (n.get("type") or "").lower().strip()
        return f"{ntype}|{_norm(nid)}"

    for n in nodes:
        nid = str(n.get("id") or "").strip()
        if not nid:
            continue
        key = _node_key(n)
        if key not in key_to_node:
            key_to_node[key] = dict(n)
            order.append(key)
            alias[nid] = key_to_node[key]["id"]
        else:
            alias[nid] = key_to_node[key]["id"]
            for k, v in n.items():
                if k not in key_to_node[key] or key_to_node[key][k] in (None, "", []):
                    key_to_node[key][k] = v

    # Ensure explanations present
    for key in order:
        n = key_to_node[key]
        if not n.get("explanation"):
            n["explanation"] = "[reasoned] Included based on adjacent evidence and CDISC conventions."

    nodes_fixed = [key_to_node[k] for k in order]

    # Normalize edges and remap with alias
    valid_ids = {n["id"] for n in nodes_fixed}
    edges_fixed = []
    for e in edges:
        if "from" not in e and "source" in e:
            e["from"] = e.pop("source")
        if "to" not in e and "target" in e:
            e["to"] = e.pop("target")

        frm_raw = str(e.get("from") or "").strip()
        to_raw  = str(e.get("to")   or "").strip()
        frm = alias.get(frm_raw, frm_raw)
        to  = alias.get(to_raw,  to_raw)
        e["from"] = frm
        e["to"]   = to

        if not frm or not to:
            gaps.append({"explanation": "Dropped edge missing 'from' or 'to'."})
            continue
        if frm not in valid_ids or to not in valid_ids:
            gaps.append({"source": frm or None, "target": to or None,
                         "explanation": "Edge refers to unknown node id; edge removed."})
            continue
        if not e.get("explanation"):
            e["explanation"] = "[reasoned] Connection inferred from standard mapping and nearby evidence."
        edges_fixed.append(e)

    lineage["nodes"] = nodes_fixed
    lineage["edges"] = edges_fixed
    lineage["gaps"]  = gaps
    return graph

def _merge_graphs(base: Dict[str, Any], aug: Dict[str, Any]) -> Dict[str, Any]:
    """Merge two lineage graphs (same outer structure)."""
    out = {
        "variable": base.get("variable") or aug.get("variable"),
        "dataset":  base.get("dataset")  or aug.get("dataset"),
        "summary":  (base.get("summary") or "") + (" " if base.get("summary") else "") + (aug.get("summary") or ""),
        "lineage": {
            "nodes": (base.get("lineage",{}).get("nodes",[]) + aug.get("lineage",{}).get("nodes",[])),
            "edges": (base.get("lineage",{}).get("edges",[]) + aug.get("lineage",{}).get("edges",[])),
            "gaps":  (base.get("lineage",{}).get("gaps", []) + aug.get("lineage",{}).get("gaps", [])),
        }
    }
    return _validate_and_fix_graph(out)

# ---------------- table routing helpers ----------------

def _parse_table_cell_query(s: str) -> Optional[Tuple[str, str, str, str]]:
    """
    LEGACY FORMAT (kept for backward compatibility):
      Accepts strings like "FDA_AE_T06 | Results in Death | Xanomeline Low Dose | n"
    Returns: (display_id, section_label, treatment_label, measure)
    """
    parts = [p.strip() for p in (s or "").split("|")]
    if len(parts) == 4:
        return parts[0], parts[1], parts[2], parts[3]
    parts = [p.strip() for p in (s or "").split(",")]
    if len(parts) == 4:
        return parts[0], parts[1], parts[2], parts[3]
    return None

def _table_mode_for_display(sess_dir: Path, summary: Dict[str, Any], display_id: str) -> str:
    """
    Decide table mode for a given display id (when user did NOT ask for a specific cell).
    Priority:
      - 'ars_display' if any ARS/ARD JSON contains the display id
      - 'define_ar' if define.xml text includes Analysis Results constructs
      - 'titles_only' otherwise
    """
    did_norm = _norm(display_id)

    # ARS/ARD present?
    for p in sess_dir.glob("*.json"):
        nm = p.name.lower()
        if nm.endswith(("-ars.json","-ard.json")):
            try:
                t = _read_json_file_text(p)
            except Exception:
                t = ""
            if did_norm in _norm(t):
                return "ars_display"

    # define with Analysis Results?
    for b in _collect_evidence_texts(sess_dir, summary):
        if b[0].startswith("ADaM::"):
            txt = b[1].lower()
            if ("analysis results" in txt) or ("resultdisplay" in txt) or ("analysisresult" in txt):
                return "define_ar"

    return "titles_only"

# ---------------- main builders ----------------

def build_lineage_with_llm_from_session(
    dataset: str,
    variable: str,
    files_ctx: Optional[List[Dict[str, Any]]] = None,
    *,
    model: str = DEFAULT_MODEL,
    embed_model: str = EMBED_MODEL
) -> Dict[str, Any]:
    """
    Unified entry:
      - dataset in {'endpoint','protocol','soa'} → endpoint builder
      - dataset in {'table','tlf','display'}    → table builder (auto mode incl. ARS cell)
      - else                                    → variable builder (SDTM/ADaM)
    """
    # Endpoint routing
    if (dataset or "").lower() in ("endpoint", "protocol", "soa"):
        return build_endpoint_lineage_with_llm_from_session(
            endpoint_term=variable, files_ctx=files_ctx, model=model, embed_model=embed_model
        )

    # Table routing
    if (dataset or "").lower() in ("table", "tlf", "display"):
        return build_table_lineage_from_session(
            display_spec=variable, files_ctx=files_ctx, model=model, embed_model=embed_model
        )

    # -------- Variable lineage (SDTM/ADaM) --------
    client = _make_client()
    sess = _latest_session()
    summary = _load_session_summary(sess)
    pairs = _collect_evidence_texts(sess, summary)

    chunks=[]
    for doc_id, text in pairs:
        chunks += _chunk_text(doc_id, text, MAX_CHARS, OVERLAP)

    if not chunks:
        return {
            "variable": variable,
            "dataset": dataset,
            "summary": f"No evidence available in session for {dataset}.{variable}.",
            "lineage": {
                "nodes": [ {"id": f"{dataset}.{variable}".upper(), "type":"adam variable" if dataset.upper().startswith("AD") else "sdtm variable",
                            "explanation":"[general] Target node only; no artifacts to trace against."} ],
                "edges": [],
                "gaps":  ["No evidence found."]
            }
        }

    query = f"Trace lineage for {dataset}.{variable} across Protocol→CRF→SDTM→ADaM→TLF (exhaustive)."
    with _use_embed_model(embed_model or EMBED_MODEL):
        top_chunks = _retrieve(client, chunks, query, k=TOP_K)

    messages = _build_messages_for_variable(dataset, variable, top_chunks)

    def _chat_call(m: str):
        resp = _retry(client.chat.completions.create, model=m, temperature=0.0,
                      response_format={"type":"json_object"},
                      messages=messages, max_tokens=MAX_TOKENS)
        return json.loads(resp.choices[0].message.content.strip())

    try:
        raw = _chat_call(model)
    except Exception:
        raw = _chat_call(FALLBACK_MODEL)

    try:
        out = {
            "variable": raw.get("variable") or variable,
            "dataset":  raw.get("dataset")  or dataset,
            "summary":  (raw.get("summary") or "").strip(),
            "lineage": {
                "nodes": list(raw.get("lineage", {}).get("nodes", [])),
                "edges": list(raw.get("lineage", {}).get("edges", [])),
                "gaps":  list(raw.get("lineage", {}).get("gaps",  [])),
            }
        }
        # ensure explicit target node exists (normalized compare)
        target_id = f"{dataset}.{variable}".upper()
        if not any(_norm(str(n.get("id",""))) == _norm(target_id) for n in out["lineage"]["nodes"]):
            out["lineage"]["nodes"].append({
                "id": target_id,
                "type": "adam variable" if target_id.startswith("AD") else "sdtm variable",
                "explanation":"[general] Explicit target node added by post-processor."
            })

        out = _validate_and_fix_graph(out)
        if not out.get("summary"):
            out["summary"] = f"Lineage for {variable} in {dataset} assembled from available protocol/CRF/define/spec evidence."
        return out
    except Exception as e:
        return {
            "variable": variable,
            "dataset": dataset,
            "summary": "",
            "lineage": {
                "nodes": [ {"id": f"{dataset}.{variable}".upper(), "type":"adam variable" if dataset.upper().startswith("AD") else "sdtm variable",
                            "explanation": "[general] Post-processing error; returning target only."} ],
                "edges": [],
                "gaps":  [f"Post-processing error: {e}"]
            }
        }

def build_endpoint_lineage_with_llm_from_session(
    endpoint_term: str,
    files_ctx: Optional[List[Dict[str, Any]]] = None,
    *,
    model: str = DEFAULT_MODEL,
    embed_model: str = EMBED_MODEL
) -> Dict[str, Any]:
    """
    Endpoint/SoA-centric lineage: Protocol/USDM → CRF Forms → SDTM Domains → ADaM Datasets → TLF Displays
    """
    client = _make_client()
    sess = _latest_session()
    summary = _load_session_summary(sess)
    pairs = _collect_evidence_texts(sess, summary)

    chunks=[]
    for doc_id, text in pairs:
        chunks += _chunk_text(doc_id, text, MAX_CHARS, OVERLAP)

    if not chunks:
        return {
            "variable": endpoint_term,
            "dataset": "endpoint",
            "summary": f"No evidence available in session for endpoint '{endpoint_term}'.",
            "lineage": {
                "nodes": [ {"id": endpoint_term.lower(), "type":"protocol endpoint",
                            "explanation":"[general] Endpoint source only; no artifacts to trace against."} ],
                "edges": [],
                "gaps":  ["No evidence found."]
            }
        }

    query = f"Endpoint/SoA flow for '{endpoint_term}' across Protocol/USDM→CRF→SDTM→ADaM→TLF."
    with _use_embed_model(embed_model or EMBED_MODEL):
        top_chunks = _retrieve(client, chunks, query, k=TOP_K)

    messages = _build_messages_for_endpoint(endpoint_term, top_chunks)

    def _chat_call(m: str):
        resp = _retry(client.chat.completions.create, model=m, temperature=0.0,
                      response_format={"type":"json_object"},
                      messages=messages, max_tokens=MAX_TOKENS)
        return json.loads(resp.choices[0].message.content.strip())

    try:
        raw = _chat_call(model)
    except Exception:
        raw = _chat_call(FALLBACK_MODEL)

    try:
        out = {
            "variable": raw.get("variable") or endpoint_term,
            "dataset":  "endpoint",
            "summary":  (raw.get("summary") or "").strip(),
            "lineage": {
                "nodes": list(raw.get("lineage", {}).get("nodes", [])),
                "edges": list(raw.get("lineage", {}).get("edges", [])),
                "gaps":  list(raw.get("lineage", {}).get("gaps",  [])),
            }
        }
        # ensure root node exists
        root_id = endpoint_term.lower()
        if not any(_norm(str(n.get("id",""))) == _norm(root_id) for n in out["lineage"]["nodes"]):
            out["lineage"]["nodes"].append({"id": root_id, "type":"protocol endpoint",
                                            "explanation":"[general] Endpoint root added by post-processor."})

        out = _validate_and_fix_graph(out)
        if not out.get("summary"):
            out["summary"] = f"Endpoint lineage for '{endpoint_term}' assembled from USDM/Protocol, CRF/define/spec, and TLF titles."
        return out
    except Exception as e:
        return {
            "variable": endpoint_term,
            "dataset": "endpoint",
            "summary": "",
            "lineage": {
                "nodes": [ {"id": endpoint_term.lower(), "type":"protocol endpoint",
                            "explanation":"[general] Post-processing error; returning endpoint root only."} ],
                "edges": [],
                "gaps":  [f"Post-processing error: {e}"]
            }
        }

# -------- Table lineage (incl. ARS cell with LLM backtrace) --------

def _extract_adam_vars_from_nodes(nodes: List[Dict[str, Any]]) -> List[str]:
    out = []
    for n in nodes:
        if (n.get("type") or "").lower() == "adam variable":
            vid = n.get("id") or n.get("label")
            if vid and vid not in out:
                out.append(vid)
    return out

def build_table_lineage_from_session(
    display_spec: str,
    files_ctx: Optional[List[Dict[str, Any]]] = None,
    *,
    model: str = DEFAULT_MODEL,
    embed_model: str = EMBED_MODEL
) -> Dict[str, Any]:
    """
    Table lineage router:
      - If display_spec looks like a flexible cell spec (contains '|'):
          → ARS-only LLM matcher builds base TLF cell → ADaM parent graph,
            then LLM backtrace to SDTM → CRF → Protocol; merge results.
      - Else decide mode by evidence: ars_display / define_ar / titles_only → LLM builder.
    """
    # --- ARS-only LLM cell-matcher (flexible spec; ARS-only evidence) ---
    if _is_cell_spec(display_spec):
        base_graph = _build_ars_cell_base_graph_llm(
            display_spec, model=model, embed_model=embed_model
        )

        # Use backtrace to add SDTM → CRF → Protocol for the ADaM parents
        adam_vars = _extract_adam_vars_from_nodes(base_graph.get("lineage", {}).get("nodes", []))
        if not adam_vars:
            return _validate_and_fix_graph(base_graph)

        # Build broader evidence (define/spec, CRF, protocol, USDM, ARS) and backtrace
        client = _make_client()
        sess = _latest_session()
        summary = _load_session_summary(sess)
        pairs = _collect_evidence_texts(sess, summary)

        chunks=[]
        for doc_id, text in pairs:
            chunks += _chunk_text(doc_id, text, MAX_CHARS, OVERLAP)

        query = (
            f"Backtrace ADaM vars {', '.join(adam_vars)} to SDTM→CRF→Protocol "
            f"for TLF cell '{display_spec}'."
        )
        with _use_embed_model(embed_model or EMBED_MODEL):
            top_chunks = _retrieve(client, chunks, query, k=TOP_K)

        messages = _build_messages_for_ars_backtrace(
            tlf_cell_id=display_spec, adam_vars=adam_vars, retrieved=top_chunks
        )

        def _chat_call(m: str):
            resp = _retry(client.chat.completions.create, model=m, temperature=0.0,
                          response_format={"type":"json_object"},
                          messages=messages, max_tokens=MAX_TOKENS)
            return json.loads(resp.choices[0].message.content.strip())

        try:
            aug_raw = _chat_call(model)
        except Exception:
            aug_raw = _chat_call(FALLBACK_MODEL)

        aug_graph = {
            "variable": aug_raw.get("variable") or base_graph.get("variable"),
            "dataset":  "table",
            "summary":  (aug_raw.get("summary") or "").strip(),
            "lineage": {
                "nodes": list(aug_raw.get("lineage", {}).get("nodes", [])),
                "edges": list(aug_raw.get("lineage", {}).get("edges", [])),
                "gaps":  list(aug_raw.get("lineage", {}).get("gaps",  [])),
            }
        }
        return _merge_graphs(base_graph, aug_graph)

    # --- LLM display-level (situations #1 or #2 or ARS summary) ---
    sess = _latest_session()
    summary = _load_session_summary(sess)
    display_id = display_spec
    mode = _table_mode_for_display(sess, summary, display_id)
    pairs = _collect_table_evidence(sess, summary, display_id)

    # Build chunks & retrieve
    client = _make_client()
    chunks=[]
    for doc_id, text in pairs:
        chunks += _chunk_text(doc_id, text, MAX_CHARS, OVERLAP)

    if not chunks:
        return {
            "variable": display_id,
            "dataset": "table",
            "summary": f"No evidence available in session for display '{display_id}'.",
            "lineage": {
                "nodes": [ {"id": display_id, "type":"tlf display",
                            "explanation":"[general] Target display only; no artifacts to trace against."} ],
                "edges": [],
                "gaps":  ["No evidence found."]
            }
        }

    query = f"Table lineage for display '{display_id}' (mode={mode}) across Protocol/USDM→CRF→SDTM→ADaM→TLF (exhaustive)."
    with _use_embed_model(embed_model or EMBED_MODEL):
        top_chunks = _retrieve(client, chunks, query, k=TOP_K)

    messages = _build_messages_for_table(display_id, mode, top_chunks)

    def _chat_call(m: str):
        resp = _retry(client.chat.completions.create, model=m, temperature=0.0,
                      response_format={"type":"json_object"},
                      messages=messages, max_tokens=MAX_TOKENS)
        return json.loads(resp.choices[0].message.content.strip())

    try:
        raw = _chat_call(model)
    except Exception:
        raw = _chat_call(FALLBACK_MODEL)

    try:
        out = {
            "variable": raw.get("variable") or display_id,
            "dataset":  "table",
            "summary":  (raw.get("summary") or "").strip(),
            "lineage": {
                "nodes": list(raw.get("lineage", {}).get("nodes", [])),
                "edges": list(raw.get("lineage", {}).get("edges", [])),
                "gaps":  list(raw.get("lineage", {}).get("gaps",  [])),
            }
        }
        # ensure target display node exists (normalized compare)
        if not any(_norm(str(n.get("id",""))) == _norm(display_id) for n in out["lineage"]["nodes"]):
            out["lineage"]["nodes"].append({"id": display_id, "type": "tlf display",
                                            "explanation":"[general] Target display node added by post-processor."})

        out = _validate_and_fix_graph(out)
        if not out.get("summary"):
            if mode == "titles_only":
                out["summary"] = f"{display_id}: dataset-level lineage inferred from TLF titles and protocol/SAP context."
            elif mode == "define_ar":
                out["summary"] = f"{display_id}: variable-level lineage extracted from define.xml Analysis Results."
            else:
                out["summary"] = f"{display_id}: table-level lineage summarized from ARS/ARD evidence."
        return out
    except Exception as e:
        return {
            "variable": display_id,
            "dataset": "table",
            "summary": "",
            "lineage": {
                "nodes": [ {"id": display_id, "type": "tlf display",
                            "explanation":"[general] Post-processing error; returning target display only."} ],
                "edges": [],
                "gaps":  [f"Post-processing error: {e}"]
            }
        }

# --------------- ARS-only base graph (private) ---------------

def _build_ars_cell_base_graph_llm(cell_spec: str, *, model: str, embed_model: str) -> Dict[str, Any]:
    """
    ARS-only LLM matcher for a flexible cell spec string like:
      "ars-vs-t01 | Diastolic Blood Pressure (mmHg) | Week 2 Change from Baseline | Xanomeline High Dose | mean"
    1) Retrieves ARS/ARD JSON from current session and embeds/retrieves by query.
    2) Asks LLM to locate the best match and extract ADaM parents and rules.
    """
    sess = _latest_session()
    pairs = _collect_ars_texts_only(sess)
    if not pairs:
        return {
            "variable": cell_spec,
            "dataset": "table",
            "summary": "No ARS/ARD files found in the current session.",
            "lineage": {
                "nodes": [{"id": cell_spec, "type": "tlf display",
                           "explanation": "[general] Target only; no ARS evidence available."}],
                "edges": [],
                "gaps": ["No ARS/ARD files present."]
            }
        }

    client = _make_client()
    chunks=[]
    for doc_id, text in pairs:
        chunks += _chunk_text(doc_id, text, MAX_CHARS, OVERLAP)

    query = f"Find the ARS output/cell matching: {cell_spec}. Extract ADaM parents and rules."
    with _use_embed_model(embed_model or EMBED_MODEL):
        top = _retrieve(client, chunks, query, k=TOP_K)

    messages = _build_messages_for_ars_cell(cell_spec, top)

    def _chat(m: str):
        resp = _retry(client.chat.completions.create, model=m, temperature=0.0,
                      response_format={"type": "json_object"},
                      messages=messages, max_tokens=MAX_TOKENS)
        return json.loads(resp.choices[0].message.content.strip())

    try:
        raw = _chat(model)
    except Exception:
        raw = _chat(FALLBACK_MODEL)

    out = {
        "variable": raw.get("variable") or cell_spec,
        "dataset":  "table",
        "summary":  (raw.get("summary") or "").strip(),
        "lineage": {
            "nodes": list(raw.get("lineage", {}).get("nodes", [])),
            "edges": list(raw.get("lineage", {}).get("edges", [])),
            "gaps":  list(raw.get("lineage", {}).get("gaps",  [])),
        }
    }

    # Ensure explicit target node exists (normalized compare) and typed as TLF display
    if not any(_norm(n.get("id","")) == _norm(cell_spec) for n in out["lineage"]["nodes"]):
        out["lineage"]["nodes"].append({
            "id": cell_spec,
            "type": "tlf display",
            "explanation": "[general] Added explicit target node for the requested cell spec."
        })

    return _validate_and_fix_graph(out)
