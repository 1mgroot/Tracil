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

// Convert legacy response to source-agnostic format (for migration)
export function convertLegacyToSourceAgnostic(response: ProcessFilesResponse): SourceAgnosticProcessFilesResponse {
  const standards: { [standardType in StandardType]?: StandardDefinition } = {}
  
  response.files.forEach(file => {
    const standardType = deriveStandardFromFileType(file.type)
    
    if (!standards[standardType]) {
      const datasetEntities: { [entityKey: string]: DatasetEntity } = {}
      standards[standardType] = {
        type: standardType,
        label: getStandardLabel(standardType),
        datasetEntities,
        metadata: {
          totalEntities: 0
        }
      }
    }
    
    file.datasets.forEach(dataset => {
      const entity: DatasetEntity = {
        name: dataset.name,
        label: dataset.label || dataset.name,
        type: deriveEntityTypeFromStandard(standardType),
        variables: dataset.variables,
        sourceFiles: [{
          fileId: file.filename,
          role: "primary",
          extractedData: ["metadata", "variables"]
        }],
        metadata: {
          records: dataset.metadata?.records,
          structure: dataset.metadata?.structure,
          version: dataset.metadata?.version,
          lastModified: dataset.metadata?.lastModified,
          validationStatus: "unknown"
        }
      }
      
      // Use mutable access during construction
      const mutableStandard = standards[standardType] as any
      mutableStandard.datasetEntities[dataset.name] = entity
      mutableStandard.metadata.totalEntities++
    })
  })
  
  return {
    standards,
    metadata: {
      processedAt: new Date().toISOString(),
      totalVariables: response.files.reduce((sum, file) => 
        sum + file.datasets.reduce((datasetSum, dataset) => 
          datasetSum + dataset.variables.length, 0), 0),
      sourceFiles: response.files.map(file => ({
        id: file.filename,
        filename: file.filename,
        type: deriveSourceFileType(file.type),
        uploadedAt: new Date().toISOString(),
        sizeKB: 100, // Mock value
        processingStatus: "completed" as ProcessingStatus
      }))
    }
  }
}

function deriveStandardFromFileType(type: ProcessedFile['type']): StandardType {
  switch (type) {
    case 'adam_metadata': return 'ADaM'
    case 'sdtm_metadata': return 'SDTM'
    case 'acrf_document': return 'CRF'
    case 'tlf_document': return 'TLF'
  }
}

function getStandardLabel(type: StandardType): string {
  switch (type) {
    case 'ADaM': return 'Analysis Data Model'
    case 'SDTM': return 'Study Data Tabulation Model'
    case 'CRF': return 'Case Report Form'
    case 'TLF': return 'Tables, Listings, and Figures'
  }
}

function deriveEntityTypeFromStandard(standard: StandardType): EntityType {
  switch (standard) {
    case 'ADaM': return 'analysis_dataset'
    case 'SDTM': return 'domain'
    case 'CRF': return 'crf_form'
    case 'TLF': return 'tlf_item'
  }
}

function deriveSourceFileType(type: ProcessedFile['type']): SourceFileType {
  switch (type) {
    case 'adam_metadata': return 'define_xml'
    case 'sdtm_metadata': return 'define_xml'
    case 'acrf_document': return 'acrf_pdf'
    case 'tlf_document': return 'tlf_rtf'
  }
}
