import { apiRequest, getResponseData, getResponseList } from './apiClient'
import { cachedApiRequest, createApiCacheKey, hasApiCache, invalidateApiCache } from './apiCache'
import { API_ENDPOINTS } from './endpoints'
import { sanitizeEmailInput } from '../validators/emailValidator'
import { sanitizePhoneInput } from '../validators/phoneValidator'

const DEFAULT_LIST_QUERY = { page: 1, pageSize: 100 }
const CUSTOMER_CACHE_PREFIX = 'customers:'

function normalizeId(value) {
  return value === undefined || value === null ? '' : String(value)
}

function readFirst(source, keys, fallback = '') {
  if (!source || typeof source !== 'object') {
    return fallback
  }

  for (const key of keys) {
    const value = source[key]

    if (value !== undefined && value !== null && value !== '') {
      return value
    }
  }

  return fallback
}

function toNumber(value, fallback = 0) {
  const parsedValue = Number(value)
  return Number.isFinite(parsedValue) ? parsedValue : fallback
}

function toOptionalNumber(value) {
  if (value === undefined || value === null || value === '') {
    return null
  }

  const parsedValue = Number(String(value).replace('%', ''))
  return Number.isFinite(parsedValue) ? parsedValue : null
}

function cleanString(value) {
  return String(value ?? '').trim()
}

function normalizeDateValue(value) {
  if (value === undefined || value === null || value === '') {
    return null
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString()
  }

  if (typeof value === 'number') {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date.toISOString()
  }

  const rawValue = String(value).trim()

  if (!rawValue) {
    return null
  }

  const directDate = new Date(rawValue)

  if (!Number.isNaN(directDate.getTime())) {
    return directDate.toISOString()
  }

  const sqlDateMatch = rawValue.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?/,
  )

  if (sqlDateMatch) {
    const [, year, month, day, hour = '00', minute = '00', second = '00'] = sqlDateMatch
    const date = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
    )

    return Number.isNaN(date.getTime()) ? null : date.toISOString()
  }

  const dayFirstDateMatch = rawValue.match(
    /^(\d{2})[/-](\d{2})[/-](\d{4})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/,
  )

  if (dayFirstDateMatch) {
    const [, day, month, year, hour = '00', minute = '00', second = '00'] = dayFirstDateMatch
    const date = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
    )

    return Number.isNaN(date.getTime()) ? null : date.toISOString()
  }

  return null
}

function normalizeEmail(value) {
  return sanitizeEmailInput(value)
}

function normalizePhone(value) {
  return sanitizePhoneInput(value)
}

function normalizeGstNumber(value) {
  return cleanString(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 15)
}

