import { apiRequest, getResponseData, getResponseList } from './apiClient'
import { API_ENDPOINTS } from './endpoints'

export function getAllBarcodes() {
  return apiRequest(API_ENDPOINTS.barcode.list)
}

export async function getBarcodes(products = []) {
  const response = await getAllBarcodes()

  if (!response.success) {
    return response
  }

  const rawBarcodes = getResponseList(response)
  const normalizedBarcodes = rawBarcodes.map((item) => normalizeBarcode(item, products))

  return {
    ...response,
    data: normalizedBarcodes,
  }
}

export async function generateBarcode(productId, products = []) {
  const response = await apiRequest(API_ENDPOINTS.barcode.generate, {
    method: 'POST',
    query: {
      productId: Number(productId) || productId,
    },
  })

  if (!response.success) {
    return response
  }

  const rawBarcode = getResponseData(response, {})
  const normalizedBarcode = normalizeBarcode(rawBarcode, products)

  return {
    ...response,
    data: normalizedBarcode,
  }
}

export function normalizeBarcode(item = {}, products = []) {
  const id = String(item.id || item.barcodeId || item.BarcodeId || '')
  const productId = String(item.productId || item.ProductId || '')
  const product = products.find((p) => String(p.id) === productId || String(p.productId) === productId)
  const productName = item.productName || item.ProductName || product?.name || 'Unknown Product'
  
  const rawValue = item.value || item.Value || item.code || item.Code || ''
  const codeType = item.codeType || item.CodeType || (rawValue.startsWith('QR:') ? 'QR Code' : 'Barcode')
  const dateVal = item.date || item.Date || item.createdAt || item.CreatedAt || new Date().toISOString().split('T')[0]
  const date = String(dateVal).split('T')[0]

  return {
    ...item,
    id,
    productId,
    productName,
    codeType,
    value: rawValue,
    preview: codeType === 'QR Code' ? `[ QR ] ${productName}` : `|||| ${rawValue} ||||`,
    date,
  }
}
