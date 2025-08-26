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
  ReactFlowProvider,
  useReactFlow,
} from 'reactflow'
import * as dagre from 'dagre'
import 'reactflow/dist/style.css'
import type { LineageGraph as LineageGraphType, LineageNode, LineageEdge } from '@/types/lineage'
import { getTypeColors, type ArtifactType } from '@/lib/colors'

// Custom CSS to hide React Flow attribution
const hideAttributionCSS = `
  .react-flow__attribution {
    display: none !important;
  }
`

// Move nodeTypes and edgeTypes outside component to prevent recreation on every render
const nodeTypes = {}
const edgeTypes = {}

interface LineageGraphProps {
  lineage: LineageGraphType
}

// Simplified node styling based on type using centralized color system
const getNodeStyle = (node: LineageNode) => {
  const baseStyle = {
    border: '4px solid white', // Optimal border: 2.5% of node width for visual definition
    borderRadius: '20px', // Optimal radius: 12.5% of node height for modern aesthetics
    width: 280, // Match layout calculation for consistency
    height: 160, // Match layout calculation for consistency
    color: 'white',
    fontSize: '20px', // Optimal: 12.5% of node height for perfect readability
    fontWeight: 700, // Bold weight for maximum contrast and readability
    boxShadow: '0 10px 25px -6px rgba(0, 0, 0, 0.25)', // Enhanced depth perception
    padding: '12px', // Optimal padding: 7.5% of node dimensions
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }
  
  // Get colors from centralized system, with fallback for unknown types
  const nodeType = (node.type || 'SDTM') as ArtifactType
  const colors = getTypeColors(nodeType)
  
  return {
    ...baseStyle,
    background: colors.background,
    border: `3px solid ${colors.border}`,
    color: colors.text,
  }
}

// Enhanced edge styling for better visibility
const getEdgeStyle = () => {
  return {
    stroke: '#374151', // Darker color for maximum contrast
    strokeWidth: 4, // Optimal: 2.5% of node width for clear visibility
    strokeDasharray: 'none',
  }
}

// Smart automatic layout with auto-wrap capability
const getLayoutedElements = (nodes: readonly LineageNode[], edges: readonly LineageEdge[]) => {
  // Create a new graph instance for each layout calculation
  const graph = new dagre.graphlib.Graph()
  graph.setDefaultEdgeLabel(() => ({}))
  
  // Dynamic layout configuration based on node count
  const nodeCount = nodes.length
  const isCompactLayout = nodeCount > 4 // Auto-wrap when more than 4 nodes
  
  graph.setGraph({ 
    rankdir: 'LR', // Left to right layout for lineage flow
    align: 'UL',   // Upper-left alignment for better space utilization
    ranksep: isCompactLayout ? 140 : 180,  // Compact spacing for auto-wrap
    nodesep: isCompactLayout ? 80 : 120,   // Compact vertical spacing
    edgesep: 60,   // Edge separation: 0.5x node width for clean connections
    marginx: 60,   // Reduced margin for better space utilization
    marginy: 60    // Reduced margin for better space utilization
  })
  
  // Add nodes to the graph with optimal HCI dimensions
  nodes.forEach((node) => {
    graph.setNode(node.id, { width: 280, height: 160 }) // Golden ratio: 1.75:1, optimal for text readability
  })
  
  // Add edges to the graph
  edges.forEach((edge) => {
    graph.setEdge(edge.from, edge.to)
  })
  
  // Calculate the layout
  dagre.layout(graph)
  
  // Extract the positioned nodes
  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = graph.node(node.id)
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - nodeWithPosition.width / 2,
        y: nodeWithPosition.y - nodeWithPosition.height / 2,
      },
    }
  })
  
  return { nodes: layoutedNodes, edges }
}

// Inner component that uses React Flow hooks
function LineageGraphInner({ lineage }: LineageGraphProps) {
  const { fitView } = useReactFlow()
  
  // Create layouted elements
  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(() => {
    return getLayoutedElements(lineage.nodes, lineage.edges)
  }, [lineage.nodes, lineage.edges])
  
  // Convert to React Flow format
  const initialNodes: Node[] = useMemo(() => {
    return layoutedNodes.map((node) => ({
      id: node.id,
      type: 'default',
      position: node.position,
      data: {
        label: (
          <div className="text-center px-6 py-3">
            <div className="font-black text-white text-xl leading-tight tracking-wide">
              {node.label || node.title}
            </div>
          </div>
        ),
        group: node.group,
        type: node.type,
      },
      style: getNodeStyle(node),
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    }))
  }, [layoutedNodes])

  const initialEdges: Edge[] = useMemo(() => {
    return layoutedEdges.map((edge) => ({
      id: `${edge.from}-${edge.to}`,
      source: edge.from,
      target: edge.to,
      type: 'smoothstep', // Better edge routing
      style: getEdgeStyle(),
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 24, // Optimal: 8.6% of node width for clear direction
        height: 24, // Optimal: 15% of node height for clear direction
        color: '#374151', // Match edge color for consistency
      },
      data: {
        label: edge.label,
        explanation: edge.explanation,
      },
    }))
  }, [layoutedEdges])

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, , onEdgesChange] = useEdgesState(initialEdges)

  // Simple re-layout function using official React Flow methods
  const onLayout = useCallback(() => {
    const { nodes: newLayoutedNodes } = getLayoutedElements(lineage.nodes, lineage.edges)
    const updatedNodes = newLayoutedNodes.map((node) => ({
      id: node.id,
      type: 'default',
      position: node.position,
      data: {
        label: (
          <div className="text-center px-6 py-3">
            <div className="font-black text-white text-xl leading-tight tracking-wide">
              {node.label || node.title}
            </div>
          </div>
        ),
        group: node.group,
        type: node.type,
      },
      style: getNodeStyle(node),
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    }))
    setNodes(updatedNodes)
    
    // Use official fitView method
    setTimeout(() => fitView(), 100)
  }, [lineage.nodes, lineage.edges, setNodes, fitView])

  // Initial fit view using official method
  useMemo(() => {
    setTimeout(() => fitView(), 100)
  }, [fitView])

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
      {/* Inject CSS to hide React Flow attribution */}
      <style dangerouslySetInnerHTML={{ __html: hideAttributionCSS }} />
      
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
      
      <div className="h-[700px] w-full border border-gray-200 rounded-lg overflow-hidden">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          fitView
          fitViewOptions={{ padding: 0.15, includeHiddenNodes: false }}
          minZoom={0.2}
          maxZoom={1.5}
          attributionPosition="bottom-left"
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag={true}
          zoomOnScroll={true}
          zoomOnPinch={true}
          preventScrolling={false}
        >
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
                    <span className="text-sm font-semibold text-gray-900">{node.label || node.title}</span>
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

// Main component with ReactFlowProvider
export function LineageGraphReactFlow({ lineage }: LineageGraphProps) {
  return (
    <ReactFlowProvider>
      <LineageGraphInner lineage={lineage} />
    </ReactFlowProvider>
  )
}
