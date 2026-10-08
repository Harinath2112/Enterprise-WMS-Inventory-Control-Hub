import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { jsPDF } from 'jspdf'
import { autoTable } from 'jspdf-autotable'
import {
  AlertTriangle,
  CalendarDays,
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  Download,
  Eye,
  FileText,
  Pencil,
  Plus,
  Printer,
  ReceiptText,
  RefreshCw,
  Save,
  SlidersHorizontal,
  Trash2,
  User,
  X,
  XCircle,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import CurrencyInput from '../../components/CurrencyInput'
import DatePicker from '../../components/DatePicker'
import StateBlock from '../../components/common/StateBlock'
import InputField from '../../components/InputField'
import SearchableSelect from '../../components/SearchableSelect'
import { ActionMenu, DataTable, FilterBar, StatisticsCard, StatusBadge } from '../../components/erp'
import { showToast } from '../../components/common/toast'
import PortalDropdown from '../../components/layout/PortalDropdown'
import FormModal from '../../layouts/FormModal'
import { useAuth } from '../../hooks/useAuth'
import { formatCurrency, formatDate, getNumberError, getRequiredError, getToday } from '../../utils/helpers'
import { getInvoices, getPurchaseOrders } from '../../api/businessApi'
import './Payments.css'

const PAYMENT_METHODS = [
  { value: 'Cash', label: 'Cash' },
  { value: 'Bank Transfer', label: 'Bank Transfer' },
  { value: 'UPI', label: 'UPI' },
  { value: 'Card', label: 'Card' },
  { value: 'Cheque', label: 'Cheque' },
]

const PAYMENT_FILTER_OPTIONS = [
  { value: 'all', label: 'All Payments' },
  { value: 'success', label: 'Success' },
  { value: 'pending', label: 'Pending' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'reversed', label: 'Reversed' },
  { value: 'month', label: 'This Month' },
  { value: 'last30', label: 'Last 30 Days' },
  { value: 'large', label: 'Large Payments' },
]

const LARGE_PAYMENT_THRESHOLD = 50000
const RECEIPT_COMPANY_NAME = 'StockPilot IMS'
const RECEIPT_SYSTEM_NAME = 'IMS'
const RECEIPT_COMPANY_PROFILE = {
  name: RECEIPT_COMPANY_NAME,
  address: '',
  email: '',
  phone: '',
  gstNumber: '',
}
const PDF_PAGE_WIDTH = 595.28
const PDF_PAGE_HEIGHT = 841.89
const PDF_CANVAS_WIDTH = 794
const PDF_CANVAS_HEIGHT = 1123

const CUSTOMER_PAYMENT_BASE_COLUMNS = [
  'paymentNumber',
  'paymentDate',
  'partyName',
  'invoiceNumber',
  'invoiceStatus',
  'amount',
  'status',
  'actions',
]

const SUPPLIER_PAYMENT_BASE_COLUMNS = [
  'paymentNumber',
  'paymentDate',
  'partyName',
  'poId',
  'amount',
  'paymentMethod',
  'status',
  'actions',
]

const DEFAULT_PAYMENT_COLUMNS = CUSTOMER_PAYMENT_BASE_COLUMNS
const LOCKED_PAYMENT_COLUMNS = ['paymentNumber', 'actions']
const PAYMENT_COLUMNS_STORAGE_VERSION = 'v12'
const PAYMENT_COLUMNS_STORAGE_KEYS = {
  customer: `ims.customerPayments.visibleColumns.${PAYMENT_COLUMNS_STORAGE_VERSION}`,
  supplier: `ims.supplierPayments.visibleColumns.${PAYMENT_COLUMNS_STORAGE_VERSION}`,
}
const ENABLE_PAYMENT_SELECTION_DEBUG = import.meta.env.DEV
const PAYMENT_COLUMN_WIDTHS = {
  paymentNumber: 144,
  paymentDate: 112,
  partyName: 160,
  invoiceNumber: 140,
  poId: 180,
  invoiceStatus: 100,
  amount: 112,
  paymentMethod: 132,
  referenceNumber: 160,
  status: 96,
  createdBy: 130,
  notes: 220,
  cancelledAt: 140,
  cancellationReason: 220,
  actions: 64,
}
const SUPPLIER_PAYMENT_COLUMN_WIDTHS = {
  paymentNumber: 160,
  paymentDate: 118,
  partyName: 160,
  poId: 72,
  amount: 124,
  paymentMethod: 108,
  referenceNumber: 170,
  status: 96,
  createdBy: 130,
  notes: 200,
  cancelledAt: 140,
  cancellationReason: 200,
  actions: 64,
}

function toApiId(value, label) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const parsed = Number(value)

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be selected from live API records.`)
  }

  return parsed
}

function paymentNumberFrom(payment) {
  if (payment.paymentNumber) {
    return payment.paymentNumber
  }

  const datePart = String(payment.paymentDate || getToday()).replaceAll('-', '')
  const idPart = String(payment.paymentId || payment.id || 0).padStart(3, '0')
  return `PAY-${datePart}-${idPart}`
}

function getPaymentRowId(payment) {
  return String(payment?.paymentRowId || payment?.id || payment?.paymentId || paymentNumberFrom(payment))
}

function buildStablePaymentRowId(payment) {
  const primaryId = payment?.paymentId || payment?.id
  if (primaryId !== null && primaryId !== undefined && String(primaryId).trim()) {
    return `payment-${String(primaryId).trim()}`
  }

  const paymentNumber = paymentNumberFrom(payment)
  if (paymentNumber && !paymentNumber.endsWith('-000')) {
    return `number-${paymentNumber}`
  }

  return [
    'payment',
    payment?.invoiceId || 'no-invoice',
    payment?.paymentDate || 'no-date',
    payment?.amount || 0,
    payment?.referenceNumber || 'no-reference',
    payment?.partyName || 'no-party',
  ].map((part) => String(part).trim().toLowerCase().replace(/\s+/g, '-')).join('|')
}

function withPaymentRowId(payment) {
  return {
    ...payment,
    paymentRowId: buildStablePaymentRowId(payment),
  }
}

function logPaymentSelectionDebug(eventName, payload) {
  if (!ENABLE_PAYMENT_SELECTION_DEBUG) {
    return
  }

  console.info(`[CustomerPaymentsSelection] ${eventName}`, payload)
}

function getPaymentSelectionDomSnapshot(event) {
  const row = event.currentTarget.closest('tr')
  const displayedPaymentNumber = row?.querySelector?.('.payments-page__record-number')?.textContent?.trim() || ''

  return {
    domRowKey: row?.dataset?.rowKey || '',
    domRowIndex: row?.dataset?.rowIndex || '',
    displayedPaymentNumber,
    checkboxPaymentRowId: event.currentTarget.dataset.paymentRowId || '',
    checkboxPaymentNumber: event.currentTarget.dataset.paymentNumber || '',
  }
}

function normalizePaymentStatus(payment) {
  const status = String(payment.status || '').trim().toLowerCase()

  if (status === 'cancelled' || status === 'canceled') return 'Cancelled'
  if (status === 'reversed' || status === 'voided') return 'Reversed'
  if (status === 'failed') return 'Failed'
  if (status === 'completed' || status === 'success' || status === 'paid' || status === 'reconciled' || status === 'posted' || status === 'received') return 'Completed'
  return 'Pending'
}

function getPaymentStatusMeta(status) {
  const normalizedStatus = normalizePaymentStatus({ status })

  if (normalizedStatus === 'Completed') {
    return { label: 'Success', type: 'success', icon: CheckCircle2 }
  }

  if (normalizedStatus === 'Cancelled') {
    return { label: 'Cancelled', type: 'cancelled', icon: XCircle }
  }

  if (normalizedStatus === 'Reversed') {
    return { label: 'Reversed', type: 'draft', icon: RefreshCw }
  }

  if (normalizedStatus === 'Failed') {
    return { label: 'Failed', type: 'failed', icon: XCircle }
  }

  return { label: 'Pending', type: 'pending', icon: CalendarDays }
}

function PaymentStatusBadge({ status }) {
  const meta = getPaymentStatusMeta(status)
  return <StatusBadge type={meta.type} icon={meta.icon}>{meta.label}</StatusBadge>
}

function formatCompactPaymentCurrency(value) {
  const amount = Number(value || 0)
  const absoluteAmount = Math.abs(amount)
  const sign = amount < 0 ? '-' : ''

  if (absoluteAmount >= 10000000) {
    return `${sign}₹${(absoluteAmount / 10000000).toFixed(1)} Cr`
  }

  if (absoluteAmount >= 100000) {
    return `${sign}₹${(absoluteAmount / 100000).toFixed(1)} L`
  }

  return formatCurrency(amount)
}

function normalizeInvoiceStatus(value) {
  const status = String(value || '').trim().toLowerCase()

  if (status === 'draft' || status === 'sent' || status === 'unpaid') return 'Unpaid'
  if (status === 'partially paid' || status === 'partial') return 'Partial'
  if (status === 'paid') return 'Paid'
  if (status === 'overdue') return 'Overdue'
  if (status === 'cancelled' || status === 'canceled') return 'Cancelled'
  return value ? String(value).trim() : 'Unpaid'
}

function getInvoiceStatusMeta(status) {
  const normalizedStatus = normalizeInvoiceStatus(status)

  if (normalizedStatus === 'Paid') return { label: 'Paid', type: 'success', icon: CheckCircle2 }
  if (normalizedStatus === 'Partial') return { label: 'Partial', type: 'received', icon: CreditCard }
  if (normalizedStatus === 'Unpaid') return { label: 'Unpaid', type: 'pending', icon: CalendarDays }
  if (normalizedStatus === 'Overdue') return { label: 'Overdue', type: 'failed', icon: AlertTriangle }
  if (normalizedStatus === 'Cancelled') return { label: 'Cancelled', type: 'cancelled', icon: XCircle }
  return { label: normalizedStatus, type: 'info', icon: FileText }
}

function InvoiceStatusBadge({ status }) {
  const meta = getInvoiceStatusMeta(status)
  return <StatusBadge type={meta.type} icon={meta.icon}>{meta.label}</StatusBadge>
}

function isWithinDateRange(dateValue, range, customRange = {}) {
  if (!dateValue || range === 'all') {
    return true
  }

  const paymentDate = new Date(`${dateValue}T00:00:00`)
  if (Number.isNaN(paymentDate.getTime())) {
    return true
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (range === 'today') {
    return paymentDate.getTime() === today.getTime()
  }

  if (range === 'last7' || range === 'last30') {
    const days = range === 'last7' ? 7 : 30
    const startDate = new Date(today)
    startDate.setDate(today.getDate() - days + 1)
    return paymentDate >= startDate && paymentDate <= today
  }

  if (range === 'month') {
    return dateValue.startsWith(today.toISOString().slice(0, 7))
  }

  if (range === 'custom') {
    const from = customRange.from ? new Date(`${customRange.from}T00:00:00`) : null
    const to = customRange.to ? new Date(`${customRange.to}T23:59:59`) : null
    if (from && paymentDate < from) return false
    if (to && paymentDate > to) return false
  }

  return true
}

function escapeCsvValue(value) {
  const textValue = String(value ?? '')
  return /[",\n]/.test(textValue) ? `"${textValue.replaceAll('"', '""')}"` : textValue
}

