# services/tlf_lineage_from_ars_llm.py
# LLM-only ARS cell resolver with Protocol/CRF-first anchoring and synonym support.

from __future__ import annotations
import os, re, json, time
from pathlib import Path
from typing import Any, Dict, List, Tuple, Optional, Iterable
import numpy as np

try:
    from openai import OpenAI
    from openai import APIError, RateLimitError
except Exception:
    OpenAI = None
    APIError = Exception
    RateLimitError = Exception

# ---------------- config ----------------
BASE_DIR   = Path(__file__).resolve().parents[1]
OUTPUT_DIR = BASE_DIR / "output"

DEFAULT_MODEL   = os.getenv("TRACE_LLM_MODEL", "gpt-4o")
FALLBACK_MODEL  = os.getenv("TRACE_LLM_FALLBACK_MODEL", "gpt-4o-mini")
EMBED_MODEL     = os.getenv("TRACE_EMBED_MODEL", "text-embedding-3-small")

MAX_CHARS       = 900
OVERLAP         = 100
TOP_K           = 14
EMBED_BATCH     = 64
MAX_TOKENS      = 1400
RETRY_TRIES     = 5
RETRY_BASE_WAIT = 1.5

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
    if OpenAI is None:
        raise RuntimeError("openai client not available")
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY environment variable is not set.")
    return OpenAI(api_key=api_key)

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
    target_u = (target or "").upper()
    toks = set([t for t in re.split(r"[^A-Z0-9]+", target_u.replace(".", " ")) if len(t) >= 3])
    # Always include these anchors
    toks |= {"ARS","ADAM","ADSL","ADAE","ADVS","PARAM","AVAL","BASE","TRT","TRT01A","TRT01AN","AVISIT","VISIT","CHG","CHANGE"}
    scored=[]
    for c in chunks:
        T = c["text"].upper()
        score = sum(1 for tok in toks if tok in T)
        scored.append((score, c))
    scored.sort(key=lambda x: x[0], reverse=True)
    keep = min(1200, max(300, len(scored)))
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

def _validate_and_fix_graph(graph: Dict[str, Any]) -> Dict[str, Any]:
    """Lightweight structural hygiene only (no literal-evidence validator)."""
    lineage = graph.setdefault("lineage", {"nodes": [], "edges": [], "gaps": []})
    nodes   = lineage.setdefault("nodes", [])
    edges   = lineage.setdefault("edges", [])
    gaps    = lineage.setdefault("gaps", [])

    # De-duplicate nodes by id, keep first
    node_map: Dict[str, Dict[str, Any]] = {}
    order: List[str] = []
    for n in nodes:
        nid = str(n.get("id") or "").strip()
        if not nid:
            continue
        if nid not in node_map:
            node_map[nid] = dict(n); order.append(nid)
        else:
            # shallow merge extras
            for k, v in n.items():
                if k not in node_map[nid] or node_map[nid][k] in (None, "", []):
                    node_map[nid][k] = v

    nodes_fixed = [node_map[nid] for nid in order]

    # Normalize edges, drop structurally invalid ones
    edges_fixed = []
    for e in edges:
        if "from" not in e and "source" in e: e["from"] = e.pop("source")
        if "to"   not in e and "target" in e: e["to"]   = e.pop("target")
        frm = str(e.get("from") or "").strip()
        to  = str(e.get("to")   or "").strip()
        if not frm or not to:
            continue
        if frm not in node_map or to not in node_map:
            continue
        edges_fixed.append(e)

    lineage["nodes"] = nodes_fixed
    lineage["edges"] = edges_fixed
    lineage["gaps"]  = [g for g in gaps if isinstance(g, (str, dict))]
    return graph

