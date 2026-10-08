import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  AlertTriangle,
  CalendarDays,
  Download,
  ChevronDown,
  FileSpreadsheet,
  FileText,
  IndianRupee,
  PackageSearch,
  Printer,
  ShoppingCart,
  TrendingUp,
  Trophy,
  Users,
  Warehouse,
} from 'lucide-react'
import {
  exportSalesReport,
  exportSalesReportPdf,
  exportStockReport,
  exportStockReportPdf,
  getReportFilterOptions,
  getReportsData,
} from '../../api/businessApi'
import { getCategories } from '../../api/productApi'
import ResponsiveChart from '../../components/charts/ResponsiveChart'
import DatePicker from '../../components/DatePicker'
import { DataTable, ExportMenu, StatisticsCard, StatusBadge } from '../../components/erp'
import { showToast } from '../../components/common/toast'
import { formatCreditLimit, formatCurrency, formatDate } from '../../utils/helpers'
import {
  buildCustomerOutstandingReport,
  buildFastMovingReport,
  buildForecastingReport,
  buildGstReport,
  buildInventoryValuationReport,
  buildLowStockReport,
  buildProfitabilityReport,
  buildReportsSummary,
  buildScheduledReports,
  buildSlowMovingReport,
  buildSupplierOutstandingReport,
  buildTopCustomersReport,
  buildTopSuppliersReport,
  buildWarehousePerformanceReport,
} from '../../data/reportData'
import ReportKpiPrintContainer from './components/ReportKpiPrintContainer'
import ReportPrintContainer from './components/ReportPrintContainer'
import ReportsFilterSelect from './components/ReportsFilterSelect'
import './Reports.css'

const EMPTY_REPORTS = {
  sales: [],
  purchases: [],
  invoices: [],
  stock: [],
  customerBalances: [],
  errors: [],
}

const REPORT_TABS = [
  { key: 'sales', label: 'Sales' },
  { key: 'purchases', label: 'Purchases' },
  { key: 'invoices', label: 'Invoices' },
  { key: 'stock', label: 'Stock' },
  { key: 'customerBalances', label: 'Customer Balances' },
  { key: 'inventoryValuation', label: 'Inventory Valuation' },
  { key: 'lowStock', label: 'Low Stock' },
  { key: 'fastMoving', label: 'Fast Moving' },
  { key: 'slowMoving', label: 'Slow Moving' },
  { key: 'topCustomers', label: 'Top Customers' },
  { key: 'topSuppliers', label: 'Top Suppliers' },
  { key: 'profitability', label: 'Profitability' },
  { key: 'customerOutstanding', label: 'Customer Outstanding' },
  { key: 'supplierOutstanding', label: 'Supplier Outstanding' },
  { key: 'gstReport', label: 'GST / Tax' },
  { key: 'warehousePerformance', label: 'Warehouse Performance' },
  { key: 'scheduledReports', label: 'Scheduled Reports' },
  { key: 'forecasting', label: 'Forecasting' },
]

const REPORT_TAB_GROUPS = [
  {
    label: 'Core Reports',
    tabs: ['sales', 'purchases', 'invoices', 'stock', 'customerBalances'],
  },
  {
    label: 'Inventory Analytics',
    tabs: ['inventoryValuation', 'lowStock', 'fastMoving', 'slowMoving', 'warehousePerformance'],
  },
  {
    label: 'Customers & Suppliers',
    tabs: ['topCustomers', 'topSuppliers', 'customerOutstanding', 'supplierOutstanding'],
  },
  {
    label: 'Finance & Automation',
    tabs: ['profitability', 'gstReport', 'scheduledReports', 'forecasting'],
  },
]

const QUICK_RANGES = [
  { key: 'all_time', label: 'All time' },
  { key: 'custom', label: 'Custom' },
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'last_7_days', label: 'Last 7 days' },
  { key: 'last_30_days', label: 'Last 30 days' },
  { key: 'last_3_months', label: 'Last 3 months' },
  { key: 'last_6_months', label: 'Last 6 months' },
  { key: 'last_1_year', label: 'Last 1 year' },
]

const STOCK_BAR_COLORS = ['#8b7dfb', '#7c6cf0', '#2563eb', '#4322c5', '#f59e0b', '#6446d9', '#8b7dfb', '#64748b']

