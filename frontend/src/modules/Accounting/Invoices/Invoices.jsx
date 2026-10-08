import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Activity,
  CalendarDays,
  Check,
  CheckCircle2,
  Database,
  Download,
  FileSpreadsheet,
  FileText,
  FolderTree,
  Hash,
  Layers3,
  LoaderCircle,
  Mail,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  ReceiptText,
  Save,
  Tag,
  Trash2,
  UserRound,
  X,
} from 'lucide-react'
import { apiRequest, getResponseData, getResponseList } from '../../../api/apiClient'
import { API_ENDPOINTS } from '../../../api/endpoints'
import { STOCK_DATA_UPDATED_EVENT } from '../../../api/stockApi'
import {
  createResource,
  deleteResource,
  downloadResourceFile,
  listResource,
  normalizeResourceRow,
  postResourceAction,
  putResourceAction,
  readResourceValue,
  updateResource,
} from '../../../api/resourceApi'
import CurrencyInput from '../../../components/CurrencyInput'
import PageHeader from '../../../components/common/PageHeader'
import StateBlock from '../../../components/common/StateBlock'
import InputField from '../../../components/InputField'
import SearchableSelect from '../../../components/SearchableSelect'
import { ActionButtons, ActionMenu, DataTable, ExportMenu, FilterBar, StatisticsCard, StatusBadge } from '../../../components/erp'
import { showToast } from '../../../components/common/toast'
import FormModal from '../../../layouts/FormModal'
import { useAuth } from '../../../hooks/useAuth'
import { formatCurrency, formatDate } from '../../../utils/helpers'
import {
  emailInputProps,
  getEmailError,
  sanitizeEmailInput,
} from '../../../validators/emailValidator'
import { RESOURCE_CONFIGS, RESOURCE_HUBS } from '../../ResourceCenter/resourceConfigs'
import './Invoices.css'

const CATALOG_STRUCTURE_UPDATED_EVENT = 'ims:catalog-structure-updated'
const PRODUCT_CATALOG_UPDATED_EVENT = 'ims:product-catalog-updated'
const CATALOG_STRUCTURE_KEYS = new Set(['categories', 'subCategories'])
const STOCK_RESOURCE_KEYS = new Set(['stock', 'stockMovements', 'stockLedger', 'stockTransfers', 'stockTransferItems'])
const INVENTORY_COMPACT_KEYS = new Set([
  'productAttributes',
  'productVariants',
  'variantAttributes',
  'goodsReceipts',
  'stock',
  'stockMovements',
  'stockLedger',
  'stockAdjustments',
  'stockAdjustmentItems',
  'stockTransfers',
  'stockTransferItems',
  'stockAudits',
  'stockAuditItems',
])
const PRODUCT_STYLE_RESOURCE_KEYS = new Set(['users', 'roles', 'auditLogs', 'systemSettings', 'systemsettings', 'systemSetting', 'settings'])
const ACTION_MENU_RESOURCE_KEYS = new Set(['invoices', 'invoice', 'accounting', 'users', 'roles', 'systemSettings', 'systemsettings', 'systemSetting', 'settings'])
const AUDIT_LOG_COLUMN_WIDTHS = {
  action: 92,
  module: 100,
  tableName: 100,
  recordId: 88,
  userId: 82,
  description: 300,
  createdAt: 110,
}
const AUDIT_MOBILE_PAGE_SIZE = 10
const SUBCATEGORY_DRAFT_KEY = 'ims:subCategory:createDraft'

function readStoredDraft(key) {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const rawValue = window.localStorage.getItem(key)
    if (!rawValue) {
      return null
    }

    const parsedValue = JSON.parse(rawValue)
    return isRecord(parsedValue) ? parsedValue : null
  } catch {
    return null
  }
}

function writeStoredDraft(key, value) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Draft persistence is a convenience; failing storage should not block the form.
  }
}

function clearStoredDraft(key) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.removeItem(key)
  } catch {
    // Ignore storage failures.
  }
}

function hasMeaningfulDraft(values) {
  if (!isRecord(values)) {
    return false
  }

  return ['categoryId', 'name', 'description'].some((key) =>
    String(values[key] ?? '').trim() !== '',
  ) || (String(values.status ?? '').trim() !== '' && String(values.status).toLowerCase() !== 'active')
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function getFieldKey(field) {
  return field.apiKey || field.name
}

function getFieldLabel(field) {
  return String(field.label ?? field.name ?? 'Field').replace(/\s*\*+\s*$/, '')
}

function normalizeForCompare(value) {
  if (Array.isArray(value) || isRecord(value)) {
    return JSON.stringify(value)
  }

  return String(value ?? '')
}

function getDefaultValue(field) {
  if (typeof field.defaultValue === 'function') {
    return field.defaultValue()
  }

  if (field.defaultValue !== undefined) {
    return field.defaultValue
  }

  if (field.type === 'checkbox') {
    return false
  }

  if (field.type === 'lineItems') {
    return [{ productId: '', variantId: '', quantity: '1', price: '' }]
  }

  return ''
}

function getReferenceValue(item, key) {
  return readResourceValue(item, key, readResourceValue(item, key?.replace(/Id$/, 'ID'), ''))
}

function getReferenceOptionValue(item, key) {
  if (Array.isArray(key)) {
    for (const candidate of key) {
      const value = getReferenceValue(item, candidate)
      if (value !== undefined && value !== null && value !== '') {
        return value
      }
    }

    return ''
  }

  if (typeof key === 'function') {
    return key(item)
  }

  return getReferenceValue(item, key)
}

function getReferenceOptionLabel(item, key) {
  if (typeof key === 'function') {
    return key(item)
  }

  if (Array.isArray(key)) {
    for (const candidate of key) {
      const value = getReferenceValue(item, candidate)
      if (value !== undefined && value !== null && value !== '') {
        return value
      }
    }

    return ''
  }

  return getReferenceValue(item, key)
}

function getResourceFieldIcon(config, field) {
  if (config.key === 'subCategories') {
    if (field.name === 'categoryId') {
      return FolderTree
    }

    if (field.name === 'name') {
      return Tag
    }

    if (field.name === 'description') {
      return FileText
    }

    if (field.name === 'status') {
      return Layers3
    }
  }

  if (field.type === 'date') {
    return CalendarDays
  }

  return Hash
}

function getResourceFieldClassName(config, field) {
  if (config.key === 'productVariants') {
    const baseClass = `resource-form__field--${field.name}`
    if (field.name === 'productId') {
      return `${baseClass} resource-form__field--full`
    }
    return baseClass
  }

  if (config.key !== 'subCategories') {
    return ''
  }

  const baseClass = `resource-form__field--${field.name}`

  if (field.name === 'categoryId' || field.name === 'status') {
    return baseClass
  }

  return `${baseClass} resource-form__field--full`
}

function getRecordFieldValue(record, field) {
  const value = readResourceValue(
    record,
    field.name,
    readResourceValue(record, field.apiKey, undefined),
  )

  if (value === undefined || value === null) {
    return getDefaultValue(field)
  }

  if (field.type === 'checkbox') {
    return Boolean(value)
  }

  if (field.type === 'date') {
    return String(value).slice(0, 10)
  }

  if (field.type === 'lineItems') {
    const items = value || readResourceValue(record, 'invoiceItems', [])
    return Array.isArray(items)
      ? items.map((item) => ({
        productId: readResourceValue(item, 'productId', ''),
        variantId: readResourceValue(item, 'variantId', ''),
        quantity: readResourceValue(item, 'quantity', ''),
        price: readResourceValue(item, 'price', ''),
      }))
      : getDefaultValue(field)
  }

  return String(value)
}

function getActiveFields(config, mode) {
  return (config.fields ?? []).filter((field) => {
    if (mode === 'create' && field.editOnly) {
      return false
    }

    if (mode === 'edit' && field.createOnly) {
      return false
    }

    return true
  })
}

function buildInitialForm(config, record, mode) {
  return getActiveFields(config, mode).reduce((result, field) => {
    result[field.name] = record ? getRecordFieldValue(record, field) : getDefaultValue(field)
    return result
  }, {})
}

function isEmptyValue(value, field) {
  if (field.type === 'checkbox') {
    return false
  }

  if (field.type === 'lineItems') {
    return !Array.isArray(value) || value.length === 0
  }

  return value === undefined || value === null || String(value).trim() === ''
}

function getGoodsReceiptRemainingQuantity(poId, referenceData, receiptRows = []) {
  if (!poId) {
    return null
  }

  const purchaseOrder = (referenceData.purchaseOrders ?? []).find((item) =>
    String(getReferenceValue(item, 'poId')) === String(poId),
  )
  const orderedQuantity = Number(getReferenceValue(purchaseOrder, 'quantity'))

  if (!Number.isFinite(orderedQuantity)) {
    return null
  }

  const receivedQuantity = receiptRows
    .filter((item) => String(getReferenceValue(item, 'poId')) === String(poId))
    .reduce(
      (total, item) => total + (Number(getReferenceValue(item, 'quantityReceived')) || 0),
      0,
    )

  return Math.max(orderedQuantity - receivedQuantity, 0)
}

function getDynamicMax(field, context = {}) {
  if (field.maxFrom === 'goodsReceiptRemainingQuantity') {
    return getGoodsReceiptRemainingQuantity(
      context.formData?.poId,
      context.referenceData,
      context.rows,
    )
  }

  return null
}

function getFieldError(field, value, mode, context = {}) {
  const isRequired = field.required || (mode === 'create' && field.requiredOnCreate)
  const label = getFieldLabel(field)

  if (isRequired && isEmptyValue(value, field)) {
    return `${label} is required.`
  }

  if (isEmptyValue(value, field)) {
    return ''
  }

  if (field.type === 'number' || field.type === 'currency' || field.valueType === 'number') {
    const numericValue = Number(value)

    if (!Number.isFinite(numericValue)) {
      return `${label} must be a valid number.`
    }

    if (field.min !== undefined && numericValue < field.min) {
      return field.minMessage || `${label} must be at least ${field.min}.`
    }

    if (field.max !== undefined && numericValue > field.max) {
      return `${label} must be ${field.max} or less.`
    }

    const dynamicMax = getDynamicMax(field, context)
    if (dynamicMax !== null && numericValue > dynamicMax) {
      return field.maxMessage || `${label} cannot exceed ${dynamicMax}.`
    }
  }

  if (field.type === 'email') {
    return getEmailError(value, { required: Boolean(isRequired) })
  }

  if (field.minLength && String(value).trim().length < field.minLength) {
    return `${label} must be at least ${field.minLength} characters.`
  }

  if (field.type === 'lineItems') {
    const invalidIndex = value.findIndex((item) => {
      const productId = Number(item.productId)
      const quantity = Number(item.quantity)
      const price = Number(item.price)

      return (
        !Number.isInteger(productId) ||
        productId <= 0 ||
        !Number.isFinite(quantity) ||
        quantity <= 0 ||
        !Number.isFinite(price) ||
        price < 0
      )
    })

    if (invalidIndex >= 0) {
      return `Line ${invalidIndex + 1} needs product, quantity, and price.`
    }
  }

  return ''
}

function getServerFieldError(errors, field) {
  if (!errors || typeof errors !== 'object') {
    return ''
  }

  const candidates = [field.name, field.apiKey, field.label]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase())

  const match = Object.entries(errors).find(([key]) =>
    candidates.includes(String(key).toLowerCase()),
  )

  const value = match?.[1]

  if (Array.isArray(value)) {
    return value.filter(Boolean).join(' ')
  }

  return value ? String(value) : ''
}

function buildPayload(values, fields) {
  return fields.reduce((payload, field) => {
    if (field.submit === false) {
      return payload
    }

    const value = values[field.name]
    const key = getFieldKey(field)

    if (field.type === 'lineItems') {
      payload[key] = (Array.isArray(value) ? value : []).map((item) => ({
        productId: Number(item.productId),
        variantId: item.variantId ? Number(item.variantId) : null,
        quantity: Number(item.quantity),
        price: Number(item.price),
      }))
      return payload
    }

    if (field.type === 'checkbox') {
      payload[key] = Boolean(value)
      return payload
    }

    if (field.type === 'number' || field.type === 'currency' || field.valueType === 'number') {
      if (isEmptyValue(value, field) && !field.required && !field.requiredOnCreate) {
        return payload
      }

      payload[key] = Number(value)
      return payload
    }

    payload[key] = field.type === 'email'
      ? sanitizeEmailInput(value)
      : typeof value === 'string'
        ? value.trim()
        : value
    return payload
  }, {})
}

