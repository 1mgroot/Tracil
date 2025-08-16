"use client"

import { useMemo, useState, useCallback, type ReactNode } from 'react'
import { Sidebar, SidebarGroup, SidebarItem } from '@/components/ui/sidebar/Sidebar'
import { SearchBar } from '@/components/search/SearchBar'
import { mockFiles } from '@/features/datasets/mocks'
import { groupFilesByKind } from '@/types/files'
import { useSidebarKeyboardNav } from '@/hooks/useSidebarKeyboardNav'

export function MainScreenClient(): ReactNode {
	const grouped = useMemo(() => groupFilesByKind(mockFiles), [])
	const [selectedId, setSelectedId] = useState<string | null>(null)

	// Create flat list of all item IDs for keyboard navigation
	const allItemIds = useMemo(() => {
		return [
			...grouped.ADaM.map(f => f.id),
			...grouped.SDTM.map(f => f.id),
			...grouped.aCRF.map(f => f.id),
			...grouped.TLF.map(f => f.id),
		]
	}, [grouped])

	const { handleKeyDown } = useSidebarKeyboardNav({
		selectedId,
		onSelectionChange: setSelectedId,
		itemIds: allItemIds,
	})

	const toneFor = useCallback((index: number, total: number): number => {
		const maxTone = 22
		const minTone = 8
		if (total <= 1) return Math.round((maxTone + minTone) / 2)
		return Math.round(maxTone - ((maxTone - minTone) * index) / (total - 1))
	}, [])

	return (
		<div className="min-h-screen w-full grid grid-cols-1 md:grid-cols-[260px_1fr]">
			<aside className="hidden md:block">
				<Sidebar header={null} onKeyDown={handleKeyDown}>
					<SidebarGroup label="ADaM" accentVar="--accent-adam">
						{grouped.ADaM.map((f, i) => (
							<SidebarItem 
								key={f.id} 
								active={selectedId === f.id} 
								onClick={() => setSelectedId(f.id)} 
								tone={toneFor(i, grouped.ADaM.length)}
								itemId={f.id}
							>
								{f.name}
							</SidebarItem>
						))}
					</SidebarGroup>
					<SidebarGroup label="SDTM" accentVar="--accent-sdtm">
						{grouped.SDTM.map((f, i) => (
							<SidebarItem 
								key={f.id} 
								active={selectedId === f.id} 
								onClick={() => setSelectedId(f.id)} 
								tone={toneFor(i, grouped.SDTM.length)}
								itemId={f.id}
							>
								{f.name}
							</SidebarItem>
						))}
					</SidebarGroup>
					<SidebarGroup label="aCRF" accentVar="--accent-acrf">
						{grouped.aCRF.map((f, i) => (
							<SidebarItem 
								key={f.id} 
								active={selectedId === f.id} 
								onClick={() => setSelectedId(f.id)} 
								tone={toneFor(i, grouped.aCRF.length)}
								itemId={f.id}
							>
								{f.name}
							</SidebarItem>
						))}
					</SidebarGroup>
					<SidebarGroup label="TLFs" accentVar="--accent-tlf">
						{grouped.TLF.map((f, i) => (
							<SidebarItem 
								key={f.id} 
								active={selectedId === f.id} 
								onClick={() => setSelectedId(f.id)} 
								tone={toneFor(i, grouped.TLF.length)}
								itemId={f.id}
							>
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


