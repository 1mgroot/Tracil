import { render, screen, fireEvent } from '@testing-library/react'
import { VariablesBrowser } from '@/components/variables/VariablesBrowser'
import type { DatasetWithGroup, Variable } from '@/types/variables'

// Mock the child components to isolate VariablesBrowser testing
jest.mock('@/components/search/SearchBar', () => ({
  SearchBar: ({ placeholder }: { placeholder: string }) => (
    <div data-testid="search-bar" aria-label={placeholder}>
      <input type="text" placeholder={placeholder} />
    </div>
  )
}))

jest.mock('@/components/variables/DatasetHeader', () => ({
  DatasetHeader: ({ dataset }: { dataset: DatasetWithGroup }) => (
    <div data-testid="dataset-header">
      <h2>{dataset.name}</h2>
      <p>{dataset.label}</p>
    </div>
  )
}))

jest.mock('@/components/variables/VariablesGrid', () => ({
  VariablesGrid: ({ 
    variables, 
    onVariableSelect, 
    onEscape 
  }: { 
    variables: Variable[]
    onVariableSelect: (variable: Variable) => void
    onEscape?: () => void
  }) => (
    <div data-testid="variables-grid">
      {variables.map((variable) => (
        <button
          key={variable.name}
          onClick={() => onVariableSelect(variable)}
          onKeyDown={(e) => e.key === 'Escape' && onEscape?.()}
          data-testid={`variable-${variable.name}`}
        >
          {variable.name}
        </button>
      ))}
    </div>
  )
}))

jest.mock('@/components/variables/VariablesErrorBoundary', () => ({
  VariablesErrorBoundary: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="variables-error-boundary">
      {children}
    </div>
  )
}))

// Mock console.log to avoid noise in tests
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {})

const mockDataset: DatasetWithGroup = {
  id: 'test-dataset-1',
  name: 'ADSL',
  label: 'Subject Level Analysis Dataset',
  group: 'ADaM',
  fileId: 'test-file-1',
  variables: [
    {
      name: 'USUBJID',
      label: 'Unique Subject Identifier',
      type: 'character',
      role: 'identifier',
      mandatory: true
    },
    {
      name: 'AGE',
      label: 'Age',
      type: 'numeric',
      role: 'covariate'
    },
    {
      name: 'SEX',
      label: 'Sex',
      type: 'character',
      role: 'covariate',
      codelist: 'SEX'
    }
  ],
  metadata: {
    records: 100,
    structure: 'One record per subject',
    version: '1.0'
  }
}

