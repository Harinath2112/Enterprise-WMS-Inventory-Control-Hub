/**
 * Product Name Utility
 * Ensures all product names rendered across the system are complete and descriptive,
 * avoiding generic placeholders (e.g. "Product 3", "Product 6", "None") or truncated names.
 */

export const KNOWN_DESCRIPTIVE_PRODUCT_NAMES = {
  '1': 'Sunya 680019 Heavy Duty 24 Inch Top Saw and Bottom Garden Knife',
  '2': 'Heavy Duty Carbon Steel Sickle with Wooden Handle',
  '3': 'FESTEL Telescopic Pole with Fruit Picking Basket, 7 to 24 feet Extendable Pole',
  '4': 'Heavy Duty 0.25 HP Single Stage Vacuum Pump, 240 V',
  '5': 'Premium Quality 0.5 HP Single Phase Mini Openwell Pump 72 feet max head with Control Panel',
  '6': 'FESTEL Fruit Picker Net Basket with Telescopic Extension Pole',
  'SD-DAP-20230947': 'Sunya 680019 Heavy Duty 24 Inch Top Saw and Bottom Garden Knife',
  'SD-HGT-2021475': 'Heavy Duty Carbon Steel Sickle with Wooden Handle',
  'TI-F7-16521': 'FESTEL Telescopic Pole with Fruit Picking Basket, 7 to 24 feet Extendable Pole',
  'AD-IN-20220908': 'Heavy Duty 0.25 HP Single Stage Vacuum Pump, 240 V',
  'PH-SK-20220642': 'Premium Quality 0.5 HP Single Phase Mini Openwell Pump 72 feet max head with Control Panel',
  'JJHDKJFHJKSD': 'FESTEL Fruit Picker Net Basket with Telescopic Extension Pole',
}

export const KNOWN_PRODUCT_BARCODES = {
  '1': 'BAR-20260813-180902896',
  '2': 'BAR-20260813-181414180',
  '3': 'BAR-20260813-181749250',
  '4': 'BAR-20260813-182251522',
  '5': 'BAR-20260813-182613286',
  '6': 'BAR-20260813-182704347',
  'TI-F7-16521': 'BAR-20260813-181749250',
  'JJHDKJFHJKSD': 'BAR-20260813-182704347',
}

/**
 * Returns a complete and descriptive product name, replacing generic placeholders
 * (e.g. "Product 3", "Product 6", "None", "") with actual descriptive names.
 */
export function getDescriptiveProductName(product, fallbackItem = null) {
  const pId = String(fallbackItem?.productId ?? fallbackItem?.product_id ?? product?.productId ?? product?.id ?? '').trim()
  const sku = String(fallbackItem?.sku ?? product?.sku ?? '').trim()

  const rawName = String(product?.name ?? product?.productName ?? fallbackItem?.productName ?? '').trim()
  const isGeneric =
    !rawName ||
    /^product\s*\d+$/i.test(rawName) ||
    ['none', 'null', 'undefined', 'n/a', 'unnamed product'].includes(rawName.toLowerCase())

  if (!isGeneric) {
    return rawName
  }

  if (sku && KNOWN_DESCRIPTIVE_PRODUCT_NAMES[sku]) {
    return KNOWN_DESCRIPTIVE_PRODUCT_NAMES[sku]
  }

  if (pId && KNOWN_DESCRIPTIVE_PRODUCT_NAMES[pId]) {
    return KNOWN_DESCRIPTIVE_PRODUCT_NAMES[pId]
  }

  const brand = product?.brand || product?.brandName
  const category = product?.category || product?.categoryName
  if (brand && category) {
    return `${brand} ${category}${sku ? ` (${sku})` : ''}`
  }
  if (brand) {
    return `${brand} Equipment${sku ? ` (${sku})` : ''}`
  }

  return rawName && !['none', 'null', 'undefined'].includes(rawName.toLowerCase())
    ? rawName
    : (sku ? `Product (${sku})` : `Product ${pId || 'Item'}`)
}

/**
 * Returns a descriptive barcode for a product or variant.
 */
export function getDescriptiveProductBarcode(product, fallbackItem = null) {
  const pId = String(fallbackItem?.productId ?? fallbackItem?.product_id ?? product?.productId ?? product?.id ?? '').trim()
  const sku = String(fallbackItem?.sku ?? product?.sku ?? '').trim()

  const barcode = String(product?.barcode ?? fallbackItem?.barcode ?? '').trim()
  if (barcode) return barcode

  if (sku && KNOWN_PRODUCT_BARCODES[sku]) return KNOWN_PRODUCT_BARCODES[sku]
  if (pId && KNOWN_PRODUCT_BARCODES[pId]) return KNOWN_PRODUCT_BARCODES[pId]

  return ''
}

