import type { 
  SourceAgnosticProcessFilesResponse,
  AnalyzeVariableRequest,
  AnalyzeVariableResponse 
} from '@/types/variables'

// Configuration
const PYTHON_BACKEND_URL = process.env.NEXT_PUBLIC_PYTHON_BACKEND_URL || 'http://localhost:8000'
const API_TIMEOUT_MS = 30000

// Error handling
class APIError extends Error {
  constructor(
    message: string,
    public status: number,
    public statusText: string
  ) {
    super(message)
    this.name = 'APIError'
  }
}

// Utility function for making API calls with timeout and error handling
async function apiCall<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS)

  try {
    const response = await fetch(`${PYTHON_BACKEND_URL}${endpoint}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new APIError(
        `API request failed: ${response.statusText}`,
        response.status,
        response.statusText
      )
    }

    return await response.json()
  } catch (error) {
    clearTimeout(timeoutId)
    
    if (error instanceof APIError) {
      throw error
    }
    
    if (error instanceof Error && error.name === 'AbortError') {
      throw new APIError('Request timeout', 408, 'Request Timeout')
    }
    
    throw new APIError(
      `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      0,
      'Network Error'
    )
  }
}

// API functions for communicating with Python backend
export const apiClient = {
  /**
   * Process uploaded files and return CDISC-organized data structure
   * This endpoint is called by the Next.js API route, not directly from frontend
   */
  async processFiles(files: File[]): Promise<SourceAgnosticProcessFilesResponse> {
    // Note: This function is for future use when we implement file upload
    // Currently, the frontend gets data from the Next.js API route
    throw new Error('Direct file processing not yet implemented. Use Next.js API route.')
  },

  /**
   * Analyze lineage for a specific variable
   * This endpoint is called by the Next.js API route, not directly from frontend
   */
  async analyzeVariable(request: AnalyzeVariableRequest): Promise<AnalyzeVariableResponse> {
    // Note: This function is for future use when we implement direct backend calls
    // Currently, the frontend gets data from the Next.js API route
    throw new Error('Direct variable analysis not yet implemented. Use Next.js API route.')
  },

  /**
   * Health check for the Python backend
   */
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return apiCall('/health')
  }
}

// Export error class for use in components
export { APIError }
