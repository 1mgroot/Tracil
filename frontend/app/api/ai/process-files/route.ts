import { NextRequest, NextResponse } from 'next/server'
import type { SourceAgnosticProcessFilesResponse } from '@/types/variables'

// Configuration
const PYTHON_BACKEND_URL = process.env.PYTHON_AI_BACKEND_URL || 'http://localhost:8000'
const API_TIMEOUT_MS = parseInt(process.env.AI_API_TIMEOUT_MS || '30000')

/**
 * Next.js API route for processing files
 * Proxies requests to Python backend and returns CDISC-organized data
 * 
 * Note: This route is currently for testing - you can send files directly to backend
 * Future: Will handle file uploads from frontend
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Get files from request
    const formData = await request.formData()
    const files = formData.getAll('files') as File[]
    
    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      )
    }

    console.log(`📁 Processing ${files.length} files:`, files.map(f => f.name))

    // Forward to Python backend
    const backendFormData = new FormData()
    files.forEach(file => {
      backendFormData.append('files', file)
    })

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS)

    try {
      const response = await fetch(`${PYTHON_BACKEND_URL}/process-files`, {
        method: 'POST',
        body: backendFormData,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`Backend error: ${response.statusText}`)
      }

      const data: SourceAgnosticProcessFilesResponse = await response.json()
      console.log('✅ Files processed successfully by backend')
      return NextResponse.json(data)
    } catch (error) {
      clearTimeout(timeoutId)
      throw error
    }
    
  } catch (error) {
    console.error('Error processing files:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to process files',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * GET method for getting processed files data
 * Returns mock data for testing, or checks backend health if requested
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Check if this is a health check request
    const url = new URL(request.url)
    const isHealthCheck = url.searchParams.get('health') === 'true'
    
    if (isHealthCheck) {
      // Health check functionality
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)

      try {
        const response = await fetch(`${PYTHON_BACKEND_URL}/health`, {
          signal: controller.signal,
        })
        
        clearTimeout(timeoutId)
        
        if (response.ok) {
          return NextResponse.json({ 
            status: 'healthy',
            backend: 'connected',
            timestamp: new Date().toISOString()
          })
        } else {
          return NextResponse.json({ 
            status: 'unhealthy',
            backend: 'error',
            error: response.statusText,
            timestamp: new Date().toISOString()
          }, { status: 503 })
        }
      } catch (error) {
        clearTimeout(timeoutId)
        return NextResponse.json({ 
          status: 'unhealthy',
          backend: 'unreachable',
          error: error instanceof Error ? error.message : 'Connection failed',
          timestamp: new Date().toISOString()
        }, { status: 503 })
      }
    }
    
    // Default: fetch real data from Python backend
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS)

      const response = await fetch(`${PYTHON_BACKEND_URL}/process-files`, {
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (response.ok) {
        const data: SourceAgnosticProcessFilesResponse = await response.json()
        return NextResponse.json(data)
      } else {
        throw new Error(`Backend error: ${response.status} ${response.statusText}`)
      }
    } catch (error) {
      console.error('Error fetching from backend:', error)
      
      // Return empty data structure if backend is unavailable
      return NextResponse.json({
        standards: {},
        metadata: {
          processedAt: new Date().toISOString(),
          totalVariables: 0,
          sourceFiles: [],
          message: "Backend unavailable. Please ensure Python backend is running and try again.",
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      })
    }
    
  } catch {
    return NextResponse.json({ 
      status: 'error',
      error: 'Failed to get data',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
