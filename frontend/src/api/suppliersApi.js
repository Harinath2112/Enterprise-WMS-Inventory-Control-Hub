import { apiRequest, buildApiHeaders, buildUrl, getResponseData, getResponseList } from './apiClient'
import { cachedApiRequest, createApiCacheKey, hasApiCache, invalidateApiCache } from './apiCache'
import { API_ENDPOINTS } from './endpoints'
import { normalizeSupplierDocumentType } from '../modules/Suppliers/supplierDocumentTypes'
import { sanitizeEmailInput } from '../validators/emailValidator'
import { sanitizePhoneInput } from '../validators/phoneValidator'

const DEFAULT_LIST_QUERY = { page: 1, pageSize: 100 }
const SUPPLIER_CACHE_PREFIX = 'suppliers:'

function readValue(source, ...keys) {
  return keys.reduce((result, key) => (
    result !== undefined && result !== null ? result : source?.[key]
  ), undefined)
}

function cleanString(value) {
  return String(value ?? '').trim()
}

function cleanDigits(value, maxLength) {
  const digits = cleanString(value).replace(/\D/g, '')
  return maxLength ? digits.slice(0, maxLength) : digits
}

function cleanCode(value, maxLength) {
  return cleanString(value).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, maxLength)
}

function normalizeStatus(value) {
  return cleanString(value || 'active').toLowerCase()
}

function toSupplierStatus(value) {
  const normalized = normalizeStatus(value)
  return ['active', 'blocked', 'inactive', 'pending'].includes(normalized)
    ? normalized
    : 'active'
}

