# services/__init__.py
"""
Service package exports.

This package contains:
- acrf_preprocess:    Extracts aCRF variable index CSV from annotated CRF PDFs
- protocol_to_txt:    Converts protocol PDFs to plain text
- tlf_extract_titles: Extracts TLF titles from combined TLF documents
- build_lineage_with_llm_from_session: LLM-driven lineage builder used by /analyze-variable
"""

from .acrf_preprocess import acrf_preprocess
from .protocol_preprocess import protocol_to_txt
from .tlf_preprocess import tlf_extract_titles
from .llm_lineage_define import build_lineage_with_llm_from_session

__all__ = [
    "acrf_preprocess",
    "protocol_to_txt",
    "tlf_extract_titles",
    "build_lineage_with_llm_from_session",
]

__version__ = "0.1.0"
