import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Download,
  FileText,
  LoaderCircle,
  Mail,
  Plus,
  Printer,
  RefreshCw,
  ShoppingCart,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  deletePurchaseIndent,
  getPurchaseIndents,
  getPurchaseIndent,
  approvePurchaseIndent,
  rejectPurchaseIndent,
  convertPurchaseOrder,
  getPurchaseIndentDashboard,
} from '../../../api/purchaseIndentsApi'
import { getInvoiceCompanyProfile } from '../../../api/businessApi'
import { apiRequest, IMS_DATA_MUTATION_EVENT } from '../../../api/apiClient'
import { getSuppliers } from '../../../api/suppliersApi'
import { getProducts } from '../../../api/productApi'
import { showToast } from '../../../components/common/toast'
import FormModal from '../../../layouts/FormModal'
import { useAuth } from '../../../hooks/useAuth'
import { formatDate, formatIndentNumber, getLogicalRequiredDate } from '../../../utils/helpers'
import { getLocalTodayDate } from '../../../utils/dateUtils'
import {
  emailInputProps,
  getEmailError,
  sanitizeEmailInput,
} from '../../../validators/emailValidator'
import PurchaseIndentsTable from './components/PurchaseIndentsTable'
import PurchaseIndentDocument from './PurchaseIndentDocument'
import {
  buildPurchaseIndentDocumentModel,
  formatPurchaseIndentCurrency,
  getPurchaseIndentPdfFilename,
  validatePurchaseIndentDocumentModel,
} from './purchaseIndentDocumentModel'
import './PurchaseIndents.css'

const NOT_AVAILABLE = 'Not Available'
const NOT_ASSIGNED = 'Not Assigned'
const PENDING_APPROVAL = 'Pending Approval'
const NOT_CONVERTED = 'Not Converted'
const NOT_UPDATED = 'Not Updated'
const NOT_REJECTED = 'Not Rejected'
const EMPTY_VALUE = NOT_AVAILABLE
const DEFAULT_STATUS = 'Pending'
const DEFAULT_PRIORITY = 'Medium'
const LIST_PAGE_SIZE = 1000
const ROLE_SEED_USER_NAMES = new Set(['Admin', 'Manager', 'Staff'])
const DEPARTMENT_OPTIONS = [
  { id: 1, name: 'Production' },
  { id: 2, name: 'Inventory' },
  { id: 3, name: 'Sales' },
  { id: 4, name: 'Purchase' },
  { id: 5, name: 'Finance' },
  { id: 6, name: 'Admin' },
]
let cachedPurchaseIndentUsers = null
let pendingPurchaseIndentUsersRequest = null

function getIndentId(indent) {
  return indent?.purchaseIndentId || indent?.indentId || indent?.id
}

function getIndentNumber(indent) {
  return formatIndentNumber(indent)
}

function getResponseListData(data) {
  if (Array.isArray(data)) {
    return data
  }

  if (Array.isArray(data?.data)) {
    return data.data
  }

  if (Array.isArray(data?.items)) {
    return data.items
  }

  if (Array.isArray(data?.results)) {
    return data.results
  }

  if (Array.isArray(data?.users)) {
    return data.users
  }

  if (Array.isArray(data?.suppliers)) {
    return data.suppliers
  }

  if (Array.isArray(data?.indents)) {
    return data.indents
  }

  if (Array.isArray(data?.purchaseIndents)) {
    return data.purchaseIndents
  }

  if (Array.isArray(data?.data?.items)) {
    return data.data.items
  }

  if (Array.isArray(data?.data?.purchaseIndents)) {
    return data.data.purchaseIndents
  }

  return []
}

function isLikelyId(value) {
  const text = String(value ?? '').trim()
  return /^\d+$/.test(text) || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text)
}

function getFirstValue(source, keys) {
  for (const key of keys) {
    const value = source?.[key]
    if (value !== undefined && value !== null && value !== '') {
      return value
    }
  }

  return ''
}

function getUserId(user) {
  return user?.id ?? user?.Id ?? user?.userId ?? user?.UserId ?? user?.userID ?? user?.employeeId ?? user?.EmployeeId
}

function getUserName(user) {
  return (
    user?.fullName ||
    user?.FullName ||
    user?.displayName ||
    user?.DisplayName ||
    user?.name ||
    user?.Name ||
    user?.userName ||
    user?.UserName ||
    user?.email ||
    user?.Email ||
    ''
  )
}

function getUserDisplayName(user) {
  const name = getUserName(user)

  if (!name) {
    return ''
  }

  return name
}

function isRoleSeedUser(user) {
  const name = String(user?.name || user?.Name || user?.fullName || user?.FullName || '').trim()
  const email = String(user?.email || user?.Email || '').trim().toLowerCase()
  const role = String(user?.role || user?.Role || '').trim()

  return ROLE_SEED_USER_NAMES.has(name) && ROLE_SEED_USER_NAMES.has(role) && email.endsWith('@test.com')
}

function normalizeUserList(data) {
  return getResponseListData(data).filter((user) => user && getUserId(user) && !isRoleSeedUser(user))
}

async function loadPurchaseIndentUsers() {
  if (cachedPurchaseIndentUsers) {
    return cachedPurchaseIndentUsers
  }

  if (!pendingPurchaseIndentUsersRequest) {
    pendingPurchaseIndentUsersRequest = apiRequest('/Users')
      .then((response) => {
        const users = response.success ? normalizeUserList(response.data) : []
        cachedPurchaseIndentUsers = users
        return users
      })
      .finally(() => {
        pendingPurchaseIndentUsersRequest = null
      })
  }

  return pendingPurchaseIndentUsersRequest
}

function getDashboardData(data) {
  return data?.data || data || null
}

function getLineItems(indent) {
  return Array.isArray(indent?.items) && indent.items.length > 0
    ? indent.items
    : []
}

function getItemQuantity(item) {
  return Number(item?.requiredQty ?? item?.quantity ?? 0)
}

function getIndentQuantity(indent) {
  const items = getLineItems(indent)

  if (items.length > 0) {
    return items.reduce((sum, item) => sum + getItemQuantity(item), 0)
  }

  return Number(indent?.totalQuantity ?? indent?.requiredQty ?? indent?.quantity ?? 0)
}

function getItemProductName(item, fallback = NOT_AVAILABLE) {
  return item?.productName || item?.name || fallback
}

function getIndentProductSummary(indent) {
  const items = getLineItems(indent)
  if (items.length > 0) {
    const firstProductName = getItemProductName(items[0])
    return items.length === 1
      ? firstProductName
      : `${firstProductName} (+${items.length - 1} more)`
  }
  return indent?.productName || indent?.product || NOT_AVAILABLE
}

function normalizeIndent(indent) {
  const id = getIndentId(indent)
  const items = Array.isArray(indent?.items) ? indent.items : []
  const productSummary = getIndentProductSummary(indent)
  const qty = getIndentQuantity(indent)

  return {
    ...indent,
    purchaseIndentId: id,
    indentNumber: indent?.indentNumber || indent?.indentNo || (id ? `PI-${id}` : EMPTY_VALUE),
    status: indent?.status || DEFAULT_STATUS,
    priority: indent?.priority || DEFAULT_PRIORITY,
    items,
    productName: productSummary,
    product: productSummary,
    quantity: qty,
    totalQuantity: qty,
  }
}

function normalizeIndentList(data) {
  return getResponseListData(data)
    .map(normalizeIndent)
    .filter((indent) => indent.purchaseIndentId)
}

function getSupplierId(supplier) {
  return supplier?.supplierId ?? supplier?.SupplierId ?? supplier?.id ?? supplier?.Id ?? supplier?.vendorId ?? supplier?.VendorId
}

function getSupplierName(supplier) {
  return (
    supplier?.supplierName ||
    supplier?.SupplierName ||
    supplier?.name ||
    supplier?.Name ||
    supplier?.companyName ||
    supplier?.CompanyName ||
    supplier?.company ||
    supplier?.Company ||
    ''
  )
}

