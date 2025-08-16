pgm/ - Python Programs for CRF Processing and Lineage Generation
===============================================================

This folder contains two Python scripts that work together to preprocess annotated CRF PDFs and generate variable lineage graphs using LLMs.

---------------------------------------------------------------
1. acrf_preprocess.py
---------------------------------------------------------------
Purpose:
    Extracts variable mentions from an annotated CRF (aCRF) PDF and creates an index CSV.

Inputs:
    - PDF file (e.g. backend/data/protocol/blankcrf.pdf)

Outputs:
    - CSV file (e.g. backend/output/acrf_var_index.csv)
      Columns: var, page, context

Usage example:
    python acrf_preprocess.py --pdf ../data/protocol/blankcrf.pdf --out ../output/acrf_var_index.csv

---------------------------------------------------------------
2. llm_lineage_define.py
---------------------------------------------------------------
Purpose:
    Generates a JSON lineage graph for a target variable, combining evidence from:
      - SDTM define/spec (XML, HTML, or Excel)
      - ADaM define/spec (XML, HTML, or Excel)
      - The CRF index CSV from acrf_preprocess.py

Inputs:
    --sdtm-define : Path to SDTM define/spec file
    --adam-define : Path to ADaM define/spec file
    --crf-index   : Path to CRF index CSV (default: ../output/acrf_var_index.csv)
    --target      : Target variable (e.g., SDTM.QSTESTCD or ADSL.AGE)

Outputs:
    - JSON file (e.g. backend/output/lineage_<target>.json)
      Includes nodes, edges, derivation, paths, and evidence snippets

Usage example:
    export OPENAI_API_KEY="your_api_key_here"

    python llm_lineage_define.py --sdtm-define ../data/sdtm/define.xml --adam-define ../data/adam/datasets/define.xml --crf-index ../output/acrf_var_index.csv --target "SDTM.QSTESTCD" --out ../output/lineage_SDTM_QSTESTCD.json

---------------------------------------------------------------
Requirements
---------------------------------------------------------------
Install dependencies:
    pip install pymupdf pandas openpyxl numpy openai

---------------------------------------------------------------
Notes on OpenAI Usage
---------------------------------------------------------------
- You must set your own OPENAI_API_KEY before running llm_lineage_define.py
- The script uses the GPT-4o model for lineage generation
- Each run typically costs around $0.02–$0.03 USD in API usage

---------------------------------------------------------------
Workflow Summary
---------------------------------------------------------------
1. Run acrf_preprocess.py to extract variables from the CRF PDF → generates acrf_var_index.csv
2. Run llm_lineage_define.py with SDTM + ADaM define/specs and the CRF index → generates lineage JSON
