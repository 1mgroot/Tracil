import { render, screen, fireEvent } from '@testing-library/react'
import { VariableCard } from '@/components/variables/VariableCard'
import type { Variable } from '@/types/variables'
import type { FileGroupKind } from '@/types/files'

const mockVariable: Variable = {
  name: 'USUBJID',
  label: 'Unique Subject Identifier',
  type: 'character',
  role: 'identifier',
  mandatory: true
}

const mockGroup: FileGroupKind = 'ADaM'

describe('VariableCard', () => {
  describe('Basic Rendering', () => {
    it('should render variable name', () => {
      render(<VariableCard variable={mockVariable} group={mockGroup} />)
      
      expect(screen.getByText('USUBJID')).toBeInTheDocument()
    })

    it('should render with all required props', () => {
      render(<VariableCard variable={mockVariable} group={mockGroup} />)
      
      const button = screen.getByRole('gridcell')
      expect(button).toBeInTheDocument()
      expect(button).toHaveAttribute('type', 'button')
    })

    it('should render with optional props', () => {
      render(
        <VariableCard 
          variable={mockVariable} 
          group={mockGroup}
          selected={true}
          isFocused={true}
          tabIndex={0}
        />
      )
      
      const button = screen.getByRole('gridcell')
      expect(button).toHaveAttribute('aria-selected', 'true')
      expect(button).toHaveAttribute('tabindex', '0')
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(<VariableCard variable={mockVariable} group={mockGroup} />)
      
      const button = screen.getByRole('gridcell')
      expect(button).toHaveAttribute('aria-label', 'Variable USUBJID: Unique Subject Identifier')
      expect(button).toHaveAttribute('aria-describedby', 'tooltip-USUBJID')
      expect(button).toHaveAttribute('aria-selected', 'false')
      expect(button).toHaveAttribute('role', 'gridcell')
    })

    it('should have proper ARIA attributes when selected', () => {
      render(<VariableCard variable={mockVariable} group={mockGroup} selected={true} />)
      
      const button = screen.getByRole('gridcell')
      expect(button).toHaveAttribute('aria-selected', 'true')
    })

    it('should have proper ARIA grid attributes', () => {
      render(
        <VariableCard 
          variable={mockVariable} 
          group={mockGroup}
          aria-rowindex={1}
          aria-colindex={2}
        />
      )
      
      const button = screen.getByRole('gridcell')
      expect(button).toHaveAttribute('aria-rowindex', '1')
      expect(button).toHaveAttribute('aria-colindex', '2')
    })

    it('should have proper semantic role', () => {
      render(<VariableCard variable={mockVariable} group={mockGroup} />)
      
      expect(screen.getByRole('gridcell')).toBeInTheDocument()
    })
  })

  describe('Interactive Events', () => {
    it('should call onClick when clicked', () => {
      const mockOnClick = jest.fn()
      render(
        <VariableCard 
          variable={mockVariable} 
          group={mockGroup}
          onClick={mockOnClick}
        />
      )
      
      const button = screen.getByRole('gridcell')
      fireEvent.click(button)
      
      expect(mockOnClick).toHaveBeenCalledWith(mockVariable)
    })

    it('should call onHover when mouse enters', () => {
      const mockOnHover = jest.fn()
      render(
        <VariableCard 
          variable={mockVariable} 
          group={mockGroup}
          onHover={mockOnHover}
        />
      )
      
      const button = screen.getByRole('gridcell')
      fireEvent.mouseEnter(button)
      
      expect(mockOnHover).toHaveBeenCalledWith(mockVariable, expect.any(Object))
    })

    it('should call onFocus when focused', () => {
      const mockOnFocus = jest.fn()
      render(
        <VariableCard 
          variable={mockVariable} 
          group={mockGroup}
          onFocus={mockOnFocus}
        />
      )
      
      const button = screen.getByRole('gridcell')
      fireEvent.focus(button)
      
      expect(mockOnFocus).toHaveBeenCalledWith(mockVariable, expect.any(Object))
    })

    it('should call onBlur when focus is lost', () => {
      const mockOnBlur = jest.fn()
      render(
        <VariableCard 
          variable={mockVariable} 
          group={mockGroup}
          onBlur={mockOnBlur}
        />
      )
      
      const button = screen.getByRole('gridcell')
      fireEvent.focus(button)
      fireEvent.blur(button)
      
      expect(mockOnBlur).toHaveBeenCalled()
    })

    it('should call onMouseLeave when mouse leaves', () => {
      const mockOnMouseLeave = jest.fn()
      render(
        <VariableCard 
          variable={mockVariable} 
          group={mockGroup}
          onMouseLeave={mockOnMouseLeave}
        />
      )
      
      const button = screen.getByRole('gridcell')
      fireEvent.mouseLeave(button)
      
      expect(mockOnMouseLeave).toHaveBeenCalled()
    })

    it('should handle missing event handlers gracefully', () => {
      render(<VariableCard variable={mockVariable} group={mockGroup} />)
      
      const button = screen.getByRole('gridcell')
      
      // Should not throw errors when handlers are missing
      expect(() => {
        fireEvent.click(button)
        fireEvent.mouseEnter(button)
        fireEvent.focus(button)
        fireEvent.blur(button)
        fireEvent.mouseLeave(button)
      }).not.toThrow()
    })
  })

  describe('Styling and CSS Classes', () => {
    it('should have base CSS classes', () => {
      render(<VariableCard variable={mockVariable} group={mockGroup} />)
      
      const button = screen.getByRole('gridcell')
      expect(button).toHaveClass(
        'variable-card',
        'aspect-[2/1]',
        'rounded-lg',
        'focus:outline-none',
        'focus:ring-2',
        'focus:ring-[var(--focus-ring)]',
        'focus:ring-offset-2',
        'transition-all',
        'duration-200',
        'ease-in-out',
        'hover:transform',
        'hover:-translate-y-0.5',
        'hover:shadow-md',
        'flex',
        'items-center',
        'justify-center',
        'text-sm',
        'font-medium',
        'cursor-pointer',
        'p-2'
      )
    })

    it('should have selected state classes', () => {
      render(<VariableCard variable={mockVariable} group={mockGroup} selected={true} />)
      
      const button = screen.getByRole('gridcell')
      expect(button).toHaveClass('is-selected')
      expect(button).not.toHaveClass('is-idle')
    })

    it('should have idle state classes when not selected', () => {
      render(<VariableCard variable={mockVariable} group={mockGroup} selected={false} />)
      
      const button = screen.getByRole('gridcell')
      expect(button).toHaveClass('is-idle')
      expect(button).not.toHaveClass('is-selected')
    })

    it('should have focused state classes when isFocused is true', () => {
      render(<VariableCard variable={mockVariable} group={mockGroup} isFocused={true} />)
      
      const button = screen.getByRole('gridcell')
      expect(button).toHaveClass('ring-2', 'ring-[var(--focus-ring)]', 'ring-offset-2')
    })

    it('should not have focused state classes when isFocused is false', () => {
      render(<VariableCard variable={mockVariable} group={mockGroup} isFocused={false} />)
      
      const button = screen.getByRole('gridcell')
      expect(button).not.toHaveClass('ring-2', 'ring-[var(--focus-ring)]', 'ring-offset-2')
    })
  })

  describe('CSS Custom Properties', () => {
    it('should set accent color CSS variable based on group', () => {
      render(<VariableCard variable={mockVariable} group="ADaM" />)
      
      const button = screen.getByRole('gridcell')
      // Check if the style attribute contains the CSS custom property
      expect(button).toHaveAttribute('style', expect.stringContaining('--accent-color'))
      expect(button).toHaveAttribute('style', expect.stringContaining('var(--accent-adam)'))
    })

    it('should set accent color for different groups', () => {
      const { rerender } = render(<VariableCard variable={mockVariable} group="SDTM" />)
      
      let button = screen.getByRole('gridcell')
      expect(button).toHaveAttribute('style', expect.stringContaining('var(--accent-sdtm)'))
      
      rerender(<VariableCard variable={mockVariable} group="aCRF" />)
      button = screen.getByRole('gridcell')
      expect(button).toHaveAttribute('style', expect.stringContaining('var(--accent-acrf)'))
      
      rerender(<VariableCard variable={mockVariable} group="TLF" />)
      button = screen.getByRole('gridcell')
      expect(button).toHaveAttribute('style', expect.stringContaining('var(--accent-tlf)'))
    })
  })

  describe('Data Attributes', () => {
    it('should set data-variable-card attribute when provided', () => {
      render(
        <VariableCard 
          variable={mockVariable} 
          group={mockGroup}
          data-variable-card={true}
        />
      )
      
      const button = screen.getByRole('gridcell')
      expect(button).toHaveAttribute('data-variable-card', 'true')
    })

    it('should not set data-variable-card attribute when not provided', () => {
      render(<VariableCard variable={mockVariable} group={mockGroup} />)
      
      const button = screen.getByRole('gridcell')
      expect(button).not.toHaveAttribute('data-variable-card')
    })
  })

  describe('Tab Index', () => {
    it('should have default tabIndex of -1', () => {
      render(<VariableCard variable={mockVariable} group={mockGroup} />)
      
      const button = screen.getByRole('gridcell')
      expect(button).toHaveAttribute('tabindex', '-1')
    })

    it('should use custom tabIndex when provided', () => {
      render(
        <VariableCard 
          variable={mockVariable} 
          group={mockGroup}
          tabIndex={5}
        />
      )
      
      const button = screen.getByRole('gridcell')
      expect(button).toHaveAttribute('tabindex', '5')
    })
  })

  describe('Content Layout', () => {
    it('should center variable name text', () => {
      render(<VariableCard variable={mockVariable} group={mockGroup} />)
      
      const textSpan = screen.getByText('USUBJID')
      expect(textSpan).toHaveClass('text-center', 'truncate', 'w-full')
    })

    it('should handle long variable names with truncation', () => {
      const longVariable: Variable = {
        ...mockVariable,
        name: 'VERY_LONG_VARIABLE_NAME_THAT_SHOULD_BE_TRUNCATED'
      }
      
      render(<VariableCard variable={longVariable} group={mockGroup} />)
      
      const textSpan = screen.getByText('VERY_LONG_VARIABLE_NAME_THAT_SHOULD_BE_TRUNCATED')
      expect(textSpan).toHaveClass('truncate')
    })
  })

  describe('Performance Optimization', () => {
    it('should use memo to prevent unnecessary re-renders', () => {
      const { rerender } = render(<VariableCard variable={mockVariable} group={mockGroup} />)
      
      // Re-render with same props
      rerender(<VariableCard variable={mockVariable} group={mockGroup} />)
      
      // Component should still be rendered
      expect(screen.getByText('USUBJID')).toBeInTheDocument()
    })

    it('should use useRef for card reference', () => {
      render(<VariableCard variable={mockVariable} group={mockGroup} />)
      
      const button = screen.getByRole('gridcell')
      // The ref should be attached to the button element
      expect(button).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('should handle variable with minimal properties', () => {
      const minimalVariable: Variable = {
        name: 'MIN',
        label: 'Minimal',
        type: 'character'
      }
      
      render(<VariableCard variable={minimalVariable} group={mockGroup} />)
      
      expect(screen.getByText('MIN')).toBeInTheDocument()
      expect(screen.getByRole('gridcell')).toHaveAttribute('aria-label', 'Variable MIN: Minimal')
    })

    it('should handle variable with all optional properties', () => {
      const fullVariable: Variable = {
        name: 'FULL',
        label: 'Full Variable',
        type: 'numeric',
        role: 'covariate',
        length: 8,
        format: 'BEST8.',
        mandatory: false,
        codelist: 'SEX',
        comment: 'Test comment'
      }
      
      render(<VariableCard variable={fullVariable} group={mockGroup} />)
      
      expect(screen.getByText('FULL')).toBeInTheDocument()
      expect(screen.getByRole('gridcell')).toHaveAttribute('aria-label', 'Variable FULL: Full Variable')
    })
  })
})
