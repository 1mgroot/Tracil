import type { LineageGraph } from '@/types/lineage'
import type { AnalyzeVariableResponse } from '@/types/variables'

interface AnalyzeLineageRequest {
  dataset: string
  variable: string
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
    console.log('🔍 Debug - Summary from backend:', data.summary)
    console.log('🔍 Debug - Lineage data:', data.lineage)
    console.log('🔍 Debug - Gaps data:', data.lineage?.gaps)
    
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
        
        // Determine group based on node type
        let group: 'ADaM' | 'SDTM' | 'aCRF' | 'TLF' | 'Protocol' = 'ADaM'
        if (nodeType === 'SDTM') group = 'SDTM'
        else if (nodeType === 'CRF') group = 'aCRF'
        else if (nodeType === 'TLF') group = 'TLF'
        else if (nodeType === 'Protocol') group = 'Protocol'
        
        // Determine kind based on type and position in flow
        let kind: 'source' | 'intermediate' | 'target' = 'target'
        if (nodeType === 'Protocol' || nodeType === 'CRF') kind = 'source'
        else if (nodeType === 'SDTM') kind = 'intermediate'
        else if (nodeType === 'target') kind = 'target'
        
        return {
          id: nodeId,
          title: node.label || nodeId.split('.').pop() || data.variable,
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
          // Debug: Log the gaps transformation
          console.log('🔍 Debug - Processing gaps:', data.lineage.gaps)
          
          if (Array.isArray(data.lineage.gaps)) {
            const processedGaps = data.lineage.gaps.map((gap: { source: string; target: string; explanation: string }) => {
              const explanation = gap.explanation || 'Gap identified'
              console.log('🔍 Debug - Processing gap:', gap, '→ explanation:', explanation)
              return explanation
            }).filter(Boolean)
            
            // Remove duplicate explanations to prevent React key conflicts
            const uniqueGaps = [...new Set(processedGaps)]
            console.log('🔍 Debug - Final processed gaps (unique):', uniqueGaps)
            return uniqueGaps
          } else {
            console.log('🔍 Debug - Gaps is not an array, using default')
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
          group: 'aCRF' as const,
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
          group: 'aCRF' as const,
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


