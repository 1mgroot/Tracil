import type { ReactNode } from 'react'
import { useMemo } from 'react'
import { AlertCircle, XCircle, Info } from 'lucide-react'
import type { LineageGraph } from '@/types/lineage'
import { LineageView } from '@/app/(workspace)/_components/LineageView'

export interface SearchResultsProps {
	readonly query: string
	readonly dataset: string
	readonly lineage: LineageGraph | null
	readonly loading: boolean
	readonly error: string | null
	readonly onBack: () => void
}

export function SearchResults({ 
	query, 
	dataset, 
	lineage, 
	loading, 
	error, 
	onBack 
}: SearchResultsProps): ReactNode {
	// Calculate summary statistics
	const summaryStats = useMemo(() => {
		if (!lineage) return null
		
		const totalNodes = lineage.nodes.length
		const totalEdges = lineage.edges.length
		const gapsCount = lineage.gaps?.notes?.length || 0
		
		return { totalNodes, totalEdges, gapsCount }
	}, [lineage])

	// Loading state
	if (loading) {
		return (
			<div className="flex-1 overflow-hidden p-6">
				{/* Header with back button */}
				<div className="flex items-center gap-4 mb-6">
					<button
						onClick={onBack}
						className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
					>
						← Back to Search
					</button>
					<div className="h-6 w-px bg-gray-300" />
					<h1 className="text-xl font-semibold text-gray-900">
													Analyzing lineage for &ldquo;{query}&rdquo;
					</h1>
				</div>

				{/* Loading content */}
				<div className="flex items-center justify-center h-96">
					<div className="text-center">
						<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
						<p className="text-lg text-gray-600">Analyzing variable lineage...</p>
						<p className="text-sm text-gray-500 mt-2">This may take a few moments</p>
					</div>
				</div>
			</div>
		)
	}

	// Error state
	if (error) {
		return (
			<div className="flex-1 overflow-hidden p-6">
				{/* Header with back button */}
				<div className="flex items-center gap-4 mb-6">
					<button
						onClick={onBack}
						className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
					>
						← Back to Search
					</button>
					<div className="h-6 w-px bg-gray-300" />
					<h1 className="text-xl font-semibold text-gray-900">
						Search Error
					</h1>
				</div>

				{/* Error content */}
				<div className="max-w-2xl mx-auto">
					<div className="bg-red-50 border border-red-200 rounded-lg p-6">
						<div className="flex items-center gap-3 mb-4">
							<XCircle className="h-6 w-6 text-red-500" />
							<h3 className="text-lg font-semibold text-red-800">
								Failed to analyze lineage
							</h3>
						</div>
						<p className="text-red-700 mb-4">
							{error}
						</p>
						<div className="bg-white p-4 rounded border text-sm text-left">
							<p className="text-gray-600 mb-2">
								<strong>Search Query:</strong> {query}
							</p>
							<p className="text-gray-600">
								<strong>Dataset:</strong> {dataset}
							</p>
						</div>
					</div>
				</div>
			</div>
		)
	}

	// No results state
	if (!lineage) {
		return (
			<div className="flex-1 overflow-hidden p-6">
				{/* Header with back button */}
				<div className="flex items-center gap-4 mb-6">
					<button
						onClick={onBack}
						className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
					>
						← Back to Search
					</button>
					<div className="h-6 w-px bg-gray-300" />
					<h1 className="text-xl font-semibold text-gray-900">
						No Results Found
					</h1>
				</div>

				{/* No results content */}
				<div className="max-w-2xl mx-auto">
					<div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
						<div className="flex items-center gap-3 mb-4">
							<Info className="h-6 w-6 text-yellow-500" />
							<h3 className="text-lg font-semibold text-yellow-800">
								No lineage found
							</h3>
						</div>
						<p className="text-yellow-700 mb-4">
							No lineage information was found for the specified variable and dataset combination.
						</p>
						<div className="bg-white p-4 rounded border text-sm text-left">
							<p className="text-gray-600 mb-2">
								<strong>Search Query:</strong> {query}
							</p>
							<p className="text-gray-600">
								<strong>Dataset:</strong> {dataset}
							</p>
						</div>
					</div>
				</div>
			</div>
		)
	}

	// Results state - use LineageView for consistency
	return (
		<LineageView
			dataset={dataset}
			variable={query}
			onBack={onBack}
			mode="search"
			backButtonText="← Back to Search"
			initialLineage={lineage}
		/>
	)
}
