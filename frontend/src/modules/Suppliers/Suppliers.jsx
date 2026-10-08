import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Archive,
  LoaderCircle,
  Download,
  Printer,
  Plus,
  RefreshCw,
  RotateCcw,
  Eye,
  Pencil,
  CreditCard,
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { showToast } from '../../components/common/toast'
import StateBlock from '../../components/common/StateBlock'
import FormModal from '../../layouts/FormModal'
import { ActionMenu, DataTable, FilterBar, StatusBadge } from '../../components/erp'
import { formatCurrency } from '../../utils/helpers'
import {
  cleanupSupplierTempDocuments,
  createSupplier,
  deleteSupplier,
  getSupplierById,
  getSuppliers,
  restoreSupplier,
  updateSupplier,
} from '../../api/suppliersApi'
import {
  getPurchaseOrders,
  getSupplierPayments,
} from '../../api/businessApi'
import { getCategories } from '../../api/productApi'
import SupplierDetailsPage from './components/SupplierDetailsPage'
import SupplierForm from './components/SupplierForm'
import {
  formatCategory,
  formatEmpty,
  formatNullableCurrency,
  formatStatus,
  formatTaxValue,
  getStatusBadgeType,
  normalizeStatusValue,
} from './supplierFormatters'
import './Suppliers.css'

const STATUS_FILTERS = [
  { value: '', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'pending', label: 'Pending' },
  { value: 'archived', label: 'Archived' },
]

const SUPPLIER_DEFAULT_COLUMNS = [
  'name',
  'category',
  'tax',
  'totalPurchaseAmount',
  'outstandingPayable',
  'status',
  'actions',
]
const SUPPLIERS_COLUMNS_STORAGE_KEY = 'suppliers-visible-columns'

function getSupplierDeleteError(error) {
  const message = String(error || '').trim()

  if (/archiv/i.test(message)) {
    return message
  }

  if (/product|purchase|receipt|payment|constraint|foreign key|conflict/i.test(message)) {
    return 'Supplier has transaction history and will be archived instead of removed.'
  }

  return message || 'Supplier archive failed.'
}

function getSupplierDeleteApiError(response) {
  const status = Number(response?.status || 0)
  const message = String(response?.error || response?.message || '').trim()

  if (status === 0) return message || 'Network connection lost. Supplier was not archived.'
  if (status === 401) return 'Your session has expired. Please sign in again.'
  if (status === 403) return 'You do not have permission to delete suppliers.'
  if (status === 404) return 'Supplier record was already removed or archived. Refreshing the list.'
  if (status >= 500) return message || 'Supplier archive failed. Please try again or contact support if the problem continues.'

  return getSupplierDeleteError(message)
}

function getSupplierApiError(response, fallback = 'Supplier action failed.', actionType = 'action') {
  const status = Number(response?.status || 0)
  const message = String(response?.error || response?.message || '').trim()

  if (status === 0) return message || 'Network connection lost. Check the backend connection and try again.'
  if (status === 400) return message || 'Review the supplier form and correct the highlighted fields.'
  if (status === 401) return 'Your session has expired. Please sign in again.'
  if (status === 403) return 'You do not have permission to complete this supplier action.'
  if (status === 404) return 'Supplier record was not found. Refresh the list and try again.'
  if (status === 409) return message || 'Supplier conflicts with an existing record.'
  if (status >= 500) {
    if (/status/i.test(message) && !/database|failed/i.test(message)) return 'Unable to update supplier status. Please select Active, Blocked, Inactive, or Pending.'
    if (actionType === 'load') return message || fallback || 'Supplier details could not be loaded.'
    return message || fallback || `Supplier ${actionType} failed.`
  }
  if (/exception|stack|sql|mysql|inner/i.test(message)) return fallback

  return message || fallback
}

function useDebouncedValue(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedValue(value), delay)
    return () => window.clearTimeout(timeoutId)
  }, [delay, value])

  return debouncedValue
}

function buildSupplierProfile(supplier) {
  const id = String(supplier.id || supplier.supplierId || '')

  const gstNumber =
    supplier.gstNumber ||
    supplier.GstNumber ||
    supplier.gstin ||
    supplier.GSTIN ||
    supplier.gst ||
    supplier.GST ||
    supplier.taxNumber ||
    supplier.taxId ||
    supplier.tax ||
    ''

  const panNumber =
    supplier.panNumber ||
    supplier.PanNumber ||
    supplier.pan ||
    supplier.PAN ||
    supplier.panNo ||
    supplier.PanNo ||
    ''

  return {
    ...supplier,
    id,
    supplierCode: supplier.supplierCode || supplier.code || '',
    companyName: supplier.companyName ?? supplier.CompanyName ?? supplier.company ?? supplier.Company ?? '',
    gstNumber,
    panNumber,
    gstin: gstNumber,
    gst: gstNumber,
    pan: panNumber,
    category: supplier.category || '',
    status: normalizeStatusValue(supplier.status),
    totalPurchaseAmount: supplier.totalPurchaseAmount ?? supplier.totalPurchases ?? supplier.totalPurchase ?? supplier.totalAmount ?? supplier.purchases ?? supplier.purchaseAmount ?? null,
    outstandingPayable: supplier.outstandingPayable ?? supplier.outstandingAmount ?? supplier.outstandingBalance ?? supplier.balanceAmount ?? supplier.outstanding ?? supplier.balance ?? null,
    lastPurchaseDate: supplier.lastPurchaseDate || null,
    contacts: Array.isArray(supplier.contacts) ? supplier.contacts : [],
    addresses: Array.isArray(supplier.addresses) ? supplier.addresses : [],
    bankAccounts: Array.isArray(supplier.bankAccounts) ? supplier.bankAccounts : [],
    documents: Array.isArray(supplier.documents) ? supplier.documents : [],
    performance: supplier.performance || supplier.Performance || null,
  }
}

