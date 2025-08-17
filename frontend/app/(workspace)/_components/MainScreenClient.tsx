"use client"

import { useMemo, useState, useCallback, type ReactNode } from 'react'
import { Sidebar, SidebarGroup, SidebarItem } from '@/components/ui/sidebar/Sidebar'
import { SearchBar } from '@/components/search/SearchBar'
import { VariablesBrowser } from '@/components/variables'
import { mockFiles } from '@/features/datasets/mocks'
import { groupFilesByKind } from '@/types/files'
import { useVariablesBrowser } from '@/hooks/useVariablesBrowser'
import { useSidebarKeyboardNav } from '@/hooks/useSidebarKeyboardNav'

type ViewState = 'search' | 'variables'
type SelectedItem = { type: 'dataset'; datasetId: string } | null

export function MainScreenClient(): ReactNode {
	const grouped = useMemo(() => groupFilesByKind(mockFiles), [])
	const { getDatasetById } = useVariablesBrowser()
	const [selectedItem, setSelectedItem] = useState<SelectedItem>(null)
	const [selectedId, setSelectedId] = useState<string | null>(null)

	// Determine current view state
	const viewState: ViewState = selectedItem?.type === 'dataset' ? 'variables' : 'search'
	
	// Get the selected dataset for variables view
	const selectedDataset = selectedItem?.type === 'dataset' 
		? getDatasetById(selectedItem.datasetId) 
		: undefined

	// Create flat list of all item IDs for keyboard navigation
	const allItemIds = useMemo(() => {
		return [
			...grouped.ADaM.map(f => f.id),
			...grouped.SDTM.map(f => f.id),
			...grouped.aCRF.map(f => f.id),
			...grouped.TLF.map(f => f.id),
		]
	}, [grouped])

	// Create mapping from sidebar IDs to Variables Browser IDs
	const sidebarToVariablesBrowserIdMap = useMemo(() => {
		const map = new Map<string, string>()
		// ADaM mappings
		map.set('adam-adsl', 'define_adam.xml-ADSL')
		map.set('adam-adae', 'define_adam.xml-ADAE')
		map.set('adam-adlb', 'define_adam.xml-ADLB')
		// SDTM mappings
		map.set('sdtm-dm', 'define_sdtm.xml-DM')
		map.set('sdtm-lb', 'define_sdtm.xml-LB')
		map.set('sdtm-ae', 'define_sdtm.xml-AE')
		map.set('sdtm-vs', 'define_sdtm.xml-VS')
		return map
	}, [])

	// Handle dataset selection
	const handleDatasetSelect = useCallback((datasetId: string) => {
		setSelectedId(datasetId)
		// Map sidebar ID to Variables Browser ID
		const variablesBrowserId = sidebarToVariablesBrowserIdMap.get(datasetId)
		if (variablesBrowserId) {
			console.log(`Dataset selected: ${datasetId} → ${variablesBrowserId}`)
			setSelectedItem({ type: 'dataset', datasetId: variablesBrowserId })
		} else {
			console.warn(`No mapping found for dataset ID: ${datasetId}`)
		}
	}, [sidebarToVariablesBrowserIdMap])



	// Handle keyboard navigation
	const { handleKeyDown } = useSidebarKeyboardNav({
		selectedId,
		onSelectionChange: handleDatasetSelect,
		itemIds: allItemIds,
	})



	const toneFor = useCallback((index: number, total: number): number => {
		const maxTone = 22
		const minTone = 8
		if (total <= 1) return Math.round((maxTone + minTone) / 2)
		return Math.round(maxTone - ((maxTone - minTone) * index) / (total - 1))
	}, [])

	return (
		<div 
			className="min-h-screen w-full grid grid-cols-1 md:grid-cols-[260px_1fr]"
		>
			<aside className="hidden md:block">
				<Sidebar header={null} onKeyDown={handleKeyDown}>
					<SidebarGroup label="ADaM" accentVar="--accent-adam">
						{grouped.ADaM.map((f, i) => (
							<SidebarItem 
								key={f.id} 
								active={selectedId === f.id} 
								onClick={() => handleDatasetSelect(f.id)} 
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
								onClick={() => handleDatasetSelect(f.id)} 
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
								onClick={() => handleDatasetSelect(f.id)} 
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
								onClick={() => handleDatasetSelect(f.id)} 
								tone={toneFor(i, grouped.TLF.length)}
								itemId={f.id}
							>
								{f.name}
							</SidebarItem>
						))}
					</SidebarGroup>
				</Sidebar>
			</aside>

			{viewState === 'search' && (
				<main className="flex items-center justify-center p-6">
					<div className="w-full flex flex-col items-center gap-6">
						<h1 className="text-center text-2xl md:text-3xl text-balance">
							What can I help with?
						</h1>
						<SearchBar className="w-full" />
					</div>
				</main>
			)}

			{viewState === 'variables' && selectedDataset && (
				<div className="flex-1 overflow-hidden">
					<VariablesBrowser 
						dataset={selectedDataset} 
						onVariableSelect={(variable) => {
							console.log('Variable selected in main screen:', variable.name)
							// Future: Open variable details modal or navigate to lineage view
						}}
						onEscape={() => {
							setSelectedItem(null)
							setSelectedId(null)
						}}
					/>
				</div>
			)}
		</div>
	)
}


