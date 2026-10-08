import { apiRequest, buildApiHeaders, buildUrl, getResponseData, getResponseList, sanitizeApiError } from './apiClient'
import { API_ENDPOINTS } from './endpoints'
import { getCustomers } from './customersApi'
import { getProductCatalog } from './productApi'
import { getSuppliers, invalidateSupplierCache } from './suppliersApi'

function idOf(item, keys) {
  for (const key of keys) {
    if (item?.[key] !== undefined && item?.[key] !== null) {
      return String(item[key])
    }
  }
  return ''
}

function text(value) {
  return String(value ?? '').trim()
}

function number(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function dateOnly(value) {
  if (!value) return ''
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10)
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return String(value).slice(0, 10)
  }
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function normalizeStatus(value, fallback = 'Draft') {
  const raw = text(value || fallback).replace(/[_-]+/g, ' ')
  return raw ? raw.replace(/\b\w/g, (letter) => letter.toUpperCase()) : fallback
}

export function normalizePayment(item, partyType = 'customer') {
  const partyKey = partyType === 'supplier' ? 'supplier' : 'customer'
  const paymentId = idOf(item, ['paymentId', 'PaymentId', 'payment_id', 'id'])
  const paymentDate = dateOnly(item?.paymentDate ?? item?.PaymentDate ?? item?.payment_date)
  const generatedPaymentNumber = paymentId
    ? `PAY-${(paymentDate || new Date().toISOString().slice(0, 10)).replaceAll('-', '')}-${String(paymentId).padStart(3, '0')}`
    : ''

  const rawRef = text(
    item?.referenceNumber ?? item?.ReferenceNumber ?? item?.reference_number ??
    item?.referenceNo ?? item?.ReferenceNo ?? item?.reference_no ??
    item?.reference ?? item?.Reference ??
    item?.transactionId ?? item?.TransactionId ?? item?.txnId ?? item?.TxnId ??
    item?.chequeNo ?? item?.ChequeNo ?? item?.utrNumber ?? item?.UtrNumber
  )

  const generatedReferenceNumber = (rawRef && rawRef.toLowerCase() !== 'not provided' && rawRef.toLowerCase() !== 'n/a')
    ? rawRef
    : (paymentId ? `REF-PAY-${String(paymentId).padStart(4, '0')}` : '')

  return {
    ...item,
    id: idOf(item, ['id', 'paymentId', 'PaymentId', 'payment_id']),
    paymentId,
    paymentNumber: text(item?.paymentNumber ?? item?.PaymentNumber ?? item?.payment_number) || generatedPaymentNumber,
    invoiceId: idOf(item, ['invoiceId', 'InvoiceId', 'invoice_id']),
    invoiceNumber: text(item?.invoiceNumber ?? item?.InvoiceNumber ?? item?.invoice_number),
    invoiceStatus: normalizeStatus(item?.invoiceStatus ?? item?.InvoiceStatus ?? item?.invoice_status, ''),
    invoiceAmount: number(item?.invoiceAmount ?? item?.InvoiceAmount ?? item?.invoice_amount),
    outstandingBefore: number(item?.outstandingBefore ?? item?.OutstandingBefore ?? item?.outstanding_before),
    outstandingAfter: number(item?.outstandingAfter ?? item?.OutstandingAfter ?? item?.outstanding_after),
    partyName: text(item?.[partyKey] ?? item?.partyName ?? item?.customerName ?? item?.supplierName ?? item?.customer_name ?? item?.supplier_name),
    amount: number(item?.amount ?? item?.Amount),
    paymentDate,
    paymentMethod: text(item?.paymentMethod ?? item?.PaymentMethod ?? item?.payment_method) || 'Bank Transfer',
    referenceNumber: generatedReferenceNumber,
    notes: text(item?.notes ?? item?.Notes),
    createdBy: text(item?.createdBy ?? item?.CreatedBy ?? item?.created_by) || 'System',
    createdAt: dateOnly(item?.createdAt ?? item?.CreatedAt ?? item?.created_at),
    cancelledAt: dateOnly(item?.cancelledAt ?? item?.CancelledAt ?? item?.cancelled_at),
    cancellationReason: text(item?.cancellationReason ?? item?.CancellationReason ?? item?.cancellation_reason),
    poId: idOf(item, ['poId', 'PoId', 'po_id']),
    status: normalizeStatus(item?.status ?? item?.Status ?? 'Pending', 'Pending'),
  }
}

export function groupFlatPurchaseOrders(rawList) {
  if (!Array.isArray(rawList)) return []

  const groupedMap = new Map()

  for (const item of rawList) {
    if (!item || typeof item !== 'object') continue

    const poKey =
      idOf(item, ['id', 'poId', 'PoId', 'purchaseOrderId', 'PurchaseOrderId']) ||
      text(item?.poNumber ?? item?.PoNumber ?? item?.purchaseOrderNumber ?? item?.PurchaseOrderNumber)

    if (!poKey) {
      groupedMap.set(Symbol('standalone'), { ...item, items: item.items || [item] })
      continue
    }

    if (!groupedMap.has(poKey)) {
      const initialItems = Array.isArray(item.items) && item.items.length > 0
        ? [...item.items]
        : (item.productId || item.ProductId || item.productName || item.ProductName || item.quantity || item.Quantity ? [{ ...item }] : [])

      groupedMap.set(poKey, {
        ...item,
        items: initialItems,
      })
    } else {
      const existingPo = groupedMap.get(poKey)
      const newItems = Array.isArray(item.items) && item.items.length > 0
        ? item.items
        : (item.productId || item.ProductId || item.productName || item.ProductName || item.quantity || item.Quantity ? [{ ...item }] : [])

      for (const newItem of newItems) {
        const newProdId = newItem?.productId ?? newItem?.ProductId ?? newItem?.id ?? newItem?.Id
        const newProdName = newItem?.productName ?? newItem?.ProductName ?? newItem?.product ?? newItem?.Product
        const isDuplicate = existingPo.items.some((existing) => {
          const exProdId = existing?.productId ?? existing?.ProductId ?? existing?.id ?? existing?.Id
          const exProdName = existing?.productName ?? existing?.ProductName ?? existing?.product ?? existing?.Product
          if (newProdId && exProdId && String(newProdId) === String(exProdId)) return true
          if (!newProdId && !exProdId && newProdName && exProdName && String(newProdName).toLowerCase() === String(exProdName).toLowerCase()) return true
          return false
        })

        if (!isDuplicate) {
          existingPo.items.push(newItem)
        }
      }
    }
  }

  return Array.from(groupedMap.values())
}

