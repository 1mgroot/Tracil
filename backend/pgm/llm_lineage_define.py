#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
LLM-only lineage builder (GPT-5 first, 4o fallback).

- SDTM + ADaM inputs can be Define-XML/HTML or spec spreadsheets (.xlsx/.xlsm/.xls).
- CRF→SDTM linkage ONLY comes from the pre-built CSV (aCRF preprocessor output).
- Reads all sources as plain text evidence (no schema parsing).
- Batches embeddings to avoid "max_tokens_per_request".
- Forces valid JSON response with response_format={"type": "json_object"} to avoid JSONDecodeError.
- Retries 429/5xx with exponential backoff.

Usage:
  pip install openai pandas openpyxl numpy
  export OPENAI_API_KEY="sk-..."
  python llm_lineage_gpt5.py \
    --sdtm-define "/path/define_sdtm.xml|.html|.xlsx" \
    --adam-define "/path/define_adam.xml|.html|.xlsx" \
    --crf-index   "/path/acrf_var_index.csv" \
    --target "ADSL.AGE" \
    --out "/path/lineage_ADSL_AGE.json"
"""

import os, re, time, json, argparse
from pathlib import Path
from typing import List, Dict, Iterable, Optional

import numpy as np
from openai import OpenAI
from openai import APIError, RateLimitError

# Optional (only needed if you pass Excel specs)
try:
    import pandas as pd
except Exception:
    pd = None

# -----------------------------
# Config
# -----------------------------
DEFAULT_MODEL   = "gpt-5"                 # primary
FALLBACK_MODEL  = "gpt-4o"                # fallback if 5 unavailable
EMBED_MODEL     = "text-embedding-3-small"

MAX_CHARS       = 1000                    # per chunk
OVERLAP         = 120
TOP_K           = 12                      # top retrieved evidence chunks
MAX_TOKENS      = 800                     # for the JSON answer
EMBED_BATCH     = 64                      # batch size for embeddings
MAX_INPUTS      = 1500                    # cap prefiltered chunks (keeps cost down)

RETRY_TRIES     = 5
RETRY_BASE_WAIT = 1.5

# -----------------------------
# IO helpers
# -----------------------------
def read_text_file(p: Path) -> str:
    try:
        return p.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return p.read_text(errors="ignore")

def read_excel_as_text(p: Path) -> str:
    """
    Flatten an SDTM/ADaM spec spreadsheet to text. Very tolerant.
    """
    if pd is None:
        raise SystemExit("pandas/openpyxl needed for Excel: pip install pandas openpyxl")

    try:
        xl = pd.ExcelFile(p)
        blocks: List[str] = []
        for sh in xl.sheet_names:
            df = xl.parse(sh, dtype=str).fillna("")
            if df.empty:
                continue
            df.columns = [str(c).strip() for c in df.columns]
            likely_cols = [c for c in df.columns if re.search(r"(var|variable|name)$", c, re.I)]
            extra_cols  = [c for c in df.columns if c not in likely_cols]

            lines = []
            for _, row in df.iterrows():
                left = " / ".join([row[c] for c in likely_cols if row.get(c)]) if likely_cols else ""
                right_bits = [f"{c}={row[c]}" for c in extra_cols if row.get(c)]
                right = "; ".join(right_bits)
                line = (f"{left} :: {right}").strip(" :")
                if line and len(line) > 2:
                    lines.append(line)
            if lines:
                blocks.append(f"[SHEET: {sh}]\n" + "\n".join(lines))

        return f"[EXCEL_SPEC: {p.name}]\n" + ("\n\n".join(blocks) if blocks else "[EMPTY]")
    except Exception as e:
        return f"[EXCEL_READ_ERROR {p.name}] {e}"

def read_define_or_spec(path_str: str) -> Dict:
    """
    Accept .xml/.html/.htm or .xlsx/.xlsm/.xls (define or spec).
    Returns {"id": name, "text": text}
    """
    p = Path(path_str)
    if not p.exists():
        raise SystemExit(f"File not found: {p}")
    ext = p.suffix.lower()
    if ext in [".xml", ".html", ".htm"]:
        return {"id": p.name, "text": read_text_file(p)}
    if ext in [".xlsx", ".xlsm", ".xls"]:
        return {"id": p.name, "text": read_excel_as_text(p)}
    # fallback
    return {"id": p.name, "text": read_text_file(p)}

def read_crf_index_csv_as_text(csv_path: str) -> Dict:
    """
    Read the CRF index CSV from the preprocessor (var,page,context).
    """
    p = Path(csv_path)
    if not p.exists():
        raise SystemExit(f"CRF index CSV not found: {p}")

    import csv
    lines = []
    with open(p, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            var = (row.get("var") or row.get("VAR") or "").strip()
            page = (row.get("page") or row.get("PAGE") or "").strip()
            ctx  = (row.get("context") or row.get("CONTEXT") or "").strip()
            if not var:
                continue
            lines.append(f"CRF_VAR={var} | PAGE={page} | CONTEXT={ctx}")
    text = "[CRF_INDEX]\n" + ("\n".join(lines) if lines else "[EMPTY]")
    return {"id": p.name, "text": text}

# -----------------------------
# Chunking & retrieval
# -----------------------------
def chunk_text(doc_id: str, text: str, max_chars=MAX_CHARS, overlap=OVERLAP) -> List[Dict]:
    chunks, i = [], 0
    while i < len(text):
        j = min(len(text), i + max_chars)
        if j < len(text):
            k = text.rfind("\n", i, j)
            if k > -1 and (j - k) < 200:
                j = k
        chunks.append({"id": f"{doc_id}#{len(chunks)}", "text": text[i:j]})
        i = max(j - overlap, j)
    return chunks

def _batch(xs: List[str], n: int) -> Iterable[List[str]]:
    for i in range(0, len(xs), n):
        yield xs[i:i+n]

def _retry(fn, *args, **kwargs):
    """
    Retry wrapper for API calls (429, 5xx).
    """
    tries = RETRY_TRIES
    delay = RETRY_BASE_WAIT
    last_exc = None
    for _ in range(tries):
        try:
            return fn(*args, **kwargs)
        except (RateLimitError, APIError) as e:
            last_exc = e
            # exponential backoff
            time.sleep(delay)
            delay *= 2
        except Exception as e:
            last_exc = e
            break
    if last_exc:
        raise last_exc

def embed_texts(client: OpenAI, texts: List[str]) -> np.ndarray:
    """
    Batched embeddings to avoid per-request token cap.
    """
    vecs: List[np.ndarray] = []
    for group in _batch(texts, EMBED_BATCH):
        resp = _retry(client.embeddings.create, model=EMBED_MODEL, input=group)
        vecs.extend([np.array(d.embedding, dtype=np.float32) for d in resp.data])
    return np.vstack(vecs)

def cosine_sim(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    a = a / (np.linalg.norm(a, axis=1, keepdims=True) + 1e-8)
    b = b / (np.linalg.norm(b, axis=1, keepdims=True) + 1e-8)
    return a @ b.T

def _prefilter_chunks(chunks: List[Dict], target: str) -> List[Dict]:
    """
    Cheap keyword scoring to cut down total embeddings cost.
    """
    target_u = target.upper()
    toks = set([t for t in target_u.replace(".", " ").split() if len(t) >= 3])
    toks |= {
        "DERIV", "DERIVED", "ORIGIN", "SOURCE", "DOCUMENTREF",
        "SDTM", "ADAM", "ADSL", "ADTTE", "AVAL",
        "DM", "EX", "AE", "QS", "SV", "VS", "LB",
        "RFSTDTC", "BRTHDTC", "AGE", "SEX", "RACE", "ETHNIC", "QSTESTCD"
    }
    scored = []
    for c in chunks:
        T = c["text"].upper()
        score = sum(1 for tok in toks if tok in T)
        scored.append((score, c))
    scored.sort(key=lambda x: x[0], reverse=True)
    keep_n = min(MAX_INPUTS, max(300, len(scored)))
    return [c for _, c in scored[:keep_n]]

def retrieve(client: OpenAI, chunks: List[Dict], query: str, k=TOP_K) -> List[Dict]:
    chunks = _prefilter_chunks(chunks, query)
    texts = [c["text"] for c in chunks]
    chunk_vecs = embed_texts(client, texts)
    q_vec = embed_texts(client, [query])
    sims = cosine_sim(q_vec, chunk_vecs).ravel()
    idx = sims.argsort()[::-1][:k]
    return [chunks[i] for i in idx]

# -----------------------------
# Prompt + LLM call
# -----------------------------
def build_prompt(target_var: str, retrieved: List[Dict]) -> List[Dict]:
    SYSTEM = (
        "You are a senior CDISC expert. Use ONLY the provided evidence blocks:\n"
        "- SDTM define/spec text\n"
        "- ADaM define/spec text\n"
        "- CRF index (CSV-derived: var/page/context)\n\n"
        "Infer a FULL lineage graph for the target. Prefer CRF → SDTM → ADaM. "
        "CRF details MUST come only from the CRF-index evidence. "
        "If exact SDTM vars are unclear, placeholders like 'SDTM.EX.*' are OK. "
        "Return STRICT JSON ONLY with nodes/edges/derivation/paths (multi-branch allowed)."
    )

    EVIDENCE = "\n\n--- EVIDENCE ---\n"
    for c in retrieved:
        EVIDENCE += f"\n[CHUNK {c['id']}]\n{c['text'][:2500]}\n"

    USER = f"""
