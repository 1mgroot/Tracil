import { memo, useEffect, useRef, type ReactNode } from 'react'
import type { Variable } from '@/types/variables'

interface VariableTooltipProps {
  readonly variable: Variable
  readonly isVisible: boolean
  readonly position: { x: number; y: number }
  readonly onClose: () => void
}

export const VariableTooltip = memo(function VariableTooltip({
  variable,
  isVisible,
  position,
  onClose
}: VariableTooltipProps): ReactNode {
  const tooltipRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    if (isVisible) {
      document.addEventListener('keydown', handleEscape)
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isVisible, onClose])

  // Simple tooltip positioning
  const tooltipStyle = {
    left: `${position.x}px`,
    top: `${position.y}px`,
    transform: 'translateX(-50%) translateY(-100%)'
  }

  if (!isVisible) {
    return null
  }

  return (
    <div
      ref={tooltipRef}
      id={`tooltip-${variable.name}`}
      role="tooltip"
      aria-live="polite"
      className="
        fixed
        z-50
        bg-[var(--surface)]
        border
        border-[var(--border)]
        rounded-lg
        shadow-lg
        p-4
        max-w-sm
        tooltip-animate-in
      "
      style={tooltipStyle}
    >
      <div className="space-y-2">
        <div className="font-semibold text-[var(--text-primary)] border-b border-[var(--border)] pb-2">
          Variable Details
        </div>
        
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="font-medium text-[var(--text-secondary)]">Name:</span>
            <span className="text-[var(--text-primary)] font-mono">{variable.name}</span>
          </div>
          
          <div className="flex justify-between">
            <span className="font-medium text-[var(--text-secondary)]">Label:</span>
            <span className="text-[var(--text-primary)] text-right max-w-[200px] break-words">
              {variable.label}
            </span>
          </div>
          
          <div className="flex justify-between">
            <span className="font-medium text-[var(--text-secondary)]">Type:</span>
            <span className="text-[var(--text-primary)]">
              {variable.type}
              {variable.length && ` (Length: ${variable.length})`}
            </span>
          </div>
          
          {variable.role && (
            <div className="flex justify-between">
              <span className="font-medium text-[var(--text-secondary)]">Role:</span>
              <span className="text-[var(--text-primary)] capitalize">
                {variable.role.replace('_', ' ')}
              </span>
            </div>
          )}
          
          {variable.format && (
            <div className="flex justify-between">
              <span className="font-medium text-[var(--text-secondary)]">Format:</span>
              <span className="text-[var(--text-primary)] font-mono">{variable.format}</span>
            </div>
          )}
          
          {variable.mandatory !== undefined && (
            <div className="flex justify-between">
              <span className="font-medium text-[var(--text-secondary)]">Mandatory:</span>
              <span className="text-[var(--text-primary)]">
                {variable.mandatory ? 'Yes' : 'No'}
              </span>
            </div>
          )}
          
          {variable.codelist && (
            <div className="flex justify-between">
              <span className="font-medium text-[var(--text-secondary)]">Codelist:</span>
              <span className="text-[var(--text-primary)] font-mono">{variable.codelist}</span>
            </div>
          )}
          
          {variable.comment && (
            <div className="mt-2 pt-2 border-t border-[var(--border)]">
              <span className="font-medium text-[var(--text-secondary)]">Comment:</span>
              <p className="text-[var(--text-primary)] text-xs mt-1">{variable.comment}</p>
            </div>
          )}
        </div>
      </div>
      
      {/* Tooltip arrow */}
      <div 
        className="
          absolute
          bottom-0
          left-1/2
          transform
          -translate-x-1/2
          translate-y-full
          w-0
          h-0
          border-l-4
          border-r-4
          border-t-4
          border-transparent
          border-t-[var(--surface)]
        "
        aria-hidden="true"
      />
    </div>
  )
})
