import { useState, useCallback, useRef } from 'react'
import type { LineageGraph } from '@/types/lineage'
import { analyzeLineage } from '@/lib/ai/entrypoints/analyzeLineage'

export interface SearchState {
	readonly query: string
	readonly lineage: LineageGraph | null
	readonly loading: boolean
	readonly error: string | null
}

export interface SearchActions {
	readonly search: (query: string) => Promise<void>
	readonly clear: () => void
	readonly reset: () => void
}

export function useSearch(): SearchState & SearchActions {
	const [state, setState] = useState<SearchState>({
		query: '',
		lineage: null,
		loading: false,
		error: null
	})

	// Prevent duplicate requests
	const lastRequestRef = useRef<string>('')
	const isRequestingRef = useRef(false)

	// Perform search
	const search = useCallback(async (query: string) => {
		const requestKey = query
		
		// Prevent duplicate requests for the same search
		if (lastRequestRef.current === requestKey && isRequestingRef.current) {
			return
		}
		
		// Prevent duplicate requests while one is already in progress
		if (isRequestingRef.current) {
			return
		}

		try {
			isRequestingRef.current = true
			lastRequestRef.current = requestKey
			
			setState(prev => ({
				...prev,
				query,
				loading: true,
				error: null,
				lineage: null
			}))

			// Call the analyze lineage API with natural language query as variable
			// For search-triggered requests, send empty dataset string
			const result = await analyzeLineage({ dataset: '', variable: query })
			
			setState(prev => ({
				...prev,
				lineage: result,
				loading: false
			}))
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : 'Failed to analyze lineage'
			
			setState(prev => ({
				...prev,
				error: errorMessage,
				loading: false
			}))
		} finally {
			isRequestingRef.current = false
		}
	}, [])

	// Clear search results
	const clear = useCallback(() => {
		setState(prev => ({
			...prev,
			lineage: null,
			error: null
		}))
	}, [])

	// Reset search state completely
	const reset = useCallback(() => {
		setState({
			query: '',
			lineage: null,
			loading: false,
			error: null
		})
		lastRequestRef.current = ''
		isRequestingRef.current = false
	}, [])

	return {
		...state,
		search,
		clear,
		reset
	}
}
