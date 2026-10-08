import {
  BadgeCheck,
  Building2,
  CreditCard,
  FileText,
  Hash,
  Landmark,
  Lock,
  LoaderCircle,
  Mail,
  MapPin,
  Phone,
  Plus,
  Eraser,
  Save,
  ShieldCheck,
  Trash2,
  User,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import InputField from '../../../components/InputField'
import CurrencyInput from '../../../components/CurrencyInput'
import SearchableSelect from '../../../components/SearchableSelect'
import { buildCustomerPayload, getChangedCustomerFields } from '../../../api/customersApi'
import { getSupplierIfscDetails } from '../../../api/suppliersApi'
import {
  emailInputProps,
  getEmailError,
  sanitizeEmailInput,
} from '../../../validators/emailValidator'
import {
  getNameError as getSharedNameError,
  sanitizeNameInput,
} from '../../../validators/nameValidator'
import {
  getPhoneError,
  phoneInputProps,
  sanitizePhoneInput,
} from '../../../validators/phoneValidator'
import {
  getPincodeError,
} from '../../../validators/pincodeValidator'
import SupplierAddressTab from '../../Suppliers/components/SupplierAddressTab'
import SupplierBankAccountsTab from '../../Suppliers/components/SupplierBankAccountsTab'
import SupplierContactsTab from '../../Suppliers/components/SupplierContactsTab'
import SupplierPaymentTermsTab from '../../Suppliers/components/SupplierPaymentTermsTab'
import {
  DEPARTMENT_OPTIONS,
  IFSC_PATTERN,
  INDIA_STATES,
  STATE_PINCODE_PREFIXES,
  getCityStateError,
  getDesignationOptionsForDepartment,
  mergeMasterOptions,
} from '../../Suppliers/supplierMasterData'
import '../../Suppliers/Suppliers.css'

const tabs = [
  { id: 'basic', label: 'Basic Information' },
  { id: 'contacts', label: 'Contacts' },
  { id: 'addresses', label: 'Addresses' },
  { id: 'paymentTerms', label: 'Payment Terms' },
  { id: 'banking', label: 'Banking' },
  { id: 'activity', label: 'Activity' },
]

const emptyContact = {
  contactName: '',
  role: 'Sales',
  designation: '',
  phone: '',
  email: '',
  isPrimary: false,
}

const contactRoles = [
  'Sales',
  'Billing',
  'Accounts',
  'Operations',
  'Support',
  'Management',
  'Escalation',
  'Other',
]

const paymentMethodOptions = ['Bank Transfer', 'UPI', 'Cheque', 'Cash', 'Card'].map((item) => ({
  value: item,
  label: item,
}))

const emptyAddress = {
  addressType: 'Billing',
  addressLine: '',
  addressLine2: '',
  city: '',
  state: '',
  country: 'India',
  pincode: '',
  isPrimary: false,
}

const emptyPaymentTerms = {
  creditDays: '',
  creditLimit: '',
  paymentMode: 'Bank Transfer',
  notes: '',
}

const emptyBankDetail = {
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

const emptyForm = {
  name: '',
  customerCode: '',
  customerType: 'Business',
  company: '',
  gstNumber: '',
  panNumber: '',
  phone: '',
  email: '',
  status: 'Active',
  notes: '',
  contacts: [],
  addresses: [],
  paymentTerms: { ...emptyPaymentTerms },
  bankDetails: [],
}

const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z0-9]{3}$/
const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/
const PINCODE_PATTERN = /^[0-9]{6}$/

function collapseSpaces(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function titleCaseWords(value, { preserveAcronyms = false } = {}) {
  return String(value ?? '').replace(/[A-Za-z]+/g, (word) => {
    if (preserveAcronyms && /^[A-Z]{2,}$/.test(word)) return word
    if (word.length === 1) return word.toUpperCase()
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  })
}

function normalizeBusinessText(value, maxLength = 150) {
  return titleCaseWords(
    String(value ?? '')
      .normalize('NFKC')
      .replace(/[<>]/g, '')
      .replace(/^\s+/, '')
      .replace(/[^A-Za-z0-9 .'-]/g, '')
      .replace(/\s{2,}/g, ' ')
      .slice(0, maxLength),
    { preserveAcronyms: true },
  )
}

function normalizeCustomerName(value, maxLength = 255) {
  return titleCaseWords(
    String(value ?? '')
      .normalize('NFKC')
      .replace(/[<>]/g, '')
      .replace(/^\s+/, '')
      .replace(/[^A-Za-z0-9 &.'-]/g, '')
      .replace(/\s{2,}/g, ' ')
      .slice(0, maxLength),
    { preserveAcronyms: true },
  )
}

function normalizeCustomerDisplayName(value, maxLength = 100) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/[<>]/g, '')
    .replace(/^\s+/, '')
    .replace(/[^A-Za-z &.-]/g, '')
    .replace(/\s{2,}/g, ' ')
    .slice(0, maxLength)
}

function normalizeAddressText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/[<>]/g, '')
    .replace(/^\s+/, '')
    .replace(/[^A-Za-z0-9 .,/#&'-]/g, '')
    .replace(/\s{2,}/g, ' ')
    .slice(0, 255)
}

function normalizeHumanName(value) {
  return titleCaseWords(
    String(value ?? '')
      .normalize('NFKC')
      .replace(/[<>]/g, '')
      .replace(/^\s+/, '')
      .replace(/[^A-Za-z .'-]/g, '')
      .replace(/\s{2,}/g, ' ')
      .slice(0, 150),
  )
}

function normalizeContactName(value) {
  return titleCaseWords(
    String(value ?? '')
      .normalize('NFKC')
      .replace(/[<>]/g, '')
      .replace(/^\s+/, '')
      .replace(/[^A-Za-z &.-]/g, '')
      .replace(/\s{2,}/g, ' ')
      .slice(0, 150),
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
    String(value ?? '')
      .normalize('NFKC')
      .replace(/[<>]/g, '')
      .replace(/^\s+/, '')
      .replace(/[^A-Za-z0-9 .,/&'-]/g, '')
      .replace(/\s{2,}/g, ' ')
      .slice(0, 100),
    { preserveAcronyms: true },
  )
}

function normalizeCountryValue(value) {
  const rawValue = typeof value === 'object' && value !== null
    ? value.value ?? value.label ?? value.name ?? value.Name ?? ''
    : value
  return collapseSpaces(rawValue) || 'India'
}

function isIndiaCountry(value) {
  return normalizeCountryValue(value).toLowerCase() === 'india'
}

function readValue(source, ...keys) {
  return keys.reduce((result, key) => (
    result !== undefined && result !== null ? result : source?.[key]
  ), undefined)
}

function getIfscPayload(payload) {
  const source = payload?.data || payload?.result || payload
  const bankName = collapseSpaces(readValue(source, 'BANK', 'bank', 'Bank', 'bankName', 'BankName'))
  const branch = collapseSpaces(readValue(source, 'BRANCH', 'branch', 'Branch'))
  const city = collapseSpaces(readValue(source, 'CITY', 'city', 'City'))
  const state = collapseSpaces(readValue(source, 'STATE', 'state', 'State'))

  if (!bankName && !branch && !city && !state) return null
  return { bankName, branch, city, state }
}

function normalizeCode(value, maxLength = 40) {
  return collapseSpaces(value)
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
    .slice(0, maxLength)
}

function normalizeGst(value) {
  return String(value ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 15)
}

function normalizePan(value) {
  return String(value ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 10)
}

function normalizeDecimal(value, maxIntegerDigits = 10) {
  const cleanValue = String(value ?? '').replace(/[^0-9.]/g, '')
  const [whole, ...decimalParts] = cleanValue.split('.')
  const truncatedWhole = (whole || '').slice(0, maxIntegerDigits)
  return decimalParts.length ? `${truncatedWhole}.${decimalParts.join('').slice(0, 2)}` : truncatedWhole
}

function normalizeDigits(value, maxLength) {
  return String(value ?? '').replace(/\D/g, '').slice(0, maxLength)
}

function normalizeStatus(value) {
  return collapseSpaces(value).toLowerCase() === 'inactive' ? 'Inactive' : 'Active'
}

function normalizeCustomerType(value) {
  return collapseSpaces(value).toLowerCase() === 'individual' ? 'Individual' : 'Business'
}

function sanitizeCustomerPhone(value) {
  const digits = String(value ?? '').replace(/\D/g, '')
  const withoutCountryCode = digits.length > 10 && digits.startsWith('91') ? digits.slice(2) : digits
  return withoutCountryCode.slice(0, 10)
}

function makeCustomerCode(initialValues) {
  if (initialValues?.customerCode) {
    return normalizeCode(initialValues.customerCode)
  }

  return 'CUST-000001'
}

function normalizeActivityType(item = {}) {
  const rawType = collapseSpaces(item.type || item.activityType || item.eventType || 'Activity')
  const normalizedType = rawType.toLowerCase()

  if (normalizedType.includes('create')) return 'Customer Created'
  if (normalizedType.includes('update')) return 'Customer Updated'
  if (normalizedType.includes('contact')) return 'Contact Added'
  if (normalizedType.includes('address')) return 'Address Added'
  if (normalizedType.includes('payment')) return 'Payment Received'
  if (normalizedType.includes('invoice')) return 'Invoice Generated'
  return rawType
}

function readInitialList(value) {
  return Array.isArray(value) ? value : []
}

function getInitialForm(initialValues) {
  const paymentTerms = initialValues?.paymentTerms || initialValues?.paymentTerm || {}
  const primaryAddress = initialValues?.address || initialValues?.city || ''
  const values = {
    ...emptyForm,
    name: normalizeCustomerDisplayName(initialValues?.name ?? '', 100),
    customerCode: initialValues?.customerCode ?? '',
    customerType: normalizeCustomerType(initialValues?.customerType ?? initialValues?.type ?? 'Business'),
    company: normalizeCustomerName(initialValues?.companyName ?? initialValues?.company ?? '', 50),
    gstNumber: normalizeGst(initialValues?.gstNumber ?? initialValues?.taxNumber ?? ''),
    panNumber: normalizePan(initialValues?.panNumber ?? ''),
    phone: sanitizeCustomerPhone(initialValues?.phone ?? ''),
    email: sanitizeEmailInput(initialValues?.email ?? ''),
    status: normalizeStatus(initialValues?.status ?? 'Active'),
    notes: initialValues?.notes ?? '',
    contacts: readInitialList(initialValues?.contacts).map((contact, index) => ({
      ...emptyContact,
      ...contact,
      contactName: contact.contactName || contact.ContactName || contact.name || '',
      role: contact.role || contact.Role || contact.contactRole || 'Sales',
      phone: sanitizePhoneInput(contact.phone || contact.Phone || ''),
      email: sanitizeEmailInput(contact.email || contact.Email || ''),
      isPrimary: Boolean(contact.isPrimary ?? contact.IsPrimary ?? index === 0),
    })),
    addresses: readInitialList(initialValues?.addresses).map((address) => ({
      ...emptyAddress,
      ...address,
      addressLine: address.addressLine || address.AddressLine || address.addressLine1 || primaryAddress,
      addressLine2: address.addressLine2 || address.AddressLine2 || address.addressLineTwo || '',
      addressType: address.addressType || address.AddressType || address.type || 'Billing',
      city: address.city || address.City || '',
      state: address.state || address.State || '',
      country: address.country || address.Country || 'India',
      pincode: normalizeDigits(address.pincode || address.Pincode || address.postalCode || '', 6),
    })).map((address, index, addresses) => ({
      ...address,
      isPrimary: Boolean(address.isPrimary ?? address.IsPrimary ?? (index === 0 && !addresses.some((item) => item.isPrimary || item.IsPrimary))),
    })),
    paymentTerms: {
      ...emptyPaymentTerms,
      ...paymentTerms,
      creditDays: String(paymentTerms.creditDays ?? initialValues?.creditDays ?? ''),
      creditLimit: String(paymentTerms.creditLimit ?? initialValues?.creditLimit ?? ''),
      paymentMode: paymentTerms.paymentMode || paymentTerms.preferredPaymentMethod || 'Bank Transfer',
    },
    bankDetails: readInitialList(initialValues?.bankDetails || initialValues?.bankAccounts).map((bank) => ({
      ...emptyBankDetail,
      ...bank,
      accountName: bank.accountName || bank.AccountName || '',
      accountNumber: normalizeDigits(bank.accountNumber || bank.AccountNumber || '', 18),
      bankName: bank.bankName || bank.BankName || '',
      ifscCode: normalizeCode(bank.ifscCode || bank.IfscCode || '', 11),
      branch: bank.branch || bank.Branch || '',
      bankState: bank.bankState || bank.BankState || '',
      bankCity: bank.bankCity || bank.BankCity || '',
      upiId: bank.upiId || bank.UpiId || '',
    })).map((bank, index, bankDetails) => ({
      ...bank,
      isPrimary: Boolean(bank.isPrimary ?? bank.IsPrimary ?? (index === 0 && !bankDetails.some((item) => item.isPrimary || item.IsPrimary))),
    })),
  }

  return {
    ...values,
    customerCode: makeCustomerCode(initialValues),
  }
}

function getServerFieldError(errors, fieldName) {
  if (!errors || typeof errors !== 'object') return ''
  const normalizedField = fieldName.toLowerCase()
  const match = Object.entries(errors).find(([key]) =>
    key.toLowerCase().endsWith(normalizedField),
  )
  const value = match?.[1]
  if (Array.isArray(value)) return value.find(Boolean) || ''
  return typeof value === 'string' ? value : ''
}

function getNameError(value, label, { required = true, min = 3 } = {}) {
  return getSharedNameError(value, { label, required, min, allowAmpersand: true, allowNumbers: true })
}

function getPlaceNameError(value, label) {
  const cleanValue = collapseSpaces(value)
  if (!cleanValue) return `${label} is required.`
  if (cleanValue.length < 2) return `${label} must be at least 2 characters.`
  if (cleanValue.length > 100) return `${label} cannot exceed 100 characters.`
  if (!/[A-Za-z]/.test(cleanValue) || /^\d+$/.test(cleanValue)) {
    return `${label} must contain alphabetic characters and cannot contain only numbers.`
  }
  return /^[A-Za-z .'-]+$/.test(cleanValue)
    ? ''
    : `${label} can contain letters, spaces, periods, apostrophes, and hyphens only.`
}

function getAddressLineError(value, label, required = false) {
  const cleanValue = collapseSpaces(value)
  if (!cleanValue) return required ? `${label} is required.` : ''
  if (cleanValue.length < 3) return `${label} must be at least 3 characters.`
  if (cleanValue.length > 200) return `${label} cannot exceed 200 characters.`
  if (!/[A-Za-z]/.test(cleanValue)) {
    return 'Address must contain meaningful text.'
  }
  return /^[A-Za-z0-9 .,/#'()\--]+$/.test(cleanValue)
    ? ''
    : 'Enter a valid address using letters, numbers, spaces and common address punctuation.'
}

function getBankNameError(value) {
  const cleanValue = collapseSpaces(value)
  if (!cleanValue) return 'Bank name is required.'
  if (cleanValue.length < 2) return 'Bank name must be at least 2 characters.'
  if (cleanValue.length > 100) return 'Bank name cannot exceed 100 characters.'
  if (!/[A-Za-z]/.test(cleanValue) || /^\d+$/.test(cleanValue)) return 'Bank name must contain alphabetic characters and cannot contain only numbers.'
  return /^[A-Za-z0-9 .&'-]+$/.test(cleanValue) ? '' : 'Bank name contains invalid characters.'
}

function getAccountNumberError(value) {
  const accountNumber = collapseSpaces(value)
  if (!accountNumber) return 'Account number is required.'
  if (!/^\d+$/.test(accountNumber)) return 'Account number must contain only digits.'
  return /^\d{9,18}$/.test(accountNumber) ? '' : 'Account number must be 9 to 18 digits.'
}

function getBranchError(value) {
  const branch = collapseSpaces(value)
  if (!branch) return ''
  if (branch.length < 2) return 'Branch name must be at least 2 characters.'
  if (branch.length > 100) return 'Branch name cannot exceed 100 characters.'
  if (!/[A-Za-z]/.test(branch) || /^\d+$/.test(branch)) return 'Branch name must contain alphabetic characters and cannot contain only numbers.'
  return /^[A-Za-z0-9 .,/&'-]+$/.test(branch)
    ? ''
    : 'Branch can contain letters, numbers, spaces, periods, commas, slashes, and hyphens only.'
}

function hasDuplicate(values, value) {
  return Boolean(value) && values.filter((item) => item === value).length > 1
}

function uniqueCleanValues(values) {
  return [...new Set(values.map(collapseSpaces).filter(Boolean))]
}

function getContactNameError(value) {
  const cleanValue = collapseSpaces(value)
  if (!cleanValue) return 'Contact name is required.'
  if (cleanValue.length < 2) return 'Contact name must be at least 2 characters.'
  if (!/[A-Za-z]/.test(cleanValue) || /^\d+$/.test(cleanValue)) {
    return 'Contact name must contain alphabetic characters and cannot contain only numbers.'
  }
  if (!/^[A-Za-z &.-]+$/.test(cleanValue)) {
    return 'Contact name can contain only letters, spaces, &, -, and .'
  }
  return ''
}

function getCustomerNameError(value) {
  const cleanValue = collapseSpaces(value)
  if (!cleanValue) return 'Customer name is required.'
  const sharedError = getSharedNameError(cleanValue, {
    label: 'Customer name',
    required: true,
    min: 2,
    max: 100,
  })
  if (sharedError) return sharedError

  if (!/[A-Za-z]/.test(cleanValue) || /^\d+$/.test(cleanValue)) {
    return 'Customer name must contain alphabetic characters and cannot contain only numbers.'
  }
  if (!/^[A-Za-z &.-]+$/.test(cleanValue)) {
    return 'Customer name can contain only letters, spaces, &, -, and .'
  }
  return ''
}

function getCompanyNameError(value) {
  const cleanValue = collapseSpaces(value)
  if (!cleanValue) return ''
  if (cleanValue.length < 3) return 'Company name must be at least 3 characters.'
  if (cleanValue.length > 50) return 'Company name cannot exceed 50 characters.'
  if (!/[A-Za-z]/.test(cleanValue)) return 'Company name must include letters.'
  if (!/^[A-Za-z0-9 &.'-]+$/.test(cleanValue)) {
    return "Company name can use letters, numbers, spaces, &, -, ., and '."
  }
  if (/([A-Za-z0-9])\1{3,}/.test(cleanValue) || /([A-Za-z0-9]{1,2})\1{3,}/i.test(cleanValue)) {
    return 'Enter a valid company name.'
  }
  return ''
}

function getOptionalCodeError(value, label, pattern, message, length = null, { required = false } = {}) {
  const cleanValue = collapseSpaces(value).toUpperCase()
  if (!cleanValue) return required ? `${label} is required.` : ''
  if (length && cleanValue.length !== length) return `${label} must contain ${length} characters.`
  return pattern.test(cleanValue) ? '' : message
}

function hasBasicContactData(values) {
  return Boolean(collapseSpaces(values.name) || sanitizeCustomerPhone(values.phone) || sanitizeEmailInput(values.email))
}

function getPrimaryContactSyncPatch(values) {
  return {
    contactName: collapseSpaces(values.name),
    role: 'Sales',
    phone: sanitizeCustomerPhone(values.phone),
    email: sanitizeEmailInput(values.email),
  }
}

function syncPrimaryContact(values) {
  const patch = getPrimaryContactSyncPatch(values)
  const contacts = Array.isArray(values.contacts) ? [...values.contacts] : []
  const primaryIndex = contacts.findIndex((contact) => contact.isPrimary)
  const targetIndex = primaryIndex >= 0 ? primaryIndex : 0
  const currentContact = contacts[targetIndex] || { ...emptyContact, isInlineDraft: true }

  contacts[targetIndex] = {
    ...currentContact,
    ...patch,
    isPrimary: true,
    isInlineDraft: currentContact.isInlineDraft ?? true,
  }

  return contacts.map((contact, index) => (
    index === targetIndex ? contact : { ...contact, isPrimary: false }
  ))
}

function isSyncedPrimaryContact(contact, values) {
  if (!contact) return true
  const patch = getPrimaryContactSyncPatch(values)
  return (
    collapseSpaces(contact.contactName) === patch.contactName &&
    sanitizePhoneInput(contact.phone) === patch.phone &&
    sanitizeEmailInput(contact.email) === patch.email
  )
}

function isBlankContact(contact = {}) {
  return !contact.contactName && !contact.designation && !contact.phone && !contact.email
}

function isBlankAddress(address = {}) {
  return !address.addressLine && !address.addressLine2 && !address.city && !address.state && !address.pincode
}

function isBlankBankDetail(bank = {}) {
  return !bank.accountName && !bank.accountNumber && !bank.bankName && !bank.ifscCode && !bank.branch
}

function getContactErrors(contact) {
  if (isBlankContact(contact) && !contact.forceValidation) return {}
  return {
    contactName: getContactNameError(contact.contactName),
    role: contactRoles.includes(contact.role || 'Sales') ? '' : 'Select a valid role.',
    designation: getNameError(contact.designation, 'Designation', { required: false, min: 2 }),
    phone: contact.phone ? getPhoneError(contact.phone, 'Contact phone') : 'Contact phone is required.',
    email: contact.email ? getEmailError(contact.email) : '',
  }
}

function getAddressErrors(address) {
  if (isBlankAddress(address) && !address.forceValidation) return {}
  const country = normalizeCountryValue(address.country)
  const state = collapseSpaces(address.state)
  return {
    addressType: ['Billing', 'Shipping', 'Warehouse', 'Head Office', 'Branch Office', 'Factory', 'Office', 'Other'].includes(address.addressType || 'Billing') ? '' : 'Select a valid address type.',
    addressLine: getAddressLineError(address.addressLine, 'Address line 1', true),
    addressLine2: getAddressLineError(address.addressLine2, 'Address line 2'),
    city: getPlaceNameError(address.city, 'City') || getCityStateError(address.city, state, country),
    state: isIndiaCountry(country)
      ? (!state ? 'State is required.' : INDIA_STATES.includes(state) ? '' : 'Select a valid Indian state or union territory.')
      : getPlaceNameError(state, 'State'),
    country: country ? '' : 'Country is required.',
    pincode: getPincodeError(address.pincode, state, country, { required: false }),
  }
}

function getBankErrors(bank) {
  if (isBlankBankDetail(bank) && !bank.forceValidation) return {}
  return {
    accountName: getNameError(bank.accountName, 'Account name'),
    accountNumber: getAccountNumberError(bank.accountNumber),
    bankName: getBankNameError(bank.bankName),
    ifscCode: bank.ifscCode && IFSC_PATTERN.test(bank.ifscCode) ? '' : 'IFSC code must follow format SBIN0001234.',
    branch: getBranchError(bank.branch),
    upiId: '',
  }
}

function getComparablePayload(values) {
  const payload = buildCustomerPayload(values)
  return {
    customerCode: payload.customerCode,
    name: payload.name,
    company: payload.company,
    gstNumber: payload.gstNumber,
    panNumber: payload.panNumber,
    phone: payload.phone,
    email: payload.email,
    status: payload.status,
    customerType: values.customerType || 'Business',
    creditLimit: payload.creditLimit,
    contacts: JSON.stringify((payload.contacts || []).filter((contact) => !isBlankContact(contact))),
    addresses: JSON.stringify(payload.addresses),
    paymentTerms: JSON.stringify(payload.paymentTerms),
    bankDetails: JSON.stringify(payload.bankDetails),
  }
}

function formatDateTime(value) {
  const date = new Date(value)
  if (!value || Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function Section({ title, subtitle, children, className = '' }) {
  return (
    <section className={`customer-master-section ${className}`.trim()}>
      {title || subtitle ? (
        <div className="customer-master-section__heading">
          {title ? <h3>{title}</h3> : null}
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
      ) : null}
      {children}
    </section>
  )
}

function EmptyPanel({ title, description }) {
  return (
    <div className="customer-master-empty">
      <strong>{title}</strong>
      <span>{description}</span>
    </div>
  )
}

export default function CustomerForm({
  initialValues,
  activity = [],
  apiErrors,
  apiMessage,
  isLoadingInitial,
  isSubmitting,
  readOnly = false,
  canSubmit,
  onSubmit,
  onCancel,
  onDirtyChange,
  activeTab: controlledActiveTab,
  onTabChange,
}) {
  const [formData, setFormData] = useState(() => getInitialForm(initialValues))
  const [internalActiveTab, setInternalActiveTab] = useState('basic')
  const activeTab = controlledActiveTab ?? internalActiveTab

  const handleTabSelect = useCallback((nextTab) => {
    setInternalActiveTab(nextTab)
    onTabChange?.(nextTab)
  }, [onTabChange])

  const setActiveTab = handleTabSelect
  const [touched, setTouched] = useState({})
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [isPrimaryContactSynced, setIsPrimaryContactSynced] = useState(() => {
    const initialForm = getInitialForm(initialValues)
    const primaryContact = initialForm.contacts.find((contact) => contact.isPrimary)
    return !primaryContact || isSyncedPrimaryContact(primaryContact, initialForm)
  })
  const formRef = useRef(null)
  const isEditing = Boolean(initialValues?.id)
  const lastLoadedIdRef = useRef(initialValues?.id)
  const isDirtyRef = useRef(false)

  useEffect(() => {
    const currentId = initialValues?.id
    const isNewEntity = currentId !== lastLoadedIdRef.current
    lastLoadedIdRef.current = currentId

    if (isNewEntity) {
      const initialForm = getInitialForm(initialValues)
      const primaryContact = initialForm.contacts.find((contact) => contact.isPrimary)
      setFormData(initialForm)
      handleTabSelect('basic')
      setTouched({})
      setSubmitAttempted(false)
      setIsPrimaryContactSynced(!primaryContact || isSyncedPrimaryContact(primaryContact, initialForm))
    } else if (initialValues && !isDirtyRef.current) {
      // Async update for the same customer (e.g. getCustomerById loaded details)
      // Only sync if user hasn't modified the form yet
      const initialForm = getInitialForm(initialValues)
      const primaryContact = initialForm.contacts.find((contact) => contact.isPrimary)
      setFormData(initialForm)
      setIsPrimaryContactSynced(!primaryContact || isSyncedPrimaryContact(primaryContact, initialForm))
    }
  }, [initialValues, handleTabSelect])

  useEffect(() => {
    if (initialValues?.customerCode) return
    setFormData((current) => ({
      ...current,
      customerCode: makeCustomerCode(initialValues),
    }))
  }, [initialValues])

  const basicErrors = {
    name: getCustomerNameError(formData.name),
    customerCode: '',
    customerType: ['Business', 'Individual'].includes(formData.customerType) ? '' : 'Select a valid customer type.',
    company: getCompanyNameError(formData.company),
    gstNumber: getOptionalCodeError(
      formData.gstNumber,
      'GST number',
      GSTIN_PATTERN,
      'Enter a valid GST number.',
      formData.gstNumber ? 15 : null,
    ),
    panNumber: getOptionalCodeError(
      formData.panNumber,
      'PAN number',
      PAN_PATTERN,
      'PAN must follow format ABCDE1234F.',
      formData.panNumber ? 10 : null,
    ),
    phone: getPhoneError(formData.phone),
    email: formData.email ? getEmailError(formData.email) : '',
    status: ['Active', 'Inactive'].includes(formData.status) ? '' : 'Select a valid status.',
  }

  const contactErrors = useMemo(() => {
    const phones = formData.contacts.map((contact) => sanitizePhoneInput(contact.phone)).filter(Boolean)
    const emails = formData.contacts.map((contact) => sanitizeEmailInput(contact.email)).filter(Boolean)
    const primaryCount = formData.contacts.filter((contact) => contact.isPrimary).length

    return formData.contacts.map((contact) => {
      const errors = getContactErrors(contact)
      if (!Object.keys(errors).length) return errors

      return {
        ...errors,
        phone: errors.phone || (hasDuplicate(phones, sanitizePhoneInput(contact.phone)) ? 'Contact phone is already used.' : ''),
        email: errors.email || (hasDuplicate(emails, sanitizeEmailInput(contact.email)) ? 'Contact email is already used.' : ''),
        duplicate: primaryCount > 1 ? 'Only one primary contact is allowed.' : '',
      }
    })
  }, [formData.contacts])
  const addressErrors = useMemo(() => formData.addresses.map(getAddressErrors), [formData.addresses])
  const addressWarnings = useMemo(() => formData.addresses.map((address) => {
    const country = normalizeCountryValue(address.country)
    const state = collapseSpaces(address.state)

    if (!isIndiaCountry(country) || !PINCODE_PATTERN.test(address.pincode || '') || !state) {
      return {}
    }

    const prefixes = STATE_PINCODE_PREFIXES[state] || []
    return prefixes.length > 0 && !prefixes.some((prefix) => address.pincode.startsWith(prefix))
      ? { pincode: 'Pincode may not belong to the selected state.' }
      : {}
  }), [formData.addresses])
  const bankErrors = useMemo(() => {
    const accountNumbers = formData.bankDetails.map((bank) => normalizeDigits(bank.accountNumber, 18)).filter(Boolean)
    const accountIfscPairs = formData.bankDetails
      .map((bank) => ({
        accountNumber: normalizeDigits(bank.accountNumber, 18),
        ifscCode: normalizeCode(bank.ifscCode, 11),
      }))
      .filter((bank) => bank.accountNumber && bank.ifscCode)
      .map((bank) => `${bank.accountNumber}|${bank.ifscCode}`)

    return formData.bankDetails.map((bank) => {
      const errors = getBankErrors(bank)
      if (!Object.keys(errors).length) return errors

      const accountNumber = normalizeDigits(bank.accountNumber, 18)
      const ifscCode = normalizeCode(bank.ifscCode, 11)
      return {
        ...errors,
        accountNumber:
          errors.accountNumber ||
          (hasDuplicate(accountNumbers, accountNumber) ? 'Account number is already used.' : '') ||
          (accountNumber && ifscCode && hasDuplicate(accountIfscPairs, `${accountNumber}|${ifscCode}`) ? 'This IFSC and account number combination already exists.' : ''),
      }
    })
  }, [formData.bankDetails])
  const paymentErrors = {
    creditDays:
      formData.paymentTerms.creditDays && Number(formData.paymentTerms.creditDays) > 365
        ? 'Credit days must be between 0 and 365.'
        : '',
    creditLimit:
      formData.paymentTerms.creditLimit && Number(formData.paymentTerms.creditLimit) < 0
        ? 'Credit limit cannot be negative.'
        : formData.paymentTerms.creditLimit && Number(formData.paymentTerms.creditLimit) > 999999999.99
          ? 'Credit limit cannot exceed 999,999,999.99.'
          : '',
    paymentMode: '',
  }

  const clientErrors = {
    ...basicErrors,
  }

  const errors = Object.keys(clientErrors).reduce((result, key) => {
    result[key] = clientErrors[key] || getServerFieldError(apiErrors, key)
    return result
  }, {})

  const tabErrors = {
    basic: Object.values(basicErrors).some(Boolean),
    contacts: contactErrors.some((item) => Object.values(item).some(Boolean)),
    addresses: addressErrors.some((item) => Object.values(item).some(Boolean)),
    paymentTerms: Object.values(paymentErrors).some(Boolean),
    banking: bankErrors.some((item) => Object.values(item).some(Boolean)),
    activity: false,
  }

  const comparableInitial = useMemo(
    () => getComparablePayload(getInitialForm(initialValues)),
    [initialValues],
  )
  const comparableCurrent = useMemo(() => getComparablePayload(formData), [formData])
  const isDirty = Object.keys(comparableCurrent).some(
    (key) => String(comparableInitial[key] ?? '') !== String(comparableCurrent[key] ?? ''),
  )
  const isValid = [
    ...Object.values(basicErrors),
    ...Object.values(paymentErrors),
    ...contactErrors.flatMap((item) => Object.values(item)),
    ...addressErrors.flatMap((item) => Object.values(item)),
    ...bankErrors.flatMap((item) => Object.values(item)),
  ].every((value) => !value)
  const hasApiErrors = Boolean(apiErrors && Object.keys(apiErrors).length > 0)
  const isDuplicateFieldMessage = useMemo(() => {
    if (!apiMessage) return false
    const cleanMsg = String(apiMessage).trim().toLowerCase()
    const allFieldMessages = [
      ...Object.values(errors),
      ...Object.values(paymentErrors),
      ...contactErrors.flatMap((item) => Object.values(item)),
      ...addressErrors.flatMap((item) => Object.values(item)),
      ...bankErrors.flatMap((item) => Object.values(item)),
      ...(apiErrors && typeof apiErrors === 'object' ? Object.values(apiErrors).flat() : []),
    ].filter(Boolean).map((msg) => String(msg).trim().toLowerCase())

    return allFieldMessages.includes(cleanMsg)
  }, [apiMessage, errors, paymentErrors, contactErrors, addressErrors, bankErrors, apiErrors])
  const shouldShowTopMessage = Boolean(
    apiMessage && isValid && !hasApiErrors && !isDuplicateFieldMessage
  )
  const isReadOnly = Boolean(readOnly)
  const isBusy = isLoadingInitial || isSubmitting
  const disableSubmit = isReadOnly || !canSubmit || !isValid || isBusy || (isEditing && !isDirty)
  const hasPrimarySyncSource = hasBasicContactData({
    name: formData.name,
    phone: formData.phone,
    email: formData.email,
  }) && Boolean(collapseSpaces(formData.name) && sanitizeCustomerPhone(formData.phone) && sanitizeEmailInput(formData.email))
  useEffect(() => {
    if (activeTab !== 'contacts' || isReadOnly || formData.contacts.length > 0) {
      return
    }

    setFormData((current) => (
      current.contacts.length > 0
        ? current
        : {
          ...current,
          contacts: hasBasicContactData(current)
            ? syncPrimaryContact(current)
            : [{ ...emptyContact, isPrimary: true, isInlineDraft: true }],
        }
    ))
  }, [activeTab, formData.contacts.length, isReadOnly])

  useEffect(() => {
    if (isReadOnly || !isPrimaryContactSynced || !hasPrimarySyncSource || formData.contacts.length === 0) return

    setFormData((current) => {
      if (current.contacts.length === 0) {
        return current
      }

      const nextContacts = syncPrimaryContact(current)
      if (JSON.stringify(nextContacts) === JSON.stringify(current.contacts)) {
        return current
      }

      return {
        ...current,
        contacts: nextContacts,
      }
    })
  }, [hasPrimarySyncSource, formData.name, formData.phone, formData.email, formData.contacts.length, isPrimaryContactSynced, isReadOnly])

  useEffect(() => {
    if (activeTab !== 'addresses' || isReadOnly || formData.addresses.length > 0) {
      return
    }

    setFormData((current) => (
      current.addresses.length > 0
        ? current
        : {
          ...current,
          addresses: [{ ...emptyAddress, isPrimary: true, isInlineDraft: true }],
        }
    ))
  }, [activeTab, formData.addresses.length, isReadOnly])

  useEffect(() => {
    if (activeTab !== 'banking' || isReadOnly || formData.bankDetails.length > 0) {
      return
    }

    setFormData((current) => (
      current.bankDetails.length > 0
        ? current
        : {
          ...current,
          bankDetails: [{ ...emptyBankDetail, isPrimary: true, isInlineDraft: true }],
        }
    ))
  }, [activeTab, formData.bankDetails.length, isReadOnly])

  useEffect(() => {
    isDirtyRef.current = !isReadOnly && isDirty
    onDirtyChange?.(!isReadOnly && isDirty)
  }, [isDirty, isReadOnly, onDirtyChange])

  function shouldShowError(name) {
    if (isReadOnly) return false
    const hasServerError = Boolean(getServerFieldError(apiErrors, name))
    const hasLiveValue = ['company', 'gstNumber', 'panNumber', 'phone'].includes(name)
      && Boolean(formData[name])
    return Boolean(touched[name] || submitAttempted || hasServerError || hasLiveValue)
  }


  function handleBasicChange(event) {
    if (isReadOnly) return
    const { name, value } = event.target
    const nextValue =
      name === 'phone'
        ? sanitizeCustomerPhone(value)
        : name === 'email'
          ? sanitizeEmailInput(value)
          : name === 'customerType'
            ? normalizeCustomerType(value)
            : name === 'gstNumber'
              ? normalizeGst(value)
              : name === 'panNumber'
                ? normalizePan(value)
                : name === 'name'
                  ? normalizeCustomerDisplayName(value, 100)
                  : name === 'company'
                    ? normalizeCustomerName(value, 150)
                    : value

    if (name === 'name') {
      const displayName = normalizeCustomerDisplayName(nextValue, 100)
      setFormData((current) => ({
        ...current,
        name: displayName,
      }))
      return
    }

    if (name === 'company') {
      const companyName = normalizeCustomerName(nextValue, 50)
      setFormData((current) => ({
        ...current,
        company: companyName,
      }))
      return
    }

    if (name === 'customerType') {
      setFormData((current) => ({
        ...current,
        customerType: nextValue,
      }))
      return
    }

    setFormData((current) => ({ ...current, [name]: nextValue }))
  }

  function handleBlur(event) {
    if (isReadOnly) return
    const { name } = event.target
    setTouched((current) => ({ ...current, [name]: true }))
    setFormData((current) => {
      const nextValue = ['name', 'company'].includes(name) ? collapseSpaces(current[name]) : current[name]
      const nextValues = {
        ...current,
        [name]: nextValue,
      }
      return nextValues
    })
  }

  function handlePaymentChange(event) {
    if (isReadOnly) return
    const { name, value } = event.target
    const nextValue =
      name === 'creditDays'
        ? normalizeDigits(value, 3)
        : name === 'creditLimit'
          ? normalizeDecimal(value)
          : name === 'notes'
            ? String(value ?? '').replace(/[<>]/g, '').slice(0, 1000)
            : value

    setFormData((current) => ({
      ...current,
      paymentTerms: {
        ...current.paymentTerms,
        [name]: nextValue,
      },
    }))
    setTouched((current) => ({ ...current, paymentTerms: true }))
  }

  function updateInlineContact(index, event) {
    if (isReadOnly) return
    const { name, value, type, checked } = event.target
    const currentContact = formData.contacts[index]
    if (name === 'isPrimary' && !checked && currentContact?.isPrimary) {
      return
    }
    const touchesSyncedPrimary = currentContact?.isPrimary && isPrimaryContactSynced && [
      'contactName',
      'role',
      'designation',
      'phone',
      'email',
      'isPrimary',
    ].includes(name)

    if (touchesSyncedPrimary) {
      setIsPrimaryContactSynced(false)
    }

    const nextValue =
      name === 'phone'
        ? sanitizePhoneInput(value)
        : name === 'email'
          ? sanitizeEmailInput(value)
          : name === 'contactName'
            ? normalizeContactName(value)
            : name === 'designation'
              ? normalizeBusinessText(value, 100)
              : value

    setFormData((current) => ({
      ...current,
      contacts: current.contacts.map((contact, contactIndex) => {
        if (contactIndex !== index) {
          return name === 'isPrimary' && checked ? { ...contact, isPrimary: false } : contact
        }

        return {
          ...contact,
          [name]: type === 'checkbox' ? checked : nextValue,
        }
      }),
    }))
  }

  function blurInlineContact(index, event) {
    if (isReadOnly) return
    const { name } = event.target
    setTouched((current) => ({ ...current, collections: true }))
    setFormData((current) => ({
      ...current,
      contacts: current.contacts.map((contact, contactIndex) => (
        contactIndex === index
          ? { ...contact, [name]: collapseSpaces(contact[name]) }
          : contact
      )),
    }))
  }

  function addInlineContact() {
    if (isReadOnly) return

    setFormData((current) => {
      const hasContacts = current.contacts.length > 0
      return {
        ...current,
        contacts: [
          ...current.contacts,
          {
            ...emptyContact,
            role: 'Sales',
            isPrimary: !hasContacts,
            isInlineDraft: true,
          },
        ],
      }
    })
    setTouched((current) => ({ ...current, collections: true }))
  }

  function markPrimaryContact(index) {
    if (isReadOnly || formData.contacts[index]?.isPrimary) return

    setIsPrimaryContactSynced(false)
    setFormData((current) => ({
      ...current,
      contacts: current.contacts.map((contact, contactIndex) => ({
        ...contact,
        isPrimary: contactIndex === index,
      })),
    }))
    setTouched((current) => ({ ...current, collections: true }))
  }

  function addInlineAddress() {
    if (isReadOnly) return

    setFormData((current) => {
      const hasAddresses = current.addresses.length > 0
      return {
        ...current,
        addresses: [
          ...current.addresses,
          {
            ...emptyAddress,
            addressType: hasAddresses ? 'Shipping' : 'Billing',
            isPrimary: !hasAddresses,
            isInlineDraft: true,
          },
        ],
      }
    })
    setTouched((current) => ({ ...current, collections: true }))
  }

  function updateInlineAddress(index, event) {
    if (isReadOnly) return

    const { name, value } = event.target
    const nextValue =
      name === 'pincode'
        ? (isIndiaCountry(formData.addresses[index]?.country) ? normalizeDigits(value, 6) : collapseSpaces(value).toUpperCase().replace(/[^A-Z0-9 -]/g, '').slice(0, 12))
        : name === 'addressType'
          ? collapseSpaces(value)
          : name === 'country'
            ? normalizeCountryValue(value)
            : name === 'state'
              ? (isIndiaCountry(formData.addresses[index]?.country) ? collapseSpaces(value) : normalizeHumanName(value))
              : ['city'].includes(name)
                ? normalizeHumanName(value)
                : ['addressLine', 'addressLine2'].includes(name)
                  ? normalizeAddressText(value)
                  : value

    setFormData((current) => ({
      ...current,
      addresses: current.addresses.map((address, addressIndex) => {
        if (addressIndex !== index) return address

        if (name === 'country') {
          return {
            ...address,
            country: nextValue,
            state: '',
            pincode: '',
          }
        }

        if (name === 'state') {
          return {
            ...address,
            state: nextValue,
            pincode: '',
          }
        }

        return { ...address, [name]: nextValue }
      }),
    }))
  }

  function blurInlineAddress(index, event) {
    if (isReadOnly) return

    const { name } = event.target
    setTouched((current) => ({ ...current, collections: true }))
    setFormData((current) => ({
      ...current,
      addresses: current.addresses.map((address, addressIndex) => (
        addressIndex === index
          ? { ...address, [name]: collapseSpaces(address[name]) }
          : address
      )),
    }))
  }

  function markPrimaryAddress(index) {
    if (isReadOnly || formData.addresses[index]?.isPrimary) return

    setFormData((current) => ({
      ...current,
      addresses: current.addresses.map((address, addressIndex) => ({
        ...address,
        isPrimary: addressIndex === index,
      })),
    }))
    setTouched((current) => ({ ...current, collections: true }))
  }

  function addInlineBankDetail() {
    if (isReadOnly) return

    setFormData((current) => {
      const hasBankDetails = current.bankDetails.length > 0
      return {
        ...current,
        bankDetails: [
          ...current.bankDetails,
          {
            ...emptyBankDetail,
            isPrimary: !hasBankDetails,
            isInlineDraft: true,
          },
        ],
      }
    })
    setTouched((current) => ({ ...current, collections: true }))
  }

  function updateInlineBankDetail(index, event) {
    if (isReadOnly) return

    const { name, value } = event.target
    const nextValue =
      name === 'accountNumber'
        ? normalizeDigits(value, 18)
        : name === 'ifscCode'
          ? normalizeCode(value, 11)
          : name === 'accountName'
            ? normalizeHumanName(value)
            : name === 'bankName'
              ? normalizeBankText(value)
              : name === 'branch'
                ? normalizeBranchText(value)
                : ['bankCity', 'bankState'].includes(name)
                  ? normalizeBusinessText(value, 100)
                  : value

    setFormData((current) => ({
      ...current,
      bankDetails: current.bankDetails.map((bank, bankIndex) => (
        bankIndex === index
          ? {
            ...bank,
            [name]: nextValue,
            ...(name === 'ifscCode'
              ? {
                bankName: bank.bankNameAutoFilled && !bank.bankNameManualOverride ? '' : bank.bankName,
                branch: bank.branchAutoFilled && !bank.branchManualOverride ? '' : bank.branch,
                bankCity: bank.bankCityAutoFilled && !bank.bankCityManualOverride ? '' : bank.bankCity,
                bankState: bank.bankStateAutoFilled && !bank.bankStateManualOverride ? '' : bank.bankState,
                bankNameAutoFilled: false,
                branchAutoFilled: false,
                bankCityAutoFilled: false,
                bankStateAutoFilled: false,
                ifscLookupStatus: IFSC_PATTERN.test(nextValue) ? 'pending' : '',
                ifscLookupMessage: '',
              }
              : {}),
            ...(name === 'bankName' ? { bankNameManualOverride: Boolean(nextValue), bankNameAutoFilled: false } : {}),
            ...(name === 'branch' ? { branchManualOverride: Boolean(nextValue), branchAutoFilled: false } : {}),
            ...(name === 'bankCity' ? { bankCityManualOverride: Boolean(nextValue), bankCityAutoFilled: false } : {}),
            ...(name === 'bankState' ? { bankStateManualOverride: Boolean(nextValue), bankStateAutoFilled: false } : {}),
          }
          : bank
      )),
    }))
  }

  function blurInlineBankDetail(index, event) {
    if (isReadOnly) return

    const { name } = event.target
    setTouched((current) => ({ ...current, collections: true }))
    setFormData((current) => ({
      ...current,
      bankDetails: current.bankDetails.map((bank, bankIndex) => (
        bankIndex === index
          ? { ...bank, [name]: collapseSpaces(bank[name]) }
          : bank
      )),
    }))
  }

  function markPrimaryBankDetail(index) {
    if (isReadOnly || formData.bankDetails[index]?.isPrimary) return

    setFormData((current) => ({
      ...current,
      bankDetails: current.bankDetails.map((bank, bankIndex) => ({
        ...bank,
        isPrimary: bankIndex === index,
      })),
    }))
    setTouched((current) => ({ ...current, collections: true }))
  }

  function removeRecord(collectionName, index) {
    if (isReadOnly) return

    setFormData((current) => {
      const nextItems = current[collectionName].filter((_, itemIndex) => itemIndex !== index)
      if (collectionName === 'contacts' && nextItems.length === 0) {
        return {
          ...current,
          contacts: [{ ...emptyContact, role: 'Sales', isPrimary: true, isInlineDraft: true }],
        }
      }
      if (collectionName === 'addresses' && nextItems.length === 0) {
        return {
          ...current,
          addresses: [{ ...emptyAddress, isPrimary: true, isInlineDraft: true }],
        }
      }
      if (collectionName === 'bankDetails' && nextItems.length === 0) {
        return {
          ...current,
          bankDetails: [{ ...emptyBankDetail, isPrimary: true, isInlineDraft: true }],
        }
      }
      if (collectionName === 'contacts' && nextItems.length > 0 && !nextItems.some((item) => item.isPrimary)) {
        nextItems[0] = { ...nextItems[0], isPrimary: true }
      }
      if (collectionName === 'addresses' && nextItems.length > 0 && !nextItems.some((item) => item.isPrimary)) {
        nextItems[0] = { ...nextItems[0], isPrimary: true }
      }
      if (collectionName === 'bankDetails' && nextItems.length > 0 && !nextItems.some((item) => item.isPrimary)) {
        nextItems[0] = { ...nextItems[0], isPrimary: true }
      }
      return { ...current, [collectionName]: nextItems }
    })
    setTouched((current) => ({ ...current, collections: true }))
  }

  async function handleIfscLookup(index, ifscCode) {
    const normalizedIfsc = normalizeCode(ifscCode, 11)
    if (!IFSC_PATTERN.test(normalizedIfsc)) return

    try {
      const response = await getSupplierIfscDetails(normalizedIfsc)
      const payload = response.success ? getIfscPayload(response.data) : null

      setFormData((current) => ({
        ...current,
        bankDetails: current.bankDetails.map((bank, bankIndex) => {
          if (bankIndex !== index || normalizeCode(bank.ifscCode, 11) !== normalizedIfsc) {
            return bank
          }

          if (!payload) {
            return {
              ...bank,
              ifscLookupStatus: 'unrecognized',
              ifscLookupMessage: "We couldn't fetch bank details. You can enter them manually.",
            }
          }

          return {
            ...bank,
            bankName: bank.bankNameManualOverride ? bank.bankName : normalizeBankText(payload.bankName),
            branch: bank.branchManualOverride ? bank.branch : normalizeBranchText(payload.branch),
            bankCity: bank.bankCityManualOverride ? bank.bankCity : normalizeBusinessText(payload.city, 100),
            bankState: bank.bankStateManualOverride ? bank.bankState : normalizeBusinessText(payload.state, 100),
            bankNameAutoFilled: Boolean(payload.bankName && !bank.bankNameManualOverride),
            branchAutoFilled: Boolean(payload.branch && !bank.branchManualOverride),
            bankCityAutoFilled: Boolean(payload.city && !bank.bankCityManualOverride),
            bankStateAutoFilled: Boolean(payload.state && !bank.bankStateManualOverride),
            ifscLookupStatus: 'recognized',
            ifscLookupMessage: 'Bank details fetched from IFSC.',
          }
        }),
      }))
    } catch {
      setFormData((current) => ({
        ...current,
        bankDetails: current.bankDetails.map((bank, bankIndex) => (
          bankIndex === index && normalizeCode(bank.ifscCode, 11) === normalizedIfsc
            ? {
              ...bank,
              ifscLookupStatus: 'unrecognized',
              ifscLookupMessage: "We couldn't fetch bank details. You can enter them manually.",
            }
            : bank
        )),
      }))
    }
  }

  const departmentOptions = useMemo(
    () => mergeMasterOptions(
      ['Sales', 'Billing', 'Accounts', 'Operations', 'Support', 'Management', 'Escalation', 'Other'],
      DEPARTMENT_OPTIONS,
      formData.contacts.map((contact) => contact.role),
    ),
    [formData.contacts],
  )

  const supplierContacts = useMemo(() => formData.contacts.map((contact) => ({
    ...contact,
    name: contact.contactName,
    department: contact.role,
  })), [formData.contacts])

  const supplierAddresses = useMemo(() => formData.addresses.map((address) => ({
    ...address,
    type: address.addressType,
    addressLine1: address.addressLine,
  })), [formData.addresses])

  const supplierBankAccounts = useMemo(() => formData.bankDetails, [formData.bankDetails])

  const supplierPaymentTerms = useMemo(() => ({
    creditDays: formData.paymentTerms.creditDays,
    creditLimit: formData.paymentTerms.creditLimit,
    preferredPaymentMethod: formData.paymentTerms.paymentMode,
    currency: formData.paymentTerms.currency || 'INR',
    taxType: formData.paymentTerms.taxType || '',
    notes: formData.paymentTerms.notes,
  }), [formData.paymentTerms])

  function handleSupplierContactChange(index, event) {
    const { name } = event.target
    const mappedName = name === 'name' ? 'contactName' : name === 'department' ? 'role' : name
    updateInlineContact(index, {
      ...event,
      target: {
        ...event.target,
        name: mappedName,
      },
    })
  }

  function handleSupplierAddressChange(index, event) {
    const { name } = event.target
    const mappedName = name === 'type' ? 'addressType' : name === 'addressLine1' ? 'addressLine' : name
    updateInlineAddress(index, {
      ...event,
      target: {
        ...event.target,
        name: mappedName,
      },
    })
  }

  function handleSupplierPaymentChange(event) {
    const mappedName = event.target.name === 'preferredPaymentMethod' ? 'paymentMode' : event.target.name
    handlePaymentChange({
      ...event,
      target: {
        ...event.target,
        name: mappedName,
      },
    })
  }

  function markAllTouched() {
    setTouched({
      name: true,
      customerCode: true,
      customerType: true,
      company: true,
      gstNumber: true,
      panNumber: true,
      phone: true,
      email: true,
      status: true,
      collections: true,
    })
  }

  function focusFirstInvalid() {
    window.requestAnimationFrame(() => {
      const firstInvalid = formRef.current?.querySelector('[aria-invalid="true"]')
      firstInvalid?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
      firstInvalid?.focus?.()
    })
  }

  function sanitizeForSubmit() {
    const normalizedContacts = formData.contacts
      .map((contact) => ({
        contactName: collapseSpaces(contact.contactName),
        role: contactRoles.includes(contact.role) ? contact.role : 'Sales',
        designation: collapseSpaces(contact.designation),
        phone: sanitizePhoneInput(contact.phone),
        email: sanitizeEmailInput(contact.email),
        isPrimary: Boolean(contact.isPrimary),
      }))
      .filter((contact) => !isBlankContact(contact))
    const normalizedAddresses = formData.addresses
      .map((address) => ({
        ...address,
        addressType: collapseSpaces(address.addressType || 'Billing'),
        addressLine: collapseSpaces(address.addressLine),
        addressLine2: collapseSpaces(address.addressLine2),
        city: collapseSpaces(address.city),
        state: collapseSpaces(address.state),
        country: collapseSpaces(address.country),
        pincode: isIndiaCountry(address.country)
          ? normalizeDigits(address.pincode, 6)
          : collapseSpaces(address.pincode).toUpperCase().replace(/[^A-Z0-9 -]/g, '').slice(0, 12),
        isPrimary: Boolean(address.isPrimary),
      }))
      .filter((address) => !isBlankAddress(address))
    const normalizedBankDetails = formData.bankDetails
      .map((bank) => ({
        ...bank,
        accountName: collapseSpaces(bank.accountName),
        accountNumber: normalizeDigits(bank.accountNumber, 18),
        bankName: collapseSpaces(bank.bankName),
        ifscCode: normalizeCode(bank.ifscCode, 11),
        branch: collapseSpaces(bank.branch),
        isPrimary: Boolean(bank.isPrimary),
      }))
      .filter((bank) => !isBlankBankDetail(bank))
    const hasPaymentTermsData = Boolean(
      formData.paymentTerms.creditDays ||
      formData.paymentTerms.creditLimit ||
      formData.paymentTerms.paymentMode ||
      formData.paymentTerms.notes,
    )
    const includeCollections = isEditing || touched.collections ||
      normalizedContacts.length > 0 ||
      normalizedAddresses.length > 0 ||
      normalizedBankDetails.length > 0
    const includePaymentTerms = isEditing || touched.paymentTerms || hasPaymentTermsData

    return {
      ...formData,
      customerCode: makeCustomerCode(initialValues),
      name: collapseSpaces(formData.name),
      customerType: normalizeCustomerType(formData.customerType),
      company: collapseSpaces(formData.company),
      gstNumber: normalizeGst(formData.gstNumber),
      panNumber: normalizePan(formData.panNumber),
      phone: sanitizePhoneInput(formData.phone),
      email: sanitizeEmailInput(formData.email),
      status: normalizeStatus(formData.status),
      contacts: includeCollections ? normalizedContacts : [],
      addresses: includeCollections ? normalizedAddresses : [],
      bankDetails: includeCollections ? normalizedBankDetails : [],
      bankAccounts: includeCollections ? normalizedBankDetails : [],
      paymentTerms: includePaymentTerms ? {
        ...formData.paymentTerms,
        notes: collapseSpaces(formData.paymentTerms.notes),
      } : null,
    }
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (isReadOnly || isSubmitting) return

    setSubmitAttempted(true)
    markAllTouched()

    if (!isValid || disableSubmit) {
      focusFirstInvalid()
      return
    }

    const nextValues = sanitizeForSubmit()
    onSubmit(nextValues, {
      changedFields: getChangedCustomerFields(getInitialForm(initialValues), nextValues),
    })
  }

  function handleReset() {
    if (isReadOnly || isSubmitting) return
    setFormData(getInitialForm(initialValues))
    setTouched({})
    setSubmitAttempted(false)
    setActiveTab('basic')
  }

  const visibleActivity = Array.isArray(activity) && activity.length > 0
    ? activity
    : [
      initialValues?.createdAt
        ? {
          id: 'created',
          activityType: 'CREATE',
          description: 'Customer profile created.',
          createdAt: initialValues.createdAt,
        }
        : null,
      initialValues?.updatedAt
        ? {
          id: 'updated',
          activityType: 'UPDATE',
          description: 'Customer profile updated.',
          createdAt: initialValues.updatedAt,
        }
        : null,
    ].filter(Boolean)

  return (
    <form
      ref={formRef}
      className={`customer-form customer-form--master customer-form--master-v2 ${isReadOnly ? 'customer-form--readonly' : ''}`.trim()}
      onSubmit={handleSubmit}
      aria-busy={isBusy}
      noValidate
    >
      <div className="customer-master-shell">
        {shouldShowTopMessage ? (
          <div className="message-box message-box--error customer-form__message page-error-banner" role="alert">
            {apiMessage}
          </div>
        ) : null}

        {isLoadingInitial ? (
          <div className="customer-form__loading" role="status">
            <LoaderCircle size={16} className="animate-spin" />
            Loading latest customer profile...
          </div>
        ) : null}

        <div className="customer-form__tabs" role="tablist" aria-label="Customer master sections">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`customer-form__tab ${activeTab === tab.id ? 'is-active' : ''} ${tabErrors[tab.id] && (submitAttempted || touched.collections) ? 'has-error' : ''}`.trim()}
              onClick={() => setActiveTab(tab.id)}
              role="tab"
              aria-selected={activeTab === tab.id}
              disabled={isSubmitting}
            >
              {tab.label}
              {tabErrors[tab.id] && (submitAttempted || touched.collections) ? (
                <span className="customer-form__tab-error" aria-hidden="true" />
              ) : null}
            </button>
          ))}
        </div>

        <div className="customer-form__panel">
          {activeTab === 'basic' ? (
            <Section className="customer-basic-section">
              <div className="customer-basic-layout">
                <div className="customer-form__section-grid customer-basic-grid">
                  <InputField
                    id="customer-name"
                    name="name"
                    label="Customer Name *"
                    value={formData.name}
                    onChange={handleBasicChange}
                    onBlur={handleBlur}
                    error={shouldShowError('name') ? errors.name : ''}
                    className="customer-basic-field--identity"
                    placeholder="Enter registered customer name"
                    disabled={isBusy || isReadOnly}
                    required
                    maxLength={100}
                  />
                  <InputField
                    id="customer-code"
                    name="customerCode"
                    label="Customer Code"
                    value={formData.customerCode || 'CUST-000001'}
                    className="customer-basic-field--code"
                    placeholder="CUST-000001"
                    disabled={isBusy || isReadOnly}
                    readOnly
                  />
                  <label className="customer-form__status-field customer-basic-field--select customer-basic-field--type">
                    <span>Customer Type</span>
                    <select
                      name="customerType"
                      value={formData.customerType}
                      onChange={handleBasicChange}
                      onBlur={handleBlur}
                      disabled={isBusy || isReadOnly}
                      aria-invalid={Boolean(shouldShowError('customerType') && errors.customerType)}
                    >
                      <option value="Business">Business</option>
                      <option value="Individual">Individual</option>
                    </select>
                    {shouldShowError('customerType') && errors.customerType ? (
                      <span className="field-error">{errors.customerType}</span>
                    ) : null}
                  </label>
                  <InputField
                    id="customer-company"
                    name="company"
                    label="Company Name"
                    value={formData.company}
                    onChange={handleBasicChange}
                    onBlur={handleBlur}
                    error={shouldShowError('company') ? errors.company : ''}
                    placeholder="Legal entity name"
                    disabled={isBusy || isReadOnly}
                    maxLength={50}
                  />
                  <InputField
                    id="customer-gst"
                    name="gstNumber"
                    label="GST Number"
                    value={formData.gstNumber}
                    onChange={handleBasicChange}
                    onBlur={handleBlur}
                    error={shouldShowError('gstNumber') ? errors.gstNumber : ''}
                    placeholder="Enter GSTIN"
                    disabled={isBusy || isReadOnly}
                    maxLength={15}
                  />
                  <InputField
                    id="customer-pan"
                    name="panNumber"
                    label="PAN Number"
                    value={formData.panNumber}
                    onChange={handleBasicChange}
                    onBlur={handleBlur}
                    error={shouldShowError('panNumber') ? errors.panNumber : ''}
                    placeholder="ABCDE1234F"
                    disabled={isBusy || isReadOnly}
                    maxLength={10}
                  />
                  <InputField
                    id="customer-phone"
                    name="phone"
                    label="Phone *"
                    {...phoneInputProps}
                    value={formData.phone}
                    onChange={handleBasicChange}
                    onBlur={handleBlur}
                    error={shouldShowError('phone') ? errors.phone : ''}
                    placeholder="9876543210"
                    disabled={isBusy || isReadOnly}
                    required
                  />
                  <InputField
                    id="customer-email"
                    name="email"
                    label="Email"
                    {...emailInputProps}
                    value={formData.email}
                    onChange={handleBasicChange}
                    onBlur={handleBlur}
                    error={shouldShowError('email') ? errors.email : ''}
                    placeholder="customer@company.com"
                    disabled={isBusy || isReadOnly}
                  />
                  <label className="customer-form__status-field customer-basic-field--select customer-basic-field--status">
                    <span>Status</span>
                    <select
                      name="status"
                      value={formData.status}
                      onChange={handleBasicChange}
                      onBlur={handleBlur}
                      disabled={isBusy || isReadOnly}
                      aria-invalid={Boolean(shouldShowError('status') && errors.status)}
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                    {shouldShowError('status') && errors.status ? (
                      <span className="field-error">{errors.status}</span>
                    ) : null}
                  </label>
                </div>
              </div>
            </Section>
          ) : null}
          {activeTab === 'contacts' ? (
            <SupplierContactsTab
              contacts={supplierContacts}
              errors={contactErrors.map((error) => ({
                ...error,
                name: error.contactName,
                department: error.role,
              }))}
              showErrors={submitAttempted || touched.collections}
              onChange={handleSupplierContactChange}
              onAdd={addInlineContact}
              onRemove={(index) => removeRecord('contacts', index)}
              departmentOptions={departmentOptions}
              getDesignationOptions={(role) => mergeMasterOptions(getDesignationOptionsForDepartment(role), uniqueCleanValues(formData.contacts.map((contact) => contact.designation)))}
              onCreateMasterOption={() => { }}
              readOnly={isReadOnly}
            />
          ) : null}
          {activeTab === '__legacyContacts' ? (
            <Section className="customer-contacts-section">
              <div className="customer-contact-section-header">
                <div>
                  <h3>Contact Persons</h3>
                  <p>Manage sales, billing, support and escalation contacts.</p>
                </div>
                {!isReadOnly ? (
                  <button type="button" className="button button-secondary customer-contact-add-button" onClick={addInlineContact}>
                    <Plus size={15} />
                    Add Contact
                  </button>
                ) : null}
              </div>

              {formData.contacts.length > 0 ? (
                <div className="customer-contact-card-grid">
                  {formData.contacts.map((contact, index) => {
                    const contactTitle = `Contact ${index + 1}`
                    const contactError = contactErrors[index] || {}
                    return (
                      <article className="customer-contact-person-card" key={contact.id ?? index}>
                        <div className="customer-contact-person-card__header">
                          <div>
                            <strong>{contactTitle}</strong>
                          </div>
                          <div className="customer-contact-person-card__actions">
                            {contact.isPrimary ? (
                              <span className="customer-contact-primary-badge">Primary</span>
                            ) : !isReadOnly ? (
                              <button
                                type="button"
                                className="customer-contact-primary-action"
                                onClick={() => markPrimaryContact(index)}
                              >
                                Set primary
                              </button>
                            ) : null}
                            {!isReadOnly ? (
                              <button
                                type="button"
                                className="button button-danger button-icon customer-contact-delete-button"
                                onClick={() => removeRecord('contacts', index)}
                                aria-label={`Remove contact ${index + 1}`}
                              >
                                <Trash2 size={14} />
                              </button>
                            ) : null}
                          </div>
                        </div>
                        <div className="customer-contact-card-form">
                          <InputField id={`customer-contact-name-${index}`} name="contactName" label="Contact Name *" icon={User} value={contact.contactName} onChange={(event) => updateInlineContact(index, event)} onBlur={(event) => blurInlineContact(index, event)} error={(submitAttempted || touched.collections) ? contactError.contactName : ''} placeholder="Enter contact name" disabled={isReadOnly} />
                          <label className="customer-form__status-field customer-contact-select-field">
                            <span>Role *</span>
                            <select name="role" value={contact.role || 'Sales'} onChange={(event) => updateInlineContact(index, event)} onBlur={(event) => blurInlineContact(index, event)} aria-invalid={Boolean((submitAttempted || touched.collections) && contactError.role)} disabled={isReadOnly}>
                              {contactRoles.map((role) => <option value={role} key={role}>{role}</option>)}
                            </select>
                            {(submitAttempted || touched.collections) && contactError.role ? <span className="field-error">{contactError.role}</span> : null}
                          </label>
                          <InputField id={`customer-contact-designation-${index}`} name="designation" label="Designation" icon={Building2} value={contact.designation} onChange={(event) => updateInlineContact(index, event)} onBlur={(event) => blurInlineContact(index, event)} error={(submitAttempted || touched.collections) ? contactError.designation : ''} placeholder="Enter designation" disabled={isReadOnly} />
                          <InputField id={`customer-contact-phone-${index}`} name="phone" label="Phone *" icon={Phone} {...phoneInputProps} value={contact.phone} onChange={(event) => updateInlineContact(index, event)} onBlur={(event) => blurInlineContact(index, event)} error={(submitAttempted || touched.collections) ? contactError.phone : ''} placeholder="Enter phone number" disabled={isReadOnly} />
                          <InputField id={`customer-contact-email-${index}`} name="email" label="Email *" icon={Mail} {...emailInputProps} value={contact.email} onChange={(event) => updateInlineContact(index, event)} onBlur={(event) => blurInlineContact(index, event)} error={(submitAttempted || touched.collections) ? contactError.email : ''} placeholder="Enter email address" disabled={isReadOnly} />
                        </div>
                      </article>
                    )
                  })}
                </div>
              ) : isReadOnly ? (
                <EmptyPanel title="No contacts added" description="Add contact persons for sales, billing, and follow-up ownership." />
              ) : null}
            </Section>
          ) : null}
          {activeTab === 'addresses' ? (
            <SupplierAddressTab
              addresses={supplierAddresses}
              errors={addressErrors.map((error) => ({
                ...error,
                type: error.addressType,
                addressLine1: error.addressLine,
              }))}
              warnings={addressWarnings}
              showErrors={submitAttempted || touched.collections}
              validationRunId={submitAttempted ? 1 : 0}
              onChange={handleSupplierAddressChange}
              onAdd={addInlineAddress}
              onRemove={(index) => removeRecord('addresses', index)}
              readOnly={isReadOnly}
            />
          ) : null}
          {activeTab === '__legacyAddresses' ? (
            <Section className="customer-addresses-section">
              <div className="customer-address-section-header">
                <div>
                  <h3>Addresses</h3>
                  <p>Manage billing and shipping destinations.</p>
                </div>
                {!isReadOnly ? (
                  <button type="button" className="button button-secondary customer-address-add-button" onClick={addInlineAddress}>
                    <Plus size={15} />
                    Add Address
                  </button>
                ) : null}
              </div>
              <div className="customer-address-card-grid">
                {formData.addresses.map((address, index) => {
                  const addressError = addressErrors[index] || {}
                  return (
                    <article className="customer-address-person-card" key={address.id ?? `address-${index}`}>
                      <div className="customer-address-person-card__header">
                        <div>
                          <strong>{`Address ${index + 1}`}</strong>
                        </div>
                        <div className="customer-address-person-card__actions">
                          {address.isPrimary ? (
                            <span className="customer-address-primary-badge">Primary</span>
                          ) : !isReadOnly ? (
                            <button type="button" className="customer-address-primary-action" onClick={() => markPrimaryAddress(index)}>
                              Set primary
                            </button>
                          ) : null}
                          {!isReadOnly ? (
                            <button
                              type="button"
                              className="button button-danger button-icon customer-address-delete-button"
                              onClick={() => removeRecord('addresses', index)}
                              aria-label={`Remove address ${index + 1}`}
                            >
                              <Trash2 size={14} />
                            </button>
                          ) : null}
                        </div>
                      </div>
                      <div className="customer-address-card-form">
                        <label className="customer-form__status-field customer-address-select-field">
                          <span>Address Type *</span>
                          <select name="addressType" value={address.addressType || 'Billing'} onChange={(event) => updateInlineAddress(index, event)} onBlur={(event) => blurInlineAddress(index, event)} aria-invalid={Boolean((submitAttempted || touched.collections) && addressError.addressType)} disabled={isReadOnly}>
                            <option value="Billing">Billing</option>
                            <option value="Shipping">Shipping</option>
                            <option value="Office">Office</option>
                            <option value="Warehouse">Warehouse</option>
                            <option value="Other">Other</option>
                          </select>
                          {(submitAttempted || touched.collections) && addressError.addressType ? <span className="field-error">{addressError.addressType}</span> : null}
                        </label>
                        <InputField id={`customer-address-line1-${index}`} name="addressLine" label="Address Line 1 *" icon={MapPin} value={address.addressLine} onChange={(event) => updateInlineAddress(index, event)} onBlur={(event) => blurInlineAddress(index, event)} error={(submitAttempted || touched.collections) ? addressError.addressLine : ''} placeholder="Street address, building, locality" disabled={isReadOnly} />
                        <InputField id={`customer-address-line2-${index}`} name="addressLine2" label="Address Line 2" icon={MapPin} value={address.addressLine2} onChange={(event) => updateInlineAddress(index, event)} onBlur={(event) => blurInlineAddress(index, event)} error="" placeholder="Apartment, suite, landmark" disabled={isReadOnly} />
                        <InputField id={`customer-address-city-${index}`} name="city" label="City *" icon={MapPin} value={address.city} onChange={(event) => updateInlineAddress(index, event)} onBlur={(event) => blurInlineAddress(index, event)} error={(submitAttempted || touched.collections) ? addressError.city : ''} placeholder="Enter city" disabled={isReadOnly} />
                        <InputField id={`customer-address-state-${index}`} name="state" label="State *" icon={MapPin} value={address.state} onChange={(event) => updateInlineAddress(index, event)} onBlur={(event) => blurInlineAddress(index, event)} error={(submitAttempted || touched.collections) ? addressError.state : ''} placeholder="Enter state" disabled={isReadOnly} />
                        <InputField id={`customer-address-country-${index}`} name="country" label="Country *" icon={MapPin} value={address.country} onChange={(event) => updateInlineAddress(index, event)} onBlur={(event) => blurInlineAddress(index, event)} error={(submitAttempted || touched.collections) ? addressError.country : ''} placeholder="Enter country" disabled={isReadOnly} />
                        <InputField id={`customer-address-pincode-${index}`} name="pincode" label="Pincode *" icon={Hash} value={address.pincode} onChange={(event) => updateInlineAddress(index, event)} onBlur={(event) => blurInlineAddress(index, event)} error={(submitAttempted || touched.collections || (address.pincode && String(address.pincode).trim().length >= 6)) ? addressError.pincode : ''} placeholder="560001" inputMode="numeric" maxLength={6} disabled={isReadOnly} />
                      </div>
                    </article>
                  )
                })}
              </div>
            </Section>
          ) : null}

          {activeTab === 'paymentTerms' ? (
            <SupplierPaymentTermsTab
              terms={supplierPaymentTerms}
              errors={{
                creditDays: paymentErrors.creditDays,
                creditLimit: paymentErrors.creditLimit,
                preferredPaymentMethod: paymentErrors.paymentMode,
                currency: '',
                taxType: '',
                notes: '',
              }}
              showErrors={submitAttempted || touched.paymentTerms}
              touched={touched}
              onChange={handleSupplierPaymentChange}
              onBlur={() => setTouched((prev) => ({ ...prev, paymentTerms: true }))}
              readOnly={isReadOnly}
            />
          ) : null}

          {activeTab === '__legacyPaymentTerms' ? (
            <Section className="customer-payment-section" title="Payment Terms" subtitle="Define receivable controls, credit exposure, and collection behavior.">
              <div className="customer-payment-panel">
                <div className="customer-form__section-grid customer-payment-grid">
                  <InputField
                    id="customer-credit-days"
                    name="creditDays"
                    label="Credit Days"
                    icon={CreditCard}
                    value={formData.paymentTerms.creditDays}
                    onChange={handlePaymentChange}
                    helperText="0 to 365 days."
                    error={submitAttempted ? paymentErrors.creditDays : ''}
                    disabled={isBusy || isReadOnly}
                    placeholder="Enter credit days"
                    inputMode="numeric"
                    maxLength={3}
                    className="customer-payment-field customer-payment-field--numeric"
                  />
                  <CurrencyInput
                    id="customer-credit-limit"
                    name="creditLimit"
                    label="Credit Limit"
                    icon={CreditCard}
                    value={formData.paymentTerms.creditLimit}
                    onChange={handlePaymentChange}
                    error={submitAttempted ? paymentErrors.creditLimit : ''}
                    currency="INR"
                    disabled={isBusy || isReadOnly}
                    placeholder="Enter credit limit"
                    maxIntegerDigits={10}
                    helperText="Up to 999,999,999.99"
                    className="customer-payment-field customer-payment-field--numeric"
                  />
                  <SearchableSelect
                    id="customer-payment-mode"
                    name="paymentMode"
                    label="Preferred Payment Method"
                    icon={CreditCard}
                    value={formData.paymentTerms.paymentMode}
                    onChange={handlePaymentChange}
                    options={paymentMethodOptions}
                    placeholder="Select payment method"
                    searchPlaceholder="Search payment method"
                    error={paymentErrors.paymentMode}
                    showError={submitAttempted}
                    className="customer-payment-field customer-payment-select"
                    disabled={isBusy || isReadOnly}
                  />
                </div>
                <div className="field--full customer-notes-field customer-payment-notes">
                  <InputField
                    id="customer-payment-notes"
                    name="notes"
                    label="Notes"
                    icon={FileText}
                    value={formData.paymentTerms.notes}
                    onChange={handlePaymentChange}
                    disabled={isBusy || isReadOnly}
                    placeholder="Add approval instructions, settlement notes, or internal finance comments"
                    textarea
                    rows={2}
                    maxLength={1000}
                  />
                  <span className="customer-character-count">{String(formData.paymentTerms.notes ?? '').length}/1000</span>
                </div>
              </div>
            </Section>
          ) : null}

          {activeTab === 'banking' ? (
            <SupplierBankAccountsTab
              bankAccounts={supplierBankAccounts}
              errors={bankErrors}
              showErrors={submitAttempted || touched.collections}
              onChange={updateInlineBankDetail}
              onAdd={addInlineBankDetail}
              onRemove={(index) => removeRecord('bankDetails', index)}
              onIfscLookup={handleIfscLookup}
              readOnly={isReadOnly}
            />
          ) : null}

          {activeTab === '__legacyBanking' ? (
            <Section className="customer-banking-section">
              <div className="customer-bank-section-header">
                <div>
                  <h3>Banking</h3>
                  <p>Manage customer bank accounts for payments and settlements.</p>
                </div>
                {!isReadOnly ? (
                  <button type="button" className="button button-secondary customer-bank-add-button" onClick={addInlineBankDetail}>
                    <Plus size={15} />
                    Add Bank Account
                  </button>
                ) : null}
              </div>
              <div className="customer-bank-card-grid">
                {formData.bankDetails.map((bank, index) => {
                  const bankError = bankErrors[index] || {}
                  return (
                    <article className="customer-bank-person-card" key={bank.id ?? `bank-${index}`}>
                      <div className="customer-bank-person-card__header">
                        <div>
                          <strong>{`Bank Account ${index + 1}`}</strong>
                        </div>
                        <div className="customer-bank-person-card__actions">
                          {bank.isPrimary ? (
                            <span className="customer-bank-primary-badge">Primary</span>
                          ) : !isReadOnly ? (
                            <button type="button" className="customer-bank-primary-action" onClick={() => markPrimaryBankDetail(index)}>
                              Set primary
                            </button>
                          ) : null}
                          {!isReadOnly ? (
                            <button
                              type="button"
                              className="button button-danger button-icon customer-bank-delete-button"
                              onClick={() => removeRecord('bankDetails', index)}
                              aria-label={`Remove bank account ${index + 1}`}
                            >
                              <Trash2 size={14} />
                            </button>
                          ) : null}
                        </div>
                      </div>
                      <div className="customer-bank-card-form">
                        <InputField id={`customer-bank-name-${index}`} name="bankName" label="Bank Name *" icon={Landmark} value={bank.bankName} onChange={(event) => updateInlineBankDetail(index, event)} onBlur={(event) => blurInlineBankDetail(index, event)} error={(submitAttempted || touched.collections) ? bankError.bankName : ''} placeholder="Enter bank name" disabled={isReadOnly} />
                        <InputField id={`customer-bank-account-name-${index}`} name="accountName" label="Account Holder Name *" icon={User} value={bank.accountName} onChange={(event) => updateInlineBankDetail(index, event)} onBlur={(event) => blurInlineBankDetail(index, event)} error={(submitAttempted || touched.collections) ? bankError.accountName : ''} placeholder="Enter account holder name" disabled={isReadOnly} />
                        <InputField id={`customer-bank-account-number-${index}`} name="accountNumber" label="Account Number *" icon={Hash} value={bank.accountNumber} onChange={(event) => updateInlineBankDetail(index, event)} onBlur={(event) => blurInlineBankDetail(index, event)} error={(submitAttempted || touched.collections) ? bankError.accountNumber : ''} placeholder="Enter account number" inputMode="numeric" maxLength={18} disabled={isReadOnly} />
                        <InputField id={`customer-bank-ifsc-${index}`} name="ifscCode" label="IFSC Code *" icon={Hash} value={bank.ifscCode} onChange={(event) => updateInlineBankDetail(index, event)} onBlur={(event) => blurInlineBankDetail(index, event)} error={(submitAttempted || touched.collections) ? bankError.ifscCode : ''} placeholder="SBIN0001234" maxLength={11} disabled={isReadOnly} />
                        <InputField id={`customer-bank-branch-${index}`} name="branch" label="Branch Name *" icon={MapPin} value={bank.branch} onChange={(event) => updateInlineBankDetail(index, event)} onBlur={(event) => blurInlineBankDetail(index, event)} error={(submitAttempted || touched.collections) ? bankError.branch : ''} placeholder="Enter branch name" disabled={isReadOnly} />
                      </div>
                    </article>
                  )
                })}
              </div>
            </Section>
          ) : null}

          {activeTab === 'activity' ? (
            <Section title="Activity" subtitle="Timeline of customer profile, billing, and payment events.">
              {visibleActivity.length > 0 ? (
                <ol className="customer-enterprise-timeline">
                  {visibleActivity.map((item, index) => (
                    <li key={item.id || item.activityId || index}>
                      <span className="customer-enterprise-timeline__marker" aria-hidden="true" />
                      <div>
                        <strong>{normalizeActivityType(item)}</strong>
                        <p>{item.description || item.message || 'Customer activity recorded.'}</p>
                        {item.date || item.createdAt ? <time>{formatDateTime(item.date || item.createdAt)}</time> : null}
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <EmptyPanel title="No activity yet" description="Customer updates, invoices, and payments will appear here." />
              )}
            </Section>
          ) : null}
        </div>

        <div className="customer-form__actions">
          {!isReadOnly && submitAttempted && !isValid ? (
            <p className="customer-form__hint customer-form__hint--error">
              Review highlighted fields before saving.
            </p>
          ) : (
            <span aria-hidden="true" />
          )}
          <div className="customer-form__action-buttons">
            <button type="button" className="button button-cancel" onClick={onCancel} disabled={isSubmitting}>
              <X size={16} />
              {isReadOnly ? 'Close' : 'Cancel'}
            </button>
            {!isReadOnly ? (
              <>
                <button type="button" className="button button-secondary" onClick={handleReset} disabled={isBusy || !isDirty}>
                  <Eraser size={16} />
                  Reset
                </button>
                <button type="submit" className="button button-primary" disabled={disableSubmit} title={!isValid ? 'Review highlighted customer fields before saving.' : undefined}>
                  {isSubmitting ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} />}
                  {isSubmitting ? 'Saving...' : 'Save Customer'}
                </button>
              </>
            ) : null}
          </div>
        </div>
      </div>

    </form>
  )
}
