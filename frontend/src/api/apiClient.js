const DEFAULT_TIMEOUT_MS = 15000
const DEFAULT_BASE_URL = '/api'
const BASE_URL = (import.meta.env.VITE_API_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '')
const NGROK_SKIP_BROWSER_WARNING_HEADER = 'ngrok-skip-browser-warning'
let apiRequestSequence = 0
const apiStatusBatch = {
  pendingRequestIds: new Set(),
  serverReached: false,
  lastIssue: null,
}
 
export const AUTH_TOKEN_KEY = 'ims-auth-token'
export const AUTH_UNAUTHORIZED_EVENT = 'ims:auth:unauthorized'
export const IMS_API_STATUS_EVENT = 'ims:api-status'
export const IMS_DATA_MUTATION_EVENT = 'ims:data-mutation'
 
function notifyApiStatus(detail) {
  if (typeof window === 'undefined') {
    return
  }

  if (detail.status === 'pending') {
    if (apiStatusBatch.pendingRequestIds.size === 0) {
      apiStatusBatch.serverReached = false
      apiStatusBatch.lastIssue = null
    }

    apiStatusBatch.pendingRequestIds.add(detail.requestId)
  } else {
    if (detail.requestId !== undefined) {
      apiStatusBatch.pendingRequestIds.delete(detail.requestId)
    }

    if (detail.status === 'ok') {
      apiStatusBatch.serverReached = true
      apiStatusBatch.lastIssue = null
    }

    if (detail.status === 'offline' || detail.status === 'timeout' || detail.status === 'server-error') {
      apiStatusBatch.lastIssue = {
        status: detail.status,
        message: detail.message || 'We are having trouble reaching the server.',
      }
    }
  }

  const batchComplete = detail.status !== 'pending' && apiStatusBatch.pendingRequestIds.size === 0
  const eventDetail = {
    ...detail,
    batchComplete,
    batchServerReached: apiStatusBatch.serverReached,
    batchIssue: apiStatusBatch.serverReached ? null : apiStatusBatch.lastIssue,
  }

  window.dispatchEvent(new CustomEvent(IMS_API_STATUS_EVENT, { detail: eventDetail }))

  if (batchComplete) {
    apiStatusBatch.serverReached = false
    apiStatusBatch.lastIssue = null
  }
}
 
function notifyDataMutation(detail) {
  if (typeof window === 'undefined') {
    return
  }
 
  window.dispatchEvent(new CustomEvent(IMS_DATA_MUTATION_EVENT, { detail }))
}
 
function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}
 
function readProp(value, ...keys) {
  if (!isRecord(value)) {
    return undefined
  }
 
  return keys.reduce((result, key) => (
    result === undefined ? value[key] : result
  ), undefined)
}
 
function isApiEnvelope(payload) {
  return isRecord(payload) && (
    'success' in payload ||
    'Success' in payload ||
    'data' in payload ||
    'Data' in payload ||
    'message' in payload ||
    'Message' in payload
  )
}
 
export function getAuthToken() {
  const rawToken = localStorage.getItem(AUTH_TOKEN_KEY)
 
  if (!rawToken) {
    return ''
  }
 
  try {
    const parsedToken = JSON.parse(rawToken)
    const token = typeof parsedToken === 'string' ? parsedToken : rawToken
    const normalizedToken = String(token).trim()

    return /^(undefined|null)$/i.test(normalizedToken) ? '' : normalizedToken
  } catch {
    const normalizedToken = rawToken.trim()
    return /^(undefined|null)$/i.test(normalizedToken) ? '' : normalizedToken
  }
}
 
export function buildApiHeaders(headers = {}, options = {}) {
  const token = getAuthToken()
  const {
    accept = 'application/json',
    includeContentType = false,
    contentType = 'application/json',
  } = options
  const requestHeaders = {
    Accept: accept,
    'X-Requested-With': 'XMLHttpRequest',
    [NGROK_SKIP_BROWSER_WARNING_HEADER]: 'true',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...headers,
  }
 
  if (includeContentType && !requestHeaders['Content-Type']) {
    requestHeaders['Content-Type'] = contentType
  }
 
  return requestHeaders
}
 
