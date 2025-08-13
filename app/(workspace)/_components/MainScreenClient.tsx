"use client"

import * as React from 'react'
import { Sidebar, SidebarGroup, SidebarItem } from '@/components/ui/sidebar/Sidebar'
import { SearchBar } from '@/components/search/SearchBar'
import { mockFiles } from '@/features/datasets/mocks'
import { groupFilesByKind } from '@/types/files'

export function MainScreenClient(): React.JSX.Element {
	const grouped = React.useMemo(() => groupFilesByKind(mockFiles), [])
	const [selectedId, setSelectedId] = React.useState<string | null>(null)

	const toneFor = React.useCallback((index: number, total: number): number => {
		const maxTone = 22
		const minTone = 8
		if (total <= 1) return Math.round((maxTone + minTone) / 2)
		return Math.round(maxTone - ((maxTone - minTone) * index) / (total - 1))
	}, [])

	return (
		<div className="min-h-screen w-full grid grid-cols-1 md:grid-cols-[260px_1fr]">
			<aside className="hidden md:block">
				<Sidebar header={null}>
					<SidebarGroup label="ADaM" accentVar="--accent-adam">
						{grouped.ADaM.map((f, i) => (
							<SidebarItem key={f.id} active={selectedId === f.id} onClick={() => setSelectedId(f.id)} tone={toneFor(i, grouped.ADaM.length)}>
								{f.name}
							</SidebarItem>
						))}
					</SidebarGroup>
					<SidebarGroup label="SDTM" accentVar="--accent-sdtm">
						{grouped.SDTM.map((f, i) => (
							<SidebarItem key={f.id} active={selectedId === f.id} onClick={() => setSelectedId(f.id)} tone={toneFor(i, grouped.SDTM.length)}>
								{f.name}
							</SidebarItem>
						))}
					</SidebarGroup>
					<SidebarGroup label="aCRF" accentVar="--accent-acrf">
						{grouped.aCRF.map((f, i) => (
							<SidebarItem key={f.id} active={selectedId === f.id} onClick={() => setSelectedId(f.id)} tone={toneFor(i, grouped.aCRF.length)}>
								{f.name}
							</SidebarItem>
						))}
					</SidebarGroup>
					<SidebarGroup label="TLFs" accentVar="--accent-tlf">
						{grouped.TLF.map((f, i) => (
							<SidebarItem key={f.id} active={selectedId === f.id} onClick={() => setSelectedId(f.id)} tone={toneFor(i, grouped.TLF.length)}>
								{f.name}
							</SidebarItem>
						))}
					</SidebarGroup>
				</Sidebar>
			</aside>

			<main className="flex items-center justify-center p-6">
				<div className="w-full flex flex-col items-center gap-6">
					<h1 className="text-center text-2xl md:text-3xl text-balance">What can I help with ?</h1>
					<SearchBar className="w-full" />
				</div>
			</main>
		</div>
	)
}


