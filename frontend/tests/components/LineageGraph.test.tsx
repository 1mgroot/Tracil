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
      group: 'aCRF',
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
      confidence: 'high',
      label: 'Derived from'
    },
    {
      from: 'AE.AESCAN',
      to: 'CRF.Page.121',
      confidence: 'high',
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
    
    // Check that paths are rendered (edges)
    const paths = document.querySelectorAll('path')
    expect(paths).toHaveLength(2) // 2 edges
  })

  it('applies correct confidence colors to edges', () => {
    render(<LineageGraph lineage={mockLineageData} />)
    
    const paths = document.querySelectorAll('path')
    paths.forEach(path => {
      const stroke = path.getAttribute('stroke')
      // High confidence should be green (#10b981)
      expect(stroke).toBe('#10b981')
    })
  })

  it('renders accessibility information', () => {
    render(<LineageGraph lineage={mockLineageData} />)
    
    expect(screen.getByText('Lineage Details (Accessibility)')).toBeInTheDocument()
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
    
    // Check that confidence is displayed (appears twice - once for each edge)
    const confidenceTexts = screen.getAllByText(/Confidence: high/)
    expect(confidenceTexts).toHaveLength(2)
  })

  it('positions edges correctly between nodes with hierarchical layout', () => {
    render(<LineageGraph lineage={mockLineageData} />)
    
    // Now we use paths instead of lines
    const paths = document.querySelectorAll('path')
    expect(paths).toHaveLength(2) // 2 edges
    
    // Check that paths have proper d attributes (SVG path data)
    paths.forEach(path => {
      const pathData = path.getAttribute('d')
      expect(pathData).toBeTruthy()
      expect(pathData).toMatch(/^M\s+\d+/) // Should start with Move command
    })
  })
})
