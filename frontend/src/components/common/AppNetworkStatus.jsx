import { useEffect, useState } from 'react'
import { CloudOff, RefreshCw, WifiOff } from 'lucide-react'
import { IMS_API_STATUS_EVENT } from '../../api/apiClient'
import './AppNetworkStatus.css'

export default function AppNetworkStatus() {
  const [isOffline, setIsOffline] = useState(() => typeof navigator !== 'undefined' ? !navigator.onLine : false)
  const [serverIssue, setServerIssue] = useState(null)
  const [isRetrying, setIsRetrying] = useState(false)

  useEffect(() => {
    function handleOnline() {
      setIsOffline(false)
      setServerIssue(null)
    }

    function handleOffline() {
      setIsOffline(true)
    }

    function handleApiStatus(event) {
      const detail = event.detail ?? {}

      if (detail.status === 'pending') {
        return
      }

      if (detail.status === 'ok') {
        setServerIssue(null)
      }

      if (detail.batchComplete && !detail.batchServerReached && detail.batchIssue) {
        setServerIssue(detail.batchIssue)
      }
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    window.addEventListener(IMS_API_STATUS_EVENT, handleApiStatus)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener(IMS_API_STATUS_EVENT, handleApiStatus)
    }
  }, [])

  const handleReconnect = async () => {
    if (isRetrying) return

    const issueBeforeRetry = serverIssue
    setIsRetrying(true)
    setServerIssue(null)

    const retryTasks = []
    const addRetry = (task) => {
      try {
        retryTasks.push(Promise.resolve(typeof task === 'function' ? task() : task))
      } catch (error) {
        retryTasks.push(Promise.reject(error))
      }
    }

    window.dispatchEvent(new CustomEvent('ims:reconnect', {
      detail: { addRetry },
    }))

    try {
      if (retryTasks.length > 0) {
        await Promise.allSettled(retryTasks)
      } else {
        setServerIssue(issueBeforeRetry)
      }
    } finally {
      setIsRetrying(false)
    }
  }

  const visible = isOffline || serverIssue

  if (!visible) {
    return null
  }

  const Icon = isOffline ? WifiOff : CloudOff
  const title = isOffline ? 'Offline mode' : 'Server connection issue'
  const message = isOffline
    ? 'You appear to be offline. Previously loaded data remains available, but new changes may not save.'
    : serverIssue.message

  return (
    <div className="app-network-status" role="status" aria-live="polite">
      <Icon size={16} />
      <div>
        <strong>{title}</strong>
        <span>{message}</span>
      </div>
      <button
        type="button"
        className="button button-secondary"
        onClick={handleReconnect}
        disabled={isRetrying}
      >
        <RefreshCw size={14} className={isRetrying ? 'animate-spin' : ''} />
        {isRetrying ? 'Reconnecting...' : 'Reconnect'}
      </button>
    </div>
  )
}
