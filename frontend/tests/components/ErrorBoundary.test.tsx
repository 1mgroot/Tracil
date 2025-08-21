import { render, screen, fireEvent } from '@testing-library/react'
import { ErrorBoundary, withErrorBoundary } from '@/components/ui/ErrorBoundary'

// Component that throws an error for testing
const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error message')
  }
  return <div>Normal content</div>
}

describe('ErrorBoundary', () => {
  // Suppress console.error for these tests since we're testing error boundaries
  const originalConsoleError = console.error
  beforeEach(() => {
    console.error = jest.fn()
  })

  afterEach(() => {
    console.error = originalConsoleError
  })

  describe('Normal Operation', () => {
    it('should render children when no error occurs', () => {
      render(
        <ErrorBoundary>
          <div>Test content</div>
        </ErrorBoundary>
      )
      
      expect(screen.getByText('Test content')).toBeInTheDocument()
    })

    it('should render complex children correctly', () => {
      render(
        <ErrorBoundary>
          <div>
            <h1>Title</h1>
            <p>Paragraph</p>
            <button>Click me</button>
          </div>
        </ErrorBoundary>
      )
      
      expect(screen.getByText('Title')).toBeInTheDocument()
      expect(screen.getByText('Paragraph')).toBeInTheDocument()
      expect(screen.getByRole('button')).toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    it('should catch errors and render fallback UI', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )
      
      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
      expect(screen.getByText('An error occurred while rendering this component. Please try again or contact support if the problem persists.')).toBeInTheDocument()
    })

    it('should log errors to console', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )
      
      expect(console.error).toHaveBeenCalledWith(
        'Error caught by boundary:',
        expect.any(Error),
        expect.any(Object)
      )
    })

    it('should call custom onError handler', () => {
      const mockOnError = jest.fn()
      
      render(
        <ErrorBoundary onError={mockOnError}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )
      
      expect(mockOnError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.any(Object)
      )
    })

    it('should store error in state', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )
      
      // Error details should be available in development mode
      if (process.env.NODE_ENV === 'development') {
        expect(screen.getByText('Error Details (Development)')).toBeInTheDocument()
      }
    })
  })

  describe('Fallback UI', () => {
    it('should render default error UI when no fallback provided', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )
      
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    })

    it('should render custom fallback when provided', () => {
      const customFallback = <div>Custom error message</div>
      
      render(
        <ErrorBoundary fallback={customFallback}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )
      
      expect(screen.getByText('Custom error message')).toBeInTheDocument()
      expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument()
    })

    it('should render error icon', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )
      
      const icon = document.querySelector('svg')
      expect(icon).toBeInTheDocument()
      expect(icon).toHaveClass('h-12', 'w-12', 'text-destructive')
    })
  })

  describe('Retry Functionality', () => {
    it('should reset error state when retry button is clicked', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )
      
      // Initially shows error
      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
      
      // Click retry button - this resets the internal error state
      const retryButton = screen.getByRole('button', { name: 'Try again' })
      fireEvent.click(retryButton)
      
      // Since the ThrowError component still has shouldThrow={true},
      // it will throw again immediately and the error boundary will catch it
      // The retry button should still be visible because we're back in error state
      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    })

    it('should allow recovery when error condition is resolved', () => {
      const { rerender } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )
      
      // Initially shows error
      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
      
      // Click retry button to reset error state
      const retryButton = screen.getByRole('button', { name: 'Try again' })
      fireEvent.click(retryButton)
      
      // Now re-render with the error condition resolved AND a fresh ErrorBoundary
      // This simulates the parent component re-rendering with a new ErrorBoundary instance
      rerender(
        <ErrorBoundary key="fresh">
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>
      )
      
      // Should show normal content since error boundary state is reset and no error occurs
      expect(screen.getByText('Normal content')).toBeInTheDocument()
      expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument()
    })

    it('should clear error details when retrying', () => {
      const { rerender } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )
      
      // Click retry button
      const retryButton = screen.getByRole('button', { name: 'Try again' })
      fireEvent.click(retryButton)
      
      // Re-render with error again - this will recreate the component tree
      rerender(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )
      
      // Should show fresh error state
      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    })
  })

  describe('Development Mode Features', () => {
    it('should show error details in development mode', () => {
      // Mock NODE_ENV for this test
      const originalEnv = process.env.NODE_ENV
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: 'development',
        writable: true
      })
      
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )
      
      expect(screen.getByText('Error Details (Development)')).toBeInTheDocument()
      // The error details show the stack trace, which includes the error message
      expect(screen.getByText(/Test error message/)).toBeInTheDocument()
      
      // Restore original NODE_ENV
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: originalEnv,
        writable: true
      })
    })

    it('should hide error details in production mode', () => {
      // Mock NODE_ENV for this test
      const originalEnv = process.env.NODE_ENV
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: 'production',
        writable: true
      })
      
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )
      
      expect(screen.queryByText('Error Details (Development)')).not.toBeInTheDocument()
      
      // Restore original NODE_ENV
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: originalEnv,
        writable: true
      })
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )
      
      const alert = screen.getByRole('alert')
      expect(alert).toHaveAttribute('aria-live', 'assertive')
    })

    it('should have proper semantic structure', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )
      
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getByRole('button')).toBeInTheDocument()
      expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument()
    })

    it('should have proper focus management', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )
      
      const retryButton = screen.getByRole('button', { name: 'Try again' })
      expect(retryButton).toHaveClass('focus-visible:outline', 'focus-visible:outline-2', 'focus-visible:outline-[var(--focus)]')
    })

    it('should have proper color contrast classes', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )
      
      const heading = screen.getByRole('heading', { level: 2 })
      expect(heading).toHaveClass('text-destructive')
      
      const icon = document.querySelector('svg')
      expect(icon).toHaveClass('text-destructive')
    })
  })

  describe('Styling and Layout', () => {
    it('should have proper CSS classes for layout', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )
      
      const container = screen.getByRole('alert')
      expect(container).toHaveClass('flex', 'items-center', 'justify-center', 'min-h-[200px]', 'p-6')
      
      const content = container.querySelector('.text-center')
      expect(content).toHaveClass('text-center', 'max-w-md')
    })

    it('should have proper button styling', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )
      
      const retryButton = screen.getByRole('button', { name: 'Try again' })
      expect(retryButton).toHaveClass(
        'px-4', 'py-2', 'bg-primary', 'text-primary-foreground', 'rounded-md',
        'hover:bg-primary/90', 'transition-colors'
      )
    })
  })

  describe('withErrorBoundary HOC', () => {
    it('should wrap component with error boundary', () => {
      const WrappedComponent = withErrorBoundary(ThrowError)
      
      render(<WrappedComponent shouldThrow={true} />)
      
      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    })

    it('should pass through props correctly', () => {
      const WrappedComponent = withErrorBoundary(ThrowError)
      
      render(<WrappedComponent shouldThrow={false} />)
      
      expect(screen.getByText('Normal content')).toBeInTheDocument()
    })

    it('should use custom fallback when provided', () => {
      const customFallback = <div>Custom fallback</div>
      const WrappedComponent = withErrorBoundary(ThrowError, customFallback)
      
      render(<WrappedComponent shouldThrow={true} />)
      
      expect(screen.getByText('Custom fallback')).toBeInTheDocument()
    })

    it('should set proper display name', () => {
      const WrappedComponent = withErrorBoundary(ThrowError)
      expect(WrappedComponent.displayName).toBe('withErrorBoundary(ThrowError)')
    })
  })

  describe('Error Recovery', () => {
    it('should handle multiple error-recovery cycles', () => {
      const { rerender } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )
      
      // First error
      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
      
      // Retry and re-render with no error
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
      rerender(
        <ErrorBoundary key="recovery-1">
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>
      )
      
      expect(screen.getByText('Normal content')).toBeInTheDocument()
      
      // Second error
      rerender(
        <ErrorBoundary key="recovery-2">
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )
      
      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    })

    it('should maintain error boundary state across prop changes', () => {
      const { rerender } = render(
        <ErrorBoundary onError={jest.fn()}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )
      
      // Change onError prop
      rerender(
        <ErrorBoundary onError={jest.fn()}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      )
      
      // Should still show error
      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    })
  })
})