# ---------------- evidence collection ----------------
def _collect_evidence_prioritized(sess_dir: Path, summary: Dict[str, Any]) -> List[Tuple[str,str]]:
    """
    Priority order:
      1) CRF index CSV (derived text)
      2) Protocol text
      3) USDM design JSON (endpoints/SoA)
      4) ARS/ARD JSONs (all uploaded for this session)
      5) TLF titles (if any)
    """
    out: List[Tuple[str,str]] = []
    file_index: Dict[str, Path] = {}
    for sf in summary.get("metadata",{}).get("sourceFiles", []):
        fid = sf.get("filename") or sf.get("id")
        if fid: file_index[fid] = sess_dir / fid

    # 1) CRF index (text csv)
    crf = summary.get("standards",{}).get("CRF",{}).get("datasetEntities",{}).get("aCRF")
    if crf:
        md = crf.get("metadata",{})
        fid = md.get("varIndexCsv")
        if fid and (sess_dir / fid).exists():
            txt = _read_text_file(sess_dir / fid)
            out.append((f"CRF_INDEX::{fid}", txt))

    # 2) Protocol text
    proto = summary.get("standards",{}).get("Protocol",{}).get("datasetEntities",{}).get("Protocol")
    if proto:
        md = proto.get("metadata",{})
        fid = md.get("textFile")
        if fid and (sess_dir / fid).exists():
            txt = _read_text_file(sess_dir / fid)
            out.append((f"PROTOCOL::{fid}", txt))

    # 3) USDM design
    usdm = summary.get("standards",{}).get("Protocol",{}).get("datasetEntities",{}).get("StudyDesign_USDM")
    if usdm:
        design = usdm.get("metadata",{}).get("design") or {}
        out.append(("USDM::design", json.dumps(design, indent=2)))

    # 4) ARS/ARD JSONs
    for p in sorted(sess_dir.glob("*.json")):
        nm = p.name.lower()
        if nm.endswith(("-ars.json","-ard.json")):
            out.append((f"ARS::{p.name}", _read_json_file_text(p)))

    # 5) TLF titles blocks
    for key, ent in (summary.get("standards",{}).get("TLF",{}).get("datasetEntities") or {}).items():
        meta = ent.get("metadata",{})
        titles = meta.get("titles") or []
        if titles:
            joined = "\n".join([f"{t.get('id')}: {t.get('title')}" for t in titles[:200]])
            out.append((f"TLF_TITLES::{key}", "[TLF_TITLES]\n"+joined))

    return out

# ---------------- synonym map ----------------
_SYNONYMS = {
    # treatment
    "treatment": ["arm", "group", "trt", "trt01a", "trt01an", "treatment arm", "dose", "drug"],
    # visit
    "visit": ["avisit", "avisitn", "week", "timepoint", "visit week", "visit number"],
    # change
    "chg": ["change", "chg from baseline", "change from baseline", "delta", "difference", "chgbl", "chg_from_baseline"],
    # parameter
    "param": ["parameter", "paramcd", "paramn", "vstest", "vstestcd", "endpoint", "measure"],
    # population/flags (do not inject unless present, but help match phrasing)
    "pop": ["safety population", "itt", "pp", "saffl", "efffl", "fas", "analysis set"],
    # stats
    "min": ["minimum", "lowest"], "max": ["maximum", "highest"], "mean": ["average"],
}

def _synonym_guidance() -> str:
    lines = []
    for canon, alts in _SYNONYMS.items():
        lines.append(f"{canon}: {', '.join(alts)}")
    return "\n".join(lines)

# ---------------- prompt ----------------
def _build_messages_for_ars_cell(
    cell_spec: str,
    retrieved: List[Dict[str,str]]
) -> List[Dict[str,str]]:
    SYSTEM = (
        "You are a CDISC lineage assistant. Build a lineage graph for ONE TLF cell using ONLY evidence from:\n"
        "  (a) ARS/ARD JSON uploaded in this session for ADaM variables, filters, slices, operations;\n"
        "  (b) Protocol text and USDM design for endpoint/SoA anchoring;\n"
        "  (c) aCRF variable index text for CRF anchors.\n"
        "Rules:\n"
        "- Do NOT invent variables. Prefer exact dataset.variable identifiers seen in ARS (e.g., ADVS.AVISIT, ADVS.CHG, ADSL.TRT01AN, ADAE.AESER).\n"
        "- If ARS uses numeric or coded fields (e.g., TRT01AN), include them as-is and add human-readable labels from the same evidence when possible.\n"
        "- Protocol/CRF nodes and edges should be [direct] only if you can cite text from Protocol/USDM or CRF index; otherwise use [general].\n"
        "- Output STRICT JSON only in this schema:\n"
        "{\n"
        "  'variable': '<original cell spec>',\n"
        "  'dataset': 'table',\n"
        "  'summary': '<one sentence>',\n"
        "  'lineage': {\n"
        "    'nodes': [ {id, type, label?, description?, explanation?} ],\n"
        "    'edges': [ {from, to, label?, explanation?} ],\n"
        "    'gaps':  [ {explanation} ]\n"
        "  }\n"
        "}\n"
        "- Node types to use: 'tlf cell', 'adam variable', 'sdtm variable', 'crf', 'protocol'.\n"
        "- Ensure all edges refer to existing node ids and use 'from'/'to'.\n"
        "- Prefer the ARS vocabulary (e.g., AVISIT/CHG/TRT01AN) over friendly aliases (VISIT/CHANGE/TRT01A).\n"
        "- If multiple ARS matches exist, choose the slice that best fits ALL segments of the user spec.\n"
        "- If nothing matches, return a minimal graph with one 'tlf cell' node and add a gap explaining why.\n"
        "\n"
        "Synonym hints to match user phrasing to ARS terms:\n" + _synonym_guidance() + "\n"
    )

    EVIDENCE = "\n\n--- EVIDENCE (prioritized: CRF, Protocol, USDM, ARS, TLF titles) ---\n"
    for c in retrieved:
        EVIDENCE += f"\n[CHUNK {c['id']}]\n{c['text'][:2400]}\n"

    USER = (
        f"User TLF cell spec (flexible segments with '|'): {cell_spec}\n"
        f"Find the best matching ARS slice(s) and build the lineage graph now.\n"
        f"{EVIDENCE}"
    )
    return [{"role":"system","content":SYSTEM},{"role":"user","content":USER}]

