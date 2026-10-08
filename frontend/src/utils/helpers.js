import { formatCreditLimit, formatINR } from './currency'
import {
  getEmailError as getSharedEmailError,
  isValidEmail,
  sanitizeEmailInput,
} from '../validators/emailValidator'
import {
  getNameError as getSharedNameError,
  sanitizeNameInput,
} from '../validators/nameValidator'
import {
  addDaysToDate,
  compareDateOnly,
  formatDateForDisplay,
  formatDateTimeForDisplay,
  formatExactTimestamp,
  formatRelativeTime,
  getLocalTodayDate,
  getLogicalRequiredDate,
  isValidDateValue,
  normaliseDateOnlyPayload,
  parseDateValue,
  toDateInputValue,
} from './dateUtils'



export const DEFAULT_WAREHOUSES = [
  {
    id: 'WH-01',
    name: 'Central Hub',
    location: 'Bengaluru',
    manager: 'Anita Rao',
  },
  {
    id: 'WH-02',
    name: 'North Depot',
    location: 'Delhi NCR',
    manager: 'Manav Sethi',
  },
  {
    id: 'WH-03',
    name: 'Packaging Yard',
    location: 'Pune',
    manager: 'Ishita Kulkarni',
  },
  {
    id: 'WH-04',
    name: 'Retail Buffer',
    location: 'Hyderabad',
    manager: 'Neeraj Sharma',
  },
]

export const DEFAULT_PURCHASES = [
  {
    id: 'PUR-1001',
    supplierId: 'SUP-1001',
    supplierName: 'MetalWorks Supply',
    productId: 'PRD-1001',
    productName: 'Aluminium Coil 5mm',
    warehouseId: 'WH-01',
    warehouseName: 'Central Hub',
    quantity: 20,
    unitCost: 3600,
    total: 72000,
    date: '2026-04-10',
    status: 'Received',
    notes: 'Monthly replenishment',
  },
  {
    id: 'PUR-1002',
    supplierId: 'SUP-1003',
    supplierName: 'VoltEdge Electronics',
    productId: 'PRD-1003',
    productName: 'Smart Sensor Panel',
    warehouseId: 'WH-02',
    warehouseName: 'North Depot',
    quantity: 12,
    unitCost: 7600,
    total: 91200,
    date: '2026-04-13',
    status: 'Ordered',
    notes: 'Pending delivery',
  },
]

export const DEFAULT_SALES = [
  {
    id: 'SAL-1001',
    customerId: 'CUS-1001',
    customerName: 'Apex Retail',
    productId: 'PRD-1004',
    productName: 'Packaging Carton XL',
    warehouseId: 'WH-03',
    warehouseName: 'Packaging Yard',
    quantity: 30,
    unitPrice: 420,
    total: 12600,
    date: '2026-04-12',
    status: 'Completed',
    notes: 'Retail supply order',
  },
  {
    id: 'SAL-1002',
    customerId: 'CUS-1005',
    customerName: 'Horizon Traders',
    productId: 'PRD-1002',
    productName: 'Industrial Bearing Set',
    warehouseId: 'WH-01',
    warehouseName: 'Central Hub',
    quantity: 8,
    unitPrice: 1860,
    total: 14880,
    date: '2026-04-18',
    status: 'Completed',
    notes: 'Spare parts order',
  },
]

export const DEFAULT_STOCK_MOVEMENTS = [
  {
    id: 'MOV-1001',
    productId: 'PRD-1006',
    productName: 'Copper Wiring Roll',
    warehouseId: 'WH-01',
    warehouseName: 'Central Hub',
    type: 'in',
    quantity: 10,
    date: '2026-04-14',
    notes: 'Manual stock correction',
  },
  {
    id: 'MOV-1002',
    productId: 'PRD-1007',
    productName: 'Retail Display Stand',
    warehouseId: 'WH-04',
    warehouseName: 'Retail Buffer',
    type: 'out',
    quantity: 2,
    date: '2026-04-19',
    notes: 'Showroom transfer',
  },
]

export const DEFAULT_INVENTORY_AUDITS = [
  {
    id: 'AUD-1001',
    warehouseId: 'WH-01',
    warehouseName: 'Central Hub',
    productId: 'PRD-1001',
    productName: 'Aluminium Coil 5mm',
    systemQty: 320,
    actualQty: 315,
    difference: -5,
    date: '2026-04-20',
    notes: 'Cycle count variance found during aisle check.',
  },
  {
    id: 'AUD-1002',
    warehouseId: 'WH-02',
    warehouseName: 'North Depot',
    productId: 'PRD-1003',
    productName: 'Smart Sensor Panel',
    systemQty: 18,
    actualQty: 20,
    difference: 2,
    date: '2026-04-21',
    notes: 'Late inward scan reconciled.',
  },
]

