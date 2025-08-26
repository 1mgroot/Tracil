export type LineageNodeKind = 'source' | 'intermediate' | 'target'
export type ArtifactGroup = 'ADaM' | 'SDTM' | 'aCRF' | 'TLF' | 'Protocol' | 'Unknown' | 'target'

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
  readonly label?: string        // e.g., "retain", "MedDRA map"
  readonly explanation?: string  // Detailed explanation of the relationship
}

export interface LineageGaps { readonly notes?: string[] }

export interface LineageGraph {
  readonly summary: string
  readonly nodes: readonly LineageNode[]
  readonly edges: readonly LineageEdge[]
  readonly gaps?: LineageGaps
}