function exportPaymentsToCsv(rows, fileName) {
  const headers = ['Payment No', 'Payment Date', 'Customer', 'Invoice', 'Invoice Status', 'Amount', 'Method', 'Reference', 'Payment Status', 'Created By']
  const lines = rows.map((payment) => [
    paymentNumberFrom(payment),
    payment.paymentDate,
    payment.partyName,
    payment.invoiceNumber,
    getInvoiceStatusMeta(payment.invoiceStatus).label,
    payment.amount,
    payment.paymentMethod,
    payment.referenceNumber,
    getPaymentStatusMeta(payment.status).label,
    payment.createdBy,
  ].map(escapeCsvValue).join(','))
  const blob = new Blob([[headers.map(escapeCsvValue).join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

function escapeXml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function sanitizeFileName(value) {
  return String(value || 'Receipt')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

async function copyToClipboard(value) {
  const text = String(value || '').trim()
  if (!text) return false

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return true
  }

  if (typeof document === 'undefined') return false

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.top = '-1000px'
  document.body.appendChild(textarea)
  textarea.select()

  try {
    return document.execCommand('copy')
  } finally {
    document.body.removeChild(textarea)
  }
}

function getGeneratedTimestamp() {
  return new Date().toLocaleString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatReceiptCurrency(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0))
}

function formatReceiptDate(value) {
  if (!value) return 'N/A'

  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) {
    return formatDate(value) || 'N/A'
  }

  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).replaceAll(' ', '-')
}

function getReceiptCompanyLines() {
  return [
    RECEIPT_COMPANY_PROFILE.address,
    RECEIPT_COMPANY_PROFILE.email ? `Email: ${RECEIPT_COMPANY_PROFILE.email}` : '',
    RECEIPT_COMPANY_PROFILE.phone ? `Phone: ${RECEIPT_COMPANY_PROFILE.phone}` : '',
    RECEIPT_COMPANY_PROFILE.gstNumber ? `GST: ${RECEIPT_COMPANY_PROFILE.gstNumber}` : '',
  ].filter(Boolean)
}

function getInvoiceReceiptStatusClass(status) {
  const normalizedStatus = normalizeInvoiceStatus(status)
  if (normalizedStatus === 'Paid') return 'badge-green'
  if (normalizedStatus === 'Partial') return 'badge-amber'
  return 'badge-red'
}

function getPaymentReceiptStatusClass(status) {
  const normalizedStatus = normalizePaymentStatus({ status })
  if (normalizedStatus === 'Completed') return 'badge-green'
  if (normalizedStatus === 'Pending') return 'badge-amber'
  return 'badge-red'
}

function wrapSvgText(value, maxLength = 44, maxLines = 2) {
  const words = String(value || '-')
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((word) => {
      if (word.length <= maxLength) return [word]
      const chunks = []
      for (let index = 0; index < word.length; index += maxLength) {
        chunks.push(word.slice(index, index + maxLength))
      }
      return chunks
    })
  const lines = []
  let currentLine = ''

  words.forEach((word) => {
    const nextLine = currentLine ? `${currentLine} ${word}` : word
    if (nextLine.length > maxLength && currentLine) {
      lines.push(currentLine)
      currentLine = word
      return
    }

    currentLine = nextLine
  })

  if (currentLine) {
    lines.push(currentLine)
  }

  const visibleLines = lines.slice(0, maxLines)
  if (lines.length > maxLines) {
    visibleLines[maxLines - 1] = `${visibleLines[maxLines - 1].slice(0, Math.max(0, maxLength - 1)).trim()}...`
  }

  return visibleLines.length > 0 ? visibleLines : ['-']
}

function renderSvgMultilineText(value, x, y, options = {}) {
  const {
    maxLength = 44,
    maxLines = 2,
    lineHeight = 18,
    className = 'value',
    anchor = 'start',
  } = options
  const lines = wrapSvgText(value, maxLength, maxLines)

  return `
    <text x="${x}" y="${y}" class="${className}" text-anchor="${anchor}">
      ${lines.map((line, index) => `<tspan x="${x}" dy="${index === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`).join('')}
    </text>
  `
}

function renderReceiptInfoCell(label, value, x, y, width, options = {}) {
  const { maxLength = 30, valueClass = 'cell-value', badgeClass = '', badgeTextClass = 'badge-text' } = options
  return `
    <g>
      <text x="${x}" y="${y}" class="cell-label">${escapeXml(label)}</text>
      ${badgeClass
        ? `<rect x="${x}" y="${y + 12}" width="${Math.min(width - 16, 112)}" height="26" rx="13" class="${badgeClass}"/><text x="${x + Math.min(width - 16, 112) / 2}" y="${y + 30}" class="${badgeTextClass}" text-anchor="middle">${escapeXml(value || '-')}</text>`
        : renderSvgMultilineText(value, x, y + 25, { maxLength, maxLines: 2, lineHeight: 17, className: valueClass })}
    </g>
  `
}

function exportPaymentsToPdf(rows, isSupplier, user) {
  if (!Array.isArray(rows) || rows.length === 0) return

  // A4 Landscape mode for maximum column width and 0 text overwriting
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageMargin = 12
  const pageWidth = 297
  const pageHeight = 210
  const contentWidth = pageWidth - pageMargin * 2

  const titleText = isSupplier ? 'Supplier Payments Executive Statement' : 'Customer Payments Executive Statement'
  const partyHeaderLabel = isSupplier ? 'Supplier Name' : 'Customer Name'
  const referenceHeaderLabel = isSupplier ? 'PO Number' : 'Invoice Number'

  const totalCount = rows.length
  const totalAmount = rows.reduce((acc, row) => acc + (Number(row.amount) || 0), 0)
  const completedCount = rows.filter((r) => {
    const label = getPaymentStatusMeta(r.status).label
    return label === 'Success' || label === 'Completed'
  }).length
  const pendingCount = rows.filter((r) => getPaymentStatusMeta(r.status).label === 'Pending').length

  // Header Banner
  doc.setFillColor(15, 23, 42)
  doc.roundedRect(pageMargin, pageMargin, contentWidth, 22, 3, 3, 'F')

  // Logo box badge
  doc.setFillColor(255, 255, 255)
  doc.roundedRect(pageMargin + 4, pageMargin + 3.5, 15, 15, 3, 3, 'F')
  doc.setTextColor(15, 23, 42)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('IMS', pageMargin + 11.5, pageMargin + 13, { align: 'center' })

  // Header Text
  doc.setFontSize(13)
  doc.setTextColor(255, 255, 255)
  doc.text('StockPilot IMS', pageMargin + 23, pageMargin + 10.5)
  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(148, 163, 184)
  doc.text(titleText, pageMargin + 23, pageMargin + 16)

  // Header Right Meta
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(isSupplier ? 45 : 96, isSupplier ? 212 : 165, isSupplier ? 191 : 250)
  doc.text('OFFICIAL FINANCIAL RECORD', pageWidth - pageMargin - 6, pageMargin + 9.5, { align: 'right' })
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text(`Generated: ${getGeneratedTimestamp()}`, pageWidth - pageMargin - 6, pageMargin + 16, { align: 'right' })

  // Summary Metrics Box - 4 distinct cards
  const startY = pageMargin + 26
  const cardGap = 4
  const cardWidth = (contentWidth - cardGap * 3) / 4
  const cardHeight = 14

  const metricsData = [
    { label: 'TOTAL RECORDS', val: `${totalCount} Payments`, color: [15, 23, 42] },
    { label: 'TOTAL SETTLED AMOUNT', val: formatReceiptCurrency(totalAmount), color: [16, 185, 129] },
    { label: 'COMPLETED / SUCCESS', val: `${completedCount}`, color: [22, 163, 74] },
    { label: 'PENDING RECONCILIATION', val: `${pendingCount}`, color: [217, 119, 6] },
  ]

  metricsData.forEach((m, idx) => {
    const x = pageMargin + idx * (cardWidth + cardGap)
    doc.setFillColor(248, 250, 252)
    doc.setDrawColor(226, 232, 240)
    doc.roundedRect(x, startY, cardWidth, cardHeight, 2, 2, 'FD')

    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(100, 116, 139)
    doc.text(m.label, x + 4, startY + 5)

    doc.setFontSize(9.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(m.color[0], m.color[1], m.color[2])
    doc.text(m.val, x + 4, startY + 11)
  })

  // Table Columns in Landscape Mode (273mm total width)
  const head = [[
    'Payment No',
    'Date',
    partyHeaderLabel,
    referenceHeaderLabel,
    'Amount (INR)',
    'Payment Method',
    'Reference / UTR',
    'Status',
  ]]

  const body = rows.map((payment) => [
    paymentNumberFrom(payment),
    formatReceiptDate(payment.paymentDate),
    payment.partyName || (isSupplier ? 'Supplier' : 'Customer'),
    isSupplier
      ? (payment.poNumber || (payment.poId ? `PO-${String(payment.poId).padStart(3, '0')}` : '-'))
      : (payment.invoiceNumber || (payment.invoiceId ? `INV-${String(payment.invoiceId).padStart(3, '0')}` : '-')),
    formatReceiptCurrency(payment.amount),
    payment.paymentMethod || 'Bank Transfer',
    payment.referenceNumber || 'N/A',
    getPaymentStatusMeta(payment.status).label,
  ])

  autoTable(doc, {
    startY: startY + cardHeight + 4,
    margin: { left: pageMargin, right: pageMargin, bottom: 16 },
    head,
    body,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'left',
      cellPadding: 2.5,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [30, 41, 59],
      cellPadding: 2.5,
      overflow: 'linebreak',
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 36 },
      1: { cellWidth: 26 },
      2: { cellWidth: 54 },
      3: { cellWidth: 34 },
      4: { halign: 'right', fontStyle: 'bold', cellWidth: 32 },
      5: { cellWidth: 30 },
      6: { cellWidth: 35 },
      7: { halign: 'center', cellWidth: 26 },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    didDrawPage: (data) => {
      const pageCount = doc.internal.getNumberOfPages()
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(148, 163, 184)
      doc.text(
        `Generated by StockPilot IMS  |  Page ${data.pageNumber} of ${pageCount}`,
        pageWidth / 2,
        pageHeight - 6,
        { align: 'center' }
      )
    },
  })

  const dateTag = new Date().toISOString().slice(0, 10)
  const filePrefix = isSupplier ? 'Supplier-Payments-Report' : 'Customer-Payments-Report'
  doc.save(`${filePrefix}-${dateTag}.pdf`)
}

function buildReceiptSvg({ payment, invoice, metrics, generatedBy }) {
  const paymentStatus = getPaymentStatusMeta(payment.status).label
  const invoiceStatus = getInvoiceStatusMeta(payment.invoiceStatus).label
  const receiptNumber = paymentNumberFrom(payment)
  const invoiceNumber = getInvoiceNumber(payment, invoice)
  const generatedOn = getGeneratedTimestamp()
  const companyLines = getReceiptCompanyLines()
  const invoiceDate = formatReceiptDate(invoice?.invoiceDate || payment.invoiceDate || payment.paymentDate)
  const remainingBalance = Number(metrics.outstandingAfter || 0)

  const documentTag = 'CUSTOMER PAYMENT RECEIPT'
  const partyTypeLabel = 'Customer'
  const referenceTypeLabel = 'Invoice Number'
  const partyName = payment.partyName || 'Customer'
  const totalLabel = 'Invoice Total Amount'

  const safeIssuedBy = String(generatedBy || 'System Administrator').slice(0, 34)

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${PDF_CANVAS_WIDTH}" height="${PDF_CANVAS_HEIGHT}" viewBox="0 0 ${PDF_CANVAS_WIDTH} ${PDF_CANVAS_HEIGHT}">
      <defs>
        <linearGradient id="headerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0f172a"/>
          <stop offset="50%" stop-color="#1e293b"/>
          <stop offset="100%" stop-color="#2563eb"/>
        </linearGradient>
      </defs>

      <style>
        .page-bg { fill: #f8fafc; }
        .sheet-bg { fill: #ffffff; stroke: #e2e8f0; stroke-width: 1.5; }
        .section-title { fill: #475569; font: 800 11px Arial, sans-serif; letter-spacing: 1.2px; text-transform: uppercase; }
        .card-bg { fill: #f8fafc; stroke: #e2e8f0; stroke-width: 1; }
        .card-label { fill: #64748b; font: 700 10px Arial, sans-serif; letter-spacing: 0.8px; text-transform: uppercase; }
        .card-val { fill: #0f172a; font: 700 13px Arial, sans-serif; }
        .card-val-large { fill: #0f172a; font: 800 14px Arial, sans-serif; }
        
        .brand-name { fill: #ffffff; font: 800 20px Arial, sans-serif; letter-spacing: -0.2px; }
        .brand-sub { fill: #94a3b8; font: 500 11px Arial, sans-serif; }
        .brand-line { fill: #cbd5e1; font: 500 11px Arial, sans-serif; }

        .meta-tag { fill: #60a5fa; font: 800 11px Arial, sans-serif; letter-spacing: 1.2px; }
        .meta-lbl { fill: #94a3b8; font: 700 10px Arial, sans-serif; letter-spacing: 0.6px; }
        .meta-txt { fill: #ffffff; font: 800 12px Consolas, monospace; }

        .stamp-bg { fill: #f3f0fd; stroke: #c7bbf7; stroke-width: 1; }
        .stamp-circle { fill: #6346d9; }
        .stamp-check { fill: #ffffff; font: 900 12px Arial, sans-serif; }
        .stamp-text { fill: #261665; font: 800 12px Arial, sans-serif; letter-spacing: 0.8px; }

        .table-card { fill: #ffffff; stroke: #e2e8f0; stroke-width: 1; }
        .table-head { fill: #f1f5f9; stroke: #e2e8f0; stroke-width: 1; }
        .head-txt { fill: #475569; font: 800 11px Arial, sans-serif; letter-spacing: 0.8px; text-transform: uppercase; }
        .row-line { stroke: #f1f5f9; stroke-width: 1; }
        .cell-desc { fill: #334155; font: 600 13px Arial, sans-serif; }
        .cell-amt { fill: #0f172a; font: 700 13px Consolas, monospace; }

        .current-bg { fill: #f3f0fd; }
        .current-bar { fill: #8b7dfb; }
        .current-desc { fill: #261665; font: 800 13.5px Arial, sans-serif; }
        .current-amt { fill: #2a1580; font: 800 14px Consolas, monospace; }

        .balance-open-bg { fill: #fff7ed; }
        .balance-open-bar { fill: #f97316; }
        .balance-open-desc { fill: #9a3412; font: 800 13.5px Arial, sans-serif; }
        .balance-open-amt { fill: #c2410c; font: 800 14px Consolas, monospace; }

        .balance-paid-bg { fill: #f0fdf4; }
        .balance-paid-bar { fill: #10b981; }
        .balance-paid-desc { fill: #166534; font: 800 13.5px Arial, sans-serif; }
        .balance-paid-amt { fill: #15803d; font: 800 14px Consolas, monospace; }

        .badge-bg-green { fill: #dcfce7; stroke: #86efac; stroke-width: 1; }
        .badge-txt-green { fill: #15803d; font: 800 11px Arial, sans-serif; }
        .badge-bg-amber { fill: #fff7ed; stroke: #fed7aa; stroke-width: 1; }
        .badge-txt-amber { fill: #c2410c; font: 800 11px Arial, sans-serif; }
        .badge-bg-red { fill: #fef2f2; stroke: #fca5a5; stroke-width: 1; }
        .badge-txt-red { fill: #b91c1c; font: 800 11px Arial, sans-serif; }

        .sig-line { stroke: #cbd5e1; stroke-width: 1.5; stroke-dasharray: 4 3; }
        .sig-lbl { fill: #64748b; font: 700 11px Arial, sans-serif; letter-spacing: 0.6px; text-transform: uppercase; }
        .seal-bg { fill: #ffffff; stroke: #cbd5e1; stroke-width: 2; stroke-dasharray: 3 3; }
        .seal-txt { fill: #94a3b8; font: 800 9px Arial, sans-serif; }

        .footer-note { fill: #64748b; font: 500 11px Arial, sans-serif; }
        .footer-box { fill: #f8fafc; stroke: #e2e8f0; stroke-width: 1; }
        .footer-meta { fill: #94a3b8; font: 600 11px Arial, sans-serif; }
      </style>

      <rect class="page-bg" width="${PDF_CANVAS_WIDTH}" height="${PDF_CANVAS_HEIGHT}"/>
      <rect class="sheet-bg" x="32" y="32" width="730" height="1059" rx="16"/>

      <!-- Header Banner -->
      <rect x="52" y="52" width="690" height="100" rx="12" fill="url(#headerGrad)"/>
      <rect x="72" y="72" width="56" height="56" rx="12" fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.3)"/>
      <text x="100" y="107" text-anchor="middle" fill="#ffffff" font-weight="900" font-size="20" letter-spacing="1">IMS</text>
      
      <text x="142" y="85" class="brand-name">${escapeXml(RECEIPT_COMPANY_PROFILE.name || RECEIPT_COMPANY_NAME)}</text>
      <text x="142" y="101" class="brand-sub">Inventory &amp; Financial Management System</text>
      ${companyLines.slice(0, 1).map((line) => `<text x="142" y="116" class="brand-line">${escapeXml(wrapSvgText(line, 40, 1)[0])}</text>`).join('')}

      <rect x="490" y="66" width="232" height="26" rx="13" fill="rgba(96,165,250,0.18)" stroke="rgba(96,165,250,0.4)"/>
      <text x="606" y="83" text-anchor="middle" class="meta-tag">${escapeXml(documentTag)}</text>

      <text x="550" y="110" text-anchor="end" class="meta-lbl">RECEIPT NO:</text>
      <text x="558" y="110" class="meta-txt">${escapeXml(receiptNumber)}</text>
      <text x="550" y="128" text-anchor="end" class="meta-lbl">DATE:</text>
      <text x="558" y="128" class="meta-txt">${escapeXml(formatReceiptDate(payment.paymentDate))}</text>

      <!-- Watermark Stamp -->
      <rect class="stamp-bg" x="52" y="168" width="690" height="38" rx="8"/>
      <circle class="stamp-circle" cx="76" cy="187" r="10"/>
      <text class="stamp-check" x="76" y="191" text-anchor="middle">✓</text>
      <text class="stamp-text" x="96" y="191">OFFICIAL SETTLEMENT RECEIPT — RECORDED</text>

      <!-- Section 1: Details Card -->
      <text class="section-title" x="52" y="232">${escapeXml(partyTypeLabel.toUpperCase())} &amp; DETAILS</text>
      <rect class="card-bg" x="52" y="244" width="690" height="92" rx="10"/>
      <line x1="224" y1="244" x2="224" y2="336" stroke="#e2e8f0"/>
      <line x1="396" y1="244" x2="396" y2="336" stroke="#e2e8f0"/>
      <line x1="568" y1="244" x2="568" y2="336" stroke="#e2e8f0"/>

      <text class="card-label" x="70" y="268">${escapeXml(partyTypeLabel)} Name</text>
      ${renderSvgMultilineText(partyName, 70, 292, { maxLength: 20, maxLines: 2, className: 'card-val-large' })}

      <text class="card-label" x="242" y="268">${escapeXml(referenceTypeLabel)}</text>
      <text class="card-val" x="242" y="292">${escapeXml(invoiceNumber)}</text>

      <text class="card-label" x="414" y="268">Date</text>
      <text class="card-val" x="414" y="292">${escapeXml(invoiceDate)}</text>

      <text class="card-label" x="586" y="268">Status</text>
      <rect class="${getInvoiceReceiptStatusClass(invoiceStatus)}" x="582" y="278" width="124" height="26" rx="13"/>
      <text class="${getInvoiceReceiptStatusClass(invoiceStatus).replace('badge-', 'badge-txt-')}" x="644" y="295" text-anchor="middle">${escapeXml(invoiceStatus)}</text>

      <!-- Section 2: Financial Breakdown Table -->
      <text class="section-title" x="52" y="362">FINANCIAL SETTLEMENT BREAKDOWN</text>
      <rect class="table-card" x="52" y="374" width="690" height="220" rx="10"/>
      <rect class="table-head" x="52" y="374" width="690" height="36" rx="10"/>
      <text class="head-txt" x="72" y="397">Description</text>
      <text class="head-txt" x="722" y="397" text-anchor="end">Amount</text>

      <!-- Table Rows -->
      <line class="row-line" x1="52" y1="410" x2="742" y2="410"/>
      <text class="cell-desc" x="72" y="434">${escapeXml(totalLabel)}</text>
      <text class="cell-amt" x="722" y="434" text-anchor="end">${escapeXml(formatReceiptCurrency(metrics.invoiceTotal))}</text>

      <line class="row-line" x1="52" y1="455" x2="742" y2="455"/>
      <text class="cell-desc" x="72" y="479">Previous Cumulative Payments</text>
      <text class="cell-amt" x="722" y="479" text-anchor="end">${escapeXml(formatReceiptCurrency(metrics.previousPayments))}</text>

      <!-- Current Payment Row -->
      <rect class="current-bg" x="53" y="500" width="688" height="46"/>
      <rect class="current-bar" x="53" y="500" width="5" height="46"/>
      <text class="current-desc" x="72" y="528">Current Payment Settled</text>
      <text class="current-amt" x="722" y="528" text-anchor="end">${escapeXml(formatReceiptCurrency(payment.amount))}</text>

      <!-- Remaining Balance Row -->
      <rect class="${remainingBalance > 0 ? 'balance-open-bg' : 'balance-paid-bg'}" x="53" y="547" width="688" height="46"/>
      <rect class="${remainingBalance > 0 ? 'balance-open-bar' : 'balance-paid-bar'}" x="53" y="547" width="5" height="46"/>
      <text class="${remainingBalance > 0 ? 'balance-open-desc' : 'balance-paid-desc'}" x="72" y="575">Remaining Outstanding Balance</text>
      <text class="${remainingBalance > 0 ? 'balance-open-amt' : 'balance-paid-amt'}" x="722" y="575" text-anchor="end">${escapeXml(formatReceiptCurrency(metrics.outstandingAfter))}</text>

      <!-- Section 3: Payment Method & Details -->
      <text class="section-title" x="52" y="622">PAYMENT METHOD &amp; EXECUTION</text>
      <rect class="card-bg" x="52" y="634" width="690" height="84" rx="10"/>
      <line x1="282" y1="634" x2="282" y2="718" stroke="#e2e8f0"/>
      <line x1="512" y1="634" x2="512" y2="718" stroke="#e2e8f0"/>

      <text class="card-label" x="70" y="658">Payment Method</text>
      <text class="card-val" x="70" y="682">${escapeXml(payment.paymentMethod || 'Bank Transfer')}</text>

      <text class="card-label" x="300" y="658">Reference / UTR Number</text>
      <text class="card-val" x="300" y="682">${escapeXml(payment.referenceNumber || 'N/A')}</text>

      <text class="card-label" x="530" y="658">Payment Status</text>
      <rect class="${getPaymentReceiptStatusClass(payment.status)}" x="530" y="668" width="124" height="26" rx="13"/>
      <text class="${getPaymentReceiptStatusClass(payment.status).replace('badge-', 'badge-txt-')}" x="592" y="685" text-anchor="middle">${escapeXml(paymentStatus)}</text>

      <!-- Section 4: Signature & Stamp -->
      <text class="section-title" x="52" y="746">AUTHORIZATION &amp; SIGNATURE</text>
      <line class="sig-line" x1="72" y1="810" x2="350" y2="810"/>
      <text class="sig-lbl" x="211" y="830" text-anchor="middle">Customer Signature</text>

      <circle class="seal-bg" cx="560" cy="790" r="22"/>
      <text class="seal-txt" x="560" y="793" text-anchor="middle">SEAL</text>
      <line class="sig-line" x1="440" y1="810" x2="720" y2="810"/>
      <text class="sig-lbl" x="580" y="830" text-anchor="middle">Authorized Signatory</text>

      <!-- Footer Audit -->
      <line x1="52" y1="880" x2="742" y2="880" stroke="#e2e8f0"/>
      <text class="footer-note" x="397" y="904" text-anchor="middle">This is a computer-generated official payment receipt issued by StockPilot IMS. Valid without physical signature.</text>
      
      <rect class="footer-box" x="52" y="920" width="690" height="34" rx="6"/>
      <text class="footer-meta" x="70" y="941">Generated On: ${escapeXml(generatedOn)}</text>
      <text class="footer-meta" x="397" y="941" text-anchor="middle">Issued By: ${escapeXml(safeIssuedBy)}</text>
      <text class="footer-meta" x="724" y="941" text-anchor="end">System: ${escapeXml(RECEIPT_SYSTEM_NAME)}</text>
    </svg>
  `
}

function getImageSizeFromDataUrl(dataUrl) {
  const [, base64 = ''] = dataUrl.split(',')
  const binary = atob(base64)
  return binary
}

function buildSingleImagePdf(jpegDataUrl) {
  const imageBinary = getImageSizeFromDataUrl(jpegDataUrl)
  const contentStream = `q\n${PDF_PAGE_WIDTH} 0 0 ${PDF_PAGE_HEIGHT} 0 0 cm\n/Im1 Do\nQ\n`
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PDF_PAGE_WIDTH} ${PDF_PAGE_HEIGHT}] /Resources << /XObject << /Im1 4 0 R >> >> /Contents 5 0 R >>`,
    `<< /Type /XObject /Subtype /Image /Width ${PDF_CANVAS_WIDTH} /Height ${PDF_CANVAS_HEIGHT} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imageBinary.length} >>\nstream\n${imageBinary}\nendstream`,
    `<< /Length ${contentStream.length} >>\nstream\n${contentStream}endstream`,
  ]
  let pdf = '%PDF-1.4\n'
  const offsets = [0]

  objects.forEach((object, index) => {
    offsets.push(pdf.length)
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`
  })

  const xrefOffset = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`
  })
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`

  const bytes = new Uint8Array(pdf.length)
  for (let index = 0; index < pdf.length; index += 1) {
    bytes[index] = pdf.charCodeAt(index) & 0xff
  }

  return new Blob([bytes], { type: 'application/pdf' })
}

