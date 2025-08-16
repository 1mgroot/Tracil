import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Search, Settings2 } from 'lucide-react'

export interface SearchBarProps extends HTMLAttributes<HTMLDivElement> {
	readonly placeholder?: string
}

export function SearchBar({ className, placeholder = 'Search variables…', ...props }: SearchBarProps): ReactNode {
	return (
		<div className={cn('w-full max-w-2xl', className)} {...props}>
			<div
				className={
					'flex items-center gap-2 rounded-xl border bg-[--surface] px-3 py-2 shadow-sm transition-colors ' +
					'focus-within:outline focus-within:outline-2 focus-within:outline-[--focus]'
				}
			>
				<button type="button" aria-label="Filters" className="p-1 rounded-md hover:bg-[--surface-muted]">
					<Settings2 className="h-4 w-4 text-[--text-muted]" />
				</button>
				<input
					className="flex-1 bg-transparent outline-none placeholder:text-[--text-muted] text-sm"
					placeholder={placeholder}
					aria-label="Search variables"
				/>
				<button type="button" aria-label="Search" className="p-1 rounded-md hover:bg-[--surface-muted]">
					<Search className="h-4 w-4 text-[--text-muted]" />
				</button>
			</div>
		</div>
	)
}


