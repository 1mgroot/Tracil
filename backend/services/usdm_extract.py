# services/usdm_extract.py
from __future__ import annotations
from pathlib import Path
from typing import Any, Dict, List, Tuple, Iterable, Optional, Set
import json
import re
from collections import defaultdict

Json = Dict[str, Any]

USDM_MARKER_KEYS = {
    "usdmVersion", "study", "Study", "studyDesigns", "StudyDesigns",
    "endpoints", "Endpoints", "studyEndpoints", "StudyEndpoints"
}

def _as_list(v: Any) -> List[Any]:
    if v is None: return []
    if isinstance(v, list): return v
    return [v]

def _get_first(d: Dict[str, Any], *keys: str, default: Any = None) -> Any:
    for k in keys:
        if k in d and d[k] not in (None, "", []): return d[k]
        for kk in d.keys():
            if kk.lower() == k.lower() and d[kk] not in (None, "", []):
                return d[kk]
    return default

def _slug(s: str) -> str:
    s = re.sub(r"\s+", "_", (s or "").strip())
    s = re.sub(r"[^A-Za-z0-9_]+", "", s)
    return s[:80] or "ID"

def _norm_code(v: Any) -> Optional[str]:
    """Turn USDM coded objects into simple text (e.g., 'primary endpoint')."""
    if v is None: return None
    if isinstance(v, dict):
        for key in ("decode", "display", "term", "label", "name", "value"):
            if key in v and v[key]:
                return str(v[key]).strip()
        if "code" in v and v["code"]:
            return str(v["code"]).strip()
        return json.dumps(v)  # last resort
    if isinstance(v, (list, tuple)) and v:
        return _norm_code(v[0])
    return str(v).strip()

_SDTM_HINTS = [
    (r"\b(adverse|ae|serious|death|aesdth|aesev|aeshosp)\b", ["AE"], ["ADAE"]),
    (r"\b(vital|blood pressure|pulse|temperature|vs)\b", ["VS"], ["ADVS"]),
    (r"\b(lab|laboratory|chemistry|hematology|lb)\b", ["LB"], ["ADLB"]),
    (r"\b(ecg|electrocardiogram|eg)\b", ["EG"], ["ADEG"]),
    (r"\b(exposure|dose|dosing|drug administration|ex)\b", ["EX"], ["ADSL"]),
    (r"\b(demograph|age|sex|race|dm)\b", ["DM"], ["ADSL"]),
    (r"\b(disposition|completion|withdrawal|ds)\b", ["DS"], ["ADSL"]),
    (r"\b(concomitant|medication|cm)\b", ["CM"], []),
]

def _guess_links(text: str) -> Dict[str, List[str]]:
    if not text: return {"sdtm": [], "adam": []}
    t = text.lower()
    sdtm: Set[str] = set()
    adam: Set[str] = set()
    for pat, sdtm_domains, adam_sets in _SDTM_HINTS:
        if re.search(pat, t):
            sdtm.update(sdtm_domains); adam.update(adam_sets)
    return {"sdtm": sorted(sdtm), "adam": sorted(adam)}

def _walk(obj: Any) -> Iterable[Any]:
    if isinstance(obj, dict):
        yield obj
        for v in obj.values(): yield from _walk(v)
    elif isinstance(obj, list):
        for v in obj: yield from _walk(v)

def _find_sections(root: Json, *section_names: str) -> List[Any]:
    hits: List[Any] = []
    snames = {s.lower() for s in section_names}
    for node in _walk(root):
        if isinstance(node, dict):
            for k, v in node.items():
                if k.lower() in snames:
                    hits.append(v)
    return hits

def _looks_like_usdm(root: Json) -> bool:
    if any(k in root for k in USDM_MARKER_KEYS): return True
    if _find_sections(root, "endpoints", "studyEndpoints"): return True
    study = _get_first(root, "study", "Study", default={})
    if isinstance(study, dict) and _get_first(study, "studyDesigns", "StudyDesigns"):
        return True
    return False

def _extract_objectives(root: Json) -> List[Json]:
    objs: List[Json] = []
    sections = _find_sections(root, "objectives", "studyObjectives", "Objectives")
    for sec in sections:
        for itm in _as_list(sec):
            if not isinstance(itm, dict): continue
            name = _get_first(itm, "name", "label", "title", default="")
            if not name: continue
            oid = _get_first(itm, "id", "uid", "oid", default=_slug(name))
            level = _get_first(itm, "level", "objectiveLevel", "type", "category", default=None)
            desc = _get_first(itm, "description", "text", "definition", default=None)
            objs.append({
                "id": str(oid),
                "name": str(name),
                "type": _norm_code(level),
                "description": desc
            })
    seen = set(); out=[]
    for o in objs:
        if o["id"] in seen: continue
        seen.add(o["id"]); out.append(o)
    return out

