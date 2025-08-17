### Variables Browser UI — Design & Implementation Plan (2025 Standards)

This document specifies the design, data structures, and implementation plan for the Variables Browser feature. This task builds upon the existing main screen foundation to display variable-level information when a dataset is selected from the left sidebar.

---

## 1) Goals & Requirements (2025 Standards)

**Primary Objectives:**
- **Dataset-Driven Variables Display**: When a user clicks on a dataset (e.g., "ADSL", "LB") in the left sidebar, show all variables within that dataset in the main content area
- **Modern React Patterns**: Named imports, ReactNode return types, proper memoization, error boundaries
- **Accessibility-First**: WCAG 2.2 AA compliant with full keyboard navigation, ARIA patterns, and screen reader support
- **Performance Optimized**: React.memo, useMemo, useCallback for efficient rendering
- **Rich Variable Information**: Display variable name, label, type, role, and other metadata in a clean, scannable format
- **Mock Data Foundation**: Comprehensive mock data structure that matches the API contract defined in DESIGN.md

**Non-Goals (This Phase):**
- No search or filtering functionality (future phase)
- No lineage visualization (future phase)
- No real API integration (mock data only)
- No variable editing or modification

---

## 2) User Experience Flow

**Current State → Target State:**
1. **Current**: User sees main screen with left sidebar (datasets) and centered search prompt
2. **Target**: When user clicks a dataset (e.g., "ADSL"), the main content area transforms to show:
   - Header with dataset name and summary information
   - Grid of variable cards (small gray boxes) displaying variable names
   - Each card shows the variable name prominently
3. **Variable Interaction**: When user hovers over a variable card:
   - Card highlights with subtle animation
   - Tooltip/popover appears showing rich metadata (label, type, role, etc.)
   - Tooltip positioned to avoid viewport edges

**Interaction States:**
- **No Selection**: Show search prompt (current behavior)
- **Dataset Selected**: Show variables browser with card grid layout
- **Variable Hover**: Show detailed tooltip with comprehensive variable metadata
- **Variable Focus**: Keyboard-accessible focus states with same tooltip behavior

---

## 3) Data Architecture & Mock Data Design

### 3.1) API Contract Alignment & Python Integration Strategy

**Python Backend API Response Structure:**
Based on DESIGN.md section 5, the Python backend will return structured data that our frontend mock data must exactly match:

```typescript
// Python API Response Structure (from DESIGN.md)
// POST /process-files endpoint response
{
  "files": [
    {
      "filename": "define.xml",
      "type": "adam_metadata", 
      "datasets": [
        {
          "name": "ADSL",
          "label": "Subject-Level Analysis Dataset",
          "variables": [
            {
              "name": "USUBJID",
              "label": "Unique Subject Identifier",
              "type": "character", 
              "length": 20,
              "role": "identifier",
              "mandatory": true
            },
            {
              "name": "AGE", 
              "label": "Age at Baseline",
              "type": "numeric",
              "role": "covariate",
              "format": "3."
            }
          ],
          "metadata": {
            "records": 100,
            "structure": "One record per subject"
          }
        }
      ]
    }
  ]
}
```

**Mock Data Strategy for API Integration:**
- Mock data structure **exactly mirrors** Python API response
- Use same property names, types, and nesting
- Include all optional fields that Python backend may provide
- Implement data transformation utilities that work with both mock and real data
- Ensure type definitions are compatible with both sources

### 3.2) Enhanced Type Definitions (Python API Compatible)