# ---------------- main entry ----------------
def build_table_lineage_from_ars_llm(
    display_spec: str,
    *,
    model: str = DEFAULT_MODEL,
    embed_model: str = EMBED_MODEL
) -> Dict[str, Any]:
    """
    LLM-only ARS cell lineage:
      - display_spec: 'tablename/number | row | column | param1 | ...'
      - evidence: CRF/Protocol/USDM prioritized, then ARS/ARD JSON from this session
      - output: lineage graph with TLF cell, ADaM variables (from ARS), and Protocol/CRF anchors
    """
    sess = _latest_session()
    summary = _load_session_summary(sess)

    # Build evidence chunks (prioritized)
    pairs = _collect_evidence_prioritized(sess, summary)

    # Chunk & retrieve
    client = _make_client()
    chunks=[]
    for doc_id, text in pairs:
        chunks += _chunk_text(doc_id, text, MAX_CHARS, OVERLAP)

    if not chunks:
        return {
            "variable": display_spec,
            "dataset": "table",
            "summary": "No session evidence (ARS/Protocol/CRF/USDM) available.",
            "lineage": {
                "nodes": [ {"id": display_spec, "type":"tlf cell",
                            "explanation":"[general] Target cell only; no artifacts to trace against."} ],
                "edges": [],
                "gaps":  [{"explanation":"No evidence found in session."}]
            }
        }

    query = f"Locate ARS slice for: {display_spec}. Map ADaM vars, operations, filters; anchor to Protocol/CRF if possible."
    # embeddings model selection
    global EMBED_MODEL
    old_embed = EMBED_MODEL
    if embed_model: EMBED_MODEL = embed_model
    try:
        top_chunks = _retrieve(client, chunks, query, k=TOP_K)
    finally:
        EMBED_MODEL = old_embed

    messages = _build_messages_for_ars_cell(display_spec, top_chunks)

    def _chat_call(m: str):
        resp = _retry(client.chat.completions.create, model=m, temperature=0.0,
                      response_format={"type":"json_object"},
                      messages=messages, max_tokens=MAX_TOKENS)
        return json.loads(resp.choices[0].message.content.strip())

    try:
        raw = _chat_call(model)
    except Exception:
        raw = _chat_call(FALLBACK_MODEL)

    # Shape the output and add the explicit target node if missing
    out = {
        "variable": raw.get("variable") or display_spec,
        "dataset":  "table",
        "summary":  (raw.get("summary") or "").strip(),
        "lineage": {
            "nodes": list(raw.get("lineage", {}).get("nodes", [])),
            "edges": list(raw.get("lineage", {}).get("edges", [])),
            "gaps":  list(raw.get("lineage", {}).get("gaps",  [])),
        }
    }
    # Ensure a target cell node exists
    if not any(str(n.get("id","")).strip().lower()==str(display_spec).strip().lower()
               for n in out["lineage"]["nodes"]):
        out["lineage"]["nodes"].append({
            "id": display_spec,
            "type":"tlf cell",
            "explanation":"[general] Target cell node added by post-processor."
        })

    out = _validate_and_fix_graph(out)
    if not out.get("summary"):
        out["summary"] = "Lineage assembled from ARS with Protocol/CRF/USDM anchors (session evidence)."
    return out