function makeUserMap(users) {
  const map = new Map()
  const safeUsers = Array.isArray(users) ? users : []

  safeUsers.forEach((user) => {
    if (!user) return
    const userId = getUserId(user)
    const userName = getUserDisplayName(user)

    if (userId && userName) {
      map.set(String(userId), userName)
    }
  })

  return map
}

function makeSupplierMap(suppliers) {
  const map = new Map()
  const safeSuppliers = Array.isArray(suppliers) ? suppliers : []

  safeSuppliers.forEach((supplier) => {
    if (!supplier) return
    const supplierId = getSupplierId(supplier)
    const supplierName = getSupplierName(supplier)

    if (supplierId && supplierName) {
      map.set(String(supplierId), supplierName)
    }
  })

  return map
}

function getObjectId(value, getId) {
  return value && typeof value === 'object' ? getId(value) : ''
}

function getObjectName(value, getName) {
  return value && typeof value === 'object' ? getName(value) : ''
}

function getReadablePersonName(record, nameKeys, idKeys, userMap, fallback = NOT_ASSIGNED) {
  const nameValue = getFirstValue(record, nameKeys)
  const objectName = getObjectName(nameValue, getUserDisplayName)

  if (objectName) {
    return objectName
  }

  if (nameValue && typeof nameValue !== 'object' && !isLikelyId(nameValue)) {
    return String(nameValue)
  }

  const idValue = getFirstValue(record, idKeys)
  const lookupId = getObjectId(idValue, getUserId) || idValue || getObjectId(nameValue, getUserId) || nameValue

  if (lookupId && userMap.has(String(lookupId))) {
    return userMap.get(String(lookupId))
  }

  return fallback
}

function getRequestedByName(indent, userMap) {
  return getReadablePersonName(
    indent,
    ['requestedByName', 'RequestedByName', 'requestByName', 'RequestByName', 'requesterName', 'RequesterName', 'createdByName', 'CreatedByName', 'createdBy', 'CreatedBy'],
    ['requestedById', 'RequestedById', 'requestedByUserId', 'RequestedByUserId', 'requestedBy', 'RequestedBy', 'requestBy', 'RequestBy', 'createdById', 'CreatedById', 'createdBy', 'CreatedBy'],
    userMap,
  )
}

function getApprovedByName(indent, userMap) {
  return getReadablePersonName(
    indent,
    ['approvedByName', 'ApprovedByName', 'approverName', 'ApproverName', 'approvedBy', 'ApprovedBy'],
    ['approvedById', 'ApprovedById', 'approvedByUserId', 'ApprovedByUserId', 'approvedBy', 'ApprovedBy'],
    userMap,
    PENDING_APPROVAL,
  )
}

function getRejectedByName(indent, userMap) {
  return getReadablePersonName(
    indent,
    ['rejectedByName', 'RejectedByName', 'rejecterName', 'RejecterName', 'rejectedBy', 'RejectedBy'],
    ['rejectedById', 'RejectedById', 'rejectedByUserId', 'RejectedByUserId', 'rejectedBy', 'RejectedBy'],
    userMap,
    NOT_REJECTED,
  )
}

function getCreatedByName(indent, userMap) {
  return getReadablePersonName(
    indent,
    ['createdByName', 'CreatedByName', 'creatorName', 'CreatorName', 'createdBy', 'CreatedBy'],
    ['createdById', 'CreatedById', 'createdByUserId', 'CreatedByUserId', 'createdBy', 'CreatedBy'],
    userMap,
  )
}

function getConvertedByName(indent, userMap) {
  return getReadablePersonName(
    indent,
    ['convertedByName', 'ConvertedByName', 'convertedBy', 'ConvertedBy'],
    ['convertedById', 'ConvertedById', 'convertedByUserId', 'ConvertedByUserId', 'convertedBy', 'ConvertedBy'],
    userMap,
    NOT_CONVERTED,
  )
}

function getUpdatedByName(indent, userMap) {
  const name = getReadablePersonName(
    indent,
    ['updatedByName', 'UpdatedByName', 'modifiedByName', 'ModifiedByName', 'updatedBy', 'UpdatedBy', 'modifiedBy', 'ModifiedBy'],
    ['updatedById', 'UpdatedById', 'modifiedById', 'ModifiedById', 'updatedBy', 'UpdatedBy', 'modifiedBy', 'ModifiedBy'],
    userMap,
    '',
  )

  if (name && name !== NOT_UPDATED) {
    return name
  }

  // If approved or rejected or updated date exists, fallback to approver/rejecter/creator
  const approvedPerson = getApprovedByName(indent, userMap)
  if (approvedPerson && approvedPerson !== PENDING_APPROVAL) {
    return approvedPerson
  }

  const rejectedPerson = getRejectedByName(indent, userMap)
  if (rejectedPerson && rejectedPerson !== NOT_REJECTED) {
    return rejectedPerson
  }

  const updatedDate = getFirstValue(indent, ['updatedAt', 'UpdatedAt', 'modifiedAt', 'ModifiedAt', 'updatedOn', 'UpdatedOn', 'modifiedOn', 'ModifiedOn'])
  if (updatedDate) {
    const createdPerson = getCreatedByName(indent, userMap)
    if (createdPerson) {
      return createdPerson
    }
  }

  return NOT_UPDATED
}

function getSupplierDisplayName(indent, supplierMap) {
  const nameValue = getFirstValue(indent, ['supplierName', 'SupplierName', 'vendorName', 'VendorName', 'supplier', 'Supplier', 'vendor', 'Vendor'])
  const objectName = getObjectName(nameValue, getSupplierName)

  if (objectName) {
    return objectName
  }

  if (nameValue && typeof nameValue !== 'object' && !isLikelyId(nameValue)) {
    return String(nameValue)
  }

  const supplierIdValue = getFirstValue(indent, ['supplierId', 'SupplierId', 'vendorId', 'VendorId', 'suggestedSupplierId', 'SuggestedSupplierId'])
  const supplierId = getObjectId(supplierIdValue, getSupplierId) || supplierIdValue || getObjectId(nameValue, getSupplierId) || nameValue

  if (supplierId && supplierMap.has(String(supplierId))) {
    return supplierMap.get(String(supplierId))
  }

  return NOT_ASSIGNED
}

function getSupplierRecord(indent, suppliers) {
  const supplierIdValue = getFirstValue(indent, [
    'supplierId',
    'SupplierId',
    'vendorId',
    'VendorId',
    'suggestedSupplierId',
    'SuggestedSupplierId',
  ])
  const embeddedSupplier = getFirstValue(indent, ['supplier', 'Supplier', 'vendor', 'Vendor'])
  const supplierId = (
    getObjectId(supplierIdValue, getSupplierId) ||
    supplierIdValue ||
    getObjectId(embeddedSupplier, getSupplierId)
  )

  if (!supplierId) {
    return embeddedSupplier && typeof embeddedSupplier === 'object' ? embeddedSupplier : null
  }

  return (Array.isArray(suppliers) ? suppliers : []).find(
    (supplier) => String(getSupplierId(supplier)) === String(supplierId),
  ) || (embeddedSupplier && typeof embeddedSupplier === 'object' ? embeddedSupplier : null)
}

function getDepartmentDisplayName(indent) {
  const nameValue = getFirstValue(indent, ['departmentName', 'DepartmentName', 'department', 'Department'])
  const objectName = getObjectName(nameValue, (department) => department?.name || department?.Name || department?.departmentName || department?.DepartmentName || '')

  if (objectName) {
    return objectName
  }

  if (nameValue && typeof nameValue !== 'object' && !isLikelyId(nameValue)) {
    return String(nameValue)
  }

  const departmentId = getFirstValue(indent, ['departmentId', 'DepartmentId']) || nameValue
  const department = DEPARTMENT_OPTIONS.find((item) => String(item.id) === String(departmentId))
  return department?.name || NOT_ASSIGNED
}

