### AI Developer Guide — Tracil 

Purpose: Only the minimal folder structure and stable entrypoints UI will use. Internals are your choice.

---

#### 1) Where to put AI code (MVP)
```
lib/ai/
├─ entrypoints/                # Only place the UI depends on (contracts)
│  ├─ analyzeLineage.ts        # (files/meta) → LineageIR
│  └─ parseFile.ts             # (blob, type) → ParsedArtifact
├─ lineage/                    # Minimal IR types/helpers
├─ parsers/                    # Minimal parsers (start with xpt, xlsx)
└─ provider/                   # Single provider (gemini or gpt)

types/
```

Path aliases (UI and API will use these):
- `@ai/*` → `lib/ai/*`
- `@types/*` → `types/*`

---

#### 2) Stable entrypoints (contracts)
- `@ai/entrypoints/analyzeLineage` input:
  - `files`: Array of `{ kind: 'SDTM'|'ADaM'|'TLF'|'CRF'|'Protocol'|'SAP', name: string, blob: Blob }`
  - `options`: `{ provider?: 'gpt'|'claude'|'gemini', metadataOnly?: boolean }`
- `@ai/entrypoints/analyzeLineage` output:
  - `{ nodes: Node[], edges: Edge[], gaps: Gap[] }` (Lineage IR types)
- `@ai/entrypoints/parseFile` input:
  - `{ blob: Blob, fileType: 'xpt'|'sas7bdat'|'xlsx'|'pdf'|'docx'|'rtf', group?: 'SDTM'|'ADaM'|'TLF'|'CRF'|'Protocol'|'SAP' }`
- `@ai/entrypoints/parseFile` output:
  - `ParsedArtifact` (normalized metadata and optional redacted samples)

Only these signatures are consumed by UI/API. Everything else inside `lib/ai/` is your own implementation choice.

---

#### 3) How the UI will call you (now and later)
- Now: UI uses a thin client that imports `@ai/entrypoints/*` directly (mocks OK).
- Later: Optional serverless routes call the same entrypoints; the UI swaps the thin client to `/api/*` with no shape changes.

---

#### 4) You do you (freedom of implementation)
- Internals are up to you. Only keep the `entrypoints` signatures stable so UI stays unblocked.


