import { memo, useCallback, type ReactNode } from 'react'
import type { DatasetWithGroup, Variable } from '@/types/variables'
import { SearchBar } from '@/components/search/SearchBar'
import { DatasetHeader } from './DatasetHeader'
import { VariablesGrid } from './VariablesGrid'
import { VariablesErrorBoundary } from './VariablesErrorBoundary'

interface VariablesBrowserProps {
  readonly dataset: DatasetWithGroup
  readonly onVariableSelect?: (variable: Variable) => void
  readonly onEscape?: () => void
}

export const VariablesBrowser = memo(function VariablesBrowser({ 
  dataset,
  onVariableSelect,
  onEscape
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
          <SearchBar placeholder="Search variables..." />
        </div>
        <div className="px-6">
          <DatasetHeader dataset={dataset} />
        </div>
        <div className="flex-1 overflow-auto">
          <VariablesGrid 
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
