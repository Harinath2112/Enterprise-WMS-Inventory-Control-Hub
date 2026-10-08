import { apiRequest } from './apiClient'

function requireId(id, action = 'perform this action') {
  if (id === undefined || id === null || String(id).trim() === '') {
    throw new Error(`A Purchase Indent ID is required to ${action}.`)
  }

  return encodeURIComponent(String(id).trim())
}

export function getPurchaseIndents(page = 1, pageSize = 10, options = {}) {
  return apiRequest('/PurchaseIndents', {
    ...options,
    query: {
      page,
      pageSize,
      ...(options.query || {}),
    },
  })
}

export function getPurchaseIndent(id, options = {}) {
  return apiRequest(`/PurchaseIndents/${requireId(id, 'load the Purchase Indent')}`, options)
}

export function createPurchaseIndent(data, options = {}) {
  return apiRequest('/PurchaseIndents', {
    ...options,
    method: 'POST',
    body: data,
  })
}

export function updatePurchaseIndent(id, data, options = {}) {
  return apiRequest(`/PurchaseIndents/${requireId(id, 'update the Purchase Indent')}`, {
    ...options,
    method: 'PUT',
    body: data,
  })
}

export function deletePurchaseIndent(id, options = {}) {
  return apiRequest(`/PurchaseIndents/${requireId(id, 'delete the Purchase Indent')}`, {
    ...options,
    method: 'DELETE',
  })
}

export function getPurchaseIndentDashboard(options = {}) {
  return apiRequest('/PurchaseIndents/dashboard', options)
}

export function approvePurchaseIndent(id, options = {}) {
  return apiRequest(`/PurchaseIndents/${requireId(id, 'approve the Purchase Indent')}/approve`, {
    ...options,
    method: 'PUT',
  })
}

export function rejectPurchaseIndent(id, data, options = {}) {
  return apiRequest(`/PurchaseIndents/${requireId(id, 'reject the Purchase Indent')}/reject`, {
    ...options,
    method: 'PUT',
    body: data,
  })
}

export function convertPurchaseOrder(id, options = {}) {
  return apiRequest(`/PurchaseIndents/${requireId(id, 'convert the Purchase Indent')}/convert-po`, {
    ...options,
    method: 'POST',
  })
}
