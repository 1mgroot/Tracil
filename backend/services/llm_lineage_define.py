#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
services/llm_lineage_define.py

LLM-driven lineage builder for Protocol → CRF → SDTM → ADaM → TLF.
- Uses ORIGINAL files from the latest backend/output/session_*/ folder:
  * SDTM/ADaM define.xml/.html/.htm or spec .xlsx/.xlsm/.xls
  * Protocol plain-text (derived)
  * aCRF variable index CSV (derived)
  * TLF titles (derived; NOT full TLF PDF to save tokens)
- Returns the STRICT JSON shape the frontend expects:
  {
    "variable": "<VAR>",
    "dataset": "<DS>",
    "lineage": {
      "nodes": [...],
      "edges": [...],
      "gaps": [...]
    }
  }

Auth:
- Reads OPENAI_API_KEY from environment.
"""

import os, re, json, time
from pathlib import Path
from typing import Any, Dict, List, Optional, Iterable, Tuple
import numpy as np

# --- OpenAI client (ENV-based) ---
from openai import OpenAI
from openai import APIError, RateLimitError

try:
    import pandas as pd
except Exception:
    pd = None

# ---------------- params (tuned for cost) ----------------
DEFAULT_MODEL   = "gpt-4o"           # preferred
FALLBACK_MODEL  = "gpt-4o-mini"      # fallback
EMBED_MODEL     = "text-embedding-3-small"

MAX_CHARS       = 900
OVERLAP         = 100
TOP_K           = 12
EMBED_BATCH     = 64
MAX_INPUTS      = 1500
MAX_TOKENS      = 1000
RETRY_TRIES     = 5
RETRY_BASE_WAIT = 1.5

BASE_DIR   = Path(__file__).resolve().parents[1]   # backend/
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


def _read_text_file(p: Path) -> str:
    try:
        return p.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return p.read_text(errors="ignore")


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
    toks |= {"CRF","PROTOCOL","SDTM","ADAM","TLF","DERIV","DERIVED","SOURCE","MAP","LINK","VAR","VARIABLE"}
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

    return out


# ---------------- prompt ----------------

def _build_messages(target_ds: str, target_var: str, retrieved: List[Dict[str,str]]) -> List[Dict[str,str]]:
    SYSTEM = (
        "You are a senior CDISC standards expert helping to build a TOOL for TRACEABILITY "
        "across CDISC layers (Protocol → CRF → SDTM → ADaM → TLF).\n"
        "The user provides a target variable, either from SDTM or ADaM.\n\n"
        "Your job: Construct a detailed lineage graph.\n"
        "- Trace backward to Protocol (exact section/page) and CRF (exact page/field).\n"
        "- Trace forward to all SDTM and ADaM variables (multi-level possible).\n"
        "- Include TLFs that consume the ADaM variables.\n\n"
        "Rules:\n"
        "- Always resolve lineage to exact variable level (e.g., SDTM.DM.AGE not just SDTM.DM).\n"
        "- For ADaM variables: capture ALL possible SDTM parents (and their CRF/Protocol pages).\n"
        "- For SDTM variables: capture ALL downstream ADaM children (possibly multi-hop), then TLFs.\n"
        "- Include a direct Protocol → Target edge for context.\n"
        "- If inference comes from domain knowledge (not explicit evidence), label as "
        "general_knowledge with low confidence.\n"
        "- Return STRICT JSON in this schema:\n"
        "{\n"
        "  'variable': '<VAR>',\n"
        "  'dataset': '<DS>',\n"
        "  'lineage': {\n"
        "    'nodes': [ {id, type, file?, label?, description?, confidence?} ],\n"
        "    'edges': [ {source, target, label?, confidence?} ],\n"
        "    'gaps':  [ {source?, target?, explanation, confidence?} ]\n"
        "  }\n"
        "}\n"
    )

    EVIDENCE = "\n\n--- EVIDENCE ---\n"
    for c in retrieved:
        EVIDENCE += f"\n[CHUNK {c['id']}]\n{c['text'][:2400]}\n"

    USER = f"Target variable: {target_ds}.{target_var}\nBuild the full traceability graph now.\n{EVIDENCE}"

    return [{"role":"system","content":SYSTEM},{"role":"user","content":USER}]


# ---------------- main ----------------

def build_lineage_with_llm_from_session(
    dataset: str,
    variable: str,
    files_ctx: Optional[List[Dict[str, Any]]] = None,
    *,
    model: str = DEFAULT_MODEL,
    embed_model: str = EMBED_MODEL
) -> Dict[str, Any]:
    client = _make_client()
    sess = _latest_session()
    summary = _load_session_summary(sess)
    pairs = _collect_evidence_texts(sess, summary)

    chunks=[]
    for doc_id, text in pairs:
        chunks += _chunk_text(doc_id, text, MAX_CHARS, OVERLAP)

    if not chunks:
        return {"variable": variable,"dataset": dataset,"lineage":{"nodes":[{"id":f"ADaM.{dataset.upper()}.{variable.upper()}","type":"target","file":"define"}],"edges":[],"gaps":["No evidence found."]}}

    query = f"Trace lineage for {dataset}.{variable} across Protocol→CRF→SDTM→ADaM→TLF."
    global EMBED_MODEL; old_embed = EMBED_MODEL; EMBED_MODEL = embed_model or EMBED_MODEL
    try:
        top_chunks = _retrieve(client, chunks, query, k=TOP_K)
    finally:
        EMBED_MODEL = old_embed

    messages = _build_messages(dataset, variable, top_chunks)

    def _chat_call(m: str):
        resp = _retry(client.chat.completions.create,model=m,temperature=0.0,
                      response_format={"type":"json_object"},
                      messages=messages,max_tokens=MAX_TOKENS)
        return json.loads(resp.choices[0].message.content.strip())

    try:
        raw = _chat_call(model)
    except Exception:
        raw = _chat_call(FALLBACK_MODEL)

    try:
        out = {
            "variable": raw.get("variable") or variable,
            "dataset": raw.get("dataset") or dataset,
            "lineage": {
                "nodes": list(raw.get("lineage", {}).get("nodes", [])),
                "edges": list(raw.get("lineage", {}).get("edges", [])),
                "gaps": list(raw.get("lineage", {}).get("gaps", [])),
            }
        }
        if not any(n.get("id")==f"ADaM.{dataset.upper()}.{variable.upper()}" for n in out["lineage"]["nodes"]):
            out["lineage"]["nodes"].append({"id":f"ADaM.{dataset.upper()}.{variable.upper()}","type":"target","file":"define"})
        return out
    except Exception as e:
        return {"variable":variable,"dataset":dataset,"lineage":{"nodes":[{"id":f"ADaM.{dataset.upper()}.{variable.upper()}","type":"target","file":"define"}],"edges":[],"gaps":[f"Post-processing error: {e}"]}}