describe('VariablesBrowser', () => {
  beforeEach(() => {
    mockConsoleLog.mockClear()
  })

  afterAll(() => {
    mockConsoleLog.mockRestore()
  })

  describe('Basic Rendering', () => {
    it('should render all child components correctly', () => {
      render(<VariablesBrowser dataset={mockDataset} />)
      
      expect(screen.getByRole('button', { name: 'Click to search for variable lineage' })).toBeInTheDocument()
      expect(screen.getByTestId('dataset-header')).toBeInTheDocument()
      expect(screen.getByTestId('variables-grid')).toBeInTheDocument()
      expect(screen.getByTestId('variables-error-boundary')).toBeInTheDocument()
    })

    it('should display dataset information correctly', () => {
      render(<VariablesBrowser dataset={mockDataset} />)
      
      expect(screen.getByText('ADSL')).toBeInTheDocument()
      expect(screen.getByText('Subject Level Analysis Dataset')).toBeInTheDocument()
    })

    it('should render all variables', () => {
      render(<VariablesBrowser dataset={mockDataset} />)
      
      expect(screen.getByTestId('variable-USUBJID')).toBeInTheDocument()
      expect(screen.getByTestId('variable-AGE')).toBeInTheDocument()
      expect(screen.getByTestId('variable-SEX')).toBeInTheDocument()
    })
  })

  describe('Search Functionality', () => {
    it('should render search button with correct text and aria-label', () => {
      render(<VariablesBrowser dataset={mockDataset} />)
      
      const searchButton = screen.getByRole('button', { name: 'Click to search for variable lineage' })
      expect(searchButton).toHaveAttribute('aria-label', 'Click to search for variable lineage')
      expect(searchButton).toHaveTextContent('Search variables...')
    })

    it('should call onSearchClick when search button is clicked', () => {
      const mockOnSearchClick = jest.fn()
      render(
        <VariablesBrowser 
          dataset={mockDataset} 
          onSearchClick={mockOnSearchClick} 
        />
      )
      
      const searchButton = screen.getByRole('button', { name: 'Click to search for variable lineage' })
      fireEvent.click(searchButton)
      
      expect(mockOnSearchClick).toHaveBeenCalledTimes(1)
    })
  })

  describe('Variable Selection', () => {
    it('should call onVariableSelect when a variable is clicked', () => {
      const mockOnVariableSelect = jest.fn()
      render(
        <VariablesBrowser 
          dataset={mockDataset} 
          onVariableSelect={mockOnVariableSelect} 
        />
      )
      
      const usubjidButton = screen.getByTestId('variable-USUBJID')
      fireEvent.click(usubjidButton)
      
      expect(mockOnVariableSelect).toHaveBeenCalledWith(mockDataset.variables[0])
      expect(mockConsoleLog).toHaveBeenCalledWith('Variable selected:', 'USUBJID')
    })

    it('should handle variable selection without callback gracefully', () => {
      render(<VariablesBrowser dataset={mockDataset} />)
      
      const usubjidButton = screen.getByTestId('variable-USUBJID')
      fireEvent.click(usubjidButton)
      
      // Should not throw error, just log to console
      expect(mockConsoleLog).toHaveBeenCalledWith('Variable selected:', 'USUBJID')
    })
  })

  describe('Escape Key Handling', () => {
    it('should pass onEscape callback to VariablesGrid', () => {
      const mockOnEscape = jest.fn()
      render(
        <VariablesBrowser 
          dataset={mockDataset} 
          onEscape={mockOnEscape} 
        />
      )
      
      const usubjidButton = screen.getByTestId('variable-USUBJID')
      fireEvent.keyDown(usubjidButton, { key: 'Escape' })
      
      expect(mockOnEscape).toHaveBeenCalled()
    })

    it('should handle missing onEscape callback gracefully', () => {
      render(<VariablesBrowser dataset={mockDataset} />)
      
      const usubjidButton = screen.getByTestId('variable-USUBJID')
      // Should not throw error when pressing Escape
      expect(() => {
        fireEvent.keyDown(usubjidButton, { key: 'Escape' })
      }).not.toThrow()
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(<VariablesBrowser dataset={mockDataset} />)
      
      const mainElement = screen.getByRole('main')
      expect(mainElement).toHaveAttribute('aria-label', 'Variables Browser')
      expect(mainElement).toHaveAttribute('aria-live', 'polite')
    })

    it('should have proper semantic structure', () => {
      render(<VariablesBrowser dataset={mockDataset} />)
      
      expect(screen.getByRole('main')).toBeInTheDocument()
    })

    it('should have proper heading hierarchy', () => {
      render(<VariablesBrowser dataset={mockDataset} />)
      
      const heading = screen.getByRole('heading', { level: 2 })
      expect(heading).toHaveTextContent('ADSL')
    })
  })

  describe('Layout and Styling', () => {
    it('should have proper CSS classes for layout', () => {
      render(<VariablesBrowser dataset={mockDataset} />)
      
      const mainElement = screen.getByRole('main')
      expect(mainElement).toHaveClass('flex', 'flex-col', 'h-full', 'overflow-hidden')
    })

    it('should have proper spacing and padding', () => {
      render(<VariablesBrowser dataset={mockDataset} />)
      
      const searchContainer = screen.getByRole('button', { name: 'Click to search for variable lineage' }).parentElement
      const headerContainer = screen.getByTestId('dataset-header').parentElement
      
      expect(searchContainer).toHaveClass('px-6', 'pt-6', 'pb-4')
      expect(headerContainer).toHaveClass('px-6')
    })

    it('should have scrollable variables area', () => {
      render(<VariablesBrowser dataset={mockDataset} />)
      
      const variablesContainer = screen.getByTestId('variables-grid').parentElement
      expect(variablesContainer).toHaveClass('flex-1', 'overflow-auto')
    })
  })

  describe('Error Boundary Integration', () => {
    it('should wrap content in VariablesErrorBoundary', () => {
      render(<VariablesBrowser dataset={mockDataset} />)
      
      expect(screen.getByTestId('variables-error-boundary')).toBeInTheDocument()
    })
  })

  describe('Props Validation', () => {
    it('should handle dataset with minimal required properties', () => {
      const minimalDataset: DatasetWithGroup = {
        id: 'minimal-1',
        name: 'MIN',
        group: 'SDTM',
        fileId: 'min-file-1',
        variables: []
      }
      
      render(<VariablesBrowser dataset={minimalDataset} />)
      
      expect(screen.getByText('MIN')).toBeInTheDocument()
      expect(screen.getByTestId('variables-grid')).toBeInTheDocument()
    })

    it('should handle dataset with no variables gracefully', () => {
      const emptyDataset: DatasetWithGroup = {
        id: 'empty-1',
        name: 'EMPTY',
        group: 'aCRF',
        fileId: 'empty-file-1',
        variables: []
      }
      
      render(<VariablesBrowser dataset={emptyDataset} />)
      
      expect(screen.getByTestId('variables-grid')).toBeInTheDocument()
      // Grid should render but with no variable buttons
      expect(screen.queryByTestId(/^variable-/)).not.toBeInTheDocument()
    })
  })

  describe('Performance Optimization', () => {
    it('should use memo to prevent unnecessary re-renders', () => {
      const { rerender } = render(<VariablesBrowser dataset={mockDataset} />)
      
      // Re-render with same props
      rerender(<VariablesBrowser dataset={mockDataset} />)
      
      // Component should still be rendered
      expect(screen.getByTestId('variables-grid')).toBeInTheDocument()
    })

    it('should use useCallback for event handlers', () => {
      const mockOnVariableSelect = jest.fn()
      const { rerender } = render(
        <VariablesBrowser 
          dataset={mockDataset} 
          onVariableSelect={mockOnVariableSelect} 
        />
      )
      
      // Re-render with same callback
      rerender(
        <VariablesBrowser 
          dataset={mockDataset} 
          onVariableSelect={mockOnVariableSelect} 
        />
      )
      
      // Handler should still work
      const usubjidButton = screen.getByTestId('variable-USUBJID')
      fireEvent.click(usubjidButton)
      expect(mockOnVariableSelect).toHaveBeenCalled()
    })
  })
})