export function normalizePurchaseOrder(item) {
  const rawStatus = normalizeStatus(item?.status ?? item?.Status, 'Ordered')
  const rawItems = item?.items ?? item?.Items ?? item?.lineItems ?? item?.LineItems ?? item?.orderItems ?? item?.OrderItems ?? item?.purchaseOrderItems ?? item?.PurchaseOrderItems ?? item?.lines ?? item?.Lines ?? item?.products ?? item?.Products ?? []
  let items = Array.isArray(rawItems) ? [...rawItems] : []

  const getPriceVal = (obj) => {
    if (!obj || typeof obj !== 'object') return undefined
    return obj.unitPrice ?? obj.UnitPrice ?? obj.unit_price ??
      obj.unitCost ?? obj.UnitCost ?? obj.unit_cost ??
      obj.price ?? obj.Price ??
      obj.purchasePrice ?? obj.PurchasePrice ?? obj.purchase_price ??
      obj.costPrice ?? obj.CostPrice ?? obj.cost_price ??
      obj.rate ?? obj.Rate ?? obj.cost ?? obj.Cost ??
      obj.buyingPrice ?? obj.BuyingPrice ?? obj.buying_price ??
      obj.unitPriceAmount ?? obj.UnitPriceAmount ?? obj.itemPrice ?? obj.ItemPrice ?? obj.item_price
  }

  if (items.length === 0 && (item?.productId || item?.ProductId || item?.productName || item?.ProductName || item?.price || item?.Price || item?.unitPrice || item?.UnitPrice || item?.unitCost || item?.UnitCost)) {
    items = [{
      ...item,
      unitPrice: getPriceVal(item),
      unitCost: getPriceVal(item),
      price: getPriceVal(item),
    }]
  }

  items = items.map((line) => {
    const qty = Number(line?.quantity ?? line?.Quantity ?? line?.orderedQuantity ?? line?.OrderedQuantity ?? line?.orderedQty ?? line?.OrderedQty ?? line?.requiredQty ?? line?.RequiredQty ?? line?.qty ?? line?.Qty ?? 0)
    const rawTotal = Number(line?.total ?? line?.Total ?? line?.lineTotal ?? line?.LineTotal ?? line?.amount ?? line?.Amount ?? 0)
    const calcPrice = (rawTotal > 0 && qty > 0) ? (rawTotal / qty) : 0

    const lineExplicit = Number(getPriceVal(line))
    const headerExplicit = Number(getPriceVal(item))

    let unitPrice = 0
    if (calcPrice > 0) {
      unitPrice = calcPrice
    } else if (Number.isFinite(lineExplicit) && lineExplicit > 0) {
      unitPrice = lineExplicit
    } else if (Number.isFinite(headerExplicit) && headerExplicit > 0) {
      unitPrice = headerExplicit
    }

    const total = rawTotal > 0 ? rawTotal : qty * unitPrice

    return {
      ...line,
      id: idOf(line, ['id', 'Id', 'purchaseOrderItemId', 'PurchaseOrderItemId']),
      productId: line?.productId ?? line?.ProductId ?? line?.id ?? line?.Id,
      productName: text(
        line?.productName ?? line?.ProductName ?? line?.product ?? line?.Product ?? line?.name ?? line?.Name
      ),
      productSku: text(
        line?.productSku ?? line?.ProductSku ?? line?.sku ?? line?.Sku ?? line?.SKU
      ),
      variantId: line?.variantId ?? line?.VariantId,
      variantName: text(line?.variantName ?? line?.VariantName ?? line?.variant ?? line?.Variant),
      unitName: text(line?.unitName ?? line?.UnitName ?? line?.unit ?? line?.Unit),
      quantity: qty,
      orderedQuantity: qty,
      receivedQuantity: Number(line?.receivedQuantity ?? line?.ReceivedQuantity ?? line?.quantityReceived ?? line?.QuantityReceived ?? 0),
      price: unitPrice,
      unitPrice: unitPrice,
      unitCost: unitPrice,
      cost: unitPrice,
      total: total,
      lineTotal: total,
      remarks: text(line?.remarks ?? line?.Remarks ?? line?.notes ?? line?.Notes),
    }
  })

  const getHeaderAmount = (obj) => {
    if (!obj || typeof obj !== 'object') return 0
    const candidates = [
      obj.totalAmount, obj.TotalAmount, obj.total_amount,
      obj.totalPrice, obj.TotalPrice, obj.total_price,
      obj.totalCost, obj.TotalCost, obj.total_cost,
      obj.grandTotal, obj.GrandTotal, obj.grand_total,
      obj.netAmount, obj.NetAmount, obj.net_amount,
      obj.subTotal, obj.SubTotal, obj.sub_total,
      obj.amount, obj.Amount,
      obj.total, obj.Total,
      obj.poAmount, obj.PoAmount, obj.po_amount,
      obj.price, obj.Price, obj.cost, obj.Cost,
    ]
    for (const val of candidates) {
      const num = Number(val)
      if (Number.isFinite(num) && num > 0) {
        return num
      }
    }
    return 0
  }

  const totalQuantity = items.reduce((sum, line) => sum + (Number(line.quantity) || 0), 0)
  const itemsTotalAmount = items.reduce((sum, line) => sum + (Number(line.total) || 0), 0)

  const headerTotal = getHeaderAmount(item)
  const finalTotalAmount = headerTotal > 0 ? headerTotal : itemsTotalAmount

  const firstItem = items[0] || {}
  const firstItemProductId = firstItem.productId ?? item?.productId ?? item?.ProductId
  const firstItemProductName = firstItem.productName || item?.productName || item?.ProductName || item?.product || item?.Product

  const idVal = idOf(item, ['id', 'poId', 'PoId', 'purchaseOrderId', 'PurchaseOrderId'])
  const poNumVal = text(item?.poNumber ?? item?.PoNumber ?? item?.purchaseOrderNumber ?? item?.PurchaseOrderNumber ?? (idVal ? `PO-${String(idVal).padStart(6, '0')}` : ''))

  return {
    ...item,
    id: idVal,
    poId: idVal,
    purchaseOrderId: idVal,
    poNumber: poNumVal,
    number: poNumVal,
    supplierId: idOf(item, ['supplierId', 'SupplierId', 'supplier_id', 'SupplierID', 'supplierID', 'vendorId', 'VendorId']),
    supplier: text(item?.supplier ?? item?.supplierName ?? item?.Supplier ?? item?.SupplierName ?? item?.companyName ?? item?.CompanyName),
    supplierName: text(item?.supplierName ?? item?.SupplierName ?? item?.supplier ?? item?.Supplier ?? item?.companyName ?? item?.CompanyName),
    productId: firstItemProductId ? String(firstItemProductId) : idOf(item, ['productId', 'ProductId']),
    productName: text(firstItemProductName) || text(item?.productName ?? item?.ProductName ?? item?.product ?? item?.Product),
    variantId: idOf(firstItem, ['variantId', 'VariantId']) || idOf(item, ['variantId', 'VariantId']),
    quantity: totalQuantity || Number(item?.quantity ?? item?.Quantity ?? 0),
    price: firstItem.price || 0,
    unitPrice: firstItem.unitPrice || 0,
    unitCost: firstItem.unitPrice || 0,
    items,
    orderDate: dateOnly(item?.orderDate ?? item?.OrderDate),
    expectedDate: dateOnly(item?.expectedDate ?? item?.ExpectedDate),
    status: rawStatus.toLowerCase() === 'pending' ? 'Ordered' : rawStatus,
    totalAmount: finalTotalAmount,
    notes: text(item?.notes ?? item?.Notes),
  }
}

function ensureUniquePurchaseOrderNumbers(purchaseOrders) {
  const usedNumbers = new Set()
  const highestSequenceByPrefix = new Map()

  purchaseOrders.forEach((purchase) => {
    const match = text(purchase?.poNumber).match(/^(.*-)(\d+)$/)

    if (!match) return

    const [, prefix, sequenceText] = match
    highestSequenceByPrefix.set(
      prefix,
      Math.max(highestSequenceByPrefix.get(prefix) || 0, Number(sequenceText)),
    )
  })

  return purchaseOrders.map((purchase) => {
    const originalNumber = text(purchase?.poNumber)
    const candidateNumber = originalNumber ||
      (purchase?.poId ? `PO-${String(purchase.poId).padStart(6, '0')}` : '')

    if (!usedNumbers.has(candidateNumber)) {
      usedNumbers.add(candidateNumber)
      return { ...purchase, poNumber: candidateNumber }
    }

    const match = candidateNumber.match(/^(.*-)(\d+)$/)
    const prefix = match?.[1] || `${candidateNumber}-`
    const sequenceWidth = match?.[2]?.length || 3
    let nextSequence = (highestSequenceByPrefix.get(prefix) || 0) + 1
    let uniqueNumber = `${prefix}${String(nextSequence).padStart(sequenceWidth, '0')}`

    while (usedNumbers.has(uniqueNumber)) {
      nextSequence += 1
      uniqueNumber = `${prefix}${String(nextSequence).padStart(sequenceWidth, '0')}`
    }

    highestSequenceByPrefix.set(prefix, nextSequence)
    usedNumbers.add(uniqueNumber)

    return { ...purchase, poNumber: uniqueNumber }
  })
}

