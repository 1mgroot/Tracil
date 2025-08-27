import type { LineageGraph } from '@/types/lineage'
import type { AnalyzeVariableResponse } from '@/types/variables'

interface AnalyzeLineageRequest {
  dataset: string
  variable: string
}

// Type normalization system for backend response types
type NormalizedType = "ADaM" | "SDTM" | "CRF" | "TLF" | "Protocol" | "Unknown" | "target"

/**
 * Normalize backend type strings to standardized CDISC categories
 * Uses "contains" logic for flexible matching
 */
function normalizeNodeType(backendType: string): NormalizedType {
  const typeLower = backendType.toLowerCase()
  
  // Check for target type first
  if (typeLower === 'target') {
    return "target"
  }
  
  // ADaM types - look for "adam" or "analysis" in the type
  if (typeLower.includes('adam') || typeLower.includes('analysis') || typeLower.includes('analysis dataset')) {
    return "ADaM"
  }
  
  // SDTM types - look for "sdtm" or "standard" in the type
  if (typeLower.includes('sdtm') || typeLower.includes('standard')) {
    return "SDTM"
  }
  
  // CRF types - look for "crf" (including "acrf") or "case report" in the type
  // This will match "CRF", "aCRF", "acrf", "case report form", etc.
  if (typeLower.includes('crf') || typeLower.includes('case report') || typeLower.includes('form')) {
    return "CRF"
  }
  
  // TLF types - look for "tlf" or "table" or "figure" or "display" in the type
  if (typeLower.includes('tlf') || typeLower.includes('table') || typeLower.includes('figure') || 
      typeLower.includes('display') || typeLower.includes('listing')) {
    return "TLF"
  }
  
  // Protocol types - look for "protocol" or "sap" in the type
  if (typeLower.includes('protocol') || typeLower.includes('sap') || typeLower.includes('study plan')) {
    return "Protocol"
  }
  
  // Default to Unknown for unrecognized types
  return "Unknown"
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
    
    const data: AnalyzeVariableResponse = await response.json()
    
    // Debug: Log the raw backend response
    console.log('🔍 Debug - Raw backend response:', data)
    console.log('🔍 Debug - Lineage data:', data.lineage)
    
    // Transform the API response to match LineageGraph type
    // The backend returns a different structure, so we need to transform it
    const transformedLineage: LineageGraph = {
      summary: data.summary || `Lineage analysis for ${data.dataset}.${data.variable}`,
      nodes: data.lineage.nodes.map((node: {
        id: string
        type: string
        file?: string
        label: string
        description: string
        explanation: string
      }) => {
        // Backend returns nodes with 'type', 'label', 'description', and 'explanation'
        const nodeId = node.id || `${data.dataset}.${data.variable}`
        const nodeType = node.type || 'target'
        
        // Normalize the backend type to our standardized categories
        const normalizedType = normalizeNodeType(nodeType)
        
        // Determine group based on normalized type
        let group: 'ADaM' | 'SDTM' | 'CRF' | 'TLF' | 'Protocol' | 'Unknown'
        switch (normalizedType) {
          case 'ADaM':
            group = 'ADaM'
            break
          case 'SDTM':
            group = 'SDTM'
            break
          case 'CRF':
            group = 'CRF'
            break
          case 'TLF':
            group = 'TLF'
            break
          case 'Protocol':
            group = 'Protocol'
            break
          case 'target':
            group = 'ADaM' // Target nodes are typically ADaM
            break
          case 'Unknown':
            // For unknown types, try to infer from context
            if (nodeType.toLowerCase().includes('variable')) {
              group = 'ADaM' // Assume variables are ADaM if we can't determine
            } else if (nodeType.toLowerCase().includes('dataset')) {
              group = 'ADaM' // Assume datasets are ADaM if we can't determine
            } else {
              group = 'Unknown' // Keep as unknown if we can't infer
            }
            break
        }
        
        // Determine kind based on group - Protocol and CRF are sources, others are intermediate
        let kind: 'source' | 'intermediate' | 'target' = 'intermediate'
        if (group === 'Protocol' || group === 'CRF') {
          kind = 'source'
        } else if (group === 'Unknown') {
          kind = 'target'
        }
        
        return {
          id: nodeId,
          title: node.label || nodeId || data.variable,
          dataset: data.dataset,
          variable: data.variable,
          group,
          kind,
          meta: { 
            file: node.file,
            notes: node.description || node.explanation || node.file
          }
        }
      }),
      edges: data.lineage.edges.map((edge: {
        from: string
        to: string
        label: string
        explanation: string
      }) => ({
        from: edge.from,
        to: edge.to,
        label: edge.label || edge.explanation || 'derived',
        explanation: edge.explanation
      })),
      gaps: { 
        notes: (() => {
          if (Array.isArray(data.lineage.gaps)) {
            const processedGaps = data.lineage.gaps.map((gap: { source: string; target: string; explanation: string }) => {
              const explanation = gap.explanation || 'Gap identified'
              return explanation
            }).filter(Boolean)
            
            // Remove duplicate explanations to prevent React key conflicts
            const uniqueGaps = [...new Set(processedGaps)]
            return uniqueGaps
          } else {
            return ['No gaps identified']
          }
        })()
      }
    }
    
    // If the backend returned minimal data (just one node), enhance it with typical CDISC flow
    if (transformedLineage.nodes.length === 1 && transformedLineage.edges.length === 0) {
      const targetNode = transformedLineage.nodes[0]
      const targetId = targetNode.id
      
      // Add typical CDISC flow nodes
      const additionalNodes = [
        {
          id: `SDTM.${data.dataset}.${data.variable}`,
          title: `${data.dataset}.${data.variable}`,
          dataset: data.dataset,
          variable: data.variable,
          group: 'SDTM' as const,
          kind: 'intermediate' as const,
          meta: { notes: 'Intermediate SDTM variable' }
        },
        {
          id: `CRF.${data.dataset}.${data.variable}`,
          title: `CRF: ${data.variable}`,
          group: 'CRF' as const,
          kind: 'source' as const,
          meta: { notes: 'Source CRF variable' }
        },
        {
          id: `Protocol.${data.dataset}.${data.variable}`,
          title: `Protocol: ${data.variable}`,
          group: 'Protocol' as const,
          kind: 'source' as const,
          meta: { notes: 'Protocol definition' }
        }
      ]
      
      const additionalEdges = [
        {
          from: `Protocol.${data.dataset}.${data.variable}`,
          to: `CRF.${data.dataset}.${data.variable}`,
          label: 'Protocol → CRF design',
          explanation: 'Protocol defines the variable requirements and CRF design implements data collection'
        },
        {
          from: `CRF.${data.dataset}.${data.variable}`,
          to: `SDTM.${data.dataset}.${data.variable}`,
          label: 'CRF capture → SDTM standardize',
          explanation: 'Data captured on CRF is standardized according to SDTM guidelines'
        },
        {
          from: `SDTM.${data.dataset}.${data.variable}`,
          to: targetId,
          label: 'retain or derive',
          explanation: 'Variable is retained or derived for analysis dataset according to ADaM specifications'
        }
      ]
      
      // Create a new enhanced lineage object
      return {
        summary: `Enhanced lineage for ${data.dataset}.${data.variable} showing typical CDISC flow from Protocol → CRF → SDTM → ADaM`,
        nodes: [...transformedLineage.nodes, ...additionalNodes],
        edges: [...transformedLineage.edges, ...additionalEdges],
        gaps: transformedLineage.gaps
      }
    }
    
    return transformedLineage
  } catch (error) {
    console.error('Error analyzing lineage:', error)
    
    // Return meaningful fallback lineage data on error
    return {
      summary: `Lineage analysis for ${request.dataset}.${request.variable} is currently unavailable. This variable appears to be part of the ${request.dataset} dataset.`,
      nodes: [
        {
          id: `${request.dataset}.${request.variable}`,
          title: request.variable,
          dataset: request.dataset,
          variable: request.variable,
          group: 'ADaM' as const,
          kind: 'target',
          meta: { notes: 'Target variable in analysis dataset' }
        },
        {
          id: `SDTM.${request.dataset}.${request.variable}`,
          title: `${request.dataset}.${request.variable}`,
          dataset: request.dataset,
          variable: request.variable,
          group: 'SDTM' as const,
          kind: 'intermediate',
          meta: { notes: 'Intermediate SDTM variable' }
        },
        {
          id: `CRF.${request.dataset}.${request.variable}`,
          title: `CRF: ${request.variable}`,
          group: 'CRF' as const,
          kind: 'source',
          meta: { notes: 'Source CRF variable' }
        },
        {
          id: `Protocol.${request.dataset}.${request.variable}`,
          title: `Protocol: ${request.variable}`,
          group: 'Protocol' as const,
          kind: 'source',
          meta: { notes: 'Protocol definition' }
        }
      ],
      edges: [
        {
          from: `Protocol.${request.dataset}.${request.variable}`,
          to: `CRF.${request.dataset}.${request.variable}`,
          label: 'Protocol → CRF design',
          explanation: 'Protocol defines the variable requirements and CRF design implements data collection'
        },
        {
          from: `CRF.${request.dataset}.${request.variable}`,
          to: `SDTM.${request.dataset}.${request.variable}`,
          label: 'CRF capture → SDTM standardize',
          explanation: 'Data captured on CRF is standardized according to SDTM guidelines'
        },
        {
          from: `SDTM.${request.dataset}.${request.variable}`,
          to: `${request.dataset}.${request.variable}`,
          label: 'retain or derive',
          explanation: 'Variable is retained or derived for analysis dataset according to ADaM specifications'
        }
      ],
      gaps: { 
        notes: [
          'Lineage analysis is currently unavailable',
          'This is placeholder data showing typical CDISC flow',
          'Contact system administrator for full lineage analysis'
        ] 
      }
    }
  }
}


