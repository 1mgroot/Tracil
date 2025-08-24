"use client"

import { useMemo, useState, useCallback, type ReactNode } from 'react'
import { Sidebar, SidebarGroup, SidebarItem } from '@/components/ui/sidebar/Sidebar'
import { SearchBar } from '@/components/search/SearchBar'
import { VariablesBrowser } from '@/components/variables'
import { LineageView } from './LineageView'
import { useVariablesBrowser } from '@/hooks/useVariablesBrowser'
import { useSidebarKeyboardNav } from '@/hooks/useSidebarKeyboardNav'
import { FileUploadButton } from '@/components/ui/FileUploadButton'
import { SidebarToggle } from '@/components/ui/sidebar/SidebarToggle'
import { FileUploadModal } from '@/components/ui/FileUploadModal'
import type { UploadState } from '@/types/upload'

type ViewState = 'search' | 'variables' | 'lineage'
type SelectedItem = { type: 'dataset'; datasetId: string } | null

export function MainScreenClient(): ReactNode {
	const { 
		datasets, 
		getDatasetById, 
		loading, 
		error, 
		refresh,
		hasUploadedFiles
	} = useVariablesBrowser()
	const [selectedItem, setSelectedItem] = useState<SelectedItem>(null)
	const [selectedId, setSelectedId] = useState<string | null>(null)
	const [lineageState, setLineageState] = useState<{ dataset: string; variable: string } | null>(null)
	const [sidebarVisible, setSidebarVisible] = useState(true)
	const [uploadState, setUploadState] = useState<UploadState>({
		isModalOpen: false,
		isUploading: false,
		progress: 0,
		errors: []
	})

	// Determine current view state
	const viewState: ViewState = lineageState ? 'lineage' : selectedItem?.type === 'dataset' ? 'variables' : 'search'
	
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
		setLineageState(null) // Clear lineage when switching datasets
	}, [])

	// Handle variable selection - open lineage view
	const handleVariableSelect = useCallback((variable: { name: string }) => {
		if (selectedDataset) {
			setLineageState({
				dataset: selectedDataset.name,
				variable: variable.name
			})
		}
	}, [selectedDataset])

	// Handle back from lineage view
	const handleLineageBack = useCallback(() => {
		setLineageState(null)
	}, [])

	// Handle upload button click
	const handleUploadClick = useCallback(() => {
		setUploadState(prev => ({ ...prev, isModalOpen: true }))
	}, [])

	// Handle successful upload
	const handleUploadSuccess = useCallback(async (files: File[]) => {
		console.log('📁 Files uploaded successfully:', files)
		// Trigger data refresh after upload
		await refresh()
	}, [refresh])

	// Handle upload modal close
	const handleUploadModalClose = useCallback(() => {
		setUploadState(prev => ({ ...prev, isModalOpen: false }))
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

	// Loading state (only show when actively loading after upload)
	if (loading) {
		return (
			<div className="min-h-screen w-full flex items-center justify-center">
				<div className="text-center">
					<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
					<p className="text-lg text-gray-600">Processing uploaded files...</p>
				</div>
			</div>
		)
	}

	// Error state (only show when there's an error after upload)
	if (error && hasUploadedFiles) {
		return (
			<div className="min-h-screen w-full flex items-center justify-center">
				<div className="text-center max-w-md">
					<div className="text-red-500 text-6xl mb-4">⚠️</div>
					<h2 className="text-xl font-semibold text-gray-800 mb-2">Failed to process uploaded files</h2>
					<p className="text-gray-600 mb-4">{error}</p>
					<button
						onClick={refresh}
						className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
					>
						Try Again
					</button>
				</div>
			</div>
		)
	}

	// No data state - show main interface even without uploaded files
	if (!hasUploadedFiles) {
		return (
			<>
				{/* Main interface without data */}
				<div 
					className={`min-h-screen w-full grid grid-cols-1 ${
						sidebarVisible ? 'md:grid-cols-[260px_1fr]' : 'md:grid-cols-[0px_1fr]'
					}`}
				>
					<aside className={`hidden md:block transition-all duration-300 ${
						sidebarVisible ? 'w-[260px]' : 'w-0 overflow-hidden'
					}`}>
						<Sidebar header={null} onKeyDown={handleKeyDown}>
							{/* Sidebar Header with Controls */}
							<div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
								<FileUploadButton
									onUploadClick={handleUploadClick}
									variant="sidebar"
									className="flex-shrink-0"
								/>
								<SidebarToggle
									isVisible={sidebarVisible}
									onToggle={() => setSidebarVisible(!sidebarVisible)}
									className="flex-shrink-0"
								/>
							</div>
							{/* Empty sidebar content */}
							<div className="p-4 text-center text-gray-500 dark:text-gray-400">
								<p className="text-sm">No datasets available</p>
								<p className="text-xs mt-1">Upload files to see your data</p>
							</div>
						</Sidebar>
					</aside>

					{/* Main content area */}
					<main className="flex flex-col p-6">
						{/* Header */}
						<div className="flex items-center justify-center mb-6">
							<h1 className="text-2xl md:text-3xl text-balance text-center">
								What can I help with?
							</h1>
						</div>

						{/* Main content */}
						<div className="flex-1 flex flex-col items-center justify-center gap-6">
							<SearchBar className="w-full max-w-2xl" />
							
							{/* Upload instructions */}
							<div className="max-w-2xl text-center">
								<div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
									<h3 className="text-lg font-semibold text-blue-800 mb-3">
										🚀 Get Started with File Upload
									</h3>
									<p className="text-blue-700 mb-4">
										Use the upload button in the left sidebar to add your clinical data files.
									</p>
									<div className="bg-white p-4 rounded border text-sm font-mono text-left">
										<span className="text-gray-600"># Upload files to backend</span><br/>
										curl -X POST http://localhost:8000/process-files \<br/>
										&nbsp;&nbsp;-F &quot;files=@your_file.xpt&quot;<br/>
										&nbsp;&nbsp;-F &quot;files=@your_define.xml&quot;<br/>
										&nbsp;&nbsp;-F &quot;files=@your_crf.pdf&quot;
									</div>
									<p className="text-sm text-blue-600 mt-3">
										After uploading, your datasets will appear in the sidebar.
									</p>
								</div>
							</div>
						</div>
					</main>
				</div>

				{/* File Upload Modal */}
				<FileUploadModal
					isOpen={uploadState.isModalOpen}
					onClose={handleUploadModalClose}
					onUpload={handleUploadSuccess}
				/>
			</>
		)
	}

	return (
		<>
			<div 
				className={`min-h-screen w-full grid grid-cols-1 ${
					sidebarVisible ? 'md:grid-cols-[260px_1fr]' : 'md:grid-cols-[0px_1fr]'
				}`}
			>
			<aside className={`hidden md:block transition-all duration-300 ${
				sidebarVisible ? 'w-[260px]' : 'w-0 overflow-hidden'
			}`}>
				<Sidebar header={null} onKeyDown={handleKeyDown}>
					{/* Sidebar Header with Controls */}
					<div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
						<FileUploadButton
							onUploadClick={handleUploadClick}
							variant="sidebar"
							className="flex-shrink-0"
						/>
						<SidebarToggle
							isVisible={sidebarVisible}
							onToggle={() => setSidebarVisible(!sidebarVisible)}
							className="flex-shrink-0"
						/>
					</div>
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
				<main className="flex flex-col p-6">
					{/* Header */}
					<div className="flex items-center justify-center mb-6">
						<h1 className="text-2xl md:text-3xl text-balance text-center">
							What can I help with?
						</h1>
					</div>

					{/* Main content */}
					<div className="flex-1 flex flex-col items-center justify-center gap-6">
						<SearchBar className="w-full max-w-2xl" />
						
						{/* Show upload instructions if no datasets */}
						{datasets.length === 0 && (
							<div className="max-w-2xl text-center">
								<div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
									<h3 className="text-lg font-semibold text-blue-800 mb-3">
										🚀 Get Started with File Upload
									</h3>
									<p className="text-blue-700 mb-4">
										Upload your clinical data files to the Python backend to start exploring variables and lineage.
									</p>
									<div className="bg-white p-4 rounded border text-sm font-mono text-left">
										<span className="text-gray-600"># Upload files to backend</span><br/>
										curl -X POST http://localhost:8000/process-files \<br/>
										&nbsp;&nbsp;-F &quot;files=@your_file.xpt&quot;<br/>
										&nbsp;&nbsp;-F &quot;files=@your_define.xml&quot;<br/>
										&nbsp;&nbsp;-F &quot;files=@your_crf.pdf&quot;
									</div>
									<p className="text-sm text-blue-600 mt-3">
										After uploading, click &quot;Refresh Data&quot; to see your datasets.
									</p>
								</div>
							</div>
						)}
						
						{/* Add refresh button for testing */}
						<button
							onClick={refresh}
							className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
						>
							🔄 Refresh Data
						</button>
					</div>
				</main>
			)}

			{viewState === 'variables' && selectedDataset && (
				<div className="flex-1 overflow-hidden">
					<VariablesBrowser 
						dataset={selectedDataset} 
						onVariableSelect={handleVariableSelect}
						onEscape={() => {
							setSelectedItem(null)
							setSelectedId(null)
						}}
					/>
				</div>
			)}

			{viewState === 'lineage' && lineageState && (
				<LineageView
					dataset={lineageState.dataset}
					variable={lineageState.variable}
					onBack={handleLineageBack}
				/>
			)}
			</div>

		{/* File Upload Modal */}
		<FileUploadModal
			isOpen={uploadState.isModalOpen}
			onClose={handleUploadModalClose}
			onUpload={handleUploadSuccess}
		/>
	</>
	)
}


