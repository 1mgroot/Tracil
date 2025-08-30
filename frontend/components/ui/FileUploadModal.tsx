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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[calc(100vh-2rem)] border border-gray-100">
        {/* Header - Clean and modern */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-xl font-semibold text-gray-900">
            Upload Clinical Data Files
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            disabled={uploadState.isUploading}
            className="p-2 hover:bg-gray-100 rounded-xl transition-all duration-200"
          >
            <X className="w-5 h-5 text-gray-500" />
          </Button>
        </div>

        {/* Content - Elegant scrollable area */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6">
          {/* File Drop Zone - Beautiful design */}
          <div
            className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-300 ${
              isDragOver
                ? 'border-blue-500 bg-blue-50 shadow-lg scale-[1.02]'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/50'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-2xl flex items-center justify-center">
              <Upload className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Drop files here or click to browse
            </h3>
            <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">
              Support for .xpt, .sas7bdat, .csv, .pdf, .docx, .rtf, .xml, .json files
            </p>
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              disabled={uploadState.isUploading}
              className="px-6 py-3 text-sm font-medium hover:bg-blue-50 hover:border-blue-300 transition-all duration-200"
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

          {/* Selected Files - Clean list design */}
          {uploadState.selectedFiles.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  Selected Files
                </h3>
                <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                  {uploadState.selectedFiles.length} files
                </span>
              </div>
              <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
                {uploadState.selectedFiles.map((file, fileIndex) => (
                  <div
                    key={`${file.name}-${file.size}-${file.lastModified}-${fileIndex}`}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100 hover:bg-gray-100/80 transition-all duration-200"
                  >
                    <div className="flex items-center space-x-3 min-w-0 flex-1">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <File className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {file.name}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {(file.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveFile(fileIndex)}
                      disabled={uploadState.isUploading}
                      className="p-2 h-8 w-8 flex-shrink-0 hover:bg-red-50 hover:text-red-600 transition-all duration-200"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Progress Bar - Modern design */}
          {uploadState.isUploading && (
            <div className="space-y-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
              <div className="flex justify-between text-sm font-medium text-gray-700">
                <span>Uploading files...</span>
                <span>{uploadState.progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gray-800 h-2 rounded-full transition-all duration-300 shadow-sm"
                  style={{ width: `${uploadState.progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Errors - Clean error display */}
          {uploadState.errors.length > 0 && (
            <div className="space-y-3">
              {uploadState.errors.map((error, errorIndex) => (
                <div
                  key={`error-${errorIndex}-${error.slice(0, 20)}`}
                  className="flex items-center space-x-3 p-4 bg-red-50 border border-red-200 rounded-xl"
                >
                  <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <AlertCircle className="w-4 h-4 text-red-600" />
                  </div>
                  <p className="text-sm text-red-700 font-medium">{error}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer - Elegant button design */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 p-6 border-t border-gray-100 flex-shrink-0 bg-gray-50/50">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={uploadState.isUploading}
            className="order-2 sm:order-1 flex-1 sm:flex-none py-3 text-sm font-medium hover:bg-white hover:border-gray-300 transition-all duration-200"
          >
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={uploadState.selectedFiles.length === 0 || uploadState.isUploading}
            className="order-1 sm:order-2 flex-1 sm:flex-none py-3 text-sm font-medium bg-blue-600 hover:bg-blue-700 shadow-lg hover:shadow-xl transition-all duration-200"
          >
            {uploadState.isUploading ? 'Uploading...' : 'Upload Files'}
          </Button>
        </div>
      </div>
    </div>
  )
}
