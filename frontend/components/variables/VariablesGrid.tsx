import { memo, useState, useCallback, type ReactNode, type MouseEvent, type FocusEvent } from 'react'
import type { Variable } from '@/types/variables'
import { VariableCard } from './VariableCard'
import { VariableTooltip } from './VariableTooltip'

interface VariablesGridProps {
  readonly variables: readonly Variable[]
}

interface TooltipState {
  readonly variable: Variable | null
  readonly position: { x: number; y: number }
  readonly isVisible: boolean
}

export const VariablesGrid = memo(function VariablesGrid({ 
  variables 
}: VariablesGridProps): ReactNode {
  const [tooltip, setTooltip] = useState<TooltipState>({
    variable: null,
    position: { x: 0, y: 0 },
    isVisible: false
  })

  const handleVariableHover = useCallback((variable: Variable, event: MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    console.log('Tooltip hover:', variable.name, 'Position:', rect.left, rect.top)
    setTooltip({
      variable,
      position: {
        x: rect.left + rect.width / 2,
        y: rect.top - 8
      },
      isVisible: true
    })
  }, [])

  const handleVariableFocus = useCallback((variable: Variable, event: FocusEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    console.log('Tooltip focus:', variable.name)
    setTooltip({
      variable,
      position: {
        x: rect.left + rect.width / 2,
        y: rect.top - 8
      },
      isVisible: true
    })
  }, [])

  const handleTooltipClose = useCallback(() => {
    console.log('Tooltip closing')
    setTooltip(prev => ({ ...prev, isVisible: false }))
  }, [])

  if (variables.length === 0) {
    return (
      <div 
        className="flex items-center justify-center h-32 text-[var(--text-secondary)]"
        role="status"
        aria-live="polite"
      >
        No variables found in this dataset
      </div>
    )
  }

  return (
    <section 
      role="region" 
      aria-labelledby="variables-heading"
      className="p-6"
    >
      <h2 
        id="variables-heading" 
        className="sr-only"
      >
        Variables
      </h2>
      
      <div 
        className="variables-grid grid gap-3"
        style={{
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))'
        }}
      >
        {variables.map((variable) => (
          <VariableCard
            key={variable.name}
            variable={variable}
            onHover={handleVariableHover}
            onFocus={handleVariableFocus}
            onBlur={handleTooltipClose}
            onMouseLeave={handleTooltipClose}
          />
        ))}
      </div>

      {tooltip.isVisible && tooltip.variable && (
        <VariableTooltip
          variable={tooltip.variable}
          isVisible={tooltip.isVisible}
          position={tooltip.position}
          onClose={handleTooltipClose}
        />
      )}
    </section>
  )
})
