import { render, screen } from '@testing-library/react'
import { MainScreenClient } from '@/app/(workspace)/_components/MainScreenClient'
import { useVariablesBrowser } from '@/hooks/useVariablesBrowser'
import { mockSourceAgnosticResponse } from '@/features/variables/mockSourceAgnostic'

// Mock the hooks
jest.mock('@/hooks/useVariablesBrowser')
jest.mock('@/hooks/useSearch', () => ({
  useSearch: () => ({
    query: '',
    lineage: null,
    loading: false,
    error: null,
    search: jest.fn(),
    clear: jest.fn(),
    reset: jest.fn()
  })
}))
jest.mock('@/hooks/useSidebarKeyboardNav', () => ({
  useSidebarKeyboardNav: () => ({
    handleKeyDown: jest.fn()
  })
}))

// Mock the components
jest.mock('@/components/ui/sidebar/Sidebar', () => ({
  Sidebar: ({ children }: { children: React.ReactNode }) => <div data-testid="sidebar">{children}</div>,
  SidebarGroup: ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div data-testid={`sidebar-group-${label}`}>{children}</div>
  ),
  SidebarItem: ({ children }: { children: React.ReactNode }) => <div data-testid="sidebar-item">{children}</div>
}))

jest.mock('@/components/ui/sidebar/SidebarToggle', () => ({
  SidebarToggle: () => <div data-testid="sidebar-toggle" />
}))

jest.mock('@/components/ui/FileUploadButton', () => ({
  FileUploadButton: () => <div data-testid="file-upload-button" />
}))

jest.mock('@/components/ui/FileUploadModal', () => ({
  FileUploadModal: () => <div data-testid="file-upload-modal" />
}))

jest.mock('@/components/search/SearchForm', () => ({
  SearchForm: () => <div data-testid="search-form" />
}))

jest.mock('@/components/variables', () => ({
  VariablesBrowser: () => <div data-testid="variables-browser" />
}))

jest.mock('@/app/(workspace)/_components/LineageView', () => ({
  LineageView: () => <div data-testid="lineage-view" />
}))

const mockUseVariablesBrowser = useVariablesBrowser as jest.MockedFunction<typeof useVariablesBrowser>