function titleCase(value) {
  return cleanString(value)
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function normalizeStatus(value) {
  const normalizedValue = cleanString(value || 'active').toLowerCase()

  if (['blocked', 'blacklisted', 'suspended'].includes(normalizedValue)) {
    return 'Blocked'
  }

  if (['inactive', 'disabled', 'archived'].includes(normalizedValue)) {
    return 'Inactive'
  }

  if (['pending', 'prospect'].includes(normalizedValue)) {
    return titleCase(normalizedValue)
  }

  return 'Active'
}

function buildAddress(customer) {
  const directAddress = readFirst(customer, [
    'address',
    'Address',
    'addressLine',
    'addressLine1',
    'billingAddress',
    'shippingAddress',
  ])

  if (directAddress) {
    return cleanString(directAddress)
  }

  return [
    readFirst(customer, ['city', 'City']),
    readFirst(customer, ['state', 'State']),
    readFirst(customer, ['postalCode', 'zipCode', 'pincode']),
  ]
    .map(cleanString)
    .filter(Boolean)
    .join(', ')
}

export function normalizeCustomer(customer = {}) {
  const id = normalizeId(readFirst(customer, ['id', 'customerId', 'CustomerId', '_id']))
  const createdAt = normalizeDateValue(readFirst(customer, [
    'createdAt',
    'CreatedAt',
    'created_at',
    'CreatedDate',
    'createdDate',
    'created_date',
    'CreatedOn',
    'createdOn',
    'created_on',
    'dateCreated',
  ], null))
  const updatedAt = normalizeDateValue(readFirst(customer, [
    'updatedAt',
    'UpdatedAt',
    'updated_at',
    'UpdatedDate',
    'updatedDate',
    'updated_date',
    'UpdatedOn',
    'updatedOn',
    'updated_on',
    'dateUpdated',
  ], null))
  const totalOrders = toNumber(
    readFirst(customer, [
      'totalOrders',
      'orderCount',
      'ordersCount',
      'salesCount',
      'transactionCount',
    ], 0),
  )
  const totalPurchases = toNumber(
    readFirst(customer, [
      'totalPurchases',
      'totalPurchaseAmount',
      'purchaseTotal',
      'totalAmount',
      'totalSpent',
      'lifetimeValue',
      'purchases',
      'totalSales',
      'salesTotal',
      'salesAmount',
    ], 0),
  )
  const outstandingBalance = toNumber(
    readFirst(customer, ['outstandingBalance', 'balance', 'OutstandingBalance', 'outstandingAmount'], 0),
  )
  const address = buildAddress(customer)
  const bankAccountsList = Array.isArray(customer.bankAccounts)
    ? customer.bankAccounts
    : Array.isArray(customer.bankDetails)
    ? customer.bankDetails
    : []
  const primaryBankAccount = bankAccountsList[0] || {}
  const accountNumber = cleanString(
    readFirst(customer, [
      'accountNumber',
      'accountNo',
      'bankAccountNumber',
      'account_number',
      'AccountNo',
      'AccountNumber',
    ]) || readFirst(primaryBankAccount, ['accountNumber', 'accountNo', 'AccountNumber'])
  )

  return {
    ...customer,
    id,
    customerId: id,
    customerCode: cleanString(readFirst(customer, ['customerCode', 'code', 'CustomerCode'])),
    name: cleanString(readFirst(customer, ['name', 'Name'])),
    email: normalizeEmail(readFirst(customer, ['email', 'Email'])),
    phone: normalizePhone(readFirst(customer, ['phone', 'Phone', 'mobile'])),
    company: cleanString(readFirst(customer, ['company', 'Company'])),
    companyName: cleanString(readFirst(customer, ['companyName', 'company', 'Company'])),
    address,
    city: cleanString(readFirst(customer, ['city', 'City'], address)),
    gstNumber: cleanString(readFirst(customer, ['gstNumber', 'gst', 'GSTNumber', 'taxNumber'])),
    taxNumber: cleanString(readFirst(customer, ['taxNumber', 'gstNumber', 'gst'])),
    panNumber: cleanString(readFirst(customer, ['panNumber', 'pan', 'PANNumber', 'PanNumber'])),
    notes: cleanString(readFirst(customer, ['notes', 'description', 'remark', 'remarks'])),
    creditLimit: toNumber(readFirst(customer, ['creditLimit', 'CreditLimit'], 0)),
    outstandingBalance,
    balance: outstandingBalance,
    totalOrders,
    totalPurchases,
    accountNumber,
    lastActivity: readFirst(customer, [
      'lastActivity',
      'lastActivityAt',
      'lastOrderAt',
      'updatedAt',
      'UpdatedAt',
      'createdAt',
      'CreatedAt',
    ]),
    createdAt,
    updatedAt,
    contacts: Array.isArray(customer.contacts)
      ? customer.contacts
      : Array.isArray(customer.Contacts) ? customer.Contacts : [],
    addresses: Array.isArray(customer.addresses)
      ? customer.addresses
      : Array.isArray(customer.Addresses) ? customer.Addresses : [],
    bankDetails: Array.isArray(customer.bankDetails)
      ? customer.bankDetails
      : Array.isArray(customer.BankDetails)
        ? customer.BankDetails
        : Array.isArray(customer.bankAccounts)
          ? customer.bankAccounts
          : Array.isArray(customer.BankAccounts) ? customer.BankAccounts : [],
    paymentTerms: customer.paymentTerms || customer.PaymentTerms || customer.paymentTerm || null,
    activity: Array.isArray(customer.activity)
      ? customer.activity
      : Array.isArray(customer.Activity) ? customer.Activity : [],
    status: normalizeStatus(readFirst(customer, ['status', 'Status'])),
  }
}

export function normalizeCustomerSummary(summary = {}) {
  const source = getResponseData({ data: summary }, summary) ?? {}

  return {
    totalCustomers: toOptionalNumber(readFirst(source, ['totalCustomers', 'customers', 'total'])),
    activeCustomers: toOptionalNumber(readFirst(source, ['activeCustomers', 'active'])),
    repeatCustomers: toOptionalNumber(readFirst(source, ['repeatCustomers', 'repeat'])),
    newCustomers: toOptionalNumber(readFirst(source, ['newCustomers', 'new'])),
    outstandingReceivables: toOptionalNumber(readFirst(source, [
      'outstandingReceivables',
      'outstanding',
      'totalOutstanding',
    ])),
    creditUtilization: toOptionalNumber(readFirst(source, [
      'creditUtilization',
      'utilization',
      'creditUtilizationPercent',
    ])),
    customerGrowth: toOptionalNumber(readFirst(source, [
      'customerGrowth',
      'growth',
      'growthRate',
      'monthlyGrowth',
    ])),
  }
}

export function normalizeCustomerHistoryItem(item = {}) {
  const id = normalizeId(readFirst(item, ['id', 'activityId', 'transactionId', '_id']))
  const type = titleCase(readFirst(item, [
    'activityType',
    'type',
    'transactionType',
    'eventType',
  ], 'Activity'))
  const amount = toNumber(readFirst(item, ['amount', 'total', 'totalAmount', 'value'], 0))
  const quantity = toNumber(readFirst(item, ['quantity', 'qty'], 0))
  const productName = cleanString(readFirst(item, ['productName', 'product', 'itemName']))

  return {
    ...item,
    id,
    type,
    description: cleanString(readFirst(item, [
      'description',
      'message',
      'notes',
      'summary',
    ], type)),
    date: readFirst(item, ['createdAt', 'date', 'transactionDate', 'updatedAt']),
    amount,
    quantity,
    productName,
    status: normalizeStatus(readFirst(item, ['status'], type)),
    isTransaction:
      amount > 0 ||
      quantity > 0 ||
      Boolean(productName) ||
      /sale|purchase|order|invoice|payment|return/i.test(type),
  }
}

export function buildCustomerPayload(values = {}) {
  const primaryAddress = Array.isArray(values.addresses)
    ? values.addresses.find((item) => item.addressLine || item.addressLine1) || values.addresses[0]
    : null
  const address = cleanString(readFirst(values, [
    'address',
    'city',
  ], primaryAddress?.addressLine || primaryAddress?.addressLine1 || primaryAddress?.city || ''))
  const gstNumber = normalizeGstNumber(readFirst(values, ['gstNumber', 'taxNumber', 'gst']))
  const hasPaymentTerms =
    values.paymentTerms !== null &&
    values.paymentTerm !== null &&
    (values.paymentTerms !== undefined || values.paymentTerm !== undefined)
  const paymentTerms = values.paymentTerms || values.paymentTerm || {}

  return {
    customerCode: cleanString(values.customerCode).toUpperCase(),
    name: cleanString(values.name),
    company: cleanString(readFirst(values, ['company', 'companyName'])),
    phone: normalizePhone(values.phone),
    email: normalizeEmail(values.email),
    address,
    city: address,
    gstNumber,
    taxNumber: gstNumber,
    panNumber: cleanString(values.panNumber).toUpperCase(),
    notes: cleanString(values.notes),
    status: normalizeStatus(values.status),
    creditDays: toNumber(paymentTerms.creditDays ?? values.creditDays, 0),
    paymentMode: cleanString(paymentTerms.paymentMode ?? values.paymentMode),
    creditLimit: toNumber(paymentTerms.creditLimit ?? values.creditLimit, 0),
    outstandingBalance: toNumber(
      readFirst(values, ['outstandingBalance', 'balance'], 0),
      0,
    ),
    contacts: Array.isArray(values.contacts)
      ? values.contacts.map((contact) => ({
          contactName: cleanString(contact.contactName || contact.name),
          role: cleanString(contact.role || contact.contactRole),
          designation: cleanString(contact.designation),
          phone: normalizePhone(contact.phone),
          email: normalizeEmail(contact.email),
          isPrimary: Boolean(contact.isPrimary),
        }))
      : [],
    addresses: Array.isArray(values.addresses)
      ? values.addresses.map((addressItem) => ({
          addressType: cleanString(addressItem.addressType || addressItem.type || 'Billing'),
          addressLine: cleanString(addressItem.addressLine || addressItem.addressLine1),
          addressLine2: cleanString(addressItem.addressLine2),
          city: cleanString(addressItem.city),
          state: cleanString(addressItem.state),
          country: cleanString(addressItem.country || 'India'),
          pincode: cleanString(addressItem.country || 'India').toLowerCase() === 'india'
            ? cleanString(addressItem.pincode).replace(/\D/g, '').slice(0, 6)
            : cleanString(addressItem.pincode).toUpperCase().replace(/[^A-Z0-9 -]/g, '').slice(0, 12),
          isPrimary: Boolean(addressItem.isPrimary),
        }))
      : [],
    bankDetails: Array.isArray(values.bankDetails || values.bankAccounts)
      ? (values.bankDetails || values.bankAccounts).map((bank) => ({
          accountName: cleanString(bank.accountName),
          accountNumber: cleanString(bank.accountNumber).replace(/\D/g, '').slice(0, 18),
          bankName: cleanString(bank.bankName),
          ifscCode: cleanString(bank.ifscCode).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11),
          branch: cleanString(bank.branch),
          isPrimary: Boolean(bank.isPrimary),
        }))
      : [],
    bankAccounts: Array.isArray(values.bankDetails || values.bankAccounts)
      ? (values.bankDetails || values.bankAccounts).map((bank) => ({
          accountName: cleanString(bank.accountName),
          accountNumber: cleanString(bank.accountNumber).replace(/\D/g, '').slice(0, 18),
          bankName: cleanString(bank.bankName),
          ifscCode: cleanString(bank.ifscCode).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11),
          branch: cleanString(bank.branch),
          isPrimary: Boolean(bank.isPrimary),
        }))
      : [],
    paymentTerms: hasPaymentTerms ? {
      creditDays: toNumber(paymentTerms.creditDays ?? values.creditDays, 0),
      creditLimit: toNumber(paymentTerms.creditLimit ?? values.creditLimit, 0),
      paymentMode: cleanString(paymentTerms.paymentMode ?? paymentTerms.preferredPaymentMethod ?? values.paymentMode),
      notes: cleanString(paymentTerms.notes),
    } : null,
  }
}

