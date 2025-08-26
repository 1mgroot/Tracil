import { useCallback, useMemo } from 'react'
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Position,
  MarkerType,
} from 'reactflow'
import 'reactflow/dist/style.css'
import type { LineageGraph as LineageGraphType, LineageNode, LineageEdge } from '@/types/lineage'

// Move nodeTypes and edgeTypes outside component to prevent recreation on every render
const nodeTypes = {}
const edgeTypes = {}

interface LineageGraphProps {
  lineage: LineageGraphType
}

const getGroupColor = (group: string): string => {
  switch (group) {
    case 'ADaM': return '#10b981' // Green for derived data
    case 'SDTM': return '#3b82f6' // Blue for source data
    case 'aCRF': return '#dc2626' // Red for collection forms
    case 'TLF': return '#7c3aed' // Purple for outputs/reports
    default: return '#6b7280'
  }
}

const getNodeStyle = (node: LineageNode) => {
  const baseStyle = {
    border: '2px solid white',
    borderRadius: '8px',
    width: 160,
    height: 60,
    color: 'white',
    fontSize: '12px',
    fontWeight: 500,
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  }
  
  // Special styling for different node types
  if (node.title.includes('Protocol')) {
    return {
      ...baseStyle,
      background: '#7c3aed', // Purple for protocol
      border: '3px solid #4c1d95',
      boxShadow: '0 6px 12px -2px rgba(124, 58, 237, 0.3)',
    }
  }
  
  if (node.title.includes('Table')) {
    return {
      ...baseStyle,
      background: '#7c3aed', // Purple for TLF outputs
      border: '3px solid #4c1d95',
      boxShadow: '0 6px 12px -2px rgba(124, 58, 237, 0.3)',
    }
  }
  
  if (node.dataset === 'ADSL' && node.group === 'ADaM') {
    return {
      ...baseStyle,
      background: '#059669', // Darker green for core ADSL
      border: '3px solid #047857',
      boxShadow: '0 6px 12px -2px rgba(5, 150, 105, 0.3)',
    }
  }
  
  return {
    ...baseStyle,
    background: getGroupColor(node.group),
  }
}



const getEdgeStyle = (edge: LineageEdge) => {
  const baseStyle = {
    strokeWidth: 3,
    strokeDasharray: 'none',
  }
  
  // Different styles for different relationship types
  if (edge.label === 'Derived from') {
    return {
      ...baseStyle,
      stroke: '#10b981', // Green for derivation
      strokeWidth: 4,
    }
  }
  
  if (edge.label === 'Collected from') {
    return {
      ...baseStyle,
      stroke: '#dc2626', // Red for collection
      strokeWidth: 3,
    }
  }
  
  if (edge.label === 'Defined in') {
    return {
      ...baseStyle,
      stroke: '#7c3aed', // Purple for definition
      strokeWidth: 3,
    }
  }
  
  if (edge.label === 'Used in') {
    return {
      ...baseStyle,
      stroke: '#3b82f6', // Blue for usage
      strokeWidth: 3,
    }
  }
  
  if (edge.label === 'Direct context') {
    return {
      ...baseStyle,
      stroke: '#f59e0b', // Orange for context
      strokeWidth: 3,
    }
  }
  
  return {
    ...baseStyle,
    stroke: '#6b7280', // Default gray color
  }
}

// Lineage-based layout function that follows the actual data flow
const createLineageLayout = (nodes: readonly LineageNode[]) => {
  const horizontalSpacing = 200
  
  const positions: { [key: string]: { x: number; y: number } } = {}
  
  // Create a more intelligent layout based on the actual lineage flow
  // For the AGEGR1N example, we want: Protocol → CRF → DM → ADSL → Other ADaM
  
  // Group nodes by their logical position in the flow
  const protocolNodes = nodes.filter(n => n.group === 'TLF' && n.title.includes('Protocol'))
  const crfNodes = nodes.filter(n => n.group === 'aCRF')
  const sdtmNodes = nodes.filter(n => n.group === 'SDTM')
  const adamCoreNodes = nodes.filter(n => n.group === 'ADaM' && n.dataset === 'ADSL')
  const adamDerivedNodes = nodes.filter(n => n.group === 'ADaM' && n.dataset !== 'ADSL')
  const tlfOutputNodes = nodes.filter(n => n.group === 'TLF' && !n.title.includes('Protocol'))
  
  let currentX = 100
  const currentY = 100
  
  // Position Protocol nodes (leftmost)
  protocolNodes.forEach((node, index) => {
    positions[node.id] = {
      x: currentX,
      y: currentY + index * 80
    }
  })
  currentX += horizontalSpacing
  
  // Position CRF nodes
  crfNodes.forEach((node, index) => {
    positions[node.id] = {
      x: currentX,
      y: currentY + index * 80
    }
  })
  currentX += horizontalSpacing
  
  // Position SDTM nodes
  sdtmNodes.forEach((node, index) => {
    positions[node.id] = {
      x: currentX,
      y: currentY + index * 80
    }
  })
  currentX += horizontalSpacing
  
  // Position core ADSL nodes
  adamCoreNodes.forEach((node, index) => {
    positions[node.id] = {
      x: currentX,
      y: currentY + index * 80
    }
  })
  currentX += horizontalSpacing
  
  // Position derived ADaM nodes
  adamDerivedNodes.forEach((node, index) => {
    positions[node.id] = {
      x: currentX,
      y: currentY + index * 80
    }
  })
  currentX += horizontalSpacing
  
  // Position TLF output nodes (rightmost)
  tlfOutputNodes.forEach((node, index) => {
    positions[node.id] = {
      x: currentX,
      y: currentY + index * 80
    }
  })
  
  return positions
}