export const DEFAULT_BARCODES = [
  {
    id: 'BAR-1001',
    productId: 'PRD-1001',
    productName: 'Aluminium Coil 5mm',
    codeType: 'Barcode',
    value: 'AC-5MM-01-PRD-1001',
    preview: '|||| AC-5MM-01 ||||',
    date: '2026-04-20',
  },
  {
    id: 'BAR-1002',
    productId: 'PRD-1004',
    productName: 'Packaging Carton XL',
    codeType: 'QR Code',
    value: 'QR:PRD-1004:PC-XL-24',
    preview: '[ QR ] Packaging Carton XL',
    date: '2026-04-21',
  },
]

export const DEFAULT_NOTIFICATIONS = [
  {
    id: 'NTF-1001',
    title: 'Inventory audit scheduled',
    type: 'Info',
    message: 'Central Hub cycle count is planned for this week.',
    source: 'Manual',
    date: '2026-04-20',
  },
  {
    id: 'NTF-1002',
    title: 'Customer return approved',
    type: 'Action',
    message: 'Safety Gloves Pro return needs quality review.',
    source: 'Manual',
    date: '2026-04-21',
  },
]

export const DEFAULT_ACCOUNTING_INVOICES = [
  {
    id: 'INV-1001',
    referenceId: 'PUR-1001',
    invoiceNo: 'PINV-1001',
    invoiceType: 'Purchases',
    partyId: 'SUP-1001',
    partyName: 'MetalWorks Supply',
    productId: 'PRD-1001',
    productName: 'Aluminium Coil 5mm',
    warehouseId: 'WH-01',
    warehouseName: 'Central Hub',
    quantity: 20,
    amount: 72000,
    date: '2026-04-10',
    status: 'Issued',
  },
  {
    id: 'INV-1002',
    referenceId: 'SAL-1001',
    invoiceNo: 'SINV-1001',
    invoiceType: 'Sales',
    partyId: 'CUS-1001',
    partyName: 'Apex Retail',
    productId: 'PRD-1004',
    productName: 'Packaging Carton XL',
    warehouseId: 'WH-03',
    warehouseName: 'Packaging Yard',
    quantity: 30,
    amount: 12600,
    date: '2026-04-12',
    status: 'Issued',
  },
]

export const DEFAULT_RETURNS = [
  {
    id: 'RTN-1001',
    entryType: 'Return',
    productId: 'PRD-1005',
    productName: 'Safety Gloves Pro',
    warehouseId: 'WH-02',
    warehouseName: 'North Depot',
    quantity: 6,
    date: '2026-04-19',
    reason: 'Customer size mismatch',
  },
  {
    id: 'RTN-1002',
    entryType: 'Damage',
    productId: 'PRD-1007',
    productName: 'Retail Display Stand',
    warehouseId: 'WH-04',
    warehouseName: 'Retail Buffer',
    quantity: 1,
    date: '2026-04-21',
    reason: 'Transit damage',
  },
]

export {
  addDaysToDate,
  compareDateOnly,
  formatDateForDisplay,
  formatDateTimeForDisplay,
  formatExactTimestamp,
  formatRelativeTime,
  getLocalTodayDate,
  getLogicalRequiredDate,
  isValidDateValue,
  normaliseDateOnlyPayload,
  parseDateValue,
  toDateInputValue,
}

export function getToday() {
  return getLocalTodayDate()
}

export function formatCurrency(value) {
  return formatINR(value)
}

export { formatCreditLimit, formatINR }

export function formatDate(value) {
  return formatDateForDisplay(value)
}

export function formatDateTime(value) {
  return formatDateTimeForDisplay(value)
}

export function createId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
}

export function isEmail(value) {
  return isValidEmail(value, { required: true })
}

export function normalizeEmail(value) {
  return sanitizeEmailInput(value)
}

export function getNameError(value, label = 'Name') {
  return getSharedNameError(value, { label, required: true })
}

export function getEmailError(value) {
  return getSharedEmailError(value, { required: true })
}

export function getRequiredError(value, label = 'Field') {
  if (!String(value ?? '').trim()) {
    return `${label} is required.`
  }

  return ''
}