export function normalizeSalesReturn(item) {
  const source = item?.return ?? item?.Return ?? item
  const rawItems = item?.items ?? item?.Items ?? []
  const rawHistory = item?.history ?? item?.History ?? []
  const rawRefunds = item?.refunds ?? item?.Refunds ?? []
  const rawAdjustments = item?.adjustments ?? item?.Adjustments ?? []

  return {
    ...source,
    id: idOf(source, ['id', 'returnId', 'ReturnId']),
    returnId: idOf(source, ['returnId', 'ReturnId', 'id']),
    returnNumber: text(source?.returnNumber ?? source?.ReturnNumber) || (idOf(source, ['returnId', 'ReturnId', 'id']) ? `RET-${String(idOf(source, ['returnId', 'ReturnId', 'id'])).padStart(3, '0')}` : ''),
    invoiceId: idOf(source, ['invoiceId', 'InvoiceId']),
    invoiceNumber: text(source?.invoiceNumber ?? source?.InvoiceNumber),
    customerId: idOf(source, ['customerId', 'CustomerId']),
    customer: text(source?.customer ?? source?.customerName ?? source?.Customer),
    totalAmount: number(source?.totalAmount ?? source?.TotalAmount),
    returnDate: dateOnly(source?.returnDate ?? source?.ReturnDate),
    reason: text(source?.reason ?? source?.Reason),
    status: normalizeStatus(source?.status ?? 'pending', 'Pending'),
    createdBy: text(source?.createdBy ?? source?.CreatedBy),
    createdAt: dateOnly(source?.createdAt ?? source?.CreatedAt),
    approvedBy: text(source?.approvedBy ?? source?.ApprovedBy),
    approvedAt: dateOnly(source?.approvedAt ?? source?.ApprovedAt),
    rejectedBy: text(source?.rejectedBy ?? source?.RejectedBy),
    rejectedAt: dateOnly(source?.rejectedAt ?? source?.RejectedAt),
    processedBy: text(source?.processedBy ?? source?.ProcessedBy),
    processedAt: dateOnly(source?.processedAt ?? source?.ProcessedAt),
    refundedBy: text(source?.refundedBy ?? source?.RefundedBy),
    refundedAt: dateOnly(source?.refundedAt ?? source?.RefundedAt),
    invoiceAdjustmentAmount: number(source?.invoiceAdjustmentAmount ?? source?.InvoiceAdjustmentAmount),
    refundedAmount: number(source?.refundedAmount ?? source?.RefundedAmount),
    items: Array.isArray(rawItems) ? rawItems.map((line) => ({
      ...line,
      id: idOf(line, ['id', 'Id']),
      productId: idOf(line, ['productId', 'ProductId']),
      productName: text(line?.productName ?? line?.ProductName),
      productSku: text(line?.productSku ?? line?.ProductSku),
      variantId: idOf(line, ['variantId', 'VariantId']),
      quantity: number(line?.quantity ?? line?.Quantity),
      price: number(line?.price ?? line?.Price),
      total: number(line?.total ?? line?.Total),
    })) : [],
    history: Array.isArray(rawHistory) ? rawHistory.map((entry) => ({
      ...entry,
      id: idOf(entry, ['id', 'Id']),
      oldStatus: normalizeStatus(entry?.oldStatus ?? entry?.OldStatus, ''),
      newStatus: normalizeStatus(entry?.newStatus ?? entry?.NewStatus, ''),
      action: text(entry?.action ?? entry?.Action),
      actor: text(entry?.actor ?? entry?.Actor),
      comments: text(entry?.comments ?? entry?.Comments),
      createdAt: dateOnly(entry?.createdAt ?? entry?.CreatedAt),
    })) : [],
    refunds: Array.isArray(rawRefunds) ? rawRefunds.map((refund) => ({
      ...refund,
      id: idOf(refund, ['id', 'Id']),
      refundAmount: number(refund?.refundAmount ?? refund?.RefundAmount),
      refundMethod: text(refund?.refundMethod ?? refund?.RefundMethod),
      refundDate: dateOnly(refund?.refundDate ?? refund?.RefundDate),
      status: normalizeStatus(refund?.status ?? refund?.Status, 'Pending'),
      notes: text(refund?.notes ?? refund?.Notes),
    })) : [],
    adjustments: Array.isArray(rawAdjustments) ? rawAdjustments.map((adjustment) => ({
      ...adjustment,
      id: idOf(adjustment, ['id', 'Id']),
      adjustmentType: text(adjustment?.adjustmentType ?? adjustment?.AdjustmentType),
      amount: number(adjustment?.amount ?? adjustment?.Amount),
      status: normalizeStatus(adjustment?.status ?? adjustment?.Status, 'Completed'),
      notes: text(adjustment?.notes ?? adjustment?.Notes),
      createdAt: dateOnly(adjustment?.createdAt ?? adjustment?.CreatedAt),
    })) : [],
  }
}

export function normalizeInvoice(item) {
  const id = idOf(item, ['id', 'invoiceId', 'InvoiceId'])
  const rawItems =
    item?.items ??
    item?.Items ??
    item?.invoiceItems ??
    item?.InvoiceItems ??
    item?.lineItems ??
    item?.LineItems ??
    item?.lines ??
    item?.Lines ??
    item?.details ??
    item?.Details ??
    item?.invoiceDetails ??
    item?.InvoiceDetails ??
    item?.products ??
    item?.Products ??
    []

  let validRawItems = Array.isArray(rawItems) && rawItems.length > 0
    ? rawItems
    : (item?.productId || item?.ProductId || item?.product_id || item?.productName || item?.ProductName)
    ? [{ ...item }]
    : []

  const normalizedItems = validRawItems.map((line) => {
    const qty = number(line?.quantity ?? line?.Quantity ?? line?.qty ?? line?.Qty)
    const taxPct = number(line?.taxPercent ?? line?.TaxPercent ?? line?.tax ?? line?.Tax ?? line?.taxRate ?? line?.TaxRate ?? line?.gstRate ?? line?.GstRate)
    const discPct = number(line?.discountPercent ?? line?.DiscountPercent ?? line?.discount ?? line?.Discount)
    const rawUnitPrice = number(line?.unitPrice ?? line?.UnitPrice)
    const rawPrice = number(line?.price ?? line?.Price ?? line?.salePrice ?? line?.SalePrice)
    const rawTotal = number(line?.total ?? line?.Total ?? line?.lineTotal ?? line?.LineTotal ?? line?.amount ?? line?.Amount)

    let unitPrice = rawUnitPrice || rawPrice

    const gross = qty * unitPrice
    const discAmount = number(line?.discountAmount ?? line?.DiscountAmount ?? line?.lineDiscount ?? line?.LineDiscount ?? (gross * discPct / 100))
    const taxable = Math.max(0, gross - discAmount)
    const taxAmount = number(line?.taxAmount ?? line?.TaxAmount ?? line?.gstAmount ?? line?.GstAmount ?? (taxable * taxPct / 100))

    return {
      ...line,
      id: idOf(line, ['id', 'Id']),
      productId: idOf(line, ['productId', 'ProductId', 'id', 'Id']),
      productName: text(
        line?.productName ??
          line?.ProductName ??
          line?.name ??
          line?.Name ??
          line?.product?.name ??
          line?.product?.Name ??
          line?.Product?.name ??
          line?.Product?.Name,
      ),
      productSku: text(
        line?.productSku ??
          line?.ProductSku ??
          line?.sku ??
          line?.Sku ??
          line?.SKU ??
          line?.product?.sku ??
          line?.Product?.SKU,
      ),
      productImageUrl: text(line?.productImageUrl ?? line?.ProductImageUrl ?? line?.imageUrl ?? line?.ImageUrl),
      variantId: idOf(line, ['variantId', 'VariantId']),
      unit: text(line?.unit ?? line?.Unit ?? line?.unitName ?? line?.UnitName ?? line?.uom ?? line?.Uom ?? line?.UOM),
      quantity: qty,
      unitPrice: number(unitPrice || rawPrice),
      price: number(rawPrice || unitPrice),
      discountPercent: discPct,
      discountAmount: discAmount,
      taxPercent: taxPct,
      taxAmount: taxAmount,
      total: rawTotal > 0 ? rawTotal : taxable + taxAmount,
      returnedQuantity: number(line?.returnedQuantity ?? line?.ReturnedQuantity ?? line?.returnQuantity ?? line?.ReturnQuantity),
      returnedAmount: number(line?.returnedAmount ?? line?.ReturnedAmount),
      returnReferences: line?.returnReferences ?? line?.ReturnReferences ?? [],
    }
  })

  return {
    ...item,
    id,
    invoiceId: id,
    soId: idOf(item, ['soId', 'SoId']),
    customerId: idOf(item, ['customerId', 'CustomerId']),
    customerName: text(
      item?.customerName ??
        item?.CustomerName ??
        item?.customer ??
        item?.Customer?.name ??
        item?.Customer?.Name,
    ),
    customer: text(
      item?.customer ??
        item?.Customer ??
        item?.customerName ??
        item?.CustomerName,
    ),
    customerEmail: text(item?.customerEmail ?? item?.CustomerEmail ?? item?.Customer?.email ?? item?.Customer?.Email),
    invoiceNumber: text(item?.invoiceNumber ?? item?.InvoiceNumber),
    invoiceDate: dateOnly(item?.invoiceDate ?? item?.InvoiceDate),
    dueDate: dateOnly(item?.dueDate ?? item?.DueDate),
    status: normalizeStatus(item?.status ?? item?.Status, 'Unpaid'),
    totalAmount: number(item?.totalAmount ?? item?.TotalAmount),
    paidAmount: number(item?.paidAmount ?? item?.PaidAmount),
    balanceAmount: number(item?.balanceAmount ?? item?.BalanceAmount),
    paymentMethod: text(item?.paymentMethod ?? item?.PaymentMethod ?? item?.payment_method ?? 'N/A'),
    returnedAmount: number(item?.returnedAmount ?? item?.ReturnedAmount),
    adjustedOutstanding: number(item?.adjustedOutstanding ?? item?.AdjustedOutstanding ?? item?.balanceAmount ?? item?.BalanceAmount),
    returnStatus: text(item?.returnStatus ?? item?.ReturnStatus),
    returnReferences: item?.returnReferences ?? item?.ReturnReferences ?? [],
    itemCount: normalizedItems.length > 0 ? normalizedItems.length : number(item?.itemCount ?? item?.ItemCount ?? validRawItems.length),
    items: normalizedItems,
  }
}

