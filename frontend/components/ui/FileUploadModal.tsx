import { useState, useCallback, useRef } from 'react'
import { X, Upload, File, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface FileUploadModalProps {
  isOpen: boolean
  onClose: () => void
  onUpload: (files: File[]) => Promise<unknown> // Return the response data
}

interface UploadState {
  selectedFiles: File[]
  isUploading: boolean
  progress: number
  errors: string[]
}

export function FileUploadModal({ isOpen, onClose, onUpload }: FileUploadModalProps) {
  const [uploadState, setUploadState] = useState<UploadState>({
    selectedFiles: [],
    isUploading: false,
    progress: 0,
    errors: []
  })
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files) return
    
    const newFiles = Array.from(files)
    setUploadState(prev => ({
      ...prev,
      selectedFiles: [...prev.selectedFiles, ...newFiles],
      errors: []
    }))
  }, [])

  const handleRemoveFile = useCallback((index: number) => {
    setUploadState(prev => ({
      ...prev,
      selectedFiles: prev.selectedFiles.filter((_, i) => i !== index),
      errors: []
    }))
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    handleFileSelect(e.dataTransfer.files)
  }, [handleFileSelect])

  const handleUpload = useCallback(async () => {
    if (uploadState.selectedFiles.length === 0) return
    
    setUploadState(prev => ({ ...prev, isUploading: true, progress: 0, errors: [] }))
    
    try {
      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setUploadState(prev => ({
          ...prev,
          progress: Math.min(prev.progress + 10, 90)
        }))
      }, 200)

      const responseData = await onUpload(uploadState.selectedFiles)
      
      clearInterval(progressInterval)
      setUploadState(prev => ({ ...prev, progress: 100 }))
      
      // Store the response data for the parent component to use
      if (responseData) {
        console.log('📊 Upload response data:', responseData)
      }
      
      // Close modal after successful upload
      setTimeout(() => {
        onClose()
        setUploadState({
          selectedFiles: [],
          isUploading: false,
          progress: 0,
          errors: []
        })
      }, 1000)
      
    } catch (error) {
      setUploadState(prev => ({
        ...prev,
        isUploading: false,
        errors: [error instanceof Error ? error.message : 'Upload failed']
      }))
    }
  }, [uploadState.selectedFiles, onUpload, onClose])

  const handleClose = useCallback(() => {
    if (!uploadState.isUploading) {
      onClose()
      setUploadState({
        selectedFiles: [],
        isUploading: false,
        progress: 0,
        errors: []
      })
    }
  }, [onClose, uploadState.isUploading])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Upload Clinical Data Files
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            disabled={uploadState.isUploading}
            className="p-2"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* File Drop Zone */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragOver
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Drop files here or click to browse
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Support for .xpt, .sas7bdat, .csv, .pdf, .docx, .rtf, .xml, .json files
            </p>
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              disabled={uploadState.isUploading}
            >
              Choose Files
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".xpt,.sas7bdat,.csv,.pdf,.docx,.rtf,.xml,.html,.json"
              onChange={(e) => handleFileSelect(e.target.files)}
              className="hidden"
            />
          </div>

          {/* Selected Files */}
          {uploadState.selectedFiles.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Selected Files ({uploadState.selectedFiles.length})
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {uploadState.selectedFiles.map((file, fileIndex) => (
                  <div
                    key={`${file.name}-${file.size}-${file.lastModified}-${fileIndex}`}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <File className="w-4 h-4 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {file.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {(file.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveFile(fileIndex)}
                      disabled={uploadState.isUploading}
                      className="p-1 h-8 w-8"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Progress Bar */}
          {uploadState.isUploading && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                <span>Uploading files...</span>
                <span>{uploadState.progress}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadState.progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Errors */}
          {uploadState.errors.length > 0 && (
            <div className="space-y-2">
              {uploadState.errors.map((error, errorIndex) => (
                <div
                  key={`error-${errorIndex}-${error.slice(0, 20)}`}
                  className="flex items-center space-x-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
                >
                  <AlertCircle className="w-4 h-4 text-red-500" />
                  <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={uploadState.isUploading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={uploadState.selectedFiles.length === 0 || uploadState.isUploading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {uploadState.isUploading ? 'Uploading...' : 'Upload Files'}
          </Button>
        </div>
      </div>
    </div>
  )
}
