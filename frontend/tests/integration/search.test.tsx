import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SearchForm } from '@/components/search/SearchForm'
import { LineageView } from '@/app/(workspace)/_components/LineageView'
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
      lineage: null,
      loading: false,
      error: null,
      search: mockSearch,
      clear: mockClear,
      reset: mockReset
    })
  })

  describe('SearchForm', () => {
    it('should render search form with natural language input and submit button', () => {
      render(<SearchForm onSearch={mockSearch} />)
      
      expect(screen.getByLabelText(/tracil request/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /tracil it/i })).toBeInTheDocument()
    })

    it('should call onSearch when form is submitted with valid data', async () => {
      render(<SearchForm onSearch={mockSearch} />)
      
      const queryInput = screen.getByLabelText(/tracil request/i)
      const submitButton = screen.getByRole('button', { name: /tracil it/i })
      
      fireEvent.change(queryInput, { target: { value: 'diastolic blood pressure change from baseline at week 2' } })
      fireEvent.click(submitButton)
      
      expect(mockSearch).toHaveBeenCalledWith('diastolic blood pressure change from baseline at week 2')
    })

    it('should not call onSearch when form is submitted with empty data', () => {
      render(<SearchForm onSearch={mockSearch} />)
      
      const submitButton = screen.getByRole('button', { name: /tracil it/i })
      fireEvent.click(submitButton)
      
      expect(mockSearch).not.toHaveBeenCalled()
    })

    it('should show loading state when loading is true', () => {
      render(<SearchForm onSearch={mockSearch} loading={true} />)
      
      const submitButton = screen.getByRole('button', { name: /traciling/i })
      expect(submitButton).toBeDisabled()
      expect(screen.getByText(/traciling/i)).toBeInTheDocument()
    })

    it('should show error message when error is provided', () => {
      const errorMessage = 'Search failed'
      render(<SearchForm onSearch={mockSearch} error={errorMessage} />)
      
      expect(screen.getByText(errorMessage)).toBeInTheDocument()
      // The error icon is present but doesn't have a test ID, so we just verify the error message
    })
  })

  describe('LineageView (Search Mode)', () => {
    it('should render search results with lineage graph when data is available', () => {
      render(
        <LineageView
          variable="test-variable"
          dataset="test-dataset"
          onBack={jest.fn()}
          mode="search"
          backButtonText="← Back to Search"
          initialLineage={mockLineageData}
        />
      )
      
      // Use getAllByText for multiple instances
      const variableElements = screen.getAllByText(/test-variable/i)
      expect(variableElements.length).toBeGreaterThan(0)
      
      expect(screen.getByText(/test-dataset/i)).toBeInTheDocument()
      // LineageView renders the graph, so we check for the lineage content instead
      expect(screen.getByText(/Lineage for test-dataset\.test-variable/i)).toBeInTheDocument()
      // Check for TraceabilitySummary content
      expect(screen.getByText(/AI-Generated Traceability Summary/i)).toBeInTheDocument()
    })

    it('should show loading state when no initial lineage provided', () => {
      render(
        <LineageView
          variable="test-variable"
          dataset="test-dataset"
          onBack={jest.fn()}
          mode="search"
          backButtonText="← Back"
        />
      )
      
      expect(screen.getByText(/Loading lineage for test-dataset\.test-variable/i)).toBeInTheDocument()
    })

    it('should call onBack when back button is clicked', () => {
      const mockOnBack = jest.fn()
      render(
        <LineageView
          variable="test-variable"
          dataset="test-dataset"
          onBack={mockOnBack}
          mode="search"
          backButtonText="← Back"
          initialLineage={mockLineageData}
        />
      )
      
      const backButton = screen.getByRole('button', { name: /back/i })
      fireEvent.click(backButton)
      
      expect(mockOnBack).toHaveBeenCalled()
    })

    it('should display lineage summary information', () => {
      render(
        <LineageView
          variable="test-variable"
          dataset="test-dataset"
          onBack={jest.fn()}
          mode="search"
          backButtonText="← Back"
          initialLineage={mockLineageData}
        />
      )
      
      // LineageView now renders TraceabilitySummary which has different structure
      expect(screen.getByText(/AI-Generated Traceability Summary/i)).toBeInTheDocument()
      expect(screen.getByText(/Lineage Details/i)).toBeInTheDocument()
      // Check for the specific Nodes button in TraceabilitySummary
      expect(screen.getByRole('button', { name: /Nodes/i })).toBeInTheDocument()
      // Check for the specific Connections button in TraceabilitySummary
      expect(screen.getByRole('button', { name: /Connections/i })).toBeInTheDocument()
    })
  })

  describe('Search Flow Integration', () => {
    it('should handle complete search flow from form to results', async () => {
      // First render with empty state
      const { rerender } = render(<SearchForm onSearch={mockSearch} />)
      
      // Fill out and submit form
      const queryInput = screen.getByLabelText(/tracil request/i)
      const submitButton = screen.getByRole('button', { name: /tracil it/i })
      
      fireEvent.change(queryInput, { target: { value: 'diastolic blood pressure change from baseline at week 2' } })
      fireEvent.click(submitButton)
      
      expect(mockSearch).toHaveBeenCalledWith('diastolic blood pressure change from baseline at week 2')
      
      // Now render results view
      rerender(
        <LineageView
          variable="test-variable"
          dataset="test-dataset"
          onBack={jest.fn()}
          mode="search"
          backButtonText="← Back"
          initialLineage={mockLineageData}
        />
      )
      
      // Verify results are displayed (use getAllByText for multiple instances)
      const variableElements = screen.getAllByText(/test-variable/i)
      expect(variableElements.length).toBeGreaterThan(0)
      
      expect(screen.getByText(/test-dataset/i)).toBeInTheDocument()
      // LineageView renders the lineage content, so check for that instead
      expect(screen.getByText(/Lineage for test-dataset\.test-variable/i)).toBeInTheDocument()
      expect(screen.getByText(/AI-Generated Traceability Summary/i)).toBeInTheDocument()
    })
  })
})