function normalizeTitleValue(value) {
  return cleanString(value)
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function normalizeContacts(contacts) {
  return Array.isArray(contacts)
    ? contacts.map((contact) => ({
        id: readValue(contact, 'id', 'contactId', 'ContactId'),
        name: readValue(contact, 'name', 'Name') || '',
        designation: readValue(contact, 'designation', 'Designation') || '',
        department: readValue(contact, 'department', 'Department') || '',
        phone: readValue(contact, 'phone', 'Phone') || '',
        email: readValue(contact, 'email', 'Email') || '',
        isPrimary: Boolean(readValue(contact, 'isPrimary', 'IsPrimary')),
      }))
    : []
}

function normalizeAddresses(addresses) {
  return Array.isArray(addresses)
    ? addresses.map((address) => ({
        id: readValue(address, 'id', 'addressId', 'AddressId'),
        type: normalizeTitleValue(readValue(address, 'type', 'addressType', 'AddressType') || 'Billing'),
        addressLine1: readValue(address, 'addressLine1', 'addressLine', 'AddressLine') || '',
        addressLine2: readValue(address, 'addressLine2') || '',
        city: readValue(address, 'city', 'City') || '',
        state: readValue(address, 'state', 'State') || '',
        country: readValue(address, 'country', 'Country') || 'India',
        pincode: readValue(address, 'pincode', 'Pincode', 'postalCode') || '',
      }))
    : []
}

function normalizePaymentTerm(supplier) {
  const paymentTerm = readValue(supplier, 'paymentTerm', 'PaymentTerm', 'paymentTermsProfile') || {}

  return {
    creditDays: readValue(paymentTerm, 'creditDays', 'CreditDays') ?? readValue(supplier, 'creditDays', 'CreditDays') ?? '',
    creditLimit: readValue(paymentTerm, 'creditLimit', 'CreditLimit') ?? readValue(supplier, 'creditLimit', 'CreditLimit') ?? '',
    preferredPaymentMethod: normalizeTitleValue(readValue(paymentTerm, 'preferredPaymentMethod', 'paymentMethod', 'PaymentMethod') || ''),
    currency: readValue(paymentTerm, 'currency', 'Currency') || '',
    taxType: readValue(paymentTerm, 'taxType', 'TaxType') || '',
    notes: readValue(paymentTerm, 'notes', 'Notes') || '',
  }
}

function normalizeBankAccounts(bankAccounts) {
  return Array.isArray(bankAccounts)
    ? bankAccounts.map((account, index) => ({
        id: readValue(account, 'id', 'bankId', 'BankId'),
        accountName: readValue(account, 'accountName', 'AccountName') || '',
        accountNumber: readValue(account, 'accountNumber', 'AccountNumber') || '',
        bankName: readValue(account, 'bankName', 'BankName') || '',
        ifscCode: readValue(account, 'ifscCode', 'IfscCode', 'IFSCCode') || '',
        branch: readValue(account, 'branch', 'Branch') || '',
        bankState: readValue(account, 'bankState', 'BankState') || '',
        bankCity: readValue(account, 'bankCity', 'BankCity') || '',
        upiId: readValue(account, 'upiId', 'UpiId') || '',
        isPrimary: Boolean(readValue(account, 'isPrimary', 'IsPrimary')) || index === 0,
      }))
    : []
}

function normalizeDocument(document) {
  const id = String(readValue(document, 'id', 'documentId', 'supplierDocumentId', 'DocumentId', '_id') ?? '')

  return {
    ...document,
    id,
    documentId: id,
    type: normalizeSupplierDocumentType(readValue(document, 'type', 'documentType', 'DocumentType')),
    documentType: normalizeSupplierDocumentType(readValue(document, 'documentType', 'DocumentType', 'type')),
    displayName: readValue(document, 'displayName', 'DisplayName') || '',
    fileName: readValue(document, 'fileName', 'FileName', 'name', 'Name', 'originalFileName', 'OriginalFileName', 'originalName', 'OriginalName') || '',
    originalFileName: readValue(document, 'originalFileName', 'OriginalFileName', 'fileName', 'FileName', 'name', 'Name') || '',
    fileSize: readValue(document, 'fileSize', 'FileSize', 'fileSizeInBytes', 'FileSizeInBytes', 'fileSizeBytes', 'FileSizeBytes', 'sizeInBytes', 'SizeInBytes', 'size', 'Size', 'length', 'Length') ?? null,
    uploadedAt: readValue(document, 'uploadedAt', 'UploadedAt', 'uploadedOn', 'UploadedOn', 'createdAt', 'CreatedAt', 'uploadDate', 'UploadDate') || '',
    status: readValue(document, 'status', 'Status') || 'Uploaded',
    isTemporary: Boolean(readValue(document, 'isTemporary', 'IsTemporary')),
  }
}

export function normalizeSupplier(supplier) {
  const id = String(readValue(supplier, 'id', 'supplierId', 'SupplierId', '_id') ?? '')
  const contacts = normalizeContacts(readValue(supplier, 'contacts', 'Contacts'))
  const addresses = normalizeAddresses(readValue(supplier, 'addresses', 'Addresses'))
  const paymentTerm = normalizePaymentTerm(supplier)
  const bankAccounts = normalizeBankAccounts(readValue(supplier, 'bankAccounts', 'BankAccounts'))

  const gstNumber = readValue(supplier, 'gstNumber', 'GstNumber', 'gst', 'gstin', 'GSTIN', 'GSTNumber', 'taxNumber', 'taxId') || ''
  const panNumber = readValue(supplier, 'panNumber', 'PanNumber', 'pan', 'PAN', 'panNo', 'PanNo') || ''

  return {
    ...supplier,
    id,
    supplierId: id,
    supplierCode: readValue(supplier, 'supplierCode', 'SupplierCode') || '',
    name: readValue(supplier, 'name', 'Name') || '',
    companyName: readValue(supplier, 'companyName', 'CompanyName', 'company') || '',
    category: readValue(supplier, 'category', 'Category') || '',
    gstNumber,
    panNumber,
    gstin: gstNumber,
    gst: gstNumber,
    pan: panNumber,
    contact: readValue(supplier, 'contact', 'Contact') || contacts.find((contact) => contact.isPrimary)?.name || readValue(supplier, 'name', 'Name') || '',
    email: readValue(supplier, 'email', 'Email') || contacts.find((contact) => contact.isPrimary)?.email || '',
    phone: readValue(supplier, 'phone', 'Phone') || contacts.find((contact) => contact.isPrimary)?.phone || '',
    website: readValue(supplier, 'website', 'Website') || '',
    status: normalizeStatus(readValue(supplier, 'status', 'Status')),
    totalPurchaseAmount: readValue(supplier, 'totalPurchaseAmount', 'TotalPurchaseAmount', 'totalPurchases', 'TotalPurchases', 'totalPurchase', 'TotalPurchase', 'totalAmount', 'TotalAmount', 'purchases', 'Purchases', 'purchaseAmount', 'PurchaseAmount') ?? null,
    paidAmount: readValue(supplier, 'paidAmount', 'PaidAmount', 'totalPaid', 'TotalPaid', 'paid', 'Paid') ?? 0,
    totalPaid: readValue(supplier, 'totalPaid', 'TotalPaid', 'paidAmount', 'PaidAmount', 'paid', 'Paid') ?? 0,
    outstandingPayable: readValue(supplier, 'outstandingPayable', 'OutstandingPayable', 'outstandingAmount', 'OutstandingAmount', 'outstandingBalance', 'OutstandingBalance', 'balanceAmount', 'BalanceAmount', 'outstanding', 'Outstanding', 'balance', 'Balance') ?? null,
    isDeleted: Boolean(readValue(supplier, 'isDeleted', 'IsDeleted')),
    deletedAt: readValue(supplier, 'deletedAt', 'DeletedAt') || '',
    contacts,
    addresses,
    paymentTerm,
    bankAccounts,
    documents: getResponseList({ data: readValue(supplier, 'documents', 'Documents') }).map(normalizeDocument),
  }
}

export function toSupplierPayload(data = {}) {
  const paymentTerm = data.paymentTermsProfile || data.paymentTerm || {}

  const rawGst = data.gstNumber || data.gstin || data.gst || data.GSTIN || data.GSTNumber || data.taxNumber
  const rawPan = data.panNumber || data.pan || data.PAN || data.PanNumber || data.panNo

  const gstNumber = cleanCode(rawGst, 15)
  const panNumber = cleanCode(rawPan, 10)

  const contactsList = Array.isArray(data.contacts) ? data.contacts : []
  const primaryContact = contactsList.find((c) => c?.isPrimary) || contactsList[0] || {}

  const phone = sanitizePhoneInput(data.phone || primaryContact.phone || '')
  const email = sanitizeEmailInput(data.email || primaryContact.email || '')

  function safeId(value) {
    if (value === null || value === undefined || value === '') return null
    const num = Number(value)
    return Number.isInteger(num) && num > 0 ? num : null
  }

  return {
    supplierCode: cleanString(data.supplierCode).toUpperCase(),
    name: cleanString(data.name),
    companyName: cleanString(data.companyName),
    gstNumber,
    panNumber,
    gstin: gstNumber,
    gst: gstNumber,
    pan: panNumber,
    phone,
    email,
    website: cleanString(data.website),
    status: toSupplierStatus(data.status),
    category: cleanString(data.category),
    contacts: contactsList.map((contact) => {
      const contactId = safeId(contact.contactId ?? contact.id)
      return {
        contactId,
        id: contactId,
        name: cleanString(contact.name),
        designation: cleanString(contact.designation),
        department: cleanString(contact.department),
        phone: sanitizePhoneInput(contact.phone),
        email: sanitizeEmailInput(contact.email),
        isPrimary: Boolean(contact.isPrimary),
      }
    }),
    addresses: (Array.isArray(data.addresses) ? data.addresses : []).map((address) => {
      const addressId = safeId(address.addressId ?? address.id)
      const line1 = cleanString(address.addressLine1 || address.addressLine)
      const line2 = cleanString(address.addressLine2)
      return {
        addressId,
        id: addressId,
        addressType: cleanString(address.type || address.addressType || 'Billing'),
        addressLine1: line1,
        addressLine2: line2,
        addressLine: line1,
        city: cleanString(address.city),
        state: cleanString(address.state),
        country: cleanString(address.country || 'India'),
        pincode: cleanString(address.country || 'India').toLowerCase() === 'india'
          ? cleanDigits(address.pincode, 6)
          : cleanString(address.pincode).toUpperCase().replace(/[^A-Z0-9 -]/g, '').slice(0, 12),
      }
    }),
    paymentTerm: {
      creditDays: Number(paymentTerm.creditDays || data.creditDays || 0),
      creditLimit: paymentTerm.creditLimit === '' || paymentTerm.creditLimit === null || paymentTerm.creditLimit === undefined
        ? null
        : Number(paymentTerm.creditLimit),
      paymentMethod: cleanString(paymentTerm.preferredPaymentMethod || paymentTerm.paymentMethod || ''),
      notes: cleanString(paymentTerm.notes),
    },
    bankAccounts: (Array.isArray(data.bankAccounts) ? data.bankAccounts : []).map((account) => {
      const bankId = safeId(account.bankId ?? account.id)
      return {
        bankId,
        id: bankId,
        accountName: cleanString(account.accountName),
        accountNumber: cleanDigits(account.accountNumber),
        bankName: cleanString(account.bankName),
        ifscCode: cleanString(account.ifscCode).toUpperCase(),
        branch: cleanString(account.branch),
        bankState: cleanString(account.bankState),
        bankCity: cleanString(account.bankCity),
        upiId: cleanString(account.upiId),
      }
    }),
  }
}

export function getAllSuppliers(query = {}) {
  return apiRequest(API_ENDPOINTS.suppliers.list, {
    query: {
      ...DEFAULT_LIST_QUERY,
      ...query,
    },
  })
}

export function invalidateSupplierCache() {
  invalidateApiCache(SUPPLIER_CACHE_PREFIX)
}

export function getSuppliers(query = {}, options = {}) {
  const normalizedQuery = {
    includeDeleted: true,
    includeArchived: true,
    ...query,
  }

  return cachedApiRequest(
    createApiCacheKey(SUPPLIER_CACHE_PREFIX, normalizedQuery),
    async () => {
      const response = await getAllSuppliers(normalizedQuery)
      if (!response.success) {
        return response
      }
      return {
        ...response,
        data: getResponseList(response, 'suppliers').map(normalizeSupplier),
      }
    },
    options,
  )
}
getSuppliers.hasCache = (query = {}) => hasApiCache(createApiCacheKey(SUPPLIER_CACHE_PREFIX, { includeDeleted: true, includeArchived: true, ...query }))

export async function getSupplierById(id) {
  const response = await apiRequest(API_ENDPOINTS.suppliers.byId(id))

  if (!response.success) {
    return response
  }

  return {
    ...response,
    data: normalizeSupplier(getResponseData(response)),
  }
}

async function runSupplierMutation(request) {
  const response = await request
  if (response.success) {
    invalidateSupplierCache()
  }
  return response
}

export function createSupplier(data) {
  return runSupplierMutation(apiRequest(API_ENDPOINTS.suppliers.list, {
    method: 'POST',
    body: toSupplierPayload(data),
  }))
}

export function updateSupplier(id, data) {
  return runSupplierMutation(apiRequest(API_ENDPOINTS.suppliers.byId(id), {
    method: 'PUT',
    body: toSupplierPayload(data),
  }))
}

export function deleteSupplier(id) {
  return runSupplierMutation(apiRequest(API_ENDPOINTS.suppliers.byId(id), {
    method: 'DELETE',
  }))
}

export function restoreSupplier(id) {
  return runSupplierMutation(apiRequest(API_ENDPOINTS.suppliers.restore(id), {
    method: 'POST',
  }))
}

export function cleanupSupplierTempDocuments(supplierId) {
  return apiRequest(API_ENDPOINTS.suppliers.cleanupTempDocuments(supplierId), {
    method: 'DELETE',
  })
}

export async function getSupplierIfscDetails(ifscCode) {
  const normalizedIfsc = cleanString(ifscCode).toUpperCase()
  console.log('[Suppliers IFSC] request', normalizedIfsc)

  const response = await apiRequest(API_ENDPOINTS.suppliers.ifsc(normalizedIfsc))

  if (response.success) {
    console.log('[Suppliers IFSC] response', response.data)
  } else {
    console.log('[Suppliers IFSC] error', response.error || response.message || response)
  }

  return response
}

export async function getSupplierDocuments(supplierId) {
  const response = await apiRequest(API_ENDPOINTS.suppliers.documents(supplierId))

  if (!response.success) {
    return response
  }

  return {
    ...response,
    data: getResponseList(response, 'documents').map(normalizeDocument),
  }
}

export function uploadSupplierDocument(supplierId, { documentType, file, onProgress }) {
  const formData = new FormData()
  formData.append('documentType', normalizeSupplierDocumentType(documentType))
  formData.append('file', file)

  if (typeof onProgress !== 'function') {
    return apiRequest(API_ENDPOINTS.suppliers.uploadDocument(supplierId), {
      method: 'POST',
      body: formData,
      timeoutMs: 60000,
    })
  }

  return uploadSupplierDocumentWithProgress(
    API_ENDPOINTS.suppliers.uploadDocument(supplierId),
    formData,
    onProgress,
  )
}

function uploadSupplierDocumentWithProgress(endpoint, formData, onProgress) {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', buildUrl(endpoint))
    xhr.timeout = 60000
    Object.entries(buildApiHeaders())
      .forEach(([header, value]) => {
        xhr.setRequestHeader(header, value)
      })

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100))
      }
    }

    xhr.onload = () => {
      const payload = parseXhrPayload(xhr)
      const success = xhr.status >= 200 && xhr.status < 300

      resolve({
        success,
        data: payload?.data ?? payload?.Data ?? payload,
        message: payload?.message ?? payload?.Message ?? null,
        error: success ? null : getUploadError(payload, xhr.status),
        errors: payload?.errors ?? payload?.Errors ?? null,
        status: xhr.status,
      })
    }

    xhr.onerror = () => {
      resolve({
        success: false,
        data: null,
        message: null,
        error: 'Unable to reach the IMS API. Check the backend server and VITE_API_BASE_URL.',
        errors: null,
        status: 0,
      })
    }

    xhr.ontimeout = () => {
      resolve({
        success: false,
        data: null,
        message: null,
        error: 'Upload timed out. Please check your connection and try again.',
        errors: null,
        status: 0,
      })
    }

    xhr.send(formData)
  })
}