**Types Matching Python Backend Response:**
```typescript
// Variable-level types (matches Python API exactly)
export type VariableType = 'character' | 'numeric' | 'date' | 'datetime' | 'time'
export type VariableRole = 'identifier' | 'topic' | 'qualifier' | 'timing' | 'covariate' | 'record_qualifier'

export interface Variable {
  readonly name: string                  // Variable name (e.g., "USUBJID") - PRIMARY KEY
  readonly label: string                 // Human-readable label
  readonly type: VariableType           // Data type
  readonly role?: VariableRole          // CDISC role
  readonly length?: number              // Character length or numeric precision
  readonly format?: string              // Display format (e.g., "DATE9.", "$20.")
  readonly mandatory?: boolean          // Required variable flag
  readonly codelist?: string           // Reference to controlled terminology

  readonly comment?: string            // Additional comments
}

// Dataset-level types (matches Python API exactly)
export interface Dataset {
  readonly name: string                 // Dataset name (e.g., "ADSL") - PRIMARY KEY
  readonly label?: string              // Dataset description
  readonly variables: readonly Variable[] // All variables in this dataset
  readonly metadata?: {
    readonly records?: number
    readonly structure?: string         // e.g., "one record per subject"
    readonly version?: string
    readonly lastModified?: string
  }
}

// File structure (matches Python API exactly)
export interface ProcessedFile {
  readonly filename: string             // File name - PRIMARY KEY
  readonly type: 'adam_metadata' | 'sdtm_metadata' | 'acrf_document' | 'tlf_document'
  readonly datasets: readonly Dataset[]
}

// API Response wrapper (matches Python API exactly)
export interface ProcessFilesResponse {
  readonly files: readonly ProcessedFile[]
}

// Frontend-specific extensions (for UI state management)
export interface DatasetWithGroup extends Dataset {
  readonly id: string                   // Generated from filename + dataset name
  readonly group: FileGroupKind        // Derived from file type
  readonly fileId: string              // Reference to source file
}
```

### 3.3) Mock Data Strategy & API Integration Plan

**Mock Data Structure (Matches Python API Exactly):**
```typescript
// Mock data that mirrors Python backend response
export const mockProcessFilesResponse: ProcessFilesResponse = {
  files: [
    {
      filename: "define_adam.xml",
      type: "adam_metadata",
      datasets: [
        {
          name: "ADSL",
          label: "Subject-Level Analysis Dataset", 
          variables: [
            {
              name: "USUBJID",
              label: "Unique Subject Identifier",
              type: "character",
              length: 20,
              role: "identifier",
              mandatory: true
            },
            // ... more variables
          ],
          metadata: {
            records: 100,
            structure: "One record per subject"
          }
        }
      ]
    },
    {
      filename: "define_sdtm.xml", 
      type: "sdtm_metadata",
      datasets: [
        // SDTM datasets...
      ]
    }
  ]
}
```

**API Integration Utilities:**
```typescript
// Data transformation utilities (work with both mock and real data)
export function transformApiResponseToUI(response: ProcessFilesResponse): DatasetWithGroup[] {
  return response.files.flatMap(file => 
    file.datasets.map(dataset => ({
      ...dataset,
      id: `${file.filename}-${dataset.name}`,
      group: deriveGroupFromFileType(file.type),
      fileId: file.filename
    }))
  )
}

export function deriveGroupFromFileType(type: ProcessedFile['type']): FileGroupKind {
  switch (type) {
    case 'adam_metadata': return 'ADaM'
    case 'sdtm_metadata': return 'SDTM' 
    case 'acrf_document': return 'aCRF'
    case 'tlf_document': return 'TLF'
  }
}
```

**Dataset Coverage:**
- **ADSL**: ~18 variables (demographics, baseline, disposition)
- **ADAE**: ~28 variables (adverse events analysis)
- **ADLB**: ~25 variables (laboratory analysis) 
- **DM**: ~15 variables (demographics SDTM)
- **LB**: ~20 variables (laboratory SDTM)
- **AE**: ~22 variables (adverse events SDTM)
- **VS**: ~18 variables (vital signs SDTM)

---

## 4) UI Components & Layout Design

### 4.1) Variables Card Grid Layout

**Visual Design (Matching Mockup):**
```
┌─────────────────────────────────────────────────────────────┐
│ Dataset Header                                              │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ADSL - Subject-Level Analysis Dataset                   │ │
│ │ 100 records • 18 variables • Last updated: 2024-01-15  │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Variables Grid (Card Layout)                                │
│ ┌─────────┬─────────┬─────────┬─────────┬─────────┬───────┐ │
│ │ USUBJID │ SUBJID  │   AGE   │ AGEGR1  │   SEX   │ RACE  │ │
│ └─────────┴─────────┴─────────┴─────────┴─────────┴───────┘ │
│ ┌─────────┬─────────┬─────────┬─────────┬─────────┬───────┐ │
│ │ ETHNIC  │   ARM   │ ACTARM  │ COUNTRY │ SITEID  │ ...   │ │
│ └─────────┴─────────┴─────────┴─────────┴─────────┴───────┘ │
│                                                             │
│ [Hover State: Tooltip with variable details]               │
└─────────────────────────────────────────────────────────────┘
```

