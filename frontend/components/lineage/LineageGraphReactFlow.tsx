import { useMemo, memo } from 'react'
import ReactFlow, {
  Node,
  Edge,
  Background,
  useNodesState,
  useEdgesState,
  Position,
  MarkerType,
  ReactFlowProvider,
  useReactFlow,
  Handle,
  NodeProps,
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

// Custom node component with group tag following React Flow best practices
const CustomLineageNode = memo<NodeProps>(({ data }) => {
  const nodeType = (data.group || 'SDTM') as ArtifactType
  const colors = getTypeColors(nodeType)
  
  return (
    <div 
      className="relative"
      style={{
        border: `3px solid ${colors.border}`,
        borderRadius: '20px',
        width: 280,
        height: 160,
        background: colors.background,
        color: colors.text,
        fontSize: '20px',
        fontWeight: 700,
        boxShadow: '0 10px 25px -6px rgba(0, 0, 0, 0.25)',
        padding: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Main node content */}
      <div className="text-center px-6 py-3">
        <div className="font-black text-white text-xl leading-tight tracking-wide">
          {data.title || data.label}
        </div>
      </div>
      
      {/* Group tag - positioned as a small badge in the top-right corner */}
      <div 
        className="absolute -top-2 -right-2 px-2 py-1 text-xs font-semibold rounded-md"
        style={{
          backgroundColor: colors.border,
          color: colors.text,
          fontSize: '11px',
          minWidth: '32px',
          textAlign: 'center',
          border: '2px solid white',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
        }}
      >
        {data.group}
      </div>
      
      {/* React Flow handles for connections */}
      <Handle 
        type="target" 
        position={Position.Left}
        style={{ background: colors.border, border: '2px solid white' }}
      />
      <Handle 
        type="source" 
        position={Position.Right}
        style={{ background: colors.border, border: '2px solid white' }}
      />
    </div>
  )
})

CustomLineageNode.displayName = 'CustomLineageNode'

// Move nodeTypes and edgeTypes outside component to prevent recreation on every render
const nodeTypes = {
  lineageNode: CustomLineageNode,
}
const edgeTypes = {}

interface LineageGraphProps {
  lineage: LineageGraphType
}

// Node styling is now handled by the custom component

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
      type: 'lineageNode',
      position: node.position,
      data: {
        title: node.title,
        group: node.group,
        type: node.group,
      },
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

  const [nodes, , onNodesChange] = useNodesState(initialNodes)
  const [edges, , onEdgesChange] = useEdgesState(initialEdges)



  // Initial fit view using official method
  useMemo(() => {
    setTimeout(() => fitView(), 100)
  }, [fitView])

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm h-full flex flex-col min-h-0">
      {/* Inject CSS to hide React Flow attribution */}
      <style dangerouslySetInnerHTML={{ __html: hideAttributionCSS }} />
      
      <div className="p-4 md:p-6 pb-3 flex-shrink-0">
        <h2 className="text-lg font-semibold text-gray-900">
          Lineage flow chart
        </h2>
      </div>
      
      <div className="flex-1 mx-4 md:mx-6 mb-4 md:mb-6 border border-gray-200 rounded-lg overflow-hidden min-h-0">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          fitView
          fitViewOptions={{ padding: 0.1, includeHiddenNodes: false }}
          minZoom={0.1}
          maxZoom={2.0}
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
