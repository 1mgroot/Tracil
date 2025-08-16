import { useState, useEffect, useCallback, type KeyboardEvent } from 'react'

interface UseSidebarKeyboardNavProps {
	selectedId: string | null
	onSelectionChange: (id: string) => void
	itemIds: string[]
}

interface UseSidebarKeyboardNavReturn {
	handleKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void
	focusedId: string | null
	setFocusedId: (id: string | null) => void
}

export function useSidebarKeyboardNav({
	selectedId,
	onSelectionChange,
	itemIds,
}: UseSidebarKeyboardNavProps): UseSidebarKeyboardNavReturn {
	const [focusedId, setFocusedId] = useState<string | null>(selectedId)

	// Update focused item when selection changes
	useEffect(() => {
		if (selectedId && itemIds.includes(selectedId)) {
			setFocusedId(selectedId)
		}
	}, [selectedId, itemIds])

	// Focus the DOM element when focusedId changes
	useEffect(() => {
		if (focusedId) {
			const element = document.querySelector(`[data-item-id="${focusedId}"]`) as HTMLElement
			if (element) {
				element.focus()
			}
		}
	}, [focusedId])

	const handleKeyDown = useCallback(
		(event: KeyboardEvent<HTMLDivElement>) => {
			if (itemIds.length === 0) return

			const currentIndex = focusedId ? itemIds.indexOf(focusedId) : -1

			switch (event.key) {
				case 'ArrowDown': {
					event.preventDefault()
					const nextIndex = currentIndex < itemIds.length - 1 ? currentIndex + 1 : 0
					setFocusedId(itemIds[nextIndex])
					break
				}
				case 'ArrowUp': {
					event.preventDefault()
					const prevIndex = currentIndex > 0 ? currentIndex - 1 : itemIds.length - 1
					setFocusedId(itemIds[prevIndex])
					break
				}
				case 'Home': {
					event.preventDefault()
					setFocusedId(itemIds[0])
					break
				}
				case 'End': {
					event.preventDefault()
					setFocusedId(itemIds[itemIds.length - 1])
					break
				}
				case 'Enter':
				case ' ': {
					event.preventDefault()
					if (focusedId) {
						onSelectionChange(focusedId)
					}
					break
				}
			}
		},
		[focusedId, itemIds, onSelectionChange]
	)

	return {
		handleKeyDown,
		focusedId,
		setFocusedId,
	}
}