export function normalizeReportRow(item, reportType, index = 0) {
  const id = idOf(item, ['id', 'soId', 'poId', 'invoiceId', 'stockId', 'customerId', 'supplierId', 'productId', 'Id', 'SoId', 'PoId', 'InvoiceId', 'StockId', 'CustomerId', 'SupplierId', 'ProductId'])
  return {
    ...item,
    id: id || `${reportType}-${index}`,
    reportType,
    soId: idOf(item, ['soId', 'SoId']),
    poId: idOf(item, ['poId', 'PoId']),
    invoiceId: idOf(item, ['invoiceId', 'InvoiceId']),
    stockId: idOf(item, ['stockId', 'StockId']),
    customerId: idOf(item, ['customerId', 'CustomerId']),
    supplierId: idOf(item, ['supplierId', 'SupplierId']),
    productId: idOf(item, ['productId', 'ProductId']),
    warehouseId: idOf(item, ['warehouseId', 'WarehouseId', 'warehouse_id', 'whId', 'locationId']),
    name: text(item?.name ?? item?.Name),
    customer: text(item?.customer ?? item?.Customer ?? item?.customerName ?? item?.CustomerName),
    customerName: text(item?.customerName ?? item?.CustomerName ?? item?.customer ?? item?.Customer),
    supplier: text(item?.supplier ?? item?.Supplier ?? item?.supplierName ?? item?.SupplierName),
    supplierName: text(item?.supplierName ?? item?.SupplierName ?? item?.supplier ?? item?.Supplier),
    product: text(item?.product ?? item?.Product ?? item?.productName ?? item?.ProductName ?? item?.name ?? item?.Name),
    productName: text(item?.productName ?? item?.ProductName ?? item?.product ?? item?.Product ?? item?.name ?? item?.Name),
    sku: text(item?.sku ?? item?.SKU ?? item?.code ?? item?.Code),
    category: text(item?.category ?? item?.Category ?? item?.categoryName ?? item?.CategoryName),
    warehouse: text(item?.warehouse ?? item?.Warehouse ?? item?.warehouseName ?? item?.WarehouseName ?? item?.location ?? item?.Location),
    warehouseName: text(item?.warehouseName ?? item?.WarehouseName ?? item?.warehouse ?? item?.Warehouse ?? item?.location ?? item?.Location),
    soNumber: text(item?.soNumber ?? item?.SoNumber),
    poNumber: text(item?.poNumber ?? item?.PoNumber),
    invoiceNumber: text(item?.invoiceNumber ?? item?.InvoiceNumber),
    billNumber: text(item?.billNumber ?? item?.BillNumber ?? item?.poNumber ?? item?.PoNumber),
    orderDate: dateOnly(item?.orderDate ?? item?.OrderDate),
    invoiceDate: dateOnly(item?.invoiceDate ?? item?.InvoiceDate),
    billDate: dateOnly(item?.billDate ?? item?.BillDate ?? item?.orderDate ?? item?.OrderDate),
    dueDate: dateOnly(item?.dueDate ?? item?.DueDate),
    lastPurchaseDate: dateOnly(item?.lastPurchaseDate ?? item?.LastPurchaseDate),
    lastSoldDate: dateOnly(item?.lastSoldDate ?? item?.LastSoldDate),
    totalAmount: number(item?.totalAmount ?? item?.TotalAmount ?? item?.amount ?? item?.Amount ?? item?.grandTotal ?? item?.GrandTotal),
    invoiceAmount: number(item?.invoiceAmount ?? item?.InvoiceAmount ?? item?.totalAmount ?? item?.TotalAmount),
    billAmount: number(item?.billAmount ?? item?.BillAmount ?? item?.totalAmount ?? item?.TotalAmount),
    paidAmount: number(item?.paidAmount ?? item?.PaidAmount),
    balanceAmount: number(item?.balanceAmount ?? item?.BalanceAmount),
    quantity: number(item?.quantity ?? item?.Quantity),
    quantityAvailable: number(item?.quantityAvailable ?? item?.QuantityAvailable ?? item?.availableQuantity ?? item?.AvailableQuantity ?? item?.availableStock ?? item?.AvailableStock ?? item?.quantity ?? item?.Quantity),
    availableQuantity: number(item?.availableQuantity ?? item?.AvailableQuantity ?? item?.quantityAvailable ?? item?.QuantityAvailable ?? item?.availableStock ?? item?.AvailableStock ?? item?.quantity ?? item?.Quantity),
    availableStock: number(item?.availableStock ?? item?.AvailableStock ?? item?.availableQuantity ?? item?.AvailableQuantity ?? item?.quantityAvailable ?? item?.QuantityAvailable ?? item?.quantity ?? item?.Quantity),
    reservedQuantity: number(item?.reservedQuantity ?? item?.ReservedQuantity),
    minimumStockLevel: number(item?.minimumStockLevel ?? item?.MinimumStockLevel ?? item?.reorderLevel ?? item?.ReorderLevel ?? item?.minStock ?? 10),
    reorderQuantity: number(item?.reorderQuantity ?? item?.ReorderQuantity ?? item?.reorderQty ?? 20),
    averageCost: number(item?.averageCost ?? item?.AverageCost ?? item?.costPrice ?? item?.CostPrice ?? item?.unitCost ?? item?.UnitCost),
    totalStockValue: number(item?.totalStockValue ?? item?.TotalStockValue ?? item?.stockValue ?? item?.StockValue),
    stockValue: number(item?.stockValue ?? item?.StockValue ?? item?.totalStockValue ?? item?.TotalStockValue),
    unitsSold: number(item?.unitsSold ?? item?.UnitsSold ?? item?.totalSold ?? item?.TotalSold),
    salesValue: number(item?.salesValue ?? item?.SalesValue ?? item?.totalSalesValue ?? item?.TotalSalesValue),
    totalSalesValue: number(item?.totalSalesValue ?? item?.TotalSalesValue ?? item?.salesValue ?? item?.SalesValue),
    costValue: number(item?.costValue ?? item?.CostValue),
    grossProfit: number(item?.grossProfit ?? item?.GrossProfit),
    profitMargin: number(item?.profitMargin ?? item?.ProfitMargin),
    stockLeft: number(item?.stockLeft ?? item?.StockLeft ?? item?.availableStock ?? item?.AvailableStock),
    daysSinceLastSale: number(item?.daysSinceLastSale ?? item?.DaysSinceLastSale),
    totalOrders: number(item?.totalOrders ?? item?.TotalOrders),
    totalPurchases: number(item?.totalPurchases ?? item?.TotalPurchases),
    purchaseValue: number(item?.purchaseValue ?? item?.PurchaseValue),
    outstandingAmount: number(item?.outstandingAmount ?? item?.OutstandingAmount ?? item?.outstandingBalance ?? item?.OutstandingBalance),
    outstandingPayable: number(item?.outstandingPayable ?? item?.OutstandingPayable ?? item?.outstandingBalance ?? item?.OutstandingBalance),
    creditLimit: number(item?.creditLimit ?? item?.CreditLimit),
    outstandingBalance: number(item?.outstandingBalance ?? item?.OutstandingBalance),
    month: text(item?.month ?? item?.Month),
    taxableSales: number(item?.taxableSales ?? item?.TaxableSales),
    outputGst: number(item?.outputGst ?? item?.OutputGst),
    taxablePurchases: number(item?.taxablePurchases ?? item?.TaxablePurchases),
    inputGst: number(item?.inputGst ?? item?.InputGst),
    netGstPayable: number(item?.netGstPayable ?? item?.NetGstPayable),
    totalProducts: number(item?.totalProducts ?? item?.TotalProducts),
    lowStockItems: number(item?.lowStockItems ?? item?.LowStockItems),
    damagedItems: number(item?.damagedItems ?? item?.DamagedItems),
    salesDispatches: number(item?.salesDispatches ?? item?.SalesDispatches),
    purchaseReceipts: number(item?.purchaseReceipts ?? item?.PurchaseReceipts),
    insight: text(item?.insight ?? item?.Insight),
    prediction: text(item?.prediction ?? item?.Prediction),
    priority: text(item?.priority ?? item?.Priority),
    agingStatus: text(item?.agingStatus ?? item?.AgingStatus) || '0-30 Days',
    movementStatus: text(item?.movementStatus ?? item?.MovementStatus) || 'Normal',
    status: normalizeStatus(item?.status ?? item?.Status, 'Active'),
  }
}