export function getChangedCustomerFields(initialValues = {}, nextValues = {}) {
  const initialPayload = buildCustomerPayload(initialValues)
  const nextPayload = buildCustomerPayload(nextValues)

  function comparablePayloadValue(value) {
    return value !== null && typeof value === 'object'
      ? JSON.stringify(value)
      : String(value ?? '')
  }

  return Object.keys(nextPayload).reduce((changedFields, key) => {
    if (comparablePayloadValue(initialPayload[key]) !== comparablePayloadValue(nextPayload[key])) {
      changedFields[key] = nextPayload[key]
    }

    return changedFields
  }, {})
}

export function getAllCustomers(query = {}) {
  return apiRequest(API_ENDPOINTS.customers.list, {
    query: {
      ...DEFAULT_LIST_QUERY,
      ...query,
    },
  })
}

export function invalidateCustomerCache() {
  invalidateApiCache(CUSTOMER_CACHE_PREFIX)
}

export function getCustomers(query = {}, options = {}) {
  const normalizedQuery = {
    ...DEFAULT_LIST_QUERY,
    ...query,
  }

  return cachedApiRequest(
    createApiCacheKey(CUSTOMER_CACHE_PREFIX, normalizedQuery),
    async () => {
      const response = await getAllCustomers(normalizedQuery)

      if (!response.success) {
        return response
      }

      const rawCustomers = getResponseList(response, 'customers')
      const normalizedCustomers = rawCustomers.map(normalizeCustomer)

      return {
        ...response,
        data: normalizedCustomers,
      }
    },
    options,
  )
}
getCustomers.hasCache = (query = {}) => hasApiCache(createApiCacheKey(CUSTOMER_CACHE_PREFIX, { ...DEFAULT_LIST_QUERY, ...query }))

