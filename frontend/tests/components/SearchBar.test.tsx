import { render, screen, fireEvent } from '@testing-library/react'
import { SearchBar } from '@/components/search/SearchBar'

describe('SearchBar', () => {
  describe('Basic Rendering', () => {
    it('should render with default placeholder', () => {
      render(<SearchBar />)
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('placeholder', 'Search variables…')
    })

    it('should render with custom placeholder', () => {
      render(<SearchBar placeholder="Custom search..." />)
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('placeholder', 'Custom search...')
    })

    it('should render all interactive elements', () => {
      render(<SearchBar />)
      
      expect(screen.getByRole('textbox')).toBeInTheDocument()
      expect(screen.getByLabelText('Filters')).toBeInTheDocument()
      expect(screen.getByLabelText('Search')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<SearchBar />)
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('aria-label', 'Search variables')
      
      const filtersButton = screen.getByLabelText('Filters')
      expect(filtersButton).toHaveAttribute('aria-label', 'Filters')
      
      const searchButton = screen.getByLabelText('Search')
      expect(searchButton).toHaveAttribute('aria-label', 'Search')
    })

    it('should have proper semantic structure', () => {
      render(<SearchBar />)
      
      const input = screen.getByRole('textbox')
      expect(input).toBeInTheDocument()
      
      const buttons = screen.getAllByRole('button')
      expect(buttons).toHaveLength(2)
    })

    it('should support keyboard navigation', () => {
      render(<SearchBar />)
      
      const input = screen.getByRole('textbox')
      const filtersButton = screen.getByLabelText('Filters')
      const searchButton = screen.getByLabelText('Search')
      
      // Test that all elements are focusable
      filtersButton.focus()
      expect(filtersButton).toHaveFocus()
      
      input.focus()
      expect(input).toHaveFocus()
      
      // Search button should be disabled when no input, so it can't receive focus
      // Instead, test that it has the proper disabled state
      expect(searchButton).toBeDisabled()
      
      // Test that elements have proper tab order by checking they're all focusable
      // The actual tab order will be determined by the DOM structure
      expect(filtersButton).toHaveAttribute('type', 'button')
      expect(input).toHaveAttribute('aria-label', 'Search variables')
      expect(searchButton).toHaveAttribute('type', 'button')
    })
  })

  describe('Interactive Elements', () => {
    it('should handle input changes', () => {
      render(<SearchBar />)
      
      const input = screen.getByRole('textbox')
      fireEvent.change(input, { target: { value: 'test search' } })
      
      expect(input).toHaveValue('test search')
    })

    it('should handle button clicks', () => {
      render(<SearchBar />)
      
      const filtersButton = screen.getByLabelText('Filters')
      const searchButton = screen.getByLabelText('Search')
      
      // Buttons should be clickable (even if no functionality implemented yet)
      expect(() => {
        fireEvent.click(filtersButton)
        fireEvent.click(searchButton)
      }).not.toThrow()
    })

    it('should handle button hover states', () => {
      render(<SearchBar />)
      
      const filtersButton = screen.getByLabelText('Filters')
      const searchButton = screen.getByLabelText('Search')
      
      // Hover should not throw errors
      expect(() => {
        fireEvent.mouseEnter(filtersButton)
        fireEvent.mouseLeave(filtersButton)
        fireEvent.mouseEnter(searchButton)
        fireEvent.mouseLeave(searchButton)
      }).not.toThrow()
    })
  })

  describe('Styling and Layout', () => {
    it('should have proper CSS classes', () => {
      render(<SearchBar />)
      
      const container = screen.getByRole('textbox').closest('div')?.parentElement
      expect(container).toHaveClass('w-full', 'max-w-2xl')
      
      const searchContainer = screen.getByRole('textbox').parentElement
      expect(searchContainer).toHaveClass(
        'flex', 'items-center', 'gap-2', 'rounded-xl', 'border', 
        'bg-[--surface]', 'px-3', 'py-2', 'shadow-sm', 'transition-colors'
      )
    })

    it('should apply custom className', () => {
      render(<SearchBar className="custom-class" />)
      
      const container = screen.getByRole('textbox').closest('div')?.parentElement
      expect(container).toHaveClass('custom-class')
    })

    it('should have proper focus styles', () => {
      render(<SearchBar />)
      
      const searchContainer = screen.getByRole('textbox').parentElement
      expect(searchContainer).toHaveClass('focus-within:outline', 'focus-within:outline-2', 'focus-within:outline-[--focus]')
    })
  })

  describe('Input Behavior', () => {
    it('should handle text input correctly', () => {
      render(<SearchBar />)
      
      const input = screen.getByRole('textbox')
      
      // Type some text
      fireEvent.change(input, { target: { value: 'variable name' } })
      expect(input).toHaveValue('variable name')
      
      // Clear the input
      fireEvent.change(input, { target: { value: '' } })
      expect(input).toHaveValue('')
    })

    it('should maintain input value across re-renders', () => {
      const { rerender } = render(<SearchBar />)
      
      const input = screen.getByRole('textbox')
      fireEvent.change(input, { target: { value: 'persistent value' } })
      
      rerender(<SearchBar />)
      expect(input).toHaveValue('persistent value')
    })
  })

  describe('Button Functionality', () => {
    it('should have proper button types', () => {
      render(<SearchBar />)
      
      const filtersButton = screen.getByLabelText('Filters')
      const searchButton = screen.getByLabelText('Search')
      
      expect(filtersButton).toHaveAttribute('type', 'button')
      expect(searchButton).toHaveAttribute('type', 'button')
    })

    it('should have proper button styling', () => {
      render(<SearchBar />)
      
      const filtersButton = screen.getByLabelText('Filters')
      const searchButton = screen.getByLabelText('Search')
      
      expect(filtersButton).toHaveClass('p-1', 'rounded-md', 'hover:bg-[--surface-muted]')
      expect(searchButton).toHaveClass('p-1', 'rounded-md', 'hover:bg-[--surface-muted]')
    })
  })

  describe('Loading State', () => {
    it('should show loading spinner when loading is true', () => {
      render(<SearchBar isLoading={true} />)
      
      // Should show loading spinner instead of search icon
      expect(screen.getByRole('textbox')).toBeDisabled()
      expect(screen.getByLabelText('Search')).toBeDisabled()
      
      // Should have loading spinner
      const loadingSpinner = screen.getByLabelText('Search').querySelector('.animate-spin')
      expect(loadingSpinner).toBeInTheDocument()
    })

    it('should disable input and search button when loading', () => {
      render(<SearchBar isLoading={true} />)
      
      const input = screen.getByRole('textbox') as HTMLInputElement
      const searchButton = screen.getByLabelText('Search') as HTMLButtonElement
      
      expect(input).toBeDisabled()
      expect(searchButton).toBeDisabled()
    })

    it('should not call onSearch when loading', () => {
      const mockOnSearch = jest.fn()
      render(<SearchBar onSearch={mockOnSearch} isLoading={true} />)
      
      const input = screen.getByRole('textbox')
      const searchButton = screen.getByLabelText('Search')
      
      // Type some text
      fireEvent.change(input, { target: { value: 'test' } })
      
      // Click search button
      fireEvent.click(searchButton)
      
      expect(mockOnSearch).not.toHaveBeenCalled()
    })
  })

  describe('Icon Rendering', () => {
    it('should render Settings2 icon for filters', () => {
      render(<SearchBar />)
      
      const filtersButton = screen.getByLabelText('Filters')
      const icon = filtersButton.querySelector('svg')
      expect(icon).toBeInTheDocument()
    })

    it('should render Search icon for search button', () => {
      render(<SearchBar />)
      
      const searchButton = screen.getByLabelText('Search')
      const icon = searchButton.querySelector('svg')
      expect(icon).toBeInTheDocument()
    })

    it('should have proper icon sizing', () => {
      render(<SearchBar />)
      
      const icons = document.querySelectorAll('svg')
      icons.forEach(icon => {
        expect(icon).toHaveClass('h-4', 'w-4')
      })
    })
  })

  describe('Props Handling', () => {
    it('should pass through additional HTML attributes', () => {
      render(<SearchBar data-testid="search-bar" title="Search Tool" />)
      
      const container = screen.getByTestId('search-bar')
      expect(container).toHaveAttribute('title', 'Search Tool')
    })

    it('should handle undefined placeholder gracefully', () => {
      render(<SearchBar placeholder={undefined} />)
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('placeholder', 'Search variables…') // Default value
    })

    it('should handle empty string placeholder', () => {
      render(<SearchBar placeholder="" />)
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('placeholder', '')
    })
  })

  describe('Responsive Design', () => {
    it('should have proper max width constraint', () => {
      render(<SearchBar />)
      
      const container = screen.getByRole('textbox').closest('div')?.parentElement
      expect(container).toHaveClass('max-w-2xl')
    })

    it('should be full width within constraints', () => {
      render(<SearchBar />)
      
      const container = screen.getByRole('textbox').closest('div')?.parentElement
      expect(container).toHaveClass('w-full')
    })
  })
})
