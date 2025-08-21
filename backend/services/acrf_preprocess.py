# services/acrf_preprocess.py
# Requires: pip install pymupdf
from pathlib import Path
import re, csv
import fitz  # PyMuPDF

DOMAIN_PREFIXES = {
    "AE","CM","DM","DS","EG","EX","LB","MH","PR","QS","SV","VS","PE","SC","SE","TE","TU",
    "PC","PP","RS","MI","MS","MB","EC","SU","HO","DA","DV","TR"
}
COMMON_SUFFIXES = {
    "TESTCD","TEST","CAT","SCAT","DECOD","ORRES","STRESC","STRESN","ORRESU","POS","DTC",
    "TPT","TPTNUM","LOC","METHOD","REFID","REASND","DY","SEQ","STAT","REAS","OCCUR",
    "SEV","GRPID","EVAL","EVALID"
}
ALWAYS_INCLUDE = {
    "STUDYID","SITEID","SUBJID","USUBJID",
    "SEX","RACE","ETHNIC","AGE","BRTHDTC","RFSTDTC","RFENDTC","DTHDTC","DTHFL",
    "VISIT","VISITNUM","VISITDY",
}
EXCLUDE_TOKENS = {"PRINTED", "DS1609"}
TOKEN_RE = re.compile(r"\b[A-Z][A-Z0-9_]{2,}\b")

def _cdiscish(token: str) -> bool:
    t = token.upper()
    if t in EXCLUDE_TOKENS: return False
    if t in ALWAYS_INCLUDE:  return True
    for dom in DOMAIN_PREFIXES:
        if t.startswith(dom):
            rest = t[len(dom):]
            if any(rest.startswith(suf) for suf in COMMON_SUFFIXES) or len(rest) >= 3:
                return True
    return False

def _extract_words_as_lines(page):
    words = page.get_text("words")
    lines_map = {}
    for w in words:
        *_, word, bno, lno, wn = w
        lines_map.setdefault((bno,lno), []).append((wn, word))
    lines=[]
    for (_,_), arr in lines_map.items():
        arr_sorted = sorted(arr, key=lambda t: t[0])
        lines.append(" ".join(a[1] for a in arr_sorted))
    return lines

def _scan_line(line_text, page_no):
    out=[]
    text = re.sub(r"[:;,./\\()\[\]\-]", " ", line_text)
    for tok in TOKEN_RE.findall(text):
        if _cdiscish(tok):
            out.append({"var": tok.upper(), "page": page_no, "context": line_text.strip()})
    return out

def _extract_from_annotations(page, page_no):
    out=[]
    annots = page.annots()
    if not annots: return out
    for a in annots:
        info = a.info or {}
        content = info.get("content") or info.get("title") or ""
        if content:
            out.extend(_scan_line(content, page_no))
    return out

def acrf_preprocess(pdf_path: Path, out_csv: Path) -> int:
    """Extract likely CDISC variable tokens from an aCRF PDF into a CSV."""
    pdf_path = Path(pdf_path)
    out_csv  = Path(out_csv)
    doc = fitz.open(str(pdf_path))
    first_seen = {}
    for i in range(len(doc)):
        page = doc[i]; pno = i + 1
        for r in _extract_from_annotations(page, pno):
            key = (r["var"], r["page"])
            if key not in first_seen: first_seen[key] = r
        for line_text in _extract_words_as_lines(page):
            for r in _scan_line(line_text, pno):
                key = (r["var"], r["page"])
                if key not in first_seen: first_seen[key] = r

    rows = list(first_seen.values())
    out_csv.parent.mkdir(parents=True, exist_ok=True)
    with out_csv.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f); w.writerow(["var","page","context"])
        for r in sorted(rows, key=lambda x: (x["page"], x["var"])):
            w.writerow([r["var"], r["page"], (r.get("context") or "")[:1000]])
    return len(rows)
