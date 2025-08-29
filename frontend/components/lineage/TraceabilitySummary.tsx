import { useEffect, useState } from 'react'
import type { LineageGraph } from '@/types/lineage'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { getNodeDisplayText, capitalizeWords } from '@/lib/utils'
import { getTypeColors, type ArtifactType } from '@/lib/colors'

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
    <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200/60 shadow-sm flex flex-col h-full overflow-hidden">
      {/* Compact header */}
      <div className="flex-shrink-0 p-6 pb-4">
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
                      <li key={uniqueKey} className="text-xs text-gray-700 bg-gray-50 px-2 py-1 rounded border border-gray-200">
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
      <div className="flex-1 overflow-hidden px-6 pb-6">
        <div className="border-t border-gray-200/60 pt-4 h-full flex flex-col">
          <div className="flex-1 flex flex-col space-y-4 min-h-0">
            {/* Collapsible Nodes Section - Takes more space when expanded */}
            <div className={`border border-gray-200/50 rounded-xl bg-gray-50/50 backdrop-blur-sm flex-shrink-0 overflow-hidden ${
              nodesExpanded ? 'flex-1 min-h-0' : ''
            }`}>
              <button
                onClick={handleNodesToggle}
                className="flex items-center justify-between w-full px-4 py-3 text-left text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-white/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-0 transition-all duration-200 backdrop-blur-sm"
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
                className={`transition-all duration-200 overflow-hidden ${
                  nodesExpanded ? 'max-h-[32rem]' : 'max-h-0'
                }`}
              >
                <div className="h-[32rem] overflow-y-auto px-4 pb-4">
                  <div className="space-y-2 pt-2">
                    {lineage.nodes.map((node) => {
                      const nodeType = (node.group || 'Unknown') as ArtifactType
                      const colors = getTypeColors(nodeType)
                      
                      return (
                        <div key={node.id} className="bg-gray-50 rounded-md p-2 border border-gray-200 hover:border-gray-300 transition-colors">
                          <div className="flex items-center space-x-2 mb-1">
                            <span 
                              className="inline-flex items-center justify-center w-16 px-1.5 py-0.5 text-xs font-medium rounded"
                              style={{ 
                                backgroundColor: colors.background,
                                color: colors.text 
                              }}
                            >
                              {nodeType}
                            </span>
                            <span className="text-xs font-semibold text-gray-900 truncate">{getNodeDisplayText(node)}</span>
                          </div>
                          
                          {node.id && (
                            <div className="text-xs text-gray-500 truncate">
                              {node.id}
                            </div>
                          )}
                          
                          {node.meta?.file && (
                            <div className="text-xs text-gray-600 leading-relaxed mt-1">aliz
                              Source: {node.meta.file}
                            </div>
                          )}
                          
                          {node.description && (
                            <div className="text-xs text-gray-600 leading-relaxed mt-1">
                              {node.description}
                            </div>
                          )}
                          
                          {node.explanation && (
                            <div className="text-xs text-gray-600 leading-relaxed mt-1">
                              <span className="font-medium text-gray-700">Explanation:</span> {node.explanation}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Collapsible Connections Section - Takes more space when expanded */}
            <div className={`border border-gray-200/50 rounded-xl bg-gray-50/50 backdrop-blur-sm flex-shrink-0 overflow-hidden ${
              connectionsExpanded ? 'flex-1 min-h-0' : ''
            }`}>
              <button
                onClick={handleConnectionsToggle}
                className="flex items-center justify-between w-full px-4 py-3 text-left text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-white/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-0 transition-all duration-200 backdrop-blur-sm"
                aria-expanded={connectionsExpanded}
                aria-controls="connections-content"
              >
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2">
                    {connectionsExpanded ? (
                      <ChevronDown className="h-4 w-4 text-gray-500 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-gray-500 flex-shrink-0" />
                    )}
                    <span>Connections</span>
                  </div>
                </div>
                <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
                  {lineage.edges.length}
                </span>
              </button>
              
              <div
                id="connections-content"
                className={`transition-all duration-200 overflow-hidden ${
                  connectionsExpanded ? 'max-h-[32rem]' : 'max-h-0'
                }`}
              >
                <div className="h-[32rem] overflow-y-auto px-4 pb-4">
                  <div className="space-y-2 pt-2">
                    {lineage.edges.map((edge) => (
                      <div key={`${edge.from}-${edge.to}`} className="bg-gray-50 rounded-md p-2 border border-gray-200 hover:border-gray-300 transition-colors">
                        <div className="flex items-center space-x-2 mb-1">
                          <div className="flex-shrink-0 w-2 h-2 bg-gray-400 rounded-full"></div>
                          <span className="text-xs font-semibold text-gray-900 truncate">{capitalizeWords(edge.from)}</span>
                          <svg className="w-3 h-3 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                          </svg>
                          <span className="text-xs font-semibold text-gray-900 truncate">{capitalizeWords(edge.to)}</span>
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
