from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Tuple
from pathlib import Path
from datetime import datetime
import os, shutil, json

# --- local services ---
from services.acrf_preprocess import acrf_preprocess
from services.protocol_preprocess import protocol_to_txt
from services.tlf_preprocess import tlf_extract_titles
from services.llm_lineage_define import build_lineage_with_llm_from_session

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

def _file_kind(name: str) -> str:
    n = name.lower()
    if (n.endswith(".xml") or n.endswith(".html") or n.endswith(".htm")) and "define" in n:
        return "define_xml"
    if n.endswith(".sas7bdat"): return "sas7bdat"
    if n.endswith(".xpt"):      return "sas_xpt"
    if n.endswith(".json"):     return "dataset_json"
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
            "orig": base,"saved": save_name,"path": dest,
            "kind": _file_kind(base),"sizeKB": round(dest.stat().st_size/1024, 1)
        })
    return sess, saved

def _attr_any_ns(elem, key):
    for k, v in elem.attrib.items():
        if k.split('}')[-1] == key:
            return v
    return None

def _cdisc_type_from_dtype(dtype: str) -> str:
    s = (dtype or "").lower()
    if any(x in s for x in ["int","float","double","decimal","number"]):
        return "numeric"
    return "character"

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
            if not it: continue
            vname  = (it.get("Name") or "VAR").upper()
            vlabel = it.get("Label") or vname
            vtype  = _cdisc_type_from_dtype(it.get("DataType") or "character")
            vlen   = _attr_any_ns(it, "Length")
            try: vlen = int(vlen) if vlen else None
            except: vlen = None
            mandatory = (ref.get("Mandatory") or "").lower() in ("yes","true","1")
            variables.append({
                "name": vname,"label": vlabel,"type": vtype,
                "length": vlen,"role": None,"mandatory": mandatory
            })
        dataset_entities[ds_name] = {
            "name": ds_name,"label": ds_label,"type": ds_type,"variables": variables,
            "sourceFiles":[{"fileId": define_path.name,"role":"primary","extractedData":["metadata","variables","codelists"]}],
            "metadata": {"records": None,"structure": None,"validationStatus":"unknown"}
        }
    return dataset_entities

# ---------------- dataset readers ----------------
def entity_from_pyreadstat(df, meta, ds_name: str, file_id: str) -> Dict[str, Any]:
    names   = list(meta.column_names) if getattr(meta,"column_names",None) else list(df.columns)
    labels  = list(meta.column_labels) if getattr(meta,"column_labels",None) else [None]*len(names)
    vtypes  = [meta.variable_types.get(nm) if getattr(meta,"variable_types",None) else str(df[nm].dtype) for nm in names]
    variables=[{"name":nm.upper(),"label":labels[i] or nm,"type":_cdisc_type_from_dtype(vtypes[i]),
                "length":None,"role":None,"mandatory":None} for i,nm in enumerate(names)]
    return {
        "name": ds_name,"label": ds_name,"type":"analysis_dataset" if ds_name.startswith("AD") else "domain",
        "variables": variables,
        "sourceFiles":[{"fileId": file_id,"role":"primary","extractedData":["data","variables"]}],
        "metadata":{"records": len(df),"structure": None,"validationStatus":"unknown"}
    }

def read_sas7bdat(path: Path, ds_name: str) -> Dict[str, Any]:
    if pyreadstat is None: raise RuntimeError("pyreadstat not installed")
    df, meta = pyreadstat.read_sas7bdat(str(path)); return entity_from_pyreadstat(df, meta, ds_name, path.name)

def read_xpt(path: Path, ds_name: str) -> Dict[str, Any]:
    if pyreadstat is None: raise RuntimeError("pyreadstat not installed")
    df, meta = pyreadstat.read_xport(str(path)); return entity_from_pyreadstat(df, meta, ds_name, path.name)

