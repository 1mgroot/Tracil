import { memo, type ReactNode } from 'react'
import type { DatasetWithGroup } from '@/types/variables'

interface DatasetHeaderProps {
  readonly dataset: DatasetWithGroup
}

export const DatasetHeader = memo(function DatasetHeader({ 
  dataset 
}: DatasetHeaderProps): ReactNode {
  const { name, label, metadata, group } = dataset
  
  return (
    <header 
      role="banner" 
      className="px-6 py-4"
    >
      <div className="flex items-center gap-3">
        <div 
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: `var(--accent-${group.toLowerCase()})` }}
          aria-hidden="true"
        />
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
            {name}
            {label && (
              <span className="text-lg font-normal text-[var(--text-secondary)] ml-3">
                {label}
              </span>
            )}
          </h1>
          {metadata && (
            <div className="flex items-center gap-4 mt-1 text-sm text-[var(--text-secondary)]">
              {metadata.records && (
                <span>{metadata.records.toLocaleString()} records</span>
              )}
              <span>•</span>
              <span>{dataset.variables.length} variables</span>
              {metadata.lastModified && (
                <>
                  <span>•</span>
                  <span>Last updated: {metadata.lastModified}</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  )
})
