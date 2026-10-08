import {
  apiRequest,
  buildApiHeaders,
  buildUrl,
  getResponseData,
  getResponseList,
} from './apiClient'
import {
  cachedApiRequest,
  createApiCacheKey,
  hasApiCache,
  invalidateApiCache,
} from './apiCache'

const DEFAULT_LIST_QUERY = { page: 1, pageSize: 100 }
const RESOURCE_CACHE_PREFIX = 'resource:'

function getResourceCacheKey(config, query = {}) {
  return createApiCacheKey(`${RESOURCE_CACHE_PREFIX}${config.key || config.endpoint}`, {
    endpoint: config.endpoint,
    query: {
      ...DEFAULT_LIST_QUERY,
      ...(config.defaultQuery ?? {}),
      ...(query ?? {}),
    },
  })
}

async function runResourceMutation(request, config) {
  const response = await request

  if (response.success) {
    invalidateApiCache(RESOURCE_CACHE_PREFIX)
    invalidateApiCache('catalog:')

    const isStockRelated = config && (
      ['stock', 'stockMovements', 'stockLedger', 'stockTransfers', 'stockTransferItems', 'stockAdjustments', 'stockAdjustmentItems', 'stockAudits', 'stockAuditItems', 'goodsReceipts', 'purchaseReturns'].includes(config.key)
    )
    if (isStockRelated) {
      invalidateApiCache('stock:')
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ims:stock-data-updated', {
          detail: {
            resource: config.key,
            action: 'mutated',
          }
        }))
      }
    }
  }

  return response
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function upperFirst(value) {
  const text = String(value ?? '')
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text
}

function lowerFirst(value) {
  const text = String(value ?? '')
  return text ? text.charAt(0).toLowerCase() + text.slice(1) : text
}

export function readResourceValue(row, key, fallback = '') {
  if (!isRecord(row) || !key) {
    return fallback
  }

  const candidates = [
    key,
    lowerFirst(key),
    upperFirst(key),
    String(key).toUpperCase(),
    key.replace(/Id$/, 'ID'),
    key.replace(/ID$/, 'Id'),
  ]

  if (['isactive', 'active', 'userisactive', 'status'].includes(String(key).toLowerCase())) {
    candidates.push('isActive', 'IsActive', 'is_active', 'userIsActive', 'effectiveIsActive', 'status', 'Status')
  }

  if (['phone', 'phoneno', 'phonenumber'].includes(String(key).toLowerCase())) {
    candidates.push('phone', 'phoneNo', 'phoneNumber', 'Phone', 'PhoneNo', 'PhoneNumber')
  }

  if (['createdat', 'created_at', 'createddate', 'creationdate', 'datecreated', 'created'].includes(String(key).toLowerCase())) {
    candidates.push('createdAt', 'created_at', 'createdDate', 'creationDate', 'dateCreated', 'created', 'CreatedAt', 'Created_At', 'CreatedDate')
  }

  for (const candidate of candidates) {
    if (row[candidate] !== undefined && row[candidate] !== null) {
      return row[candidate]
    }
  }

  return fallback
}

export function getRoleUserCount(roleRow, usersList = []) {
  if (!roleRow || !Array.isArray(usersList) || usersList.length === 0) {
    return 0
  }
  const roleNameStr = String(
    readResourceValue(roleRow, 'roleName', readResourceValue(roleRow, 'name', readResourceValue(roleRow, 'role', '')))
  ).trim().toLowerCase()
  const roleIdStr = String(readResourceValue(roleRow, 'roleId', readResourceValue(roleRow, 'id', ''))).trim()

  return usersList.filter((u) => {
    const rawUserRole = readResourceValue(u, 'role', readResourceValue(u, 'roleName', readResourceValue(u, 'role_name', '')))
    const userRoleStr = typeof rawUserRole === 'object' && rawUserRole !== null
      ? String(rawUserRole.roleName || rawUserRole.name || rawUserRole.role || '').trim().toLowerCase()
      : String(rawUserRole || '').trim().toLowerCase()
    const userRoleIdStr = String(readResourceValue(u, 'roleId', readResourceValue(u, 'role_id', ''))).trim()

    if (roleNameStr && userRoleStr && userRoleStr === roleNameStr) {
      return true
    }
    if (roleIdStr && userRoleIdStr && userRoleIdStr === roleIdStr) {
      return true
    }
    return false
  }).length
}

