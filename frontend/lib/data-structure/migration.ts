import type { 
  ProcessFilesResponse,
  SourceAgnosticProcessFilesResponse,
  DatasetWithGroup
} from '@/types/variables'

import { 
  transformApiResponseToUI,
  transformSourceAgnosticToUI,
  convertLegacyToSourceAgnostic
} from '@/types/variables'

/**
 * Unified data access layer that works with both legacy and source-agnostic responses
 * This allows for gradual migration without breaking the UI
 */
export class DataStructureMigration {
  private static instance: DataStructureMigration
  private useSourceAgnostic = false

  static getInstance(): DataStructureMigration {
    if (!this.instance) {
      this.instance = new DataStructureMigration()
    }
    return this.instance
  }

  /**
   * Enable source-agnostic mode (for testing/migration)
   */
  enableSourceAgnosticMode(enabled: boolean = true): void {
    this.useSourceAgnostic = enabled
  }

  /**
   * Check if source-agnostic mode is enabled
   */
  isSourceAgnosticMode(): boolean {
    return this.useSourceAgnostic
  }

  /**
   * Transform any response type to UI format
   * This is the main entry point for UI components
   */
  transformToUI(response: ProcessFilesResponse | SourceAgnosticProcessFilesResponse): DatasetWithGroup[] {
    if (this.isSourceAgnosticResponse(response)) {
      return transformSourceAgnosticToUI(response)
    } else {
      return transformApiResponseToUI(response)
    }
  }

  /**
   * Convert legacy response to source-agnostic format
   * Useful for testing migration
   */
  convertLegacyToSourceAgnostic(response: ProcessFilesResponse): SourceAgnosticProcessFilesResponse {
    return convertLegacyToSourceAgnostic(response)
  }

  /**
   * Type guard to check if response is source-agnostic
   */
  private isSourceAgnosticResponse(
    response: ProcessFilesResponse | SourceAgnosticProcessFilesResponse
  ): response is SourceAgnosticProcessFilesResponse {
    return 'standards' in response
  }
}

/**
 * Hook for components to get the migration instance
 */
export function useMigration() {
  return DataStructureMigration.getInstance()
}

/**
 * Utility to get datasets in UI format from any response type
 */
export function getDatasetsForUI(response: ProcessFilesResponse | SourceAgnosticProcessFilesResponse): DatasetWithGroup[] {
  return DataStructureMigration.getInstance().transformToUI(response)
}
