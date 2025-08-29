import type { HTMLAttributes, ReactNode, KeyboardEvent, ButtonHTMLAttributes, CSSProperties } from 'react'
import { useState } from 'react'

import { cn } from '@/lib/utils'

export interface SidebarProps extends HTMLAttributes<HTMLDivElement> {
	readonly header?: ReactNode
	readonly onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void
}

export function Sidebar({ className, header, children, onKeyDown, ...props }: SidebarProps): ReactNode {
	return (
		<nav
			className={cn(
				'hidden md:flex md:flex-col md:sticky md:top-0 md:h-screen md:overflow-hidden border-r',
				'bg-[var(--sidebar-pane-bg)]',
				'focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus)]',
				className,
			)}
			role="navigation"
			aria-label="File navigation"
			onKeyDown={onKeyDown}
			tabIndex={0}
			{...props}
		>
			{header ? <div className="border-b border-gray-200 dark:border-gray-700">{header}</div> : null}
			<div className="flex-1 overflow-y-auto p-2 space-y-3">{children}</div>
		</nav>
	)
}

export interface SidebarGroupProps extends HTMLAttributes<HTMLDivElement> {
	readonly label: string
	readonly accentVar?: string
	readonly collapsible?: boolean
	readonly defaultExpanded?: boolean
}

export function SidebarGroup({ label, accentVar, className, children, collapsible = true, defaultExpanded = true, ...props }: SidebarGroupProps): ReactNode {
	const [expanded, setExpanded] = useState<boolean>(defaultExpanded)
	return (
		<div 
			className={cn('space-y-1', className)} 
			style={accentVar ? { ['--accent-color' as string]: `var(${accentVar})` } : undefined} 
			role="group"
			aria-labelledby={`sidebar-group-${label.toLowerCase().replace(/\s+/g, '-')}`}
			{...props}
		>
			<div id={`sidebar-group-${label.toLowerCase().replace(/\s+/g, '-')}`} className="px-2 pt-2">
				<button
					type="button"
					className="w-full flex items-center justify-between text-left text-xs font-medium tracking-wide text-[--text-muted] hover:text-[var(--text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus)] rounded"
					aria-expanded={expanded}
					onClick={() => collapsible && setExpanded(prev => !prev)}
				>
					<span className="flex items-center gap-2">
						<span
							className="inline-block h-2 w-2 rounded-full"
							style={accentVar ? { background: `var(${accentVar})` } : undefined}
							aria-hidden="true"
						/>
						{label}
					</span>
					{collapsible && (
						<svg className="h-3 w-3 text-[--text-muted]" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
							<path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" clipRule="evenodd" />
						</svg>
					)}
				</button>
			</div>
			<div className={cn('mt-1 space-y-1 transition-[max-height,opacity] duration-200', expanded ? '' : 'max-h-0 overflow-hidden opacity-0')} role="listbox" aria-labelledby={`sidebar-group-${label.toLowerCase().replace(/\s+/g, '-')}`}>
				{children}
			</div>
		</div>
	)
}

export interface SidebarItemProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	readonly active?: boolean
	readonly tone?: number // percentage used for color-mix influence
	readonly itemId?: string
}

export function SidebarItem({ className, active, tone, itemId, children, ...props }: SidebarItemProps): ReactNode {
	return (
		<button
			className={cn(
				'group w-full text-left inline-flex items-center h-9 rounded-md px-3 text-sm transition-colors border sidebar-item',
				active ? 'is-active' : 'is-idle',
				'focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus)]',
				className,
			)}
			style={tone ? ({ ['--tone' as string]: `${tone}%` } as CSSProperties) : undefined}
			data-active={active ? 'true' : 'false'}
			data-item-id={itemId}
			role="option"
			aria-selected={active}
			tabIndex={active ? 0 : -1}
			{...props}
		>
			<span className="block truncate">{children}</span>
		</button>
	)
}


