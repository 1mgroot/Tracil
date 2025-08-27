import { render, screen } from '@testing-library/react'
import { LineageGraph } from '@/components/lineage/LineageGraph'
import type { LineageGraph as LineageGraphType } from '@/types/lineage'

// Mock data that matches the backend structure
const mockLineageData: LineageGraphType = {
  summary: 'Test lineage for ADAE.AESCAN',
  nodes: [
    {
      id: 'ADAE.AESCAN',
      title: 'AESCAN',
      dataset: 'ADAE',
      variable: 'AESCAN',
      group: 'ADaM',
      kind: 'target',
      meta: {
        notes: 'Adverse Event Scan'
      }
    },
    {
      id: 'AE.AESCAN',
      title: 'AESCAN',
      dataset: 'ADAE',
      variable: 'AESCAN',
      group: 'ADaM',
      kind: 'target',
      meta: {
        notes: 'Adverse Event Scan'
      }
    },
    {
      id: 'CRF.Page.121',
      title: 'CRF Page 121',
      dataset: 'ADAE',
      variable: 'AESCAN',
      group: 'CRF',
      kind: 'target',
      meta: {
        file: 'blankcrf.pdf',
        notes: 'CRF page for AE data'
      }
    }
  ],
  edges: [
    {
      from: 'ADAE.AESCAN',
      to: 'AE.AESCAN',
      label: 'Derived from'
    },
    {
      from: 'AE.AESCAN',
      to: 'CRF.Page.121',
      label: 'Collected on'
    }
  ],
  gaps: {
    notes: []
  }
}

describe('LineageGraph', () => {
  it('renders all nodes with correct titles', () => {
    render(<LineageGraph lineage={mockLineageData} />)
    
    // Check that all expected nodes are rendered
    // There are 2 buttons with "AESCAN" title + 2 spans in accessibility section = 4 total
    const aescans = screen.getAllByText('AESCAN')
    expect(aescans).toHaveLength(4) // 2 buttons + 2 spans in accessibility
    
    // CRF Page 121 appears twice (button + accessibility span)
    const crfPages = screen.getAllByText('CRF Page 121')
    expect(crfPages).toHaveLength(2)
  })

  it('renders edges with correct SVG elements', () => {
    render(<LineageGraph lineage={mockLineageData} />)
    
    // Check that SVG elements are rendered
    const svg = document.querySelector('svg')
    expect(svg).toBeInTheDocument()
    
    // Check that paths are rendered (edges) - only count the actual edge paths, not accessibility icons
    const edgePaths = document.querySelectorAll('svg path[marker-end]')
    expect(edgePaths).toHaveLength(2) // 2 edges
  })



  it('renders accessibility information', () => {
    render(<LineageGraph lineage={mockLineageData} />)
    
    expect(screen.getByText('Lineage Details')).toBeInTheDocument()
    expect(screen.getByText('Nodes:')).toBeInTheDocument()
    expect(screen.getByText('Connections:')).toBeInTheDocument()
  })

  it('shows correct node metadata in accessibility section', () => {
    render(<LineageGraph lineage={mockLineageData} />)
    
    // Check that the specific node with source file is shown
    expect(screen.getByText(/Source: blankcrf\.pdf/)).toBeInTheDocument()
    
    // Check that connection labels are shown correctly
    expect(screen.getByText(/Derived from/)).toBeInTheDocument()
    expect(screen.getByText(/Collected on/)).toBeInTheDocument()
  })

  it('handles edges with and without explanation fields', () => {
    // Test with mock data that has explanation fields
    const mockLineageWithExplanation = {
      summary: 'Test lineage with explanations',
      nodes: [
        { id: 'A', title: 'Node A', group: 'ADaM' as const, kind: 'source' as const },
        { id: 'B', title: 'Node B', group: 'SDTM' as const, kind: 'target' as const }
      ],
      edges: [
        { from: 'A', to: 'B', label: 'Test', explanation: 'This is a test explanation' },
        { from: 'B', to: 'A', label: 'Reverse' } // No explanation
      ],
      gaps: { notes: [] }
    }
    
    render(<LineageGraph lineage={mockLineageWithExplanation} />)
    
    // Check that explanation is displayed when present
    expect(screen.getByText(/This is a test explanation/)).toBeInTheDocument()
    
    // Check that edge without explanation still works
    expect(screen.getByText(/Reverse/)).toBeInTheDocument()
  })

  it('positions edges correctly between nodes with hierarchical layout', () => {
    render(<LineageGraph lineage={mockLineageData} />)
    
    // Now we use paths instead of lines - only count the actual edge paths
    const edgePaths = document.querySelectorAll('svg path[marker-end]')
    expect(edgePaths).toHaveLength(2) // 2 edges
    
    // Check that paths have proper d attributes (SVG path data)
    edgePaths.forEach(path => {
      const pathData = path.getAttribute('d')
      expect(pathData).toBeTruthy()
      expect(pathData).toMatch(/^M\s+\d+/) // Should start with Move command
    })
  })
})
