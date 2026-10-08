import React from 'react'
import { formatCurrency, formatDate } from '../../../utils/helpers'

const QUICK_RANGES_MAP = {
  all_time: 'All Time',
  custom: 'Custom',
  today: 'Today',
  yesterday: 'Yesterday',
  last_7_days: 'Last 7 days',
  last_30_days: 'Last 30 days',
  last_3_months: 'Last 3 months',
  last_6_months: 'Last 6 months',
  last_1_year: 'Last 1 year',
}

function numeric(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function rowValue(row, keys) {
  return keys.map((key) => row[key]).find((value) => value != null && value !== '')
}

function matchesWarehouseId(row, targetWarehouseId, warehousesList = []) {
  if (!targetWarehouseId || targetWarehouseId === 'all') return true

  const targetId = String(targetWarehouseId).toLowerCase()
  const selectedWarehouse = warehousesList.find(
    (w) => String(w.id).toLowerCase() === targetId || String(w.warehouseId || '').toLowerCase() === targetId,
  )
  const targetName = selectedWarehouse ? String(selectedWarehouse.name || selectedWarehouse.warehouseName || '').toLowerCase() : ''

  const rowWhId = String(row.warehouseId ?? row.warehouse_id ?? row.whId ?? '').toLowerCase()
  const rowWhName = String(row.warehouse ?? row.warehouseName ?? row.location ?? row.whName ?? '').toLowerCase()

  if (rowWhId && rowWhId === targetId) return true
  if (rowWhName && targetName && rowWhName === targetName) return true
  if (rowWhName && rowWhName === targetId) return true
  if (targetName && rowWhId && targetId && (rowWhId.includes(targetId) || targetId.includes(rowWhId))) return true

  const items = row.items || row.products || row.orderItems || row.lines
  if (Array.isArray(items) && items.length > 0) {
    const hasItemMatch = items.some((item) => {
      const itemWhId = String(item.warehouseId ?? item.warehouse_id ?? '').toLowerCase()
      const itemWhName = String(item.warehouse ?? item.warehouseName ?? item.location ?? '').toLowerCase()
      if (itemWhId && itemWhId === targetId) return true
      if (itemWhName && targetName && itemWhName === targetName) return true
      if (itemWhName && itemWhName === targetId) return true
      return false
    })
    if (hasItemMatch) return true
  }

  const hasAnyWhProp = Boolean(rowWhId || rowWhName)
  if (hasAnyWhProp) return false

  return true
}

export default function ReportKpiPrintContainer({
  kpiKey,
  kpiTitle,
  kpiValue,
  kpiTrend,
  kpiCaption,
  filters,
  activeRange,
  warehousesList = [],
  categoriesList = [],
  productsList = [],
  customersList = [],
  suppliersList = [],
  filteredReports = {},
  allRowsByReport = {},
  summary = {},
}) {
  const now = new Date()
  const generatedDate = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  let periodLabel = QUICK_RANGES_MAP[activeRange] || 'All Time'
  if (activeRange === 'custom') {
    if (filters.from && filters.to) {
      periodLabel = `${formatDate(filters.from)} - ${formatDate(filters.to)}`
    } else if (filters.from) {
      periodLabel = `From ${formatDate(filters.from)}`
    } else if (filters.to) {
      periodLabel = `Until ${formatDate(filters.to)}`
    } else {
      periodLabel = 'Custom'
    }
  }

  const isAllWarehouses = !filters.warehouse || filters.warehouse === 'all'
  const selectedWarehouseObj = warehousesList.find((w) => String(w.id) === String(filters.warehouse))
  const selectedWarehouseName = isAllWarehouses
    ? 'All Warehouses'
    : selectedWarehouseObj?.name || filters.warehouse

  const categoryName =
    !filters.category || filters.category === 'all'
      ? 'All Categories'
      : categoriesList.find((c) => String(c.id) === String(filters.category))?.name || filters.category

  const productName =
    !filters.product || filters.product === 'all'
      ? 'All Products'
      : productsList.find((p) => String(p.id) === String(filters.product))?.name || filters.product

  const customerName =
    !filters.customer || filters.customer === 'all'
      ? 'All Customers'
      : customersList.find((c) => String(c.id) === String(filters.customer))?.name || filters.customer

  const supplierName =
    !filters.supplier || filters.supplier === 'all'
      ? 'All Suppliers'
      : suppliersList.find((s) => String(s.id) === String(filters.supplier))?.name || filters.supplier

  const statusLabel = !filters.status || filters.status === 'all' ? 'All Status' : filters.status

  const isCustomerRelevant = ['sales', 'customerBalances', 'topCustomers', 'customerOutstanding'].includes(kpiKey) || filters.customer !== 'all'
  const isSupplierRelevant = ['purchases', 'topSuppliers', 'supplierOutstanding'].includes(kpiKey) || filters.supplier !== 'all'

  const kpiReportTitle = `${kpiTitle || 'KPI'} REPORT`.toUpperCase()

  // Calculate Warehouse-wise breakdown for All Warehouses view
  const warehouseBreakdown = React.useMemo(() => {
    if (!isAllWarehouses || !warehousesList.length) return []

    return warehousesList.map((wh) => {
      const whName = wh.name
      const whId = wh.id

      switch (kpiKey) {
        case 'sales': {
          const rows = (filteredReports.sales || []).filter((r) => matchesWarehouseId(r, whId, warehousesList))
          const totalSales = rows.reduce((tot, r) => tot + numeric(r.totalAmount || r.amount || r.grandTotal || r.total), 0)
          return { warehouseName: whName, mainVal: formatCurrency(totalSales), numericVal: totalSales, subVal: `${rows.length} Orders` }
        }
        case 'purchases': {
          const rows = (filteredReports.purchases || []).filter((r) => matchesWarehouseId(r, whId, warehousesList))
          const totalPurchases = rows.reduce((tot, r) => tot + numeric(r.totalAmount || r.amount || r.grandTotal || r.total), 0)
          return { warehouseName: whName, mainVal: formatCurrency(totalPurchases), numericVal: totalPurchases, subVal: `${rows.length} Orders` }
        }
        case 'inventoryValuation': {
          const rows = (filteredReports.inventoryValuation || []).filter((r) => matchesWarehouseId(r, whId, warehousesList))
          const stockVal = rows.reduce((tot, r) => tot + numeric(r.totalStockValue), 0)
          const totalUnits = rows.reduce((tot, r) => tot + numeric(r.quantityAvailable || r.availableQuantity), 0)
          return { warehouseName: whName, mainVal: formatCurrency(stockVal), numericVal: stockVal, subVal: `${rows.length} Items (${totalUnits} Units)` }
        }
        case 'lowStock': {
          const rows = (filteredReports.lowStock || []).filter((r) => matchesWarehouseId(r, whId, warehousesList))
          const critical = rows.filter((r) => r.status === 'Critical').length
          const warning = rows.filter((r) => r.status === 'Warning').length
          const totalLow = critical + warning
          return { warehouseName: whName, mainVal: `${totalLow} Items`, numericVal: totalLow, subVal: `${critical} Critical, ${warning} Warning` }
        }
        case 'customerOutstanding': {
          const rows = (filteredReports.customerOutstanding || filteredReports.customerBalances || []).filter((r) => matchesWarehouseId(r, whId, warehousesList))
          const dues = rows.reduce((tot, r) => tot + numeric(r.balanceAmount || r.outstandingBalance || r.balance), 0)
          return { warehouseName: whName, mainVal: formatCurrency(dues), numericVal: dues, subVal: `${rows.length} Pending Invoices` }
        }
        case 'supplierOutstanding': {
          const rows = (filteredReports.supplierOutstanding || filteredReports.purchases || []).filter((r) => matchesWarehouseId(r, whId, warehousesList))
          const dues = rows.reduce((tot, r) => tot + numeric(r.balanceAmount || r.outstandingPayable || r.balance), 0)
          return { warehouseName: whName, mainVal: formatCurrency(dues), numericVal: dues, subVal: `${rows.length} Pending Bills` }
        }
        case 'profitability': {
          const salesRows = (filteredReports.sales || []).filter((r) => matchesWarehouseId(r, whId, warehousesList))
          const purchaseRows = (filteredReports.purchases || []).filter((r) => matchesWarehouseId(r, whId, warehousesList))
          const salesTotal = salesRows.reduce((tot, r) => tot + numeric(r.totalAmount || r.amount || r.grandTotal || r.total), 0)
          const purchaseTotal = purchaseRows.reduce((tot, r) => tot + numeric(r.totalAmount || r.amount || r.grandTotal || r.total), 0)
          const profit = salesTotal - purchaseTotal
          return { warehouseName: whName, mainVal: formatCurrency(profit), numericVal: profit, subVal: `Sales ${formatCurrency(salesTotal)} | Cost ${formatCurrency(purchaseTotal)}` }
        }
        case 'fastMoving': {
          const salesRows = (filteredReports.sales || []).filter((r) => matchesWarehouseId(r, whId, warehousesList))
          const prodMap = new Map()
          salesRows.forEach((sale) => {
            const items = sale.items || sale.products || sale.lines || []
            if (!items.length) {
              const name = sale.product || sale.productName || 'Sales Item'
              const qty = numeric(sale.quantity || sale.qty || 1)
              const val = numeric(sale.totalAmount || sale.total || sale.amount)
              const cur = prodMap.get(name) || { qty: 0, val: 0 }
              prodMap.set(name, { qty: cur.qty + qty, val: cur.val + val })
              return
            }
            items.forEach((item) => {
              const name = item.productName || item.product || item.name || 'Sales Item'
              const qty = numeric(item.quantity || item.qty || 1)
              const val = numeric(item.total || item.amount || item.price * qty)
              const cur = prodMap.get(name) || { qty: 0, val: 0 }
              prodMap.set(name, { qty: cur.qty + qty, val: cur.val + val })
            })
          })
          const sorted = [...prodMap.entries()].sort((a, b) => b[1].qty - a[1].qty)
          const top = sorted[0]
          return {
            warehouseName: whName,
            mainVal: top ? top[0] : 'No sales yet',
            numericVal: top ? top[1].qty : 0,
            subVal: top ? `${top[1].qty} Units (${formatCurrency(top[1].val)})` : '0 Units',
          }
        }
        default:
          return { warehouseName: whName, mainVal: '-', numericVal: 0, subVal: '-' }
      }
    })
  }, [isAllWarehouses, warehousesList, kpiKey, filteredReports])

  // Get active detailed table rows for this KPI
  const activeDetailRows = React.useMemo(() => {
    return filteredReports[kpiKey] || []
  }, [filteredReports, kpiKey])

  // Columns for detail table
  const detailColumns = React.useMemo(() => {
    switch (kpiKey) {
      case 'sales':
        return [
          { key: 'soNumber', label: 'Order No.' },
          { key: 'customer', label: 'Customer' },
          { key: 'warehouse', label: 'Warehouse' },
          { key: 'orderDate', label: 'Date', render: (r) => formatDate(r.orderDate) },
          { key: 'totalAmount', label: 'Amount', className: 'reports-table__numeric', render: (r) => formatCurrency(r.totalAmount) },
          { key: 'status', label: 'Status' },
        ]
      case 'purchases':
        return [
          { key: 'poNumber', label: 'PO No.' },
          { key: 'supplier', label: 'Supplier' },
          { key: 'warehouse', label: 'Warehouse' },
          { key: 'orderDate', label: 'Date', render: (r) => formatDate(r.orderDate) },
          { key: 'totalAmount', label: 'Amount', className: 'reports-table__numeric', render: (r) => formatCurrency(r.totalAmount) },
          { key: 'status', label: 'Status' },
        ]
      case 'inventoryValuation':
        return [
          { key: 'productName', label: 'Product' },
          { key: 'sku', label: 'SKU' },
          { key: 'category', label: 'Category' },
          { key: 'warehouse', label: 'Warehouse' },
          { key: 'quantityAvailable', label: 'Available Qty', className: 'reports-table__numeric' },
          { key: 'averageCost', label: 'Avg Cost', className: 'reports-table__numeric', render: (r) => formatCurrency(r.averageCost) },
          { key: 'totalStockValue', label: 'Total Value', className: 'reports-table__numeric', render: (r) => formatCurrency(r.totalStockValue) },
        ]
      case 'lowStock':
        return [
          { key: 'productName', label: 'Product' },
          { key: 'sku', label: 'SKU' },
          { key: 'category', label: 'Category' },
          { key: 'warehouse', label: 'Warehouse' },
          { key: 'availableStock', label: 'Available Stock', className: 'reports-table__numeric' },
          { key: 'minimumStockLevel', label: 'Min Level', className: 'reports-table__numeric' },
          { key: 'status', label: 'Status' },
        ]
      case 'customerOutstanding':
        return [
          { key: 'customerName', label: 'Customer' },
          { key: 'invoiceNumber', label: 'Invoice No.' },
          { key: 'dueDate', label: 'Due Date', render: (r) => formatDate(r.dueDate) },
          { key: 'invoiceAmount', label: 'Invoice Amount', className: 'reports-table__numeric', render: (r) => formatCurrency(r.invoiceAmount) },
          { key: 'balanceAmount', label: 'Outstanding Balance', className: 'reports-table__numeric', render: (r) => formatCurrency(r.balanceAmount) },
          { key: 'agingStatus', label: 'Aging' },
        ]
      case 'supplierOutstanding':
        return [
          { key: 'supplierName', label: 'Supplier' },
          { key: 'billNumber', label: 'Bill No.' },
          { key: 'dueDate', label: 'Due Date', render: (r) => formatDate(r.dueDate) },
          { key: 'billAmount', label: 'Bill Amount', className: 'reports-table__numeric', render: (r) => formatCurrency(r.billAmount) },
          { key: 'balanceAmount', label: 'Outstanding Balance', className: 'reports-table__numeric', render: (r) => formatCurrency(r.balanceAmount) },
          { key: 'agingStatus', label: 'Aging' },
        ]
      case 'profitability':
        return [
          { key: 'productName', label: 'Product' },
          { key: 'salesValue', label: 'Sales Revenue', className: 'reports-table__numeric', render: (r) => formatCurrency(r.salesValue) },
          { key: 'costValue', label: 'Purchase Cost', className: 'reports-table__numeric', render: (r) => formatCurrency(r.costValue) },
          { key: 'grossProfit', label: 'Gross Profit', className: 'reports-table__numeric', render: (r) => formatCurrency(r.grossProfit) },
          { key: 'profitMargin', label: 'Margin %', className: 'reports-table__numeric', render: (r) => `${numeric(r.profitMargin).toFixed(1)}%` },
          { key: 'status', label: 'Health' },
        ]
      case 'fastMoving':
        return [
          { key: 'productName', label: 'Product' },
          { key: 'sku', label: 'SKU' },
          { key: 'unitsSold', label: 'Units Sold', className: 'reports-table__numeric' },
          { key: 'salesValue', label: 'Sales Value', className: 'reports-table__numeric', render: (r) => formatCurrency(r.salesValue) },
          { key: 'stockLeft', label: 'Stock Left', className: 'reports-table__numeric' },
          { key: 'movementStatus', label: 'Movement' },
        ]
      default:
        return [
          { key: 'id', label: 'ID' },
          { key: 'name', label: 'Name' },
        ]
    }
  }, [kpiKey])

  return (
    <div className="reports-print-container kpi-print-container">
      {/* Top Brand Emerald Accent Line */}
      <div className="print-brand-bar" />

      {/* Header section */}
      <div className="print-report-header">
        <div className="print-header-main">
          <div className="print-company-brand">
            <span className="print-brand-tag">INVENTORY MANAGEMENT SYSTEM</span>
            <h1 className="print-report-title">{kpiReportTitle}</h1>
          </div>
          <div className="print-header-meta">
            <span className="print-meta-badge">Generated: {generatedDate}</span>
          </div>
        </div>
      </div>

      {/* Filter Context Card */}
      <div className="print-filter-card">
        <div className="print-filter-card-header">
          <span className="print-filter-card-title">Filter & Location Context</span>
        </div>
        <div className="print-filter-grid">
          <div className="print-filter-item">
            <span className="print-filter-label">Warehouse:</span>{' '}
            <span className="print-filter-val">{isAllWarehouses ? 'All Warehouses (Consolidated)' : selectedWarehouseName}</span>
          </div>
          <div className="print-filter-item">
            <span className="print-filter-label">Period:</span>{' '}
            <span className="print-filter-val">{periodLabel}</span>
          </div>
          <div className="print-filter-item">
            <span className="print-filter-label">Category:</span>{' '}
            <span className="print-filter-val">{categoryName}</span>
          </div>
          <div className="print-filter-item">
            <span className="print-filter-label">Product:</span>{' '}
            <span className="print-filter-val">{productName}</span>
          </div>
          {isCustomerRelevant ? (
            <div className="print-filter-item">
              <span className="print-filter-label">Customer:</span>{' '}
              <span className="print-filter-val">{customerName}</span>
            </div>
          ) : null}
          {isSupplierRelevant ? (
            <div className="print-filter-item">
              <span className="print-filter-label">Supplier:</span>{' '}
              <span className="print-filter-val">{supplierName}</span>
            </div>
          ) : null}
          <div className="print-filter-item">
            <span className="print-filter-label">Status:</span>{' '}
            <span className="print-filter-val">{statusLabel}</span>
          </div>
        </div>
      </div>

      {/* Prominent KPI Highlight Box (Green Theme) */}
      <div className="kpi-print-highlight-box">
        <div className="kpi-print-highlight-label">{isAllWarehouses ? `CONSOLIDATED ${kpiTitle.toUpperCase()}` : kpiTitle.toUpperCase()}</div>
        <div className="kpi-print-highlight-value">{kpiValue}</div>
        <div className="kpi-print-highlight-meta">
          <span>Location: <strong>{isAllWarehouses ? 'All Warehouses Consolidated' : selectedWarehouseName}</strong></span>
          {kpiTrend ? <span className="kpi-print-trend"> | Trend: {kpiTrend} ({kpiCaption})</span> : null}
        </div>
      </div>

      {/* WAREHOUSE-WISE BREAKDOWN TABLE (When Warehouse = All Warehouses) */}
      {isAllWarehouses && warehouseBreakdown.length > 0 ? (
        <div className="kpi-print-breakdown-section">
          <h2 className="kpi-print-breakdown-title">Warehouse-Wise Breakdown</h2>
          <div className="print-table-wrapper">
            <table className="print-report-table">
              <thead>
                <tr>
                  <th>Warehouse</th>
                  <th className="reports-table__numeric">{kpiTitle}</th>
                  <th>Summary / Details</th>
                </tr>
              </thead>
              <tbody>
                {warehouseBreakdown.map((row, idx) => (
                  <tr key={row.warehouseName || idx}>
                    <td><strong>{row.warehouseName}</strong></td>
                    <td className="reports-table__numeric"><strong>{row.mainVal}</strong></td>
                    <td>{row.subVal}</td>
                  </tr>
                ))}
                <tr className="kpi-print-total-row">
                  <td><strong>ALL WAREHOUSES TOTAL</strong></td>
                  <td className="reports-table__numeric"><strong>{kpiValue}</strong></td>
                  <td><strong>Consolidated Overall Total</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {/* DETAILED RELEVANT DATA TABLE */}
      <div className="kpi-print-detail-section">
        <h2 className="kpi-print-breakdown-title">
          {isAllWarehouses ? `All Warehouses Itemized ${kpiTitle} Details` : `${selectedWarehouseName} — Itemized ${kpiTitle} Details`}
        </h2>
        <div className="print-table-wrapper">
          <table className="print-report-table">
            <thead>
              <tr>
                {detailColumns.map((col, idx) => (
                  <th key={col.key || idx} className={col.className || ''}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeDetailRows && activeDetailRows.length > 0 ? (
                activeDetailRows.map((row, rowIdx) => (
                  <tr key={row.id || row.soNumber || row.poNumber || rowIdx}>
                    {detailColumns.map((col, colIdx) => (
                      <td key={col.key || colIdx} className={col.className || ''}>
                        {col.render ? col.render(row) : row[col.key] ?? '-'}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={detailColumns.length || 1} className="print-table-empty">
                    No records found matching selected warehouse and filter context.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Enterprise Footer */}
      <div className="print-footer">
        <div className="print-footer-left">
          <span>Inventory Management System — Official KPI Report ({kpiTitle})</span>
        </div>
        <div className="print-footer-right">
          <span>Generated on: {generatedDate} | Page 1 of 1</span>
        </div>
      </div>
    </div>
  )
}
