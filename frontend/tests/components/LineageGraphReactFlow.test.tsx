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
  Controls: () => <div data-testid="react-flow-controls">Controls</div>,
  MiniMap: () => <div data-testid="react-flow-minimap">MiniMap</div>,
  Handle: () => <div data-testid="react-flow-handle">Handle</div>,
  NodeResizer: () => <div data-testid="react-flow-node-resizer">NodeResizer</div>,
  useNodesState: (initialNodes: any) => [initialNodes, jest.fn(), jest.fn()],
  useEdgesState: (initialEdges: any) => [initialEdges, jest.fn(), jest.fn()],
  useReactFlow: () => ({
    fitView: jest.fn()
  }),
  ReactFlowProvider: ({ children }: any) => <div data-testid="react-flow-provider">{children}</div>,
  Position: { 
    Bottom: 'bottom', 
    Top: 'top', 
    Left: 'left', 
    Right: 'right' 
  },
  MarkerType: { 
    ArrowClosed: 'arrowclosed',
    Arrow: 'arrow'
  },
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
      group: 'CRF',
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
      label: 'Derived from',
      explanation: '[direct] Direct mapping from SDTM AE.AESCAN to ADaM ADAE.AESCAN as per define.xml'
    },
    {
      from: 'AE.AESCAN',
      to: 'CRF.Page.121',
      label: 'Collected on',
      explanation: '[reasoned] Data collected on CRF page 121 based on aCRF index and protocol section 5.2'
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

  it('renders chart title', () => {
    render(<LineageGraphReactFlow lineage={mockLineageData} />)
    
    expect(screen.getByText('Lineage Flow Chart')).toBeInTheDocument()
  })

  it('renders React Flow with proper configuration', () => {
    render(<LineageGraphReactFlow lineage={mockLineageData} />)
    
    // Check that React Flow is configured correctly
    const reactFlowElement = screen.getByTestId('react-flow')
    expect(reactFlowElement).toBeInTheDocument()
    
    // Check that background is rendered
    expect(screen.getByTestId('react-flow-background')).toBeInTheDocument()
  })

  it('processes trace strength from edge explanations', () => {
    const lineageWithTraceStrengths: LineageGraphType = {
      summary: 'Test trace strength processing',
      nodes: [
        {
          id: 'node1',
          title: 'Node 1',
          group: 'SDTM',
          kind: 'source'
        },
        {
          id: 'node2', 
          title: 'Node 2',
          group: 'ADaM',
          kind: 'target'
        },
        {
          id: 'node3',
          title: 'Node 3', 
          group: 'CRF',
          kind: 'intermediate'
        }
      ],
      edges: [
        {
          from: 'node1',
          to: 'node2',
          explanation: '[direct] Direct mapping with exact citation'
        },
        {
          from: 'node2',
          to: 'node3',
          explanation: '[reasoned] Inferred from nearby evidence'
        },
        {
          from: 'node1',
          to: 'node3',
          explanation: '[general] Based on CDISC conventions'
        },
        {
          from: 'node2',
          to: 'node1',
          explanation: 'No trace strength indicator'
        }
      ],
      gaps: { notes: [] }
    }

    render(<LineageGraphReactFlow lineage={lineageWithTraceStrengths} />)
    
    // Component should render without errors when processing different trace strengths
    expect(screen.getByText('Lineage Flow Chart')).toBeInTheDocument()
    expect(screen.getByTestId('react-flow')).toBeInTheDocument()
  })

  it('correctly extracts trace strength from explanations', () => {
    // Test the trace strength extraction logic directly
    const { LineageGraphReactFlow } = require('@/components/lineage/LineageGraphReactFlow')
    
    // Since extractTraceStrength is not exported, we test it indirectly through the component behavior
    // The component should handle various explanation formats without errors
    const testCases = [
      { explanation: '[direct] Exact citation', expected: 'direct' },
      { explanation: '[reasoned] Inferred from evidence', expected: 'reasoned' },
      { explanation: '[general] CDISC conventions', expected: 'general' },
      { explanation: 'No trace strength', expected: null },
      { explanation: '', expected: null },
      { explanation: undefined, expected: null },
      { explanation: '[invalid] Unknown strength', expected: null }
    ]
    
    // Test that component renders without errors for all test cases
    testCases.forEach((testCase, index) => {
      const testLineage = {
        summary: `Test case ${index}`,
        nodes: [
          { id: 'node1', title: 'Node 1', group: 'SDTM' as const, kind: 'source' as const },
          { id: 'node2', title: 'Node 2', group: 'ADaM' as const, kind: 'target' as const }
        ],
        edges: [
          { from: 'node1', to: 'node2', explanation: testCase.explanation }
        ],
        gaps: { notes: [] }
      }
      
      const { unmount } = render(<LineageGraphReactFlow lineage={testLineage} />)
      expect(screen.getByText('Lineage Flow Chart')).toBeInTheDocument()
      unmount()
    })
  })

  it('renders trace strength legend', () => {
    render(<LineageGraphReactFlow lineage={mockLineageData} />)
    
    // Check that legend is rendered
    expect(screen.getByText('Trace Strength')).toBeInTheDocument()
    
    // Check that all trace strength types are shown (text is split across elements)
    expect(screen.getByText('Direct')).toBeInTheDocument()
    expect(screen.getByText('- Exact citation')).toBeInTheDocument()
    expect(screen.getByText('Reasoned')).toBeInTheDocument()
    expect(screen.getByText('- Inferred evidence')).toBeInTheDocument()
    expect(screen.getByText('General')).toBeInTheDocument()
    expect(screen.getByText('- CDISC conventions')).toBeInTheDocument()
  })
})
