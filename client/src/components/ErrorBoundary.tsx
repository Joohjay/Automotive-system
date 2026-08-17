import { Component, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-dvh items-center justify-center bg-background p-6">
          <div className="w-full max-w-md rounded-xl border border-red-200 bg-red-50 p-6 text-center">
            <h1 className="text-lg font-semibold text-red-700">Something went wrong</h1>
            <p className="mt-2 text-sm break-words text-red-600">
              {this.state.error.message || String(this.state.error)}
            </p>
            <Button className="mt-4" onClick={() => {
              this.setState({ error: null })
              window.location.hash = ''
              window.location.reload()
            }}>
              Reload page
            </Button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
