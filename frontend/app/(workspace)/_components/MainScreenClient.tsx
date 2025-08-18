"use client"

import { useMemo, useState, useCallback, type ReactNode } from 'react'
import { Sidebar, SidebarGroup, SidebarItem } from '@/components/ui/sidebar/Sidebar'
import { SearchBar } from '@/components/search/SearchBar'
import { VariablesBrowser } from '@/components/variables'
import { useVariablesBrowser } from '@/hooks/useVariablesBrowser'
import { useSidebarKeyboardNav } from '@/hooks/useSidebarKeyboardNav'

type ViewState = 'search' | 'variables'
type SelectedItem = { type: 'dataset'; datasetId: string } | null

export function MainScreenClient(): ReactNode {
	const { datasets, getDatasetById } = useVariablesBrowser()
	const [selectedItem, setSelectedItem] = useState<SelectedItem>(null)
	const [selectedId, setSelectedId] = useState<string | null>(null)

	// Determine current view state
	const viewState: ViewState = selectedItem?.type === 'dataset' ? 'variables' : 'search'
	
	// Get the selected dataset for variables view
	const selectedDataset = selectedItem?.type === 'dataset' 
		? getDatasetById(selectedItem.datasetId) 
		: undefined

	// Group datasets by their group type for sidebar display
	const groupedDatasets = useMemo(() => {
		const groups = {
			ADaM: datasets.filter(d => d.group === 'ADaM'),
			SDTM: datasets.filter(d => d.group === 'SDTM'),
			aCRF: datasets.filter(d => d.group === 'aCRF'),
			TLF: datasets.filter(d => d.group === 'TLF')
		}
		return groups
	}, [datasets])

	// Create flat list of all item IDs for keyboard navigation
	const allItemIds = useMemo(() => {
		return [
			...groupedDatasets.ADaM.map(d => d.id),
			...groupedDatasets.SDTM.map(d => d.id),
			...groupedDatasets.aCRF.map(d => d.id),
			...groupedDatasets.TLF.map(d => d.id),
		]
	}, [groupedDatasets])

	// Handle dataset selection
	const handleDatasetSelect = useCallback((datasetId: string) => {
		setSelectedId(datasetId)
		setSelectedItem({ type: 'dataset', datasetId })
	}, [])



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
						{groupedDatasets.ADaM.map((dataset, i) => (
							<SidebarItem 
								key={dataset.id} 
								active={selectedId === dataset.id} 
								onClick={() => handleDatasetSelect(dataset.id)} 
								tone={toneFor(i, groupedDatasets.ADaM.length)}
								itemId={dataset.id}
							>
								{dataset.name}
							</SidebarItem>
						))}
					</SidebarGroup>
					<SidebarGroup label="SDTM" accentVar="--accent-sdtm">
						{groupedDatasets.SDTM.map((dataset, i) => (
							<SidebarItem 
								key={dataset.id} 
								active={selectedId === dataset.id} 
								onClick={() => handleDatasetSelect(dataset.id)} 
								tone={toneFor(i, groupedDatasets.SDTM.length)}
								itemId={dataset.id}
							>
								{dataset.name}
							</SidebarItem>
						))}
					</SidebarGroup>
					<SidebarGroup label="aCRF" accentVar="--accent-acrf">
						{groupedDatasets.aCRF.map((dataset, i) => (
							<SidebarItem 
								key={dataset.id} 
								active={selectedId === dataset.id} 
								onClick={() => handleDatasetSelect(dataset.id)} 
								tone={toneFor(i, groupedDatasets.aCRF.length)}
								itemId={dataset.id}
							>
								{dataset.name}
							</SidebarItem>
						))}
					</SidebarGroup>
					<SidebarGroup label="TLFs" accentVar="--accent-tlf">
						{groupedDatasets.TLF.map((dataset, i) => (
							<SidebarItem 
								key={dataset.id} 
								active={selectedId === dataset.id} 
								onClick={() => handleDatasetSelect(dataset.id)} 
								tone={toneFor(i, groupedDatasets.TLF.length)}
								itemId={dataset.id}
							>
								{dataset.name}
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


