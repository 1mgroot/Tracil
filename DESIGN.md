### Tracil — Project Design & Architecture (2025 Standards)

#### 1) Project Overview
- **Purpose**: AI-powered clinical data lineage platform improving traceability across Protocol/SAP, CRF, SDTM, ADaM, and TLF artifacts.
- **Processing Model**: In-browser file processing with ephemeral serverless support; no server-side persistence.
- **Technology Stack**: Next.js 15+ (App Router), TypeScript 5.6+, React 19+, Tailwind CSS v4, shadcn/ui, React Flow.
- **Deployment**: Vercel with performance monitoring and analytics.
- **Standards Compliance**: WCAG 2.2 AA accessibility, 2025 React patterns, ES2022+ TypeScript.
- **AI Integration**: Multi-provider abstraction (OpenAI GPT, Anthropic Claude, Google Gemini) with privacy-first approach.
- **Internationalization**: English primary, future bilingual (EN/中文) support.

---

#### 2) Cost‑free by default (hosting and LLM)
- Hosting: Vercel Hobby plan for free deployments suitable for early development and demos.
- LLM providers:
  - Google Gemini: typically offers a developer free tier with rate limits; good default for zero-cost development.
  - OpenAI GPT: generally no ongoing free tier (trial credits may apply for new accounts).
  - Anthropic Claude: generally no free tier.
- Recommendation: default `LLM_PROVIDER=gemini` for free development, with simple switching to `gpt` or `claude` via env.

Note: Free tiers/quotas change; verify before demos or releases and adjust defaults accordingly.

---

#### 2) 2025 Development Standards (Enforced)

**React & TypeScript (Mandatory Patterns):**
- **Named Imports**: `import { useState, useCallback } from 'react'` (never namespace imports)
- **Return Types**: `ReactNode` for components (more flexible than `JSX.Element`)
- **Performance**: Mandatory `React.memo`, `useMemo`, `useCallback` for optimization
- **Error Handling**: Error boundaries required for all major UI sections
- **Accessibility**: WCAG 2.2 AA compliance enforced via ESLint and testing

**Development Environment (Required):**
- **TypeScript**: ES2022+ target, strict mode, all advanced strict options enabled
- **ESLint**: Accessibility plugin mandatory, TypeScript strict rules enforced
- **Testing**: Automated accessibility testing with axe-core required
- **Performance**: Core Web Vitals monitoring mandatory
- **CSS**: Tailwind CSS v4 with container queries, OKLCH color space

**Code Quality (Enforced Standards):**
- Import order: Built-in → Third-party → Internal (ESLint enforced)
- Descriptive naming, no abbreviations (linter rules)
- Functions ≤ 20 lines, early returns pattern
- No silent catches, meaningful error messages
- 100% TypeScript coverage, no `any` types

---

#### 3) System Architecture

**Frontend (Next.js App Router)**
- **Framework**: Next.js 15+ with React 19+, TypeScript ES2022+
- **Styling**: Tailwind CSS v4 + shadcn/ui, OKLCH colors, container queries
- **State Management**: Zustand (global), React Context (component trees)
- **Performance**: Mandatory React.memo/useMemo/useCallback, streaming for large data
- **Accessibility**: WCAG 2.2 AA compliance, full keyboard navigation, screen reader support
- **Error Handling**: Error boundaries at route and component levels
- **Monitoring**: Core Web Vitals, user interactions, accessibility violations

**Next.js API Layer (Proxy/Gateway)**
- **Purpose**: Secure proxy between frontend and Python AI backend
- **Endpoints**: `/api/ai/process-files`, `/api/ai/analyze-variable`
- **Features**: Request validation, error handling, streaming responses, timeout management
- **Security**: API key management, request sanitization, CORS configuration
- **Privacy**: PII/PHI redaction before forwarding to AI backend

