import { LoaderCircle, Save } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { getSupplierIfscDetails } from '../../../api/suppliersApi'
import { getRequiredError } from '../../../utils/helpers'
import {
  getEmailError as getSharedEmailError,
  sanitizeEmailInput,
} from '../../../validators/emailValidator'
import {
  getPhoneError as getSharedPhoneError,
  sanitizePhoneInput,
} from '../../../validators/phoneValidator'
import {
  getPincodeError,
  getPincodeStateError as getSharedPincodeStateError,
  getStateForPincode,
  sanitizePincodeInput,
} from '../../../validators/pincodeValidator'
import SupplierAddressTab from './SupplierAddressTab'
import SupplierBankAccountsTab from './SupplierBankAccountsTab'
import SupplierBasicInfoTab from './SupplierBasicInfoTab'
import SupplierContactsTab from './SupplierContactsTab'
import SupplierDocumentsTab from './SupplierDocumentsTab'
import SupplierPaymentTermsTab from './SupplierPaymentTermsTab'
import {
  DEPARTMENT_OPTIONS,
  IFSC_PATTERN,
  INDIA_STATES,
  STATE_PINCODE_PREFIXES,
  getCityStateError,
  getDesignationOptionsForDepartment,
  mergeMasterOptions,
} from '../supplierMasterData'
const emptyBasic = {
  name: '',
  supplierCode: '',
  companyName: '',
  category: '',
  gstNumber: '',
  panNumber: '',
  phone: '',
  email: '',
  website: '',
  status: 'active',
  contact: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  postalCode: '',
  creditDays: '30',
}

const emptyTerms = {
  creditDays: '30',
  creditLimit: '',
  preferredPaymentMethod: '',
  currency: '',
  taxType: '',
  notes: '',
}

const emptyContact = {
  name: '',
  designation: '',
  department: '',
  phone: '',
  email: '',
  isPrimary: true,
}

const emptyBankAccount = {
  accountName: '',
  accountNumber: '',
  bankName: '',
  ifscCode: '',
  branch: '',
  bankState: '',
  bankCity: '',
  upiId: '',
  bankNameAutoFilled: false,
  bankNameManualOverride: false,
  branchAutoFilled: false,
  branchManualOverride: false,
  bankCityAutoFilled: false,
  bankCityManualOverride: false,
  bankStateAutoFilled: false,
  bankStateManualOverride: false,
  ifscLookupStatus: '',
  ifscLookupMessage: '',
  isPrimary: false,
}

const emptyAddress = {
  type: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  country: 'India',
  state: '',
  pincode: '',
}

const tabs = [
  { id: 'basic', label: 'Basic' },
  { id: 'contacts', label: 'Contacts' },
  { id: 'addresses', label: 'Addresses' },
  { id: 'paymentTerms', label: 'Payment Terms' },
  { id: 'bankAccounts', label: 'Banking' },
  { id: 'documents', label: 'Documents' },
]

const INPUT_LIMITS = {
  supplierName: 120,
  companyName: 150,
  supplierCode: 20,
  gst: 15,
  pan: 10,
  email: 254,
  website: 150,
  contactName: 100,
  addressLine: 200,
  notes: 1000,
}

const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z0-9]{3}$/
const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/

function stripUnsafeText(value) {
  return Array.from(value).filter((character) => {
    const code = character.charCodeAt(0)
    return !(
      code <= 31 ||
      (code >= 127 && code <= 159) ||
      (code >= 0x200B && code <= 0x200D) ||
      code === 0xFEFF
    )
  }).join('')
}

function cleanString(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .split(/[<>]/)
    .map(stripUnsafeText)
    .join('')
    .replace(/[<>]/g, '')
    .trim()
}

function getSelectValue(value) {
  if (typeof value === 'object' && value !== null) {
    return value.value ?? value.label ?? value.name ?? value.Name ?? ''
  }

  return value
}

function normalizeCountry(value) {
  return cleanString(getSelectValue(value))
}

function isIndiaCountry(value) {
  return normalizeCountry(value).toLowerCase() === 'india'
}

export function getPincodeStateError(pincode, state, country = 'India') {
  return getSharedPincodeStateError(cleanString(pincode), getSelectValue(state), country)
}

function normalizeAddress(address = {}) {
  const country = normalizeCountry(address.country) || 'India'
  const state = cleanString(getSelectValue(address.state))

  return {
    type: address.type ?? '',
    addressLine1: address.addressLine1 || '',
    addressLine2: address.addressLine2 || '',
    city: address.city || '',
    state: isIndiaCountry(country) && !INDIA_STATES.includes(state) ? '' : state,
    country,
    pincode: address.pincode || address.postalCode || '',
  }
}

function readValue(source, ...keys) {
  return keys.reduce((result, key) => (
    result !== undefined && result !== null ? result : source?.[key]
  ), undefined)
}

function getIfscPayload(payload) {
  const source = payload?.data || payload?.result || payload
  const bankName = cleanString(readValue(source, 'BANK', 'bank', 'Bank', 'bankName', 'BankName'))
  const branch = cleanString(readValue(source, 'BRANCH', 'branch', 'Branch'))
  const city = cleanString(readValue(source, 'CITY', 'city', 'City'))
  const state = cleanString(readValue(source, 'STATE', 'state', 'State'))

  if (!bankName && !branch && !city && !state) {
    return null
  }

  return { bankName, branch, city, state }
}

function onlyDigits(value, maxLength) {
  const digits = String(value ?? '').replace(/\D/g, '')
  return maxLength ? digits.slice(0, maxLength) : digits
}

function normalizeSpaces(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .split(/[<>]/)
    .map(stripUnsafeText)
    .join('')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
}

function normalizeSupplierCode(value) {
  return cleanString(value).toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, INPUT_LIMITS.supplierCode)
}

function normalizeCode(value, maxLength) {
  const normalized = cleanString(value).toUpperCase().replace(/[^A-Z0-9]/g, '')
  return maxLength ? normalized.slice(0, maxLength) : normalized
}

function titleCaseWords(value, { preserveAcronyms = false } = {}) {
  return String(value ?? '').replace(/[A-Za-z]+/g, (word) => {
    if (preserveAcronyms && /^[A-Z]{2,}$/.test(word)) return word
    if (word.length === 1) return word.toUpperCase()
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  })
}

function normalizeBusinessText(value, { allowAmpersand = false } = {}) {
  const allowedPattern = allowAmpersand ? /[^A-Za-z0-9 .&'-]/g : /[^A-Za-z0-9 .'-]/g
  return titleCaseWords(
    normalizeSpaces(value)
      .replace(/^\s+/, '')
      .replace(allowedPattern, ''),
    { preserveAcronyms: true },
  )
}

