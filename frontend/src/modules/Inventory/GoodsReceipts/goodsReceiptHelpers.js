import { readResourceValue } from '../../../api/resourceApi'

const GOODS_RECEIPT_NUMBER_FIELDS = [
  'grnNumber',
  'goodsReceiptNumber',
  'receiptNumber',
  'grnNo',
  'receiptNo',
]

const GOODS_RECEIPT_ID_FIELDS = [
  'grnId',
  'goodsReceiptId',
  'receiptId',
  'grId',
  'id',
]

const PURCHASE_ORDER_NUMBER_FIELDS = [
  'poNumber',
  'purchaseOrderNumber',
  'orderNumber',
]

function getPurchaseOrderFormattedGrn(row) {
  for (const field of PURCHASE_ORDER_NUMBER_FIELDS) {
    const purchaseOrderNumber = String(readResourceValue(row, field, '') ?? '').trim()

    if (!purchaseOrderNumber) continue

    const suffix = purchaseOrderNumber.replace(/^PO-/i, '').trim()

    if (suffix) {
      return `GRN-${suffix}`
    }
  }

  return ''
}

function isLegacyNumericGrn(value) {
  return /^(?:GRN-)?\d+$/i.test(value)
}

export function getGoodsReceiptNumber(row) {
  for (const field of GOODS_RECEIPT_NUMBER_FIELDS) {
    const value = String(readResourceValue(row, field, '') ?? '').trim()

    if (value) {
      const cleanVal = value.replace(/^GRN-/i, '').trim()
      if (/^\d+$/.test(cleanVal)) {
        return `GRN-${cleanVal.padStart(6, '0')}`
      }
      return /^GRN-/i.test(value) ? value : `GRN-${value}`
    }
  }

  for (const field of GOODS_RECEIPT_ID_FIELDS) {
    const value = String(readResourceValue(row, field, '') ?? '').trim()

    if (value) {
      const cleanVal = value.replace(/^GRN-/i, '').trim()
      if (/^\d+$/.test(cleanVal)) {
        return `GRN-${cleanVal.padStart(6, '0')}`
      }
      return /^GRN-/i.test(value) ? value : `GRN-${value}`
    }
  }

  const purchaseOrderFormattedGrn = getPurchaseOrderFormattedGrn(row)
  if (purchaseOrderFormattedGrn) {
    return purchaseOrderFormattedGrn
  }

  return ''
}

export function normalizeGoodsReceiptItem(item = {}) {
  const quantity = Number(
    item.quantity ??
    item.receivedQuantity ??
    item.quantityReceived ??
    item.acceptedQuantity ??
    item.orderedQuantity ??
    item.orderedQty ??
    0
  )

  const unitPrice = Number(
    item.unitPrice ??
    item.purchasePrice ??
    item.price ??
    item.rate ??
    item.cost ??
    0
  )

  const taxPercentage = Number(
    item.taxPercentage ??
    item.taxRate ??
    item.taxPercent ??
    item.gstPercentage ??
    item.tax ??
    0
  )

  const discountPercentage = Number(
    item.discountPercentage ??
    item.discount ??
    item.discountPercent ??
    0
  )

  const taxableAmount = Number(
    item.taxableAmount ??
    (quantity * unitPrice)
  )

  const discountAmount = Number(
    item.discountAmount ??
    ((taxableAmount * discountPercentage) / 100)
  )

  const netTaxableAmount = Math.max(0, taxableAmount - discountAmount)

  const taxAmount = Number(
    item.taxAmount ??
    item.gstAmount ??
    ((netTaxableAmount * taxPercentage) / 100)
  )

  const lineTotal = Number(
    item.lineTotal ??
    item.totalAmount ??
    (netTaxableAmount + taxAmount)
  )

  return {
    ...item,
    quantity,
    receivedQuantity: quantity,
    quantityReceived: quantity,
    acceptedQuantity: quantity,
    orderedQuantity: Number(item.orderedQuantity ?? item.orderedQty ?? quantity),
    unitPrice,
    price: unitPrice,
    discountPercentage,
    discount: discountPercentage,
    discountPercent: discountPercentage,
    discountAmount,
    taxPercentage,
    taxRate: taxPercentage,
    taxPercent: taxPercentage,
    gstPercentage: taxPercentage,
    tax: taxPercentage,
    taxableAmount,
    netTaxableAmount,
    taxAmount,
    gstAmount: taxAmount,
    lineTotal,
    totalAmount: lineTotal,
  }
}

export function calculateGoodsReceiptTotals(items = []) {
  const normalizedItems = (items || []).map(normalizeGoodsReceiptItem)

  const subtotal = normalizedItems.reduce((sum, item) => sum + item.taxableAmount, 0)
  const totalDiscount = normalizedItems.reduce((sum, item) => sum + item.discountAmount, 0)
  const totalTax = normalizedItems.reduce((sum, item) => sum + item.taxAmount, 0)
  const grandTotal = subtotal - totalDiscount + totalTax

  return {
    subtotal,
    totalDiscount,
    totalTax,
    grandTotal,
    items: normalizedItems,
  }
}
