import { Component, type ReactNode, type ErrorInfo } from 'react'

interface Props {
  readonly children: ReactNode
  readonly fallback?: ReactNode
}

interface State {
  readonly hasError: boolean
  readonly error: Error | null
}

export class VariablesErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Variables Browser Error:', error, errorInfo)
    // In production, you might want to log this to an error reporting service
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div 
          className="flex flex-col items-center justify-center p-8 text-center"
          role="alert"
          aria-live="assertive"
        >
          <div className="mb-4">
            <svg
              className="w-16 h-16 text-[var(--text-secondary)] mx-auto"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          
          <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
            Something went wrong
          </h2>
          
          <p className="text-[var(--text-secondary)] mb-4 max-w-md">
            We encountered an error while loading the variables browser. 
            Please try refreshing the page or selecting a different dataset.
          </p>
          
          <div className="flex gap-3">
            <button
              onClick={() => window.location.reload()}
              className="
                px-4 py-2 
                bg-[var(--accent)] 
                text-[var(--accent-foreground)] 
                rounded-md 
                hover:bg-[var(--accent)]/90 
                focus:outline-none 
                focus:ring-2 
                focus:ring-[var(--focus-ring)]
                transition-colors
              "
            >
              Refresh Page
            </button>
            
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="
                px-4 py-2 
                border 
                border-[var(--border)] 
                text-[var(--text-primary)] 
                rounded-md 
                hover:bg-[var(--surface-hover)] 
                focus:outline-none 
                focus:ring-2 
                focus:ring-[var(--focus-ring)]
                transition-colors
              "
            >
              Try Again
            </button>
          </div>
          
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details className="mt-6 text-left max-w-2xl">
              <summary className="cursor-pointer text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                Error Details (Development)
              </summary>
              <pre className="mt-2 p-4 bg-[var(--surface-muted)] rounded-md text-sm overflow-auto">
                {this.state.error.stack}
              </pre>
            </details>
          )}
        </div>
      )
    }

    return this.props.children
  }
}
