import { memo, useRef, type ReactNode, type MouseEvent, type FocusEvent } from 'react'
import type { Variable } from '@/types/variables'

interface VariableCardProps {
  readonly variable: Variable
  readonly onHover?: (variable: Variable, event: MouseEvent<HTMLButtonElement>) => void
  readonly onFocus?: (variable: Variable, event: FocusEvent<HTMLButtonElement>) => void
  readonly onBlur?: () => void
  readonly onMouseLeave?: () => void
}

export const VariableCard = memo(function VariableCard({
  variable,
  onHover,
  onFocus,
  onBlur,
  onMouseLeave
}: VariableCardProps): ReactNode {
  const cardRef = useRef<HTMLButtonElement>(null)

  const handleMouseEnter = (event: MouseEvent<HTMLButtonElement>) => {
    if (onHover) {
      onHover(variable, event)
    }
  }

  const handleFocus = (event: FocusEvent<HTMLButtonElement>) => {
    if (onFocus) {
      onFocus(variable, event)
    }
  }

  const handleBlur = () => {
    if (onBlur) {
      onBlur()
    }
  }

  const handleMouseLeave = () => {
    if (onMouseLeave) {
      onMouseLeave()
    }
  }

  return (
    <button
      ref={cardRef}
      className="
        variable-card
        aspect-[2/1]
        bg-[var(--surface-muted)]
        hover:bg-[var(--surface-hover)]
        focus:bg-[var(--surface-hover)]
        rounded-lg
        border border-[var(--border)]
        hover:border-[var(--border-hover)]
        focus:border-[var(--border-focus)]
        focus:outline-none
        focus:ring-2
        focus:ring-[var(--focus-ring)]
        focus:ring-offset-2
        transition-all
        duration-200
        ease-in-out
        hover:transform
        hover:-translate-y-0.5
        hover:shadow-md
        flex
        items-center
        justify-center
        text-sm
        font-medium
        text-[var(--text-primary)]
        cursor-pointer
        p-2
      "
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
      aria-label={`Variable ${variable.name}: ${variable.label}`}
      aria-describedby={`tooltip-${variable.name}`}
      type="button"
    >
      <span className="text-center truncate w-full">
        {variable.name}
      </span>
    </button>
  )
})
