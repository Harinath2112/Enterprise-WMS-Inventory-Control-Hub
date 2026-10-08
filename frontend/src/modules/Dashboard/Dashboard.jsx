import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import {
  AlertTriangle,
  Boxes,
  DollarSign,
  Package,
  ShoppingCart,
  Truck,
  Users,
} from 'lucide-react'
import { getDashboardData } from '../../api/businessApi'
import { IMS_DATA_MUTATION_EVENT, sanitizeApiError } from '../../api/apiClient'
import { formatCurrency, formatDate } from '../../utils/helpers'
import ActivityTimeline from './components/ActivityTimeline'
import BusinessInsights from './components/BusinessInsights'
import DashboardChart from './components/DashboardChart'
import DashboardHeader from './components/DashboardHeader'
import LowStockWidget from './components/LowStockWidget'
import SkeletonCard from './components/SkeletonCard'
import StatCard from './components/StatCard'
import TopProductsList from './components/TopProductsList'
import LowStockAlert from '../../components/LowStockAlert/LowStockAlert'
import './Dashboard.css'

const EMPTY_DASHBOARD = {
  summary: {},
  lowStock: [],
  recentSales: [],
  topProducts: [],
  monthlySales: [],
  monthlyPurchases: [],
  recentActivities: [],
  errors: [],
}

const PRODUCT_CATALOG_UPDATED_EVENT = 'ims:product-catalog-updated'
const INVOICE_WORKFLOW_UPDATED_EVENT = 'ims:invoice-workflow-updated'

