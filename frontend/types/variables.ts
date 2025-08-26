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

// Protocol Design Types (New)
export interface ProtocolEndpoint {
  readonly id: string
  readonly name: string
  readonly type: 'Primary Endpoint' | 'Secondary Endpoint'
  readonly description: string
  readonly population?: string | null
}

export interface ProtocolObjective {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly type?: string
}

export interface ProtocolPopulation {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly type?: string
}

export interface ProtocolSOA {
  readonly forms: readonly (string | { readonly id: string; readonly name: string })[]
  readonly schedule: readonly (string | { readonly id: string; readonly name: string })[]
}

export interface ProtocolDesign {
  readonly endpoints: readonly ProtocolEndpoint[]
  readonly objectives: readonly ProtocolObjective[]
  readonly populations: readonly ProtocolPopulation[]
  readonly soa: ProtocolSOA
}

// Source-Agnostic Data Structure Types (New)
export type StandardType = "ADaM" | "SDTM" | "CRF" | "TLF" | "Protocol"
export type EntityType = "domain" | "analysis_dataset" | "crf_form" | "tlf_item" | "protocol_document" | "tlf_document" | "protocol_design"
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
  // Protocol design metadata
  readonly design?: ProtocolDesign
  readonly stats?: {
    readonly objectiveCount?: number
    readonly populationCount?: number
    readonly endpointCount?: number
    readonly visitCount?: number
    readonly formCount?: number
  }
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
      } else if (standardType === 'Protocol' && entity.type === 'protocol_design' && entity.metadata?.design) {
        // Special handling for Protocol design - create individual items for each design component
        const design = entity.metadata.design
        
        // Create Endpoints dataset
        if (design.endpoints && design.endpoints.length > 0) {
          const endpointVariables = design.endpoints.map((endpoint: ProtocolEndpoint) => ({
            name: endpoint.id,
            label: endpoint.description,
            type: 'character' as VariableType,
            comment: `${endpoint.type}: ${endpoint.name}`
          }))
          
          datasets.push({
            name: 'Endpoints',
            label: `Protocol Endpoints (${design.endpoints.length})`,
            variables: endpointVariables,
            metadata: {
              records: design.endpoints.length,
              structure: 'One record per endpoint',
              validationStatus: entity.metadata.validationStatus
            },
            id: 'Protocol-Endpoints',
            group: 'Protocol' as FileGroupKind,
            fileId: entity.sourceFiles?.[0]?.fileId || 'Protocol-Endpoints',
            sourceFiles: entity.sourceFiles
          })
        }
        
        // Create Objectives dataset
        if (design.objectives && design.objectives.length > 0) {
          const objectiveVariables = design.objectives.map((objective: ProtocolObjective) => ({
            name: objective.id,
            label: objective.description,
            type: 'character' as VariableType,
            comment: objective.name
          }))
          
          datasets.push({
            name: 'Objectives',
            label: `Protocol Objectives (${design.objectives.length})`,
            variables: objectiveVariables,
            metadata: {
              records: design.objectives.length,
              structure: 'One record per objective',
              validationStatus: entity.metadata.validationStatus
            },
            id: 'Protocol-Objectives',
            group: 'Protocol' as FileGroupKind,
            fileId: entity.sourceFiles?.[0]?.fileId || 'Protocol-Objectives',
            sourceFiles: entity.sourceFiles
          })
        }
        
        // Create Populations dataset
        if (design.populations && design.populations.length > 0) {
          const populationVariables = design.populations.map((population: ProtocolPopulation) => ({
            name: population.id,
            label: population.description,
            type: 'character' as VariableType,
            comment: population.name
          }))
          
          datasets.push({
            name: 'Populations',
            label: `Protocol Populations (${design.populations.length})`,
            variables: populationVariables,
            metadata: {
              records: design.populations.length,
              structure: 'One record per population',
              validationStatus: entity.metadata.validationStatus
            },
            id: 'Protocol-Populations',
            group: 'Protocol' as FileGroupKind,
            fileId: entity.sourceFiles?.[0]?.fileId || 'Protocol-Populations',
            sourceFiles: entity.sourceFiles
          })
        }
        
        // Create SOA dataset
        if (design.soa) {
          const soaVariables = [
            // Handle both string arrays and object arrays for forms
            ...(Array.isArray(design.soa.forms) ? design.soa.forms.map((form: string | { readonly id: string; readonly name: string }) => {
              if (typeof form === 'string') {
                return {
                  name: form,
                  label: form,
                  type: 'character' as VariableType,
                  comment: 'SOA Form'
                }
              } else {
                return {
                  name: form.id || form.name,
                  label: form.name || form.id,
                  type: 'character' as VariableType,
                  comment: 'SOA Form'
                }
              }
            }) : []),
            // Handle both string arrays and object arrays for schedules
            ...(Array.isArray(design.soa.schedule) ? design.soa.schedule.map((schedule: string | { readonly id: string; readonly name: string }) => {
              if (typeof schedule === 'string') {
                return {
                  name: schedule,
                  label: schedule,
                  type: 'character' as VariableType,
                  comment: 'SOA Schedule'
                }
              } else {
                return {
                  name: schedule.id || schedule.name,
                  label: schedule.name || schedule.id,
                  type: 'character' as VariableType,
                  comment: 'SOA Schedule'
                }
              }
            }) : [])
          ]
          
          if (soaVariables.length > 0) {
            datasets.push({
              name: 'SOA',
              label: `Protocol SOA (${design.soa.forms.length} forms, ${design.soa.schedule.length} schedules)`,
              variables: soaVariables,
              metadata: {
                records: soaVariables.length,
                structure: 'Forms and schedules',
                validationStatus: entity.metadata.validationStatus
              },
              id: 'Protocol-SOA',
              group: 'Protocol' as FileGroupKind,
              fileId: entity.sourceFiles?.[0]?.fileId || 'Protocol-SOA',
              sourceFiles: entity.sourceFiles
            })
          }
        }
        
        return // Skip the original entity since we've created individual design components
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
  readonly files?: readonly { readonly [key: string]: unknown }[]
}

export interface AnalyzeVariableResponse {
  readonly variable: string
  readonly dataset: string
  readonly summary: string
  readonly lineage: {
    readonly nodes: readonly {
      readonly id: string
      readonly type: string
      readonly file?: string
      readonly label: string
      readonly description: string
      readonly explanation: string
    }[]
    readonly edges: readonly {
      readonly from: string
      readonly to: string
      readonly label: string
      readonly explanation: string
    }[]
    readonly gaps?: readonly {
      readonly source: string
      readonly target: string
      readonly explanation: string
    }[]
  }
}
