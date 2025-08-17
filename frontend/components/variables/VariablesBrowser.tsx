import { memo, type ReactNode } from 'react'
import type { DatasetWithGroup } from '@/types/variables'
import { DatasetHeader } from './DatasetHeader'
import { VariablesGrid } from './VariablesGrid'

interface VariablesBrowserProps {
  readonly dataset: DatasetWithGroup
}

export const VariablesBrowser = memo(function VariablesBrowser({ 
  dataset 
}: VariablesBrowserProps): ReactNode {
  return (
    <main 
      role="main" 
      aria-label="Variables Browser"
      className="flex flex-col h-full overflow-hidden"
    >
      <DatasetHeader dataset={dataset} />
      <div className="flex-1 overflow-auto">
        <VariablesGrid variables={dataset.variables} />
      </div>
    </main>
  )
})
