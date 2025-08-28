#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
services/llm_lineage_define.py

LLM-driven lineage builder for:
  1) Variable lineage across Protocol → CRF → SDTM → ADaM → TLF
  2) Endpoint/SoA lineage centered on protocol endpoint concepts
  3) Table lineage:
        (1) Titles-only (combined TLF; dataset-level inference)
        (2) define.xml Analysis Results present (variable-level)
        (3) ARS/ARD cell query → ARS-only LLM matching of the requested cell/output,
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

This version adds:
- Auto-prefixing for bare ADaM variables (e.g., PARAMCD → ADQSADAS.PARAMCD).
- Canonical node types: 'adam variable', 'sdtm variable', 'adam dataset', 'sdtm dataset', 'tlf display', 'tlf cell', 'crf page', 'protocol section', 'endpoint'.
- Prompts require canonical IDs (ADaM DATASET.VARIABLE and SDTM DOMAIN.VAR) and exhaustive parents/children with concrete aCRF page & Protocol section/USDM anchors.
- Backtrace augmentation to add SDTM→CRF→Protocol anchors when missing.
"""

from __future__ import annotations

import os, re, json, time
from pathlib import Path
from typing import Any, Dict, List, Optional, Iterable, Tuple
from contextlib import contextmanager

import numpy as np
from openai import OpenAI
from openai import APIError, RateLimitError

# legacy import (not used in LLM path; retained for compatibility)
try:
    from services.tlf_lineage_from_ars import build_table_lineage_from_ars  # noqa: F401
except Exception:
    build_table_lineage_from_ars = None  # type: ignore

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
        "  'summary': '<one-sentence overview of flow from protocol endpoint/SoA → CRF → SDTM → ADaM → TLF>',\n"
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
        "  'summary': '<one-sentence overview of how the TLF maps back to ADaM/SDTM/CRF/Protocol>',\n"
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
        "Task: Construct a detailed variable lineage graph for an SDTM or ADaM variable.\n\n"
        "Backtrace: Protocol (specific section §/heading or USDM Objective/Endpoint ID) → CRF (form/page/field) → SDTM (DOMAIN.VAR)\n"
        "Forward: SDTM → ADaM (DATASET.VARIABLE) → TLF (display IDs/titles).\n\n"
        "Node types MUST be chosen from this closed set: "
        "['protocol section','protocol endpoint','crf page','sdtm dataset','sdtm variable',"
        "'adam dataset','adam variable','tlf display','tlf cell','endpoint'].\n"
        "IDs MUST be canonical and uppercase: SDTM as 'DOMAIN.VAR' (e.g., 'DM.BRTHDTC'); "
        "ADaM as 'DATASET.VARIABLE' (e.g., 'ADSL.AGE'); CRF as 'CRF page <n> • <DOMAIN>.<VAR>' when possible.\n"
        "Enumerate **ALL** contributing parent variables and **ALL** downstream children found in evidence; "
        "unlimited nodes/edges are OK.\n"
        "For CRF anchors, use the aCRF index (page numbers); for Protocol, cite the exact §/heading and/or USDM ids; "
        "include short snippets when possible.\n"
        "Provide an 'explanation' on EVERY node/edge with [direct]/[reasoned]/[general] and a short citation.\n"
        "Output STRICT JSON in this schema:\n"
        + _variable_prompt_schema() +
        "Use ONLY 'from' and 'to' for edges; ensure every edge refers to an existing node id; avoid duplicates.\n"
    )
    EVIDENCE = "\n\n--- EVIDENCE ---\n"
    for c in retrieved:
        EVIDENCE += f"\n[CHUNK {c['id']}]\n{c['text'][:2400]}\n"
    USER = (
        f"Target variable: {target_ds}.{target_var}\n"
        f"Build the full traceability graph now.\n"
        f"{EVIDENCE}"
    )
    return [{"role":"system","content":SYSTEM},{"role":"user","content":USER}]

def _build_messages_for_endpoint(endpoint_term: str, retrieved: List[Dict[str,str]]) -> List[Dict[str,str]]:
    SYSTEM = (
        "You are a senior CDISC standards expert building a PROTOCOL-ENDPOINT lineage map.\n"
        "Center the graph on the protocol endpoint/SoA concept, then link:\n"
        "  Protocol/USDM Endpoint or Objective → CRF Form(s)/Page(s) → SDTM Domain(s) → ADaM Dataset(s) → TLF Display(s).\n\n"
        "Node types: 'protocol endpoint' for the root, 'crf page', 'sdtm dataset', 'adam dataset', 'tlf display'.\n"
        "Enumerate ALL relevant parents/children; do not stop at one path.\n"
        "Provide an 'explanation' on EVERY node and edge with [direct]/[reasoned]/[general] and cite anchors "
        "(protocol §, USDM id, CRF page, define/analysis id, TLF id).\n"
        "Output STRICT JSON only in this schema:\n"
        + _endpoint_prompt_schema() +
        "Use ONLY 'from' and 'to' for edges; ensure endpoints exist and avoid duplicates.\n"
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
      - 'titles_only' : only combined TLF available → dataset-level inference (no var-level)
      - 'define_ar'   : define.xml with Analysis Results present → variable-level
      - 'ars_display' : ARS/ARD present (table-level summary via ARS evidence, not single cell)
    """
    rules_common = (
        "Provide an 'explanation' on EVERY node and edge using [direct]/[reasoned]/[general]. "
        "[direct] must cite file and exact anchor when possible (define.xml path/ResultDisplay id, "
        "ARS analysis/output/whereClause ids, protocol section number or USDM id, aCRF page). "
        "Enumerate **ALL** parents/children present in evidence; unlimited nodes/edges are OK. "
        "**Always emit ADaM variables as DATASET.VARIABLE (e.g., ADVS.AVAL) and SDTM variables as DOMAIN.VAR (e.g., VS.VSORRES).** "
        "Node types MUST be from: 'protocol section','crf page','sdtm dataset','sdtm variable','adam dataset','adam variable','tlf display','tlf cell'. "
        "Use ONLY 'from' and 'to' in edges; ensure all edge endpoints exist; avoid duplicate nodes.\n"
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
            "- TLF Display → ADaM variable(s) listed in Analysis Result (emit as DATASET.VARIABLE) "
            "→ SDTM parent variable(s) (emit as DOMAIN.VAR) → CRF anchors → related Protocol/SAP section(s)/USDM ids.\n"
        )
    else:  # ars_display
        MODE_TXT = (
            "SITUATION: ARS/ARD JSONs are available for this display (table-level summary, not a single cell).\n"
            "Goal: Summarize the ADaM variables and filters used across the display per ARS (emit as DATASET.VARIABLE), "
            "then map back to SDTM parents and CRF anchors. Include Protocol/SAP linkage.\n"
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
    We will merge with the ARS/define graph that already has TLF → ADaM edges.
    """
    adam_list = ", ".join(adam_vars) if adam_vars else "(none)"
    SYSTEM = (
        "You are a senior CDISC standards expert augmenting a lineage graph for a specific output/display.\n"
        "Input: a list of ADaM variables already linked to this output.\n"
        "Task: For EACH ADaM variable, backtrace to one or more SDTM parent variables; for those, "
        "identify CRF page/field anchors from the aCRF index (emit concrete nodes like 'CRF page 12 • AE.AESTDTC'); "
        "and provide the related Protocol/SAP section(s) and USDM endpoint/objective ids.\n\n"
        "STRICT requirements:\n"
        "- Build CONNECTED paths for every ADaM var: Protocol/USDM §/ID → CRF page/field → SDTM.DOMAIN.VAR → ADaM.DATASET.VAR.\n"
        "- Enumerate all plausible parents/children found; do not reduce to a single path.\n"
        "- Node types must be from: 'protocol section','crf page','sdtm variable','adam variable'.\n"
        "- Use existing ADaM variable IDs EXACTLY as provided; do not rename.\n"
        "- Provide an 'explanation' on EVERY node and edge with citations/snippets.\n"
        "- Return STRICT JSON ONLY in this schema:\n"
        "{\n"
        "  'variable': '<display id or cell id>',\n"
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
        f"Output id: {tlf_cell_id}\n"
        f"ADaM variables already linked: {adam_list}\n"
        f"Build ONLY the upstream mappings and return strict JSON as specified.\n"
        f"{EVIDENCE}"
    )
    return [{"role":"system","content":SYSTEM},{"role":"user","content":USER}]

# ---------------- ARS-only LLM cell matcher (flexible cell spec) ----------------

def _build_messages_for_ars_cell(cell_spec: str, retrieved: List[Dict[str,str]]) -> List[Dict[str,str]]:
    SYSTEM = (
        "You are an expert reading ARS/ARD JSON for clinical TLF outputs. "
        "Your ONLY source of truth is the ARS text provided. Do not invent content. "
        "Task: locate the single best-matching output/cell for the user's spec string, "
        "then extract ALL ADaM parents (emit as DATASET.VARIABLE), filters/slices (where clauses), "
        "populations/denominators, parameters, and the statistical method shown in ARS. "
        "Return a lineage graph with:\n"
        "- a TLF cell target node whose id is exactly the input spec string,\n"
        "- one node per ADaM parent (type='adam variable'), and all applicable rules as edges with [direct] ARS citations.\n"
        "If multiple ARS candidates remain, pick the strongest and list alternates under 'gaps' as ambiguity notes.\n"
        "STRICT JSON only in this schema:\n"
        "{ 'variable': '<cell spec>', 'dataset': 'table', 'summary': '<short>', "
        "  'lineage': { 'nodes': [...], 'edges': [...], 'gaps': [...] } }\n"
    )
    EVIDENCE = "\n\n--- EVIDENCE (ARS/ARD ONLY) ---\n"
    for c in retrieved:
        EVIDENCE += f"\n[CHUNK {c['id']}]\n{c['text'][:2400]}\n"
    USER = f"Cell spec to locate and extract from ARS: {cell_spec}\nReturn STRICT JSON now.\n{EVIDENCE}"
    return [{"role":"system","content":SYSTEM},{"role":"user","content":USER}]

# ---------------- graph post-processing & helpers ----------------

def _suggest_type_for_id(nid: str, dataset_kind: str) -> str:
    up = (nid or "").upper().strip()
    dk = (dataset_kind or "").lower()
    if dk in ("table", "tlf", "display"):
        if "|" in up:
            return "tlf cell"
        return "tlf display"
    if dk in ("endpoint", "protocol", "soa"):
        return "endpoint"
    if re.match(r"^AD[A-Z0-9]{2,}\.[A-Z0-9_]+$", up):
        return "adam variable"
    if up.startswith("SDTM."):
        return "sdtm variable"
    if re.match(r"^[A-Z]{2}\.[A-Z0-9_]+$", up):  # e.g., AE.AESTDTC
        return "sdtm variable"
    if up in ("PROTOCOL", "CRF", "USDM"):
        return up.lower()
    return "concept"

def _auto_prefix_adam_vars(graph: Dict[str, Any]) -> Dict[str, Any]:
    """Prefix bare ADaM var node ids with the dataset in context (e.g., PARAMCD → ADQSADAS.PARAMCD)."""
    lin = graph.setdefault("lineage", {}).setdefault("nodes", [])
    edges = graph.setdefault("lineage", {}).setdefault("edges", [])
    # collect ADaM datasets
    ds_ids = set()
    for n in lin:
        t = (n.get("type") or "").lower()
        if t in ("adam dataset", "adam data set", "adamdata set", "adaml dataset", "adml dataset"):
            ds_ids.add(n.get("id"))
        # heuristic: uppercase AD... with no dot and type mentions dataset
        nid = (n.get("id") or "")
        if (nid.upper().startswith("AD") and "." not in nid and "dataset" in t):
            ds_ids.add(nid)
    ds_ids = [d for d in ds_ids if d]

    # try infer dataset from edges (dataset → variable)
    edge_map = {}
    for e in edges:
        frm = str(e.get("from") or "")
        to  = str(e.get("to")   or "")
        if frm in ds_ids and to:
            edge_map[to] = frm

    default_ds = ds_ids[0] if len(ds_ids) == 1 else None

    id_changes: Dict[str, str] = {}
    for n in lin:
        t = (n.get("type") or "").lower()
        nid = n.get("id") or ""
        if t.startswith("adam") and "var" in t:
            if "." not in nid and re.match(r"^[A-Z0-9_]+$", nid):
                ds = edge_map.get(nid) or default_ds
                if ds:
                    new_id = f"{ds}.{nid}"
                    id_changes[nid] = new_id
                    n["id"] = new_id

    # update edges to new ids
    if id_changes:
        for e in edges:
            if e.get("from") in id_changes:
                e["from"] = id_changes[e["from"]]
            if e.get("to") in id_changes:
                e["to"] = id_changes[e["to"]]
    return graph

def _canonicalize_types_in_graph(graph: Dict[str, Any]) -> Dict[str, Any]:
    """Coerce node.type values to canonical set based on id/label patterns."""
    nodes = graph.get("lineage", {}).get("nodes", [])
    for n in nodes:
        t = (n.get("type") or "").strip().lower()
        nid = (n.get("id") or "").strip()
        up = nid.upper()
        lbl = (n.get("label") or "").lower()

        # dataset.variable generic → adam/sdtm variable
        if t in ("dataset.variable", "data set variable", "data-variable", "variable"):
            if re.match(r"^AD[A-Z0-9]{2,}\.[A-Z0-9_]+$", up):
                n["type"] = "adam variable"
            elif re.match(r"^[A-Z]{2}\.[A-Z0-9_]+$", up) or up.startswith("SDTM."):
                n["type"] = "sdtm variable"
            continue

        # unify display/cell
        if t in ("display", "tlf", "tlf display", "table"):
            n["type"] = "tlf display"; continue
        if t in ("cell", "tlf cell", "output cell"):
            n["type"] = "tlf cell"; continue

        # unify protocol/crf
        if t in ("protocol", "protocol/sap", "sap", "protocol section"):
            n["type"] = "protocol section"; continue
        if t in ("crf", "acrf", "crf page"):
            # if id mentions page → crf page
            if "crf page" in (nid.lower() + " " + lbl):
                n["type"] = "crf page"
            else:
                n["type"] = "crf page"
            continue

        # unify adam/sdtm datasets and variables
        if t in ("adam", "adam variable", "adsl var", "ad a m", "adaml", "adaml variable"):
            # if looks like dataset.var keep variable, else dataset
            if "." in nid:
                n["type"] = "adam variable"
            else:
                n["type"] = "adam dataset"
            continue
        if t in ("sdtm", "sdtm variable"):
            if "." in nid or re.match(r"^[A-Z]{2}\.[A-Z0-9_]+$", up):
                n["type"] = "sdtm variable"
            else:
                n["type"] = "sdtm dataset"
            continue

        # if nothing matched, infer from id pattern
        if not t or t in ("target", "source", "concept"):
            if re.match(r"^AD[A-Z0-9]{2,}\.[A-Z0-9_]+$", up):
                n["type"] = "adam variable"
            elif re.match(r"^[A-Z]{2}\.[A-Z0-9_]+$", up) or up.startswith("SDTM."):
                n["type"] = "sdtm variable"
            elif up.startswith("AD") and "." not in up:
                n["type"] = "adam dataset"
            elif "crf page" in up.lower():
                n["type"] = "crf page"
            elif "|" in nid:
                n["type"] = "tlf cell"
            elif "table" in nid.lower() or "tlf" in lbl:
                n["type"] = "tlf display"
            elif "endpoint" in lbl:
                n["type"] = "protocol endpoint"

    return graph

def _has_sdtm_nodes(nodes: List[Dict[str, Any]]) -> bool:
    for n in nodes:
        t = (n.get("type") or "").lower()
        i = (n.get("id") or "").upper()
        if t in ("sdtm", "sdtm variable", "sdtm dataset") or i.startswith("SDTM.") or re.match(r"^[A-Z]{2}\.[A-Z0-9_]+$", i):
            return True
    return False

def _validate_and_fix_graph(graph: Dict[str, Any]) -> Dict[str, Any]:
    """
    - De-duplicate nodes by id (merge shallowly)
    - Normalize edges: use 'from'/'to'; drop edges with missing endpoints
    - Ensure nodes/edges lists exist; append gaps for dropped items
    - If explanation missing, add a minimal placeholder so frontend has something to show
    - Canonicalize node types (adam/sdtm/crf/protocol/tlf...)
    """
    lineage = graph.setdefault("lineage", {"nodes": [], "edges": [], "gaps": []})
    nodes   = lineage.setdefault("nodes", [])
    edges   = lineage.setdefault("edges", [])
    gaps    = lineage.setdefault("gaps", [])
    dataset_kind = (graph.get("dataset") or "").lower()

    # De-dupe nodes
    node_map: Dict[str, Dict[str, Any]] = {}
    order: List[str] = []
    for n in nodes:
        nid = str(n.get("id") or "").strip()
        if not nid:
            continue
        if nid not in node_map:
            node_map[nid] = dict(n)
            order.append(nid)
        else:
            for k, v in n.items():
                if k not in node_map[nid] or node_map[nid][k] in (None, "", []):
                    node_map[nid][k] = v

    # Normalize types/explanations
    for nid in order:
        n = node_map[nid]
        t = (n.get("type") or "").strip().lower()
        if t in ("", "target", "source"):
            n["type"] = _suggest_type_for_id(nid, dataset_kind)
        if not n.get("explanation"):
            n["explanation"] = "[reasoned] Included based on adjacent evidence and CDISC artifacts."

    nodes_fixed = [node_map[n] for n in order]

    # Normalize edges
    edges_fixed = []
    for e in edges:
        if "from" not in e and "source" in e:
            e["from"] = e.pop("source")
        if "to" not in e and "target" in e:
            e["to"] = e.pop("target")
        frm = str(e.get("from") or "").strip()
        to  = str(e.get("to")   or "").strip()
        if not frm or not to:
            gaps.append({"explanation": "Dropped edge missing 'from' or 'to'."})
            continue
        if frm not in node_map or to not in node_map:
            gaps.append({"source": frm or None, "target": to or None,
                         "explanation": "Edge refers to unknown node id; edge removed."})
            continue
        if not e.get("explanation"):
            e["explanation"] = "[reasoned] Connection inferred from standard mapping and nearby evidence."
        edges_fixed.append(e)

    lineage["nodes"] = nodes_fixed
    lineage["edges"] = edges_fixed

    # Canonicalize node types
    _canonicalize_types_in_graph(graph)

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

def _extract_adam_vars_from_nodes(nodes: List[Dict[str, Any]]) -> List[str]:
    out = []
    for n in nodes:
        if (n.get("type") or "").lower() == "adam variable":
            vid = n.get("id") or n.get("label")
            if vid and vid not in out:
                out.append(vid)
    return out

def _augment_backtrace_if_missing_sdtm(base_graph: Dict[str, Any], *, model: str, embed_model: str) -> Dict[str, Any]:
    """If graph has ADaM variables but no SDTM nodes, run a backtrace augmentation and merge."""
    nodes = base_graph.get("lineage", {}).get("nodes", [])
    if not nodes:
        return base_graph
    if _has_sdtm_nodes(nodes):
        return base_graph
    adam_vars = _extract_adam_vars_from_nodes(nodes)
    if not adam_vars:
        return base_graph

    # collect broad evidence and run augmentation
    client = _make_client()
    sess = _latest_session()
    summary = _load_session_summary(sess)
    pairs = _collect_evidence_texts(sess, summary)

    chunks=[]
    for doc_id, text in pairs:
        chunks += _chunk_text(doc_id, text, MAX_CHARS, OVERLAP)

    query = (
        f"Backtrace ADaM vars {', '.join(adam_vars)} to SDTM→CRF→Protocol "
        f"for output '{base_graph.get('variable')}'."
    )
    with _use_embed_model(embed_model or EMBED_MODEL):
        top_chunks = _retrieve(client, chunks, query, k=TOP_K)

    messages = _build_messages_for_ars_backtrace(
        tlf_cell_id=str(base_graph.get("variable") or "output"),
        adam_vars=adam_vars,
        retrieved=top_chunks
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
        "dataset":  base_graph.get("dataset"),
        "summary":  (aug_raw.get("summary") or "").strip(),
        "lineage": {
            "nodes": list(aug_raw.get("lineage", {}).get("nodes", [])),
            "edges": list(aug_raw.get("lineage", {}).get("edges", [])),
            "gaps":  list(aug_raw.get("lineage", {}).get("gaps",  [])),
        }
    }
    merged = _merge_graphs(base_graph, aug_graph)
    return merged

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
                "nodes": [ {"id": f"{dataset}.{variable}".upper(), "type": _suggest_type_for_id(f"{dataset}.{variable}", dataset),
                            "explanation":"[general] Target only; no artifacts to trace against."} ],
                "edges": [],
                "gaps":  ["No evidence found."]
            }
        }

    query = f"Trace lineage for {dataset}.{variable} across Protocol→CRF→SDTM→ADaM→TLF."
    with _use_embed_model(embed_model or EMBED_MODEL):
        top_chunks = _retrieve(client, chunks, query, k=TOP_K)

    messages = _build_messages_for_variable(dataset.upper(), variable.upper(), top_chunks)

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
            "variable": raw.get("variable") or variable.upper(),
            "dataset":  raw.get("dataset")  or dataset.upper(),
            "summary":  (raw.get("summary") or "").strip(),
            "lineage": {
                "nodes": list(raw.get("lineage", {}).get("nodes", [])),
                "edges": list(raw.get("lineage", {}).get("edges", [])),
                "gaps":  list(raw.get("lineage", {}).get("gaps",  [])),
            }
        }

        # Prefix bare ADaM vars
        out = _auto_prefix_adam_vars(out)

        # Ensure explicit node for the requested var exists with meaningful type
        target_id = f"{dataset}.{variable}".upper()
        if not any(str(n.get("id","")).upper()==target_id for n in out["lineage"]["nodes"]):
            out["lineage"]["nodes"].append({
                "id": target_id,
                "type": _suggest_type_for_id(target_id, dataset),
                "explanation":"[general] Explicit node for the requested variable."
            })

        out = _validate_and_fix_graph(out)

        # If no SDTM parents were emitted, run augmentation to add them
        out = _augment_backtrace_if_missing_sdtm(out, model=model, embed_model=embed_model)

        if not out.get("summary"):
            out["summary"] = f"Lineage for {variable.upper()} in {dataset.upper()} assembled from protocol/USDM, aCRF index, and define/spec."
        return out
    except Exception as e:
        return {
            "variable": variable.upper(),
            "dataset": dataset.upper(),
            "summary": "",
            "lineage": {
                "nodes": [ {"id": f"{dataset}.{variable}".upper(), "type": _suggest_type_for_id(f"{dataset}.{variable}", dataset),
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
                "nodes": [ {"id": endpoint_term.lower(), "type":"endpoint",
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
        if not any(str(n.get("id","")).lower()==root_id for n in out["lineage"]["nodes"]):
            out["lineage"]["nodes"].append({"id": root_id, "type":"endpoint",
                                            "explanation":"[general] Endpoint root added by post-processor."})

        out = _validate_and_fix_graph(out)
        if not out.get("summary"):
            out["summary"] = f"Endpoint lineage for '{endpoint_term}' assembled from USDM/Protocol, aCRF index, define/spec, and TLF titles."
        return out
    except Exception as e:
        return {
            "variable": endpoint_term,
            "dataset": "endpoint",
            "summary": "",
            "lineage": {
                "nodes": [ {"id": endpoint_term.lower(), "type":"endpoint",
                            "explanation":"[general] Post-processing error; returning endpoint root only."} ],
                "edges": [],
                "gaps":  [f"Post-processing error: {e}"]
            }
        }

# -------- ARS cell path and display path --------

def _build_ars_cell_base_graph_llm(cell_spec: str, *, model: str, embed_model: str) -> Dict[str, Any]:
    """
    ARS-only LLM matcher for a flexible cell spec string like:
      "FDA-DS-T04 | Discontinued study drug | Xanomeline Low Dose | n (%) | Safety population"
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
                "nodes": [{"id": cell_spec, "type": "tlf cell",
                           "explanation": "[general] Target only; no ARS evidence available."}],
                "edges": [],
                "gaps": ["No ARS/ARD files present."]
            }
        }

    client = _make_client()
    chunks=[]
    for doc_id, text in pairs:
        chunks += _chunk_text(doc_id, text, MAX_CHARS, OVERLAP)

    query = f"Find the ARS output/cell matching: {cell_spec}. Extract all ADaM parents and rules."
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

    # Prefix bare ADaM vars and canonicalize
    out = _auto_prefix_adam_vars(out)
    if not any((n.get("id") or "").strip().lower() == cell_spec.strip().lower()
               for n in out["lineage"]["nodes"]):
        out["lineage"]["nodes"].append({
            "id": cell_spec,
            "type": "tlf cell",
            "explanation": "[general] Added explicit target cell node."
        })

    return _validate_and_fix_graph(out)

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
        # Backtrace to add SDTM → CRF → Protocol for the ADaM parents
        base_graph = _augment_backtrace_if_missing_sdtm(base_graph, model=model, embed_model=embed_model)
        return base_graph

    # --- LLM display-level (situations #1/#2 or ARS summary) ---
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

    query = f"Table lineage for display '{display_id}' (mode={mode}) across Protocol/USDM→CRF→SDTM→ADaM→TLF."
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
        # Prefix bare ADaM vars and canonicalize
        out = _auto_prefix_adam_vars(out)

        # ensure target display node exists with meaningful type
        if not any(str(n.get("id","")).lower()==_norm(display_id) for n in out["lineage"]["nodes"]):
            out["lineage"]["nodes"].append({"id": display_id, "type": "tlf display",
                                            "explanation":"[general] Display node added by post-processor."})

        out = _validate_and_fix_graph(out)

        # If SDTM parents are missing, run augmentation to add them
        out = _augment_backtrace_if_missing_sdtm(out, model=model, embed_model=embed_model)

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
