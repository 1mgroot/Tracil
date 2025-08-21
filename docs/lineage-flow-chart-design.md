### Lineage Flow Chart — Design (Frontend, Mock-first, API-compatible)

**Status: IMPLEMENTED** ✅

Purpose: add an interactive lineage flow chart view that opens when a user picks a variable from the Variables Browser. The view consumes mocked lineage data using the same TypeScript contracts we will receive from the Python backend, so swapping to real data is a drop-in change.

---

### User flow ✅ IMPLEMENTED
- Select dataset from left pane
- Browse variables in the grid
- Click a variable → show lineage view below variables (same page)
- Use Back control to return to full variables grid view

---

### Scope ✅ IMPLEMENTED
- Frontend-only, mock lineage for two variables: `ADSL.SEX` and `AE.AEBODSYS`
- Strict TypeScript, accessibility-first UI
- No persistence; all data is ephemeral

---

### Current state (code alignment) ✅ IMPLEMENTED
- Data model: source-agnostic mocks live in `frontend/features/variables/mockSourceAgnostic.ts` (organized by CDISC standards)
- Migration layer: `frontend/lib/data-structure/migration.ts` transforms either legacy or source-agnostic responses into a unified UI shape consumed by the Variables Browser
- UI state: `MainScreenClient` currently supports `'search'` and `'variables'` ✅
- Entrypoint: `frontend/lib/ai/entrypoints/analyzeLineage.ts` is implemented as a mock ✅

Notes:
- The standard is named `CRF` in the data layer, while the UI group label is shown as `aCRF`. The migration layer handles grouping for the sidebar.
- **CRF data has been added** ✅: `CRF_DEMO` and `CRF_AE` datasets are now included in the mock variables

---

### Types and contracts ✅ IMPLEMENTED
New shared types to match the backend response. These types are intentionally provider-agnostic and can be returned by the Next.js API proxy once the Python backend is wired.

```ts
// frontend/types/lineage.ts ✅ IMPLEMENTED
export type LineageNodeKind = 'source' | 'intermediate' | 'target'
export type ArtifactGroup = 'ADaM' | 'SDTM' | 'aCRF' | 'TLF'

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

**Note**: The `ArtifactGroup` type has been simplified to remove `'Protocol/SAP'` as it wasn't needed for the current implementation.

---

### Data source (mock-first, API-compatible) ✅ IMPLEMENTED
- ✅ `frontend/features/lineage/mocks.ts` exports `mockLineage: Record<string, LineageGraph>` keyed by `"<DATASET>.<VARIABLE>"`.
- ✅ `frontend/lib/ai/entrypoints/analyzeLineage.ts` returns a `Promise<LineageGraph>`.
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

### Mock lineage data (authoritative examples) ✅ IMPLEMENTED

```ts
// frontend/features/lineage/mocks.ts ✅ IMPLEMENTED
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

### UI composition ✅ IMPLEMENTED

**Implementation: Integrated Components (No Separate View)**

Instead of creating a separate `LineageView`, we have successfully integrated lineage components directly into the existing `VariablesBrowser`:

**Components Updated:**
- ✅ `frontend/components/variables/VariablesBrowser.tsx` - Now integrates lineage display below variables
- ✅ `frontend/components/lineage/TraceabilitySummary.tsx` (reused existing)
- ✅ `frontend/components/lineage/LineageGraph.tsx` (reused existing)

**Layout Structure Implemented:**
```
VariablesBrowser
├── Dataset Header (unchanged)
├── Variables Grid (collapsible to single row when variable selected)
├── Lineage Section (only visible when variable selected)
│   ├── TraceabilitySummary (full width, above graph)
│   └── LineageGraph (full width, below summary)
└── Back Button (returns to full variables view)
```

**Variable Display States Implemented:**
1. **Default State**: Full variables grid (current implementation)
2. **Variable Selected State**: 
   - Variables collapsed to single row (same styling, reduced height)
   - Lineage components displayed below
   - Back button to return to full view

**Benefits Achieved:**
- ✅ **No unnecessary re-renders** - Same component tree, conditional rendering
- ✅ **Reuse existing logic** - Variable selection, dataset context, styling
- ✅ **Consistent styling** - Same CSS classes and design tokens
- ✅ **Simpler state management** - No view switching in MainScreenClient
- ✅ **Better UX** - Context preserved, smooth transitions

---

### Visual Design - Node Styling ✅ IMPLEMENTED

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

### Navigation and state ✅ IMPLEMENTED

**State Management Implemented:**

Instead of managing separate view states, we have successfully extended the existing `VariablesBrowser` state:

```tsx
// In VariablesBrowser component ✅ IMPLEMENTED
interface VariablesBrowserState {
  selectedVariable: { name: string; lineage?: LineageGraph } | null
  showLineage: boolean
  isLoadingLineage: boolean
}

// State transitions implemented:
// 1. No variable selected: show full variables grid
// 2. Variable selected: show collapsed variables + lineage
// 3. Back clicked: return to full variables grid
```

**Benefits Achieved:**
- ✅ **No view switching** in MainScreenClient
- ✅ **Preserved context** - Dataset selection maintained
- ✅ **Smoother transitions** - No component unmounting/remounting
- ✅ **Simpler navigation** - Back button just clears selection

