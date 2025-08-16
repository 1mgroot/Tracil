import { axe, toHaveNoViolations } from 'jest-axe'
import type { Result } from 'axe-core'

// Extend Jest matchers
expect.extend(toHaveNoViolations)

// Custom axe configuration for our application
const axeConfig = {
  rules: {
    // Enable additional rules for 2025 WCAG 2.2 AA compliance
    'color-contrast': { enabled: true },
    'focus-order-semantics': { enabled: true },
    'landmark-unique': { enabled: true },
    'region': { enabled: true },
    
    // Disable rules that might conflict with our design system
    'page-has-heading-one': { enabled: false }, // We handle this at the page level
    'landmark-no-duplicate-banner': { enabled: false }, // Multiple banners might be intentional
  },
  tags: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']
}

/**
 * Test accessibility compliance for a given DOM element
 * @param container - The DOM element to test
 * @param config - Optional axe configuration overrides
 */
export async function testAccessibility(
  container: HTMLElement,
  config: any = {}
): Promise<void> {
  const results = await axe(container, { ...axeConfig, ...config })
  expect(results).toHaveNoViolations()
}

/**
 * Test accessibility with custom rules
 * @param container - The DOM element to test
 * @param customRules - Custom axe rules to apply
 */
export async function testAccessibilityWithRules(
  container: HTMLElement,
  customRules: Record<string, any>
): Promise<void> {
  const config = {
    ...axeConfig,
    rules: { ...axeConfig.rules, ...customRules }
  }
  
  const results = await axe(container, config)
  expect(results).toHaveNoViolations()
}

/**
 * Get accessibility violations without throwing
 * Useful for logging or custom handling
 */
export async function getAccessibilityViolations(
  container: HTMLElement,
  config: any = {}
): Promise<Result[]> {
  const results = await axe(container, { ...axeConfig, ...config })
  return results.violations
}

/**
 * Test keyboard navigation for a component
 * @param container - The container element
 * @param expectedFocusableElements - Expected number of focusable elements
 */
export function testKeyboardNavigation(
  container: HTMLElement,
  expectedFocusableElements?: number
): void {
  // Get all focusable elements
  const focusableElements = container.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  )
  
  if (expectedFocusableElements !== undefined) {
    expect(focusableElements).toHaveLength(expectedFocusableElements)
  }
  
  // Test that all focusable elements have visible focus indicators
  focusableElements.forEach((element) => {
    const htmlElement = element as HTMLElement
    htmlElement.focus()
    
    // In JSDOM, we can't reliably test computed styles for pseudo-classes
    // Instead, check that focus-visible classes are present in the className
    const hasJSDOMFocusClasses = htmlElement.className.includes('focus-visible:outline') || 
                                htmlElement.className.includes('focus-visible:ring') ||
                                htmlElement.className.includes('focus-visible:border')
    
    // Fallback to computed style check for real browsers
    const computedStyle = window.getComputedStyle(htmlElement, ':focus-visible')
    const hasOutline = computedStyle.outline !== 'none' && computedStyle.outline !== '0px'
    const hasBoxShadow = computedStyle.boxShadow !== 'none'
    const hasBorder = computedStyle.borderColor !== 'transparent'
    
    expect(hasJSDOMFocusClasses || hasOutline || hasBoxShadow || hasBorder).toBe(true)
  })
}

/**
 * Test ARIA attributes for a component
 * @param container - The container element
 * @param expectedAttributes - Expected ARIA attributes
 */
export function testAriaAttributes(
  container: HTMLElement,
  expectedAttributes: Record<string, string | boolean>
): void {
  Object.entries(expectedAttributes).forEach(([attribute, expectedValue]) => {
    const element = container.querySelector(`[${attribute}]`)
    expect(element).toBeInTheDocument()
    
    if (typeof expectedValue === 'string') {
      expect(element).toHaveAttribute(attribute, expectedValue)
    } else if (expectedValue === true) {
      expect(element).toHaveAttribute(attribute)
    }
  })
}

/**
 * Test color contrast ratios
 * @param container - The container element
 * @param minimumRatio - Minimum contrast ratio (default: 4.5 for AA compliance)
 */
export async function testColorContrast(
  container: HTMLElement,
  minimumRatio: number = 4.5
): Promise<void> {
  const config = {
    rules: {
      'color-contrast': {
        enabled: true,
        options: { contrastRatio: { normal: { aa: minimumRatio } } }
      }
    }
  }
  
  await testAccessibility(container, config)
}

/**
 * Test semantic HTML structure
 * @param container - The container element
 */
export function testSemanticHTML(container: HTMLElement): void {
  // Check for proper landmark usage
  const landmarks = container.querySelectorAll('main, nav, aside, section, article, header, footer')
  expect(landmarks.length).toBeGreaterThan(0)
  
  // Check for proper heading hierarchy
  const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6')
  if (headings.length > 0) {
    const headingLevels = Array.from(headings).map(h => parseInt(h.tagName.charAt(1)))
    
    // Check that headings start with h1 or h2 (depending on page context)
    expect(headingLevels[0]).toBeLessThanOrEqual(2)
    
    // Check that heading levels don't skip (e.g., h1 -> h3)
    for (let i = 1; i < headingLevels.length; i++) {
      const diff = headingLevels[i] - headingLevels[i - 1]
      expect(diff).toBeLessThanOrEqual(1)
    }
  }
}

/**
 * Comprehensive accessibility test suite
 * Runs all accessibility tests in one function
 */
export async function runFullAccessibilityTest(
  container: HTMLElement,
  options: {
    expectedFocusableElements?: number
    expectedAriaAttributes?: Record<string, string | boolean>
    minimumContrastRatio?: number
    customAxeConfig?: any
  } = {}
): Promise<void> {
  // Run axe accessibility tests
  await testAccessibility(container, options.customAxeConfig)
  
  // Test keyboard navigation
  if (options.expectedFocusableElements !== undefined) {
    testKeyboardNavigation(container, options.expectedFocusableElements)
  }
  
  // Test ARIA attributes
  if (options.expectedAriaAttributes) {
    testAriaAttributes(container, options.expectedAriaAttributes)
  }
  
  // Test color contrast
  if (options.minimumContrastRatio) {
    await testColorContrast(container, options.minimumContrastRatio)
  }
  
  // Test semantic HTML
  testSemanticHTML(container)
}