**Card Design Specifications:**
- **Size**: ~120px width × 60px height (responsive)
- **Appearance**: Subtle gray background (`--surface-muted`), rounded corners (8px)
- **Typography**: Variable name centered, medium font weight
- **Grid**: Auto-fit layout with consistent gaps
- **Hover State**: Subtle elevation, background lightens, tooltip appears
- **Focus State**: Visible focus ring for keyboard navigation

**Responsive Grid Behavior:**
- **Desktop (≥1280px)**: 6-8 cards per row, generous spacing
- **Tablet (768-1279px)**: 4-6 cards per row, moderate spacing  
- **Mobile (<768px)**: 2-3 cards per row, compact spacing



### 4.2) Component Architecture

**New Components to Create:**
```typescript
// Main container for variables view
export function VariablesBrowser({ dataset }: { dataset: DatasetWithGroup }): ReactNode

// Dataset summary header
export function DatasetHeader({ dataset }: { dataset: DatasetWithGroup }): ReactNode

// Variables grid container
export function VariablesGrid({ variables }: { variables: readonly Variable[] }): ReactNode

// Individual variable card (gray box)
export function VariableCard({ 
  variable, 
  onHover, 
  onFocus 
}: { 
  variable: Variable
  onHover?: (variable: Variable, event: MouseEvent) => void
  onFocus?: (variable: Variable, event: FocusEvent) => void
}): ReactNode

// Variable detail tooltip/popover
export function VariableTooltip({ 
  variable, 
  isVisible,
  position,
  onClose
}: { 
  variable: Variable
  isVisible: boolean
  position: { x: number; y: number }
  onClose: () => void
}): ReactNode
```

**Component Placement:**
- `components/variables/` - New directory for variable-related UI components
- `features/variables/` - Enhanced with mock data and business logic
- Update `app/(workspace)/_components/MainScreenClient.tsx` to handle state switching

### 4.3) Hover Interaction & Tooltip Design

**Tooltip Content Structure:**
```
┌─────────────────────────────────────────┐
│ Variable Details                        │
├─────────────────────────────────────────┤
│ Name: USUBJID                          │
│ Label: Unique Subject Identifier        │
│ Type: character (Length: 20)           │
│ Role: identifier                        │
│ Mandatory: Yes                          │
└─────────────────────────────────────────┘
```

**Tooltip Behavior:**
- **Trigger**: Mouse hover or keyboard focus on variable card
- **Delay**: 300ms delay before showing, 100ms before hiding
- **Positioning**: Smart positioning to avoid viewport edges
- **Animation**: Subtle fade-in/out with scale animation
- **Accessibility**: Announced to screen readers, dismissible with Escape

**CSS Grid Implementation:**
```css
.variables-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 12px;
  padding: 16px;
}

.variable-card {
  aspect-ratio: 2 / 1;
  background: var(--surface-muted);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 500;
  transition: all 0.2s ease;
  cursor: pointer;
}

.variable-card:hover {
  background: var(--surface-hover);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}
```

---

## 5) State Management & Integration

### 5.1) State Architecture

**Current State (MainScreenClient.tsx):**
```typescript
const [selectedId, setSelectedId] = useState<string | null>(null)
```

**Enhanced State:**
```typescript
type ViewState = 'search' | 'variables'
type SelectedItem = { type: 'dataset'; datasetId: string } | null

const [selectedItem, setSelectedItem] = useState<SelectedItem>(null)
const [viewState, setViewState] = useState<ViewState>('search')

```

### 5.2) Data Flow

**Selection Flow:**
1. User clicks dataset in sidebar → `setSelectedItem({ type: 'dataset', datasetId: 'adsl-001' })`
2. Component re-renders → `currentViewState` becomes 'variables'
3. Main content switches from SearchBar to VariablesBrowser
4. VariablesBrowser receives `selectedDataset` and renders variables

**Navigation Flow:**
- **Back to Search**: Click logo, press Escape, or click "Back to Search" button
- **Dataset Switching**: Click different dataset → immediate switch to new variables
- **Keyboard Navigation**: Tab through variables, Enter to select/expand

---

## 6) Accessibility Implementation (WCAG 2.2 AA)

### 6.1) Semantic Structure