def _extract_populations(root: Json) -> List[Json]:
    pops: List[Json] = []
    sections = _find_sections(root, "analysisPopulations", "studyPopulations", "populations")
    for sec in sections:
        for itm in _as_list(sec):
            if not isinstance(itm, dict): continue
            name = _get_first(itm, "name", "label", "title", default="")
            if not name: continue
            pid = _get_first(itm, "id", "uid", "oid", default=_slug(name))
            desc = _get_first(itm, "description", "text", "definition", default=None)
            criterion = _get_first(itm, "inclusionCriteria", "criteria", default=None)
            pops.append({"id": str(pid), "name": str(name), "description": desc, "criteria": criterion})
    for p in pops:
        low = p["name"].lower()
        if "safety" in low or low == "saffl": p["alias"] = "Safety"
        elif "intent" in low or "itt" in low: p["alias"] = "Intent-to-Treat"
        elif "per protocol" in low or "pp" in low: p["alias"] = "Per-Protocol"
    return pops

def _extract_endpoints(root: Json, pops: List[Json]) -> List[Json]:
    pop_by_id = {p["id"]: p for p in pops}
    endpoints: List[Json] = []
    sections = _find_sections(root, "endpoints", "studyEndpoints", "Endpoints")
    for sec in sections:
        for itm in _as_list(sec):
            if not isinstance(itm, dict): continue
            name = _get_first(itm, "name", "label", "title", "endpointName", default="")
            if not name: continue
            eid = _get_first(itm, "id", "uid", "oid", default=_slug(name))
            etype = _get_first(itm, "level", "endpointLevel", "type", "category", default=None)
            desc = _get_first(itm, "description", "text", "definition", default=None)
            pop_ref = _get_first(itm, "populationId", "analysisPopulationId", "population", default=None)
            pop_name = None
            if isinstance(pop_ref, str):
                pop_name = pop_by_id.get(pop_ref, {}).get("name")
            elif isinstance(pop_ref, dict):
                pop_name = _get_first(pop_ref, "name", "label", "title", default=None)
            elif isinstance(pop_ref, list) and pop_ref:
                pop_name = _get_first(pop_ref[0], "name", "label", "title", default=None)
            links = _guess_links(f"{name} {desc or ''}")
            endpoints.append({
                "id": str(eid),
                "name": str(name),
                "type": _norm_code(etype),
                "description": desc,
                "population": pop_name,
                "timing": None,
                "concepts": None,
                "collection": None,
                "links": links,
                "source": "USDM",
                "confidence": 0.98
            })
    if not endpoints:
        for obj in _extract_objectives(root):
            links = _guess_links(f"{obj['name']} {obj.get('description') or ''}")
            endpoints.append({
                "id": f"EP_{_slug(obj['name'])}",
                "name": obj["name"],
                "type": obj.get("type"),
                "description": obj.get("description"),
                "population": None,
                "timing": None,
                "concepts": None,
                "collection": None,
                "links": links,
                "source": "USDM(objective-inferred)",
                "confidence": 0.75
            })
    seen_ids, seen_names = set(), set()
    unique: List[Json] = []
    for ep in endpoints:
        key = ep["id"] or ep["name"]
        if key in seen_ids or ep["name"] in seen_names: continue
        seen_ids.add(key); seen_names.add(ep["name"]); unique.append(ep)
    return unique

def _extract_soa(root: Json) -> Dict[str, Any]:
    activities: Set[str] = set()
    visits: Set[str] = set()
    for sec in _find_sections(root, "activities", "Assessments", "procedures"):
        for itm in _as_list(sec):
            if isinstance(itm, dict):
                name = _get_first(itm, "name", "label", "title")
                if name: activities.add(str(name))
            elif isinstance(itm, str):
                activities.add(itm)
    for sec in _find_sections(root, "visits", "scheduleTimelines", "StudyVisits", "StudyEpochs"):
        for itm in _as_list(sec):
            if isinstance(itm, dict):
                nm = _get_first(itm, "name", "label", "title")
                if nm: visits.add(str(nm))
            elif isinstance(itm, str):
                visits.add(itm)
    return {"forms": sorted(activities), "schedule": sorted(visits)}

def sniff_and_extract_usdm(usdm_path: Path) -> Tuple[bool, Dict[str, Any], Dict[str, Any]]:
    try:
        root: Json = json.loads(usdm_path.read_text(encoding="utf-8", errors="ignore"))
    except Exception:
        return False, {}, {}
    if not isinstance(root, dict): return False, {}, {}
    if not _looks_like_usdm(root): return False, {}, {}
    pops = _extract_populations(root)
    endpoints = _extract_endpoints(root, pops)
    objectives = _extract_objectives(root)
    soa = _extract_soa(root)
    design = {"objectives": objectives, "populations": pops, "endpoints": endpoints, "soa": soa}
    stats = {
        "objectiveCount": len(objectives),
        "populationCount": len(pops),
        "endpointCount": len(endpoints),
        "visitCount": len(soa.get("schedule", [])),
        "formCount": len(soa.get("forms", [])),
    }
    return True, design, stats
