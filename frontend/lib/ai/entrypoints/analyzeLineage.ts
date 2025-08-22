import type { LineageGraph } from '@/types/lineage'

interface AnalyzeLineageRequest {
  dataset: string
  variable: string
}

interface AnalyzeLineageResponse {
  variable: string
  dataset: string
  summary: string
  lineage: LineageGraph
}

/**
 * Analyze lineage for a specific variable
 * Calls the real API endpoint that proxies to Python backend
 */
export async function analyzeLineage(request: AnalyzeLineageRequest): Promise<LineageGraph> {
  try {
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
  } catch (error) {
    console.error('Error analyzing lineage:', error)
    
    // Return fallback lineage data on error
    return {
      summary: `Lineage analysis failed for ${request.dataset}.${request.variable}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      nodes: [
        {
          id: `${request.dataset}.${request.variable}`,
          title: request.variable,
          dataset: request.dataset,
          variable: request.variable,
          group: 'ADaM' as const,
          kind: 'target'
        }
      ],
      edges: [],
      gaps: { 
        notes: [`Lineage analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`] 
      }
    }
  }
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use analyzeLineage instead
 */
export async function analyzeLineageFromBackend(request: AnalyzeLineageRequest): Promise<LineageGraph> {
  return analyzeLineage(request)
}