function withReadableIndentFields(indent, userMap, supplierMap) {
  const productSummary = indent?.productName || getIndentProductSummary(indent)
  const qty = indent?.quantity !== undefined ? indent.quantity : getIndentQuantity(indent)

  return {
    ...indent,
    productName: productSummary,
    product: productSummary,
    quantity: qty,
    totalQuantity: qty,
    requestedByDisplay: getRequestedByName(indent, userMap),
    approvedByDisplay: getApprovedByName(indent, userMap),
    rejectedByDisplay: getRejectedByName(indent, userMap),
    createdByDisplay: getCreatedByName(indent, userMap),
    convertedByDisplay: getConvertedByName(indent, userMap),
    updatedByDisplay: getUpdatedByName(indent, userMap),
    supplierDisplay: getSupplierDisplayName(indent, supplierMap),
    departmentDisplay: getDepartmentDisplayName(indent),
  }
}

function getIndentProductsText(indent) {
  const items = getLineItems(indent)

  if (items.length > 0) {
    return items.map((item) => getItemProductName(item)).join('; ')
  }

  return indent?.productName || NOT_AVAILABLE
}

function getStatusKind(status) {
  const normalized = String(status || DEFAULT_STATUS).toLowerCase()

  if (normalized.includes('converted') || normalized.includes('ordered')) {
    return 'converted'
  }

  if (normalized.includes('approved')) {
    return 'approved'
  }

  if (normalized.includes('rejected')) {
    return 'rejected'
  }

  return 'pending'
}

function canApproveIndent(indent) {
  return getStatusKind(indent?.status) === 'pending'
}

function canRejectIndent(indent) {
  return getStatusKind(indent?.status) === 'pending'
}

function canEditIndent(indent) {
  return getStatusKind(indent?.status) === 'pending'
}

function canDeleteIndent(indent) {
  return getStatusKind(indent?.status) === 'pending'
}

function canConvertIndent(indent) {
  return getStatusKind(indent?.status) === 'approved'
}

function getIndentConversionIssues(indent) {
  const issues = []
  const supplierId = getFirstValue(indent, ['supplierId', 'SupplierId', 'vendorId', 'VendorId', 'suggestedSupplierId', 'SuggestedSupplierId'])
  const items = getLineItems(indent)
  const conversionItems = items.length > 0 ? items : [indent]

  if (!supplierId) {
    issues.push('supplier')
  }

  if (!getFirstValue(indent, ['departmentId', 'DepartmentId', 'departmentName', 'DepartmentName', 'department', 'Department'])) {
    issues.push('department')
  }

  if (!getRequiredDate(indent)) {
    issues.push('required date')
  }

  if (items.length === 0 && !getFirstValue(indent, ['productId', 'ProductId'])) {
    issues.push('line items')
  }

  conversionItems.forEach((item, index) => {
    if (!getFirstValue(item, ['productId', 'ProductId'])) {
      issues.push(`product on line ${index + 1}`)
    }

    if (getItemQuantity(item) <= 0) {
      issues.push(`quantity on line ${index + 1}`)
    }
  })

  return issues
}

function getRequiredDate(indent) {
  const items = getLineItems(indent)
  const rawDate = indent?.requiredDate || indent?.expectedDeliveryDate || items[0]?.requiredDate
  const indentDate = indent?.indentDate || indent?.createdAt
  return getLogicalRequiredDate(rawDate, indentDate, 7)
}

function getCurrentUserName(user) {
  return getUserDisplayName(user) || NOT_AVAILABLE
}

function getSafeText(value, fallback = NOT_AVAILABLE) {
  if (value === undefined || value === null || value === '' || value === '-' || value === '0') {
    return fallback
  }

  return String(value)
}

function getSafeDate(value, fallback = NOT_AVAILABLE) {
  return value ? formatDate(value) : fallback
}

function buildPurchaseIndentEmailSubject(models) {
  if (models.length === 1) {
    return `Purchase Indent ${models[0].indentNumber} - ${models[0].status}`
  }

  return `Purchase Indents (${models.length}) - ${getLocalTodayDate()}`
}

function buildPurchaseIndentEmailBody(models, generatedBy) {
  return [
    'Dear Team,',
    '',
    models.length === 1
      ? 'Please find the Purchase Indent details below.'
      : 'Please find the selected Purchase Indent details below.',
    '',
    ...models.flatMap((model, modelIndex) => [
      `${modelIndex + 1}. Purchase Indent: ${model.indentNumber}`,
      `   Status: ${model.status}`,
      `   Priority: ${model.priority}`,
      `   Department: ${model.department || NOT_ASSIGNED}`,
      `   Supplier: ${model.supplier.companyName || model.supplier.name || NOT_ASSIGNED}`,
      `   Requested By: ${model.requestedBy || NOT_ASSIGNED}`,
      `   Request Date: ${model.indentDate ? getSafeDate(model.indentDate) : NOT_AVAILABLE}`,
      `   Required Date: ${model.requiredDate ? getSafeDate(model.requiredDate) : NOT_AVAILABLE}`,
      `   Total Quantity: ${model.summary.totalQuantity.toLocaleString('en-IN')}`,
      `   Estimated Value: ${model.summary.hasEstimatedValue ? formatPurchaseIndentCurrency(model.summary.estimatedValue) : NOT_AVAILABLE}`,
      `   Remarks: ${model.remarks || NOT_AVAILABLE}`,
      '   Items:',
      ...model.items.map((item) => (
        `   ${item.serialNumber}. ${item.productName || NOT_AVAILABLE} | Quantity: ${item.quantity.toLocaleString('en-IN')}${item.unit ? ` ${item.unit}` : ''}${item.requiredDate ? ` | Required: ${getSafeDate(item.requiredDate)}` : ''}`
      )),
      '',
    ]),
    'Regards,',
    generatedBy || 'IMS Inventory Management System',
  ].join('\n')
}

function readDashboardNumber(source, keys, fallback = 0) {
  if (!source) {
    return fallback
  }

  for (const key of keys) {
    const value = source[key]
    if (value !== undefined && value !== null && value !== '') {
      const numericValue = Number(value)
      return Number.isFinite(numericValue) ? numericValue : fallback
    }
  }

  return fallback
}