TARGET VARIABLE: {target_var}

RETURN JSON WITH THIS SCHEMA EXACTLY:
{{
  "target": "string",
  "graph": {{
    "nodes": [
      {{"id":"string","type":"crf|sdtm|adam","label":"string","domain":"string|null","var":"string|null","origin":"string|null","notes":"string|null"}}
    ],
    "edges": [
      {{"from":"string","to":"string","type":"mapped_from|derived_from|input|copy","evidence":"string"}}
    ]
  }},
  "derivation": {{
    "type": "arithmetic|lookup_merge|aggregation|copy|other",
    "formula": "string",
    "assumptions": "string",
    "sources": [{{"name":"string","role":"string","evidence":"string"}}]
  }},
  "paths": [
    ["string","string","string"]
  ],
  "evidence_snippets": [
    {{"chunk_id":"string","text":"string"}}
  ]
}}

RULES:
- SDTM/ADaM node ids must be 'SDTM.DOMAIN.VAR' or 'ADaM.DATASET.VAR'.
- CRF nodes MUST be created only from CRF-index evidence: e.g., 'CRF.VISITNUM:Page7'.
- If the target is just copied from a single upstream, set type='copy'.
- If it uses multiple inputs or arithmetic, set type='arithmetic' and include a short formula.
- Enumerate ALL distinct upstream paths (earliest source → target).