async function renderSvgToJpegDataUrl(svgMarkup) {
  const image = new Image()
  const svgBlob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(svgBlob)

  try {
    await new Promise((resolve, reject) => {
      image.onload = resolve
      image.onerror = reject
      image.src = url
    })

    const canvas = document.createElement('canvas')
    canvas.width = PDF_CANVAS_WIDTH
    canvas.height = PDF_CANVAS_HEIGHT
    const context = canvas.getContext('2d')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.96)
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function downloadPaymentReceiptPdf({ payment, invoice, allPayments, generatedBy }) {
  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    throw new Error('PDF generation is only available in the browser.')
  }

  const metrics = getReceiptAllocationMetrics(payment, invoice, allPayments)
  const svgMarkup = buildReceiptSvg({ payment, invoice, metrics, generatedBy })
  const jpegDataUrl = await renderSvgToJpegDataUrl(svgMarkup)
  const pdfBlob = buildSingleImagePdf(jpegDataUrl)
  const url = URL.createObjectURL(pdfBlob)
  const anchor = document.createElement('a')
  const receiptNumber = sanitizeFileName(paymentNumberFrom(payment))
  anchor.href = url
  anchor.download = `Customer-Payment-Receipt-${receiptNumber}.pdf`
  anchor.click()
  URL.revokeObjectURL(url)
}

function getPaymentLoadErrorMessage(message) {
  const rawMessage = String(message || '').trim()

  if (!rawMessage) {
    return 'Unable to load payment data right now.'
  }

  if (/unknown column|unknown table|sql|mysql|database|exception|stack|system\.|microsoft\./i.test(rawMessage)) {
    return 'Unable to load payment data right now.'
  }

  return rawMessage
}

function getInvoiceId(invoice) {
  return String(invoice?.invoiceId || invoice?.id || '')
}

function getInvoiceNumber(payment, invoice) {
  return payment.invoiceNumber || invoice?.invoiceNumber || (payment.invoiceId ? `INV-${String(payment.invoiceId).padStart(3, '0')}` : 'Not applied')
}

function getInvoiceMetrics(payment, invoice) {
  const invoiceTotal = Number(payment.invoiceAmount || invoice?.totalAmount || 0)
  const outstandingAfter = Number(payment.outstandingAfter || invoice?.balanceAmount || 0)
  const outstandingBefore = Number(payment.outstandingBefore || outstandingAfter + Number(payment.amount || 0))

  return {
    invoiceTotal,
    alreadyPaid: Math.max(0, invoiceTotal - Number(invoice?.balanceAmount || 0)),
    outstandingBefore,
    outstandingAfter: Math.max(0, outstandingAfter),
  }
}

function getPaymentSequenceValue(payment) {
  const rawId = payment?.paymentId ?? payment?.id
  const numericId = Number(rawId)
  if (Number.isFinite(numericId) && numericId > 0) {
    return numericId
  }

  const paymentNumberMatch = String(paymentNumberFrom(payment)).match(/(\d+)(?!.*\d)/)
  return paymentNumberMatch ? Number(paymentNumberMatch[1]) : 0
}

function getPaymentSortKey(payment) {
  return [
    payment?.createdAt || payment?.paymentDate || '',
    payment?.paymentDate || '',
    String(getPaymentSequenceValue(payment)).padStart(12, '0'),
    paymentNumberFrom(payment),
  ].join('|')
}

function isSameInvoicePayment(payment, selectedPayment, invoice) {
  const selectedInvoiceId = String(selectedPayment?.invoiceId || invoice?.invoiceId || invoice?.id || '').trim()
  const paymentInvoiceId = String(payment?.invoiceId || '').trim()

  if (selectedInvoiceId && paymentInvoiceId) {
    return paymentInvoiceId === selectedInvoiceId
  }

  const selectedInvoiceNumber = getInvoiceNumber(selectedPayment, invoice)
  const paymentInvoiceNumber = getInvoiceNumber(payment, null)
  return selectedInvoiceNumber !== 'Not applied' && paymentInvoiceNumber === selectedInvoiceNumber
}

function isEffectiveReceiptPayment(payment) {
  const status = normalizePaymentStatus(payment)
  return status !== 'Cancelled' && status !== 'Failed' && status !== 'Reversed'
}

