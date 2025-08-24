import { useMemo, useState, useCallback } from 'react'
import type { DatasetWithGroup, SourceAgnosticProcessFilesResponse } from '@/types/variables'
import { transformSourceAgnosticToUI } from '@/types/variables'

// API endpoint for getting processed files data
const API_ENDPOINT = '/api/ai/process-files'

/**
 * Hook for managing variables browser state and data
 * Only fetches data when explicitly requested (after file upload)
 * Uses source-agnostic data structure directly
 */
export function useVariablesBrowser() {
  const [data, setData] = useState<SourceAgnosticProcessFilesResponse | null>(null)
  const [loading, setLoading] = useState(false) // Start with false since we don't auto-fetch
  const [error, setError] = useState<string | null>(null)
  const [hasUploadedFiles, setHasUploadedFiles] = useState(false)

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
      setHasUploadedFiles(true) // Mark that we have data from upload
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch data'
      console.error('❌ Error fetching variables data:', err)
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [])

  // Only fetch data if files have been uploaded
  const fetchDataIfUploaded = useCallback(async () => {
    if (hasUploadedFiles) {
      await fetchData()
    }
  }, [hasUploadedFiles, fetchData])

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

  // Set data directly (useful for upload responses)
  const setDataDirectly = useCallback((newData: SourceAgnosticProcessFilesResponse) => {
    if (newData && newData.standards) {
      setData(newData)
      setHasUploadedFiles(true)
      setError(null)
      console.log('✅ Data set directly from upload response')
    } else {
      console.warn('⚠️ Invalid data structure for setDataDirectly:', newData)
    }
  }, [])

  return {
    datasets,
    datasetMap,
    getDatasetById,
    getDatasetsByGroup,
    loading,
    error,
    refresh,
    data,
    hasUploadedFiles,
    setHasUploadedFiles,
    setDataDirectly
  }
}
