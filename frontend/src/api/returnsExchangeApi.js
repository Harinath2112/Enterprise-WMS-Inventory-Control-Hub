import {
  apiRequest,
  buildApiHeaders,
  buildUrl,
  getResponseData,
  getResponseList,
  resolveApiAssetUrl,
} from './apiClient'
import { API_ENDPOINTS } from './endpoints'
import { toDateInputValue } from '../utils/dateUtils'

function firstValue(source, keys, fallback = undefined) {
  if (!source || typeof source !== 'object') return fallback

  for (const key of keys) {
    const value = source[key]
    if (value !== undefined && value !== null) return value
  }

  return fallback
}

function idValue(source, keys) {
  const value = firstValue(source, keys, '')
  return value === '' ? '' : String(value)
}

function textValue(value, fallback = '') {
  const normalized = String(value ?? '').trim()
  return normalized || fallback
}

function numberValue(value, fallback = 0) {
  const normalized = Number(value)
  return Number.isFinite(normalized) ? normalized : fallback
}

function dateOnly(value) {
  return toDateInputValue(value)
}

function titleCaseStatus(value, fallback) {
  const normalized = textValue(value, fallback).replace(/[_-]+/g, ' ')
  return normalized.replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function numericId(value, fieldName) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${fieldName} must be a valid positive integer.`)
  }
  return parsed
}

function optionalNumericId(value) {
  if (value === undefined || value === null || value === '') return null
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function referenceFromId(prefix, id) {
  return id ? `${prefix}-${String(id).padStart(3, '0')}` : ''
}

function normalizeMutationError(error) {
  return {
    success: false,
    data: null,
    error: error instanceof Error ? error.message : 'The request could not be completed.',
    message: null,
    status: 0,
  }
}


function objectValue(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null
}

function entityText(value) {
  if (value === undefined || value === null) return ''
  if (typeof value === 'string' || typeof value === 'number') return textValue(value)

  const source = objectValue(value)
  if (!source) return ''

  return textValue(firstValue(source, [
    'name', 'Name',
    'customerName', 'CustomerName',
    'productName', 'ProductName',
    'displayName', 'DisplayName',
    'title', 'Title',
  ]))
}

function firstArray(sources, keys) {
  for (const source of sources) {
    if (!source || typeof source !== 'object') continue
    for (const key of keys) {
      if (Array.isArray(source[key])) return source[key]
    }
  }
  return []
}

function meaningfulText(detailValue, summaryValue) {
  return textValue(detailValue) || textValue(summaryValue)
}

function meaningfulId(detailValue, summaryValue) {
  return textValue(detailValue) || textValue(summaryValue)
}

function meaningfulPositiveNumber(detailValue, summaryValue) {
  const detailNumber = numberValue(detailValue)
  if (detailNumber > 0) return detailNumber
  return numberValue(summaryValue)
}

function meaningfulAmount(detailValue, summaryValue) {
  const detailNumber = Number(detailValue)
  const summaryNumber = Number(summaryValue)

  if (Number.isFinite(detailNumber) && (detailNumber !== 0 || !Number.isFinite(summaryNumber) || summaryNumber === 0)) {
    return detailNumber
  }

  return Number.isFinite(summaryNumber) ? summaryNumber : 0
}

export function normalizeExchange(item = {}) {
  const exchangeId = idValue(item, ['exchangeId', 'ExchangeId', 'id', 'Id'])
  const returnId = idValue(item, ['returnId', 'ReturnId'])
  const oldQty = numberValue(firstValue(item, ['oldQty', 'OldQty']))
  const newQty = numberValue(firstValue(item, ['newQty', 'NewQty']))
  const oldProductValue = numberValue(firstValue(item, ['oldProductValue', 'OldProductValue', 'oldValue']))
  const newProductValue = numberValue(firstValue(item, ['newProductValue', 'NewProductValue', 'newValue', 'newPrice']))

  return {
    ...item,
    id: exchangeId,
    exchangeId,
    returnId,
    returnReference: textValue(
      firstValue(item, ['returnReference', 'ReturnReference', 'returnNumber', 'ReturnNumber']),
      referenceFromId('RET', returnId),
    ),
    customerId: idValue(item, ['customerId', 'CustomerId']),
    customer: textValue(firstValue(item, [
      'customerName',
      'CustomerName',
      'customer',
      'Customer',
    ])?.name ?? firstValue(item, ['customerName', 'CustomerName', 'customer', 'Customer'])),
    oldProductId: idValue(item, ['oldProductId', 'OldProductId']),
    oldProduct: textValue(firstValue(item, [
      'oldProductName',
      'OldProductName',
      'oldProduct',
      'OldProduct',
    ])?.name ?? firstValue(item, ['oldProductName', 'OldProductName', 'oldProduct', 'OldProduct'])),
    oldQty,
    oldProductValue,
    oldValue: oldProductValue,
    oldStatus: textValue(firstValue(item, ['oldStatus', 'OldStatus']), 'Returned'),
    newProductId: idValue(item, ['newProductId', 'NewProductId']),
    newProduct: textValue(firstValue(item, [
      'newProductName',
      'NewProductName',
      'newProduct',
      'NewProduct',
    ])?.name ?? firstValue(item, ['newProductName', 'NewProductName', 'newProduct', 'NewProduct'])),
    newQty,
    newProductValue,
    newPrice: newQty > 0 ? newProductValue / newQty : newProductValue,
    differenceAmount: numberValue(firstValue(item, ['differenceAmount', 'DifferenceAmount'])),
    settlementType: textValue(firstValue(item, ['settlementType', 'SettlementType']), 'None'),
    settlementAmount: numberValue(firstValue(item, ['settlementAmount', 'SettlementAmount'])),
    status: titleCaseStatus(firstValue(item, ['status', 'Status']), 'Pending'),
    createdDate: dateOnly(firstValue(item, ['createdAt', 'CreatedAt', 'createdDate', 'CreatedDate'])),
  }
}

export function normalizeDamage(item = {}) {
  const damageId = idValue(item, ['damageId', 'DamageId', 'id', 'Id'])
  const returnId = idValue(item, ['returnId', 'ReturnId'])
  const product = firstValue(item, ['product', 'Product'])

  return {
    ...item,
    id: damageId,
    damageId,
    returnId,
    returnReference: textValue(
      firstValue(item, ['returnReference', 'ReturnReference', 'returnNumber', 'ReturnNumber']),
      referenceFromId('RET', returnId),
    ),
    inspectionId: idValue(item, ['inspectionId', 'InspectionId']),
    productId: idValue(item, ['productId', 'ProductId']),
    product: textValue(
      firstValue(item, ['productName', 'ProductName']) ?? product?.name ?? product?.Name,
    ),
    sku: textValue(firstValue(item, ['sku', 'SKU', 'Sku']) ?? product?.sku ?? product?.SKU),
    damageType: textValue(firstValue(item, ['damageType', 'DamageType'])),
    severity: titleCaseStatus(firstValue(item, ['severity', 'Severity']), 'Minor'),
    action: textValue(firstValue(item, ['actionTaken', 'ActionTaken', 'action', 'Action']), 'Repair'),
    actionTaken: textValue(firstValue(item, ['actionTaken', 'ActionTaken', 'action', 'Action']), 'Repair'),
    assessedBy: textValue(firstValue(item, ['assessedBy', 'AssessedBy']), 'Quality Inspector'),
    remarks: textValue(firstValue(item, ['remarks', 'Remarks'])),
    date: dateOnly(firstValue(item, ['createdAt', 'CreatedAt', 'date', 'Date'])),
  }
}

export function normalizeDamageInventory(item = {}) {
  const product = firstValue(item, ['product', 'Product'])
  const warehouse = firstValue(item, ['warehouse', 'Warehouse'])
  const productId = idValue(item, ['productId', 'ProductId'])
  const warehouseId = idValue(item, ['warehouseId', 'WarehouseId'])
  const productName = entityText(firstValue(item, ['productName', 'ProductName'])) || entityText(product)
  const sku = textValue(firstValue(item, ['sku', 'SKU', 'Sku']) ?? product?.sku ?? product?.SKU)
  const warehouseName = entityText(firstValue(item, ['warehouseName', 'WarehouseName'])) || entityText(warehouse)
  const inventoryId = idValue(item, ['damageInventoryId', 'DamageInventoryId', 'id', 'Id'])
    || [productId || sku || productName, warehouseId || warehouseName].filter(Boolean).join('-')

  return {
    ...item,
    id: inventoryId,
    productId,
    product: productName,
    sku,
    warehouseId,
    warehouse: warehouseName,
    availableStock: numberValue(firstValue(item, ['availableStock', 'AvailableStock'])),
    damageStock: numberValue(firstValue(item, ['damageStock', 'DamageStock', 'damagedStock', 'DamagedStock'])),
    repairStock: numberValue(firstValue(item, ['repairStock', 'RepairStock'])),
    scrapStock: numberValue(firstValue(item, ['scrapStock', 'ScrapStock'])),
    stockValue: numberValue(firstValue(item, ['stockValue', 'StockValue'])),
  }
}

export function normalizeCreditNote(item = {}) {
  const creditNoteId = idValue(item, ['creditNoteId', 'CreditNoteId', 'id', 'Id'])
  const returnId = idValue(item, ['returnId', 'ReturnId'])
  const amount = numberValue(firstValue(item, ['amount', 'Amount']))
  const usedAmount = numberValue(firstValue(item, ['usedAmount', 'UsedAmount']))
  const explicitRemaining = firstValue(item, ['remainingAmount', 'RemainingAmount'])
  const remainingAmount = explicitRemaining === undefined
    ? Math.max(amount - usedAmount, 0)
    : numberValue(explicitRemaining)

  return {
    ...item,
    id: creditNoteId,
    creditNoteId,
    creditNoteNumber: textValue(
      firstValue(item, ['creditNoteNumber', 'CreditNoteNumber']),
      referenceFromId('CN', creditNoteId),
    ),
    returnId,
    returnReference: textValue(
      firstValue(item, ['returnReference', 'ReturnReference', 'returnNumber', 'ReturnNumber']),
      referenceFromId('RET', returnId),
    ),
    customerId: idValue(item, ['customerId', 'CustomerId']),
    customer: textValue(firstValue(item, [
      'customerName',
      'CustomerName',
      'customer',
      'Customer',
    ])?.name ?? firstValue(item, ['customerName', 'CustomerName', 'customer', 'Customer'])),
    amount,
    usedAmount,
    remainingAmount,
    status: titleCaseStatus(
      firstValue(item, ['status', 'Status']),
      remainingAmount <= 0 && amount > 0 ? 'Used' : usedAmount > 0 ? 'Partially Used' : 'Active',
    ),
    createdDate: dateOnly(firstValue(item, ['createdAt', 'CreatedAt', 'createdDate', 'CreatedDate'])),
  }
}

export function normalizeRefund(item = {}) {
  const refundId = idValue(item, ['refundId', 'RefundId', 'id', 'Id'])
  const returnId = idValue(item, ['returnId', 'ReturnId'])

  return {
    ...item,
    id: refundId,
    refundId,
    returnId,
    returnReference: textValue(
      firstValue(item, ['returnReference', 'ReturnReference', 'returnNumber', 'ReturnNumber']),
      referenceFromId('RET', returnId),
    ),
    customerId: idValue(item, ['customerId', 'CustomerId']),
    customer: textValue(firstValue(item, [
      'customerName',
      'CustomerName',
      'customer',
      'Customer',
    ])?.name ?? firstValue(item, ['customerName', 'CustomerName', 'customer', 'Customer'])),
    referenceNumber: textValue(firstValue(item, ['refundReference', 'RefundReference', 'referenceNumber', 'ReferenceNumber'])),
    refundReference: textValue(firstValue(item, ['refundReference', 'RefundReference', 'referenceNumber', 'ReferenceNumber'])),
    method: textValue(firstValue(item, ['refundMethod', 'RefundMethod', 'method', 'Method']), 'Bank Transfer'),
    refundMethod: textValue(firstValue(item, ['refundMethod', 'RefundMethod', 'method', 'Method']), 'Bank Transfer'),
    refundDate: dateOnly(firstValue(item, ['refundDate', 'RefundDate'])),
    amount: numberValue(firstValue(item, ['amount', 'Amount'])),
    status: titleCaseStatus(firstValue(item, ['status', 'Status']), 'Pending'),
  }
}

function mapListResponse(response, normalizer) {
  if (!response.success) return response
  return { ...response, data: getResponseList(response).map(normalizer) }
}

function mapItemResponse(response, normalizer) {
  if (!response.success) return response
  return { ...response, data: normalizer(getResponseData(response, {})) }
}

function toExchangeDto(data) {
  return {
    returnId: numericId(data.returnId, 'Return'),
    customerId: numericId(data.customerId, 'Customer'),
    oldProductId: numericId(data.oldProductId, 'Old product'),
    oldQty: numberValue(data.oldQty),
    newProductId: numericId(data.newProductId, 'New product'),
    newQty: numberValue(data.newQty),
    oldProductValue: numberValue(data.oldProductValue ?? data.oldValue),
    newProductValue: numberValue(data.newProductValue),
    differenceAmount: numberValue(data.differenceAmount),
    settlementType: textValue(data.settlementType, 'None'),
    settlementAmount: numberValue(data.settlementAmount),
    status: textValue(data.status, 'Pending'),
  }
}

function toDamageDto(data) {
  return {
    returnId: numericId(data.returnId, 'Return'),
    inspectionId: optionalNumericId(data.inspectionId),
    productId: numericId(data.productId, 'Product'),
    sku: textValue(data.sku),
    damageType: textValue(data.damageType),
    severity: textValue(data.severity, 'Minor'),
    actionTaken: textValue(data.actionTaken ?? data.action, 'Repair'),
    assessedBy: textValue(data.assessedBy, 'Quality Inspector'),
    remarks: textValue(data.remarks),
  }
}

function toCreditNoteDto(data) {
  return {
    returnId: numericId(data.returnId, 'Return'),
    customerId: numericId(data.customerId, 'Customer'),
    creditNoteNumber: textValue(data.creditNoteNumber),
    amount: numberValue(data.amount),
  }
}

function toRefundDto(data) {
  return {
    returnId: numericId(data.returnId, 'Return'),
    customerId: numericId(data.customerId, 'Customer'),
    refundReference: textValue(data.refundReference ?? data.referenceNumber),
    refundMethod: textValue(data.refundMethod ?? data.method, 'Bank Transfer'),
    refundDate: data.refundDate,
    amount: numberValue(data.amount),
    status: textValue(data.status, 'Pending'),
  }
}

async function safeMutation(factory) {
  try {
    return await factory()
  } catch (error) {
    return normalizeMutationError(error)
  }
}

export async function getExchanges() {
  return mapListResponse(await apiRequest(API_ENDPOINTS.exchanges.list), normalizeExchange)
}

export async function getExchange(id) {
  return mapItemResponse(await apiRequest(API_ENDPOINTS.exchanges.byId(id)), normalizeExchange)
}

export function createExchange(data) {
  return safeMutation(() => apiRequest(API_ENDPOINTS.exchanges.list, {
    method: 'POST',
    body: toExchangeDto(data),
  }))
}

export function updateExchange(id, data) {
  return safeMutation(() => apiRequest(API_ENDPOINTS.exchanges.byId(id), {
    method: 'PUT',
    body: toExchangeDto(data),
  }))
}

export function deleteExchange(id) {
  return apiRequest(API_ENDPOINTS.exchanges.byId(id), { method: 'DELETE' })
}

export function updateExchangeStatus(id, status) {
  return apiRequest(API_ENDPOINTS.exchanges.status(id), {
    method: 'PUT',
    query: { status },
  })
}

export function moveExchangeNext(id) {
  return apiRequest(API_ENDPOINTS.exchanges.moveNext(id), { method: 'POST' })
}

export async function getDamages() {
  return mapListResponse(await apiRequest(API_ENDPOINTS.damages.list), normalizeDamage)
}

export async function getDamage(id) {
  return mapItemResponse(await apiRequest(API_ENDPOINTS.damages.byId(id)), normalizeDamage)
}

export function createDamage(data) {
  return safeMutation(() => apiRequest(API_ENDPOINTS.damages.list, {
    method: 'POST',
    body: toDamageDto(data),
  }))
}

export function updateDamage(id, data) {
  return safeMutation(() => apiRequest(API_ENDPOINTS.damages.byId(id), {
    method: 'PUT',
    body: toDamageDto(data),
  }))
}

export function deleteDamage(id) {
  return apiRequest(API_ENDPOINTS.damages.byId(id), { method: 'DELETE' })
}

export async function getDamageInventory() {
  const response = await apiRequest(API_ENDPOINTS.damageInventory.list)
  if (!response.success) return response

  const rows = getResponseList(response)
  const hasInventoryShape = rows.some((item) => [
    'availableStock', 'AvailableStock',
    'damageStock', 'DamageStock', 'damagedStock', 'DamagedStock',
    'repairStock', 'RepairStock',
    'scrapStock', 'ScrapStock',
    'stockValue', 'StockValue',
  ].some((key) => item?.[key] !== undefined && item?.[key] !== null))

  if (rows.length && !hasInventoryShape) {
    return {
      ...response,
      success: false,
      data: null,
      error: 'The DamageInventory API is returning damage-assessment records instead of inventory stock fields. The backend response must include availableStock, damageStock, repairStock, scrapStock, and stockValue.',
    }
  }

  return { ...response, data: rows.map(normalizeDamageInventory) }
}

export async function getCreditNotes() {
  return mapListResponse(await apiRequest(API_ENDPOINTS.creditNotes.list), normalizeCreditNote)
}

export async function getCreditNote(id) {
  return mapItemResponse(await apiRequest(API_ENDPOINTS.creditNotes.byId(id)), normalizeCreditNote)
}

export function createCreditNote(data) {
  return safeMutation(() => apiRequest(API_ENDPOINTS.creditNotes.list, {
    method: 'POST',
    body: toCreditNoteDto(data),
  }))
}

export function updateCreditNote(id, data) {
  return safeMutation(() => apiRequest(API_ENDPOINTS.creditNotes.byId(id), {
    method: 'PUT',
    body: toCreditNoteDto(data),
  }))
}

export function consumeCreditNote(id, amount) {
  return safeMutation(() => apiRequest(API_ENDPOINTS.creditNotes.consume(id), {
    method: 'POST',
    body: { amount: positiveNumber(amount, 'Credit amount') },
  }))
}

export function deleteCreditNote(id) {
  return apiRequest(API_ENDPOINTS.creditNotes.byId(id), { method: 'DELETE' })
}

export async function getRefunds() {
  return mapListResponse(await apiRequest(API_ENDPOINTS.refunds.list), normalizeRefund)
}

export async function getRefund(id) {
  return mapItemResponse(await apiRequest(API_ENDPOINTS.refunds.byId(id)), normalizeRefund)
}

export function createRefund(data) {
  return safeMutation(() => apiRequest(API_ENDPOINTS.refunds.list, {
    method: 'POST',
    body: toRefundDto(data),
  }))
}

export function updateRefund(id, data) {
  return safeMutation(() => apiRequest(API_ENDPOINTS.refunds.byId(id), {
    method: 'PUT',
    body: toRefundDto(data),
  }))
}

export function deleteRefund(id) {
  return apiRequest(API_ENDPOINTS.refunds.byId(id), { method: 'DELETE' })
}


export function normalizeReturnAttachment(item = {}) {
  const attachmentId = idValue(item, ['attachmentId', 'AttachmentId', 'id', 'Id'])
  const returnId = idValue(item, ['returnId', 'ReturnId'])

  return {
    ...item,
    id: attachmentId,
    attachmentId,
    returnId,
    attachmentType: textValue(firstValue(item, [
      'attachmentType', 'AttachmentType', 'type', 'Type', 'category', 'Category',
    ])),
    fileName: textValue(firstValue(item, [
      'fileName', 'FileName', 'originalFileName', 'OriginalFileName', 'name', 'Name',
    ])),
    fileUrl: textValue(firstValue(item, [
      'fileUrl', 'FileUrl', 'url', 'Url', 'filePath', 'FilePath', 'path', 'Path',
    ])),
    contentType: textValue(firstValue(item, ['contentType', 'ContentType', 'mimeType', 'MimeType'])),
    description: textValue(firstValue(item, ['description', 'Description', 'remarks', 'Remarks'])),
    size: numberValue(firstValue(item, ['size', 'Size', 'fileSize', 'FileSize'])),
    uploadedAt: dateOnly(firstValue(item, ['uploadedAt', 'UploadedAt', 'createdAt', 'CreatedAt'])),
  }
}

function normalizeReturnLine(line = {}, returnId = '', index = 0) {
  const product = firstValue(line, ['product', 'Product'])
  const productObject = objectValue(product)
  const lineQuantity = numberValue(firstValue(line, [
    'quantity', 'Quantity',
    'returnQuantity', 'ReturnQuantity',
    'returnedQuantity', 'ReturnedQuantity',
    'returnQty', 'ReturnQty',
    'returnedQty', 'ReturnedQty',
    'qty', 'Qty',
  ]))
  const linePrice = numberValue(firstValue(line, [
    'price', 'Price', 'unitPrice', 'UnitPrice', 'salePrice', 'SalePrice',
  ]))

  return {
    ...line,
    id: idValue(line, [
      'returnItemId', 'ReturnItemId', 'salesReturnItemId', 'SalesReturnItemId', 'id', 'Id',
    ]) || `${returnId}-item-${index}`,
    productId: idValue(line, ['productId', 'ProductId'])
      || idValue(productObject, ['productId', 'ProductId', 'id', 'Id']),
    productName: textValue(
      firstValue(line, [
        'productName', 'ProductName',
        'itemName', 'ItemName',
        'name', 'Name',
      ]) ?? entityText(product),
    ),
    productSku: textValue(firstValue(line, [
      'productSku', 'ProductSku', 'sku', 'Sku', 'SKU', 'productCode', 'ProductCode',
    ]) ?? firstValue(productObject, ['sku', 'Sku', 'SKU'])),
    unitId: idValue(line, ['unitId', 'UnitId'])
      || idValue(productObject, ['unitId', 'UnitId']),
    unitName: textValue(firstValue(line, [
      'unit', 'Unit', 'unitName', 'UnitName', 'uom', 'Uom', 'UOM',
    ]) ?? firstValue(productObject, ['unit', 'Unit', 'unitName', 'UnitName', 'uom', 'Uom', 'UOM'])),
    unit: textValue(firstValue(line, [
      'unit', 'Unit', 'unitName', 'UnitName', 'uom', 'Uom', 'UOM',
    ]) ?? firstValue(productObject, ['unit', 'Unit', 'unitName', 'UnitName', 'uom', 'Uom', 'UOM'])),
    variantId: idValue(line, ['variantId', 'VariantId'])
      || idValue(productObject, ['variantId', 'VariantId']),
    quantity: lineQuantity,
    price: linePrice,
    total: numberValue(
      firstValue(line, ['total', 'Total', 'lineTotal', 'LineTotal', 'amount', 'Amount']),
      lineQuantity * linePrice,
    ),
    returnedQuantity: numberValue(firstValue(line, ['returnedQuantity', 'ReturnedQuantity'])),
  }
}

function normalizeInvoiceLines(payload = {}) {
  const source = getResponseData({ data: payload }, payload) || payload
  const invoice = firstValue(source, ['invoice', 'Invoice'], source) || source
  const rawItems = firstArray([source, invoice], [
    'items', 'Items',
    'invoiceItems', 'InvoiceItems',
    'lines', 'Lines',
    'details', 'Details',
    'invoiceDetails', 'InvoiceDetails',
  ])

  return rawItems.map((line, index) => normalizeReturnLine(line, '', index))
}

export function normalizeSalesReturn(item = {}) {
  const root = objectValue(item) || {}
  const nestedSource = firstValue(root, [
    'return', 'Return', 'salesReturn', 'SalesReturn', 'returnDetails', 'ReturnDetails',
  ])
  const source = objectValue(nestedSource) || root
  const returnId = idValue(source, ['returnId', 'ReturnId', 'id', 'Id'])
  const invoiceId = idValue(source, ['invoiceId', 'InvoiceId'])
  const customerSource = firstValue(source, ['customer', 'Customer'])
  const productSource = firstValue(source, ['product', 'Product'])
  const quantity = numberValue(firstValue(source, [
    'quantity', 'Quantity', 'returnQuantity', 'ReturnQuantity', 'qty', 'Qty',
  ]))
  const price = numberValue(firstValue(source, [
    'price', 'Price', 'unitPrice', 'UnitPrice', 'salePrice', 'SalePrice',
  ]))

  const itemCollections = firstArray([root, source], [
    'items', 'Items',
    'returnItems', 'ReturnItems',
    'returnItemDetails', 'ReturnItemDetails',
    'salesReturnItems', 'SalesReturnItems',
    'salesReturnDetails', 'SalesReturnDetails',
    'lines', 'Lines',
    'lineItems', 'LineItems',
    'itemDetails', 'ItemDetails',
    'details', 'Details',
    'returnDetails', 'ReturnDetails',
    'productDetails', 'ProductDetails',
  ])
  const singleItem = objectValue(firstValue(root, [
    'returnItem', 'ReturnItem',
    'salesReturnItem', 'SalesReturnItem',
    'item', 'Item',
    'lineItem', 'LineItem',
    'productDetail', 'ProductDetail',
  ])) || objectValue(firstValue(source, [
    'returnItem', 'ReturnItem',
    'salesReturnItem', 'SalesReturnItem',
    'item', 'Item',
    'lineItem', 'LineItem',
    'productDetail', 'ProductDetail',
  ]))
  const rawItems = itemCollections.length ? itemCollections : singleItem ? [singleItem] : []
  const rawHistory = firstArray([root, source], ['history', 'History', 'statusHistory', 'StatusHistory'])
  const rawRefunds = firstArray([root, source], ['refunds', 'Refunds', 'refundTransactions', 'RefundTransactions'])
  const rawAdjustments = firstArray([root, source], ['adjustments', 'Adjustments'])
  const rawAttachments = firstArray([root, source], ['attachments', 'Attachments', 'returnAttachments', 'ReturnAttachments'])

  const items = rawItems.length
    ? rawItems.map((line, index) => normalizeReturnLine(line, returnId, index))
    : idValue(source, ['productId', 'ProductId'])
      ? [normalizeReturnLine({
        productId: idValue(source, ['productId', 'ProductId']),
        productName: firstValue(source, ['productName', 'ProductName']) ?? entityText(productSource),
        productSku: firstValue(source, ['productSku', 'ProductSku', 'sku', 'Sku', 'SKU']),
        unitId: idValue(source, ['unitId', 'UnitId'])
          || idValue(objectValue(productSource), ['unitId', 'UnitId']),
        unitName: firstValue(source, ['unitName', 'UnitName', 'unit', 'Unit', 'uom', 'Uom', 'UOM'])
          ?? firstValue(objectValue(productSource), ['unitName', 'UnitName', 'unit', 'Unit', 'uom', 'Uom', 'UOM']),
        variantId: idValue(source, ['variantId', 'VariantId']),
        quantity,
        price,
        total: quantity * price,
      }, returnId, 0)]
      : []

  const history = rawHistory.map((entry, index) => ({
    ...entry,
    id: idValue(entry, ['historyId', 'HistoryId', 'id', 'Id']) || `${returnId}-history-${index}`,
    oldStatus: titleCaseStatus(firstValue(entry, ['oldStatus', 'OldStatus']), ''),
    newStatus: titleCaseStatus(firstValue(entry, ['newStatus', 'NewStatus']), ''),
    action: textValue(firstValue(entry, ['action', 'Action'])),
    actor: textValue(firstValue(entry, ['actor', 'Actor', 'createdBy', 'CreatedBy'])),
    comments: textValue(firstValue(entry, ['comments', 'Comments', 'remarks', 'Remarks'])),
    createdAt: dateOnly(firstValue(entry, ['createdAt', 'CreatedAt'])),
  }))

  const refunds = rawRefunds.map((refund, index) => ({
    ...refund,
    id: idValue(refund, ['refundId', 'RefundId', 'id', 'Id']) || `${returnId}-refund-${index}`,
    refundId: idValue(refund, ['refundId', 'RefundId', 'id', 'Id']),
    refundAmount: numberValue(firstValue(refund, ['refundAmount', 'RefundAmount', 'amount', 'Amount'])),
    amount: numberValue(firstValue(refund, ['amount', 'Amount', 'refundAmount', 'RefundAmount'])),
    refundMethod: textValue(firstValue(refund, ['refundMethod', 'RefundMethod', 'method', 'Method'])),
    refundDate: dateOnly(firstValue(refund, ['refundDate', 'RefundDate', 'createdAt', 'CreatedAt'])),
    status: titleCaseStatus(firstValue(refund, ['status', 'Status']), 'Completed'),
    notes: textValue(firstValue(refund, ['notes', 'Notes', 'remarks', 'Remarks'])),
  }))

  const adjustments = rawAdjustments.map((adjustment, index) => ({
    ...adjustment,
    id: idValue(adjustment, ['adjustmentId', 'AdjustmentId', 'id', 'Id']) || `${returnId}-adjustment-${index}`,
    adjustmentType: textValue(firstValue(adjustment, ['adjustmentType', 'AdjustmentType'])),
    amount: numberValue(firstValue(adjustment, ['amount', 'Amount'])),
    status: titleCaseStatus(firstValue(adjustment, ['status', 'Status']), 'Completed'),
    notes: textValue(firstValue(adjustment, ['notes', 'Notes'])),
    createdAt: dateOnly(firstValue(adjustment, ['createdAt', 'CreatedAt'])),
  }))

  const itemCount = numberValue(firstValue(source, ['itemCount', 'ItemCount']), items.length)

  return {
    ...source,
    id: returnId,
    returnId,
    returnNumber: textValue(
      firstValue(source, ['returnNumber', 'ReturnNumber', 'returnReference', 'ReturnReference']),
      referenceFromId('RET', returnId),
    ),
    invoiceId,
    invoiceNumber: textValue(firstValue(source, ['invoiceNumber', 'InvoiceNumber']), invoiceId ? `INV-${invoiceId}` : ''),
    customerId: idValue(source, ['customerId', 'CustomerId']),
    customer: textValue(
      firstValue(source, ['customerName', 'CustomerName']) ?? entityText(customerSource),
    ),
    productId: idValue(source, ['productId', 'ProductId']) || items[0]?.productId || '',
    productName: textValue(
      firstValue(source, ['productName', 'ProductName']) ?? entityText(productSource) ?? items[0]?.productName,
    ) || textValue(items[0]?.productName),
    productSku: textValue(
      firstValue(source, ['productSku', 'ProductSku', 'sku', 'Sku', 'SKU']) ?? items[0]?.productSku,
    ),
    unitId: idValue(source, ['unitId', 'UnitId']) || items[0]?.unitId || '',
    unitName: textValue(
      firstValue(source, ['unitName', 'UnitName', 'unit', 'Unit', 'uom', 'Uom', 'UOM'])
        ?? items[0]?.unitName
        ?? items[0]?.unit,
    ),
    unit: textValue(
      firstValue(source, ['unit', 'Unit', 'unitName', 'UnitName', 'uom', 'Uom', 'UOM'])
        ?? items[0]?.unit
        ?? items[0]?.unitName,
    ),
    variantId: idValue(source, ['variantId', 'VariantId']) || items[0]?.variantId || '',
    quantity: quantity || numberValue(items[0]?.quantity),
    price: price || numberValue(items[0]?.price),
    totalAmount: numberValue(
      firstValue(source, ['totalAmount', 'TotalAmount', 'returnValue', 'ReturnValue', 'amount', 'Amount']),
      items.reduce((sum, line) => sum + numberValue(line.total), 0),
    ),
    returnDate: dateOnly(firstValue(source, ['returnDate', 'ReturnDate'])),
    reason: textValue(firstValue(source, ['reason', 'Reason', 'returnReason', 'ReturnReason'])),
    status: titleCaseStatus(firstValue(source, ['status', 'Status']), ''),
    createdBy: textValue(firstValue(source, ['createdBy', 'CreatedBy'])),
    createdAt: dateOnly(firstValue(source, ['createdAt', 'CreatedAt'])),
    approvedBy: textValue(firstValue(source, ['approvedBy', 'ApprovedBy'])),
    approvedAt: dateOnly(firstValue(source, ['approvedAt', 'ApprovedAt'])),
    rejectedBy: textValue(firstValue(source, ['rejectedBy', 'RejectedBy'])),
    rejectedAt: dateOnly(firstValue(source, ['rejectedAt', 'RejectedAt'])),
    processedBy: textValue(firstValue(source, ['processedBy', 'ProcessedBy'])),
    processedAt: dateOnly(firstValue(source, ['processedAt', 'ProcessedAt'])),
    refundedBy: textValue(firstValue(source, ['refundedBy', 'RefundedBy'])),
    refundedAt: dateOnly(firstValue(source, ['refundedAt', 'RefundedAt'])),
    refundedAmount: numberValue(firstValue(source, ['refundedAmount', 'RefundedAmount'])),
    invoiceAdjustmentAmount: numberValue(firstValue(source, ['invoiceAdjustmentAmount', 'InvoiceAdjustmentAmount'])),
    itemCount,
    items,
    history,
    refunds,
    adjustments,
    attachments: rawAttachments.map(normalizeReturnAttachment),
    productCount: itemCount || items.length,
  }
}

function mergeSalesReturnRecords(summary = {}, detail = {}) {
  const items = detail.items?.length ? detail.items : summary.items || []
  const merged = {
    ...summary,
    ...detail,
    id: meaningfulId(detail.id, summary.id),
    returnId: meaningfulId(detail.returnId, summary.returnId),
    returnNumber: meaningfulText(detail.returnNumber, summary.returnNumber),
    invoiceId: meaningfulId(detail.invoiceId, summary.invoiceId),
    invoiceNumber: meaningfulText(detail.invoiceNumber, summary.invoiceNumber),
    customerId: meaningfulId(detail.customerId, summary.customerId),
    customer: meaningfulText(detail.customer, summary.customer),
    productId: meaningfulId(detail.productId, summary.productId) || items[0]?.productId || '',
    productName: meaningfulText(detail.productName, summary.productName) || items[0]?.productName || '',
    productSku: meaningfulText(detail.productSku, summary.productSku) || items[0]?.productSku || '',
    unitId: meaningfulId(detail.unitId, summary.unitId) || items[0]?.unitId || '',
    unitName: meaningfulText(detail.unitName, summary.unitName) || items[0]?.unitName || items[0]?.unit || '',
    unit: meaningfulText(detail.unit, summary.unit) || items[0]?.unit || items[0]?.unitName || '',
    variantId: meaningfulId(detail.variantId, summary.variantId) || items[0]?.variantId || '',
    quantity: meaningfulPositiveNumber(detail.quantity, summary.quantity) || numberValue(items[0]?.quantity),
    price: meaningfulAmount(detail.price, summary.price) || numberValue(items[0]?.price),
    totalAmount: meaningfulAmount(detail.totalAmount, summary.totalAmount),
    returnDate: meaningfulText(detail.returnDate, summary.returnDate),
    reason: meaningfulText(detail.reason, summary.reason),
    status: meaningfulText(detail.status, summary.status),
    createdBy: meaningfulText(detail.createdBy, summary.createdBy),
    createdAt: meaningfulText(detail.createdAt, summary.createdAt),
    approvedBy: meaningfulText(detail.approvedBy, summary.approvedBy),
    approvedAt: meaningfulText(detail.approvedAt, summary.approvedAt),
    rejectedBy: meaningfulText(detail.rejectedBy, summary.rejectedBy),
    rejectedAt: meaningfulText(detail.rejectedAt, summary.rejectedAt),
    processedBy: meaningfulText(detail.processedBy, summary.processedBy),
    processedAt: meaningfulText(detail.processedAt, summary.processedAt),
    refundedBy: meaningfulText(detail.refundedBy, summary.refundedBy),
    refundedAt: meaningfulText(detail.refundedAt, summary.refundedAt),
    refundedAmount: meaningfulAmount(detail.refundedAmount, summary.refundedAmount),
    invoiceAdjustmentAmount: meaningfulAmount(detail.invoiceAdjustmentAmount, summary.invoiceAdjustmentAmount),
    items,
    itemCount: meaningfulPositiveNumber(detail.itemCount, summary.itemCount) || items.length,
    history: detail.history?.length ? detail.history : summary.history || [],
    refunds: detail.refunds?.length ? detail.refunds : summary.refunds || [],
    adjustments: detail.adjustments?.length ? detail.adjustments : summary.adjustments || [],
    attachments: detail.attachments?.length ? detail.attachments : summary.attachments || [],
  }

  if (!merged.totalAmount && items.length) {
    merged.totalAmount = items.reduce((sum, line) => sum + numberValue(line.total), 0)
  }

  return merged
}

async function enrichSalesReturnFromInvoice(row) {
  if (!row?.invoiceId) return row

  const invoiceResponse = await apiRequest(API_ENDPOINTS.invoices.byId(row.invoiceId))
  if (!invoiceResponse.success) return row

  const invoicePayload = getResponseData(invoiceResponse, {})
  const invoiceLines = normalizeInvoiceLines(invoicePayload)
  if (!invoiceLines.length) return row

  const returnLine = row.items?.[0] || null
  let matchedLine = null
  if (row.productId) {
    matchedLine = invoiceLines.find((line) => String(line.productId) === String(row.productId))
  }
  if (!matchedLine && returnLine?.productId) {
    matchedLine = invoiceLines.find((line) => String(line.productId) === String(returnLine.productId))
  }
  if (!matchedLine && (returnLine?.productName || row.productName)) {
    const productName = textValue(returnLine?.productName || row.productName).toLowerCase()
    matchedLine = invoiceLines.find(
      (line) => textValue(line.productName).toLowerCase() === productName,
    )
  }
  if (!matchedLine && invoiceLines.length === 1) matchedLine = invoiceLines[0]
  if (!matchedLine) return row

  const returnedQuantity = numberValue(returnLine?.quantity ?? row.quantity)
  const returnedPrice = numberValue(returnLine?.price ?? row.price, matchedLine.price)
  const inferredReturnedQuantity = returnedQuantity > 0
    ? returnedQuantity
    : returnedPrice > 0 && numberValue(row.totalAmount) > 0
      ? numberValue(row.totalAmount) / returnedPrice
      : 0
  const enrichedLine = {
    ...matchedLine,
    ...returnLine,
    productId: returnLine?.productId || row.productId || matchedLine.productId,
    productName: returnLine?.productName || row.productName || matchedLine.productName,
    productSku: returnLine?.productSku || matchedLine.productSku,
    unitId: returnLine?.unitId || matchedLine.unitId,
    unitName: returnLine?.unitName || returnLine?.unit || matchedLine.unitName || matchedLine.unit,
    unit: returnLine?.unit || matchedLine.unit,
    quantity: inferredReturnedQuantity,
    price: returnedPrice,
    total: numberValue(returnLine?.total, inferredReturnedQuantity * returnedPrice),
    invoiceQuantity: numberValue(matchedLine.quantity),
    previouslyReturnedQuantity: numberValue(matchedLine.returnedQuantity),
  }

  return mergeSalesReturnRecords(row, {
    productId: enrichedLine.productId,
    productName: enrichedLine.productName,
    variantId: enrichedLine.variantId,
    quantity: enrichedLine.quantity,
    price: enrichedLine.price,
    items: [enrichedLine],
    itemCount: 1,
  })
}

export function normalizeInspection(item = {}) {
  const inspectionId = idValue(item, ['inspectionId', 'InspectionId', 'id', 'Id'])
  const returnId = idValue(item, ['returnId', 'ReturnId'])

  return {
    ...item,
    id: inspectionId,
    inspectionId,
    returnId,
    returnReference: textValue(
      firstValue(item, ['returnReference', 'ReturnReference', 'returnNumber', 'ReturnNumber']),
      referenceFromId('RET', returnId),
    ),
    inspector: textValue(firstValue(item, ['inspectorName', 'InspectorName', 'inspector', 'Inspector'])),
    inspectorName: textValue(firstValue(item, ['inspectorName', 'InspectorName', 'inspector', 'Inspector'])),
    inspectionDate: dateOnly(firstValue(item, ['inspectionDate', 'InspectionDate'])),
    productCondition: textValue(firstValue(item, ['productCondition', 'ProductCondition'])),
    decision: titleCaseStatus(firstValue(item, ['decision', 'Decision']), 'Pending'),
    finalAction: textValue(firstValue(item, ['finalAction', 'FinalAction'])),
    remarks: textValue(firstValue(item, ['remarks', 'Remarks'])),
    photoUrl: resolveApiAssetUrl(
      firstValue(item, ['photoUrl', 'PhotoUrl', 'photoPath', 'PhotoPath']),
    ),
  }
}

function positiveNumber(value, fieldName) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${fieldName} must be greater than zero.`)
  }
  return parsed
}

