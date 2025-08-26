### Lineage Flow Chart — Design (Frontend, Mock-first, API-compatible)

Purpose: add an interactive lineage flow chart view that opens when a user picks a variable from the Variables Browser. The view consumes mocked lineage data using the same TypeScript contracts we will receive from the Python backend, so swapping to real data is a drop-in change.

---

### User flow
- Select dataset from left pane
- Browse variables in the grid
- Click a variable → open lineage view for that variable
- Use Back control to return to the variable grid of the same dataset

---

### Scope
- Frontend-only, mock lineage for two variables: `ADSL.SEX` and `AE.AEBODSYS`
- Strict TypeScript, accessibility-first UI
- No persistence; all data is ephemeral

---

### Current state (code alignment)
- Data model: source-agnostic mocks live in `frontend/features/variables/mockSourceAgnostic.ts` (organized by CDISC standards)
- Migration layer: `frontend/lib/data-structure/migration.ts` transforms either legacy or source-agnostic responses into a unified UI shape consumed by the Variables Browser
- UI state: `MainScreenClient` currently supports `'search'` and `'variables'`; lineage view is planned (see Navigation and state)
- Entrypoint: `frontend/lib/ai/entrypoints/analyzeLineage.ts` is the single consumer; implement as a mock now and later proxy to the backend

Notes:
- The standard is named `CRF` in the data layer, while the UI group label is shown as `aCRF`. The migration layer handles grouping for the sidebar.

---

### Types and contracts
New shared types to match the backend response. These types are intentionally provider-agnostic and can be returned by the Next.js API proxy once the Python backend is wired.

```ts
// frontend/types/lineage.ts
export type LineageNodeKind = 'source' | 'intermediate' | 'target'
export type ArtifactGroup = 'Protocol/SAP' | 'aCRF' | 'SDTM' | 'ADaM' | 'TLF'

export interface LineageNode {
  readonly id: string            // e.g., "SDTM.DM.SEX"
  readonly title: string         // short label for node
  readonly dataset?: string      // e.g., "DM", "ADSL", "AE"
  readonly variable?: string     // e.g., "SEX", "AEBODSYS"
  readonly group: ArtifactGroup  // for visual accent & grouping
  readonly kind: LineageNodeKind // visual style and ordering
  readonly meta?: { file?: string; notes?: string }
}

export interface LineageEdge {
  readonly from: string
  readonly to: string
  readonly confidence?: number   // 0..1
  readonly label?: string        // e.g., "retain", "MedDRA map"
}

export interface LineageGaps { readonly notes?: string[] }

export interface LineageGraph {
  readonly summary: string
  readonly nodes: readonly LineageNode[]
  readonly edges: readonly LineageEdge[]
  readonly gaps?: LineageGaps
}
```

---

### Data source (mock-first, API-compatible)
- Create `frontend/features/lineage/mocks.ts` that exports `mockLineage: Record<string, LineageGraph>` keyed by `"<DATASET>.<VARIABLE>"`.
- Add a thin entrypoint `frontend/lib/ai/entrypoints/analyzeLineage.ts` that returns a `Promise<LineageGraph>`.
  - In mock mode, it resolves from `mockLineage[key]`.
  - Later, it will call the proxy `POST /api/ai/analyze-variable` with the identical request/response shape.

Example call site usage (page/component):
```ts
import { analyzeLineage } from '@/lib/ai/entrypoints/analyzeLineage'

const graph = await analyzeLineage({ dataset: 'ADSL', variable: 'SEX' })
```

Request payload (future backend):
```ts
{ dataset: string; variable: string }
```

Response payload (future backend):
```ts
{ variable: string; dataset: string; lineage: LineageGraph }
```

---

### Mock lineage data (authoritative examples)

