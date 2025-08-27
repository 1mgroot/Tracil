import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SearchForm } from '@/components/search/SearchForm'
import { SearchResults } from '@/components/search/SearchResults'
import { useSearch } from '@/hooks/useSearch'
import type { LineageGraph } from '@/types/lineage'

// Mock the analyzeLineage function
jest.mock('@/lib/ai/entrypoints/analyzeLineage', () => ({
  analyzeLineage: jest.fn()
}))

// Mock the useSearch hook
jest.mock('@/hooks/useSearch')

// Mock the LineageGraphReactFlow component
jest.mock('@/components/lineage/LineageGraphReactFlow', () => ({
  LineageGraphReactFlow: ({ lineage }: { lineage: LineageGraph }) => (
    <div data-testid="lineage-graph">
      <div>Graph with {lineage.nodes.length} nodes</div>
      <div>Graph with {lineage.edges.length} edges</div>
    </div>
  )
}))

const mockLineageData: LineageGraph = {
  summary: 'Test lineage graph',
  nodes: [
    {
      id: 'source',
      title: 'Source Variable',
      group: 'SDTM',
      kind: 'source',
    },
    {
      id: 'target',
      title: 'Target Variable',
      group: 'ADaM',
      kind: 'target',
    }
  ],
  edges: [
    {
      from: 'source',
      to: 'target',
      label: 'Transformation',
      explanation: 'Variable transformation'
    }
  ],
  gaps: { notes: [] }
}

