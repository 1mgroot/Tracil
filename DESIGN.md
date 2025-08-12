### Tracil — Design and Implementation Plan

#### 1) Scope and assumptions
- Build a Next.js web app to improve traceability across Protocol/SAP, CRF, SDTM, ADaM, and TLF artifacts.
- Users upload files in-browser; processing is ephemeral with no server-side persistence.
- Stack: Next.js (App Router, TypeScript), Tailwind CSS, shadcn/ui, React Flow; deploy on Vercel; designs in Figma.
- LLM providers via an abstraction supporting OpenAI GPT, Anthropic Claude, Google Gemini. Default to a free provider for dev (see Cost-Free section); assume OpenAI GPT when a paid provider is chosen.
- i18n: English now; future bilingual (EN/中文). No authentication initially.

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

#### 3) Architecture overview
- Client (Next.js + TypeScript)
  - UI: Tailwind + shadcn/ui
  - Parsing in-browser where feasible (XPT, SAS7BDAT, XLSX, DOCX, PDF, RTF)
  - State: Zustand and/or React Context; heavy parsing in Web Workers
  - Visualization: React Flow (ELK layout optional, later)
- Serverless (future, optional)
  - Later, add thin API routes that delegate to `@ai/entrypoints/*` without changing UI contracts.
  - All processing remains ephemeral; no server-side persistence.
- Lineage model
  - Unified Lineage IR with node types for Protocol/SAP/CRF/SDTM/ADaM/TLF and edges containing relation, derivation, confidence, gap flags

---

#### 4) File formats and ingestion
- SDTM/ADaM: SAS XPT (v5) and SAS7BDAT
- TLF: RTF (primary)
- Protocol/SAP/CRF: PDF, DOCX, XLSX
- Indicative libraries
  - XPT: xport-js or xport-parser
  - SAS7BDAT: WASM-based parsers
  - XLSX: `xlsx` (SheetJS)
  - DOCX: `mammoth`
  - PDF: `pdfjs-dist`
  - RTF: lightweight RTF-to-text parser
- Validation
  - Light CDISC checks: required domains, variable roles, presence; badges: ✔ valid, ❌ invalid, “缺失” missing

---

#### 5) LLM analysis pipeline
- Provider abstraction with adapters (OpenAI/Anthropic/Gemini), selected via `LLM_PROVIDER`
- Preprocess: extract metadata, normalize tables, chunk large docs, redact sample values
- Prompting: instruct model to infer lineage links and detect gaps with reasons
- Output: normalized edges to Lineage IR with confidence + gap flags
- Privacy: analyze metadata by default; strip PII/PHI (identifiers/health-linked data) before LLM calls; provide a “metadata-only” toggle

---

#### 6) Pages and UX flow (single-page workspace)
- One workspace route: `app/page.tsx` contains the entire tool; no hard navigations.
- In-workspace views (toggled via local state/URL query):
  - Upload Files: grouped upload (SDTM, ADaM, TLF, Protocol/SAP/CRF); progress + validation badges (✔ / ❌ / Missing); enable Start Analysis when minimal set present
  - Select File: grouped datasets; expand SDTM to list domains (e.g., LB)
  - Browse Variables: list + filters (gap-only); detail modal with mini lineage
  - Lineage Graph: expand upstream/downstream (Protocol/SAP ↔ CRF ↔ SDTM ↔ ADaM ↔ TLF); highlight gaps; fit-to-view, search, focus

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

#### 7) Project structure and team responsibilities (single-page, AI-first)
```
/ (repo root)
├─ .cursorrules
├─ .env.example
├─ app/
│  ├─ layout.tsx
│  └─ page.tsx                       # Workspace (all views inside one page)
│  └─ (marketing)/                   # FUTURE: SEO pages (features, docs, blog)
│  └─ (api/)                         # FUTURE: optional serverless routes
├─ components/                       # Shared UI primitives
├─ features/                         # UI-only vertical slices (optional)
├─ lib/
│  └─ ai/                            # Independent AI workspace (no UI deps)
│     ├─ entrypoints/                # Stable facades used by UI (contracts only)
│     │  ├─ analyzeLineage.ts        # (files/meta) → LineageIR
│     │  └─ parseFile.ts             # (blob, type) → ParsedArtifact
│     ├─ lineage/                    # Minimal IR types and helpers (MVP)
│     ├─ parsers/                    # Minimal parsers (start with xpt, xlsx)
│     └─ provider/                   # Single provider implementation (e.g., gemini or gpt)
├─ hooks/
├─ state/                            # Zustand stores (client-only)
├─ styles/
├─ types/                            # Shared TS types (CDISC, IR, DTOs)
├─ tests/                            # Unit tests (focus on lib/ai)
└─ docs/
```

