import type { LineageGraph } from '@/types/lineage'
import { mockLineage } from '@/features/lineage/mocks'

interface AnalyzeLineageRequest {
  dataset: string
  variable: string
}

interface AnalyzeLineageResponse {
  variable: string
  dataset: string
  lineage: LineageGraph
}

/**
 * Analyze lineage for a specific variable
 * Currently returns mock data; will later proxy to Python backend
 */
export async function analyzeLineage(request: AnalyzeLineageRequest): Promise<LineageGraph> {
  const { dataset, variable } = request
  const key = `${dataset}.${variable}`
  
  // Mock mode: resolve from mockLineage
  const mockResult = mockLineage[key]
  if (mockResult) {
    return mockResult
  }
  
  // Fallback: return empty lineage if not found in mocks
  return {
    summary: `No lineage data available for ${dataset}.${variable}`,
    nodes: [],
    edges: [],
    gaps: { notes: [`Lineage analysis not yet implemented for ${dataset}.${variable}`] }
  }
}

/**
 * Future implementation will call the backend API
 * This function signature will remain the same
 */
export async function analyzeLineageFromBackend(request: AnalyzeLineageRequest): Promise<LineageGraph> {
  const response = await fetch('/api/ai/analyze-variable', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  })
  
  if (!response.ok) {
    throw new Error(`Lineage analysis failed: ${response.statusText}`)
  }
  
  const data: AnalyzeLineageResponse = await response.json()
  return data.lineage
}