**HTML Semantics:**
```html
<main role="main" aria-label="Variables Browser">
  <header role="banner">
    <h1>Dataset Name</h1>
    <p>Dataset summary information</p>
  </header>
  
  <section role="region" aria-labelledby="variables-heading">
    <h2 id="variables-heading">Variables</h2>
    <table role="table" aria-label="Dataset variables">
      <thead>
        <tr role="row">
          <th role="columnheader">Variable</th>
          <th role="columnheader">Label</th>
          <th role="columnheader">Type</th>
          <th role="columnheader">Role</th>
        </tr>
      </thead>
      <tbody>
        <tr role="row" tabindex="0">
          <td role="cell">USUBJID</td>
          <td role="cell">Unique Subject Identifier</td>
          <td role="cell">character</td>
          <td role="cell">identifier</td>
        </tr>
      </tbody>
    </table>
  </section>
</main>
```

### 6.2) Keyboard Navigation

**Navigation Patterns:**
- **Tab**: Move between interactive elements (Back button, table rows, etc.)
- **Arrow Keys**: Navigate within table (up/down for rows, left/right for cells)
- **Enter/Space**: Activate focused element
- **Escape**: Return to search view
- **Home/End**: Jump to first/last variable in table

**Focus Management:**
- **On Dataset Selection**: Focus moves to dataset header
- **On Return to Search**: Focus returns to search input
- **Within Table**: Roving tabindex pattern for efficient navigation

### 6.3) Screen Reader Support

**ARIA Attributes:**
- `aria-label` for complex elements
- `aria-describedby` for additional context
- `aria-expanded` for collapsible sections
- `aria-sort` for sortable columns (future enhancement)
- `aria-selected` for selected variables (future enhancement)

**Live Regions:**
- Announce dataset changes: `aria-live="polite"`
- Status updates: `aria-live="assertive"` for errors

---

## 7) Performance Considerations

### 7.1) Optimization Strategies

**React Performance:**
```typescript
// Memoized components
export const VariableRow = memo(function VariableRow({ variable }: { variable: Variable }) {
  // Component implementation
})

// Memoized data transformations
const sortedVariables = useMemo(() => 
  variables.sort((a, b) => a.name.localeCompare(b.name)), 
  [variables]
)

// Optimized event handlers
const handleVariableSelect = useCallback((variableId: string) => {
  // Handle selection
}, [])
```

**Large Dataset Handling:**
- **Virtual Scrolling**: For datasets with >100 variables, implement virtualization
- **Progressive Loading**: Load variable details on-demand
- **Search/Filter Preparation**: Structure data for future search implementation

### 7.2) Bundle Size

**Code Splitting:**
- Lazy load VariablesBrowser component
- Dynamic imports for large datasets
- Tree-shake unused mock data in production

---

## 8) File Structure & Implementation Plan

### 8.1) New Files to Create

```
frontend/
├── components/
│   └── variables/                    # New directory
│       ├── VariablesBrowser.tsx      # Main container
│       ├── DatasetHeader.tsx         # Dataset summary
│       ├── VariablesGrid.tsx         # Variables grid container
│       ├── VariableCard.tsx          # Individual variable card (gray box)
│       ├── VariableTooltip.tsx       # Hover tooltip component
│       └── index.ts                  # Barrel exports
├── features/
│   └── variables/                    # Enhanced directory
│       ├── mocks.ts                  # Python API-compatible mock data
│       ├── transforms.ts             # API response transformation utilities
│       └── types.ts                  # Variable-specific types
├── types/
│   └── variables.ts                  # Python API-compatible core types
└── hooks/
    ├── useVariablesBrowser.ts        # State management for variables view
    └── useVariableTooltip.ts         # Tooltip positioning and behavior
```

### 8.2) Files to Modify

```
frontend/
├── app/(workspace)/_components/
│   └── MainScreenClient.tsx          # Add conditional rendering for variables view
├── types/
│   └── files.ts                      # Extend with DatasetWithGroup interface
├── features/datasets/
│   └── mocks.ts                      # Update to use new API-compatible structure
└── app/globals.css                   # Add tooltip and hover state variables
```

### 8.3) API Integration Strategy

**Development Phases:**
1. **Phase 1 (Current)**: Use `mockProcessFilesResponse` directly in components
2. **Phase 2 (Future)**: Replace mock with actual API calls
3. **Phase 3 (Future)**: Add caching and error handling