function escapeCsvValue(value) {
  const text = String(value ?? '')
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function exportSuppliersCsv(suppliers) {
  const headers = [
    'Supplier',
    'Code',
    'Status',
    'Category',
    'GST',
    'PAN',
    'Purchases',
    'Outstanding',
  ]
  const rows = suppliers.map((supplier) => [
    supplier.name,
    supplier.supplierCode,
    formatStatus(supplier.isDeleted ? 'archived' : supplier.status),
    formatCategory(supplier.category),
    supplier.gstNumber,
    supplier.panNumber,
    supplier.totalPurchaseAmount ?? '',
    supplier.outstandingPayable ?? '',
  ])
  const csv = [headers, ...rows]
    .map((row) => row.map(escapeCsvValue).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'SupplierMaster.csv'
  link.click()
  URL.revokeObjectURL(url)
}

function printSuppliers(suppliers) {
  const rows = suppliers.map((supplier) => `
    <tr>
      <td><strong>${escapeHtml(supplier.name)}</strong><span>${escapeHtml(formatEmpty(supplier.supplierCode))}</span></td>
      <td>${escapeHtml(formatStatus(supplier.isDeleted ? 'archived' : supplier.status))}</td>
      <td>${escapeHtml(formatCategory(supplier.category))}</td>
      <td><span>${escapeHtml(formatTaxValue(supplier.gstNumber, 'GST'))}</span><span>${escapeHtml(formatTaxValue(supplier.panNumber, 'PAN'))}</span></td>
      <td>${escapeHtml(formatNullableCurrency(formatCurrency, supplier.totalPurchaseAmount))}</td>
      <td>${escapeHtml(formatNullableCurrency(formatCurrency, supplier.outstandingPayable))}</td>
    </tr>
  `).join('')
  const printWindow = window.open('', '_blank')

  if (!printWindow) {
    return
  }

  printWindow.document.write(`<!doctype html><html><head><title>Suppliers</title><style>
    body { margin: 28px; color: #111827; font: 13px Arial, sans-serif; }
    h1 { margin: 0 0 16px; font-size: 20px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 8px 10px; border: 1px solid #e2e8f0; text-align: left; vertical-align: top; }
    th { background: #f8fafc; color: #475569; font-size: 12px; }
    td span { display: block; color: #64748b; margin-top: 2px; }
  </style></head><body>
    <h1>Suppliers</h1>
    <table>
      <thead><tr><th>Supplier</th><th>Status</th><th>Category</th><th>GST / PAN</th><th>Purchases</th><th>Outstanding</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </body></html>`)
  printWindow.document.close()
  printWindow.focus()
  printWindow.print()
}

function getSupplierInitials(supplier) {
  const value = String(supplier?.name || supplier?.companyName || 'Supplier').trim()
  const words = value.split(/\s+/).filter(Boolean)

  if (words.length === 0) {
    return 'S'
  }

  return words.slice(0, 2).map((word) => word.charAt(0).toUpperCase()).join('')
}

function SuppliersHeader({ canCreate, summary, onAdd }) {
  const metrics = [
    { key: 'total', label: 'Suppliers', value: summary.total, tone: 'total' },
    { key: 'active', label: 'Active', value: summary.active, tone: 'success' },
    { key: 'inactive', label: 'Inactive', value: summary.inactive, tone: 'inactive' },
    { key: 'blocked', label: 'Blocked', value: summary.blocked, tone: 'danger' },
    { key: 'pending', label: 'Pending Payments', value: summary.vendorsWithPendingPayments, tone: 'warning' },
  ]

  return (
    <header className="resource-center__inventory-header" aria-label="Suppliers summary">
      <div className="resource-center__inventory-header-main">
        <h1>Suppliers</h1>
        <div className="resource-center__inventory-metrics" aria-label="Supplier metrics">
          {metrics.map((metric) => (
            <span
              key={metric.key}
              className={`resource-center__inventory-metric resource-center__inventory-metric--${metric.tone}`}
            >
              <strong>{metric.value}</strong> {metric.label}
            </span>
          ))}
        </div>
      </div>

      <div className="resource-center__inventory-header-actions">
        {canCreate ? (
          <button className="button button-primary" onClick={onAdd}>
            <Plus size={16} />
            Add Supplier
          </button>
        ) : null}
      </div>
    </header>
  )
}

export default function Suppliers({
  purchases = [],
  supplierPayments = [],
}) {
  const { hasPermission } = useAuth()

  const [suppliers, setSuppliers] = useState([])
  const [purchasesState, setPurchasesState] = useState([])
  const [supplierPaymentsState, setSupplierPaymentsState] = useState([])
  const [editingSupplier, setEditingSupplier] = useState(null)
  const [detailsSupplier, setDetailsSupplier] = useState(null)
  const [detailsInitialTab, setDetailsInitialTab] = useState('overview')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [bulkArchiveTarget, setBulkArchiveTarget] = useState(null)
  const [message, setMessage] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [loadingSupplierId, setLoadingSupplierId] = useState('')
  const [archivedSupplierIds, setArchivedSupplierIds] = useState([])
  const [supplierCategories, setSupplierCategories] = useState([])
  const [filters, setFilters] = useState({ search: '', status: '', category: '' })
  const [selectedSupplierIds, setSelectedSupplierIds] = useState([])
  const listRequestRef = useRef(0)
  const detailRequestRef = useRef(0)
  const debouncedSearch = useDebouncedValue(filters.search, 300)

  const activePurchases = useMemo(() => {
    return Array.isArray(purchases) && purchases.length > 0 ? purchases : purchasesState
  }, [purchases, purchasesState])

  const activeSupplierPayments = useMemo(() => {
    return Array.isArray(supplierPayments) && supplierPayments.length > 0 ? supplierPayments : supplierPaymentsState
  }, [supplierPayments, supplierPaymentsState])

  const canCreate = hasPermission('suppliers', 'create')
  const canEdit = hasPermission('suppliers', 'edit')
  const canDelete = hasPermission('suppliers', 'delete')

  const notify = useCallback((result) => {
    showToast({
      type: result.success ? 'success' : 'error',
      title: 'Suppliers',
      message: result.message,
      action: result.action,
    })
  }, [])

  const loadSuppliers = useCallback(async () => {
    const requestId = listRequestRef.current + 1
    listRequestRef.current = requestId
    setIsLoading(true)

    try {
      const [suppliersRes, purchasesRes, paymentsRes] = await Promise.allSettled([
        getSuppliers({}, { force: true }),
        getPurchaseOrders(),
        getSupplierPayments(),
      ])

      if (requestId !== listRequestRef.current) {
        return
      }

      if (suppliersRes.status === 'fulfilled' && suppliersRes.value?.success) {
        setSuppliers(Array.isArray(suppliersRes.value.data) ? suppliersRes.value.data : [])
        setMessage(null)
      } else if (suppliersRes.status === 'fulfilled' && suppliersRes.value) {
        throw new Error(getSupplierApiError(suppliersRes.value, 'Suppliers could not be loaded from the IMS API.'))
      }

      if (purchasesRes.status === 'fulfilled' && purchasesRes.value) {
        const val = purchasesRes.value
        const poData = Array.isArray(val?.data) ? val.data : (Array.isArray(val) ? val : [])
        setPurchasesState(poData)
      }

      if (paymentsRes.status === 'fulfilled' && paymentsRes.value) {
        const val = paymentsRes.value
        const payData = Array.isArray(val?.data) ? val.data : (Array.isArray(val) ? val : [])
        setSupplierPaymentsState(payData)
      }
    } catch (error) {
      const nextMessage = {
        success: false,
        message: error instanceof Error ? error.message : 'Suppliers could not be loaded from the IMS API.',
      }
      setMessage(nextMessage)
    } finally {
      if (requestId === listRequestRef.current) {
        setIsLoading(false)
      }
    }
  }, [])

  const loadSupplierCategories = useCallback(async () => {
    const response = await getCategories()

    if (response.success) {
      setSupplierCategories(
        (Array.isArray(response.data) ? response.data : [])
          .map((category) => category.name || category.label)
          .filter(Boolean),
      )
    }
  }, [])

  useEffect(() => {
    queueMicrotask(() => {
      loadSuppliers()
      loadSupplierCategories()
    })
  }, [loadSupplierCategories, loadSuppliers])

  const supplierProfiles = useMemo(
    () => suppliers.map((supplier, index) => buildSupplierProfile(supplier, index)),
    [suppliers],
  )

  const categoryOptions = useMemo(() => {
    const categories = [
      ...new Set([
        ...supplierCategories,
        ...supplierProfiles.map((supplier) => supplier.category).filter(Boolean),
      ]),
    ].sort((firstCategory, secondCategory) => firstCategory.localeCompare(secondCategory))
    return [{ value: '', label: 'All categories' }, ...categories.map((category) => ({ value: category, label: category }))]
  }, [supplierCategories, supplierProfiles])
  const formCategoryOptions = useMemo(
    () => categoryOptions.filter((option) => option.value),
    [categoryOptions],
  )

  const filteredSuppliers = useMemo(() => {
    const search = debouncedSearch.trim().toLowerCase()

    return supplierProfiles.filter((supplier) => {
      const isArchived = Boolean(supplier.isDeleted)

      if (!filters.status && isArchived) {
        return false
      }
      if (filters.status === 'archived' && !isArchived) {
        return false
      }
      if (filters.status && filters.status !== 'archived' && normalizeStatusValue(supplier.status) !== filters.status) {
        return false
      }
      if (filters.category && supplier.category !== filters.category) {
        return false
      }
      if (!search) {
        return true
      }
      return [
        supplier.name,
        supplier.supplierCode,
        supplier.companyName,
        supplier.category,
        supplier.gstNumber,
        supplier.panNumber,
        supplier.phone,
        supplier.email,
      ].join(' ').toLowerCase().includes(search)
    })
  }, [debouncedSearch, filters, supplierProfiles])

  const summary = useMemo(() => {
    const currentSuppliers = supplierProfiles.filter((supplier) => !supplier.isDeleted)
    const active = currentSuppliers.filter((supplier) => normalizeStatusValue(supplier.status) === 'active').length
    const inactive = currentSuppliers.filter((supplier) => normalizeStatusValue(supplier.status) === 'inactive').length
    const blocked = currentSuppliers.filter((supplier) => normalizeStatusValue(supplier.status) === 'blocked').length
    const vendorsWithPendingPayments = currentSuppliers.filter((supplier) => Number(supplier.outstandingPayable || 0) > 0).length

    return {
      total: currentSuppliers.length,
      active,
      inactive,
      blocked,
      vendorsWithPendingPayments,
    }
  }, [supplierProfiles])

  const selectedSupplier = editingSupplier || detailsSupplier
  const selectedPurchases = useMemo(() => {
    if (!selectedSupplier) return []

    const targetIds = [
      String(selectedSupplier.id || ''),
      String(selectedSupplier.supplierId || ''),
      String(selectedSupplier.supplier_id || ''),
      String(selectedSupplier.SupplierId || ''),
    ].filter((id) => id && id !== '0').map((id) => id.trim().toLowerCase())

    const targetCodes = [
      String(selectedSupplier.supplierCode || ''),
      String(selectedSupplier.code || ''),
    ].filter(Boolean).map((c) => c.trim().toLowerCase())

    const targetName = String(selectedSupplier.name || selectedSupplier.companyName || '').trim().toLowerCase()
    const targetCompany = String(selectedSupplier.companyName || selectedSupplier.name || '').trim().toLowerCase()

    const cleanTargetName = targetName.replace(/[^a-z0-9]/g, '')
    const cleanTargetCompany = targetCompany.replace(/[^a-z0-9]/g, '')

    return activePurchases.filter((item) => {
      const itemSupId = String(
        item.supplierId || item.SupplierId || item.supplier_id || item.supplierID ||
        (typeof item.supplier === 'object' ? (item.supplier?.id || item.supplier?.supplierId || item.supplier?.SupplierId) : '') || ''
      ).trim().toLowerCase()

      const itemSupCode = String(item.supplierCode || item.SupplierCode || item.code || item.supplier_code || '').trim().toLowerCase()

      const itemSupName = String(
        item.supplierName || item.SupplierName ||
        (typeof item.supplier === 'string' ? item.supplier : (item.supplier?.name || item.supplier?.companyName || '')) ||
        item.partyName || item.companyName || item.vendorName || ''
      ).trim().toLowerCase()

      const cleanItemSupName = itemSupName.replace(/[^a-z0-9]/g, '')

      const matchId = targetIds.some((tId) => itemSupId === tId || itemSupCode === tId)
      const matchCode = targetCodes.some((tCode) => itemSupId === tCode || itemSupCode === tCode)

      const matchName = Boolean(
        (targetName && itemSupName && (itemSupName === targetName || itemSupName.includes(targetName) || targetName.includes(itemSupName))) ||
        (targetCompany && itemSupName && (itemSupName === targetCompany || itemSupName.includes(targetCompany) || targetCompany.includes(itemSupName))) ||
        (cleanTargetName && cleanItemSupName && (cleanTargetName === cleanItemSupName || cleanItemSupName.includes(cleanTargetName) || cleanTargetName.includes(cleanItemSupName))) ||
        (cleanTargetCompany && cleanItemSupName && (cleanTargetCompany === cleanItemSupName || cleanItemSupName.includes(cleanTargetCompany) || cleanTargetCompany.includes(cleanItemSupName)))
      )

      return matchId || matchCode || matchName
    })
  }, [selectedSupplier, activePurchases])

  const selectedPayments = useMemo(() => {
    if (!selectedSupplier) return []

    const targetId = String(selectedSupplier.id || selectedSupplier.supplierId || '').trim().toLowerCase()
    const targetCode = String(selectedSupplier.supplierCode || selectedSupplier.code || '').trim().toLowerCase()
    const targetName = String(selectedSupplier.name || '').trim().toLowerCase()
    const targetCompany = String(selectedSupplier.companyName || '').trim().toLowerCase()

    const cleanTargetName = targetName.replace(/[^a-z0-9]/g, '')
    const cleanTargetCompany = targetCompany.replace(/[^a-z0-9]/g, '')

    return activeSupplierPayments.filter((item) => {
      const itemSupId = String(item.supplierId || item.SupplierId || item.supplier_id || item.supplierID || item.partyId || '').trim().toLowerCase()
      const itemSupCode = String(item.supplierCode || item.SupplierCode || item.code || item.supplier_code || '').trim().toLowerCase()
      const itemSupName = String(item.supplierName || item.SupplierName || item.supplier || item.partyName || item.companyName || item.vendorName || '').trim().toLowerCase()
      const cleanItemSupName = itemSupName.replace(/[^a-z0-9]/g, '')

      const matchId = Boolean(targetId && targetId !== '0' && (itemSupId === targetId || itemSupCode === targetId))
      const matchCode = Boolean(targetCode && (itemSupId === targetCode || itemSupCode === targetCode))

      const matchName = Boolean(
        (targetName && itemSupName && (itemSupName === targetName || itemSupName.includes(targetName) || targetName.includes(itemSupName))) ||
        (targetCompany && itemSupName && (itemSupName === targetCompany || itemSupName.includes(targetCompany) || targetCompany.includes(itemSupName))) ||
        (cleanTargetName && cleanItemSupName && (cleanTargetName === cleanItemSupName || cleanItemSupName.includes(cleanTargetName) || cleanTargetName.includes(cleanItemSupName))) ||
        (cleanTargetCompany && cleanItemSupName && (cleanTargetCompany === cleanItemSupName || cleanItemSupName.includes(cleanTargetCompany) || cleanTargetCompany.includes(cleanItemSupName)))
      )

      return matchId || matchCode || matchName
    })
  }, [selectedSupplier, activeSupplierPayments])

  const selectedSuppliers = useMemo(() => {
    const selectedIdSet = new Set(selectedSupplierIds.map(String))
    return filteredSuppliers.filter((supplier) => selectedIdSet.has(String(supplier.id)))
  }, [selectedSupplierIds, filteredSuppliers])
  const hasSelectedSuppliers = selectedSupplierIds.length > 0

  async function loadSupplierDetail(supplier) {
    const supplierId = supplier?.id || supplier?.supplierId

    if (!supplierId) {
      return supplier
    }

    const requestId = detailRequestRef.current + 1
    detailRequestRef.current = requestId
    setLoadingSupplierId(String(supplierId))

    try {
      const response = await getSupplierById(supplierId)

      if (requestId !== detailRequestRef.current) {
        return null
      }

      if (!response.success) {
        return null
      }

      return buildSupplierProfile(response.data, 0)
    } catch {
      return null
    } finally {
      if (requestId === detailRequestRef.current) {
        setLoadingSupplierId('')
      }
    }
  }

  async function openSupplierDetails(supplier, tab = 'overview') {
    setDetailsInitialTab(tab)
    const baseSupplier = supplier || {}

    const [detailedSupplier, poRes, payRes] = await Promise.all([
      loadSupplierDetail(supplier),
      getPurchaseOrders().catch(() => null),
      getSupplierPayments().catch(() => null),
    ])

    if (poRes?.success || Array.isArray(poRes?.data) || Array.isArray(poRes)) {
      const poData = Array.isArray(poRes?.data) ? poRes.data : (Array.isArray(poRes) ? poRes : [])
      if (poData.length > 0) setPurchasesState(poData)
    }

    if (payRes?.success || Array.isArray(payRes?.data) || Array.isArray(payRes)) {
      const payData = Array.isArray(payRes?.data) ? payRes.data : (Array.isArray(payRes) ? payRes : [])
      if (payData.length > 0) setSupplierPaymentsState(payData)
    }

    const mergedSupplier = detailedSupplier
      ? {
          ...baseSupplier,
          ...detailedSupplier,
          totalPurchaseAmount:
            detailedSupplier.totalPurchaseAmount ??
            detailedSupplier.purchases ??
            baseSupplier.totalPurchaseAmount ??
            baseSupplier.purchases ??
            null,
          outstandingPayable:
            detailedSupplier.outstandingPayable ??
            detailedSupplier.outstanding ??
            baseSupplier.outstandingPayable ??
            baseSupplier.outstanding ??
            null,
          lastPurchaseDate:
            detailedSupplier.lastPurchaseDate ||
            baseSupplier.lastPurchaseDate ||
            null,
        }
      : baseSupplier

    setDetailsSupplier(mergedSupplier)
  }

  function handleSupplierDocumentsChange(nextDocuments) {
    setDetailsSupplier((currentValue) => (
      currentValue
        ? { ...currentValue, documents: nextDocuments }
        : currentValue
    ))
    setSuppliers((currentValue) => currentValue.map((supplier) => {
      const supplierId = String(supplier.id || supplier.supplierId || '')
      const selectedSupplierId = String(detailsSupplier?.id || detailsSupplier?.supplierId || '')

      return supplierId && supplierId === selectedSupplierId
        ? { ...supplier, documents: nextDocuments }
        : supplier
    }))
  }

  function handleOpenCreate() {
    setEditingSupplier(null)
    setIsFormOpen(true)
  }

  async function handleEdit(supplier) {
    const detailedSupplier = await loadSupplierDetail(supplier)
    setEditingSupplier(detailedSupplier || supplier)
    setIsFormOpen(true)
  }

  async function handleCloseForm() {
    if (isSaving) {
      return
    }
    const supplierId = editingSupplier?.id || editingSupplier?.supplierId
    if (supplierId) {
      await cleanupSupplierTempDocuments(supplierId)
      await loadSuppliers()
    }
    setEditingSupplier(null)
    setIsFormOpen(false)
  }

  async function handleSave(values) {
    if (isSaving) {
      return
    }

    setIsSaving(true)

    const targetId = editingSupplier?.id || editingSupplier?.supplierId

    try {
      const response = targetId
        ? await updateSupplier(targetId, values)
        : await createSupplier(values)

      const isOfflineError = !response.success && (response.status === 0 || /connect|network|offline|failed to fetch/i.test(response.error || response.message || ''))

        if (response.success || isOfflineError) {
          const savedSupplierId = response.data?.id || response.data?.supplierId || targetId
          const stagedFiles = (Array.isArray(values?.documents) ? values.documents : []).filter(
            (doc) => doc?.file instanceof File || doc?.file instanceof Blob
          )

          if (stagedFiles.length > 0 && savedSupplierId) {
            try {
              await Promise.all(
                stagedFiles.map((doc) =>
                  uploadSupplierDocument(savedSupplierId, {
                    documentType: doc.documentType || doc.type,
                    file: doc.file,
                  })
                )
              )
            } catch (uploadErr) {
              console.error('[Supplier Save] Staged document upload failed:', uploadErr)
            }
          }

          const updatedSupplierProfile = response.data
            ? buildSupplierProfile(response.data)
            : buildSupplierProfile({
                ...(editingSupplier || {}),
                ...values,
                id: targetId || `SUP-${Date.now()}`,
                supplierId: targetId || `SUP-${Date.now()}`,
              })

          setSuppliers((currentValue) => {
            if (targetId) {
              return currentValue.map((sup) => {
                const currentId = String(sup.id || sup.supplierId || '')
                return currentId === String(targetId) ? { ...sup, ...updatedSupplierProfile } : sup
              })
            }
            return [updatedSupplierProfile, ...currentValue]
          })

          const result = {
            success: true,
            message: targetId
              ? 'Supplier updated successfully.'
              : 'Supplier added successfully.',
          }

          notify(result)
          setEditingSupplier(null)
          setIsFormOpen(false)

          if (response.success) {
            loadSuppliers()
          }
        } else {
        const result = {
          success: false,
          message: getSupplierApiError(response, 'Supplier save failed.'),
        }
        notify(result)
      }
    } catch (error) {
      const result = {
        success: false,
        message: error instanceof Error ? error.message : 'Supplier save failed.',
      }
      notify(result)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget?.id) {
      return
    }

    const supplierToDelete = deleteTarget
    setIsDeleting(true)

    try {
      const response = await deleteSupplier(supplierToDelete.id)
      const nextMessage = response.success
        ? {
            success: true,
            message: 'Supplier archived successfully.',
            action: {
              label: 'Undo archive',
              onClick: () => handleRestoreSupplier(supplierToDelete),
            },
          }
        : { success: false, message: getSupplierDeleteApiError(response) }

      notify(nextMessage)

      if (response.success) {
        setArchivedSupplierIds((currentValue) => [...new Set([...currentValue, String(supplierToDelete.id)])])
        setDeleteTarget(null)
        window.setTimeout(() => {
          setSuppliers((currentValue) => currentValue.filter((supplier) => String(supplier.id || supplier.supplierId) !== String(supplierToDelete.id)))
          setArchivedSupplierIds((currentValue) => currentValue.filter((id) => id !== String(supplierToDelete.id)))
          loadSuppliers()
        }, 180)
        if (editingSupplier?.id === supplierToDelete.id) {
          setEditingSupplier(null)
          setIsFormOpen(false)
        }
      }
    } catch (error) {
      const nextMessage = {
        success: false,
        message: getSupplierDeleteError(error instanceof Error ? error.message : ''),
      }
      notify(nextMessage)
    } finally {
      setIsDeleting(false)
    }
  }

  function handleBulkArchiveRequest(selectedItems, onComplete) {
    if (!Array.isArray(selectedItems) || selectedItems.length === 0) {
      return
    }

    setBulkArchiveTarget({ suppliers: selectedItems, onComplete })
  }

  async function handleConfirmBulkArchive() {
    if (!bulkArchiveTarget?.suppliers?.length) {
      return
    }

    const suppliersToArchive = bulkArchiveTarget.suppliers
    setIsDeleting(true)

    try {
      for (const supplier of suppliersToArchive) {
        const supplierId = supplier.id || supplier.supplierId

        if (!supplierId) {
          throw new Error(`Supplier identifier is missing for ${supplier.name || 'one selected supplier'}.`)
        }

        const response = await deleteSupplier(supplierId)

        if (!response.success) {
          throw new Error(getSupplierDeleteApiError(response))
        }
      }

      const nextMessage = {
        success: true,
        message: `${suppliersToArchive.length} supplier${suppliersToArchive.length === 1 ? '' : 's'} archived successfully.`,
      }
      notify(nextMessage)
      bulkArchiveTarget.onComplete?.()
      setBulkArchiveTarget(null)
      setArchivedSupplierIds((currentValue) => [
        ...new Set([
          ...currentValue,
          ...suppliersToArchive.map((supplier) => String(supplier.id || supplier.supplierId)),
        ]),
      ])
      window.setTimeout(() => {
        setSuppliers((currentValue) => {
          const archivedIdSet = new Set(suppliersToArchive.map((supplier) => String(supplier.id || supplier.supplierId)))
          return currentValue.filter((supplier) => !archivedIdSet.has(String(supplier.id || supplier.supplierId)))
        })
        setArchivedSupplierIds((currentValue) => {
          const archivedIdSet = new Set(suppliersToArchive.map((supplier) => String(supplier.id || supplier.supplierId)))
          return currentValue.filter((id) => !archivedIdSet.has(String(id)))
        })
        loadSuppliers()
      }, 180)
    } catch (error) {
      const nextMessage = {
        success: false,
        message: getSupplierDeleteError(error instanceof Error ? error.message : ''),
      }
      notify(nextMessage)
    } finally {
      setIsDeleting(false)
    }
  }

  async function handleRestoreSupplier(supplierToRestore) {
    if (!supplierToRestore?.id) {
      return
    }

    try {
      const response = await restoreSupplier(supplierToRestore.id)
      const nextMessage = response.success
        ? { success: true, message: 'Supplier restored successfully.' }
        : { success: false, message: getSupplierDeleteApiError(response) }

      notify(nextMessage)

      if (response.success) {
        await loadSuppliers()
      }
    } catch (error) {
      const nextMessage = {
        success: false,
        message: getSupplierDeleteError(error instanceof Error ? error.message : 'Supplier restore failed.'),
      }
      notify(nextMessage)
    }
  }

  // Define table columns
  const columns = useMemo(() => [
    {
      key: 'name',
      label: 'Supplier',
      style: { minWidth: '180px' },
      headerStyle: { minWidth: '180px' },
      sortable: true,
      mobilePrimary: true,
      render: (supplier) => (
        <div className="suppliers-page__identity-cell">
          <span className="suppliers-page__identity-avatar" aria-hidden="true">
            {getSupplierInitials(supplier)}
          </span>
          <div className="suppliers-page__table-stack">
            <strong title={supplier.name}>{supplier.name}</strong>
            <span>{formatEmpty(supplier.supplierCode)}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'category',
      label: 'Category',
      tableWidth: '130px',
      sortable: true,
      style: { width: '130px', minWidth: '130px' },
      headerStyle: { width: '130px', minWidth: '130px' },
      render: (supplier) => (
        <span className={`supplier-category-badge ${supplier.category ? '' : 'is-empty'}`}>
          {formatCategory(supplier.category)}
        </span>
      ),
    },
    {
      key: 'tax',
      label: 'GST / PAN',
      tableWidth: '140px',
      sortable: false,
      style: { width: '140px', minWidth: '140px' },
      headerStyle: { width: '140px', minWidth: '140px' },
      render: (supplier) => {
        const gst = supplier.gstNumber || supplier.gstin || supplier.gst || ''
        const pan = supplier.panNumber || supplier.pan || ''
        return (
          <div className="suppliers-page__table-stack supplier-tax-stack">
            <span className={gst ? '' : 'is-empty'}>{formatTaxValue(gst, 'GST')}</span>
            <span className={pan ? '' : 'is-empty'}>{formatTaxValue(pan, 'PAN')}</span>
          </div>
        )
      },
    },
    {
      key: 'totalPurchaseAmount',
      label: 'Purchases',
      tableWidth: '110px',
      sortable: true,
      className: 'is-numeric',
      headerClassName: 'is-numeric',
      style: { width: '110px', minWidth: '110px', textAlign: 'right' },
      headerStyle: { width: '110px', minWidth: '110px', textAlign: 'right' },
      render: (supplier) => formatNullableCurrency(formatCurrency, supplier.totalPurchaseAmount),
    },
    {
      key: 'outstandingPayable',
      label: 'Outstanding',
      tableWidth: '110px',
      sortable: true,
      className: 'is-numeric',
      headerClassName: 'is-numeric',
      style: { width: '110px', minWidth: '110px', textAlign: 'right' },
      headerStyle: { width: '110px', minWidth: '110px', textAlign: 'right' },
      render: (supplier) => formatNullableCurrency(formatCurrency, supplier.outstandingPayable),
    },
    {
      key: 'status',
      label: 'Status',
      tableWidth: '100px',
      sortable: true,
      style: { width: '100px', minWidth: '100px' },
      headerStyle: { width: '100px', minWidth: '100px' },
      render: (supplier) => {
        const displayStatus = supplier.isDeleted ? 'archived' : supplier.status
        return <StatusBadge type={getStatusBadgeType(displayStatus)}>{formatStatus(displayStatus)}</StatusBadge>
      },
    },
    {
      key: 'actions',
      label: 'Actions',
      tableWidth: '70px',
      className: 'supplier-actions-column text-center',
      headerClassName: 'text-center',
      style: { width: '70px', minWidth: '70px', textAlign: 'center' },
      headerStyle: { width: '70px', minWidth: '70px', textAlign: 'center' },
      render: (supplier) => {
        if (supplier.isDeleted) {
          return (
            <ActionMenu
              iconOnly
              label={`Actions for ${supplier.name || 'supplier'}`}
              actions={[
                {
                  key: 'view',
                  label: 'View',
                  icon: Eye,
                  onClick: () => openSupplierDetails(supplier, 'overview'),
                },
                {
                  key: 'restore',
                  label: 'Restore',
                  icon: RotateCcw,
                  onClick: () => handleRestoreSupplier(supplier),
                },
              ]}
            />
          )
        }

        return (
          <ActionMenu
            iconOnly
            label={`Actions for ${supplier.name || 'supplier'}`}
            actions={[
              {
                key: 'view',
                label: 'View',
                icon: Eye,
                onClick: () => openSupplierDetails(supplier, 'overview'),
              },
              canEdit ? {
                key: 'edit',
                label: String(loadingSupplierId) === String(supplier.id) ? 'Loading...' : 'Edit',
                icon: Pencil,
                disabled: String(loadingSupplierId) === String(supplier.id),
                onClick: () => handleEdit(supplier),
              } : null,
              {
                key: 'payments',
                label: 'Payments',
                icon: CreditCard,
                onClick: () => openSupplierDetails(supplier, 'paymentHistory'),
              },
              canDelete ? {
                key: 'archive',
                label: 'Archive',
                icon: Archive,
                variant: 'danger',
                onClick: () => setDeleteTarget(supplier),
              } : null,
            ]}
          />
        )
      }
    }
  ], [canEdit, canDelete, loadingSupplierId])

  function renderSupplierMobileCard(supplier) {
    const isArchived = Boolean(supplier.isDeleted)
    const category = formatCategory(supplier.category)
    const displayStatus = isArchived ? 'archived' : supplier.status
    const statusType = getStatusBadgeType(displayStatus)
    const statusText = formatStatus(displayStatus)

    return (
      <article
        className={`catalog-mobile-card ${
          isArchived ? 'supplier-row--archiving' : ''
        }`.trim()}
      >
        <div className="catalog-mobile-card__header">
          <div className="catalog-mobile-card__identity">
            <strong>{supplier.name}</strong>
            <span style={{ fontSize: '11px', color: '#64748b' }}>{formatEmpty(supplier.supplierCode)}</span>
          </div>
          <StatusBadge type={statusType}>{statusText}</StatusBadge>
        </div>

        <div className="catalog-mobile-card__description" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <span className={`supplier-category-badge ${supplier.category ? '' : 'is-empty'}`}>
            {category}
          </span>
          {supplier.gstNumber && (
            <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#475569' }}>
              {formatTaxValue(supplier.gstNumber, 'GST')}
            </span>
          )}
        </div>

        <dl className="catalog-mobile-card__meta">
          <div>
            <dt>Purchases</dt>
            <dd>{formatNullableCurrency(formatCurrency, supplier.totalPurchaseAmount)}</dd>
          </div>
          <div>
            <dt>Outstanding</dt>
            <dd style={{ color: '#c2410c', fontWeight: 'bold' }}>
              {formatNullableCurrency(formatCurrency, supplier.outstandingPayable)}
            </dd>
          </div>
        </dl>

        <div className="catalog-mobile-card__actions">
          <div className="supplier-actions-column-cell">
            {columns[columns.length - 1].render(supplier)}
          </div>
        </div>
      </article>
    )
  }

  const selectedToolbarContent = hasSelectedSuppliers ? (
    <FilterBar className="suppliers-list-page__selection-toolbar" ariaLabel="Bulk actions selection">
      <span className="suppliers-selection-summary">
        <strong>{selectedSupplierIds.length}</strong> selected
      </span>
      <button
        type="button"
        className="button button-secondary"
        onClick={() => exportSuppliersCsv(selectedSuppliers)}
      >
        <Download size={15} />
        Export
      </button>
      <button
        type="button"
        className="button button-secondary"
        onClick={() => printSuppliers(selectedSuppliers)}
      >
        <Printer size={15} />
        Print
      </button>
      {canDelete ? (
        <button
          type="button"
          className="button button-secondary"
          onClick={() => handleBulkArchiveRequest(selectedSuppliers, () => setSelectedSupplierIds([]))}
        >
          <Archive size={15} />
          Archive
        </button>
      ) : null}
    </FilterBar>
  ) : null

  const supplierFilterContent = hasSelectedSuppliers ? selectedToolbarContent : (
    <FilterBar className="suppliers-list-page__filters" ariaLabel="Supplier filters">
      <select
        value={filters.status}
        onChange={(event) => setFilters((curr) => ({ ...curr, status: event.target.value }))}
        aria-label="Filter suppliers by status"
      >
        {STATUS_FILTERS.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <select
        value={filters.category}
        onChange={(event) => setFilters((curr) => ({ ...curr, category: event.target.value }))}
        aria-label="Filter suppliers by category"
      >
        {categoryOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </FilterBar>
  )

  if (detailsSupplier) {
    return (
      <div className="page suppliers-page">
        <SupplierDetailsPage
          supplier={detailsSupplier}
          purchases={selectedPurchases}
          payments={selectedPayments}
          initialTab={detailsInitialTab}
          onBack={() => setDetailsSupplier(null)}
          onDocumentsChange={handleSupplierDocumentsChange}
        />
      </div>
    )
  }

  return (
    <div className="page resource-center">
      <div className="resource-center__page resource-center__page--suppliers">
        <SuppliersHeader
          canCreate={canCreate}
          summary={summary}
          onAdd={handleOpenCreate}
        />

        {message ? (
          message.success ? (
            <div className="message-box message-box--success">
              <span>{message.message}</span>
            </div>
          ) : (
            <StateBlock
              type="server"
              title="Supplier data could not be refreshed"
              message={message.message}
              actionLabel={isLoading ? 'Retrying...' : 'Retry'}
              onAction={loadSuppliers}
              compact
            />
          )
        ) : null}

        <div className="card resource-center__inventory-table-card">
          <DataTable
            className="resource-center__inventory-table"
            rows={filteredSuppliers}
            columns={columns}
            rowClassName={(supplier) =>
              archivedSupplierIds.includes(String(supplier.id)) ? 'supplier-row--archiving' : ''
            }
            loading={isLoading}
            defaultPageSize={20}
            defaultSortKey=""
            showSearch={!hasSelectedSuppliers}
            searchPlaceholder="Search suppliers by name, code"
            invalidSearchMessage="Please enter a valid search term (e.g., supplier name, code, phone, email, city)."
            emptyMessage={isLoading ? 'Loading suppliers...' : 'No suppliers match the current filters.'}
            enableRowSelection
            selectedRowKeys={selectedSupplierIds}
            onSelectionChange={setSelectedSupplierIds}
            keyField="id"
            defaultVisibleColumnKeys={SUPPLIER_DEFAULT_COLUMNS}
            columnStorageKey={SUPPLIERS_COLUMNS_STORAGE_KEY}
            fitExplicitColumnsToContainer
            splitToolbar
            filterContent={supplierFilterContent}
            toolbarContent={
              <FilterBar className="suppliers__toolbar-actions" ariaLabel="Supplier table actions">
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={loadSuppliers}
                  disabled={isLoading}
                >
                  <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                  Refresh
                </button>
              </FilterBar>
            }
            onSearchChange={(value) => setFilters((curr) => ({ ...curr, search: value }))}
            searchValue={filters.search}
            renderMobileCard={renderSupplierMobileCard}
          />
        </div>

        {isFormOpen ? (
          <FormModal
            title={editingSupplier ? 'Edit Supplier' : 'Add Supplier'}
            onClose={handleCloseForm}
            className="supplier-form-modal-shell"
            dialogClassName="supplier-enterprise-modal"
          >
            <SupplierForm
              key={`${editingSupplier?.id ?? 'new'}-master`}
              initialValues={selectedSupplier}
              canSubmit={editingSupplier ? canEdit : canCreate}
              onSubmit={handleSave}
              onCancel={handleCloseForm}
              isSubmitting={isSaving}
              existingSupplierCodes={supplierProfiles.map((supplier) => supplier.supplierCode).filter(Boolean)}
              categoryOptions={formCategoryOptions}
            />
          </FormModal>
        ) : null}

        {deleteTarget ? (
          <FormModal
            title="Archive Supplier?"
            subtitle="The supplier will be archived and hidden from active procurement records."
            onClose={() => {
              if (!isDeleting) {
                setDeleteTarget(null)
              }
            }}
            dialogClassName="supplier-delete-modal"
          >
            <div className="suppliers-page__delete-dialog">
              <div className="supplier-warning">
                <AlertTriangle size={18} />
                <p>
                  Archive supplier <strong>{deleteTarget.name || 'this supplier'}</strong>? Historical purchases, receipts, and payments remain preserved for audit.
                </p>
              </div>
              <div className="button-row suppliers-page__delete-actions">
                <button type="button" className="button button-cancel" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
                  Cancel
                </button>
                <button type="button" className="button button-danger" onClick={handleConfirmDelete} disabled={isDeleting}>
                  {isDeleting ? <LoaderCircle size={16} className="animate-spin" /> : <Archive size={16} />}
                  {isDeleting ? 'Archiving...' : 'Archive Supplier'}
                </button>
              </div>
            </div>
          </FormModal>
        ) : null}

        {bulkArchiveTarget ? (
          <FormModal
            title="Archive Selected Suppliers?"
            subtitle="Selected suppliers will be hidden from active procurement records."
            onClose={() => {
              if (!isDeleting) {
                setBulkArchiveTarget(null)
              }
            }}
            dialogClassName="supplier-delete-modal"
          >
            <div className="suppliers-page__delete-dialog">
              <div className="supplier-warning">
                <AlertTriangle size={18} />
                <p>
                  Archive <strong>{bulkArchiveTarget.suppliers.length}</strong> selected supplier{bulkArchiveTarget.suppliers.length === 1 ? '' : 's'}?
                  Historical purchases, receipts, and payments remain preserved for audit.
                </p>
              </div>
              <ul className="suppliers-page__bulk-list">
                {bulkArchiveTarget.suppliers.slice(0, 5).map((supplier) => (
                  <li key={supplier.id || supplier.supplierId || supplier.name}>
                    {supplier.name || supplier.supplierCode || 'Unnamed supplier'}
                  </li>
                ))}
                {bulkArchiveTarget.suppliers.length > 5 ? (
                  <li>+{bulkArchiveTarget.suppliers.length - 5} more</li>
                ) : null}
              </ul>
              <div className="button-row suppliers-page__delete-actions">
                <button type="button" className="button button-cancel" onClick={() => setBulkArchiveTarget(null)} disabled={isDeleting}>
                  Cancel
                </button>
                <button type="button" className="button button-danger" onClick={handleConfirmBulkArchive} disabled={isDeleting}>
                  {isDeleting ? <LoaderCircle size={16} className="animate-spin" /> : <Archive size={16} />}
                  {isDeleting ? 'Archiving...' : 'Archive Selected'}
                </button>
              </div>
            </div>
          </FormModal>
        ) : null}
      </div>
    </div>
  )
}
