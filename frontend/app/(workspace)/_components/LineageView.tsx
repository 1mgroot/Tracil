"use client"

import { useState, useEffect, useRef } from 'react'
import { TraceabilitySummary } from '@/components/lineage/TraceabilitySummary'
import { LineageGraphReactFlow } from '@/components/lineage/LineageGraphReactFlow'
import { analyzeLineage } from '@/lib/ai/entrypoints/analyzeLineage'
import type { LineageGraph as LineageGraphType } from '@/types/lineage'

interface LineageViewProps {
  dataset: string
  variable: string
  onBack: () => void
}

export function LineageView({ dataset, variable, onBack }: LineageViewProps) {
  const [lineage, setLineage] = useState<LineageGraphType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Prevent duplicate API calls for the same dataset/variable combination
  const lastRequestRef = useRef<string>('')
  const isRequestingRef = useRef(false)

  useEffect(() => {
    const requestKey = `${dataset}:${variable}`
    
    // Prevent duplicate requests for the same dataset/variable
    if (lastRequestRef.current === requestKey && isRequestingRef.current) {
      return
    }
    
    // Prevent duplicate requests while one is already in progress
    if (isRequestingRef.current) {
      return
    }

    async function loadLineage() {
      try {
        isRequestingRef.current = true
        lastRequestRef.current = requestKey
        setLoading(true)
        setError(null)
        
        const result = await analyzeLineage({ dataset, variable })
        setLineage(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load lineage')
      } finally {
        setLoading(false)
        isRequestingRef.current = false
      }
    }

    loadLineage()
  }, [dataset, variable])

  if (loading) {
    return (
      <div className="flex-1 overflow-hidden p-6">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={onBack}
            className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
          >
            ← Back to Variables
          </button>
          <div className="h-6 w-px bg-gray-300" />
          <h1 className="text-xl font-semibold text-gray-900">
            Loading lineage for {dataset}.{variable}...
          </h1>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    )
  }

  if (error || !lineage) {
    return (
      <div className="flex-1 overflow-hidden p-6">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={onBack}
            className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
          >
            ← Back to Variables
          </button>
          <div className="h-6 w-px bg-gray-300" />
          <h1 className="text-xl font-semibold text-gray-900">
            Lineage for {dataset}.{variable}
          </h1>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-red-800 mb-2">
            Error Loading Lineage
          </h2>
          <p className="text-red-700">
            {error || 'Failed to load lineage data'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Fixed header - breadcrumb and back control */}
      <div className="flex-shrink-0 px-6 pt-6 pb-4">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
          >
            ← Back to Variables
          </button>
          <div className="h-6 w-px bg-gray-300" />
          <h1 className="text-xl font-semibold text-gray-900">
            Lineage for {dataset}.{variable}
          </h1>
        </div>
      </div>

      {/* Main content area - fills remaining viewport height */}
      <div className="flex-1 px-6 pb-6 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 h-full">
          {/* Summary card - left side on large screens, top on small screens */}
          <div className="lg:col-span-2 flex flex-col">
            <TraceabilitySummary lineage={lineage} />
          </div>
          
          {/* Graph canvas - main area */}
          <div className="lg:col-span-3 flex flex-col">
            <LineageGraphReactFlow lineage={lineage} />
          </div>
        </div>
      </div>
    </div>
  )
}
