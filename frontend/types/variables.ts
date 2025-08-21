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

// Source-Agnostic Data Structure Types (New)
export type StandardType = "ADaM" | "SDTM" | "CRF" | "TLF"
export type EntityType = "domain" | "analysis_dataset" | "crf_form" | "tlf_item"
export type SourceFileType = "define_xml" | "dataset_xpt" | "dataset_sas7bdat" | "spec_xlsx" | "acrf_pdf" | "tlf_rtf" | "tlf_pdf"
export type FileRole = "primary" | "supplementary" | "validation"
export type ProcessingStatus = "pending" | "processing" | "completed" | "error"
export type ValidationStatus = "compliant" | "non_compliant" | "missing" | "unknown"

export interface SourceFile {
  readonly id: string
  readonly filename: string
  readonly type: SourceFileType
  readonly uploadedAt: string
  readonly sizeKB: number
  readonly processingStatus: ProcessingStatus
}

export interface SourceFileReference {
  readonly fileId: string
  readonly role: FileRole
  readonly extractedData: readonly string[]
}

export interface EntityMetadata {
  readonly records?: number
  readonly structure?: string
  readonly version?: string
  readonly lastModified?: string
  readonly validationStatus?: ValidationStatus
}

export interface DatasetEntity {
  readonly name: string           // LB, ADSL, CRF_AE, T-14-3-01
  readonly label: string          // Human-readable description
  readonly type: EntityType       // Maps to CDISC concept
  readonly variables: readonly Variable[]
  readonly sourceFiles: readonly SourceFileReference[]
  readonly metadata: EntityMetadata
}

export interface StandardDefinition {
  readonly type: StandardType
  readonly label: string
  readonly datasetEntities: { readonly [entityKey: string]: DatasetEntity }
  readonly metadata: {
    readonly version?: string
    readonly lastModified?: string
    readonly totalEntities: number
  }
}

// New Source-Agnostic API Response
export interface SourceAgnosticProcessFilesResponse {
  readonly standards: { readonly [standardType in StandardType]?: StandardDefinition }
  readonly metadata: {
    readonly processedAt: string
    readonly totalVariables: number
    readonly sourceFiles: readonly SourceFile[]
  }
}

// Frontend-specific extensions (for UI state management)
export interface DatasetWithGroup {
  readonly name: string                   // Dataset name (e.g., "ADSL") - PRIMARY KEY
  readonly label?: string              // Dataset description
  readonly variables: readonly Variable[] // All variables in this dataset
  readonly metadata?: {
    readonly records?: number
    readonly structure?: string         // e.g., "one record per subject"
    readonly version?: string
    readonly lastModified?: string
  }
  readonly id: string                   // Generated from standard + dataset name
  readonly group: FileGroupKind        // Derived from standard type
  readonly fileId: string              // Reference to source file
}

// Import FileGroupKind from existing files.ts
import type { FileGroupKind } from './files'

// Source-Agnostic Data Transformation Utilities
export function transformSourceAgnosticToUI(response: SourceAgnosticProcessFilesResponse): DatasetWithGroup[] {
  const datasets: DatasetWithGroup[] = []
  
  Object.entries(response.standards).forEach(([standardType, standard]) => {
    if (!standard) return
    
    Object.values(standard.datasetEntities).forEach(entity => {
      datasets.push({
        name: entity.name,
        label: entity.label,
        variables: entity.variables,
        metadata: {
          records: entity.metadata.records,
          structure: entity.metadata.structure,
          version: entity.metadata.version,
          lastModified: entity.metadata.lastModified
        },
        id: `${standardType}-${entity.name}`,
        group: standardType as FileGroupKind,
        fileId: entity.sourceFiles[0]?.fileId || `${standardType}-${entity.name}`
      })
    })
  })
  
  return datasets
}