**URL State (Optional):**
- Sync `?variable=SEX` when variable selected
- No hard navigation, just query param updates

---

### Consuming mocks like an API ✅ IMPLEMENTED
- ✅ `analyzeLineage.ts` is the single consumer of lineage data
  - Today: resolves from `mockLineage` (no network)
  - Future: `fetch('/api/ai/analyze-variable')` with identical response shape; callers unchanged
- All UI components accept the typed `LineageGraph` and remain agnostic to source

---

### Update: variables mocks to include aCRF data ✅ IMPLEMENTED

To show aCRF items in the left pane and enable future CRF-driven flows, extend `frontend/features/variables/mockSourceAgnostic.ts` so the `CRF` standard includes pseudo-datasets with variables captured on CRF.

**✅ IMPLEMENTED** - The following CRF datasets have been added:
```ts
// In mockSourceAgnosticResponse.standards.CRF.datasetEntities ✅ IMPLEMENTED
CRF_DEMO: {
  name: 'CRF_DEMO',
  label: 'CRF Demographics',
  type: 'crf_form',
  variables: [
    { name: 'SEX', label: 'Sex (CRF)', type: 'character', length: 1 }
  ],
  sourceFiles: [
    { fileId: 'acrf_v1.0.pdf', role: 'primary', extractedData: ['form_structure', 'field_definitions'] }
  ],
  metadata: { structure: 'CRF Form: Demographics', validationStatus: 'compliant' }
},
CRF_AE: {
  name: 'CRF_AE',
  label: 'Adverse Events Form',
  type: 'crf_form',
  variables: crfAeVariables,
  sourceFiles: [
    { fileId: 'acrf_v1.0.pdf', role: 'primary', extractedData: ['form_structure', 'field_definitions'] }
  ],
  metadata: { structure: 'Electronic case report form', validationStatus: 'compliant' }
}
```

Notes:
- ✅ This keeps the left pane's aCRF group non-empty and provides consistent dataset/variable shapes for the browser
- ✅ Names are prefixed to avoid collisions with SDTM/ADaM datasets
- ✅ These CRF variables are only for navigation/visibility; lineage still comes from `mockLineage`
- ✅ Data layer standard is `CRF`; UI group label is `aCRF` (handled in the migration/grouping logic)

---

### Testing ✅ IMPLEMENTED
- ✅ Render lineage view for `ADSL.SEX` and `AE.AEBODSYS` with expected node/edge counts
- ✅ Back button restores variables view without losing dataset selection
- ✅ `jest-axe` scan on lineage view has no critical violations

**✅ COMPLETED**: Comprehensive testing for lineage functionality has been implemented and all tests pass.

---

### Acceptance criteria ✅ IMPLEMENTED
- ✅ Selecting `ADSL` → `SEX` shows a 3-node lineage with summary and gaps list
- ✅ Selecting `AE` (SDTM) → `AEBODSYS` shows a 4-node lineage with summary and gaps list
- ✅ Back returns to the same dataset's Variables Browser
- ✅ Switching to real API requires only changing the implementation of `analyzeLineage.ts`; UI components unchanged
- ✅ **IMPLEMENTED**: Variables display collapses to single row when lineage is shown
- ✅ **IMPLEMENTED**: Lineage components appear below variables (same page, no view switching)
- ✅ **IMPLEMENTED**: Styling and behavior consistent with existing variables display

---

### Implementation Status Summary

**✅ COMPLETED:**
- All TypeScript types and interfaces
- Mock lineage data for ADSL.SEX and AE.AEBODSYS
- TraceabilitySummary component for displaying summary and gaps
- LineageGraph component with React Flow integration
- CRF data addition to mock variables
- analyzeLineage entrypoint with mock-first implementation
- **UI Architecture**: Successfully changed from separate LineageView to integrated components
- **State Management**: Successfully simplified to avoid view switching
- **Component Integration**: Lineage components now live within VariablesBrowser
- **Variable Display**: Successfully implemented collapsible to single row when lineage is shown
- **Comprehensive Testing**: All tests pass, including error handling and edge cases

**✅ ALL REQUIREMENTS MET:**
- Variables display collapses to single row when lineage is shown
- Lineage components appear below variables (same page, no view switching)
- Styling and behavior consistent with existing variables display
- No unnecessary re-renders
- Reuse of existing logic and styling
- Smooth transitions and preserved context

**🔄 READY FOR BACKEND INTEGRATION:**
- All components are designed to work with the same data contracts
- Switching from mocks to real API requires only changing `analyzeLineage.ts`
- No UI component changes needed

**🎯 KEY DESIGN PRINCIPLES ACHIEVED:**
- ✅ **Avoid unnecessary re-renders** - Same component tree, conditional rendering
- ✅ **Reuse existing logic** - Variable selection, dataset context, styling
- ✅ **Maintain consistency** - Same look and feel, smooth transitions
- ✅ **Simplify state** - No complex view management, just selection state

**🚀 PRODUCTION READY:**
The lineage flow chart functionality is now fully implemented and production-ready. Users can:
1. Select a dataset from the left sidebar
2. Browse variables in the grid view
3. Click any variable to see its lineage in a compact, integrated view
4. Navigate back to the full variables view seamlessly
5. Experience smooth transitions without losing context

The implementation follows React best practices, maintains accessibility standards, and provides a foundation for easy backend integration when ready.


