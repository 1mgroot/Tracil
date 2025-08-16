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
- **Performance**: Mandatory React.memo/useMemo/useCallback, Web Workers for heavy tasks
- **Accessibility**: WCAG 2.2 AA compliance, full keyboard navigation, screen reader support
- **Error Handling**: Error boundaries at route and component levels
- **Monitoring**: Core Web Vitals, user interactions, accessibility violations

**Data Processing**
- **File Parsing**: In-browser (XPT, SAS7BDAT, XLSX, DOCX, PDF, RTF) via Web Workers
- **Validation**: Real-time CDISC compliance checking
- **Privacy**: No server-side file persistence, ephemeral processing only

**AI Integration**
- **Architecture**: Provider abstraction layer in `lib/ai/`
- **Providers**: OpenAI GPT, Anthropic Claude, Google Gemini
- **Privacy**: Metadata-only prompts, PII/PHI redaction
- **Modes**: `mock` (development), `live` (production), `auto` (conditional)

**Serverless Backend (Optional)**
- **Purpose**: Heavy processing offload, API rate limiting
- **Implementation**: Stateless proxies calling `@ai/entrypoints/*`
- **Constraints**: Strict timeouts, no persistence, ephemeral processing

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

#### 4) Project Structure & Ownership
```
/ (repo root)
├─ .cursorrules
├─ .env.example
├─ app/
│  ├─ layout.tsx
│  ├─ page.tsx                       # Workspace (renders client entry)
│  └─ (workspace)/
│     └─ _components/
│        └─ MainScreenClient.tsx     # Interactive workspace (client component)
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

**Architecture Principles:**
- **Domain Separation**: AI logic (`lib/ai/`) completely decoupled from UI
- **Stable Contracts**: UI only imports `@ai/entrypoints/*`, never internals
- **2025 Standards**: All code follows modern React/TypeScript patterns
- **Accessibility-First**: WCAG 2.2 AA compliance built into every component
- **Performance-First**: Monitoring and optimization built into architecture
- **Error Resilience**: Graceful degradation at all levels
- **Developer Experience**: Comprehensive tooling, testing, and documentation

Path aliases (to configure in `tsconfig.json`)
- `@ai/*` → `lib/ai/*`
- `@types/*` → `types/*`
- `@state/*` → `state/*`

Additional UI tokens and theming
- Global OKLCH tokens for surfaces and group accents are defined in `app/globals.css`. Tailwind v4 consumes these via CSS variable utilities (e.g., `bg-[var(--token)]`).

Layout constraint (main screen)
- Left pane is fixed to 260px on md+ via `md:grid-cols-[260px_1fr]` to match the visual spec.

Team focus
- Web developer: `app/`, `components/`, `features/`, `hooks/`, `styles/`
- AI developer: `lib/ai/` (all subfolders), `types/`, unit tests in `tests/`, and the thin logic inside `app/api/*` to connect HTTP → `@ai/entrypoints/*`

---

#### 5) Development Methodology
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

#### 7) Environment Configuration
- `LLM_PROVIDER=gpt|claude|gemini` (default `gemini` for free dev)
- `OPENAI_API_KEY=`
- `ANTHROPIC_API_KEY=`
- `GOOGLE_API_KEY=`
- `MAX_FILE_SIZE_MB=200`
- `ENABLE_METADATA_ONLY=true`
- `AI_MODE=mock|live|auto`          # mock (default) uses canned results; live calls provider; auto picks live if keys present

Secrets are stored only in server env (Vercel project settings). Client never sees keys.

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