export async function getReportFilterOptions() {
  const endpoints = API_ENDPOINTS.reports

  const [warehouses, categories, products, customers, suppliers] = await Promise.allSettled([
    apiRequest(endpoints.filtersWarehouses),
    apiRequest(endpoints.filtersCategories),
    apiRequest(endpoints.filtersProducts),
    apiRequest(endpoints.filtersCustomers),
    apiRequest(endpoints.filtersSuppliers),
  ])

  const extractList = (result) => {
    if (result.status === 'fulfilled' && result.value?.success) {
      return getResponseList(result.value)
    }
    return []
  }

  return {
    warehouses: extractList(warehouses).map((item) => ({
      id: idOf(item, ['id', 'warehouseId', 'Id', 'WarehouseId']),
      name: text(item?.name ?? item?.Name ?? item?.warehouseName ?? item?.WarehouseName ?? item?.label ?? item?.Label),
    })).filter((w) => w.id && w.name),
    categories: extractList(categories).map((item) => ({
      id: idOf(item, ['id', 'categoryId', 'Id', 'CategoryId']),
      name: text(item?.name ?? item?.Name ?? item?.categoryName ?? item?.CategoryName ?? item?.label ?? item?.Label),
    })).filter((c) => c.id && c.name),
    products: extractList(products).map((item) => ({
      id: idOf(item, ['id', 'productId', 'Id', 'ProductId']),
      name: text(item?.name ?? item?.Name ?? item?.productName ?? item?.ProductName ?? item?.label ?? item?.Label),
    })).filter((p) => p.id && p.name),
    customers: extractList(customers).map((item) => ({
      id: idOf(item, ['id', 'customerId', 'Id', 'CustomerId']),
      name: text(item?.name ?? item?.Name ?? item?.customerName ?? item?.CustomerName ?? item?.label ?? item?.Label),
    })).filter((c) => c.id && c.name),
    suppliers: extractList(suppliers).map((item) => ({
      id: idOf(item, ['id', 'supplierId', 'Id', 'SupplierId']),
      name: text(item?.name ?? item?.Name ?? item?.supplierName ?? item?.SupplierName ?? item?.label ?? item?.Label),
    })).filter((s) => s.id && s.name),
  }
}

export async function getReportsData(query = {}) {
  const endpoints = API_ENDPOINTS.reports

  const [
    sales, purchases, invoices, stock, customerBalances,
    inventoryValuation, lowStock, fastMoving, slowMoving,
    topCustomers, topSuppliers, profitability,
    customerOutstanding, supplierOutstanding, gstTax,
    warehousePerformance, forecasting, summary,
    transactionTrend, stockAvailability,
  ] = await Promise.allSettled([
    apiRequest(endpoints.sales, { query }),
    apiRequest(endpoints.purchases, { query }),
    apiRequest(endpoints.invoices, { query }),
    apiRequest(endpoints.stock, { query }),
    apiRequest(endpoints.customerBalances, { query }),
    apiRequest(endpoints.inventoryValuation, { query }),
    apiRequest(endpoints.lowStock, { query }),
    apiRequest(endpoints.fastMoving, { query }),
    apiRequest(endpoints.slowMoving, { query }),
    apiRequest(endpoints.topCustomers, { query }),
    apiRequest(endpoints.topSuppliers, { query }),
    apiRequest(endpoints.profitability, { query }),
    apiRequest(endpoints.customerOutstanding, { query }),
    apiRequest(endpoints.supplierOutstanding, { query }),
    apiRequest(endpoints.gstTax, { query }),
    apiRequest(endpoints.warehousePerformance, { query }),
    apiRequest(endpoints.forecasting, { query }),
    apiRequest(endpoints.summary, { query }),
    apiRequest(endpoints.transactionTrend, { query }),
    apiRequest(endpoints.stockAvailability, { query }),
  ])

  const extractList = (res, type) => {
    if (res.status === 'fulfilled' && res.value?.success) {
      return getResponseList(res.value).map((item, index) => normalizeReportRow(item, type, index))
    }
    return []
  }

  const extractData = (res) => {
    if (res.status === 'fulfilled' && res.value?.success) {
      return getResponseData(res.value, {}) ?? {}
    }
    return null
  }

  const allResponses = [
    sales, purchases, invoices, stock, customerBalances,
    inventoryValuation, lowStock, fastMoving, slowMoving,
    topCustomers, topSuppliers, profitability,
    customerOutstanding, supplierOutstanding, gstTax,
    warehousePerformance, forecasting, summary,
    transactionTrend, stockAvailability,
  ]

  const errors = allResponses
    .filter((res) => res.status === 'fulfilled' && !res.value?.success && res.value?.status !== 404)
    .map((res) => res.value?.error)
    .filter(Boolean)

  return {
    sales: extractList(sales, 'sales'),
    purchases: extractList(purchases, 'purchases'),
    invoices: extractList(invoices, 'invoices'),
    stock: extractList(stock, 'stock'),
    customerBalances: extractList(customerBalances, 'customerBalances'),
    inventoryValuation: extractList(inventoryValuation, 'inventoryValuation'),
    lowStock: extractList(lowStock, 'lowStock'),
    fastMoving: extractList(fastMoving, 'fastMoving'),
    slowMoving: extractList(slowMoving, 'slowMoving'),
    topCustomers: extractList(topCustomers, 'topCustomers'),
    topSuppliers: extractList(topSuppliers, 'topSuppliers'),
    profitability: extractList(profitability, 'profitability'),
    customerOutstanding: extractList(customerOutstanding, 'customerOutstanding'),
    supplierOutstanding: extractList(supplierOutstanding, 'supplierOutstanding'),
    gstReport: extractList(gstTax, 'gstTax'),
    warehousePerformance: extractList(warehousePerformance, 'warehousePerformance'),
    forecasting: extractList(forecasting, 'forecasting'),
    summary: extractData(summary),
    transactionTrend: extractList(transactionTrend, 'transactionTrend'),
    stockAvailability: extractList(stockAvailability, 'stockAvailability'),
    errors,
  }
}

