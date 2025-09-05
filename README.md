# Tracil

## What is Tracil?

Tracil is an AI-powered clinical data lineage platform that connects Protocol/SAP, CRF, SDTM, ADaM, and TLF artifacts into a clear, standards-aligned traceability graph. It is source-agnostic (works with define.xml, specs, raw datasets, PDFs/RTFs) and CDISC-first, with privacy-by-design: no long-term server-side persistence.

<img width="1920" height="990" alt="image" src="https://github.com/user-attachments/assets/cb0d9675-81d5-4a29-9eb6-c996e843d9ad" />
<img width="1920" height="990" alt="image" src="https://github.com/user-attachments/assets/b5ea855e-3d48-4a78-84c9-176b7ac6f11c" />

## Project Owners  

- Junze Zhang  
- Kexin Guan  
- Anthony Chow  

*All project owners contributed significantly; ordering is not intended to reflect contribution levels.*

## Key Features

- **Source‑agnostic ingestion**: Ingests XPT/SAS7BDAT/JSON (SDTM/ADaM datasets), define.xml, ARD, ARS, PDF/RTF/DOCX (Protocol/CRF/TLF documents) across all CDISC standards.
- **Specification support**: Accepts ADaM/SDTM specifications (e.g., XLSX/CSV) and define.xml.
- **CDISC‑first organization**: Normalizes inputs into a unified structure by standard (not by file), enabling consistent UI and APIs.
- **AI‑powered lineage analysis**: Explains variable lineage (source → transformation → target) with evidence tags on nodes/edges — [direct], [reasoned], [general] — and explicit gap notes when links can’t be supported; supports freeform queries.
- **TLF cell normalization**: Converts natural‑language table requests into concrete cell specs and builds a TLF index from ARD/ARS.
- **USDM study design support**: Parses USDM JSON, auto‑labels objectives/endpoints, filters placeholders, and exposes a clean design view.
- **Accessibility & UX**: WCAG 2.2 AA compliant, full keyboard navigation, screen reader support, strong error handling and user feedback.
- **Performance & privacy**: Ephemeral sessions, metadata‑only LLM usage, strict timeouts, and streaming where applicable.
- **Developer experience**: Typed API responses, strict TypeScript, 136 passing tests including accessibility checks.

## Architecture Overview

- **Frontend (Next.js 15 + React 19 + TypeScript 5.6+)**: Single‑page workspace; components in `frontend/components`; proxy API routes in `frontend/app/api/ai/*`.
- **Proxy API routes**: `POST /api/ai/process-files` and `POST /api/ai/analyze-variable` forward to Python backend with timeouts and error handling.
- **Python backend (FastAPI)**: Core endpoints `POST /process-files` and `POST /analyze-variable`; optional `GET /health` for readiness.
- **Standards & parsing**: SDTM/ADaM via pyreadstat/define.xml; CRF/Protocol/USDM via PDF/JSON parsers; TLF via ARD/ARS/RTF.
- **Privacy & sessions**: No long‑term persistence; transient session artifacts during development under `backend/output/`.

<img width="376" height="735" alt="image" src="https://github.com/user-attachments/assets/0478c148-9e43-4528-a096-d0d4749b08cd" />


## Technical quality & feasibility

- **Reproducible**: Clear setup, strict TypeScript, comprehensive tests, explicit API contracts, environment‑driven configuration.
- **Sound**: Strong error handling, timeouts, streaming, and deterministic fallbacks when AI is unavailable.
- **Extensible**: Modular backend services; easy to add new file types or standards; proxy pattern isolates the UI from AI providers.
- **Adoptable**: Works with define.xml/specs/raw datasets; can be introduced incrementally without data migration.

## Impact & value

- **Efficiency**: Automates lineage discovery and TLF cell identification; reduces manual curation and review cycles.
- **Conformance**: Encourages CDISC standards‑aligned structures and exposes gaps explicitly.
- **Transformation**: Accelerates protocol‑to‑analysis traceability, improving auditability and submission readiness.
- **Interoperability**: Contracts and normalized structures enable integration with existing pipelines and tools.

## Accessibility Support

Tracil is built with **accessibility-first** principles, ensuring the platform is usable by everyone, including users with disabilities.

**WCAG 2.2 AA Compliance:**
- ✅ Full keyboard navigation support
- ✅ Screen reader compatibility (ARIA labels, roles, properties)
- ✅ High contrast color schemes (OKLCH color space)
- ✅ Focus management and visual indicators
- ✅ Semantic HTML structure
- ✅ Alternative text for images and icons

**Accessibility Features:**
- **Keyboard Navigation**: Complete interface control without mouse
  - Tab/Shift+Tab for navigation
  - Enter/Space for activation
  - Arrow keys for lists and grids
  - Escape to close modals/dropdowns
- **Screen Reader Support**: Comprehensive ARIA implementation
  - Descriptive labels for all interactive elements
  - Live regions for dynamic content updates
  - Proper heading hierarchy (h1-h6)
  - Table headers and captions for data
