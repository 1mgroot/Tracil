import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { Button } from '../button'

interface SidebarToggleProps {
  isVisible: boolean
  onToggle: () => void
  className?: string
}

export function SidebarToggle({ isVisible, onToggle, className = '' }: SidebarToggleProps) {
  return (
    <Button
      onClick={onToggle}
      variant="ghost"
      size="sm"
      className={`p-2 h-8 w-8 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 ${className}`}
      aria-label={isVisible ? 'Collapse sidebar' : 'Expand sidebar'}
    >
      {isVisible ? (
        <PanelLeftClose className="w-4 h-4" />
      ) : (
        <PanelLeftOpen className="w-4 h-4" />
      )}
    </Button>
  )
}
