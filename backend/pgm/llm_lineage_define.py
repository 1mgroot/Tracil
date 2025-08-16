#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os, re, time, json, argparse
from pathlib import Path
from typing import List, Dict, Iterable
import numpy as np
from openai import OpenAI
from openai import APIError, RateLimitError

try:
    import pandas as pd
except Exception:
    pd=None

# ---------- paths (relative to this file) ----------
HERE=Path(__file__).resolve().parent      # backend/pgm
BACKEND=HERE.parent                       # backend
DATA=BACKEND/"data"
OUTPUT=BACKEND/"output"

DEFAULT_MODEL="gpt-5"
FALLBACK_MODEL="gpt-4o"
EMBED_MODEL="text-embedding-3-small"

MAX_CHARS=1000
OVERLAP=120
TOP_K=12
MAX_TOKENS=800
EMBED_BATCH=64
MAX_INPUTS=1500
RETRY_TRIES=5
RETRY_BASE_WAIT=1.5

def read_text_file(p:Path)->str:
    try:
        return p.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return p.read_text(errors="ignore")

def read_excel_as_text(p:Path)->str:
    if pd is None:
        raise SystemExit("pandas/openpyxl required for Excel.")
    try:
        xl=pd.ExcelFile(p)
        blocks=[]
        for sh in xl.sheet_names:
            df=xl.parse(sh, dtype=str).fillna("")
            if df.empty:
                continue
            df.columns=[str(c).strip() for c in df.columns]
            likely=[c for c in df.columns if re.search(r"(var|variable|name)$", c, re.I)]
            extra=[c for c in df.columns if c not in likely]
            lines=[]
            for _,row in df.iterrows():
                left=" / ".join([row[c] for c in likely if row.get(c)]) if likely else ""
                right="; ".join([f"{c}={row[c]}" for c in extra if row.get(c)])
                line=(f"{left} :: {right}").strip(" :")
                if line and len(line)>2:
                    lines.append(line)
            if lines:
                blocks.append(f"[SHEET: {sh}]\n"+"\n".join(lines))
        return f"[EXCEL_SPEC: {p.name}]\n"+("\n\n".join(blocks) if blocks else "[EMPTY]")
    except Exception as e:
        return f"[EXCEL_READ_ERROR {p.name}] {e}"

def read_define_or_spec(path_str:str)->Dict:
    p=Path(path_str)
    if not p.exists():
        raise SystemExit(f"File not found: {p}")
    ext=p.suffix.lower()
    if ext in [".xml",".html",".htm"]:
        return {"id":p.name,"text":read_text_file(p)}
    if ext in [".xlsx",".xlsm",".xls"]:
        return {"id":p.name,"text":read_excel_as_text(p)}
    return {"id":p.name,"text":read_text_file(p)}

def read_crf_index_csv_as_text(csv_path:str)->Dict:
    p=Path(csv_path)
    if not p.exists():
        raise SystemExit(f"CRF index CSV not found: {p}")
    import csv
    lines=[]
    with open(p,"r",encoding="utf-8") as f:
        r=csv.DictReader(f)
        for row in r:
            var=(row.get("var") or row.get("VAR") or "").strip()
            page=(row.get("page") or row.get("PAGE") or "").strip()
            ctx=(row.get("context") or row.get("CONTEXT") or "").strip()
            if var:
                lines.append(f"CRF_VAR={var} | PAGE={page} | CONTEXT={ctx}")
    return {"id":p.name,"text":"[CRF_INDEX]\n"+("\n".join(lines) if lines else "[EMPTY]")}

def chunk_text(doc_id:str, text:str, max_chars=MAX_CHARS, overlap=OVERLAP)->List[Dict]:
    chunks=[]; i=0
    while i<len(text):
        j=min(len(text), i+max_chars)
        if j<len(text):
            k=text.rfind("\n", i, j)
            if k>-1 and (j-k)<200: j=k
        chunks.append({"id":f"{doc_id}#{len(chunks)}","text":text[i:j]})
        i=max(j-overlap, j)
    return chunks

def _batch(xs:List[str], n:int)->Iterable[List[str]]:
    for i in range(0,len(xs),n):
        yield xs[i:i+n]

def _retry(fn,*args,**kwargs):
    tries=RETRY_TRIES; delay=RETRY_BASE_WAIT; last=None
    for _ in range(tries):
        try:
            return fn(*args,**kwargs)
        except (RateLimitError, APIError) as e:
            last=e; time.sleep(delay); delay*=2
        except Exception as e:
            last=e; break
    if last: raise last

def embed_texts(client:OpenAI, texts:List[str])->np.ndarray:
    vecs=[]
    for group in _batch(texts, EMBED_BATCH):
        resp=_retry(client.embeddings.create, model=EMBED_MODEL, input=group)
        vecs.extend([np.array(d.embedding, dtype=np.float32) for d in resp.data])
    return np.vstack(vecs)

def cosine_sim(a:np.ndarray, b:np.ndarray)->np.ndarray:
    a=a/(np.linalg.norm(a, axis=1, keepdims=True)+1e-8)
    b=b/(np.linalg.norm(b, axis=1, keepdims=True)+1e-8)
    return a@b.T

def _prefilter_chunks(chunks:List[Dict], target:str)->List[Dict]:
    target_u=target.upper()
    toks=set([t for t in target_u.replace("."," ").split() if len(t)>=3])
    toks|={"DERIV","DERIVED","ORIGIN","SOURCE","DOCUMENTREF","SDTM","ADAM","ADSL","ADTTE","AVAL",
           "DM","EX","AE","QS","SV","VS","LB","RFSTDTC","BRTHDTC","AGE","SEX","RACE","ETHNIC","QSTESTCD"}
    scored=[]
    for c in chunks:
        T=c["text"].upper()
        score=sum(1 for tok in toks if tok in T)
        scored.append((score,c))
    scored.sort(key=lambda x:x[0], reverse=True)
    keep=min(MAX_INPUTS, max(300,len(scored)))
    return [c for _,c in scored[:keep]]

