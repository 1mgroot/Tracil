# services/protocol_preprocess.py
# Requires: pip install pymupdf
from pathlib import Path
import fitz  # PyMuPDF

def protocol_to_txt(pdf_path: Path, out_txt: Path) -> int:
    """Convert a Protocol PDF to plain text (one page per block)."""
    pdf_path = Path(pdf_path); out_txt = Path(out_txt)
    doc = fitz.open(str(pdf_path))
    blocks=[]
    for i in range(len(doc)):
        page = doc[i]
        blocks.append(f"\n\n=== Page {i+1} ===\n{page.get_text('text')}")
    text = "".join(blocks)
    out_txt.parent.mkdir(parents=True, exist_ok=True)
    out_txt.write_text(text, encoding="utf-8")
    return len(text)
