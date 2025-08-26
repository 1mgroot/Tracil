# Grouped File Upload Design Document

## Overview

This document outlines the design and implementation of a grouped file upload system for the Tracil application. The system will allow users to upload clinical data files organized by CDISC standards (SDTM, ADaM, TLF, Protocol/SAP/CRF) and send them to the Python backend API for processing.

## Design Goals

1. **User Experience**: Simple and intuitive file upload with visual feedback
2. **File Selection**: Easy selection of multiple files without complex grouping
3. **Progress Tracking**: Real-time upload progress and status
4. **Responsive Design**: Works seamlessly on desktop and mobile devices
5. **Accessibility**: WCAG 2.2 AA compliant with keyboard navigation support
6. **Integration**: Seamless integration with existing Python backend API

## User Interface Design

### 1. Upload Button Placement
- **Location**: Top-left corner of the main content area (above the "What can I help with?" prompt)
- **Design**: Prominent blue button with upload icon and "Upload Files" text
- **Responsive**: Adapts to mobile with appropriate sizing

### 2. Left Pane Toggle
- **Location**: Top-right corner of the sidebar, add a collapse icon
- **Functionality**: Toggle visibility of the entire left sidebar
- **State Persistence**: Remembers user preference across sessions
- **Responsive**: Automatically hidden on mobile, toggle available on desktop

### 3. File Upload Modal
- **Trigger**: Clicking the Upload Files button
- **Layout**: Full-screen overlay on mobile, centered modal on desktop
- **Content**: Simple file picker with drag-and-drop support

## File Upload

### Supported File Types
- **Data Files**: `.xpt`, `.sas7bdat`, `.csv` (SDTM, ADaM datasets)
- **Documents**: `.pdf`, `.docx`, `.rtf`, `.html` (TLF, Protocol, SAP, CRF)
- **Metadata**: `.xml` (define.xml, specifications)
- **No Grouping Required**: User selects any combination of files they want to upload

### Simple Upload Process
- User clicks "Upload Files" button
- File picker opens allowing selection of multiple files
- All selected files are sent to the API in a single request
- Backend handles file categorization and processing automatically

## Component Architecture

### 1. FileUploadButton Component
```typescript
interface FileUploadButtonProps {
  onUploadClick: () => void;
  disabled?: boolean;
  className?: string;
}
```

**Features:**
- Prominent blue button with upload icon
- Disabled state when upload in progress
- Responsive design for mobile/desktop
- Keyboard accessible with proper ARIA labels

### 2. SidebarToggle Component
```typescript
interface SidebarToggleProps {
  isVisible: boolean;
  onToggle: () => void;
  className?: string;
}
```

**Features:**
- Icon button with toggle state
- Smooth animation for show/hide
- Persists state in localStorage
- Accessible with screen reader support

### 3. FileUploadModal Component
```typescript
interface FileUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (files: UploadedFiles) => Promise<void>;
}
```

**Features:**
- Full-screen overlay on mobile
- Organized file groups with visual hierarchy
- Drag-and-drop support for each group
- File validation and error handling
- Progress tracking for uploads

### 4. FileList Component
```typescript
interface FileListProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
  onRemoveFile: (file: File) => void;
}
```

**Features:**
- Simple list of selected files
- File count and size display
- Remove individual files
- Drag-and-drop support for adding files

## State Management

### Upload State
```typescript
interface UploadState {
  isModalOpen: boolean;
  isUploading: boolean;
  progress: number;
  errors: UploadError[];
}
```

### Files State
```typescript
interface FilesState {
  selectedFiles: File[];
  isUploading: boolean;
  uploadProgress: number;
}
```

### Application State
```typescript
interface AppState {
  hasUploadedFiles: boolean;        // Track if files have been uploaded in current session
  uploadState: UploadState;         // Current upload status
  filesState: FilesState;           // File selection and upload progress
  data: SourceAgnosticProcessFilesResponse | null;  // Only populated after upload
}
```

### State Flow
1. **Initial State**: `hasUploadedFiles: false`, `data: null`
2. **File Selection**: `filesState.selectedFiles` populated
3. **Upload Process**: `uploadState.isUploading: true`, progress tracking
4. **Upload Success**: `hasUploadedFiles: true`, data fetched and displayed
5. **Session Persistence**: State maintained until page refresh

## Current Implementation vs. Required Changes