function nonNegativeNumber(value, fieldName) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${fieldName} cannot be negative.`)
  }
  return parsed
}

function isoDate(value, fieldName) {
  const dateStr = toDateInputValue(value)
  if (!dateStr) {
    throw new Error(`${fieldName} must be a valid date.`)
  }
  return `${dateStr}T00:00:00.000Z`
}

function toSalesReturnDto(data) {
  return {
    invoiceId: optionalNumericId(data.invoiceId),
    customerId: optionalNumericId(data.customerId),
    productId: numericId(data.productId, 'Product'),
    variantId: optionalNumericId(data.variantId),
    quantity: positiveNumber(data.quantity, 'Quantity'),
    price: nonNegativeNumber(data.price, 'Price'),
    returnDate: isoDate(data.returnDate, 'Return date'),
    reason: textValue(data.reason),
  }
}

function toInspectionFormData(data) {
  const payload = new FormData()
  payload.append('ReturnId', String(numericId(data.returnId, 'Return')))
  payload.append('InspectorName', textValue(data.inspectorName ?? data.inspector))
  payload.append('InspectionDate', isoDate(data.inspectionDate, 'Inspection date'))
  payload.append('ProductCondition', textValue(data.productCondition))
  payload.append('Decision', textValue(data.decision))
  payload.append('FinalAction', textValue(data.finalAction))
  payload.append('Remarks', textValue(data.remarks))

  if (data.photo instanceof File) {
    payload.append('Photo', data.photo)
  }

  return payload
}

export async function getSalesReturns(options = {}) {
  const { includeDetails = false, includeInvoiceFallback = false, ...query } = options || {}
  const listResponse = await apiRequest(API_ENDPOINTS.salesReturns.list, { query })

  if (!listResponse.success) return listResponse

  const summaries = getResponseList(listResponse).map(normalizeSalesReturn)
  if (!includeDetails || !summaries.length) {
    return { ...listResponse, data: summaries }
  }

  const detailed = await Promise.all(summaries.map(async (summary) => {
    const id = summary.returnId || summary.id
    if (!id) return summary

    const detailResponse = await apiRequest(API_ENDPOINTS.salesReturns.byId(id))
    let merged = summary

    if (detailResponse.success) {
      const detail = normalizeSalesReturn(getResponseData(detailResponse, {}))
      merged = mergeSalesReturnRecords(summary, detail)
    }

    return includeInvoiceFallback ? enrichSalesReturnFromInvoice(merged) : merged
  }))

  return { ...listResponse, data: detailed }
}

export async function getSalesReturn(id) {
  const detailResponse = await apiRequest(API_ENDPOINTS.salesReturns.byId(id))

  if (!detailResponse.success) return detailResponse

  const detail = normalizeSalesReturn(getResponseData(detailResponse, {}))
  const merged = await enrichSalesReturnFromInvoice(detail)
  return { ...detailResponse, data: merged }
}

export async function getSalesReturnHistory(id) {
  const response = await apiRequest(API_ENDPOINTS.salesReturns.history(id))
  if (!response.success) return response
  return { ...response, data: getResponseList(response) }
}

export async function createSalesReturn(data) {
  const response = await safeMutation(() => apiRequest(API_ENDPOINTS.salesReturns.list, {
    method: 'POST',
    body: toSalesReturnDto(data),
  }))

  if (!response.success || response.data === null || response.data === undefined) return response

  const createdPayload = getResponseData(response, response.data)
  if (typeof createdPayload === 'number' || typeof createdPayload === 'string') {
    const returnId = String(createdPayload)
    return {
      ...response,
      data: {
        id: returnId,
        returnId,
        returnNumber: referenceFromId('RET', returnId),
      },
    }
  }

  return { ...response, data: normalizeSalesReturn(createdPayload) }
}

export function updateSalesReturn(id, data) {
  return safeMutation(() => apiRequest(API_ENDPOINTS.salesReturns.byId(id), {
    method: 'PUT',
    body: toSalesReturnDto(data),
  }))
}

export function deleteSalesReturn(id) {
  return apiRequest(API_ENDPOINTS.salesReturns.byId(id), { method: 'DELETE' })
}

export function approveSalesReturn(id, comments = '') {
  return apiRequest(API_ENDPOINTS.salesReturns.approve(id), {
    method: 'POST',
    body: { comments: textValue(comments) },
  })
}

export function rejectSalesReturn(id, comments = '') {
  return apiRequest(API_ENDPOINTS.salesReturns.reject(id), {
    method: 'POST',
    body: { comments: textValue(comments) },
  })
}

export function processSalesReturn(id, comments = '') {
  return apiRequest(API_ENDPOINTS.salesReturns.process(id), {
    method: 'POST',
    body: { comments: textValue(comments) },
  })
}

export function refundSalesReturn(id, data = {}) {
  return safeMutation(() => apiRequest(API_ENDPOINTS.salesReturns.refund(id), {
    method: 'POST',
    body: {
      refundAmount: positiveNumber(data.refundAmount ?? data.amount, 'Refund amount'),
      refundMethod: textValue(data.refundMethod ?? data.method, 'Bank Transfer'),
      refundDate: data.refundDate ? isoDate(data.refundDate, 'Refund date') : new Date().toISOString(),
      notes: textValue(data.notes),
    },
  }))
}

export async function getReturnAttachments(returnId) {
  return mapListResponse(
    await apiRequest(API_ENDPOINTS.salesReturns.attachments(returnId)),
    normalizeReturnAttachment,
  )
}

export function uploadReturnAttachment(returnId, { file }) {
  if (!(file instanceof File)) {
    return Promise.resolve(normalizeMutationError(new Error('A valid file is required.')))
  }

  const payload = new FormData()
  payload.append('File', file)

  return safeMutation(() => apiRequest(API_ENDPOINTS.salesReturns.attachments(returnId), {
    method: 'POST',
    body: payload,
  }))
}

export function deleteReturnAttachment(attachmentId) {
  return apiRequest(API_ENDPOINTS.salesReturns.attachmentDelete(attachmentId), {
    method: 'DELETE',
  })
}

export async function getReturnAttachmentBlob(attachmentId) {
  try {
    const url = buildUrl(API_ENDPOINTS.salesReturns.attachmentDownload(attachmentId))
    const response = await fetch(url, {
      headers: buildApiHeaders({}, { accept: '*/*' }),
    })

    if (!response.ok) {
      return {
        success: false,
        data: null,
        error: `Unable to download the attachment (HTTP ${response.status}).`,
        status: response.status,
      }
    }

    const blob = await response.blob()

    return { success: true, data: blob, error: null, status: response.status }
  } catch (error) {
    return normalizeMutationError(error)
  }
}

export async function downloadReturnAttachment(attachmentId, fileName = 'return-attachment') {
  const response = await getReturnAttachmentBlob(attachmentId)
  if (!response.success) return response

  try {
    const blob = response.data
    const objectUrl = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = objectUrl
    anchor.download = textValue(fileName, 'return-attachment')
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)

    return { ...response, data: null }
  } catch (error) {
    return normalizeMutationError(error)
  }
}

export async function getInspections() {
  return mapListResponse(
    await apiRequest(API_ENDPOINTS.inspections.list),
    normalizeInspection,
  )
}

export async function getInspection(id) {
  return mapItemResponse(
    await apiRequest(API_ENDPOINTS.inspections.byId(id)),
    normalizeInspection,
  )
}

export async function createInspection(data) {
  const response = await safeMutation(() => apiRequest(API_ENDPOINTS.inspections.list, {
    method: 'POST',
    body: toInspectionFormData(data),
  }))

  return response.success
    ? { ...response, data: normalizeInspection(getResponseData(response, {})) }
    : response
}

export async function updateInspection(id, data) {
  const response = await safeMutation(() => apiRequest(API_ENDPOINTS.inspections.byId(id), {
    method: 'PUT',
    body: toInspectionFormData(data),
  }))

  return response.success
    ? { ...response, data: normalizeInspection(getResponseData(response, {})) }
    : response
}

export function deleteInspection(id) {
  return apiRequest(API_ENDPOINTS.inspections.byId(id), { method: 'DELETE' })
}

export function getReturnsReport() {
  return apiRequest(API_ENDPOINTS.reports.returns)
}

export function getDamagesReport() {
  return apiRequest(API_ENDPOINTS.reports.damages)
}

export function getExchangesReport() {
  return apiRequest(API_ENDPOINTS.reports.exchanges)
}

export function getCreditNotesReport() {
  return apiRequest(API_ENDPOINTS.reports.creditNotes)
}