export function buildUrl(endpoint, query) {
  if (!endpoint || typeof endpoint !== 'string') {
    throw new Error('API endpoint must be a non-empty string.')
  }
 
  if (/^https?:\/\//i.test(endpoint)) {
    const absoluteUrl = new URL(endpoint)
 
    if (query && isRecord(query)) {
      Object.entries(query).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') {
          return
        }
 
        absoluteUrl.searchParams.set(key, String(value))
      })
    }
 
    return absoluteUrl.href
  }
 
  const basePath = `${BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`
  const url = new URL(basePath, window.location.origin)
 
  if (query && isRecord(query)) {
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        return
      }
 
      url.searchParams.set(key, String(value))
    })
  }
 
  return /^https?:\/\//i.test(BASE_URL)
    ? url.href
    : url.pathname + url.search + url.hash
}
 
export function resolveApiAssetUrl(value) {
  let rawValue = String(value ?? '').trim().replace(/\\/g, '/')
 
  if (!rawValue) {
    return ''
  }
 
  if (/^(blob:|data:|https?:\/\/)/i.test(rawValue)) {
    return rawValue
  }
 
  if (!rawValue.startsWith('/')) {
    rawValue = '/' + rawValue
  }
 
  // In development these paths are proxied by Vite to the API host. Keeping
  // them same-origin also lets the proxy attach the ngrok bypass header.
  if (import.meta.env.DEV) {
    return rawValue
  }
 
  if (/^https?:\/\//i.test(BASE_URL)) {
    try {
      return new URL(rawValue, new URL(BASE_URL).origin).href
    } catch {
      return rawValue
    }
  }
 
  return rawValue
}
 
async function parseResponse(response) {
  const contentType = response.headers.get('content-type') || ''
 
  if (response.status === 204) {
    return null
  }
 
  if (contentType.includes('application/json')) {
    return response.json()
  }
 
  const text = await response.text()
  return text || null
}
 
function getErrorMessage(payload, fallback) {
  if (!payload) {
    return fallback
  }
 
  if (typeof payload === 'string') {
    return sanitizeApiError(payload)
  }

  const errors = readProp(payload, 'errors', 'Errors')

  if (errors && typeof errors === 'object') {
    const firstError = Object.values(errors)
      .flat()
      .find(Boolean)

    if (firstError) {
      return sanitizeApiError(firstError)
    }
  }

  const extracted =
    readProp(payload, 'message', 'Message') ||
    readProp(payload, 'innerError', 'InnerError') ||
    readProp(payload, 'error', 'Error') ||
    readProp(payload, 'fullError', 'FullError') ||
    readProp(payload, 'title', 'Title') ||
    fallback

  return sanitizeApiError(extracted)
}

function getStatusErrorMessage(status, payload) {
  const fallbackByStatus = {
    400: 'The request could not be completed. Review the form and try again.',
    401: 'Your session has expired. Please sign in again.',
    403: 'You do not have access to complete this action.',
    404: 'We could not find that record.',
    409: 'This record conflicts with existing data.',
    500: 'We are having trouble loading data right now.',
    502: 'Unable to connect to the server.',
    503: 'Unable to connect to the server.',
    504: 'Unable to connect to the server.',
  }

  const message = getErrorMessage(payload, fallbackByStatus[status] || 'The request could not be completed. Please try again.')

  return sanitizeApiError(message, status)
}

export function sanitizeApiError(message, status = 0) {
  const rawMessage = String(message || '').trim()

  if (!rawMessage) {
    return ''
  }

  const lower = rawMessage.toLowerCase()

  // Detect HTML/XML tags, DOCTYPE, ngrok error codes/domains, localhost, ports, tunnels, or proxy/infrastructure details
  const isInfraError =
    /<[a-z!][\s\S]*>/i.test(rawMessage) ||
    lower.includes('<!doctype') ||
    lower.includes('ngrok') ||
    lower.includes('err_ngrok') ||
    lower.includes('tunnel') ||
    lower.includes('localhost') ||
    lower.includes('127.0.0.1') ||
    lower.includes('0.0.0.0') ||
    lower.includes('upstream') ||
    lower.includes('bad gateway') ||
    lower.includes('gateway timeout') ||
    lower.includes('service unavailable') ||
    lower.includes('connection refused') ||
    lower.includes('econnrefused') ||
    lower.includes('etimedout') ||
    /:\d{4,5}\b/.test(rawMessage) ||
    /vite_api_base_url|backend server|ims api|failed to fetch|networkerror|load failed/i.test(rawMessage)

  if (isInfraError) {
    return 'Unable to connect to the server.'
  }

  if (/timeout|aborted/i.test(rawMessage)) {
    return 'Unable to connect to the server.'
  }

  if (rawMessage.length > 250 && /stack trace|exception|system\.|microsoft\.|sql|database|unknown column|unknown table|mysql|syntax near/i.test(rawMessage)) {
    return 'We are having trouble completing this request right now.'
  }

  if (/normalizeCategory\s+is\s+not\s+defined/i.test(rawMessage)) {
    return 'Invalid category name. Please select from predefined categories.'
  }

  if (/is\s+not\s+defined|referenceerror|typeerror|syntaxerror|cannot\s+read\s+propert|is\s+not\s+a\s+function/i.test(rawMessage)) {
    return 'We are having trouble completing this request right now.'
  }

  if (/the\s+dto\s+field\s+is\s+required/i.test(rawMessage)) {
    return 'Please fill in all mandatory Goods Receipt fields.'
  }

  if (/\bdto\b/i.test(rawMessage)) {
    return rawMessage.replace(/\bthe\s+dto\s+field\b/gi, 'The required form field').replace(/\bdto\b/gi, 'form data')
  }

  if (/request failed with status/i.test(rawMessage)) {
    return 'The request could not be completed. Please try again.'
  }

  return rawMessage
}
 