- **Visual Accessibility**: 
  - 4.5:1 minimum contrast ratio (AAA level)
  - Scalable text up to 200% without horizontal scrolling
  - No reliance on color alone for information
  - Reduced motion support for vestibular disorders
- **Cognitive Accessibility**:
  - Clear, consistent navigation patterns
  - Descriptive error messages and validation
  - Timeout warnings and extensions
  - Help text and tooltips for complex interactions

**Testing & Validation:**
- Automated accessibility testing with axe-core
- Manual keyboard navigation testing
- Screen reader testing (NVDA, JAWS, VoiceOver)
- Color contrast validation
- 122 accessibility tests in the test suite

**Keyboard Shortcuts:**
- `Cmd/Ctrl + B`: Toggle sidebar
- `Tab`: Navigate forward through interactive elements
- `Shift + Tab`: Navigate backward
- `Enter/Space`: Activate buttons and links
- `Escape`: Close modals and dropdowns
- `Arrow Keys`: Navigate within data grids and lists

For accessibility feedback or support requests, please open an issue with the `accessibility` label.

### Ephemeral Processing and Privacy

- Tracil is designed for ephemeral processing; no long-term server-side persistence of user files.
- During development, the backend may write transient session artifacts under `backend/output/session_<timestamp>` to aid debugging. These artifacts should be treated as temporary and cleaned up. No raw data is sent to LLMs; only metadata is used.

## Demo flow (suggested)

1) Upload mixed files (define.xml, SDTM/ADaM XPT/SAS7BDAT, aCRF PDF, Protocol PDF, ARD/ARS JSON).
2) Browse the unified left pane (SDTM/ADaM/CRF/Protocol/TLF); select a dataset to view variables.
3) Click a variable → get AI lineage (sources, transformations, gaps) with an interactive graph.
4) Try a natural language query (e.g., “Show the derivation of max week 4 baseline pulse rate for patients that received Xanomeline low dose treatment in table ARS_VS_T01”) → normalized cell and lineage context.

### Prerequisites
- Node 18+ and npm (for frontend)
- Python 3.8+ and pip (for backend)

### Quick Start

**Frontend Development:**
```bash
# Install and run frontend
npm install
npm run frontend:dev
# open http://localhost:3000
```

**Backend Development (AI Developer):**
```bash
# Set up Python backend
cd backend
# Install dependencies and run FastAPI
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload  # serves at http://localhost:8000

# Follow backend/AI_DEV_GUIDE.md for details
# AI Developer has complete freedom over backend implementation
```

### Environment Setup

**Copy environment templates:**
```bash
# Frontend environment
cp frontend/.env.example frontend/.env.local

# Backend environment (AI Developer)
cp backend/.env.example backend/.env
```

**Environment variables (commonly used):**

- Frontend (`frontend/.env.local`)
  - `NEXT_PUBLIC_API_BASE_URL` = Python backend base URL (default `http://localhost:8000`)
  - `NEXT_PUBLIC_API_TIMEOUT_MS` = API timeout in ms (default `120000`)
- Backend (`backend/.env`)
  - `ALLOWED_ORIGINS` = Frontend origin for CORS (default `http://localhost:3000`)
  - `OPENAI_API_KEY` = Optional, enables LLM features
  - `USDM_SUMMARY_MODEL`, `CELL_NORMALIZER_MODEL`, `FREEFORM_ROUTER_MODEL` = Optional model overrides


### Development Scripts
```bash
# Frontend
npm run frontend:dev    # Start Next.js dev server
npm run frontend:build  # Build frontend
npm run frontend:test   # Run frontend tests

# Backend (AI Developer sets up their own scripts)
npm run backend:dev     # Placeholder - AI Developer implements
```

### Monorepo Structure
```
/
├── frontend/           # Next.js Application
│   ├── app/           # App Router pages
│   ├── components/    # Shared UI primitives  
│   ├── features/      # UI-only vertical modules
│   └── ...
├── backend/           # Python AI Backend (AI Developer's Domain)
│   ├── AI_DEV_GUIDE.md # Complete guide for AI developer
│   └── .env.example   # Backend environment template
├── .env.example       # Root environment template
└── DESIGN.md         # Complete architecture documentation
```

### API Endpoints

- Python Backend (FastAPI):
  - `POST /process-files` — Process uploaded files and return CDISC-organized structure
  - `POST /analyze-variable` — Generate lineage for a specific variable or freeform query
  - Optional: `GET /health` — Simple health endpoint (frontend handles absence gracefully)
- Next.js API proxy (Frontend):
  - `POST /api/ai/process-files` → proxies to backend `/process-files`
  - `POST /api/ai/analyze-variable` → proxies to backend `/analyze-variable`
  - `GET /api/ai/process-files?health=true` → lightweight health probe; reports unhealthy if backend `/health` is missing