export function getNumberError(value, label, options = {}) {
  const { min = 0, allowZero = true } = options

  if (!String(value ?? '').trim()) {
    return `${label} is required.`
  }

  const numericValue = Number(value)

  if (!Number.isFinite(numericValue)) {
    return `${label} must be a valid number.`
  }

  if (!allowZero && numericValue <= 0) {
    return `${label} must be greater than 0.`
  }

  if (numericValue < min) {
    return `${label} must be ${min} or more.`
  }

  return ''
}

export function getPasswordError(value, options = {}) {
  const { required = true } = options
  const cleanValue = value.trim()

  if (!cleanValue) {
    return required ? 'Password is required.' : ''
  }

  if (cleanValue.length < 6 || !/[A-Z]/.test(cleanValue) || !/\d/.test(cleanValue)) {
    return 'Password must be at least 6 characters and include 1 uppercase letter and 1 number.'
  }

  return ''
}

export function getConfirmPasswordError(password, confirmPassword) {
  if (!confirmPassword.trim()) {
    return 'Confirm password is required.'
  }

  if (password !== confirmPassword) {
    return 'Passwords do not match.'
  }

  return ''
}

export function getOtpError(value) {
  if (!value.trim()) {
    return 'OTP is required.'
  }

  if (!/^\d{6}$/.test(value.trim())) {
    return 'OTP must be 6 digits.'
  }

  return ''
}

export function createOtp() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

export function isOtpExpired(expiresAt) {
  return !expiresAt || Date.now() > expiresAt
}

export function upsertById(list, item) {
  const exists = list.some((entry) => entry.id === item.id)

  if (exists) {
    return list.map((entry) => (entry.id === item.id ? item : entry))
  }

  return [item, ...list]
}

export function getWarehouseName(warehouses, warehouseId) {
  return warehouses.find((item) => item.id === warehouseId)?.name ?? ''
}

export function getStockQuantity(stock, productId, warehouseId = '') {
  return stock
    .filter(
      (item) =>
        String(item.productId) === String(productId) &&
        (!warehouseId || String(item.warehouseId) === String(warehouseId)),
    )
    .reduce((total, item) => total + (Number(item.availableQty) || 0), 0)
}

export function syncProductsWithStock(products, stock, warehouses) {
  return products.map((product) => {
    const productId = product.id ?? product.productId
    const stockRecords = stock.filter((item) => String(item.productId) === String(productId))
    const stockRecord = stockRecords[0]
    const quantity = stockRecords.reduce(
      (total, item) => total + (Number(item.availableQty) || 0),
      0,
    )
    const status =
      String(product.status).toLowerCase() === 'inactive'
        ? 'Inactive'
        : quantity <= 0
          ? 'Out Of Stock'
          : quantity <= Number(product.reorderLevel || 0)
            ? 'Low Stock'
            : 'In Stock'

    return {
      ...product,
      stock: quantity,
      warehouseId: stockRecord?.warehouseId ?? product.warehouseId ?? '',
      warehouseName:
        stockRecord?.warehouseName ??
        getWarehouseName(warehouses, product.warehouseId) ??
        '',
      status,
    }
  })
}

export function setProductStockQuantity({
  stock,
  products,
  warehouses,
  productId,
  quantity,
  warehouseId,
  date,
}) {
  const product = products.find((item) => item.id === productId)

  if (!product) {
    return stock
  }

  const currentRecord = stock.find((item) => item.productId === productId)
  const warehouseName =
    getWarehouseName(warehouses, warehouseId) ||
    currentRecord?.warehouseName ||
    product.warehouseName ||
    ''

  const nextRecord = {
    id: currentRecord?.id ?? createId('STK'),
    productId,
    productName: product.name,
    productImage: product.image || product.imageUrl || currentRecord?.productImage || '',
    sku: product.sku,
    warehouseId: warehouseId || currentRecord?.warehouseId || product.warehouseId || '',
    warehouseName,
    availableQty: Math.max(0, Number(quantity) || 0),
    reservedQty: Number(currentRecord?.reservedQty) || 0,
    reorderLevel: Number(product.reorderLevel) || 0,
    lastUpdated: date || getToday(),
  }

  if (currentRecord) {
    return stock.map((item) => (item.productId === productId ? nextRecord : item))
  }

  return [nextRecord, ...stock]
}

