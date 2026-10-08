import { apiRequest } from './apiClient'
import { API_ENDPOINTS } from './endpoints'

/**
 * Purchase Returns API
 *
 * All Purchase Return data must come from the backend.
 * No mock/fallback data is used here.
 */

/**
 * Get all purchase returns.
 */
export const getPurchaseReturns = async () => {
  const response = await apiRequest(
    API_ENDPOINTS.purchaseReturns.list
  )

  return response
}

/**
 * Get a single purchase return by ID.
 */
export const getPurchaseReturnById = async (id) => {
  if (!id) {
    throw new Error(
      'Purchase Return ID is required.'
    )
  }

  const response = await apiRequest(
    API_ENDPOINTS.purchaseReturns.byId(id)
  )

  return response
}

/**
 * Create a purchase return.
 */
export const createPurchaseReturn = async (
  payload
) => {
  if (!payload) {
    throw new Error(
      'Purchase Return data is required.'
    )
  }

  const response = await apiRequest(
    API_ENDPOINTS.purchaseReturns.create,
    {
      method: 'POST',
      body: payload,
    }
  )

  return response
}

/**
 * Update an existing purchase return.
 */
export const updatePurchaseReturn = async (
  id,
  payload
) => {
  if (!id) {
    throw new Error(
      'Purchase Return ID is required.'
    )
  }

  if (!payload) {
    throw new Error(
      'Purchase Return data is required.'
    )
  }

  const response = await apiRequest(
    API_ENDPOINTS.purchaseReturns.update(id),
    {
      method: 'PUT',
      body: payload,
    }
  )

  return response
}

/**
 * Delete a purchase return.
 */
export const deletePurchaseReturn = async (
  id
) => {
  if (!id) {
    throw new Error(
      'Purchase Return ID is required.'
    )
  }

  const response = await apiRequest(
    API_ENDPOINTS.purchaseReturns.delete(id),
    {
      method: 'DELETE',
    }
  )

  return response
}

/**
 * Get suppliers available for Purchase Returns.
 *
 * Backend should return only suppliers relevant
 * to purchase return processing.
 */
export const getPurchaseReturnSuppliers =
  async () => {
    const response = await apiRequest(
      API_ENDPOINTS.purchaseReturns.suppliers
    )

    return response?.data ?? []
  }

/**
 * Get GRNs available for Purchase Returns.
 */
export const getPurchaseReturnGrns =
  async (supplierId) => {
    const response = await apiRequest(
      API_ENDPOINTS.purchaseReturns.grns,
      { query: supplierId ? { supplierId } : undefined }
    )

    return response?.data ?? []
  }

/**
 * Get items belonging to a GRN.
 *
 * Used while creating/editing a Purchase Return.
 */
export const getPurchaseReturnGrnItems =
  async (grnId) => {
    if (!grnId) {
      throw new Error(
        'GRN ID is required.'
      )
    }

    const response = await apiRequest(
      API_ENDPOINTS.purchaseReturns.grnItems(
        grnId
      )
    )

    return response?.data ?? []
  }