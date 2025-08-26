import { NextRequest, NextResponse } from 'next/server'
import type { AnalyzeVariableRequest, AnalyzeVariableResponse } from '@/types/variables'
import { processLineageData } from '@/lib/utils'

// Configuration
const PYTHON_BACKEND_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'
const API_TIMEOUT_MS = parseInt(process.env.NEXT_PUBLIC_API_TIMEOUT_MS || '120000') // Increased to 2 minutes

// Simple in-memory cache to prevent duplicate requests
const requestCache = new Map<string, { data: AnalyzeVariableResponse; timestamp: number }>()
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes cache TTL

// Clean up expired cache entries periodically
setInterval(() => {
  const now = Date.now()
  for (const [key, value] of requestCache.entries()) {
    if (now - value.timestamp > CACHE_TTL_MS) {
      requestCache.delete(key)
    }
  }
}, CACHE_TTL_MS)

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

    // Check cache for existing request
    const cacheKey = `${body.dataset}:${body.variable}`
    const cachedResult = requestCache.get(cacheKey)
    
    if (cachedResult && (Date.now() - cachedResult.timestamp) < CACHE_TTL_MS) {
      console.log(`✅ Returning cached result for ${cacheKey}`)
      return NextResponse.json(cachedResult.data)
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
      
      // Deduplicate lineage data to prevent React key conflicts
      if (data.lineage && data.lineage.nodes && data.lineage.edges) {
        const processedData = processLineageData(data.lineage.nodes, data.lineage.edges)
        
        // Create a new object with deduplicated data since the original is readonly
        const deduplicatedData: AnalyzeVariableResponse = {
          ...data,
          lineage: {
            ...data.lineage,
            nodes: processedData.nodes,
            edges: processedData.edges
          }
        }
        
        // Cache the result
        requestCache.set(cacheKey, { 
          data: deduplicatedData, 
          timestamp: Date.now() 
        })
        
        console.log(`✅ Deduplicated lineage data: ${processedData.nodes.length} nodes, ${processedData.edges.length} edges`)
        return NextResponse.json(deduplicatedData)
      }
      
      // Cache the result even if no deduplication needed
      requestCache.set(cacheKey, { 
        data, 
        timestamp: Date.now() 
      })
      
      return NextResponse.json(data)
    } catch (error) {
      clearTimeout(timeoutId)
      
      // Handle specific timeout/abort errors
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timed out after ${API_TIMEOUT_MS / 1000} seconds. The AI analysis is taking longer than expected.`)
      }
      
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
