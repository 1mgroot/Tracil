import type { Metric } from 'web-vitals'

// Performance monitoring and analytics utilities
export function reportWebVitals(metric: Metric) {
  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.log('Web Vitals:', metric)
  }
  
  // Send to analytics service in production
  if (process.env.NODE_ENV === 'production' && typeof window !== 'undefined') {
    // Example: Send to Google Analytics 4
    if (window.gtag) {
      window.gtag('event', metric.name, {
        value: Math.round(metric.value),
        event_category: 'Web Vitals',
        non_interaction: true,
      } as Record<string, unknown>)
    }
    
    // Example: Send to custom analytics endpoint
    // fetch('/api/analytics', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(metric),
    // }).catch(console.error)
  }
}

// Error reporting utility
export function reportError(error: Error, errorInfo?: Record<string, unknown>) {
  if (process.env.NODE_ENV === 'development') {
    console.error('Error reported:', error, errorInfo)
    return
  }
  
  // In production, send to error tracking service
  try {
    // Example: Send to Sentry
    // Sentry.captureException(error, { extra: errorInfo })
    
    // Example: Send to custom error endpoint
    if (typeof window !== 'undefined') {
      fetch('/api/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          url: window.location.href,
          errorInfo,
        }),
      }).catch(console.error)
    }
  } catch (reportingError) {
    console.error('Failed to report error:', reportingError)
  }
}

// Performance measurement utilities
export class PerformanceMonitor {
  private static measurements = new Map<string, number>()
  
  static startMeasurement(name: string): void {
    this.measurements.set(name, performance.now())
  }
  
  static endMeasurement(name: string): number | null {
    const startTime = this.measurements.get(name)
    if (!startTime) {
      console.warn(`No start time found for measurement: ${name}`)
      return null
    }
    
    const duration = performance.now() - startTime
    this.measurements.delete(name)
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`Performance: ${name} took ${duration.toFixed(2)}ms`)
    }
    
    return duration
  }
  
  static measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
    this.startMeasurement(name)
    return fn().finally(() => this.endMeasurement(name))
  }
  
  static measure<T>(name: string, fn: () => T): T {
    this.startMeasurement(name)
    try {
      return fn()
    } finally {
      this.endMeasurement(name)
    }
  }
}

// User interaction tracking
export function trackUserInteraction(action: string, category: string, label?: string) {
  if (process.env.NODE_ENV === 'development') {
    console.log('User Interaction:', { action, category, label })
    return
  }
  
  // Send to analytics in production
  if (process.env.NODE_ENV === 'production' && typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', action, {
      event_category: category,
      event_label: label,
    } as Record<string, unknown>)
  }
}

// Accessibility violation reporting
export function reportA11yViolation(violation: Record<string, unknown>) {
  if (process.env.NODE_ENV === 'development') {
    console.warn('Accessibility Violation:', violation)
    return
  }
  
  // In production, you might want to track these for monitoring
  // but be careful not to spam your analytics
  if (Math.random() < 0.1) { // Sample 10% of violations
    reportError(new Error(`A11y Violation: ${violation.id}`), violation)
  }
}

// Type declarations for global gtag
declare global {
  interface Window {
    gtag?: (command: string, targetId: string, config?: Record<string, unknown>) => void
  }
}
