import { Component } from 'react'
import StateBlock from './StateBlock'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    console.error('Application error boundary caught an error', error, errorInfo)
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="app-fallback" role="alert">
          <div className="app-fallback__panel">
            <StateBlock
              type="error"
              title="This view could not load"
              message="Refresh the page and try again. Your workspace data is still safe."
              actionLabel="Refresh"
              onAction={this.handleReload}
            />
          </div>
        </main>
      )
    }

    return this.props.children
  }
}
