import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import './styles/premium.css'
import './styles/dark-theme.css'
import ErrorBoundary from './components/common/ErrorBoundary'
import { initTheme } from './theme/theme'

initTheme()

createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
)