function numeric(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatChartCurrency(value) {
  const amount = numeric(value)

  if (Math.abs(amount) >= 10000000) {
    return `${Number((amount / 10000000).toFixed(1))}Cr`
  }

  if (Math.abs(amount) >= 100000) {
    return `${Number((amount / 100000).toFixed(1))}L`
  }

  if (Math.abs(amount) >= 1000) {
    return `${Number((amount / 1000).toFixed(1))}k`
  }

  return String(amount)
}

function statusType(value) {
  return String(value || 'info').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function getStockHealthStatus(row) {
  const available = numeric(row.availableQuantity || row.availableStock || row.quantityAvailable || row.quantity || row.stockAvailable || row.stock)
  const minimum = numeric(row.minimumStockLevel || row.minimumStock || row.minStock || row.reorderLevel || row.lowStockLimit || 10)

  if (available <= 0) return 'Critical'
  if (available <= minimum) return 'Critical'
  if (available <= minimum + 5) return 'Warning'
  return 'Healthy'
}

function getEffectiveStatus(row) {
  return row.status || row.movementStatus || row.agingStatus || row.priority || getStockHealthStatus(row)
}

function matchesStatusFilter(row, filterValue) {
  if (!filterValue || filterValue === 'all') return true
  return String(getEffectiveStatus(row)).toLowerCase() === String(filterValue).toLowerCase()
}

function renderStatusBadge(value) {
  const label = value || 'Healthy'
  return <StatusBadge type={statusType(label)}>{label}</StatusBadge>
}

function getRowDate(row) {
  return row.orderDate || row.invoiceDate || row.billDate || row.date || row.createdAt || ''
}

function isWithinDateRange(row, filters) {
  const date = getRowDate(row)

  if (!date) return true
  if (filters.from && date < filters.from) return false
  if (filters.to && date > filters.to) return false

  return true
}

function rowValue(row, keys) {
  return keys.map((key) => row[key]).find((value) => value != null && value !== '')
}

function matchesWarehouseFilter(row, filterWarehouseId, warehousesList = [], stockList = []) {
  if (!filterWarehouseId || filterWarehouseId === 'all') return true

  const targetId = String(filterWarehouseId).toLowerCase()
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

  const prodName = String(row.productName || row.product || row.name || '').toLowerCase()
  const prodId = String(row.productId || '').toLowerCase()

  if (stockList.length > 0 && (prodName || prodId)) {
    const foundStock = stockList.find(
      (s) => (prodId && String(s.productId || s.id).toLowerCase() === prodId) ||
             (prodName && String(s.productName || s.product || s.name).toLowerCase() === prodName),
    )
    if (foundStock) {
      const stockWhId = String(foundStock.warehouseId || '').toLowerCase()
      const stockWhName = String(foundStock.warehouseName || foundStock.warehouse || '').toLowerCase()
      if (stockWhId && stockWhId === targetId) return true
      if (stockWhName && targetName && stockWhName === targetName) return true
      if (stockWhName && stockWhName === targetId) return true
      if (stockWhId || stockWhName) return false
    }
  }

  const hasAnyWhProp = Boolean(rowWhId || rowWhName)
  if (hasAnyWhProp) return false

  return true
}

function matchesEntityFilter(row, filterId, nameKeys, idKeys, entityList = []) {
  if (!filterId || filterId === 'all') return true

  const selectedEntity = entityList.find(
    (e) => String(e.id).toLowerCase() === String(filterId).toLowerCase(),
  )
  const targetId = String(filterId).toLowerCase()
  const targetName = selectedEntity ? String(selectedEntity.name).toLowerCase() : ''

  const rowId = String(rowValue(row, idKeys) || '').toLowerCase()
  const rowName = String(rowValue(row, nameKeys) || '').toLowerCase()

  if (rowId && rowId === targetId) return true
  if (rowName && targetName && rowName === targetName) return true
  if (rowName && rowName === targetId) return true

  const hasAnyProp = Boolean(rowId || rowName)
  return !hasAnyProp
}

function applyAdvancedFilters(rows, filters, reportKey, { categories = [], warehouses = [], products = [], customers = [], suppliers = [], stock = [] } = {}) {
  return rows.filter((row) => {
    const dateOk = isWithinDateRange(row, filters)
    const warehouseOk = matchesWarehouseFilter(row, filters.warehouse, warehouses, stock)
    const categoryOk = matchesEntityFilter(row, filters.category, ['category', 'categoryName', 'type'], ['categoryId', 'category_id'], categories)
    const productOk = matchesEntityFilter(row, filters.product, ['product', 'productName', 'name', 'item'], ['productId', 'product_id', 'id'], products)
    const customerOk = matchesEntityFilter(row, filters.customer, ['customer', 'customerName', 'name', 'partyName'], ['customerId', 'customer_id'], customers)
    const supplierOk = matchesEntityFilter(row, filters.supplier, ['supplier', 'supplierName', 'name', 'partyName'], ['supplierId', 'supplier_id'], suppliers)
    const statusOk = matchesStatusFilter(row, filters.status)

    if (['sales', 'invoices', 'customerBalances', 'topCustomers', 'customerOutstanding'].includes(reportKey)) {
      return dateOk && customerOk && statusOk && warehouseOk
    }

    if (['purchases', 'topSuppliers', 'supplierOutstanding'].includes(reportKey)) {
      return dateOk && supplierOk && statusOk && warehouseOk
    }

    if (['stock', 'inventoryValuation', 'lowStock', 'fastMoving', 'slowMoving', 'profitability', 'warehousePerformance'].includes(reportKey)) {
      return dateOk && warehouseOk && categoryOk && productOk && statusOk
    }

    return dateOk && statusOk && warehouseOk
  })
}

function buildTrendRows(sales, purchases) {
  const rows = new Map()

  function add(type, row) {
    const date = getRowDate(row)
    const key = date ? date.slice(0, 7) : ''

    if (!key) return

    const current = rows.get(key) ?? { month: key, sales: 0, purchases: 0 }
    rows.set(key, {
      ...current,
      [type]: current[type] + numeric(row.totalAmount || row.amount || row.grandTotal || row.total),
    })
  }

  sales.forEach((row) => add('sales', row))
  purchases.forEach((row) => add('purchases', row))

  return [...rows.values()]
    .sort((first, second) => first.month.localeCompare(second.month))
    .map((row) => ({
      ...row,
      month: new Date(`${row.month}-01`).toLocaleString('en-US', {
        month: 'short',
        year: '2-digit',
      }),
    }))
}

/**
 * Computes a real month-over-month trend % for an array of rows.
 * Compares the most recent calendar month found in data vs the one before it.
 * Returns a formatted string like "+12.5%" or "-3.2%" or "New" / "No data".
 */
function computeTrendPercent(rows, getValue) {
  if (!rows || !rows.length) return 'No data'

  // Group totals by YYYY-MM
  const byMonth = new Map()
  rows.forEach((row) => {
    const rawDate = row.orderDate || row.invoiceDate || row.date || row.createdAt || ''
    const monthKey = rawDate ? String(rawDate).slice(0, 7) : null
    if (!monthKey) return
    const val = getValue ? getValue(row) : numeric(row.totalAmount || row.amount || row.grandTotal || row.total)
    byMonth.set(monthKey, (byMonth.get(monthKey) || 0) + val)
  })

  if (byMonth.size === 0) return 'No data'

  const sortedMonths = [...byMonth.keys()].sort()
  if (sortedMonths.length === 1) return 'New'

  const current = byMonth.get(sortedMonths[sortedMonths.length - 1])
  const previous = byMonth.get(sortedMonths[sortedMonths.length - 2])

  if (!previous || previous === 0) return current > 0 ? 'New' : 'No data'

  const change = ((current - previous) / Math.abs(previous)) * 100
  const sign = change >= 0 ? '+' : ''
  return `${sign}${change.toFixed(1)}%`
}

/**
 * Derives the trend tone from a trend string.
 */
function trendTone(trendStr) {
  if (!trendStr || trendStr === 'No data' || trendStr === 'New') return 'neutral'
  if (trendStr.startsWith('+')) return 'positive'
  if (trendStr.startsWith('-')) return 'negative'
  return 'neutral'
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function toIsoDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function calculatePeriodDates(rangeKey) {
  const today = new Date()
  const start = new Date(today)

  switch (rangeKey) {
    case 'all_time':
      return { from: '', to: '' }
    case 'today':
      return { from: toIsoDate(today), to: toIsoDate(today) }
    case 'yesterday': {
      const yesterday = new Date(today)
      yesterday.setDate(today.getDate() - 1)
      return { from: toIsoDate(yesterday), to: toIsoDate(yesterday) }
    }
    case 'last_7_days':
      start.setDate(today.getDate() - 6)
      return { from: toIsoDate(start), to: toIsoDate(today) }
    case 'last_30_days':
      start.setDate(today.getDate() - 29)
      return { from: toIsoDate(start), to: toIsoDate(today) }
    case 'last_3_months':
      start.setMonth(today.getMonth() - 3)
      return { from: toIsoDate(start), to: toIsoDate(today) }
    case 'last_6_months':
      start.setMonth(today.getMonth() - 6)
      return { from: toIsoDate(start), to: toIsoDate(today) }
    case 'last_1_year':
      start.setFullYear(today.getFullYear() - 1)
      return { from: toIsoDate(start), to: toIsoDate(today) }
    default:
      return { from: '', to: '' }
  }
}

function getDateRangeLabel(filters) {
  if (!filters.from && !filters.to) return 'All dates'
  if (filters.from && filters.to) return `${formatDate(filters.from)} - ${formatDate(filters.to)}`
  if (filters.from) return `From ${formatDate(filters.from)}`
  return `Until ${formatDate(filters.to)}`
}

function csvEscape(value) {
  const text = value == null ? '' : String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function getExportValue(row, column) {
  const value = row[column.key]
  const key = String(column.key || '').toLowerCase()

  if (key.includes('date')) return value ? formatDate(value) : ''
  if (key.includes('amount') || key.includes('balance') || key.includes('limit') || key.includes('value') || key.includes('cost') || key.includes('profit') || key === 'total') return formatCurrency(value)
  if (key.includes('margin')) return `${numeric(value).toFixed(1)}%`

  return value ?? ''
}

function optionValues(rows, keys) {
  return [...new Set(rows.map((row) => rowValue(row, keys)).filter(Boolean))]
}

function getReportInsights(reportKey, rows, summary) {
  if (reportKey === 'sales') return [{ label: 'Rows', value: rows.length }, { label: 'Value', value: formatCurrency(summary.salesTotal) }]
  if (reportKey === 'purchases') return [{ label: 'Rows', value: rows.length }, { label: 'Value', value: formatCurrency(summary.purchaseTotal) }]
  if (reportKey === 'invoices') {
    const balance = rows.reduce((total, row) => total + numeric(row.balanceAmount), 0)
    return [{ label: 'Rows', value: rows.length }, { label: 'Open balance', value: formatCurrency(balance) }]
  }
  if (reportKey === 'stock') return [{ label: 'Items', value: rows.length }, { label: 'Available', value: summary.stockAvailable }]
  if (reportKey === 'inventoryValuation') {
    const totalValue = rows.reduce((total, row) => total + numeric(row.totalStockValue), 0)
    return [{ label: 'Items', value: rows.length }, { label: 'Stock Value', value: formatCurrency(totalValue) }]
  }
  if (reportKey === 'lowStock') return [{ label: 'Items', value: rows.length }, { label: 'Critical', value: rows.filter((row) => row.status === 'Critical').length }]
  if (reportKey === 'topCustomers') return [{ label: 'Customers', value: rows.length }, { label: 'Top Value', value: formatCurrency(rows[0]?.totalSalesValue || 0) }]
  if (reportKey === 'topSuppliers') return [{ label: 'Suppliers', value: rows.length }, { label: 'Top Value', value: formatCurrency(rows[0]?.purchaseValue || 0) }]
  if (reportKey === 'profitability') {
    const profit = rows.reduce((total, row) => total + numeric(row.grossProfit), 0)
    return [{ label: 'Products', value: rows.length }, { label: 'Gross Profit', value: formatCurrency(profit) }]
  }
  if (reportKey === 'gstReport') {
    const gst = rows.reduce((total, row) => total + numeric(row.netGstPayable), 0)
    return [{ label: 'Months', value: rows.length }, { label: 'Net GST', value: formatCurrency(gst) }]
  }
  if (reportKey === 'scheduledReports') return [{ label: 'Schedules', value: rows.length }, { label: 'Enabled', value: rows.filter((row) => row.status === 'Enabled').length }]

  return [{ label: 'Rows', value: rows.length }, { label: 'Report', value: 'Ready' }]
}


function normalizePdfText(value) {
  return String(value ?? '')
    .replace(/â‚¹/g, 'Rs. ')
    .replace(/[â€“â€”]/g, '-')
    .replace(/[â€œâ€]/g, '"')
    .replace(/[â€˜â€™]/g, "'")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '')
}

function escapePdfText(value) {
  return normalizePdfText(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

function wrapPdfText(value, limit = 88) {
  const text = normalizePdfText(value)
  const words = text.split(/\s+/).filter(Boolean)
  const lines = []
  let current = ''

  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word

    if (next.length > limit) {
      if (current) lines.push(current)
      current = word
    } else {
      current = next
    }
  })

  if (current) lines.push(current)
  return lines.length ? lines : ['']
}

function createPremiumKpiPdfBlob({ title, value, trend, caption, dateRangeLabel, reportLabel, rows, columns }) {
  const pageWidth = 842
  const pageHeight = 595
  const margin = 30
  const tableWidth = pageWidth - (margin * 2)
  const exportColumns = (columns || []).filter(Boolean)
  const exportRows = rows || []
  const generatedOn = new Date().toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  const safeTitle = normalizePdfText(title || 'KPI Report')
  const safeValue = normalizePdfText(value || '-')
  const safeTrend = normalizePdfText(trend || '-')
  const safeCaption = normalizePdfText(caption || '-')
  const safeDateRange = normalizePdfText(dateRangeLabel || 'All dates')
  const safeReportLabel = normalizePdfText(reportLabel || title || 'Report')

  // --- Project Theme Colors (RGB 0-1) ---
  // Primary: #6c5ce7  â†’ 0.02, 0.59, 0.41
  // Dark header: #0f172a â†’ 0.059, 0.09, 0.165
  // Header accent stripe: #6c5ce7 â†’ 0.02, 0.59, 0.41
  // Primary soft bg: #e4e2ff â†’ 0.82, 0.98, 0.90
  // Text dark: #0f172a â†’ 0.059, 0.09, 0.165
  // Text muted: #64748b â†’ 0.39, 0.46, 0.55
  // Border: #e2e8f0 â†’ 0.886, 0.91, 0.94
  // Page bg: #f8fafc â†’ 0.973, 0.98, 0.988
  // White: 1,1,1
  // Success: #16a34a â†’ 0.086, 0.64, 0.29
  // Danger:  #dc2626 â†’ 0.863, 0.15, 0.15

  const isTrendPositive = String(trend || '').trim().startsWith('+')
  const isTrendNegative = String(trend || '').trim().startsWith('-')
  const trendBg     = isTrendPositive ? [0.9, 0.99, 0.94]  : isTrendNegative ? [1, 0.93, 0.93]  : [0.95, 0.97, 0.99]
  const trendBorder = isTrendPositive ? [0.73, 0.94, 0.80]  : isTrendNegative ? [0.97, 0.77, 0.77]  : [0.83, 0.88, 0.94]
  const trendColor  = isTrendPositive ? [0.058, 0.56, 0.25] : isTrendNegative ? [0.78, 0.10, 0.10] : [0.39, 0.46, 0.55]

  const pages = []
  let commands = []
  let pageNumber = 0

  const add = (command) => commands.push(command)
  const rgb = (r, g, b) => add(`${r} ${g} ${b} rg`)
  const strokeRgb = (r, g, b) => add(`${r} ${g} ${b} RG`)
  const rectFill = (x, y, width, height, color) => {
    rgb(...color)
    add(`${x} ${y} ${width} ${height} re f`)
  }
  const rectStroke = (x, y, width, height, color, lineWidth = 1) => {
    strokeRgb(...color)
    add(`${lineWidth} w`)
    add(`${x} ${y} ${width} ${height} re S`)
  }
  const line = (x1, y1, x2, y2, color = [0.88, 0.91, 0.95], width = 1) => {
    strokeRgb(...color)
    add(`${width} w`)
    add(`${x1} ${y1} m ${x2} ${y2} l S`)
  }
  const text = (valueToWrite, x, y, size = 9, font = 'F1', color = [0.15, 0.19, 0.27]) => {
    rgb(...color)
    add('BT')
    add(`/${font} ${size} Tf`)
    add(`1 0 0 1 ${x} ${y} Tm (${escapePdfText(valueToWrite)}) Tj`)
    add('ET')
  }
  const textLines = (lines, x, y, size = 8, font = 'F1', color = [0.15, 0.19, 0.27], lineHeight = size + 2) => {
    lines.forEach((lineText, index) => {
      text(lineText, x, y - (index * lineHeight), size, font, color)
    })
  }
  const truncate = (input) => normalizePdfText(input)
  const charsForWidth = (width, fontSize = 7.2) => Math.max(8, Math.floor((width - 12) / (fontSize * 0.52)))
  const wrapCell = (valueToWrap, width, fontSize = 7.2) => {
    const limit = charsForWidth(width, fontSize)
    const clean = normalizePdfText(valueToWrap || '-')
    const lines = []

    clean.split(/\s+/).filter(Boolean).forEach((word) => {
      if (word.length > limit) {
        if (!lines.length || lines[lines.length - 1]) {
          // split long IDs/numbers without hiding content
          const parts = word.match(new RegExp(`.{1,${limit}}`, 'g')) || [word]
          parts.forEach((part) => lines.push(part))
        }
        return
      }

      const last = lines[lines.length - 1] || ''
      const next = last ? `${last} ${word}` : word

      if (next.length > limit) {
        lines.push(word)
      } else if (lines.length) {
        lines[lines.length - 1] = next
      } else {
        lines.push(next)
      }
    })

    return lines.length ? lines : ['-']
  }

  const finishPage = () => {
    if (!commands.length) return
    pages.push(commands.join('\n'))
    commands = []
  }

  const startPage = ({ firstPage = false, sectionTitle = '' } = {}) => {
    if (commands.length) finishPage()
    pageNumber += 1

    // Page background â€” clean off-white
    rectFill(0, 0, pageWidth, pageHeight, [0.973, 0.98, 0.988])

    // Header bar â€” deep navy matching project dark surface
    rectFill(0, pageHeight - 62, pageWidth, 62, [0.059, 0.09, 0.165])

    // Header bottom accent stripe â€” project primary teal
    rectFill(0, pageHeight - 64, pageWidth, 4, [0.02, 0.59, 0.41])

    // Header texts
    text('IMS REPORTS', margin, pageHeight - 22, 7.5, 'F2', [0.02, 0.59, 0.41])
    text(`${safeTitle} KPI Report`, margin, pageHeight - 44, 16, 'F2', [1, 1, 1])
    text(`Generated: ${generatedOn}`, pageWidth - 240, pageHeight - 23, 7.5, 'F1', [0.72, 0.80, 0.90])
    text(`Date Range: ${safeDateRange}`, pageWidth - 240, pageHeight - 40, 7.5, 'F1', [0.72, 0.80, 0.90])

    if (firstPage) {
      // KPI hero card â€” white with soft border
      rectFill(margin, 456, tableWidth, 76, [1, 1, 1])
      rectStroke(margin, 456, tableWidth, 76, [0.886, 0.91, 0.94], 0.8)
      // Left teal accent bar
      rectFill(margin, 456, 5, 76, [0.02, 0.59, 0.41])

      // KPI title and value
      text(safeTitle, margin + 16, 508, 9.5, 'F2', [0.39, 0.46, 0.55])
      text(safeValue, margin + 16, 480, 24, 'F2', [0.059, 0.09, 0.165])

      // Trend badge â€” dynamically colored: green for +, red for -, neutral for unknown
      rectFill(pageWidth - 210, 491, 152, 30, trendBg)
      rectStroke(pageWidth - 210, 491, 152, 30, trendBorder, 0.8)
      text('TREND', pageWidth - 204, 511, 6.5, 'F2', trendColor)
      text(`${safeTrend}`, pageWidth - 204, 498, 11, 'F2', trendColor)

      // Caption
      textLines(wrapCell(safeCaption, tableWidth - 260, 8.5), margin + 16, 464, 8.5, 'F1', [0.39, 0.46, 0.55], 9.5)

      // Info cards row
      const cardWidth = (tableWidth - 24) / 3
      const infoTop = 388
        ;[
          ['Linked Report', safeReportLabel],
          ['Records Included', String(exportRows.length)],
          ['Export Type', 'Complete KPI PDF'],
        ].forEach(([label, infoValue], index) => {
          const x = margin + index * (cardWidth + 12)
          rectFill(x, infoTop, cardWidth, 54, [1, 1, 1])
          rectStroke(x, infoTop, cardWidth, 54, [0.886, 0.91, 0.94], 0.8)
          // Small teal top line
          rectFill(x, infoTop + 50, cardWidth, 4, [0.02, 0.59, 0.41])
          text(label, x + 12, infoTop + 33, 7.5, 'F2', [0.39, 0.46, 0.55])
          textLines(wrapCell(infoValue, cardWidth - 24, 9.2), x + 12, infoTop + 17, 9.2, 'F2', [0.059, 0.09, 0.165], 10)
        })

      text('Complete Report Data', margin, 358, 13, 'F2', [0.059, 0.09, 0.165])
      text('All available rows and all report columns are included. Wide reports continue in column sections.', margin, 342, 8.5, 'F1', [0.39, 0.46, 0.55])
      return 314
    }

    text(sectionTitle || 'Complete Report Data', margin, pageHeight - 84, 12, 'F2', [0.059, 0.09, 0.165])
    return pageHeight - 114
  }

  const drawFooter = () => {
    // Footer bar â€” subtle neutral
    rectFill(margin, 22, tableWidth, 28, [0.94, 0.96, 0.98])
    rectStroke(margin, 22, tableWidth, 28, [0.886, 0.91, 0.94], 0.6)
    text('This file was generated from IMS Reports KPI dashboard.', margin + 10, 33, 7.5, 'F1', [0.39, 0.46, 0.55])
    text(`Page ${pageNumber}`, pageWidth - 75, 33, 7.5, 'F2', [0.059, 0.09, 0.165])
  }

  const getColumnPdfWeight = (column) => {
    const key = String(column?.key || '').toLowerCase()
    const label = String(column?.label || '').toLowerCase()

    if (key === 'ponumber' || label.includes('po no')) return 2.4
    if (key.includes('number') || label.includes('number')) return 1.5
    if (key.includes('date')) return 1.15
    if (key.includes('amount') || key.includes('total') || key.includes('value') || key.includes('balance') || key.includes('cost')) return 1.25
    if (key.includes('status')) return 0.95
    if (key.includes('supplier') || key.includes('customer') || key.includes('product')) return 1.65
    return 1.15
  }

  const makeColumnSections = () => {
    if (!exportColumns.length) return [[]]
    const sections = []
    let current = []
    let weight = 0
    const maxWeight = 7.2

    exportColumns.forEach((column) => {
      const columnWeight = getColumnPdfWeight(column)
      if (current.length && weight + columnWeight > maxWeight) {
        sections.push(current)
        current = []
        weight = 0
      }
      current.push(column)
      weight += columnWeight
    })

    if (current.length) sections.push(current)
    return sections
  }

  const columnSections = makeColumnSections()

  if (!exportColumns.length) {
    let y = startPage({ firstPage: true })
    rectFill(margin, y - 48, tableWidth, 48, [1, 1, 1])
    rectStroke(margin, y - 48, tableWidth, 48, [0.886, 0.91, 0.94], 1)
    text('No detailed rows are available for this KPI with the current filters.', margin + 12, y - 25, 9, 'F1', [0.39, 0.46, 0.55])
    drawFooter()
    finishPage()
  } else if (!exportRows.length) {
    let y = startPage({ firstPage: true })
    rectFill(margin, y - 48, tableWidth, 48, [1, 1, 1])
    rectStroke(margin, y - 48, tableWidth, 48, [0.886, 0.91, 0.94], 1)
    text('No rows are available for this KPI with the current filters.', margin + 12, y - 25, 9, 'F1', [0.39, 0.46, 0.55])
    drawFooter()
    finishPage()
  } else {
    columnSections.forEach((sectionColumns, sectionIndex) => {
      let y = startPage({
        firstPage: sectionIndex === 0,
        sectionTitle: `Complete Report Data - Columns ${sectionIndex + 1} of ${columnSections.length}`,
      })
      const sectionTitle = columnSections.length > 1
        ? `Column Section ${sectionIndex + 1} of ${columnSections.length}`
        : 'Report Table'
      text(sectionTitle, margin, y + 8, 9.5, 'F2', [0.059, 0.09, 0.165])

      const weights = sectionColumns.map(getColumnPdfWeight)
      const totalWeight = weights.reduce((total, weight) => total + weight, 0) || 1
      const widths = weights.map((weight) => (tableWidth * weight) / totalWeight)
      const starts = widths.reduce((acc, width, index) => {
        acc.push(index === 0 ? margin : acc[index - 1] + widths[index - 1])
        return acc
      }, [])
      const headerHeight = 26
      const headerY = () => y
      const drawHeader = () => {
        // Table header â€” very subtle navy tint (not mint-green)
        rectFill(margin, y, tableWidth, headerHeight, [0.235, 0.298, 0.416])
        sectionColumns.forEach((column, index) => {
          const x = starts[index]
          if (index > 0) line(x, y, x, y + headerHeight, [0.35, 0.41, 0.53], 0.7)
          textLines(wrapCell(column.label, widths[index], 7.4).slice(0, 2), x + 6, y + 15, 7.5, 'F2', [1, 1, 1], 8)
        })
        y -= headerHeight
      }

      drawHeader()

      exportRows.forEach((row, rowIndex) => {
        const cellLines = sectionColumns.map((column, columnIndex) => wrapCell(getExportValue(row, column), widths[columnIndex], 7.1))
        const maxLines = Math.max(1, ...cellLines.map((lines) => lines.length))
        const rowHeight = Math.max(23, (maxLines * 8.2) + 10)

        if (y - rowHeight < 62) {
          drawFooter()
          y = startPage({ sectionTitle: `${sectionTitle} continued` })
          drawHeader()
        }

        // Alternating rows: white and very light slate
        rectFill(margin, y - rowHeight, tableWidth, rowHeight, rowIndex % 2 === 0 ? [1, 1, 1] : [0.973, 0.976, 0.984])
        line(margin, y - rowHeight, margin + tableWidth, y - rowHeight, [0.886, 0.91, 0.94], 0.5)

        sectionColumns.forEach((column, columnIndex) => {
          const x = starts[columnIndex]
          if (columnIndex > 0) line(x, y - rowHeight, x, y, [0.90, 0.92, 0.95], 0.5)
          textLines(cellLines[columnIndex], x + 6, y - 12, 7.1, 'F1', [0.15, 0.20, 0.30], 8.2)
        })

        y -= rowHeight
      })

      // Table outer border
      rectStroke(margin, y, tableWidth, headerY() - y + headerHeight, [0.78, 0.83, 0.90], 0.8)
      drawFooter()
      finishPage()
    })
  }

  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    `2 0 obj\n<< /Type /Pages /Kids [${pages.map((_, index) => `${3 + index} 0 R`).join(' ')}] /Count ${pages.length} >>\nendobj\n`,
  ]

  pages.forEach((stream, index) => {
    const pageObjectId = 3 + index
    const contentObjectId = 3 + pages.length + index
    objects.push(`${pageObjectId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${3 + pages.length * 2} 0 R /F2 ${4 + pages.length * 2} 0 R >> >> /Contents ${contentObjectId} 0 R >>\nendobj\n`)
  })

  pages.forEach((stream, index) => {
    const contentObjectId = 3 + pages.length + index
    objects.push(`${contentObjectId} 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`)
  })

  objects.push(`${3 + pages.length * 2} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`)
  objects.push(`${4 + pages.length * 2} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n`)

  let pdf = '%PDF-1.4\n'
  const offsets = [0]

  objects.forEach((object) => {
    offsets.push(pdf.length)
    pdf += object
  })

  const xrefOffset = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n`
  pdf += '0000000000 65535 f \n'
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`
  })
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`

  return new Blob([pdf], { type: 'application/pdf' })
}
function getSafeFilename(value) {
  return String(value || 'report')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'report'
}

function buildKpiPdfLines({ title, value, trend, caption, dateRangeLabel, reportLabel, rows, columns }) {
  const exportColumns = (columns || []).slice(0, 5)
  const sampleRows = (rows || []).slice(0, 12)
  const lines = [
    `KPI: ${title}`,
    `Value: ${value}`,
    `Trend: ${trend || '-'}`,
    `Details: ${caption || '-'}`,
    `Date Range: ${dateRangeLabel || 'All dates'}`,
    `Linked Report: ${reportLabel || title}`,
    `Records Included: ${(rows || []).length}`,
  ]

  if (sampleRows.length && exportColumns.length) {
    lines.push('', 'Sample report data:')
    lines.push(exportColumns.map((column) => column.label).join(' | '))

    sampleRows.forEach((row, index) => {
      lines.push(
        `${index + 1}. ${exportColumns
          .map((column) => getExportValue(row, column))
          .join(' | ')}`,
      )
    })
  } else {
    lines.push('', 'No detailed rows are available for this KPI with the current filters.')
  }

  return lines
}

function SummaryCard({ title, value, caption, icon: Icon, trend, tone = 'neutral', onClick, onDownload, loading }) {
  return (
    <div className="reports-kpi-tile">
      <button type="button" className="reports-kpi-button" onClick={onClick}>
        <StatisticsCard
          icon={Icon}
          label={title}
          value={loading ? '...' : value}
          helper={
            <span className={`reports-kpi-helper reports-kpi-helper--${tone}`}>
              <strong>{loading ? '...' : trend}</strong>
              <span>{caption}</span>
            </span>
          }
          className="stat-card"
        />
      </button>

      <button
        type="button"
        className="reports-kpi-download-btn"
        title={`Print ${title} KPI Report`}
        aria-label={`Print ${title} KPI Report`}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          onDownload?.()
        }}
      >
        <Printer size={14} strokeWidth={2.4} />
      </button>
    </div>
  )
}

export default function Reports({ data = {} }) {
  const [reports, setReports] = useState(EMPTY_REPORTS)
  const [activeReport, setActiveReport] = useState('sales')
  const [filters, setFilters] = useState({
    from: '',
    to: '',
    warehouse: 'all',
    category: 'all',
    product: 'all',
    customer: 'all',
    supplier: 'all',
    reportType: 'sales',
    status: 'all',
  })
  const [activeRange, setActiveRange] = useState('all_time')
  const [isLoading, setIsLoading] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const [isExportingStock, setIsExportingStock] = useState(false)
  const [isExportingSalesPdf, setIsExportingSalesPdf] = useState(false)
  const [isExportingStockPdf, setIsExportingStockPdf] = useState(false)
  const [isPeriodMenuOpen, setIsPeriodMenuOpen] = useState(false)
  const [error, setError] = useState('')
  const [retryTrigger, setRetryTrigger] = useState(0)
  const [activeKpiPrint, setActiveKpiPrint] = useState(null)
  const periodMenuRef = useRef(null)

  useEffect(() => {
    if (!activeKpiPrint) return undefined

    const timer = setTimeout(() => {
      window.print()
    }, 150)

    function handleAfterPrint() {
      setActiveKpiPrint(null)
    }

    window.addEventListener('afterprint', handleAfterPrint)

    return () => {
      clearTimeout(timer)
      window.removeEventListener('afterprint', handleAfterPrint)
    }
  }, [activeKpiPrint])

  function handlePrintKpiCard({ title, value, trend, caption, reportKey }) {
    setActiveKpiPrint({
      title,
      value,
      trend,
      caption,
      reportKey,
    })
  }

  // API Filter options state
  const [filterOptionsData, setFilterOptionsData] = useState({
    warehouses: [],
    categories: [],
    products: [],
    customers: [],
    suppliers: [],
  })

  // Categories loading states
  const [categories, setCategories] = useState([])
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(false)
  const [categoriesError, setCategoriesError] = useState('')

  // Load filter options & categories
  useEffect(() => {
    let isMounted = true

    async function loadFilterOptions() {
      setIsCategoriesLoading(true)
      setCategoriesError('')
      try {
        const [catRes, filtersRes] = await Promise.allSettled([
          getCategories(),
          getReportFilterOptions(),
        ])

        if (!isMounted) return

        if (catRes.status === 'fulfilled' && catRes.value?.success) {
          setCategories(catRes.value.data || [])
        }
        if (filtersRes.status === 'fulfilled' && filtersRes.value) {
          setFilterOptionsData(filtersRes.value)
        }
      } catch (err) {
        if (!isMounted) return
        setCategoriesError('Failed to load filter options')
      } finally {
        if (isMounted) setIsCategoriesLoading(false)
      }
    }

    loadFilterOptions()

    return () => {
      isMounted = false
    }
  }, [retryTrigger])

  // Load / Refresh Reports data whenever filters, activeRange, or retryTrigger changes
  useEffect(() => {
    let isMounted = true

    if (activeRange === 'custom') {
      if (!filters.from || !filters.to) {
        return
      }
      if (filters.from > filters.to) {
        return
      }
    }

    async function load() {
      setIsLoading(true)
      setError('')
      try {
        const payload = await getReportsData(filters)
        if (!isMounted) return
        if (payload) {
          setReports({ ...EMPTY_REPORTS, ...payload })
          setError(payload.errors?.[0] ?? '')
        }
      } catch (err) {
        if (!isMounted) return
        setError('Failed to fetch report data.')
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    load()

    return () => {
      isMounted = false
    }
  }, [filters, activeRange, retryTrigger])

  function handleRetry() {
    setError('')
    setCategoriesError('')
    setRetryTrigger((prev) => prev + 1)
  }

  useEffect(() => {
    if (!isPeriodMenuOpen) return undefined

    function handlePointerDown(event) {
      if (!periodMenuRef.current?.contains(event.target)) setIsPeriodMenuOpen(false)
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') setIsPeriodMenuOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isPeriodMenuOpen])

  const projectData = useMemo(() => ({
    products: reports.stock || [],
    stock: reports.stock || [],
    sales: reports.sales || [],
    purchases: reports.purchases || [],
    customers: reports.customerBalances || [],
    suppliers: reports.errors?.length ? [] : (data.suppliers || []),
    warehouses: reports.errors?.length ? [] : (data.warehouses || []),
    returns: reports.errors?.length ? [] : (data.returns || []),
    invoices: reports.invoices || [],
    accountingInvoices: reports.invoices || [],
  }), [data, reports])

  const erpReports = useMemo(() => {
    const inventoryValuation = buildInventoryValuationReport(projectData)
    const lowStock = buildLowStockReport(projectData)
    const fastMoving = buildFastMovingReport(projectData)
    const slowMoving = buildSlowMovingReport(projectData)
    const topCustomers = buildTopCustomersReport(projectData)
    const topSuppliers = buildTopSuppliersReport(projectData)
    const profitability = buildProfitabilityReport(projectData)
    const customerOutstanding = buildCustomerOutstandingReport(projectData)
    const supplierOutstanding = buildSupplierOutstandingReport(projectData)
    const gstReport = buildGstReport(projectData)
    const warehousePerformance = buildWarehousePerformanceReport(projectData)
    const scheduledReports = buildScheduledReports(projectData)
    const forecasting = buildForecastingReport(projectData)
    const summary = buildReportsSummary(projectData)

    return {
      inventoryValuation,
      lowStock,
      fastMoving,
      slowMoving,
      topCustomers,
      topSuppliers,
      profitability,
      customerOutstanding,
      supplierOutstanding,
      gstReport,
      warehousePerformance,
      scheduledReports,
      forecasting,
      summary,
    }
  }, [projectData])

  const allRowsByReport = useMemo(() => ({
    sales: reports.sales || [],
    purchases: reports.purchases || [],
    invoices: reports.invoices || [],
    stock: reports.stock || [],
    customerBalances: reports.customerBalances || [],
    inventoryValuation: reports.inventoryValuation?.length ? reports.inventoryValuation : erpReports.inventoryValuation,
    lowStock: reports.lowStock?.length ? reports.lowStock : erpReports.lowStock,
    fastMoving: reports.fastMoving?.length ? reports.fastMoving : erpReports.fastMoving,
    slowMoving: reports.slowMoving?.length ? reports.slowMoving : erpReports.slowMoving,
    topCustomers: reports.topCustomers?.length ? reports.topCustomers : erpReports.topCustomers,
    topSuppliers: reports.topSuppliers?.length ? reports.topSuppliers : erpReports.topSuppliers,
    profitability: reports.profitability?.length ? reports.profitability : erpReports.profitability,
    customerOutstanding: reports.customerOutstanding?.length ? reports.customerOutstanding : erpReports.customerOutstanding,
    supplierOutstanding: reports.supplierOutstanding?.length ? reports.supplierOutstanding : erpReports.supplierOutstanding,
    gstReport: reports.gstReport?.length ? reports.gstReport : erpReports.gstReport,
    warehousePerformance: reports.warehousePerformance?.length ? reports.warehousePerformance : erpReports.warehousePerformance,
    scheduledReports: erpReports.scheduledReports,
    forecasting: reports.forecasting?.length ? reports.forecasting : erpReports.forecasting,
  }), [erpReports, reports])

  // Clean, unique lists of options from data to map IDs to labels
  function getUniqueById(array, getId) {
    const seen = new Set()
    return array.filter((item) => {
      const id = getId(item)
      if (!id || seen.has(id)) return false
      seen.add(id)
      return true
    })
  }

  const warehousesList = useMemo(() => {
    if (filterOptionsData.warehouses.length > 0) return filterOptionsData.warehouses
    const raw = projectData.warehouses || []
    return getUniqueById(raw, (w) => w.warehouseId || w.id).map((w) => ({
      id: w.warehouseId || w.id,
      name: w.name || w.warehouseName || 'Unknown Warehouse',
    }))
  }, [filterOptionsData.warehouses, projectData.warehouses])

  const productsList = useMemo(() => {
    if (filterOptionsData.products.length > 0) return filterOptionsData.products
    const raw = projectData.products || []
    return getUniqueById(raw, (p) => p.productId || p.id).map((p) => ({
      id: p.productId || p.id,
      name: p.name || p.productName || p.product || 'Unknown Product',
    }))
  }, [filterOptionsData.products, projectData.products])

  const customersList = useMemo(() => {
    if (filterOptionsData.customers.length > 0) return filterOptionsData.customers
    const raw = projectData.customers || []
    return getUniqueById(raw, (c) => c.customerId || c.id).map((c) => ({
      id: c.customerId || c.id,
      name: c.name || c.customerName || c.customer || 'Unknown Customer',
    }))
  }, [filterOptionsData.customers, projectData.customers])

  const suppliersList = useMemo(() => {
    if (filterOptionsData.suppliers.length > 0) return filterOptionsData.suppliers
    const raw = projectData.suppliers || []
    return getUniqueById(raw, (s) => s.supplierId || s.id).map((s) => ({
      id: s.supplierId || s.id,
      name: s.name || s.supplierName || s.supplier || 'Unknown Supplier',
    }))
  }, [filterOptionsData.suppliers, projectData.suppliers])

  const categoriesList = useMemo(() => {
    if (filterOptionsData.categories.length > 0) return filterOptionsData.categories
    const raw = categories || []
    return getUniqueById(raw, (c) => c.id).map((c) => ({
      id: c.id,
      name: c.name || 'Unknown Category',
    }))
  }, [filterOptionsData.categories, categories])

  const filteredReports = useMemo(() => {
    return Object.fromEntries(
      Object.entries(allRowsByReport).map(([key, rows]) => [
        key,
        applyAdvancedFilters(rows || [], filters, key, {
          categories: categoriesList,
          warehouses: warehousesList,
          products: productsList,
          customers: customersList,
          suppliers: suppliersList,
          stock: reports.stock || [],
        }),
      ]),
    )
  }, [allRowsByReport, filters, categoriesList, warehousesList, productsList, customersList, suppliersList, reports.stock])

  const summary = useMemo(() => {
    const apiSummary = reports.summary || {}
    const salesTotal = apiSummary.totalSales != null ? numeric(apiSummary.totalSales) : filteredReports.sales.reduce((total, row) => total + numeric(row.totalAmount || row.amount || row.grandTotal || row.total), 0)
    const purchaseTotal = apiSummary.totalPurchases != null ? numeric(apiSummary.totalPurchases) : filteredReports.purchases.reduce((total, row) => total + numeric(row.totalAmount || row.amount || row.grandTotal || row.total), 0)
    const balanceTotal = filteredReports.customerBalances.reduce((total, row) => total + numeric(row.outstandingBalance || row.balance || row.balanceAmount), 0)
    const stockAvailable = filteredReports.stock.reduce((total, row) => total + numeric(row.availableQuantity || row.availableStock || row.quantity), 0)

    const totalInventoryValue = apiSummary.totalInventoryValue != null ? numeric(apiSummary.totalInventoryValue) : filteredReports.inventoryValuation.reduce((total, row) => total + numeric(row.totalStockValue), 0)
    const lowStockItems = apiSummary.lowStockItems != null ? numeric(apiSummary.lowStockItems) : filteredReports.lowStock.filter((row) => row.status === 'Critical' || row.status === 'Warning').length
    const outstandingReceivables = apiSummary.outstandingReceivables != null ? numeric(apiSummary.outstandingReceivables) : (balanceTotal || filteredReports.customerOutstanding.reduce((total, row) => total + numeric(row.balanceAmount), 0))
    const outstandingPayables = apiSummary.outstandingPayables != null ? numeric(apiSummary.outstandingPayables) : filteredReports.supplierOutstanding.reduce((total, row) => total + numeric(row.balanceAmount), 0)
    const grossProfit = apiSummary.grossProfit != null ? numeric(apiSummary.grossProfit) : (salesTotal - purchaseTotal)
    const topSellingItem = apiSummary.topSellingItem || filteredReports.fastMoving[0]?.productName || 'No sales yet'

    return {
      salesTotal,
      purchaseTotal,
      balanceTotal,
      stockAvailable,
      totalInventoryValue,
      lowStockItems,
      outstandingReceivables,
      outstandingPayables,
      grossProfit,
      topSellingItem,
    }
  }, [filteredReports, reports.summary])

  const filterOptions = useMemo(() => ({
    statuses: [...new Set(Object.values(allRowsByReport).flat().map(getEffectiveStatus).filter(Boolean))],
  }), [allRowsByReport])

  const warehouseOptions = useMemo(() => [
    { value: 'all', label: 'All Warehouses' },
    ...warehousesList.map((w) => ({ value: String(w.id), label: w.name })),
  ], [warehousesList])

  const categoryOptions = useMemo(() => [
    { value: 'all', label: 'All Categories' },
    ...categoriesList.map((c) => ({ value: String(c.id), label: c.name })),
  ], [categoriesList])

  const productOptions = useMemo(() => [
    { value: 'all', label: 'All Products' },
    ...productsList.map((p) => ({ value: String(p.id), label: p.name })),
  ], [productsList])

  const customerOptions = useMemo(() => [
    { value: 'all', label: 'All Customers' },
    ...customersList.map((c) => ({ value: String(c.id), label: c.name })),
  ], [customersList])

  const supplierOptions = useMemo(() => [
    { value: 'all', label: 'All Suppliers' },
    ...suppliersList.map((s) => ({ value: String(s.id), label: s.name })),
  ], [suppliersList])

  const reportTypeOptions = useMemo(() => [
    ...REPORT_TABS.map((tab) => ({ value: tab.key, label: tab.label })),
  ], [])

  const statusOptions = useMemo(() => [
    { value: 'all', label: 'All Status' },
    ...filterOptions.statuses.map((v) => ({ value: v, label: v })),
  ], [filterOptions.statuses])

  const transactionTrend = useMemo(
    () => (reports.transactionTrend?.length ? reports.transactionTrend : buildTrendRows(filteredReports.sales, filteredReports.purchases)),
    [reports.transactionTrend, filteredReports.purchases, filteredReports.sales],
  )

  // Real month-over-month KPI trends computed from actual data
  const kpiTrends = useMemo(() => {
    const rowTotal = (row) => numeric(row.totalAmount || row.amount || row.grandTotal || row.total)

    const salesTrend = computeTrendPercent(filteredReports.sales, rowTotal)
    const purchaseTrend = computeTrendPercent(filteredReports.purchases, rowTotal)

    const invTrend = computeTrendPercent(
      filteredReports.inventoryValuation.map((row) => ({
        orderDate: row.lastPurchaseDate || '',
        totalAmount: row.totalStockValue || 0,
      })),
      rowTotal,
    )

    const recTrend = computeTrendPercent(
      filteredReports.customerBalances.map((row) => ({
        orderDate: row.orderDate || row.date || row.createdAt || '',
        totalAmount: numeric(row.outstandingBalance || row.balance || row.balanceAmount),
      })),
      rowTotal,
    )

    const payTrend = computeTrendPercent(filteredReports.purchases, rowTotal)

    const profitByMonth = new Map()
    filteredReports.sales.forEach((row) => {
      const key = (row.orderDate || '').slice(0, 7)
      if (!key) return
      profitByMonth.set(key, { ...profitByMonth.get(key) || { sales: 0, purchases: 0 }, sales: (profitByMonth.get(key)?.sales || 0) + rowTotal(row) })
    })
    filteredReports.purchases.forEach((row) => {
      const key = (row.orderDate || '').slice(0, 7)
      if (!key) return
      const cur = profitByMonth.get(key) || { sales: 0, purchases: 0 }
      profitByMonth.set(key, { ...cur, purchases: cur.purchases + rowTotal(row) })
    })
    const profitRows = [...profitByMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, vals]) => ({ orderDate: `${key}-01`, totalAmount: vals.sales - vals.purchases }))
    const profitTrend = computeTrendPercent(profitRows, rowTotal)

    const lowStockCount = summary.lowStockItems
    const lowStockTrend = lowStockCount === 0 ? 'None' : `${lowStockCount} items`
    const topItem = summary.topSellingItem

    return {
      sales: salesTrend,
      salesTone: trendTone(salesTrend),
      purchases: purchaseTrend,
      purchaseTone: trendTone(purchaseTrend),
      inventory: invTrend,
      inventoryTone: trendTone(invTrend),
      receivables: recTrend,
      receivablesTone: trendTone(recTrend),
      payables: payTrend,
      payablesTone: trendTone(payTrend) === 'positive' ? 'negative' : trendTone(payTrend) === 'negative' ? 'positive' : 'neutral',
      profit: profitTrend,
      profitTone: trendTone(profitTrend),
      lowStock: lowStockTrend,
      topItem,
    }
  }, [filteredReports, summary])

  const stockChartData = useMemo(
    () => (reports.stockAvailability?.length ? reports.stockAvailability : filteredReports.stock.slice(0, 8).map((row) => ({
      product: row.product || row.productName || row.name || 'Stock item',
      available: numeric(row.availableQuantity || row.availableStock || row.quantity),
    }))),
    [reports.stockAvailability, filteredReports.stock],
  )

  const topCustomersChartData = useMemo(
    () => filteredReports.topCustomers.slice(0, 8).map((row) => ({
      customer: row.customerName,
      sales: numeric(row.totalSalesValue),
    })),
    [filteredReports.topCustomers],
  )

  async function handleExportSales() {
    setIsExporting(true)
    const response = await exportSalesReport()
    setIsExporting(false)

    if (!response.success) {
      showToast({ type: 'error', title: 'Reports', message: response.error || 'Sales report export failed.' })
      return
    }

    downloadBlob(response.blob, response.filename)
    showToast({ type: 'success', title: 'Reports', message: 'Sales report exported successfully.' })
  }

  async function handleExportStock() {
    setIsExportingStock(true)
    const response = await exportStockReport()
    setIsExportingStock(false)

    if (!response.success) {
      showToast({ type: 'error', title: 'Reports', message: response.error || 'Stock report export failed.' })
      return
    }

    downloadBlob(response.blob, response.filename)
    showToast({ type: 'success', title: 'Reports', message: 'Stock report exported successfully.' })
  }

  async function handleExportSalesPdf() {
    setIsExportingSalesPdf(true)
    const response = await exportSalesReportPdf()
    setIsExportingSalesPdf(false)

    if (!response.success) {
      showToast({ type: 'error', title: 'Reports', message: response.error || 'Sales PDF export failed.' })
      return
    }

    downloadBlob(response.blob, response.filename)
    showToast({ type: 'success', title: 'Reports', message: 'Sales PDF downloaded successfully.' })
  }

  async function handleExportStockPdf() {
    setIsExportingStockPdf(true)
    const response = await exportStockReportPdf()
    setIsExportingStockPdf(false)

    if (!response.success) {
      showToast({ type: 'error', title: 'Reports', message: response.error || 'Stock PDF export failed.' })
      return
    }

    downloadBlob(response.blob, response.filename)
    showToast({ type: 'success', title: 'Reports', message: 'Stock PDF downloaded successfully.' })
  }

  function handleFilterChange(event) {
    const { name, value } = event.target

    if (name === 'from') {
      if (value && filters.to && value > filters.to) {
        showToast({ type: 'error', title: 'Reports', message: 'From date cannot be later than To date.' })
        return
      }
    }
    if (name === 'to') {
      if (value && filters.from && value < filters.from) {
        showToast({ type: 'error', title: 'Reports', message: 'To date cannot be earlier than From date.' })
        return
      }
    }

    if (name === 'from' || name === 'to') {
      setActiveRange('custom')
    }

    setFilters((currentValue) => ({ ...currentValue, [name]: value }))
  }

  function handlePeriodChange(nextRange) {
    setActiveRange(nextRange)
    if (nextRange !== 'custom') {
      const dates = calculatePeriodDates(nextRange)
      setFilters((currentValue) => ({ ...currentValue, ...dates }))
    }
    setIsPeriodMenuOpen(false)
  }

  function handleReportTypeChange(event) {
    const value = event.target.value
    setActiveReport(value)
    setFilters((currentValue) => ({ ...currentValue, reportType: value }))
  }

  function handleTabChange(tabKey) {
    setActiveReport(tabKey)
    setFilters((currentValue) => ({ ...currentValue, reportType: tabKey }))
  }

  const columnsByReport = {
    sales: [
      { key: 'soNumber', label: 'Order No.', sortable: true, width: '185px' },
      { key: 'customer', label: 'Customer', sortable: true, width: '210px' },
      { key: 'orderDate', label: 'Order Date', sortable: true, width: '180px', render: (row) => formatDate(row.orderDate) },
      { key: 'totalAmount', label: 'Total', sortable: true, width: '170px', className: 'reports-table__numeric', render: (row) => formatCurrency(row.totalAmount) },
      { key: 'status', label: 'Status', sortable: true, width: '150px', render: (row) => renderStatusBadge(row.status) },
    ],
    purchases: [
      { key: 'poNumber', label: 'PO No.', sortable: true, width: '300px' },
      { key: 'supplier', label: 'Supplier', sortable: true, width: '160px' },
      { key: 'orderDate', label: 'Order Date', sortable: true, width: '180px', render: (row) => formatDate(row.orderDate) },
      { key: 'totalAmount', label: 'Total', sortable: true, width: '170px', className: 'reports-table__numeric', render: (row) => formatCurrency(row.totalAmount) },
      { key: 'status', label: 'Status', sortable: true, width: '150px', render: (row) => renderStatusBadge(row.status) },
    ],
    invoices: [
      { key: 'invoiceNumber', label: 'Invoice', sortable: true, width: '180px' },
      { key: 'customer', label: 'Customer', sortable: true, width: '190px' },
      { key: 'invoiceDate', label: 'Invoice Date', sortable: true, width: '160px', render: (row) => formatDate(row.invoiceDate) },
      { key: 'totalAmount', label: 'Total', sortable: true, width: '150px', className: 'reports-table__numeric', render: (row) => formatCurrency(row.totalAmount) },
      { key: 'paidAmount', label: 'Paid', sortable: true, width: '140px', className: 'reports-table__numeric', render: (row) => formatCurrency(row.paidAmount) },
      { key: 'balanceAmount', label: 'Balance', sortable: true, width: '140px', className: 'reports-table__numeric', render: (row) => formatCurrency(row.balanceAmount) },
      { key: 'status', label: 'Status', sortable: true, width: '160px', render: (row) => renderStatusBadge(row.status) },
    ],
    stock: [
      { key: 'product', label: 'Product', sortable: true, width: '240px' },
      { key: 'warehouse', label: 'Warehouse', sortable: true, width: '220px' },
      { key: 'quantity', label: 'On Hand', sortable: true, width: '140px', className: 'reports-table__numeric' },
      { key: 'reservedQuantity', label: 'Reserved', sortable: true, width: '140px', className: 'reports-table__numeric' },
      { key: 'availableQuantity', label: 'Available', sortable: true, width: '140px', className: 'reports-table__numeric' },
      { key: 'computedStatus', label: 'Status', sortable: false, width: '150px', render: (row) => renderStatusBadge(getStockHealthStatus(row)) },
    ],
    customerBalances: [
      { key: 'name', label: 'Customer', sortable: true, width: '220px', render: (row) => row.name || row.customer },
      { key: 'company', label: 'Company', sortable: true, width: '220px' },
      { key: 'creditLimit', label: 'Credit Limit', sortable: true, width: '160px', className: 'reports-table__numeric', render: (row) => formatCreditLimit(row.creditLimit, 'INR') },
      { key: 'outstandingBalance', label: 'Outstanding', sortable: true, width: '170px', className: 'reports-table__numeric', render: (row) => formatCurrency(row.outstandingBalance) },
      { key: 'status', label: 'Status', sortable: true, width: '150px', render: (row) => renderStatusBadge(row.status) },
    ],
    inventoryValuation: [
      { key: 'productName', label: 'Product Name', sortable: true, width: '230px' },
      { key: 'sku', label: 'SKU', sortable: true, width: '140px' },
      { key: 'category', label: 'Category', sortable: true, width: '160px' },
      { key: 'warehouse', label: 'Warehouse', sortable: true, width: '190px' },
      { key: 'quantityAvailable', label: 'Qty Available', sortable: true, width: '150px', className: 'reports-table__numeric' },
      { key: 'averageCost', label: 'Avg Cost', sortable: true, width: '140px', className: 'reports-table__numeric', render: (row) => formatCurrency(row.averageCost) },
      { key: 'totalStockValue', label: 'Stock Value', sortable: true, width: '160px', className: 'reports-table__numeric', render: (row) => formatCurrency(row.totalStockValue) },
      { key: 'lastPurchaseDate', label: 'Last Purchase', sortable: true, width: '160px', render: (row) => (row.lastPurchaseDate ? formatDate(row.lastPurchaseDate) : '-') },
    ],
    lowStock: [
      { key: 'productName', label: 'Product Name', sortable: true, width: '230px' },
      { key: 'sku', label: 'SKU', sortable: true, width: '140px' },
      { key: 'category', label: 'Category', sortable: true, width: '160px' },
      { key: 'availableStock', label: 'Available Stock', sortable: true, width: '160px', className: 'reports-table__numeric' },
      { key: 'minimumStockLevel', label: 'Minimum Level', sortable: true, width: '160px', className: 'reports-table__numeric' },
      { key: 'reorderQuantity', label: 'Reorder Qty', sortable: true, width: '150px', className: 'reports-table__numeric' },
      { key: 'warehouse', label: 'Warehouse', sortable: true, width: '190px' },
      { key: 'status', label: 'Status', sortable: true, width: '150px', render: (row) => renderStatusBadge(row.status) },
    ],
    fastMoving: [
      { key: 'productName', label: 'Product Name', sortable: true, width: '230px' },
      { key: 'sku', label: 'SKU', sortable: true, width: '140px' },
      { key: 'unitsSold', label: 'Units Sold', sortable: true, width: '140px', className: 'reports-table__numeric' },
      { key: 'salesValue', label: 'Sales Value', sortable: true, width: '160px', className: 'reports-table__numeric', render: (row) => formatCurrency(row.salesValue) },
      { key: 'stockLeft', label: 'Stock Left', sortable: true, width: '140px', className: 'reports-table__numeric' },
      { key: 'movementStatus', label: 'Movement Status', sortable: true, width: '170px', render: (row) => renderStatusBadge(row.movementStatus) },
    ],
    slowMoving: [
      { key: 'productName', label: 'Product Name', sortable: true, width: '230px' },
      { key: 'sku', label: 'SKU', sortable: true, width: '140px' },
      { key: 'lastSoldDate', label: 'Last Sold Date', sortable: true, width: '160px', render: (row) => (row.lastSoldDate ? formatDate(row.lastSoldDate) : 'Not sold') },
      { key: 'stockAvailable', label: 'Stock Available', sortable: true, width: '160px', className: 'reports-table__numeric' },
      { key: 'daysSinceLastSale', label: 'Days Since Last Sale', sortable: true, width: '190px', className: 'reports-table__numeric' },
      { key: 'stockValue', label: 'Stock Value', sortable: true, width: '160px', className: 'reports-table__numeric', render: (row) => formatCurrency(row.stockValue) },
    ],
    topCustomers: [
      { key: 'customerName', label: 'Customer Name', sortable: true, width: '240px' },
      { key: 'totalOrders', label: 'Total Orders', sortable: true, width: '150px', className: 'reports-table__numeric' },
      { key: 'totalSalesValue', label: 'Total Sales Value', sortable: true, width: '190px', className: 'reports-table__numeric', render: (row) => formatCurrency(row.totalSalesValue) },
      { key: 'outstandingAmount', label: 'Outstanding Amount', sortable: true, width: '190px', className: 'reports-table__numeric', render: (row) => formatCurrency(row.outstandingAmount) },
      { key: 'lastPurchaseDate', label: 'Last Purchase Date', sortable: true, width: '180px', render: (row) => (row.lastPurchaseDate ? formatDate(row.lastPurchaseDate) : '-') },
    ],
    topSuppliers: [
      { key: 'supplierName', label: 'Supplier Name', sortable: true, width: '240px' },
      { key: 'totalPurchases', label: 'Total Purchases', sortable: true, width: '170px', className: 'reports-table__numeric' },
      { key: 'purchaseValue', label: 'Purchase Value', sortable: true, width: '180px', className: 'reports-table__numeric', render: (row) => formatCurrency(row.purchaseValue) },
      { key: 'outstandingPayable', label: 'Outstanding Payable', sortable: true, width: '200px', className: 'reports-table__numeric', render: (row) => formatCurrency(row.outstandingPayable) },
      { key: 'lastPurchaseDate', label: 'Last Purchase Date', sortable: true, width: '180px', render: (row) => (row.lastPurchaseDate ? formatDate(row.lastPurchaseDate) : '-') },
    ],
    profitability: [
      { key: 'productName', label: 'Product Name', sortable: true, width: '240px' },
      { key: 'salesValue', label: 'Sales Value', sortable: true, width: '170px', className: 'reports-table__numeric', render: (row) => formatCurrency(row.salesValue) },
      { key: 'costValue', label: 'Cost Value', sortable: true, width: '170px', className: 'reports-table__numeric', render: (row) => formatCurrency(row.costValue) },
      { key: 'grossProfit', label: 'Gross Profit', sortable: true, width: '170px', className: 'reports-table__numeric', render: (row) => formatCurrency(row.grossProfit) },
      { key: 'profitMargin', label: 'Profit Margin %', sortable: true, width: '170px', className: 'reports-table__numeric', render: (row) => `${numeric(row.profitMargin).toFixed(1)}%` },
      { key: 'status', label: 'Status', sortable: true, width: '150px', render: (row) => renderStatusBadge(row.status) },
    ],
    customerOutstanding: [
      { key: 'customerName', label: 'Customer Name', sortable: true, width: '230px' },
      { key: 'invoiceNumber', label: 'Invoice Number', sortable: true, width: '180px' },
      { key: 'invoiceDate', label: 'Invoice Date', sortable: true, width: '160px', render: (row) => (row.invoiceDate ? formatDate(row.invoiceDate) : '-') },
      { key: 'dueDate', label: 'Due Date', sortable: true, width: '160px', render: (row) => (row.dueDate ? formatDate(row.dueDate) : '-') },
      { key: 'invoiceAmount', label: 'Invoice Amount', sortable: true, width: '170px', className: 'reports-table__numeric', render: (row) => formatCurrency(row.invoiceAmount) },
      { key: 'paidAmount', label: 'Paid Amount', sortable: true, width: '160px', className: 'reports-table__numeric', render: (row) => formatCurrency(row.paidAmount) },
      { key: 'balanceAmount', label: 'Balance Amount', sortable: true, width: '180px', className: 'reports-table__numeric', render: (row) => formatCurrency(row.balanceAmount) },
      { key: 'agingStatus', label: 'Aging Status', sortable: true, width: '170px', render: (row) => renderStatusBadge(row.agingStatus) },
    ],
    supplierOutstanding: [
      { key: 'supplierName', label: 'Supplier Name', sortable: true, width: '230px' },
      { key: 'billNumber', label: 'Bill Number', sortable: true, width: '180px' },
      { key: 'billDate', label: 'Bill Date', sortable: true, width: '160px', render: (row) => (row.billDate ? formatDate(row.billDate) : '-') },
      { key: 'dueDate', label: 'Due Date', sortable: true, width: '160px', render: (row) => (row.dueDate ? formatDate(row.dueDate) : '-') },
      { key: 'billAmount', label: 'Bill Amount', sortable: true, width: '170px', className: 'reports-table__numeric', render: (row) => formatCurrency(row.billAmount) },
      { key: 'paidAmount', label: 'Paid Amount', sortable: true, width: '160px', className: 'reports-table__numeric', render: (row) => formatCurrency(row.paidAmount) },
      { key: 'balanceAmount', label: 'Balance Amount', sortable: true, width: '180px', className: 'reports-table__numeric', render: (row) => formatCurrency(row.balanceAmount) },
      { key: 'agingStatus', label: 'Aging Status', sortable: true, width: '170px', render: (row) => renderStatusBadge(row.agingStatus) },
    ],
    gstReport: [
      { key: 'month', label: 'Month', sortable: true, width: '160px' },
      { key: 'taxableSales', label: 'Taxable Sales', sortable: true, width: '170px', className: 'reports-table__numeric', render: (row) => formatCurrency(row.taxableSales) },
      { key: 'outputGst', label: 'Output GST', sortable: true, width: '160px', className: 'reports-table__numeric', render: (row) => formatCurrency(row.outputGst) },
      { key: 'taxablePurchases', label: 'Taxable Purchases', sortable: true, width: '190px', className: 'reports-table__numeric', render: (row) => formatCurrency(row.taxablePurchases) },
      { key: 'inputGst', label: 'Input GST', sortable: true, width: '160px', className: 'reports-table__numeric', render: (row) => formatCurrency(row.inputGst) },
      { key: 'netGstPayable', label: 'Net GST Payable', sortable: true, width: '190px', className: 'reports-table__numeric', render: (row) => formatCurrency(row.netGstPayable) },
    ],
    warehousePerformance: [
      { key: 'warehouseName', label: 'Warehouse Name', sortable: true, width: '230px' },
      { key: 'stockValue', label: 'Stock Value', sortable: true, width: '170px', className: 'reports-table__numeric', render: (row) => formatCurrency(row.stockValue) },
      { key: 'totalProducts', label: 'Total Products', sortable: true, width: '170px', className: 'reports-table__numeric' },
      { key: 'lowStockItems', label: 'Low Stock Items', sortable: true, width: '180px', className: 'reports-table__numeric' },
      { key: 'damagedItems', label: 'Damaged Items', sortable: true, width: '170px', className: 'reports-table__numeric' },
      { key: 'salesDispatches', label: 'Sales Dispatches', sortable: true, width: '180px', className: 'reports-table__numeric' },
      { key: 'purchaseReceipts', label: 'Purchase Receipts', sortable: true, width: '190px', className: 'reports-table__numeric' },
    ],
    scheduledReports: [
      { key: 'reportName', label: 'Report Name', sortable: true, width: '260px' },
      { key: 'frequency', label: 'Frequency', sortable: true, width: '150px' },
      { key: 'recipients', label: 'Email Recipients', sortable: true, width: '260px' },
      { key: 'format', label: 'Format', sortable: true, width: '140px' },
      { key: 'status', label: 'Status', sortable: true, width: '150px', render: (row) => renderStatusBadge(row.status) },
    ],
    forecasting: [
      { key: 'insight', label: 'Insight', sortable: true, width: '220px' },
      { key: 'prediction', label: 'Prediction', sortable: true, width: '420px' },
      { key: 'priority', label: 'Priority', sortable: true, width: '140px' },
      { key: 'status', label: 'Status', sortable: true, width: '160px', render: (row) => renderStatusBadge(row.status) },
    ],
  }

  const lockedColumnsByReport = {
    sales: ['soNumber', 'status'],
    purchases: ['poNumber', 'status'],
    invoices: ['invoiceNumber', 'status'],
    stock: ['product', 'availableQuantity', 'computedStatus'],
    customerBalances: ['name', 'status'],
    inventoryValuation: ['productName', 'totalStockValue'],
    lowStock: ['productName', 'status'],
    fastMoving: ['productName', 'movementStatus'],
    slowMoving: ['productName', 'daysSinceLastSale'],
    topCustomers: ['customerName', 'totalSalesValue'],
    topSuppliers: ['supplierName', 'purchaseValue'],
    profitability: ['productName', 'grossProfit'],
    customerOutstanding: ['customerName', 'agingStatus'],
    supplierOutstanding: ['supplierName', 'agingStatus'],
    gstReport: ['month', 'netGstPayable'],
    warehousePerformance: ['warehouseName', 'stockValue'],
    scheduledReports: ['reportName', 'status'],
    forecasting: ['insight', 'status'],
  }

  const activeRows = filteredReports[activeReport] ?? []
  const activeTab = REPORT_TABS.find((tab) => tab.key === activeReport)
  const activeColumns = columnsByReport[activeReport] ?? []
  const dateRangeLabel = getDateRangeLabel(filters)

  function handleExportActiveReport() {
    const header = activeColumns.map((column) => csvEscape(column.label)).join(',')
    const body = activeRows.map((row) => activeColumns.map((column) => csvEscape(getExportValue(row, column))).join(',')).join('\n')
    const filename = `${activeTab?.label?.toLowerCase().replace(/\s+/g, '-') || 'report'}-view.csv`

    downloadBlob(new Blob([[header, body].filter(Boolean).join('\n')], { type: 'text/csv;charset=utf-8' }), filename)
    showToast({ type: 'success', title: 'Reports', message: `${activeTab?.label ?? 'Current'} view exported successfully.` })
  }

  function handleExportSummary() {
    const rows = [
      ['Metric', 'Value'],
      ['Date Range', dateRangeLabel],
      ['Sales Value', formatCurrency(summary.salesTotal)],
      ['Purchase Value', formatCurrency(summary.purchaseTotal)],
      ['Inventory Value', formatCurrency(erpReports.summary.totalInventoryValue)],
      ['Low Stock Items', erpReports.summary.lowStockItems],
      ['Customer Balance', formatCurrency(summary.balanceTotal || erpReports.summary.outstandingReceivables)],
      ['Supplier Payables', formatCurrency(erpReports.summary.outstandingPayables)],
      ['Gross Profit', formatCurrency(erpReports.summary.grossProfit)],
    ]
    const csv = rows.map((row) => row.map(csvEscape).join(',')).join('\n')

    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), 'reports-summary.csv')
    showToast({ type: 'success', title: 'Reports', message: 'Summary exported successfully.' })
  }

  function handleDownloadKpiPdf({ title, value, trend, caption, reportKey }) {
    const rows = filteredReports[reportKey] ?? []
    const columns = columnsByReport[reportKey] ?? []
    const reportLabel = REPORT_TABS.find((tab) => tab.key === reportKey)?.label || title
    const blob = createPremiumKpiPdfBlob({
      title,
      value,
      trend,
      caption,
      dateRangeLabel,
      reportLabel,
      rows,
      columns,
    })
    downloadBlob(blob, `${getSafeFilename(title)}-kpi-report.pdf`)
    showToast({ type: 'success', title: 'Reports', message: `${title} KPI PDF downloaded successfully.` })
  }

  return (
    <div className="page reports-page">
      <header className="reports-page__header reports-page__no-print">
        <div className="reports-page__header-main">
          <div className="reports-page__heading-block">
            <div className="reports-page__title-row">
              <h1>Reports</h1>
              <div className="reports-page__metrics" aria-label="Report summary">
                <span className="reports-metric-badge reports-metric-badge--success"><strong>{filteredReports.sales.length}</strong><span>Sales</span></span>
                <span className="reports-metric-badge reports-metric-badge--info"><strong>{filteredReports.purchases.length}</strong><span>Purchases</span></span>
                <span className="reports-metric-badge reports-metric-badge--warning"><strong>{filteredReports.invoices.length}</strong><span>Invoices</span></span>
                <span className="reports-metric-badge reports-metric-badge--primary"><strong>{summary.stockAvailable}</strong><span>Stock Units</span></span>
              </div>
            </div>

          </div>

          <div className="reports-page__header-actions">
            <button type="button" className="button button-secondary" onClick={() => window.print()}>
              <Printer size={16} />
              Print
            </button>
            <ExportMenu
              actions={[
                { key: 'active-view', label: `${activeTab?.label ?? 'Current'} table CSV`, icon: FileSpreadsheet, onClick: handleExportActiveReport },
                { key: 'summary', label: 'Summary metrics CSV', icon: FileText, onClick: handleExportSummary },
                { key: 'sales-excel', label: 'Full sales report Excel', icon: FileSpreadsheet, loading: isExporting, onClick: handleExportSales },
                { key: 'sales-pdf', label: 'Sales report PDF', icon: FileText, loading: isExportingSalesPdf, onClick: handleExportSalesPdf },
                { key: 'stock-excel', label: 'Full stock report Excel', icon: FileSpreadsheet, loading: isExportingStock, onClick: handleExportStock },
                { key: 'stock-pdf', label: 'Stock report PDF', icon: FileText, loading: isExportingStockPdf, onClick: handleExportStockPdf },
              ]}
            />
          </div>
        </div>
      </header>

      {error ? (
        <div className="message-box message-box--error page-error-banner" role="alert" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{error}</span>
          <button type="button" className="button button-danger button-sm" onClick={handleRetry}>Retry</button>
        </div>
      ) : null}

      <div className="reports-page__filters reports-page__no-print">
        {/* Row 1, Col 1: Period */}
        <div className="reports-page__period-field" ref={periodMenuRef}>
          <span>Period</span>
          <span className="reports-page__period-control">
            <button
              type="button"
              id="reports-period"
              className="reports-page__period-button"
              onClick={() => setIsPeriodMenuOpen((currentValue) => !currentValue)}
              aria-haspopup="menu"
              aria-expanded={isPeriodMenuOpen}
              aria-label="Report date period"
            >
              <span>{activeRange === 'custom' ? 'Custom' : QUICK_RANGES.find((range) => range.key === activeRange)?.label ?? 'All time'}</span>
              <ChevronDown size={14} aria-hidden="true" />
            </button>
            {isPeriodMenuOpen ? (
              <div className="reports-page__period-menu" role="menu" aria-labelledby="reports-period">
                {QUICK_RANGES.map((range) => (
                  <button key={range.key} type="button" className={activeRange === range.key ? 'is-active' : ''} onClick={() => handlePeriodChange(range.key)} role="menuitem">
                    {range.label}
                  </button>
                ))}
              </div>
            ) : null}
          </span>
        </div>

        {/* Row 1, Col 2: From Date */}
        <DatePicker
          id="reports-from"
          name="from"
          label="From"
          icon={CalendarDays}
          value={filters.from}
          onChange={handleFilterChange}
          readOnly={activeRange !== 'custom'}
        />

        {/* Row 1, Col 3: To Date */}
        <DatePicker
          id="reports-to"
          name="to"
          label="To"
          icon={CalendarDays}
          value={filters.to}
          onChange={handleFilterChange}
          readOnly={activeRange !== 'custom'}
        />

        {/* Row 1, Col 4: Warehouse */}
        <label className="reports-page__filter-field">
          <span>Warehouse</span>
          <ReportsFilterSelect
            name="warehouse"
            value={filters.warehouse}
            onChange={handleFilterChange}
            options={warehouseOptions}
          />
        </label>

        {/* Row 1, Col 5: Category */}
        <label className="reports-page__filter-field">
          <span>Category {categoriesError ? '(Error)' : isCategoriesLoading ? '...' : ''}</span>
          <ReportsFilterSelect
            name="category"
            value={filters.category}
            onChange={handleFilterChange}
            options={categoryOptions}
            disabled={isCategoriesLoading || Boolean(categoriesError)}
          />
        </label>

        {/* Row 2, Col 1: Product */}
        <label className="reports-page__filter-field">
          <span>Product</span>
          <ReportsFilterSelect
            name="product"
            value={filters.product}
            onChange={handleFilterChange}
            options={productOptions}
          />
        </label>

        {/* Row 2, Col 2: Customer */}
        <label className="reports-page__filter-field">
          <span>Customer</span>
          <ReportsFilterSelect
            name="customer"
            value={filters.customer}
            onChange={handleFilterChange}
            options={customerOptions}
          />
        </label>

        {/* Row 2, Col 3: Supplier */}
        <label className="reports-page__filter-field">
          <span>Supplier</span>
          <ReportsFilterSelect
            name="supplier"
            value={filters.supplier}
            onChange={handleFilterChange}
            options={supplierOptions}
          />
        </label>

        {/* Row 2, Col 4: Report Type */}
        <label className="reports-page__filter-field">
          <span>Report Type</span>
          <ReportsFilterSelect
            name="reportType"
            value={activeReport}
            onChange={handleReportTypeChange}
            options={reportTypeOptions}
          />
        </label>

        {/* Row 2, Col 5: Status */}
        <label className="reports-page__filter-field">
          <span>Status</span>
          <ReportsFilterSelect
            name="status"
            value={filters.status}
            onChange={handleFilterChange}
            options={statusOptions}
          />
        </label>
      </div>

      <section className="reports-page__analytics-layout reports-page__no-print" aria-label="Reports analytics summary">
        <div className="reports-page__chart-stack">
          {activeReport === 'topCustomers' ? (
            <div className="card chart-card reports-page__chart-card reports-page__chart-card--primary">
              <h2 className="section-title">Top customers by sales</h2>
              <ResponsiveChart>
                <BarChart data={topCustomersChartData} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
                  <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="customer" tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={formatChartCurrency} tickLine={false} axisLine={false} width={38} />
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Bar dataKey="sales" fill="#2563eb" radius={[6, 6, 0, 0]} maxBarSize={54} />
                </BarChart>
              </ResponsiveChart>
            </div>
          ) : (
            <div className="card chart-card reports-page__chart-card reports-page__chart-card--primary">
              <h2 className="section-title">Transaction trend</h2>
              <ResponsiveChart>
                <LineChart data={transactionTrend} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
                  <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={formatChartCurrency} tickLine={false} axisLine={false} width={38} />
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Line type="monotone" dataKey="sales" stroke="#2563eb" strokeWidth={2.6} dot={false} />
                  <Line type="monotone" dataKey="purchases" stroke="#6042d8" strokeWidth={2.6} dot={false} />
                </LineChart>
              </ResponsiveChart>
            </div>
          )}

          <div className="card chart-card reports-page__chart-card reports-page__chart-card--secondary">
            <h2 className="section-title">Stock availability</h2>
            <ResponsiveChart>
              <BarChart data={stockChartData} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
                <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="product" tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} width={30} />
                <Tooltip />
                <Bar dataKey="available" radius={[6, 6, 0, 0]} maxBarSize={42}>
                  {stockChartData.map((entry, index) => <Cell key={entry.product} fill={STOCK_BAR_COLORS[index % STOCK_BAR_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveChart>
          </div>
        </div>

        <div className="stats-grid reports-page__summary-grid reports-page__no-print">
          <SummaryCard loading={isLoading} title="Total Sales" value={formatCurrency(summary.salesTotal)} icon={ShoppingCart} trend={kpiTrends.sales} tone={kpiTrends.salesTone} caption="vs prev month" onClick={() => handleTabChange('sales')} onDownload={() => handlePrintKpiCard({ title: 'Total Sales', value: formatCurrency(summary.salesTotal), trend: kpiTrends.sales, caption: 'vs prev month', reportKey: 'sales' })} />
          <SummaryCard loading={isLoading} title="Total Purchases" value={formatCurrency(summary.purchaseTotal)} icon={FileText} trend={kpiTrends.purchases} tone={kpiTrends.purchaseTone} caption="vs prev month" onClick={() => handleTabChange('purchases')} onDownload={() => handlePrintKpiCard({ title: 'Total Purchases', value: formatCurrency(summary.purchaseTotal), trend: kpiTrends.purchases, caption: 'vs prev month', reportKey: 'purchases' })} />
          <SummaryCard loading={isLoading} title="Inventory Value" value={formatCurrency(summary.totalInventoryValue)} icon={IndianRupee} trend={kpiTrends.inventory} tone={kpiTrends.inventoryTone} caption="stock value" onClick={() => handleTabChange('inventoryValuation')} onDownload={() => handlePrintKpiCard({ title: 'Inventory Value', value: formatCurrency(summary.totalInventoryValue), trend: kpiTrends.inventory, caption: 'stock value', reportKey: 'inventoryValuation' })} />
          <SummaryCard loading={isLoading} title="Low Stock Items" value={summary.lowStockItems} icon={AlertTriangle} trend={kpiTrends.lowStock} tone={kpiTrends.lowStock === 'None' ? 'positive' : 'negative'} caption="reorder watch" onClick={() => handleTabChange('lowStock')} onDownload={() => handlePrintKpiCard({ title: 'Low Stock Items', value: String(summary.lowStockItems), trend: kpiTrends.lowStock, caption: 'reorder watch', reportKey: 'lowStock' })} />
          <SummaryCard loading={isLoading} title="Receivables" value={formatCurrency(summary.outstandingReceivables)} icon={Users} trend={kpiTrends.receivables} tone={kpiTrends.receivablesTone} caption="customer dues" onClick={() => handleTabChange('customerOutstanding')} onDownload={() => handlePrintKpiCard({ title: 'Receivables', value: formatCurrency(summary.outstandingReceivables), trend: kpiTrends.receivables, caption: 'customer dues', reportKey: 'customerOutstanding' })} />
          <SummaryCard loading={isLoading} title="Payables" value={formatCurrency(summary.outstandingPayables)} icon={PackageSearch} trend={kpiTrends.payables} tone={kpiTrends.payablesTone} caption="supplier dues" onClick={() => handleTabChange('supplierOutstanding')} onDownload={() => handlePrintKpiCard({ title: 'Payables', value: formatCurrency(summary.outstandingPayables), trend: kpiTrends.payables, caption: 'supplier dues', reportKey: 'supplierOutstanding' })} />
          <SummaryCard loading={isLoading} title="Profit" value={formatCurrency(summary.grossProfit)} icon={TrendingUp} trend={kpiTrends.profit} tone={kpiTrends.profitTone} caption="sales minus purchases" onClick={() => handleTabChange('profitability')} onDownload={() => handlePrintKpiCard({ title: 'Profit', value: formatCurrency(summary.grossProfit), trend: kpiTrends.profit, caption: 'sales minus purchases', reportKey: 'profitability' })} />
          <SummaryCard loading={isLoading} title="Top Selling Item" value={summary.topSellingItem} icon={Trophy} trend="Fast Moving" tone="neutral" caption="by sales volume" onClick={() => handleTabChange('fastMoving')} onDownload={() => handlePrintKpiCard({ title: 'Top Selling Item', value: summary.topSellingItem, trend: 'Fast Moving', caption: 'by sales volume', reportKey: 'fastMoving' })} />
        </div>
      </section>

      <div className={`card reports-page__table-card reports-page__table-card--${activeReport} reports-page__no-print`}>
        <div className="reports-page__table-strip reports-page__no-print">
          <div className="reports-page__tab-groups" role="tablist" aria-label="Report type">
            {REPORT_TAB_GROUPS.map((group) => (
              <div className="reports-page__tab-group" key={group.label}>
                <span className="reports-page__tab-group-title">{group.label}</span>
                <div className="reports-page__tabs">
                  {group.tabs.map((tabKey) => {
                    const tab = REPORT_TABS.find((item) => item.key === tabKey)
                    if (!tab) return null

                    return (
                      <button
                        key={tab.key}
                        type="button"
                        className={`reports-page__tab reports-page__tab--${tab.key} ${activeReport === tab.key ? 'is-active' : ''}`}
                        onClick={() => handleTabChange(tab.key)}
                        role="tab"
                        aria-selected={activeReport === tab.key}
                      >
                        {tab.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <DataTable
          key={`reports-${activeReport}`}
          title={`${activeTab?.label ?? 'Report'} Report`}
          className="reports-data-table--compact"
          rows={activeRows}
          columns={activeColumns}
          loading={isLoading}
          defaultPageSize={10}
          defaultVisibleColumnKeys={activeColumns.map((column) => column.key)}
          lockedColumnKeys={lockedColumnsByReport[activeReport]}
          minVisibleColumnCount={Math.min(3, activeColumns.length)}
          columnStorageKey={`ims.reports.visibleColumns.v11.${activeReport}`}
          splitToolbar
          searchPlaceholder={`Search ${activeTab?.label.toLowerCase() ?? 'report'}`}
          emptyMessage="No report records match the current filters."
        />
      </div>

      {activeKpiPrint ? (
        <ReportKpiPrintContainer
          kpiKey={activeKpiPrint.reportKey}
          kpiTitle={activeKpiPrint.title}
          kpiValue={activeKpiPrint.value}
          kpiTrend={activeKpiPrint.trend}
          kpiCaption={activeKpiPrint.caption}
          filters={filters}
          activeRange={activeRange}
          warehousesList={warehousesList}
          categoriesList={categoriesList}
          productsList={productsList}
          customersList={customersList}
          suppliersList={suppliersList}
          filteredReports={filteredReports}
          allRowsByReport={allRowsByReport}
          summary={summary}
        />
      ) : (
        <ReportPrintContainer
          activeReport={activeReport}
          activeTabLabel={activeTab?.label}
          filters={filters}
          activeRange={activeRange}
          warehousesList={warehousesList}
          categoriesList={categoriesList}
          productsList={productsList}
          customersList={customersList}
          suppliersList={suppliersList}
          columns={activeColumns}
          rows={activeRows}
        />
      )}
    </div>
  )
}
