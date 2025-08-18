import { useMemo } from 'react'
import type { DatasetWithGroup } from '@/types/variables'
import { mockProcessFilesResponse } from '@/features/variables/mocks'
import { transformApiResponseToUI } from '@/types/variables'

/**
 * Hook for managing variables browser state and data
 * Provides transformed dataset data compatible with UI components
 */
export function useVariablesBrowser() {
  // Transform API response to UI-compatible format
  const datasets = useMemo(() => {
    return transformApiResponseToUI(mockProcessFilesResponse)
  }, [])

  // Create a lookup map for quick dataset retrieval by ID
  const datasetMap = useMemo(() => {
    const map = new Map<string, DatasetWithGroup>()
    datasets.forEach(dataset => {
      map.set(dataset.id, dataset)
    })
    return map
  }, [datasets])

  // Helper function to get dataset by ID
  const getDatasetById = (id: string): DatasetWithGroup | undefined => {
    return datasetMap.get(id)
  }

  // Helper function to get datasets by group
  const getDatasetsByGroup = (group: string) => {
    return datasets.filter(dataset => dataset.group === group)
  }

  return {
    datasets,
    datasetMap,
    getDatasetById,
    getDatasetsByGroup
  }
}