**API Client Pattern:**
```typescript
// lib/api/variables.ts
export async function fetchProcessedFiles(): Promise<ProcessFilesResponse> {
  if (process.env.NODE_ENV === 'development') {
    // Return mock data during development
    return mockProcessFilesResponse
  }
  
  // Production: Call Next.js API route that proxies to Python backend
  const response = await fetch('/api/ai/process-files', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ files: uploadedFiles })
  })
  
  return response.json()
}
```

**Component Integration:**
```typescript
// No component changes needed when switching from mock to real API
const response = await fetchProcessedFiles()
const datasets = transformApiResponseToUI(response)
// Component renders exactly the same way
```

---

## 9) Implementation Phases

### Phase 1: Data Foundation ✅ (This Task)
- [x] Create comprehensive variable type definitions
- [x] Build realistic mock data for all datasets
- [x] Design proper data relationships between files and variables
- [x] Ensure type safety and readonly patterns

### Phase 2: Core UI Components ✅ (This Task)  
- [x] Build VariablesBrowser component with proper React patterns
- [x] Create DatasetHeader with summary information
- [x] Implement VariablesGrid with accessibility features (enhanced from table to card grid)
- [x] Add VariableCard with proper keyboard navigation (enhanced from row to card)

### Phase 3: Integration & State Management ✅ (This Task)
- [x] Update MainScreenClient with conditional rendering
- [x] Implement proper state management for dataset selection
- [x] Add navigation between search and variables views
- [x] Ensure focus management and keyboard shortcuts

### Phase 4: Polish & Accessibility ✅ (This Task)
- [x] Complete WCAG 2.2 AA compliance testing
- [x] Add comprehensive keyboard navigation
- [x] Implement proper ARIA attributes and screen reader support
- [x] Performance optimization with React.memo and useMemo

### Future Phases (Not This Task):
- **Phase 5**: Search and filtering functionality
- **Phase 6**: Variable detail modals and enhanced metadata display
- **Phase 7**: Lineage integration and visualization
- **Phase 8**: Real API integration

---

## 10) Mock Data Specifications

### 10.1) Dataset Coverage

**ADSL (Subject-Level Analysis Dataset):**
- **Purpose**: One record per subject with baseline characteristics
- **Variables**: ~18 variables including demographics, baseline measurements, disposition
- **Key Variables**: USUBJID, SUBJID, AGE, AGEGR1, SEX, RACE, ETHNIC, ARM, ACTARM, etc.

**ADAE (Adverse Events Analysis Dataset):**
- **Purpose**: One record per adverse event occurrence
- **Variables**: ~28 variables covering event details, severity, causality
- **Key Variables**: USUBJID, AESEQ, AEDECOD, AEBODSYS, AESEV, AEREL, AESTDTC, etc.


**DM (Demographics SDTM Domain):**
- **Purpose**: One record per subject with core demographics
- **Variables**: ~15 variables with basic subject information
- **Key Variables**: USUBJID, SUBJID, RFSTDTC, RFENDTC, SITEID, AGE, AGEU, SEX, RACE


**AE (Adverse Events SDTM Domain):**
- **Purpose**: One record per adverse event as collected
- **Variables**: ~22 variables with raw adverse event data
- **Key Variables**: USUBJID, AESEQ, AETERM, AEDECOD, AEBODSYS, AESEV, AEREL, AESTDTC

### 10.2) Variable Realism Standards

**Naming Conventions:**
- Follow CDISC standards for variable names
- Use actual CDISC variable labels where possible
- Include standard suffixes (DTC, DT, TM, CD, etc.)

**Data Types Distribution:**
- ~40% character variables
- ~35% numeric variables  
- ~15% date/datetime variables
- ~10% other types (time, etc.)

**Role Distribution:**
- ~20% identifier variables
- ~30% topic variables
- ~25% qualifier variables
- ~15% timing variables
- ~10% other roles

**Metadata Completeness:**
- 100% have name, label, type
- ~80% have role specified
- ~60% have length specified
- ~40% have format specified
- ~10% have comments

---

## 11) Testing Strategy

### 11.1) Unit Testing

