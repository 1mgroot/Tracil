import { useCallback, useEffect, useState } from 'react'
import type { Variable } from '@/types/variables'

interface UseVariablesKeyboardNavProps {
  readonly variables: readonly Variable[]
  readonly onVariableSelect?: (variable: Variable) => void
  readonly onEscape?: () => void
}

export function useVariablesKeyboardNav({
  variables,
  onVariableSelect,
  onEscape
}: UseVariablesKeyboardNavProps) {
  const [focusedIndex, setFocusedIndex] = useState<number>(-1)

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (variables.length === 0) return

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        setFocusedIndex(prev => {
          const next = prev < variables.length - 1 ? prev + 1 : prev
          return next
        })
        break

      case 'ArrowUp':
        event.preventDefault()
        setFocusedIndex(prev => {
          const next = prev > 0 ? prev - 1 : prev
          return next
        })
        break

      case 'ArrowRight':
        event.preventDefault()
        // Move to next column in grid (approximate 6 columns)
        setFocusedIndex(prev => {
          const next = Math.min(prev + 6, variables.length - 1)
          return next
        })
        break

      case 'ArrowLeft':
        event.preventDefault()
        // Move to previous column in grid
        setFocusedIndex(prev => {
          const next = Math.max(prev - 6, 0)
          return next
        })
        break

      case 'Home':
        event.preventDefault()
        setFocusedIndex(0)
        break

      case 'End':
        event.preventDefault()
        setFocusedIndex(variables.length - 1)
        break

      case 'Enter':
      case ' ':
        event.preventDefault()
        if (focusedIndex >= 0 && focusedIndex < variables.length) {
          onVariableSelect?.(variables[focusedIndex])
        }
        break

      case 'Escape':
        event.preventDefault()
        onEscape?.()
        break

      default:
        break
    }
  }, [variables, focusedIndex, onVariableSelect, onEscape])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown])

  return {
    focusedIndex,
    setFocusedIndex
  }
}
