"use client"

import { useMemo, useState, useCallback, type ReactNode, useEffect } from 'react'
import { Sidebar, SidebarGroup, SidebarItem } from '@/components/ui/sidebar/Sidebar'
import { SearchForm } from '@/components/search/SearchForm'

import { VariablesBrowser } from '@/components/variables'
import { LineageView } from './LineageView'
import { useVariablesBrowser } from '@/hooks/useVariablesBrowser'
import { useSearch } from '@/hooks/useSearch'
import { useSidebarKeyboardNav } from '@/hooks/useSidebarKeyboardNav'
import { FileUploadButton } from '@/components/ui/FileUploadButton'
import { SidebarToggle } from '@/components/ui/sidebar/SidebarToggle'
import { FileUploadModal } from '@/components/ui/FileUploadModal'
import type { UploadState } from '@/types/upload'

type ViewState = 'search' | 'variables' | 'lineage' | 'search-results'
type SelectedItem = { type: 'dataset'; datasetId: string } | null

export function MainScreenClient(): ReactNode {
	const { 
		datasets, 
		getDatasetById, 
		loading, 
		error, 
		refresh,
		hasUploadedFiles,
		setHasUploadedFiles,
		setDataDirectly
	} = useVariablesBrowser()
	
	const {
		query: searchQuery,
		lineage: searchLineage,
		loading: searchLoading,
		error: searchError,
		search: performSearch,
		clear: clearSearch,
		reset: resetSearch
	} = useSearch()
	
	const [selectedItem, setSelectedItem] = useState<SelectedItem>(null)
	const [selectedId, setSelectedId] = useState<string | null>(null)
	const [lineageState, setLineageState] = useState<{ dataset: string; variable: string } | null>(null)
	const [sidebarVisible, setSidebarVisible] = useState(true) // Always start with true for SSR
	const [uploadState, setUploadState] = useState<UploadState>({
		isModalOpen: false,
		isUploading: false,
		progress: 0,
		errors: []
	})

	// Load sidebar preference from localStorage after component mounts (client-side only)
	useEffect(() => {
		if (typeof window !== 'undefined') {
			const saved = localStorage.getItem('tracil-sidebar-visible')
			if (saved !== null) {
				setSidebarVisible(JSON.parse(saved))
			}
		}
	}, [])

	// Persist sidebar visibility preference to localStorage
	useEffect(() => {
		if (typeof window !== 'undefined') {
			localStorage.setItem('tracil-sidebar-visible', JSON.stringify(sidebarVisible))
		}
	}, [sidebarVisible])

	// Keyboard shortcut for toggling sidebar (Cmd/Ctrl + B)
	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			// Check if Cmd (Mac) or Ctrl (Windows/Linux) is pressed
			if ((event.metaKey || event.ctrlKey) && event.key === 'b') {
				event.preventDefault()
				setSidebarVisible((prev: boolean) => !prev)
			}
		}

		document.addEventListener('keydown', handleKeyDown)
		return () => document.removeEventListener('keydown', handleKeyDown)
	}, [])

	// Determine current view state
	const viewState: ViewState = searchLineage ? 'search-results' : lineageState ? 'lineage' : selectedItem?.type === 'dataset' ? 'variables' : 'search'
	
	// Get the selected dataset for variables view
	const selectedDataset = selectedItem?.type === 'dataset' 
		? getDatasetById(selectedItem.datasetId) 
		: undefined

	// Group datasets by their group type for sidebar display
	const groupedDatasets = useMemo(() => {
		const groups = {
			ADaM: datasets.filter(d => d.group === 'ADaM'),
			SDTM: datasets.filter(d => d.group === 'SDTM'),
			CRF: datasets.filter(d => d.group === 'CRF'),
			TLF: datasets.filter(d => d.group === 'TLF'),
			Protocol: datasets.filter(d => d.group === 'Protocol')
		}
		return groups
	}, [datasets])

	// Create flat list of all item IDs for keyboard navigation
	const allItemIds = useMemo(() => {
		return [
			...groupedDatasets.ADaM.map(d => d.id),
			...groupedDatasets.SDTM.map(d => d.id),
			...groupedDatasets.CRF.map(d => d.id),
			...groupedDatasets.TLF.map(d => d.id),
			...groupedDatasets.Protocol.map(d => d.id),
		]
	}, [groupedDatasets])

	// Handle dataset selection
	const handleDatasetSelect = useCallback((datasetId: string) => {
		setSelectedId(datasetId)
		setSelectedItem({ type: 'dataset', datasetId })
		setLineageState(null) // Clear lineage when switching datasets
		resetSearch() // Clear search results when switching datasets
		
		// Auto-trigger lineage analysis for TLF items
		const selectedDataset = getDatasetById(datasetId)
		if (selectedDataset && selectedDataset.group === 'TLF') {
			// For TLF items, automatically analyze lineage with the table ID
			setLineageState({
				dataset: 'TLF',
				variable: selectedDataset.name
			})
		}
		// Note: Protocol datasets don't auto-trigger lineage analysis
		// Users must click on individual variables (forms, endpoints, etc.) to analyze
	}, [getDatasetById, resetSearch])

	// Handle variable selection - open lineage view
	const handleVariableSelect = useCallback((variable: { name: string }) => {
		if (selectedDataset) {
			// For Protocol data, always use "Protocol" as the dataset
			// This ensures that analyze-variable calls use dataset: "Protocol"
			const datasetName = selectedDataset.group === 'Protocol' ? 'Protocol' : selectedDataset.name
			
			setLineageState({
				dataset: datasetName,
				variable: variable.name
			})
		}
	}, [selectedDataset])

	// Handle back from lineage view
	const handleLineageBack = useCallback(() => {
		setLineageState(null)
	}, [])

	// Handle search submission
	const handleSearch = useCallback(async (query: string) => {
		try {
			await performSearch(query)
		} catch (error) {
			console.error('Search failed:', error)
		}
	}, [performSearch])

	// Handle back from search results
	const handleSearchBack = useCallback(() => {
		clearSearch()
	}, [clearSearch])

	// Handle upload button click
	const handleUploadClick = useCallback(() => {
		setUploadState(prev => ({ ...prev, isModalOpen: true }))
	}, [])

	// Handle successful upload
	const handleUploadSuccess = useCallback(async (files: File[]) => {
		console.log('📁 Files uploaded successfully:', files)
		
		// Create FormData and send files to backend
		const formData = new FormData()
		files.forEach(file => {
			formData.append('files', file)
		})
		
		try {
			const response = await fetch('/api/ai/process-files', {
				method: 'POST',
				body: formData,
			})
			
			if (!response.ok) {
				throw new Error(`Upload failed: ${response.statusText}`)
			}
			
			const responseData = await response.json()
			console.log('📊 Upload response data:', responseData)
			
			// Update the variables browser data directly with the upload response
			// This ensures the UI updates immediately without needing a refresh
			if (responseData && responseData.standards) {
				// Set the data directly in the hook's state - this is the best practice
				// It avoids unnecessary API calls and ensures immediate UI updates
				setDataDirectly(responseData)
			} else {
				console.warn('⚠️ Upload response missing standards data:', responseData)
				setHasUploadedFiles(true)
			}
			
		} catch (error) {
			console.error('❌ Upload error:', error)
			throw error // Re-throw to let the modal handle the error
		}
	}, [setDataDirectly, setHasUploadedFiles])

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

	const navigateToSearch = useCallback(() => {
		setSelectedItem(null)
		setSelectedId(null)
		setLineageState(null)
		clearSearch()
		resetSearch()
	}, [clearSearch, resetSearch])

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

	return (
		<>
			{/* Floating restore button - always visible when sidebar is hidden */}
			{!sidebarVisible && (
				<div className="fixed left-0 top-1/2 -translate-y-1/2 z-40 group">
					<button
						onClick={() => setSidebarVisible(true)}
						className="p-2 h-12 w-6 rounded-r-lg rounded-l-none bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm border border-l-0 border-gray-200 dark:border-gray-700 shadow-lg hover:shadow-xl transition-all duration-200 ease-out hover:w-8 hover:bg-white dark:hover:bg-gray-900 group-hover:w-8 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset"
						aria-label="Restore sidebar"
					>
						<svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
						</svg>
					</button>
					
					{/* Tooltip */}
					<div className="absolute left-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
						<div className="bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
							Restore sidebar
						</div>
						<div className="absolute left-0 top-1/2 -translate-y-1/2 w-0 h-0 border-l-4 border-l-gray-900 border-t-4 border-t-transparent border-b-4 border-b-transparent"></div>
					</div>
				</div>
			)}

			{/* No data state - show main interface even without uploaded files */}
			{!hasUploadedFiles ? (
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
					<main className="flex flex-col p-6 relative">
						{/* Left edge restore hint when sidebar is hidden */}
						{!sidebarVisible && (
							<button
								onClick={() => setSidebarVisible(true)}
								onKeyDown={(e) => {
									if (e.key === 'Enter' || e.key === ' ') {
										e.preventDefault()
										setSidebarVisible(true)
									}
								}}
								className="absolute left-0 top-0 bottom-0 w-1 group cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset"
								aria-label="Click to restore sidebar"
								tabIndex={0}
							>
								<div className="absolute left-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity duration-200 pointer-events-none">
									<div className="bg-blue-500 text-white text-xs px-2 py-1 rounded-r whitespace-nowrap shadow-lg">
										Click to restore sidebar
									</div>
									<div className="absolute left-0 top-1/2 -translate-y-1/2 w-0 h-0 border-l-4 border-l-blue-500 border-t-4 border-t-transparent border-b-4 border-b-transparent"></div>
								</div>
							</button>
						)}
						
						{/* Main content */}
						<div className="flex-1 flex flex-col items-center justify-center gap-6">
							<SearchForm 
								onSearch={handleSearch}
								loading={searchLoading}
								error={searchError}
							/>
							

						</div>
					</main>
				</div>
			) : (
				<div 
					className={`h-screen w-full grid grid-cols-1 ${
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
						<SidebarGroup label="Protocol" accentVar="--accent-protocol">
							{groupedDatasets.Protocol.map((dataset, i) => (
								<SidebarItem 
									key={dataset.id} 
									active={selectedId === dataset.id} 
									onClick={() => handleDatasetSelect(dataset.id)} 
									tone={toneFor(i, groupedDatasets.Protocol.length)}
									itemId={dataset.id}
								>
									{dataset.name}
								</SidebarItem>
							))}
						</SidebarGroup>
					</Sidebar>
				</aside>

				{viewState === 'search' && (
					<main className="flex flex-col p-6 relative">
						{/* Left edge restore hint when sidebar is hidden */}
						{!sidebarVisible && (
							<button
								onClick={() => setSidebarVisible(true)}
								onKeyDown={(e) => {
									if (e.key === 'Enter' || e.key === ' ') {
										e.preventDefault()
										setSidebarVisible(true)
									}
								}}
								className="absolute left-0 top-0 bottom-0 w-1 group cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset"
								aria-label="Click to restore sidebar"
								tabIndex={0}
							>
								<div className="absolute left-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity duration-200 pointer-events-none">
									<div className="bg-blue-500 text-white text-xs px-2 py-1 rounded-r whitespace-nowrap shadow-lg">
										Click to restore sidebar
									</div>
									<div className="absolute left-0 top-1/2 -translate-y-1/2 w-0 h-0 border-l-4 border-l-blue-500 border-t-4 border-t-transparent border-b-4 border-b-transparent"></div>
								</div>
							</button>
						)}
						

						{/* Main content */}
						<div className="flex-1 flex flex-col items-center justify-center gap-6">
							<SearchForm 
								onSearch={handleSearch}
								loading={searchLoading}
								error={searchError}
							/>
							
						</div>
					</main>
				)}

				{viewState === 'search-results' && (
					<div className="relative">
						{/* Left edge restore hint when sidebar is hidden */}
						{!sidebarVisible && (
							<button
								onClick={() => setSidebarVisible(true)}
								onKeyDown={(e) => {
									if (e.key === 'Enter' || e.key === ' ') {
										e.preventDefault()
										setSidebarVisible(true)
									}
								}}
								className="absolute left-0 top-0 bottom-0 w-1 group cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset z-10"
								aria-label="Click to restore sidebar"
								tabIndex={0}
							>
								<div className="absolute left-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity duration-200 pointer-events-none">
									<div className="bg-blue-500 text-white text-xs px-2 py-1 rounded-r whitespace-nowrap shadow-lg">
										Click to restore sidebar
									</div>
									<div className="absolute left-0 top-1/2 -translate-y-1/2 w-0 h-0 border-l-4 border-l-blue-500 border-t-4 border-t-transparent border-b-4 border-b-transparent"></div>
								</div>
							</button>
						)}
						
						<LineageView
							dataset=""
							variable={searchQuery}
							onBack={handleSearchBack}
							mode="search"
							backButtonText="← Back"
							initialLineage={searchLineage}
						/>
					</div>
				)}

				{viewState === 'variables' && selectedDataset && (
					<div className="flex-1 overflow-hidden relative">
						{/* Left edge restore hint when sidebar is hidden */}
						{!sidebarVisible && (
							<button
								onClick={() => setSidebarVisible(true)}
								onKeyDown={(e) => {
									if (e.key === 'Enter' || e.key === ' ') {
										e.preventDefault()
										setSidebarVisible(true)
									}
								}}
								className="absolute left-0 top-0 bottom-0 w-1 group cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset"
								aria-label="Click to restore sidebar"
								tabIndex={0}
							>
								<div className="absolute left-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity duration-200 pointer-events-none">
									<div className="bg-blue-500 text-white text-xs px-2 py-1 rounded-r whitespace-nowrap shadow-lg">
										Click to restore sidebar
									</div>
									<div className="absolute left-0 top-1/2 -translate-y-1/2 w-0 h-0 border-l-4 border-l-blue-500 border-t-4 border-t-transparent border-b-4 border-b-transparent"></div>
								</div>
							</button>
						)}
						
						<VariablesBrowser 
							dataset={selectedDataset} 
							onVariableSelect={handleVariableSelect}
							onEscape={() => {
								setSelectedItem(null)
								setSelectedId(null)
							}}
							onSearchClick={navigateToSearch}
						/>
					</div>
				)}

				{viewState === 'lineage' && lineageState && (
					<div className="relative">
						{/* Left edge restore hint when sidebar is hidden */}
						{!sidebarVisible && (
							<button
								onClick={() => setSidebarVisible(true)}
								onKeyDown={(e) => {
									if (e.key === 'Enter' || e.key === ' ') {
										e.preventDefault()
										setSidebarVisible(true)
									}
								}}
								className="absolute left-0 top-0 bottom-0 w-1 group cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset"
								aria-label="Click to restore sidebar"
								tabIndex={0}
							>
								<div className="absolute left-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity duration-200 pointer-events-none">
									<div className="bg-blue-500 text-white text-xs px-2 py-1 rounded-r whitespace-nowrap shadow-lg">
										Click to restore sidebar
									</div>
									<div className="absolute left-0 top-1/2 -translate-y-1/2 w-0 h-0 border-l-4 border-l-blue-500 border-t-4 border-t-transparent border-b-4 border-b-transparent"></div>
								</div>
							</button>
						)}
						
						<LineageView
							dataset={lineageState.dataset}
							variable={lineageState.variable}
							onBack={handleLineageBack}
						/>
					</div>
				)}
				</div>
			)}

			{/* File Upload Modal - always available */}
			<FileUploadModal
				isOpen={uploadState.isModalOpen}
				onClose={handleUploadModalClose}
				onUpload={handleUploadSuccess}
			/>
		</>
	)
}


