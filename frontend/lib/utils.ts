import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Capitalize the first letter of each word in a string
 * This improves readability for node titles and labels
 */
export function capitalizeWords(text: string): string {
  if (!text || typeof text !== 'string') return text
  
  return text.replace(/\b\w/g, (char) => char.toUpperCase())
}

/**
 * Datasets that should display ID instead of title (ADaM + SDTM)
 * This matches the logic used in React Flow components
 */
const DATASETS_USE_ID = new Set([
  // ADaM datasets
  'ADSL', 'ADAE', 'ADCM', 'ADLB', 'ADVS', 'ADEG', 'ADQS', 'ADPC', 'ADPP', 'ADTR', 'ADRS', 'ADTTE', 'ADMH', 'ADPR', 'ADDS', 'ADHO', 'ADRE', 'ADQSADAS', 'ADQSCIBC', 'ADQSNPIX',
  // SDTM datasets
  'DM', 'CO', 'SE', 'SV', 'TE', 'TV', 'TS', 'TI', 'AE', 'DS', 'DV', 'CE', 'MH', 'CM', 'EX', 'SU', 'PR', 'LB', 'VS', 'EG', 'IE', 'QS', 'RS', 'DA', 'PE', 'SC', 'FA', 'TA', 'SUPP--', 'RELREC'
])

/**
 * Determine if a node should display its ID instead of title
 * This is used for ADaM and SDTM datasets to show the full node identifier
 */
export function shouldDisplayNodeId(node: { dataset?: string }): boolean {
  const dataset = node.dataset
  return dataset ? DATASETS_USE_ID.has(dataset) : false
}

/**
 * Get the appropriate display text for a node
 * For ADaM/SDTM datasets: returns the full node ID
 * For other types: returns the title/label with proper capitalization
 * This ensures consistency between React Flow charts and text summaries
 */
export function getNodeDisplayText(node: { 
  id?: string; 
  title?: string; 
  label?: string; 
  dataset?: string 
}): string {
  if (shouldDisplayNodeId(node)) {
    return capitalizeWords(node.id || node.title || node.label || 'Unknown')
  }
  
  // For non-ADaM/SDTM datasets, apply proper capitalization
  const text = node.title || node.label || node.id || 'Unknown'
  return capitalizeWords(text)
}

/**
 * Deduplicate lineage nodes by ID to prevent React key conflicts
 * This function ensures that each node ID appears only once in the array
 */
export function deduplicateLineageNodes<T extends { readonly id: string }>(nodes: readonly T[]): T[] {
  const seen = new Set<string>()
  const uniqueNodes: T[] = []
  
  for (const node of nodes) {
    if (!seen.has(node.id)) {
      seen.add(node.id)
      uniqueNodes.push(node)
    } else {
      console.warn(`Duplicate node ID found: ${node.id}, skipping...`)
    }
  }
  
  return uniqueNodes
}

/**
 * Deduplicate lineage edges by ensuring both source and target nodes exist
 * and filtering out any edges that reference non-existent nodes
 */
export function deduplicateLineageEdges<T extends { readonly from: string; readonly to: string }>(
  edges: readonly T[], 
  validNodeIds: Set<string>
): T[] {
  return edges.filter(edge => {
    const isValid = validNodeIds.has(edge.from) && validNodeIds.has(edge.to)
    if (!isValid) {
      console.warn(`Edge references non-existent nodes: ${edge.from} → ${edge.to}, skipping...`)
    }
    return isValid
  })
}

/**
 * Process lineage data to ensure no duplicates exist
 * This is the main function to call before passing data to React components
 */
export function processLineageData<T extends { readonly id: string }, U extends { readonly from: string; readonly to: string }>(
  nodes: readonly T[],
  edges: readonly U[]
): { nodes: T[]; edges: U[] } {
  // First deduplicate nodes
  const uniqueNodes = deduplicateLineageNodes(nodes)
  
  // Create set of valid node IDs for edge validation
  const validNodeIds = new Set(uniqueNodes.map(node => node.id))
  
  // Then filter edges to only include valid connections
  const validEdges = deduplicateLineageEdges(edges, validNodeIds)
  
  console.log(`Processed lineage data: ${nodes.length} → ${uniqueNodes.length} nodes, ${edges.length} → ${validEdges.length} edges`)
  
  return { nodes: uniqueNodes, edges: validEdges }
}