export function adjustStockQuantity({
  stock,
  products,
  warehouses,
  productId,
  quantityChange,
  warehouseId,
  date,
}) {
  const currentRecord = stock.find((item) => item.productId === productId)
  const currentQty = Number(currentRecord?.availableQty) || 0
  const nextQty = currentQty + (Number(quantityChange) || 0)

  if (nextQty < 0) {
    return {
      success: false,
      message: 'Not enough stock available for this action.',
    }
  }

  return {
    success: true,
    stock: setProductStockQuantity({
      stock,
      products,
      warehouses,
      productId,
      quantity: nextQty,
      warehouseId,
      date,
    }),
  }
}

export function buildInvoiceEntry({
  id = createId('INV'),
  referenceId = '',
  invoiceType = 'Sales',
  partyId = '',
  partyName = '',
  productId = '',
  productName = '',
  warehouseId = '',
  warehouseName = '',
  quantity = 0,
  amount = 0,
  date = getToday(),
  status = 'Draft',
}) {
  const invoicePrefix = invoiceType === 'Sales' ? 'SINV' : 'PINV'

  return {
    id,
    referenceId,
    invoiceNo: `${invoicePrefix}-${id.split('-').at(-1)}`,
    invoiceType,
    partyId,
    partyName,
    productId,
    productName,
    warehouseId,
    warehouseName,
    quantity: Number(quantity) || 0,
    amount: Number(amount) || 0,
    date,
    status,
  }
}

export function createTransactionInvoice(record, invoiceType) {
  const isSale = invoiceType === 'Sales'

  return buildInvoiceEntry({
    referenceId: record.id,
    invoiceType,
    partyId: isSale ? record.customerId : record.supplierId,
    partyName: isSale ? record.customerName : record.supplierName,
    productId: record.productId,
    productName: record.productName,
    warehouseId: record.warehouseId,
    warehouseName: record.warehouseName,
    quantity: record.quantity,
    amount: record.total,
    date: record.date,
    status: 'Issued',
  })
}

export function isActiveInventoryProduct(item) {
  if (!item) return false
  const rawStatus = String(item?.rawStatus ?? item?.sourceStatus ?? item?.status ?? '').trim().toLowerCase()
  const isArchived = Boolean(
    (item?.isArchived ?? item?.IsArchived ?? item?.is_archived) ||
    rawStatus === 'archived' ||
    rawStatus === 'discontinued'
  )
  const isDeleted = Boolean(item?.isDeleted ?? item?.IsDeleted)

  return !isDeleted && !isArchived && rawStatus !== 'archived' && rawStatus !== 'discontinued' && rawStatus !== 'inactive'
}

export function isLowStockProduct(item) {
  return (
    isActiveInventoryProduct(item) &&
    Number(item?.stock ?? item?.currentStock ?? item?.availableQty ?? 0) <= Number(item?.reorderLevel ?? 0)
  )
}

export function getLowStockProducts(products) {
  return products.filter(isLowStockProduct)
}

export function getInventoryValue(products) {
  return products.reduce(
    (total, item) => total + Number(item.stock || 0) * Number(item.cost || 0),
    0,
  )
}

export function getCategoryChartData(products) {
  const categoryMap = new Map()

  products.forEach((item) => {
    const currentValue = categoryMap.get(item.category) ?? 0
    categoryMap.set(item.category, currentValue + Number(item.stock || 0))
  })

  return [...categoryMap.entries()].map(([name, stock]) => ({
    name,
    stock,
  }))
}

export function getMonthlyTransactionData(purchases, sales) {
  const monthMap = new Map()

  purchases.forEach((item) => {
    const month = item.date.slice(0, 7)
    const currentValue = monthMap.get(month) ?? {
      month,
      purchases: 0,
      sales: 0,
    }

    monthMap.set(month, {
      ...currentValue,
      purchases: currentValue.purchases + Number(item.total || 0),
    })
  })

  sales.forEach((item) => {
    const month = item.date.slice(0, 7)
    const currentValue = monthMap.get(month) ?? {
      month,
      purchases: 0,
      sales: 0,
    }

    monthMap.set(month, {
      ...currentValue,
      sales: currentValue.sales + Number(item.total || 0),
    })
  })

  return [...monthMap.values()]
    .sort((firstItem, secondItem) => firstItem.month.localeCompare(secondItem.month))
    .map((item) => ({
      ...item,
      month: new Date(`${item.month}-01`).toLocaleString('en-US', {
        month: 'short',
      }),
    }))
}

