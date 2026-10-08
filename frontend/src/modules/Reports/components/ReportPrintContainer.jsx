import React from 'react'
import { formatCreditLimit, formatCurrency, formatDate } from '../../../utils/helpers'

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

function getReportSummaryTotals(reportKey, rows) {
  if (!rows || !Array.isArray(rows)) return []

  const sum = (field) => rows.reduce((total, row) => total + numeric(row[field]), 0)

  switch (reportKey) {
    case 'stock': {
      const totalUnits = rows.reduce(
        (total, row) => total + numeric(row.quantity || row.quantityAvailable || row.stockAvailable || row.stock),
        0
      )
      const totalAvailable = rows.reduce(
        (total, row) => total + numeric(row.availableQuantity || row.availableStock || row.quantityAvailable),
        0
      )
      return [
        { label: 'Total Products', value: rows.length },
        { label: 'Total Units', value: totalUnits },
        { label: 'Total Available', value: totalAvailable },
      ]
    }
    case 'sales': {
      const totalAmount = sum('totalAmount')
      return [
        { label: 'Total Orders', value: rows.length },
        { label: 'Total Sales Amount', value: formatCurrency(totalAmount) },
      ]
    }
    case 'purchases': {
      const totalAmount = sum('totalAmount')
      return [
        { label: 'Total Orders', value: rows.length },
        { label: 'Total Purchase Amount', value: formatCurrency(totalAmount) },
      ]
    }
    case 'invoices': {
      const totalAmount = sum('totalAmount')
      const paidAmount = sum('paidAmount')
      const balanceAmount = sum('balanceAmount')
      return [
        { label: 'Total Invoices', value: rows.length },
        { label: 'Total Invoice Amount', value: formatCurrency(totalAmount) },
        { label: 'Total Paid Amount', value: formatCurrency(paidAmount) },
        { label: 'Total Outstanding Balance', value: formatCurrency(balanceAmount) },
      ]
    }
    case 'customerBalances': {
      const creditLimit = sum('creditLimit')
      const outstandingBalance = sum('outstandingBalance')
      return [
        { label: 'Total Customers', value: rows.length },
        { label: 'Total Credit Limit', value: formatCreditLimit(creditLimit, 'INR') },
        { label: 'Total Outstanding Balance', value: formatCurrency(outstandingBalance) },
      ]
    }
    case 'inventoryValuation': {
      const totalQty = sum('quantityAvailable')
      const totalStockVal = sum('totalStockValue')
      return [
        { label: 'Total Items', value: rows.length },
        { label: 'Total Quantity Available', value: totalQty },
        { label: 'Total Stock Value', value: formatCurrency(totalStockVal) },
      ]
    }
    case 'lowStock': {
      const criticalCount = rows.filter((r) => r.status === 'Critical').length
      const warningCount = rows.filter((r) => r.status === 'Warning').length
      return [
        { label: 'Total Low Stock Items', value: rows.length },
        { label: 'Critical Items', value: criticalCount },
        { label: 'Warning Items', value: warningCount },
      ]
    }
    case 'fastMoving': {
      const totalSold = sum('unitsSold')
      const totalValue = sum('salesValue')
      return [
        { label: 'Total Fast Moving Items', value: rows.length },
        { label: 'Total Units Sold', value: totalSold },
        { label: 'Total Sales Value', value: formatCurrency(totalValue) },
      ]
    }
    case 'slowMoving': {
      const totalStock = sum('stockAvailable')
      const totalValue = sum('stockValue')
      return [
        { label: 'Total Slow Moving Items', value: rows.length },
        { label: 'Total Stock Available', value: totalStock },
        { label: 'Total Stock Value', value: formatCurrency(totalValue) },
      ]
    }
    case 'topCustomers': {
      const totalOrders = sum('totalOrders')
      const totalSales = sum('totalSalesValue')
      const totalOutstanding = sum('outstandingAmount')
      return [
        { label: 'Total Customers', value: rows.length },
        { label: 'Total Orders', value: totalOrders },
        { label: 'Total Sales Value', value: formatCurrency(totalSales) },
        { label: 'Total Outstanding Amount', value: formatCurrency(totalOutstanding) },
      ]
    }
    case 'topSuppliers': {
      const totalPurchases = sum('totalPurchases')
      const totalValue = sum('purchaseValue')
      const totalOutstanding = sum('outstandingPayable')
      return [
        { label: 'Total Suppliers', value: rows.length },
        { label: 'Total Purchases', value: totalPurchases },
        { label: 'Total Purchase Value', value: formatCurrency(totalValue) },
        { label: 'Total Outstanding Payable', value: formatCurrency(totalOutstanding) },
      ]
    }
    case 'profitability': {
      const salesVal = sum('salesValue')
      const costVal = sum('costValue')
      const profit = sum('grossProfit')
      return [
        { label: 'Total Products', value: rows.length },
        { label: 'Total Sales Value', value: formatCurrency(salesVal) },
        { label: 'Total Cost Value', value: formatCurrency(costVal) },
        { label: 'Total Gross Profit', value: formatCurrency(profit) },
      ]
    }
    case 'customerOutstanding': {
      const invAmount = sum('invoiceAmount')
      const paidAmount = sum('paidAmount')
      const balanceAmount = sum('balanceAmount')
      return [
        { label: 'Total Outstanding Invoices', value: rows.length },
        { label: 'Total Invoice Amount', value: formatCurrency(invAmount) },
        { label: 'Total Paid Amount', value: formatCurrency(paidAmount) },
        { label: 'Total Balance Amount', value: formatCurrency(balanceAmount) },
      ]
    }
    case 'supplierOutstanding': {
      const billAmount = sum('billAmount')
      const paidAmount = sum('paidAmount')
      const balanceAmount = sum('balanceAmount')
      return [
        { label: 'Total Outstanding Bills', value: rows.length },
        { label: 'Total Bill Amount', value: formatCurrency(billAmount) },
        { label: 'Total Paid Amount', value: formatCurrency(paidAmount) },
        { label: 'Total Balance Amount', value: formatCurrency(balanceAmount) },
      ]
    }
    case 'gstReport': {
      const outputGst = sum('outputGst')
      const inputGst = sum('inputGst')
      const netGst = sum('netGstPayable')
      return [
        { label: 'Total Months', value: rows.length },
        { label: 'Total Output GST', value: formatCurrency(outputGst) },
        { label: 'Total Input GST', value: formatCurrency(inputGst) },
        { label: 'Total Net GST Payable', value: formatCurrency(netGst) },
      ]
    }
    case 'warehousePerformance': {
      const stockVal = sum('stockValue')
      const dispatches = sum('salesDispatches')
      const receipts = sum('purchaseReceipts')
      return [
        { label: 'Total Warehouses', value: rows.length },
        { label: 'Total Stock Value', value: formatCurrency(stockVal) },
        { label: 'Total Sales Dispatches', value: dispatches },
        { label: 'Total Purchase Receipts', value: receipts },
      ]
    }
    case 'scheduledReports': {
      const enabled = rows.filter((r) => r.status === 'Enabled').length
      return [
        { label: 'Total Scheduled Reports', value: rows.length },
        { label: 'Enabled Schedules', value: enabled },
      ]
    }
    case 'forecasting': {
      return [{ label: 'Total Insights', value: rows.length }]
    }
    default:
      return [{ label: 'Total Records', value: rows.length }]
  }
}

