import type { HTMLAttributes, ReactNode, KeyboardEvent, ButtonHTMLAttributes, CSSProperties } from 'react'

import { cn } from '@/lib/utils'

export interface SidebarProps extends HTMLAttributes<HTMLDivElement> {
	readonly header?: ReactNode
	readonly onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void
}

export function Sidebar({ className, header, children, onKeyDown, ...props }: SidebarProps): ReactNode {
	return (
		<nav
			className={cn(
				'hidden md:flex md:flex-col md:sticky md:top-0 md:h-screen md:overflow-y-auto border-r',
				'bg-[var(--sidebar-pane-bg)]',
				className,
			)}
			role="navigation"
			aria-label="File navigation"
			onKeyDown={onKeyDown}
			tabIndex={0}
			{...props}
		>
			{header ? <div className="px-3 py-2 text-sm text-[--text-muted]">{header}</div> : null}
			<div className="p-2 space-y-3">{children}</div>
		</nav>
	)
}

export interface SidebarGroupProps extends HTMLAttributes<HTMLDivElement> {
	readonly label: string
	readonly accentVar?: string
}

export function SidebarGroup({ label, accentVar, className, children, ...props }: SidebarGroupProps): ReactNode {
	return (
		<div 
			className={cn('space-y-1', className)} 
			style={accentVar ? { ['--accent-color' as string]: `var(${accentVar})` } : undefined} 
			role="group"
			aria-labelledby={`sidebar-group-${label.toLowerCase().replace(/\s+/g, '-')}`}
			{...props}
		>
			<div 
				id={`sidebar-group-${label.toLowerCase().replace(/\s+/g, '-')}`}
				className="px-2 pt-2 text-xs font-medium tracking-wide text-[--text-muted] flex items-center gap-2"
			>
				<span
					className="inline-block h-2 w-2 rounded-full"
					style={accentVar ? { background: `var(${accentVar})` } : undefined}
					aria-hidden="true"
				/>
				{label}
			</div>
			<div className="mt-1 space-y-1" role="listbox" aria-labelledby={`sidebar-group-${label.toLowerCase().replace(/\s+/g, '-')}`}>
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