export default function PurchaseIndentsScreen({
  products = [],
  users = [],
}) {
  const navigate = useNavigate()
  const { hasPermission, user } = useAuth()
  const isMountedRef = useRef(false)
  const conversionInFlightRef = useRef(false)
  const supplierRequestRef = useRef(0)
  const [indents, setIndents] = useState([])
  const [dashboardData, setDashboardData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isViewing, setIsViewing] = useState(false)
  const [busyAction, setBusyAction] = useState(null)
  const [error, setError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [viewTarget, setViewTarget] = useState(null)
  const [viewDocumentModel, setViewDocumentModel] = useState(null)
  const [printDocumentModel, setPrintDocumentModel] = useState(null)
  const [mailDraft, setMailDraft] = useState(null)
  const [mailErrors, setMailErrors] = useState({})
  const [mailFeedback, setMailFeedback] = useState('')
  const [isSendingMail, setIsSendingMail] = useState(false)
  const [rejectTarget, setRejectTarget] = useState(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [selectedIndentIds, setSelectedIndentIds] = useState([])
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false)
  const [backendUsers, setBackendUsers] = useState(() => normalizeUserList(users))
  const [backendSuppliers, setBackendSuppliers] = useState([])
  const [isSupplierLoading, setIsSupplierLoading] = useState(true)
  const [supplierError, setSupplierError] = useState('')

  const canCreate = hasPermission('purchaseIndents', 'create')
  const canDelete = hasPermission('purchaseIndents', 'delete')

  const loadLiveSuppliers = useCallback(async ({ showErrorToast = false } = {}) => {
    const requestId = supplierRequestRef.current + 1
    supplierRequestRef.current = requestId
    setIsSupplierLoading(true)
    setSupplierError('')

    const response = await getSuppliers({
      page: 1,
      pageSize: 500,
      includeDeleted: false,
      includeArchived: false,
    })

    if (!isMountedRef.current || requestId !== supplierRequestRef.current) {
      return
    }

    if (!response.success) {
      const message = response.error || 'Unable to load suppliers from the backend.'
      setBackendSuppliers([])
      setSupplierError(message)

      if (showErrorToast) {
        showToast({ type: 'error', title: 'Purchase Indents', message })
      }
    } else {
      setBackendSuppliers(
        getResponseListData(response.data)
          .filter((supplier) => supplier && !supplier.isDeleted),
      )
    }

    setIsSupplierLoading(false)
  }, [])

  useEffect(() => {
    function handleSupplierMutation(event) {
      const endpoint = String(event.detail?.endpoint || '').toLowerCase()

      if (endpoint.includes('/suppliers')) {
        loadLiveSuppliers()
      }
    }

    window.addEventListener(IMS_DATA_MUTATION_EVENT, handleSupplierMutation)
    return () => window.removeEventListener(IMS_DATA_MUTATION_EVENT, handleSupplierMutation)
  }, [loadLiveSuppliers])

  useEffect(() => {
    let isActive = true
    const propUsers = normalizeUserList(users)

    if (propUsers.length > 0) {
      setBackendUsers(propUsers)
    }

    loadPurchaseIndentUsers()
      .then((loadedUsers) => {
        if (isActive && loadedUsers.length > 0) {
          setBackendUsers(loadedUsers)
        }
      })
      .catch(() => {
        if (isActive && propUsers.length > 0) {
          setBackendUsers(propUsers)
        }
      })

    return () => {
      isActive = false
    }
  }, [users])

  const userMap = useMemo(() => makeUserMap(backendUsers), [backendUsers])
  const supplierMap = useMemo(
    () => makeSupplierMap(backendSuppliers),
    [backendSuppliers],
  )
  const displayIndents = useMemo(
    () => indents.map((indent) => withReadableIndentFields(indent, userMap, supplierMap)),
    [indents, supplierMap, userMap],
  )

  const selectedIndents = useMemo(() => {
    const selectedIdSet = new Set(selectedIndentIds.map(String))

    return displayIndents.filter((indent) =>
      selectedIdSet.has(String(getIndentId(indent)))
    )
  }, [displayIndents, selectedIndentIds])

  useEffect(() => {
    const visibleIdSet = new Set(
      indents.map((indent) => String(getIndentId(indent)))
    )
    setSelectedIndentIds((currentValue) => currentValue.filter((id) => visibleIdSet.has(String(id))))
  }, [indents])

  useEffect(() => {
    setViewTarget((currentValue) => (
      currentValue
        ? withReadableIndentFields(currentValue, userMap, supplierMap)
        : currentValue
    ))
  }, [supplierMap, userMap])

  const loadIndents = useCallback(async ({ signal, showErrorToast = false } = {}) => {
    if (!signal?.aborted) {
      setIsLoading(true)
      setError('')
    }

    try {
      const response = await getPurchaseIndents(1, LIST_PAGE_SIZE, { signal })

      if (signal?.aborted || !isMountedRef.current) {
        return
      }

      if (!response.success) {
        const message = response.error || 'Unable to load Purchase Indents.'
        setError(message)
        setIndents([])

        if (showErrorToast) {
          showToast({
            type: 'error',
            title: 'Purchase Indents',
            message,
          })
        }
        return
      }

      setIndents(normalizeIndentList(response.data))
    } catch {
      if (signal?.aborted || !isMountedRef.current) {
        return
      }

      const message = 'Unable to load Purchase Indents.'
      setError(message)
      setIndents([])

      if (showErrorToast) {
        showToast({
          type: 'error',
          title: 'Purchase Indents',
          message,
        })
      }
    } finally {
      if (!signal?.aborted && isMountedRef.current) {
        setIsLoading(false)
      }
    }
  }, [])

  const loadDashboard = useCallback(async ({ signal, showErrorToast = false } = {}) => {
    const response = await getPurchaseIndentDashboard({ signal })

    if (signal?.aborted || !isMountedRef.current) {
      return
    }

    if (response.success) {
      setDashboardData(getDashboardData(response.data))
      return
    }

    if (showErrorToast) {
      showToast({
        type: 'error',
        title: 'Purchase Indents',
        message: response.error || 'Unable to load Purchase Indent dashboard.',
      })
    }
  }, [])

  const refreshIndents = useCallback(async (options = {}) => {
    await Promise.all([
      loadIndents(options),
      loadDashboard(options),
      loadLiveSuppliers(options),
    ])
  }, [loadDashboard, loadIndents, loadLiveSuppliers])

  const handleManualRefresh = useCallback(() => {
    refreshIndents({ showErrorToast: true })
  }, [refreshIndents])

  useEffect(() => {
    isMountedRef.current = true
    const controller = new AbortController()

    refreshIndents({ signal: controller.signal, showErrorToast: true })

    return () => {
      isMountedRef.current = false
      controller.abort()
    }
  }, [refreshIndents])

  const summary = useMemo(() => {
    const safeIndents = Array.isArray(indents) ? indents : []
    const totalQty = safeIndents.reduce(
  (sum, ind) => sum + getIndentQuantity(ind),
  0,
)
    const pending = safeIndents.filter((ind) => getStatusKind(ind?.status) === 'pending').length
    const approved = safeIndents.filter((ind) => getStatusKind(ind?.status) === 'approved').length
    const converted = safeIndents.filter((ind) => getStatusKind(ind?.status) === 'converted').length
    const rejected = safeIndents.filter((ind) => getStatusKind(ind?.status) === 'rejected').length

    return {
      total: readDashboardNumber(dashboardData, ['totalIndents', 'total', 'totalCount', 'count'], safeIndents.length),
      pending: readDashboardNumber(dashboardData, ['pendingIndents', 'pending', 'pendingCount'], pending),
      approved: readDashboardNumber(dashboardData, ['approvedIndents', 'approved', 'approvedCount'], approved),
      converted: readDashboardNumber(dashboardData, ['convertedIndents', 'converted', 'convertedCount'], converted),
      rejected: readDashboardNumber(dashboardData, ['rejectedIndents', 'rejected', 'rejectedCount'], rejected),
      totalQty: readDashboardNumber(dashboardData, ['totalQuantity', 'totalQty', 'itemsRequested', 'totalItemsRequested', 'totalRequestedQuantity'], totalQty),
    }
  }, [dashboardData, indents])
  async function preparePurchaseIndentDocument(indent) {
    const id = getIndentId(indent)

    if (!id) {
      throw new Error('Purchase Indent identifier is unavailable. The document was not generated.')
    }

    const [indentResponse, companyResponse, productsResponse] = await Promise.all([
      getPurchaseIndent(id),
      getInvoiceCompanyProfile(),
      getProducts({ pageSize: 500 }).catch(() => null),
    ])

    if (!indentResponse.success || !indentResponse.data) {
      throw new Error(indentResponse.error || 'Unable to load complete Purchase Indent data.')
    }

    const products = productsResponse?.success
      ? getResponseListData(productsResponse.data)
      : []

    const productMap = new Map(
      products
        .filter(Boolean)
        .map((p) => [String(p.id ?? p.productId ?? p.Id ?? p.ProductId), p])
    )

    const responseIndent = indentResponse.data?.data || indentResponse.data
    const rawItems = Array.isArray(responseIndent?.items) && responseIndent.items.length > 0
      ? responseIndent.items
      : Array.isArray(indent?.items)
        ? indent.items
        : []

    const enrichedItems = rawItems.filter(Boolean).map((item) => {
      const product = productMap.get(String(item.productId ?? item.ProductId))
      const rate = Number(
        item.unitPrice ??
        item.rate ??
        item.costPrice ??
        item.price ??
        product?.costPrice ??
        product?.cost ??
        product?.purchasePrice ??
        product?.price ??
        0
      )
      const qty = Number(item.requiredQty ?? item.quantity ?? 1)
      const amount = Number(
        item.amount ??
        (rate * qty)
      )

      return {
        ...item,
        unitPrice: rate,
        rate,
        costPrice: product?.costPrice ?? rate,
        amount,
      }
    })

    const fullIndent = withReadableIndentFields(
      normalizeIndent({
        ...indent,
        ...responseIndent,
        items: enrichedItems,
      }),
      userMap,
      supplierMap,
    )
    const model = buildPurchaseIndentDocumentModel(fullIndent, {
      companyProfile: companyResponse.success ? companyResponse.data : {},
      supplier: getSupplierRecord(fullIndent, backendSuppliers),
      generatedBy: getCurrentUserName(user),
      products,
      productMap,
    })
    const validationError = validatePurchaseIndentDocumentModel(model)

    if (validationError) {
      throw new Error(validationError)
    }

    return { fullIndent, model }
  }

  async function handleView(indent) {
    if (isViewing) {
      return
    }

    setViewTarget(indent)
    setViewDocumentModel(null)
    setIsViewing(true)
    setBusyAction({ id: getIndentId(indent), key: 'view' })

    try {
      const { fullIndent, model } = await preparePurchaseIndentDocument(indent)
      setViewTarget(fullIndent)
      setViewDocumentModel(model)
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Purchase Indents',
        message:
          error instanceof Error
            ? error.message
            : 'Unable to load Purchase Indent.',
      })
      setViewTarget(null)
      setViewDocumentModel(null)
    } finally {
      setIsViewing(false)
      setBusyAction(null)
    }
  }

  async function handleDownloadPdf(indent, preparedModel = null) {
    if (String(indent?.status || preparedModel?.status || '').toLowerCase().includes('pending')) {
      showToast({
        type: 'warning',
        title: 'Purchase Indents',
        message: 'PDF download is disabled until the indent is approved or rejected.',
      })
      return
    }

    const id = getIndentId(indent)
    setBusyAction({ id, key: 'pdf' })

    try {
      const model = preparedModel || (await preparePurchaseIndentDocument(indent)).model
      const { downloadProfessionalPurchaseIndentPdf } = await import('./purchaseIndentPdf')
      await downloadProfessionalPurchaseIndentPdf(model)
      showToast({
        type: 'success',
        title: 'Purchase Indents',
        message: 'Purchase Indent PDF downloaded.',
      })
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Purchase Indents',
        message: error instanceof Error ? error.message : 'Unable to generate Purchase Indent PDF.',
      })
    } finally {
      setBusyAction(null)
    }
  }

  async function handlePrintIndent(indent, preparedModel = null) {
    if (String(indent?.status || preparedModel?.status || '').toLowerCase().includes('pending')) {
      showToast({
        type: 'warning',
        title: 'Purchase Indents',
        message: 'Print is disabled until the indent is approved or rejected.',
      })
      return
    }

    const id = getIndentId(indent)
    setBusyAction({ id, key: 'print' })

    try {
      const model = preparedModel || (await preparePurchaseIndentDocument(indent)).model
      setPrintDocumentModel(model)

      await new Promise((resolve) => {
        window.requestAnimationFrame(() => window.requestAnimationFrame(resolve))
      })

      if (document.fonts?.ready) {
        await document.fonts.ready
      }

      const printImages = [...document.querySelectorAll('.purchase-indent-document.invoice-document--print-root img')]
      await Promise.all(printImages.map((image) => (
        image.complete
          ? Promise.resolve()
          : new Promise((resolve) => {
              const timeoutId = window.setTimeout(resolve, 1500)
              image.addEventListener('load', () => {
                window.clearTimeout(timeoutId)
                resolve()
              }, { once: true })
              image.addEventListener('error', () => {
                window.clearTimeout(timeoutId)
                resolve()
              }, { once: true })
            })
      )))

      document.body.classList.add('invoice-print-active')
      window.print()
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Purchase Indents',
        message: error instanceof Error ? error.message : 'Unable to prepare Purchase Indent for printing.',
      })
    } finally {
      document.body.classList.remove('invoice-print-active')
      setPrintDocumentModel(null)
      setBusyAction(null)
    }
  }

  async function handleOpenMailCopy(rows) {
    const safeRows = Array.isArray(rows) ? rows.filter(Boolean) : []

    if (safeRows.length === 0) {
      showToast({
        type: 'warning',
        title: 'Purchase Indents',
        message: 'Select at least one Purchase Indent to mail.',
      })
      return
    }

    const hasPending = safeRows.some((row) => String(row.status || '').toLowerCase().includes('pending'))
    if (hasPending) {
      showToast({
        type: 'warning',
        title: 'Purchase Indents',
        message: 'Email is disabled until the indent is approved or rejected.',
      })
      return
    }

    const singleIndentId = safeRows.length === 1 ? getIndentId(safeRows[0]) : ''
    if (singleIndentId) {
      setBusyAction({ id: singleIndentId, key: 'mail' })
    }

    try {
      const preparedDocuments = await Promise.all(
        safeRows.map((indent) => preparePurchaseIndentDocument(indent)),
      )
      const models = preparedDocuments.map(({ model }) => model)
      setMailDraft({
        models,
        recipient: models.length === 1 ? sanitizeEmailInput(models[0].supplier.email) : '',
        subject: buildPurchaseIndentEmailSubject(models),
        message: buildPurchaseIndentEmailBody(models, getCurrentUserName(user)),
      })
      setMailErrors({})
      setMailFeedback('')
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Purchase Indents',
        message: error instanceof Error ? error.message : 'Unable to prepare the Purchase Indent email.',
      })
    } finally {
      setBusyAction(null)
    }
  }

  function handleMailDraftChange(field, value) {
    setMailDraft((currentValue) => (
      currentValue
        ? {
            ...currentValue,
            [field]: field === 'recipient' ? sanitizeEmailInput(value) : value,
          }
        : currentValue
    ))
    setMailErrors((currentValue) => ({ ...currentValue, [field]: '' }))
    setMailFeedback('')
  }

  async function handleSendMailCopy() {
    if (!mailDraft || isSendingMail) {
      return
    }

    const validationErrors = {
      recipient: getEmailError(mailDraft.recipient, { required: true, label: 'Recipient' }),
      subject: mailDraft.subject.trim() ? '' : 'Subject is required.',
      message: mailDraft.message.trim() ? '' : 'Message is required.',
    }

    if (Object.values(validationErrors).some(Boolean)) {
      setMailErrors(validationErrors)
      setMailFeedback('Please correct the highlighted fields before sending.')
      return
    }

    setIsSendingMail(true)
    setMailFeedback('')

    try {
      const mailtoUrl = `mailto:${encodeURIComponent(mailDraft.recipient)}?subject=${encodeURIComponent(mailDraft.subject.trim())}&body=${encodeURIComponent(mailDraft.message.trim())}`
      window.location.href = mailtoUrl
      showToast({
        type: 'success',
        title: 'Purchase Indents',
        message: mailDraft.models.length === 1
          ? 'Email draft opened successfully.'
          : 'Email draft opened successfully for selected Purchase Indents.',
      })
      setMailDraft(null)
      setMailErrors({})
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to prepare the Purchase Indent email.'
      setMailFeedback(message)
      showToast({
        type: 'error',
        title: 'Purchase Indents',
        message,
      })
    } finally {
      setIsSendingMail(false)
    }
  }

  function handleEdit(indent) {
    if (!canEditIndent(indent)) {
      showToast({
        type: 'warning',
        title: 'Purchase Indents',
        message: 'Only pending Purchase Indents can be edited.',
      })
      return
    }

    const id = getIndentId(indent)

    if (!id) {
      showToast({
        type: 'error',
        title: 'Purchase Indents',
        message: 'Unable to open Purchase Indent for editing.',
      })
      return
    }

    navigate('/inventory/purchase-indents/create', {
      state: { editIndentId: id },
    })
  }



  async function handleApprove(indent) {
    if (isSaving) {
      return
    }

    if (!canApproveIndent(indent)) {
      showToast({
        type: 'warning',
        title: 'Purchase Indent',
        message: 'Only pending Purchase Indents can be approved.',
      })
      return
    }

    setIsSaving(true)
    setBusyAction({ id: getIndentId(indent), key: 'approve' })

    try {
      const id = getIndentId(indent)

      if (!id) {
        throw new Error('Unable to approve Purchase Indent.')
      }

      const result = await approvePurchaseIndent(id)

      if (!result.success) {
        throw new Error(result.error || 'Unable to approve Purchase Indent.')
      }

      await refreshIndents()

      showToast({
        type: 'success',
        title: 'Purchase Indent',
        message: 'Purchase Indent approved successfully.',
      })
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Purchase Indent',
        message:
          error instanceof Error
            ? error.message
            : 'Unable to approve Purchase Indent.',
      })
    } finally {
      setIsSaving(false)
      setBusyAction(null)
    }
  }

  async function confirmReject() {
    if (!rejectTarget) {
      return
    }

    const reason = rejectionReason.trim()

    if (!canRejectIndent(rejectTarget)) {
      showToast({
        type: 'warning',
        title: 'Purchase Indents',
        message: 'Only pending Purchase Indents can be rejected.',
      })
      setRejectTarget(null)
      setRejectionReason('')
      return
    }

    if (!reason) {
      showToast({
        type: 'error',
        title: 'Purchase Indents',
        message: 'Rejection reason is required.',
      })
      return
    }

    setIsSaving(true)

    try {
      const id = getIndentId(rejectTarget)

      if (!id) {
        throw new Error('Unable to reject Purchase Indent.')
      }

      setBusyAction({ id, key: 'reject' })

      const response = await rejectPurchaseIndent(id, {
        reason,
        rejectionReason: reason,
      })

      if (!response.success) {
        throw new Error(response.error || 'Unable to reject Purchase Indent.')
      }

      await refreshIndents()

      showToast({
        type: 'success',
        title: 'Purchase Indents',
        message: 'Purchase Indent rejected successfully.',
      })

      setRejectTarget(null)
      setRejectionReason('')
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Purchase Indents',
        message:
          error instanceof Error
            ? error.message
            : 'Unable to reject Purchase Indent.',
      })
    } finally {
      setIsSaving(false)
      setBusyAction(null)
    }
  }

  async function handleConvert(indent) {
    if (isSaving || conversionInFlightRef.current) {
      return
    }

    const id = getIndentId(indent)

    if (!id) {
      showToast({
        type: 'error',
        title: 'Purchase Indents',
        message: 'Unable to convert Purchase Indent.',
      })
      return
    }

    const statusKind = getStatusKind(indent?.status)
    if (statusKind === 'converted' || String(indent?.status || '').toLowerCase() === 'converted') {
      showToast({
        type: 'warning',
        title: 'Purchase Indents',
        message: 'A Purchase Order has already been created for this Purchase Indent.',
      })
      return
    }

    if (!canConvertIndent(indent)) {
      showToast({
        type: 'warning',
        title: 'Purchase Indents',
        message: 'Only approved Purchase Indents can be converted.',
      })
      return
    }

    conversionInFlightRef.current = true
    setIsSaving(true)
    setBusyAction({ id, key: 'convert-po' })

    try {
      let conversionSource = indent
      const detailsResponse = await getPurchaseIndent(id)

      if (detailsResponse.success && detailsResponse.data) {
        conversionSource = detailsResponse.data
      }

      const conversionIssues = getIndentConversionIssues(conversionSource)

      if (conversionIssues.length > 0) {
        throw new Error(
          `Cannot convert until ${conversionIssues.join(', ')} ${conversionIssues.length === 1 ? 'is' : 'are'} available.`,
        )
      }

      // The backend conversion endpoint must create exactly one Purchase Order,
      // generate its unique PO number, copy the indent data, and mark the indent converted.
      const response = await convertPurchaseOrder(id)

      if (!response.success) {
        throw new Error(response.error || 'Unable to convert Purchase Indent.')
      }

      await refreshIndents()

      showToast({
        type: 'success',
        title: 'Purchase Indents',
        message: (() => {
          const converted = response?.data?.data || response?.data || {}
          const poNumber = converted?.poNumber || converted?.purchaseOrderNumber || converted?.orderNumber
          return poNumber
            ? `Purchase Indent converted successfully. Purchase Order: ${poNumber}`
            : 'Purchase Indent converted to Purchase Order successfully.'
        })(),
      })
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Purchase Indents',
        message:
          error instanceof Error
            ? error.message
            : 'Unable to convert Purchase Indent.',
      })
    } finally {
      conversionInFlightRef.current = false
      setIsSaving(false)
      setBusyAction(null)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget || isDeleting) {
      return
    }

  setIsDeleting(true)

  try {
    if (!canDeleteIndent(deleteTarget)) {
      throw new Error('Only pending Purchase Indents can be deleted.')
    }

    const targetId = getIndentId(deleteTarget)

    if (!targetId) {
      throw new Error('Unable to delete Purchase Indent.')
    }

    const response = await deletePurchaseIndent(targetId)

    if (!response.success) {
      throw new Error(
        response.error || 'Unable to delete Purchase Indent.'
      )
    }

    await refreshIndents()

    showToast({
      type: 'success',
      title: 'Purchase Indents',
      message: 'Purchase Indent deleted successfully.',
    })

    setDeleteTarget(null)
  } catch (error) {
    showToast({
      type: 'error',
      title: 'Purchase Indents',
      message:
        error instanceof Error
          ? error.message
          : 'Unable to delete Purchase Indent.',
    })
  } finally {
    setIsDeleting(false)
  }
}

  async function handleBulkDelete() {
  if (isDeleting) {
    return
  }

  setIsDeleting(true)

  try {
    const blockedRows = selectedIndents.filter((indent) => !canDeleteIndent(indent))

    if (blockedRows.length > 0) {
      throw new Error('Only pending Purchase Indents can be bulk deleted.')
    }

    for (const id of selectedIndentIds) {
      const response = await deletePurchaseIndent(id)

      if (!response.success) {
        throw new Error(
          response.error || `Unable to delete Purchase Indent ${id}.`
        )
      }
    }

    await refreshIndents()

    showToast({
      type: 'success',
      title: 'Purchase Indents',
      message: `${selectedIndentIds.length} Purchase Indent(s) deleted successfully.`,
    })

    setSelectedIndentIds([])
    setShowBulkDeleteConfirm(false)
  } catch (error) {
    showToast({
      type: 'error',
      title: 'Purchase Indents',
      message:
        error instanceof Error
          ? error.message
          : 'Unable to delete Purchase Indents.',
    })
  } finally {
    setIsDeleting(false)
  }
}

  const generatedBy = getCurrentUserName(user)
  const canBulkDeleteSelection = selectedIndents.length > 0 && selectedIndents.every(canDeleteIndent)
  const pageError = error || supplierError

  return (
    <div className="page purchases-page">
      <header className="purchases-page__compact-header" aria-label="Purchase indents summary">
        <div className="purchases-page__compact-main">
          <h1>Purchase Indents</h1>
          <div className="purchases-page__metrics" aria-label="Purchase indent metrics">
            <span className="purchases-page__metric purchases-page__metric--success">
              {summary.total} Indents
            </span>
            <span className="purchases-page__metric purchases-page__metric--warning">
              {summary.pending} Pending
            </span>
            <span className="purchases-page__metric purchases-page__metric--info">
              {summary.approved} Approved
            </span>
            <span className="purchases-page__metric purchases-page__metric--converted">
              {summary.converted} Converted
            </span>
            {summary.rejected > 0 ? (
              <span className="purchases-page__metric purchases-page__metric--danger">
                {summary.rejected} Rejected
              </span>
            ) : null}
            <span className="purchases-page__metric purchases-page__metric--value">
              {summary.totalQty} Items Requested
            </span>
          </div>
        </div>
        {canCreate ? (
          <button
            type="button"
            className="button button-primary"
            onClick={() => navigate('/inventory/purchase-indents/create')}
          >
            <Plus size={16} />
            Create Purchase Indent
          </button>
        ) : null}
      </header>

      {pageError ? (
        <div className="message-box message-box--error page-error-banner" role="alert">
          {pageError}
          <button
            type="button"
            className="button button-secondary"
            onClick={handleManualRefresh}
          >
            <RefreshCw size={16} />
            Retry
          </button>
        </div>
      ) : null}

      <PurchaseIndentsTable
        onApprove={handleApprove}
        onReject={(indent) => {
          setRejectTarget(indent)
          setRejectionReason('')
        }}
        onConvert={handleConvert}
        indents={displayIndents}
        products={products}
        canDelete={canDelete}
        onDelete={setDeleteTarget}
        onView={handleView}
        onRefresh={handleManualRefresh}
        loading={isLoading || isSupplierLoading}
        selectedIndentIds={selectedIndentIds}
        onSelectionChange={setSelectedIndentIds}
        onBulkExport={() => exportPurchaseIndentsCsv(selectedIndents)}
        onBulkPrint={() => printPurchaseIndents(selectedIndents, generatedBy)}
        onBulkMail={() => handleOpenMailCopy(selectedIndents)}
        onBulkDelete={() => setShowBulkDeleteConfirm(true)}
        canBulkDelete={canBulkDeleteSelection}
        onClearSelection={() => setSelectedIndentIds([])}
        onEdit={handleEdit}
        onMail={(indent) => handleOpenMailCopy([indent])}
        onPdf={handleDownloadPdf}
        onPrint={handlePrintIndent}
        busyAction={busyAction}
      />

      {deleteTarget ? (
        <FormModal
          title="Delete Purchase Indent"
          onClose={() => setDeleteTarget(null)}
        >
          <div className="purchase-form__delete-dialog">
            <div className="delete-confirmation__copy">
              <p>
                Are you sure you want to delete <strong>{getIndentNumber(deleteTarget)}</strong>?
              </p>
              <p className="delete-confirmation__warning">This action cannot be undone.</p>
            </div>
            <div className="button-row">
              <button type="button" className="button button-secondary button-cancel" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
                Cancel
              </button>
              <button type="button" className="button button-danger" onClick={confirmDelete} disabled={isDeleting}>
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </FormModal>
      ) : null}

      {rejectTarget ? (
        <FormModal
          title="Reject Purchase Indent"
          subtitle={`Reject ${getIndentNumber(rejectTarget)}`}
          onClose={() => {
            setRejectTarget(null)
            setRejectionReason('')
          }}
        >
          <div className="purchase-form__delete-dialog">
            <label htmlFor="purchase-indent-rejection-reason">Rejection reason</label>
            <textarea
              id="purchase-indent-rejection-reason"
              className="indent-remarks-textarea"
              value={rejectionReason}
              onChange={(event) => setRejectionReason(event.target.value)}
              disabled={isSaving}
              rows={4}
            />
            <div className="button-row">
              <button type="button" className="button button-danger" onClick={confirmReject} disabled={isSaving}>
                {isSaving ? 'Rejecting...' : 'Reject'}
              </button>
              <button
                type="button"
                className="button"
                onClick={() => {
                  setRejectTarget(null)
                  setRejectionReason('')
                }}
                disabled={isSaving}
              >
                Cancel
              </button>
            </div>
          </div>
        </FormModal>
      ) : null}

      {viewTarget ? (
        <FormModal
          title={viewDocumentModel ? `Purchase Indent Preview: ${viewDocumentModel.indentNumber}` : 'Loading Purchase Indent Preview...'}
          subtitle={viewDocumentModel?.indentDate ? `Requested on ${getSafeDate(viewDocumentModel.indentDate)}` : 'Please wait while we fetch the complete Purchase Indent information.'}
          onClose={() => {
            if (!isViewing) {
              setViewTarget(null)
              setViewDocumentModel(null)
            }
          }}
          dialogClassName="purchase-indent-details-modal"
        >
          {isViewing ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
              <LoaderCircle className="animate-spin" size={32} style={{ color: '#6c5ce7' }} />
            </div>
          ) : viewDocumentModel ? (
            <div className="purchase-indent-details">
              <PurchaseIndentDocument model={viewDocumentModel} />

              <div className="purchase-indent-details__actions">
                {(() => {
                  const isViewPending = String(viewTarget?.status || viewDocumentModel?.status || '').toLowerCase().includes('pending')
                  return (
                    <>
                      <button
                        type="button"
                        className="button button-secondary"
                        onClick={() => handleDownloadPdf(viewTarget, viewDocumentModel)}
                        disabled={isViewPending || busyAction?.key === 'pdf'}
                        title={isViewPending ? 'PDF download is disabled until the indent is approved or rejected' : undefined}
                      >
                        {busyAction?.key === 'pdf' ? <LoaderCircle className="animate-spin" size={15} /> : <Download size={15} />}
                        Download PDF
                      </button>
                      <button
                        type="button"
                        className="button button-secondary"
                        onClick={() => handlePrintIndent(viewTarget, viewDocumentModel)}
                        disabled={isViewPending || busyAction?.key === 'print'}
                        title={isViewPending ? 'Print is disabled until the indent is approved or rejected' : undefined}
                      >
                        {busyAction?.key === 'print' ? <LoaderCircle className="animate-spin" size={15} /> : <Printer size={15} />}
                        Print
                      </button>
                      <button
                        type="button"
                        className="button button-secondary"
                        onClick={() => {
                          if (isViewPending) return
                          const indentToMail = viewTarget
                          setViewTarget(null)
                          setViewDocumentModel(null)
                          handleOpenMailCopy([indentToMail])
                        }}
                        disabled={isViewPending || busyAction?.key === 'mail'}
                        title={isViewPending ? 'Email is disabled until the indent is approved or rejected' : undefined}
                      >
                        {busyAction?.key === 'mail' ? <LoaderCircle className="animate-spin" size={15} /> : <Mail size={15} />}
                        Mail Copy
                      </button>
                    </>
                  )
                })()}
                {canConvertIndent(viewTarget) ? (
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => {
                    handleConvert(viewTarget)
                    setViewTarget(null)
                    setViewDocumentModel(null)
                  }}
                >
                  <ShoppingCart size={16} />
                  Convert to Purchase Order
                </button>
              ) : null}
                <button
                  type="button"
                  className="button button-primary"
                  onClick={() => {
                    setViewTarget(null)
                    setViewDocumentModel(null)
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            <p style={{ textAlign: 'center', margin: '20px 0' }}>Failed to load Purchase Indent details.</p>
          )}
        </FormModal>
      ) : null}

      {mailDraft ? (
        <FormModal
          title={mailDraft.models.length === 1 ? 'Mail Purchase Indent Copy' : `Mail ${mailDraft.models.length} Purchase Indent Copies`}
          subtitle="Review the recipient and message before opening your email draft."
          icon={Mail}
          onClose={() => {
            if (!isSendingMail) {
              setMailDraft(null)
              setMailErrors({})
              setMailFeedback('')
            }
          }}
          dialogClassName="purchase-indent-mail-modal"
        >
          <div className="purchase-indent-mail">
            <div className="purchase-indent-mail__field">
              <label htmlFor="purchase-indent-mail-recipient">Recipient</label>
              <input
                id="purchase-indent-mail-recipient"
                {...emailInputProps}
                value={mailDraft.recipient}
                onChange={(event) => handleMailDraftChange('recipient', event.target.value)}
                aria-invalid={Boolean(mailErrors.recipient)}
                aria-describedby={mailErrors.recipient ? 'purchase-indent-mail-recipient-error' : undefined}
                disabled={isSendingMail}
              />
              {mailErrors.recipient ? (
                <p className="purchase-indent-mail__error" id="purchase-indent-mail-recipient-error">
                  {mailErrors.recipient}
                </p>
              ) : null}
            </div>

            <div className="purchase-indent-mail__field">
              <label htmlFor="purchase-indent-mail-subject">Subject</label>
              <input
                id="purchase-indent-mail-subject"
                type="text"
                value={mailDraft.subject}
                onChange={(event) => handleMailDraftChange('subject', event.target.value)}
                aria-invalid={Boolean(mailErrors.subject)}
                aria-describedby={mailErrors.subject ? 'purchase-indent-mail-subject-error' : undefined}
                disabled={isSendingMail}
              />
              {mailErrors.subject ? (
                <p className="purchase-indent-mail__error" id="purchase-indent-mail-subject-error">
                  {mailErrors.subject}
                </p>
              ) : null}
            </div>

            <div className="purchase-indent-mail__field">
              <label htmlFor="purchase-indent-mail-message">Message</label>
              <textarea
                id="purchase-indent-mail-message"
                rows={8}
                value={mailDraft.message}
                onChange={(event) => handleMailDraftChange('message', event.target.value)}
                aria-invalid={Boolean(mailErrors.message)}
                aria-describedby={mailErrors.message ? 'purchase-indent-mail-message-error' : undefined}
                disabled={isSendingMail}
              />
              {mailErrors.message ? (
                <p className="purchase-indent-mail__error" id="purchase-indent-mail-message-error">
                  {mailErrors.message}
                </p>
              ) : null}
            </div>

            <div aria-label="Purchase Indent PDF attachments">
              {mailDraft.models.map((model) => (
                <div className="purchase-indent-mail__attachment" key={model.indentNumber}>
                  <span className="purchase-indent-mail__attachment-icon" aria-hidden="true">
                    <FileText size={18} />
                  </span>
                  <div className="purchase-indent-mail__attachment-copy">
                    <strong>{model.indentNumber}</strong>
                    <span>Purchase Indent details will be pre-filled into your mail client.</span>
                  </div>
                </div>
              ))}
            </div>

            {mailFeedback ? (
              <p className="purchase-indent-mail__feedback" role="alert">{mailFeedback}</p>
            ) : null}

            <div className="purchase-indent-mail__actions">
              <button
                type="button"
                className="button button-secondary"
                onClick={() => {
                  setMailDraft(null)
                  setMailErrors({})
                  setMailFeedback('')
                }}
                disabled={isSendingMail}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button button-primary"
                onClick={handleSendMailCopy}
                disabled={isSendingMail}
              >
                {isSendingMail ? <LoaderCircle className="animate-spin" size={15} /> : <Mail size={15} />}
                {isSendingMail ? 'Preparing...' : 'Send'}
              </button>
            </div>
          </div>
        </FormModal>
      ) : null}

      {showBulkDeleteConfirm ? (
        <FormModal
          title="Delete Selected Purchase Indents"
          onClose={() => setShowBulkDeleteConfirm(false)}
        >
          <div className="purchase-form__delete-dialog">
            <div className="delete-confirmation__copy">
              <p>
                Are you sure you want to delete <strong>{selectedIndentIds.length}</strong> selected
                purchase indent{selectedIndentIds.length === 1 ? '' : 's'}?
              </p>
              <p className="delete-confirmation__warning">This action cannot be undone.</p>
            </div>
            <div className="button-row">
              <button type="button" className="button button-secondary button-cancel" onClick={() => setShowBulkDeleteConfirm(false)} disabled={isDeleting}>
                Cancel
              </button>
              <button type="button" className="button button-danger" onClick={handleBulkDelete} disabled={isDeleting}>
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </FormModal>
      ) : null}

      {printDocumentModel
        ? createPortal(
            <PurchaseIndentDocument model={printDocumentModel} printRoot />,
            document.body,
          )
        : null}
    </div>
  )
}

