# Tracil Backend

FastAPI backend for processing clinical data files and AI-powered lineage analysis.

## Quick Start

1. **Setup environment:**
   ```bash
   python3.13 -m venv venv
   source venv/bin/activate  # macOS/Linux
   # or venv\Scripts\activate  # Windows
   ```

2. **Install dependencies:**
   ```bash
   pip install pip-tools
   pip install -r requirements.txt
   ```

3. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env and add your OpenAI API key
   ```

4. **Start server:**
   ```bash
   uvicorn main:app --reload --port 8000
   ```

5. **Test:**
   ```bash
   curl http://localhost:8000/health
   ```

## What It Does

- **File Processing**: define.xml, SAS datasets, PDFs, DOCX, RTF
- **CDISC Standards**: SDTM, ADaM, CRF, TLF organization
- **AI Integration**: OpenAI-powered variable lineage analysis

## API Endpoints

- `GET /health` - Server health check
- `POST /process-files` - Process uploaded clinical data files
- `POST /analyze-variable` - Generate AI-powered lineage analysis

## Environment Variables

- `OPENAI_API_KEY` - Required for AI lineage analysis
- `ALLOWED_ORIGINS` - CORS origins (default: http://localhost:3000)

## File Support

- **Metadata**: define.xml, specification sheets
- **Datasets**: SAS XPT (.xpt), SAS7BDAT, JSON
- **Documents**: PDF, DOCX, RTF (CRF, Protocol, TLF)

## Development

- **Interactive API Docs**: http://localhost:8000/docs
- **Auto-reload**: Server restarts on code changes
- **Modular Services**: Separate modules for different file types

## Dependencies

- **Core**: FastAPI, uvicorn, pydantic
- **Data**: pandas, numpy, pyreadstat
- **AI**: openai, LangGraph (orchestration)
- **Files**: PyMuPDF, python-docx, striprtf

## Architecture

- **FastAPI**: Modern web framework
- **Ephemeral**: No server-side file persistence
- **CDISC-First**: Data organized by clinical standards

## Lineage workflow

`main.py` assembles one compiled graph per process using the existing services:

```text
START → resolve_request ─ unresolved → END
                       ├ variable → legacy_variable ─┐
                       ├ endpoint → legacy_endpoint ├→ finalize_response → END
                       └ table    → legacy_table ────┘
```

The API keeps Pydantic validation and the existing HTTP 200 error envelope. Every
valid request that reaches Python invokes the graph once. Resolution retains the
legacy free-text sequence (LLM, heuristic, last cell-normalizer attempt). Protocol
and SoA select the endpoint builder; table/TLF/display select the table builder,
which still owns all display/cell decisions. Unknown datasets select the variable
builder. Router outputs are passed through without reformatting.

State contains only original/resolved strings, a request-local copy of `files`,
builder kind, and the legacy response. Response updates replace rather than append.
Each selected node runs one complete legacy builder; final pruning runs once on its
result. Unresolved requests skip pruning. Errors propagate to the API without
workflow retry or replay. The HTTP response contains no workflow state keys.

Synchronous invocation with the application's compiled graph (from `backend/`):

```python
from main import lineage_workflow
from services.lineage_workflow import invoke_lineage_workflow