export function normalizeDashboardPayload(responses) {
  const [
    summary,
    lowStock,
    recentSales,
    topProducts,
    monthlySales,
    monthlyPurchases,
    recentActivities,
    productCatalog,
    customers,
    suppliers,
  ] = responses
  const normalizedLowStock = lowStock.success ? getResponseList(lowStock).map((item) => ({
    ...item,
    id: idOf(item, ['stockId', 'StockId', 'id']),
    name: text(item?.name ?? item?.Name),
    sku: text(item?.sku ?? item?.SKU),
    stock: number(item?.currentStock ?? item?.CurrentStock ?? item?.quantity ?? item?.Quantity),
    reorderLevel: number(item?.reorderLevel ?? item?.ReorderLevel ?? 10),
    availableQty: number(item?.availableQuantity ?? item?.AvailableQuantity ?? item?.currentStock ?? item?.CurrentStock),
    status: text(item?.status ?? item?.Status),
  })) : []
  const lowStockOnly = normalizedLowStock.filter(
    (item) => Number(item.stock) > 0 && Number(item.stock) <= Number(item.reorderLevel ?? 10),
  )
  const outOfStockOnly = normalizedLowStock.filter(
    (item) => Number(item.stock) <= 0 || String(item.status || '').toLowerCase() === 'out of stock',
  )
  const summaryData = summary.success ? getResponseData(summary, {}) ?? {} : {}
  const productRows = productCatalog?.success ? getResponseList(productCatalog, 'products') : []
  const customerRows = customers?.success ? getResponseList(customers, 'customers') : []
  const supplierRows = suppliers?.success ? getResponseList(suppliers, 'suppliers') : []

  return {
    summary: {
      ...summaryData,
      totalProducts: productCatalog?.success
        ? productRows.length
        : number(summaryData.totalProducts ?? summaryData.TotalProducts),
      totalCustomers: customers?.success
        ? customerRows.length
        : number(summaryData.totalCustomers ?? summaryData.TotalCustomers),
      totalSuppliers: suppliers?.success
        ? supplierRows.length
        : number(summaryData.totalSuppliers ?? summaryData.TotalSuppliers),
      lowStockProducts: lowStock.success
        ? lowStockOnly.length
        : number(summaryData.lowStockProducts ?? summaryData.LowStockProducts),
      outOfStockProducts: lowStock.success
        ? outOfStockOnly.length
        : number(summaryData.outOfStockProducts ?? summaryData.OutOfStockProducts),
      inventoryHealthStatus: text(summaryData.inventoryHealthStatus ?? summaryData.InventoryHealthStatus),
      inventoryHealthTone: text(summaryData.inventoryHealthTone ?? summaryData.InventoryHealthTone),
      inventoryHealthMessage: text(summaryData.inventoryHealthMessage ?? summaryData.InventoryHealthMessage),
    },
    lowStock: normalizedLowStock,
    recentSales: recentSales.success ? getResponseList(recentSales).map((item) => ({
      ...item,
      id: idOf(item, ['invoiceId', 'InvoiceId', 'id']),
      invoiceNumber: text(item?.invoiceNumber ?? item?.InvoiceNumber),
      customerName: text(item?.customerName ?? item?.CustomerName),
      invoiceDate: dateOnly(item?.invoiceDate ?? item?.InvoiceDate),
      totalAmount: number(item?.totalAmount ?? item?.TotalAmount),
      status: normalizeStatus(item?.status ?? item?.Status, 'Issued'),
    })) : [],
    topProducts: topProducts.success ? getResponseList(topProducts).map((item) => ({
      ...item,
      id: idOf(item, ['productId', 'ProductId', 'id']),
      name: text(item?.name ?? item?.Name),
      sku: text(item?.sku ?? item?.SKU),
      totalSold: number(item?.totalSold ?? item?.TotalSold),
      revenue: number(item?.revenue ?? item?.Revenue),
    })) : [],
    monthlySales: monthlySales.success ? getResponseList(monthlySales) : [],
    monthlyPurchases: monthlyPurchases.success ? getResponseList(monthlyPurchases) : [],
    recentActivities: recentActivities.success ? getResponseList(recentActivities).map((item, index) => ({
      ...item,
      id: idOf(item, ['id', 'logId', 'LogId']) || `${text(item?.type ?? 'activity')}-${index}`,
      type: normalizeStatus(item?.type ?? 'Activity', 'Activity'),
      description: text(item?.description ?? item?.Description),
      date: text(item?.date ?? item?.Date ?? item?.createdAt ?? item?.CreatedAt ?? item?.created_at),
    })) : [],
    errors: (!responses.some((r) => r.success) && responses.some((r) => r.status === 0 || r.status === 502 || r.status === 503))
      ? ['Unable to connect to the server.']
      : [],
  }
}

export async function getDashboardData() {
  const responses = await Promise.all([
    apiRequest(API_ENDPOINTS.dashboard.summary),
    apiRequest(API_ENDPOINTS.dashboard.lowStock),
    apiRequest(API_ENDPOINTS.dashboard.recentSales),
    apiRequest(API_ENDPOINTS.dashboard.topProducts),
    apiRequest(API_ENDPOINTS.dashboard.monthlySales),
    apiRequest(API_ENDPOINTS.dashboard.monthlyPurchases),
    apiRequest(API_ENDPOINTS.dashboard.recentActivities),
    getProductCatalog(),
    getCustomers(),
    getSuppliers(),
  ])
  return normalizeDashboardPayload(responses)
}

export async function getTopProducts() {
  const response = await apiRequest(API_ENDPOINTS.dashboard.topProducts)
  if (!response.success) return response
  return {
    ...response,
    data: getResponseList(response).map((item) => ({
      ...item,
      id: idOf(item, ['productId', 'ProductId', 'id']),
      productId: idOf(item, ['productId', 'ProductId', 'id']),
      name: text(item?.name ?? item?.Name),
      sku: text(item?.sku ?? item?.SKU),
      totalSold: number(item?.totalSold ?? item?.TotalSold),
      revenue: number(item?.revenue ?? item?.Revenue),
    })),
  }
}

export async function getCustomerPayments() {
  const response = await apiRequest(API_ENDPOINTS.customerPayments.list)
  return response.success ? { ...response, data: getResponseList(response).map((item) => normalizePayment(item, 'customer')) } : response
}

export function createCustomerPayment(data) {
  return apiRequest(API_ENDPOINTS.customerPayments.list, { method: 'POST', body: data })
}

export function updateCustomerPayment(id, data) {
  return apiRequest(API_ENDPOINTS.customerPayments.byId(id), { method: 'PUT', body: data })
}

export function deleteCustomerPayment(id) {
  return apiRequest(API_ENDPOINTS.customerPayments.byId(id), { method: 'DELETE' })
}

export async function getPurchaseOrders() {
  const response = await apiRequest(API_ENDPOINTS.purchaseOrders.list)
  return response.success
    ? {
        ...response,
        data: ensureUniquePurchaseOrderNumbers(
          groupFlatPurchaseOrders(getResponseList(response)).map(normalizePurchaseOrder),
        ),
      }
    : response
}

export async function getPurchaseOrder(id) {
  const response = await apiRequest(API_ENDPOINTS.purchaseOrders.byId(id))
  if (!response.success) return response

  const rawData = response.data ?? {}
  const rawList = Array.isArray(rawData) ? rawData : (Array.isArray(rawData?.data) ? rawData.data : [rawData])
  const grouped = groupFlatPurchaseOrders(rawList)
  const target = grouped[0] || rawData

  return {
    ...response,
    data: normalizePurchaseOrder(target),
  }
}

export function createPurchaseOrder(data) {
  return apiRequest(API_ENDPOINTS.purchaseOrders.list, { method: 'POST', body: data })
}

export function updatePurchaseOrder(id, data) {
  return apiRequest(API_ENDPOINTS.purchaseOrders.byId(id), { method: 'PUT', body: data })
}

export function deletePurchaseOrder(id) {
  return apiRequest(API_ENDPOINTS.purchaseOrders.byId(id), { method: 'DELETE' })
}