Why this is simpler for AI developers
- Independent workspace: Everything AI lives under `lib/ai/` with zero UI coupling. You can develop, test, and refactor internally without touching routes/components.
- Stable contracts: UI and API routes only import from `lib/ai/entrypoints/*`, minimizing surface area and churn.
- Clear ownership: Web devs stay in `app/`, `components/`, `features/`; AI devs own `lib/ai/`, `types/` (shared), and API route logic that simply calls AI facades.

Path aliases (to configure in `tsconfig.json`)
- `@ai/*` → `lib/ai/*`
- `@types/*` → `types/*`
- `@state/*` → `state/*`

Team focus
- Web developer: `app/`, `components/`, `features/`, `hooks/`, `styles/`
- AI developer: `lib/ai/` (all subfolders), `types/`, unit tests in `tests/`, and the thin logic inside `app/api/*` to connect HTTP → `@ai/entrypoints/*`

---

#### 8) Mock-first development plan (UI first, AI later)
- Web developer builds all pages and interactions using mock data and fixtures.
- The Upload UI may accept real files for UX testing, but no AI calls occur; only local validation and previews.
- During mock phase:
  - UI calls a thin client module that delegates directly to `@ai/entrypoints/*` (no serverless yet).
  - `@ai/entrypoints/analyzeLineage` returns deterministic sample IR from `tests/fixtures/` or `docs/mocks/`.
  - `@ai/entrypoints/parseFile` can either run lightweight local parsers or return summarized metadata stubs without LLM.
- Contracts remain stable: the UI consumes `@ai/entrypoints/*` outputs and shared types so swapping mocks → real AI is seamless.
 - AI integration starts only after the designated milestone (see Milestones). Set `AI_MODE=live` (or `AI_MODE=auto`).

#### 8.1) Parallel workstreams (non-blocking)
- Start both roles immediately once the skeleton exists:
  - Web UI developer:
    - Build all pages/components and wire a thin client to `@ai/entrypoints/*` (direct import) using mocks.
    - Later, swap the thin client to call `/api/*` without changing UI components.
  - AI developer:
    - Implement `lib/ai/*` internals freely; expose only stable functions in `lib/ai/entrypoints/*`.
    - Provide mock implementations first that match the final return shapes, then switch to real logic without changing signatures.
- Contract to stay unblocked:
  - Keep `entrypoints` function signatures and return types stable.
  - UI/API never import from `lib/ai/providers/*` or other internals.
  - Any changes to shared types live in `types/` and are versioned with clear diffs.

#### 9) Initialization plan (what to run first)
1) Run `create-next-app` first to scaffold Next.js (TypeScript, App Router, ESLint) correctly.
2) Add Tailwind CSS and shadcn/ui.
3) Create the folder skeleton and placeholder routes/components.
4) Wire basic state (Zustand), environment config, and CI lint/typecheck.

Rationale: letting the official scaffolder set up configs avoids subtle misconfiguration, then we layer our structure on top.

---

#### 10) Environment variables
- `LLM_PROVIDER=gpt|claude|gemini` (default `gemini` for free dev)
- `OPENAI_API_KEY=`
- `ANTHROPIC_API_KEY=`
- `GOOGLE_API_KEY=`
- `MAX_FILE_SIZE_MB=200`
- `ENABLE_METADATA_ONLY=true`
- `AI_MODE=mock|live|auto`          # mock (default) uses canned results; live calls provider; auto picks live if keys present

Secrets are stored only in server env (Vercel project settings). Client never sees keys.

---

#### 11) Risks and mitigations
- Free tier variability → Default to Gemini; keep provider switchable; verify quotas before demos.
- Large files → Web Workers, streaming parsers, optional serverless parsing with strict timeouts.
- Graph scale → Expand-on-demand, virtualized panes, throttled layouts.

---

#### 12) Milestones
- M1: Scaffold app + Tailwind + shadcn/ui + React Flow + `.cursorrules` + route placeholders (UI uses mocks)
- M2: Parsing UX and validation chips with mock outputs; upload queue; fixtures finalized
 - M3: Enable real AI path by setting `AI_MODE=live`; implement provider adapter (default Gemini) and normalization to IR
- M4: Variables UI + detail modal + lineage graph interactions refined (real AI optional via flags)
- M5: Performance hardening, i18n scaffolding (EN/中文), Vercel deploy

---

#### 13) Lower-priority enhancements (performance and accuracy)
- Performance (later):
  - Web Workers for heavy parsing of large files
  - Streaming parsers and incremental UI updates
  - Virtualized tables and list views
  - ELK-based graph layout tuning and caching
  - Optional serverless offloading for very large documents
- Accuracy (later):
  - Advanced prompt strategies and few-shot exemplars
  - Multi-provider fallback or consensus
  - Richer CDISC validations and rule sets
  - Better table extraction from PDF/RTF with heuristics/WASM libs
  - Confidence scoring calibration and gap reason taxonomy