response = invoke_lineage_workflow(lineage_workflow, {
    "dataset": "ADSL", "variable": "AGE", "files": [],
})
```

This example runs the real builder and requires its normal evidence/model setup.
Tests instead inject stub services and require no API key or model calls.

Evidence, retrieval, prompts, validation, augmentation, model fallback, and retries
remain inside the existing builders. Latest-session selection and the sessionless
frontend cache remain unchanged: invocation-state isolation is **not** evidence
isolation. There is no new deadline, checkpointing, tracing setup, or clinical
quality guarantee. LangSmith is a transitive dependency only. Future module
boundaries follow the [unified architecture in issue #52](https://github.com/1mgroot/Tracil/issues/52).

### Runtime and dependency workflow

The supported and verified runtime for this integration is Python 3.13 (tested on
CPython 3.13.1, macOS arm64). The original lockfiles were also generated on 3.13;
`requires-python` and tool targets now reflect this instead of claiming Python 3.8
support. The repository has no deployment runtime configuration, so an external
production runtime has not been independently verified. Deploy with Python 3.13;
other runtime/platform combinations need their own installation checks.

From `backend/`, regenerate the pinned files with the existing pip-tools workflow:

```bash
python3.13 -m venv .venv
source .venv/bin/activate
python -m pip install pip-tools
pip-compile --output-file=requirements.txt pyproject.toml
pip-compile --extra=dev --output-file=requirements-dev.txt pyproject.toml
python -m pip install -r requirements-dev.txt
python -m pip check
python -m pytest -q
```

### Migration validation

- Source commit: `5ba6dd3a59f39944b86c508fef8af6bdef883193`.
- Resolved LangGraph: `1.2.11`; pip-tools: `7.6.1`.
- A fresh Python 3.13.1 environment installed `requirements.txt`, passed `pip check`,
  and imported both LangGraph and the existing API. The dev lock was installed for
  the focused routing, invocation isolation, and HTTP smoke tests.
- `python -m pytest -q`: 24 tests passed. There were no pre-existing backend tests
  in this checkout. Five PyMuPDF/SWIG import deprecation warnings remain.
- Tests assert builder arguments/call counts, finalization, mixed gap and optional
  field preservation, free-text fallback order, unchanged errors, and request
  validation. They do not measure lineage accuracy or model performance.


### Local manual test data

Keep private/manual fixtures in the repository-root `local-test-data/` directory.
The root `.gitignore` excludes the entire directory, including test results;
`backend/output/` is also ignored. Do not force-add either directory.
Verify with `git check-ignore -v local-test-data/define.xml` and
`git ls-files -- local-test-data` (the latter must produce no output).

Upload the local fixture files through the UI after starting both services.
Set `OPENAI_API_KEY` in the ignored `backend/.env` before starting Python for real
lineage testing. HTTP 200 alone is insufficient: inspect `lineage.gaps` for the
legacy service-error envelope and confirm the model actually ran.

## Free offline UI testing

Use the explicit **test-only** launcher for routine UI and orchestration checks:

```bash
# Terminal 1, from backend/ with backend dependencies installed
python -m tests.offline_api

# Terminal 2, from frontend/ with frontend dependencies installed
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8001 npm run dev -- --port 3001
```

Open `http://localhost:3001`. Upload `backend/tests/fixtures/ADTEST.json`, select
ADTEST, then click SYNTHETIC_VALUE. This fixture uses the real JSON-upload schema
and contains two synthetic column definitions and **zero subject records**.
It is safe to commit; private test data still belongs in ignored local-test-data/.

The lineage response visibly says **OFFLINE FIXTURE / SYNTHETIC**. The two-node,
one-edge fixture follows the existing response envelope and includes both object
and string gaps. It asserts no actual CDISC or clinical relationship. Each request
gets its own copy. No API key is needed and no model/embedding request is made.

Named free-text scenarios (exact names, case-insensitive):

| Query | Scenario |
| --- | --- |
| `offline variable` | Synthetic variable response |
| `offline endpoint` | Synthetic endpoint response |
| `offline table` | Synthetic display response |
| `offline cell` | Synthetic cell response |
| `offline error` | Intentional builder failure through the real API error handler |
| Any other free text | Existing unresolved-request response |

Dataset/variable clicks also work with uploaded local files, but the returned graph
is always synthetic and does not use their evidence. The existing UI may enhance
error/unresolved results with placeholder relationships; those are not model output.

The harness retains the real HTTP validation, LangGraph, final pruning and upload
parsers. It injects deterministic resolver/builders, blocks HTTPX network transport
(including the OpenAI SDK), disables LangSmith tracing, and uses a temporary upload
output directory cleaned on exit. Scoped replacements are restored on shutdown.
It binds to loopback port 8001 only. Importing the test module does not activate it;
normal `uvicorn main:app` never imports it or falls back to fixtures. Tests are also
excluded from the production package by the existing services-only package rule.