def read_json_records(path: Path, ds_name_hint: str) -> Dict[str, Any]:
    raw=json.loads(path.read_text(encoding="utf-8", errors="ignore"))
    ds_name=(raw.get("name") or raw.get("itemGroupOID") or ds_name_hint or "").upper()
    if "." in ds_name: ds_name=ds_name.split(".")[-1]
    records=int(raw.get("records") or 0)
    def map_dtype(dt: str) -> str:
        return "numeric" if (dt or "").lower() in ("integer","float","double","number","decimal") else "character"
    variables=[{"name":(col.get("name") or col.get("itemOID") or "VAR").upper(),
                "label": col.get("label") or col.get("name"),
                "type": map_dtype(col.get("dataType")),"length": col.get("length"),
                "role":None,"mandatory":None} for col in raw.get("columns",[])]
    return {"name": ds_name,"label": raw.get("label") or ds_name,
            "type":"analysis_dataset" if ds_name.startswith("AD") else "domain",
            "variables": variables,
            "sourceFiles":[{"fileId": path.name,"role":"primary","extractedData":["data","variables","metadata"]}],
            "metadata":{"records": records,"structure": None,"validationStatus":"unknown"}}

# ---------------- endpoints ----------------
@app.get("/health")
def health(): return {"ok": True,"time": _nowz()}