function normalizeHumanName(value) {
  return titleCaseWords(
    normalizeSpaces(value)
      .replace(/^\s+/, '')
      .replace(/[^A-Za-z .'-]/g, ''),
  )
}

function normalizeContactName(value) {
  return titleCaseWords(
    normalizeSpaces(value)
      .replace(/^\s+/, '')
      .replace(/[^A-Za-z ]/g, ''),
  )
}

function normalizeBankText(value) {
  const acronymWords = new Set(['HDFC', 'ICICI', 'IDBI', 'SBI', 'RBL', 'YES', 'HSBC', 'DBS', 'UCO', 'BOB'])
  return normalizeHumanName(value).replace(/\b[a-zA-Z]{2,5}\b/g, (word) => {
    const upperWord = word.toUpperCase()
    return acronymWords.has(upperWord) ? upperWord : word
  })
}

function normalizeBranchText(value) {
  return titleCaseWords(
    normalizeSpaces(value)
      .replace(/^\s+/, '')
      .replace(/[^A-Za-z0-9 .,/&'-]/g, '')
      .slice(0, 100),
    { preserveAcronyms: true },
  )
}

function normalizeAddressText(value) {
  return normalizeSpaces(value)
    .replace(/^\s+/, '')
    .replace(/[^A-Za-z0-9 .,/#&'-]/g, '')
    .slice(0, INPUT_LIMITS.addressLine)
}

function normalizeDecimal(value, maxIntegerDigits = 10) {
  const normalizedValue = cleanString(value).replace(/[^0-9.]/g, '')
  const [wholePart, ...decimalParts] = normalizedValue.split('.')
  const truncatedWhole = (wholePart || '').slice(0, maxIntegerDigits)
  return decimalParts.length ? `${truncatedWhole}.${decimalParts.join('').slice(0, 2)}` : truncatedWhole
}

function getHumanNameError(value, label, { required = true, min = 3, max = 100 } = {}) {
  const nextValue = cleanString(value)
  if (!nextValue) return required ? `${label} is required.` : ''
  if (nextValue.length < min) return `${label} must be at least ${min} characters.`
  if (nextValue.length > max) return `${label} cannot exceed ${max} characters.`
  if (!/[A-Za-z]/.test(nextValue) || /^\d+$/.test(nextValue)) return `${label} must contain alphabetic characters and cannot contain only numbers.`
  if (/\s{2,}/.test(nextValue)) return `${label} cannot contain repeated spaces.`
  if (/([.'-])\1{1,}/.test(nextValue)) return `${label} contains repeated punctuation.`
  return /^[A-Za-z .'-]+$/.test(nextValue)
    ? ''
    : `${label} can contain letters, spaces, periods, apostrophes, and hyphens only.`
}

function getContactNameError(value) {
  const nextValue = cleanString(value)
  if (!nextValue) return 'Contact name is required.'
  if (nextValue.length < 2) return 'Contact name must be at least 2 characters.'
  if (nextValue.length > INPUT_LIMITS.contactName) return `Contact name cannot exceed ${INPUT_LIMITS.contactName} characters.`
  if (!/[A-Za-z]/.test(nextValue) || /^\d+$/.test(nextValue)) return 'Contact name must contain alphabetic characters and cannot contain only numbers.'
  if (/\s{2,}/.test(nextValue)) return 'Contact name cannot contain repeated spaces.'
  if (!/^[A-Za-z0-9 .&'/\-()]+$/.test(nextValue)) {
    return 'Contact name can contain letters, numbers, spaces, and common punctuation only.'
  }
  if (/([A-Za-z0-9])\1{3,}/.test(nextValue)) return 'Enter a valid contact name.'
  if (/([^aeiouyAEIOUY0-9\s.&'/\-()]){6,}/i.test(nextValue)) return 'Enter a valid contact name.'
  return ''
}

function getBusinessNameError(value, label, { required = true, min = 3, max = 150 } = {}) {
  const nextValue = cleanString(value)
  const allowedPattern = /^[A-Za-z0-9\s.,&'/\-()]+$/

  if (!nextValue) return required ? `${label} is required.` : ''
  if (nextValue.length < min) return `${label} must be at least ${min} characters.`
  if (nextValue.length > max) return `${label} cannot exceed ${max} characters.`
  if (!/[A-Za-z]/.test(nextValue) || /^\d+$/.test(nextValue)) return `${label} must contain alphabetic characters and cannot contain only numbers.`
  if (!allowedPattern.test(nextValue)) {
    return `${label} contains invalid characters.`
  }
  if (/([A-Za-z0-9])\1{3,}/.test(nextValue)) return `Enter a valid ${label.toLowerCase()}.`
  if (/([^aeiouyAEIOUY0-9\s.,&'/\-()]){6,}/i.test(nextValue)) return `Enter a valid ${label.toLowerCase()}.`
  return ''
}

function getBankNameError(value) {
  const nextValue = cleanString(value)
  if (!nextValue) return 'Bank name is required.'
  if (nextValue.length < 2) return 'Bank name must be at least 2 characters.'
  if (nextValue.length > 100) return 'Bank name cannot exceed 100 characters.'
  if (!/[A-Za-z]/.test(nextValue)) return 'Bank name must contain letters.'
  if (!/^[A-Za-z0-9 .&'-]+$/.test(nextValue)) return 'Bank name contains invalid characters.'
  if (/([A-Za-z0-9])\1{3,}/.test(nextValue)) return 'Enter a valid bank name.'
  if (/([^aeiouyAEIOUY0-9\s.&'-]){6,}/i.test(nextValue)) return 'Enter a valid bank name.'
  return ''
}

export function getBusinessTitleError(value, label = 'Field') {
  const nextValue = cleanString(value)
  const lowerLabel = label.toLowerCase()
  if (!nextValue) return ''
  if (nextValue.length < 2) return `${label} must be at least 2 characters.`
  if (nextValue.length > 50) return `${label} cannot exceed 50 characters.`
  if (!/[A-Za-z]/.test(nextValue)) return `${label} must contain letters.`
  if (/\d/.test(nextValue)) return `${label} cannot contain numbers.`
  if (!/^[A-Za-z\s.,&'/\-]+$/.test(nextValue)) return `${label} contains invalid characters.`
  if (/\s{2,}/.test(nextValue)) return `${label} cannot contain repeated spaces.`
  if (/([A-Za-z])\1{3,}/i.test(nextValue)) return `Enter a valid ${lowerLabel}.`

  const words = nextValue.split(/[\s/\-]+/).filter(Boolean)
  for (const word of words) {
    if (word.length > 25) return `Enter a valid ${lowerLabel}.`
  }

  return ''
}

function getAddressLineError(value, label, required = false) {
  const nextValue = cleanString(value)
  if (!nextValue) return required ? `${label} is required.` : ''
  if (nextValue.length < 3) return `${label} must be at least 3 characters.`
  if (INPUT_LIMITS?.addressLine && nextValue.length > INPUT_LIMITS.addressLine) {
    return `${label} cannot exceed ${INPUT_LIMITS.addressLine} characters.`
  }
  if (!/[A-Za-z]/.test(nextValue) || /^\d+$/.test(nextValue)) {
    return `${label} must contain letters and meaningful text.`
  }
  if (!/^[A-Za-z0-9 .,/#'()\-]+$/.test(nextValue)) {
    return `Enter a valid ${label.toLowerCase()} using letters, numbers, spaces, and common address punctuation.`
  }
  if (/\s{2,}/.test(nextValue)) {
    return `${label} cannot contain repeated spaces.`
  }
  if (/([.,/#'()\-]){2,}/.test(nextValue)) {
    return `${label} contains repeated punctuation.`
  }
  if (/([A-Za-z0-9])\1{3,}/i.test(nextValue)) {
    return `Enter a valid ${label.toLowerCase()}.`
  }

  return ''
}

function getEmailError(value, label = 'Email') {
  return getSharedEmailError(value, { required: true, label })
}

function getGstNumberError(value) {
  const gstNumber = cleanString(value).toUpperCase()
  if (!gstNumber) return ''
  return gstNumber.length === INPUT_LIMITS.gst && GSTIN_PATTERN.test(gstNumber)
    ? ''
    : 'Enter valid 15-character GSTIN.'
}

function getPanNumberError(value) {
  const panNumber = cleanString(value).toUpperCase()
  if (!panNumber) return ''
  return panNumber.length === INPUT_LIMITS.pan && PAN_PATTERN.test(panNumber)
    ? ''
    : 'PAN must follow format ABCDE1234F.'
}

function getPlaceNameError(value, label) {
  const nextValue = cleanString(value)
  if (!nextValue) return `${label} is required.`
  if (nextValue.length < 2) return `${label} must be at least 2 characters.`
  if (nextValue.length > 100) return `${label} cannot exceed 100 characters.`
  if (!/[A-Za-z]/.test(nextValue)) return `${label} must contain letters.`
  return /^[A-Za-z .'-]+$/.test(nextValue)
    ? ''
    : `${label} can contain letters, spaces, periods, apostrophes, and hyphens only.`
}

function getAccountNumberError(value) {
  const accountNumber = cleanString(value)
  if (!accountNumber) return 'Account number is required.'
  if (!/^\d+$/.test(accountNumber)) return 'Account number must contain only digits.'
  return /^\d{9,18}$/.test(accountNumber)
    ? ''
    : 'Account number must be 9 to 18 digits.'
}

function getIfscError(value) {
  const ifscCode = cleanString(value).toUpperCase()
  if (!ifscCode) return 'IFSC code is required.'
  return IFSC_PATTERN.test(ifscCode)
    ? ''
    : 'IFSC code must follow format: SBIN0001234'
}

function getBranchError(value) {
  const branch = cleanString(value)
  if (!branch) return ''
  if (branch.length < 2) return 'Branch name must be at least 2 characters.'
  if (branch.length > 100) return 'Branch name cannot exceed 100 characters.'
  if (!/[A-Za-z]/.test(branch)) return 'Branch name must contain letters.'
  return /^[A-Za-z0-9 .,/&'-]+$/.test(branch)
    ? ''
    : 'Branch can contain letters, numbers, spaces, periods, commas, slashes, and hyphens only.'
}

function getUpiError(value) {
  const upiId = cleanString(value)
  if (!upiId) return ''
  return /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.-]{2,64}$/.test(upiId)
    ? ''
    : 'Enter a valid UPI ID.'
}

function getPatternError(value, pattern, message) {
  const cleanValue = cleanString(value)
  if (!cleanValue) return ''
  return pattern.test(cleanValue) ? '' : message
}

function getSupplierNameError(value) {
  return getBusinessNameError(value, 'Supplier name', { max: INPUT_LIMITS.supplierName, allowAmpersand: true })
}

function getCompanyNameError(value) {
  const nextValue = cleanString(value).replace(/\s+/g, ' ')
  if (!nextValue) return ''

  if (nextValue.length < 2) return 'Company name must be at least 2 characters.'
  if (nextValue.length > INPUT_LIMITS.companyName) return `Company name cannot exceed ${INPUT_LIMITS.companyName} characters.`
  if (!/[A-Za-z]/.test(nextValue) || /^\d+$/.test(nextValue)) return 'Company name must contain at least one letter.'

  const allowedPattern = /^[A-Za-z0-9 .&',()/-]+$/
  if (!allowedPattern.test(nextValue)) {
    return 'Company name can contain letters, numbers, spaces, and common business punctuation only.'
  }

  if (/([.&',()/-])\1{1,}/.test(nextValue)) return 'Company name contains repeated punctuation.'
  if (/([A-Za-z0-9])\1{3,}/.test(nextValue)) return 'Enter a valid company name.'
  if (/([A-Za-z0-9]{1,2})\1{3,}/i.test(nextValue)) return 'Enter a valid company name.'

  const words = nextValue.split(' ')
  for (const word of words) {
    const cleanWord = word.replace(/[^A-Za-z]/g, '')
    if (cleanWord.length > 15 && /[^aeiouyAEIOUY]{7,}/.test(cleanWord)) {
      return 'Enter a valid company name.'
    }
  }

  return ''
}

function getSupplierCodeError(value, existingCodes = []) {
  const code = cleanString(value)
  if (!code) return 'Supplier code is required.'
  if (code.length < 2) return 'Supplier code must be at least 2 characters.'
  if (code.length > INPUT_LIMITS.supplierCode) return `Supplier code cannot exceed ${INPUT_LIMITS.supplierCode} characters.`
  if (!/^[A-Z0-9-]+$/.test(code)) return 'Supplier code can contain uppercase letters, numbers, and hyphen only.'
  return existingCodes.includes(code) ? 'Supplier code already exists.' : ''
}

function getPhoneError(value, label = 'Phone') {
  return getSharedPhoneError(value, label)
}

function getOptionalEmailError(value, label = 'Contact email') {
  return getSharedEmailError(value, { required: false, label })
}

function getWebsiteError(value) {
  const raw = String(value ?? '')
  const trimmed = raw.trim()

  if (!trimmed) {
    return ''
  }

  if (trimmed.length > INPUT_LIMITS.website) {
    return `Website URL cannot exceed ${INPUT_LIMITS.website} characters.`
  }

  if (/\s/.test(trimmed)) {
    return 'Enter a valid website URL, including http:// or https://.'
  }

  if (!/^https?:\/\//i.test(trimmed)) {
    return 'Enter a valid website URL, including http:// or https://.'
  }

  if (/^https?:\/\/\s*$/i.test(trimmed)) {
    return 'Enter a valid website URL, including http:// or https://.'
  }

  if (trimmed.includes('..')) {
    return 'Enter a valid website URL, including http:// or https://.'
  }

  try {
    const url = new URL(trimmed)

    if (!['http:', 'https:'].includes(url.protocol)) {
      return 'Enter a valid website URL, including http:// or https://.'
    }

    const hostname = url.hostname.toLowerCase()

    if (!hostname || hostname.startsWith('.') || hostname.endsWith('.') || !hostname.includes('.')) {
      return 'Enter a valid website URL, including http:// or https://.'
    }

    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'Enter a valid website URL, including http:// or https://.'
    }

    const domainParts = hostname.split('.')
    if (domainParts.length < 2) {
      return 'Enter a valid website URL, including http:// or https://.'
    }

    for (const part of domainParts) {
      if (!part || part.startsWith('-') || part.endsWith('-') || !/^[a-z0-9-]+$/i.test(part)) {
        return 'Enter a valid website URL, including http:// or https://.'
      }
    }

    const tld = domainParts[domainParts.length - 1]
    if (!tld || !/^[a-z]{2,24}$/i.test(tld)) {
      return 'Enter a valid website URL, including http:// or https://.'
    }

    return ''
  } catch {
    return 'Enter a valid website URL, including http:// or https://.'
  }
}

function getNonNegativeNumberError(value, label, { max = null, min = 0, allowDecimal = true } = {}) {
  const nextValue = cleanString(value)
  if (!nextValue) return ''
  const pattern = allowDecimal ? /^[0-9]+(\.[0-9]{1,2})?$/ : /^[0-9]+$/
  if (!pattern.test(nextValue)) return allowDecimal ? `${label} must be numeric.` : `${label} must be a whole number.`
  const num = Number(nextValue)
  if (num < min) return `${label} cannot be negative.`
  if (max !== null && num > max) {
    const formattedMax = max === 999999999.99 ? '999,999,999.99' : max
    return `${label} cannot exceed ${formattedMax}.`
  }
  return ''
}

function hasDuplicate(values, value) {
  return Boolean(value) && values.filter((item) => item === value).length > 1
}

function uniqueCleanValues(values) {
  return [...new Set(values.map(cleanString).filter(Boolean))]
}

function getInitialContacts(initialValues) {
  if (Array.isArray(initialValues?.contacts) && initialValues.contacts.length > 0) {
    return initialValues.contacts.map((contact) => ({
      ...contact,
      contactId: contact.contactId || contact.id || null,
      id: contact.contactId || contact.id || null,
      name: contact.name || '',
      designation: contact.designation || '',
      department: contact.department || '',
      phone: contact.phone || '',
      email: contact.email || '',
      isPrimary: Boolean(contact.isPrimary),
    }))
  }

  if (!initialValues?.contact && !initialValues?.phone && !initialValues?.email) {
    return [{ ...emptyContact }]
  }

  return [{
    name: initialValues.contact || initialValues.name || '',
    designation: '',
    department: '',
    phone: initialValues.phone || '',
    email: initialValues.email || '',
    isPrimary: true,
  }]
}

function isBlankContact(contact = {}) {
  return !contact.name &&
    !contact.designation &&
    !contact.department &&
    !contact.phone &&
    !contact.email
}

function getInitialAddresses(initialValues) {
  if (Array.isArray(initialValues?.addresses) && initialValues.addresses.length > 0) {
    return initialValues.addresses.map(normalizeAddress)
  }

  if (!initialValues?.addressLine1 && !initialValues?.city && !initialValues?.state) {
    return [{ ...emptyAddress }]
  }

  return [normalizeAddress({
    type: initialValues?.type || '',
    addressLine1: initialValues.addressLine1 || '',
    addressLine2: initialValues.addressLine2 || '',
    city: initialValues.city || '',
    state: initialValues.state || '',
    country: initialValues.country || 'India',
    pincode: initialValues.postalCode || initialValues.pincode || '',
  })]
}

function isBlankAddress(address = {}) {
  return !address.addressLine1 &&
    !address.addressLine2 &&
    !address.city &&
    !address.state &&
    !address.pincode &&
    (!address.country || isIndiaCountry(address.country))
}

function getInitialPaymentTerm(initialValues) {
  const paymentTerm = initialValues?.paymentTerm || initialValues?.paymentTerms || {}

  return {
    ...emptyTerms,
    creditDays: initialValues?.creditDays || paymentTerm.creditDays || '30',
    creditLimit: initialValues?.creditLimit || paymentTerm.creditLimit || '',
    preferredPaymentMethod: paymentTerm.preferredPaymentMethod || paymentTerm.paymentMethod || '',
    currency: paymentTerm.currency || 'INR',
    taxType: paymentTerm.taxType || '',
    notes: paymentTerm.notes || '',
  }
}

function getInitialSupplier(initialValues) {
  const supplier = initialValues ? { ...emptyBasic, ...initialValues } : emptyBasic

  const gstNumber =
    supplier.gstNumber ||
    supplier.GstNumber ||
    supplier.gstin ||
    supplier.GSTIN ||
    supplier.gst ||
    supplier.GST ||
    supplier.taxNumber ||
    ''

  const panNumber =
    supplier.panNumber ||
    supplier.PanNumber ||
    supplier.pan ||
    supplier.PAN ||
    supplier.panNo ||
    ''

  return {
    ...supplier,
    supplierCode: supplier.supplierCode || supplier.code || '',
    companyName: supplier.companyName || supplier.company || '',
    category: supplier.category || '',
    status: cleanString(supplier.status || 'active').toLowerCase(),
    gstNumber,
    panNumber,
    website: supplier.website || '',
    contacts: getInitialContacts(initialValues),
    addresses: getInitialAddresses(initialValues),
    paymentTerm: getInitialPaymentTerm(initialValues),
    bankAccounts: (() => {
      const initialBankAccounts = Array.isArray(initialValues?.bankAccounts) && initialValues.bankAccounts.length > 0
        ? initialValues.bankAccounts
        : [{ ...emptyBankAccount, isPrimary: true }]
      if (!initialBankAccounts.some(acc => acc.isPrimary)) {
        return initialBankAccounts.map((acc, idx) => idx === 0 ? { ...acc, isPrimary: true } : { ...acc, isPrimary: false })
      }
      return initialBankAccounts.map((acc) => ({ ...acc, isPrimary: Boolean(acc.isPrimary) }))
    })(),
    documents: Array.isArray(initialValues?.documents) ? initialValues.documents : [],
  }
}

function isBlankBankAccount(account = {}) {
  return !account.accountName &&
    !account.accountNumber &&
    !account.bankName &&
    !account.ifscCode &&
    !account.branch &&
    !account.bankState &&
    !account.bankCity &&
    !account.upiId
}

function getSupplierDirtySnapshot(supplier) {
  const supplierWithoutPersistedDocuments = { ...(supplier || {}) }
  supplierWithoutPersistedDocuments.documents = Array.isArray(supplierWithoutPersistedDocuments.documents)
    ? supplierWithoutPersistedDocuments.documents
        .filter((document) => document?.isTemporary)
        .map((document) => ({
          documentId: document.documentId || document.id,
          documentType: document.documentType || document.type,
          fileName: document.fileName || document.originalFileName || document.displayName,
          status: document.status,
          isTemporary: true,
        }))
    : []
  return JSON.stringify(supplierWithoutPersistedDocuments)
}

function sanitizeBasicValue(name, value) {
  if (name === 'supplierCode') return normalizeSupplierCode(value)
  if (name === 'phone') return sanitizePhoneInput(value)
  if (name === 'email') return sanitizeEmailInput(value)
  if (name === 'gstNumber') return normalizeCode(value, INPUT_LIMITS.gst)
  if (name === 'panNumber') return normalizeCode(value, INPUT_LIMITS.pan)
  if (name === 'name') return normalizeBusinessText(value).slice(0, INPUT_LIMITS.supplierName)
  if (name === 'companyName') return normalizeBusinessText(value, { allowAmpersand: true })
  if (name === 'website') return cleanString(value)
  return value
}

function sanitizeNestedValue(name, value) {
  if (name === 'phone') return sanitizePhoneInput(value)
  if (name === 'email') return sanitizeEmailInput(value)
  if (name === 'pincode') return onlyDigits(value, 6)
  if (name === 'accountNumber') return onlyDigits(value, 18)
  if (name === 'ifscCode') return normalizeCode(value, 11)
  if (name === 'accountName') return normalizeHumanName(value).slice(0, 100)
  if (name === 'bankName') return normalizeBankText(value)
  if (name === 'branch') return normalizeBranchText(value)
  if (name === 'name') return normalizeContactName(value).slice(0, INPUT_LIMITS.contactName)
  if (['designation', 'department', 'city', 'state', 'country', 'bankCity', 'bankState'].includes(name)) return normalizeBusinessText(value)
  if (['addressLine1', 'addressLine2'].includes(name)) return normalizeAddressText(value)
  return value
}

function sanitizeCollectionValue(collectionName, item, name, value) {
  if (collectionName === 'addresses' && name === 'country') {
    return normalizeCountry(value)
  }

  if (collectionName === 'addresses' && name === 'pincode') {
    return sanitizePincodeInput(value, item.country)
  }

  if (collectionName === 'addresses' && name === 'state') {
    return isIndiaCountry(item.country)
      ? cleanString(getSelectValue(value))
      : normalizeBusinessText(getSelectValue(value)).slice(0, 100)
  }

  return sanitizeNestedValue(name, value)
}

function normalizeWebsiteValue(value) {
  return cleanString(value)
}

function scrollToFirstError() {
  window.requestAnimationFrame(() => {
    const invalidControl = document.querySelector('.supplier-form [aria-invalid="true"]')
    if (invalidControl instanceof HTMLElement) {
      invalidControl.focus({ preventScroll: true })
      invalidControl.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  })
}

function buildPrefilledContact(supplier, seed = {}) {
  return {
    name: seed.name || supplier.name || '',
    designation: seed.designation || '',
    department: seed.department || '',
    phone: seed.phone || supplier.phone || '',
    email: seed.email || supplier.email || '',
    isPrimary: seed.isPrimary ?? true,
  }
}

function syncFirstContact(nextSupplier, previousSupplier, dirtyFields) {
  if (!nextSupplier.contacts.length) {
    return nextSupplier
  }

  const firstContact = nextSupplier.contacts[0]
  const firstDirty = dirtyFields[0] || {}
  const syncedContact = { ...firstContact }

  ;[
    ['name', 'name'],
    ['phone', 'phone'],
    ['email', 'email'],
  ].forEach(([contactField, supplierField]) => {
    if (firstDirty[contactField]) {
      return
    }

    const previousSupplierValue = previousSupplier[supplierField] || ''
    const currentContactValue = firstContact[contactField] || ''

    if (!currentContactValue || currentContactValue === previousSupplierValue) {
      syncedContact[contactField] = nextSupplier[supplierField] || ''
    }
  })

  return {
    ...nextSupplier,
    contacts: [syncedContact, ...nextSupplier.contacts.slice(1)],
  }
}

export default function SupplierForm({
  initialValues,
  canSubmit,
  onSubmit,
  onCancel,
  initialTab = 'basic',
  readOnly = false,
  isSubmitting = false,
  existingSupplierCodes = [],
  categoryOptions = [],
}) {
  const panelRef = useRef(null)
  const tabScrollRef = useRef({})
  const initialSupplier = useMemo(() => getInitialSupplier(initialValues), [initialValues])
  const [supplier, setSupplier] = useState(initialSupplier)
  const [contactDirtyFields, setContactDirtyFields] = useState({})
  const [customMasterOptions, setCustomMasterOptions] = useState(() => ({
    departments: uniqueCleanValues(initialSupplier.contacts.map((contact) => contact.department)),
    designations: uniqueCleanValues(initialSupplier.contacts.map((contact) => contact.designation)),
  }))
  const [touched, setTouched] = useState({})
  const [validationRunId, setValidationRunId] = useState(0)
  const [activeTab, setActiveTab] = useState(initialTab)
  const initialSnapshot = useMemo(() => getSupplierDirtySnapshot(initialSupplier), [initialSupplier])
  const uniqueCodeCandidates = useMemo(
    () => existingSupplierCodes
      .map((code) => normalizeSupplierCode(code))
      .filter((code) => code && code !== normalizeSupplierCode(initialValues?.supplierCode)),
    [existingSupplierCodes, initialValues?.supplierCode],
  )
  const effectiveCategoryOptions = useMemo(() => {
    const values = new Set(categoryOptions.map((option) => option.value).filter(Boolean))
    const options = [...categoryOptions]

    if (supplier.category && !values.has(supplier.category)) {
      options.push({ value: supplier.category, label: supplier.category })
    }

    return options
  }, [categoryOptions, supplier.category])
  const departmentOptions = useMemo(
    () => mergeMasterOptions(DEPARTMENT_OPTIONS, customMasterOptions.departments, supplier.contacts.map((contact) => contact.department)),
    [customMasterOptions.departments, supplier.contacts],
  )
  const getContactDesignationOptions = (department) => mergeMasterOptions(
    getDesignationOptionsForDepartment(department),
    customMasterOptions.designations,
    supplier.contacts.map((contact) => contact.designation),
  )

  const basicErrors = {
    name: getSupplierNameError(supplier.name),
    supplierCode: getSupplierCodeError(supplier.supplierCode, uniqueCodeCandidates),
    companyName: getCompanyNameError(supplier.companyName),
    email: getSharedEmailError(supplier.email, { required: true, label: 'Email' }),
    phone: getPhoneError(supplier.phone),
    category: effectiveCategoryOptions.length === 0
      ? 'No supplier categories are available.'
      : getRequiredError(supplier.category, 'Category'),
    gstNumber: getGstNumberError(supplier.gstNumber),
    panNumber: getPanNumberError(supplier.panNumber),
    website: getWebsiteError(supplier.website),
    status: getRequiredError(supplier.status, 'Status'),
  }

  const contactErrors = useMemo(() => {
    const phones = supplier.contacts.map((contact) => sanitizePhoneInput(contact.phone)).filter(Boolean)
    const emails = supplier.contacts.map((contact) => sanitizeEmailInput(contact.email)).filter(Boolean)
    const normalizedContactNames = supplier.contacts
      .map((contact) => cleanString(contact.name).toLowerCase())
      .filter(Boolean)
    const primaryCount = supplier.contacts.filter((contact) => contact.isPrimary).length

    return supplier.contacts.map((contact) => {
      if (isBlankContact(contact)) {
        return {}
      }

      const normalizedName = cleanString(contact.name).toLowerCase()

      return {
        name:
          getContactNameError(contact.name) ||
          (normalizedName && hasDuplicate(normalizedContactNames, normalizedName)
            ? 'A contact with this name already exists for this supplier.'
            : ''),
        designation: getBusinessTitleError(contact.designation, 'Designation'),
        department: getBusinessTitleError(contact.department, 'Department'),
        phone:
          getPhoneError(contact.phone, 'Contact phone') ||
          (hasDuplicate(phones, sanitizePhoneInput(contact.phone)) ? 'Contact phone is already used.' : ''),
        email:
          getOptionalEmailError(contact.email) ||
          (hasDuplicate(emails, sanitizeEmailInput(contact.email)) ? 'Contact email is already used.' : ''),
        duplicate: primaryCount > 1 ? 'Only one primary contact is allowed.' : '',
      }
    })
  }, [supplier.contacts])

  const addressErrors = useMemo(() => {
    const addressTypes = supplier.addresses.map((address) => cleanString(address.type).toLowerCase()).filter(Boolean)

    return supplier.addresses.map((address) => {
      if (isBlankAddress(address)) {
        return {}
      }

      const country = normalizeCountry(address.country)
      const state = cleanString(getSelectValue(address.state))

      return {
        type:
          getRequiredError(address.type, 'Address type') ||
          (hasDuplicate(addressTypes, cleanString(address.type).toLowerCase()) ? `${address.type} address already exists.` : ''),
        addressLine1: getAddressLineError(address.addressLine1, 'Address line 1', true),
        addressLine2: getAddressLineError(address.addressLine2, 'Address line 2'),
        city: getPlaceNameError(address.city, 'City') || getCityStateError(address.city, state, country),
        state:
          isIndiaCountry(country)
            ? getRequiredError(state, 'State') ||
              (INDIA_STATES.includes(state) ? '' : 'Select a valid Indian state or union territory.')
            : getPlaceNameError(state, 'State'),
        country: getRequiredError(country, 'Country'),
        pincode: getPincodeError(address.pincode, state, country, { required: false }),
      }
    })
  }, [supplier.addresses])

  const addressWarnings = useMemo(() => supplier.addresses.map(() => ({})), [supplier.addresses])

  const bankErrors = useMemo(() => {
    const accountNumbers = supplier.bankAccounts.map((account) => onlyDigits(account.accountNumber)).filter(Boolean)
    const accountIfscPairs = supplier.bankAccounts
      .map((account) => ({
        accountNumber: onlyDigits(account.accountNumber),
        ifscCode: cleanString(account.ifscCode).toUpperCase(),
      }))
      .filter((account) => account.accountNumber && account.ifscCode)
      .map((account) => `${account.accountNumber}|${account.ifscCode}`)

    return supplier.bankAccounts.map((account) => {
      if (isBlankBankAccount(account)) {
        return {}
      }

      return {
        accountName: getHumanNameError(account.accountName, 'Account name'),
        accountNumber:
          getAccountNumberError(account.accountNumber) ||
          (hasDuplicate(accountNumbers, onlyDigits(account.accountNumber)) ? 'Account number is already used.' : '') ||
          (account.accountNumber && account.ifscCode && hasDuplicate(accountIfscPairs, `${onlyDigits(account.accountNumber)}|${cleanString(account.ifscCode).toUpperCase()}`) ? 'This IFSC and account number combination already exists.' : ''),
        bankName: getBankNameError(account.bankName),
        ifscCode: getIfscError(account.ifscCode),
        branch: getBranchError(account.branch),
        bankCity: account.bankCity ? (getPlaceNameError(account.bankCity, 'Bank city') || getCityStateError(account.bankCity, account.bankState)) : '',
        bankState: account.bankState ? getPlaceNameError(account.bankState, 'Bank state') : '',
        upiId: getUpiError(account.upiId),
      }
    })
  }, [supplier.bankAccounts])

  const paymentTermErrors = {
    creditDays: getNonNegativeNumberError(supplier.paymentTerm.creditDays, 'Credit days', { max: 365, allowDecimal: false }),
    creditLimit: getNonNegativeNumberError(supplier.paymentTerm.creditLimit, 'Credit limit', { max: 999999999.99 }),
    preferredPaymentMethod: '',
    currency: '',
    taxType: '',
    notes: cleanString(supplier.paymentTerm.notes).length > INPUT_LIMITS.notes ? `Notes cannot exceed ${INPUT_LIMITS.notes} characters.` : '',
  }

  const isValid = [
    ...Object.values(basicErrors),
    ...Object.values(paymentTermErrors),
    ...contactErrors.flatMap((item) => Object.values(item)),
    ...addressErrors.flatMap((item) => Object.values(item)),
    ...bankErrors.flatMap((item) => Object.values(item)),
  ].every((value) => !value)
  const isDirty = initialSnapshot !== getSupplierDirtySnapshot(supplier)
  const tabErrors = {
    basic: Object.values(basicErrors).some(Boolean),
    contacts: contactErrors.some((item) => Object.values(item).some(Boolean)),
    addresses: addressErrors.some((item) => Object.values(item).some(Boolean)),
    paymentTerms: Object.values(paymentTermErrors).some(Boolean),
    bankAccounts: bankErrors.some((item) => Object.values(item).some(Boolean)),
    documents: false,
  }

  function handleBasicChange(event) {
    const { name, value } = event.target
    const nextValue = sanitizeBasicValue(name, value)

    setSupplier((currentValue) => {
      const nextSupplier = {
        ...currentValue,
        [name]: nextValue,
      }
      return syncFirstContact(nextSupplier, currentValue, contactDirtyFields)
    })
  }

  function handleBlur(event) {
    const { name } = event.target
    setTouched((currentValue) => ({ ...currentValue, [event.target.name]: true }))

    if (['name', 'companyName', 'website'].includes(name)) {
      setSupplier((currentValue) => ({
        ...currentValue,
        [name]: name === 'website'
          ? normalizeWebsiteValue(currentValue[name])
          : name === 'companyName'
            ? cleanString(currentValue[name]).replace(/\s+/g, ' ')
            : cleanString(currentValue[name]),
      }))
    }
  }

  function handleCreateMasterOption(type, value) {
    const cleanValue = normalizeBusinessText(value)
    const label = type === 'departments' ? 'Department' : 'Designation'
    if (!cleanValue || getBusinessTitleError(cleanValue, label)) return

    setCustomMasterOptions((currentValue) => ({
      ...currentValue,
      [type]: mergeMasterOptions(currentValue[type] || [], [cleanValue]).map((option) => option.value),
    }))
  }

  function resetIfscDependencies(item, nextItem, ifscCode) {
    const hasValidIfsc = IFSC_PATTERN.test(ifscCode)

    return {
      ...nextItem,
      bankName: item.bankNameAutoFilled && !item.bankNameManualOverride ? '' : nextItem.bankName,
      branch: item.branchAutoFilled && !item.branchManualOverride ? '' : nextItem.branch,
      bankState: item.bankStateAutoFilled && !item.bankStateManualOverride ? '' : nextItem.bankState,
      bankCity: item.bankCityAutoFilled && !item.bankCityManualOverride ? '' : nextItem.bankCity,
      bankNameAutoFilled: false,
      branchAutoFilled: false,
      bankStateAutoFilled: false,
      bankCityAutoFilled: false,
      ifscLookupStatus: hasValidIfsc ? 'pending' : '',
      ifscLookupMessage: '',
    }
  }

  async function handleIfscLookup(index, ifscCode) {
    const normalizedIfsc = cleanString(ifscCode).toUpperCase()

    if (!IFSC_PATTERN.test(normalizedIfsc)) {
      return
    }

    try {
      const response = await getSupplierIfscDetails(normalizedIfsc)
      const payload = response.success ? getIfscPayload(response.data) : null

      setSupplier((currentValue) => ({
        ...currentValue,
        bankAccounts: currentValue.bankAccounts.map((account, accountIndex) => {
          if (accountIndex !== index || cleanString(account.ifscCode).toUpperCase() !== normalizedIfsc) {
            return account
          }

          if (!response.success || !payload) {
            return {
              ...account,
              ifscLookupStatus: 'unrecognized',
              ifscLookupMessage: "We couldn't fetch bank details. You can enter them manually.",
            }
          }

          return {
            ...account,
            bankName: account.bankNameManualOverride ? account.bankName : payload.bankName,
            branch: account.branchManualOverride ? account.branch : payload.branch,
            bankCity: account.bankCityManualOverride ? account.bankCity : payload.city,
            bankState: account.bankStateManualOverride ? account.bankState : payload.state,
            bankNameAutoFilled: Boolean(payload.bankName && !account.bankNameManualOverride),
            branchAutoFilled: Boolean(payload.branch && !account.branchManualOverride),
            bankCityAutoFilled: Boolean(payload.city && !account.bankCityManualOverride),
            bankStateAutoFilled: Boolean(payload.state && !account.bankStateManualOverride),
            ifscLookupStatus: 'recognized',
            ifscLookupMessage: 'Bank details fetched from IFSC.',
          }
        }),
      }))
    } catch {
      setSupplier((currentValue) => ({
        ...currentValue,
        bankAccounts: currentValue.bankAccounts.map((account, accountIndex) => (
          accountIndex === index && cleanString(account.ifscCode).toUpperCase() === normalizedIfsc
            ? {
                ...account,
                ifscLookupStatus: 'unrecognized',
                ifscLookupMessage: "We couldn't fetch bank details. You can enter them manually.",
              }
            : account
        )),
      }))
    }
  }

  function updateCollection(collectionName) {
    return (index, event) => {
      const { name, value, type, checked } = event.target

      if (collectionName === 'contacts' && type !== 'checkbox') {
        setContactDirtyFields((currentValue) => ({
          ...currentValue,
          [index]: { ...currentValue[index], [name]: true },
        }))
      }

      setSupplier((currentValue) => {
        const nextItems = currentValue[collectionName].map((item, itemIndex) => {
          const nextValue = sanitizeCollectionValue(collectionName, item, name, value)
          const nextItem = { ...item, [name]: type === 'checkbox' ? checked : nextValue }

          if (collectionName === 'addresses' && name === 'country') {
            const previousCountry = normalizeCountry(item.country)
            nextItem.country = nextValue
            if (nextValue !== previousCountry) {
              nextItem.state = ''
              nextItem.pincode = ''
            }

            if (isIndiaCountry(nextValue) && !INDIA_STATES.includes(cleanString(item.state))) {
              nextItem.state = ''
            }
          }

          if (collectionName === 'addresses' && name === 'pincode') {
            if (isIndiaCountry(item.country) && !item.state && nextValue && nextValue.length === 6) {
              const detectedState = getStateForPincode(nextValue)
              if (detectedState) {
                nextItem.state = detectedState
              }
            }
          }

          if (collectionName === 'bankAccounts') {
            if (name === 'bankName') {
              nextItem.bankNameManualOverride = Boolean(nextValue)
              nextItem.bankNameAutoFilled = false
            }

            if (name === 'branch') {
              nextItem.branchManualOverride = Boolean(nextValue)
              nextItem.branchAutoFilled = false
            }

            if (name === 'bankCity') {
              nextItem.bankCityManualOverride = Boolean(nextValue)
              nextItem.bankCityAutoFilled = false
            }

            if (name === 'bankState') {
              nextItem.bankStateManualOverride = Boolean(nextValue)
              nextItem.bankStateAutoFilled = false
            }

            if (name === 'ifscCode') {
              return itemIndex === index
                ? resetIfscDependencies(item, nextItem, nextValue)
                : item
            }
          }

          return itemIndex === index
            ? nextItem
            : collectionName === 'contacts' && name === 'isPrimary' && checked
                ? { ...item, isPrimary: false }
                : collectionName === 'bankAccounts' && name === 'isPrimary' && checked
                    ? { ...item, isPrimary: false }
                    : item
        })

        const updatedSupplier = {
          ...currentValue,
          [collectionName]: nextItems,
        }

        if (collectionName === 'contacts' && index === 0) {
          const primaryContact = nextItems[0]
          if (primaryContact) {
            if (name === 'phone') updatedSupplier.phone = primaryContact.phone || ''
            if (name === 'email') updatedSupplier.email = primaryContact.email || ''
          }
        }

        return updatedSupplier
      })
    }
  }

  function addCollectionItem(collectionName) {
    return (item) => {
      setSupplier((currentValue) => {
        let nextItem = collectionName === 'contacts' && currentValue.contacts.length === 0
          ? buildPrefilledContact(currentValue, item)
          : { ...item }

        if (collectionName === 'bankAccounts') {
          nextItem = { ...nextItem, isPrimary: currentValue.bankAccounts.length === 0 }
        }

        return {
          ...currentValue,
          [collectionName]: [...currentValue[collectionName], nextItem],
        }
      })
    }
  }

  function removeCollectionItem(collectionName) {
    return (index) => {
      setSupplier((currentValue) => ({
        ...currentValue,
        [collectionName]: (() => {
          let nextItems = currentValue[collectionName].filter((_, itemIndex) => itemIndex !== index)
          if (collectionName === 'contacts' && nextItems.length === 0) {
            return [{ ...emptyContact }]
          }

          if (collectionName === 'addresses' && nextItems.length === 0) {
            return [{ ...emptyAddress }]
          }

          if (collectionName === 'bankAccounts') {
            if (nextItems.length === 0) {
              return [{ ...emptyBankAccount, isPrimary: true }]
            }
            if (!nextItems.some((acc) => acc.isPrimary)) {
              nextItems = nextItems.map((acc, idx) => idx === 0 ? { ...acc, isPrimary: true } : acc)
            }
          }

          return nextItems
        })(),
      }))

      if (collectionName === 'contacts') {
        setContactDirtyFields((currentValue) => {
          const nextValue = {}
          Object.entries(currentValue).forEach(([key, value]) => {
            const keyIndex = Number(key)
            if (keyIndex < index) nextValue[keyIndex] = value
            if (keyIndex > index) nextValue[keyIndex - 1] = value
          })
          return nextValue
        })
      }
    }
  }

  function handlePaymentTermsChange(event) {
    const { name, value } = event.target
    const nextValue = name === 'creditDays'
      ? onlyDigits(value, 3)
      : name === 'creditLimit'
        ? normalizeDecimal(value)
        : name === 'notes'
          ? normalizeSpaces(value).slice(0, INPUT_LIMITS.notes)
          : value

    setSupplier((currentValue) => ({
      ...currentValue,
      paymentTerm: {
        ...currentValue.paymentTerm,
        [name]: nextValue,
      },
    }))
    setTouched((currentValue) => ({
      ...currentValue,
      paymentTerms: true,
      [`paymentTerm_${name}`]: true,
    }))
  }

  function handlePaymentTermsBlur(event) {
    const { name } = event.target
    setTouched((currentValue) => ({
      ...currentValue,
      paymentTerms: true,
      [`paymentTerm_${name}`]: true,
    }))
  }

  function markRequiredTouched() {
    setValidationRunId((currentValue) => currentValue + 1)
    setTouched({
      name: true,
      supplierCode: true,
      email: true,
      phone: true,
      category: true,
      gstNumber: true,
      panNumber: true,
      website: true,
      status: true,
      collections: true,
    })
  }

  function handleSubmit(event) {
    event.preventDefault()
    markRequiredTouched()

    if (!isValid || readOnly || isSubmitting) {
      const firstErrorTab = tabs.find((tab) => tabErrors[tab.id])?.id
      if (firstErrorTab && firstErrorTab !== activeTab) {
        handleTabChange(firstErrorTab)
      }
      scrollToFirstError()
      return
    }

    const primaryContact = supplier.contacts.find((contact) => contact.isPrimary) || supplier.contacts[0]
    const primaryAddress = supplier.addresses[0]

    onSubmit({
      ...supplier,
      gstNumber: supplier.gstNumber,
      panNumber: supplier.panNumber,
      gstin: supplier.gstNumber,
      gst: supplier.gstNumber,
      pan: supplier.panNumber,
      contacts: supplier.contacts.filter((contact) => !isBlankContact(contact)),
      addresses: supplier.addresses.filter((address) => !isBlankAddress(address)),
      bankAccounts: supplier.bankAccounts.filter((account) => !isBlankBankAccount(account)),
      contact: primaryContact?.name || supplier.contact,
      email: supplier.email || primaryContact?.email || '',
      phone: supplier.phone || primaryContact?.phone || '',
      addressLine1: primaryAddress?.addressLine1 || supplier.addressLine1,
      addressLine2: primaryAddress?.addressLine2 || supplier.addressLine2,
      city: primaryAddress?.city || supplier.city,
      state: primaryAddress?.state || supplier.state,
      postalCode: primaryAddress?.pincode || supplier.postalCode,
      paymentTerms: `Net ${supplier.paymentTerm.creditDays}`,
      creditDays: supplier.paymentTerm.creditDays,
      paymentTermsProfile: supplier.paymentTerm,
    })
  }

  function handleTabChange(nextTab) {
    const currentPanel = panelRef.current

    if (currentPanel) {
      tabScrollRef.current[activeTab] = currentPanel.scrollTop
    }

    setActiveTab(nextTab)
    window.requestAnimationFrame(() => {
      if (panelRef.current) {
        panelRef.current.scrollTop = tabScrollRef.current[nextTab] || 0
      }
    })
  }

  return (
    <form className="supplier-form supplier-form--enterprise" onSubmit={handleSubmit}>
      <div className="supplier-form__tabs" role="tablist" aria-label="Supplier sections">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`supplier-form__tab ${activeTab === tab.id ? 'is-active' : ''} ${tabErrors[tab.id] && touched.collections ? 'has-error' : ''}`.trim()}
            onClick={() => handleTabChange(tab.id)}
            disabled={isSubmitting}
          >
            {tab.label}
            {tabErrors[tab.id] && (touched.collections || Object.values(touched).some(Boolean)) ? (
              <span className="supplier-form__tab-error" aria-label={`${tab.label} has validation errors`} />
            ) : null}
          </button>
        ))}
      </div>

      <div className="supplier-form__panel" ref={panelRef}>
        {activeTab === 'basic' ? (
          <SupplierBasicInfoTab
            formData={supplier}
            errors={basicErrors}
            touched={touched}
            onChange={handleBasicChange}
            onBlur={handleBlur}
            readOnly={readOnly}
            categoryOptions={effectiveCategoryOptions}
          />
        ) : null}
        {activeTab === 'contacts' ? (
          <SupplierContactsTab
            contacts={supplier.contacts}
            errors={contactErrors}
            showErrors={touched.collections}
            onChange={updateCollection('contacts')}
            onAdd={addCollectionItem('contacts')}
            onRemove={removeCollectionItem('contacts')}
            departmentOptions={departmentOptions}
            getDesignationOptions={getContactDesignationOptions}
            onCreateMasterOption={handleCreateMasterOption}
            readOnly={readOnly}
          />
        ) : null}
        {activeTab === 'addresses' ? (
          <SupplierAddressTab
            addresses={supplier.addresses}
            errors={addressErrors}
            warnings={addressWarnings}
            showErrors={touched.collections}
            validationRunId={validationRunId}
            onChange={updateCollection('addresses')}
            onAdd={addCollectionItem('addresses')}
            onRemove={removeCollectionItem('addresses')}
            readOnly={readOnly}
          />
        ) : null}
        {activeTab === 'paymentTerms' ? (
          <SupplierPaymentTermsTab
            terms={supplier.paymentTerm}
            errors={paymentTermErrors}
            showErrors={touched.collections || touched.paymentTerms}
            touched={touched}
            onChange={handlePaymentTermsChange}
            onBlur={handlePaymentTermsBlur}
            readOnly={readOnly}
          />
        ) : null}
        {activeTab === 'bankAccounts' ? (
          <SupplierBankAccountsTab
            bankAccounts={supplier.bankAccounts}
            errors={bankErrors}
            showErrors={touched.collections}
            onChange={updateCollection('bankAccounts')}
            onAdd={addCollectionItem('bankAccounts')}
            onRemove={removeCollectionItem('bankAccounts')}
            onIfscLookup={handleIfscLookup}
            readOnly={readOnly}
          />
        ) : null}
        {activeTab === 'documents' ? (
          <SupplierDocumentsTab
            supplierId={supplier.id || supplier.supplierId}
            documents={supplier.documents}
            readOnly={readOnly}
            onDocumentsChange={(nextDocuments) => {
              setSupplier((currentValue) => ({
                ...currentValue,
                documents: nextDocuments,
              }))
            }}
          />
        ) : null}
      </div>

      <div className="supplier-form__actions">
        {!readOnly && isDirty ? <span className="supplier-form__dirty-note">Unsaved changes</span> : <span aria-hidden="true" />}
        <div className="supplier-form__action-buttons">
          <button type="button" className="button button-cancel" onClick={onCancel} disabled={isSubmitting}>
            {readOnly ? 'Close' : 'Cancel'}
          </button>
          {!readOnly ? (
            <button
              type="submit"
              className={`button button-primary ${!isValid ? 'is-validation-pending' : ''} ${isSubmitting ? 'is-submitting' : ''}`.trim()}
              disabled={!canSubmit || isSubmitting || !isDirty || !isValid}
              aria-busy={isSubmitting}
              title={!isDirty ? 'No supplier changes to save.' : !isValid ? 'Review highlighted supplier fields before saving.' : 'Save supplier'}
            >
              {isSubmitting ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} />}
              {isSubmitting ? 'Saving Supplier...' : 'Save Supplier'}
            </button>
          ) : null}
        </div>
      </div>
    </form>
  )
}