export async function getSalesReturns() {
  const response = await apiRequest(API_ENDPOINTS.salesReturns.list)
  return response.success ? { ...response, data: getResponseList(response).map(normalizeSalesReturn) } : response
}

export function createSalesReturn(data) {
  return apiRequest(API_ENDPOINTS.salesReturns.list, { method: 'POST', body: data })
}

export async function getSalesReturn(id) {
  const response = await apiRequest(API_ENDPOINTS.salesReturns.byId(id))
  return response.success ? { ...response, data: normalizeSalesReturn(response.data ?? {}) } : response
}

export function updateSalesReturn(id, data) {
  return apiRequest(API_ENDPOINTS.salesReturns.byId(id), { method: 'PUT', body: data })
}

export function deleteSalesReturn(id) {
  return apiRequest(API_ENDPOINTS.salesReturns.byId(id), { method: 'DELETE' })
}

export function approveSalesReturn(id, comments = '') {
  const url = API_ENDPOINTS.salesReturns?.approve ? API_ENDPOINTS.salesReturns.approve(id) : `/SalesReturns/${id}/approve`
  return apiRequest(url, { method: 'POST', body: { comments } })
}

export function rejectSalesReturn(id, comments = '') {
  const url = API_ENDPOINTS.salesReturns?.reject ? API_ENDPOINTS.salesReturns.reject(id) : `/SalesReturns/${id}/reject`
  return apiRequest(url, { method: 'POST', body: { comments } })
}

export function processSalesReturn(id, comments = '') {
  const url = API_ENDPOINTS.salesReturns?.process ? API_ENDPOINTS.salesReturns.process(id) : `/SalesReturns/${id}/process`
  return apiRequest(url, { method: 'POST', body: { comments } })
}

export function refundSalesReturn(id, data) {
  const url = API_ENDPOINTS.salesReturns?.refund ? API_ENDPOINTS.salesReturns.refund(id) : `/SalesReturns/${id}/refund`
  return apiRequest(url, { method: 'POST', body: data })
}

export async function getInvoices(query = {}) {
  const response = await apiRequest(API_ENDPOINTS.invoices.list, {
    query: {
      page: 1,
      pageSize: 100,
      ...query,
    },
  })

  if (!response.success) {
    return response
  }

  return {
    ...response,
    data: getResponseList(response).map(normalizeInvoice),
    meta: getResponseData(response, {}),
  }
}

export async function getInvoiceById(id) {
  const response = await apiRequest(API_ENDPOINTS.invoices.byId(id))

  if (!response.success) {
    return response
  }

  // The invoice itself contains an `items` collection. Do not use
  // getResponseData here because that helper interprets `items` as a list
  // response and would discard the invoice header/detail fields.
  const payload = response.data ?? {}
  const rawInvoice = payload?.invoice ?? payload?.Invoice ?? payload?.data ?? payload?.Data ?? payload

  return {
    ...response,
    data: normalizeInvoice(rawInvoice),
  }
}

export function createInvoice(data) {
  return apiRequest(API_ENDPOINTS.invoices.list, {
    method: 'POST',
    body: data,
    timeoutMs: 60000,
  })
}

export function deleteInvoice(id) {
  return apiRequest(API_ENDPOINTS.invoices.byId(id), {
    method: 'DELETE',
    timeoutMs: 60000,
  })
}

export function sendInvoiceEmail(id) {
  return apiRequest(API_ENDPOINTS.invoices.sendEmail(id), {
    method: 'POST',
    timeoutMs: 60000,
  })
}

export async function downloadInvoicePdf(id, filename = `invoice-${id}.pdf`) {
  return downloadApiFile(API_ENDPOINTS.invoices.pdf(id), filename, 'application/pdf')
}

export function getInvoiceCompanyProfile() {
  return apiRequest('/SystemSettings/company-profile')
}

export async function getSupplierPayments() {
  const response = await apiRequest(API_ENDPOINTS.supplierPayments.list)
  return response.success ? { ...response, data: getResponseList(response).map((item) => normalizePayment(item, 'supplier')) } : response
}

export async function createSupplierPayment(data) {
  const response = await apiRequest(API_ENDPOINTS.supplierPayments.list, { method: 'POST', body: data })
  if (response.success) {
    invalidateSupplierCache()
  }
  return response
}

export async function deleteSupplierPayment(id) {
  const response = await apiRequest(API_ENDPOINTS.supplierPayments.byId(id), { method: 'DELETE' })
  if (response.success) {
    invalidateSupplierCache()
  }
  return response
}


export async function exportSalesReport() {
  return exportReportFile(API_ENDPOINTS.reports.exportSales, 'SalesReport.xlsx')
}

export async function exportStockReport() {
  return exportReportFile(API_ENDPOINTS.reports.exportStock, 'StockReport.xlsx')
}

export async function exportSalesReportPdf() {
  return downloadApiFile(API_ENDPOINTS.reports.exportSalesPdf, 'SalesReport.pdf', 'application/pdf')
}

export async function exportStockReportPdf() {
  return downloadApiFile(API_ENDPOINTS.reports.exportStockPdf, 'StockReport.pdf', 'application/pdf')
}

