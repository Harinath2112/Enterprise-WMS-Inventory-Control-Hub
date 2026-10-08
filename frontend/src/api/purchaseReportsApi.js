import { apiRequest, getResponseData } from './apiClient'
import { API_ENDPOINTS } from './endpoints'

export async function getPurchaseReport(query = {}) {
  const response = await apiRequest(API_ENDPOINTS.reports.purchases, { query })

  if (!response.success) {
    return response
  }

  const rawData = getResponseData(response, {})
  return {
    ...response,
    data: rawData,
  }
}

export function getPurchaseReportErrorMessage(response, fallback = 'Failed to load purchase report data.') {
  if (typeof response === 'string') return response
  return response?.message || response?.error || fallback
}