@app.post("/process-files")
async def process_files(files: List[UploadFile] = File(...)) -> Dict[str, Any]:
    sess_dir, saved_files = _save_uploads(files)
    source_files, sdtm_entities, adam_entities, crf_entities, protocol_entities, tlf_entities = [],{},{},{},{},{}
    # catalog
    for s in saved_files:
        source_files.append({"id": s["saved"],"filename": s["saved"],"type": s["kind"],
                             "uploadedAt": _nowz(),"sizeKB": s["sizeKB"],"processingStatus":"completed"})
    # parse defines
    for s in saved_files:
        if s["kind"]=="define_xml":
            try:
                entities=parse_define_minimal(s["path"])
                for ds,payload in entities.items():
                    (adam_entities if ds.startswith("AD") else sdtm_entities)[ds]=payload
                    payload["sourceFiles"][0]["fileId"]=s["saved"]
            except Exception as e:
                for sf in source_files:
                    if sf["filename"]==s["saved"]: sf["processingStatus"]=f"parse_error: {e}"
    # datasets
    for s in saved_files:
        try:
            entity=None
            if s["kind"]=="sas7bdat": entity=read_sas7bdat(s["path"], Path(s["saved"]).stem.upper())
            elif s["kind"]=="sas_xpt": entity=read_xpt(s["path"], Path(s["saved"]).stem.upper())
            elif s["kind"]=="dataset_json": entity=read_json_records(s["path"], Path(s["saved"]).stem.upper())
            if entity:
                entity["sourceFiles"][0]["fileId"]=s["saved"]
                target=adam_entities if entity["name"].startswith("AD") else sdtm_entities
                if entity["name"] not in target: target[entity["name"]]=entity
        except Exception as e:
            for sf in source_files:
                if sf["filename"]==s["saved"]: sf["processingStatus"]=f"error: {e}"
    # documents
    for s in saved_files:
        if s["kind"]=="acrf_pdf":
            acrf_csv=OUTPUT/f"acrf_{Path(s['saved']).stem}_var_index.csv"
            try:
                n=acrf_preprocess(s["path"], acrf_csv)
                crf_entities["aCRF"]={"name":"aCRF","label":"Annotated CRF","type":"crf_document",
                    "variables":[],
                    "sourceFiles":[{"fileId":s["saved"],"role":"primary","extractedData":["document"]},
                                   {"fileId":acrf_csv.name,"role":"derived","extractedData":["crf_var_index_csv"]}],
                    "metadata":{"records":None,"structure":"document","validationStatus":"not_applicable",
                                "varIndexCsv": acrf_csv.name,"varIndexCount": n}}
                source_files.append({"id":acrf_csv.name,"filename":acrf_csv.name,"type":"crf_index_csv",
                                     "uploadedAt":_nowz(),"sizeKB": round(acrf_csv.stat().st_size/1024,1),"processingStatus":"completed"})
            except Exception as e:
                for sf in source_files:
                    if sf["filename"]==s["saved"]: sf["processingStatus"]=f"aCRF preprocess error: {e}"
        elif s["kind"]=="protocol_pdf":
            proto_txt=OUTPUT/f"protocol_{Path(s['saved']).stem}.txt"
            try:
                n_chars=protocol_to_txt(s["path"], proto_txt)
                protocol_entities["Protocol"]={"name":"Protocol","label":"Clinical Study Protocol","type":"protocol_document",
                    "variables":[],
                    "sourceFiles":[{"fileId":s["saved"],"role":"primary","extractedData":["document"]},
                                   {"fileId":proto_txt.name,"role":"derived","extractedData":["text"]}],
                    "metadata":{"records":None,"structure":"document","validationStatus":"not_applicable",
                                "textFile": proto_txt.name,"textChars": n_chars}}
                source_files.append({"id":proto_txt.name,"filename":proto_txt.name,"type":"protocol_txt",
                                     "uploadedAt":_nowz(),"sizeKB": round(proto_txt.stat().st_size/1024,1),"processingStatus":"completed"})
            except Exception as e:
                for sf in source_files:
                    if sf["filename"]==s["saved"]: sf["processingStatus"]=f"protocol preprocess error: {e}"
        elif s["kind"] in ("tlf_rtf","tlf_docx","tlf_pdf"):
            try:
                titles=tlf_extract_titles(s["path"])
                key=f"TLF_{Path(s['saved']).stem}"
                tlf_entities[key]={"name":key,"label":f"TLF Document ({s['saved']})","type":"tlf_document",
                    "variables":[],
                    "sourceFiles":[{"fileId":s["saved"],"role":"primary","extractedData":["document","titles"]}],
                    "metadata":{"records":None,"structure":"document","validationStatus":"not_applicable",
                                "titles": titles,"titleCount": len(titles)}}
            except Exception as e:
                for sf in source_files:
                    if sf["filename"]==s["saved"]: sf["processingStatus"]=f"TLF preprocess error: {e}"
    # final
    result={"standards":{"SDTM":{"type":"SDTM","label":"Study Data Tabulation Model","datasetEntities": sdtm_entities,
                                 "metadata":{"totalEntities": len(sdtm_entities)}},
                         "ADaM":{"type":"ADaM","label":"Analysis Data Model","datasetEntities": adam_entities,
                                 "metadata":{"totalEntities": len(adam_entities)}},
                         "CRF":{"type":"CRF","label":"Annotated CRF","datasetEntities": crf_entities,
                                "metadata":{"totalEntities": len(crf_entities)}},
                         "Protocol":{"type":"Protocol","label":"Clinical Study Protocol","datasetEntities": protocol_entities,
                                     "metadata":{"totalEntities": len(protocol_entities)}},
                         "TLF":{"type":"TLF","label":"Tables, Listings, Figures","datasetEntities": tlf_entities,
                                "metadata":{"totalEntities": len(tlf_entities)}}},
            "metadata":{"processedAt": _nowz(),
                        "totalVariables": sum(len(v.get("variables",[])) for v in sdtm_entities.values()) +
                                          sum(len(v.get("variables",[])) for v in adam_entities.values()),
                        "sourceFiles": source_files}}
    (sess_dir/"session_summary.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    return result

# ---------------- analyze-variable ----------------
class AnalyzeVariableIn(BaseModel):
    variable: str
    dataset: str
    files: List[Dict[str, Any]] = []

@app.post("/analyze-variable")
def analyze_variable(payload: AnalyzeVariableIn):
    try:
        return build_lineage_with_llm_from_session(
            dataset=payload.dataset,variable=payload.variable,files_ctx=payload.files
        )
    except Exception as e:
        return {"variable": payload.variable,"dataset": payload.dataset,
                "lineage":{"nodes":[{"id": f"ADaM.{payload.dataset.upper()}.{payload.variable.upper()}",
                                     "type":"target","file":"define"}],
                           "edges":[],"gaps":[f"Lineage service error: {str(e)}"]}}
