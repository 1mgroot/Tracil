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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-3 md:p-4 bg-black/50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-2xl max-h-[95vh] sm:max-h-[92vh] md:max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-3 sm:p-4 md:p-5 lg:p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-base sm:text-lg md:text-xl font-semibold text-gray-900 dark:text-white">
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
        <div className="p-3 sm:p-4 md:p-5 lg:p-6 space-y-3 sm:space-y-4 md:space-y-5 lg:space-y-6">
          {/* File Drop Zone - More compact on small screens */}
          <div
            className={`border-2 border-dashed rounded-lg p-3 sm:p-4 md:p-5 lg:p-6 xl:p-8 text-center transition-colors ${
              isDragOver
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <Upload className="w-6 h-6 sm:w-8 sm:h-8 md:w-10 md:h-10 lg:w-12 lg:h-12 mx-auto mb-2 sm:mb-3 md:mb-4 text-gray-400" />
            <p className="text-sm sm:text-base md:text-lg font-medium text-gray-900 dark:text-white mb-1 sm:mb-2 md:mb-3">
              Drop files here or click to browse
            </p>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-2 sm:mb-3 md:mb-4">
              Support for .xpt, .sas7bdat, .csv, .pdf, .docx, .rtf, .xml, .json files
            </p>
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              disabled={uploadState.isUploading}
              size="sm"
              className="text-xs sm:text-sm md:text-base"
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
            <div className="space-y-2 sm:space-y-3 md:space-y-4">
              <h3 className="text-sm sm:text-base md:text-lg font-medium text-gray-900 dark:text-white">
                Selected Files ({uploadState.selectedFiles.length})
              </h3>
              <div className="space-y-2 max-h-28 sm:max-h-36 md:max-h-40 lg:max-h-48 overflow-y-auto scrollable-container">
                {uploadState.selectedFiles.map((file, fileIndex) => (
                  <div
                    key={`${file.name}-${file.size}-${file.lastModified}-${fileIndex}`}
                    className="flex items-center justify-between p-2 sm:p-2.5 md:p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                  >
                    <div className="flex items-center space-x-2 sm:space-x-2.5 md:space-x-3 min-w-0 flex-1">
                      <File className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white truncate">
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
                      className="p-1 h-6 w-6 sm:h-7 sm:w-7 md:h-8 md:w-8 flex-shrink-0 ml-2"
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
              <div className="flex justify-between text-xs sm:text-sm text-gray-600 dark:text-gray-400">
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
                  className="flex items-center space-x-2 p-2 sm:p-2.5 md:p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
                >
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <p className="text-xs sm:text-sm text-red-700 dark:text-red-400">{error}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer - Always visible with responsive spacing */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-2.5 md:gap-3 p-3 sm:p-4 md:p-5 lg:p-6 border-t border-gray-200 dark:border-gray-700">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={uploadState.isUploading}
            className="order-2 sm:order-1 flex-1 sm:flex-none text-xs sm:text-sm md:text-base"
          >
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={uploadState.selectedFiles.length === 0 || uploadState.isUploading}
            className="bg-blue-600 hover:bg-blue-700 order-1 sm:order-2 flex-1 sm:flex-none text-xs sm:text-sm md:text-base"
          >
            {uploadState.isUploading ? 'Uploading...' : 'Upload Files'}
          </Button>
        </div>
      </div>
    </div>
  )
}
