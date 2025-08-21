import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { VariablesBrowser } from '@/components/variables/VariablesBrowser'
import type { DatasetWithGroup } from '@/types/variables'

// Mock the lineage components and analyzeLineage function
jest.mock('@/components/lineage/TraceabilitySummary', () => ({
  TraceabilitySummary: ({ lineage }: { lineage: any }) => (
    <div data-testid="traceability-summary">
      <h2>AI-Generated Traceability Summary</h2>
      <p>{lineage.summary}</p>
    </div>
  )
}))

jest.mock('@/components/lineage/LineageGraph', () => ({
  LineageGraph: ({ lineage }: { lineage: any }) => (
    <div data-testid="lineage-graph">
      <h2>Lineage Flow Chart</h2>
      <div>Nodes: {lineage.nodes.length}</div>
      <div>Edges: {lineage.edges.length}</div>
    </div>
  )
}))

jest.mock('@/lib/ai/entrypoints/analyzeLineage', () => ({
  analyzeLineage: jest.fn()
}))

const mockAnalyzeLineage = require('@/lib/ai/entrypoints/analyzeLineage').analyzeLineage

const mockDataset: DatasetWithGroup = {
  id: 'adsl-1',
  name: 'ADSL',
  label: 'Subject-Level Analysis Dataset',
  group: 'ADaM',
  fileId: 'adam_spec_v2.xlsx',
  variables: [
    {
      name: 'USUBJID',
      label: 'Unique Subject Identifier',
      type: 'character',
      length: 20,
      role: 'identifier',
      mandatory: true
    },
    {
      name: 'SEX',
      label: 'Sex',
      type: 'character',
      length: 1,
      role: 'covariate',
      mandatory: true,
      codelist: 'SEX'
    }
  ],
  metadata: {
    structure: 'Analysis dataset',
    version: '2.0',
    lastModified: '2024-01-16'
  }
}

const mockLineageData = {
  summary: 'SEX is captured on CRF, standardized in SDTM DM.SEX, and retained as ADSL.SEX.',
  nodes: [
    { id: 'aCRF.DEMO.SEX', title: 'CRF: Sex', group: 'aCRF', kind: 'source' },
    { id: 'SDTM.DM.SEX', title: 'DM.SEX', group: 'SDTM', kind: 'intermediate' },
    { id: 'ADaM.ADSL.SEX', title: 'ADSL.SEX', group: 'ADaM', kind: 'target' }
  ],
  edges: [
    { from: 'aCRF.DEMO.SEX', to: 'SDTM.DM.SEX', confidence: 0.95 },
    { from: 'SDTM.DM.SEX', to: 'ADaM.ADSL.SEX', confidence: 0.98 }
  ]
}

describe('VariablesBrowser', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAnalyzeLineage.mockResolvedValue(mockLineageData)
  })

  it('renders variables in grid layout by default', () => {
    render(<VariablesBrowser dataset={mockDataset} />)
    
    // Check for the dataset name and label separately since they're in different elements
    expect(screen.getByText('ADSL')).toBeInTheDocument()
    expect(screen.getByText('Subject-Level Analysis Dataset')).toBeInTheDocument()
    expect(screen.getByText('USUBJID')).toBeInTheDocument()
    expect(screen.getByText('SEX')).toBeInTheDocument()
  })

  it('switches to compact mode and shows lineage when variable is selected', async () => {
    render(<VariablesBrowser dataset={mockDataset} />)
    
    // Click on SEX variable
    const sexVariable = screen.getByText('SEX')
    fireEvent.click(sexVariable)
    
    // Wait for lineage to load
    await waitFor(() => {
      expect(screen.getByTestId('traceability-summary')).toBeInTheDocument()
    })
    
    // Should show lineage components
    expect(screen.getByTestId('traceability-summary')).toBeInTheDocument()
    expect(screen.getByTestId('lineage-graph')).toBeInTheDocument()
    
    // Should show back button
    expect(screen.getByText('Back to Variables')).toBeInTheDocument()
  })

  it('returns to full variables view when back button is clicked', async () => {
    render(<VariablesBrowser dataset={mockDataset} />)
    
    // Select a variable to show lineage
    const sexVariable = screen.getByText('SEX')
    fireEvent.click(sexVariable)
    
    await waitFor(() => {
      expect(screen.getByTestId('traceability-summary')).toBeInTheDocument()
    })
    
    // Click back button
    const backButton = screen.getByText('Back to Variables')
    fireEvent.click(backButton)
    
    // Should return to full variables view
    await waitFor(() => {
      expect(screen.queryByTestId('traceability-summary')).not.toBeInTheDocument()
    })
  })

  it('calls analyzeLineage with correct parameters', async () => {
    render(<VariablesBrowser dataset={mockDataset} />)
    
    const sexVariable = screen.getByText('SEX')
    fireEvent.click(sexVariable)
    
    await waitFor(() => {
      expect(mockAnalyzeLineage).toHaveBeenCalledWith({
        dataset: 'ADSL',
        variable: 'SEX'
      })
    })
  })

  it('shows loading state while fetching lineage', async () => {
    // Make the mock return a delayed promise
    mockAnalyzeLineage.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(mockLineageData), 100)))
    
    render(<VariablesBrowser dataset={mockDataset} />)
    
    const sexVariable = screen.getByText('SEX')
    fireEvent.click(sexVariable)
    
    // Should show loading state
    expect(screen.getByText('Loading lineage data...')).toBeInTheDocument()
    
    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading lineage data...')).not.toBeInTheDocument()
    })
  })

  it('handles lineage loading errors gracefully', async () => {
    mockAnalyzeLineage.mockRejectedValue(new Error('Failed to load lineage'))
    
    render(<VariablesBrowser dataset={mockDataset} />)
    
    const sexVariable = screen.getByText('SEX')
    fireEvent.click(sexVariable)
    
    // Should not crash and should allow going back
    await waitFor(() => {
      expect(screen.getByText('Back to Variables')).toBeInTheDocument()
    })
  })
})
