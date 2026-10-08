// frontend/src/utils/skuUtils.js
/**
 * SKU Standardization and Formatting Utility
 *
 * Ensures all SKU codes adhere to a consistent standard format:
 * [BRAND/PREFIX]-[CATEGORY/TYPE]-[IDENTIFIER/CODE] (e.g., SD-DAP-20230947, FS-FPN-20260813)
 * And variant codes: [BASE_SKU]-VAR-[SUFFIX] (e.g., SD-DAP-20230947-VAR-01)
 */

export const STANDARDIZED_SKU_MAP = {
  // Legacy / unstandardized database SKUs mapped to standard format
  'JJHDKJFHJKSD': 'FS-FPN-20260813',
  'JJHDKJFHJKS': 'FS-FPN-20260813',
  'TI-F7-16521': 'FS-TLP-16521',
}

/**
 * Validates whether a SKU follows the standard hyphen-separated uppercase convention
 * Example valid formats: SD-DAP-20230947, SD-HGT-2021475, FS-FPN-20260813, SD-DAP-20230947-VAR-01
 */
export function isValidStandardSku(sku) {
  if (!sku || typeof sku !== 'string') return false
  const trimmed = sku.trim().toUpperCase()
  if (trimmed.length < 6 || trimmed.length > 30) return false
  // Must consist of 2 to 4 hyphen-separated uppercase alphanumeric segments
  return /^[A-Z0-9]{2,8}(-[A-Z0-9]{1,14})+$/.test(trimmed)
}

/**
 * Returns a standardized SKU code for any product or variant.
 * If the SKU is already in the map or in standard format, returns the clean standard format.
 * Otherwise standardizes the code into [PREFIX]-[CODE]-[IDENTIFIER].
 *
 * @param {string} sku - The raw SKU from the backend or record
 * @param {object} [context] - Optional item or product object for fallback context
 * @returns {string} Standardized SKU string
 */
export function getStandardizedSku(sku, context = {}) {
  const raw = String(sku || context?.sku || context?.SKU || context?.productSku || '').trim().toUpperCase()
  if (!raw || raw === '—' || raw === '-') {
    return '—'
  }

  // 1. Direct match in standardization dictionary
  if (STANDARDIZED_SKU_MAP[raw]) {
    return STANDARDIZED_SKU_MAP[raw]
  }

  // 2. Check for variant suffixes on mapped base SKUs (e.g. JJHDKJFHJKSD-VAR-01)
  for (const [legacySku, standardBase] of Object.entries(STANDARDIZED_SKU_MAP)) {
    if (raw.startsWith(legacySku + '-VAR-')) {
      const suffix = raw.slice((legacySku + '-VAR-').length)
      return `${standardBase}-VAR-${suffix}`
    }
    if (raw.startsWith(legacySku + '-')) {
      const suffix = raw.slice((legacySku + '-').length)
      return `${standardBase}-${suffix}`
    }
  }

  // 3. Already valid standard format (has at least 1 hyphen, 2+ uppercase/digit parts)
  if (isValidStandardSku(raw)) {
    return raw
  }

  // 4. Handle non-standard unhyphenated or irregular strings
  // If it's a long continuous alphanumeric string (like JJHDKJFHJKSD), segment it consistently
  if (/^[A-Z0-9]+$/.test(raw)) {
    if (raw.length >= 8) {
      // Segment: e.g. AB-CDE-123456
      const prefix = raw.slice(0, 2)
      const mid = raw.slice(2, 5)
      const end = raw.slice(5)
      return `${prefix}-${mid}-${end}`
    } else if (raw.length >= 5) {
      return `${raw.slice(0, 2)}-${raw.slice(2)}`
    }
  }

  return raw
}

/**
 * Validates SKU input for product & variant forms
 */
export function getStandardSkuError(value, options = {}) {
  const normalized = String(value ?? '').trim().toUpperCase()

  if (!normalized) {
    return 'SKU is required.'
  }

  if (normalized.length < 6) {
    return 'SKU must contain at least 6 characters.'
  }

  if (normalized.length > 30) {
    return 'SKU must not exceed 30 characters.'
  }

  if (!/^[A-Z0-9_-]+$/.test(normalized)) {
    return 'SKU can contain only uppercase letters, numbers, and hyphens.'
  }

  if (/(.)\1{3,}/i.test(normalized)) {
    return 'Please enter a valid, meaningful SKU without repetitive characters.'
  }

  if (!isValidStandardSku(normalized)) {
    return 'SKU must follow the standard format: [PREFIX]-[CATEGORY]-[CODE] (e.g., SD-DAP-20230947).'
  }

  const currentProductId = String(options.currentProductId ?? '')
  const productList = options.products ?? []
  if (Array.isArray(productList) && productList.length > 0) {
    const isDuplicate = productList.some((product) => {
      const pId = String(product.id ?? product.productId ?? product._id ?? '')
      const pSku = String(product.sku ?? product.SKU ?? '').trim().toUpperCase()
      return pSku === normalized && Boolean(normalized) && pId !== currentProductId
    })

    if (isDuplicate) {
      return 'SKU already exists. Please enter a unique SKU.'
    }
  }

  return ''
}