### Current Behavior (Automatic Data Fetching)
- **useVariablesBrowser hook**: Automatically calls `GET /api/ai/process-files` on component mount
- **API Route**: Fetches data from Python backend's `GET /process-files` endpoint
- **Data Display**: Shows existing processed data immediately when page loads
- **No User Control**: Data is loaded regardless of user actions

### Required Changes (User-Triggered Upload)
- **Remove Automatic Fetching**: `useVariablesBrowser` should not fetch data on mount
- **Add Upload State**: Track whether files have been uploaded in current session
- **Conditional Data Display**: Only show data after successful file upload
- **Upload-Triggered Refresh**: Data refresh only happens after file upload completion

## API Integration

### Upload Endpoint
- **Route**: `POST /api/ai/process-files`
- **Backend**: Proxies to Python backend `POST /process-files`
- **Content-Type**: `multipart/form-data`
- **Response**: CDISC-organized data structure

### File Processing Flow
1. **Frontend**: User selects multiple files
2. **Upload**: Send all files to Python backend via Next.js API
3. **Processing**: Backend automatically categorizes and processes files
4. **Response**: Frontend receives CDISC-organized response
5. **Update**: Refresh dataset list and update UI state

## User Experience Flow

### 1. Initial State (No Data)
- Upload button visible in top-left
- Left sidebar visible but empty (no dataset groups)
- Main content shows "What can I help with?" prompt
- **No automatic data loading** - clean slate for user

### 2. Upload Process
1. User clicks "Upload Files" button
2. Modal opens with file picker
3. User selects multiple files (drag-and-drop or file picker)
4. Files are displayed in a simple list
5. User clicks "Upload Files" to begin upload

### 3. Upload Progress
1. Modal shows progress bar for overall upload
2. Real-time feedback for upload progress
3. Error handling for failed uploads
4. Success confirmation when complete

### 4. Post-Upload (Data Available)
1. Modal closes automatically
2. **Dataset list populates** with uploaded data
3. Success notification displayed
4. User can now browse variables and lineage
5. **Data persists for current session** until page refresh

## Required Code Changes

### 1. Modify useVariablesBrowser Hook
```typescript
// Remove automatic data fetching on mount
useEffect(() => {
  // Don't fetch data automatically
  // fetchData() // Remove this line
}, [fetchData])

// Add upload state tracking
const [hasUploadedFiles, setHasUploadedFiles] = useState(false)

// Only fetch data if files have been uploaded
const fetchDataIfUploaded = useCallback(async () => {
  if (hasUploadedFiles) {
    await fetchData()
  }
}, [hasUploadedFiles, fetchData])
```

### 2. Update MainScreenClient Component
```typescript
// Add upload state management
const [uploadState, setUploadState] = useState<UploadState>({
  isModalOpen: false,
  isUploading: false,
  progress: 0,
  errors: []
})

// Handle successful upload
const handleUploadSuccess = useCallback(async () => {
  setUploadState(prev => ({ ...prev, isModalOpen: false }))
  // Trigger data refresh after upload
  await refresh()
}, [refresh])

// Conditional rendering based on upload state
if (!hasUploadedFiles) {
  return <EmptyState onUploadClick={() => setUploadState(prev => ({ ...prev, isModalOpen: true }))} />
}
```

### 3. Update API Route
```typescript
// POST method should handle file uploads
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const formData = await request.formData()
    const files = formData.getAll('files') as File[]
    
    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      )
    }

    // Forward to Python backend
    const backendFormData = new FormData()
    files.forEach(file => {
      backendFormData.append('files', file)
    })

    const response = await fetch(`${PYTHON_BACKEND_URL}/process-files`, {
      method: 'POST',
      body: backendFormData,
    })

    if (!response.ok) {
      throw new Error(`Backend error: ${response.statusText}`)
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    // Error handling
  }
}
```

## Accessibility Features

### Keyboard Navigation
- Tab order follows logical flow
- Escape key closes modal
- Enter/Space activates buttons
- Arrow keys navigate file groups

### Screen Reader Support
- Proper ARIA labels for all interactive elements
- Status announcements for upload progress
- Error messages read aloud
- File group descriptions

### Visual Design
- High contrast ratios (WCAG AA compliant)
- Clear visual hierarchy
- Consistent iconography
- Responsive typography

## Error Handling

### Validation Errors
- **File Type**: Invalid file extensions
- **File Size**: Files exceeding limits
- **File Count**: Too many files selected

