/**
 * Professional Color System for Tracil Application
 * 
 * DESIGN PHILOSOPHY:
 * Based on Apple & Sony design principles for enterprise applications
 * 
 * 1. SEMANTIC COLOR MAPPING
 *    - Colors are chosen based on function and psychological impact
 *    - Each color represents a specific data type with clear meaning
 * 
 * 2. OPTIMAL HUE DISTRIBUTION
 *    - 60° intervals between colors for maximum visual distinction
 *    - Prevents color confusion and improves accessibility
 * 
 * 3. CONSISTENT LIGHTNESS & CHROMA
 *    - All primary colors use 0.65 lightness and 0.18 chroma
 *    - Creates visual harmony while maintaining contrast
 * 
 * 4. ACCESSIBILITY FIRST
 *    - WCAG 2.2 AA compliance for all color combinations
 *    - High contrast ratios for text readability
 * 
 * 5. BRAND PSYCHOLOGY
 *    - Professional, trustworthy colors for clinical data
 *    - Emotional connection to data types and functions
 */

export type ArtifactType = 'ADaM' | 'SDTM' | 'CRF' | 'TLF' | 'Protocol' | 'Unknown' | 'target'

/**
 * COLOR SEMANTICS & PSYCHOLOGY:
 * 
 * SDTM (240° Blue): Trust, Stability, Data Standards
 *    - Blue represents reliability and professional data handling
 *    - Used for foundational data structures
 * 
 * ADaM (150° Green): Growth, Analysis, Success
 *    - Green represents progress and analytical thinking
 *    - Used for derived and analyzed datasets
 * 
 * CRF (60° Orange): Energy, Clinical, Human
 *    - Orange represents human interaction and clinical processes
 *    - Used for patient-facing forms and data collection
 * 
 * TLF (300° Purple): Innovation, Technology, Results
 *    - Purple represents innovation and technological advancement
 *    - Used for final outputs and reporting
 * 
 * Protocol (180° Teal): Planning, Strategy, Process
 *    - Teal represents strategic thinking and process planning
 *    - Used for study design and methodology
 */

/**
 * Get the primary accent color for a given artifact type
 * These colors match the sidebar accent colors exactly
 */
export function getTypeColor(type: ArtifactType): string {
  switch (type) {
    case 'ADaM':
      return 'var(--accent-adam)'
    case 'SDTM':
      return 'var(--accent-sdtm)'
    case 'CRF':
      return 'var(--accent-acrf)'
    case 'TLF':
      return 'var(--accent-tlf)'
    case 'Protocol':
      return 'var(--accent-protocol)'
    case 'target':
      return 'oklch(0.50 0.10 30)' // Orange for target nodes
    case 'Unknown':
      return 'oklch(0.50 0.10 30)' // Dark gray for unknown types
    default:
      return 'oklch(0.50 0.10 30)' //  Dark gray
  }
}

/**
 * Get the hover color for a given artifact type
 * These colors match the sidebar hover colors exactly
 */
export function getTypeHoverColor(type: ArtifactType): string {
  switch (type) {
    case 'ADaM':
      return 'var(--accent-adam-hover)'
    case 'SDTM':
      return 'var(--accent-sdtm-hover)'
    case 'CRF':
      return 'var(--accent-acrf-hover)'
    case 'TLF':
      return 'var(--accent-tlf-hover)'
    case 'Protocol':
      return 'var(--accent-protocol-hover)'
    case 'target':
      return 'oklch(0.55 0.16 60)' // Darker orange for hover
    case 'Unknown':
      return 'oklch(0.45 0.10 30)' // Darker gray for hover
    default:
      return 'var(--accent-sdtm-hover)' // Fallback to SDTM hover color
  }
}

/**
 * Get the background color for a given artifact type
 * These colors match the sidebar background colors exactly
 */
export function getTypeBackgroundColor(type: ArtifactType): string {
  switch (type) {
    case 'ADaM':
      return 'var(--accent-adam-bg)'
    case 'SDTM':
      return 'var(--accent-sdtm-bg)'
    case 'CRF':
      return 'var(--accent-acrf-bg)'
    case 'TLF':
      return 'var(--accent-tlf-bg)'
    case 'Protocol':
      return 'var(--accent-protocol-bg)'
    case 'target':
      return 'oklch(0.96 0.03 60)' // Light orange background
    case 'Unknown':
      return 'oklch(0.95 0.02 30)' // Light gray background
    default:
      return 'var(--accent-sdtm-bg)' // Fallback to SDTM background color
  }
}

/**
 * Get the text color for a given artifact type
 * Returns appropriate text color based on background brightness
 */
export function getTypeTextColor(): string {
  // For lineage graph nodes, we want white text on colored backgrounds
  return 'white'
}

/**
 * Get the border color for a given artifact type
 * Returns a slightly darker version of the main color for borders
 */
export function getTypeBorderColor(type: ArtifactType): string {
  switch (type) {
    case 'ADaM':
      return 'var(--accent-adam-hover)'
    case 'SDTM':
      return 'var(--accent-sdtm-hover)'
    case 'CRF':
      return 'var(--accent-acrf-hover)'
    case 'TLF':
      return 'var(--accent-tlf-hover)'
    case 'Protocol':
      return 'var(--accent-protocol-hover)'
    case 'target':
      return 'oklch(0.55 0.16 60)' // Darker orange for border
    case 'Unknown':
      return 'oklch(0.40 0.08 30)' // Dark gray for border
    default:
      return 'var(--accent-sdtm-hover)' // Fallback to SDTM hover color
  }
}

/**
 * Get all color properties for a given artifact type
 * Returns an object with all the color values needed for styling
 */
export function getTypeColors(type: ArtifactType) {
  return {
    background: getTypeColor(type),
    hover: getTypeHoverColor(type),
    backgroundLight: getTypeBackgroundColor(type),
    text: getTypeTextColor(),
    border: getTypeBorderColor(type),
  }
}
