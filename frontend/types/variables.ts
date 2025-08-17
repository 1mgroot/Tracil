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

// Import FileGroupKind from existing files.ts
import type { FileGroupKind } from './files'

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
