import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Activity,
  CalendarDays,
  Check,
  CheckCircle2,
  Database,
  Download,
  Eye,
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
import GoodsReceiptForm from './components/GoodsReceiptForm'
import { groupFlatPurchaseOrders, normalizePurchaseOrder } from '../../../api/businessApi'
import { createWarehouseStockFromGrn, normalizeWarehouse } from '../../../api/warehousesApi'
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
import { RESOURCE_CONFIGS, RESOURCE_HUBS } from './resourceConfigs'
import { calculateGoodsReceiptTotals, getGoodsReceiptNumber, normalizeGoodsReceiptItem } from './goodsReceiptHelpers'
import './GoodsReceipts.css'

const CATALOG_STRUCTURE_UPDATED_EVENT = 'ims:catalog-structure-updated'
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
const ACTION_MENU_RESOURCE_KEYS = new Set(['users', 'roles', 'systemSettings', 'systemsettings', 'systemSetting', 'settings'])
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
const GOODS_RECEIPT_SUBMISSION_LOCKS = new Set()

function getGoodsReceiptSubmissionKey(payload = {}) {
  return String(payload.poId ?? '').trim()
}

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
  if (!item || typeof item !== 'object') return ''

  if (key === 'warehouseId' || key === 'fromWarehouseId' || key === 'toWarehouseId') {
    const val = readResourceValue(item, key, '') || readResourceValue(item, 'id', '') || readResourceValue(item, 'Id', '')
    if (val !== '') return val
  }

  if (key === 'name' || key === 'warehouseName') {
    const val = readResourceValue(item, 'name', '') || readResourceValue(item, 'warehouseName', '') || readResourceValue(item, 'Name', '') || readResourceValue(item, 'WarehouseName', '') || readResourceValue(item, 'warehouse', '')
    if (val !== '') return val
  }

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

function getFirstReferenceValue(item, keys, fallback = '') {
  for (const key of keys) {
    const value = getReferenceValue(item, key, '')

    if (value !== undefined && value !== null && value !== '') {
      return value
    }
  }

  return fallback
}

function getPurchaseOrderById(poId, referenceData) {
  if (!poId) {
    return null
  }

  const rawList = Array.isArray(referenceData)
    ? referenceData
    : (referenceData?.purchaseOrders ?? referenceData?.purchases ?? [])

  if (!Array.isArray(rawList) || rawList.length === 0) return null

  const groupedPOs = groupFlatPurchaseOrders(rawList)
  const targetStr = String(poId).trim().toLowerCase()
  const cleanTarget = targetStr.replace(/^po-?/i, '')

  return groupedPOs.find((item) => {
    const candidateVals = [
      getReferenceValue(item, 'poId'),
      getReferenceValue(item, 'id'),
      getReferenceValue(item, 'PoId'),
      getReferenceValue(item, 'Id'),
      item?.poId, item?.PoId, item?.id, item?.Id,
      item?.poNumber, item?.PoNumber, item?.orderNumber, item?.OrderNumber,
    ]

    return candidateVals.some((v) => {
      if (v === undefined || v === null || v === '') return false
      const str = String(v).trim().toLowerCase()
      const cleanStr = str.replace(/^po-?/i, '')
      return str === targetStr || cleanStr === cleanTarget || (cleanTarget && cleanStr === cleanTarget)
    })
  }) || null
}

function getPurchaseOrderLineItems(purchaseOrder) {
  const items = getFirstReferenceValue(purchaseOrder, [
    'items',
    'Items',
    'purchaseOrderItems',
    'PurchaseOrderItems',
    'orderItems',
    'OrderItems',
    'lineItems',
    'LineItems',
    'lines',
    'Lines',
    'products',
    'Products',
  ], [])

  return Array.isArray(items) ? items : []
}

function getPurchaseOrderQuantity(purchaseOrder, productId, variantId) {
  const lines = getPurchaseOrderLineItems(purchaseOrder)

  if (productId && lines.length > 0) {
    const matchingLine = getPurchaseOrderMatchingLineItem(purchaseOrder, productId, variantId)

    if (matchingLine && lines.includes(matchingLine)) {
      return Number(getFirstReferenceValue(matchingLine, [
        'quantity',
        'Quantity',
        'orderedQty',
        'OrderedQty',
        'orderedQuantity',
        'OrderedQuantity',
        'requiredQty',
        'RequiredQty',
        'qty',
        'Qty',
      ], 0)) || 0
    }
  }

  if (lines.length > 0) {
    return lines.reduce((total, item) =>
      total + (Number(getFirstReferenceValue(item, ['quantity', 'Quantity', 'orderedQty', 'OrderedQty', 'orderedQuantity', 'OrderedQuantity', 'requiredQty', 'RequiredQty', 'qty', 'Qty'], 0)) || 0),
    0)
  }

  return Number(getFirstReferenceValue(purchaseOrder, ['quantity', 'Quantity', 'totalQuantity', 'TotalQuantity', 'orderedQty', 'OrderedQty', 'orderedQuantity', 'OrderedQuantity', 'qty', 'Qty'], 0)) || 0
}

function getPurchaseOrderMatchingLineItem(purchaseOrder, productId, variantId) {
  if (!purchaseOrder) return null

  const items = getPurchaseOrderLineItems(purchaseOrder)
  if (!Array.isArray(items) || items.length === 0) {
    return purchaseOrder
  }

  if (productId) {
    const targetPId = String(productId)
    const targetVId = variantId !== undefined && variantId !== null && variantId !== '' ? String(variantId) : null

    const exactMatch = items.find((line) => {
      const linePId = String(getFirstReferenceValue(line, ['productId', 'product_id', 'ProductId'], ''))
      const lineVId = getFirstReferenceValue(line, ['variantId', 'variant_id', 'VariantId'], null)
      const lineVIdStr = lineVId !== null && lineVId !== undefined && lineVId !== '' ? String(lineVId) : null

      if (linePId !== targetPId) return false
      if (targetVId !== null && lineVIdStr !== null) {
        return lineVIdStr === targetVId
      }
      return true
    })

    if (exactMatch) {
      return exactMatch
    }

    const productMatch = items.find((line) => {
      const linePId = String(getFirstReferenceValue(line, ['productId', 'product_id', 'ProductId'], ''))
      return linePId === targetPId
    })

    if (productMatch) {
      return productMatch
    }
  }

  return items[0] ?? purchaseOrder
}

function getLineItemUnitPrice(targetItem) {
  if (!targetItem || typeof targetItem !== 'object') {
    return null
  }

  const candidateKeys = [
    'unitPrice', 'UnitPrice', 'unit_price',
    'purchasePrice', 'PurchasePrice', 'purchase_price',
    'unitCost', 'UnitCost', 'unit_cost',
    'costPrice', 'CostPrice', 'cost_price',
    'rate', 'Rate',
    'cost', 'Cost',
    'buyingPrice', 'BuyingPrice', 'buying_price',
    'unitPriceAmount', 'UnitPriceAmount',
    'itemPrice', 'ItemPrice', 'item_price',
    'price', 'Price',
  ]

  for (const key of candidateKeys) {
    const val = readResourceValue(targetItem, key, undefined)
    if (val !== undefined && val !== null && val !== '') {
      const num = Number(val)
      if (Number.isFinite(num) && num > 0) {
        return num
      }
    }
  }

  return null
}

function getProductOrVariantUnitPrice(productId, variantId, referenceData = {}) {
  if (variantId && Array.isArray(referenceData.productVariants)) {
    const variant = referenceData.productVariants.find((v) =>
      String(getFirstReferenceValue(v, ['variantId', 'id', 'Id'], '')) === String(variantId)
    )
    if (variant) {
      const vPrice = getLineItemUnitPrice(variant)
      if (vPrice !== null && vPrice > 0) {
        return vPrice
      }
    }
  }

  if (productId && Array.isArray(referenceData.products)) {
    const product = referenceData.products.find((p) =>
      String(getFirstReferenceValue(p, ['productId', 'id', 'Id'], '')) === String(productId)
    )
    if (product) {
      const pPrice = getLineItemUnitPrice(product)
      if (pPrice !== null && pPrice > 0) {
        return pPrice
      }
    }
  }

  return null
}

function getPurchaseOrderUnitPrice(purchaseOrder, productId, variantId, referenceData = {}) {
  if (!purchaseOrder) return null

  // 1. Check matching line item in PO line items
  const matchingLine = getPurchaseOrderMatchingLineItem(purchaseOrder, productId, variantId)
  if (matchingLine) {
    const linePrice = getLineItemUnitPrice(matchingLine)
    if (linePrice !== null && linePrice > 0) {
      return linePrice
    }
  }

  // 2. Check any line item in PO
  const lines = getPurchaseOrderLineItems(purchaseOrder)
  for (const line of lines) {
    const price = getLineItemUnitPrice(line)
    if (price !== null && price > 0) {
      return price
    }
  }

  // 3. Check explicit raw root PO price
  const candidateKeys = [
    'unitPrice', 'UnitPrice', 'unit_price',
    'purchasePrice', 'PurchasePrice', 'purchase_price',
    'price', 'Price',
    'rate', 'Rate',
    'costPrice', 'CostPrice', 'cost_price',
    'unitCost', 'UnitCost', 'unit_cost',
    'cost', 'Cost',
  ]
  for (const key of candidateKeys) {
    const val = Number(readResourceValue(purchaseOrder, key, undefined))
    if (Number.isFinite(val) && val > 0) {
      return val
    }
  }

  // 4. Calculated fallback: totalAmount / totalQuantity
  const totalAmount = Number(getFirstReferenceValue(purchaseOrder, ['totalAmount', 'TotalAmount', 'total_amount', 'grandTotal', 'GrandTotal', 'amount', 'Amount', 'total', 'Total'], 0))
  const quantity = getPurchaseOrderQuantity(purchaseOrder, productId, variantId)

  if (Number.isFinite(totalAmount) && totalAmount > 0 && quantity > 0) {
    return totalAmount / quantity
  }

  // 5. Check master product or variant in referenceData ONLY as last fallback
  const masterPrice = getProductOrVariantUnitPrice(productId, variantId, referenceData)
  if (masterPrice !== null && masterPrice > 0) {
    return masterPrice
  }

  return null
}
function getPurchaseOrderPrimaryLine(purchaseOrder) {
  return getPurchaseOrderLineItems(purchaseOrder)[0] ?? purchaseOrder ?? {}
}

