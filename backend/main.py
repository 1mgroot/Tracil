# main.py
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Tuple, Optional
from pathlib import Path
from datetime import datetime
import os, shutil, json, re

# --- local services ---
from services.acrf_preprocess import acrf_preprocess
from services.protocol_preprocess import protocol_to_txt
from services.tlf_preprocess import tlf_extract_titles
from services.tlf_index import build_tlf_index_from_uploads
from services.usdm_extract import sniff_and_extract_usdm  # NEW
from services.llm_lineage_define import (
    build_lineage_with_llm_from_session,
    build_endpoint_lineage_with_llm_from_session
)

try:
    import pyreadstat
except Exception:
    pyreadstat = None

try:
    from lxml import etree
except Exception:
    etree = None

# ---------------- APP SETUP ----------------
app = FastAPI(title="Tracil AI Backend")

ALLOWED_ORIGINS = [os.getenv("ALLOWED_ORIGINS", "http://localhost:3000")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE = Path(__file__).resolve().parent
OUTPUT = BASE / "output"
OUTPUT.mkdir(parents=True, exist_ok=True)

# ---------------- helpers ----------------
def _nowz() -> str:
    return datetime.utcnow().isoformat() + "Z"

def re_search(pat: str, s: str) -> bool:
    import re as _re
    return _re.search(pat, s) is not None

def _file_kind(name: str) -> str:
    n = name.lower()
    if (n.endswith(".xml") or n.endswith(".html") or n.endswith(".htm")) and "define" in n:
        return "define_xml"
    if n.endswith(".sas7bdat"): return "sas7bdat"
    if n.endswith(".xpt"):      return "sas_xpt"
    if n.endswith(".json"):
        # classify ARD/ARS explicitly
        if re_search(r"(^|[-_])(ard|ard_fix)\.json$", n):
            return "tlf_ard_json"
        if re_search(r"(^|[-_])ars\.json$", n):
            return "tlf_ars_json"
        return "dataset_json"  # USDM will be sniffed & reclassified later
    if n.endswith(".rtf"):      return "tlf_rtf"
    if n.endswith(".docx"):     return "tlf_docx"
    if n.endswith(".pdf"):
        if "crf" in n: return "acrf_pdf"
        if "combined_tlf" in n: return "tlf_pdf"
        return "protocol_pdf"
    return "unknown"

def _save_uploads(files: List[UploadFile]) -> Tuple[Path, List[Dict[str, Any]]]:
    if not files:
        raise HTTPException(400, "No files uploaded under key 'files'.")
    sess = OUTPUT / f"session_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
    sess.mkdir(parents=True, exist_ok=True)

    seen, saved = {}, []
    for f in files:
        base = Path(f.filename).name
        root, ext = os.path.splitext(base)
        if base not in seen:
            seen[base] = 1
            save_name = base
        else:
            seen[base] += 1
            save_name = f"{root}_{seen[base]}{ext}"
        dest = sess / save_name
        with dest.open("wb") as w:
            shutil.copyfileobj(f.file, w)
        saved.append({
            "orig": base,
            "saved": save_name,
            "path": dest,
            "kind": _file_kind(base),
            "sizeKB": round(dest.stat().st_size / 1024, 1)
        })
    return sess, saved

def _attr_any_ns(elem, key):
    for k, v in elem.attrib.items():
        if k.split('}')[-1] == key:
            return v
    return None

def _cdisc_type_from_dtype(dtype: str) -> str:
    s = (dtype or "").lower()
    if any(x in s for x in ["int", "float", "double", "decimal", "number"]):
        return "numeric"
    return "character"

def _latest_session_dir() -> Optional[Path]:
    sessions = sorted([p for p in OUTPUT.glob("session_*") if p.is_dir()],
                      key=lambda p: p.stat().st_mtime, reverse=True)
    return sessions[0] if sessions else None

def _read_session_summary(sess_dir: Optional[Path]) -> Optional[Dict[str, Any]]:
    if not sess_dir:
        return None
    ss = sess_dir / "session_summary.json"
    if not ss.exists():
        return None
    try:
        return json.loads(ss.read_text(encoding="utf-8", errors="ignore"))
    except Exception:
        return None

def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", (s or "").lower()).strip()

# ---------- USDM objective/endpoint post-processing ----------
def _looks_placeholder(text: str) -> bool:
    """
    True if the string looks like TBD/TBC/placeholder regardless of extra words.
    Examples caught: "TBD", "To be determined", "To be determined from protocol", "TBC", "to be defined", etc.
    """
    if not text:
        return True
    t = (text or "").strip().lower()
    # search (not full-match) for common placeholders
    return re.search(
        r"\b(tbd|tbc|placeholder|to\s*be\s*(determined|defined|decided|confirmed|specified)|not\s+applicable|n/?a)\b",
        t
    ) is not None

def _short_phrase_llm(text: str) -> str:
    """
    Return a compact (<= 8 words, <= 80 chars) noun-phrase summary.
    Uses gpt-4o-mini when OPENAI_API_KEY is present; otherwise a heuristic fallback.
    """
    text = (text or "").strip()
    if not text:
        return ""
    phrase = ""
    # Optional LLM call
    try:
        from openai import OpenAI
        api_key = os.getenv("OPENAI_API_KEY")
        model = os.getenv("USDM_SUMMARY_MODEL", "gpt-4o-mini")
        if api_key:
            client = OpenAI(api_key=api_key)
            prompt = (
                "Summarize this clinical text as a short noun phrase, "
                "max 8 words, no trailing punctuation:\n\n" + text
            )
            resp = client.chat.completions.create(
                model=model,
                temperature=0.0,
                max_tokens=32,
                messages=[
                    {"role": "system", "content": "You write extremely concise noun phrases."},
                    {"role": "user", "content": prompt},
                ],
            )
            phrase = (resp.choices[0].message.content or "").strip().strip('"').strip("'")
    except Exception:
        phrase = ""

    # Heuristic fallback
    if not phrase:
        seg = re.split(r"[.;:\n]", text)[0]
        seg = re.sub(r"[\[\]{}()]", "", seg)
        words = seg.split()
        phrase = " ".join(words[:8]).strip()

    return phrase[:80]

def _postprocess_usdm_design(design: Dict[str, Any]) -> Dict[str, Any]:
    """
    - Rename Objective IDs to 'Objective <i> - <short phrase>'
    - Rename Endpoint IDs to 'Endpoint <i> - <short phrase>'
    - Drop endpoints whose description is placeholder/TBD
    """
    new = dict(design or {})

    # Objectives: rename IDs
    objs = list(new.get("objectives") or [])
    new_objs = []
    for i, obj in enumerate(objs, start=1):
        o = dict(obj)
        # phrase from description, backoff to name
        phrase = _short_phrase_llm(o.get("description") or o.get("name") or "")
        phrase = phrase or (o.get("name") or "").strip() or "Objective"
        o["id"] = f"Objective {i} - {phrase}"
        new_objs.append(o)
    new["objectives"] = new_objs

    # Endpoints: drop TBD and rename IDs
    eps = list(new.get("endpoints") or [])
    new_eps = []
    idx = 1
    for ep in eps:
        e = dict(ep)
        desc = (e.get("description") or "").strip()
        if _looks_placeholder(desc):
            # skip placeholders
            continue
        phrase = _short_phrase_llm(desc or e.get("name") or "")
        phrase = phrase or (e.get("name") or "").strip() or "Endpoint"
        e["id"] = f"Endpoint {idx} - {phrase}"
        new_eps.append(e)
        idx += 1
    new["endpoints"] = new_eps

    return new

# ---------------- parse define.xml/html ----------------
def parse_define_minimal(define_path: Path) -> Dict[str, Any]:
    if etree is None:
        raise RuntimeError("lxml not installed")
    root = etree.fromstring(define_path.read_bytes())
    itemdefs = {it.get("OID"): it for it in root.xpath('.//*[local-name()="ItemDef"]')}
    dataset_entities: Dict[str, Any] = {}
    for ig in root.xpath('.//*[local-name()="ItemGroupDef"]'):
        ds_name  = (ig.get("Name") or ig.get("Domain") or "UNKNOWN").upper()
        ds_label = ig.get("Label") or ds_name
        ds_type  = "analysis_dataset" if ds_name.startswith("AD") else "domain"
        variables = []
        for ref in ig.xpath('.//*[local-name()="ItemRef"]'):
            it = itemdefs.get(ref.get("ItemOID"))
            if not it:
                continue
            vname  = (it.get("Name") or "VAR").upper()
            vlabel = it.get("Label") or vname
            vtype  = _cdisc_type_from_dtype(it.get("DataType") or "character")
            vlen   = _attr_any_ns(it, "Length")
            try:
                vlen = int(vlen) if vlen else None
            except Exception:
                vlen = None
            mandatory = (ref.get("Mandatory") or "").lower() in ("yes", "true", "1")
            variables.append({
                "name": vname,
                "label": vlabel,
                "type": vtype,
                "length": vlen,
                "role": None,
                "mandatory": mandatory
            })
        dataset_entities[ds_name] = {
            "name": ds_name,
            "label": ds_label,
            "type": ds_type,
            "variables": variables,
            "sourceFiles": [{
                "fileId": define_path.name,
                "role": "primary",
                "extractedData": ["metadata", "variables", "codelists"]
            }],
            "metadata": {"records": None, "structure": None, "validationStatus": "unknown"}
        }
    return dataset_entities

# ---------------- dataset readers ----------------
def entity_from_pyreadstat(df, meta, ds_name: str, file_id: str) -> Dict[str, Any]:
    names   = list(meta.column_names) if getattr(meta, "column_names", None) else list(df.columns)
    labels  = list(meta.column_labels) if getattr(meta, "column_labels", None) else [None] * len(names)
    vtypes  = [meta.variable_types.get(nm) if getattr(meta, "variable_types", None) else str(df[nm].dtype) for nm in names]
    variables = [{
        "name": nm.upper(),
        "label": labels[i] or nm,
        "type": _cdisc_type_from_dtype(vtypes[i]),
        "length": None,
        "role": None,
        "mandatory": None
    } for i, nm in enumerate(names)]
    return {
        "name": ds_name,
        "label": ds_name,
        "type": "analysis_dataset" if ds_name.startswith("AD") else "domain",
        "variables": variables,
        "sourceFiles": [{"fileId": file_id, "role": "primary", "extractedData": ["data", "variables"]}],
        "metadata": {"records": len(df), "structure": None, "validationStatus": "unknown"}
    }

def read_sas7bdat(path: Path, ds_name: str) -> Dict[str, Any]:
    if pyreadstat is None:
        raise RuntimeError("pyreadstat not installed")
    df, meta = pyreadstat.read_sas7bdat(str(path))
    return entity_from_pyreadstat(df, meta, ds_name, path.name)

def read_xpt(path: Path, ds_name: str) -> Dict[str, Any]:
    if pyreadstat is None:
        raise RuntimeError("pyreadstat not installed")
    df, meta = pyreadstat.read_xport(str(path))
    return entity_from_pyreadstat(df, meta, ds_name, path.name)

def read_json_records(path: Path, ds_name_hint: str) -> Dict[str, Any]:
    raw = json.loads(path.read_text(encoding="utf-8", errors="ignore"))
    ds_name = (raw.get("name") or raw.get("itemGroupOID") or ds_name_hint or "").upper()
    if "." in ds_name:
        ds_name = ds_name.split(".")[-1]
    records = int(raw.get("records") or (len(raw.get("data")) if isinstance(raw.get("data"), list) else 0))
    def map_dtype(dt: str) -> str:
        return "numeric" if (dt or "").lower() in ("integer", "float", "double", "number", "decimal", "numeric") else "character"
    variables = [{
        "name": (col.get("name") or col.get("itemOID") or "VAR").upper(),
        "label": col.get("label") or col.get("name"),
        "type": map_dtype(col.get("dataType") or col.get("type")),
        "length": col.get("length"),
        "role": None,
        "mandatory": None
    } for col in raw.get("columns", [])]
    return {
        "name": ds_name,
        "label": raw.get("label") or ds_name,
        "type": "analysis_dataset" if ds_name.startswith("AD") else "domain",
        "variables": variables,
        "sourceFiles": [{"fileId": path.name, "role": "primary", "extractedData": ["data", "variables", "metadata"]}],
        "metadata": {"records": records, "structure": None, "validationStatus": "unknown"}
    }

# ---------------- documents (helpers) ----------------
def _openai_client():
    try:
        from openai import OpenAI
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            return None
        return OpenAI(api_key=api_key)
    except Exception:
        return None

def _parse_json_loose(s: str) -> Optional[Dict[str, Any]]:
    if not s:
        return None
    s = s.strip()
    # try strict
    try:
        return json.loads(s)
    except Exception:
        pass
    # try to extract {"cell": "..."} with regex
    m = re.search(r'{"\s*cell\s*"\s*:\s*"([^"]+)"}', s, re.S | re.I)
    if m:
        return {"cell": m.group(1)}
    return None

def _clean_cell_spec(cell: str, display_id: str) -> Optional[str]:
    if not cell:
        return None
    parts = [p.strip() for p in cell.split("|")]
    if not parts:
        return None
    # ensure first token is the display id
    if parts[0].lower() != display_id.lower():
        parts = [display_id] + parts
    # drop empties and duplicates; avoid 'All Treatments' default when a specific arm is present
    kept, seen = [], set()
    has_specific_arm = any(re.search(r"\b(placebo|xanomeline)\b", p, re.I) for p in parts)
    for tok in parts:
        if not tok:
            continue
        key = tok.lower()
        if has_specific_arm and key in ("all treatments", "overall"):
            continue
        if key not in seen:
            kept.append(tok)
            seen.add(key)
    spec = " | ".join(kept)
    return spec if spec.strip() else None

def _fallback_cell_terms_from_text(text: str) -> List[str]:
    t = (text or "").lower()
    picks: List[str] = []

    # timepoint (Week/Wk)
    m = re.search(r"\b(?:wk|week)\s*0*(\d{1,2})\b", t)
    if m: picks.append(f"Week {int(m.group(1))}")

    # derivation
    if re.search(r"\bchange\s*from\s*baseline\b|\bcfb\b|\bchg\b", t): picks.append("Change from Baseline")
    if re.search(r"\bbaseline\b", t) and "Change from Baseline" not in picks: picks.append("Baseline")

    # parameter/test
    if re.search(r"\bpulse\s*rate\b", t): picks.append("Pulse Rate")
    elif re.search(r"\bheart\s*rate\b", t): picks.append("Heart Rate")
    elif re.search(r"\bsystolic\b.*\bblood\s*pressure\b|\bsbp\b", t): picks.append("Systolic Blood Pressure")
    elif re.search(r"\bdiastolic\b.*\bblood\s*pressure\b|\bdbp\b", t): picks.append("Diastolic Blood Pressure")

    # arm
    if re.search(r"\bxanomeline\b.*\blow\b|\blow\b.*\bxanomeline\b", t): picks.append("Xanomeline Low Dose")
    if re.search(r"\bplacebo\b", t): picks.append("Placebo")

    # statistic
    if re.search(r"\bmax(imum)?\b", t): picks.append("max")
    if re.search(r"\bmean|average\b", t): picks.append("mean")
    if re.search(r"\bnumber of\b|\bcount\b|\bn\b", t): picks.append("n")
    if re.search(r"\bse\b|\bstandard\s*error\b", t): picks.append("se")

    return picks

def _harvest_from_json(js: Any, candidates: Dict[str, set]) -> None:
    # Recursive scan: collect categorical values from ARS/ARD JSONs regardless of schema diversity
    if isinstance(js, dict):
        for k, v in js.items():
            if isinstance(v, (str, int, float)):
                s = str(v)
                if re.search(r"\b(?:week|wk|day|month)\s*0*\d+\b", s, re.I):
                    for x in re.findall(r"(?:Week|Wk|Day|Month)\s*0*\d{1,2}", s, re.I):
                        candidates["visits"].add(re.sub(r"\bWk\b", "Week", x, flags=re.I))
                if re.search(r"\bchange\s*from\s*baseline\b|\bbaseline\b", s, re.I):
                    if re.search(r"change\s*from\s*baseline", s, re.I): candidates["derivations"].add("Change from Baseline")
                    if re.search(r"\bbaseline\b", s, re.I): candidates["derivations"].add("Baseline")
                # stats
                if re.search(r"\b(max|minimum|min|median|mean|sd|se|sem|n\s*\(%\)|n)\b", s, re.I):
                    for st in ["max","min","median","mean","sd","se","sem","n (%)","n"]:
                        if re.search(rf"\b{re.escape(st)}\b", s, re.I):
                            candidates["stats"].add(st)
                # arms
                if re.search(r"\bxanomeline\b.*\blow\b|\blow\b.*\bxanomeline\b", s, re.I):
                    candidates["arms"].add("Xanomeline Low Dose")
                if re.search(r"\bplacebo\b", s, re.I):
                    candidates["arms"].add("Placebo")
                # parameters
                if re.search(r"\bpulse\s*rate\b", s, re.I): candidates["parameters"].add("Pulse Rate")
                if re.search(r"\bheart\s*rate\b", s, re.I): candidates["parameters"].add("Heart Rate")
                if re.search(r"\bsystolic\b.*\bblood\s*pressure\b|\bsbp\b", s, re.I):
                    candidates["parameters"].add("Systolic Blood Pressure")
                if re.search(r"\bdiastolic\b.*\bblood\s*pressure\b|\bdbp\b", s, re.I):
                    candidates["parameters"].add("Diastolic Blood Pressure")
                # populations
                if re.search(r"\bsafety\b\s*(set|population)?\b", s, re.I):
                    candidates["populations"].add("Safety Population")
                if re.search(r"\bintent(?:ion)?\s*to\s*treat\b|\bitt\b", s, re.I):
                    candidates["populations"].add("Intent-to-Treat")
            elif isinstance(v, list):
                for it in v:
                    _harvest_from_json(it, candidates)
            else:
                _harvest_from_json(v, candidates)
    elif isinstance(js, list):
        for it in js:
            _harvest_from_json(it, candidates)

def _collect_ars_candidates_for_display(sess_dir: Path, display_id: str) -> Dict[str, List[str]]:
    out_sets: Dict[str, set] = {
        "visits": set(), "derivations": set(), "parameters": set(), "tests": set(),
        "arms": set(), "stats": set(), "populations": set(), "other_labels": set()
    }
    did = _norm(display_id)
    for p in sorted(sess_dir.glob("*.json")):
        nm = p.name.lower()
        if not (nm.endswith("-ars.json") or nm.endswith("-ard.json")):
            continue
        txt = p.read_text(encoding="utf-8", errors="ignore")
        if did not in _norm(txt):
            continue
        try:
            js = json.loads(txt)
        except Exception:
            js = None
        if js is not None:
            _harvest_from_json(js, out_sets)
    return {k: sorted(v) for k, v in out_sets.items()}

def _detect_display_id_from_text(user_text: str, sess_dir: Optional[Path]) -> Optional[str]:
    """
    Prefer an existing TLF display id from tlfIndex; fallback to 'table <id>' pattern.
    """
    if not user_text:
        return None
    t = user_text.strip()
    # explicit "table <id>"
    m = re.search(r"\btable\s+([A-Za-z0-9_.-]+)\b", t, re.I)
    if m:
        return m.group(1)
    # scan tlfIndex
    ss = _read_session_summary(sess_dir)
    if ss:
        displays = (ss.get("standards", {}).get("TLF", {}).get("metadata", {}) or {}).get("tlfIndex", {}).get("displays", []) or []
        tnorm = _norm(t)
        hits = []
        for d in displays:
            did = d.get("id") or ""
            title = d.get("title") or ""
            if _norm(did) in tnorm or _norm(title) in tnorm:
                hits.append(did)
        if hits:
            # pick longest id (more specific)
            hits.sort(key=lambda s: len(s or ""), reverse=True)
            return hits[0]
    return None

def _llm_choose_cell_spec(display_id: str, user_text: str, options: Dict[str, List[str]]) -> Optional[str]:
    client = _openai_client()
    if not client:
        return None
    model = os.getenv("CELL_NORMALIZER_MODEL", "gpt-4o-mini")

    sys = (
        "You convert a user's natural-language request about a specific clinical TLF table into a SINGLE pipe-separated cell spec.\n"
        "RULES:\n"
        "1) Prefer ONLY values from the provided option lists. If a clearly explicit value appears in the user text but is missing from options (e.g., 'Week 4', 'Placebo'), you MAY use it verbatim.\n"
        "2) Include only values needed to identify the cell. Do NOT output placeholders, empty segments, or repeated pipes.\n"
        "3) Recommended order: timepoint/derivation, parameter/test, arm/treatment, statistic, population. Omit categories that don't apply.\n"
        "4) Return STRICT JSON: {\"cell\": \"<display_id> | <value1> | <value2> | ...\"}."
    )
    opt_txt = json.dumps(options, indent=2)
    user = (
        f"Display id: {display_id}\n"
        f"User request: {user_text}\n"
        f"Available option values (some lists may be empty):\n{opt_txt}\n"
        "Output strict JSON with the single field 'cell'."
    )

    try:
        resp = client.chat.completions.create(
            model=model,
            temperature=0.0,
            response_format={"type":"json_object"},
            max_tokens=200,
            messages=[{"role":"system","content":sys},{"role":"user","content":user}],
        )
        raw = (resp.choices[0].message.content or "").strip()
    except Exception:
        return None

    obj = _parse_json_loose(raw)
    if not obj:
        return None
    cell_raw = (obj.get("cell") or "").strip()
    return _clean_cell_spec(cell_raw, display_id)

def _normalize_freeform_to_cell_spec(user_text: str, sess_dir: Optional[Path]) -> Optional[Tuple[str, str]]:
    display_id = _detect_display_id_from_text(user_text, sess_dir)
    if not display_id:
        return None

    options = {"visits":[], "derivations":[], "parameters":[], "tests":[], "arms":[], "stats":[], "populations":[], "other_labels":[]}
    if sess_dir:
        mined = _collect_ars_candidates_for_display(sess_dir, display_id)
        for k in options.keys():
            options[k] = mined.get(k, [])

    # LLM closed-set (with sanitizer)
    cell = _llm_choose_cell_spec(display_id, user_text, options)

    # If still empty or just the display id, fall back to explicit terms from the user text
    if not cell or cell.strip().lower() == display_id.lower():
        picks = _fallback_cell_terms_from_text(user_text)
        if picks:
            cell = _clean_cell_spec(f"{display_id} | " + " | ".join(picks), display_id)
        else:
            cell = display_id

    return ("table", cell)

def _guess_kind_and_target_with_llm(user_text: str, sess_dir: Optional[Path]) -> Optional[Tuple[str, str]]:
    """
    Ask LLM to classify freeform request into (dataset, variable).
    dataset ∈ {'table','adam','sdtm','endpoint'}
    variable formats:
      - table display id (e.g., 'ars_vs_t01') OR a cell spec ('ars_vs_t01 | ... | ...')
      - adam/sdtm variable 'ADXX.VAR' / 'DM.BRTHDTC'
      - endpoint phrase (if dataset='endpoint')
    """
    client = _openai_client()
    if not client:
        return None

    # gather known display ids to help classification
    ss = _read_session_summary(sess_dir)
    displays = []
    if ss:
        displays = (ss.get("standards", {}).get("TLF", {}).get("metadata", {}) or {}).get("tlfIndex", {}).get("displays", []) or []
    display_ids = [d.get("id") for d in displays if d.get("id")]

    sys = (
        "You are a router. Classify the user's request into one of: ADaM variable, SDTM variable, Table display or Table cell, or Protocol endpoint.\n"
        "OUTPUT STRICT JSON with fields: dataset (one of 'adam','sdtm','table','endpoint') and variable.\n"
        "Rules:\n"
        "- If the text mentions a specific table id (from the provided list) treat as 'table'. If the text describes a specific cell (mentions a visit/timepoint, statistic, parameter, arm, or population), you MUST return a pipe-separated cell spec: '<display_id> | <value1> | <value2> | ...'.\n"
        "- If you see patterns like 'ADXX.VAR' it's ADaM; 'XX.VAR' is SDTM.\n"
        "- If it's clearly an endpoint/SoA/Objective description, choose 'endpoint'.\n"
        "Do NOT invent values. Do NOT output empty pipe segments."
    )
    user = json.dumps({
        "known_display_ids": display_ids,
        "request": user_text
    }, indent=2)

    try:
        resp = client.chat.completions.create(
            model=os.getenv("FREEFORM_ROUTER_MODEL", "gpt-4o-mini"),
            temperature=0.0,
            response_format={"type":"json_object"},
            max_tokens=200,
            messages=[{"role":"system","content":sys},{"role":"user","content":user}],
        )
        raw = (resp.choices[0].message.content or "").strip()
        obj = json.loads(raw)
        ds = (obj.get("dataset") or "").strip().lower()
        var = (obj.get("variable") or "").strip()
        if not ds or not var:
            return None
        # If dataset=table but variable is only the id and the user text seems to specify a cell → upgrade to cell via our normalizer.
        if ds == "table":
            disp = _detect_display_id_from_text(user_text, sess_dir)
            # detect cell intent
            if re.search(r"\b(week|wk|visit|day|month|baseline|change from baseline|mean|median|max|min|se|sd|count|n|placebo|trt|dose|arm|cohort|group)\b", user_text, re.I):
                maybe = _normalize_freeform_to_cell_spec(user_text, sess_dir)
                if maybe:
                    return maybe
            # else keep as table id
            if disp and disp.lower() != var.lower():
                var = disp
        return (ds, var)
    except Exception:
        return None

def _heuristic_router(user_text: str, sess_dir: Optional[Path]) -> Optional[Tuple[str, str]]:
    """Heuristic fallback when LLM is unavailable."""
    txt = user_text or ""
    # ADaM / SDTM vars
    m = re.search(r"\b(AD[A-Z0-9]{2,}\.[A-Z0-9_]+)\b", txt)
    if m: return ("adam", m.group(1).upper())
    m = re.search(r"\b([A-Z]{2}\.[A-Z0-9_]+)\b", txt)
    if m: return ("sdtm", m.group(1).upper())
    # Table id / cell
    disp = _detect_display_id_from_text(txt, sess_dir)
    if disp:
        # look for cell intent
        if re.search(r"\b(week|wk|visit|day|month|baseline|change from baseline|mean|median|max|min|se|sd|count|n|placebo|xanomeline|arm|cohort|group)\b", txt, re.I):
            maybe = _normalize_freeform_to_cell_spec(txt, sess_dir)
            if maybe:
                return maybe
        return ("table", disp)
    # Endpoint-ish
    if re.search(r"\b(endpoint|objective|primary|secondary|key secondary|soa|schedule of activities)\b", txt, re.I):
        return ("endpoint", txt.strip())
    return None

def _normalize_freeform_request(user_text: str) -> Optional[Tuple[str, str]]:
    """Main entry: freeform router → (dataset, variable/cell-spec)."""
    sess = _latest_session_dir()
    # Try LLM router first
    out = _guess_kind_and_target_with_llm(user_text, sess)
    if out:
        return out
    # Fallback heuristics
    return _heuristic_router(user_text, sess)

# ---------------- endpoints ----------------
@app.post("/process-files")
async def process_files(files: List[UploadFile] = File(...)) -> Dict[str, Any]:
    sess_dir, saved_files = _save_uploads(files)
    source_files: List[Dict[str, Any]] = []
    sdtm_entities: Dict[str, Any] = {}
    adam_entities: Dict[str, Any] = {}
    crf_entities: Dict[str, Any] = {}
    protocol_entities: Dict[str, Any] = {}
    tlf_entities: Dict[str, Any] = {}

    # catalog uploads
    for s in saved_files:
        source_files.append({
            "id": s["saved"],
            "filename": s["saved"],
            "type": s["kind"],
            "uploadedAt": _nowz(),
            "sizeKB": s["sizeKB"],
            "processingStatus": "completed"
        })

    # ---- USDM sniff first (so we don't treat USDM as a generic dataset) ----
    for s in saved_files:
        if s["kind"] != "dataset_json":
            continue
        try:
            is_usdm, design, stats = sniff_and_extract_usdm(s["path"])
            if is_usdm:
                # Summarize/clean: rename Objective/Endpoint IDs and drop TBD endpoints
                design = _postprocess_usdm_design(design)
                # Update counts to reflect any filtering/renaming
                stats = dict(stats or {})
                stats["objectiveCount"] = len(design.get("objectives", []))
                stats["endpointCount"]  = len(design.get("endpoints", []))

                protocol_entities["StudyDesign_USDM"] = {
                    "name": "USDM_Design",
                    "label": "USDM Study Design",
                    "type": "protocol_design",
                    "variables": [],
                    "sourceFiles": [{"fileId": s["saved"], "role": "primary", "extractedData": ["design"]}],
                    "metadata": {"validationStatus": "parsed", "design": design, "stats": stats}
                }
                # reclassify file kind
                s["kind"] = "usdm_json"
                for sf in source_files:
                    if sf["filename"] == s["saved"]:
                        sf["type"] = "usdm_json"
        except Exception as e:
            for sf in source_files:
                if sf["filename"] == s["saved"]:
                    sf["processingStatus"] = f"usdm parse error: {e}"

    # parse define.xml / define.html
    for s in saved_files:
        if s["kind"] == "define_xml":
            try:
                entities = parse_define_minimal(s["path"])
                for ds, payload in entities.items():
                    (adam_entities if ds.startswith("AD") else sdtm_entities)[ds] = payload
                    payload["sourceFiles"][0]["fileId"] = s["saved"]
            except Exception as e:
                for sf in source_files:
                    if sf["filename"] == s["saved"]:
                        sf["processingStatus"] = f"parse_error: {e}"

    # datasets (skip USDM files)
    for s in saved_files:
        if s["kind"] in ("usdm_json",):
            continue
        try:
            entity = None
            if s["kind"] == "sas7bdat":
                entity = read_sas7bdat(s["path"], Path(s["saved"]).stem.upper())
            elif s["kind"] == "sas_xpt":
                entity = read_xpt(s["path"], Path(s["saved"]).stem.upper())
            elif s["kind"] == "dataset_json":
                entity = read_json_records(s["path"], Path(s["saved"]).stem.upper())
            if entity:
                entity["sourceFiles"][0]["fileId"] = s["saved"]
                target = adam_entities if entity["name"].startswith("AD") else sdtm_entities
                if entity["name"] not in target:
                    target[entity["name"]] = entity
        except Exception as e:
            for sf in source_files:
                if sf["filename"] == s["saved"]:
                    sf["processingStatus"] = f"error: {e}"

    # documents (aCRF / Protocol / TLF titles)
    for s in saved_files:
        if s["kind"] == "acrf_pdf":
            acrf_csv = OUTPUT / f"acrf_{Path(s['saved']).stem}_var_index.csv"
            try:
                n = acrf_preprocess(s["path"], acrf_csv)
                crf_entities["aCRF"] = {
                    "name": "aCRF",
                    "label": "Annotated CRF",
                    "type": "crf_document",
                    "variables": [],
                    "sourceFiles": [
                        {"fileId": s["saved"], "role": "primary", "extractedData": ["document"]},
                        {"fileId": acrf_csv.name, "role": "derived", "extractedData": ["crf_var_index_csv"]}
                    ],
                    "metadata": {
                        "records": None,
                        "structure": "document",
                        "validationStatus": "not_applicable",
                        "varIndexCsv": acrf_csv.name,
                        "varIndexCount": n
                    }
                }
                source_files.append({
                    "id": acrf_csv.name,
                    "filename": acrf_csv.name,
                    "type": "crf_index_csv",
                    "uploadedAt": _nowz(),
                    "sizeKB": round(acrf_csv.stat().st_size / 1024, 1),
                    "processingStatus": "completed"
                })
            except Exception as e:
                for sf in source_files:
                    if sf["filename"] == s["saved"]:
                        sf["processingStatus"] = f"aCRF preprocess error: {e}"
        elif s["kind"] == "protocol_pdf":
            proto_txt = OUTPUT / f"protocol_{Path(s['saved']).stem}.txt"
            try:
                n_chars = protocol_to_txt(s["path"], proto_txt)
                protocol_entities["Protocol"] = {
                    "name": "Protocol",
                    "label": "Clinical Study Protocol",
                    "type": "protocol_document",
                    "variables": [],
                    "sourceFiles": [
                        {"fileId": s["saved"], "role": "primary", "extractedData": ["document"]},
                        {"fileId": proto_txt.name, "role": "derived", "extractedData": ["text"]}
                    ],
                    "metadata": {
                        "records": None,
                        "structure": "document",
                        "validationStatus": "not_applicable",
                        "textFile": proto_txt.name,
                        "textChars": n_chars
                    }
                }
                source_files.append({
                    "id": proto_txt.name,
                    "filename": proto_txt.name,
                    "type": "protocol_txt",
                    "uploadedAt": _nowz(),
                    "sizeKB": round(proto_txt.stat().st_size / 1024, 1),
                    "processingStatus": "completed"
                })
            except Exception as e:
                for sf in source_files:
                    if sf["filename"] == s["saved"]:
                        sf["processingStatus"] = f"protocol preprocess error: {e}"
        elif s["kind"] in ("tlf_rtf", "tlf_docx", "tlf_pdf"):
            try:
                titles = tlf_extract_titles(s["path"])
                key = f"TLF_{Path(s['saved']).stem}"
                tlf_entities[key] = {
                    "name": key,
                    "label": f"TLF Document ({s['saved']})",
                    "type": "tlf_document",
                    "variables": [],
                    "sourceFiles": [{"fileId": s["saved"], "role": "primary", "extractedData": ["document", "titles"]}],
                    "metadata": {
                        "records": None,
                        "structure": "document",
                        "validationStatus": "not_applicable",
                        "titles": titles,
                        "titleCount": len(titles)
                    }
                }
            except Exception as e:
                for sf in source_files:
                    if sf["filename"] == s["saved"]:
                        sf["processingStatus"] = f"TLF preprocess error: {e}"

    # ---------- ARD/ARS → TLF Index ----------
    tlf_index_entities, tlf_index_obj = build_tlf_index_from_uploads(sess_dir, saved_files)
    for k, v in tlf_index_entities.items():
        tlf_entities[k] = v

    # final response
    result = {
        "standards": {
            "SDTM": {
                "type": "SDTM",
                "label": "Study Data Tabulation Model",
                "datasetEntities": sdtm_entities,
                "metadata": {"totalEntities": len(sdtm_entities)}
            },
            "ADaM": {
                "type": "ADaM",
                "label": "Analysis Data Model",
                "datasetEntities": adam_entities,
                "metadata": {"totalEntities": len(adam_entities)}
            },
            "CRF": {
                "type": "CRF",
                "label": "Annotated CRF",
                "datasetEntities": crf_entities,
                "metadata": {"totalEntities": len(crf_entities)}
            },
            "Protocol": {
                "type": "Protocol",
                "label": "Clinical Study Protocol",
                "datasetEntities": protocol_entities,
                "metadata": {"totalEntities": len(protocol_entities)}
            },
            "TLF": {
                "type": "TLF",
                "label": "Tables, Listings, Figures",
                "datasetEntities": tlf_entities,
                "metadata": {"totalEntities": len(tlf_entities), "tlfIndex": tlf_index_obj}
            }
        },
        "metadata": {
            "processedAt": _nowz(),
            "totalVariables": sum(len(v.get("variables", [])) for v in sdtm_entities.values()) +
                              sum(len(v.get("variables", [])) for v in adam_entities.values()),
            "sourceFiles": source_files
        }
    }
    (sess_dir / "session_summary.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    return result

# ---------------- analyze-variable ----------------
class AnalyzeVariableIn(BaseModel):
    variable: str
    dataset: str
    files: List[Dict[str, Any]] = []

@app.post("/analyze-variable")
def analyze_variable(payload: AnalyzeVariableIn):
    try:
        # If dataset is empty → freeform router
        ds = (payload.dataset or "").strip()
        var = (payload.variable or "").strip()

        if not ds:
            routed = _normalize_freeform_request(var)
            if routed:
                ds, var = routed
            else:
                # as a last resort: if it looks like a table mention, try cell normalizer
                maybe = _normalize_freeform_to_cell_spec(var, _latest_session_dir())
                if maybe:
                    ds, var = maybe
                else:
                    return {
                        "variable": payload.variable,
                        "dataset": payload.dataset,
                        "summary": "",
                        "lineage": {
                            "nodes": [ {"id": f"{(payload.dataset or '').strip()}.{(payload.variable or '').strip()}".lower() or "target",
                                        "type":"target",
                                        "explanation":"[general] Could not classify the freeform request into a dataset/variable."} ],
                            "edges": [],
                            "gaps":  ["Freeform router could not determine dataset/variable; please reference a table id (e.g., 'table ars_vs_t01'), an ADaM/SDTM variable (e.g., 'ADSL.AGE' or 'DM.BRTHDTC'), or an endpoint description."]
                        }
                    }

        # Route to endpoint lineage if requested
        if (ds or "").lower() in {"endpoint", "soa"}:
            return build_endpoint_lineage_with_llm_from_session(endpoint_term=var, files_ctx=payload.files)
        else:
            return build_lineage_with_llm_from_session(dataset=ds, variable=var, files_ctx=payload.files)

    except Exception as e:
        return {
            "variable": payload.variable,
            "dataset": payload.dataset,
            "summary": "",
            "lineage": {
                "nodes": [ {"id": f"{(payload.dataset or '').strip()}.{(payload.variable or '').strip()}".lower() or "target",
                            "type":"target",
                            "explanation":"[general] Error path."} ],
                "edges": [],
                "gaps":  [f"Lineage service error: {str(e)}"]
            }
        }
