import { apiRequest, getResponseData, getResponseList } from './apiClient'
import { API_ENDPOINTS } from './endpoints'

/**
 * Normalizes raw API response item for a Sales Return header and items based strictly on:
 * - sales_returns (return_id, invoice_id, customer_id, return_date, total_amount, reason)
 * - sales_return_items (id, return_id, product_id, variant_id, quantity, price)
 */
export function normalizeSalesReturn(item = {}) {
  if (!item || typeof item !== 'object' || Object.keys(item).length === 0) return null

  const salesReturnId = item.salesReturnId ?? item.SalesReturnId ?? item.id ?? item.return_id ?? ''
  if (!salesReturnId && !item.returnNumber && !item.ReturnNumber && !item.return_number) return null

  const id = String(salesReturnId)
  const returnNumber = item.returnNumber ?? item.ReturnNumber ?? item.return_number ?? (id ? `SRR-${String(id).padStart(6, '0')}` : '')
  const returnId = id || returnNumber

  const invoiceId = item.invoiceId ?? item.InvoiceId ?? item.invoice_id ?? ''
  const invoiceNumber = item.invoiceNumber ?? item.InvoiceNumber ?? item.invoice_number ?? (invoiceId ? `SINV-${invoiceId}` : '')

  const customerId = item.customerId ?? item.CustomerId ?? item.customer_id ?? ''
  const customerName = item.customerName ?? item.CustomerName ?? item.customer_name ?? (item.customer?.name || '')

  const returnDate = item.returnDate ?? item.ReturnDate ?? item.return_date ?? item.createdAt ?? item.CreatedAt ?? ''
  const totalAmount = Number(item.totalReturnAmount ?? item.TotalReturnAmount ?? item.totalAmount ?? item.total_amount ?? 0)
  const reason = String(item.reason ?? item.Reason ?? '').trim()
  const status = String(item.status ?? item.Status ?? 'Completed').trim()

  const rawItems = Array.isArray(item.items)
    ? item.items
    : Array.isArray(item.Items)
    ? item.Items
    : Array.isArray(item.salesReturnItems)
    ? item.salesReturnItems
    : Array.isArray(item.SalesReturnItems)
    ? item.SalesReturnItems
    : Array.isArray(item.sales_return_items)
    ? item.sales_return_items
    : []

  const items = rawItems.map((line, idx) => {
    const lineQty = Number(line.returnQuantity ?? line.ReturnQuantity ?? line.quantity ?? line.qty ?? 0)
    const linePrice = Number(line.price ?? line.Price ?? line.unitPrice ?? 0)
    const invoicedQty = Number(line.invoicedQuantity ?? line.InvoicedQuantity ?? line.receivedQuantity ?? lineQty)
    const lineTotal = Number(line.total ?? line.Total ?? lineQty * linePrice)

    return {
      id: line.salesReturnItemId ?? line.SalesReturnItemId ?? line.id ?? idx + 1,
      salesReturnItemId: line.salesReturnItemId ?? line.SalesReturnItemId ?? line.id ?? idx + 1,
      returnId: line.returnId ?? line.return_id ?? id,
      productId: line.productId ?? line.ProductId ?? line.product_id ?? '',
      productName: line.productName ?? line.ProductName ?? line.product?.name ?? '',
      variantId: line.variantId ?? line.VariantId ?? line.variant_id ?? null,
      variantName: line.variantName ?? line.VariantName ?? '',
      invoicedQuantity: invoicedQty,
      receivedQuantity: invoicedQty,
      returnQuantity: lineQty,
      quantity: lineQty,
      price: linePrice,
      total: lineTotal,
    }
  })

  return {
    ...item,
    id,
    salesReturnId: id,
    returnId,
    returnNumber,
    invoiceId,
    invoiceNumber,
    customerId,
    customerName,
    returnDate,
    totalAmount,
    totalReturnAmount: totalAmount,
    reason,
    status,
    items,
  }
}

/**
 * Fetch all sales returns.
 */
export async function getSalesReturns(query = {}) {
  const response = await apiRequest(API_ENDPOINTS.salesReturns.list, { query })
  if (!response.success) return response

  const list = getResponseList(response)
  return {
    ...response,
    data: list.map(normalizeSalesReturn).filter(Boolean),
  }
}