export function LineageGraphReactFlow({ lineage }: LineageGraphProps) {
  // Create lineage-based layout
  const layoutPositions = useMemo(() => {
    const positions = createLineageLayout(lineage.nodes)
    return positions
  }, [lineage.nodes])
  
  // Convert lineage data to React Flow format
  // Note: Data is already deduplicated at the API level
  const initialNodes: Node[] = useMemo(() => {
    return lineage.nodes.map((node) => {
      const position = layoutPositions[node.id] || { x: 0, y: 0 }
      
      return {
        id: node.id,
        type: 'default',
        position,
        data: {
          label: (
            <div className="text-center">
              <div className="font-medium text-white">{node.title}</div>
              <div className="text-xs text-white/80">
                {node.id}
              </div>
              {node.dataset && node.variable && node.id !== `${node.dataset}.${node.variable}` && (
                <div className="text-xs text-white/60">
                  {node.dataset}.{node.variable}
                </div>
              )}
              {node.group && (
                <div className="text-xs text-white/60">
                  {node.group}
                </div>
              )}
            </div>
          ),
          group: node.group,
          meta: node.meta,
        },
        style: getNodeStyle(node),
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
      }
    })
  }, [lineage.nodes, layoutPositions])

  const initialEdges: Edge[] = useMemo(() => {
    // Note: Data is already deduplicated at the API level
    return lineage.edges.map((edge) => {
      return {
        id: `${edge.from}-${edge.to}`,
        source: edge.from,
        target: edge.to,
        type: 'smoothstep',
        style: getEdgeStyle(edge),
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 20,
          height: 20,
          color: getEdgeStyle(edge).stroke,
        },
        data: {
          label: edge.label,
          explanation: edge.explanation,
        },
      }
    })
  }, [lineage.edges])

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, , onEdgesChange] = useEdgesState(initialEdges)

  const onLayout = useCallback(() => {
    const newPositions = createLineageLayout(lineage.nodes)
    const updatedNodes = nodes.map(node => ({
      ...node,
      position: newPositions[node.id] || node.position
    }))
    setNodes(updatedNodes)
  }, [lineage.nodes, nodes, setNodes])

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900">
          Lineage flow chart
        </h2>
        <button
          onClick={onLayout}
          className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          Re-layout
        </button>
      </div>
      
      <div className="h-[600px] w-full border border-gray-200 rounded-lg overflow-hidden">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          fitView
          attributionPosition="bottom-left"
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
        >
          <Controls />
          <Background color="#f3f4f6" gap={16} />
        </ReactFlow>
      </div>

      {/* Accessible fallback list */}
      <div className="mt-8 pt-6 border-t border-gray-200">
        <h3 className="text-sm font-medium text-gray-900 mb-3">
          Lineage Details
        </h3>
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">Nodes:</h4>
            <div className="space-y-2">
              {lineage.nodes.map((node) => (
                <div key={node.id} className="bg-white rounded-lg p-3 border border-gray-200 hover:border-gray-300 transition-colors">
                  <div className="flex items-center space-x-2 mb-1">
                    <div className="flex-shrink-0 w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm font-semibold text-gray-900">{node.title}</span>
                  </div>
                  
                  {node.dataset && (
                    <div className="text-xs text-gray-500 mb-1">
                      Dataset: {node.dataset}.{node.variable}
                    </div>
                  )}
                  
                  {node.meta?.file && (
                    <div className="text-xs text-gray-500">
                      Source: {node.meta.file}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">Connections:</h4>
            <div className="space-y-3">
              {initialEdges.map((edge) => (
                <div key={edge.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:border-gray-300 transition-colors">
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-sm font-semibold text-gray-900">{edge.source}</span>
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                    <span className="text-sm font-semibold text-gray-900">{edge.target}</span>
                  </div>
                  
                  {edge.data?.label && (
                    <div className="mb-2">
                      <span className="inline-block px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-md">
                        {edge.data.label}
                      </span>
                    </div>
                  )}
                  
                  {edge.data?.explanation && (
                    <div className="text-sm text-gray-700 leading-relaxed">
                      {edge.data.explanation}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