**Component Tests:**
```typescript
describe('VariablesBrowser', () => {
  it('renders dataset header with correct information')
  it('displays all variables in sortable table')
  it('handles empty variable list gracefully')
  it('supports keyboard navigation between rows')
})

describe('VariableRow', () => {
  it('displays all variable metadata correctly')
  it('handles missing optional fields')
  it('supports focus and hover states')
  it('announces changes to screen readers')
})
```

**Accessibility Tests:**
```typescript
describe('VariablesBrowser Accessibility', () => {
  it('has proper ARIA labels and roles')
  it('supports full keyboard navigation')
  it('announces dataset changes to screen readers')
  it('maintains focus management correctly')
  it('meets WCAG 2.2 AA contrast requirements')
})
```

### 11.2) Integration Testing

**State Management:**
- Dataset selection triggers correct view change
- Navigation between search and variables works
- Back button returns to correct state

**Performance:**
- Large datasets render efficiently
- Memoization prevents unnecessary re-renders
- Virtual scrolling works for 100+ variables

---

## 12) Success Criteria

### 12.1) Functional Requirements ✅
- [x] User can click any dataset in left sidebar
- [x] Variables browser displays with dataset header and variable grid (enhanced from table)
- [x] All mock variables display with proper metadata (name, label, type, role)
- [x] User can navigate back to search view
- [x] Keyboard navigation works throughout the interface

### 12.2) Technical Requirements ✅
- [x] Modern React patterns (named imports, ReactNode, memoization)
- [x] TypeScript strict mode with comprehensive types
- [x] WCAG 2.2 AA accessibility compliance
- [x] Error boundaries for graceful error handling
- [x] Performance optimization with React.memo/useMemo/useCallback

### 12.3) Data Requirements ✅
- [x] Comprehensive mock data for all major datasets
- [x] Realistic variable names, labels, and metadata
- [x] Proper type definitions matching API contract
- [x] Extensible structure for future enhancements

### 12.4) User Experience Requirements ✅
- [x] Smooth transitions between search and variables views
- [x] Intuitive navigation and clear visual hierarchy
- [x] Responsive design works on all screen sizes
- [x] Loading states and error handling (where applicable)

---

## 13) Future Enhancements (Not This Task)

**Search & Filtering:**
- Global variable search across all datasets
- Filter by variable type, role, or metadata
- Advanced search with regex support

**Variable Details:**
- Expandable rows with full metadata
- Modal/drawer for complete variable information
- Enhanced metadata display and editing

**Lineage Integration:**
- Click variable to show lineage graph
- Upstream/downstream relationship visualization
- Gap detection and highlighting

**Performance Enhancements:**
- Virtual scrolling for very large datasets
- Lazy loading of variable metadata
- Search indexing for instant results

---

## 14) Dependencies & Constraints

### 14.1) Technical Dependencies
- Existing sidebar implementation (no changes required)
- Current type system in `types/files.ts` (extend, don't replace)
- shadcn/ui components for consistent styling
- Current accessibility infrastructure

### 14.2) Design Constraints
- Must maintain 260px fixed sidebar width on md+
- Must follow existing color system and OKLCH tokens
- Must preserve current keyboard navigation patterns
- Must maintain existing focus management

### 14.3) Data Constraints
- Mock data only (no API integration)
- Must match API contract defined in DESIGN.md
- Must be extensible for future real data integration
- Must handle edge cases (empty datasets, missing metadata)

---

## 15) Risk Mitigation

**Performance Risks:**
- **Large Datasets**: Implement virtual scrolling from start if >50 variables
- **Memory Usage**: Use readonly types and proper garbage collection
- **Render Performance**: Comprehensive memoization strategy

**Accessibility Risks:**
- **Complex Tables**: Use proper ARIA table patterns
- **Focus Management**: Test with actual screen readers
- **Keyboard Navigation**: Implement roving tabindex correctly

**Data Risks:**
- **Type Safety**: Comprehensive TypeScript coverage
- **Mock Data Quality**: Use realistic CDISC examples
- **API Contract**: Ensure mock data matches expected API structure

**Integration Risks:**
- **State Conflicts**: Careful state management design
- **Component Coupling**: Keep components loosely coupled
- **Backward Compatibility**: Don't break existing functionality

---

This specification provides a comprehensive foundation for implementing the Variables Browser feature while maintaining the high standards established in the existing codebase and following 2025 React development best practices.
