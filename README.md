### Tracil — Developer Quickstart

Single-page Next.js workspace with mock-first AI integration. See `DESIGN.md` and `AI_DEV_GUIDE.md` for details.

### Prerequisites
- Node 18+ and npm
- Optional: Vercel CLI for deploys

### Install
```bash
npm install
```

### Run (mock mode by default)
```bash
export AI_MODE=mock
npm run dev
# open http://localhost:3000
```

### Folder map (essentials)
- `app/page.tsx`: single-page workspace container
- `components/`: shared UI primitives
- `features/`: UI-only vertical modules (upload, datasets, variables, lineage)
- `lib/ai/`: AI workspace (no UI deps)
  - `entrypoints/`: stable contracts used by UI (do not change signatures)
  - `lineage/`, `parsers/`, `provider/`: minimal MVP internals
- `types/`, `state/`, `hooks/`, `styles/`, `tests/`, `docs/`

### Configure providers (optional for live)
```bash
# .env.local
LLM_PROVIDER=gemini
GOOGLE_API_KEY=...    # or OPENAI_API_KEY / ANTHROPIC_API_KEY
AI_MODE=live          # mock|live|auto
```

### Roles
- Web UI dev: build views in `app/page.tsx` using `components/` + `features/`.
- AI dev: implement internals under `lib/ai/` and expose only `@ai/entrypoints/*`.

### Commit and lint
```bash
npm run lint
npm run build
```

### Deploy (later)
- Use Vercel. Keep keys in project settings; no client-side keys.
