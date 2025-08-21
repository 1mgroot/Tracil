import { memo, useState, useCallback, useRef, useEffect, type ReactNode, type MouseEvent, type FocusEvent } from 'react'
import type { Variable } from '@/types/variables'
import type { FileGroupKind } from '@/types/files'
import { VariableCard } from './VariableCard'
import { VariableTooltip } from './VariableTooltip'
import { useVariablesKeyboardNav } from '@/hooks/useVariablesKeyboardNav'

interface VariablesGridProps {
  readonly variables: readonly Variable[]
  readonly group: FileGroupKind
  readonly onVariableSelect?: (variable: Variable) => void
  readonly onEscape?: () => void
  readonly compact?: boolean
  readonly selectedVariable?: string | null
}

interface TooltipState {
  readonly variable: Variable | null
  readonly position: { x: number; y: number }
  readonly isVisible: boolean
}

export const VariablesGrid = memo(function VariablesGrid({ 
  variables,
  group,
  onVariableSelect,
  onEscape,
  compact = false,
  selectedVariable = null
}: VariablesGridProps): ReactNode {
  const [tooltip, setTooltip] = useState<TooltipState>({
    variable: null,
    position: { x: 0, y: 0 },
    isVisible: false
  })
  const [focusedVariable, setFocusedVariable] = useState<string | null>(null)

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
  const { focusedIndex, setFocusedIndex } = useVariablesKeyboardNav({
    variables,
    onVariableSelect: (variable: Variable) => {
      // When selecting via keyboard (Enter/Space), update selection but keep focus
      setFocusedVariable(variable.name)
      onVariableSelect?.(variable)
    },
    onEscape
  })

  const handleVariableClick = useCallback((variable: Variable) => {
    const clickedIndex = variables.findIndex(v => v.name === variable.name)
    // When clicking, update both selection and focus to clicked item
    setFocusedVariable(variable.name)
    setFocusedIndex(clickedIndex)
    onVariableSelect?.(variable)
  }, [onVariableSelect, variables, setFocusedIndex])

  // Focus management - ensure focused card is visible
  useEffect(() => {
    if (focusedIndex >= 0 && gridRef.current) {
      const cards = gridRef.current.querySelectorAll('[data-variable-card]')
      const focusedCard = cards[focusedIndex] as HTMLElement
      if (focusedCard && typeof focusedCard.scrollIntoView === 'function') {
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

  // In compact mode, show variables in a single row with reduced height
  if (compact) {
    return (
      <section 
        aria-labelledby="variables-heading"
        className="px-6 pt-4 pb-4 border-b border-gray-200"
      >
        <h2 
          id="variables-heading" 
          className="sr-only"
        >
          Variables
        </h2>
        
        <div 
          ref={gridRef}
          className="variables-grid flex gap-2 overflow-x-auto pb-2"
          role="grid"
          aria-label="Dataset variables"
        >
          {variables.map((variable, index) => (
            <VariableCard
              key={variable.name}
              variable={variable}
              group={group}
              selected={selectedVariable === variable.name}
              onClick={handleVariableClick}
              onHover={handleVariableHover}
              onFocus={handleVariableFocus}
              onBlur={handleTooltipClose}
              onMouseLeave={handleTooltipClose}
              isFocused={focusedIndex === index}
              tabIndex={focusedIndex === index ? 0 : -1}
              data-variable-card={true}
              compact={true}
              aria-rowindex={1}
              aria-colindex={index + 1}
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
  }

  // Default grid layout
  return (
    <section 
      aria-labelledby="variables-heading"
      className="px-6 pt-6 pb-6"
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
            group={group}
            selected={focusedVariable === variable.name}
            onClick={handleVariableClick}
            onHover={handleVariableHover}
            onFocus={handleVariableFocus}
            onBlur={handleTooltipClose}
            onMouseLeave={handleTooltipClose}
            isFocused={focusedIndex === index}
            tabIndex={focusedIndex === index ? 0 : -1}
            data-variable-card={true}
            compact={false}
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