function exportPurchaseIndentsCsv(rows) {
  const headers = ['Indent Number', 'Status', 'Priority', 'Department', 'Supplier', 'Requester', 'Request Date', 'Required Date', 'Product', 'Quantity', 'Remarks']
  const csvRows = rows.map((row) => [
    getIndentNumber(row),
    row.status || DEFAULT_STATUS,
    row.priority || DEFAULT_PRIORITY,
    getSafeText(row.departmentDisplay, NOT_ASSIGNED),
    getSafeText(row.supplierDisplay, NOT_ASSIGNED),
    getSafeText(row.requestedByDisplay, NOT_ASSIGNED),
    getSafeDate(row.indentDate),
    getSafeDate(getRequiredDate(row)),
    getIndentProductsText(row),
    getIndentQuantity(row) || NOT_AVAILABLE,
    getSafeText(row.remarks || row.notes),
  ])
  
  const csv = [headers, ...csvRows]
    .map((row) => row.map(val => {
      const stringVal = String(val ?? '');
      if (stringVal.includes(',') || stringVal.includes('"') || stringVal.includes('\n')) {
        return `"${stringVal.replace(/"/g, '""')}"`;
      }
      return stringVal;
    }).join(','))
    .join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `purchase-indents-export-${getLocalTodayDate()}.csv`
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function createPrintableHtml(title, bodyHtml, extraStyles = '') {
  return `<!doctype html><html><head><meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>
      @page { size: A4; margin: 15mm 14mm 18mm; }
      * { box-sizing: border-box; }
      body { margin: 0; color: #111827; font: 12.5px Arial, sans-serif; line-height: 1.45; }
      h1 { margin: 0; font-size: 22px; color: #4a3bb8; }
      h2 { margin: 20px 0 10px; font-size: 14px; color: #0f172a; }
      table { width: 100%; border-collapse: collapse; }
      thead { display: table-header-group; }
      tfoot { display: table-footer-group; }
      tr { break-inside: avoid; page-break-inside: avoid; }
      th, td { padding: 8px 9px; border: 1px solid #dbe4f0; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
      th { background: #f8fafc; color: #475569; font-size: 11px; text-transform: uppercase; letter-spacing: 0; }
      .print-header { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; padding-bottom: 14px; margin-bottom: 16px; border-bottom: 2px solid #4a3bb8; }
      .print-logo { width: 64px; height: 64px; border: 1px solid #cbd5e1; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #64748b; font-size: 10px; text-align: center; }
      .print-meta { color: #64748b; font-size: 11.5px; text-align: right; }
      .print-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin: 14px 0 18px; }
      .print-field { border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 10px; background: #f8fafc; min-height: 52px; }
      .print-field strong { display: block; margin-bottom: 3px; color: #64748b; font-size: 10px; text-transform: uppercase; }
      .print-notes { margin-top: 16px; padding: 11px 12px; border-left: 3px solid #4a3bb8; background: #f8fafc; border-radius: 6px; white-space: pre-wrap; }
      .print-footer { position: fixed; left: 0; right: 0; bottom: -10mm; color: #64748b; font-size: 10px; display: flex; justify-content: space-between; border-top: 1px solid #e2e8f0; padding-top: 6px; }
      .page-number::after { content: "Page " counter(page); }
      ${extraStyles}
    </style>
  </head><body>
    ${bodyHtml}
    <script>
      window.addEventListener('load', function () {
        window.setTimeout(function () {
          window.focus();
          window.print();
        }, 120);
      });
      window.addEventListener('afterprint', function () {
        window.setTimeout(function () {
          window.close();
        }, 120);
      });
    </script>
  </body></html>`
}

function openPrintableDocument(title, bodyHtml, extraStyles = '') {
  const html = createPrintableHtml(title, bodyHtml, extraStyles)
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const printWindow = window.open(url, '_blank', 'noopener,noreferrer')

  window.setTimeout(() => URL.revokeObjectURL(url), 60000)

  if (!printWindow) {
    showToast({
      type: 'error',
      title: 'Purchase Indents',
      message: 'Allow pop-ups to open the printable Purchase Indent document.',
    })
    return false
  }

  return true
}

function printPurchaseIndents(rows, generatedBy = NOT_AVAILABLE) {
  const title = 'Selected Purchase Indents'
  const generatedTime = new Date().toLocaleString()
  const headers = ['Indent Number', 'Status', 'Priority', 'Department', 'Supplier', 'Required Date', 'Quantity']
  const tableHeaders = headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')
  const tableRows = rows.map(row => `
    <tr>
      <td>${escapeHtml(getIndentNumber(row))}</td>
      <td>${escapeHtml(row.status || DEFAULT_STATUS)}</td>
      <td>${escapeHtml(row.priority || DEFAULT_PRIORITY)}</td>
      <td>${escapeHtml(getSafeText(row.departmentDisplay, NOT_ASSIGNED))}</td>
      <td>${escapeHtml(getSafeText(row.supplierDisplay, NOT_ASSIGNED))}</td>
      <td>${escapeHtml(getSafeDate(getRequiredDate(row)))}</td>
      <td style="text-align: right;">${escapeHtml(String(getIndentQuantity(row) || NOT_AVAILABLE))}</td>
    </tr>
  `).join('')

  openPrintableDocument(title, `
    <div class="print-header">
      <div>
        <h1>${title}</h1>
        <p style="margin: 4px 0 0; color: #64748b;">IMS Inventory Management System</p>
      </div>
      <div class="print-logo">Company<br />Logo</div>
    </div>
    <table>
      <thead><tr>${tableHeaders}</tr></thead>
      <tbody>${tableRows}</tbody>
    </table>
    <div class="print-footer">
      <span>Generated ${escapeHtml(generatedTime)} by ${escapeHtml(generatedBy)}</span>
      <span class="page-number"></span>
    </div>
  `)
}

function escapeHtml(string) {
  return String(string ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
