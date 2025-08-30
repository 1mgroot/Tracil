import type { LineageGraph as LineageGraphType, LineageNode, LineageEdge } from '@/types/lineage'
import { useState } from 'react'

interface LineageGraphProps {
  lineage: LineageGraphType
}

interface TooltipData {
  type: 'node' | 'edge'
  content: React.ReactNode
  x: number
  y: number
}

export function LineageGraph({ lineage }: LineageGraphProps) {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null)
  


  const getGroupColor = (group: string): string => {
    switch (group) {
      case 'ADaM': return 'bg-[var(--accent-adam)]'
      case 'SDTM': return 'bg-[var(--accent-sdtm)]'
      case 'CRF': return 'bg-[var(--accent-acrf)]'
      case 'TLF': return 'bg-[var(--accent-tlf)]'
      default: return 'bg-gray-500'
    }
  }

  const getGroupHoverColor = (group: string): string => {
    switch (group) {
      case 'ADaM': return 'hover:bg-[var(--accent-adam-hover)]'
      case 'SDTM': return 'hover:bg-[var(--accent-sdtm-hover)]'
      case 'CRF': return 'hover:bg-[var(--accent-acrf-hover)]'
      case 'TLF': return 'hover:bg-[var(--accent-tlf-hover)]'
      default: return 'hover:bg-gray-600'
    }
  }

  // Calculate node positions with hierarchical tree layout
  const getNodePositions = () => {
    const nodeWidth = 140 // Increased width for better readability
    const nodeHeight = 48
    const horizontalSpacing = 180 // Increased horizontal spacing
    const verticalSpacing = 100 // Increased vertical spacing
    
    const positions: { [key: string]: { x: number; y: number; width: number; height: number } } = {}
    
    // Build adjacency lists for incoming and outgoing edges
    const incomingEdges: { [key: string]: string[] } = {}
    const outgoingEdges: { [key: string]: string[] } = {}
    
    lineage.nodes.forEach(node => {
      incomingEdges[node.id] = []
      outgoingEdges[node.id] = []
    })
    
    lineage.edges.forEach(edge => {
      outgoingEdges[edge.from].push(edge.to)
      incomingEdges[edge.to].push(edge.from)
    })
    
    // Find root nodes (nodes with no incoming edges)
    const rootNodes = lineage.nodes.filter(node => incomingEdges[node.id].length === 0)
    
    // Assign levels using BFS
    const levels: { [key: string]: number } = {}
    const queue = [...rootNodes.map(node => ({ id: node.id, level: 0 }))]
    const visited = new Set<string>()
    
    while (queue.length > 0) {
      const item = queue.shift()
      if (!item) continue
      const { id, level } = item
      
      if (visited.has(id)) continue
      visited.add(id)
      
      levels[id] = level
      
      // Add children to queue
      outgoingEdges[id].forEach(childId => {
        if (!visited.has(childId)) {
          queue.push({ id: childId, level: level + 1 })
        }
      })
    }
    
    // Group nodes by level
    const nodesByLevel: { [level: number]: string[] } = {}
    Object.entries(levels).forEach(([nodeId, level]) => {
      if (!nodesByLevel[level]) nodesByLevel[level] = []
      nodesByLevel[level].push(nodeId)
    })
    
    // Position nodes level by level
    
    Object.entries(nodesByLevel).forEach(([levelStr, nodeIds]) => {
      const level = parseInt(levelStr)
      const y = level * verticalSpacing + nodeHeight / 2 + 50 // Start with some top padding
      
      // Calculate total width needed for this level
      const totalWidth = nodeIds.length * nodeWidth + (nodeIds.length - 1) * horizontalSpacing
      const startX = Math.max(nodeWidth / 2, (1000 - totalWidth) / 2) // Center the level, min width
      
      nodeIds.forEach((nodeId, index) => {
        const x = startX + index * (nodeWidth + horizontalSpacing)
        
        positions[nodeId] = {
          x,
          y,
          width: nodeWidth,
          height: nodeHeight
        }
      })
    })
    
    return positions
  }

  const nodePositions = getNodePositions()

  // Calculate connection points at node edges with improved routing
  const getConnectionPoints = (fromId: string, toId: string) => {
    const fromPos = nodePositions[fromId]
    const toPos = nodePositions[toId]
    
    if (!fromPos || !toPos) return null
    
    // Calculate the direction vector from from to to
    const dx = toPos.x - fromPos.x
    const dy = toPos.y - fromPos.y
    
    // Normalize the direction vector
    const length = Math.sqrt(dx * dx + dy * dy)
    if (length === 0) return null
    
    // For better visual flow, prefer connecting from bottom of upper node to top of lower node
    let fromEdgeX, fromEdgeY, toEdgeX, toEdgeY
    
    if (Math.abs(dy) > Math.abs(dx)) {
      // Vertical connection is dominant
      if (dy > 0) {
        // From node is above to node
        fromEdgeX = fromPos.x
        fromEdgeY = fromPos.y + fromPos.height / 2
        toEdgeX = toPos.x
        toEdgeY = toPos.y - toPos.height / 2
      } else {
        // From node is below to node
        fromEdgeX = fromPos.x
        fromEdgeY = fromPos.y - fromPos.height / 2
        toEdgeX = toPos.x
        toEdgeY = toPos.y + toPos.height / 2
      }
    } else {
      // Horizontal connection is dominant
      if (dx > 0) {
        // From node is left of to node
        fromEdgeX = fromPos.x + fromPos.width / 2
        fromEdgeY = fromPos.y
        toEdgeX = toPos.x - toPos.width / 2
        toEdgeY = toPos.y
      } else {
        // From node is right of to node
        fromEdgeX = fromPos.x - fromPos.width / 2
        fromEdgeY = fromPos.y
        toEdgeX = toPos.x + toPos.width / 2
        toEdgeY = toPos.y
      }
    }
    
    return {
      from: { x: fromEdgeX, y: fromEdgeY },
      to: { x: toEdgeX, y: toEdgeY }
    }
  }

  // Create curved paths for better visual flow
  const createPath = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const pathDy = to.y - from.y
    
    // For hierarchical layout, use smooth curves
    if (Math.abs(pathDy) > 20) {
      // Vertical flow - use curved path
      const midY = from.y + pathDy * 0.6
      return `M ${from.x} ${from.y} Q ${from.x} ${midY} ${to.x} ${to.y}`
    } else {
      // Horizontal flow - use straight line
      return `M ${from.x} ${from.y} L ${to.x} ${to.y}`
    }
  }

  const handleNodeMouseEnter = (event: React.MouseEvent, node: LineageNode) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const tooltipContent = (
      <div className="space-y-2">
        <div className="font-semibold text-gray-900">{node.title}</div>
        {node.dataset && node.variable && (
          <div className="text-sm text-gray-600">
            Dataset: {node.dataset}.{node.variable}
          </div>
        )}
        {node.meta?.file && (
          <div className="text-sm text-gray-600">
            Source: {node.meta.file}
          </div>
        )}
        {node.meta?.notes && (
          <div className="text-sm text-gray-600">
            Notes: {node.meta.notes}
          </div>
        )}
        {node.description && (
          <div className="text-sm text-gray-600">
            Description: {node.description}
          </div>
        )}
        {node.explanation && (
          <div className="text-sm text-gray-600">
            Explanation: {node.explanation}
          </div>
        )}
        <div className="text-sm text-gray-600">
          Group: {node.group}
        </div>
        <div className="text-sm text-gray-600">
          Type: {node.kind}
        </div>
      </div>
    )
    
    setTooltip({
      type: 'node',
      content: tooltipContent,
      x: rect.left + rect.width / 2,
      y: rect.top - 10
    })
  }

  const handleNodeMouseLeave = () => {
    setTooltip(null)
  }

  const handleEdgeMouseEnter = (event: React.MouseEvent, edge: LineageEdge) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const tooltipContent = (
      <div className="space-y-2">
        <div className="font-semibold text-gray-900">Connection</div>
        <div className="text-sm text-gray-600">
          From: {edge.from}
        </div>
        <div className="text-sm text-gray-600">
          To: {edge.to}
        </div>
        {edge.label && (
          <div className="text-sm text-gray-600">
            Process: {edge.label}
          </div>
        )}
        {edge.explanation && (
          <div className="text-sm text-gray-600">
            Explanation: {edge.explanation}
          </div>
        )}

      </div>
    )
    
    setTooltip({
      type: 'edge',
      content: tooltipContent,
      x: rect.left + rect.width / 2,
      y: rect.top - 10
    })
  }

  const handleEdgeMouseLeave = () => {
    setTooltip(null)
  }



  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900 mb-6">
        Lineage Flow Chart
      </h2>
      
      <div className="relative min-h-[600px] overflow-auto" style={{ width: '100%', minWidth: '1200px' }}>
        {/* Render nodes as positioned buttons */}
        {lineage.nodes.map((node) => {
          const position = nodePositions[node.id]
          if (!position) return null
          
          return (
            <div
              key={node.id}
              className="absolute"
              style={{
                left: `${position.x}px`,
                top: `${position.y}px`,
                transform: 'translate(-50%, -50%)'
              }}
            >
              <button 
                className={`px-4 py-2 rounded-lg text-white font-medium shadow-md border-2 border-white
                  ${getGroupColor(node.group)} 
                  ${getGroupHoverColor(node.group)}
                  transition-all duration-200
                  hover:scale-105 hover:shadow-lg
                  focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
                onMouseEnter={(e) => handleNodeMouseEnter(e, node)}
                onMouseLeave={handleNodeMouseLeave}
              >
                {node.title}
              </button>
            </div>
          )
        })}
        
        {/* Render edges as curved SVG paths */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          {lineage.edges.map((edge) => {
            const connectionPoints = getConnectionPoints(edge.from, edge.to)
            
            if (!connectionPoints) return null
            
            const pathData = createPath(connectionPoints.from, connectionPoints.to)
            
            return (
              <g key={`${edge.from}-${edge.to}`}>
                {/* Curved path connection */}
                <path
                  d={pathData}
                  stroke="#6b7280"
                  strokeWidth="2"
                  fill="none"
                  markerEnd="url(#arrowhead)"
                  className="pointer-events-auto cursor-pointer hover:stroke-gray-800 hover:stroke-[3px] transition-all duration-200"
                  onMouseEnter={(e) => handleEdgeMouseEnter(e, edge)}
                  onMouseLeave={handleEdgeMouseLeave}
                />
              </g>
            )
          })}
          
          {/* Arrow marker definition */}
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon
                points="0 0, 10 3.5, 0 7"
                fill="#6b7280"
              />
            </marker>
          </defs>
        </svg>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute z-50 px-4 py-3 bg-white border border-gray-200 text-gray-900 text-sm rounded-lg shadow-lg pointer-events-none"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translate(-50%, -100%)'
          }}
        >
          {tooltip.content}
          {/* Tooltip arrow */}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-200"></div>
        </div>
      )}
      
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
                  
                  {node.description && (
                    <div className="text-xs text-gray-600 mt-1">
                      <span className="font-medium text-gray-700">Description:</span> {node.description}
                    </div>
                  )}
                  
                  {node.explanation && (
                    <div className="text-xs text-gray-600 mt-1">
                      <span className="font-medium text-gray-700">Explanation:</span> {node.explanation}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">Connections:</h4>
            <div className="space-y-3">
              {lineage.edges.map((edge) => (
                <div key={`${edge.from}-${edge.to}`} className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:border-gray-300 transition-colors">
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-sm font-semibold text-gray-900">{edge.from}</span>
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                    <span className="text-sm font-semibold text-gray-900">{edge.to}</span>
                  </div>
                  
                  {edge.label && (
                    <div className="mb-2">
                      <span className="inline-block px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-md">
                        {edge.label}
                      </span>
                    </div>
                  )}
                  
                  {edge.explanation && (
                    <div className="text-sm text-gray-700 leading-relaxed">
                      {edge.explanation}
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
