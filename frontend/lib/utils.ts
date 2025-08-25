import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
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