**Python AI Backend (FastAPI)**
- **Framework**: FastAPI with async/await for high-performance AI processing
- **Core Services**: 
  - File parsing (XPT, SAS7BDAT, XLSX, DOCX, PDF, RTF)
  - LLM integration (OpenAI GPT, Anthropic Claude, Google Gemini)
  - Lineage analysis and gap detection
  - CDISC compliance validation
- **Features**: Streaming responses, async processing, automatic API documentation
- **Privacy**: Ephemeral processing, no file persistence, metadata-only LLM calls
- **Deployment**: Docker containers, scalable serverless deployment

**Data Processing Pipeline**
- **File Upload**: Frontend → Next.js API → Python backend (streaming)
- **AI Analysis**: Python backend with provider abstraction and fallback
- **Response**: Streaming JSON responses for real-time progress updates
- **Privacy**: All processing ephemeral, files discarded immediately after processing

---

#### 4) File formats and ingestion (Python Backend)
- **Supported Formats**: SAS XPT (v5), SAS7BDAT, XLSX, DOCX, PDF, RTF
- **File Types**: 
  - SDTM/ADaM: SAS XPT (v5) and SAS7BDAT
  - TLF: RTF (primary)
  - Protocol/SAP/CRF: PDF, DOCX, XLSX
- **Python Libraries (AI Developer's Choice)**:
  - XPT: python-xport, pandas, or custom parsers
  - SAS7BDAT: sas7bdat, pandas, or custom parsers
  - XLSX: openpyxl, pandas, or xlsxwriter
  - DOCX: python-docx or custom parsers
  - PDF: PyPDF2, pdfplumber, or custom parsers
  - RTF: striprtf or custom RTF parsers
- **Validation (Python Backend)**:
  - Light CDISC checks: required domains, variable roles, presence
  - Return validation badges: ✔ valid, ❌ invalid, Missing

---

#### 5) Core AI Workflows (Python Backend)

**Workflow A: File Processing & Dataset Discovery**
```
Input: Frontend receives files from user
├─ aCRF files (PDF)
├─ SDTM metadata (define.xml, spec sheets, or raw .xpt)
├─ ADaM metadata (define.xml, spec sheets, or raw datasets)
└─ TLF documents (RTF/PDF)

Python Backend Processing:
├─ Parse all uploaded files (source-agnostic)
├─ Extract metadata and structure from any source type
├─ Organize by CDISC standards rather than source files


Output JSON Structure (Source-Agnostic):
{
  "standards": {
    "SDTM": {
      "type": "SDTM",
      "label": "Study Data Tabulation Model",
      "datasetEntities": {
        "DM": {
          "name": "DM",
          "label": "Demographics", 
          "type": "domain",
          "variables": [
            {
              "name": "USUBJID",
              "label": "Unique Subject Identifier",
              "type": "character",
              "length": 20,
              "role": "identifier"
            }
          ],
          "sourceFiles": [
            {"fileId": "define_sdtm_001", "role": "primary"},
            {"fileId": "dm_dataset_001", "role": "supplementary"}
          ]
        }
      }
    },
    "ADaM": {
      "type": "ADaM", 
      "label": "Analysis Data Model",
      "datasetEntities": {
        "ADSL": {
          "name": "ADSL",
          "label": "Subject-Level Analysis Dataset",
          "type": "analysis_dataset",
          "variables": [...],
          "sourceFiles": [{"fileId": "spec_sheet_001", "role": "primary"}]
        }
      }
    }
  },
  "metadata": {
    "sourceFiles": [...]
  }
}

Frontend Usage:
└─ Generate left pane file and dataset list (ADSL, ADAE, DM, LB, aCRF)
└─ Click dataset → display variables on main screen
└─ Future: Click variables → display variables source traceability
```

**Workflow B: Variable Lineage Analysis**
```
Input: User requests lineage for specific variable
├─ Variable name (e.g., "AEDECOD")
├─ Dataset context (e.g., "ADAE")
└─ Available metadata files

Python Backend Processing:
├─ Analyze variable across all available files
├─ Use AI/LLM to trace lineage connections
├─ Identify source → transformation → target relationships
└─ Generate confidence scores and gap detection

Output JSON Structure:
{
  "variable": "AEDECOD",
  "dataset": "ADAE", 
  "lineage": {
    "nodes": [
      {"id": "aCRF.AE_TERM", "type": "source", "file": "aCRF"},
      {"id": "SDTM.AE.AETERM", "type": "intermediate", "file": "ae.xpt"},
      {"id": "ADaM.ADAE.AEDECOD", "type": "target", "file": "adae.xpt"}
    ],
    "edges": [
      {"from": "aCRF.AE_TERM", "to": "SDTM.AE.AETERM", "confidence": 0.95},
      {"from": "SDTM.AE.AETERM", "to": "ADaM.ADAE.AEDECOD", "confidence": 0.87}
    ],
    "gaps": ["Missing transformation logic documentation"]
  }
}

Frontend Usage:
└─ Display interactive lineage visualization
└─ Show confidence scores and highlight gaps
```

---

#### 6) Pages and UX flow (single-page workspace)
- One workspace route: `app/page.tsx` contains the entire tool; no hard navigations.
- In-workspace views (toggled via local state/URL query):
  - Upload Files: grouped upload (SDTM, ADaM, TLF, Protocol/SAP/CRF); progress + validation badges (✔ / ❌ / Missing); enable Start Analysis when minimal set present
  - Select File: grouped datasets; expand SDTM to list domains (e.g., LB)
  - Browse Variables: list + filters (gap-only); detail modal with mini lineage
  - Lineage Graph: expand upstream/downstream (Protocol/SAP ↔ CRF ↔ SDTM ↔ ADaM ↔ TLF); highlight gaps; fit-to-view, search, focus

Note (implementation detail as of current branch):
- For App Router best practices, interactive workspace UI is implemented as a Client Component (`app/(workspace)/_components/MainScreenClient.tsx`) and rendered by `app/page.tsx`. This keeps hooks and interactivity out of the server component while preserving the single-page route.

#### 6.1) SEO strategy (optional, non-workspace routes)
- Keep the workspace as a single page (no SEO need).
- Add indexable marketing/docs routes when needed using static generation or ISR:
  - `app/(marketing)/page.tsx`, `app/(marketing)/features/page.tsx`, `app/(marketing)/docs/page.tsx`, etc.
- For SEO pages:
  - Use `generateMetadata` for title/description/OG/Twitter.
  - Provide `app/sitemap.ts` and `app/robots.txt`.
  - Prefer SSG/ISR (`export const dynamic = 'force-static'` where applicable).
  - Add canonical URLs and JSON-LD if relevant.

---

#### 4) Project Structure & Ownership (Monorepo)

**Unified Repository Structure (2025 Best Practices):**
```
/ (monorepo root - Tracil)
├─ .cursorrules
├─ .env.example                     # Template for all environment variables
├─ .gitignore
├─ README.md
├─ package.json                     # Root workspace configuration
│
├─ frontend/                        # Next.js Application
│  ├─ .env.local                    # Frontend-specific environment (not committed)
│  ├─ .env.example                  # Frontend environment template
│  ├─ package.json                  # Frontend dependencies
│  ├─ next.config.ts
│  ├─ tailwind.config.ts
│  ├─ tsconfig.json
│  ├─ app/
│  │  ├─ layout.tsx
│  │  ├─ page.tsx                   # Workspace (renders client entry)
│  │  └─ (workspace)/
│  │     └─ _components/
│  │        └─ MainScreenClient.tsx # Interactive workspace (client component)
│  │  └─ (marketing)/               # FUTURE: SEO pages
│  │  └─ (api)/                     # Next.js API routes (proxy to Python backend)
│  │     └─ ai/
│  │        ├─ process-files/
│  │        │  └─ route.ts          # POST /api/ai/process-files → Python POST /process-files
│  │        └─ analyze-variable/
│  │           └─ route.ts          # POST /api/ai/analyze-variable → Python POST /analyze-variable
│  ├─ components/                   # Shared UI primitives
│  ├─ features/                     # UI-only vertical slices
│  ├─ lib/
│  │  ├─ api-client.ts              # HTTP client for Python backend
│  │  └─ types.ts                   # Shared TypeScript types
│  ├─ hooks/
│  ├─ state/                        # Zustand stores (client-only)
│  ├─ styles/
│  └─ tests/                        # Frontend unit tests
│
├─ backend/                         # Python AI Backend (AI Developer's Domain)
│  ├─ .env                          # Backend environment (not committed)
│  ├─ .env.example                  # Backend environment template
│  ├─ requirements.txt              # Python dependencies
│  ├─ pyproject.toml                # Python project configuration
│  ├─ main.py                       # FastAPI application entry point
│  │
│  └─ [AI DEVELOPER HAS COMPLETE FREEDOM HERE]
│     # AI Developer can organize this however they want:
│     # - Any folder structure
│     # - Any Python libraries/frameworks
│     # - Any design patterns
│     # - Only constraint: expose the required API endpoints
│
├─ docs/                            # Documentation
├─ tests/                           # Integration tests
│
└─ (deployment/)                      # (Low Priority - Later)
   ├─ docker-compose.yml            # Full-stack local development
   ├─ Dockerfile.frontend           # Next.js container
   └─ Dockerfile.backend            # Python container
```

**Architecture Principles:**
- **Monorepo Benefits**: Single repository for easier coordination and shared tooling
- **AI Developer Autonomy**: Complete freedom in `backend/` folder structure and design
- **API-First Integration**: Only constraint is exposing required API endpoints
- **2025 Standards**: Modern React/TypeScript frontend, Python backend with full ecosystem access
- **Accessibility-First**: WCAG 2.2 AA compliance built into every component
- **Performance-First**: Streaming responses, async processing, monitoring built-in
- **Privacy-First**: Ephemeral processing, no persistence, PII/PHI protection
- **Developer Experience**: Unified development environment with Docker Compose

**Development Environment Setup:**
- **Frontend**: Standard Next.js development server (`npm run dev`)
- **Backend**: FastAPI with hot reload (`uvicorn app.main:app --reload`)
- **Integration**: Docker Compose for local full-stack development
- **API Documentation**: Auto-generated OpenAPI docs at `/docs` endpoint

Path aliases (to configure in `tsconfig.json`)
- `@api/*` → `lib/api-client/*`
- `@types/*` → `types/*`
- `@state/*` → `state/*`

Additional UI tokens and theming
- Global OKLCH tokens for surfaces and group accents are defined in `app/globals.css`. Tailwind v4 consumes these via CSS variable utilities (e.g., `bg-[var(--token)]`).

Layout constraint (main screen)
- Left pane is fixed to 260px on md+ via `md:grid-cols-[260px_1fr]` to match the visual spec.

**Team Focus & Responsibilities:**
- **Frontend Developer**: 
  - `frontend/` folder: `app/`, `components/`, `features/`, `hooks/`, `styles/`
  - Next.js API routes in `frontend/app/(api)/ai/*` (proxy logic only)
  - Frontend testing and accessibility compliance
- **AI Developer**: 
  - **Complete autonomy over `backend/` folder**
  - Can organize Python code however they prefer
  - Choose any libraries, frameworks, design patterns
  - Only requirement: expose these API endpoints:
    - `POST /process-files` - Process uploaded files and return dataset/variable structure
    - `POST /analyze-variable` - Generate lineage for a specific variable
- **Shared Responsibilities**:
  - API contract agreement (initially just documentation/verbal)
  - Integration testing coordination

---

#### 5) Development Methodology & Priorities

**High Priority (Immediate Development):**

**Frontend Developer:**
- Build UI with mock JSON responses (hardcoded in Next.js API routes)
- Focus on core UI components and user interactions
- Use static mock data that matches the expected API contract

**AI Developer:**
- Build Python backend with the two required endpoints
- Can run Python backend locally (simple `python main.py` or `uvicorn`)
- Focus on core file processing and lineage analysis logic

**API Contract (This is for communication between frontend and Python backend):**
- The JSON structure defines what data the Python backend sends to frontend
- Frontend needs variable details (name, label, type, role) to display rich information
- This allows frontend to show meaningful variable information beyond just names

**Medium Priority (After Core Features Work):**

**Integration Setup:**
- Replace frontend mock responses with actual HTTP calls to Python backend
- Set up CORS configuration for local development
- Test end-to-end workflows

**Low Priority (Later):**

**Formal API Contracts & Type Generation:**
- `shared/` folder with OpenAPI specifications
- `shared/api-contracts/process-files.json` - OpenAPI spec for file processing
- `shared/api-contracts/analyze-variable.json` - OpenAPI spec for variable analysis
- `shared/types/typescript/` - Auto-generated TypeScript types
- `shared/types/python/` - Auto-generated Pydantic models
- Type synchronization between frontend and backend

**Docker & Deployment:**
- `deployment/docker-compose.yml` for unified development environment
- `deployment/Dockerfile.frontend` and `deployment/Dockerfile.backend`
- Production deployment configuration
- Monitoring and logging setup
- Advanced error handling and retry logic

**Development Flow (Simplified):**
1. **Now**: Frontend with mocks + Python backend running separately
2. **Soon**: Connect them via HTTP calls (no Docker needed initially)  
3. **Later**: Docker, production deployment, advanced features

#### 6) Development Setup (Mandatory)

**Initial Setup:**
1. Next.js 15+ scaffold with TypeScript, App Router, ESLint
2. Install 2025 toolchain: Tailwind CSS v4, shadcn/ui, accessibility tools
3. Configure strict TypeScript (ES2022+, all strict options)
4. Set up comprehensive ESLint (accessibility + TypeScript rules)
5. Implement error boundaries and performance monitoring
6. Configure testing infrastructure (Jest + accessibility testing)

**Quality Gates (All Required):**
- TypeScript strict compilation (zero errors)
- ESLint accessibility compliance (zero violations)
- Automated accessibility testing (axe-core)
- Performance budgets (Core Web Vitals)
- Test coverage requirements
- Documentation standards

---

#### 7) Environment Configuration (Monorepo)

**Root Environment Template (.env.example):**
```bash
# ==============================================
# SHARED ENVIRONMENT VARIABLES TEMPLATE
# Copy to frontend/.env.local and backend/.env as needed
# ==============================================

# Development Configuration
NODE_ENV=development
PYTHON_ENV=development

# Frontend-Specific Variables (copy to frontend/.env.local)
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api
NEXT_PUBLIC_MAX_FILE_SIZE_MB=200

# Backend-Specific Variables (copy to backend/.env)
# LLM Provider Configuration
LLM_PROVIDER=gemini
OPENAI_API_KEY=your_openai_key_here
ANTHROPIC_API_KEY=your_claude_key_here  
GOOGLE_API_KEY=your_gemini_key_here

# Processing Configuration
AI_MODE=auto
MAX_FILE_SIZE_MB=200
ENABLE_METADATA_ONLY=true
PROCESSING_TIMEOUT_SECONDS=300

# FastAPI Configuration
HOST=0.0.0.0
PORT=8000
DEBUG=true
LOG_LEVEL=info

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3000,https://your-frontend-domain.com
```

**Frontend Environment Template (frontend/.env.example):**
```bash
# Frontend Environment Variables
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api
NEXT_PUBLIC_MAX_FILE_SIZE_MB=200

# Internal API Configuration (not exposed to browser)
PYTHON_AI_BACKEND_URL=http://localhost:8000
AI_API_TIMEOUT_MS=30000
```

**Backend Environment Template (backend/.env.example):**
```bash
# Python Backend Environment Variables
# LLM Provider Configuration (AI Developer's choice)
LLM_PROVIDER=gemini
OPENAI_API_KEY=your_openai_key_here
ANTHROPIC_API_KEY=your_claude_key_here  
GOOGLE_API_KEY=your_gemini_key_here

# Processing Configuration (AI Developer's choice)
AI_MODE=auto
MAX_FILE_SIZE_MB=200
ENABLE_METADATA_ONLY=true
PROCESSING_TIMEOUT_SECONDS=300

# FastAPI Configuration (AI Developer's choice)
HOST=0.0.0.0
PORT=8000
DEBUG=true
LOG_LEVEL=info

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3000,https://your-frontend-domain.com

# AI Developer can add any additional environment variables needed
```

**Environment Management Best Practices:**
- **Root .env.example**: Template showing all possible variables across both services
- **Service-specific .env.example**: Templates for each service's specific needs
- **No duplication**: Each service only has variables it actually needs
- **Security**: Sensitive variables (API keys) only in backend environment
- **Development**: Use .env.local (frontend) and .env (backend) for actual values
- **Production**: Set environment variables through deployment platform

---

#### 8) Risk Management
- Free tier variability → Default to Gemini; keep provider switchable; verify quotas before demos.
- Large files → Web Workers, streaming parsers, optional serverless parsing with strict timeouts.
- Graph scale → Expand-on-demand, virtualized panes, throttled layouts.

---

#### 9) Development Phases

**Phase 1: Foundation (✅ Complete)**
- 2025 tooling setup with accessibility-first architecture
- WCAG 2.2 AA compliant UI components with keyboard navigation
- Error boundaries, performance monitoring, comprehensive testing
- Modern React patterns with TypeScript strict mode

**Phase 2: Core Features (Next)**
- File upload with validation and progress indicators
- AI-powered parsing with privacy-first approach
- Variables browser with advanced filtering and search
- Real-time CDISC compliance checking

**Phase 3: Advanced Features**
- Interactive lineage visualization with React Flow
- AI-powered gap detection and recommendations
- Advanced accessibility features for complex interactions
- Multi-language support with RTL layouts

**Phase 4: Production**
- Performance optimization and monitoring
- Advanced error tracking and user analytics
- Comprehensive E2E testing and accessibility audits
- Production deployment with CI/CD pipeline

---

#### 10) Future Enhancements

**Performance Optimization:**
- Advanced virtualization for large datasets
- Service workers for offline functionality
- Advanced caching strategies and CDN optimization
- Real-time collaboration features

**AI Capabilities:**
- Multi-provider consensus and fallback strategies
- Advanced prompt engineering and few-shot learning
- Real-time confidence scoring and uncertainty quantification
- Advanced CDISC validation and compliance scoring

**User Experience:**
- Advanced keyboard shortcuts and power-user features
- Customizable dashboards and workspace layouts
- Advanced export formats and reporting capabilities
- Integration with external clinical data systems

---

#### 11) Quality Standards (Enforced)

**Code Quality Gates:**
- TypeScript strict compilation (zero errors, no `any`)
- ESLint accessibility compliance (zero violations)
- 100% WCAG 2.2 AA compliance (automated testing)
- Core Web Vitals in "Good" range (performance budgets)
- 90%+ test coverage for critical paths
- Zero security vulnerabilities in dependencies

**Development Standards:**
- All components must use modern React patterns (named imports, ReactNode)
- Error boundaries required for all major UI sections
- Performance monitoring mandatory (Core Web Vitals, user interactions)
- Accessibility testing required for all interactive components
- Documentation required for all public APIs and complex logic

**Architecture Compliance:**
- Clean separation between UI and business logic
- No direct AI provider imports in UI components
- All state management through established patterns (Zustand/Context)
- Consistent error handling and user feedback patterns
- Performance optimization built into component design


