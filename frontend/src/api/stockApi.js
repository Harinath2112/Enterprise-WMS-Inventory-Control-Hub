import { apiRequest, getResponseList } from './apiClient'
import { API_ENDPOINTS } from './endpoints'
import { cachedApiRequest, createApiCacheKey, hasApiCache, invalidateApiCache } from './apiCache'

export const STOCK_DATA_UPDATED_EVENT = 'ims:stock-data-updated'
const STOCK_CACHE_PREFIX = 'stock:'

export function invalidateStockCache() {
  invalidateApiCache(STOCK_CACHE_PREFIX)
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function toId(value) {
  return value === undefined || value === null || value === '' ? '' : String(value)
}

export function normalizeStockRow(row = {}) {
  const quantity = toNumber(
    row.quantity ??
    row.Quantity ??
    row.currentStock ??
    row.CurrentStock ??
    row.stockQuantity ??
    row.StockQuantity ??
    row.onHandQuantity ??
    row.OnHandQuantity,
  )
  const reservedQty = toNumber(row.reservedQuantity ?? row.ReservedQuantity ?? row.reservedQty ?? row.ReservedQty)
  const availableQty = toNumber(
    row.availableQuantity ??
    row.AvailableQuantity ??
    row.availableQty ??
    row.AvailableQty ??
    row.availableStock ??
    row.AvailableStock,
    quantity - reservedQty,
  )

  return {
    ...row,
    id: toId(row.id ?? row.stockId ?? row.StockId),
    stockId: toId(row.stockId ?? row.StockId ?? row.id),
    productId: toId(row.productId ?? row.ProductId),
    variantId: toId(row.variantId ?? row.VariantId),
    warehouseId: toId(row.warehouseId ?? row.WarehouseId),
    productName: row.productName ?? row.ProductName ?? '',
    productImage: row.productImage ?? row.ProductImage ?? '',
    sku: row.sku ?? row.SKU ?? '',
    variantName: row.variantName ?? row.VariantName ?? '',
    warehouseName: row.warehouseName ?? row.WarehouseName ?? '',
    quantity,
    reservedQty,
    reservedQuantity: reservedQty,
    availableQty,
    availableQuantity: availableQty,
    reorderLevel: toNumber(row.reorderLevel ?? row.ReorderLevel),
    lastUpdated: row.lastUpdated ?? row.LastUpdated ?? row.updatedAt ?? row.UpdatedAt ?? '',
  }
}

export function normalizeStockMovement(row = {}) {
  return {
    ...row,
    id: toId(row.id ?? row.movementId ?? row.MovementId),
    movementId: toId(row.movementId ?? row.MovementId ?? row.id),
    productId: toId(row.productId ?? row.ProductId),
    variantId: toId(row.variantId ?? row.VariantId),
    warehouseId: toId(row.warehouseId ?? row.WarehouseId),
    productName: row.productName ?? row.ProductName ?? '',
    warehouseName: row.warehouseName ?? row.WarehouseName ?? '',
    movementType: row.movementType ?? row.MovementType ?? row.type ?? row.Type ?? '',
    type: row.type ?? row.Type ?? row.movementType ?? row.MovementType ?? '',
    quantity: toNumber(row.quantity ?? row.Quantity),
    referenceId: row.referenceId ?? row.ReferenceId ?? '',
    referenceType: row.referenceType ?? row.ReferenceType ?? '',
    notes: row.notes ?? row.Notes ?? '',
    date: row.date ?? row.Date ?? row.createdAt ?? row.CreatedAt ?? '',
    createdAt: row.createdAt ?? row.CreatedAt ?? row.date ?? row.Date ?? '',
  }
}

export function getStockRegister(options = {}) {
  return cachedApiRequest(
    createApiCacheKey(STOCK_CACHE_PREFIX, 'register'),
    async () => {
      const response = await apiRequest(API_ENDPOINTS.stock.list, {
        query: { page: 1, pageSize: 100 },
      })

      if (!response.success) {
        console.error('[Stock] Failed to load stock register', response)
        return response
      }

      return {
        ...response,
        data: getResponseList(response, 'stock').map(normalizeStockRow),
      }
    },
    options,
  )
}
getStockRegister.hasCache = () => hasApiCache(createApiCacheKey(STOCK_CACHE_PREFIX, 'register'))

export function getStockMovements(options = {}) {
  return cachedApiRequest(
    createApiCacheKey(STOCK_CACHE_PREFIX, 'movements'),
    async () => {
      const response = await apiRequest(API_ENDPOINTS.stockMovements.list, {
        query: { page: 1, pageSize: 100 },
      })

      if (!response.success) {
        console.error('[Stock] Failed to load stock movements', response)
        return response
      }

      return {
        ...response,
        data: getResponseList(response, 'stockMovements').map(normalizeStockMovement),
      }
    },
    options,
  )
}
getStockMovements.hasCache = () => hasApiCache(createApiCacheKey(STOCK_CACHE_PREFIX, 'movements'))

export async function createStockTransfer(payload) {
  const fromWh = payload.fromWarehouseId ? Number(payload.fromWarehouseId) : payload.sourceWarehouseId ? Number(payload.sourceWarehouseId) : undefined
  const toWh = payload.toWarehouseId ? Number(payload.toWarehouseId) : payload.destinationWarehouseId ? Number(payload.destinationWarehouseId) : undefined
  const prodId = payload.productId ? Number(payload.productId) : undefined
  const qty = payload.quantity ? Number(payload.quantity) : 1

  const normalizedPayload = {
    ...payload,
    fromWarehouseId: fromWh,
    sourceWarehouseId: fromWh,
    toWarehouseId: toWh,
    destinationWarehouseId: toWh,
    productId: prodId,
    quantity: qty,
  }

  console.log('[Stock Transfer] Request payload', normalizedPayload)

  const response = await apiRequest(API_ENDPOINTS.stockTransfers.list, {
    method: 'POST',
    body: normalizedPayload,
  })

  if (response.success) {
    invalidateStockCache()
  }

  return response
}

export function notifyStockDataUpdated(detail = {}) {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(new CustomEvent(STOCK_DATA_UPDATED_EVENT, { detail }))
}