### Upload Errors
- **Network**: Connection failures
- **Server**: Backend processing errors
- **Timeout**: Long-running operations
- **Format**: Unsupported file formats

### User Feedback
- Clear error messages with actionable guidance
- Visual indicators for each error type
- Retry mechanisms for recoverable errors
- Help text for common issues

## Performance Considerations

### File Handling
- Client-side file validation before upload
- Chunked uploads for large files
- Progress tracking for user feedback
- Memory-efficient file processing

### State Updates
- Debounced validation updates
- Optimistic UI updates
- Efficient re-renders with React.memo
- Background data refresh

## Mobile Responsiveness

### Layout Adaptations
- Full-screen modal on mobile
- Stacked file groups vertically
- Touch-friendly button sizes
- Swipe gestures for file management

### Performance
- Reduced animations on mobile
- Optimized file picker integration
- Efficient memory usage
- Fast upload initiation

## Testing Strategy

### Unit Tests
- Component rendering and interactions
- State management logic
- File validation functions
- API integration handlers

### Integration Tests
- End-to-end upload flow
- Error handling scenarios
- Mobile vs desktop behavior
- Accessibility compliance

### User Testing
- Usability testing with clinical data professionals
- Accessibility testing with screen readers
- Performance testing with large files
- Cross-browser compatibility

## Implementation Phases

### Phase 1: Core Components & State Management
- FileUploadButton component
- SidebarToggle component
- Basic modal structure
- Simple file picker
- **Upload state management** (replace automatic data fetching)
- **Conditional data display** (only show data after upload)

### Phase 2: Upload Functionality & API Integration
- Drag-and-drop implementation
- File list display
- **POST /api/ai/process-files integration** (send files to backend)
- **Replace automatic GET calls** with upload-triggered data refresh
- Progress tracking
- **Data refresh after successful upload**

### Phase 3: Enhanced UX & Data Flow
- Error handling improvements
- Mobile responsiveness
- Accessibility enhancements
- Performance optimization
- **Upload success feedback**
- **Empty state management** (no automatic data loading)

### Phase 4: Testing & Polish
- Comprehensive testing
- Bug fixes and refinements
- Documentation updates
- User feedback integration
- **Upload flow testing**
- **Data refresh validation**

## Success Metrics

### User Experience
- Upload completion rate > 95%
- Error rate < 5%
- Average upload time < 30 seconds
- User satisfaction score > 4.5/5

### Technical Performance
- Page load time < 2 seconds
- Upload success rate > 98%
- Memory usage < 100MB for large files
- Accessibility score 100%

### Business Impact
- Reduced time to data analysis
- Increased user adoption
- Improved data quality
- Enhanced user productivity

## Future Enhancements

### Advanced Features
- Batch upload scheduling
- File format conversion
- File preview capabilities
- Integration with external systems

### User Experience
- Drag-and-drop file selection
- File preview capabilities
- Upload templates and presets
- Collaborative upload workflows

### Analytics
- Upload analytics dashboard
- User behavior tracking
- Performance monitoring
- Error rate analysis

## Conclusion

This simple file upload system will provide Tracil users with an intuitive, efficient, and accessible way to upload clinical data files. The design prioritizes simplicity, accessibility, and performance while maintaining seamless integration with the existing Python backend architecture.

### Key Implementation Changes

The system requires significant changes to the current automatic data fetching behavior:

1. **Remove Automatic Data Loading**: The `useVariablesBrowser` hook currently fetches data on mount, which must be disabled
2. **Add Upload State Management**: Track whether files have been uploaded in the current session
3. **Conditional Data Display**: Only show data after successful file upload, not automatically
4. **Upload-Triggered Refresh**: Data refresh happens only after file upload completion
5. **Session Persistence**: Uploaded data persists for the current session until page refresh

### Benefits of the New Approach

- **User Control**: Users explicitly choose when to upload files
- **Clean Initial State**: No pre-existing data cluttering the interface
- **Clear Data Lineage**: All displayed data comes from user-uploaded files
- **Better Performance**: No unnecessary API calls on page load
- **Improved UX**: Clear workflow from upload to analysis

The implementation follows modern React best practices and ensures WCAG 2.2 AA compliance. The modular component architecture allows for easy maintenance and future enhancements, while the comprehensive testing strategy ensures reliability and quality.
