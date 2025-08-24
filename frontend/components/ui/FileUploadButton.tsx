import { Upload, FolderOpen } from 'lucide-react'
import { Button } from './button'

interface FileUploadButtonProps {
  onUploadClick: () => void
  disabled?: boolean
  className?: string
  variant?: 'default' | 'sidebar'
}

export function FileUploadButton({ onUploadClick, disabled = false, className = '', variant = 'default' }: FileUploadButtonProps) {
  if (variant === 'sidebar') {
    return (
      <Button
        onClick={onUploadClick}
        disabled={disabled}
        variant="ghost"
        size="sm"
        className={`p-2 h-8 w-8 rounded-md hover:bg-blue-50 hover:text-blue-600 transition-colors ${className}`}
        aria-label="Upload clinical data files"
      >
        <FolderOpen className="w-4 h-4" />
      </Button>
    )
  }

  return (
    <Button
      onClick={onUploadClick}
      disabled={disabled}
      className={`bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors ${className}`}
      aria-label="Upload clinical data files"
    >
      <Upload className="w-4 h-4 mr-2" />
      Upload Files
    </Button>
  )
}
