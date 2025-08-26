import { memo, type ReactNode } from 'react'
import type { DatasetWithGroup } from '@/types/variables'

interface DatasetHeaderProps {
  readonly dataset: DatasetWithGroup
}

export const DatasetHeader = memo(function DatasetHeader({ 
  dataset 
}: DatasetHeaderProps): ReactNode {
  const { name, label, metadata, group } = dataset
  
  // For TLF items, show the title prominently and the ID as secondary
  const isTLFItem = group === 'TLF' && name.startsWith('Table') || name.startsWith('Figure')
  
  return (
    <header 
      role="banner" 
      className="py-4"
    >
      <div className="flex items-center gap-3">
        <div 
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: `var(--accent-${group.toLowerCase()})` }}
          aria-hidden="true"
        />
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
            {isTLFItem ? label : name}
            {isTLFItem && (
              <span className="text-lg font-normal text-[var(--text-secondary)] ml-3">
                {name}
              </span>
            )}
            {!isTLFItem && label && (
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
          {/* Special display for TLF items */}
          {isTLFItem && (
            <div className="mt-2 text-sm text-[var(--text-secondary)]">
              <span className="font-medium">Table/Figure:</span>
              <span className="ml-2">{label}</span>
            </div>
          )}
          {/* Display source file information if available */}
          {dataset.sourceFiles && dataset.sourceFiles.length > 0 && (
            <div className="mt-2 text-sm text-[var(--text-secondary)]">
              <span className="font-medium">Source files:</span>
              <div className="flex flex-wrap gap-2 mt-1">
                {dataset.sourceFiles.map((sourceFile) => (
                  <span 
                    key={`${sourceFile.fileId}-${sourceFile.role}`}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-[var(--surface-hover)] rounded text-xs"
                    title={`Role: ${sourceFile.role}, Extracted: ${sourceFile.extractedData.join(', ')}`}
                  >
                    <span className="font-mono">{sourceFile.fileId}</span>
                    <span className="text-[var(--text-muted)]">({sourceFile.role})</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
})
