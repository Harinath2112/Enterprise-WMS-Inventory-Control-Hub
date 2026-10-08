import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react'
import { sanitizeApiError } from '../../../api/apiClient'

export default function DashboardHeader({
  healthMessage,
  healthTone,
  isLoading,
  lowStockProducts,
  onRefresh,
  totalProducts,
  onOpenLowStockModal,
}) {
  const lowStockCount = Number(lowStockProducts) || 0
  const productCount = Number(totalProducts) || 0
  const isHealthy = (healthTone || '').toLowerCase() === 'success' || (lowStockCount === 0 && productCount > 0)
  const isCritical = (healthTone || '').toLowerCase() === 'danger'
  const statusLabel = isLoading
    ? 'Syncing'
    : (healthMessage ? sanitizeApiError(healthMessage) : (
        isHealthy
          ? 'Operations Healthy'
          : `${lowStockCount} Low Stock ${lowStockCount === 1 ? 'Item' : 'Items'}`
      ))
  const statusTone = isHealthy ? 'is-success' : isCritical ? 'is-danger' : 'is-warning'

  return (
    <header className="dashboard-hero">
      <div className="dashboard-hero__copy">
        <div className="dashboard-hero__title-row">
          <h1>Operations Dashboard</h1>
          <button
            type="button"
            className={`dashboard-status ${statusTone}`}
            onClick={onOpenLowStockModal}
            title="Click to view low stock items"
          >
            {isHealthy ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
            {statusLabel}
          </button>
        </div>
      </div>

      <div className="dashboard-hero__actions">
        <button
          type="button"
          className="dashboard-hero__refresh"
          onClick={onRefresh}
          disabled={isLoading}
        >
          <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>
    </header>
  )
}
