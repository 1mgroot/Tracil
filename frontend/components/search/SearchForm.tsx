import type { ReactNode } from 'react'
import { useState, useCallback } from 'react'
import { Search, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SearchFormProps {
	readonly className?: string
	readonly onSearch: (query: string, dataset: string) => void
	readonly loading?: boolean
	readonly error?: string | null
}

export function SearchForm({ 
	className, 
	onSearch, 
	loading = false, 
	error = null 
}: SearchFormProps): ReactNode {
	const [variable, setVariable] = useState('')
	const [dataset, setDataset] = useState('')

	// Handle form submission
	const handleSubmit = useCallback((event: React.FormEvent) => {
		event.preventDefault()
		
		const trimmedVariable = variable.trim()
		const trimmedDataset = dataset.trim()
		
		if (trimmedVariable && trimmedDataset) {
			onSearch(trimmedVariable, trimmedDataset)
		}
	}, [variable, dataset, onSearch])

	// Handle variable input change
	const handleVariableChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
		setVariable(event.target.value)
	}, [])

	// Handle dataset input change
	const handleDatasetChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
		setDataset(event.target.value)
	}, [])

	// Check if form is valid
	const isValid = variable.trim() && dataset.trim()

	return (
		<div className={cn('w-full max-w-2xl', className)}>
			<form onSubmit={handleSubmit} className="space-y-4">
				{/* Variable input */}
				<div>
					<label htmlFor="variable" className="block text-sm font-medium text-gray-700 mb-2">
						Variable Name
					</label>
					<input
						id="variable"
						type="text"
						value={variable}
						onChange={handleVariableChange}
						placeholder="e.g., FDA-AE-T06 | SAE Results in Death | Xanomeline Low Dose | n"
						className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
						disabled={loading}
						required
					/>
					<p className="mt-1 text-xs text-gray-500">
						Enter the variable name you want to analyze
					</p>
				</div>

				{/* Dataset input */}
				<div>
					<label htmlFor="dataset" className="block text-sm font-medium text-gray-700 mb-2">
						Dataset
					</label>
					<input
						id="dataset"
						type="text"
						value={dataset}
						onChange={handleDatasetChange}
						placeholder="e.g., table, ADSL, ADAE, DM"
						className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
						disabled={loading}
						required
					/>
					<p className="mt-1 text-xs text-gray-500">
						Enter the dataset name where the variable is located
					</p>
				</div>

				{/* Error message */}
				{error && (
					<div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
						<AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
						<p className="text-sm text-red-700">{error}</p>
					</div>
				)}

				{/* Submit button */}
				<button
					type="submit"
					disabled={!isValid || loading}
					className={cn(
						'w-full px-4 py-2 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2',
						isValid && !loading
							? 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500'
							: 'bg-gray-300 text-gray-500 cursor-not-allowed'
					)}
				>
					{loading ? (
						<div className="flex items-center justify-center gap-2">
							<div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
							Analyzing Lineage...
						</div>
					) : (
						<div className="flex items-center justify-center gap-2">
							<Search className="h-4 w-4" />
							Search Variable Lineage
						</div>
					)}
				</button>
			</form>

			{/* Example usage */}
			<div className="mt-6 p-4 bg-gray-50 rounded-lg">
				<h4 className="text-sm font-medium text-gray-700 mb-2">Example Search</h4>
				<div className="text-xs text-gray-600 space-y-1">
					<p><strong>Variable:</strong> FDA-AE-T06 | SAE Results in Death | Xanomeline Low Dose | n</p>
					<p><strong>Dataset:</strong> table</p>
				</div>
			</div>
		</div>
	)
}
