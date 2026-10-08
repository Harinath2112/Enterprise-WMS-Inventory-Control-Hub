export const SUPPLIER_DOCUMENT_TYPES = Object.freeze({
  GST: 'GST',
  PAN: 'PAN',
  AGREEMENT: 'AGREEMENT',
  OTHER: 'OTHER',
})

export const SUPPLIER_DOCUMENT_TYPE_LABELS = Object.freeze({
  [SUPPLIER_DOCUMENT_TYPES.GST]: 'GST Certificate',
  [SUPPLIER_DOCUMENT_TYPES.PAN]: 'PAN Card',
  [SUPPLIER_DOCUMENT_TYPES.AGREEMENT]: 'Supplier Agreement',
  [SUPPLIER_DOCUMENT_TYPES.OTHER]: 'Other Documents',
})

export const SUPPLIER_DOCUMENT_TYPE_OPTIONS = Object.freeze(
  Object.values(SUPPLIER_DOCUMENT_TYPES).map((value) => ({
    value,
    label: SUPPLIER_DOCUMENT_TYPE_LABELS[value],
  })),
)

export const SUPPLIER_SINGLE_DOCUMENT_TYPES = Object.freeze([
  SUPPLIER_DOCUMENT_TYPES.GST,
  SUPPLIER_DOCUMENT_TYPES.PAN,
  SUPPLIER_DOCUMENT_TYPES.AGREEMENT,
])

export function normalizeSupplierDocumentType(value) {
  const normalizedValue = String(value || '').trim().toUpperCase()

  if (Object.values(SUPPLIER_DOCUMENT_TYPES).includes(normalizedValue)) {
    return normalizedValue
  }

  const option = SUPPLIER_DOCUMENT_TYPE_OPTIONS.find(
    (item) => item.label.toUpperCase() === normalizedValue,
  )

  return option?.value || SUPPLIER_DOCUMENT_TYPES.OTHER
}

export function getSupplierDocumentTypeLabel(value) {
  return SUPPLIER_DOCUMENT_TYPE_LABELS[normalizeSupplierDocumentType(value)]
}
