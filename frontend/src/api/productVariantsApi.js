import { apiRequest, getResponseList } from './apiClient'
import { API_ENDPOINTS } from './endpoints'

export function getAllVariants() {
  return apiRequest(API_ENDPOINTS.productVariants.list)
}

export async function getVariantsByProduct(productId) {
  const response = await getAllVariants()

  if (!response.success) {
    return response
  }

  const variants = getResponseList(response, 'variants')

  return {
    ...response,
    data: variants.filter((variant) => {
      const currentProductId = variant.productId ?? variant.product?.id ?? variant.product_id
      return String(currentProductId) === String(productId)
    }),
  }
}

export function getVariantById(id) {
  return apiRequest(API_ENDPOINTS.productVariants.byId(id))
}

export function createVariant(productId, data) {
  return apiRequest(API_ENDPOINTS.productVariants.byProduct(productId), {
    method: 'POST',
    body: data,
  })
}

export function updateVariant(id, data) {
  return apiRequest(API_ENDPOINTS.productVariants.byId(id), {
    method: 'PUT',
    body: data,
  })
}

export function deleteVariant(id) {
  return apiRequest(API_ENDPOINTS.productVariants.byId(id), {
    method: 'DELETE',
  })
}