export async function getCustomerById(id) {
  const response = await apiRequest(API_ENDPOINTS.customers.byId(id))

  if (!response.success) {
    return response
  }

  return {
    ...response,
    data: normalizeCustomer(getResponseData(response, {})),
  }
}

export async function getCustomerSummary() {
  const response = await apiRequest(API_ENDPOINTS.customers.summary)

  if (!response.success) {
    return response
  }

  return {
    ...response,
    data: normalizeCustomerSummary(getResponseData(response, {})),
  }
}

export async function getCustomerHistory(id) {
  const response = await apiRequest(API_ENDPOINTS.customers.history(id))

  if (!response.success) {
    return response
  }

  return {
    ...response,
    data: getResponseList(response, 'history').map(normalizeCustomerHistoryItem),
  }
}

async function runCustomerMutation(request) {
  const response = await request
  if (response.success) {
    invalidateCustomerCache()
  }
  return response
}

export async function createCustomer(data) {
  const payload = buildCustomerPayload(data)
  const response = await runCustomerMutation(apiRequest(API_ENDPOINTS.customers.list, {
    method: 'POST',
    body: {
      ...payload,
      customerCode: '',
    },
  }))

  if (!response.success) {
    return response
  }

  return {
    ...response,
    data: normalizeCustomer(getResponseData(response, {})),
  }
}

export async function updateCustomer(id, data) {
  const response = await runCustomerMutation(apiRequest(API_ENDPOINTS.customers.byId(id), {
    method: 'PUT',
    body: buildCustomerPayload(data),
  }))

  if (!response.success) {
    return response
  }

  return {
    ...response,
    data: normalizeCustomer(getResponseData(response, {})),
  }
}

export async function updateCustomerStatus(id, data) {
  const response = await runCustomerMutation(apiRequest(API_ENDPOINTS.customers.status(id), {
    method: 'PATCH',
    body: {
      status: cleanString(data?.status),
      reason: cleanString(data?.reason),
    },
  }))

  if (!response.success) {
    return response
  }

  return {
    ...response,
    data: normalizeCustomer(getResponseData(response, {})),
  }
}

export function deleteCustomer(id) {
  return runCustomerMutation(apiRequest(API_ENDPOINTS.customers.byId(id), {
    method: 'DELETE',
  }))
}
