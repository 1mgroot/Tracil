import { memo, useCallback, useState, useEffect, type ReactNode } from 'react'
import type { DatasetWithGroup, Variable } from '@/types/variables'
import type { LineageGraph } from '@/types/lineage'
import { SearchBar } from '@/components/search/SearchBar'
import { DatasetHeader } from './DatasetHeader'
import { VariablesGrid } from './VariablesGrid'
import { VariablesErrorBoundary } from './VariablesErrorBoundary'
import { TraceabilitySummary } from '@/components/lineage/TraceabilitySummary'
import { LineageGraph as LineageGraphComponent } from '@/components/lineage/LineageGraph'
import { analyzeLineage } from '@/lib/ai/entrypoints/analyzeLineage'

interface VariablesBrowserProps {
  readonly dataset: DatasetWithGroup
  readonly onVariableSelect?: (variable: Variable) => void
  readonly onEscape?: () => void
}

interface VariablesBrowserState {
  selectedVariable: { name: string; lineage?: LineageGraph } | null
  showLineage: boolean
  isLoadingLineage: boolean
}

export const VariablesBrowser = memo(function VariablesBrowser({ 
  dataset,
  onVariableSelect,
  onEscape
}: VariablesBrowserProps): ReactNode {
  const [state, setState] = useState<VariablesBrowserState>({
    selectedVariable: null,
    showLineage: false,
    isLoadingLineage: false
  })

  const handleVariableSelect = useCallback(async (variable: Variable) => {
    console.log('Variable selected:', variable.name)
    
    // Set loading state
    setState(prev => ({
      ...prev,
      selectedVariable: { name: variable.name },
      showLineage: true,
      isLoadingLineage: true
    }))

    try {
      // Fetch lineage data
      const lineage = await analyzeLineage({
        dataset: dataset.name,
        variable: variable.name
      })

      // Update state with lineage data
      setState(prev => ({
        ...prev,
        selectedVariable: { name: variable.name, lineage },
        isLoadingLineage: false
      }))

      // Notify parent component
      onVariableSelect?.(variable)
    } catch (error) {
      console.error('Failed to load lineage:', error)
      setState(prev => ({
        ...prev,
        isLoadingLineage: false
      }))
    }
  }, [dataset.name, onVariableSelect])

  const handleBackToVariables = useCallback(() => {
    setState({
      selectedVariable: null,
      showLineage: false,
      isLoadingLineage: false
    })
  }, [])

  const handleEscape = useCallback(() => {
    if (state.showLineage) {
      handleBackToVariables()
    } else {
      onEscape?.()
    }
  }, [state.showLineage, handleBackToVariables, onEscape])

  // Reset lineage when dataset changes
  useEffect(() => {
    setState({
      selectedVariable: null,
      showLineage: false,
      isLoadingLineage: false
    })
  }, [dataset.id])

  return (
    <VariablesErrorBoundary>
      <main 
        role="main" 
        aria-label="Variables Browser"
        className="flex flex-col h-full overflow-hidden"
        aria-live="polite"
      >
        <div className="px-6 pt-6 pb-4">
          <SearchBar placeholder="Search variables..." />
        </div>
        <div className="px-6">
          <DatasetHeader dataset={dataset} />
        </div>
        
        {/* Variables Section - Collapsible to single row when lineage is shown */}
        <div className={`${state.showLineage ? 'flex-shrink-0' : 'flex-1 overflow-auto'}`}>
          <VariablesGrid 
            key={dataset.id}
            variables={dataset.variables}
            group={dataset.group}
            onVariableSelect={handleVariableSelect}
            onEscape={handleEscape}
            compact={state.showLineage}
            selectedVariable={state.selectedVariable?.name || null}
          />
        </div>

        {/* Lineage Section - Only visible when variable selected */}
        {state.showLineage && (
          <div className="flex-1 overflow-auto px-6 pb-6 space-y-6">
            {/* Back Button */}
            <div className="flex justify-start">
              <button
                onClick={handleBackToVariables}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                aria-label="Back to variables"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Variables
              </button>
            </div>

            {/* Traceability Summary */}
            {state.selectedVariable?.lineage && (
              <TraceabilitySummary lineage={state.selectedVariable.lineage} />
            )}

            {/* Lineage Graph */}
            {state.selectedVariable?.lineage && (
              <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Lineage Flow Chart
                </h2>
                <LineageGraphComponent lineage={state.selectedVariable.lineage} />
              </div>
            )}

            {/* Loading State */}
            {state.isLoadingLineage && (
              <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-3 text-gray-600">Loading lineage data...</span>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </VariablesErrorBoundary>
  )
})
