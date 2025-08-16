# Requires: pip install pymupdf
import fitz  # PyMuPDF
import re, csv, argparse
from pathlib import Path

# --- Paths relative to this file ---
HERE = Path(__file__).resolve().parent          # backend/pgm
BACKEND = HERE.parent                            # backend/
DATA = BACKEND / "data"
OUTPUT = BACKEND / "output"

# Defaults (can be overridden by CLI)
DEFAULT_PDF = DATA / "protocol" / "blankcrf.pdf"
DEFAULT_OUT = OUTPUT / "acrf_var_index.csv"

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
    "SEX","RACE","ETHNIC","AGE",
    "BRTHDTC","RFSTDTC","RFENDTC","DTHDTC","DTHFL",
    "VISIT","VISITNUM","VISITDY",
}
EXCLUDE_TOKENS = {"PRINTED", "DS1609"}

TOKEN_RE = re.compile(r"\b[A-Z][A-Z0-9_]{2,}\b")

def cdiscish(token: str) -> bool:
    t = token.upper()
    if t in EXCLUDE_TOKENS:
        return False
    if t in ALWAYS_INCLUDE:
        return True
    for dom in DOMAIN_PREFIXES:
        if t.startswith(dom):
            rest = t[len(dom):]
            if any(rest.startswith(suf) for suf in COMMON_SUFFIXES) or len(rest) >= 3:
                return True
    return False

def extract_words_as_lines(page):
    words = page.get_text("words")
    lines_map = {}
    for w in words:
        x0,y0,x1,y1,word,bno,lno,wn = w
        lines_map.setdefault((bno,lno), []).append(w)
    lines = []
    for (bno,lno), arr in lines_map.items():
        arr_sorted = sorted(arr, key=lambda t: t[7])  # by word_no
        text = " ".join(a[4] for a in arr_sorted)
        lines.append(text)
    return lines

def scan_line(line_text, page_no):
    rows = []
    text = re.sub(r"[:;,./\\()\[\]\-]", " ", line_text)
    for tok in TOKEN_RE.findall(text):
        if cdiscish(tok):
            rows.append({
                "var": tok.upper(),
                "page": page_no,
                "context": line_text.strip()
            })
    return rows

def extract_from_annotations(page, page_no):
    out = []
    annots = page.annots()
    if not annots:
        return out
    for a in annots:
        info = a.info or {}
        content = info.get("content") or info.get("title") or ""
        if content:
            out.extend(scan_line(content, page_no))
    return out

def extract_vars_to_csv(pdf_path: Path, out_csv: Path):
    doc = fitz.open(str(pdf_path))
    first_seen = {}

    for i in range(len(doc)):
        page = doc[i]
        pno  = i + 1

        for r in extract_from_annotations(page, pno):
            key = (r["var"], r["page"])
            if key not in first_seen:
                first_seen[key] = r

        for line_text in extract_words_as_lines(page):
            for r in scan_line(line_text, pno):
                key = (r["var"], r["page"])
                if key not in first_seen:
                    first_seen[key] = r

    rows = list(first_seen.values())

    out_csv.parent.mkdir(parents=True, exist_ok=True)
    with open(out_csv, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["var","page","context"])
        for r in sorted(rows, key=lambda x: (x["page"], x["var"])):
            w.writerow([r["var"], r["page"], r.get("context","")[:1000]])

    print(f"Found {len(rows)} variable mentions (unique per page).")
    print(f"CSV : {out_csv}")

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf", default=str(DEFAULT_PDF), help="Path to aCRF PDF")
    ap.add_argument("--out", default=str(DEFAULT_OUT), help="Output CSV path")
    args = ap.parse_args()

    extract_vars_to_csv(Path(args.pdf), Path(args.out))