/**
 * Fetch a single sales return by ID.
 */
export async function getSalesReturnById(id) {
  const response = await apiRequest(API_ENDPOINTS.salesReturns.byId(id))
  if (!response.success) return response

  const data = getResponseData(response, null)
  const normalized = normalizeSalesReturn(data)

  if (!normalized) {
    return {
      ...response,
      success: false,
      data: null,
      error: 'Sales return record not found on server.',
    }
  }

  return {
    ...response,
    data: normalized,
  }
}

/**
 * Fetch invoice items for a sales return (with invoiced qty, price, and remaining returnable qty).
 */
export async function getSalesReturnInvoiceItems(invoiceId) {
  const response = await apiRequest(API_ENDPOINTS.salesReturns.invoiceItems(invoiceId))
  if (!response.success) return response
  const list = getResponseList(response)
  return {
    ...response,
    data: list,
  }
}

/**
 * Fetch customers dropdown for sales return.
 */
export async function getSalesReturnCustomers() {
  const response = await apiRequest(API_ENDPOINTS.salesReturns.customers)
  if (!response.success) return response
  const list = getResponseList(response)
  return {
    ...response,
    data: list,
  }
}

/**
 * Fetch invoices for customer.
 */
export async function getSalesReturnInvoices(customerId) {
  const response = await apiRequest(API_ENDPOINTS.salesReturns.customerInvoices(customerId))
  if (!response.success) return response
  const list = getResponseList(response)
  return {
    ...response,
    data: list,
  }
}

/**
 * Create a new sales return.
 */
export async function createSalesReturn(payload) {
  const customerId = Number(payload.customerId ?? payload.CustomerId ?? payload.customer_id)
  const invoiceId = Number(payload.invoiceId ?? payload.InvoiceId ?? payload.invoice_id)
  const returnDate = payload.returnDate ?? payload.ReturnDate ?? payload.return_date ?? new Date().toISOString()
  const reason = String(payload.reason ?? payload.Reason ?? '').trim()

  const rawItems = Array.isArray(payload.items) ? payload.items : Array.isArray(payload.Items) ? payload.Items : []
  const items = rawItems.map((item) => {
    const qty = Number(item.returnQuantity ?? item.ReturnQuantity ?? item.quantity ?? item.qty ?? 0)
    const varId = item.variantId || item.VariantId || item.variant_id ? Number(item.variantId ?? item.VariantId ?? item.variant_id) : null
    const pId = Number(item.productId ?? item.ProductId ?? item.product_id)

    return {
      productId: pId,
      variantId: varId,
      returnQuantity: qty,
    }
  })

  const body = {
    customerId,
    invoiceId,
    returnDate,
    reason,
    items,
  }

  return apiRequest(API_ENDPOINTS.salesReturns.list, {
    method: 'POST',
    body,
  })
}

/**
 * Update an existing sales return.
 */
export async function updateSalesReturn(id, payload) {
  const customerId = Number(payload.customerId ?? payload.CustomerId ?? payload.customer_id)
  const invoiceId = Number(payload.invoiceId ?? payload.InvoiceId ?? payload.invoice_id)
  const returnDate = payload.returnDate ?? payload.ReturnDate ?? payload.return_date
  const reason = String(payload.reason ?? payload.Reason ?? '').trim()

  const rawItems = Array.isArray(payload.items) ? payload.items : Array.isArray(payload.Items) ? payload.Items : []
  const items = rawItems.map((item) => {
    const qty = Number(item.returnQuantity ?? item.ReturnQuantity ?? item.quantity ?? item.qty ?? 0)
    const varId = item.variantId || item.VariantId || item.variant_id ? Number(item.variantId ?? item.VariantId ?? item.variant_id) : null
    const pId = Number(item.productId ?? item.ProductId ?? item.product_id)

    return {
      productId: pId,
      variantId: varId,
      returnQuantity: qty,
    }
  })

  const body = {
    customerId,
    invoiceId,
    returnDate,
    reason,
    items,
  }

  return apiRequest(API_ENDPOINTS.salesReturns.byId(id), {
    method: 'PUT',
    body,
  })
}

/**
 * Delete a sales return.
 */
export async function deleteSalesReturn(id) {
  return apiRequest(API_ENDPOINTS.salesReturns.byId(id), {
    method: 'DELETE',
  })
}
