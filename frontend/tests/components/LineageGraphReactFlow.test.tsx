import { render, screen } from '@testing-library/react'
import { LineageGraphReactFlow } from '@/components/lineage/LineageGraphReactFlow'
import type { LineageGraph as LineageGraphType } from '@/types/lineage'

// Global mock for dagre to avoid import issues
const mockDagreGraph = {
  setDefaultEdgeLabel: jest.fn(),
  setGraph: jest.fn(),
  setNode: jest.fn(),
  setEdge: jest.fn(),
  layout: jest.fn(),
  node: jest.fn().mockReturnValue({ x: 100, y: 100, width: 160, height: 60 }),
  nodes: jest.fn().mockReturnValue([]),
  edges: jest.fn().mockReturnValue([]),
  removeNode: jest.fn(),
  removeEdge: jest.fn()
}

// Mock dagre at module level
jest.mock('dagre', () => ({
  __esModule: true,
  graphlib: {
    Graph: jest.fn(() => mockDagreGraph)
  },
  layout: jest.fn()
}))

// Mock React Flow to avoid canvas rendering issues in tests
jest.mock('reactflow', () => ({
  __esModule: true,
  default: ({ children, ...props }: any) => (
    <div data-testid="react-flow" {...props}>
      {children}
    </div>
  ),
  Background: () => <div data-testid="react-flow-background">Background</div>,
  useNodesState: (initialNodes: any) => [initialNodes, jest.fn(), jest.fn()],
  useEdgesState: (initialEdges: any) => [initialEdges, jest.fn(), jest.fn()],
  useReactFlow: () => ({
    fitView: jest.fn()
  }),
  ReactFlowProvider: ({ children }: any) => <div data-testid="react-flow-provider">{children}</div>,
  Position: { Bottom: 'bottom', Top: 'top' },
  MarkerType: { ArrowClosed: 'arrowclosed' },
}))



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
      group: 'SDTM',
      kind: 'intermediate',
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
      kind: 'source',
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

describe('LineageGraphReactFlow', () => {
  it('renders React Flow container', () => {
    render(<LineageGraphReactFlow lineage={mockLineageData} />)
    
    expect(screen.getByTestId('react-flow')).toBeInTheDocument()
    expect(screen.getByTestId('react-flow-background')).toBeInTheDocument()
  })

  it('renders accessibility information', () => {
    render(<LineageGraphReactFlow lineage={mockLineageData} />)
    
    expect(screen.getByText('Lineage Details')).toBeInTheDocument()
    expect(screen.getByText('Nodes:')).toBeInTheDocument()
    expect(screen.getByText('Connections:')).toBeInTheDocument()
  })

  it('shows correct node metadata in accessibility section', () => {
    render(<LineageGraphReactFlow lineage={mockLineageData} />)
    
    // Check that the specific node with source file is shown
    expect(screen.getByText(/Source: blankcrf\.pdf/)).toBeInTheDocument()
    
    // Check that connection labels are shown correctly
    expect(screen.getByText(/Derived from/)).toBeInTheDocument()
    expect(screen.getByText(/Collected on/)).toBeInTheDocument()
    

  })

  it('renders chart title', () => {
    render(<LineageGraphReactFlow lineage={mockLineageData} />)
    
    expect(screen.getByText('Lineage flow chart')).toBeInTheDocument()
  })
})
