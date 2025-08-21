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
      case 'aCRF': return 'bg-[var(--accent-acrf)]'
      case 'TLF': return 'bg-[var(--accent-tlf)]'
      default: return 'bg-gray-500'
    }
  }

  const getGroupHoverColor = (group: string): string => {
    switch (group) {
      case 'ADaM': return 'hover:bg-[var(--accent-adam-hover)]'
      case 'SDTM': return 'hover:bg-[var(--accent-sdtm-hover)]'
      case 'aCRF': return 'hover:bg-[var(--accent-acrf-hover)]'
      case 'TLF': return 'hover:bg-[var(--accent-tlf-hover)]'
      default: return 'hover:bg-gray-600'
    }
  }

  // Calculate node positions with horizontal layout and wrapping
  const getNodePositions = () => {
    const nodeWidth = 120 // Approximate width of each node button
    const nodeHeight = 48 // Approximate height of each node button
    const horizontalSpacing = 40 // Space between nodes horizontally
    const verticalSpacing = 80 // Space between rows
    const containerWidth = 800 // Approximate container width for wrapping
    const bottomBuffer = 120 // Buffer space above the horizontal line
    
    const positions: { [key: string]: { x: number; y: number; width: number; height: number } } = {}
    let currentX = 0
    let currentY = 0
    let maxHeightInRow = 0
    
    lineage.nodes.forEach((node) => {
      // Check if we need to wrap to a new row
      if (currentX + nodeWidth > containerWidth && currentX > 0) {
        currentX = 0
        currentY += maxHeightInRow + verticalSpacing
        maxHeightInRow = 0
      }
      
      // Ensure we don't position nodes too close to the bottom horizontal line
      const maxY = 500 - bottomBuffer // Maximum Y position before the line
      const adjustedY = Math.min(currentY + nodeHeight / 2, maxY)
      
      positions[node.id] = {
        x: currentX + nodeWidth / 2,
        y: adjustedY,
        width: nodeWidth,
        height: nodeHeight
      }
      
      currentX += nodeWidth + horizontalSpacing
      maxHeightInRow = Math.max(maxHeightInRow, nodeHeight)
    })
    
    return positions
  }

  const nodePositions = getNodePositions()

  // Calculate connection points at node edges
  const getConnectionPoints = (fromId: string, toId: string) => {
    const fromPos = nodePositions[fromId]
    const toPos = nodePositions[toId]
    
    if (!fromPos || !toPos) return null
    
    // Calculate the direction vector from from to to
    const dx = toPos.x - fromPos.x
    const dy = toPos.y - fromPos.y
    
    // Normalize the direction vector
    const length = Math.sqrt(dx * dx + dy * dy)
    const normalizedDx = dx / length
    const normalizedDy = dy / length
    
    // Calculate connection points at node edges
    const fromEdgeX = fromPos.x + (normalizedDx * fromPos.width / 2)
    const fromEdgeY = fromPos.y + (normalizedDy * fromPos.height / 2)
    const toEdgeX = toPos.x - (normalizedDx * toPos.width / 2)
    const toEdgeY = toPos.y - (normalizedDy * toPos.height / 2)
    
    return {
      from: { x: fromEdgeX, y: fromEdgeY },
      to: { x: toEdgeX, y: toEdgeY }
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
        {edge.confidence && (
          <div className="text-sm text-gray-600">
            Confidence: {Math.round(edge.confidence * 100)}%
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
    <div className="relative min-h-[500px] overflow-auto pb-8">
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
      
      {/* Render edges as straight SVG connections */}
      <svg className="absolute inset-0 w-full h-[calc(100%-120px)] pointer-events-none">
        {lineage.edges.map((edge) => {
          const connectionPoints = getConnectionPoints(edge.from, edge.to)
          
          if (!connectionPoints) return null
          
          return (
            <g key={`${edge.from}-${edge.to}`}>
              {/* Straight line connection */}
              <line
                x1={connectionPoints.from.x}
                y1={connectionPoints.from.y}
                x2={connectionPoints.to.x}
                y2={connectionPoints.to.y}
                stroke="#6b7280"
                strokeWidth="2"
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
      <div className="mt-16 pt-8 border-t border-gray-200 bg-gray-50 rounded-lg p-6">
        <h3 className="text-sm font-medium text-gray-900 mb-3">
          Lineage Details (Accessibility)
        </h3>
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Nodes:</h4>
            <ul className="space-y-1">
              {lineage.nodes.map((node) => (
                <li key={node.id} className="text-sm text-gray-600">
                  <span className="font-medium">{node.title}</span>
                  {node.dataset && ` (${node.dataset}.${node.variable})`}
                  {node.meta?.file && ` - Source: ${node.meta.file}`}
                </li>
              ))}
            </ul>
          </div>
          
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Connections:</h4>
            <ul className="space-y-1">
              {lineage.edges.map((edge) => (
                <li key={`${edge.from}-${edge.to}`} className="text-sm text-gray-600">
                  <span className="font-medium">{edge.from}</span> → <span className="font-medium">{edge.to}</span>
                  {edge.label && ` (${edge.label})`}
                  {edge.confidence && ` - Confidence: ${Math.round(edge.confidence * 100)}%`}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
