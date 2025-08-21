# services/tlf_preprocess.py
# Requires: pip install striprtf python-docx pymupdf
from pathlib import Path
import re
from typing import List, Dict, Tuple

def _titles_from_text(txt: str) -> List[Tuple[str, str]]:
    # Capture e.g. "Table 14-1.01", "Figure 3.2", lines around become title.
    lines = [l.strip() for l in txt.splitlines()]
    titles=[]
    pat = re.compile(r"^(Table|Figure)\s+([A-Za-z0-9.\-]+)", re.I)
    for i, line in enumerate(lines):
        m = pat.match(line)
        if m:
            ident = f"{m.group(1).title()} {m.group(2)}"
            # Title often on same line after id OR next non-empty line
            title = line[m.end():].strip(" :\t") or next((l for l in lines[i+1:i+5] if l), "")
            titles.append((ident, title))
    return titles

def _pdf_to_text(path: Path) -> str:
    import fitz
    doc = fitz.open(str(path))
    return "\n".join(page.get_text("text") for page in doc)

def _rtf_to_text(path: Path) -> str:
    from striprtf.striprtf import rtf_to_text
    return rtf_to_text(path.read_text(errors="ignore"))

def _docx_to_text(path: Path) -> str:
    import docx
    d = docx.Document(str(path))
    return "\n".join(p.text for p in d.paragraphs)

def tlf_extract_titles(file_path: Path) -> List[Dict]:
    """Return a list of {'id','title'} from a combined TLF in pdf/rtf/docx."""
    file_path = Path(file_path)
    ext = file_path.suffix.lower()
    if ext == ".pdf":
        txt = _pdf_to_text(file_path)
    elif ext == ".rtf":
        txt = _rtf_to_text(file_path)
    elif ext == ".docx":
        txt = _docx_to_text(file_path)
    else:
        txt = file_path.read_text(encoding="utf-8", errors="ignore")

    pairs = _titles_from_text(txt)
    return [{"id": ident, "title": title} for ident, title in pairs]