function normalizeEnvelope(payload) {
  if (!isApiEnvelope(payload)) {
    return null
  }
 
  const success = readProp(payload, 'success', 'Success')
 
  return {
    success: typeof success === 'boolean' ? success : true,
    data: readProp(payload, 'data', 'Data') ?? null,
    message: readProp(payload, 'message', 'Message') ?? null,
    errors: readProp(payload, 'errors', 'Errors') ?? null,
    traceId: readProp(payload, 'traceId', 'TraceId') ?? null,
  }
}
 
export function getResponseData(response, fallback = null) {
  const data = response?.data
  return data?.data ?? data?.items ?? data?.results ?? data ?? fallback
}
 
export function getResponseList(response, key) {
  const data = getResponseData(response)

  if (Array.isArray(data)) {
    return data
  }

  if (key && Array.isArray(data?.[key])) {
    return data[key]
  }

  const commonKeys = ['warehouses', 'Warehouses', 'suppliers', 'Suppliers', 'products', 'Products', 'purchaseOrders', 'PurchaseOrders', 'data', 'Data']
  for (const candidate of commonKeys) {
    if (Array.isArray(data?.[candidate])) {
      return data[candidate]
    }
  }

  if (Array.isArray(data?.items)) {
    return data.items
  }

  if (Array.isArray(data?.results)) {
    return data.results
  }

  return []
}
 
export async function checkServerHealth() {
  if (typeof window === 'undefined') {
    return true
  }

  try {
    const healthUrl = buildUrl('/health')
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), 4000)

    const response = await fetch(healthUrl, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        [NGROK_SKIP_BROWSER_WARNING_HEADER]: 'true',
      },
    })

    window.clearTimeout(timeoutId)
    return response.ok
  } catch {
    return false
  }
}

