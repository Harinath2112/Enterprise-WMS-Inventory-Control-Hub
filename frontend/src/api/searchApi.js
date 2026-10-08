import { apiRequest, getResponseList } from './apiClient'
import { API_ENDPOINTS } from './endpoints'

const SEARCH_COUNT_ENDPOINTS = {
  Product: { endpoint: API_ENDPOINTS.products.list, listKey: 'products' },
  Customer: { endpoint: API_ENDPOINTS.customers.list, listKey: 'customers' },
  Supplier: { endpoint: API_ENDPOINTS.suppliers.list, listKey: 'suppliers' },
  Brand: { endpoint: API_ENDPOINTS.brands.list },
  Category: { endpoint: API_ENDPOINTS.categories.list },
  SubCategory: { endpoint: API_ENDPOINTS.subCategories.list },
}

export async function searchGlobal(query, options = {}) {
  const response = await apiRequest(API_ENDPOINTS.search.global, {
    query: { query },
    signal: options.signal,
    timeoutMs: 15000,
  })

  if (!response.success) {
    return response
  }

  return {
    ...response,
    data: getResponseList(response),
  }
}

export async function getGlobalSearchCounts() {
  const entries = Object.entries(SEARCH_COUNT_ENDPOINTS)
  const responses = await Promise.allSettled(
    entries.map(([, config]) => apiRequest(config.endpoint, { timeoutMs: 10000 })),
  )

  return responses.reduce((counts, response, index) => {
    const [type, config] = entries[index]

    if (response.status !== 'fulfilled' || !response.value.success) {
      return counts
    }

    const rows = getResponseList(response.value, config.listKey)

    return {
      ...counts,
      [type]: rows.length,
    }
  }, {})
}