function readNumber(source, ...keys) {
  const value = keys.reduce((result, key) => (
    result === undefined ? source?.[key] : result
  ), undefined)
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function monthKey(item) {
  const year = readNumber(item, 'year', 'Year')
  const month = readNumber(item, 'month', 'Month')

  if (!year || !month) {
    return ''
  }

  return `${year}-${String(month).padStart(2, '0')}`
}

function monthLabel(key) {
  const [year, month] = key.split('-').map(Number)
  const date = new Date(year, month - 1, 1)

  if (Number.isNaN(date.getTime())) {
    return key
  }

  return date.toLocaleString('en-US', { month: 'short', year: '2-digit' })
}

function buildMonthlyTrend(monthlySales = [], monthlyPurchases = []) {
  const safeSales = Array.isArray(monthlySales) ? monthlySales : []
  const safePurchases = Array.isArray(monthlyPurchases) ? monthlyPurchases : []
  const rows = new Map()

  safeSales.forEach((item) => {
    const key = monthKey(item)
    if (!key) return
    rows.set(key, {
      month: monthLabel(key),
      sales: readNumber(item, 'totalSales', 'TotalSales'),
      purchases: rows.get(key)?.purchases ?? 0,
    })
  })

  safePurchases.forEach((item) => {
    const key = monthKey(item)
    if (!key) return
    rows.set(key, {
      month: monthLabel(key),
      sales: rows.get(key)?.sales ?? 0,
      purchases: readNumber(item, 'totalPurchases', 'TotalPurchases'),
    })
  })

  return [...rows.entries()]
    .sort(([firstKey], [secondKey]) => firstKey.localeCompare(secondKey))
    .map(([, value]) => value)
}

function getLatestValue(rows = [], ...keys) {
  const safeRows = Array.isArray(rows) ? rows : []
  const latest = safeRows.at(-1)
  return latest ? readNumber(latest, ...keys) : 0
}

function getPreviousValue(rows = [], ...keys) {
  const safeRows = Array.isArray(rows) ? rows : []
  const previous = safeRows.at(-2)
  return previous ? readNumber(previous, ...keys) : 0
}

function getTrend(current, previous) {
  if (!previous || !Number.isFinite(current) || !Number.isFinite(previous)) {
    return null
  }

  const delta = ((current - previous) / Math.abs(previous)) * 100

  if (Math.abs(delta) < 0.1) {
    return {
      direction: 'flat',
      label: 'Flat this month',
    }
  }

  return {
    direction: delta > 0 ? 'up' : 'down',
    label: `${delta > 0 ? 'Up' : 'Down'} ${Math.abs(delta).toFixed(1)}% this month`,
  }
}

function getHealthScore(totalProducts, lowStockProducts) {
  if (totalProducts <= 0) {
    return null
  }

  return Math.max(0, Math.round((1 - lowStockProducts / totalProducts) * 100))
}

function parseActivityDate(value) {
  if (!value) {
    return null
  }

  const rawValue = String(value).trim()
  const timestamp = /^\d{4}-\d{2}-\d{2}T/.test(rawValue) && !/[zZ]|[+-]\d{2}:\d{2}$/.test(rawValue)
    ? `${rawValue}Z`
    : rawValue
  const date = new Date(timestamp)

  return Number.isNaN(date.getTime()) ? null : date
}

function isCurrentMonth(value) {
  const date = parseActivityDate(value)
  if (!date) {
    return false
  }

  const now = new Date()
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()
}

function countCreatedThisMonth(activities = [], entity) {
  const safeActivities = Array.isArray(activities) ? activities : []
  const entityValue = entity.toLowerCase()

  return safeActivities.filter((activity) => {
    const haystack = `${activity.type || ''} ${activity.module || ''} ${activity.tableName || ''} ${activity.description || ''}`.toLowerCase()
    return isCurrentMonth(activity.date) && haystack.includes(entityValue) && haystack.includes('create')
  }).length
}

function formatMonthlyCreatedLabel(count) {
  return count > 0
    ? `+${count} this month`
    : '0 new this month'
}

function getInvoiceStatus(sale) {
  const value = String(
    sale.status
      || sale.invoiceStatus
      || sale.paymentStatus
      || sale.Status
      || sale.InvoiceStatus
      || sale.PaymentStatus
      || 'Completed',
  ).trim()

  return value
    ? value.toLowerCase().replace(/\b\w/g, (character) => character.toUpperCase())
    : 'Completed'
}

function getInvoiceStatusTone(status) {
  const value = String(status).toLowerCase()

  if (value.includes('partial') || value.includes('partially')) return 'warning'
  if (value.includes('paid') || value.includes('complete') || value.includes('approved')) return 'success'
  if (value.includes('pending') || value.includes('draft')) return 'warning'
  if (value.includes('cancel') || value.includes('overdue') || value.includes('failed')) return 'danger'
  return 'info'
}

function buildInsights({
  lowStockItems = [],
  lowStockProducts,
  totalProducts,
  totalSales,
  totalPurchases,
  topProducts = [],
  salesTrend,
  healthScore,
}) {
  const insights = []
  const safeLowStockItems = Array.isArray(lowStockItems) ? lowStockItems : []
  const safeTopProducts = Array.isArray(topProducts) ? topProducts : []
  const topRevenue = safeTopProducts.reduce((total, product) => total + Number(product.revenue || 0), 0)
  const leadingRevenue = Number(safeTopProducts[0]?.revenue || 0)
  const leadingShare = topRevenue > 0 ? Math.round((leadingRevenue / topRevenue) * 100) : 0

  if (lowStockProducts === 0 && totalProducts > 0) {
    insights.push({
      tone: 'success',
      title: 'Inventory healthy',
      description: 'No low-stock products are currently detected.',
    })
  } else if (lowStockProducts > 0) {
    const firstLowStockItem = safeLowStockItems.find((item) => Number(item.stock) > 0) || safeLowStockItems[0]
    insights.push({
      tone: 'warning',
      title: lowStockProducts === 1 ? 'Replenishment needed' : 'Restocking required',
      description: firstLowStockItem
        ? `${firstLowStockItem.name} is below reorder level (${firstLowStockItem.stock} on hand, reorder ${firstLowStockItem.reorderLevel}).`
        : `${lowStockProducts} products require restocking.`,
    })
  }

  if (salesTrend?.direction === 'up') {
    insights.push({
      tone: 'success',
      title: 'Sales trend improving',
      description: salesTrend.label,
    })
  } else if (salesTrend?.direction === 'down') {
    insights.push({
      tone: 'warning',
      title: 'Sales softened',
      description: salesTrend.label,
    })
  }

  if (leadingShare >= 50) {
    insights.push({
      tone: 'primary',
      title: 'Revenue concentrated',
      description: `${safeTopProducts[0]?.name || 'Top product'} contributes ${leadingShare}% of top-product revenue.`,
    })
  }

  if (totalPurchases > totalSales && totalPurchases > 0) {
    insights.push({
      tone: 'neutral',
      title: 'Procurement ahead of sales',
      description: 'Purchase value is currently higher than invoiced sales.',
    })
  }

  if (healthScore !== null && healthScore >= 90 && insights.length < 4) {
    insights.push({
      tone: 'success',
      title: 'Strong stock health',
      description: `Inventory health score is ${healthScore}%.`,
    })
  }

  return insights
}

function CompactList({ title, subtitle, items = [], emptyTitle, emptyText, viewAllTo, renderItem, ctaText, ctaTo }) {
  const safeItems = Array.isArray(items) ? items : []
  return (
    <section className="dashboard-panel compact-list">
      <div className="dashboard-panel__header">
        <div>
          {subtitle ? <span>{subtitle}</span> : null}
          <h2>{title}</h2>
        </div>
        {safeItems.length > 4 && viewAllTo && (
          <Link className="dashboard-panel__link" to={viewAllTo}>View all</Link>
        )}
      </div>

      {safeItems.length > 0 ? (
        <div className="compact-list__items">
          {safeItems.slice(0, 50).map(renderItem)}
        </div>
      ) : (
        <div className="dashboard-empty">
          <Boxes size={22} />
          <strong>{emptyTitle}</strong>
          <p>{emptyText}</p>
          {ctaText && ctaTo && (
            <Link className="dashboard-empty__button" to={ctaTo}>
              {ctaText}
            </Link>
          )}
        </div>
      )}
    </section>
  )
}

export default function Dashboard() {
  const { hasPermission } = useAuth()
  const [dashboard, setDashboard] = useState(EMPTY_DASHBOARD)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [showLowStockModal, setShowLowStockModal] = useState(false)

  const loadDashboard = useCallback(async function loadDashboard() {
    setIsLoading(true)
    setError('')

    const payload = await getDashboardData()
    setDashboard(payload)
    const firstErr = payload.errors?.[0] || ''
    setError(firstErr ? sanitizeApiError(firstErr) : '')
    setIsLoading(false)
  }, [])

  useEffect(() => {
    loadDashboard()
}, [loadDashboard])

  useEffect(() => {
    let timer = null;

    function handleCatalogUpdated() {
        clearTimeout(timer);

        timer = setTimeout(() => {
            loadDashboard();
        }, 300);
    }

    window.addEventListener(PRODUCT_CATALOG_UPDATED_EVENT, handleCatalogUpdated);
    window.addEventListener(INVOICE_WORKFLOW_UPDATED_EVENT, handleCatalogUpdated);
    window.addEventListener(IMS_DATA_MUTATION_EVENT, handleCatalogUpdated);

    return () => {
        clearTimeout(timer);

        window.removeEventListener(PRODUCT_CATALOG_UPDATED_EVENT, handleCatalogUpdated);
        window.removeEventListener(INVOICE_WORKFLOW_UPDATED_EVENT, handleCatalogUpdated);
        window.removeEventListener(IMS_DATA_MUTATION_EVENT, handleCatalogUpdated);
    };
}, [loadDashboard]);

  const monthlyTrend = useMemo(
    () => buildMonthlyTrend(dashboard.monthlySales, dashboard.monthlyPurchases),
    [dashboard.monthlyPurchases, dashboard.monthlySales],
  )

  const summary = dashboard.summary || {}
  const totalProducts = readNumber(summary, 'totalProducts', 'TotalProducts')
  const totalCustomers = readNumber(summary, 'totalCustomers', 'TotalCustomers')
  const totalSuppliers = readNumber(summary, 'totalSuppliers', 'TotalSuppliers')
  const lowStockProducts = useMemo(() => {
    if (Array.isArray(dashboard.lowStock) && dashboard.lowStock.length > 0) {
      return dashboard.lowStock.filter(
        (item) => Number(item.stock) > 0 && Number(item.stock) <= Number(item.reorderLevel ?? 10),
      ).length
    }
    return readNumber(summary, 'lowStockProducts', 'LowStockProducts')
  }, [dashboard.lowStock, summary])
  const totalSales = readNumber(summary, 'totalSales', 'TotalSales')
  const totalPurchases = readNumber(summary, 'totalPurchases', 'TotalPurchases')
  const latestMonthlyRevenue = getLatestValue(dashboard.monthlySales, 'totalSales', 'TotalSales')
  const latestMonthlyPurchases = getLatestValue(dashboard.monthlyPurchases, 'totalPurchases', 'TotalPurchases')
  const previousMonthlyRevenue = getPreviousValue(dashboard.monthlySales, 'totalSales', 'TotalSales')
  const previousMonthlyPurchases = getPreviousValue(dashboard.monthlyPurchases, 'totalPurchases', 'TotalPurchases')
  const salesTrend = getTrend(latestMonthlyRevenue, previousMonthlyRevenue)
  const purchasesTrend = getTrend(latestMonthlyPurchases, previousMonthlyPurchases)
  const healthScore = getHealthScore(totalProducts, lowStockProducts)
  const productsCreatedThisMonth = countCreatedThisMonth(dashboard.recentActivities, 'product')
  const customersCreatedThisMonth = countCreatedThisMonth(dashboard.recentActivities, 'customer')
  const suppliersCreatedThisMonth = countCreatedThisMonth(dashboard.recentActivities, 'supplier')
  const insights = buildInsights({
    lowStockItems: dashboard.lowStock,
    lowStockProducts,
    totalProducts,
    totalSales,
    totalPurchases,
    topProducts: dashboard.topProducts,
    salesTrend,
    healthScore,
  })

  return (
    <div className="page dashboard-page">
      <DashboardHeader
        healthMessage={summary?.inventoryHealthMessage}
        healthTone={summary?.inventoryHealthTone}
        isLoading={isLoading}
        lowStockProducts={lowStockProducts}
        onRefresh={loadDashboard}
        totalProducts={totalProducts}
        onOpenLowStockModal={() => setShowLowStockModal(true)}
      />

      {error ? (
        <div className="dashboard-alert page-error-banner" role="alert">
          <AlertTriangle size={18} className="dashboard-alert__icon" />
          <span>{sanitizeApiError(error)}</span>
        </div>
      ) : null}

      <section className="dashboard-kpi-grid" aria-label="Dashboard summary">
        {isLoading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            {hasPermission('products', 'view') && (
              <StatCard
                title="Products"
                value={totalProducts}
                icon={Package}
                trend={formatMonthlyCreatedLabel(productsCreatedThisMonth)}
                description="Available SKUs"
                to="/inventory/products"
                tone="primary"
                tooltip="Open the product catalog"
              />
            )}
            {hasPermission('customers', 'view') && (
              <StatCard
                title="Customers"
                value={totalCustomers}
                icon={Users}
                trend={formatMonthlyCreatedLabel(customersCreatedThisMonth)}
                description="Customer records"
                to="/people/customers"
                tone="secondary"
                tooltip="Open customer records"
              />
            )}
            {hasPermission('suppliers', 'view') && (
              <StatCard
                title="Suppliers"
                value={totalSuppliers}
                icon={Truck}
                trend={formatMonthlyCreatedLabel(suppliersCreatedThisMonth)}
                description="Supplier records"
                to="/people/suppliers"
                tone="neutral"
                tooltip="Open supplier records"
              />
            )}
            {hasPermission('products', 'view') && (
              <StatCard
                title="Low Stock"
                value={lowStockProducts}
                icon={AlertTriangle}
                trend={lowStockProducts > 0 ? `${lowStockProducts} ${lowStockProducts === 1 ? 'item' : 'items'} low stock` : 'All items in stock'}
                description="Products below threshold"
                to="/inventory/products?filter=low-stock"
                tone={lowStockProducts > 0 ? 'warning' : 'success'}
                tooltip="Open low-stock products"
              />
            )}
            {hasPermission('sales', 'view') && (
              <StatCard
                title="Sales"
                value={formatCurrency(totalSales)}
                icon={ShoppingCart}
                trend={salesTrend?.label || `${dashboard.recentSales.length} recent ${dashboard.recentSales.length === 1 ? 'invoice' : 'invoices'}`}
                trendDirection={salesTrend?.direction}
                description="Total sales"
                to="/pos/sales"
                tone="success"
                tooltip="Open sales invoices"
              />
            )}
            {hasPermission('purchases', 'view') && (
              <StatCard
                title="Purchases"
                value={formatCurrency(totalPurchases)}
                icon={DollarSign}
                trend={purchasesTrend?.label || 'Purchase orders'}
                trendDirection={purchasesTrend?.direction}
                description="Total purchases"
                to="/inventory/purchases"
                tone="warning"
                tooltip="Open purchase orders"
              />
            )}
          </>
        )}
      </section>

      <div className="dashboard-columns">
        <div className="dashboard-column">
          {(hasPermission('sales', 'view') || hasPermission('purchases', 'view')) && (
            <DashboardChart data={monthlyTrend} isLoading={isLoading} />
          )}
          {hasPermission('products', 'view') && (
            <LowStockWidget items={dashboard.lowStock} isLoading={isLoading} />
          )}
          {hasPermission('products', 'view') && (
            <TopProductsList products={dashboard.topProducts} />
          )}
        </div>

        <div className="dashboard-column">
          {hasPermission('auditLogs', 'view') && (
            <ActivityTimeline activities={dashboard.recentActivities} isLoading={isLoading} />
          )}
          {(hasPermission('products', 'view') || hasPermission('sales', 'view') || hasPermission('purchases', 'view')) && (
            <BusinessInsights insights={insights} />
          )}
          {hasPermission('sales', 'view') && (
            <CompactList
              title="Recent Sales"
              subtitle=""
              items={dashboard.recentSales}
              emptyTitle="No recent sales"
              emptyText="Recent invoice activity will appear here."
              viewAllTo="/pos/sales"
              ctaText="Create Invoice"
              ctaTo="/pos/sales/create"
              renderItem={(sale) => {
                const status = getInvoiceStatus(sale)
                const tone = getInvoiceStatusTone(status)

                return (
                  <Link
                    className="compact-list__row recent-sale-row"
                    key={sale.id || sale.invoiceNumber}
                    to={`/management/accounting/${sale.invoiceId || sale.id}`}
                  >
                    <span className="compact-list__rank">
                      <ShoppingCart size={15} />
                    </span>
                    <div className="recent-sale-row__main">
                      <span className="recent-sale-row__title">
                        <strong>{sale.invoiceNumber || 'Invoice'}</strong>
                        <small className={`invoice-status invoice-status--${tone}`}>{status}</small>
                      </span>
                      <small>{sale.customerName || 'Customer'} - {formatDate(sale.invoiceDate)}</small>
                    </div>
                    <span className="recent-sale-row__value">
                      <em>{formatCurrency(sale.totalAmount || 0)}</em>
                    </span>
                  </Link>
                )
              }}
            />
          )}
        </div>
      </div>

      {showLowStockModal && (
        <LowStockAlert
          lowStockProducts={dashboard.lowStock}
          onClose={() => {
            setShowLowStockModal(false)
            const currentIds = (dashboard.lowStock || []).map(p => p.productId || p.id).sort().join(',')
            sessionStorage.setItem('ims-low-stock-alert-dismissed-ids', currentIds)
          }}
        />
      )}
    </div>
  )
}