{EVIDENCE}
"""
    return [
        {"role": "system", "content": SYSTEM},
        {"role": "user", "content": USER}
    ]

def chat_json(client: OpenAI, messages: List[Dict], model: str) -> Dict:
    """
    Call chat completions forcing JSON output; retry with fallback model if needed.
    """
    def _call(mdl: str):
        return _retry(
            client.chat.completions.create,
            model=mdl,
            temperature=0.0,
            response_format={"type": "json_object"},  # <<< forces valid JSON
            messages=messages,
            max_tokens=MAX_TOKENS
        )

    try:
        resp = _call(model)
    except Exception:
        # fallback once
        resp = _call(FALLBACK_MODEL)

    txt = resp.choices[0].message.content.strip()
    # Guaranteed to be a JSON object because of response_format
    return json.loads(txt)

# -----------------------------
# Main
# -----------------------------
def main():
    ap = argparse.ArgumentParser(
        description="Lineage from SDTM/ADaM (define/spec) + CRF index CSV using GPT-5 with JSON-safe output."
    )
    ap.add_argument("--sdtm-define", required=True, help="Path to SDTM define.xml/html or spec .xlsx/.xlsm/.xls")
    ap.add_argument("--adam-define", required=True, help="Path to ADaM define.xml/html or spec .xlsx/.xlsm/.xls")
    ap.add_argument("--crf-index",   required=True, help="Path to CRF index CSV (from aCRF preprocessor)")
    ap.add_argument("--target",      required=True, help='Target variable, e.g., "ADSL.AGE" or "SDTM.QSTESTCD"')
    ap.add_argument("--out",         required=False, help="Output JSON path")
    ap.add_argument("--model",       default=DEFAULT_MODEL, help=f"Chat model (default: {DEFAULT_MODEL})")
    args = ap.parse_args()

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise SystemExit("OPENAI_API_KEY is not set.")

    client = OpenAI(api_key=api_key)

    # Gather documents
    sdtm_doc = read_define_or_spec(args.sdtm_define)
    adam_doc = read_define_or_spec(args.adam_define)
    crf_doc  = read_crf_index_csv_as_text(args.crf_index)

    docs = [
        {"id": f"SDTM::{sdtm_doc['id']}", "text": sdtm_doc["text"]},
        {"id": f"ADaM::{adam_doc['id']}", "text": adam_doc["text"]},
        {"id": f"CRF_INDEX::{crf_doc['id']}", "text": crf_doc["text"]},
    ]

    # Chunk & retrieve
    chunks: List[Dict] = []
    for d in docs:
        chunks += chunk_text(d["id"], d["text"], MAX_CHARS, OVERLAP)

    query = (
        f"Full lineage to {args.target} using SDTM/ADaM define/spec + CRF-index; "
        "CRF nodes must come only from CRF-index CSV; include multi-branch sources."
    )
    top_chunks = retrieve(client, chunks, query, k=TOP_K)

    # Ask LLM (JSON guaranteed)
    messages = build_prompt(args.target, top_chunks)
    result = chat_json(client, messages, args.model)

    out_path = args.out or f"lineage_{args.target.replace('.','_')}.json"
    Path(out_path).write_text(json.dumps(result, indent=2))
    print(f"Saved: {out_path}")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
