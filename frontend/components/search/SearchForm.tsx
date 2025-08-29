import type { ReactNode } from 'react'
import { useState, useCallback } from 'react'
import { Search, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SearchFormProps {
	readonly className?: string
	readonly onSearch: (query: string) => void
	readonly loading?: boolean
	readonly error?: string | null
}

export function SearchForm({ 
	className, 
	onSearch, 
	loading = false, 
	error = null 
}: SearchFormProps): ReactNode {
	const [query, setQuery] = useState('')

	// Handle form submission
	const handleSubmit = useCallback((event: React.FormEvent) => {
		event.preventDefault()
		
		const trimmedQuery = query.trim()
		
		if (trimmedQuery) {
			onSearch(trimmedQuery)
		}
	}, [query, onSearch])

	// Handle query input change
	const handleQueryChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
		setQuery(event.target.value)
	}, [])

	// Check if form is valid
	const isValid = query.trim()

	return (
		<div className={cn('w-full max-w-2xl', className)}>
			<form onSubmit={handleSubmit} className="space-y-4">
				{/* Natural language query input */}
				<div>
					<label htmlFor="query" className="block text-sm font-medium text-gray-700 mb-2">
						Tracil Request
					</label>
					<textarea
						id="query"
						value={query}
						onChange={handleQueryChange}
						placeholder="e.g., diastolic blood pressure change from baseline at week 2 for high dose treatment"
						rows={3}
						className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed resize-y min-h-[4rem]"
						disabled={loading}
						required
					/>
					<p className="mt-1 text-xs text-gray-500">
						Describe the variable lineage you want to trace
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
							Traciling...
						</div>
					) : (
						<div className="flex items-center justify-center gap-2">
							<Search className="h-4 w-4" />
							Tracil It
						</div>
					)}
				</button>
			</form>

			{/* Example usage */}
			<div className="mt-6 p-4 bg-gray-50 rounded-lg">
				<h4 className="text-sm font-medium text-gray-700 mb-2">Example Requests</h4>
				<div className="text-xs text-gray-600 space-y-2">
					<p><strong>•</strong> "diastolic blood pressure change from baseline at week 2 for high dose treatment"</p>
					<p><strong>•</strong> "hemoglobin mean values in lab data for week 4 by treatment group"</p>
					<p><strong>•</strong> "adverse events leading to treatment discontinuation"</p>
					<p><strong>•</strong> "demographics age distribution by treatment arm"</p>
				</div>
			</div>
		</div>
	)
}
