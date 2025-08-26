# Type Normalization System for Lineage Analysis

## Overview

The `analyze-variable` API from the Python backend returns nodes with `type` fields that can be inconsistent and varied. Our type normalization system standardizes these backend types into consistent CDISC categories for the frontend lineage graph.

## Problem Statement

Backend API responses contain node types like:
- `"TLF Display"` 
- `"ADaM Dataset"`
- `"ADaM Variable"`
- `"Protocol"`
- `"target"`

These need to be normalized to standardized categories for consistent UI rendering.

## Solution Architecture

### 1. **Location**: `frontend/lib/ai/entrypoints/analyzeLineage.ts`

**Why this location?**
- **Single Responsibility**: All lineage transformation logic is centralized here
- **Data Flow**: API response → Transform → UI components
- **Maintainability**: One place to update type normalization rules
- **Performance**: Transform once, use everywhere
- **Best Practice**: Follows "transform at the boundary" principle

### 2. **Type Categories**

```typescript
type NormalizedType = "ADaM" | "SDTM" | "CRF" | "TLF" | "Protocol" | "Unknown" | "target"
```

**Note**: We now include `"target"` as a distinct type to properly handle target nodes from the backend.

### 3. **Normalization Logic**

Uses **"contains" logic** for flexible matching:

```typescript
function normalizeNodeType(backendType: string): NormalizedType {
  const typeLower = backendType.toLowerCase()
  
  // Check for target type first
  if (typeLower === 'target') {
    return "target"
  }
  
  // ADaM: contains "adam", "analysis", "analysis dataset"
  if (typeLower.includes('adam') || typeLower.includes('analysis')) {
    return "ADaM"
  }
  
  // SDTM: contains "sdtm", "standard"
  if (typeLower.includes('sdtm') || typeLower.includes('standard')) {
    return "SDTM"
  }
  
  // CRF: contains "crf", "case report", "form"
  if (typeLower.includes('crf') || typeLower.includes('case report')) {
    return "CRF"
  }
  
  // TLF: contains "tlf", "table", "figure", "display", "listing"
  if (typeLower.includes('tlf') || typeLower.includes('table') || 
      typeLower.includes('figure') || typeLower.includes('display')) {
    return "TLF"
  }
  
  // Protocol: contains "protocol", "sap", "study plan"
  if (typeLower.includes('protocol') || typeLower.includes('sap')) {
    return "Protocol"
  }
  
  return "Unknown"
}
```

## Example Transformations

| Backend Type | Normalized Type | Logic |
|--------------|-----------------|-------|
| `"TLF Display"` | `"TLF"` | Contains "display" |
| `"ADaM Dataset"` | `"ADaM"` | Contains "adam" |
| `"ADaM Variable"` | `"ADaM"` | Contains "adam" |
| `"Protocol"` | `"Protocol"` | Exact match |
| `"target"` | `"target"` | Exact match for target nodes |

## Context-Aware Inference

For `"Unknown"` types, we attempt to infer the category:

```typescript
case 'Unknown':
  if (nodeType.toLowerCase().includes('variable')) {
    group = 'ADaM' // Variables are typically ADaM
  } else if (nodeType.toLowerCase().includes('dataset')) {
    group = 'ADaM' // Datasets are typically ADaM
  } else {
    group = 'Unknown' // Keep as unknown if we can't infer
  }
```

## Target Node Handling

Target nodes (`"target"`) are now properly recognized and handled:

```typescript
case 'target':
  group = 'ADaM' // Target nodes are typically ADaM
  break
```

## Visual Kind Determination

Based on group, determine visual positioning:

```typescript
// Determine kind based on group - Protocol and CRF are sources, others are intermediate
let kind: 'source' | 'intermediate' | 'target' = 'intermediate'
if (group === 'Protocol' || group === 'aCRF') {
  kind = 'source'
} else if (group === 'Unknown') {
  kind = 'target'
}
```

## Benefits

1. **Consistency**: All lineage graphs use standardized categories
2. **Flexibility**: Handles backend type variations gracefully
3. **Maintainability**: Centralized logic, easy to update
4. **Debugging**: Comprehensive logging for troubleshooting
5. **Extensibility**: Easy to add new type patterns
6. **Target Recognition**: Proper handling of target nodes

## Usage in Components

The normalized types flow through to UI components:

```typescript
// In LineageView.tsx
const lineage = await analyzeLineage({ dataset, variable })
// lineage.nodes[].group is now consistently normalized
```

## Future Enhancements

1. **Machine Learning**: Could use ML to improve type inference
2. **Configuration**: Make normalization rules configurable
3. **Validation**: Add validation for edge cases
4. **Metrics**: Track normalization success rates

## Testing

The system has been tested with real backend responses and handles:
- ✅ Exact matches (`"Protocol"`, `"target"`)
- ✅ Partial matches (`"TLF Display"`)
- ✅ Case variations (`"adam dataset"`)
- ✅ Unknown types (unrecognized patterns)
- ✅ Context inference (`"ADaM Variable"`)

## Error Handling

- **Graceful Degradation**: Unknown types default to "Unknown" category
- **Logging**: Comprehensive debug logging for troubleshooting
- **Fallbacks**: Context-aware inference when possible
- **Validation**: Ensures all nodes have valid group assignments
- **Target Recognition**: Target nodes are properly categorized and styled
