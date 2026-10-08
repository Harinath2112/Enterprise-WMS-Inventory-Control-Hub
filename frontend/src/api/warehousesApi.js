import { apiRequest, getResponseData, getResponseList } from './apiClient'
import { API_ENDPOINTS } from './endpoints'
import { cachedApiRequest, createApiCacheKey, hasApiCache, invalidateApiCache } from './apiCache'

const WAREHOUSE_CACHE_PREFIX = 'warehouses:'


function formatCapitalizedTitle(value) {
  if (!value) return ''
  const str = String(value).trim()
  if (!str) return ''

  return str
    .split(/\s+/)
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : ''))
    .join(' ')
}

export function normalizeWarehouse(warehouse) {
  const id = String(warehouse?.id ?? warehouse?.warehouseId ?? warehouse?.WarehouseId ?? warehouse?._id ?? '')
  const rawStatus = warehouse?.status ?? warehouse?.Status ?? 'active'
  const status = String(rawStatus).toLowerCase() === 'inactive' ? 'Inactive' : 'Active'

  const rawName = warehouse?.name ?? warehouse?.Name ?? ''
  const rawLocation = warehouse?.location ?? warehouse?.Location ?? ''
  const rawManagerName = warehouse?.managerName ?? warehouse?.ManagerName ?? warehouse?.manager ?? warehouse?.Manager ?? ''

  return {
    ...warehouse,
    id,
    warehouseId: id,
    name: formatCapitalizedTitle(rawName),
    location: formatCapitalizedTitle(rawLocation),
    status,
    warehouseCode: warehouse?.warehouseCode ?? warehouse?.WarehouseCode ?? warehouse?.code ?? warehouse?.Code ?? '',
    managerName: formatCapitalizedTitle(rawManagerName),
    phone: warehouse?.phone ?? warehouse?.Phone ?? '',
    email: warehouse?.email ?? warehouse?.Email ?? '',
    createdAt: warehouse?.createdAt ?? warehouse?.CreatedAt ?? '',
    updatedAt: warehouse?.updatedAt ?? warehouse?.UpdatedAt ?? warehouse?.createdAt ?? warehouse?.CreatedAt ?? '',
  }
}

function readNumber(value, fallback = 0) {
  const nextValue = Number(value)
  return Number.isFinite(nextValue) ? nextValue : fallback
}

export function invalidateWarehouseCache() {
  invalidateApiCache(WAREHOUSE_CACHE_PREFIX)
}

export function getAllWarehouses() {
  return apiRequest(API_ENDPOINTS.warehouses.list)
}

export function getWarehouses(options = {}) {
  return cachedApiRequest(
    createApiCacheKey(WAREHOUSE_CACHE_PREFIX, 'list'),
    async () => {
      const response = await getAllWarehouses()

      if (!response.success) {
        return response
      }

      return {
        ...response,
        data: getResponseList(response, 'warehouses').map(normalizeWarehouse),
      }
    },
    options,
  )
}
getWarehouses.hasCache = () => hasApiCache(createApiCacheKey(WAREHOUSE_CACHE_PREFIX, 'list'))

export function normalizeWarehouseStats(stats = {}) {
  return {
    warehouses: readNumber(stats?.warehouses ?? stats?.Warehouses),
    stockUnits: readNumber(stats?.stockUnits ?? stats?.StockUnits),
    racks: readNumber(stats?.racks ?? stats?.Racks),
    bins: readNumber(stats?.bins ?? stats?.Bins),
  }
}

export function getWarehouseStats(options = {}) {
  return cachedApiRequest(
    createApiCacheKey(WAREHOUSE_CACHE_PREFIX, 'stats'),
    async () => {
      let response = await apiRequest(API_ENDPOINTS.warehouseStats.list)

      if (!response.success && response.status === 404) {
        response = await apiRequest(API_ENDPOINTS.warehouseStats.fallback)
      }

      if (!response.success) {
        return response
      }

      return {
        ...response,
        data: normalizeWarehouseStats(getResponseData(response, {})),
      }
    },
    options,
  )
}

export function normalizeWarehouseDetails(details = {}) {
  const products = Array.isArray(details?.products)
    ? details.products
    : Array.isArray(details?.Products)
      ? details.Products
      : []

  return {
    ...details,
    warehouseId: String(details?.warehouseId ?? details?.WarehouseId ?? ''),
    warehouseName: details?.warehouseName ?? details?.WarehouseName ?? '',
    totalRacks: readNumber(details?.totalRacks ?? details?.TotalRacks),
    totalBins: readNumber(details?.totalBins ?? details?.TotalBins),
    totalProducts: readNumber(details?.totalProducts ?? details?.TotalProducts),
    totalStockUnits: readNumber(details?.totalStockUnits ?? details?.TotalStockUnits),
    products: products.map((product, index) => ({
      id: `${product?.productName ?? product?.ProductName ?? 'product'}-${index}`,
      productName: product?.productName ?? product?.ProductName ?? '',
      rackCode: product?.rackCode ?? product?.RackCode ?? '',
      binCode: product?.binCode ?? product?.BinCode ?? '',
      quantity: readNumber(product?.quantity ?? product?.Quantity),
    })),
  }
}

