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
				'hidden md:flex md:flex-col md:sticky md:top-0 md:h-screen md:overflow-hidden',
				'bg-[var(--sidebar-pane-bg)]/80 backdrop-blur-sm',
				'border-r border-[var(--sidebar-border)]/60',
				'shadow-sm',
				className,
			)}
			role="navigation"
			aria-label="File navigation"
			onKeyDown={onKeyDown}
			{...props}
		>
			{header ? (
				<div className="border-b border-[var(--sidebar-border)]/50 bg-[var(--sidebar-pane-bg)]/60 backdrop-blur-sm">
					{header}
				</div>
			) : null}
			<div className="flex-1 overflow-y-auto p-4 space-y-4 pr-6">{children}</div>
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
			className={cn('space-y-2', className)} 
			style={accentVar ? { ['--accent-color' as string]: `var(${accentVar})` } : undefined} 
			role="group"
			aria-labelledby={`sidebar-group-${label.toLowerCase().replace(/\s+/g, '-')}`}
			{...props}
		>
			<button
				type="button"
				className={cn(
					'w-full flex items-center justify-between text-left',
					'px-4 py-3 text-xs font-medium tracking-wide',
					'text-[--text-muted] hover:text-[var(--text-primary)]',
					'hover:bg-white/60 dark:hover:bg-gray-800/60',
					'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]/50 focus-visible:ring-offset-0',
					'rounded-xl transition-all duration-200 backdrop-blur-sm',
					'border border-transparent hover:border-[var(--sidebar-border)]/30',
					'group'
				)}
				id={`sidebar-group-${label.toLowerCase().replace(/\s+/g, '-')}`}
				aria-expanded={expanded}
				onClick={() => collapsible && setExpanded(prev => !prev)}
			>
				<span className="flex items-center gap-3">
					<span
						className="inline-block h-3 w-3 rounded-full shadow-sm"
						style={accentVar ? { background: `var(${accentVar})` } : undefined}
						aria-hidden="true"
					/>
					{label}
				</span>
				{collapsible && (
					<svg 
						className={cn(
							'h-4 w-4 text-[--text-muted] transition-all duration-300 ease-out',
							'group-hover:text-[var(--text-primary)] group-hover:scale-110',
							expanded ? 'rotate-180 scale-110' : 'rotate-0 scale-100'
						)} 
						viewBox="0 0 20 20" 
						fill="currentColor" 
						aria-hidden="true"
					>
						<path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" clipRule="evenodd" />
					</svg>
				)}
			</button>
			
			{expanded && (
				<div 
					className="space-y-2 transition-all duration-200"
					role="listbox" 
					aria-labelledby={`sidebar-group-${label.toLowerCase().replace(/\s+/g, '-')}`}
				>
					{children}
				</div>
			)}
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
				'group w-full text-left inline-flex items-center h-10 rounded-xl px-4 text-sm',
				'transition-all duration-200 border sidebar-item',
				'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]/50 focus-visible:ring-offset-0',
				'hover:scale-[1.02] active:scale-[0.98]',
				active ? 'is-active' : 'is-idle',
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