function getReceiptAllocationMetrics(payment, invoice, allPayments = []) {
  const baseMetrics = getInvoiceMetrics(payment, invoice)
  const selectedSortKey = getPaymentSortKey(payment)
  const selectedRowId = getPaymentRowId(payment)
  const previousPayments = allPayments
    .filter((candidate) => (
      getPaymentRowId(candidate) !== selectedRowId
      && isEffectiveReceiptPayment(candidate)
      && isSameInvoicePayment(candidate, payment, invoice)
      && getPaymentSortKey(candidate) < selectedSortKey
    ))
    .reduce((sum, candidate) => sum + Number(candidate.amount || 0), 0)
  const currentPayment = Number(payment.amount || 0)
  const outstandingAfter = Math.max(0, baseMetrics.invoiceTotal - previousPayments - currentPayment)

  return {
    ...baseMetrics,
    previousPayments,
    outstandingAfter,
  }
}

function getInvoicePaymentHistory(payment, invoice, allPayments = []) {
  return allPayments
    .filter((candidate) => isEffectiveReceiptPayment(candidate) && isSameInvoicePayment(candidate, payment, invoice))
    .sort((firstPayment, secondPayment) => getPaymentSortKey(firstPayment).localeCompare(getPaymentSortKey(secondPayment)))
}

function getBalanceTone(metrics, invoiceStatus) {
  if (Number(metrics.outstandingAfter || 0) <= 0) return 'paid'
  return normalizeInvoiceStatus(invoiceStatus) === 'Overdue' ? 'overdue' : 'partial'
}

function getPaymentProgressPercent(metrics, payment) {
  const invoiceTotal = Number(metrics.invoiceTotal || 0)
  if (invoiceTotal <= 0) return 0

  const paidAmount = Math.min(invoiceTotal, Number(metrics.previousPayments || 0) + Number(payment.amount || 0))
  return Math.round((paidAmount / invoiceTotal) * 100)
}

function readStoredPaymentColumns(storageKey) {
  try {
    if (typeof window === 'undefined') {
      return null
    }

    const storedValue = window.localStorage.getItem(storageKey)
    const parsedValue = storedValue ? JSON.parse(storedValue) : null
    if (!Array.isArray(parsedValue)) {
      return null
    }

    return parsedValue.filter(Boolean)
  } catch {
    return null
  }
}

function PaymentSummaryCard({ icon: Icon, label, value, helper }) {
  return (
    <StatisticsCard
      icon={Icon}
      label={label}
      value={value}
      helper={helper}
      className="payments-page__summary-card"
    />
  )
}

function DetailItem({ label, value, wide = false }) {
  return (
    <div className={`payment-detail-item ${wide ? 'payment-detail-item--wide' : ''}`.trim()}>
      <dt>{label}</dt>
      <dd>{value || '-'}</dd>
    </div>
  )
}

function PaymentDetailsDrawer({ payment, invoice, allPayments = [], onClose, onPrint, onDownloadReceipt, onOpenInvoice }) {
  const [activePayment, setActivePayment] = useState(payment)
  const [copiedKey, setCopiedKey] = useState('')

  useEffect(() => {
    setActivePayment(payment)
  }, [payment])

  useEffect(() => {
    if (!copiedKey) return undefined

    const timeoutId = window.setTimeout(() => {
      setCopiedKey('')
    }, 1200)

    return () => window.clearTimeout(timeoutId)
  }, [copiedKey])

  const status = normalizePaymentStatus(activePayment)
  const invoiceStatus = normalizeInvoiceStatus(activePayment.invoiceStatus)
  const metrics = getReceiptAllocationMetrics(activePayment, invoice, allPayments)
  const paymentHistory = getInvoicePaymentHistory(activePayment, invoice, allPayments)
  const balanceTone = getBalanceTone(metrics, invoiceStatus)
  const progressPercent = getPaymentProgressPercent(metrics, activePayment)
  const invoiceTotal = Number(metrics.invoiceTotal || 0)
  const paidAmount = Math.max(0, Math.min(invoiceTotal, invoiceTotal - Number(metrics.outstandingAfter || 0)))
  const timelineTotalCollected = paymentHistory.reduce((sum, historyPayment) => sum + Number(historyPayment.amount || 0), 0)
  const activePaymentRowId = getPaymentRowId(activePayment)
  const invoiceNumber = getInvoiceNumber(activePayment, invoice)
  const referenceNumber = activePayment.referenceNumber || ''
  const paymentSummaryRows = [
    { label: 'Invoice Total', value: formatCurrency(metrics.invoiceTotal) },
    { label: 'Previous Payments', value: formatCurrency(metrics.previousPayments) },
    { label: 'Current Payment', value: formatCurrency(activePayment.amount), emphasis: true },
    { label: 'Remaining Balance', value: formatCurrency(metrics.outstandingAfter), strong: true, tone: balanceTone },
  ]
  const handleCopy = async (value, key) => {
    try {
      const didCopy = await copyToClipboard(value)
      if (didCopy) {
        setCopiedKey(key)
        showToast({ type: 'success', title: 'Receipt', message: 'Copied to clipboard' })
      }
    } catch {
      showToast({ type: 'error', title: 'Receipt', message: 'Unable to copy value.' })
    }
  }

  return (
    <div className="payment-drawer payment-drawer--landscape" role="dialog" aria-modal="true" aria-labelledby="payment-drawer-title">
      <button type="button" className="payment-drawer__backdrop" aria-label="Close payment details" onClick={onClose} />
      <aside className="payment-drawer__panel">
        <header className="payment-drawer__header">
          <div className="payment-drawer__title-group">
            <p className="payment-drawer__eyebrow">Receipt</p>
            <h2 id="payment-drawer-title">{paymentNumberFrom(activePayment)}</h2>
            <div className="payment-drawer__header-meta">
              <PaymentStatusBadge status={status} />
              <span>{formatDate(activePayment.paymentDate)}</span>
            </div>
          </div>
          <button type="button" className="button button-secondary payment-drawer__close" onClick={onClose} aria-label="Close payment details">
            <X size={15} />
          </button>
        </header>

        <section className="payment-drawer__summary-card" aria-label="Payment summary">
          <div className="payment-drawer__summary-main">
            <div>
              <h3>
                <span>{paymentNumberFrom(activePayment)}</span>
                <button
                  type="button"
                  className={`payment-copy-button ${copiedKey === 'payment-number' ? 'is-copied' : ''}`.trim()}
                  onClick={() => handleCopy(paymentNumberFrom(activePayment), 'payment-number')}
                  aria-label="Copy payment number"
                  title={copiedKey === 'payment-number' ? 'Copied' : 'Copy payment number'}
                >
                  <Copy size={13} />
                </button>
              </h3>
              <div className="payment-drawer__summary-meta">
                <PaymentStatusBadge status={status} />
                <span>{formatDate(activePayment.paymentDate)}</span>
              </div>
            </div>
            <strong>{formatCurrency(activePayment.amount)}</strong>
          </div>
          <div className="payment-drawer__summary-customer">
            <span>Customer</span>
            <strong>{activePayment.partyName || 'Customer'}</strong>
          </div>
        </section>

        <div className="payment-drawer__content">
          <section className="payment-drawer__finance-card" aria-label="Financial summary">
            <div className="payment-drawer__section-header">
              <h3>Financial Summary</h3>
              <InvoiceStatusBadge status={invoiceStatus} />
            </div>

            <div className="payment-drawer__progress">
              <div className="payment-drawer__progress-copy">
                <span>Payment Progress</span>
              </div>
              <div className={`payment-drawer__progress-track payment-drawer__progress-track--${balanceTone}`} aria-label={`Payment progress ${progressPercent}%`}>
                <span style={{ width: `${progressPercent}%` }} />
              </div>
              <div className="payment-drawer__progress-values">
                <span>Paid <strong>{formatCurrency(paidAmount)}</strong></span>
                <span>Remaining <strong>{formatCurrency(metrics.outstandingAfter)}</strong></span>
              </div>
            </div>

            <div className="payment-receipt__summary" aria-label="Payment allocation summary">
              {paymentSummaryRows.map((row) => (
                <div
                  key={row.label}
                  className={[
                    'payment-receipt__summary-row',
                    row.emphasis ? 'payment-receipt__summary-row--emphasis' : '',
                    row.strong ? 'payment-receipt__summary-row--strong' : '',
                    row.tone ? `payment-receipt__summary-row--${row.tone}` : '',
                  ].filter(Boolean).join(' ')}
                >
                  <span>{row.label}</span>
                  <strong>{row.value}</strong>
                </div>
              ))}
            </div>
          </section>

          <section className="payment-drawer__section payment-drawer__section--compact">
            <div className="payment-drawer__section-header">
              <h3>Payment Information</h3>
              <span className="payment-drawer__invoice-actions">
                <button type="button" className="payment-drawer__invoice-link" onClick={() => onOpenInvoice?.(activePayment, invoice)}>
                  {invoiceNumber}
                </button>
                <button
                  type="button"
                  className={`payment-copy-button ${copiedKey === 'invoice-number' ? 'is-copied' : ''}`.trim()}
                  onClick={() => handleCopy(invoiceNumber, 'invoice-number')}
                  aria-label="Copy invoice number"
                  title={copiedKey === 'invoice-number' ? 'Copied' : 'Copy invoice number'}
                >
                  <Copy size={13} />
                </button>
              </span>
            </div>
            <dl className="payment-info-inline">
              <DetailItem label="Method" value={activePayment.paymentMethod || 'Not Provided'} />
              <DetailItem
                label="Reference Number"
                value={referenceNumber ? (
                  <span className="payment-detail-copy-value">
                    <span>{referenceNumber}</span>
                    <button
                      type="button"
                      className={`payment-copy-button ${copiedKey === 'reference-number' ? 'is-copied' : ''}`.trim()}
                      onClick={() => handleCopy(referenceNumber, 'reference-number')}
                      aria-label="Copy reference number"
                      title={copiedKey === 'reference-number' ? 'Copied' : 'Copy reference number'}
                    >
                      <Copy size={13} />
                    </button>
                  </span>
                ) : 'Not Provided'}
              />
              <DetailItem label="Notes" value={activePayment.notes || 'No Notes Available'} wide />
            </dl>
          </section>

          <section className="payment-drawer__section payment-drawer__timeline-card">
            <div className="payment-drawer__timeline-header">
              <div>
                <h3>Payment History</h3>
                <span>{paymentHistory.length} Payment{paymentHistory.length === 1 ? '' : 's'} Recorded</span>
              </div>
              <strong>Total Collected: {formatCurrency(timelineTotalCollected)}</strong>
            </div>
            {paymentHistory.length > 0 ? (
              <ol className="payment-drawer__timeline-list">
                {paymentHistory.map((historyPayment) => {
                  const historyPaymentRowId = getPaymentRowId(historyPayment)
                  const isActiveTimelinePayment = historyPaymentRowId === activePaymentRowId

                  return (
                    <li key={historyPaymentRowId} className={isActiveTimelinePayment ? 'is-active' : ''}>
                      <span aria-hidden="true" />
                      <button type="button" onClick={() => setActivePayment(historyPayment)} aria-current={isActiveTimelinePayment ? 'true' : undefined}>
                        <strong>{paymentNumberFrom(historyPayment)}</strong>
                        <span className="payment-drawer__timeline-amount">{formatCurrency(historyPayment.amount)}</span>
                        <time>{formatDate(historyPayment.paymentDate || historyPayment.createdAt)}</time>
                      </button>
                    </li>
                  )
                })}
              </ol>
            ) : (
              <div className="payment-drawer__empty-state">
                No Previous Payments
              </div>
            )}
          </section>
        </div>

        <footer className="payment-drawer__footer">
          <p className="payment-drawer__recorded-line">
            Recorded on {formatDate(activePayment.createdAt || activePayment.paymentDate)} by {activePayment.createdBy || 'System'}
          </p>
          <div className="payment-drawer__actions">
            <button type="button" className="button button-secondary" onClick={() => onDownloadReceipt(activePayment)}>
              <FileText size={16} />
              Download PDF
            </button>
            <button type="button" className="button button-primary" onClick={() => onPrint([activePayment])}>
              <Printer size={16} />
              Print Receipt
            </button>
          </div>
        </footer>
      </aside>
    </div>
  )
}