function parseXhrPayload(xhr) {
  const rawValue = xhr.responseText || ''

  if (!rawValue) {
    return null
  }

  try {
    return JSON.parse(rawValue)
  } catch {
    return rawValue
  }
}

function getUploadError(payload, status) {
  if (typeof payload === 'string' && payload.trim()) {
    return payload
  }

  return (
    payload?.message ||
    payload?.Message ||
    payload?.error ||
    payload?.Error ||
    `Document upload failed with status ${status}.`
  )
}

export function deleteSupplierDocument(documentId) {
  return apiRequest(API_ENDPOINTS.suppliers.deleteDocument(documentId), {
    method: 'DELETE',
  })
}

export async function downloadSupplierDocument(documentId, fallbackFilename = `supplier-document-${documentId}`) {
  const response = await fetch(buildUrl(API_ENDPOINTS.suppliers.downloadDocument(documentId)), {
    headers: buildApiHeaders(),
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
    filename: getDownloadFilename(response, fallbackFilename),
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
        `Document download failed with status ${response.status}.`
      )
    } catch {
      return `Document download failed with status ${response.status}.`
    }
  }

  const body = await response.text()
  return body || `Document download failed with status ${response.status}.`
}

function getDownloadFilename(response, fallback) {
  const disposition = response.headers.get('content-disposition') || ''
  const match = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(disposition)

  return match ? decodeURIComponent(match[1].replace(/"/g, '')) : fallback
}
