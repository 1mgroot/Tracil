import type { HTMLAttributes, ReactNode } from 'react'
import { useState, useCallback, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Search, Settings2, X } from 'lucide-react'

export interface SearchBarProps extends Omit<HTMLAttributes<HTMLDivElement>, 'loading'> {
	readonly placeholder?: string
	readonly onSearch?: (query: string) => void
	readonly onClear?: () => void
	readonly isLoading?: boolean
	readonly searchValue?: string
}

export function SearchBar({ 
	className, 
	placeholder = 'Search variables…', 
	onSearch,
	onClear,
	isLoading = false,
	searchValue = '',
	...props 
}: SearchBarProps): ReactNode {
	const [inputValue, setInputValue] = useState(searchValue)
	const inputRef = useRef<HTMLInputElement>(null)

	// Update internal state when external searchValue changes
	useEffect(() => {
		setInputValue(searchValue)
	}, [searchValue])

	// Handle search submission
	const handleSearch = useCallback(() => {
		// Don't search if loading or no input
		if (isLoading || !inputValue.trim() || !onSearch) {
			return
		}
		
		const trimmedValue = inputValue.trim()
		onSearch(trimmedValue)
	}, [inputValue, onSearch, isLoading])

	// Handle Enter key press
	const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
		if (event.key === 'Enter' && !isLoading) {
			event.preventDefault()
			handleSearch()
		}
	}, [handleSearch, isLoading])

	// Handle clear button
	const handleClear = useCallback(() => {
		if (isLoading) return
		
		setInputValue('')
		if (onClear) {
			onClear()
		}
		// Focus input after clearing
		inputRef.current?.focus()
	}, [onClear, isLoading])

	// Handle input change
	const handleInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
		if (isLoading) return
		setInputValue(event.target.value)
	}, [isLoading])

	return (
		<div className={cn('w-full max-w-2xl', className)} {...props}>
			<div
				className={
					'flex items-center gap-2 rounded-xl border bg-[--surface] px-3 py-2 shadow-sm transition-colors ' +
					'focus-within:outline focus-within:outline-2 focus-within:outline-[--focus]'
				}
			>
				<input
					ref={inputRef}
					type="text"
					value={inputValue}
					onChange={handleInputChange}
					onKeyDown={handleKeyDown}
					className="flex-1 bg-transparent outline-none placeholder:text-[--text-muted] text-sm disabled:opacity-50 disabled:cursor-not-allowed"
					placeholder={placeholder}
					aria-label="Search variables"
					disabled={isLoading}
				/>
				
				{/* Clear button - only show when there's input and not loading */}
				{inputValue && !isLoading && (
					<button
						type="button"
						aria-label="Clear search"
						onClick={handleClear}
						className="p-1 rounded-md hover:bg-[--surface-muted] transition-colors"
					>
						<X className="h-4 w-4 text-[--text-muted]" />
					</button>
				)}
				
				<button 
					type="button" 
					aria-label="Search" 
					onClick={handleSearch}
					disabled={isLoading || !inputValue.trim()}
					className="p-1 rounded-md hover:bg-[--surface-muted] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{isLoading ? (
						<div className="h-4 w-4 animate-spin rounded-full border-2 border-[--text-muted] border-t-transparent" />
					) : (
						<Search className="h-4 w-4 text-[--text-muted]" />
					)}
				</button>
			</div>
		</div>
	)
}