export async function apiRequest(endpoint, options = {}) {
  const {
    body,
    headers = {},
    query,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    signal,
    ...restOptions
  } = options
  const isFormData = body instanceof FormData
  const controller = new AbortController()
  const requestId = ++apiRequestSequence
  const method = String(restOptions.method || 'GET').toUpperCase()
  let requestUrl = ''
  let didTimeOut = false
  const timeoutId = window.setTimeout(() => {
    if (controller.signal.aborted) {
      return
    }

    didTimeOut = true
    controller.abort()
  }, timeoutMs)
 
  if (signal) {
    if (signal.aborted) {
      controller.abort()
    } else {
      signal.addEventListener('abort', () => controller.abort(), { once: true })
    }
  }
 
  try {
    const requestHeaders = buildApiHeaders(headers, {
      includeContentType: (body !== undefined || ['POST', 'PUT', 'PATCH'].includes(method)) && !isFormData,
    })

    requestUrl = buildUrl(endpoint, query)
    notifyApiStatus({
      status: 'pending',
      requestId,
      endpoint,
      url: requestUrl,
      method,
    })

    const requestBody = isFormData
      ? body
      : body !== undefined
        ? JSON.stringify(body)
        : ['POST', 'PUT', 'PATCH'].includes(method)
          ? '{}'
          : undefined

    const response = await fetch(requestUrl, {
      ...restOptions,
      signal: controller.signal,
      headers: requestHeaders,
      body: requestBody,
    })

    // Any HTTP response proves that the server is reachable. HTTP failures are
    // handled by the calling screen and must not be presented as disconnection.
    notifyApiStatus({
      status: 'ok',
      requestId,
      endpoint,
      url: requestUrl,
      method,
      httpStatus: response.status,
    })
 
    const payload = await parseResponse(response)
    const envelope = normalizeEnvelope(payload)
 
    if (!response.ok) {
      console.error('[API] Request failed', {
        endpoint,
        url: requestUrl,
        method,
        status: response.status,
        hasAuthorizationHeader: Boolean(requestHeaders.Authorization),
        payload,
      })
 
      if (response.status === 401) {
        const isPublicAuthEndpoint =
          requestUrl.includes('/auth/login') ||
          requestUrl.includes('/auth/resend-verification') ||
          requestUrl.includes('/auth/resend-login-otp') ||
          requestUrl.includes('/auth/verify-otp') ||
          requestUrl.includes('/auth/verify-email-otp') ||
          requestUrl.includes('/auth/forgot-password') ||
          requestUrl.includes('/auth/reset-password') ||
          requestUrl.includes('/auth/register');

        if (!isPublicAuthEndpoint) {
          window.dispatchEvent(
            new CustomEvent(AUTH_UNAUTHORIZED_EVENT, {
              detail: { status: response.status },
            }),
          )
        }
      }
 
      return {
        success: false,
        data: null,
        message: envelope?.message ?? null,
        error: getStatusErrorMessage(response.status, payload),
        errors: envelope?.errors ?? null,
        traceId: envelope?.traceId ?? null,
        status: response.status,
        url: requestUrl,
      }
    }
 
    if (envelope?.success === false) {
      return {
        success: false,
        data: null,
        message: envelope.message,
        error: sanitizeApiError(getErrorMessage(payload, 'The request could not be completed. Please try again.'), response.status),
        errors: envelope.errors,
        traceId: envelope.traceId,
        status: response.status,
        url: requestUrl,
      }
    }

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      notifyDataMutation({ method, endpoint, url: requestUrl })
    }
 
    return {
      success: true,
      data: envelope ? envelope.data : payload,
      message: envelope?.message ?? null,
      error: null,
      errors: null,
      traceId: envelope?.traceId ?? null,
      status: response.status,
      url: requestUrl,
    }
  } catch (error) {
    const isAbort = error instanceof DOMException && error.name === 'AbortError'
    const isCancelled = isAbort && !didTimeOut
    const isNetworkFailure =
      error instanceof TypeError &&
      /failed to fetch|networkerror|load failed/i.test(error.message)

    // Automatic single retry for transient network drops on idempotent GET requests
    if (method === 'GET' && !options._isRetry && (isNetworkFailure || didTimeOut) && !isCancelled && !signal?.aborted) {
      await new Promise((resolve) => window.setTimeout(resolve, 600))
      if (!signal?.aborted) {
        return apiRequest(endpoint, { ...options, _isRetry: true })
      }
    }

    if (isCancelled) {
      notifyApiStatus({
        status: 'cancelled',
        requestId,
        endpoint,
        url: requestUrl,
        method,
      })

      return {
        success: false,
        data: null,
        error: 'Request cancelled.',
        message: null,
        errors: null,
        traceId: null,
        status: 0,
        url: requestUrl,
        cancelled: true,
      }
    }

    let isServerDown = isNetworkFailure || didTimeOut
    if (isServerDown && endpoint !== '/health' && !endpoint.includes('/health')) {
      const isHealthy = await checkServerHealth()
      if (isHealthy) {
        isServerDown = false
      }
    }

    notifyApiStatus({
      status: isServerDown
        ? (didTimeOut ? 'timeout' : 'offline')
        : 'error',
      requestId,
      endpoint,
      url: requestUrl,
      method,
      message: isServerDown ? 'Unable to connect to the server.' : '',
    })

    return {
      success: false,
      data: null,
      error: didTimeOut
        ? 'The request timed out. Please try again.'
        : isNetworkFailure
          ? 'Unable to connect to the server.'
          : error instanceof Error
            ? sanitizeApiError(error.message)
            : 'Unable to connect to the server.',
      message: null,
      errors: null,
      traceId: null,
      status: 0,
      url: requestUrl,
      cancelled: false,
    }
  } finally {
    window.clearTimeout(timeoutId)
  }
}

export default apiRequest
