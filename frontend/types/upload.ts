// Upload state management types
export interface UploadState {
  isModalOpen: boolean
  isUploading: boolean
  progress: number
  errors: UploadError[]
}

export interface UploadError {
  type: 'validation' | 'network' | 'server' | 'timeout' | 'format'
  message: string
  file?: string
  details?: string
}

export interface FilesState {
  selectedFiles: File[]
  isUploading: boolean
  uploadProgress: number
}

export interface AppState {
  hasUploadedFiles: boolean        // Track if files have been uploaded in current session
  uploadState: UploadState         // Current upload status
  filesState: FilesState           // File selection and upload progress
}
