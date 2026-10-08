export function isPresent(value) {
  return String(value ?? '').trim().length > 0
}

export function formatEmpty(value, fallback = 'Not provided') {
  const cleanValue = String(value ?? '').trim()
  return cleanValue || fallback
}

export function toTitleCase(value) {
  const cleanValue = String(value ?? '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()

  if (!cleanValue) {
    return ''
  }

  return cleanValue
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

export function normalizeTitleText(value) {
  return toTitleCase(value)
}

export function formatCategory(value) {
  return formatEmpty(value, 'Uncategorized')
}

export function formatStatus(value) {
  const normalized = normalizeStatusValue(value)
  if (normalized === 'archived') return 'Archived'
  if (!normalized || normalized === 'not set' || normalized === 'not_set') return 'Not set'
  return toTitleCase(normalized)
}

export function normalizeStatusValue(value) {
  return String(value ?? '').trim().toLowerCase()
}

export function formatPaymentMethod(value) {
  return toTitleCase(value)
}

export function formatTaxId(value) {
  return String(value ?? '').trim().toUpperCase()
}

export function formatTaxValue(value, label) {
  return formatEmpty(formatTaxId(value), `${label} pending`)
}

export function formatLastPurchase(value, formatDate) {
  return formatDate(value) || 'No purchases yet'
}

export function formatNullableCurrency(formatCurrency, value) {
  if (!isPresent(value)) {
    return formatCurrency(0)
  }

  return Number.isFinite(Number(value)) ? formatCurrency(Number(value)) : formatCurrency(0)
}

export function getStatusBadgeType(status) {
  const normalized = normalizeStatusValue(status)
  if (normalized === 'archived') return 'pending'
  if (normalized === 'blocked') return 'cancelled'
  if (normalized === 'inactive') return 'inactive'
  if (!normalized || normalized === 'not set' || normalized === 'not_set') return 'draft'
  if (['paid', 'received', 'reconciled', 'active'].includes(normalized)) return 'received'
  return 'ordered'
}

export function formatVendorRating(value) {
  if (value == null || value === '') return '5/5'
  let raw = String(value).trim()
  if (raw.endsWith('/5')) {
    raw = raw.slice(0, -2).trim()
  }
  const num = Number(raw)
  if (Number.isNaN(num)) {
    return raw.includes('/5') ? raw : `${raw}/5`
  }
  const formatted = num % 1 === 0 ? String(Math.round(num)) : String(num)
  return `${formatted}/5`
}