Run `python -m pytest -q` from backend/: the default suite blocks outgoing model
HTTP calls. This follows [pytest's scoped mocking guidance](https://docs.pytest.org/en/stable/how-to/monkeypatch.html).
Fixtures verify contract and UI behavior, **not retrieval, prompts, model accuracy
or true end-to-end parity**. Keep a small, deliberate live-model smoke run before
accepting model-dependent changes. Switching between offline and live mode requires
restarting the frontend to clear its response cache; separate ports help avoid mixups.


Offline validation: 33 backend tests passed, including fixture upload through the
real parser, four named success routes, intentional failure/unresolved paths,
response isolation, restoration and synchronous/asynchronous network blocking.
A browser smoke run uploaded ADTEST.json, displayed its two fields, and clicked
SYNTHETIC_VALUE through Next.js → FastAPI → LangGraph → fixture → real pruning.
The page displayed the offline warning, two synthetic nodes and one edge. The
browser run used the temporary frontend runtime described in the local manual
report because of the project-directory file-read instability; no frontend source
changes were needed. This validates the offline path only.

### Source-backed ADAE.AEREL example (private local files)

To use documented relationships instead of the synthetic contract fixture:

```bash
# From backend/; requires the supplied TestData copy in local-test-data/
python -m tests.build_aerel_fixture ../local-test-data
python -m tests.offline_api --evidence-fixture ../local-test-data/adae-aerel/lineage_response.json
```

Restart the frontend against port 8001 and upload all three files in
`local-test-data/adae-aerel/uploads/`. Select ADAE → AEREL. The sidebar contains
ADAE, AE and aCRF; the graph has exactly three nodes and two documented edges:
CRF page 121 → AE.AEREL → ADAE.AEREL. Source quotes, locations and SHA-256 hashes
are recorded beside the fixture. Generated excerpts and provenance remain ignored.

The supplied ARS files and reviewed TLF output do not establish downstream use of
AEREL. The fixture explicitly reports that gap instead of linking a generic AE
table. This is a manually verified metadata example replayed without model calls,
not a validation of live retrieval or model reasoning. Only ADAE.AEREL and AE.AEREL
are supported by this launcher mode. The optional source-backed integration test
skips when private TestData is absent.

### Keep AEREL and add AESDISAB with a verified downstream display

```bash
# From backend/
python -m tests.build_ae_fixtures ../local-test-data
python -m tests.offline_api --evidence-fixture ../local-test-data/ae-lineage-examples/lineage_responses.json
```

Upload the four files in `local-test-data/ae-lineage-examples/uploads/` after
reloading the UI. Both ADAE and AE contain AEREL and AESDISAB; CRF and the ARS
output also appear in the sidebar. AEREL retains its original three-node response.
AESDISAB has CRF pages 121/122/123 → AE.AESDISAB → ADAE.AESDISAB →
FDA-AE-T06 analyses An_39/An_40/An_40_1 (8 nodes, 7 edges; at most 3 per category).
The three TLF nodes are analyses in one display, not three tables. CRF annotations
map AESDISAB to Serious Code 3 (Permanently disabling); this is a CRF code, not
a claim that SDTM AESER takes value 3.

The downstream edge is backed by Dss_11 → An_39, Dss_59 → An_40 and
Dss_60 → An_40_1, nested under Out_04 in the ARS main list of contents.
Out_04 contains Disp_04, titled FDA-AE-T06. AESDISAB is a subset filter, while
USUBJID is the analysis variable. The complete original ARS is retained to avoid
breaking references. Source hashes and the referenced objects are saved alongside
the responses. These examples validate metadata relationships and offline UI
behavior; they do not recompute subject counts or test live-model inference.

### Final validation of the requested examples

- Backend: 37 tests passed on Python 3.13.1, including 24 workflow/API tests,
  offline transport guards, private-source integration, and ARS-only navigation.
  The three private-source tests skip when TestData is absent; generated source
  excerpts, PDFs, ARS data and provenance are not committed.
- Frontend: the focused MainScreenClient suite passed all 4 tests. The earlier
  full suite had 155 passes and one existing VariableCard CSS-class assertion
  failure; that component and test remain unchanged.
- Browser: real uploads and clicks displayed both examples. AESDISAB displayed
  eight nodes/seven edges with all source categories present in the sidebar.
  The browser runtime used a temporary source copy plus the current frontend
  changes, because of the documented local installation/file-read instability.
- `pip check` passed. Existing datetime/PyMuPDF/lxml deprecation warnings remain.
  The checked-in npm lockfile previously prevented `npm ci` because of a missing
  `@types/dagre` entry; this backend migration does not repair that lockfile.
- No live-model success is claimed: without an API key the live path returned
  the legacy error envelope. Evidence fixtures verify curated relationships and
  the offline application path, not model quality or external deployment parity.
