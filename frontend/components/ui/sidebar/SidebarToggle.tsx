import { PanelLeftClose } from 'lucide-react'
import { Button } from '../button'

interface SidebarToggleProps {
  onToggle: () => void
  className?: string
}

export function SidebarToggle({ onToggle, className = '' }: SidebarToggleProps) {
  return (
    <Button
      onClick={onToggle}
      variant="ghost"
      size="sm"
      className={`p-2 h-8 w-8 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 sidebar-toggle-animation ${className}`}
      aria-label="Collapse sidebar"
    >
      <PanelLeftClose className="w-4 h-4" />
    </Button>
  )
}