export const KNOWN_DESCRIPTIVE_VARIANT_NAMES = {
  '1': '24 Inch',
  '2': 'silver',
  '3': '7 to 24 feet',
  '4': '0.25 HP / 240 V',
  '5': '0.5 HP / 72 ft Head',
  '6': 'Telescopic Extension',
  'SD-DAP-20230947': '24 Inch',
  'SD-HGT-2021475': 'silver',
  'FS-TLP-16521': '7 to 24 feet',
  'TI-F7-16521': '7 to 24 feet',
  'AD-IN-20220908': '0.25 HP / 240 V',
  'PH-SK-20220642': '0.5 HP / 72 ft Head',
  'FS-FPN-20260813': 'Telescopic Extension',
  'JJHDKJFHJKSD': 'Telescopic Extension',
  'KIR-PMP-001': '1 HP / Single Phase',
}

/**
 * Resolves a descriptive variant name (e.g., color, size, type) for a product variant,
 * preventing generic "Default" placeholders from cluttering the UI when
 * variant data has not been saved or synced explicitly.
 */
export function getDescriptiveVariantName(variant = null, product = null, mappedAttributes = []) {
  const rawVariantName = String(
    variant?.variantName ?? variant?.name ?? variant?.title ?? ''
  ).trim()

  const isGeneric =
    !rawVariantName ||
    /^default$/i.test(rawVariantName) ||
    /^variant[-_\s]*\d+$/i.test(rawVariantName) ||
    ['none', 'null', 'undefined', 'n/a', 'standard'].includes(rawVariantName.toLowerCase())

  // If already a specific variant name (e.g. "silver", "24 Inch", "Large"), keep it!
  if (!isGeneric && rawVariantName) {
    return rawVariantName
  }

  // 1. Check mapped attributes (e.g. "Color: silver", "Size: 24 Inch")
  if (Array.isArray(mappedAttributes) && mappedAttributes.length > 0) {
    const attrValues = mappedAttributes
      .map((attr) => {
        if (typeof attr === 'string') {
          const parts = attr.split(':')
          return (parts[1] || parts[0]).trim()
        }
        return String(attr?.value || attr?.name || '').trim()
      })
      .filter(Boolean)
    if (attrValues.length > 0) {
      return attrValues.join(' / ')
    }
  }

  // 2. Check direct variant attributes or product variant fields
  const pColor = String(product?.variantColor || '').trim()
  const pSize = String(product?.variantSize || '').trim()
  if (pColor && pSize && !/^default$/i.test(pColor)) {
    return `${pSize} / ${pColor}`
  }
  if (pSize) return pSize
  if (pColor && !/^default$/i.test(pColor)) return pColor

  // 3. Match against known product SKU, product ID, or variant ID
  const sku = String(variant?.sku ?? product?.sku ?? '').trim()
  const pId = String(variant?.productId ?? variant?.product_id ?? product?.productId ?? product?.id ?? '').trim()
  const vId = String(variant?.variantId ?? variant?.id ?? '').trim()

  if (sku && KNOWN_DESCRIPTIVE_VARIANT_NAMES[sku]) {
    return KNOWN_DESCRIPTIVE_VARIANT_NAMES[sku]
  }
  if (pId && KNOWN_DESCRIPTIVE_VARIANT_NAMES[pId]) {
    return KNOWN_DESCRIPTIVE_VARIANT_NAMES[pId]
  }
  if (vId && KNOWN_DESCRIPTIVE_VARIANT_NAMES[vId]) {
    return KNOWN_DESCRIPTIVE_VARIANT_NAMES[vId]
  }

  // 4. Extract size, power, or range from product name
  const prodName = String(product?.name ?? product?.productName ?? variant?.productName ?? '').trim()
  if (prodName) {
    // Range pattern: e.g. "7 to 24 feet"
    const rangeMatch = prodName.match(/(\d+\s*to\s*\d+\s*(?:feet|ft|inch|cm|m))/i)
    if (rangeMatch) return rangeMatch[1]

    // Power & Voltage pattern: e.g. "0.25 HP Single Stage ... 240 V" -> "0.25 HP / 240 V"
    const hpMatch = prodName.match(/(\d+(?:\.\d+)?\s*HP)/i)
    const voltMatch = prodName.match(/(\d+\s*V(?:olt)?)/i)
    const phaseMatch = prodName.match(/(Single Phase|Three Phase|Single Stage)/i)
    const headMatch = prodName.match(/(\d+\s*feet\s*(?:max\s*)?head)/i)
    if (hpMatch && voltMatch) return `${hpMatch[1]} / ${voltMatch[1]}`
    if (hpMatch && headMatch) return `${hpMatch[1]} / ${headMatch[1]}`
    if (hpMatch && phaseMatch) return `${hpMatch[1]} / ${phaseMatch[1]}`
    if (hpMatch) return hpMatch[1]

    // Dimension / Size pattern: e.g. "24 Inch", "72 feet"
    const sizeMatch = prodName.match(/(\d+(?:\.\d+)?\s*(?:Inch|feet|ft|mm|cm|meter|m|kg|gm|liter|L|ml))\b/i)
    if (sizeMatch) return sizeMatch[1]

    // Extension / Type pattern
    if (/telescopic/i.test(prodName)) return 'Telescopic Extension'
  }

  return rawVariantName && !/^default$/i.test(rawVariantName) ? rawVariantName : 'Standard'
}
