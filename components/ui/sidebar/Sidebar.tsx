import * as React from 'react'

import { cn } from '@/lib/utils'

export interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
	readonly header?: React.ReactNode
}

export function Sidebar({ className, header, children, ...props }: SidebarProps) {
	return (
		<div
			className={cn(
				'hidden md:flex md:flex-col md:sticky md:top-0 md:h-screen md:overflow-y-auto border-r',
				'bg-[var(--sidebar-pane-bg)]',
				className,
			)}
			{...props}
		>
			{header ? <div className="px-3 py-2 text-sm text-[--text-muted]">{header}</div> : null}
			<div className="p-2 space-y-3">{children}</div>
		</div>
	)
}

export interface SidebarGroupProps extends React.HTMLAttributes<HTMLDivElement> {
	readonly label: string
	readonly accentVar?: string
}

export function SidebarGroup({ label, accentVar, className, children, ...props }: SidebarGroupProps) {
	return (
		<div className={cn('space-y-1', className)} style={accentVar ? { ['--accent-color' as any]: `var(${accentVar})` } : undefined} {...props}>
			<div className="px-2 pt-2 text-xs font-medium tracking-wide text-[--text-muted] flex items-center gap-2">
				<span
					className="inline-block h-2 w-2 rounded-full"
					style={accentVar ? { background: `var(${accentVar})` } : undefined}
				/>
				{label}
			</div>
			<div className="mt-1 space-y-1">{children}</div>
		</div>
	)
}

export interface SidebarItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	readonly active?: boolean
  readonly tone?: number // percentage used for color-mix influence
}

export function SidebarItem({ className, active, tone, children, ...props }: SidebarItemProps) {
	return (
		<button
			className={cn(
				'group w-full text-left inline-flex items-center h-9 rounded-md px-3 text-sm transition-colors border sidebar-item',
				active ? 'is-active' : 'is-idle',
				'focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--focus)]',
				className,
			)}
			style={tone ? ({ ['--tone' as any]: `${tone}%` } as React.CSSProperties) : undefined}
			data-active={active ? 'true' : 'false'}
			{...props}
		>
			<span className="block truncate">{children}</span>
		</button>
	)
}