export function buildInitialState({
  products,
  customers,
  suppliers,
  users,
  roles,
  stock,
}) {
  return {
    products: syncProductsWithStock(products, stock, DEFAULT_WAREHOUSES),
    customers,
    suppliers,
    users,
    roles,
    stock,
    warehouses: DEFAULT_WAREHOUSES,
    purchases: DEFAULT_PURCHASES,
    sales: DEFAULT_SALES,
    stockMovements: DEFAULT_STOCK_MOVEMENTS,
    inventoryAudits: DEFAULT_INVENTORY_AUDITS,
    barcodes: [],
    notifications: DEFAULT_NOTIFICATIONS,
    accountingInvoices: DEFAULT_ACCOUNTING_INVOICES,
    salesReturns: [],
    purchaseReturns: [],
  }
}

export function normaliseRows(value) {
  if (Array.isArray(value)) return value
  if (Array.isArray(value?.items)) return value.items
  if (Array.isArray(value?.records)) return value.records
  if (Array.isArray(value?.results)) return value.results
  if (Array.isArray(value?.data)) return value.data

  return []
}

export function getUniqueResponseError(...responses) {
  const messages = responses
    .filter((response) => !response?.success)
    .map(
      (response) =>
        response?.error ||
        response?.message ||
        'The request could not be completed. Please try again.',
    )
    .filter(Boolean)

  return [...new Set(messages)].join(' ')
}

export function rejectedResponse(message) {
  return {
    success: false,
    data: null,
    error: message,
    message: null,
    status: 0,
  }
}

export function settledResponse(result, fallbackMessage) {
  if (result.status === 'fulfilled') {
    return result.value
  }

  return rejectedResponse(fallbackMessage)
}

export function formatIndentNumber(rawIndent, rawDate) {
  const indentObj = typeof rawIndent === 'object' && rawIndent !== null ? rawIndent : null
  const str = String(
    indentObj?.indentNumber ||
    indentObj?.indentNo ||
    indentObj?.indentId ||
    indentObj?.purchaseIndentId ||
    (typeof rawIndent === 'string' || typeof rawIndent === 'number' ? rawIndent : '')
  ).trim()

  const fallbackDateStr = indentObj?.indentDate || indentObj?.createdAt || indentObj?.date || rawDate
  let datePart = ''

  if (fallbackDateStr) {
    const d = new Date(fallbackDateStr)
    if (!isNaN(d.getTime())) {
      const yyyy = d.getFullYear()
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      datePart = `${yyyy}${mm}${dd}`
    }
  }

  if (!datePart) {
    const today = new Date()
    const yyyy = today.getFullYear()
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    const dd = String(today.getDate()).padStart(2, '0')
    datePart = `${yyyy}${mm}${dd}`
  }

  if (!str || str === 'Not Available' || str === 'Not Provided' || str === 'EMPTY_VALUE') {
    return `IND-${datePart}-001`
  }

  const stdMatch = str.match(/^IND-(\d{8})-(\d+)$/i)
  if (stdMatch) {
    const dateStr = stdMatch[1]
    const seqNum = String(stdMatch[2]).padStart(3, '0')
    return `IND-${dateStr}-${seqNum}`
  }

  const dashDateMatch = str.match(/^IND-(\d{4})-(\d{2})-(\d{2})-(\d+)$/i)
  if (dashDateMatch) {
    const dateStr = `${dashDateMatch[1]}${dashDateMatch[2]}${dashDateMatch[3]}`
    const seqNum = String(dashDateMatch[4]).padStart(3, '0')
    return `IND-${dateStr}-${seqNum}`
  }

  const dashYearMonthMatch = str.match(/^IND-(\d{4})-(\d{2})-(\d+)$/i)
  if (dashYearMonthMatch) {
    const dateStr = `${dashYearMonthMatch[1]}${dashYearMonthMatch[2]}01`
    const seqNum = String(dashYearMonthMatch[3]).padStart(3, '0')
    return `IND-${dateStr}-${seqNum}`
  }

  const shortSeqMatch = str.match(/^(?:IND|PI)-(\d+)$/i)
  if (shortSeqMatch) {
    const seqNum = String(shortSeqMatch[1]).padStart(3, '0')
    return `IND-${datePart}-${seqNum}`
  }

  if (/^\d+$/.test(str)) {
    const seqNum = str.padStart(3, '0')
    return `IND-${datePart}-${seqNum}`
  }

  return str.toUpperCase()
}
