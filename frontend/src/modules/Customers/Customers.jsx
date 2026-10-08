import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Check, LoaderCircle, Plus, Trash2, X } from 'lucide-react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import AccessDenied from '../../components/common/AccessDenied'
import { showToast } from '../../components/common/toast'
import FormModal from '../../layouts/FormModal'
import { useAuth } from '../../hooks/useAuth'
import {
  createCustomer,
  deleteCustomer,
  getChangedCustomerFields,
  getCustomerById,
  getCustomerHistory,
  getCustomerSummary,
  getCustomers,
  normalizeCustomer,
  updateCustomerStatus,
  updateCustomer,
} from '../../api/customersApi'
import CustomerDeleteDialog from './components/CustomerDeleteDialog'
import CustomerDetailsPanel from './components/CustomerDetailsPanel'
import CustomerForm from './components/CustomerForm'
import CustomersTable from './components/CustomersTable'
import './Customers.css'

const VALID_CUSTOMER_FORM_TABS = ['basic', 'contacts', 'addresses', 'paymentTerms', 'banking', 'activity']

function getDate(value) {
  if (!value) {
    return null
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function isWithinDays(value, days) {
  const date = getDate(value)

  if (!date) {
    return false
  }

  const diff = Date.now() - date.getTime()
  return diff >= 0 && diff <= days * 24 * 60 * 60 * 1000
}

function getMonthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function calculateMonthlyGrowth(customers) {
  const now = new Date()
  const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const currentMonthKey = getMonthKey(now)
  const previousMonthKey = getMonthKey(previousMonth)

  const currentMonthCount = customers.filter((customer) => {
    const createdAt = getDate(customer.createdAt)
    return createdAt && getMonthKey(createdAt) === currentMonthKey
  }).length
  const previousMonthCount = customers.filter((customer) => {
    const createdAt = getDate(customer.createdAt)
    return createdAt && getMonthKey(createdAt) === previousMonthKey
  }).length

  if (previousMonthCount === 0) {
    return currentMonthCount > 0 ? 100 : 0
  }

  return Math.round(((currentMonthCount - previousMonthCount) / previousMonthCount) * 100)
}

function upsertCustomer(customers, customer) {
  const normalizedCustomer = normalizeCustomer(customer)

  if (!normalizedCustomer.id) {
    return customers
  }

  const exists = customers.some((item) => item.id === normalizedCustomer.id)

  return exists
    ? customers.map((item) => (item.id === normalizedCustomer.id ? normalizedCustomer : item))
    : [normalizedCustomer, ...customers]
}

function getCustomerDeleteError(error) {
  const message = String(error || '').trim()

  if (/invoice|payment|transaction|constraint|foreign key|conflict/i.test(message)) {
    return 'This customer cannot be deleted because invoices, payments, or transactions exist.'
  }

  return message || 'Customer delete failed. Please try again.'
}

export default function Customers() {
  const { hasPermission } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const { customerId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()

  const [customers, setCustomers] = useState([])
  const [summary, setSummary] = useState(null)
  const [summaryError, setSummaryError] = useState('')
  const [detailCustomer, setDetailCustomer] = useState(null)
  const [history, setHistory] = useState([])
  const [editingCustomer, setEditingCustomer] = useState(null)
  const [formActivity, setFormActivity] = useState([])
  const [customerFormMode, setCustomerFormMode] = useState('create')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [bulkDeleteTarget, setBulkDeleteTarget] = useState(null)
  const [statusConfirmTarget, setStatusConfirmTarget] = useState(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSummaryLoading, setIsSummaryLoading] = useState(true)
  const [isDetailLoading, setIsDetailLoading] = useState(false)
  const [isHistoryLoading, setIsHistoryLoading] = useState(false)
  const [isFormPreloading, setIsFormPreloading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [message, setMessage] = useState(null)
  const [formErrors, setFormErrors] = useState(null)
  const [formMessage, setFormMessage] = useState('')
  const [companyFilter, setCompanyFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [balanceFilter, setBalanceFilter] = useState('all')
  const [hasUnsavedCustomerChanges, setHasUnsavedCustomerChanges] = useState(false)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)

  // Auto-dismiss acknowledgement message after 4 seconds (within 3-5 seconds requirement)
  useEffect(() => {
    if (!message) return

    const timer = window.setTimeout(() => {
      setMessage(null)
    }, 4000)

    return () => window.clearTimeout(timer)
  }, [message])

  // Clear acknowledgement message when navigating or switching customer view
  useEffect(() => {
    setMessage(null)
  }, [location.pathname, location.search, customerId])

  // Clear acknowledgement message when changing table filters
  useEffect(() => {
    setMessage(null)
  }, [companyFilter, statusFilter, balanceFilter])

  const currentTabParam = searchParams.get('tab')
  const activeFormTab = VALID_CUSTOMER_FORM_TABS.includes(currentTabParam) ? currentTabParam : 'basic'

  const handleTabChange = useCallback((nextTab) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (nextTab === 'basic') {
        next.delete('tab')
      } else {
        next.set('tab', nextTab)
      }
      return next
    }, { replace: false })
  }, [setSearchParams])

  useEffect(() => {
    if (!hasUnsavedCustomerChanges) return

    function handleBeforeUnload(event) {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedCustomerChanges])

  const canView = hasPermission('customers', 'view')
  const canCreate = hasPermission('customers', 'create')
  const canEdit = hasPermission('customers', 'edit')
  const canDelete = hasPermission('customers', 'delete')

  const notify = useCallback((result) => {
    if (result) {
      setMessage(result)
    }
    showToast({
      type: result?.success ? 'success' : 'error',
      title: 'Customers',
      message: result?.message,
    })
  }, [])

  const loadDirectory = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setIsLoading(true)
      setIsSummaryLoading(true)
    }

    try {
      const [customersResponse, summaryResponse] = await Promise.all([
        getCustomers(),
        getCustomerSummary(),
      ])

      if (!customersResponse.success) {
        throw new Error(
          customersResponse.error ||
          'Customer records could not be loaded from the IMS API.',
        )
      }

      setCustomers(Array.isArray(customersResponse.data) ? customersResponse.data : [])
      setMessage(null)

      if (summaryResponse.success) {
        setSummary(summaryResponse.data ?? null)
        setSummaryError('')
      } else {
        setSummary(null)
        setSummaryError(
          summaryResponse.error ||
          'Customer summary is unavailable. Directory values are still live.',
        )
      }
    } catch (error) {
      const nextMessage = {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Customer records could not be loaded from the IMS API.',
      }
      setCustomers([])
      setMessage(nextMessage)
      notify(nextMessage)
    } finally {
      setIsLoading(false)
      setIsSummaryLoading(false)
    }
  }, [notify])

  const loadCustomerDetails = useCallback(async (id, { silent = false } = {}) => {
    if (!id) {
      setDetailCustomer(null)
      setHistory([])
      return
    }

    if (!silent) {
      setIsDetailLoading(true)
      setIsHistoryLoading(true)
    }

    try {
      const [customerResponse, historyResponse] = await Promise.all([
        getCustomerById(id),
        getCustomerHistory(id),
      ])

      if (!customerResponse.success) {
        throw new Error(
          customerResponse.error ||
          'Customer details could not be loaded from the IMS API.',
        )
      }

      const nextCustomer = customerResponse.data
      const nextHistory = historyResponse.success && Array.isArray(historyResponse.data)
        ? historyResponse.data
        : []

      setDetailCustomer(nextCustomer)
      setHistory(nextHistory)
      setCustomers((currentValue) => upsertCustomer(currentValue, nextCustomer))

      if (!historyResponse.success) {
        const nextMessage = {
          success: false,
          message:
            historyResponse.error ||
            'Customer activity history could not be loaded from the IMS API.',
        }
        setMessage(nextMessage)
        notify(nextMessage)
      }
    } catch (error) {
      const nextMessage = {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Customer details could not be loaded from the IMS API.',
      }
      setDetailCustomer(null)
      setHistory([])
      setMessage(nextMessage)
      notify(nextMessage)
    } finally {
      setIsDetailLoading(false)
      setIsHistoryLoading(false)
    }
  }, [notify])

  useEffect(() => {
    queueMicrotask(() => loadDirectory())
  }, [loadDirectory])

  useEffect(() => {
    if (customerId) {
      queueMicrotask(() => loadCustomerDetails(customerId))
      return
    }

    setDetailCustomer(null)
    setHistory([])
  }, [customerId, loadCustomerDetails])

  const dashboardMetrics = useMemo(() => {
    const activeCustomers = customers.filter(
      (customer) => String(customer.status).toLowerCase() === 'active',
    ).length
    const repeatCustomers = customers.filter(
      (customer) => Number(customer.totalOrders || 0) > 1,
    ).length
    const newCustomers = customers.filter((customer) =>
      isWithinDays(customer.createdAt, 30),
    ).length
    const growth = calculateMonthlyGrowth(customers)
    const outstandingReceivables = customers.reduce(
      (total, customer) => total + Number(customer.outstandingBalance || 0),
      0,
    )
    const totalCreditLimit = customers.reduce(
      (total, customer) => total + Number(customer.creditLimit || 0),
      0,
    )
    const creditUtilization = totalCreditLimit > 0
      ? Math.round((outstandingReceivables / totalCreditLimit) * 100)
      : 0

    return {
      totalCustomers: summary?.totalCustomers ?? customers.length,
      activeCustomers: summary?.activeCustomers ?? activeCustomers,
      repeatCustomers: summary?.repeatCustomers ?? repeatCustomers,
      newCustomers: summary?.newCustomers ?? newCustomers,
      outstandingReceivables: summary?.outstandingReceivables ?? outstandingReceivables,
      creditUtilization: summary?.creditUtilization ?? creditUtilization,
      customerGrowth: summary?.customerGrowth ?? growth,
    }
  }, [customers, summary])

  const statusOptions = useMemo(() => {
    const statuses = customers
      .map((customer) => customer.status)
      .filter(Boolean)
      .filter((status, index, list) => list.indexOf(status) === index)

    return ['all', ...new Set([...statuses, 'Active', 'Inactive'])]
  }, [customers])

  const companyOptions = useMemo(() => {
    const companies = customers
      .map((customer) => customer.company || 'Individual')
      .filter(Boolean)
      .filter((company, index, list) => list.indexOf(company) === index)

    return ['all', ...companies]
  }, [customers])

  const filteredCustomers = useMemo(() => {
    return customers.filter((customer) => {
      const matchesCompany = companyFilter === 'all'
        || String(customer.company || 'Individual') === companyFilter
      const matchesStatus = statusFilter === 'all'
        || String(customer.status).toLowerCase() === statusFilter.toLowerCase()
      const outstandingBalance = Number(customer.outstandingBalance || 0)
      const matchesBalance = balanceFilter === 'all'
        || (balanceFilter === 'outstanding' && outstandingBalance > 0)
        || (balanceFilter === 'clear' && outstandingBalance <= 0)

      return matchesCompany && matchesStatus && matchesBalance
    })
  }, [balanceFilter, companyFilter, customers, statusFilter])

  function handleOpenCreate() {
    setMessage(null)
    setEditingCustomer(null)
    setCustomerFormMode('create')
    setFormErrors(null)
    setFormMessage('')
    setHasUnsavedCustomerChanges(false)
    setShowDiscardConfirm(false)
    setIsFormPreloading(false)
    setFormActivity([])
    setIsFormOpen(true)
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('tab')
      return next
    }, { replace: true })
  }

  async function handleEdit(customer) {
    setMessage(null)
    setEditingCustomer(customer)
    setCustomerFormMode('edit')
    setFormErrors(null)
    setFormMessage('')
    setHasUnsavedCustomerChanges(false)
    setShowDiscardConfirm(false)
    setFormActivity([])
    setIsFormOpen(true)
    setIsFormPreloading(true)
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('tab')
      return next
    }, { replace: true })

    const [response, historyResponse] = await Promise.all([
      getCustomerById(customer.id),
      getCustomerHistory(customer.id),
    ])

    if (response.success) {
      setEditingCustomer(response.data)
      setCustomers((currentValue) => upsertCustomer(currentValue, response.data))
    } else {
      const nextMessage = {
        success: false,
        message:
          response.error ||
          'The latest customer profile could not be loaded. You can still edit the directory data shown.',
      }
      setFormMessage(nextMessage.message)
      notify(nextMessage)
    }

    setFormActivity(historyResponse.success && Array.isArray(historyResponse.data)
      ? historyResponse.data
      : [])

    setIsFormPreloading(false)
  }

  function handleCloseForm() {
    if (isSaving) {
      return
    }

    setEditingCustomer(null)
    setCustomerFormMode('create')
    setIsFormOpen(false)
    setFormErrors(null)
    setFormMessage('')
    setHasUnsavedCustomerChanges(false)
    setIsFormPreloading(false)
    setFormActivity([])
    setShowDiscardConfirm(false)
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('tab')
      return next
    }, { replace: true })
  }

  function handleRequestCloseForm() {
    if (isSaving) {
      return
    }

    if (hasUnsavedCustomerChanges) {
      setShowDiscardConfirm(true)
      return
    }

    handleCloseForm()
  }

  async function handleSave(values) {
    if (editingCustomer?.id) {
      const changedFields = getChangedCustomerFields(editingCustomer, values)

      if (Object.keys(changedFields).length === 0) {
        setFormMessage('No changes were detected for this customer.')
        return
      }
    }

    setIsSaving(true)
    setFormErrors(null)
    setFormMessage('')

    const response = editingCustomer?.id
      ? await updateCustomer(editingCustomer.id, values)
      : await createCustomer(values)

    if (!response.success) {
      const nextMessage = {
        success: false,
        message: response.error || 'Customer save failed. Review the form and try again.',
      }
      const hasFieldErrors = Boolean(response.errors && Object.keys(response.errors).length > 0)
      setFormErrors(response.errors)
      setFormMessage(hasFieldErrors ? '' : nextMessage.message)
      if (!hasFieldErrors) {
        setMessage(nextMessage)
      }
      notify(nextMessage)
      setIsSaving(false)
      return
    }

    const nextMessage = {
      success: true,
      message:
        response.message ||
        (editingCustomer ? 'Customer updated successfully.' : 'Customer added successfully.'),
    }
    setMessage(nextMessage)
    notify(nextMessage)
    if (response.data?.id) {
      setCustomers((currentValue) => upsertCustomer(currentValue, response.data))
    }
    await loadDirectory({ silent: true })

    if (customerId) {
      await loadCustomerDetails(customerId, { silent: true })
    }

    setIsSaving(false)
    setEditingCustomer(null)
    setCustomerFormMode('create')
    setIsFormOpen(false)
    setFormErrors(null)
    setFormMessage('')
    setHasUnsavedCustomerChanges(false)
    setIsFormPreloading(false)
    setFormActivity([])
    setShowDiscardConfirm(false)
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('tab')
      return next
    }, { replace: true })
  }

  function handleView(customer) {
    if (!customer?.id) {
      return
    }

    setMessage(null)
    setEditingCustomer(customer)
    setCustomerFormMode('view')
    setFormErrors(null)
    setFormMessage('')
    setHasUnsavedCustomerChanges(false)
    setShowDiscardConfirm(false)
    setFormActivity([])
    setIsFormOpen(true)
    setIsFormPreloading(true)
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('tab')
      return next
    }, { replace: true })

    Promise.all([
      getCustomerById(customer.id),
      getCustomerHistory(customer.id),
    ])
      .then(([response, historyResponse]) => {
        if (response.success) {
          setEditingCustomer(response.data)
          setCustomers((currentValue) => upsertCustomer(currentValue, response.data))
        } else {
          const nextMessage = {
            success: false,
            message:
              response.error ||
              'The latest customer profile could not be loaded. Showing directory data instead.',
          }
          setFormMessage(nextMessage.message)
          notify(nextMessage)
        }

        setFormActivity(historyResponse.success && Array.isArray(historyResponse.data)
          ? historyResponse.data
          : [])
      })
      .finally(() => {
        setIsFormPreloading(false)
      })
  }

  function handleBackToDirectory() {
    setMessage(null)
    navigate('/people/customers')
  }

  function handleRequestDelete(customer) {
    setMessage(null)
    setDeleteTarget(customer)
  }

  function handleRequestBulkDelete(selectedCustomers, onComplete) {
    if (!Array.isArray(selectedCustomers) || selectedCustomers.length === 0) {
      return
    }

    setMessage(null)
    setBulkDeleteTarget({ customers: selectedCustomers, onComplete })
  }

  function handleRequestStatusChange(customer, values) {
    if (!canEdit || !customer?.id) {
      return
    }

    if (values?.status) {
      setStatusConfirmTarget({
        customer,
        status: values.status,
        reason: values.reason || '',
      })
      return
    }
  }

  async function handleConfirmStatusUpdate() {
    if (!statusConfirmTarget?.customer?.id) {
      return
    }

    setIsUpdatingStatus(true)

    const response = await updateCustomerStatus(statusConfirmTarget.customer.id, {
      status: statusConfirmTarget.status,
      reason: statusConfirmTarget.reason || '',
    })

    if (!response.success) {
      notify({
        success: false,
        message: response.error || 'Customer status update failed. Please try again.',
      })
      setIsUpdatingStatus(false)
      return
    }

    notify({
      success: true,
      message: response.message || 'Customer status updated successfully.',
    })

    if (response.data?.id) {
      setCustomers((currentValue) => upsertCustomer(currentValue, response.data))

      if (String(customerId) === String(response.data.id)) {
        setDetailCustomer(response.data)
      }
    }

    setStatusConfirmTarget(null)
    setIsUpdatingStatus(false)
    await loadDirectory({ silent: true })

    if (customerId) {
      await loadCustomerDetails(customerId, { silent: true })
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget?.id) {
      return
    }

    const customerToDelete = deleteTarget
    const wasViewingDeletedCustomer = String(customerId) === String(customerToDelete.id)

    setIsDeleting(true)

    const response = await deleteCustomer(customerToDelete.id)

    if (!response.success) {
      const nextMessage = {
        success: false,
        message: getCustomerDeleteError(response.error),
      }
      notify(nextMessage)
      setDeleteTarget(null)
      setIsDeleting(false)
      return
    }

    const nextMessage = {
      success: true,
      message: response.message || 'Customer deleted successfully.',
    }
    notify(nextMessage)
    setCustomers((currentValue) =>
      currentValue.filter((customer) => customer.id !== customerToDelete.id),
    )
    if (wasViewingDeletedCustomer) {
      navigate('/people/customers')
    }
    setDeleteTarget(null)
    setIsDeleting(false)
    await loadDirectory({ silent: true })
  }

  async function handleConfirmBulkDelete() {
    if (!bulkDeleteTarget?.customers?.length) {
      return
    }

    setIsDeleting(true)

    try {
      const deletedIds = []

      for (const customer of bulkDeleteTarget.customers) {
        if (!customer?.id) {
          throw new Error(`Customer identifier is missing for ${customer?.name || 'one selected customer'}.`)
        }

        const response = await deleteCustomer(customer.id)

        if (!response.success) {
          throw new Error(getCustomerDeleteError(response.error))
        }

        deletedIds.push(customer.id)
      }

      const nextMessage = {
        success: true,
        message: `Deleted ${deletedIds.length} customer${deletedIds.length === 1 ? '' : 's'}.`,
      }
      notify(nextMessage)
      setCustomers((currentValue) =>
        currentValue.filter((customer) => !deletedIds.includes(customer.id)),
      )

      if (deletedIds.some((id) => String(customerId) === String(id))) {
        navigate('/people/customers')
      }

      bulkDeleteTarget.onComplete?.()
      setBulkDeleteTarget(null)
      await loadDirectory({ silent: true })
    } catch (error) {
      const nextMessage = {
        success: false,
        message: getCustomerDeleteError(error instanceof Error ? error.message : error),
      }
      notify(nextMessage)
      setBulkDeleteTarget(null)
    } finally {
      setIsDeleting(false)
    }
  }

  if (!canView) {
    return <AccessDenied />
  }

  return (
    <div className="page resource-center customers-page">
      <div className={customerId ? 'customers-page__details-view' : 'resource-center__page resource-center__page--customers'}>
      <div className="customers-page__top">
      {!customerId ? (
        <section className="customers-workspace-header resource-center__inventory-header" aria-label="Customer summary">
          <div className="customers-workspace-header__main resource-center__inventory-header-main">
            <div className="resource-center__inventory-metrics" aria-label="Customer metrics">
              <span className="customers-metric-badge resource-center__inventory-metric resource-center__inventory-metric--total">
                <strong>{isSummaryLoading ? '...' : dashboardMetrics.totalCustomers}</strong> Customers
              </span>
              <span className="customers-metric-badge resource-center__inventory-metric resource-center__inventory-metric--success">
                <strong>{isSummaryLoading ? '...' : dashboardMetrics.activeCustomers}</strong> Active
              </span>
              <span className="customers-metric-badge resource-center__inventory-metric resource-center__inventory-metric--danger">
                <strong>{isSummaryLoading ? '...' : Math.max(0, dashboardMetrics.totalCustomers - dashboardMetrics.activeCustomers)}</strong> Inactive
              </span>
              <span className="customers-metric-badge resource-center__inventory-metric resource-center__inventory-metric--warning">
                <strong>{isSummaryLoading ? '...' : customers.filter((customer) => Number(customer.outstandingBalance || 0) > 0).length}</strong> Pending Payments
              </span>
            </div>
          </div>
          <div className="resource-center__inventory-header-actions">
            {canCreate ? (
              <button type="button" className="button button-primary" onClick={handleOpenCreate}>
                <Plus size={16} />
                Add Customer
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      {message ? (
        <div
          className={`message-box ${message.success ? 'message-box--success' : 'message-box--error page-error-banner'
            }`}
          role={message.success ? 'status' : 'alert'}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}
        >
          <span>{message.message}</span>
          <button
            type="button"
            onClick={() => setMessage(null)}
            aria-label="Dismiss message"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              display: 'inline-flex',
              alignItems: 'center',
              color: 'inherit',
              opacity: 0.8,
              flexShrink: 0,
            }}
          >
            <X size={16} />
          </button>
        </div>
      ) : null}

      {summaryError && !customerId ? (
        <p className="customers-page__summary-warning page-error-banner" role="alert">{summaryError}</p>
      ) : null}
      </div>

      <div
        className={`content-grid content-grid--single customers-page__content-grid ${customerId ? 'customers-page__content-grid--details' : ''
          }`}
      >
        {customerId ? (
          <CustomerDetailsPanel
            customer={detailCustomer}
            history={history}
            loading={isDetailLoading}
            historyLoading={isHistoryLoading}
            canEdit={canEdit}
            canDelete={canDelete}
            onBack={handleBackToDirectory}
            onEdit={handleEdit}
            onDelete={handleRequestDelete}
            onRefresh={() => loadCustomerDetails(customerId)}
          />
        ) : (
          <CustomersTable
            customers={filteredCustomers}
            loading={isLoading}
            canEdit={canEdit}
            canDelete={canDelete}
            companyFilter={companyFilter}
            companyOptions={companyOptions}
            statusFilter={statusFilter}
            statusOptions={statusOptions}
            balanceFilter={balanceFilter}
            onCompanyFilter={setCompanyFilter}
            onStatusFilter={setStatusFilter}
            onBalanceFilter={setBalanceFilter}
            onView={handleView}
            onEdit={handleEdit}
            onDelete={handleRequestDelete}
            onBulkDelete={handleRequestBulkDelete}
            onStatusChange={canEdit ? handleRequestStatusChange : undefined}
            onRefresh={() => loadDirectory()}
          />
        )}
      </div>
      </div>

      {isFormOpen ? (
        <FormModal
          title={
            customerFormMode === 'view'
              ? 'View Customer'
              : editingCustomer
                ? 'Edit Customer'
                : 'Add Customer'
          }

          className="customer-form-modal"
          dialogClassName="customer-form-modal__dialog"
          bodyClassName="customer-form-modal__body"
          closeOnBackdropClick={false}
          onClose={handleRequestCloseForm}
        >
          <CustomerForm
            key={`${customerFormMode}-${editingCustomer?.id ?? 'new-customer'}`}
            initialValues={editingCustomer}
            activity={formActivity}
            apiErrors={formErrors}
            apiMessage={formMessage}
            isLoadingInitial={isFormPreloading}
            isSubmitting={isSaving}
            readOnly={customerFormMode === 'view'}
            canSubmit={editingCustomer ? canEdit : canCreate}
            onSubmit={handleSave}
            onCancel={handleRequestCloseForm}
            onDirtyChange={setHasUnsavedCustomerChanges}
            activeTab={activeFormTab}
            onTabChange={handleTabChange}
          />
        </FormModal>
      ) : null}

      {showDiscardConfirm ? (
        <FormModal
          title="Discard Unsaved Changes?"
          onClose={() => setShowDiscardConfirm(false)}
        >
          <div className="customer-delete-dialog">
            <div className="customer-delete-dialog__icon" style={{ background: '#fef3c7', color: '#d97706' }}>
              <AlertTriangle size={24} />
            </div>
            <div>
              <h3>Discard unsaved changes?</h3>
              <p>You have unsaved changes in this customer form. If you discard, all changes will be lost.</p>
            </div>
            <div className="button-row customer-delete-dialog__actions">
              <button
                type="button"
                className="button button-cancel button-secondary"
                onClick={() => setShowDiscardConfirm(false)}
              >
                Keep Editing
              </button>
              <button
                type="button"
                className="button button-danger"
                onClick={handleCloseForm}
              >
                Discard Changes
              </button>
            </div>
          </div>
        </FormModal>
      ) : null}

      {deleteTarget ? (
        <CustomerDeleteDialog
          customer={deleteTarget}
          isDeleting={isDeleting}
          onCancel={() => {
            if (!isDeleting) {
              setDeleteTarget(null)
              setMessage(null)
            }
          }}
          onConfirm={handleConfirmDelete}
        />
      ) : null}

      {bulkDeleteTarget ? (
        <FormModal
          title="Delete Selected Customers"
          onClose={() => {
            if (!isDeleting) {
              setBulkDeleteTarget(null)
              setMessage(null)
            }
          }}
        >
          <div className="customer-delete-dialog">
            <div className="customer-delete-dialog__icon">
              <Trash2 size={24} />
            </div>
            <div>
              <h3>
                Delete {bulkDeleteTarget.customers.length} selected customer{bulkDeleteTarget.customers.length === 1 ? '' : 's'}?
              </h3>
              <p>This action cannot be undone.</p>
              <ul className="customer-delete-dialog__list">
                {bulkDeleteTarget.customers.slice(0, 5).map((customer) => (
                  <li key={customer.id || customer.customerCode || customer.name}>
                    {customer.name || customer.customerCode || 'Unnamed customer'}
                  </li>
                ))}
                {bulkDeleteTarget.customers.length > 5 ? (
                  <li>+{bulkDeleteTarget.customers.length - 5} more</li>
                ) : null}
              </ul>
            </div>
            <div className="button-row customer-delete-dialog__actions">
              <button className="button button-cancel button-secondary"
                type="button"
                onClick={() => {
                  setBulkDeleteTarget(null)
                  setMessage(null)
                }}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button button-danger"
                onClick={handleConfirmBulkDelete}
                disabled={isDeleting}
              >
                <Trash2 size={16} />
                {isDeleting ? 'Deleting...' : 'Delete Selected'}
              </button>
            </div>
          </div>
        </FormModal>
      ) : null}

      {statusConfirmTarget ? (
        <div
          className="customers-status-confirm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="customers-status-confirm-title"
        >
          <div className="customers-status-confirm__panel">
            <div className="customers-status-confirm__content">
              <strong id="customers-status-confirm-title">
                Change customer status to {statusConfirmTarget.status}?
              </strong>
              <span>
                {statusConfirmTarget.customer?.name || 'This customer'} will be updated in the customer directory.
              </span>
            </div>
            <div className="customers-status-confirm__actions">
              <button className="button button-cancel button-secondary"
                type="button"
                onClick={() => setStatusConfirmTarget(null)}
                disabled={isUpdatingStatus}
              >
                <X size={15} />
                Cancel
              </button>
              <button
                type="button"
                className="button button-primary"
                onClick={handleConfirmStatusUpdate}
                disabled={isUpdatingStatus}
              >
                {isUpdatingStatus ? (
                  <LoaderCircle size={15} className="animate-spin" />
                ) : (
                  <Check size={15} />
                )}
                {isUpdatingStatus ? 'Updating...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