async function exportReportFile(endpoint, filename) {
  return downloadApiFile(
    endpoint,
    filename,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
}

async function downloadApiFile(endpoint, filename, accept) {
  const response = await fetch(buildUrl(endpoint), {
    headers: buildApiHeaders({}, { accept }),
  })

  if (!response.ok) {
    return {
      success: false,
      error: await readDownloadError(response),
      status: response.status,
    }
  }

  return {
    success: true,
    blob: await response.blob(),
    filename: getDownloadFilename(response, filename),
  }
}

async function readDownloadError(response) {
  const contentType = response.headers.get('content-type') || ''

  if (contentType.includes('application/json')) {
    try {
      const payload = await response.json()
      return (
        payload?.message ||
        payload?.Message ||
        payload?.error ||
        payload?.Error ||
        `Download failed with status ${response.status}.`
      )
    } catch {
      return `Download failed with status ${response.status}.`
    }
  }

  const body = await response.text()
  return body || `Download failed with status ${response.status}.`
}

function getDownloadFilename(response, fallback) {
  const disposition = response.headers.get('content-disposition') || ''
  const match = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(disposition)

  return match ? decodeURIComponent(match[1].replace(/"/g, '')) : fallback
}

export function normalizeExchange(item) {
  return {
    ...item,
    id: idOf(item, ['id', 'exchangeId', 'ExchangeId']),
    exchangeId: idOf(item, ['exchangeId', 'ExchangeId', 'id']),
    returnReference: text(item?.returnReference ?? item?.ReturnReference ?? (item?.returnId ? `RET-${String(item.returnId).padStart(3, '0')}` : '')),
    returnId: idOf(item, ['returnId', 'ReturnId']),
    customerId: idOf(item, ['customerId', 'CustomerId']),
    customer: text(item?.customer ?? item?.customerName ?? item?.CustomerName ?? item?.customer?.name),
    oldProductId: idOf(item, ['oldProductId', 'OldProductId']),
    oldProduct: text(item?.oldProduct ?? item?.oldProductName ?? item?.oldProduct?.name),
    oldQty: number(item?.oldQty ?? item?.OldQty),
    oldValue: number(item?.oldProductValue ?? item?.OldProductValue ?? item?.oldValue),
    oldStatus: text(item?.oldStatus ?? item?.OldStatus) || 'Returned',
    newProductId: idOf(item, ['newProductId', 'NewProductId']),
    newProduct: text(item?.newProduct ?? item?.newProductName ?? item?.newProduct?.name),
    newQty: number(item?.newQty ?? item?.NewQty),
    newPrice: number(item?.newProductValue ?? item?.NewProductValue ?? item?.newPrice),
    differenceAmount: number(item?.differenceAmount ?? item?.DifferenceAmount),
    settlementType: text(item?.settlementType ?? item?.SettlementType) || 'None',
    settlementAmount: number(item?.settlementAmount ?? item?.SettlementAmount),
    status: normalizeStatus(item?.status ?? 'Pending', 'Pending'),
    createdDate: dateOnly(item?.createdAt ?? item?.CreatedAt ?? item?.createdDate ?? item?.CreatedDate),
  }
}

export function normalizeRefund(item) {
  return {
    ...item,
    id: idOf(item, ['id', 'refundId', 'RefundId']),
    refundId: idOf(item, ['refundId', 'RefundId', 'id']),
    returnReference: text(item?.returnReference ?? item?.ReturnReference ?? (item?.returnId ? `RET-${String(item.returnId).padStart(3, '0')}` : '')),
    returnId: idOf(item, ['returnId', 'ReturnId']),
    customerId: idOf(item, ['customerId', 'CustomerId']),
    customer: text(item?.customer ?? item?.customerName ?? item?.CustomerName ?? item?.customer?.name),
    referenceNumber: text(item?.refundReference ?? item?.RefundReference ?? item?.referenceNumber),
    method: text(item?.refundMethod ?? item?.RefundMethod ?? item?.method) || 'Bank Transfer',
    refundDate: dateOnly(item?.refundDate ?? item?.RefundDate),
    amount: number(item?.amount ?? item?.Amount),
    status: normalizeStatus(item?.status ?? 'Completed', 'Completed'),
  }
}

export function normalizeInspection(item) {
  return {
    ...item,
    id: idOf(item, ['id', 'inspectionId', 'InspectionId']),
    inspectionId: idOf(item, ['inspectionId', 'InspectionId', 'id']),
    returnReference: text(item?.returnReference ?? item?.ReturnReference ?? (item?.returnId ? `RET-${String(item.returnId).padStart(3, '0')}` : '')),
    returnId: idOf(item, ['returnId', 'ReturnId']),
    inspector: text(item?.inspector ?? item?.Inspector) || 'Quality Inspector',
    inspectionDate: dateOnly(item?.inspectionDate ?? item?.InspectionDate),
    productCondition: normalizeStatus(item?.productCondition ?? item?.ProductCondition) || 'Good',
    decision: normalizeStatus(item?.decision ?? item?.Decision) || 'Approve',
    finalAction: text(item?.finalAction ?? item?.FinalAction) || 'Return To Stock',
    remarks: text(item?.remarks ?? item?.Remarks ?? item?.comments ?? item?.Comments),
  }
}

export function normalizeDamage(item) {
  return {
    ...item,
    id: idOf(item, ['id', 'damageId', 'DamageId']),
    damageId: idOf(item, ['damageId', 'DamageId', 'id']),
    returnReference: text(item?.returnReference ?? item?.ReturnReference ?? (item?.returnId ? `RET-${String(item.returnId).padStart(3, '0')}` : '')),
    returnId: idOf(item, ['returnId', 'ReturnId']),
    productId: idOf(item, ['productId', 'ProductId']),
    product: text(item?.product ?? item?.productName ?? item?.product?.name),
    sku: text(item?.sku ?? item?.SKU ?? item?.product?.sku),
    damageType: text(item?.damageType ?? item?.DamageType),
    severity: normalizeStatus(item?.severity ?? item?.Severity) || 'Minor',
    action: text(item?.action ?? item?.Action) || 'Repair',
    assessedBy: text(item?.assessedBy ?? item?.AssessedBy) || 'Quality Inspector',
    date: dateOnly(item?.createdAt ?? item?.CreatedAt ?? item?.date),
  }
}

export function normalizeDamageInventory(item) {
  return {
    ...item,
    id: idOf(item, ['id', 'id']),
    product: text(item?.product ?? item?.productName ?? item?.product?.name),
    sku: text(item?.sku ?? item?.SKU ?? item?.product?.sku),
    warehouse: text(item?.warehouse ?? item?.warehouseName ?? item?.warehouse?.name),
    availableStock: number(item?.availableStock ?? item?.AvailableStock),
    damageStock: number(item?.damageStock ?? item?.DamageStock),
    repairStock: number(item?.repairStock ?? item?.RepairStock),
    scrapStock: number(item?.scrapStock ?? item?.ScrapStock),
    stockValue: number(item?.stockValue ?? item?.StockValue),
  }
}

export function normalizeCreditNote(item) {
  return {
    ...item,
    id: idOf(item, ['id', 'creditNoteId', 'CreditNoteId']),
    creditNoteId: idOf(item, ['creditNoteId', 'CreditNoteId', 'id']),
    creditNoteNumber: text(item?.creditNoteNumber ?? item?.CreditNoteNumber ?? (idOf(item, ['id']) ? `CN-${String(idOf(item, ['id'])).padStart(3, '0')}` : '')),
    customer: text(item?.customer ?? item?.customerName ?? item?.CustomerName ?? item?.customer?.name),
    customerId: idOf(item, ['customerId', 'CustomerId']),
    returnReference: text(item?.returnReference ?? item?.ReturnReference ?? (item?.returnId ? `RET-${String(item.returnId).padStart(3, '0')}` : '')),
    returnId: idOf(item, ['returnId', 'ReturnId']),
    amount: number(item?.amount ?? item?.Amount),
    status: normalizeStatus(item?.status ?? 'Active', 'Active'),
    usedAmount: number(item?.usedAmount ?? item?.UsedAmount),
    remainingAmount: number(item?.remainingAmount ?? item?.RemainingAmount ?? (number(item?.amount) - number(item?.usedAmount))),
    createdDate: dateOnly(item?.createdAt ?? item?.CreatedAt ?? item?.createdDate ?? item?.CreatedDate),
  }
}

export async function getExchanges() {
  const response = await apiRequest(API_ENDPOINTS.exchanges.list)
  return response.success ? { ...response, data: getResponseList(response).map(normalizeExchange) } : response
}

export function createExchange(data) {
  return apiRequest(API_ENDPOINTS.exchanges.list, { method: 'POST', body: data })
}

export function updateExchangeStatus(id, status) {
  return apiRequest(API_ENDPOINTS.exchanges.status(id), { method: 'PUT', body: { status } })
}

export function moveExchangeNext(id) {
  return apiRequest(API_ENDPOINTS.exchanges.moveNext(id), { method: 'POST' })
}

export async function getRefunds() {
  const response = await apiRequest(API_ENDPOINTS.refunds.list)
  return response.success ? { ...response, data: getResponseList(response).map(normalizeRefund) } : response
}

export function createRefund(data) {
  return apiRequest(API_ENDPOINTS.refunds.list, { method: 'POST', body: data })
}

export function updateRefund(id, data) {
  return apiRequest(API_ENDPOINTS.refunds.byId(id), { method: 'PUT', body: data })
}

export async function getInspections() {
  const response = await apiRequest(API_ENDPOINTS.inspections.list)
  return response.success ? { ...response, data: getResponseList(response).map(normalizeInspection) } : response
}

export function createInspection(data) {
  return apiRequest(API_ENDPOINTS.inspections.list, { method: 'POST', body: data })
}

export async function getDamages() {
  const response = await apiRequest(API_ENDPOINTS.damages.list)
  return response.success ? { ...response, data: getResponseList(response).map(normalizeDamage) } : response
}

export function createDamage(data) {
  return apiRequest(API_ENDPOINTS.damages.list, { method: 'POST', body: data })
}

export async function getDamageInventoryList() {
  const response = await apiRequest(API_ENDPOINTS.damageInventory.list)
  return response.success ? { ...response, data: getResponseList(response).map(normalizeDamageInventory) } : response
}

export async function getCreditNotesList() {
  const response = await apiRequest(API_ENDPOINTS.creditNotes.list)
  return response.success ? { ...response, data: getResponseList(response).map(normalizeCreditNote) } : response
}

export function createCreditNote(data) {
  return apiRequest(API_ENDPOINTS.creditNotes.list, { method: 'POST', body: data })
}

export function updateCreditNote(id, data) {
  return apiRequest(API_ENDPOINTS.creditNotes.byId(id), { method: 'PUT', body: data })
}

export function getReturnsReport() {
  return apiRequest(API_ENDPOINTS.reports.returns)
}

export function getDamagesReport() {
  return apiRequest(API_ENDPOINTS.reports.damages)
}

export function getExchangesReport() {
  return apiRequest(API_ENDPOINTS.reports.exchanges)
}
