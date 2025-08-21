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
