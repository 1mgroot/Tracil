import { memo, useCallback, type ReactNode } from 'react'
import type { DatasetWithGroup, Variable } from '@/types/variables'
import { DatasetHeader } from './DatasetHeader'
import { VariablesGrid } from './VariablesGrid'
import { VariablesErrorBoundary } from './VariablesErrorBoundary'

interface VariablesBrowserProps {
  readonly dataset: DatasetWithGroup
  readonly onVariableSelect?: (variable: Variable) => void
  readonly onEscape?: () => void
  readonly onSearchClick?: () => void
}

export const VariablesBrowser = memo(function VariablesBrowser({ 
  dataset,
  onVariableSelect,
  onEscape,
  onSearchClick
}: VariablesBrowserProps): ReactNode {
  const handleVariableSelect = useCallback((variable: Variable) => {
    console.log('Variable selected:', variable.name)
    onVariableSelect?.(variable)
  }, [onVariableSelect])

  return (
    <VariablesErrorBoundary>
      <main 
        role="main" 
        aria-label="Variables Browser"
        className="flex flex-col h-full overflow-hidden"
        aria-live="polite"
      >
        <div className="px-6 pt-6 pb-4">
          <button
            onClick={onSearchClick}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            aria-label="Click to search for variable lineage"
          >
            <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span className="text-gray-500">Search variables...</span>
          </button>
        </div>
        <div className="px-6">
          <DatasetHeader dataset={dataset} />
        </div>
        <div className="flex-1 overflow-auto">
          <VariablesGrid 
            key={dataset.id}
            variables={dataset.variables}
            group={dataset.group}
            onVariableSelect={handleVariableSelect}
            onEscape={onEscape}
          />
        </div>
      </main>
    </VariablesErrorBoundary>
  )
})
