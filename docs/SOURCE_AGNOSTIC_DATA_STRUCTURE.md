# Source-Agnostic Data Structure Design

## Overview

Refactor from the previous file-centric approach to a CDISC-standard-centric approach that supports multiple source types (define.xml, spec sheets, raw datasets, aCRF, TLF documents). This refactoring has been completed.

## Current Problem

The previous structure in the legacy mock files assumed:
- Define.xml presence for ADaM/SDTM
- File-first organization
- Limited flexibility for mixed source scenarios

## Design Goals

1. **CDISC-First Structure**: Organize by CDISC standards rather than source files
2. **Source Flexibility**: Support any combination of source file types
3. **Unified Interface**: Consistent API regardless of data source
4. **Backward Compatibility**: Minimize breaking changes to consuming components
5. **Extensibility**: Easy to add new standards or source types

## New Data Structure

### Top-Level Organization

```typescript
interface ProcessFilesResponse {
  standards: {
    [standardType in StandardType]: StandardDefinition
  }
  metadata: {
    processedAt: string
    totalVariables: number
    sourceFiles: SourceFile[]
  }
}

type StandardType = "ADaM" | "SDTM" | "CRF" | "TLF"
```

### Standard Definition

```typescript
interface StandardDefinition {
  type: StandardType
  label: string
  datasetEntities: {
    [entityKey: string]: DatasetEntity
  }
  metadata: {
    version?: string
    lastModified?: string
    totalEntities: number
  }
}
```

### Dataset Entity (CDISC Concepts)

```typescript
interface DatasetEntity {
  name: string           // LB, ADSL, CRF_AE, T-14-3-01
  label: string          // Human-readable description
  type: EntityType       // Maps to CDISC concept
  variables: Variable[]
  sourceFiles: SourceFileReference[]
  metadata: EntityMetadata
}

type EntityType = 
  | "domain"           // SDTM domains
  | "analysis_dataset" // ADaM datasets
  | "crf_form"         // CRF forms
  | "tlf_item"         // Tables/Listings/Figures

interface EntityMetadata {
  records?: number
  structure?: string
  version?: string
  lastModified?: string
  validationStatus?: ValidationStatus
}
```

### Source File Management

```typescript
interface SourceFile {
  id: string
  filename: string
  type: SourceFileType
  uploadedAt: string
  sizeKB: number
  processingStatus: ProcessingStatus
}

type SourceFileType = 
  | "define_xml"
  | "dataset_xpt" 
  | "dataset_sas7bdat"
  | "spec_xlsx"
  | "acrf_pdf"
  | "tlf_rtf"
  | "tlf_pdf"

interface SourceFileReference {
  fileId: string
  role: FileRole        // primary, supplementary, validation
  extractedData: string[] // What was extracted from this file
}
```

## Example JSON Structure

```json
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
          "variables": [...],
          "sourceFiles": [
            {
              "fileId": "define_sdtm_001",
              "role": "primary",
              "extractedData": ["metadata", "variables", "codelists"]
            },
            {
              "fileId": "dm_dataset_001", 
              "role": "supplementary",
              "extractedData": ["data_validation", "actual_values"]
            }
          ],
          "metadata": {
            "records": 100,
            "structure": "One record per subject",
            "validationStatus": "compliant"
          }
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
          "sourceFiles": [
            {
              "fileId": "define_adam_001",
              "role": "primary", 
              "extractedData": ["metadata", "variables"]
            }
          ]
        }
      }
    },
    "CRF": {
      "type": "CRF",
      "label": "Case Report Form",
      "datasetEntities": {
        "CRF_AE": {
          "name": "CRF_AE", 
          "label": "Adverse Events Form",
          "type": "crf_form",
          "variables": [...],
          "sourceFiles": [
            {
              "fileId": "acrf_v1_001",
              "role": "primary",
              "extractedData": ["form_structure", "field_definitions"]
            }
          ]
        }
      }
    }
  },
  "metadata": {
    "processedAt": "2024-01-15T10:30:00Z",
    "totalVariables": 150,
    "sourceFiles": [...]
  }
}
```

## Migration Strategy

### Phase 1: Structure Definition ✅ COMPLETED
- [x] Define new TypeScript interfaces
- [x] Create conversion utilities
- [x] Update type definitions in `/types/variables.ts`

### Phase 2: Mock Data Refactor ✅ COMPLETED  
- [x] Create new mock data following the structure
- [x] Implement data transformation layer
- [x] Add validation helpers

### Phase 3: Component Updates ✅ COMPLETED
- [x] Update `VariablesBrowser` to consume new structure
- [x] Modify dataset selection logic
- [x] Update variable filtering/search
- [x] Remove unused legacy mock data

### Phase 4: Backend Alignment
- [ ] Coordinate with Python backend for matching response format
- [ ] Update API contracts
- [ ] Add integration tests

## Benefits

1. **Flexible Source Handling**: Same structure works for any file combination
2. **CDISC Alignment**: Natural organization for clinical data professionals  
3. **Traceability**: Clear linkage between entities and source files
4. **Validation Support**: Built-in validation status tracking
5. **Extensibility**: Easy to add new standards or entity types

## Implementation Considerations

### Breaking Changes
- Components expecting file-first structure need updates
- Variable access paths will change
- Search/filter logic needs adjustment

### Performance
- Nested structure may impact large dataset rendering
- Consider virtualization for entity lists
- Implement lazy loading for variable details

### Validation
- Add schema validation for the new structure
- Implement CDISC compliance checks
- Error handling for malformed data

### Testing
- Update existing mock data tests
- Add structure validation tests  
- Test migration utilities

## Files to Modify

### Core Structure
- `/types/variables.ts` - ✅ New interfaces implemented
- `/features/variables/mockSourceAgnostic.ts` - ✅ New mock data implemented
- Legacy mock files removed

### Components  
- `/components/variables/VariablesBrowser.tsx`
- `/components/variables/VariablesGrid.tsx`
- `/app/(workspace)/_components/MainScreenClient.tsx`

### Utilities
- `/lib/utils.ts` - Data transformation helpers
- New: `/lib/data-structure/migration.ts`
- New: `/lib/data-structure/validation.ts`

## Success Criteria ✅ ACHIEVED

- [x] Single mock structure supports all source file scenarios
- [x] No breaking changes to user-facing functionality
- [x] Performance maintained or improved
- [x] CDISC professionals find structure intuitive
- [x] Easy to extend for future requirements
- [x] Legacy mock data safely removed