export function getResourceId(row, config = {}) {
  const idFields = [
    ...(config.idFields ?? []),
    'id',
    'Id',
    `${config.key ?? ''}Id`,
    `${config.entityKey ?? ''}Id`,
  ].filter(Boolean)

  for (const field of idFields) {
    const value = readResourceValue(row, field, null)

    if (value !== null && value !== undefined && value !== '') {
      return String(value)
    }
  }

  return ''
}

export function normalizeResourceRow(row, config = {}) {
  if (!isRecord(row)) {
    return row
  }

  const id = getResourceId(row, config)

  return {
    ...row,
    id: id || row.id,
  }
}

function getListFromResponse(response, config) {
  const directList = getResponseList(response, config.listKey)

  if (directList.length > 0) {
    return directList
  }

  const data = getResponseData(response)

  if (Array.isArray(data)) {
    return data
  }

  if (isRecord(data)) {
    if (Array.isArray(data.data)) {
      return data.data
    }

    if (config.listKey && Array.isArray(data[config.listKey])) {
      return data[config.listKey]
    }

    if (Array.isArray(data.items)) {
      return data.items
    }

    if (Array.isArray(data.results)) {
      return data.results
    }

    return [data]
  }

  return []
}

export async function listResource(config, query, options = {}) {
  const {
    disableCache = false,
    requestOptions = {},
    ...cacheOptions
  } = options
  const normalizedQuery = {
    ...DEFAULT_LIST_QUERY,
    ...(config.defaultQuery ?? {}),
    ...(query ?? {}),
  }
  const cacheKey = getResourceCacheKey(config, query)
  const loadFromBackend = async () => {
    const response = await apiRequest(config.endpoint, {
      ...requestOptions,
      query: normalizedQuery,
    })

    if (!response.success) {
      return response
    }

    return {
      ...response,
      data: getListFromResponse(response, config).map((row) =>
        normalizeResourceRow(row, config),
      ),
    }
  }

  if (disableCache) {
    invalidateApiCache(`${RESOURCE_CACHE_PREFIX}${config.key || config.endpoint}:`)
    return loadFromBackend()
  }

  return cachedApiRequest(cacheKey, loadFromBackend, cacheOptions)
}

listResource.hasCache = (config, query) => hasApiCache(getResourceCacheKey(config, query))

export function getResource(config, id) {
  const endpoint = config.byId ? config.byId(id) : `${config.endpoint}/${id}`
  return apiRequest(endpoint)
}

export function createResource(config, payload) {
  const endpoint =
    typeof config.createEndpoint === 'function'
      ? config.createEndpoint(payload)
      : config.createEndpoint || config.endpoint
  const body = (config.omitCreateFields ?? []).reduce((result, field) => {
    const nextResult = { ...result }
    delete nextResult[field]
    return nextResult
  }, payload)

  return runResourceMutation(apiRequest(endpoint, {
    method: 'POST',
    query: typeof config.createQuery === 'function' ? config.createQuery(payload) : undefined,
    body,
  }), config)
}

export function updateResource(config, id, payload, changedPayload) {
  const endpoint = config.byId ? config.byId(id) : `${config.endpoint}/${id}`
  const method = config.updateMethod || 'PUT'

  // If using PUT, the server expects the full representation.
  // We must merge the original record properties (which are in the baseline/form state) 
  // with the new payload to prevent missing required fields like passwordHash.
  let requestBody = payload
  if (method === 'PUT' && window.__ims_current_record) {
    requestBody = {
      ...window.__ims_current_record,
      ...payload
    }
  }

  return runResourceMutation(apiRequest(endpoint, {
    method,
    body: method === 'PATCH' ? changedPayload : requestBody,
  }), config)
}

export function deleteResource(config, id) {
  const endpoint = config.byId ? config.byId(id) : `${config.endpoint}/${id}`
  return runResourceMutation(apiRequest(endpoint, { method: 'DELETE' }), config)
}

export async function downloadResourceFile(endpoint, filename) {
  const response = await fetch(buildUrl(endpoint), {
    headers: buildApiHeaders(),
  })

  if (!response.ok) {
    return {
      success: false,
      error: `Download failed with status ${response.status}.`,
    }
  }

  return {
    success: true,
    blob: await response.blob(),
    filename,
  }
}

export function postResourceAction(endpoint) {
  return apiRequest(endpoint, { method: 'POST' })
}

export function putResourceAction(endpoint, body) {
  return apiRequest(endpoint, { method: 'PUT', body })
}
