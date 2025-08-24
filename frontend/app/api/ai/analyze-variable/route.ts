import { NextRequest, NextResponse } from 'next/server'
import type { AnalyzeVariableRequest, AnalyzeVariableResponse } from '@/types/variables'

// Configuration
const PYTHON_BACKEND_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'
const API_TIMEOUT_MS = parseInt(process.env.NEXT_PUBLIC_API_TIMEOUT_MS || '30000')

/**
 * Next.js API route for analyzing variable lineage
 * Proxies requests to Python backend and returns lineage analysis
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Parse request body
    const body: AnalyzeVariableRequest = await request.json()
    
    if (!body.variable || !body.dataset) {
      return NextResponse.json(
        { error: 'Missing required fields: variable and dataset' },
        { status: 400 }
      )
    }

    // Forward to Python backend
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS)

    try {
      const response = await fetch(`${PYTHON_BACKEND_URL}/analyze-variable`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Backend error: ${response.statusText} - ${errorText}`)
      }

      const data: AnalyzeVariableResponse = await response.json()
      return NextResponse.json(data)
    } catch (error) {
      clearTimeout(timeoutId)
      throw error
    }
    
  } catch (error) {
    console.error('Error analyzing variable:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to analyze variable',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * GET method for health check
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ 
    status: 'healthy',
    endpoint: 'analyze-variable',
    timestamp: new Date().toISOString()
  })
}
