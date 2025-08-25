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
export type StandardType = "ADaM" | "SDTM" | "CRF" | "TLF" | "Protocol"
export type EntityType = "domain" | "analysis_dataset" | "crf_form" | "tlf_item" | "protocol_document" | "tlf_document"
export type SourceFileType = "define_xml" | "dataset_xpt" | "dataset_sas7bdat" | "spec_xlsx" | "acrf_pdf" | "tlf_rtf" | "tlf_pdf" | "protocol_pdf" | "protocol_txt"
export type FileRole = "primary" | "supplementary" | "validation"
export type ProcessingStatus = "pending" | "processing" | "completed" | "error"
export type ValidationStatus = "compliant" | "non_compliant" | "missing" | "unknown" | "not_applicable"

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
  readonly textFile?: string
  readonly textChars?: number
  readonly varIndexCsv?: string
  readonly varIndexCount?: number
  readonly titles?: readonly { readonly id: string; readonly title: string }[]
  readonly titleCount?: number
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
    readonly validationStatus?: string
  }
  readonly id: string                   // Generated from standard + dataset name
  readonly group: FileGroupKind        // Derived from standard type
  readonly fileId: string              // Reference to source file
  readonly sourceFiles?: readonly SourceFileReference[]
}

// Import FileGroupKind from existing files.ts
import type { FileGroupKind } from './files'

// Source-Agnostic Data Transformation Utilities
export function transformSourceAgnosticToUI(response: SourceAgnosticProcessFilesResponse): DatasetWithGroup[] {
  const datasets: DatasetWithGroup[] = []
  
  // Defensive programming: ensure response and standards exist
  if (!response || !response.standards) {
    console.warn('transformSourceAgnosticToUI: Invalid response structure', response)
    return []
  }
  
  Object.entries(response.standards).forEach(([standardType, standard]) => {
    if (!standard || !standard.datasetEntities) {
      console.warn(`transformSourceAgnosticToUI: Invalid standard structure for ${standardType}`, standard)
      return
    }
    
    Object.values(standard.datasetEntities).forEach(entity => {
      if (!entity || !entity.name || !entity.variables) {
        console.warn(`transformSourceAgnosticToUI: Invalid entity structure`, entity)
        return
      }
      
      // Special handling for TLF documents - create individual items for each table title
      if (standardType === 'TLF' && entity.type === 'tlf_document' && entity.metadata?.titles) {
        entity.metadata.titles.forEach((titleItem) => {
          datasets.push({
            name: titleItem.id,
            label: titleItem.title,
            variables: [], // TLF items don't have variables
            metadata: {
              records: entity.metadata?.records,
              structure: entity.metadata?.structure,
              version: entity.metadata?.version,
              lastModified: entity.metadata?.lastModified,
              validationStatus: entity.metadata?.validationStatus
            },
            id: `TLF-${titleItem.id}`,
            group: 'TLF' as FileGroupKind,
            fileId: entity.sourceFiles?.[0]?.fileId || `TLF-${titleItem.id}`,
            sourceFiles: entity.sourceFiles
          })
        })
      } else {
        // Standard handling for other entity types
        datasets.push({
          name: entity.name,
          label: entity.label,
          variables: entity.variables,
          metadata: {
            records: entity.metadata?.records,
            structure: entity.metadata?.structure,
            version: entity.metadata?.version,
            lastModified: entity.metadata?.lastModified,
            validationStatus: entity.metadata?.validationStatus
          },
          id: `${standardType}-${entity.name}`,
          group: standardType as FileGroupKind,
          fileId: entity.sourceFiles?.[0]?.fileId || `${standardType}-${entity.name}`,
          sourceFiles: entity.sourceFiles
        })
      }
    })
  })
  
  // Deduplicate datasets by ID to prevent React key conflicts
  const seen = new Set<string>()
  const uniqueDatasets: DatasetWithGroup[] = []
  
  for (const dataset of datasets) {
    if (!seen.has(dataset.id)) {
      seen.add(dataset.id)
      uniqueDatasets.push(dataset)
    } else {
      console.warn(`Duplicate dataset ID found: ${dataset.id}, skipping...`)
    }
  }
  
  console.log(`transformSourceAgnosticToUI: Processed ${datasets.length} → ${uniqueDatasets.length} unique datasets`)
  
  return uniqueDatasets
}

// API Request/Response Types for Variable Analysis
export interface AnalyzeVariableRequest {
  readonly variable: string
  readonly dataset: string
  readonly files?: readonly { readonly [key: string]: any }[]
}

export interface AnalyzeVariableResponse {
  readonly variable: string
  readonly dataset: string
  readonly summary: string
  readonly lineage: {
    readonly summary: string
    readonly nodes: readonly {
      readonly id: string
      readonly title: string
      readonly dataset?: string
      readonly variable?: string
      readonly group: 'ADaM' | 'SDTM' | 'aCRF' | 'TLF' | 'Protocol'
      readonly kind: 'source' | 'intermediate' | 'target'
      readonly meta?: { file?: string; notes?: string }
    }[]
    readonly edges: readonly {
      readonly from: string
      readonly to: string
      readonly confidence?: number
      readonly label?: string
    }[]
    readonly gaps?: { readonly notes?: string[] }
  }
}