```ts
// frontend/features/lineage/mocks.ts
export const mockLineage: Record<string, LineageGraph> = {
  'ADSL.SEX': {
    summary: 'SEX is captured on CRF, standardized in SDTM DM.SEX, and retained as ADSL.SEX.',
    nodes: [
      { id: 'aCRF.DEMO.SEX', title: 'CRF: Sex', group: 'aCRF', kind: 'source', meta: { file: 'acrf_v1.0.pdf' } },
      { id: 'SDTM.DM.SEX', title: 'DM.SEX', group: 'SDTM', kind: 'intermediate', dataset: 'DM', variable: 'SEX' },
      { id: 'ADaM.ADSL.SEX', title: 'ADSL.SEX', group: 'ADaM', kind: 'target', dataset: 'ADSL', variable: 'SEX' },
    ],
    edges: [
      { from: 'aCRF.DEMO.SEX', to: 'SDTM.DM.SEX', confidence: 0.95, label: 'CRF capture → SDTM standardize' },
      { from: 'SDTM.DM.SEX', to: 'ADaM.ADSL.SEX', confidence: 0.98, label: 'retain' },
    ],
    gaps: { notes: ['Confirm SDTM → ADaM retention rule in spec.'] },
  },
  'AE.AEBODSYS': {
    summary: 'AEBODSYS is derived via MedDRA coding in SDTM AE and retained for ADAE.',
    nodes: [
      { id: 'aCRF.AE.TERM', title: 'CRF: AE Term', group: 'aCRF', kind: 'source', meta: { file: 'acrf_v1.0.pdf' } },
      { id: 'SDTM.AE.AETERM', title: 'AE.AETERM', group: 'SDTM', kind: 'intermediate', dataset: 'AE', variable: 'AETERM' },
      { id: 'SDTM.AE.AEBODSYS', title: 'AE.AEBODSYS', group: 'SDTM', kind: 'intermediate', dataset: 'AE', variable: 'AEBODSYS' },
      { id: 'ADaM.ADAE.AEBODSYS', title: 'ADAE.AEBODSYS', group: 'ADaM', kind: 'target', dataset: 'ADAE', variable: 'AEBODSYS' },
    ],
    edges: [
      { from: 'aCRF.AE.TERM', to: 'SDTM.AE.AETERM', confidence: 0.90, label: 'CRF capture' },
      { from: 'SDTM.AE.AETERM', to: 'SDTM.AE.AEBODSYS', confidence: 0.85, label: 'MedDRA map' },
      { from: 'SDTM.AE.AEBODSYS', to: 'ADaM.ADAE.AEBODSYS', confidence: 0.95, label: 'retain' },
    ],
    gaps: { notes: ['Document MedDRA version and mapping rules.'] },
  },
}
```

---

### UI composition

New components:
- `frontend/app/(workspace)/_components/LineageView.tsx`
  - Wrapper for the lineage page with breadcrumb and Back control
  - Layout: summary card (left/top on small screens), graph canvas (main)
- `frontend/components/lineage/TraceabilitySummary.tsx`
  - Receives `LineageGraph.summary` and `gaps` and renders an accessible card
- `frontend/components/lineage/LineageGraph.tsx`
  - Renders nodes/edges using React Flow, with fit-to-view, pan/zoom
  - Accessible fallback list of nodes and edges beneath the canvas

Styling:
- Use existing tokens in `app/globals.css` (e.g., `--accent-adam`, `--accent-sdtm`, `--accent-acrf`) for node accents
- Rounded surfaces and subtle borders per current visual spec

Accessibility:
- Landmarks and headings; keyboard shortcuts for fit-to-view and panning
- Screen-reader list representation of nodes and edges

---

### Visual Design - Node Styling

Each lineage node is displayed as a button with the background color matching its group's color:

**Node Button Styling:**
- **ADaM nodes**: Green background (`--accent-adam`) - e.g., ADSL.SEX, ADAE.AEBODSYS
- **SDTM nodes**: Blue background (`--accent-sdtm`) - e.g., DM.SEX, AE.AEBODSYS  
- **aCRF nodes**: Red background (`--accent-acrf`) - e.g., CRF_DEMO.SEX, CRF_AE.AETERM
- **TLF nodes**: Purple background (`--accent-tlf`) - e.g., T-14-3-01