// Kept briefly as a rollback reference while this drawer UX is being verified.
function LegacyPaymentDetailsDrawer({ payment, invoice, onClose, onPrint, onExport }) {
  const status = normalizePaymentStatus(payment)
  const invoiceStatus = normalizeInvoiceStatus(payment.invoiceStatus)
  const metrics = getInvoiceMetrics(payment, invoice)
  const allocationRows = [
    { label: 'Invoice total', value: formatCurrency(metrics.invoiceTotal) },
    { label: 'Outstanding before', value: formatCurrency(metrics.outstandingBefore) },
    { label: 'Applied amount', value: formatCurrency(payment.amount) },
    { label: 'Outstanding after', value: formatCurrency(metrics.outstandingAfter) },
  ]

  return (
    <div className="payment-drawer" role="dialog" aria-modal="true" aria-labelledby="payment-drawer-title">
      <button type="button" className="payment-drawer__backdrop" aria-label="Close payment details" onClick={onClose} />
      <aside className="payment-drawer__panel">
        <header className="payment-drawer__header">
          <div>
            <p className="payment-drawer__eyebrow">Receipt</p>
            <h2 id="payment-drawer-title">{paymentNumberFrom(payment)}</h2>
            <p>{payment.partyName || 'Customer'} · {formatDate(payment.paymentDate)}</p>
          </div>
          <button type="button" className="button button-secondary payment-drawer__close" onClick={onClose} aria-label="Close payment details">
            <X size={15} />
          </button>
        </header>

        <div className="payment-drawer__amount">
          <span>Payment amount</span>
          <strong>{formatCurrency(payment.amount)}</strong>
          <PaymentStatusBadge status={status} />
        </div>

        <section className="payment-drawer__section">
          <div className="payment-drawer__section-header">
            <h3>Payment Details</h3>
          </div>
          <dl className="payment-drawer__definition-list">
            <DetailItem label="Method" value={payment.paymentMethod} />
            <DetailItem label="Payment Status" value={getPaymentStatusMeta(status).label} />
            <DetailItem label="Reference" value={payment.referenceNumber || (payment.id || payment.paymentId ? `REF-PAY-${String(payment.id || payment.paymentId).padStart(4, '0')}` : 'Not provided')} />
            <DetailItem label="Created By" value={payment.createdBy || 'System'} />
            <DetailItem label="Created Date" value={formatDate(payment.createdAt || payment.paymentDate)} />
          </dl>
        </section>

        <section className="payment-drawer__section">
          <div className="payment-drawer__section-header">
            <h3>Customer Details</h3>
          </div>
          <dl className="payment-drawer__definition-list">
            <DetailItem label="Customer" value={payment.partyName} />
            <DetailItem label="Invoice" value={getInvoiceNumber(payment, invoice)} />
            <DetailItem label="Invoice Status" value={invoiceStatus} />
          </dl>
        </section>

        <section className="payment-drawer__section">
          <div className="payment-drawer__section-header">
            <h3>Invoice Allocations</h3>
          </div>
          <div className="payment-drawer__allocation-list">
            {allocationRows.map((row) => (
              <div key={row.label}>
                <span>{row.label}</span>
                <strong>{row.value}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="payment-drawer__section">
          <div className="payment-drawer__section-header">
            <h3>Audit History</h3>
          </div>
          <ol className="payment-drawer__timeline">
            <li>
              <span />
              <div>
                <strong>Payment recorded</strong>
                <p>{formatDate(payment.createdAt || payment.paymentDate)} by {payment.createdBy || 'System'}</p>
              </div>
            </li>
            {status === 'Cancelled' ? (
              <li>
                <span />
                <div>
                  <strong>Payment voided</strong>
                  <p>{formatDate(payment.cancelledAt)} · {payment.cancellationReason || 'No reason recorded'}</p>
                </div>
              </li>
            ) : null}
          </ol>
        </section>

        <footer className="payment-drawer__footer">
          <button type="button" className="button button-secondary" onClick={() => onExport([payment])}>
            <Download size={16} />
            Download Receipt
          </button>
          <button type="button" className="button button-primary" onClick={() => onPrint([payment])}>
            <Printer size={16} />
            Print Receipt
          </button>
        </footer>
      </aside>
    </div>
  )
}

function PaymentEditModal({ payment, invoice, onSubmit, onClose, isSubmitting }) {
  const [formData, setFormData] = useState({
    amount: String(payment.amount || ''),
    paymentMethod: payment.paymentMethod || 'Bank Transfer',
    referenceNumber: payment.referenceNumber || '',
    notes: payment.notes || '',
  })
  const [touched, setTouched] = useState({})
  const metrics = getInvoiceMetrics(payment, invoice)
  const editableOutstanding = metrics.outstandingAfter + Number(payment.amount || 0)

  const errors = {
    amount:
      getNumberError(formData.amount, 'Amount', { allowZero: false }) ||
      (Number(formData.amount) > editableOutstanding ? `Amount cannot exceed ${formatCurrency(editableOutstanding)}.` : ''),
    referenceNumber: formData.referenceNumber.length > 100 ? 'Reference number must be 100 characters or fewer.' : '',
    notes: formData.notes.length > 500 ? 'Notes must be 500 characters or fewer.' : '',
  }
  const isFormValid = Object.values(errors).every((value) => !value)

  function handleChange(event) {
    const { name, value } = event.target
    setFormData((currentValue) => ({ ...currentValue, [name]: value }))
  }

  function handleBlur(event) {
    setTouched((currentValue) => ({ ...currentValue, [event.target.name]: true }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    setTouched({ amount: true, referenceNumber: true, notes: true })

    if (!isFormValid || isSubmitting) {
      return
    }

    onSubmit(payment, formData)
  }

  return (
    <FormModal
      title="Edit Payment"
      subtitle="Update receipt values without changing the customer, invoice, or payment number."
      onClose={onClose}
    >
      <form className="payment-form payment-edit-form" onSubmit={handleSubmit}>
        <div className="payment-form__readonly-grid">
          <DetailItem label="Payment Number" value={paymentNumberFrom(payment)} />
          <DetailItem label="Customer" value={payment.partyName} />
          <DetailItem label="Invoice Number" value={getInvoiceNumber(payment, invoice)} />
        </div>

        <div className="form-grid">
          <CurrencyInput
            id="payment-edit-amount"
            name="amount"
            label="Amount"
            value={formData.amount}
            onChange={handleChange}
            onBlur={handleBlur}
            error={touched.amount ? errors.amount : ''}
          />
          <SearchableSelect
            id="payment-edit-method"
            name="paymentMethod"
            label="Payment method"
            value={formData.paymentMethod}
            onChange={handleChange}
            options={PAYMENT_METHODS}
          />
          <InputField
            id="payment-edit-reference"
            name="referenceNumber"
            label="Reference number"
            value={formData.referenceNumber}
            maxLength={100}
            onChange={handleChange}
            onBlur={handleBlur}
            error={touched.referenceNumber ? errors.referenceNumber : ''}
          />
          <InputField
            id="payment-edit-notes"
            name="notes"
            label="Notes"
            textarea
            rows={4}
            maxLength={500}
            className="field--full"
            value={formData.notes}
            onChange={handleChange}
            onBlur={handleBlur}
            error={touched.notes ? errors.notes : ''}
          />
        </div>

        <div className="button-row payment-form__footer">
          <button type="submit" className="button button-primary" disabled={!isFormValid || isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </button>
          <button type="button" className="button button-cancel" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </button>
        </div>
      </form>
    </FormModal>
  )
}

function PaymentForm({
  type,
  partyLabel,
  parties,
  invoices,
  purchaseOrders,
  existingPayments,
  onSubmit,
  onCancel,
  isSubmitting,
}) {
  const isSupplier = type === 'supplier'
  const [formData, setFormData] = useState({
    partyId: '',
    invoiceId: '',
    poId: '',
    amount: '',
    paymentDate: getToday(),
    paymentMethod: 'Bank Transfer',
    referenceNumber: '',
    notes: '',
  })
  const [touched, setTouched] = useState({})

  const selectedInvoice = useMemo(
    () => invoices.find((invoice) => getInvoiceId(invoice) === String(formData.invoiceId)),
    [formData.invoiceId, invoices],
  )
  const invoiceTotal = Number(selectedInvoice?.totalAmount || 0)
  const alreadyPaid = Number(selectedInvoice?.paidAmount || 0)
  const outstandingBalance = Number(selectedInvoice?.balanceAmount || 0)
  const currentPayment = Number(formData.amount || 0)
  const balanceAfterPayment = Math.max(0, outstandingBalance - currentPayment)

  const normalizedReference = formData.referenceNumber.trim().toLowerCase()
  const duplicateReference =
    normalizedReference &&
    existingPayments.some((payment) =>
      payment.referenceNumber.trim().toLowerCase() === normalizedReference,
    )

  const errors = {
    partyId: getRequiredError(formData.partyId, partyLabel),
    invoiceId: !isSupplier ? getRequiredError(formData.invoiceId, 'Invoice') : '',
    poId: isSupplier ? getRequiredError(formData.poId, 'Purchase order') : '',
    amount:
      getNumberError(formData.amount, 'Amount', { allowZero: false }) ||
      (!isSupplier && selectedInvoice && Number(formData.amount) > outstandingBalance
        ? 'Amount cannot exceed outstanding balance.'
        : ''),
    paymentDate: getRequiredError(formData.paymentDate, 'Payment date'),
    referenceNumber:
      formData.referenceNumber.length > 100
        ? 'Reference number must be 100 characters or fewer.'
        : duplicateReference
          ? 'This reference number is already used.'
          : '',
    notes: formData.notes.length > 500 ? 'Notes must be 500 characters or fewer.' : '',
  }
  const isFormValid = Object.values(errors).every((value) => !value)

  const poOptions = useMemo(
    () => purchaseOrders.map((order) => ({
      value: order.poId || order.id,
      label: `${order.poNumber || `PO ${order.poId}`} - ${order.supplier || 'Supplier'} - ${formatCurrency(order.totalAmount)}`,
    })),
    [purchaseOrders],
  )

  const invoiceOptions = useMemo(
    () => invoices
      .filter((invoice) =>
        formData.partyId ? String(invoice.customerId) === String(formData.partyId) : true,
      )
      .map((invoice) => {
        const invoiceId = Number(invoice.invoiceId || invoice.id)

        return {
          value: invoiceId,
          label: `${invoice.invoiceNumber || `Invoice ${invoice.invoiceId || invoice.id}`} - ${invoice.customerName || invoice.customer || 'Customer'} - ${formatCurrency(invoice.balanceAmount)}`,
        }
      })
      .filter((option) => Number.isInteger(option.value) && option.value > 0),
    [formData.partyId, invoices],
  )

  function handleChange(event) {
    const { name, value } = event.target
    setFormData((currentValue) => ({ ...currentValue, [name]: value }))
  }

  function handlePartyChange(event) {
    const { value } = event.target
    setFormData((currentValue) => ({
      ...currentValue,
      partyId: value,
      invoiceId:
        !isSupplier &&
        currentValue.invoiceId &&
        !invoices.some((invoice) =>
          String(invoice.customerId) === String(value) &&
          getInvoiceId(invoice) === String(currentValue.invoiceId),
        )
          ? ''
          : currentValue.invoiceId,
    }))
  }

  function handleBlur(event) {
    setTouched((currentValue) => ({ ...currentValue, [event.target.name]: true }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    setTouched({
      partyId: true,
      invoiceId: true,
      poId: true,
      amount: true,
      paymentDate: true,
      referenceNumber: true,
      notes: true,
    })

    if (!isFormValid || isSubmitting) {
      return
    }

    onSubmit(formData)
  }

  return (
    <form className="payment-form" onSubmit={handleSubmit} autoComplete="off">
      <div className="payment-form__section">
        <div className="payment-form__section-header">
          
        </div>

        <div className="form-grid">
          <SearchableSelect
            id="payment-party"
            name="partyId"
            label={partyLabel}
            value={formData.partyId}
            onChange={handlePartyChange}
            onBlur={handleBlur}
            options={parties}
            placeholder={`Select ${partyLabel.toLowerCase()}`}
            error={errors.partyId}
            showError={touched.partyId}
          />

          {isSupplier ? (
            <SearchableSelect
              id="payment-po"
              name="poId"
              label="Purchase order"
              value={formData.poId}
              onChange={handleChange}
              onBlur={handleBlur}
              options={poOptions}
              placeholder="Select purchase order"
              error={errors.poId}
              showError={touched.poId}
            />
          ) : (
            <div className="payment-form__invoice-field">
              <SearchableSelect
                id="payment-invoice"
                name="invoiceId"
                label="Invoice"
                value={formData.invoiceId}
                onChange={handleChange}
                onBlur={handleBlur}
                options={invoiceOptions}
                placeholder="Select invoice"
                searchPlaceholder="Search invoices"
                error={errors.invoiceId}
                showError={touched.invoiceId}
              />
              {selectedInvoice ? (
                <dl className="payment-form__invoice-metrics">
                  <div>
                    <dt>Invoice Total</dt>
                    <dd>{formatCurrency(invoiceTotal)}</dd>
                  </div>
                  <div>
                    <dt>Already Paid</dt>
                    <dd>{formatCurrency(alreadyPaid)}</dd>
                  </div>
                  <div>
                    <dt>Outstanding Balance</dt>
                    <dd>{formatCurrency(outstandingBalance)}</dd>
                  </div>
                </dl>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <div className="payment-form__section">
        <div className="payment-form__section-header">
          <h3>Payment details</h3>
        
        </div>

        <div className="form-grid">
          <CurrencyInput
            id="payment-amount"
            name="amount"
            label="Amount"
            value={formData.amount}
            onChange={handleChange}
            onBlur={handleBlur}
            error={touched.amount ? errors.amount : ''}
          />

          <DatePicker
            id="payment-date"
            name="paymentDate"
            label="Payment date"
            icon={null}
            value={formData.paymentDate}
            onChange={handleChange}
            onBlur={handleBlur}
            error={touched.paymentDate ? errors.paymentDate : ''}
          />

          <SearchableSelect
            id="payment-method"
            name="paymentMethod"
            label="Payment method"
            value={formData.paymentMethod}
            onChange={handleChange}
            onBlur={handleBlur}
            options={PAYMENT_METHODS}
          />

          <InputField
            id="payment-reference"
            name="referenceNumber"
            label="Reference number"
            value={formData.referenceNumber}
            maxLength={100}
            onChange={handleChange}
            onBlur={handleBlur}
            error={touched.referenceNumber ? errors.referenceNumber : ''}
            
          />

          <InputField
            id="payment-notes"
            name="notes"
            label="Notes"
            textarea
            rows={3}
            maxLength={500}
            className="field--full"
            value={formData.notes}
            onChange={handleChange}
            onBlur={handleBlur}
            error={touched.notes ? errors.notes : ''}
          />
        </div>
      </div>

      <dl className="payment-form__summary-panel">
        <div>
          <dt>Invoice Total</dt>
          <dd>{formatCurrency(invoiceTotal)}</dd>
        </div>
        <div>
          <dt>Already Paid</dt>
          <dd>{formatCurrency(alreadyPaid)}</dd>
        </div>
        <div>
          <dt>Current Payment</dt>
          <dd>{formatCurrency(currentPayment)}</dd>
        </div>
        <div>
          <dt>Balance After Payment</dt>
          <dd>{formatCurrency(balanceAfterPayment)}</dd>
        </div>
      </dl>

      <div className="button-row payment-form__footer">
        <button type="submit" className="button button-primary" disabled={!isFormValid || isSubmitting}>
          {isSubmitting ? 'Posting...' : 'Post Payment'}
        </button>
        <button type="button" className="button button-cancel" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </button>
      </div>
    </form>
  )
}

export default function CustomerPaymentModule({
  customers,
  fetchPayments,
  createPayment,
  updatePayment,
  deletePayment,
}) {
  const type = 'customer'
  const title = 'Customer Payments'
  const subtitle = 'Track customer receipts, invoice allocations, and payment references.'
  const permissionKey = 'customerPayments'
  const partyLabel = 'Customer'
  const parties = customers

  const { hasPermission, user } = useAuth()
  const navigate = useNavigate()
  const isSupplier = false
  const defaultVisiblePaymentColumns = CUSTOMER_PAYMENT_BASE_COLUMNS
  const paymentColumnsStorageKey = PAYMENT_COLUMNS_STORAGE_KEYS.customer
  const [payments, setPayments] = useState([])
  const [invoices, setInvoices] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [detailTarget, setDetailTarget] = useState(null)
  const [editTarget, setEditTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [paymentFilter, setPaymentFilter] = useState('all')
  const [selectedPaymentIds, setSelectedPaymentIds] = useState([])
  const [visibleColumnKeys, setVisibleColumnKeys] = useState(() =>
    readStoredPaymentColumns(paymentColumnsStorageKey) ?? defaultVisiblePaymentColumns)
  const [isColumnMenuOpen, setIsColumnMenuOpen] = useState(false)
  const columnMenuRef = useRef(null)
  const columnButtonRef = useRef(null)

  const canCreate = hasPermission(permissionKey, 'create')
  const canEdit = Boolean(updatePayment) && (hasPermission(permissionKey, 'edit') || hasPermission(permissionKey, 'create'))
  const canDelete = hasPermission(permissionKey, 'delete')

  const invoiceById = useMemo(
    () => new Map(invoices.map((invoice) => [getInvoiceId(invoice), invoice])),
    [invoices],
  )

  const loadPayments = useCallback(async ({ updateLoading = true, isMounted = () => true } = {}) => {
    if (updateLoading) {
      setIsLoading(true)
    }
    setError('')

    try {
      const [paymentsResponse, invoicesResponse] = await Promise.all([
        fetchPayments(),
        getInvoices(),
      ])

      if (!isMounted()) {
        return
      }

      if (!paymentsResponse.success) {
        setError(getPaymentLoadErrorMessage(paymentsResponse.error || paymentsResponse.message))
        setPayments([])
        return
      }

      setPayments((paymentsResponse.data ?? []).map(withPaymentRowId))

      if (invoicesResponse.success) {
        setInvoices(invoicesResponse.data ?? [])
      } else {
        setError(getPaymentLoadErrorMessage(invoicesResponse.error || 'Unable to load invoices.'))
      }
    } catch (loadError) {
      if (isMounted()) {
        setPayments([])
        setError(getPaymentLoadErrorMessage(loadError instanceof Error ? loadError.message : 'Unable to load payment data right now.'))
      }
    } finally {
      if (isMounted()) {
        setIsLoading(false)
      }
    }
  }, [fetchPayments])

  useEffect(() => {
    let isMounted = true
    loadPayments({ isMounted: () => isMounted })
    return () => {
      isMounted = false
    }
  }, [loadPayments])

  useEffect(() => {
    setVisibleColumnKeys(readStoredPaymentColumns(paymentColumnsStorageKey) ?? defaultVisiblePaymentColumns)
  }, [defaultVisiblePaymentColumns, paymentColumnsStorageKey])

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(paymentColumnsStorageKey, JSON.stringify(visibleColumnKeys))
      }
    } catch {
      // localStorage can be unavailable in restricted browsing modes.
    }
  }, [paymentColumnsStorageKey, visibleColumnKeys])

  useEffect(() => {
    const livePaymentIds = new Set(payments.map(getPaymentRowId))
    setSelectedPaymentIds((currentValue) =>
      currentValue.filter((paymentId) => livePaymentIds.has(paymentId)))
  }, [payments])

  useEffect(() => {
    function handlePointerDown(event) {
      if (!columnMenuRef.current?.contains(event.target)) {
        setIsColumnMenuOpen(false)
      }

    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [])

  const filteredPayments = useMemo(
    () => payments.filter((payment) => {
      const status = normalizePaymentStatus(payment)
      if (paymentFilter === 'success' && status !== 'Completed') return false
      if (paymentFilter === 'pending' && status !== 'Pending') return false
      if (paymentFilter === 'failed' && status !== 'Failed') return false
      if (paymentFilter === 'cancelled' && status !== 'Cancelled') return false
      if (paymentFilter === 'reversed' && status !== 'Reversed') return false
      if (paymentFilter === 'month' && !isWithinDateRange(payment.paymentDate, 'month')) return false
      if (paymentFilter === 'last30' && !isWithinDateRange(payment.paymentDate, 'last30')) return false
      if (paymentFilter === 'large' && Number(payment.amount || 0) < LARGE_PAYMENT_THRESHOLD) return false
      return true
    }),
    [paymentFilter, payments],
  )

  const selectedPayments = useMemo(
    () => payments.filter((payment) => selectedPaymentIds.includes(getPaymentRowId(payment))),
    [payments, selectedPaymentIds],
  )

  const selectedFilteredPayments = useMemo(
    () => filteredPayments.filter((payment) => selectedPaymentIds.includes(getPaymentRowId(payment))),
    [filteredPayments, selectedPaymentIds],
  )

  const summary = useMemo(() => {
    const totalAmount = filteredPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
    const currentMonth = new Date().toISOString().slice(0, 7)

    return {
      count: filteredPayments.length,
      totalAmount,
      thisMonth: filteredPayments.filter((payment) => String(payment.paymentDate).startsWith(currentMonth)).length,
      reconciled: filteredPayments.filter((payment) => normalizePaymentStatus(payment) === 'Completed').length,
      pending: filteredPayments.filter((payment) => normalizePaymentStatus(payment) === 'Pending').length,
    }
  }, [filteredPayments])

  const handleTogglePaymentSelection = useCallback((paymentId) => {
    const normalizedId = String(paymentId)
    setSelectedPaymentIds((currentValue) => {
      const nextValue = currentValue.includes(normalizedId)
        ? currentValue.filter((id) => id !== normalizedId)
        : [...currentValue, normalizedId]

      logPaymentSelectionDebug('toggle-row', {
        clickedPaymentId: normalizedId,
        clickedPaymentNumber: payments.find((payment) => getPaymentRowId(payment) === normalizedId)?.paymentNumber || '',
        selectedBefore: currentValue,
        selectedAfter: nextValue,
        selectedPaymentNumbersAfter: nextValue.map((id) =>
          payments.find((payment) => getPaymentRowId(payment) === id)?.paymentNumber || id),
      })

      return nextValue
    })
  }, [payments])

  const handleToggleAllFilteredPayments = useCallback(() => {
    const filteredIds = filteredPayments.map(getPaymentRowId)

    setSelectedPaymentIds((currentValue) => {
      const allSelected = filteredIds.length > 0 && filteredIds.every((id) => currentValue.includes(id))

      if (allSelected) {
        return currentValue.filter((id) => !filteredIds.includes(id))
      }

      return Array.from(new Set([...currentValue, ...filteredIds]))
    })
  }, [filteredPayments])

  const handleExport = useCallback((rows = filteredPayments) => {
    const exportRows = rows.length > 0 ? rows : filteredPayments
    if (exportRows.length === 0) {
      showToast({ type: 'warning', title, message: 'No payments available to export.' })
      return
    }
    exportPaymentsToPdf(exportRows, false, user)
    showToast({ type: 'success', title, message: `${exportRows.length} payment${exportRows.length === 1 ? '' : 's'} exported as PDF.` })
  }, [filteredPayments, title, user])

  const handleDownloadReceipt = useCallback(async (payment) => {
    try {
      await downloadPaymentReceiptPdf({
        payment,
        invoice: invoiceById.get(String(payment.invoiceId)),
        allPayments: payments,
        generatedBy: user?.email || user?.name || 'System',
      })
      showToast({ type: 'success', title, message: 'Receipt PDF downloaded.' })
    } catch (downloadError) {
      showToast({
        type: 'error',
        title,
        message: downloadError instanceof Error ? downloadError.message : 'Unable to generate receipt PDF.',
      })
    }
  }, [invoiceById, payments, title, user])

  function handlePrint(rows = selectedPayments) {
    const printRows = rows.length > 0 ? rows : filteredPayments.slice(0, 1)
    if (printRows.length === 0) {
      showToast({ type: 'warning', title, message: 'Select a payment to print.' })
      return
    }

    const receiptHtml = printRows.map((payment) => {
      const invoice = invoiceById.get(String(payment.invoiceId))
      const metrics = getReceiptAllocationMetrics(payment, invoice, payments)
      const remainingBalance = Number(metrics.outstandingAfter || 0)
      const invoiceStatusLabel = getInvoiceStatusMeta(payment.invoiceStatus).label
      const paymentStatusLabel = getPaymentStatusMeta(payment.status).label
      const companyLines = getReceiptCompanyLines()

      return `
        <section class="receipt-sheet">
          <div class="receipt-top-banner">
            <div class="receipt-brand-container">
              <div class="receipt-logo-badge">IMS</div>
              <div class="receipt-brand-details">
                <strong class="company-name">${escapeXml(RECEIPT_COMPANY_PROFILE.name || RECEIPT_COMPANY_NAME)}</strong>
                <span class="company-sub">Inventory &amp; Financial Management System</span>
                ${companyLines.map((line) => `<span class="company-line">${escapeXml(line)}</span>`).join('')}
              </div>
            </div>
            <div class="receipt-header-meta">
              <span class="receipt-document-tag">CUSTOMER PAYMENT RECEIPT</span>
              <div class="receipt-number-badge">
                <span class="meta-label">RECEIPT NO:</span>
                <span class="meta-val">${escapeXml(paymentNumberFrom(payment))}</span>
              </div>
              <div class="receipt-date-badge">
                <span class="meta-label">DATE:</span>
                <span class="meta-val">${escapeXml(formatReceiptDate(payment.paymentDate))}</span>
              </div>
            </div>
          </div>

          <div class="receipt-watermark-stamp">
            <span class="stamp-icon">✓</span>
            <span class="stamp-text">OFFICIAL PAYMENT RECEIPT — RECORDED</span>
          </div>

          <div class="receipt-section-title">Customer &amp; Invoice Details</div>
          <div class="receipt-info-card">
            <div class="info-cell">
              <span class="info-label">Customer Name</span>
              <span class="info-value info-value--large">${escapeXml(payment.partyName || 'Customer')}</span>
            </div>
            <div class="info-cell">
              <span class="info-label">Invoice Number</span>
              <span class="info-value">${escapeXml(getInvoiceNumber(payment, invoice))}</span>
            </div>
            <div class="info-cell">
              <span class="info-label">Invoice Date</span>
              <span class="info-value">${escapeXml(formatReceiptDate(invoice?.invoiceDate || payment.invoiceDate || payment.paymentDate))}</span>
            </div>
            <div class="info-cell">
              <span class="info-label">Invoice Status</span>
              <span class="badge ${getInvoiceReceiptStatusClass(invoiceStatusLabel)}">${escapeXml(invoiceStatusLabel)}</span>
            </div>
          </div>

          <div class="receipt-section-title">Financial Settlement Breakdown</div>
          <div class="receipt-table-card">
            <table class="receipt-table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th class="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Invoice Total Amount</td>
                  <td class="text-right font-mono">${escapeXml(formatReceiptCurrency(metrics.invoiceTotal))}</td>
                </tr>
                <tr>
                  <td>Previous Cumulative Payments</td>
                  <td class="text-right font-mono">${escapeXml(formatReceiptCurrency(metrics.previousPayments))}</td>
                </tr>
                <tr class="row-current-payment">
                  <td><strong>Current Payment Settled</strong></td>
                  <td class="text-right font-mono"><strong>${escapeXml(formatReceiptCurrency(payment.amount))}</strong></td>
                </tr>
                <tr class="${remainingBalance > 0 ? 'row-balance-open' : 'row-balance-paid'}">
                  <td><strong>Remaining Outstanding Balance</strong></td>
                  <td class="text-right font-mono"><strong>${escapeXml(formatReceiptCurrency(metrics.outstandingAfter))}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="receipt-section-title">Payment Method &amp; Execution</div>
          <div class="receipt-info-card receipt-info-card--three">
            <div class="info-cell">
              <span class="info-label">Payment Method</span>
              <span class="info-value">${escapeXml(payment.paymentMethod || 'Bank Transfer')}</span>
            </div>
            <div class="info-cell">
              <span class="info-label">Reference / UTR Number</span>
              <span class="info-value font-mono">${escapeXml(payment.referenceNumber || 'N/A')}</span>
            </div>
            <div class="info-cell">
              <span class="info-label">Payment Status</span>
              <span class="badge ${getPaymentReceiptStatusClass(payment.status)}">${escapeXml(paymentStatusLabel)}</span>
            </div>
          </div>

          <div class="receipt-signature-section">
            <div class="signature-box">
              <div class="signature-line"></div>
              <span>Customer Signature</span>
            </div>
            <div class="signature-box">
              <div class="signature-seal-circle">SEAL</div>
              <div class="signature-line"></div>
              <span>Authorized Signatory</span>
            </div>
          </div>

          <footer class="receipt-footer">
            <p class="footer-notice">This is a computer-generated official payment receipt issued by StockPilot IMS. Valid without physical signature.</p>
            <div class="footer-meta">
              <span><b>Generated On:</b> ${escapeXml(getGeneratedTimestamp())}</span>
              <span><b>Issued By:</b> ${escapeXml(user?.email || user?.name || 'System Administrator')}</span>
              <span><b>System:</b> ${escapeXml(RECEIPT_SYSTEM_NAME)}</span>
            </div>
          </footer>
        </section>
      `
    }).join('')

    const printWindow = window.open('', '_blank', 'width=800,height=850')
    if (!printWindow) {
      showToast({ type: 'error', title, message: 'Unable to open print window.' })
      return
    }

    try {
      printWindow.opener = null
    } catch {
      // Ignore security policy warnings
    }

    let printTriggered = false
    const printWhenReady = () => {
      if (printTriggered || printWindow.closed) return
      printTriggered = true
      window.setTimeout(() => {
        if (printWindow.closed) return
        printWindow.focus()
        printWindow.print()
      }, 150)
    }

    printWindow.addEventListener('load', printWhenReady, { once: true })
    printWindow.document.open()
    printWindow.document.write(`<!doctype html><html><head><title>Customer Payment Receipt - IMS</title><style>
      @page { size: A4 portrait; margin: 12mm 14mm; }
      * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      body { margin: 0; padding: 0; background: #f8fafc; color: #0f172a; font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 13px; line-height: 1.5; }
      .receipt-sheet { background: #ffffff; max-width: 800px; margin: 0 auto; padding: 28px 32px; border: 1px solid #e2e8f0; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); position: relative; page-break-after: always; }
      .receipt-sheet:last-child { page-break-after: auto; }
      
      .receipt-top-banner { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px; padding: 20px 24px; background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #2563eb 100%); border-radius: 12px; color: #ffffff; margin-bottom: 20px; }
      .receipt-brand-container { display: flex; align-items: center; gap: 14px; }
      .receipt-logo-badge { width: 50px; height: 50px; border-radius: 12px; background: rgba(255,255,255,0.15); backdrop-filter: blur(4px); border: 1px solid rgba(255,255,255,0.25); display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 18px; letter-spacing: 1.5px; color: #ffffff; }
      .receipt-brand-details { display: flex; flex-direction: column; }
      .company-name { font-size: 20px; font-weight: 800; letter-spacing: -0.01em; color: #ffffff; line-height: 1.2; }
      .company-sub { font-size: 11px; color: #94a3b8; font-weight: 500; margin-top: 2px; }
      .company-line { font-size: 11px; color: #cbd5e1; margin-top: 1px; }

      .receipt-header-meta { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; text-align: right; }
      .receipt-document-tag { font-size: 11px; font-weight: 800; letter-spacing: 0.1em; color: #60a5fa; text-transform: uppercase; background: rgba(96,165,250,0.15); padding: 4px 10px; border-radius: 999px; border: 1px solid rgba(96,165,250,0.3); }
      .receipt-number-badge, .receipt-date-badge { display: flex; align-items: center; gap: 8px; font-size: 12px; }
      .meta-label { color: #94a3b8; font-size: 10px; font-weight: 700; letter-spacing: 0.05em; }
      .meta-val { color: #ffffff; font-weight: 800; font-family: "JetBrains Mono", Consolas, monospace; }

      .receipt-watermark-stamp { display: flex; align-items: center; justify-content: center; gap: 8px; background: #f3f0fd; border: 1px solid #c7bbf7; padding: 8px 16px; border-radius: 8px; color: #261665; font-size: 12px; font-weight: 800; letter-spacing: 0.04em; margin-bottom: 20px; }
      .stamp-icon { width: 20px; height: 20px; background: #6346d9; color: #ffffff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 900; }
      .stamp-text { text-transform: uppercase; letter-spacing: 0.06em; }

      .receipt-section-title { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: #475569; margin: 18px 0 8px 2px; }
      
      .receipt-info-card { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px; margin-bottom: 16px; }
      .receipt-info-card--three { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .info-cell { display: flex; flex-direction: column; gap: 4px; }
      .info-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; }
      .info-value { font-size: 13px; font-weight: 700; color: #0f172a; overflow-wrap: anywhere; }
      .info-value--large { font-size: 14px; font-weight: 800; color: #0f172a; }

      .badge { display: inline-flex; align-items: center; align-self: flex-start; padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 800; }
      .badge-green { color: #15803d; background: #dcfce7; border: 1px solid #86efac; }
      .badge-amber { color: #c2410c; background: #fff7ed; border: 1px solid #fed7aa; }
      .badge-red { color: #b91c1c; background: #fef2f2; border: 1px solid #fca5a5; }

      .receipt-table-card { border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; margin-bottom: 16px; }
      .receipt-table { width: 100%; border-collapse: collapse; text-align: left; }
      .receipt-table th { background: #f1f5f9; padding: 10px 16px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: #475569; border-bottom: 1px solid #e2e8f0; }
      .receipt-table td { padding: 12px 16px; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #334155; }
      .receipt-table tr:last-child td { border-bottom: none; }
      .text-right { text-align: right !important; }
      .font-mono { font-family: "JetBrains Mono", Consolas, monospace; }

      .row-current-payment { background: #f3f0fd !important; border-left: 4px solid #8b7dfb; }
      .row-current-payment td { color: #2a1580 !important; font-size: 14px; }
      .row-balance-open { background: #fff7ed !important; border-left: 4px solid #f97316; }
      .row-balance-open td { color: #c2410c !important; font-size: 14px; }
      .row-balance-paid { background: #f0fdf4 !important; border-left: 4px solid #10b981; }
      .row-balance-paid td { color: #15803d !important; font-size: 14px; }

      .receipt-signature-section { display: flex; justify-content: space-between; gap: 40px; margin-top: 36px; padding-top: 10px; }
      .signature-box { flex: 1; display: flex; flex-direction: column; align-items: center; text-align: center; position: relative; }
      .signature-seal-circle { width: 44px; height: 44px; border: 2px dashed #cbd5e1; border-radius: 50%; color: #94a3b8; font-size: 9px; font-weight: 800; display: flex; align-items: center; justify-content: center; margin-bottom: -18px; background: #ffffff; z-index: 1; }
      .signature-line { width: 100%; border-bottom: 1.5px dashed #cbd5e1; height: 32px; margin-bottom: 8px; }
      .signature-box span { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }

      .receipt-footer { margin-top: 28px; padding-top: 14px; border-top: 1px solid #e2e8f0; text-align: center; color: #64748b; }
      .footer-notice { font-size: 11px; color: #64748b; margin: 0 0 10px; font-weight: 500; }
      .footer-meta { display: flex; justify-content: space-between; gap: 12px; font-size: 11px; color: #94a3b8; background: #f8fafc; padding: 8px 14px; border-radius: 6px; }

      @media print {
        body { background: #ffffff; }
        .receipt-sheet { border: none; box-shadow: none; padding: 0; }
      }
    </style></head><body>${receiptHtml}</body></html>`)
    printWindow.document.close()
    if (printWindow.document.readyState === 'complete') printWhenReady()
  }

  async function handleBulkDelete() {
    if (selectedPayments.length === 0) {
      return
    }

    setIsSaving(true)
    try {
      await Promise.all(selectedPayments.map((payment) => deletePayment(payment.id)))
      await loadPayments({ updateLoading: false })
      setSelectedPaymentIds([])
      showToast({ type: 'success', title, message: 'Selected payments deleted.' })
    } catch (bulkError) {
      showToast({ type: 'error', title, message: bulkError instanceof Error ? bulkError.message : 'Unable to delete selected payments.' })
    } finally {
      setIsSaving(false)
    }
  }

  async function handleCreate(formData) {
    setIsSaving(true)

    try {
      const payload = isSupplier
        ? {
            supplierId: toApiId(formData.partyId, 'Supplier'),
            poId: toApiId(formData.poId, 'Purchase order'),
            amount: Number(formData.amount),
            paymentDate: formData.paymentDate,
            paymentMethod: formData.paymentMethod,
            referenceNumber: formData.referenceNumber.trim(),
            notes: formData.notes.trim(),
          }
        : {
            customerId: toApiId(formData.partyId, 'Customer'),
            invoiceId: toApiId(formData.invoiceId, 'Invoice'),
            amount: Number(formData.amount),
            paymentDate: formData.paymentDate,
            paymentMethod: formData.paymentMethod,
            referenceNumber: formData.referenceNumber.trim(),
            notes: formData.notes.trim(),
            status: 'Completed',
            createdBy: user?.email || user?.name || 'System',
          }

      const response = await createPayment(payload)
      if (!response.success) throw new Error(response.error || 'Unable to post payment.')

      await loadPayments()
      showToast({ type: 'success', title, message: 'Payment posted successfully.' })
      setIsFormOpen(false)
    } catch (saveError) {
      showToast({
        type: 'error',
        title,
        message: saveError instanceof Error ? saveError.message : 'Unable to post payment.',
      })
    } finally {
      setIsSaving(false)
    }
  }

  async function handleUpdate(payment, formData) {
    if (!updatePayment) {
      return
    }

    setIsSaving(true)
    try {
      const response = await updatePayment(payment.id, {
        amount: Number(formData.amount),
        paymentMethod: formData.paymentMethod,
        referenceNumber: formData.referenceNumber.trim(),
        notes: formData.notes.trim(),
        status: 'Completed',
      })

      if (!response.success) throw new Error(response.error || 'Unable to update payment.')

      await loadPayments()
      setEditTarget(null)
      showToast({ type: 'success', title, message: 'Payment updated successfully.' })
    } catch (saveError) {
      showToast({
        type: 'error',
        title,
        message: saveError instanceof Error ? saveError.message : 'Unable to update payment.',
      })
    } finally {
      setIsSaving(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return

    const previousPayments = payments
    setPayments((currentValue) =>
      currentValue.map((payment) =>
        String(payment.id) === String(deleteTarget.id)
          ? { ...payment, status: 'Cancelled' }
          : payment,
      ),
    )
    setDeleteTarget(null)

    const response = await deletePayment(deleteTarget.id)
    if (!response.success) {
      setPayments(previousPayments)
      showToast({ type: 'error', title, message: response.error || 'Unable to delete payment.' })
      return
    }

    await loadPayments({ updateLoading: false })
    showToast({ type: 'success', title, message: 'Payment deleted successfully.' })
  }

  function handleToggleColumn(columnKey) {
    if (LOCKED_PAYMENT_COLUMNS.includes(columnKey)) {
      return
    }

    setVisibleColumnKeys((currentValue) => {
      const baseColumnKeys = isSupplier ? SUPPLIER_PAYMENT_BASE_COLUMNS : CUSTOMER_PAYMENT_BASE_COLUMNS
      const workingValue = currentValue.length > 0 ? currentValue : baseColumnKeys
      const nextValue = workingValue.includes(columnKey)
        ? workingValue.filter((key) => key !== columnKey)
        : [...workingValue, columnKey]

      return LOCKED_PAYMENT_COLUMNS.reduce((result, key) => (
        result.includes(key) ? result : [...result, key]
      ), nextValue)
    })
  }

  function handleResetColumns() {
    setVisibleColumnKeys(isSupplier ? SUPPLIER_PAYMENT_BASE_COLUMNS : CUSTOMER_PAYMENT_BASE_COLUMNS)
  }

  const columns = useMemo(() => [
    {
      key: 'paymentNumber',
      label: 'Payment No',
      className: 'payments-col-number',
      mobilePrimary: true,
      sortable: true,
      sortValue: (payment) => paymentNumberFrom(payment),
      render: (payment) => (
        <strong className="payments-page__record-number payments-readable-cell" title={paymentNumberFrom(payment)}>
          {paymentNumberFrom(payment)}
        </strong>
      ),
      searchValue: (payment) => `${paymentNumberFrom(payment)} ${payment.partyName} ${payment.invoiceNumber} ${payment.invoiceStatus} ${payment.referenceNumber} ${payment.status}`,
    },
    {
      key: 'paymentDate',
      label: 'Payment Date',
      className: 'payments-col-date',
      sortable: true,
      sortValue: (payment) => payment.paymentDate,
      render: (payment) => {
        const paymentDateText = formatDate(payment.paymentDate)

        return (
          <span className="payments-readable-cell" title={paymentDateText}>
            {paymentDateText}
          </span>
        )
      },
    },
    {
      key: 'partyName',
      label: partyLabel,
      className: 'payments-col-party',
      sortable: true,
      render: (payment) => {
        if (payment.partyName && payment.partyName !== '-') return payment.partyName
        const partyId = payment.customerId || payment.supplierId || payment.partyId
        if (partyId && Array.isArray(parties)) {
          const matched = parties.find((p) => String(p.id) === String(partyId) || String(p.customerId) === String(partyId) || String(p.supplierId) === String(partyId))
          if (matched) {
            return matched.name || matched.companyName || matched.company || matched.customerName || matched.supplierName || '-'
          }
        }
        return payment.partyName || '-'
      },
    },
    ...(isSupplier
      ? [{
          key: 'poId',
          label: 'PO ID',
          className: 'payments-col-document',
          sortable: true,
          render: (payment) => {
            const documentNumber = payment.poId || '-'
            return (
              <span className="payments-page__document-number payments-readable-cell" title={documentNumber}>
                {documentNumber}
              </span>
            )
          },
        }]
      : [{
          key: 'invoiceNumber',
          label: 'Invoice No',
          className: 'payments-col-document',
          sortable: true,
          sortValue: (payment) => getInvoiceNumber(payment, invoiceById.get(String(payment.invoiceId))),
          render: (payment) => {
            const documentNumber = getInvoiceNumber(payment, invoiceById.get(String(payment.invoiceId)))
            return (
              <span className="payments-page__document-number payments-readable-cell" title={documentNumber}>
                {documentNumber}
              </span>
            )
          },
        },
        {
          key: 'invoiceStatus',
          label: 'Invoice Status',
          className: 'payments-col-invoice-status',
          mobileStatus: true,
          sortable: true,
          sortValue: (payment) => normalizeInvoiceStatus(payment.invoiceStatus),
          render: (payment) => <InvoiceStatusBadge status={payment.invoiceStatus} />,
        }]),
    {
      key: 'amount',
      label: 'Amount',
      className: 'is-numeric payments-col-amount',
      sortable: true,
      sortValue: (payment) => Number(payment.amount || 0),
      render: (payment) => formatCurrency(payment.amount),
    },
    { key: 'paymentMethod', label: 'Method', className: 'payments-col-method', sortable: true },
    {
      key: 'referenceNumber',
      label: 'Reference Number',
      className: 'payments-col-reference',
      sortable: true,
      render: (payment) => payment.referenceNumber || (payment.id || payment.paymentId ? `REF-PAY-${String(payment.id || payment.paymentId).padStart(4, '0')}` : 'Not provided'),
    },
    {
      key: 'status',
      label: 'Status',
      className: 'payments-col-status',
      mobileStatus: true,
      sortable: true,
      sortValue: (payment) => normalizePaymentStatus(payment),
      render: (payment) => {
        const status = normalizePaymentStatus(payment)

        return (
          <div className="payments-status-menu" data-row-click-ignore="true">
            <PaymentStatusBadge status={status} />
          </div>
        )
      },
    },
    {
      key: 'createdBy',
      label: 'Created By',
      className: 'payments-col-created-by',
      sortable: true,
      render: (payment) => payment.createdBy || 'System',
    },
    {
      key: 'notes',
      label: 'Notes',
      className: 'payments-col-notes',
      sortable: true,
      render: (payment) => payment.notes || 'No notes',
    },
    {
      key: 'cancelledAt',
      label: 'Cancelled At',
      className: 'payments-col-cancelled-at',
      sortable: true,
      render: (payment) => payment.cancelledAt ? formatDate(payment.cancelledAt) : 'Not cancelled',
    },
    {
      key: 'cancellationReason',
      label: 'Cancellation Reason',
      className: 'payments-col-cancellation-reason',
      sortable: true,
      render: (payment) => payment.cancellationReason || 'Not provided',
    },
    {
      key: 'actions',
      label: 'Actions',
      className: 'payments-col-actions',
      searchable: false,
      render: (payment) => (
        <ActionMenu
          iconOnly
          label={`Actions for ${paymentNumberFrom(payment)}`}
          actions={[
            {
              key: 'view',
              label: 'View',
              icon: Eye,
              onClick: () => setDetailTarget(payment),
            },
            canEdit ? {
              key: 'edit',
              label: 'Edit',
              icon: Pencil,
              onClick: () => setEditTarget(payment),
            } : null,
            {
              key: 'download',
              label: 'Download receipt',
              icon: Download,
              onClick: () => handleDownloadReceipt(payment),
            },
          ]}
        />
      ),
    },
  ], [
    canEdit,
    filteredPayments,
    handleDownloadReceipt,
    invoiceById,
    isSupplier,
    partyLabel,
  ])

  const visibleColumns = useMemo(() => {
    const allowedKeys = new Set(columns.map((column) => column.key))
    const baseColumnKeys = isSupplier ? SUPPLIER_PAYMENT_BASE_COLUMNS : CUSTOMER_PAYMENT_BASE_COLUMNS
    const storedKeys = visibleColumnKeys.filter((key) => allowedKeys.has(key))
    const nextKeys = storedKeys.length > 0
      ? storedKeys
      : baseColumnKeys.filter((key) => allowedKeys.has(key))

    LOCKED_PAYMENT_COLUMNS.forEach((key) => {
      if (allowedKeys.has(key) && !nextKeys.includes(key)) {
        nextKeys.push(key)
      }
    })

    return columns.filter((column) => nextKeys.includes(column.key))
  }, [columns, isSupplier, visibleColumnKeys])

  const compactColumnKeys = isSupplier ? SUPPLIER_PAYMENT_BASE_COLUMNS : CUSTOMER_PAYMENT_BASE_COLUMNS
  const compactColumnKeySet = useMemo(() => new Set(compactColumnKeys), [compactColumnKeys])
  const hasExpandedColumns = visibleColumns.some((column) => !compactColumnKeySet.has(column.key))
  const visibleColumnSignature = visibleColumns.map((column) => column.key).join('|')
  const visiblePaymentColumnCount = visibleColumns.length
  const sizedVisibleColumns = useMemo(() => (
    visibleColumns.map((column) => {
      const width = (isSupplier ? SUPPLIER_PAYMENT_COLUMN_WIDTHS : PAYMENT_COLUMN_WIDTHS)[column.key]

      if (!width) {
        return column
      }

      const widthStyle = {
        width: `${width}px`,
        minWidth: `${width}px`,
        maxWidth: `${width}px`,
      }

      return {
        ...column,
        tableWidth: width,
        style: {
          ...(column.style || {}),
          ...widthStyle,
        },
        headerStyle: {
          ...(column.headerStyle || column.style || {}),
          ...widthStyle,
        },
      }
    })
  ), [isSupplier, visibleColumns])
  const paymentTableCardClassName = [
    'card',
    'payments-page__table-card',
    isSupplier ? 'payments-page__table-card--supplier' : 'payments-page__table-card--customer',
    hasExpandedColumns ? 'payments-page__table-card--expanded-columns' : '',
    'payments-page__table-card--overflow-columns',
    `payments-page__table-card--${visiblePaymentColumnCount}-columns`,
  ].filter(Boolean).join(' ')

  const columnOptions = columns.filter((column) =>
    !LOCKED_PAYMENT_COLUMNS.includes(column.key) &&
    typeof column.label === 'string')

  const selectedToolbarContent = selectedPaymentIds.length > 0 ? (
    <FilterBar className="payments-page__selected-actions" ariaLabel="Selected payment actions">
      <div className="payments-selection-summary" aria-live="polite" data-selection-mode="true">
        <Check size={15} />
        <strong>{selectedPaymentIds.length} selected</strong>
      </div>

      <button type="button" className="button button-secondary payments-toolbar-button" onClick={() => handleExport(selectedPayments)}>
        <Download size={15} />
        Export
      </button>

      <button type="button" className="button button-secondary payments-toolbar-button" onClick={() => handlePrint(selectedPayments)}>
        <Printer size={15} />
        Print
      </button>

      {canDelete ? (
        <button type="button" className="button button-secondary payments-toolbar-button payments-toolbar-button--danger" onClick={handleBulkDelete} disabled={isSaving}>
          <Trash2 size={15} />
          Delete
        </button>
      ) : null}
    </FilterBar>
  ) : null

  const toolbarContent = (
    <FilterBar className="payments-page__toolbar-actions" ariaLabel={`${title} table actions`}>
      <label className="payments-toolbar-select">
        <select value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value)}>
          {PAYMENT_FILTER_OPTIONS.map((filter) => (
            <option key={filter.value} value={filter.value}>{filter.label}</option>
          ))}
        </select>
      </label>

      {selectedPaymentIds.length === 0 ? (
        <>
          <div className="payments-column-filter" ref={columnMenuRef}>
            <button
              ref={columnButtonRef}
              type="button"
              className="button button-secondary payments-column-filter__trigger"
              aria-haspopup="menu"
              aria-expanded={isColumnMenuOpen}
              onClick={() => setIsColumnMenuOpen((currentValue) => !currentValue)}
            >
              <SlidersHorizontal size={15} />
              Columns
            </button>

            {isColumnMenuOpen ? (
              <PortalDropdown anchorRef={columnButtonRef} className="payments-column-filter__menu payments-column-filter__menu--portal" width={230}>
                <div className="payments-column-filter__menu-header">
                  <strong>Visible columns</strong>
                  <button type="button" onClick={handleResetColumns}>Reset</button>
                </div>
                <div className="payments-column-filter__options">
                  {columnOptions.map((column) => {
                    const isChecked = visibleColumns.some((visibleColumn) => visibleColumn.key === column.key)

                    return (
                      <label key={column.key} className="payments-column-filter__option">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleColumn(column.key)}
                        />
                        <span className="payments-column-filter__check" aria-hidden="true">
                          {isChecked ? <Check size={13} /> : null}
                        </span>
                        <span>{column.label}</span>
                      </label>
                    )
                  })}
                </div>
              </PortalDropdown>
            ) : null}
          </div>

          <button type="button" className="button button-secondary payments-toolbar-button" onClick={() => handleExport(filteredPayments)} disabled={filteredPayments.length === 0}>
            <Download size={15} />
            Export
          </button>

        </>
      ) : null}
    </FilterBar>
  )

  const hasFatalError = Boolean(error) && !isLoading
  const compactMetrics = [
    { key: 'count', label: 'Payments', value: summary.count, tone: 'success' },
    { key: 'success', label: 'Success', value: summary.reconciled, tone: 'success' },
    { key: 'pending', label: 'Pending', value: summary.pending, tone: 'warning' },
    { key: 'collected', label: 'Collected', value: formatCompactPaymentCurrency(summary.totalAmount), tone: 'info' },
  ]

  return (
    <div className="page payments-page payments-page--customer">
      <header className="resource-center__inventory-header" aria-label="Customer Payments summary">
        <div className="resource-center__inventory-header-main">
          <h1>Customer Payments</h1>
          <div className="resource-center__inventory-metrics">
            <span className="resource-center__inventory-metric resource-center__inventory-metric--success">
              <strong>{summary.count}</strong> Payments
            </span>
            <span className="resource-center__inventory-metric resource-center__inventory-metric--success">
              <strong>{summary.reconciled}</strong> Success
            </span>
            <span className="resource-center__inventory-metric resource-center__inventory-metric--warning">
              <strong>{summary.pending}</strong> Pending
            </span>
            <span className="resource-center__inventory-metric resource-center__inventory-metric--info">
              <strong>{formatCompactPaymentCurrency(summary.totalAmount)}</strong> Collected
            </span>
          </div>
        </div>
        <div className="resource-center__inventory-header-actions">
          {canCreate ? (
            <button
              type="button"
              className="button button-primary"
              onClick={() => setIsFormOpen(true)}
            >
              <Plus size={16} />
              New Payment
            </button>
          ) : null}
        </div>
      </header>

      {hasFatalError ? (
        <div className="card payments-page__state-card">
          <StateBlock
            type="server"
            title="Unable to load payment data"
            message={`${error} Please try again in a few moments.`}
            actionLabel="Retry"
            onAction={() => loadPayments()}
            compact
          />
        </div>
      ) : (
        <div className={`${paymentTableCardClassName} resource-center__inventory-table-card`}>
          <DataTable
            className="resource-center__inventory-table"
            key={visibleColumnSignature}
            rows={filteredPayments}
            columns={sizedVisibleColumns}
            keyField="paymentRowId"
            loading={isLoading}
            defaultPageSize={20}
            allowSortReset
            showSearch={selectedPaymentIds.length === 0}
            searchKeys={['paymentNumber', 'partyName', 'invoiceNumber', 'invoiceStatus', 'referenceNumber']}
            searchPlaceholder="Search payments"
            emptyMessage="No customer payments available."
            hideSelectionSummary
            filterContent={selectedToolbarContent}
            toolbarContent={toolbarContent}
            rowClassName={(payment) => selectedPaymentIds.includes(getPaymentRowId(payment)) ? 'is-selected' : ''}
            showColumnControls={false}
            enableRowSelection
            selectedRowKeys={selectedPaymentIds}
            onSelectionChange={setSelectedPaymentIds}
            fitExplicitColumnsToContainer={!hasExpandedColumns}
            showHorizontalScrollbar={hasExpandedColumns}
            splitToolbar
          />
        </div>
      )}

      {isFormOpen ? (
        <FormModal title={`Post ${partyLabel} Payment`}  onClose={() => setIsFormOpen(false)}>
          <PaymentForm
            type={type}
            partyLabel={partyLabel}
            parties={parties}
            invoices={invoices}
            purchaseOrders={[]}
            existingPayments={payments}
            onSubmit={handleCreate}
            onCancel={() => setIsFormOpen(false)}
            isSubmitting={isSaving}
          />
        </FormModal>
      ) : null}

      {detailTarget ? (
        <PaymentDetailsDrawer
          payment={detailTarget}
          invoice={invoiceById.get(String(detailTarget.invoiceId))}
          allPayments={payments}
          onClose={() => setDetailTarget(null)}
          onPrint={handlePrint}
          onDownloadReceipt={handleDownloadReceipt}
          onOpenInvoice={(selectedPayment) => {
            const invoiceId = selectedPayment?.invoiceId
            navigate(invoiceId ? `/management/accounting/${invoiceId}` : '/management/accounting')
          }}
        />
      ) : null}

      {editTarget ? (
        <PaymentEditModal
          payment={editTarget}
          invoice={invoiceById.get(String(editTarget.invoiceId))}
          onSubmit={handleUpdate}
          onClose={() => setEditTarget(null)}
          isSubmitting={isSaving}
        />
      ) : null}

      {deleteTarget ? (
        <FormModal
          title={deleteTarget.deleteMode === 'void' ? 'Void Payment' : 'Delete Payment'}
          onClose={() => setDeleteTarget(null)}
        >
          <div className="payment-delete-dialog">
            <div className="payment-delete-dialog__icon">
              <AlertTriangle size={18} />
            </div>
            <div>
              <h3>{deleteTarget.deleteMode === 'void' ? 'Void this payment?' : 'Delete this payment?'}</h3>
              <p>
                Payment <strong>{paymentNumberFrom(deleteTarget)}</strong> for <strong>{deleteTarget.partyName}</strong> worth{' '}
                <strong>{formatCurrency(deleteTarget.amount)}</strong> will be cancelled and the ledger balances will be reversed.
              </p>
            </div>
            <div className="button-row payment-delete-dialog__actions">
              <button type="button" className="button button-secondary button-cancel" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button type="button" className="button button-danger" onClick={confirmDelete}>
                {deleteTarget.deleteMode === 'void' ? 'Void Payment' : 'Delete Payment'}
              </button>
            </div>
          </div>
        </FormModal>
      ) : null}

    </div>
  )
}
