import { memo, useState, useCallback, useRef, useEffect, type ReactNode, type MouseEvent, type FocusEvent } from 'react'
import type { Variable } from '@/types/variables'
import { VariableCard } from './VariableCard'
import { VariableTooltip } from './VariableTooltip'
import { useVariablesKeyboardNav } from '@/hooks/useVariablesKeyboardNav'

interface VariablesGridProps {
  readonly variables: readonly Variable[]
  readonly onVariableSelect?: (variable: Variable) => void
  readonly onEscape?: () => void
}

interface TooltipState {
  readonly variable: Variable | null
  readonly position: { x: number; y: number }
  readonly isVisible: boolean
}

export const VariablesGrid = memo(function VariablesGrid({ 
  variables,
  onVariableSelect,
  onEscape
}: VariablesGridProps): ReactNode {
  const [tooltip, setTooltip] = useState<TooltipState>({
    variable: null,
    position: { x: 0, y: 0 },
    isVisible: false
  })

  const handleVariableHover = useCallback((variable: Variable, event: MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
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
    setTooltip(prev => ({ ...prev, isVisible: false }))
  }, [])

  // Keyboard navigation
  const gridRef = useRef<HTMLDivElement>(null)
  const { focusedIndex } = useVariablesKeyboardNav({
    variables,
    onVariableSelect,
    onEscape
  })

  // Focus management - ensure focused card is visible
  useEffect(() => {
    if (focusedIndex >= 0 && gridRef.current) {
      const cards = gridRef.current.querySelectorAll('[data-variable-card]')
      const focusedCard = cards[focusedIndex] as HTMLElement
      if (focusedCard) {
        focusedCard.focus()
        focusedCard.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    }
  }, [focusedIndex])

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
        ref={gridRef}
        className="variables-grid grid gap-3"
        style={{
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))'
        }}
        role="grid"
        aria-label="Dataset variables"
      >
        {variables.map((variable, index) => (
          <VariableCard
            key={variable.name}
            variable={variable}
            onHover={handleVariableHover}
            onFocus={handleVariableFocus}
            onBlur={handleTooltipClose}
            onMouseLeave={handleTooltipClose}
            isFocused={focusedIndex === index}
            tabIndex={focusedIndex === index ? 0 : -1}
            data-variable-card={true}
            aria-rowindex={Math.floor(index / 6) + 1}
            aria-colindex={(index % 6) + 1}
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
