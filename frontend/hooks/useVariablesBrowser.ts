import { useMemo, useState, useEffect, useCallback } from 'react'
import type { DatasetWithGroup, SourceAgnosticProcessFilesResponse } from '@/types/variables'
import { transformSourceAgnosticToUI } from '@/types/variables'

// API endpoint for getting processed files data
const API_ENDPOINT = '/api/ai/process-files'

/**
 * Hook for managing variables browser state and data
 * Fetches data from the Next.js API route which proxies to Python backend
 * Uses source-agnostic data structure directly
 */
export function useVariablesBrowser() {
  const [data, setData] = useState<SourceAgnosticProcessFilesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch data from API
  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      console.log('🔍 Fetching data from API:', API_ENDPOINT)
      const response = await fetch(API_ENDPOINT)
      
      console.log('📡 API Response status:', response.status, response.statusText)
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`)
      }
      
      const result: SourceAgnosticProcessFilesResponse = await response.json()
      console.log('📊 API Response data:', result)
      
      // Validate response structure
      if (!result || !result.standards) {
        throw new Error('Invalid API response structure: missing standards')
      }
      
      setData(result)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch data'
      console.error('❌ Error fetching variables data:', err)
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch data on mount
  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Transform API response to UI-compatible format
  const datasets = useMemo(() => {
    if (!data) return []
    return transformSourceAgnosticToUI(data)
  }, [data])

  // Create a lookup map for quick dataset retrieval by ID
  const datasetMap = useMemo(() => {
    const map = new Map<string, DatasetWithGroup>()
    datasets.forEach(dataset => {
      map.set(dataset.id, dataset)
    })
    return map
  }, [datasets])

  // Helper function to get dataset by ID
  const getDatasetById = useCallback((id: string): DatasetWithGroup | undefined => {
    return datasetMap.get(id)
  }, [datasetMap])

  // Helper function to get datasets by group
  const getDatasetsByGroup = useCallback((group: string) => {
    return datasets.filter(dataset => dataset.group === group)
  }, [datasets])

  // Refresh data
  const refresh = useCallback(() => {
    fetchData()
  }, [fetchData])

  return {
    datasets,
    datasetMap,
    getDatasetById,
    getDatasetsByGroup,
    loading,
    error,
    refresh,
    data
  }
}