function getPurchaseOrderStatusKind(purchaseOrder) {
  const status = String(getReferenceValue(purchaseOrder, 'status', '') || '').toLowerCase()

  if (/cancel|delete|void|reject/.test(status)) {
    return 'blocked'
  }

  if (/received|complete|closed/.test(status)) {
    return 'closed'
  }

  return 'open'
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

function getGoodsReceiptRemainingQuantity(
  poId,
  referenceData,
  receiptRows = [],
  productId = '',
  variantId = '',
) {
  if (!poId) {
    return null
  }

  const purchaseOrder = getPurchaseOrderById(poId, referenceData)
  const orderedQuantity = getPurchaseOrderQuantity(purchaseOrder, productId, variantId)

  if (!Number.isFinite(orderedQuantity)) {
    return null
  }

  const receivedQuantity = receiptRows
    .filter((item) => {
      if (String(getReferenceValue(item, 'poId')) !== String(poId)) {
        return false
      }

      if (!productId) {
        return true
      }

      const itemProductId = getFirstReferenceValue(item, ['productId', 'ProductId'], '')
      const itemVariantId = getFirstReferenceValue(item, ['variantId', 'VariantId'], '')
      const productMatches = String(itemProductId) === String(productId)
      const variantMatches = !variantId || !itemVariantId || String(itemVariantId) === String(variantId)

      return productMatches && variantMatches
    })
    .reduce(
      (total, item) => total + (Number(getReferenceValue(item, 'quantityReceived')) || 0),
      0,
    )

  return Math.max(orderedQuantity - receivedQuantity, 0)
}

function getGoodsReceiptId(value) {
  const data = value?.success === undefined ? value : getResponseData(value)
  const record = data?.goodsReceipt ?? data?.GoodsReceipt ?? data?.receipt ?? data?.Receipt ?? data

  if (typeof record === 'number' || typeof record === 'string') {
    return String(record).trim()
  }

  return String(getFirstReferenceValue(record, [
    'grnId',
    'GrnId',
    'grId',
    'GrId',
    'goodsReceiptId',
    'GoodsReceiptId',
    'receiptId',
    'ReceiptId',
    'id',
    'Id',
  ], '')).trim()
}

function getGoodsReceiptPurchaseOrderKey(record = {}) {
  const poId = getFirstReferenceValue(record, [
    'poId',
    'PoId',
    'purchaseOrderId',
    'PurchaseOrderId',
  ], '')

  if (String(poId ?? '').trim()) {
    return `id:${String(poId).trim().toLowerCase()}`
  }

  const poNumber = getFirstReferenceValue(record, [
    'poNumber',
    'PoNumber',
    'purchaseOrderNumber',
    'PurchaseOrderNumber',
    'orderNumber',
    'OrderNumber',
  ], '')

  return String(poNumber ?? '').trim()
    ? `number:${String(poNumber).trim().toLowerCase()}`
    : ''
}

function goodsReceiptBelongsToPurchaseOrder(record, poId) {
  const targetPoId = String(poId ?? '').trim().toLowerCase()

  if (!targetPoId) {
    return false
  }

  return [
    getFirstReferenceValue(record, ['poId', 'PoId', 'purchaseOrderId', 'PurchaseOrderId'], ''),
    getFirstReferenceValue(record, [
      'poNumber',
      'PoNumber',
      'purchaseOrderNumber',
      'PurchaseOrderNumber',
      'orderNumber',
      'OrderNumber',
    ], ''),
  ].some((value) => String(value ?? '').trim().toLowerCase() === targetPoId)
}

function getGoodsReceiptSortValue(record = {}) {
  const timestamp = Date.parse(getFirstReferenceValue(record, [
    'updatedAt',
    'UpdatedAt',
    'createdAt',
    'CreatedAt',
    'receiptDate',
    'ReceiptDate',
  ], ''))
  const idNumber = Number(String(getGoodsReceiptId(record)).match(/\d+(?!.*\d)/)?.[0])

  return {
    timestamp: Number.isFinite(timestamp) ? timestamp : 0,
    idNumber: Number.isFinite(idNumber) ? idNumber : 0,
  }
}

function getLatestGoodsReceiptPerPurchaseOrder(receiptRows = []) {
  if (!Array.isArray(receiptRows)) return []
  const receiptsByGrnKey = new Map()

  receiptRows.forEach((record, index) => {
    if (!record || typeof record !== 'object') return
    const grnId = getGoodsReceiptId(record)
    const grnNum = getGoodsReceiptNumber(record)
    const key = grnId ? `id:${grnId}` : (grnNum ? `num:${grnNum}` : `idx:${index}`)

    const recordItems = Array.isArray(record.items) && record.items.length > 0
      ? record.items
      : (Array.isArray(record.lineItems) && record.lineItems.length > 0
        ? record.lineItems
        : (Array.isArray(record.goodsReceiptItems) && record.goodsReceiptItems.length > 0 ? record.goodsReceiptItems : [record]))

    if (!receiptsByGrnKey.has(key)) {
      const uniqueInitialItems = []
      const seenInitial = new Set()
      recordItems.forEach((item, itemIdx) => {
        if (!item || typeof item !== 'object') return
        const pKey = item.productId || item.product_id || item.ProductId || item.id || item.purchaseOrderItemId || item.productName || item.name || ''
        const vKey = item.variantId || item.variant_id || item.VariantId || item.variantName || ''
        const itemKey = pKey ? `${pKey}-${vKey}` : `item-${itemIdx}`
        if (!seenInitial.has(itemKey)) {
          seenInitial.add(itemKey)
          uniqueInitialItems.push(item)
        }
      })

      const totalInitialQuantity = uniqueInitialItems.reduce((sum, item) => {
        const qVal = item.quantityReceived !== undefined ? item.quantityReceived : (item.receivedQuantity !== undefined ? item.receivedQuantity : item.quantity)
        const q = qVal !== undefined ? Number(qVal) : Number(item.orderedQuantity || 0)
        return sum + (Number.isFinite(q) ? q : 0)
      }, 0)

      const totalInitialVal = uniqueInitialItems.reduce((sum, item) => {
        const qVal = item.quantityReceived !== undefined ? item.quantityReceived : (item.receivedQuantity !== undefined ? item.receivedQuantity : item.quantity)
        const q = qVal !== undefined ? Number(qVal) : Number(item.orderedQuantity || 0)
        const p = Number(item.price || item.unitPrice || 0)
        const lineTot = Number(item.lineTotal || 0) || (q * p)
        return sum + (Number.isFinite(lineTot) ? lineTot : 0)
      }, 0)

      const initialProductName = `${uniqueInitialItems.length || 1} Item${(uniqueInitialItems.length || 1) === 1 ? '' : 's'}`

      receiptsByGrnKey.set(key, {
        ...record,
        items: uniqueInitialItems,
        lineItems: uniqueInitialItems,
        productName: initialProductName,
        quantityReceived: totalInitialQuantity > 0 ? totalInitialQuantity : record.quantityReceived,
        totalAmount: totalInitialVal > 0 ? totalInitialVal : record.totalAmount,
        subtotal: totalInitialVal > 0 ? totalInitialVal : record.subtotal,
      })
      return
    }

    const existingRecord = receiptsByGrnKey.get(key)
    const existingItems = Array.isArray(existingRecord.items) ? existingRecord.items : [existingRecord]
    const mergedItems = [...existingItems]

    recordItems.forEach((item, itemIdx) => {
      if (!item || typeof item !== 'object') return
      const pKey = item.productId || item.product_id || item.ProductId || item.id || item.purchaseOrderItemId || item.productName || item.name || ''
      const vKey = item.variantId || item.variant_id || item.VariantId || item.variantName || ''
      const itemKey = pKey ? `${pKey}-${vKey}` : `item-${itemIdx}`
      if (!mergedItems.some(existing => `${existing.productId || existing.product_id || existing.ProductId || existing.id || existing.productName || ''}-${existing.variantId || existing.variant_id || existing.VariantId || ''}` === itemKey)) {
        mergedItems.push(item)
      }
    })

    const existingSortValue = getGoodsReceiptSortValue(existingRecord)
    const nextSortValue = getGoodsReceiptSortValue(record)
    const isNewer = nextSortValue.timestamp > existingSortValue.timestamp ||
      (nextSortValue.timestamp === existingSortValue.timestamp && nextSortValue.idNumber > existingSortValue.idNumber)

    const baseRecord = isNewer ? record : existingRecord

    const totalQuantity = mergedItems.reduce((sum, item) => {
      const qVal = item.quantityReceived !== undefined ? item.quantityReceived : (item.receivedQuantity !== undefined ? item.receivedQuantity : item.quantity)
      const q = qVal !== undefined ? Number(qVal) : Number(item.orderedQuantity || 0)
      return sum + (Number.isFinite(q) ? q : 0)
    }, 0)

    const totalVal = mergedItems.reduce((sum, item) => {
      const qVal = item.quantityReceived !== undefined ? item.quantityReceived : (item.receivedQuantity !== undefined ? item.receivedQuantity : item.quantity)
      const q = qVal !== undefined ? Number(qVal) : Number(item.orderedQuantity || 0)
      const p = Number(item.price || item.unitPrice || 0)
      const lineTot = Number(item.lineTotal || 0) || (q * p)
      return sum + (Number.isFinite(lineTot) ? lineTot : 0)
    }, 0)

    const productName = `${mergedItems.length || 1} Item${(mergedItems.length || 1) === 1 ? '' : 's'}`

    receiptsByGrnKey.set(key, {
      ...baseRecord,
      items: mergedItems,
      lineItems: mergedItems,
      productName,
      quantityReceived: totalQuantity > 0 ? totalQuantity : baseRecord.quantityReceived,
      totalAmount: totalVal > 0 ? totalVal : baseRecord.totalAmount,
      subtotal: totalVal > 0 ? totalVal : baseRecord.subtotal,
    })
  })

  return Array.from(receiptsByGrnKey.values())
}

function reconcileGoodsReceiptWithPurchaseOrder(record, purchaseOrders = [], referenceData = {}) {
  if (!record || typeof record !== 'object') return record || {}

  const poIdentifier = getFirstReferenceValue(record, [
    'poId',
    'PoId',
    'purchaseOrderId',
    'PurchaseOrderId',
    'poNumber',
    'PoNumber',
    'purchaseOrderNumber',
    'PurchaseOrderNumber',
  ], '')

  const purchaseOrder = getPurchaseOrderById(poIdentifier, { purchaseOrders: purchaseOrders || [] })
  const poItems = purchaseOrder ? getPurchaseOrderLineItems(purchaseOrder) : []

  const rawRecordItems = record.items || record.lineItems || record.products || record.goodsReceiptItems || record.orderItems || []

  let itemsToUse = (Array.isArray(rawRecordItems) && rawRecordItems.length > 0)
    ? rawRecordItems
    : ((Array.isArray(poItems) && poItems.length > 0) ? poItems : [])

  itemsToUse = itemsToUse.map((item) => {
    const itemProdId = String(item.productId || item.product_id || item.ProductId || '')
    const itemProdName = String(item.productName || item.product_name || item.name || '').trim().toLowerCase()

    const matchedPoItem = poItems.find((poIt) => {
      const pId = String(poIt.productId || poIt.product_id || poIt.ProductId || poIt.id || '')
      if (itemProdId && pId && itemProdId === pId) return true
      const pName = String(poIt.productName || poIt.product_name || poIt.name || '').trim().toLowerCase()
      if (itemProdName && pName && (itemProdName === pName || itemProdName.includes(pName) || pName.includes(itemProdName))) return true
      return false
    })

    const matchedCatalogProd = (referenceData.products || []).find((p) => String(p.id || p.productId) === itemProdId)

    const explicitPrice = Number(item.unitPrice ?? item.price ?? item.cost ?? 0)
    const poPrice = Number(matchedPoItem?.unitPrice ?? matchedPoItem?.price ?? matchedPoItem?.unitCost ?? 0)
    const catalogPrice = Number(matchedCatalogProd?.unitPrice ?? matchedCatalogProd?.price ?? matchedCatalogProd?.costPrice ?? 0)

    const finalUnitPrice = explicitPrice > 0 ? explicitPrice : (poPrice > 0 ? poPrice : catalogPrice)

    const explicitOrderedQty = Number(item.orderedQuantity ?? item.orderedQty ?? item.orderQuantity ?? item.requiredQty ?? 0)
    const poOrderedQty = Number(matchedPoItem?.quantityOrdered ?? matchedPoItem?.quantity ?? matchedPoItem?.orderedQuantity ?? 0)
    const finalOrderedQty = explicitOrderedQty > 0 ? explicitOrderedQty : (poOrderedQty > 0 ? poOrderedQty : Number(item.receivedQuantity ?? item.quantityReceived ?? item.quantity ?? 1))

    const explicitReceivedQty = item.receivedQuantity !== undefined ? item.receivedQuantity : (item.quantityReceived !== undefined ? item.quantityReceived : item.quantity)
    const finalReceivedQty = explicitReceivedQty !== undefined ? Number(explicitReceivedQty) : finalOrderedQty

    const productName = item.productName || item.product_name || matchedPoItem?.productName || matchedCatalogProd?.name || (itemProdId ? `Product #${itemProdId}` : 'Product')

    return {
      ...item,
      productId: itemProdId || matchedPoItem?.productId,
      productName,
      orderedQuantity: finalOrderedQty,
      receivedQuantity: finalReceivedQty,
      quantityReceived: finalReceivedQty,
      unitPrice: finalUnitPrice,
      price: finalUnitPrice,
      lineTotal: Number(item.lineTotal || 0) || (finalReceivedQty * finalUnitPrice),
    }
  })

  const primaryLine = getPurchaseOrderPrimaryLine(purchaseOrder)
  const productId = getFirstReferenceValue(primaryLine, ['productId', 'product_id', 'ProductId'], '') || getFirstReferenceValue(record, ['productId', 'ProductId'], '')
  const poNumber = getFirstReferenceValue(purchaseOrder, ['poNumber', 'PoNumber', 'number', 'Number'], '') || poIdentifier

  const totalQuantity = itemsToUse.reduce((sum, it) => sum + Number(it.receivedQuantity || 0), 0)
  const totalAmount = itemsToUse.reduce((sum, it) => sum + (Number(it.lineTotal) || (Number(it.receivedQuantity || 0) * Number(it.unitPrice || 0))), 0)

  const itemCount = itemsToUse.length || 1
  const displayName = `${itemCount} Item${itemCount === 1 ? '' : 's'}`

  return {
    ...record,
    poNumber: poNumber || record.poNumber,
    productId: productId || record.productId,
    productName: displayName,
    supplierName: purchaseOrder?.supplierName || purchaseOrder?.supplier || record.supplierName,
    supplierId: purchaseOrder?.supplierId || record.supplierId,
    warehouseName: purchaseOrder?.warehouseName || purchaseOrder?.warehouse || record.warehouseName,
    warehouseId: purchaseOrder?.warehouseId || record.warehouseId,
    items: itemsToUse,
    lineItems: itemsToUse,
    quantityReceived: totalQuantity > 0 ? totalQuantity : record.quantityReceived,
    price: itemsToUse[0]?.unitPrice || record.price,
    subtotal: totalAmount > 0 ? totalAmount : record.subtotal,
    totalAmount: totalAmount > 0 ? totalAmount : record.totalAmount,
  }
}

function getGoodsReceiptDetailItems(record = {}) {
  const purchaseOrder = getFirstReferenceValue(record, [
    'poNumber',
    'PoNumber',
    'purchaseOrderNumber',
    'PurchaseOrderNumber',
    'orderNumber',
    'OrderNumber',
  ]) || getFirstReferenceValue(record, ['poId', 'PoId'])
  const supplier = getFirstReferenceValue(record, [
    'supplierName',
    'SupplierName',
    'supplier',
    'Supplier',
  ]) || getFirstReferenceValue(record, ['supplierId', 'SupplierId'])
  const warehouse = getFirstReferenceValue(record, [
    'warehouseName',
    'WarehouseName',
    'warehouse',
    'Warehouse',
  ]) || getFirstReferenceValue(record, ['warehouseId', 'WarehouseId'])

  const receiptDate = getFirstReferenceValue(record, ['receiptDate', 'ReceiptDate', 'createdAt', 'CreatedAt'])
  const supplierInvoiceNo = getFirstReferenceValue(record, [
    'supplierInvoiceNo',
    'SupplierInvoiceNo',
    'supplierInvoiceNumber',
    'SupplierInvoiceNumber',
    'invoiceNumber',
    'InvoiceNumber',
    'invoiceNo',
    'InvoiceNo',
    'invoice',
    'Invoice',
    'supplierInvoice',
    'SupplierInvoice',
    'suppInvNo',
    'SuppInvNo',
    'vendorInvoiceNo',
    'VendorInvoiceNo',
    'billNo',
    'BillNo',
    'referenceNo',
    'ReferenceNo',
  ])
  const supplierInvoiceDate = getFirstReferenceValue(record, [
    'supplierInvoiceDate',
    'SupplierInvoiceDate',
    'invoiceDate',
    'InvoiceDate',
    'suppInvDate',
    'SuppInvDate',
    'vendorInvoiceDate',
    'VendorInvoiceDate',
    'billDate',
    'BillDate',
  ])
  const createdBy = getFirstReferenceValue(record, ['createdBy', 'CreatedBy', 'createdByName', 'CreatedByName', 'user', 'User'])

  return [
    { key: 'receiptId', label: 'GRN Number', value: getGoodsReceiptNumber(record), icon: Hash },
    { key: 'purchaseOrder', label: 'Purchase Order', value: purchaseOrder, icon: ReceiptText },
    { key: 'supplier', label: 'Supplier', value: supplier, icon: UserRound },
    { key: 'warehouse', label: 'Warehouse', value: warehouse, icon: Database },
    {
      key: 'receiptDate',
      label: 'Receipt Date',
      value: receiptDate ? formatDate(receiptDate) : '',
      icon: CalendarDays,
    },
    {
      key: 'supplierInvoiceNo',
      label: 'Supplier Invoice No',
      value: String(supplierInvoiceNo ?? '').trim() || 'N/A',
      icon: FileSpreadsheet,
    },
    {
      key: 'supplierInvoiceDate',
      label: 'Supplier Invoice Date',
      value: supplierInvoiceDate ? formatDate(supplierInvoiceDate) : 'N/A',
      icon: CalendarDays,
    },
    {
      key: 'createdBy',
      label: 'Created By',
      value: createdBy,
      optional: true,
      icon: UserRound,
    },
    {
      key: 'status',
      label: 'Status',
      value: getFirstReferenceValue(record, ['status', 'Status']),
      optional: true,
      icon: CheckCircle2,
    },
    {
      key: 'notes',
      label: 'Notes',
      value: getFirstReferenceValue(record, ['notes', 'Notes']),
      optional: true,
      fullWidth: true,
      icon: FileText,
    },
  ].filter((item) => !item.optional || String(item.value ?? '').trim() !== '')
}

function goodsReceiptMatchesSubmissionLine(receipt, payload) {
  const numberMatches = (keys, expected) => {
    const actual = Number(getFirstReferenceValue(receipt, keys, Number.NaN))
    return Number.isFinite(actual) && actual === Number(expected)
  }
  const receiptVariantId = getFirstReferenceValue(receipt, ['variantId', 'VariantId'], null)
  const payloadVariantId = payload.variantId ?? null
  const variantMatches = payloadVariantId === null || payloadVariantId === ''
    ? receiptVariantId === null || receiptVariantId === '' || Number(receiptVariantId) === 0
    : Number(receiptVariantId) === Number(payloadVariantId)

  return numberMatches(['poId', 'PoId'], payload.poId) &&
    numberMatches(['warehouseId', 'WarehouseId'], payload.warehouseId) &&
    numberMatches(['productId', 'ProductId'], payload.productId) &&
    variantMatches
}

function goodsReceiptMatchesPayload(receipt, payload) {
  const actualQuantity = Number(
    getFirstReferenceValue(receipt, ['quantityReceived', 'QuantityReceived'], Number.NaN),
  )

  return goodsReceiptMatchesSubmissionLine(receipt, payload) &&
    Number.isFinite(actualQuantity) &&
    actualQuantity === Number(payload.quantityReceived)
}

async function getGoodsReceiptsByPurchaseOrder(poId) {
  const response = await apiRequest(API_ENDPOINTS.goodsReceipts.byPo(poId))

  return {
    ...response,
    rows: response.success ? getResponseList(response, 'goodsReceipts') : [],
  }
}

async function getLivePurchaseOrder(poId) {
  const response = await apiRequest(API_ENDPOINTS.purchaseOrders.list, {
    cache: 'no-store',
    query: { page: 1, pageSize: 500 },
  })

  if (!response.success) {
    return { ...response, purchaseOrder: null }
  }

  const purchaseOrders = getResponseList(response, 'purchaseOrders').map(normalizePurchaseOrder)
  const purchaseOrder = getPurchaseOrderById(poId, { purchaseOrders })

  if (!purchaseOrder) {
    return {
      success: false,
      status: 404,
      purchaseOrder: null,
      error: 'The selected Purchase Order is no longer available in the backend.',
    }
  }

  return { ...response, purchaseOrder }
}

async function findCreatedGoodsReceipts(poId, payload, knownReceiptIds) {
  const response = await getGoodsReceiptsByPurchaseOrder(poId)

  if (!response.success) {
    return { response, matches: [], exactMatches: [] }
  }

  const matches = response.rows.filter((receipt) => {
    const receiptId = getGoodsReceiptId(receipt)
    return receiptId &&
      !knownReceiptIds.has(receiptId) &&
      goodsReceiptMatchesSubmissionLine(receipt, payload)
  })
  const exactMatches = matches.filter((receipt) => goodsReceiptMatchesPayload(receipt, payload))

  return { response, matches, exactMatches }
}

function getDynamicMax(field, context = {}) {
  if (field.maxFrom === 'goodsReceiptRemainingQuantity') {
    return getGoodsReceiptRemainingQuantity(
      context.formData?.poId,
      context.referenceData,
      context.rows,
      context.formData?.productId,
      context.formData?.variantId,
    )
  }

  return null
}

function getGoodsReceiptPurchaseOrderError(value, context = {}) {
  if (!value) {
    return ''
  }

  const purchaseOrder = getPurchaseOrderById(value, context.referenceData ?? {})

  if (!purchaseOrder) {
    return 'Select a valid Purchase Order from the live list.'
  }

  const statusKind = getPurchaseOrderStatusKind(purchaseOrder)

  if (statusKind === 'blocked') {
    return 'Cancelled or deleted Purchase Orders cannot be received.'
  }

  if ((context.rows ?? []).some((receipt) => goodsReceiptBelongsToPurchaseOrder(receipt, value))) {
    return 'A Goods Receipt already exists for this Purchase Order. Only one receipt is allowed per Purchase Order.'
  }

  const remainingQuantity = getGoodsReceiptRemainingQuantity(
    value,
    context.referenceData ?? {},
    context.rows ?? [],
    context.formData?.productId,
    context.formData?.variantId,
  )

  if (remainingQuantity !== null && remainingQuantity <= 0) {
    return 'This Purchase Order has no remaining quantity to receive.'
  }

  const poUnitPrice = getPurchaseOrderUnitPrice(
    purchaseOrder,
    context.formData?.productId,
    context.formData?.variantId,
    context.referenceData ?? {},
  )

  const currentPrice = Number(context.formData?.price)
  const hasValidPrice = (Number.isFinite(poUnitPrice) && poUnitPrice > 0) || (Number.isFinite(currentPrice) && currentPrice > 0)

  if (!hasValidPrice) {
    return 'Selected Purchase Order line item does not contain a valid unit price.'
  }

  return ''
}

function getFieldError(field, value, mode, context = {}) {
  const isRequired = field.required || (mode === 'create' && field.requiredOnCreate)
  const label = getFieldLabel(field)

  if (context.config?.key === 'goodsReceipts' && field.name === 'price' && context.formData?.poId) {
    const purchaseOrder = getPurchaseOrderById(context.formData.poId, context.referenceData ?? {})
    const poUnitPrice = getPurchaseOrderUnitPrice(
      purchaseOrder,
      context.formData?.productId,
      context.formData?.variantId,
      context.referenceData ?? {},
    )

    const currentPrice = Number(value ?? context.formData?.price)
    const hasValidPrice = (Number.isFinite(poUnitPrice) && poUnitPrice > 0) || (Number.isFinite(currentPrice) && currentPrice > 0)

    if (!hasValidPrice) {
      return 'Selected Purchase Order line item does not contain a unit price.'
    }
  }

  if (isRequired && isEmptyValue(value, field)) {
    return `${label} is required.`
  }

  if (isEmptyValue(value, field)) {
    return ''
  }

  if (context.config?.key === 'goodsReceipts' && field.name === 'poId') {
    const purchaseOrderError = getGoodsReceiptPurchaseOrderError(value, context)

    if (purchaseOrderError) {
      return purchaseOrderError
    }
  }

  if (context.config?.key === 'goodsReceipts' && field.name === 'quantityReceived' && context.formData?.poId) {
    const purchaseOrder = getPurchaseOrderById(context.formData.poId, context.referenceData ?? {})
    const orderedQuantity = getPurchaseOrderQuantity(
      purchaseOrder,
      context.formData?.productId,
      context.formData?.variantId,
    )

    if (orderedQuantity > 0 && Number(value) !== orderedQuantity) {
      return `Quantity Received must match the Purchase Order quantity of ${orderedQuantity}.`
    }
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

    if (field.type === 'date') {
      if (isEmptyValue(value, field)) {
        return payload
      }
      const parsedDate = new Date(value)
      payload[key] = !Number.isNaN(parsedDate.getTime()) ? parsedDate.toISOString() : value
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

function getGoodsReceiptItemCountDisplay(row) {
  if (!row || typeof row !== 'object') return '0 Items'
  const items = Array.isArray(row.items) && row.items.length > 0
    ? row.items
    : (Array.isArray(row.lineItems) && row.lineItems.length > 0
      ? row.lineItems
      : (Array.isArray(row.goodsReceiptItems) && row.goodsReceiptItems.length > 0
        ? row.goodsReceiptItems
        : (Array.isArray(row.products) && row.products.length > 0 ? row.products : [])))

  let count = items.length
  if (count === 0) {
    const rawName = String(row.productName || row.product || '')
    const match = rawName.match(/^(\d+)\s*(?:Item|Items|Product|Products)/i)
    if (match) {
      count = parseInt(match[1], 10)
    } else {
      count = Number(row.itemCount || row.itemsCount || row.totalItems || row.productCount || 0)
      if (count === 0 && (row.productId || row.productName || row.product || row.poId || row.poNumber)) {
        count = 1
      }
    }
  }
  return count === 1 ? '1 Item' : `${count} Items`
}

function formatCellValue(row, column, referenceData) {
  if (typeof column.render === 'function') {
    return column.render(row, referenceData)
  }

  if (column.key === 'productName' && (column.label === 'Items' || column.label === 'Product Name')) {
    return getGoodsReceiptItemCountDisplay(row)
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
  if (column.key === 'productName' && (column.label === 'Items' || column.label === 'Product Name')) {
    return getGoodsReceiptItemCountDisplay(row)
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

function handlePrintGoodsReceipt(row, referenceData = {}, viewingPoItems = []) {
  if (!row) return

  const detailItems = getGoodsReceiptDetailItems(row)
  const status = detailItems.find((item) => item.key === 'status')?.value || 'Recorded'
  const grnNumber = detailItems.find((item) => item.key === 'receiptId')?.value || getGoodsReceiptNumber(row) || 'N/A'
  const purchaseOrder = detailItems.find((item) => item.key === 'purchaseOrder')?.value || 'Purchase Order'
  const bodyItems = detailItems.filter((item) =>
    !['receiptId', 'purchaseOrder', 'status'].includes(item.key),
  )

  let itemsRaw = row.items || row.lineItems || row.products || row.goodsReceiptItems || row.orderItems || []

  const poIdentifier = getFirstReferenceValue(row, ['poId', 'PoId', 'purchaseOrderId', 'PurchaseOrderId', 'poNumber', 'PoNumber'], '')
  let poItems = []
  if (poIdentifier) {
    const matchedPo = getPurchaseOrderById(poIdentifier, referenceData)
    if (matchedPo) {
      poItems = getPurchaseOrderLineItems(matchedPo)
    } else if (Array.isArray(viewingPoItems) && viewingPoItems.length > 0) {
      poItems = viewingPoItems
    }
  }

  const baseList = (Array.isArray(poItems) && poItems.length > 0)
    ? poItems
    : (Array.isArray(itemsRaw) && itemsRaw.length > 0 ? itemsRaw : [row])

  const calculatedItems = baseList.map((poIt, idx) => {
    const pId = String(poIt.productId || poIt.product_id || poIt.id || '')
    const pName = String(poIt.productName || poIt.product || poIt.name || '').toLowerCase().trim()

    const matchedRxItem = itemsRaw.find((rxIt) => {
      const rxPId = String(rxIt.productId || rxIt.product_id || rxIt.id || '')
      if (pId && rxPId && pId === rxPId) return true
      const rxPName = String(rxIt.productName || rxIt.product || rxIt.name || '').toLowerCase().trim()
      if (pName && rxPName && (pName === rxPName || pName.includes(rxPName) || rxPName.includes(pName))) return true
      return false
    })

    const matchedCatalogProduct = referenceData.products?.find(prod => String(prod.id || prod.productId) === pId)

    const priceFromRx = matchedRxItem ? Number(matchedRxItem.unitPrice ?? matchedRxItem.price ?? matchedRxItem.cost ?? 0) : 0
    const priceFromPo = Number(poIt.unitPrice ?? poIt.price ?? poIt.unitCost ?? poIt.cost ?? 0)
    const priceFromCatalog = matchedCatalogProduct ? Number(matchedCatalogProduct.purchasePrice ?? matchedCatalogProduct.unitPrice ?? matchedCatalogProduct.price ?? matchedCatalogProduct.cost ?? 0) : 0

    const unitPrice = priceFromRx > 0 ? priceFromRx : (priceFromPo > 0 ? priceFromPo : priceFromCatalog)

    const orderedQty = Number(
      poIt.quantityOrdered ??
      poIt.orderedQuantity ??
      poIt.orderedQty ??
      poIt.quantity ??
      matchedRxItem?.orderedQuantity ??
      1
    )

    const receivedQty = Number(
      matchedRxItem?.receivedQuantity ??
      matchedRxItem?.quantityReceived ??
      matchedRxItem?.acceptedQuantity ??
      matchedRxItem?.quantity ??
      orderedQty
    )

    const discountPct = Number(matchedRxItem?.discountPercentage ?? matchedRxItem?.discount ?? poIt.discountPercentage ?? poIt.discount ?? 0)
    const taxPct = Number(matchedRxItem?.taxPercentage ?? matchedRxItem?.taxRate ?? matchedRxItem?.tax ?? poIt.taxPercentage ?? poIt.taxRate ?? poIt.tax ?? 0)

    const gross = receivedQty * unitPrice
    const discAmt = Number(matchedRxItem?.discountAmount ?? ((gross * discountPct) / 100))
    const taxableAmount = Math.max(0, gross - discAmt)
    const taxAmount = Number(matchedRxItem?.taxAmount ?? matchedRxItem?.gstAmount ?? ((taxableAmount * taxPct) / 100))
    const rawLineTotal = Number(matchedRxItem?.lineTotal ?? matchedRxItem?.totalAmount ?? 0)
    const lineTotal = matchedRxItem?.lineTotal && Number(matchedRxItem.lineTotal) > 0
      ? Number(matchedRxItem.lineTotal)
      : (rawLineTotal > 0 ? rawLineTotal : (taxableAmount + taxAmount))

    const productName = poIt.productName || poIt.product || poIt.name || matchedRxItem?.productName || (pId ? `Product #${pId}` : `Product #${idx + 1}`)
    const variantName = poIt.variantName || poIt.variant || matchedRxItem?.variantName || '-'
    const unitName = poIt.unitName || poIt.unit || matchedRxItem?.unitName || '-'

    return {
      idx: idx + 1,
      productName,
      variantName,
      unitName,
      orderedQuantity: orderedQty,
      receivedQuantity: receivedQty,
      unitPrice,
      discountPercentage: discountPct,
      taxPercentage: taxPct,
      taxableAmount,
      discountAmount: discAmt,
      taxAmount,
      lineTotal,
    }
  })

  const totals = calculateGoodsReceiptTotals(calculatedItems)

  const printWindow = window.open('', '_blank')
  if (!printWindow) return

  const detailsGridHtml = bodyItems
    .filter((item) => item.value !== undefined && item.value !== null && String(item.value).trim() !== '')
    .map((item) => `
      <div class="goods-receipt-details__item">
        <div class="goods-receipt-details__item-icon">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 7h10"/><path d="M7 12h10"/><path d="M7 17h10"/>
          </svg>
        </div>
        <div>
          <span class="goods-receipt-details__item-label">${escapeHtml(item.label)}</span>
          <strong>${escapeHtml(String(item.value))}</strong>
        </div>
      </div>
    `).join('')

  printWindow.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Goods Receipt Details - ${escapeHtml(grnNumber)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      color: #0f172a;
      background: #ffffff;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .print-container {
      max-width: 900px;
      margin: 0 auto;
      background: #ffffff;
    }
    .goods-receipt-details__hero {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 15px;
      padding: 22px 24px;
      background: linear-gradient(135deg, #4a29c9 0%, #5a49d6 58%, #4a3bb8 100%) !important;
      color: #ffffff;
      border-radius: 12px 12px 0 0;
    }
    .goods-receipt-details__hero-copy {
      flex: 1;
    }
    .goods-receipt-details__hero-copy span {
      display: block;
      margin-bottom: 3px;
      color: #cdc9ff;
      font-size: 11px;
      font-weight: 750;
      letter-spacing: 0.09em;
      text-transform: uppercase;
    }
    .goods-receipt-details__hero-copy h3 {
      margin: 0;
      color: #ffffff;
      font-size: 20px;
      font-weight: 780;
      letter-spacing: -0.02em;
    }
    .goods-receipt-details__hero-copy p {
      margin: 4px 0 0;
      color: rgba(239, 236, 253, 0.88);
      font-size: 12.5px;
    }
    .hero-badge {
      display: inline-block;
      padding: 5px 12px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 600;
      background: rgba(255, 255, 255, 0.2) !important;
      border: 1px solid rgba(255, 255, 255, 0.35);
      color: #ffffff;
      backdrop-filter: blur(4px);
    }
    .goods-receipt-details__section {
      padding: 22px 24px;
    }
    .goods-receipt-details__section-heading span {
      display: block;
      margin-bottom: 2px;
      color: #6c5ce7;
      font-size: 11px;
      font-weight: 760;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .goods-receipt-details__section-heading h4 {
      margin: 0;
      color: #0f172a;
      font-size: 16px;
      font-weight: 700;
      letter-spacing: -0.01em;
    }
    .goods-receipt-details__grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
      margin-top: 14px;
    }
    .goods-receipt-details__item {
      display: flex;
      align-items: flex-start;
      gap: 11px;
      padding: 13px 14px;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      background: #ffffff !important;
    }
    .goods-receipt-details__item-icon {
      display: grid;
      place-items: center;
      flex: 0 0 34px;
      width: 34px;
      height: 34px;
      border: 1px solid #c7bbf7;
      border-radius: 9999px;
      background: #f1f0ff !important;
      color: #5a49d6;
    }
    .goods-receipt-details__item-label {
      display: block;
      color: #64748b;
      font-size: 11.5px;
      font-weight: 680;
    }
    .goods-receipt-details__item strong {
      display: block;
      margin-top: 2px;
      color: #172033;
      font-size: 14px;
      font-weight: 720;
    }
    .indent-items-table-wrapper {
      margin-top: 1rem;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      background: #ffffff;
      overflow: hidden;
    }
    .indent-items-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    .indent-items-table th {
      background: #f8fafc !important;
      border-bottom: 2px solid #e2e8f0;
      color: #475569;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      padding: 11px 10px;
    }
    .indent-items-table td {
      padding: 10px 12px;
      border-bottom: 1px solid #f1f5f9;
    }
    .goods-receipt-details__summary {
      margin-top: 1.25rem;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 0.4rem;
    }
    .summary-line {
      display: flex;
      justify-content: space-between;
      width: 290px;
      padding: 5px 0;
      font-size: 13px;
    }
    .summary-line--grand {
      border-top: 2px solid #e2e8f0;
      padding-top: 10px;
      margin-top: 4px;
      font-size: 15px;
    }
    @media print {
      body { margin: 8mm; }
      .goods-receipt-details__hero { border-radius: 0; }
    }
  </style>
</head>
<body>
  <div class="print-container">
    <div class="goods-receipt-details__hero">
      <div class="goods-receipt-details__hero-copy">
        <span>Purchase receipt</span>
        <h3>${escapeHtml(purchaseOrder)}</h3>
        <p>GRN Number: ${escapeHtml(grnNumber)}</p>
      </div>
      <div class="hero-badge">
        ${escapeHtml(formatStatusLabel(status))}
      </div>
    </div>

    <section class="goods-receipt-details__section">
      <div class="goods-receipt-details__section-heading">
        <div>
          <span>Receipt information</span>
          <h4>Receiving details</h4>
        </div>
      </div>
      <div class="goods-receipt-details__grid">
        ${detailsGridHtml}
      </div>
    </section>

    <section class="goods-receipt-details__section" style="padding-top: 0;">
      <div class="goods-receipt-details__section-heading">
        <div>
          <span>Line items & tax breakdown</span>
          <h4>Received Products & Tax Details</h4>
        </div>
      </div>
      <div class="indent-items-table-wrapper">
        <table class="indent-items-table">
          <thead>
            <tr>
              <th style="width: 50px; text-align: center;">S.No.</th>
              <th style="text-align: left; min-width: 200px;">Product</th>
              <th style="width: 90px; text-align: center;">Variant</th>
              <th style="width: 95px; text-align: right;">Ordered Qty</th>
              <th style="width: 95px; text-align: right;">Received Qty</th>
              <th style="width: 65px; text-align: center;">Unit</th>
              <th style="width: 105px; text-align: right;">Unit Price</th>
              <th style="width: 85px; text-align: right;">Discount %</th>
              <th style="width: 75px; text-align: right;">Tax %</th>
              <th style="width: 110px; text-align: right;">Line Total</th>
            </tr>
          </thead>
          <tbody>
            ${calculatedItems.length === 0 ? `
              <tr>
                <td colSpan="10" style="text-align: center; padding: 24px; color: #64748b;">
                  No received products found.
                </td>
              </tr>
            ` : calculatedItems.map((item, idx) => `
              <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#fbfcfd'};">
                <td style="text-align: center; color: #64748b; font-weight: 600;">${item.idx}</td>
                <td><strong style="color: #0f172a; font-weight: 650;">${escapeHtml(item.productName)}</strong></td>
                <td style="text-align: center; color: #64748b;">${escapeHtml(item.variantName)}</td>
                <td style="text-align: right; color: #334155;">${item.orderedQuantity}</td>
                <td style="text-align: right; color: #0f172a; font-weight: 700;">${item.receivedQuantity}</td>
                <td style="text-align: center; color: #64748b;">${escapeHtml(item.unitName)}</td>
                <td style="text-align: right; color: #334155;">${formatCurrency(item.unitPrice)}</td>
                <td style="text-align: right; color: ${item.discountPercentage > 0 ? '#dc2626' : '#64748b'};">${item.discountPercentage > 0 ? `${item.discountPercentage}%` : '—'}</td>
                <td style="text-align: right; color: #64748b;">${item.taxPercentage > 0 ? `${item.taxPercentage}%` : '—'}</td>
                <td style="text-align: right; color: #0f172a;"><strong>${formatCurrency(item.lineTotal)}</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div class="goods-receipt-details__summary">
        <div class="summary-line">
          <span style="color: #475569; font-weight: 600;">Subtotal:</span>
          <strong style="color: #0f172a; font-weight: 700; text-align: right;">${formatCurrency(totals.subtotal)}</strong>
        </div>
        ${totals.totalDiscount > 0 ? `
          <div class="summary-line">
            <span style="color: #475569; font-weight: 600;">Total Discount:</span>
            <strong style="color: #dc2626; font-weight: 700; text-align: right;">-${formatCurrency(totals.totalDiscount)}</strong>
          </div>
        ` : ''}
        <div class="summary-line">
          <span style="color: #475569; font-weight: 600;">Tax Total:</span>
          <strong style="color: #6c5ce7; font-weight: 700; text-align: right;">+${formatCurrency(totals.totalTax)}</strong>
        </div>
        <div class="summary-line summary-line--grand">
          <strong style="color: #0f172a;">Grand Total:</strong>
          <strong style="color: #5a49d6; font-size: 16px; font-weight: 800;">${formatCurrency(totals.grandTotal)}</strong>
        </div>
      </div>
    </section>
  </div>
</body>
</html>`)

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
  const submitInFlightRef = useRef(false)

  const errors = useMemo(
    () => fields.reduce((result, field) => {
      result[field.name] =
        getFieldError(field, formData[field.name], mode, { config, formData, referenceData, rows }) ||
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

  async function updateGoodsReceiptFromPurchaseOrder(value) {
    if (!value) {
      setFormData((currentValue) => ({
        ...currentValue,
        poId: '',
        supplierId: '',
        supplierName: '',
        warehouseId: '',
        productId: '',
        productName: '',
        variantId: '',
        variantName: '',
        quantityReceived: '',
        price: '',
      }))
      return
    }

    setFormData((currentValue) => ({
      ...currentValue,
      poId: value,
    }))

    let purchaseOrder = getPurchaseOrderById(value, referenceData)
    if (!purchaseOrder || !Array.isArray(getPurchaseOrderLineItems(purchaseOrder)) || getPurchaseOrderLineItems(purchaseOrder).length === 0) {
      const liveRes = await getLivePurchaseOrder(value)
      if (liveRes.success && liveRes.purchaseOrder) {
        purchaseOrder = liveRes.purchaseOrder
      }
    }

    const primaryLine = getPurchaseOrderPrimaryLine(purchaseOrder)
    const productId =
      getFirstReferenceValue(primaryLine, ['productId', 'product_id', 'ProductId']) ||
      getFirstReferenceValue(purchaseOrder, ['productId', 'product_id', 'ProductId']) ||
      ''
    const variantId =
      getFirstReferenceValue(primaryLine, ['variantId', 'variant_id', 'VariantId']) ||
      getFirstReferenceValue(purchaseOrder, ['variantId', 'variant_id', 'VariantId']) ||
      ''
    const hasPurchaseOrder = Boolean(purchaseOrder)
    const orderedQuantity = getPurchaseOrderQuantity(purchaseOrder, productId, variantId)
    const unitPrice = getPurchaseOrderUnitPrice(purchaseOrder, productId, variantId, referenceData)

    setFormData((currentValue) => ({
      ...currentValue,
      poId: value,
      supplierId: getFirstReferenceValue(purchaseOrder, ['supplierId', 'supplier_id', 'SupplierId']) || currentValue.supplierId || '',
      supplierName: getFirstReferenceValue(purchaseOrder, ['supplierName', 'supplier_name', 'SupplierName']) || currentValue.supplierName || '',
      warehouseId: getFirstReferenceValue(purchaseOrder, ['warehouseId', 'warehouse_id', 'WarehouseId']) || currentValue.warehouseId || '',
      productId: productId || currentValue.productId || '',
      productName: getFirstReferenceValue(primaryLine, ['productName', 'product_name', 'ProductName']) || getFirstReferenceValue(purchaseOrder, ['productName', 'product_name', 'ProductName']) || currentValue.productName || '',
      variantId: variantId || currentValue.variantId || '',
      variantName: getFirstReferenceValue(primaryLine, ['variantName', 'variant_name', 'VariantName']) || getFirstReferenceValue(purchaseOrder, ['variantName', 'variant_name', 'VariantName']) || currentValue.variantName || '',
      quantityReceived: hasPurchaseOrder && Number.isFinite(orderedQuantity) && orderedQuantity > 0 ? String(orderedQuantity) : currentValue.quantityReceived,
      price: hasPurchaseOrder && Number.isFinite(unitPrice) && unitPrice > 0 ? String(unitPrice) : currentValue.price,
    }))
  }

  function handleBlur(event) {
    setTouched((currentValue) => ({
      ...currentValue,
      [event.target.name]: true,
    }))
  }

  function handleChange(eventOrName, eventValue) {
    let name
    let value
    let field
    let type
    let checked

    if (eventOrName && typeof eventOrName === 'object' && eventOrName.target) {
      name = eventOrName.target.name
      value = eventOrName.target.value
      type = eventOrName.target.type
      checked = eventOrName.target.checked
      field = fields.find((f) => f.name === name)
    } else {
      name = eventOrName
      value = eventValue
      field = fields.find((f) => f.name === name)
    }

    if (config.key === 'goodsReceipts' && name === 'poId') {
      updateGoodsReceiptFromPurchaseOrder(value)
      return
    }

    updateField(name, field?.type === 'email' ? sanitizeEmailInput(value) : type === 'checkbox' ? checked : value)
  }

  function shouldShowError(field) {
    return touched[field.name] || submitAttempted || Boolean(getServerFieldError(serverErrors, field))
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (submitInFlightRef.current || isSubmitting) {
      return
    }

    setSubmitAttempted(true)
    setTouched(fields.reduce((result, field) => ({ ...result, [field.name]: true }), {}))

    if (!isValid || saveDisabled) {
      return
    }

    submitInFlightRef.current = true

    try {
      await onSubmit({
        payload,
        changedPayload,
      })
    } finally {
      submitInFlightRef.current = false
    }
  }

  function renderField(field) {
    const error = shouldShowError(field) ? errors[field.name] : ''
    const dynamicMax = getDynamicMax(field, { formData, referenceData, rows })
    const helperText = config.key === 'goodsReceipts' && field.name === 'quantityReceived' && formData.poId
      ? `Exact quantity from the selected Purchase Order: ${formData.quantityReceived || 0}`
      : field.maxFrom === 'goodsReceiptRemainingQuantity' && dynamicMax !== null
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
  const saveInFlightRef = useRef(false)
  const rowActionInFlightRef = useRef(new Set())
  const loadRowsRequestRef = useRef(0)
  const [rows, setRows] = useState([])
  const [isLoading, setIsLoading] = useState(() => !listResource.hasCache?.(config))
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [metric, setMetric] = useState(null)
  const [editingRecord, setEditingRecord] = useState(null)
  const [viewingRecord, setViewingRecord] = useState(null)
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
  const [selectedGoodsReceiptIds, setSelectedGoodsReceiptIds] = useState([])

  const canCreate = (config.canCreate ?? true) && hasPermission(config.permissionKey, 'create')
  const canUpdate = (config.canUpdate ?? true) && hasPermission(config.permissionKey, 'edit')
  const canDelete = Boolean(config.forceDelete) ||
    ((config.canDelete ?? true) && hasPermission(config.permissionKey, 'delete'))
  const mode = editingRecord ? 'edit' : 'create'
  const Icon = config.icon
  const isGoodsReceiptsPage = config.key === 'goodsReceipts'
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
  const goodsReceiptDetailItems = viewingRecord
    ? getGoodsReceiptDetailItems(viewingRecord)
    : []
  const goodsReceiptStatus = goodsReceiptDetailItems.find((item) => item.key === 'status')?.value || 'Recorded'
  const goodsReceiptNumber = goodsReceiptDetailItems.find((item) => item.key === 'receiptId')?.value || 'N/A'
  const goodsReceiptPurchaseOrder = goodsReceiptDetailItems.find((item) => item.key === 'purchaseOrder')?.value || 'Purchase Order'
  const goodsReceiptBodyItems = goodsReceiptDetailItems.filter((item) =>
    !['receiptId', 'purchaseOrder', 'status'].includes(item.key),
  )

  const [viewingPoItems, setViewingPoItems] = useState([])

  useEffect(() => {
    if (!viewingRecord) {
      setViewingPoItems([])
      return
    }

    const poIdentifier = getFirstReferenceValue(viewingRecord, ['poId', 'PoId', 'purchaseOrderId', 'PurchaseOrderId', 'poNumber', 'PoNumber'], '')
    if (!poIdentifier) return

    let matchedPo = getPurchaseOrderById(poIdentifier, referenceData)
    if (matchedPo) {
      const lines = getPurchaseOrderLineItems(matchedPo)
      if (Array.isArray(lines) && lines.length > 0) {
        setViewingPoItems(lines)
        return
      }
    }

    getPurchaseOrder(poIdentifier)
      .then(res => {
        if (res?.success && res?.data) {
          const lines = getPurchaseOrderLineItems(res.data)
          if (Array.isArray(lines) && lines.length > 0) {
            setViewingPoItems(lines)
          }
        }
      })
      .catch(() => {})
  }, [viewingRecord, referenceData])

  const viewingRecordItems = useMemo(() => {
    if (!viewingRecord) return []
    let itemsRaw = viewingRecord.items || viewingRecord.lineItems || viewingRecord.products || viewingRecord.goodsReceiptItems || viewingRecord.orderItems || []

    const poIdentifier = getFirstReferenceValue(viewingRecord, ['poId', 'PoId', 'purchaseOrderId', 'PurchaseOrderId', 'poNumber', 'PoNumber'], '')
    let poItems = []
    if (poIdentifier) {
      const matchedPo = getPurchaseOrderById(poIdentifier, referenceData)
      if (matchedPo) {
        poItems = getPurchaseOrderLineItems(matchedPo)
      } else if (Array.isArray(viewingPoItems) && viewingPoItems.length > 0) {
        poItems = viewingPoItems
      }
    }

    const baseList = (Array.isArray(poItems) && poItems.length > 0)
      ? poItems
      : (Array.isArray(itemsRaw) && itemsRaw.length > 0 ? itemsRaw : [viewingRecord])

    return baseList.map((poIt, idx) => {
      const pId = String(poIt.productId || poIt.product_id || poIt.id || '')
      const pName = String(poIt.productName || poIt.product || poIt.name || '').toLowerCase().trim()

      const matchedRxItem = itemsRaw.find((rxIt) => {
        const rxPId = String(rxIt.productId || rxIt.product_id || rxIt.id || '')
        if (pId && rxPId && pId === rxPId) return true
        const rxPName = String(rxIt.productName || rxIt.product || rxIt.name || '').toLowerCase().trim()
        if (pName && rxPName && (pName === rxPName || pName.includes(rxPName) || rxPName.includes(pName))) return true
        return false
      })

      const matchedCatalogProduct = referenceData.products?.find(prod => String(prod.id || prod.productId) === pId)

      const priceFromRx = matchedRxItem ? Number(matchedRxItem.unitPrice ?? matchedRxItem.price ?? matchedRxItem.cost ?? 0) : 0
      const priceFromPo = Number(poIt.unitPrice ?? poIt.price ?? poIt.unitCost ?? poIt.cost ?? 0)
      const priceFromCatalog = matchedCatalogProduct ? Number(matchedCatalogProduct.purchasePrice ?? matchedCatalogProduct.unitPrice ?? matchedCatalogProduct.price ?? matchedCatalogProduct.cost ?? 0) : 0

      const unitPrice = priceFromRx > 0 ? priceFromRx : (priceFromPo > 0 ? priceFromPo : priceFromCatalog)

      const orderedQty = Number(
        poIt.quantityOrdered ??
        poIt.orderedQuantity ??
        poIt.orderedQty ??
        poIt.quantity ??
        matchedRxItem?.orderedQuantity ??
        1
      )

      const receivedQty = Number(
        matchedRxItem?.receivedQuantity ??
        matchedRxItem?.quantityReceived ??
        matchedRxItem?.acceptedQuantity ??
        matchedRxItem?.quantity ??
        orderedQty
      )

      const discountPct = Number(matchedRxItem?.discountPercentage ?? matchedRxItem?.discount ?? poIt.discountPercentage ?? poIt.discount ?? 0)
      const taxPct = Number(matchedRxItem?.taxPercentage ?? matchedRxItem?.taxRate ?? matchedRxItem?.tax ?? poIt.taxPercentage ?? poIt.taxRate ?? poIt.tax ?? 0)

      const gross = receivedQty * unitPrice
      const discAmt = Number(matchedRxItem?.discountAmount ?? ((gross * discountPct) / 100))
      const taxableAmount = Math.max(0, gross - discAmt)
      const taxAmount = Number(matchedRxItem?.taxAmount ?? matchedRxItem?.gstAmount ?? ((taxableAmount * taxPct) / 100))
      const rawLineTotal = Number(matchedRxItem?.lineTotal ?? matchedRxItem?.totalAmount ?? 0)
      const lineTotal = rawLineTotal > 0 ? rawLineTotal : (taxableAmount + taxAmount)

      const unitCandidates = [
        matchedRxItem?.unitName,
        matchedRxItem?.unit,
        matchedRxItem?.uom,
        matchedRxItem?.uomName,
        matchedRxItem?.unitSymbol,
        matchedRxItem?.unitOfMeasure,
        matchedRxItem?.UnitName,
        matchedRxItem?.Unit,
        poIt?.unitName,
        poIt?.unit,
        poIt?.uom,
        poIt?.uomName,
        poIt?.unitSymbol,
        poIt?.unitOfMeasure,
        poIt?.UnitName,
        poIt?.Unit,
        matchedCatalogProduct?.unitName,
        matchedCatalogProduct?.unit,
        matchedCatalogProduct?.uom,
        matchedCatalogProduct?.unitSymbol,
        matchedCatalogProduct?.uomName,
        matchedCatalogProduct?.unitOfMeasure,
        matchedCatalogProduct?.unit?.unitName,
        matchedCatalogProduct?.unit?.name,
        matchedCatalogProduct?.unit?.symbol,
        matchedCatalogProduct?.UnitName,
        matchedCatalogProduct?.Unit,
        matchedCatalogProduct?.Uom,
      ]

      let resolvedUnit = ''
      for (const candidate of unitCandidates) {
        if (typeof candidate === 'object' && candidate !== null) {
          const nested = candidate.unitName || candidate.name || candidate.symbol || candidate.label
          if (nested && String(nested).trim()) {
            resolvedUnit = String(nested).trim()
            break
          }
        } else {
          const textVal = String(candidate ?? '').trim()
          if (textVal && textVal !== '-' && textVal.toLowerCase() !== 'undefined' && textVal.toLowerCase() !== 'null') {
            resolvedUnit = textVal
            break
          }
        }
      }

      return {
        ...poIt,
        ...matchedRxItem,
        productName: poIt.productName || poIt.product || poIt.name || matchedRxItem?.productName || (pId ? `Product #${pId}` : `Product #${idx + 1}`),
        variantName: poIt.variantName || poIt.variant || matchedRxItem?.variantName || '-',
        unitName: resolvedUnit || matchedRxItem?.unitName || poIt.unitName || 'Nos',
        orderedQuantity: orderedQty,
        receivedQuantity: receivedQty,
        unitPrice,
        price: unitPrice,
        discountPercentage: discountPct,
        taxPercentage: taxPct,
        taxableAmount,
        discountAmount: discAmt,
        taxAmount,
        lineTotal,
        totalAmount: lineTotal,
      }
    })
  }, [viewingRecord, referenceData, viewingPoItems])

  const viewingRecordTotals = useMemo(() => {
    return calculateGoodsReceiptTotals(viewingRecordItems)
  }, [viewingRecordItems])

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
    const mustFetchLiveRows = force || config.key === 'goodsReceipts'
    const requestSequence = ++loadRowsRequestRef.current
    const shouldShowLoading = options.showLoading ?? (mustFetchLiveRows || !listResource.hasCache?.(config))

    if (shouldShowLoading) {
      setIsLoading(true)
    }

    if (config.key === 'goodsReceipts') {
      setRows([])
    }

    setError('')

    try {
      const referenceEntries = Object.entries(config.referenceEndpoints ?? {})
      const [response, metricResponse, ...referenceResponses] = await Promise.all([
        listResource(config, undefined, {
          force: mustFetchLiveRows,
          disableCache: config.key === 'goodsReceipts',
          requestOptions: config.key === 'goodsReceipts'
            ? { cache: 'no-store' }
            : {},
        }),
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
            }).catch((err) => ({ success: false, error: err?.message, data: { products: [] } }))
          }
          return apiRequest(endpoint).catch((err) => ({ success: false, error: err?.message }))
        }),
      ])

      if (requestSequence !== loadRowsRequestRef.current) {
        return
      }

      const normalizedReferenceData = referenceEntries.reduce((result, [key], index) => {
        let list = referenceResponses[index]?.success
          ? getResponseList(referenceResponses[index], config.referenceListKeys?.[key])
            .map((row) => normalizeResourceRow(row, {}))
          : []

        if (!Array.isArray(list)) {
          list = []
        }

        if (key === 'purchaseOrders') {
          list = list.map(normalizePurchaseOrder)
        }
        if (key === 'warehouses') {
          list = list.map(normalizeWarehouse)
        }

        return {
          ...result,
          [key]: list,
        }
      }, {})

      if (!response.success) {
        setRows([])
        setError(response.error || `Unable to load ${config.title}.`)
      } else {
        const rawRows = Array.isArray(response.data) ? response.data : getResponseList(response, config.listKey || 'goodsReceipts')
        const normalizedRows = (Array.isArray(rawRows) ? rawRows : []).map((row) => {
          const normalizedRow = normalizeResourceRow(row, config)

          if (config.key !== 'goodsReceipts') {
            return normalizedRow
          }

          return reconcileGoodsReceiptWithPurchaseOrder(
            { ...normalizedRow, grnNumber: getGoodsReceiptNumber(normalizedRow) },
            normalizedReferenceData.purchaseOrders || [],
            normalizedReferenceData,
          )
        })

        setRows(config.key === 'goodsReceipts'
          ? getLatestGoodsReceiptPerPurchaseOrder(normalizedRows)
          : normalizedRows)
      }

      if (metricResponse && metricResponse.success) {
        setMetric(getResponseData(metricResponse, null))
      }

      if (referenceEntries.length > 0) {
        setReferenceData(normalizedReferenceData)
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
    } catch (err) {
      console.error('[GoodsReceipts] Error loading rows:', err)
      setError(err?.message || `Unable to load ${config.title}.`)
      setRows([])
    } finally {
      if (requestSequence === loadRowsRequestRef.current) {
        setIsLoading(false)
      }
    }
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

  const selectedGoodsReceipts = useMemo(() => {
    const selectedIdSet = new Set(selectedGoodsReceiptIds.map(String))
    return rows.filter((row) => selectedIdSet.has(String(row.id || '')))
  }, [rows, selectedGoodsReceiptIds])
  const hasSelectedGoodsReceipts = selectedGoodsReceipts.length > 0

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

  useEffect(() => {
    if (!isGoodsReceiptsPage) {
      return
    }

    const visibleIdSet = new Set(rows.map((row) => String(row.id || '')))
    setSelectedGoodsReceiptIds((currentValue) => currentValue.filter((id) => visibleIdSet.has(String(id))))
  }, [isGoodsReceiptsPage, rows])

  async function handleSave(dataArg) {
    const payload = dataArg?.payload || dataArg || {}
    const changedPayload = dataArg?.changedPayload || payload
    const isGoodsReceiptCreate = config.key === 'goodsReceipts' && !editingRecord?.id && (payload?.poId || payload?.purchaseOrderId)
    const goodsReceiptSubmissionKey = isGoodsReceiptCreate
      ? getGoodsReceiptSubmissionKey(payload)
      : ''

    if (
      saveInFlightRef.current ||
      isSaving ||
      (goodsReceiptSubmissionKey && GOODS_RECEIPT_SUBMISSION_LOCKS.has(goodsReceiptSubmissionKey))
    ) {
      return { success: false, duplicateBlocked: true }
    }

    saveInFlightRef.current = true
    if (goodsReceiptSubmissionKey) {
      GOODS_RECEIPT_SUBMISSION_LOCKS.add(goodsReceiptSubmissionKey)
    }
    setIsSaving(true)
    setServerErrors(null)

    try {
      const id = editingRecord?.id
      let response

      if (config.key === 'goodsReceipts' && !id && (payload?.poId || payload?.purchaseOrderId)) {
        const poId = payload.poId || payload.purchaseOrderId
        const [livePurchaseOrderResponse, existingReceiptsResponse] = await Promise.all([
          getLivePurchaseOrder(poId),
          getGoodsReceiptsByPurchaseOrder(poId).catch(() => ({ success: true, rows: [] })),
        ])
        const purchaseOrder = livePurchaseOrderResponse.purchaseOrder
        const poStatus = String(
          purchaseOrder?.status || purchaseOrder?.Status || purchaseOrder?.orderStatus || ''
        ).toLowerCase()

        if (!livePurchaseOrderResponse?.success || !purchaseOrder) {
          console.warn('[GoodsReceipts] Could not load live Purchase Order, proceeding with payload data for PO:', poId)
        }

        const knownReceiptIds = new Set(
          (existingReceiptsResponse.rows || [])
            .map(getGoodsReceiptId)
            .filter(Boolean),
        )

        const defaultSupplierId = referenceData.suppliers?.[0]?.id ?? referenceData.suppliers?.[0]?.supplierId ?? 1
        const defaultWarehouseId = referenceData.warehouses?.[0]?.id ?? referenceData.warehouses?.[0]?.warehouseId ?? 1
        const defaultProductId = referenceData.products?.[0]?.id ?? referenceData.products?.[0]?.productId ?? 1

        const primaryLine = getPurchaseOrderPrimaryLine(purchaseOrder)
        const productId =
          payload.productId ||
          getFirstReferenceValue(primaryLine, ['productId', 'product_id', 'ProductId']) ||
          getFirstReferenceValue(purchaseOrder, ['productId', 'product_id', 'ProductId']) ||
          defaultProductId

        const variantId =
          payload.variantId ||
          getFirstReferenceValue(primaryLine, ['variantId', 'variant_id', 'VariantId']) ||
          getFirstReferenceValue(purchaseOrder, ['variantId', 'variant_id', 'VariantId']) ||
          null

        const supplierId =
          payload.supplierId ||
          getFirstReferenceValue(purchaseOrder, ['supplierId', 'supplier_id', 'SupplierId']) ||
          defaultSupplierId

        const warehouseId =
          payload.warehouseId ||
          getFirstReferenceValue(purchaseOrder, ['warehouseId', 'warehouse_id', 'WarehouseId']) ||
          defaultWarehouseId

        const orderedQuantity =
          Number(payload.quantityReceived || payload.quantity || 0) ||
          getPurchaseOrderQuantity(purchaseOrder, productId, variantId) ||
          1

        const unitPrice =
          Number(payload.price || payload.unitPrice || 0) ||
          getPurchaseOrderUnitPrice(purchaseOrder, productId, variantId, referenceData) ||
          0

        const itemsPayload = Array.isArray(payload.items) && payload.items.length > 0
          ? payload.items
          : [{
              productId: Number(productId),
              variantId: variantId ? Number(variantId) : null,
              orderedQuantity: orderedQuantity,
              quantityReceived: orderedQuantity,
              receivedQuantity: orderedQuantity,
              acceptedQuantity: orderedQuantity,
              rejectedQuantity: 0,
              unitPrice: unitPrice,
            }]

        const safeId = (val) => {
          if (val === undefined || val === null || val === '') return null
          const num = Number(val)
          if (Number.isFinite(num)) return num
          const str = String(val).trim()
          return str ? str : null
        }

        const parsedPoId = safeId(poId)
        const parsedSupplierId = safeId(supplierId)
        const parsedWarehouseId = safeId(warehouseId)
        const parsedProductId = safeId(productId)
        const parsedVariantId = safeId(variantId)

        const mappedItems = itemsPayload.map(item => {
          const itemProdId = safeId(item.productId) || parsedProductId
          const itemVarId = safeId(item.variantId) || parsedVariantId
          const rxQty = Number(item.quantityReceived || item.receivedQuantity || 0)
          const price = Number(item.unitPrice || 0)

          const matchedProd = (referenceData.products || []).find(p => String(p.id || p.productId) === String(itemProdId))
          const matchedVar = (referenceData.productVariants || []).find(v => String(v.id || v.variantId) === String(itemVarId))
          const pName = item.productName || item.product_name || item.name || matchedProd?.name || matchedProd?.productName || (itemProdId ? `Product #${itemProdId}` : '')
          const vName = item.variantName || item.variant_name || matchedVar?.name || matchedVar?.variantName || ''

          return {
            purchaseOrderItemId: safeId(item.purchaseOrderItemId || item.id),
            productId: itemProdId,
            productName: pName,
            variantId: itemVarId,
            variantName: vName,
            orderedQuantity: Number(item.orderedQuantity || rxQty || 1),
            quantityReceived: rxQty,
            receivedQuantity: rxQty,
            acceptedQuantity: rxQty,
            rejectedQuantity: 0,
            unitPrice: price,
            discount: Number(item.discount || item.discountPercentage || 0),
            discountPercentage: Number(item.discount || item.discountPercentage || 0),
            taxPercentage: Number(item.taxPercentage || item.tax || 0),
            tax: Number(item.taxPercentage || item.tax || 0),
            lineTotal: Number(item.lineTotal || 0) || (rxQty * price),
          }
        })

        const firstItem = mappedItems[0] || {}

        const totals = calculateGoodsReceiptTotals(mappedItems)

        const receiptPayload = {
          poId: parsedPoId,
          purchaseOrderId: parsedPoId,
          supplierId: parsedSupplierId,
          warehouseId: parsedWarehouseId,
          productId: safeId(firstItem.productId) || parsedProductId,
          variantId: safeId(firstItem.variantId) || parsedVariantId,
          quantityReceived: Number(firstItem.receivedQuantity || orderedQuantity || 1),
          price: Number(firstItem.unitPrice || unitPrice || 0),
          unitPrice: Number(firstItem.unitPrice || unitPrice || 0),
          receiptDate: payload.receiptDate ? new Date(payload.receiptDate).toISOString() : new Date().toISOString(),
          notes: payload.notes || payload.remarks || '',
          status: 'Pending',
          items: mappedItems,
          goodsReceiptItems: mappedItems,
          lineItems: mappedItems,
          subtotal: totals.subtotal,
          totalDiscount: totals.totalDiscount,
          totalTax: totals.totalTax,
          taxAmount: totals.totalTax,
          grandTotal: totals.grandTotal,
          totalAmount: totals.grandTotal,
        }

        console.log("Create Goods Receipt payload:", JSON.stringify(receiptPayload, null, 2))
        console.log("Payload item count:", receiptPayload.items.length)

        if (!response && (!poStatus.includes('approved') && !poStatus.includes('received') && !poStatus.includes('completed'))) {
          try {
            await apiRequest(API_ENDPOINTS.purchaseOrders.approve(poId), { method: 'POST', body: {} })
          } catch {
            // Non-blocking approval call
          }
        }

        if (!response) {
          // This is the only Goods Receipt create call for this submission. Never retry a POST.
          response = await createResource(config, receiptPayload)

          let createdReceipt = response.success ? getResponseData(response) : null
          let grnId = getGoodsReceiptId(createdReceipt)
          const canReconcile = existingReceiptsResponse.success && (
            response.success || response.status === 0 || response.status === 200 || response.status >= 500
          )
          let createdReceiptMatches = []

          if (canReconcile) {
            const creationVerification = await findCreatedGoodsReceipts(poId, receiptPayload, knownReceiptIds)
            createdReceiptMatches = creationVerification.matches

            if (createdReceiptMatches.length > 1) {
              response = {
                ...response,
                success: false,
                receiptCreated: true,
                backendDuplicateDetected: true,
                error: `The backend created ${createdReceiptMatches.length} Goods Receipt records from one POST request. Do not resubmit this receipt.`,
              }
            } else if (creationVerification.exactMatches.length === 1) {
              createdReceipt = creationVerification.exactMatches[0]
              grnId = getGoodsReceiptId(createdReceipt)

              if (!response.success) {
                response = {
                  ...response,
                  success: true,
                  data: createdReceipt,
                  error: null,
                  reconciled: true,
                }
              }
            }
          }

          if (response.success && !grnId) {
            response = {
              ...response,
              success: false,
              receiptCreated: true,
              error: 'The Goods Receipt was created, but the backend did not return its ID. Do not resubmit this receipt.',
            }
          } else if (response.success) {
            response = {
              ...response,
              data: createdReceipt ?? response.data,
              createdReceiptId: grnId,
              requiresApprovalForStock: true,
            }
          } else if (response.status === 0 || response.status >= 500) {
            response = {
              ...response,
              submissionOutcomeUnknown: true,
              error: `${response.error || 'The Goods Receipt response could not be confirmed.'} The receipt list was refreshed; verify it before trying again.`,
            }
          }
        }
      } else {
        response = id
          ? await updateResource(config, id, payload, changedPayload)
          : await createResource(config, payload)
      }

      if (!response.success) {
        setServerErrors(response.errors)
        showToast({
          type: 'error',
          title: config.title,
          message: response.error || `Unable to save ${config.entityName.toLowerCase()}.`,
        })

        if (response.receiptCreated) {
          setIsFormOpen(false)
          setEditingRecord(null)
          await loadRows({ force: true })
        } else if (response.submissionOutcomeUnknown) {
          // Keep the entered values available after an unconfirmed network
          // outcome, but refresh the real receipt list so the user can verify
          // whether the server committed the request before choosing to retry.
          await loadRows({ force: true })
        }

        return response
      }

      showToast({
        type: response.requiresApprovalForStock ? 'info' : 'success',
        title: config.title,
        message: response.requiresApprovalForStock
          ? `Goods Receipt created successfully.`
          : `${config.entityName} ${id ? 'updated' : 'created'} successfully.`,
      })
      if (isSubCategoriesPage && !id) {
        clearSubCategoryDraft()
      }
      setIsFormOpen(false)
      setEditingRecord(null)
      notifyCatalogStructureUpdate(config, id ? 'updated' : 'created')
      if (config.key === 'goodsReceipts') {
        window.dispatchEvent(new CustomEvent(STOCK_DATA_UPDATED_EVENT, {
          detail: {
            resource: config.key,
            action: id ? 'updated' : 'created',
            goodsReceiptId: response.createdReceiptId,
          },
        }))
      }
      await loadRows({ force: true })
      return response
    } finally {
      if (goodsReceiptSubmissionKey) {
        GOODS_RECEIPT_SUBMISSION_LOCKS.delete(goodsReceiptSubmissionKey)
      }
      saveInFlightRef.current = false
      setIsSaving(false)
    }
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

  async function handleBulkGoodsReceiptDelete() {
    if (!canDelete || selectedGoodsReceipts.length === 0) {
      return
    }

    setIsDeleting(true)

    try {
      for (const row of selectedGoodsReceipts) {
        const response = await deleteResource(config, row.id)

        if (!response.success) {
          throw new Error(getDeleteErrorMessage(config, response.error))
        }
      }

      setSelectedGoodsReceiptIds([])
      showToast({
        type: 'success',
        title: config.title,
        message: `${selectedGoodsReceipts.length} ${config.entityName} record${selectedGoodsReceipts.length === 1 ? '' : 's'} deleted successfully.`,
      })
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
    if (action.type === 'view' || action.key === 'view') {
      await openView(row)
      return
    }

    const id = row.id || getGoodsReceiptId(row)
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

    const actionKey = `${config.key}:${id}:${action.key || endpoint}`

    if (rowActionInFlightRef.current.has(actionKey)) {
      return
    }

    rowActionInFlightRef.current.add(actionKey)
    let response

    try {
      response = action.type === 'put'
        ? await putResourceAction(endpoint, action.body)
        : await postResourceAction(endpoint)

      const errLower = String(response.error || '').toLowerCase()
      const isAlreadyCompleted = errLower.includes('already') || errLower.includes("current status is 'completed'") || errLower.includes('current status is "completed"')

      if (!response.success && isAlreadyCompleted) {
        response = {
          success: true,
          error: null,
          message: 'Goods receipt is already approved. Warehouse stock has been updated.',
        }
      }

      if (response.success && config.key === 'goodsReceipts' && action.key === 'approve' && id) {
        try {
          await createWarehouseStockFromGrn(id)
        } catch {
          // Stock posting attempt on approval
        }
      }
    } finally {
      rowActionInFlightRef.current.delete(actionKey)
    }

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
    if (config.key === 'goodsReceipts') {
      window.dispatchEvent(new CustomEvent(STOCK_DATA_UPDATED_EVENT, {
        detail: { resource: config.key, action: action.key, goodsReceiptId: id },
      }))
    }
    await loadRows({ force: true })
  }

  async function openView(row) {
    const id = row.id || getGoodsReceiptId(row)
    let fullRecord = row

    if (id && API_ENDPOINTS.goodsReceipts?.byId) {
      try {
        const response = await apiRequest(API_ENDPOINTS.goodsReceipts.byId(id))
        console.log("Goods Receipt Details Response:", response?.data)

        if (response.success && response.data) {
          const detailed = getResponseData(response)
          const receiptData = response?.data?.data || response?.data || detailed || {}
          const backendItems =
            receiptData?.items ||
            receiptData?.goodsReceiptItems ||
            receiptData?.receiptItems ||
            receiptData?.lineItems ||
            []

          console.log("Goods Receipt Items:", backendItems)

          const rowItems = Array.isArray(row.items) && row.items.length > 0
            ? row.items
            : (Array.isArray(row.lineItems) ? row.lineItems : [])

          const itemsToKeep = Array.isArray(backendItems) && backendItems.length > 0
            ? backendItems
            : rowItems

          fullRecord = {
            ...row,
            ...receiptData,
            items: itemsToKeep,
            goodsReceiptItems: itemsToKeep,
            receiptItems: itemsToKeep,
            lineItems: itemsToKeep,
          }
        }
      } catch {
        // Fallback to row data
      }
    }

    setViewingRecord(normalizeResourceRow(fullRecord, config))
  }

  function closeView() {
    setViewingRecord(null)
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
            searchValue: column.searchValue ?? ((row) => String(readResourceValue(row, column.key, '') ?? '')),
            sortValue: column.sortValue ?? ((row) => readResourceValue(row, column.key, '')),
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
            menuKey={row.id || readResourceValue(row, config.idFields?.[0], '')}
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
    : isGoodsReceiptsPage
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
              showTooltip={false}
              label="Goods Receipt actions"
              menuKey={row.id || getGoodsReceiptId(row)}
              actions={[
                {
                  key: 'view',
                  label: 'View',
                  icon: Eye,
                  onClick: () => openView(row),
                },
                {
                  key: 'print',
                  label: 'Print',
                  icon: Printer,
                  onClick: () => handlePrintGoodsReceipt(row, referenceData),
                },
                ...(config.rowActions ?? [])
                  .filter((action) => (action.shouldShow ? action.shouldShow(row) : true))
                  .map((action) => ({
                    key: action.key,
                    label: action.label,
                    icon: action.icon || (action.key === 'approve' ? CheckCircle2 : RefreshCw),
                    onClick: () => handleRowAction(action, row),
                  })),
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
              menuKey={row.id || readResourceValue(row, config.idFields?.[0], '')}
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
                label={`Actions for ${readResourceValue(row, 'name', readResourceValue(row, 'roleName', readResourceValue(row, 'companyName', config.entityName)))}`}
                menuKey={row.id || readResourceValue(row, config.idFields?.[0], '')}
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
  const goodsReceiptSelectedToolbarContent = hasSelectedGoodsReceipts ? (
    <FilterBar className="resource-center__product-style-selection-actions" ariaLabel="Selected Goods Receipts actions">
      <div className="resource-center__product-style-selection-summary" aria-live="polite">
        <Check size={15} />
        <strong>{selectedGoodsReceipts.length} selected</strong>
      </div>
      <button
        type="button"
        className="button button-secondary resource-center__product-style-selection-button"
        onClick={() => exportResourceRowsCsv(config, selectedGoodsReceipts)}
      >
        <Download size={15} />
        Export
      </button>
      <button
        type="button"
        className="button button-secondary resource-center__product-style-selection-button"
        onClick={() => printResourceRows(config, selectedGoodsReceipts)}
      >
        <Printer size={15} />
        Print
      </button>
      {canDelete ? (
        <button
          type="button"
          className="button button-secondary resource-center__product-style-selection-button resource-center__product-style-selection-button--danger"
          onClick={handleBulkGoodsReceiptDelete}
          disabled={isDeleting}
        >
          <Trash2 size={15} />
          Delete
        </button>
      ) : null}
    </FilterBar>
  ) : null
  const resolvedFilterContent = isGoodsReceiptsPage && hasSelectedGoodsReceipts
    ? goodsReceiptSelectedToolbarContent
    : isSubCategoriesPage
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
        <header className="resource-center__compact-header" aria-label={`${config.title} workspace summary`}>
          <div className="resource-center__compact-title-row">
            <h1>{config.title}</h1>
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
          enableRowSelection={isGoodsReceiptsPage || isSubCategoriesPage || isProductStylePage}
          selectedRowKeys={isGoodsReceiptsPage ? selectedGoodsReceiptIds : isSubCategoriesPage ? selectedSubCategoryIds : isProductStylePage ? selectedProductStyleRowIds : undefined}
          onSelectionChange={isGoodsReceiptsPage ? setSelectedGoodsReceiptIds : isSubCategoriesPage ? setSelectedSubCategoryIds : isProductStylePage ? setSelectedProductStyleRowIds : undefined}
          keyField={isProductStylePage ? '__resourceSelectionKey' : 'id'}
        />
      </div>

      {!isProductStylePage && isAuditLogsPage ? (
        <AuditLogsMobileFeed rows={rows} isLoading={isLoading} />
      ) : null}

      {isFormOpen ? (
        <FormModal
          title={config.key === 'goodsReceipts' ? null : `${mode === 'edit' ? 'Edit' : 'Create'} ${config.entityName}`}
          subtitle=""
          onClose={closeForm}
          className={
            config.key === 'goodsReceipts'
              ? 'edit-indent-modal'
              : isSubCategoriesPage
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
          {config.key === 'goodsReceipts' ? (
            <GoodsReceiptForm
              mode={mode}
              record={editingRecord}
              referenceData={{
                ...referenceData,
                goodsReceipts: referenceData.goodsReceipts || rows,
              }}
              isSubmitting={isSaving}
              onSubmit={handleSave}
              onCancel={closeForm}
            />
          ) : (
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
          )}
        </FormModal>
      ) : null}

      {viewingRecord ? (
        <FormModal
          title="Goods Receipt Details"
          onClose={closeView}
          className="form-modal--goods-receipt-details"
          dialogClassName="form-modal__dialog--goods-receipt-details"
          bodyClassName="form-modal__body--goods-receipt-details"
        >
          <div className="goods-receipt-details">
            <div className="goods-receipt-details__hero">
              <div className="goods-receipt-details__hero-icon" aria-hidden="true">
                <ReceiptText size={25} />
              </div>
              <div className="goods-receipt-details__hero-copy">
                <span>Purchase receipt</span>
                <h3>{goodsReceiptPurchaseOrder}</h3>
                <p>GRN Number: {goodsReceiptNumber}</p>
              </div>
              <StatusBadge type={getStatusType(goodsReceiptStatus)}>
                {formatStatusLabel(goodsReceiptStatus)}
              </StatusBadge>
            </div>

            <section className="goods-receipt-details__section" aria-label="Receipt information">
              <div className="goods-receipt-details__section-heading">
                <div>
                  <span>Receipt information</span>
                  <h4>Receiving details</h4>
                </div>
              </div>

              <div className="goods-receipt-details__grid">
                {goodsReceiptBodyItems.map((item) => {
                  const DetailIcon = item.icon

                  return (
                    <div
                      className={`goods-receipt-details__item ${item.fullWidth ? 'goods-receipt-details__item--full' : ''}`.trim()}
                      key={item.key}
                    >
                      <span className="goods-receipt-details__item-icon" aria-hidden="true">
                        <DetailIcon size={17} />
                      </span>
                      <div>
                        <span className="goods-receipt-details__item-label">{item.label}</span>
                        <strong>{String(item.value ?? '').trim() || 'N/A'}</strong>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>

            <section className="goods-receipt-details__section" aria-label="Receipt items and tax breakdown" style={{ marginTop: '1.5rem' }}>
              <div className="goods-receipt-details__section-heading">
                <div>
                  <span>Line items & tax breakdown</span>
                  <h4>Received Products & Tax Details</h4>
                </div>
              </div>

              <div className="indent-items-table-wrapper" style={{ overflowX: 'auto', overflowY: 'auto', marginTop: '1rem', border: '1px solid #e2e8f0', borderRadius: '10px', maxHeight: '280px', background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <table className="indent-items-table" style={{ width: '100%', minWidth: '850px', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', position: 'sticky', top: 0, zIndex: 5, color: '#475569', fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                      <th style={{ width: '52px', padding: '11px 10px', textAlign: 'center' }}>S.No.</th>
                      <th style={{ padding: '11px 12px', textAlign: 'left', minWidth: '300px' }}>Product</th>
                      <th style={{ width: '90px', padding: '11px 10px', textAlign: 'center' }}>Variant</th>
                      <th style={{ width: '95px', padding: '11px 12px', textAlign: 'center' }}>Ordered Qty</th>
                      <th style={{ width: '95px', padding: '11px 12px', textAlign: 'center' }}>Received Qty</th>
                      <th style={{ width: '65px', padding: '11px 10px', textAlign: 'center' }}>Unit</th>
                      <th style={{ width: '105px', padding: '11px 12px', textAlign: 'center' }}>Unit Price</th>
                      <th style={{ width: '85px', padding: '11px 12px', textAlign: 'center' }}>Discount %</th>
                      <th style={{ width: '75px', padding: '11px 12px', textAlign: 'center' }}>Tax %</th>
                      <th style={{ width: '110px', padding: '11px 12px', textAlign: 'center' }}>Line Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewingRecordItems.length === 0 ? (
                      <tr>
                        <td colSpan={10} style={{ textAlign: 'center', padding: '24px', color: '#64748b', fontSize: '13px' }}>
                          No received products found.
                        </td>
                      </tr>
                    ) : (
                      viewingRecordItems.map((item, idx) => {
                        const orderedQty = item.orderedQuantity ?? item.orderedQty ?? item.orderQuantity ?? item.requiredQty ?? item.quantity ?? 0
                        const receivedQty = item.receivedQuantity ?? item.quantityReceived ?? item.quantity ?? 0
                        const unit = item.unitName || item.unit || item.uom || item.unitOfMeasure || '-'
                        const unitPrice = Number(item.unitPrice ?? item.price ?? item.cost ?? 0)
                        const discountPct = Number(item.discountPercentage ?? item.discount ?? item.discountPercent ?? 0)
                        const taxPct = Number(item.taxPercentage ?? item.taxRate ?? item.tax ?? 0)

                        const gross = receivedQty * unitPrice
                        const discAmt = Number(item.discountAmount ?? ((gross * discountPct) / 100))
                        const taxableAmount = Math.max(0, gross - discAmt)
                        const taxAmount = Number(item.taxAmount ?? item.gstAmount ?? ((taxableAmount * taxPct) / 100))
                        const rawLineTotal = Number(item.lineTotal ?? item.totalAmount ?? 0)
                        const lineTotal = item.lineTotal && Number(item.lineTotal) > 0
                          ? Number(item.lineTotal)
                          : (rawLineTotal > 0 ? rawLineTotal : (taxableAmount + taxAmount))
                        const productName = item.productName || item.product?.name || item.product || item.name || '-'

                        return (
                          <tr
                            key={
                              item.goodsReceiptItemId ||
                              item.id ||
                              item.purchaseOrderItemId ||
                              `${item.productId || 'item'}-${idx}`
                            }
                            style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? '#ffffff' : '#fbfcfd' }}
                          >
                            <td style={{ padding: '10px 10px', textAlign: 'center', color: '#64748b', fontWeight: 600 }}>{idx + 1}</td>
                            <td style={{ padding: '10px 12px', minWidth: '300px' }}>
                              <strong
                                style={{
                                  display: 'block',
                                  whiteSpace: 'normal',
                                  wordBreak: 'break-word',
                                  lineHeight: '1.35',
                                  color: '#0f172a',
                                  fontWeight: 650,
                                }}
                                title={productName}
                              >
                                {productName}
                              </strong>
                            </td>
                            <td style={{ padding: '10px 10px', textAlign: 'center', color: '#64748b' }}>{item.variantName || item.variant || item.productVariantName || '-'}</td>
                            <td style={{ textAlign: 'right', padding: '10px 12px', color: '#334155' }}>{orderedQty}</td>
                            <td style={{ textAlign: 'right', padding: '10px 12px', color: '#0f172a', fontWeight: 700 }}>{receivedQty}</td>
                            <td style={{ padding: '10px 10px', textAlign: 'center', color: '#64748b' }}>{unit}</td>
                            <td style={{ textAlign: 'right', padding: '10px 12px', color: '#334155' }}>{formatCurrency(unitPrice)}</td>
                            <td style={{ textAlign: 'right', padding: '10px 12px', color: discountPct > 0 ? '#dc2626' : '#64748b' }}>{discountPct > 0 ? `${discountPct}%` : '—'}</td>
                            <td style={{ textAlign: 'right', padding: '10px 12px', color: '#64748b' }}>{taxPct > 0 ? `${taxPct}%` : '—'}</td>
                            <td style={{ textAlign: 'right', padding: '10px 12px', color: '#0f172a' }}><strong>{formatCurrency(lineTotal)}</strong></td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="goods-receipt-details__summary" style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '290px', padding: '5px 0', fontSize: '13px' }}>
                  <span style={{ color: '#475569', fontWeight: 600 }}>Subtotal:</span>
                  <strong style={{ color: '#0f172a', fontWeight: 700, textAlign: 'right' }}>{formatCurrency(viewingRecordTotals.subtotal)}</strong>
                </div>
                {viewingRecordTotals.totalDiscount > 0 ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '290px', padding: '5px 0', fontSize: '13px' }}>
                    <span style={{ color: '#475569', fontWeight: 600 }}>Total Discount:</span>
                    <strong style={{ color: '#dc2626', fontWeight: 700, textAlign: 'right' }}>-{formatCurrency(viewingRecordTotals.totalDiscount)}</strong>
                  </div>
                ) : null}
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '290px', padding: '5px 0', fontSize: '13px' }}>
                  <span style={{ color: '#475569', fontWeight: 600 }}>Tax Total:</span>
                  <strong style={{ color: '#6c5ce7', fontWeight: 700, textAlign: 'right' }}>+{formatCurrency(viewingRecordTotals.totalTax)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '290px', borderTop: '2px solid #e2e8f0', paddingTop: '10px', marginTop: '4px', fontSize: '15px' }}>
                  <strong style={{ color: '#0f172a', fontWeight: 750 }}>Grand Total:</strong>
                  <strong style={{ color: '#5a49d6', fontSize: '16px', fontWeight: 800, textAlign: 'right' }}>{formatCurrency(viewingRecordTotals.grandTotal)}</strong>
                </div>
              </div>
            </section>

            <div className="button-row goods-receipt-details__footer">
              <button
                type="button"
                className="button button-secondary"
                onClick={() => handlePrintGoodsReceipt(viewingRecord, referenceData, viewingPoItems)}
              >
                <Printer size={16} /> Print
              </button>
              <button type="button" className="button button-primary" onClick={closeView}>
                Close
              </button>
            </div>
          </div>
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

export default function GoodsReceipts() {
  const resourceKey = 'goodsReceipts';
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