function getChangedPayload(payload, baselinePayload) {
  return Object.keys(payload).reduce((result, key) => {
    if (normalizeForCompare(payload[key]) !== normalizeForCompare(baselinePayload[key])) {
      result[key] = payload[key]
    }

    return result
  }, {})
}

function getDeleteErrorMessage(config, error) {
  const message = String(error || '').trim()

  if (/records exist/i.test(message)) {
    return message
  }

  if (config.key === 'purchaseOrders' && /goods receipt|receipt/i.test(message)) {
    return 'Please delete goods receipts first.'
  }

  if (['stock', 'stockMovements', 'stockLedger', 'stockAudits', 'stockAuditItems'].includes(config.key) &&
    /stock|history|transaction|constraint|foreign key|reference|dependency|linked|conflict/i.test(message)) {
    return 'Cannot delete because stock history exists.'
  }

  if (/constraint|foreign key|reference|dependency|linked|stock|transaction|conflict/i.test(message)) {
    return `${config.entityName} cannot be deleted because related stock, documents, or transactions exist.`
  }

  return message || `Unable to delete ${config.entityName.toLowerCase()}.`
}

function formatStatusLabel(value) {
  const rawValue = String(value ?? '').trim()

  if (!rawValue) {
    return 'Not set'
  }

  if (/^opening$/i.test(rawValue) || /^opening[_-\s]+stock$/i.test(rawValue)) {
    return 'Opening Stock'
  }

  return rawValue
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function getStatusType(value) {
  const normalizedValue = String(value ?? '').trim().toLowerCase().replace(/[_\s]+/g, '-')

  if (normalizedValue === 'inactive' || normalizedValue === 'blocked' || normalizedValue === 'failed') {
    return 'critical'
  }

  return normalizedValue || 'info'
}

function getSelectionRowKey(row, index = 0) {
  const candidates = [
    readResourceValue(row, 'id', null),
    readResourceValue(row, '_id', null),
    readResourceValue(row, 'settingId', null),
    readResourceValue(row, 'settingID', null),
    readResourceValue(row, 'roleId', null),
    readResourceValue(row, 'userId', null),
  ]

  const match = candidates.find((value) => value !== null && value !== undefined && value !== '')
  return String(match ?? `row-${index}`)
}

function notifyCatalogStructureUpdate(config, action) {
  if (!CATALOG_STRUCTURE_KEYS.has(config.key)) {
    return
  }

  window.dispatchEvent(new CustomEvent(CATALOG_STRUCTURE_UPDATED_EVENT, {
    detail: { resource: config.key, action },
  }))
}

function formatCellValue(row, column, referenceData) {
  if (typeof column.render === 'function') {
    return column.render(row, referenceData)
  }

  const value = readResourceValue(row, column.key)

  if (column.format === 'currency') {
    return formatCurrency(Number(value || 0))
  }

  if (column.format === 'date') {
    return value ? formatDate(value) : 'Not set'
  }

  if (column.format === 'boolean') {
    return value ? 'Yes' : 'No'
  }

  if (column.format === 'status') {
    return (
      <StatusBadge type={getStatusType(value)}>
        {formatStatusLabel(value)}
      </StatusBadge>
    )
  }

  if (value === undefined || value === null || value === '') {
    return 'Not set'
  }

  return String(value)
}

function getInventoryWorkspaceMetrics(config, rows) {
  const total = rows.length
  const sum = (key) => rows.reduce(
    (result, row) => result + (Number(readResourceValue(row, key, 0)) || 0),
    0,
  )
  const unique = (key) => new Set(
    rows.map((row) => String(readResourceValue(row, key, '') || '')).filter(Boolean),
  ).size
  const countStatus = (...statuses) => rows.filter((row) => {
    const status = String(readResourceValue(row, 'status', '') || '').toLowerCase()
    return statuses.some((value) => status.includes(value))
  }).length

  switch (config.key) {
    case 'productAttributes':
      return [
        { label: 'Attributes', value: total, tone: 'success' },
        { label: 'Reusable Fields', value: total, tone: 'info' },
      ]
    case 'productVariants':
      return [
        { label: 'Variants', value: total, tone: 'success' },
        { label: 'Products', value: unique('productId'), tone: 'info' },
        { label: 'SKUs', value: unique('sku'), tone: 'warning' },
      ]
    case 'variantAttributes':
      return [
        { label: 'Attribute Links', value: total, tone: 'success' },
        { label: 'Variants', value: unique('variantId'), tone: 'info' },
        { label: 'Attributes', value: unique('attributeId'), tone: 'warning' },
      ]
    case 'stock':
      return [
        { label: 'Stock Positions', value: total, tone: 'success' },
        { label: 'On Hand', value: sum('quantity').toLocaleString('en-IN'), tone: 'info' },
        { label: 'Available', value: sum('availableQuantity').toLocaleString('en-IN'), tone: 'warning' },
      ]
    case 'stockMovements':
      return [
        { label: 'Movements', value: total, tone: 'success' },
        { label: 'Products', value: unique('productId'), tone: 'info' },
        { label: 'Units Moved', value: sum('quantity').toLocaleString('en-IN'), tone: 'warning' },
      ]
    case 'stockLedger':
      return [
        { label: 'Ledger Entries', value: total, tone: 'success' },
        { label: 'Products', value: unique('productId'), tone: 'info' },
        { label: 'Closing Units', value: sum('closingQty').toLocaleString('en-IN'), tone: 'warning' },
      ]
    case 'goodsReceipts':
      return [
        { label: 'Receipts', value: total, tone: 'success' },
        { label: 'Units Received', value: sum('quantityReceived').toLocaleString('en-IN'), tone: 'info' },
        { label: 'Suppliers', value: unique('supplierId') || unique('supplierName'), tone: 'warning' },
      ]
    case 'stockAudits':
      return [
        { label: 'Audits', value: total, tone: 'success' },
        { label: 'Open', value: countStatus('draft', 'pending', 'open'), tone: 'warning' },
        { label: 'Completed', value: countStatus('approved', 'complete', 'closed'), tone: 'info' },
      ]
    case 'stockTransfers':
      return [
        { label: 'Transfers', value: total, tone: 'success' },
        { label: 'Pending', value: countStatus('pending', 'draft'), tone: 'warning' },
        { label: 'Completed', value: countStatus('complete', 'received', 'approved'), tone: 'info' },
      ]
    default:
      return [
        { label: 'Records', value: total, tone: 'success' },
        { label: 'Active', value: countStatus('active', 'approved', 'posted', 'complete'), tone: 'info' },
        { label: 'Pending', value: countStatus('pending', 'draft', 'open'), tone: 'warning' },
      ]
  }
}

function escapeCsvValue(value) {
  const text = String(value ?? '')

  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }

  return text
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function exportSubCategoriesCsv(rows) {
  const headers = ['SubCategory', 'Category', 'Status', 'Created']
  const csvRows = rows.map((row) => [
    readResourceValue(row, 'name', ''),
    readResourceValue(row, 'categoryName', ''),
    formatStatusLabel(readResourceValue(row, 'status', 'active')),
    readResourceValue(row, 'createdAt', ''),
  ])
  const csv = [headers, ...csvRows]
    .map((row) => row.map(escapeCsvValue).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = 'SubCategories.csv'
  link.click()
  URL.revokeObjectURL(url)
}

function printSubCategories(rows) {
  const tableRows = rows.map((row) => `
    <tr>
      <td><strong>${escapeHtml(readResourceValue(row, 'name', 'Unnamed subcategory'))}</strong></td>
      <td>${escapeHtml(readResourceValue(row, 'categoryName', 'Not set'))}</td>
      <td>${escapeHtml(formatStatusLabel(readResourceValue(row, 'status', 'active')))}</td>
      <td>${escapeHtml(readResourceValue(row, 'createdAt') ? formatDate(readResourceValue(row, 'createdAt')) : 'Not set')}</td>
    </tr>
  `).join('')
  const printWindow = window.open('', '_blank')

  if (!printWindow) {
    return
  }

  printWindow.document.write(`<!doctype html><html><head><title>SubCategories</title><style>
    body { margin: 28px; color: #111827; font: 13px Arial, sans-serif; }
    h1 { margin: 0 0 16px; font-size: 20px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 8px 10px; border: 1px solid #dbe4f0; text-align: left; vertical-align: top; }
    th { background: #f8fafc; color: #475569; font-size: 12px; }
  </style></head><body>
    <h1>SubCategories</h1>
    <table>
      <thead><tr><th>SubCategory</th><th>Category</th><th>Status</th><th>Created</th></tr></thead>
      <tbody>${tableRows}</tbody>
    </table>
  </body></html>`)
  printWindow.document.close()
  printWindow.focus()
  printWindow.print()
}


function getResourceExportColumns(config) {
  return (config.columns ?? []).filter((column) => column.key && column.key !== 'actions')
}

function getResourceExportValue(row, column) {
  const value = readResourceValue(row, column.key)

  if (column.format === 'currency') {
    return formatCurrency(Number(value || 0))
  }

  if (column.format === 'date') {
    return value ? formatDate(value) : 'Not set'
  }

  if (column.format === 'boolean') {
    return value ? 'Yes' : 'No'
  }

  if (column.format === 'status') {
    return formatStatusLabel(value)
  }

  if (value === undefined || value === null || value === '') {
    return 'Not set'
  }

  return String(value)
}

function getResourceExportFilename(config) {
  return `${String(config.title || config.key || 'Records')
    .replace(/[^a-z0-9]+/gi, '_')
    .replace(/^_+|_+$/g, '') || 'Records'}.csv`
}

function exportResourceRowsCsv(config, rows) {
  const columns = getResourceExportColumns(config)
  const headers = columns.map((column) => String(column.label ?? column.key))
  const csvRows = rows.map((row) => columns.map((column) => getResourceExportValue(row, column)))
  const csv = [headers, ...csvRows]
    .map((row) => row.map(escapeCsvValue).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = getResourceExportFilename(config)
  link.click()
  URL.revokeObjectURL(url)
}

function printResourceRows(config, rows) {
  const columns = getResourceExportColumns(config)
  const title = escapeHtml(config.title || 'Records')
  const tableHeaders = columns
    .map((column) => `<th>${escapeHtml(column.label ?? column.key)}</th>`)
    .join('')
  const tableRows = rows.map((row) => `
    <tr>
      ${columns.map((column) => `<td>${escapeHtml(getResourceExportValue(row, column))}</td>`).join('')}
    </tr>
  `).join('')
  const printWindow = window.open('', '_blank')

  if (!printWindow) {
    return
  }

  printWindow.document.write(`<!doctype html><html><head><title>${title}</title><style>
    body { margin: 28px; color: #111827; font: 13px Arial, sans-serif; }
    h1 { margin: 0 0 16px; font-size: 20px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 8px 10px; border: 1px solid #dbe4f0; text-align: left; vertical-align: top; }
    th { background: #f8fafc; color: #475569; font-size: 12px; }
  </style></head><body>
    <h1>${title}</h1>
    <table>
      <thead><tr>${tableHeaders}</tr></thead>
      <tbody>${tableRows}</tbody>
    </table>
  </body></html>`)
  printWindow.document.close()
  printWindow.focus()
  printWindow.print()
}

function exportNotificationsCsv(rows) {
  const headers = ['Title', 'Type', 'Message', 'Read', 'Created']
  const csvRows = rows.map((row) => [
    readResourceValue(row, 'title', ''),
    formatStatusLabel(readResourceValue(row, 'type', '')),
    readResourceValue(row, 'message', ''),
    readResourceValue(row, 'isRead', false) ? 'Read' : 'Unread',
    readResourceValue(row, 'createdAt', ''),
  ])
  const csv = [headers, ...csvRows]
    .map((row) => row.map(escapeCsvValue).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = 'Notifications.csv'
  link.click()
  URL.revokeObjectURL(url)
}

function getNotificationType(row) {
  return String(readResourceValue(row, 'type', 'info') || 'info')
}

function getNotificationReadState(row) {
  return Boolean(readResourceValue(row, 'isRead', false))
}

function getAuditActionTone(action) {
  const normalizedAction = String(action ?? '').trim().toLowerCase()

  if (['delete', 'deleted', 'remove', 'removed', 'archive', 'archived'].some((value) => normalizedAction.includes(value))) {
    return 'danger'
  }

  if (['create', 'created', 'add', 'added', 'insert'].some((value) => normalizedAction.includes(value))) {
    return 'success'
  }

  if (['update', 'updated', 'edit', 'edited', 'modify', 'modified'].some((value) => normalizedAction.includes(value))) {
    return 'info'
  }

  if (['login', 'auth', 'access'].some((value) => normalizedAction.includes(value))) {
    return 'neutral'
  }

  return 'default'
}

function getAuditActionLabel(row) {
  const action = readResourceValue(row, 'action', 'Activity')
  return formatStatusLabel(action)
}

function getAuditRowId(row) {
  return readResourceValue(
    row,
    'auditLogId',
    readResourceValue(row, 'auditId', readResourceValue(row, 'id', readResourceValue(row, 'recordId', 'audit-row'))),
  )
}

function getAuditDescription(row) {
  return readResourceValue(row, 'description', '') || 'System activity recorded by the IMS audit service.'
}

function AuditLogsMobileFeed({ rows, isLoading }) {
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const normalizedQuery = query.trim().toLowerCase()
  const filteredRows = useMemo(() => {
    if (!normalizedQuery) {
      return rows
    }

    return rows.filter((row) => [
      readResourceValue(row, 'action', ''),
      readResourceValue(row, 'module', ''),
      readResourceValue(row, 'tableName', ''),
      readResourceValue(row, 'recordId', ''),
      readResourceValue(row, 'userId', ''),
      readResourceValue(row, 'description', ''),
    ].some((value) => String(value ?? '').toLowerCase().includes(normalizedQuery)))
  }, [normalizedQuery, rows])
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / AUDIT_MOBILE_PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const startIndex = filteredRows.length === 0 ? 0 : (safePage - 1) * AUDIT_MOBILE_PAGE_SIZE
  const endIndex = Math.min(startIndex + AUDIT_MOBILE_PAGE_SIZE, filteredRows.length)
  const pageRows = filteredRows.slice(startIndex, endIndex)

  useEffect(() => {
    setPage(1)
  }, [normalizedQuery, rows])

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  if (isLoading && rows.length === 0) {
    return (
      <div className="resource-center__audit-feed" role="status" aria-live="polite">
        {Array.from({ length: 5 }).map((_, index) => (
          <div className="resource-center__audit-card is-loading" key={index}>
            <span />
            <span />
            <span />
          </div>
        ))}
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="resource-center__audit-feed">
        <div className="resource-center__audit-empty">
          <Activity size={20} />
          <strong>No audit activity found</strong>
          <span>Operational activity will appear here after the API returns audit records.</span>
        </div>
      </div>
    )
  }

  return (
    <div className="resource-center__audit-feed" aria-label="Audit activity feed">
      <label className="resource-center__audit-search">
        <span>Search audit activity</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Action, module, table, user, record"
        />
      </label>

      {filteredRows.length === 0 ? (
        <div className="resource-center__audit-empty">
          <Activity size={20} />
          <strong>No matching activity</strong>
          <span>Adjust the search text to review a broader audit range.</span>
        </div>
      ) : null}

      {filteredRows.length > 0 ? (
        <div className="resource-center__audit-list">
          {pageRows.map((row) => {
            const action = readResourceValue(row, 'action', 'Activity')
            const tone = getAuditActionTone(action)
            const timestamp = readResourceValue(row, 'createdAt', '')
            const moduleName = readResourceValue(row, 'module', 'System')
            const tableName = readResourceValue(row, 'tableName', 'Not set')
            const userId = readResourceValue(row, 'userId', 'System')
            const recordId = readResourceValue(row, 'recordId', 'Not set')

            return (
              <article className="resource-center__audit-card" key={getAuditRowId(row)}>
                <header className="resource-center__audit-card-header">
                  <span className={`resource-center__audit-action resource-center__audit-action--${tone}`}>
                    <Activity size={14} />
                    {getAuditActionLabel(row)}
                  </span>
                  <time dateTime={timestamp ? String(timestamp) : undefined}>
                    <CalendarDays size={13} />
                    {timestamp ? formatDate(timestamp) : 'Time not set'}
                  </time>
                </header>

                <p className="resource-center__audit-description">{getAuditDescription(row)}</p>

                <footer className="resource-center__audit-meta" aria-label="Audit metadata">
                  <span title={`Module: ${moduleName}`}>
                    <Hash size={13} />
                    {moduleName}
                  </span>
                  <span title={`Table: ${tableName}`}>
                    <Database size={13} />
                    {tableName}
                  </span>
                  <span title={`User: ${userId}`}>
                    <UserRound size={13} />
                    {userId}
                  </span>
                  <span title={`Record ID: ${recordId}`}>
                    ID {recordId}
                  </span>
                </footer>
              </article>
            )
          })}
        </div>
      ) : null}

      {filteredRows.length > 0 ? (
        <div className="resource-center__audit-pagination">
          <span>
            Showing {startIndex + 1}-{endIndex} of {filteredRows.length}
          </span>
          <div>
            <button
              type="button"
              className="button button-secondary"
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              disabled={safePage === 1}
            >
              Prev
            </button>
            <strong>Page {safePage}</strong>
            <button
              type="button"
              className="button button-secondary"
              onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              disabled={safePage === totalPages}
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function getVariantDisplayName(variantId, referenceData) {
  if (!variantId) {
    return 'Default variant'
  }

  const variant = (referenceData.productVariants ?? []).find((item) =>
    String(getReferenceValue(item, 'variantId')) === String(variantId) ||
    String(getReferenceValue(item, 'id')) === String(variantId),
  )

  return (
    getReferenceValue(variant, 'variantName') ||
    getReferenceValue(variant, 'name') ||
    getReferenceValue(variant, 'sku') ||
    'Variant not found'
  )
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

function LineItemsField({ field, value, error, onChange }) {
  const items = Array.isArray(value) && value.length > 0
    ? value
    : [{ productId: '', variantId: '', quantity: '1', price: '' }]

  function updateLine(index, key, nextValue) {
    onChange(items.map((item, itemIndex) =>
      itemIndex === index ? { ...item, [key]: nextValue } : item,
    ))
  }

  function addLine() {
    onChange([...items, { productId: '', variantId: '', quantity: '1', price: '' }])
  }

  function removeLine(index) {
    onChange(items.filter((_, itemIndex) => itemIndex !== index))
  }

  return (
    <div className={`field resource-form__line-field ${error ? 'field--error' : ''}`}>
      <label>{field.label}</label>
      <div className="resource-form__line-items">
        <div className="resource-form__line-heading" aria-hidden="true">
          <span>Product ID</span>
          <span>Variant ID</span>
          <span>Qty</span>
          <span>Price</span>
          <span />
        </div>

        {items.map((item, index) => (
          <div className="resource-form__line-row" key={`${index}-${items.length}`}>
            <input
              type="number"
              min="1"
              value={item.productId}
              onChange={(event) => updateLine(index, 'productId', event.target.value)}
              aria-label={`Line ${index + 1} product ID`}
            />
            <input
              type="number"
              min="1"
              value={item.variantId}
              onChange={(event) => updateLine(index, 'variantId', event.target.value)}
              aria-label={`Line ${index + 1} variant ID`}
            />
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={item.quantity}
              onChange={(event) => updateLine(index, 'quantity', event.target.value)}
              aria-label={`Line ${index + 1} quantity`}
            />
            <input
              type="number"
              min="0"
              step="0.01"
              value={item.price}
              onChange={(event) => updateLine(index, 'price', event.target.value)}
              aria-label={`Line ${index + 1} price`}
            />
            <button
              type="button"
              className="button button-secondary resource-form__icon-button"
              onClick={() => removeLine(index)}
              disabled={items.length === 1}
              aria-label={`Remove line ${index + 1}`}
              title="Remove line"
            >
              <X size={16} />
            </button>
          </div>
        ))}

        <button
          type="button"
          className="button button-secondary resource-form__add-line"
          onClick={addLine}
        >
          <Plus size={16} />
          Add Line
        </button>
      </div>
      {error ? <span className="field-error">{error}</span> : null}
    </div>
  )
}

function ResourceForm({
  config,
  mode,
  record,
  isSubmitting,
  serverErrors,
  referenceErrors = {},
  isReferenceLoading = false,
  referenceData = {},
  draftData = null,
  onDraftChange,
  onSaveDraft,
  rows = [],
  onCancel,
  onSubmit,
}) {
  const isSubCategoriesForm = config.key === 'subCategories'
  const fields = useMemo(() => getActiveFields(config, mode), [config, mode])
  const [formData, setFormData] = useState(() => ({
    ...buildInitialForm(config, record, mode),
    ...(isSubCategoriesForm && mode === 'create' && isRecord(draftData?.values) ? draftData.values : {}),
  }))
  const [baselineData] = useState(() => buildInitialForm(config, record, mode))
  const [touched, setTouched] = useState({})
  const [submitAttempted, setSubmitAttempted] = useState(false)

  const errors = useMemo(
    () => fields.reduce((result, field) => {
      result[field.name] =
        getFieldError(field, formData[field.name], mode, { formData, referenceData, rows }) ||
        getServerFieldError(serverErrors, field)
      return result
    }, {}),
    [fields, formData, mode, referenceData, rows, serverErrors],
  )
  const isValid = Object.values(errors).every((value) => !value)
  const payload = useMemo(() => buildPayload(formData, fields), [fields, formData])
  const baselinePayload = useMemo(
    () => buildPayload(baselineData, fields),
    [baselineData, fields],
  )
  const changedPayload = useMemo(
    () => getChangedPayload(payload, baselinePayload),
    [baselinePayload, payload],
  )
  const isDirty = Object.keys(changedPayload).length > 0
  const hasDraftContent = isSubCategoriesForm && mode === 'create' && hasMeaningfulDraft(formData)
  const hasBlockingReferenceIssue = fields.some((field) => {
    if (!field.optionsFrom || !field.required || !['select', 'searchableSelect'].includes(field.type)) {
      return false
    }

    const options = Array.isArray(referenceData[field.optionsFrom])
      ? referenceData[field.optionsFrom]
      : []

    return Boolean(referenceErrors[field.optionsFrom]) || (!isReferenceLoading && options.length === 0)
  })
  const saveDisabled =
    isSubmitting ||
    isReferenceLoading ||
    hasBlockingReferenceIssue ||
    !isValid ||
    (mode === 'edit' && !isDirty)

  function updateField(name, value) {
    setFormData((currentValue) => ({
      ...currentValue,
      [name]: value,
    }))
  }

  useEffect(() => {
    if (!isSubCategoriesForm || mode !== 'create') {
      return
    }

    onDraftChange?.(formData, hasMeaningfulDraft(formData))
  }, [formData, isSubCategoriesForm, mode, onDraftChange])

  function updateGoodsReceiptFromPurchaseOrder(value) {
    const purchaseOrder = (referenceData.purchaseOrders ?? []).find((item) =>
      String(getReferenceValue(item, 'poId')) === String(value),
    )
    const variantId = getReferenceValue(purchaseOrder, 'variantId') || ''
    const hasPurchaseOrder = Boolean(purchaseOrder)
    const remainingQuantity = getGoodsReceiptRemainingQuantity(value, referenceData, rows)

    setFormData((currentValue) => ({
      ...currentValue,
      poId: value,
      supplierId: getReferenceValue(purchaseOrder, 'supplierId') || '',
      supplierName:
        getReferenceValue(purchaseOrder, 'supplierName') ||
        getReferenceValue(purchaseOrder, 'supplier') ||
        '',
      productId: getReferenceValue(purchaseOrder, 'productId') || '',
      productName: getReferenceValue(purchaseOrder, 'productName') || '',
      variantId,
      variantName: hasPurchaseOrder ? getVariantDisplayName(variantId, referenceData) : '',
      quantityReceived: remainingQuantity ?? '',
      price: getReferenceValue(purchaseOrder, 'price') || '',
    }))
  }

  function handleChange(event) {
    const { name, value, type, checked } = event.target
    const field = fields.find((item) => item.name === name)

    if (config.key === 'goodsReceipts' && name === 'poId') {
      updateGoodsReceiptFromPurchaseOrder(value)
      return
    }

    updateField(name, field?.type === 'email' ? sanitizeEmailInput(value) : type === 'checkbox' ? checked : value)
  }

  function handleBlur(event) {
    setTouched((currentValue) => ({
      ...currentValue,
      [event.target.name]: true,
    }))
  }

  function shouldShowError(field) {
    return touched[field.name] || submitAttempted || Boolean(getServerFieldError(serverErrors, field))
  }

  function handleSubmit(event) {
    event.preventDefault()
    setSubmitAttempted(true)
    setTouched(fields.reduce((result, field) => ({ ...result, [field.name]: true }), {}))

    if (!isValid || saveDisabled) {
      return
    }

    onSubmit({
      payload,
      changedPayload,
    })
  }

  function renderField(field) {
    const error = shouldShowError(field) ? errors[field.name] : ''
    const dynamicMax = getDynamicMax(field, { formData, referenceData, rows })
    const helperText = field.maxFrom === 'goodsReceiptRemainingQuantity' && dynamicMax !== null
      ? `Remaining PO quantity: ${dynamicMax}`
      : field.helperText

    if (field.type === 'hidden') {
      return (
        <input
          key={field.name}
          type="hidden"
          name={field.name}
          value={formData[field.name] ?? ''}
          readOnly
        />
      )
    }

    if (field.type === 'lineItems') {
      return (
        <LineItemsField
          key={field.name}
          field={field}
          value={formData[field.name]}
          error={error}
          onChange={(value) => updateField(field.name, value)}
        />
      )
    }

    if (field.type === 'searchableSelect') {
      const referenceRows = Array.isArray(referenceData[field.optionsFrom])
        ? referenceData[field.optionsFrom]
        : []
      const referenceError = field.optionsFrom ? referenceErrors[field.optionsFrom] : ''
      const options = (field.optionsFrom
        ? referenceRows.map((item) => ({
          value: getReferenceOptionValue(item, field.optionValue),
          label: getReferenceOptionLabel(item, field.optionLabel),
        }))
        : field.options ?? []
      ).filter((option) =>
        option &&
        option.value !== undefined &&
        option.value !== null &&
        option.value !== '' &&
        option.label !== undefined &&
        option.label !== null &&
        option.label !== ''
      )
      const emptyOptionsMessage = referenceError
        ? `Unable to load ${getFieldLabel(field).toLowerCase()} options. Please retry after the category service is available.`
        : !isReferenceLoading && field.required && options.length === 0
          ? 'No categories available.'
          : ''
      const fieldError = error || emptyOptionsMessage

      return (
        <div
          className={`resource-form__reference-field ${getResourceFieldClassName(config, field)}`.trim()}
          key={field.name}
        >
          <SearchableSelect
            id={`resource-${config.key}-${field.name}`}
            name={field.name}
            label={field.label}

            value={formData[field.name] ?? ''}
            onChange={handleChange}
            onBlur={handleBlur}
            options={options}
            placeholder={
              isReferenceLoading
                ? 'Loading categories...'
                : field.placeholder || `Select ${getFieldLabel(field).toLowerCase()}`
            }
            searchPlaceholder={field.searchPlaceholder || `Search ${getFieldLabel(field).toLowerCase()}`}
            error={fieldError}
            showError={Boolean(fieldError)}
            disabled={field.readOnly || isReferenceLoading || Boolean(referenceError) || options.length === 0}
            className="resource-form__combobox"
            menuClassName={isSubCategoriesForm ? 'resource-form__combobox-menu resource-form__combobox-menu--subCategories' : ''}
          />
          {isReferenceLoading ? (
            <span className="field-help resource-form__reference-note">Loading category options...</span>
          ) : null}
        </div>
      )
    }

    if (field.type === 'select') {
      return (
        <div
          className={`field ${error ? 'field--error' : ''} ${getResourceFieldClassName(config, field)}`.trim()}
          key={field.name}
        >
          <label htmlFor={`resource-${config.key}-${field.name}`}>{field.label}</label>
          <select
            id={`resource-${config.key}-${field.name}`}
            name={field.name}
            value={formData[field.name]}
            onChange={handleChange}
            onBlur={handleBlur}
            aria-invalid={Boolean(error)}
          >
            <option value="">Select {field.label.toLowerCase()}</option>
            {(field.optionsFrom
              ? (referenceData[field.optionsFrom] ?? []).map((item) => ({
                value: getReferenceOptionValue(item, field.optionValue),
                label: getReferenceOptionLabel(item, field.optionLabel),
              }))
              : field.options ?? []
            ).filter((option) => option.value !== undefined && option.value !== null && option.value !== '').map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {error ? <span className="field-error">{error}</span> : null}
        </div>
      )
    }

    if (field.type === 'checkbox') {
      return (
        <label className="resource-form__checkbox" key={field.name}>
          <input
            type="checkbox"
            name={field.name}
            checked={Boolean(formData[field.name])}
            onChange={handleChange}
            onBlur={handleBlur}
          />
          <span>{field.label}</span>
        </label>
      )
    }

    if (field.type === 'currency') {
      return (
        <CurrencyInput
          key={field.name}
          id={`resource-${config.key}-${field.name}`}
          name={field.name}
          label={field.label}

          value={formData[field.name]}
          onChange={handleChange}
          onBlur={handleBlur}
          error={error}
          readOnly={field.readOnly}
        />
      )
    }

    return (
      <InputField
        key={field.name}
        id={`resource-${config.key}-${field.name}`}
        name={field.name}
        label={field.label}

        {...(field.type === 'email' ? emailInputProps : {})}
        type={field.type === 'textarea' ? 'text' : field.type || 'text'}
        textarea={field.type === 'textarea'}
        rows={field.type === 'textarea' ? (isSubCategoriesForm ? 3 : 4) : undefined}
        value={formData[field.name]}
        placeholder={field.placeholder}
        onChange={handleChange}
        onBlur={handleBlur}
        error={error}
        min={field.min}
        max={dynamicMax ?? field.max}
        readOnly={field.readOnly}
        step={field.type === 'number' ? 'any' : undefined}
        helperText={helperText}
        className={getResourceFieldClassName(config, field)}
      />
    )
  }


  return (
    <form
      className={`resource-form ${isSubCategoriesForm ? 'resource-form--subCategories' : ''}`.trim()}
      onSubmit={handleSubmit}
      autoComplete="off"
    >
      <div className="resource-form__section">
        {/* The {!isSubCategoriesForm ? (...) : null} block has been completely removed */}

        {fields.length === 0 ? (
          <div className="resource-form__empty">This resource is read-only.</div>
        ) : (
          <div className="form-grid">
            {fields.map(renderField)}
          </div>
        )}
      </div>

      <div className="button-row resource-form__footer">
        {isSubCategoriesForm && mode === 'create' && hasDraftContent ? (
          <span className="resource-form__draft-indicator">Unsaved changes</span>
        ) : null}
        <button type="submit" className="button button-primary" disabled={saveDisabled}>
          {isSubmitting ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} />}
          {isSubmitting ? 'Saving...' : mode === 'edit' ? 'Save Changes' : 'Create'}
        </button>
        <button type="button" className="button button-cancel" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </button>
      </div>
    </form>
  )
}

function SummaryCard({ label, value, helper, icon: Icon }) {
  return (
    <StatisticsCard
      icon={Icon}
      label={label}
      value={value}
      helper={helper}
      className="resource-center__summary-card"
    />
  )
}

function ResourcePage({ config, navigationContent = null }) {
  const { hasPermission } = useAuth()
  const [rows, setRows] = useState([])
  const [isLoading, setIsLoading] = useState(() => !listResource.hasCache?.(config))
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [metric, setMetric] = useState(null)
  const [editingRecord, setEditingRecord] = useState(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [serverErrors, setServerErrors] = useState(null)
  const [referenceData, setReferenceData] = useState({})
  const [referenceErrors, setReferenceErrors] = useState({})
  const [subCategoryDraft, setSubCategoryDraft] = useState(() => readStoredDraft(SUBCATEGORY_DRAFT_KEY))
  const [isDraftClosePromptOpen, setIsDraftClosePromptOpen] = useState(false)
  const [notificationFilters, setNotificationFilters] = useState({ read: 'all', type: 'all' })
  const [selectedSubCategoryIds, setSelectedSubCategoryIds] = useState([])
  const [selectedProductStyleRowIds, setSelectedProductStyleRowIds] = useState([])

  const canCreate = (config.canCreate ?? true) && hasPermission(config.permissionKey, 'create')
  const canUpdate = (config.canUpdate ?? true) && hasPermission(config.permissionKey, 'edit')
  const canDelete = Boolean(config.forceDelete) ||
    ((config.canDelete ?? true) && hasPermission(config.permissionKey, 'delete'))
  const mode = editingRecord ? 'edit' : 'create'
  const Icon = config.icon
  const isSubCategoriesPage = config.key === 'subCategories'
  const isInventoryCompactPage = INVENTORY_COMPACT_KEYS.has(config.key)
  const isAuditLogsPage = config.key === 'auditLogs'
  const isProductStylePage = PRODUCT_STYLE_RESOURCE_KEYS.has(config.key)
  const usesCompactActionMenu = ACTION_MENU_RESOURCE_KEYS.has(config.key)
  const isNotificationsPage = config.key === 'notifications'
  const isInvoicesPage = config.key === 'invoices'
  const hasSubCategoryDraft = isSubCategoriesPage && hasMeaningfulDraft(subCategoryDraft?.values)
  const inventoryMetrics = useMemo(
    () => isInventoryCompactPage ? getInventoryWorkspaceMetrics(config, rows) : [],
    [config, isInventoryCompactPage, rows],
  )

  const updateSubCategoryDraft = useCallback((values, shouldPersist = true) => {
    if (!isSubCategoriesPage) {
      return
    }

    if (!shouldPersist || !hasMeaningfulDraft(values)) {
      clearStoredDraft(SUBCATEGORY_DRAFT_KEY)
      setSubCategoryDraft(null)
      return
    }

    const nextDraft = {
      values: {
        categoryId: values.categoryId ?? '',
        name: values.name ?? '',
        description: values.description ?? '',
        status: values.status || 'active',
      },
      updatedAt: new Date().toISOString(),
    }

    writeStoredDraft(SUBCATEGORY_DRAFT_KEY, nextDraft)
    setSubCategoryDraft(nextDraft)
  }, [isSubCategoriesPage])

  function clearSubCategoryDraft() {
    clearStoredDraft(SUBCATEGORY_DRAFT_KEY)
    setSubCategoryDraft(null)
  }

  const loadRows = useCallback(async function loadRows(options = {}) {
    const force = Boolean(options.force)
    const shouldShowLoading = options.showLoading ?? (force || !listResource.hasCache?.(config))

    if (shouldShowLoading) {
      setIsLoading(true)
    }

    setError('')

    const referenceEntries = Object.entries(config.referenceEndpoints ?? {})
    const [response, metricResponse, ...referenceResponses] = await Promise.all([
      listResource(config, undefined, { force }),
      config.metricEndpoint
        ? apiRequest(config.metricEndpoint)
        : Promise.resolve({ success: true, data: null }),
      ...referenceEntries.map(([key, endpoint]) => {
        if (key === 'products') {
          return Promise.all([
            apiRequest(`${API_ENDPOINTS.products.list}?page=1&pageSize=500&isArchived=false`),
            apiRequest(`${API_ENDPOINTS.products.list}?page=1&pageSize=500&isArchived=true`),
          ]).then(([activeRes, archivedRes]) => {
            if (activeRes.success || archivedRes.success) {
              const activeList = activeRes.success ? getResponseList(activeRes, 'products') : []
              const archivedList = archivedRes.success ? getResponseList(archivedRes, 'products') : []
              return {
                success: true,
                data: {
                  products: [...activeList, ...archivedList],
                },
              }
            }
            return activeRes
          })
        }
        return apiRequest(endpoint)
      }),
    ])

    if (!response.success) {
      setRows([])
      setError(response.error || `Unable to load ${config.title}.`)
    } else {
      setRows((response.data ?? []).map((row) => normalizeResourceRow(row, config)))
    }

    if (metricResponse.success) {
      setMetric(getResponseData(metricResponse, null))
    }

    if (referenceEntries.length > 0) {
      setReferenceData(referenceEntries.reduce((result, [key], index) => {
        let list = referenceResponses[index]?.success
          ? getResponseList(referenceResponses[index], config.referenceListKeys?.[key]).map((row) => normalizeResourceRow(row, {}))
          : [];
        if (list.length === 0 && (key === 'products' || key === 'warehouses')) {
          try {
            const rawData = localStorage.getItem('ims-frontend-data');
            if (rawData) {
              const parsed = JSON.parse(rawData);
              list = parsed[key] || [];
            }
          } catch (e) {
            console.error(`Error loading fallback ${key} from localStorage:`, e);
          }
        }
        return {
          ...result,
          [key]: list,
        };
      }, {}))
      setReferenceErrors(referenceEntries.reduce((result, [key], index) => ({
        ...result,
        [key]: referenceResponses[index]?.success
          ? ''
          : referenceResponses[index]?.error || 'Unable to load reference data.',
      }), {}))
    } else {
      setReferenceData({})
      setReferenceErrors({})
    }

    setIsLoading(false)
  }, [config])

  useEffect(() => {
    if (!STOCK_RESOURCE_KEYS.has(config.key)) {
      return undefined
    }

    function handleStockDataUpdated(event) {
      console.log('[ResourceCenter] Reloading stock resource after stock update', {
        resource: config.key,
        detail: event.detail,
      })
      loadRows({ force: true })
    }

    window.addEventListener(STOCK_DATA_UPDATED_EVENT, handleStockDataUpdated)
    return () => window.removeEventListener(STOCK_DATA_UPDATED_EVENT, handleStockDataUpdated)
  }, [config.key, loadRows])

  useEffect(() => {
    loadRows({ showLoading: !listResource.hasCache?.(config) })
  }, [config, loadRows])

  const summary = useMemo(() => {
    const statusCounts = rows.reduce((result, row) => {
      const status = String(readResourceValue(row, 'status', '') || '').toLowerCase()
      if (status) {
        result[status] = (result[status] ?? 0) + 1
      }
      return result
    }, {})
    const unreadCount = metric?.unreadCount ?? metric?.UnreadCount ?? null

    return {
      total: rows.length,
      active: config.statuslessRowsAreActive
        ? rows.length
        : statusCounts.active ?? statusCounts.posted ?? statusCounts.approved ?? 0,
      pending: (statusCounts.pending ?? statusCounts.draft ?? 0) + (hasSubCategoryDraft ? 1 : 0),
      unread: unreadCount,
    }
  }, [config.statuslessRowsAreActive, hasSubCategoryDraft, metric, rows])

  const notificationSummary = useMemo(() => {
    const unread = rows.filter((row) => !getNotificationReadState(row)).length
    const critical = rows.filter((row) => getNotificationType(row).toLowerCase() === 'critical').length

    return {
      total: rows.length,
      unread,
      read: Math.max(rows.length - unread, 0),
      critical,
    }
  }, [rows])

  const invoiceSummary = useMemo(() => {
    return rows.reduce((result, row) => {
      const total = Number(readResourceValue(row, 'totalAmount', 0)) || 0
      const paid = Number(readResourceValue(row, 'paidAmount', 0)) || 0
      const balance = Number(readResourceValue(row, 'balanceAmount', 0)) || 0
      const status = String(readResourceValue(row, 'status', '') || '').toLowerCase()

      result.total += 1
      result.value += total
      result.balance += balance

      if (balance <= 0 || status === 'paid') {
        result.paid += 1
      } else {
        result.open += 1
      }

      if (paid > 0 && balance > 0) {
        result.partial += 1
      }

      return result
    }, {
      total: 0,
      value: 0,
      balance: 0,
      paid: 0,
      open: 0,
      partial: 0,
    })
  }, [rows])

  const notificationTypeOptions = useMemo(() => {
    const typeLabels = new Map()

    rows.forEach((row) => {
      const type = getNotificationType(row)
      typeLabels.set(type.toLowerCase(), formatStatusLabel(type))
    })

    return [
      { value: 'all', label: 'All types' },
      ...Array.from(typeLabels.entries())
        .sort((firstItem, secondItem) => firstItem[1].localeCompare(secondItem[1]))
        .map(([value, label]) => ({ value, label })),
    ]
  }, [rows])

  const filteredNotificationRows = useMemo(() => {
    if (!isNotificationsPage) {
      return rows
    }

    return rows.filter((row) => {
      const isRead = getNotificationReadState(row)
      const type = getNotificationType(row).toLowerCase()

      if (notificationFilters.read === 'read' && !isRead) {
        return false
      }

      if (notificationFilters.read === 'unread' && isRead) {
        return false
      }

      if (notificationFilters.type !== 'all' && type !== notificationFilters.type) {
        return false
      }

      return true
    })
  }, [isNotificationsPage, notificationFilters, rows])

  const productStyleTableRows = useMemo(() => {
    if (!isProductStylePage) {
      return rows
    }

    return rows.map((row, index) => ({
      ...row,
      __resourceSelectionKey: getSelectionRowKey(row, index),
    }))
  }, [isProductStylePage, rows])

  const selectedSubCategories = useMemo(() => {
    const selectedIdSet = new Set(selectedSubCategoryIds.map(String))
    return rows.filter((row) => selectedIdSet.has(String(row.id || '')))
  }, [rows, selectedSubCategoryIds])
  const hasSelectedSubCategories = selectedSubCategories.length > 0
  const selectedProductStyleRows = useMemo(() => {
    const selectedIdSet = new Set(selectedProductStyleRowIds.map(String))
    return rows.filter((row, index) => selectedIdSet.has(getSelectionRowKey(row, index)))
  }, [rows, selectedProductStyleRowIds])
  const hasSelectedProductStyleRows = selectedProductStyleRows.length > 0

  useEffect(() => {
    if (!isSubCategoriesPage) {
      return
    }

    const visibleIdSet = new Set(rows.map((row) => String(row.id || '')))
    setSelectedSubCategoryIds((currentValue) => currentValue.filter((id) => visibleIdSet.has(String(id))))
  }, [isSubCategoriesPage, rows])

  useEffect(() => {
    if (!isProductStylePage) {
      return
    }

    const visibleIdSet = new Set(rows.map((row, index) => getSelectionRowKey(row, index)))
    setSelectedProductStyleRowIds((currentValue) => currentValue.filter((id) => visibleIdSet.has(String(id))))
  }, [isProductStylePage, rows])

  async function handleSave({ payload, changedPayload }) {
    setIsSaving(true)
    setServerErrors(null)

    const id = editingRecord?.id
    const response = id
      ? await updateResource(config, id, payload, changedPayload)
      : await createResource(config, payload)

    setIsSaving(false)

    if (!response.success) {
      setServerErrors(response.errors)
      showToast({
        type: 'error',
        title: config.title,
        message: response.error || `Unable to save ${config.entityName.toLowerCase()}.`,
      })
      return
    }

    showToast({
      type: 'success',
      title: config.title,
      message: `${config.entityName} ${id ? 'updated' : 'created'} successfully.`,
    })
    if (isSubCategoriesPage && !id) {
      clearSubCategoryDraft()
    }
    setIsFormOpen(false)
    setEditingRecord(null)
    notifyCatalogStructureUpdate(config, id ? 'updated' : 'created')
    if (config.key === 'goodsReceipts') {
      window.dispatchEvent(new CustomEvent(PRODUCT_CATALOG_UPDATED_EVENT))
    }
    await loadRows({ force: true })
  }

  async function confirmDelete() {
    if (!deleteTarget) {
      return
    }

    setIsDeleting(true)

    const response = await deleteResource(config, deleteTarget.id)

    if (!response.success) {
      showToast({
        type: 'error',
        title: config.title,
        message: getDeleteErrorMessage(config, response.error),
      })
      setIsDeleting(false)
      return
    }

    setRows((currentRows) =>
      currentRows.filter((row) => String(row.id) !== String(deleteTarget.id)),
    )
    setDeleteTarget(null)
    showToast({
      type: 'success',
      title: config.title,
      message: response.message || `${config.entityName} deleted successfully.`,
    })
    notifyCatalogStructureUpdate(config, 'deleted')
    await loadRows({ force: true })
    setIsDeleting(false)
  }

  async function handleBulkSubCategoryDelete() {
    if (!canDelete || selectedSubCategories.length === 0) {
      return
    }

    setIsDeleting(true)

    try {
      for (const row of selectedSubCategories) {
        const response = await deleteResource(config, row.id)

        if (!response.success) {
          throw new Error(getDeleteErrorMessage(config, response.error))
        }
      }

      setSelectedSubCategoryIds([])
      showToast({
        type: 'success',
        title: config.title,
        message: `${selectedSubCategories.length} ${config.entityName} record${selectedSubCategories.length === 1 ? '' : 's'} deleted successfully.`,
      })
      notifyCatalogStructureUpdate(config, 'deleted')
      await loadRows({ force: true })
    } catch (deleteError) {
      showToast({
        type: 'error',
        title: config.title,
        message:
          deleteError instanceof Error
            ? deleteError.message
            : `Unable to delete ${config.entityName.toLowerCase()}.`,
      })
    } finally {
      setIsDeleting(false)
    }
  }

  async function handleBulkProductStyleDelete() {
    if (!canDelete || selectedProductStyleRows.length === 0) {
      return
    }

    setIsDeleting(true)

    try {
      for (const row of selectedProductStyleRows) {
        const response = await deleteResource(config, row.id)

        if (!response.success) {
          throw new Error(getDeleteErrorMessage(config, response.error))
        }
      }

      setSelectedProductStyleRowIds([])
      showToast({
        type: 'success',
        title: config.title,
        message: `${selectedProductStyleRows.length} ${config.entityName} record${selectedProductStyleRows.length === 1 ? '' : 's'} deleted successfully.`,
      })
      notifyCatalogStructureUpdate(config, 'deleted')
      await loadRows({ force: true })
    } catch (deleteError) {
      showToast({
        type: 'error',
        title: config.title,
        message:
          deleteError instanceof Error
            ? deleteError.message
            : `Unable to delete ${config.entityName.toLowerCase()}.`,
      })
    } finally {
      setIsDeleting(false)
    }
  }

  async function handleRowAction(action, row) {
    const id = row.id
    const endpoint = typeof action.endpoint === 'function'
      ? action.endpoint(row, id)
      : action.endpoint

    if (!endpoint) {
      return
    }

    if (action.type === 'download') {
      const filename = typeof action.filename === 'function'
        ? action.filename(row, id)
        : action.filename || `${config.key}-${id}.pdf`
      const response = await downloadResourceFile(endpoint, filename)

      if (!response.success) {
        showToast({
          type: 'error',
          title: config.title,
          message: response.error || 'Download failed.',
        })
        return
      }

      downloadBlob(response.blob, response.filename)
      showToast({
        type: 'success',
        title: config.title,
        message: 'File downloaded successfully.',
      })
      return
    }

    const response = action.type === 'put'
      ? await putResourceAction(endpoint, action.body)
      : await postResourceAction(endpoint)

    if (!response.success) {
      showToast({
        type: 'error',
        title: config.title,
        message: response.error || `${action.label} failed.`,
      })
      return
    }

    showToast({
      type: 'success',
      title: config.title,
      message: action.successMessage || `${action.label} completed successfully.`,
    })
    await loadRows({ force: true })
  }

  function openCreate() {
    setServerErrors(null)
    setEditingRecord(null)
    if (isSubCategoriesPage) {
      setSubCategoryDraft(readStoredDraft(SUBCATEGORY_DRAFT_KEY))
    }
    setIsFormOpen(true)
  }

  function openEdit(row) {
    setServerErrors(null)
    setEditingRecord(row)
    setIsFormOpen(true)
  }

  function closeForm() {
    if (isSubCategoriesPage && mode === 'create' && hasSubCategoryDraft) {
      setIsDraftClosePromptOpen(true)
      return
    }

    setServerErrors(null)
    setEditingRecord(null)
    setIsFormOpen(false)
  }

  function closeFormWithoutPrompt() {
    setServerErrors(null)
    setEditingRecord(null)
    setIsFormOpen(false)
    setIsDraftClosePromptOpen(false)
  }

  function handleSaveDraftAndClose() {
    if (hasSubCategoryDraft) {
      showToast({
        type: 'success',
        title: 'Draft saved',
        message: 'SubCategory draft saved on this device.',
      })
    }

    closeFormWithoutPrompt()
  }

  function handleDiscardDraftAndClose() {
    clearSubCategoryDraft()
    closeFormWithoutPrompt()
  }

  const baseColumns = isSubCategoriesPage
    ? [
      {
        key: 'name',
        label: 'SubCategory Name',
        sortable: true,
        mobilePrimary: true,
        className: 'resource-center__subcategories-col-name',
        tableWidth: 250,
        style: { width: 250, minWidth: 250, maxWidth: 250 },
        headerStyle: { width: 250, minWidth: 250, maxWidth: 250 },
        searchValue: (row) => [
          readResourceValue(row, 'name', ''),
          readResourceValue(row, 'categoryName', ''),
          readResourceValue(row, 'status', ''),
        ].join(' '),
        render: (row) => (
          <div className="resource-center__subcategories-identity">
            <strong title={readResourceValue(row, 'name', 'Unnamed subcategory')}>
              {readResourceValue(row, 'name', 'Unnamed subcategory')}
            </strong>
            <span title={`ID ${readResourceValue(row, 'id', '')}`}>
              ID {readResourceValue(row, 'id', 'Not set')}
            </span>
          </div>
        ),
        sortValue: (row) => readResourceValue(row, 'name', ''),
      },
      {
        key: 'categoryName',
        label: 'Category',
        sortable: true,
        className: 'resource-center__subcategories-col-category',
        tableWidth: 170,
        style: { width: 170, minWidth: 170, maxWidth: 170 },
        headerStyle: { width: 170, minWidth: 170, maxWidth: 170 },
        render: (row) => (
          <span className="resource-center__subcategories-cell-text" title={readResourceValue(row, 'categoryName', 'Not set')}>
            {readResourceValue(row, 'categoryName', 'Not set')}
          </span>
        ),
      },
      {
        key: 'status',
        label: 'Status',
        sortable: true,
        mobileStatus: true,
        className: 'resource-center__subcategories-col-status',
        tableWidth: 96,
        style: { width: 96, minWidth: 96, maxWidth: 96 },
        headerStyle: { width: 96, minWidth: 96, maxWidth: 96 },
        render: (row) => {
          const status = readResourceValue(row, 'status', 'active')
          return (
            <StatusBadge type={getStatusType(status)}>
              {formatStatusLabel(status)}
            </StatusBadge>
          )
        },
        sortValue: (row) => readResourceValue(row, 'status', ''),
      },
      {
        key: 'createdAt',
        label: 'Created Date',
        sortable: true,
        className: 'resource-center__subcategories-col-date',
        tableWidth: 170,
        style: { width: 170, minWidth: 170, maxWidth: 170 },
        headerStyle: { width: 170, minWidth: 170, maxWidth: 170 },
        render: (row) => readResourceValue(row, 'createdAt') ? formatDate(readResourceValue(row, 'createdAt')) : 'Not set',
        sortValue: (row) => new Date(readResourceValue(row, 'createdAt', 0)).getTime() || 0,
      },
    ]
    : isNotificationsPage
      ? [
        {
          key: 'title',
          label: 'Notification',
          sortable: true,
          mobilePrimary: true,
          className: 'resource-center__notifications-col-title',
          searchValue: (row) => [
            readResourceValue(row, 'title', ''),
            readResourceValue(row, 'message', ''),
            readResourceValue(row, 'type', ''),
          ].join(' '),
          render: (row) => (
            <div className="resource-center__notification-identity">
              <span className={`resource-center__notification-dot ${getNotificationReadState(row) ? 'is-read' : 'is-unread'}`} aria-hidden="true" />
              <div className="resource-center__notification-copy">
                <strong title={readResourceValue(row, 'title', 'Notification')}>
                  {readResourceValue(row, 'title', 'Notification')}
                </strong>
              </div>
            </div>
          ),
        },
        {
          key: 'type',
          label: 'Type',
          sortable: true,
          mobileStatus: true,
          className: 'resource-center__notifications-col-type',
          render: (row) => {
            const type = getNotificationType(row)
            return (
              <StatusBadge type={getStatusType(type)}>
                {formatStatusLabel(type)}
              </StatusBadge>
            )
          },
          sortValue: (row) => getNotificationType(row).toLowerCase(),
        },
        {
          key: 'message',
          label: 'Message',
          sortable: true,
          mobileDescription: true,
          className: 'resource-center__notifications-col-message',
          render: (row) => (
            <span className="resource-center__notification-message" title={readResourceValue(row, 'message', '')}>
              {readResourceValue(row, 'message', 'Not set')}
            </span>
          ),
        },
        {
          key: 'isRead',
          label: 'Status',
          sortable: true,
          mobileStatus: true,
          className: 'resource-center__notifications-col-status',
          render: (row) => {
            const readAction = (config.rowActions ?? []).find((action) => action.key === 'read')
            const isRead = getNotificationReadState(row)

            return (
              <div className="resource-center__notification-status-cell">
                <StatusBadge type={isRead ? 'success' : 'pending'}>
                  {isRead ? 'Read' : 'Unread'}
                </StatusBadge>
                {!isRead && readAction ? (
                  <button
                    type="button"
                    className="button button-secondary resource-center__notification-read-button"
                    onClick={(event) => {
                      event.stopPropagation()
                      handleRowAction(readAction, row)
                    }}
                    title="Mark notification as read"
                    aria-label="Mark notification as read"
                  >
                    <Check size={14} />
                    <span>Mark Read</span>
                  </button>
                ) : null}
              </div>
            )
          },
          sortValue: (row) => (getNotificationReadState(row) ? 1 : 0),
        },
        {
          key: 'createdAt',
          label: 'Created Date',
          sortable: true,
          className: 'resource-center__notifications-col-created',
          render: (row) => (
            <span className="resource-center__notification-date">
              {readResourceValue(row, 'createdAt') ? formatDate(readResourceValue(row, 'createdAt')) : 'Not set'}
            </span>
          ),
          sortValue: (row) => new Date(readResourceValue(row, 'createdAt', 0)).getTime() || 0,
        },
      ]
      : isInvoicesPage
        ? [
          {
            key: 'invoiceNumber',
            label: 'Invoice',
            sortable: true,
            mobilePrimary: true,
            className: 'resource-center__invoices-col-invoice',
            searchValue: (row) => [
              readResourceValue(row, 'invoiceNumber', ''),
              readResourceValue(row, 'customerName', ''),
              readResourceValue(row, 'status', ''),
            ].join(' '),
            render: (row) => (
              <div className="resource-center__invoice-identity">
                <span className="resource-center__invoice-icon" aria-hidden="true">
                  <ReceiptText size={15} />
                </span>
                <div>
                  <strong title={readResourceValue(row, 'invoiceNumber', 'Invoice')}>
                    {readResourceValue(row, 'invoiceNumber', 'Invoice')}
                  </strong>
                  <span>Due {readResourceValue(row, 'dueDate') ? formatDate(readResourceValue(row, 'dueDate')) : 'Not set'}</span>
                </div>
              </div>
            ),
            sortValue: (row) => readResourceValue(row, 'invoiceNumber', ''),
          },
          {
            key: 'customerName',
            label: 'Customer',
            sortable: true,
            className: 'resource-center__invoices-col-customer',
            render: (row) => (
              <span className="resource-center__invoice-text" title={readResourceValue(row, 'customerName', 'No customer')}>
                {readResourceValue(row, 'customerName', 'No customer')}
              </span>
            ),
          },
          {
            key: 'invoiceDate',
            label: 'Invoice Date',
            sortable: true,
            className: 'resource-center__invoices-col-date',
            render: (row) => readResourceValue(row, 'invoiceDate') ? formatDate(readResourceValue(row, 'invoiceDate')) : 'Not set',
            sortValue: (row) => new Date(readResourceValue(row, 'invoiceDate', 0)).getTime() || 0,
          },
          {
            key: 'totalAmount',
            label: 'Total',
            sortable: true,
            className: 'resource-center__invoices-col-money',
            render: (row) => (
              <span className="resource-center__invoice-money">
                {formatCurrency(readResourceValue(row, 'totalAmount', 0))}
              </span>
            ),
            sortValue: (row) => Number(readResourceValue(row, 'totalAmount', 0)) || 0,
          },
          {
            key: 'payment',
            label: 'Payment',
            sortable: true,
            className: 'resource-center__invoices-col-payment',
            render: (row) => (
              <div className="resource-center__invoice-payment">
                <strong>{formatCurrency(readResourceValue(row, 'paidAmount', 0))}</strong>
                <span>Balance {formatCurrency(readResourceValue(row, 'balanceAmount', 0))}</span>
              </div>
            ),
            sortValue: (row) => Number(readResourceValue(row, 'balanceAmount', 0)) || 0,
          },
          {
            key: 'status',
            label: 'Status',
            sortable: true,
            mobileStatus: true,
            className: 'resource-center__invoices-col-status',
            render: (row) => formatCellValue(row, { key: 'status', format: 'status' }),
            sortValue: (row) => readResourceValue(row, 'status', ''),
          },
        ]
        : (config.columns ?? []).map((column, index) => {
          const auditWidth = isAuditLogsPage ? AUDIT_LOG_COLUMN_WIDTHS[column.key] : undefined

          return {
            ...column,
            className: isAuditLogsPage
              ? `resource-center__audit-col-${column.key}`
              : column.className,
            tableWidth: auditWidth ?? column.tableWidth,
            style: auditWidth
              ? { ...(column.style || {}), width: auditWidth, minWidth: auditWidth, maxWidth: auditWidth }
              : column.style,
            headerStyle: auditWidth
              ? { ...(column.headerStyle || {}), width: auditWidth, minWidth: auditWidth, maxWidth: auditWidth }
              : column.headerStyle,
            mobilePrimary: column.mobilePrimary ?? index === 0,
            mobileDescription: column.mobileDescription ??
              ['description', 'message', 'reason', 'companyAddress', 'notes'].includes(column.key),
            mobileStatus: column.mobileStatus ?? (column.format === 'status' || ['status', 'isActive', 'type'].includes(column.key)),
            searchable: column.searchable,
            render: (row) => formatCellValue(row, column, referenceData),
            searchValue: (row) => String(readResourceValue(row, column.key, '') ?? ''),
            sortValue: (row) => readResourceValue(row, column.key, ''),
          }
        })
  const columns = isSubCategoriesPage
    ? [
      ...baseColumns,
      {
        key: 'actions',
        label: 'Actions',
        searchable: false,
        hideable: false,
        className: 'resource-center__subcategories-col-actions',
        tableWidth: 72,
        style: { width: 72, minWidth: 72, maxWidth: 72 },
        headerStyle: { width: 72, minWidth: 72, maxWidth: 72 },
        render: (row) => (
          <ActionMenu
            iconOnly
            label={`Actions for ${readResourceValue(row, 'name', config.entityName)}`}
            className="resource-center__subcategories-row-actions"
            actions={[
              canUpdate ? {
                key: 'edit',
                label: 'Edit',
                icon: Pencil,
                onClick: () => openEdit(row),
              } : null,
              canDelete ? {
                key: 'delete',
                label: 'Delete',
                icon: Trash2,
                tone: 'danger',
                onClick: () => setDeleteTarget(row),
              } : null,
            ]}
          />
        ),
      },
    ]
    : isInventoryCompactPage && (canUpdate || canDelete || (config.rowActions ?? []).length)
      ? [
        ...baseColumns,
        {
          key: 'actions',
          label: 'Actions',
          searchable: false,
          hideable: false,
          className: 'resource-center__inventory-col-actions',
          tableWidth: 72,
          style: { width: 72, minWidth: 72, maxWidth: 72 },
          headerStyle: { width: 72, minWidth: 72, maxWidth: 72 },
          render: (row) => (
            <ActionMenu
              iconOnly
              label={`Actions for ${config.entityName}`}
              actions={[
                ...(config.rowActions ?? [])
                  .filter((action) => (action.shouldShow ? action.shouldShow(row) : true))
                  .map((action) => ({
                    key: action.key,
                    label: action.label,
                    icon: action.icon || (action.type === 'download' ? Download : action.type === 'put' ? Check : Mail),
                    onClick: () => handleRowAction(action, row),
                  })),
                canUpdate ? {
                  key: 'edit',
                  label: 'Edit',
                  icon: Pencil,
                  onClick: () => openEdit(row),
                } : null,
                canDelete ? {
                  key: 'delete',
                  label: 'Delete',
                  icon: Trash2,
                  tone: 'danger',
                  onClick: () => setDeleteTarget(row),
                } : null,
              ]}
            />
          ),
        },
      ]
      : usesCompactActionMenu && (canUpdate || canDelete || (config.rowActions ?? []).length)
        ? [
          ...baseColumns,
          {
            key: 'actions',
            label: 'Actions',
            searchable: false,
            hideable: false,
            className: 'resource-center__admin-col-actions',
            tableWidth: 72,
            style: { width: 72, minWidth: 72, maxWidth: 72 },
            headerStyle: { width: 72, minWidth: 72, maxWidth: 72 },
            render: (row) => (
              <ActionMenu
                iconOnly
                align="center"
                label={`Actions for ${readResourceValue(row, 'invoiceNumber', readResourceValue(row, 'name', readResourceValue(row, 'roleName', readResourceValue(row, 'companyName', config.entityName))))}`}
                className="resource-center__admin-row-actions"
                actions={[
                  ...(config.rowActions ?? [])
                    .filter((action) => (action.shouldShow ? action.shouldShow(row) : true))
                    .map((action) => ({
                      key: action.key,
                      label: action.label,
                      icon: action.icon || (action.type === 'download' ? Download : action.type === 'put' ? Check : Mail),
                      onClick: () => handleRowAction(action, row),
                    })),
                  canUpdate ? {
                    key: 'edit',
                    label: 'Edit',
                    icon: Pencil,
                    onClick: () => openEdit(row),
                  } : null,
                  canDelete ? {
                    key: 'delete',
                    label: 'Delete',
                    icon: Trash2,
                    tone: 'danger',
                    onClick: () => setDeleteTarget(row),
                  } : null,
                ]}
              />
            ),
          },
        ]
        : isNotificationsPage
          ? baseColumns
          : (!canUpdate && !canDelete && !(config.rowActions ?? []).length)
            ? baseColumns
            : [
              ...baseColumns,
              {
                key: 'actions',
                label: 'Actions',
                searchable: false,
                render: (row) => (
                  <ActionButtons className="table-actions table-actions--nowrap resource-center__row-actions">
                    {(config.rowActions ?? [])
                      .filter((action) => (action.shouldShow ? action.shouldShow(row) : true))
                      .map((action) => {
                        const ActionIcon = action.icon || (action.type === 'download' ? Download : action.type === 'put' ? Check : Mail)

                        return (
                          <button
                            key={action.key}
                            type="button"
                            className="button button-secondary resource-center__action-button"
                            onClick={(event) => {
                              event.stopPropagation()
                              handleRowAction(action, row)
                            }}
                            title={action.label}
                            aria-label={`${action.label} ${config.entityName}`}
                          >
                            <ActionIcon size={16} />
                            <span>{action.label}</span>
                          </button>
                        )
                      })}
                    {canUpdate ? (
                      <button
                        type="button"
                        className="button button-secondary resource-center__action-button"
                        onClick={(event) => {
                          event.stopPropagation()
                          openEdit(row)
                        }}
                        title="Edit"
                        aria-label={`Edit ${config.entityName}`}
                      >
                        <Pencil size={16} />
                        <span>Edit</span>
                      </button>
                    ) : null}
                    {canDelete ? (
                      <button
                        type="button"
                        className="button button-danger resource-center__action-button"
                        onClick={(event) => {
                          event.stopPropagation()
                          setDeleteTarget(row)
                        }}
                        title="Delete"
                        aria-label={`Delete ${config.entityName}`}
                      >
                        <Trash2 size={16} />
                        <span>Delete</span>
                      </button>
                    ) : null}
                  </ActionButtons>
                ),
              },
            ]
  const resourceActionButtons = isNotificationsPage ? (
    <>
      <ExportMenu
        actions={[
          {
            key: 'notifications-csv',
            label: 'Notifications CSV',
            icon: FileSpreadsheet,
            onClick: () => exportNotificationsCsv(filteredNotificationRows),
          },
        ]}
        disabled={filteredNotificationRows.length === 0}
      />
    </>
  ) : isInvoicesPage ? (
    <>
      <button
        type="button"
        className="button button-secondary"
        onClick={() => loadRows({ force: true })}
        disabled={isLoading}
      >
        <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
        Refresh
      </button>
    </>
  ) : isInventoryCompactPage ? (
    <button
      type="button"
      className="button button-secondary"
      onClick={() => loadRows({ force: true })}
      disabled={isLoading}
    >
      <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
      Refresh
    </button>
  ) : (
    <>
      <button
        type="button"
        className="button button-secondary"
        onClick={() => loadRows({ force: true })}
        disabled={isLoading}
      >
        <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
        Refresh
      </button>
      {canCreate ? (
        <button type="button" className="button button-primary" onClick={openCreate}>
          <Plus size={16} />
          Add {config.entityName}
        </button>
      ) : null}
    </>
  )
  const tableToolbarContent = (
    <FilterBar className="resource-center__table-actions">
      {resourceActionButtons}
    </FilterBar>
  )
  const subCategorySelectedToolbarContent = hasSelectedSubCategories ? (
    <FilterBar className="resource-center__subcategories-selection-actions" ariaLabel="Selected SubCategory actions">
      <div className="resource-center__subcategories-selection-summary" aria-live="polite">
        <Check size={15} />
        <strong>{selectedSubCategories.length} selected</strong>
      </div>
      <button
        type="button"
        className="button button-secondary resource-center__subcategories-selection-button"
        onClick={() => exportSubCategoriesCsv(selectedSubCategories)}
      >
        <Download size={15} />
        Export
      </button>
      <button
        type="button"
        className="button button-secondary resource-center__subcategories-selection-button"
        onClick={() => printSubCategories(selectedSubCategories)}
      >
        <Printer size={15} />
        Print
      </button>
      {canDelete ? (
        <button
          type="button"
          className="button button-secondary resource-center__subcategories-selection-button resource-center__subcategories-selection-button--danger"
          onClick={handleBulkSubCategoryDelete}
          disabled={isDeleting}
        >
          <Trash2 size={15} />
          Delete
        </button>
      ) : null}
    </FilterBar>
  ) : null
  const subCategoryToolbarContent = null
  const productStyleSelectedToolbarContent = hasSelectedProductStyleRows ? (
    <FilterBar className="resource-center__product-style-selection-actions" ariaLabel={`Selected ${config.title} actions`}>
      <div className="resource-center__product-style-selection-summary" aria-live="polite">
        <Check size={15} />
        <strong>{selectedProductStyleRows.length} selected</strong>
      </div>
      <button
        type="button"
        className="button button-secondary resource-center__product-style-selection-button"
        onClick={() => exportResourceRowsCsv(config, selectedProductStyleRows)}
      >
        <Download size={15} />
        Export
      </button>
      <button
        type="button"
        className="button button-secondary resource-center__product-style-selection-button"
        onClick={() => printResourceRows(config, selectedProductStyleRows)}
      >
        <Printer size={15} />
        Print
      </button>
      {canDelete ? (
        <button
          type="button"
          className="button button-secondary resource-center__product-style-selection-button resource-center__product-style-selection-button--danger"
          onClick={handleBulkProductStyleDelete}
          disabled={isDeleting}
        >
          <Trash2 size={15} />
          Delete
        </button>
      ) : null}
    </FilterBar>
  ) : null
  const productStyleSelectedRightContent = hasSelectedProductStyleRows && canCreate ? (
    <FilterBar className="resource-center__table-actions">
      <button type="button" className="button button-primary" onClick={openCreate}>
        <Plus size={16} />
        Add {config.entityName}
      </button>
    </FilterBar>
  ) : null
  const notificationFilterContent = isNotificationsPage ? (
    <FilterBar className="resource-center__notifications-filters" ariaLabel="Notification filters">
      <select
        value={notificationFilters.read}
        onChange={(event) => setNotificationFilters((currentValue) => ({
          ...currentValue,
          read: event.target.value,
        }))}
        aria-label="Filter notification read status"
      >
        <option value="all">All statuses</option>
        <option value="unread">Unread only</option>
        <option value="read">Read only</option>
      </select>
      <select
        value={notificationFilters.type}
        onChange={(event) => setNotificationFilters((currentValue) => ({
          ...currentValue,
          type: event.target.value,
        }))}
        aria-label="Filter notification type"
      >
        {notificationTypeOptions.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </FilterBar>
  ) : null
  const resolvedFilterContent = isSubCategoriesPage
    ? subCategorySelectedToolbarContent
    : isProductStylePage && hasSelectedProductStyleRows
      ? productStyleSelectedToolbarContent
      : notificationFilterContent
  const resolvedToolbarContent = isProductStylePage && hasSelectedProductStyleRows
    ? productStyleSelectedRightContent
    : isSubCategoriesPage
      ? subCategoryToolbarContent
      : tableToolbarContent


  return (
    <div className={`resource-center__page resource-center__page--${config.key} ${isProductStylePage ? 'resource-center__page--product-style products-page' : ''}`}>
      {isProductStylePage ? (
        <header className="products-workspace-header resource-center__product-style-header" aria-label={`${config.title} summary`}>
          <div className="products-workspace-header__title-row">
            <h1>{config.title}</h1>
            <div className="products-workspace-header__metrics" aria-label={`${config.title} metrics`}>
              <span className="products-metric-badge products-metric-badge--total">
                <strong>{summary.total}</strong> Records
              </span>
              <span className="products-metric-badge products-metric-badge--value">
                <strong>{summary.unread ?? summary.active}</strong> {summary.unread !== null ? 'Unread' : 'Active'}
              </span>
              <span className="products-metric-badge products-metric-badge--warning">
                <strong>{summary.pending}</strong> Pending
              </span>
            </div>
          </div>
        </header>
      ) : isSubCategoriesPage ? (
        <header className="resource-center__subcategories-header" aria-label="SubCategories summary">
          <div className="resource-center__subcategories-header-main">
            <h1>{config.title}</h1>
            <div className="resource-center__subcategories-metrics" aria-label="SubCategory metrics">
              <span className="resource-center__subcategories-metric resource-center__subcategories-metric--success">
                {summary.total} Records
              </span>
              <span className="resource-center__subcategories-metric resource-center__subcategories-metric--info">
                {summary.active} Active
              </span>
              <span className="resource-center__subcategories-metric resource-center__subcategories-metric--warning">
                {summary.pending} Draft
              </span>
            </div>
          </div>
          <div className="resource-center__subcategories-header-actions">
            {canCreate ? (
              <button
                type="button"
                className="button button-primary"
                onClick={openCreate}
              >
                <Plus size={16} />
                Add SubCategory
              </button>
            ) : null}
          </div>
        </header>
      ) : isInventoryCompactPage ? (
        <header className="resource-center__inventory-header" aria-label={`${config.title} summary`}>
          <div className="resource-center__inventory-header-main">
            <h1>{config.title}</h1>
            <div className="resource-center__inventory-metrics">
              {inventoryMetrics.map((metric) => (
                <span
                  key={metric.label}
                  className={`resource-center__inventory-metric resource-center__inventory-metric--${metric.tone}`}
                >
                  {metric.value} {metric.label}
                </span>
              ))}
            </div>
          </div>
          <div className="resource-center__inventory-header-actions">
            {canCreate ? (
              <button type="button" className="button button-primary" onClick={openCreate}>
                <Plus size={16} />
                Add {config.entityName}
              </button>
            ) : null}
          </div>
        </header>
      ) : isNotificationsPage || isInvoicesPage ? (
        <header className="resource-center__compact-header" aria-label={`${isInvoicesPage ? 'Accounting' : config.title} workspace summary`}>
          <div className="resource-center__compact-title-row">
            <h1>{isInvoicesPage ? 'Accounting' : config.title}</h1>
            {isNotificationsPage ? (
              <div className="resource-center__compact-metrics" aria-label="Notification summary">
                <span className="resource-center__metric-badge resource-center__metric-badge--total">
                  <strong>{notificationSummary.total}</strong>
                  Notifications
                </span>
                <span className="resource-center__metric-badge resource-center__metric-badge--warning">
                  <strong>{notificationSummary.unread}</strong>
                  Unread
                </span>
                <span className="resource-center__metric-badge resource-center__metric-badge--success">
                  <strong>{notificationSummary.read}</strong>
                  Read
                </span>
                <span className="resource-center__metric-badge resource-center__metric-badge--danger">
                  <strong>{notificationSummary.critical}</strong>
                  Critical
                </span>
              </div>
            ) : (
              <div className="resource-center__compact-metrics" aria-label="Invoice summary">
                <span className="resource-center__metric-badge resource-center__metric-badge--total">
                  <strong>{invoiceSummary.total}</strong>
                  Invoices
                </span>
                <span className="resource-center__metric-badge resource-center__metric-badge--success">
                  <strong>{invoiceSummary.paid}</strong>
                  Paid
                </span>
                <span className="resource-center__metric-badge resource-center__metric-badge--warning">
                  <strong>{invoiceSummary.open}</strong>
                  Open
                </span>
                <span className="resource-center__metric-badge resource-center__metric-badge--info">
                  <strong>{formatCurrency(invoiceSummary.balance)}</strong>
                  Balance
                </span>
              </div>
            )}
            {canCreate ? (
              <button
                type="button"
                className="button button-primary resource-center__header-create-button"
                onClick={openCreate}
              >
                <Plus size={15} />
                Add {config.entityName}
              </button>
            ) : null}
          </div>
        </header>
      ) : (
        <PageHeader
          icon={Icon}
          title={config.title}
          description={config.subtitle}
          actions={null}
        />
      )}

      {navigationContent}

      {!isProductStylePage && !isSubCategoriesPage && !isInventoryCompactPage && !isNotificationsPage && !isInvoicesPage ? (
        <div className="resource-center__summary-grid">
          <SummaryCard
            icon={Icon}
            label="Total Records"
            value={summary.total}
            helper="Rows loaded from the live IMS API."
          />
          <SummaryCard
            icon={CheckCircle2}
            label={summary.unread !== null ? 'Unread' : 'Active / Posted'}
            value={summary.unread ?? summary.active}
            helper={summary.unread !== null ? 'Unread notifications from API.' : 'Records with active workflow status.'}
          />
          <SummaryCard
            icon={RefreshCw}
            label="Pending / Draft"
            value={summary.pending}
            helper="Records still awaiting operational closure."
          />
        </div>
      ) : null}

      {error ? (
        <StateBlock
          type="server"
          title="We could not load this workspace"
          message={error}
          actionLabel="Retry"
          onAction={() => loadRows({ force: true })}
          compact
        />
      ) : null}

      <div className={`card ${isProductStylePage ? 'products-table-card resource-center__products-table-card' : ''} ${isSubCategoriesPage ? 'resource-center__table-card' : ''} ${isInventoryCompactPage ? 'resource-center__inventory-table-card' : ''} ${!isProductStylePage && isAuditLogsPage ? 'resource-center__audit-table-card' : ''} ${isNotificationsPage ? 'resource-center__notifications-table-card' : ''} ${isInvoicesPage ? 'resource-center__invoices-table-card' : ''}`}>
        <DataTable
          className={isProductStylePage ? 'products-data-table--compact resource-center__products-table' : isSubCategoriesPage ? 'resource-center__subcategories-table' : isInventoryCompactPage ? 'resource-center__inventory-table' : isNotificationsPage ? 'resource-center__notifications-table' : isInvoicesPage ? 'resource-center__invoices-table' : ''}
          rows={isProductStylePage ? productStyleTableRows : isNotificationsPage ? filteredNotificationRows : rows}
          columns={columns}
          loading={isLoading}
          defaultPageSize={isProductStylePage || isSubCategoriesPage || isInventoryCompactPage || isNotificationsPage || isInvoicesPage ? 20 : 8}
          showSearch={isSubCategoriesPage ? !hasSelectedSubCategories : isProductStylePage ? !hasSelectedProductStyleRows : true}
          searchPlaceholder={`Search ${config.title.toLowerCase()}`}
          emptyMessage={`No ${config.title.toLowerCase()} records found.`}
          splitToolbar={isProductStylePage || isSubCategoriesPage || isInventoryCompactPage || isNotificationsPage || isInvoicesPage}
          showColumnControls={!(isProductStylePage && hasSelectedProductStyleRows)}
          filterContent={resolvedFilterContent}
          toolbarContent={resolvedToolbarContent}
          columnStorageKey={isProductStylePage ? `ims.${config.key}.visibleColumns.productsStyle.v1` : isSubCategoriesPage ? 'ims.subCategories.visibleColumns.warehouseParity.v1' : isNotificationsPage ? 'ims.notifications.visibleColumns.v2' : isInvoicesPage ? 'ims.invoices.visibleColumns.v2' : ''}
          defaultVisibleColumnKeys={isSubCategoriesPage
            ? ['name', 'categoryName', 'status', 'createdAt', 'actions']
            : isNotificationsPage
              ? ['title', 'type', 'message', 'isRead', 'createdAt']
              : isInvoicesPage
                ? ['invoiceNumber', 'customerName', 'invoiceDate', 'totalAmount', 'payment', 'status', 'actions']
                : []}
          rowClassName={isNotificationsPage ? (row) => (getNotificationReadState(row) ? 'is-read' : 'is-unread') : undefined}
          defaultSortKey={isProductStylePage ? config.columns?.[0]?.key || '' : isSubCategoriesPage ? 'name' : isInventoryCompactPage ? config.columns?.[0]?.key || '' : isNotificationsPage ? 'createdAt' : isInvoicesPage ? 'invoiceDate' : ''}
          defaultSortDirection={isNotificationsPage || isInvoicesPage ? 'desc' : 'asc'}
          enableRowSelection={isSubCategoriesPage || isProductStylePage}
          selectedRowKeys={isSubCategoriesPage ? selectedSubCategoryIds : isProductStylePage ? selectedProductStyleRowIds : undefined}
          onSelectionChange={isSubCategoriesPage ? setSelectedSubCategoryIds : isProductStylePage ? setSelectedProductStyleRowIds : undefined}
          keyField={isProductStylePage ? '__resourceSelectionKey' : 'id'}
        />
      </div>

      {!isProductStylePage && isAuditLogsPage ? (
        <AuditLogsMobileFeed rows={rows} isLoading={isLoading} />
      ) : null}

      {isFormOpen ? (
        <FormModal
          title={`${mode === 'edit' ? 'Edit' : 'Create'} ${config.entityName}`}
          subtitle=""
          onClose={closeForm}
          className={
            isSubCategoriesPage
              ? 'form-modal--subCategories'
              : config.key === 'productAttributes'
                ? 'form-modal--attributes'
                : config.key === 'productVariants'
                  ? 'form-modal--productVariants'
                  : ''
          }
          dialogClassName={
            isSubCategoriesPage
              ? 'form-modal__dialog--subCategories'
              : config.key === 'productAttributes'
                ? 'form-modal__dialog--attributes'
                : config.key === 'productVariants'
                  ? 'form-modal__dialog--productVariants'
                  : ''
          }
          bodyClassName={
            isSubCategoriesPage
              ? 'form-modal__body--subCategories'
              : config.key === 'productAttributes'
                ? 'form-modal__body--attributes'
                : config.key === 'productVariants'
                  ? 'form-modal__body--productVariants'
                  : ''
          }
        >
          <ResourceForm
            key={`${config.key}-${editingRecord?.id ?? 'new'}`}
            config={config}
            mode={mode}
            record={editingRecord}
            isSubmitting={isSaving}
            serverErrors={serverErrors}
            referenceErrors={referenceErrors}
            isReferenceLoading={isLoading}
            referenceData={referenceData}
            draftData={isSubCategoriesPage && mode === 'create' ? subCategoryDraft : null}
            onDraftChange={isSubCategoriesPage ? updateSubCategoryDraft : undefined}
            onSaveDraft={isSubCategoriesPage ? (values) => {
              updateSubCategoryDraft(values, true)
              showToast({
                type: 'success',
                title: 'Draft saved',
                message: 'SubCategory draft saved on this device.',
              })
            } : undefined}
            rows={rows}
            onSubmit={handleSave}
            onCancel={closeForm}
          />
        </FormModal>
      ) : null}

      {isDraftClosePromptOpen ? (
        <FormModal
          title="Save draft before closing?"
          subtitle="You have an unfinished SubCategory. Keep it as a local draft or discard it."
          onClose={() => setIsDraftClosePromptOpen(false)}
          className="form-modal--subCategories"
          dialogClassName="form-modal__dialog--subCategories resource-center__draft-dialog"
          bodyClassName="form-modal__body--subCategories"
        >
          <div className="resource-center__draft-confirm">
            <p>
              Drafts are stored on this device and counted in Pending / Draft until you create
              the SubCategory or discard the draft.
            </p>
            <div className="button-row resource-center__draft-actions">
              <button type="button" className="button button-secondary button-cancel" onClick={handleDiscardDraftAndClose}>
                Discard
              </button>
              <button type="button" className="button button-secondary" onClick={() => setIsDraftClosePromptOpen(false)}>
                Continue Editing
              </button>
              <button type="button" className="button button-primary" onClick={handleSaveDraftAndClose}>
                Save Draft
              </button>
            </div>
          </div>
        </FormModal>
      ) : null}

      {deleteTarget ? (
        <FormModal
          title={`Delete ${config.entityName}`}
          onClose={() => {
            if (!isDeleting) {
              setDeleteTarget(null)
            }
          }}
        >
          <div className="resource-center__delete-dialog">
            <div className="delete-confirmation__copy">
              <p>
                Are you sure you want to delete{' '}
                <strong>{readResourceValue(deleteTarget, config.columns?.[0]?.key, deleteTarget.id)}</strong>?
              </p>
              <p className="delete-confirmation__warning">This action cannot be undone.</p>
            </div>
            <div className="button-row">
              <button className="button button-cancel button-secondary"
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button button-danger"
                onClick={confirmDelete}
                disabled={isDeleting}
              >
                <Trash2 size={16} />
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </FormModal>
      ) : null}
    </div>
  )
}

export default function Invoices() {
  const resourceKey = 'invoices';
  const hubKey = undefined;
  const resourceKeys = undefined;
  const initialResourceKey = undefined;
  const location = useLocation()
  const navigate = useNavigate()

  const keys = useMemo(() => {
    if (Array.isArray(resourceKeys) && resourceKeys.length > 0) {
      return resourceKeys
    }

    if (hubKey && RESOURCE_HUBS[hubKey]) {
      return RESOURCE_HUBS[hubKey]
    }

    return [resourceKey].filter(Boolean)
  }, [hubKey, resourceKey, resourceKeys])
  const configs = useMemo(
    () => keys.map((key) => RESOURCE_CONFIGS[key]).filter(Boolean),
    [keys],
  )
  const preferredKey = useMemo(() => {
    const tabQuery = new URLSearchParams(location.search).get('tab')
    if (tabQuery && configs.some((config) => config.key === tabQuery)) {
      return tabQuery
    }
    return configs.some((config) => config.key === initialResourceKey)
      ? initialResourceKey
      : configs[0]?.key ?? ''
  }, [location.search, configs, initialResourceKey])
  const [activeKey, setActiveKey] = useState(preferredKey)

  useEffect(() => {
    setActiveKey(preferredKey)
  }, [preferredKey])

  const activeConfig = configs.find((config) => config.key === activeKey) ?? configs[0]
  const isStockOperationsHub = hubKey === 'stockOperations'

  if (!activeConfig) {
    return (
      <div className="page resource-center">
        <div className="message-box message-box--error page-error-banner" role="alert">
          This resource is not configured.
        </div>
      </div>
    )
  }

  const tabsContent = configs.length > 1 ? (
    <div className="card resource-center__tabs-card">
      <div className="resource-center__tabs" role="tablist" aria-label="Resource modules">
        {configs.map((config) => {
          const Icon = config.icon
          return (
            <button
              key={config.key}
              type="button"
              className={`resource-center__tab ${activeConfig.key === config.key ? 'is-active' : ''}`}
              onClick={() => {
                setActiveKey(config.key)
                const searchParams = new URLSearchParams(location.search)
                searchParams.set('tab', config.key)
                navigate({ search: searchParams.toString() }, { replace: true })
              }}
              role="tab"
              aria-selected={activeConfig.key === config.key}
            >
              <Icon size={16} />
              <span>{config.title}</span>
            </button>
          )
        })}
      </div>
    </div>
  ) : null

  return (
    <div className={`page resource-center ${isStockOperationsHub ? 'resource-center--stock-operations' : ''}`}>
      {isStockOperationsHub ? null : tabsContent}

      <ResourcePage
        key={activeConfig.key}
        config={activeConfig}
        navigationContent={isStockOperationsHub ? tabsContent : null}
      />
    </div>
  )
}