def retrieve(client:OpenAI, chunks:List[Dict], query:str, k:int=TOP_K)->List[Dict]:
    chunks=_prefilter_chunks(chunks, query)
    texts=[c["text"] for c in chunks]
    chunk_vecs=embed_texts(client, texts)
    q_vec=embed_texts(client, [query])
    sims=cosine_sim(q_vec, chunk_vecs).ravel()
    idx=sims.argsort()[::-1][:k]
    return [chunks[i] for i in idx]

def build_prompt(target_var:str, retrieved:List[Dict])->List[Dict]:
    SYSTEM=(
        "You are a senior CDISC expert. Use ONLY the provided evidence blocks "
        "(SDTM define/spec, ADaM define/spec, CRF-index). "
        "Infer a full lineage graph preferring CRF→SDTM→ADaM. "
        "CRF details must come only from CRF-index evidence. "
        "Return strict JSON with nodes/edges/derivation/paths/evidence_snippets."
    )
    EVIDENCE="\n\n--- EVIDENCE ---\n"
    for c in retrieved:
        EVIDENCE+=f"\n[CHUNK {c['id']}]\n{c['text'][:2500]}\n"
    USER=f"""
TARGET VARIABLE: {target_var}

RETURN JSON WITH THIS SCHEMA EXACTLY:
{{
  "target":"string",
  "graph":{{
    "nodes":[{{"id":"string","type":"crf|sdtm|adam","label":"string","domain":"string|null","var":"string|null","origin":"string|null","notes":"string|null"}}],
    "edges":[{{"from":"string","to":"string","type":"mapped_from|derived_from|input|copy","evidence":"string"}}]
  }},
  "derivation":{{"type":"arithmetic|lookup_merge|aggregation|copy|other","formula":"string","assumptions":"string","sources":[{{"name":"string","role":"string","evidence":"string"}}]}},
  "paths":[["string","string","string"]],
  "evidence_snippets":[{{"chunk_id":"string","text":"string"}}]
}}

RULES:
- SDTM/ADaM node ids must be 'SDTM.DOMAIN.VAR' or 'ADaM.DATASET.VAR'.
- CRF nodes must be created only from CRF-index evidence like 'CRF.VISITNUM:Page7'.
- If copied from a single upstream, set derivation.type='copy'; otherwise use the appropriate type.
- Enumerate all distinct upstream paths.

{EVIDENCE}
"""
    return [{"role":"system","content":SYSTEM},{"role":"user","content":USER}]

def chat_json(client:OpenAI, messages:List[Dict], model:str)->Dict:
    def _call(mdl:str):
        return _retry(
            client.chat.completions.create,
            model=mdl,
            temperature=0.0,
            response_format={"type":"json_object"},
            messages=messages,
            max_tokens=MAX_TOKENS
        )
    try:
        resp=_call(model)
    except Exception:
        resp=_call(FALLBACK_MODEL)
    txt=resp.choices[0].message.content.strip()
    return json.loads(txt)

def main():
    ap=argparse.ArgumentParser(description="Lineage from SDTM/ADaM define/spec + CRF index (JSON-safe).")
    # You will likely pass these; defaults shown for convenience if you place defines under backend/data
    ap.add_argument("--sdtm-define", required=True, help="Path to SDTM define.xml/html or spec .xlsx/.xlsm/.xls")
    ap.add_argument("--adam-define", required=True, help="Path to ADaM define.xml/html or spec .xlsx/.xlsm/.xls")
    ap.add_argument("--crf-index", default=str(OUTPUT/"acrf_var_index.csv"), help="Path to CRF index CSV")
    ap.add_argument("--target", required=True, help='Target variable like "ADSL.AGE" or "SDTM.QSTESTCD"')
    ap.add_argument("--out", required=False, help="Output JSON path")
    ap.add_argument("--model", default=DEFAULT_MODEL, help=f"Chat model (default: {DEFAULT_MODEL})")
    args=ap.parse_args()

    api_key=os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise SystemExit("OPENAI_API_KEY is not set.")
    client=OpenAI(api_key=api_key)

    sdtm_doc=read_define_or_spec(args.sdtm_define)
    adam_doc=read_define_or_spec(args.adam_define)
    crf_doc =read_crf_index_csv_as_text(args.crf_index)

    docs=[
        {"id":f"SDTM::{sdtm_doc['id']}", "text":sdtm_doc["text"]},
        {"id":f"ADaM::{adam_doc['id']}", "text":adam_doc["text"]},
        {"id":f"CRF_INDEX::{crf_doc['id']}", "text":crf_doc["text"]},
    ]

    chunks=[]
    for d in docs:
        chunks+=chunk_text(d["id"], d["text"], MAX_CHARS, OVERLAP)

    query=(f"Full lineage to {args.target} using SDTM/ADaM define/spec and CRF-index; "
           "CRF nodes must come only from CRF-index; include multi-branch sources.")
    top_chunks=retrieve(client, chunks, query, k=TOP_K)

    messages=build_prompt(args.target, top_chunks)
    result=chat_json(client, messages, args.model)

    out_path=Path(args.out or (OUTPUT/f"lineage_{args.target.replace('.','_')}.json"))
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(f"Saved: {out_path}")
    print(json.dumps(result, indent=2))

if __name__=="__main__":
    main()
