import { useEffect, useState } from 'react'
import type { LineageGraph } from '@/types/lineage'
import { ChevronDown, ChevronRight } from 'lucide-react'

interface TraceabilitySummaryProps {
  lineage: LineageGraph
}

export function TraceabilitySummary({ lineage }: TraceabilitySummaryProps) {
  // Smart state management - only expand one section at a time to save space
  const [nodesExpanded, setNodesExpanded] = useState(true)
  const [connectionsExpanded, setConnectionsExpanded] = useState(false)

  // Debug: Log gaps data using useEffect
  useEffect(() => {
    console.log('🔍 Debug - Full lineage object:', lineage)
    console.log('🔍 Debug - Summary:', lineage.summary)
    console.log('🔍 Debug - Summary type:', typeof lineage.summary)
    console.log('🔍 Debug - Summary length:', lineage.summary?.length)
    
    if (lineage.gaps?.notes) {
      console.log('🔍 Debug - Gaps data:', lineage.gaps.notes)
      console.log('🔍 Debug - Gaps data length:', lineage.gaps.notes.length)
      console.log('🔍 Debug - Gaps data types:', lineage.gaps.notes.map((note, i) => ({ index: i, note, type: typeof note })))
    }
  }, [lineage])

  // Smart toggle handlers - auto-collapse the other section when expanding one
  const handleNodesToggle = () => {
    if (!nodesExpanded && connectionsExpanded) {
      setConnectionsExpanded(false)
    }
    setNodesExpanded(!nodesExpanded)
  }

  const handleConnectionsToggle = () => {
    if (!connectionsExpanded && nodesExpanded) {
      setNodesExpanded(false)
    }
    setConnectionsExpanded(!connectionsExpanded)
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col h-full">
      {/* Compact header */}
      <div className="flex-shrink-0 p-4 pb-3">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">
          AI-Generated Traceability Summary
        </h2>
        
        <div className="space-y-3">
          <div>
            <p className="text-gray-700 leading-relaxed text-sm">
              {lineage.summary}
            </p>
          </div>
          
          {lineage.gaps?.notes && lineage.gaps.notes.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-2">
                Gaps & Notes
              </h3>
              <div className="max-h-16 overflow-y-auto">
                <ul className="space-y-1">
                  {lineage.gaps.notes.map((note, index) => {
                    // Debug: Log each note and its index
                    console.log(`🔍 Debug - Note ${index}:`, note)
                    // Create a unique key that combines note content and index
                    const uniqueKey = `gap-${index}-${note.substring(0, 20).replace(/[^a-zA-Z0-9]/g, '-')}`
                    return (
                      <li key={uniqueKey} className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200">
                        {note}
                      </li>
                    )
                  })}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Expanded Lineage Details section */}
      <div className="flex-1 overflow-hidden px-4 pb-4">
        <div className="border-t border-gray-200 pt-3 h-full flex flex-col">
          <h3 className="text-sm font-medium text-gray-900 mb-3 flex-shrink-0">
            Lineage Details
          </h3>
          
          <div className="flex-1 flex flex-col space-y-3 min-h-0">
            {/* Collapsible Nodes Section - Takes more space when expanded */}
            <div className={`border border-gray-200 rounded-lg overflow-hidden flex-shrink-0 ${
              nodesExpanded ? 'flex-1 min-h-0' : ''
            }`}>
              <button
                onClick={handleNodesToggle}
                className="flex items-center justify-between w-full px-3 py-2 text-left text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 transition-colors rounded-t-lg"
                aria-expanded={nodesExpanded}
                aria-controls="nodes-content"
              >
                <div className="flex items-center gap-2">
                  {nodesExpanded ? (
                    <ChevronDown className="h-4 w-4 text-gray-500 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-gray-500 flex-shrink-0" />
                  )}
                  <span>Nodes</span>
                </div>
                <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
                  {lineage.nodes.length}
                </span>
              </button>
              
              <div
                id="nodes-content"
                className={`overflow-hidden ${
                  nodesExpanded ? 'flex-1 min-h-0' : 'max-h-0 opacity-0'
                }`}
              >
                <div className="h-full overflow-y-auto px-3 pb-3">
                  <div className="space-y-2 pt-2">
                    {lineage.nodes.map((node) => (
                      <div key={node.id} className="bg-gray-50 rounded-md p-2 border border-gray-200 hover:border-gray-300 transition-colors">
                        <div className="flex items-center space-x-2 mb-1">
                          <div className="flex-shrink-0 w-2 h-2 bg-gray-400 rounded-full"></div>
                          <span className="text-xs font-semibold text-gray-900 truncate">{node.title}</span>
                        </div>
                        
                        {node.dataset && (
                          <div className="text-xs text-gray-500 truncate">
                            Dataset: {node.dataset}.{node.variable}
                          </div>
                        )}
                        
                        {node.meta?.file && (
                          <div className="text-xs text-gray-500 truncate">
                            Source: {node.meta.file}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Collapsible Connections Section - Takes more space when expanded */}
            <div className={`border border-gray-200 rounded-lg overflow-hidden flex-shrink-0 ${
              connectionsExpanded ? 'flex-1 min-h-0' : ''
            }`}>
              <button
                onClick={handleConnectionsToggle}
                className="flex items-center justify-between w-full px-3 py-2 text-left text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 transition-colors rounded-t-lg"
                aria-expanded={connectionsExpanded}
                aria-controls="connections-content"
              >
                <div className="flex items-center gap-2">
                  {connectionsExpanded ? (
                    <ChevronDown className="h-4 w-4 text-gray-500 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-gray-500 flex-shrink-0" />
                  )}
                  <span>Connections</span>
                </div>
                <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
                  {lineage.edges.length}
                </span>
              </button>
              
              <div
                id="connections-content"
                className={`overflow-hidden ${
                  connectionsExpanded ? 'flex-1 min-h-0' : 'max-h-0 opacity-0'
                }`}
              >
                <div className="h-full overflow-y-auto px-3 pb-3">
                  <div className="space-y-2 pt-2">
                    {lineage.edges.map((edge) => (
                      <div key={`${edge.from}-${edge.to}`} className="bg-gray-50 rounded-md p-2 border border-gray-200 hover:border-gray-300 transition-colors">
                        <div className="flex items-center space-x-2 mb-1">
                          <div className="flex-shrink-0 w-2 h-2 bg-gray-400 rounded-full"></div>
                          <span className="text-xs font-semibold text-gray-900 truncate">{edge.from}</span>
                          <svg className="w-3 h-3 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                          </svg>
                          <span className="text-xs font-semibold text-gray-900 truncate">{edge.to}</span>
                        </div>
                        
                        {edge.label && (
                          <div className="mb-1">
                            <span className="inline-block px-1.5 py-0.5 text-xs font-medium bg-gray-200 text-gray-700 rounded">
                              {edge.label}
                            </span>
                          </div>
                        )}
                        
                        {edge.explanation && (
                          <div className="text-xs text-gray-700 leading-relaxed overflow-hidden" style={{ 
                            display: '-webkit-box', 
                            WebkitLineClamp: 2, 
                            WebkitBoxOrient: 'vertical' 
                          }}>
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
        </div>
      </div>
    </div>
  )
}