export async function getWarehouseDetails(id) {
  const response = await apiRequest(API_ENDPOINTS.warehouses.details(id))

  if (!response.success) {
    return response
  }

  return {
    ...response,
    data: normalizeWarehouseDetails(getResponseData(response, {})),
  }
}

export async function getWarehouseDetailsMap(warehouses = []) {
  const entries = await Promise.all(
    warehouses.map(async (warehouse) => {
      const id = String(warehouse?.id ?? warehouse?.warehouseId ?? '')

      if (!id) {
        return null
      }

      const response = await getWarehouseDetails(id)
      return [id, response.success ? response.data : null, response]
    }),
  )

  return entries.reduce((detailsMap, entry) => {
    if (!entry) {
      return detailsMap
    }

    const [id, details] = entry
    if (details) {
      detailsMap[id] = details
    }

    return detailsMap
  }, {})
}

export function normalizeBin(bin = {}) {
  const id = String(bin?.binId ?? bin?.BinId ?? bin?.binID ?? bin?.BinID ?? bin?.id ?? bin?.Id ?? '')
  const warehouseId = String(
    bin?.warehouseId ?? bin?.WarehouseId ?? bin?.warehouseID ?? bin?.WarehouseID ?? '',
  )
  const rackId = String(bin?.rackId ?? bin?.RackId ?? bin?.rackID ?? bin?.RackID ?? '')
  const binCode = bin?.binCode ?? bin?.BinCode ?? bin?.code ?? bin?.Code ?? ''

  return {
    ...bin,
    id,
    binId: id,
    value: id,
    name: binCode || `Bin ${id}`,
    label: binCode || `Bin ${id}`,
    warehouseId,
    rackId,
    binCode,
    capacity: readNumber(bin?.capacity ?? bin?.Capacity),
    status: bin?.status ?? bin?.Status ?? 'active',
  }
}

export function getBins(options = {}) {
  return cachedApiRequest(
    createApiCacheKey(WAREHOUSE_CACHE_PREFIX, 'bins'),
    async () => {
      const response = await apiRequest(API_ENDPOINTS.bins.list)
      if (!response.success) return response
      return {
        ...response,
        data: getResponseList(response, 'bins').map(normalizeBin),
      }
    },
    options,
  )
}
getBins.hasCache = () => hasApiCache(createApiCacheKey(WAREHOUSE_CACHE_PREFIX, 'bins'))

export function normalizeRack(rack = {}) {
  const id = String(rack?.rackId ?? rack?.RackId ?? rack?.rackID ?? rack?.RackID ?? rack?.id ?? rack?.Id ?? '')
  const warehouseId = String(
    rack?.warehouseId ?? rack?.WarehouseId ?? rack?.warehouseID ?? rack?.WarehouseID ?? '',
  )
  const createdAt =
    rack?.createdAt ??
    rack?.CreatedAt ??
    rack?.createdDate ??
    rack?.CreatedDate ??
    rack?.createdOn ??
    rack?.CreatedOn ??
    rack?.dateCreated ??
    rack?.DateCreated ??
    ''

  return {
    ...rack,
    id,
    rackId: id,
    warehouseId,
    rackCode: rack?.rackCode ?? rack?.RackCode ?? rack?.code ?? rack?.Code ?? '',
    description: rack?.description ?? rack?.Description ?? '',
    createdAt,
    createdDate: createdAt,
  }
}

export function getRacks(options = {}) {
  return cachedApiRequest(
    createApiCacheKey(WAREHOUSE_CACHE_PREFIX, 'racks'),
    async () => {
      const response = await apiRequest(API_ENDPOINTS.racks.list)
      if (!response.success) return response
      return {
        ...response,
        data: getResponseList(response, 'racks').map(normalizeRack),
      }
    },
    options,
  )
}
getRacks.hasCache = () => hasApiCache(createApiCacheKey(WAREHOUSE_CACHE_PREFIX, 'racks'))

async function runWarehouseMutation(request) {
  const response = await request
  if (response.success) {
    invalidateWarehouseCache()
  }
  return response
}

export function createRack(data) {
  return runWarehouseMutation(apiRequest(API_ENDPOINTS.racks.list, {
    method: 'POST',
    body: data,
  }))
}

export function updateRack(id, data) {
  return runWarehouseMutation(apiRequest(API_ENDPOINTS.racks.byId(id), {
    method: 'PUT',
    body: data,
  }))
}

export function deleteRack(id) {
  return runWarehouseMutation(apiRequest(API_ENDPOINTS.racks.byId(id), {
    method: 'DELETE',
  }))
}