**Button Design:**
- Rounded corners (consistent with current UI)
- Group color as background with white text
- Subtle border/shadow for depth
- Hover states with slightly darker group color
- Active/selected state with darker group color

**Example Node Appearance:**
```tsx
// Node button with group-specific styling
<button 
  className={`px-4 py-2 rounded-lg text-white font-medium
    ${getGroupColor(node.group)} 
    hover:${getGroupHoverColor(node.group)}
    transition-colors duration-200`}
>
  {node.title}
</button>
```

**Group Color Mapping:**
```tsx
const getGroupColor = (group: ArtifactGroup): string => {
  switch (group) {
    case 'ADaM': return 'bg-[var(--accent-adam)]'
    case 'SDTM': return 'bg-[var(--accent-sdtm)]'
    case 'aCRF': return 'bg-[var(--accent-acrf)]'
    case 'TLF': return 'bg-[var(--accent-tlf)]'
    default: return 'bg-gray-500'
  }
}
```

This design ensures visual consistency with the existing sidebar grouping and makes the lineage flow intuitive to follow by color-coding the data flow between different CDISC standards.

---

### Navigation and state
- Extend `MainScreenClient` view state to include `'lineage'`
- Track `{ datasetId, datasetName, variableName }` on selection
- On Back, restore `'variables'` view with the same dataset
- Optional: sync `?dataset=ADSL&variable=SEX` in URL (no hard navigation)

---

### Consuming mocks like an API
- `analyzeLineage.ts` is the single consumer of lineage data
  - Today: resolves from `mockLineage` (no network)
  - Future: `fetch('/api/ai/analyze-variable')` with identical response shape; callers unchanged
- All UI components accept the typed `LineageGraph` and remain agnostic to source

---

### Update: variables mocks to include aCRF data

To show aCRF items in the left pane and enable future CRF-driven flows, extend `frontend/features/variables/mockSourceAgnostic.ts` so the `CRF` standard includes pseudo-datasets with variables captured on CRF.

Proposed minimal addition (example):
```ts
// In mockSourceAgnosticResponse.standards.CRF.datasetEntities
CRF_DEMO: {
  name: 'CRF_DEMO',
  label: 'CRF Demographics',
  type: 'crf_form',
  variables: [
    { name: 'SEX', label: 'Sex (CRF)', type: 'character', length: 1 },
  ],
  sourceFiles: [
    { fileId: 'acrf_v1.0.pdf', role: 'primary', extractedData: ['form_structure', 'field_definitions'] }
  ],
  metadata: { structure: 'CRF Form: Demographics', validationStatus: 'compliant' }
},
// Ensure CRF_AE exists (or add similarly if missing)
CRF_AE: {
  name: 'CRF_AE',
  label: 'CRF Adverse Events',
  type: 'crf_form',
  variables: [
    { name: 'AETERM', label: 'AE Term (CRF)', type: 'character', length: 200 },
  ],
  sourceFiles: [
    { fileId: 'acrf_v1.0.pdf', role: 'primary', extractedData: ['form_structure', 'field_definitions'] }
  ],
  metadata: { structure: 'CRF Form: Adverse Events', validationStatus: 'compliant' }
}
```

Notes:
- This keeps the left pane’s aCRF group non-empty and provides consistent dataset/variable shapes for the browser
- Names are prefixed to avoid collisions with SDTM/ADaM datasets
- These CRF variables are only for navigation/visibility; lineage still comes from `mockLineage`
- Data layer standard is `CRF`; UI group label is `aCRF` (handled in the migration/grouping logic)

---

### Testing
- Render lineage view for `ADSL.SEX` and `AE.AEBODSYS` with expected node/edge counts
- Back button restores variables view without losing dataset selection
- `jest-axe` scan on lineage view has no critical violations

---

### Acceptance criteria
- Selecting `ADSL` → `SEX` shows a 3-node lineage with summary and gaps list
- Selecting `AE` (SDTM) → `AEBODSYS` shows a 4-node lineage with summary and gaps list
- Back returns to the same dataset’s Variables Browser
- Switching to real API requires only changing the implementation of `analyzeLineage.ts`; UI components unchanged