describe('Search Integration', () => {
  const mockSearch = jest.fn()
  const mockClear = jest.fn()
  const mockReset = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useSearch as jest.Mock).mockReturnValue({
      query: '',
      dataset: '',
      lineage: null,
      loading: false,
      error: null,
      search: mockSearch,
      clear: mockClear,
      reset: mockReset
    })
  })

  describe('SearchForm', () => {
    it('should render search form with inputs and submit button', () => {
      render(<SearchForm onSearch={mockSearch} />)
      
      expect(screen.getByLabelText(/variable name/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/dataset/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /search variable lineage/i })).toBeInTheDocument()
    })

    it('should call onSearch when form is submitted with valid data', async () => {
      render(<SearchForm onSearch={mockSearch} />)
      
      const variableInput = screen.getByLabelText(/variable name/i)
      const datasetInput = screen.getByLabelText(/dataset/i)
      const submitButton = screen.getByRole('button', { name: /search variable lineage/i })
      
      fireEvent.change(variableInput, { target: { value: 'test-variable' } })
      fireEvent.change(datasetInput, { target: { value: 'test-dataset' } })
      fireEvent.click(submitButton)
      
      expect(mockSearch).toHaveBeenCalledWith('test-variable', 'test-dataset')
    })

    it('should not call onSearch when form is submitted with empty data', () => {
      render(<SearchForm onSearch={mockSearch} />)
      
      const submitButton = screen.getByRole('button', { name: /search variable lineage/i })
      fireEvent.click(submitButton)
      
      expect(mockSearch).not.toHaveBeenCalled()
    })

    it('should show loading state when loading is true', () => {
      render(<SearchForm onSearch={mockSearch} loading={true} />)
      
      const submitButton = screen.getByRole('button', { name: /analyzing lineage/i })
      expect(submitButton).toBeDisabled()
      expect(screen.getByText(/analyzing lineage/i)).toBeInTheDocument()
    })

    it('should show error message when error is provided', () => {
      const errorMessage = 'Search failed'
      render(<SearchForm onSearch={mockSearch} error={errorMessage} />)
      
      expect(screen.getByText(errorMessage)).toBeInTheDocument()
      // The error icon is present but doesn't have a test ID, so we just verify the error message
    })
  })

  describe('SearchResults', () => {
    it('should render search results with lineage graph when data is available', () => {
      render(
        <SearchResults
          query="test-variable"
          dataset="test-dataset"
          lineage={mockLineageData}
          loading={false}
          error={null}
          onBack={jest.fn()}
        />
      )
      
      // Use getAllByText for multiple instances
      const variableElements = screen.getAllByText(/test-variable/i)
      expect(variableElements.length).toBeGreaterThan(0)
      
      expect(screen.getByText(/test-dataset/i)).toBeInTheDocument()
      expect(screen.getByTestId('lineage-graph')).toBeInTheDocument()
      expect(screen.getByText(/Graph with 2 nodes/)).toBeInTheDocument()
      expect(screen.getByText(/Graph with 1 edges/)).toBeInTheDocument()
    })

    it('should show loading state when loading is true', () => {
      render(
        <SearchResults
          query="test-variable"
          dataset="test-dataset"
          lineage={null}
          loading={true}
          error={null}
          onBack={jest.fn()}
        />
      )
      
      expect(screen.getByText(/analyzing variable lineage/i)).toBeInTheDocument()
      expect(screen.getByText(/this may take a few moments/i)).toBeInTheDocument()
    })

    it('should show error state when error is provided', () => {
      const errorMessage = 'Failed to fetch lineage data'
      render(
        <SearchResults
          query="test-variable"
          dataset="test-dataset"
          lineage={null}
          loading={false}
          error={errorMessage}
          onBack={jest.fn()}
        />
      )
      
      expect(screen.getByText(/search error/i)).toBeInTheDocument()
      expect(screen.getByText(errorMessage)).toBeInTheDocument()
      expect(screen.getByText(/failed to analyze lineage/i)).toBeInTheDocument()
    })

    it('should show no results state when lineage is null and not loading', () => {
      render(
        <SearchResults
          query="test-variable"
          dataset="test-dataset"
          lineage={null}
          loading={false}
          error={null}
          onBack={jest.fn()}
        />
      )
      
      expect(screen.getByText(/no results found/i)).toBeInTheDocument()
      expect(screen.getByText(/no lineage found/i)).toBeInTheDocument()
    })

    it('should call onBack when back button is clicked', () => {
      const mockOnBack = jest.fn()
      render(
        <SearchResults
          query="test-variable"
          dataset="test-dataset"
          lineage={mockLineageData}
          loading={false}
          error={null}
          onBack={mockOnBack}
        />
      )
      
      const backButton = screen.getByRole('button', { name: /back to search/i })
      fireEvent.click(backButton)
      
      expect(mockOnBack).toHaveBeenCalled()
    })

    it('should display lineage summary information', () => {
      render(
        <SearchResults
          query="test-variable"
          dataset="test-dataset"
          lineage={mockLineageData}
          loading={false}
          error={null}
          onBack={jest.fn()}
        />
      )
      
      expect(screen.getByText(/lineage overview/i)).toBeInTheDocument()
      expect(screen.getByText(/total nodes/i)).toBeInTheDocument()
      expect(screen.getByText(/total connections/i)).toBeInTheDocument()
      expect(screen.getByText(/documentation gaps/i)).toBeInTheDocument()
    })
  })

  describe('Search Flow Integration', () => {
    it('should handle complete search flow from form to results', async () => {
      // First render with empty state
      const { rerender } = render(<SearchForm onSearch={mockSearch} />)
      
      // Fill out and submit form
      const variableInput = screen.getByLabelText(/variable name/i)
      const datasetInput = screen.getByLabelText(/dataset/i)
      const submitButton = screen.getByRole('button', { name: /search variable lineage/i })
      
      fireEvent.change(variableInput, { target: { value: 'test-variable' } })
      fireEvent.change(datasetInput, { target: { value: 'test-dataset' } })
      fireEvent.click(submitButton)
      
      expect(mockSearch).toHaveBeenCalledWith('test-variable', 'test-dataset')
      
      // Now render results view
      rerender(
        <SearchResults
          query="test-variable"
          dataset="test-dataset"
          lineage={mockLineageData}
          loading={false}
          error={null}
          onBack={jest.fn()}
        />
      )
      
      // Verify results are displayed (use getAllByText for multiple instances)
      const variableElements = screen.getAllByText(/test-variable/i)
      expect(variableElements.length).toBeGreaterThan(0)
      
      expect(screen.getByText(/test-dataset/i)).toBeInTheDocument()
      expect(screen.getByTestId('lineage-graph')).toBeInTheDocument()
    })
  })
})