export function normalizeBinStock(row = {}) {
  const binStockId = String(
    row?.binStockId ?? row?.BinStockId ?? row?.binStockID ?? row?.BinStockID ?? row?.id ?? row?.Id ?? '',
  )
  const productId = String(row?.productId ?? row?.ProductId ?? row?.productID ?? row?.ProductID ?? '')
  const warehouseId = String(
    row?.warehouseId ?? row?.WarehouseId ?? row?.warehouseID ?? row?.WarehouseID ?? '',
  )
  const rackId = String(row?.rackId ?? row?.RackId ?? row?.rackID ?? row?.RackID ?? '')
  const binId = String(row?.binId ?? row?.BinId ?? row?.binID ?? row?.BinID ?? '')

  return {
    ...row,
    id: binStockId || `${productId}-${warehouseId}-${binId}`,
    binStockId,
    productId,
    variantId: String(row?.variantId ?? row?.VariantId ?? ''),
    productName: row?.productName ?? row?.ProductName ?? '',
    warehouseId,
    warehouseName: row?.warehouseName ?? row?.WarehouseName ?? '',
    rackId,
    rackCode: row?.rackCode ?? row?.RackCode ?? '',
    binId,
    binCode: row?.binCode ?? row?.BinCode ?? '',
    quantity: readNumber(row?.quantity ?? row?.Quantity),
  }
}

export function getBinStocks(options = {}) {
  return cachedApiRequest(
    createApiCacheKey(WAREHOUSE_CACHE_PREFIX, 'binStocks'),
    async () => {
      const response = await apiRequest(API_ENDPOINTS.binStocks.list)
      if (!response.success) return response
      return {
        ...response,
        data: getResponseList(response, 'binStocks').map(normalizeBinStock),
      }
    },
    options,
  )
}
getBinStocks.hasCache = () => hasApiCache(createApiCacheKey(WAREHOUSE_CACHE_PREFIX, 'binStocks'))

export function createBin(data) {
  return runWarehouseMutation(apiRequest(API_ENDPOINTS.bins.list, {
    method: 'POST',
    body: data,
  }))
}

export function updateBin(id, data) {
  return runWarehouseMutation(apiRequest(API_ENDPOINTS.bins.byId(id), {
    method: 'PUT',
    body: data,
  }))
}

export function deleteBin(id) {
  return runWarehouseMutation(apiRequest(API_ENDPOINTS.bins.byId(id), {
    method: 'DELETE',
  }))
}

export function createBinTransfer(data) {
  console.log('[Bin Transfer] Request payload', data)

  return runWarehouseMutation(apiRequest(API_ENDPOINTS.binTransfers.list, {
    method: 'POST',
    body: data,
  }))
}

export function createPutawayStock(data) {
  return runWarehouseMutation(apiRequest(API_ENDPOINTS.putawayStock.list, {
    method: 'POST',
    body: data,
  }))
}

export function getWarehouseById(id) {
  return apiRequest(API_ENDPOINTS.warehouses.byId(id))
}

function toWarehousePayload(data) {
  const statusStr = String(data?.status || data?.Status || 'active').toLowerCase()
  const statusValue = statusStr === 'inactive' ? 'inactive' : 'active'
  
  return {
    Name: data?.name ?? data?.Name ?? '',
    WarehouseCode: data?.warehouseCode ?? data?.WarehouseCode ?? data?.code ?? data?.Code ?? '',
    Code: data?.warehouseCode ?? data?.WarehouseCode ?? data?.code ?? data?.Code ?? '',
    Location: data?.location ?? data?.Location ?? '',
    ManagerName: data?.managerName ?? data?.ManagerName ?? data?.manager ?? data?.Manager ?? '',
    Manager: data?.managerName ?? data?.ManagerName ?? data?.manager ?? data?.Manager ?? '',
    Phone: data?.phone ?? data?.Phone ?? '',
    Email: data?.email ?? data?.Email ?? '',
    Status: statusValue,
  }
}

export function createWarehouse(data) {
  const payload = toWarehousePayload(data)
  return runWarehouseMutation(apiRequest(API_ENDPOINTS.warehouses.list, {
    method: 'POST',
    body: payload,
  }))
}

export function updateWarehouse(id, data) {
  const payload = toWarehousePayload(data)
  payload.Id = id
  return runWarehouseMutation(apiRequest(API_ENDPOINTS.warehouses.byId(id), {
    method: 'PUT',
    body: payload,
  }))
}

export function deleteWarehouse(id) {
  return runWarehouseMutation(apiRequest(API_ENDPOINTS.warehouses.byId(id), {
    method: 'DELETE',
  }))
}

export async function getWarehouseProducts(id) {
  const response = await apiRequest(API_ENDPOINTS.warehouses.products(id))

  if (!response.success) {
    return response
  }

  return {
    ...response,
    data: getResponseList(response, 'products'),
  }
}

export async function createWarehouseStockFromGrn(grnId, data) {
  const cleanId = String(grnId || '').replace(/^GRN-/i, '').trim()
  const numericId = String(cleanId).match(/\d+/)?.[0] || cleanId || grnId
  const response = await apiRequest(API_ENDPOINTS.warehouses.stockFromGrn(numericId), {
    method: 'POST',
    body: data,
  })

  if (response.success) {
    invalidateApiCache('stock')
    invalidateApiCache('warehouses')
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ims:stock-data-updated', {
        detail: { resource: 'stock', action: 'created' }
      }))
    }
  }

  return response
}
