interface EmptyStateProps {
  onUploadClick: () => void
}

export function EmptyState({ onUploadClick: _onUploadClick }: EmptyStateProps) { // eslint-disable-line @typescript-eslint/no-unused-vars
  return (
    <div className="min-h-screen w-full flex items-center justify-center p-6">
      <div className="w-full flex flex-col items-center gap-6 max-w-2xl">
        <div className="text-center">
          <div className="text-blue-500 text-6xl mb-4">📁</div>
          <h1 className="text-2xl md:text-3xl text-balance font-semibold text-gray-900 dark:text-white mb-4">
            Welcome to Tracil
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-6">
            Use the upload button in the left sidebar to add your clinical data files.
          </p>
        </div>

        {/* Information Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full mt-8">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-center">
            <div className="text-blue-600 dark:text-blue-400 text-2xl mb-2">🔍</div>
            <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-1">
              Explore Variables
            </h3>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Browse through your clinical datasets and examine variable definitions
            </p>
          </div>

          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 text-center">
            <div className="text-green-600 dark:text-green-400 text-2xl mb-2">🔄</div>
            <h3 className="font-medium text-green-900 dark:text-green-100 mb-1">
              Trace Lineage
            </h3>
            <p className="text-sm text-green-700 dark:text-green-300">
              Follow data flow from source to analysis datasets
            </p>
          </div>

          <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4 text-center">
            <div className="text-purple-600 dark:text-purple-400 text-2xl mb-2">📊</div>
            <h3 className="font-medium text-purple-900 dark:text-purple-100 mb-1">
              CDISC Standards
            </h3>
            <p className="text-sm text-purple-700 dark:text-purple-300">
              Organized by SDTM, ADaM, CRF, and TLF standards
            </p>
          </div>
        </div>

        {/* Help Text */}
        <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mt-6 w-full">
          <h3 className="font-medium text-gray-900 dark:text-white mb-2">
            💡 Getting Started
          </h3>
          <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
            <li>• Click the folder icon in the left sidebar to upload files</li>
            <li>• Files are automatically categorized by CDISC standards</li>
            <li>• Explore variables and trace data lineage across datasets</li>
            <li>• All processing happens securely in the Python backend</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