describe('MainScreenClient - Protocol Section', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should not show Protocol section when StudyDesign_USDM does not exist', () => {
    // Mock response without StudyDesign_USDM
    const mockResponseWithoutStudyDesign = {
      ...mockSourceAgnosticResponse,
      standards: {
        ...mockSourceAgnosticResponse.standards,
        Protocol: {
          type: "Protocol",
          label: "Clinical Study Protocol",
          datasetEntities: {
            "Protocol": {
              name: "Protocol",
              label: "Clinical Study Protocol",
              type: "protocol_document",
              variables: [],
              sourceFiles: [],
              metadata: {
                structure: "document",
                validationStatus: "not_applicable"
              }
            }
          },
          metadata: {
            version: "1.0",
            lastModified: "2024-01-15",
            totalEntities: 1
          }
        }
      }
    }

    mockUseVariablesBrowser.mockReturnValue({
      datasets: [],
      getDatasetById: jest.fn(),
      loading: false,
      error: null,
      refresh: jest.fn(),
      hasUploadedFiles: true,
      setHasUploadedFiles: jest.fn(),
      setDataDirectly: jest.fn(),
      data: mockResponseWithoutStudyDesign
    })

    render(<MainScreenClient />)
    
    // Protocol section should not be visible
    expect(screen.queryByTestId('sidebar-group-Protocol')).not.toBeInTheDocument()
  })

  it('should show Protocol section with only 4 specific items when StudyDesign_USDM exists', () => {
    // Mock response with StudyDesign_USDM
    const mockResponseWithStudyDesign = {
      ...mockSourceAgnosticResponse,
      standards: {
        ...mockSourceAgnosticResponse.standards,
        Protocol: {
          type: "Protocol",
          label: "Clinical Study Protocol",
          datasetEntities: {
            "StudyDesign_USDM": {
              name: "StudyDesign_USDM",
              label: "Study Design from USDM",
              type: "protocol_design",
              variables: [],
              sourceFiles: [],
              metadata: {
                design: {
                  endpoints: [
                    { id: "EP1", name: "Primary Endpoint", description: "Test endpoint", type: "Primary Endpoint" }
                  ],
                  objectives: [
                    { id: "OBJ1", name: "Primary Objective", description: "Test objective" }
                  ],
                  populations: [
                    { id: "POP1", name: "ITT Population", description: "Intent to treat population" }
                  ],
                  soa: {
                    forms: ["Form1", "Form2"],
                    schedule: ["Visit1", "Visit2"]
                  }
                }
              }
            }
          },
          metadata: {
            version: "1.0",
            lastModified: "2024-01-15",
            totalEntities: 1
          }
        }
      }
    }

    mockUseVariablesBrowser.mockReturnValue({
      datasets: [
        {
          name: 'Endpoints',
          label: 'Protocol Endpoints (1)',
          variables: [],
          metadata: {},
          id: 'Protocol-Endpoints',
          group: 'Protocol',
          fileId: 'test',
          sourceFiles: []
        },
        {
          name: 'Objectives',
          label: 'Protocol Objectives (1)',
          variables: [],
          metadata: {},
          id: 'Protocol-Objectives',
          group: 'Protocol',
          fileId: 'test',
          sourceFiles: []
        },
        {
          name: 'Populations',
          label: 'Protocol Populations (1)',
          variables: [],
          metadata: {},
          id: 'Protocol-Populations',
          group: 'Protocol',
          fileId: 'test',
          sourceFiles: []
        },
        {
          name: 'SOA',
          label: 'Protocol SOA (2 forms, 2 schedules)',
          variables: [],
          metadata: {},
          id: 'Protocol-SOA',
          group: 'Protocol',
          fileId: 'test',
          sourceFiles: []
        }
      ],
      getDatasetById: jest.fn(),
      loading: false,
      error: null,
      refresh: jest.fn(),
      hasUploadedFiles: true,
      setHasUploadedFiles: jest.fn(),
      setDataDirectly: jest.fn(),
      data: mockResponseWithStudyDesign
    })

    render(<MainScreenClient />)
    
    // Protocol section should be visible
    expect(screen.getByTestId('sidebar-group-Protocol')).toBeInTheDocument()
    
    // Should show all 4 specific items
    expect(screen.getByText('Endpoints')).toBeInTheDocument()
    expect(screen.getByText('Objectives')).toBeInTheDocument()
    expect(screen.getByText('Populations')).toBeInTheDocument()
    expect(screen.getByText('SOA')).toBeInTheDocument()
  })

  it('should filter out non-standard Protocol items', () => {
    // Mock response with StudyDesign_USDM but also some non-standard Protocol items
    const mockResponseWithStudyDesign = {
      ...mockSourceAgnosticResponse,
      standards: {
        ...mockSourceAgnosticResponse.standards,
        Protocol: {
          type: "Protocol",
          label: "Clinical Study Protocol",
          datasetEntities: {
            "StudyDesign_USDM": {
              name: "StudyDesign_USDM",
              label: "Study Design from USDM",
              type: "protocol_design",
              variables: [],
              sourceFiles: [],
              metadata: {
                design: {
                  endpoints: [{ id: "EP1", name: "Primary Endpoint", description: "Test endpoint", type: "Primary Endpoint" }],
                  objectives: [{ id: "OBJ1", name: "Primary Objective", description: "Test objective" }],
                  populations: [{ id: "POP1", name: "ITT Population", description: "Intent to treat population" }],
                  soa: { forms: ["Form1"], schedule: ["Visit1"] }
                }
              }
            }
          },
          metadata: { version: "1.0", lastModified: "2024-01-15", totalEntities: 1 }
        }
      }
    }

    mockUseVariablesBrowser.mockReturnValue({
      datasets: [
        {
          name: 'Endpoints',
          label: 'Protocol Endpoints (1)',
          variables: [],
          metadata: {},
          id: 'Protocol-Endpoints',
          group: 'Protocol',
          fileId: 'test',
          sourceFiles: []
        },
        {
          name: 'NonStandardItem', // This should be filtered out
          label: 'Non-standard item',
          variables: [],
          metadata: {},
          id: 'Protocol-NonStandard',
          group: 'Protocol',
          fileId: 'test',
          sourceFiles: []
        }
      ],
      getDatasetById: jest.fn(),
      loading: false,
      error: null,
      refresh: jest.fn(),
      hasUploadedFiles: true,
      setHasUploadedFiles: jest.fn(),
      setDataDirectly: jest.fn(),
      data: mockResponseWithStudyDesign
    })

    render(<MainScreenClient />)
    
    // Protocol section should be visible
    expect(screen.getByTestId('sidebar-group-Protocol')).toBeInTheDocument()
    
    // Should only show the standard item
    expect(screen.getByText('Endpoints')).toBeInTheDocument()
    expect(screen.queryByText('NonStandardItem')).not.toBeInTheDocument()
  })
})
