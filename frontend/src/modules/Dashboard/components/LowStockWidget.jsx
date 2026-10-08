import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import SkeletonCard from './SkeletonCard'

function isOutOfStockItem(item) {
  const stock = Number(item?.stock ?? item?.currentStock ?? item?.quantity ?? 0)
  const status = String(item?.status ?? '').trim().toLowerCase()
  return stock <= 0 || status === 'out of stock'
}

function isLowStockItem(item) {
  const stock = Number(item?.stock ?? item?.currentStock ?? item?.quantity ?? 0)
  if (stock <= 0) return false
  const reorder = Number(item?.reorderLevel ?? item?.ReorderLevel ?? 10)
  const status = String(item?.status ?? '').trim().toLowerCase()
  return stock <= reorder || status === 'low stock'
}

export default function LowStockWidget({ items = [], isLoading }) {
  const safeItems = Array.isArray(items) ? items : []
  const [activeSection, setActiveSection] = useState('low-stock')

  const lowStockItems = useMemo(
    () => safeItems.filter(isLowStockItem),
    [safeItems],
  )

  const outOfStockItems = useMemo(
    () => safeItems.filter(isOutOfStockItem),
    [safeItems],
  )

  const isLowStockActive = activeSection === 'low-stock'
  const displayItems = isLowStockActive ? lowStockItems : outOfStockItems
  const currentCount = displayItems.length
  const viewAllTo = isLowStockActive
    ? '/inventory/products?filter=low-stock'
    : '/inventory/products?filter=out-of-stock'
  const isHealthy = !isLoading && displayItems.length === 0

  return (
    <section className={`dashboard-panel low-stock-widget ${isHealthy ? 'is-healthy' : ''}`}>
      <div className="dashboard-panel__header">
        <div>
          <h2>{isLowStockActive ? 'Low Stock' : 'Out of Stock'}</h2>
        </div>
        <div className="dashboard-panel__actions">
          {displayItems.length > 0 && (
            <Link className="dashboard-panel__link" to={viewAllTo}>
              View all
            </Link>
          )}
          <strong
            className={`low-stock-widget__count ${
              isLowStockActive
                ? (lowStockItems.length > 0 ? 'is-warning' : 'is-healthy')
                : (outOfStockItems.length > 0 ? 'is-critical' : 'is-healthy')
            }`}
          >
            {currentCount}
          </strong>
        </div>
      </div>

      <div className="low-stock-widget__tabs" role="tablist" aria-label="Stock status sections">
        <button
          type="button"
          role="tab"
          aria-selected={isLowStockActive}
          className={`low-stock-widget__tab ${isLowStockActive ? 'is-active is-low-stock' : ''}`}
          onClick={() => setActiveSection('low-stock')}
        >
          <AlertTriangle size={14} className="low-stock-widget__tab-icon" />
          <span>Low Stock</span>
          <span className={`low-stock-widget__tab-badge ${lowStockItems.length > 0 ? 'is-warning' : 'is-healthy'}`}>
            {lowStockItems.length}
          </span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={!isLowStockActive}
          className={`low-stock-widget__tab ${!isLowStockActive ? 'is-active is-out-of-stock' : ''}`}
          onClick={() => setActiveSection('out-of-stock')}
        >
          <XCircle size={14} className="low-stock-widget__tab-icon" />
          <span>Out of Stock</span>
          <span className={`low-stock-widget__tab-badge ${outOfStockItems.length > 0 ? 'is-critical' : 'is-healthy'}`}>
            {outOfStockItems.length}
          </span>
        </button>
      </div>

      {isLoading ? (
        <div className="low-stock-widget__list">
          <SkeletonCard variant="row" />
          <SkeletonCard variant="row" />
          <SkeletonCard variant="row" />
        </div>
      ) : displayItems.length > 0 ? (
        <div className="low-stock-widget__list">
          {displayItems.slice(0, 50).map((item) => {
            const isZeroStock = Number(item.stock) <= 0 || item.status === 'Critical' || item.status === 'Out of Stock'
            const badgeLabel = isZeroStock ? 'Out of Stock' : (item.status && item.status !== 'Critical' ? item.status : 'Low Stock')

            return (
              <Link
                className="low-stock-row"
                key={item.id || item.sku || item.name}
                to={`/inventory/products/${item.productId || item.ProductId || item.id}`}
                title={item.name}
              >
                <span className={`low-stock-row__icon ${isZeroStock ? 'is-critical' : ''}`} aria-hidden="true">
                  {isZeroStock ? <XCircle size={16} /> : <AlertTriangle size={16} />}
                </span>
                <div>
                  <strong title={item.name}>{item.name}</strong>
                  <span>Stock: {item.stock} - Reorder Level: {item.reorderLevel}</span>
                </div>
                <span className={`low-stock-row__badge ${isZeroStock ? 'is-critical' : ''}`}>
                  {badgeLabel}
                </span>
              </Link>
            )
          })}
          <Link className="low-stock-widget__action" to="/inventory/purchases">
            Create Purchase Order
          </Link>
        </div>
      ) : (
        <div className="dashboard-empty dashboard-empty--success">
          <CheckCircle2 size={18} strokeWidth={2.5} />
          <strong>
            {isLowStockActive ? 'No low-stock products found' : 'No out-of-stock products found'}
          </strong>
          <p>
            {isLowStockActive
              ? 'All items in your catalog are healthy and above reorder levels.'
              : 'All catalog products currently have available inventory in stock.'}
          </p>
          <Link className="dashboard-empty__button" to="/inventory/products">
            Manage Catalog
          </Link>
        </div>
      )}
    </section>
  )
}