export default function ReportPrintContainer({
  activeReport,
  activeTabLabel,
  filters,
  activeRange,
  warehousesList = [],
  categoriesList = [],
  productsList = [],
  customersList = [],
  suppliersList = [],
  columns = [],
  rows = [],
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

  const warehouseName =
    !filters.warehouse || filters.warehouse === 'all'
      ? 'All Warehouses'
      : warehousesList.find((w) => String(w.id) === String(filters.warehouse))?.name || filters.warehouse

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

  const isCustomerRelevant =
    ['sales', 'invoices', 'customerBalances', 'topCustomers', 'customerOutstanding'].includes(activeReport) ||
    filters.customer !== 'all'
  const isSupplierRelevant =
    ['purchases', 'topSuppliers', 'supplierOutstanding'].includes(activeReport) || filters.supplier !== 'all'

  const reportTitle = `${activeTabLabel || 'Inventory'} Report`.toUpperCase()
  const summaryTotals = getReportSummaryTotals(activeReport, rows)

  return (
    <div className="reports-print-container">
      {/* Brand Top Emerald Stripe */}
      <div className="print-brand-bar" />

      {/* Header section */}
      <div className="print-report-header">
        <div className="print-header-main">
          <div className="print-company-brand">
            <span className="print-brand-tag">IMS REPORT SYSTEM</span>
            <h1 className="print-report-title">{reportTitle}</h1>
          </div>
          <div className="print-header-meta">
            <span className="print-meta-badge">Generated: {generatedDate}</span>
          </div>
        </div>
      </div>

      {/* Filter Summary Card */}
      <div className="print-filter-card">
        <div className="print-filter-card-header">
          <span className="print-filter-card-title">Applied Filter Settings</span>
        </div>
        <div className="print-filter-grid">
          <div className="print-filter-item">
            <span className="print-filter-label">Report Type:</span>{' '}
            <span className="print-filter-val">{activeTabLabel || 'Stock'}</span>
          </div>
          <div className="print-filter-item">
            <span className="print-filter-label">Period:</span>{' '}
            <span className="print-filter-val">{periodLabel}</span>
          </div>
          <div className="print-filter-item">
            <span className="print-filter-label">Warehouse:</span>{' '}
            <span className="print-filter-val">{warehouseName}</span>
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

      {/* Filtered Data Table */}
      <div className="print-table-wrapper">
        <table className="print-report-table">
          <thead>
            <tr>
              {columns.map((col, idx) => (
                <th key={col.key || col.label || idx} className={col.className || ''}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows && rows.length > 0 ? (
              rows.map((row, rowIdx) => (
                <tr key={row.id || row.productId || row.soNumber || row.poNumber || rowIdx}>
                  {columns.map((col, colIdx) => (
                    <td key={col.key || col.label || colIdx} className={col.className || ''}>
                      {col.render ? col.render(row) : row[col.key] ?? '-'}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length || 1} className="print-table-empty">
                  No records found matching selected filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Summary Totals Footer Card */}
      {summaryTotals && summaryTotals.length > 0 ? (
        <div className="print-summary-card">
          <div className="print-summary-card-header">
            <span>Report Totals & Metrics Summary</span>
          </div>
          <div className="print-summary-grid">
            {summaryTotals.map((tot, idx) => (
              <div className="print-summary-stat" key={idx}>
                <span className="print-summary-label">{tot.label}:</span>{' '}
                <span className="print-summary-val">{tot.value}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
