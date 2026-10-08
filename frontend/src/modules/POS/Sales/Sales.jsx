import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  Check,
  ChevronRight,
  Download,
  Eye,
  LoaderCircle,
  Mail,
  Plus,
  Printer,
  ReceiptText,
  RefreshCw,
  SlidersHorizontal,
  Trash2,
  UserRound,
} from 'lucide-react'
import {
  deleteInvoice,
  getInvoiceById,
  getInvoiceCompanyProfile,
  getInvoices,
  sendInvoiceEmail,
} from '../../../api/businessApi'
import { showToast } from '../../../components/common/toast'
import { ActionMenu, DataTable, FilterBar, StatusBadge } from '../../../components/erp'
import FormModal from '../../../layouts/FormModal'
import { useAuth } from '../../../hooks/useAuth'
import { formatCurrency, formatDate } from '../../../utils/helpers'
import InvoiceDocument from './InvoiceDocument'
import {
  buildInvoiceDocumentModel,
  validateInvoiceDocumentModel,
} from './invoiceDocumentModel'
import './Sales.css'

export const INVOICE_WORKFLOW_UPDATED_EVENT = 'ims:invoice-workflow-updated'
const PRODUCT_CATALOG_UPDATED_EVENT = 'ims:product-catalog-updated'

function getInvoiceRowKey(invoice) {
  return String(invoice?.id ?? invoice?.invoiceId ?? invoice?.invoiceNumber ?? '')
}

function getStatusKey(status, balanceAmount = 0, dueDate = '') {
  const normalizedStatus = String(status || '').trim().toLowerCase()
  const isOverdue =
    Number(balanceAmount) > 0 &&
    dueDate &&
    new Date(`${dueDate}T23:59:59`) < new Date()

  if (isOverdue) return 'overdue'
  if (normalizedStatus.includes('unpaid')) return 'unpaid'
  if (normalizedStatus.includes('partial')) return 'partial'
  if (normalizedStatus.includes('paid')) return 'paid'
  return 'unpaid'
}

function getStatusLabel(status, balanceAmount, dueDate) {
  const statusKey = getStatusKey(status, balanceAmount, dueDate)
  const labels = {
    paid: 'Paid',
    partial: 'Partial',
    overdue: 'Overdue',
    unpaid: 'Unpaid',
  }

  return labels[statusKey]
}

function InvoiceStatusBadge({ status, balanceAmount, dueDate }) {
  return <StatusBadge status={getStatusLabel(status, balanceAmount, dueDate)} />
}

export default function Sales({ customers = [] }) {
  const { hasPermission } = useAuth()
  const navigate = useNavigate()
  const [invoices, setInvoices] = useState([])
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [actionId, setActionId] = useState('')
  const [detailsTarget, setDetailsTarget] = useState(null)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [detailedInvoice, setDetailedInvoice] = useState(null)
  const [detailDocumentModel, setDetailDocumentModel] = useState(null)
  const [printDocumentModel, setPrintDocumentModel] = useState(null)

  const [statusFilter, setStatusFilter] = useState('all')

  const canCreate = hasPermission('sales', 'create') || hasPermission('accounting', 'create')
  const canDelete = hasPermission('sales', 'delete') || hasPermission('accounting', 'delete')

  const loadInvoiceWorkspace = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setIsLoading(true)
    }

    setError('')

    try {
      const response = await getInvoices()

      if (response.success) {
        const rawList = response.data ?? []
        const enrichedList = await Promise.all(
          rawList.map(async (inv) => {
            const id = inv.invoiceId || inv.id
            if (id) {
              try {
                const detailRes = await getInvoiceById(id)
                if (detailRes.success && detailRes.data) {
                  return {
                    ...inv,
                    ...detailRes.data,
                    items: detailRes.data.items || [],
                    itemCount: detailRes.data.items?.length || detailRes.data.itemCount || inv.itemCount || 1,
                  }
                }
              } catch {
                // fallback to inv if detail fetch fails
              }
            }
            return inv
          })
        )
        setInvoices(enrichedList)
      } else {
        setInvoices([])
        setError(response.error || 'Unable to load invoice workspace.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load invoice workspace.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadInvoiceWorkspace()
  }, [loadInvoiceWorkspace])

  const summary = useMemo(() => {
    const totalValue = invoices.reduce(
      (sum, invoice) => sum + Number(invoice.totalAmount || 0),
      0,
    )
    const paidValue = invoices.reduce(
      (sum, invoice) => sum + Number(invoice.paidAmount || 0),
      0,
    )
    const balanceValue = invoices.reduce(
      (sum, invoice) => sum + Number(invoice.balanceAmount || 0),
      0,
    )
    const overdueCount = invoices.filter((invoice) =>
      getStatusKey(invoice.status, invoice.balanceAmount, invoice.dueDate) === 'overdue',
    ).length

    return {
      total: invoices.length,
      totalValue,
      paidValue,
      balanceValue,
      overdueCount,
    }
  }, [invoices])

  const selectedInvoices = useMemo(() => {
    const selectedSet = new Set(selectedInvoiceIds.map(String))
    return invoices.filter((invoice) => selectedSet.has(getInvoiceRowKey(invoice)))
  }, [invoices, selectedInvoiceIds])

  const tableInvoices = useMemo(
    () => invoices.map((invoice, index) => ({
      ...invoice,
      __rowKey: getInvoiceRowKey(invoice) || `invoice-${index}`,
    })),
    [invoices],
  )

  const filteredInvoices = useMemo(() => {
    if (statusFilter === 'all') {
      return tableInvoices
    }
    return tableInvoices.filter((invoice) => {
      const key = getStatusKey(invoice.status, invoice.balanceAmount, invoice.dueDate)
      return key === statusFilter
    })
  }, [statusFilter, tableInvoices])

  async function prepareInvoiceDocument(invoice) {
    const id = invoice.invoiceId || invoice.id
    if (!id) {
      throw new Error('Invoice identifier is unavailable. The invoice was not generated.')
    }

    const [invoiceResponse, companyResponse] = await Promise.all([
      getInvoiceById(id),
      getInvoiceCompanyProfile(),
    ])

    if (!invoiceResponse.success || !invoiceResponse.data) {
      throw new Error(invoiceResponse.error || 'Unable to load complete invoice data.')
    }

    const fullInvoice = {
      ...invoice,
      ...invoiceResponse.data,
      items: invoiceResponse.data.items?.length
        ? invoiceResponse.data.items
        : invoice.items || [],
    }
    const customer = customers.find(
      (entry) => String(entry.id ?? entry.customerId) === String(fullInvoice.customerId),
    )
    const model = buildInvoiceDocumentModel(fullInvoice, {
      customer,
      companyProfile: companyResponse.success ? companyResponse.data : {},
    })
    const validationError = validateInvoiceDocumentModel(model)

    if (validationError) {
      throw new Error(validationError)
    }

    return { fullInvoice, model }
  }

  async function handleDownloadPdf(invoice) {
    const id = invoice.invoiceId || invoice.id
    setActionId(`pdf-${id}`)

    try {
      const { model } = await prepareInvoiceDocument(invoice)
      const { downloadProfessionalInvoicePdf } = await import('./invoicePdf')
      await downloadProfessionalInvoicePdf(model)
      showToast({
        type: 'success',
        title: 'Invoices',
        message: 'Invoice PDF downloaded.',
      })
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Invoices',
        message: err instanceof Error ? err.message : 'Unable to generate invoice PDF.',
      })
    } finally {
      setActionId('')
    }
  }

  async function handlePrintInvoice(invoice) {
    const id = invoice.invoiceId || invoice.id
    setActionId(`print-${id}`)

    try {
      const { model } = await prepareInvoiceDocument(invoice)
      setPrintDocumentModel(model)

      await new Promise((resolve) => {
        window.requestAnimationFrame(() => window.requestAnimationFrame(resolve))
      })

      if (document.fonts?.ready) {
        await document.fonts.ready
      }

      const printImages = [...document.querySelectorAll('.invoice-document--print-root img')]
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
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Invoices',
        message: err instanceof Error ? err.message : 'Unable to prepare invoice for printing.',
      })
    } finally {
      document.body.classList.remove('invoice-print-active')
      setPrintDocumentModel(null)
      setActionId('')
    }
  }

  async function handleSendEmail(invoice) {
    const id = invoice.invoiceId || invoice.id
    setActionId(`email-${id}`)

    try {
      const response = await sendInvoiceEmail(id)

      showToast({
        type: response.success ? 'success' : 'error',
        title: 'Invoices',
        message: response.message || response.error || 'Unable to send invoice email.',
      })
    } finally {
      setActionId('')
    }
  }

  async function confirmDeleteInvoice() {
    if (!deleteTarget) {
      return
    }

    const targets = deleteTarget.invoices || [deleteTarget]
    const ids = targets.map((invoice) => invoice.invoiceId || invoice.id)
    setActionId(deleteTarget.invoices ? 'delete-selected' : `delete-${ids[0]}`)

    try {
      const responses = await Promise.all(ids.map((id) => deleteInvoice(id)))
      const failedResponse = responses.find((response) => !response.success)

      if (failedResponse) {
        showToast({
          type: 'error',
          title: 'Invoices',
          message: failedResponse.error || 'One or more invoices could not be deleted.',
        })
        await loadInvoiceWorkspace({ silent: true })
        return
      }

      const deletedIds = new Set(ids.map(String))
      setInvoices((currentValue) =>
        currentValue.filter((invoice) =>
          !deletedIds.has(String(invoice.invoiceId || invoice.id))),
      )
      setSelectedInvoiceIds([])
      setDeleteTarget(null)
      window.dispatchEvent(new CustomEvent(INVOICE_WORKFLOW_UPDATED_EVENT))
      showToast({
        type: 'success',
        title: 'Invoices',
        message: targets.length === 1
          ? 'Invoice deleted successfully.'
          : `${targets.length} invoices deleted successfully.`,
      })
    } finally {
      setActionId('')
    }
  }

  async function handleViewDetails(invoice) {
    setDetailsTarget(invoice)
    setDetailsLoading(true)
    setDetailedInvoice(null)
    setDetailDocumentModel(null)
    try {
      const { fullInvoice, model } = await prepareInvoiceDocument(invoice)
      setDetailedInvoice(fullInvoice)
      setDetailDocumentModel(model)
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Invoices',
        message: err instanceof Error ? err.message : 'Unable to load invoice details.',
      })
      setDetailsTarget(null)
    } finally {
      setDetailsLoading(false)
    }
  }

  const invoiceColumns = [
    {
      key: 'invoiceNumber',
      label: 'Invoice',
      sortable: true,
      mobilePrimary: true,
      tableWidth: 250,
      style: { width: 250, minWidth: 230 },
      headerStyle: { width: 250, minWidth: 230 },
      searchValue: (invoice) =>
        `${invoice.invoiceNumber || invoice.invoiceId || invoice.id} ${invoice.customerName || invoice.customer || ''} ${invoice.status || ''}`,
      render: (invoice) => {
        const id = invoice.invoiceId || invoice.id

        return (
          <div className="catalog-page__tree-cell">
            <button
              type="button"
              className="catalog-page__tree-toggle"
              onClick={(e) => {
                e.stopPropagation()
                handleViewDetails(invoice)
              }}
              title="View Invoice Details"
            >
              <ChevronRight size={16} />
            </button>
            <ReceiptText size={16} className="catalog-page__tree-icon" />
            <div className="catalog-page__entity">
              <strong>{invoice.invoiceNumber || `INV-${id}`}</strong>
              {invoice.dueDate ? <span>Due {formatDate(invoice.dueDate)}</span> : null}
            </div>
          </div>
        )
      },
    },
    {
      key: 'customerName',
      label: 'Customer',
      sortable: true,
      tableWidth: 170,
      style: { width: 170, minWidth: 150 },
      headerStyle: { width: 170, minWidth: 150 },
      searchValue: (invoice) => invoice.customerName || invoice.customer || '',
      render: (invoice) => (
        <div className="sales-page__customer-cell">
          <UserRound size={15} />
          <span style={{ whiteSpace: 'nowrap' }}>{invoice.customerName || invoice.customer || 'No customer'}</span>
        </div>
      ),
    },
    {
      key: 'invoiceDate',
      label: 'Date',
      sortable: true,
      tableWidth: 170,
      style: { width: 170, minWidth: 150 },
      headerStyle: { width: 170, minWidth: 150 },
      sortValue: (invoice) => new Date(invoice.invoiceDate || 0).getTime() || 0,
      render: (invoice) => (
        <span style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>
          {invoice.invoiceDate ? formatDate(invoice.invoiceDate) : 'Not set'}
        </span>
      ),
    },
    {
      key: 'itemCount',
      label: 'Items',
      sortable: true,
      tableWidth: 90,
      style: { width: 90, minWidth: 80, textAlign: 'center' },
      headerStyle: { width: 90, minWidth: 80, textAlign: 'center' },
      render: (invoice) => (
        <span style={{ display: 'inline-block', width: '100%', textAlign: 'center', fontWeight: 600 }}>
          {invoice.items?.length ? invoice.items.length : (invoice.itemCount || 1)}
        </span>
      ),
    },
    {
      key: 'totalAmount',
      label: 'Total',
      sortable: true,
      tableWidth: 120,
      style: { width: 120, minWidth: 110 },
      headerStyle: { width: 120, minWidth: 110 },
      sortValue: (invoice) => Number(invoice.totalAmount || 0),
      render: (invoice) => (
        <strong style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>
          {formatCurrency(invoice.totalAmount)}
        </strong>
      ),
    },
    {
      key: 'paidAmount',
      label: 'Paid',
      sortable: true,
      tableWidth: 150,
      style: { width: 150, minWidth: 140 },
      headerStyle: { width: 150, minWidth: 140 },
      sortValue: (invoice) => Number(invoice.paidAmount || 0),
      render: (invoice) => (
        <div className="sales-page__money-stack">
          <strong style={{ whiteSpace: 'nowrap' }}>{formatCurrency(invoice.paidAmount)}</strong>
          <span style={{ whiteSpace: 'nowrap' }}>Balance {formatCurrency(invoice.balanceAmount)}</span>
        </div>
      ),
    },
    {
      key: 'paymentMethod',
      label: 'Payment Method',
      sortable: true,
      tableWidth: 140,
      style: { width: 140, minWidth: 120 },
      headerStyle: { width: 140, minWidth: 120 },
      render: (invoice) => (
        <span style={{ fontWeight: 600 }}>
          {invoice.paymentMethod || 'N/A'}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      mobileStatus: true,
      tableWidth: 100,
      style: { width: 100, minWidth: 90 },
      headerStyle: { width: 100, minWidth: 90 },
      render: (invoice) => (
        <InvoiceStatusBadge
          status={invoice.status}
          balanceAmount={invoice.balanceAmount}
          dueDate={invoice.dueDate}
        />
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      searchable: false,
      hideable: false,
      className: 'sales-page__col-actions',
      tableWidth: 80,
      style: { width: 80, minWidth: 70, maxWidth: 80 },
      headerStyle: { width: 80, minWidth: 70, maxWidth: 80 },
      render: (invoice) => {
        const id = invoice.invoiceId || invoice.id

        return (
          <ActionMenu
            iconOnly
            label={`Actions for ${invoice.invoiceNumber || id}`}
            actions={[
              {
                key: 'details',
                label: 'View Details',
                icon: Eye,
                onClick: () => handleViewDetails(invoice),
              },
              {
                key: 'pdf',
                label: actionId === `pdf-${id}` ? 'Downloading...' : 'Download PDF',
                icon: actionId === `pdf-${id}` ? LoaderCircle : Download,
                disabled: actionId === `pdf-${id}`,
                onClick: () => handleDownloadPdf(invoice),
              },
              {
                key: 'print',
                label: actionId === `print-${id}` ? 'Preparing print...' : 'Print Invoice',
                icon: actionId === `print-${id}` ? LoaderCircle : Printer,
                disabled: actionId === `print-${id}`,
                onClick: () => handlePrintInvoice(invoice),
              },
              {
                key: 'email',
                label: actionId === `email-${id}` ? 'Sending...' : 'Send Email',
                icon: actionId === `email-${id}` ? LoaderCircle : Mail,
                disabled: actionId === `email-${id}`,
                onClick: () => handleSendEmail(invoice),
              },
              canDelete ? {
                key: 'delete',
                label: 'Delete',
                icon: Trash2,
                variant: 'danger',
                disabled: actionId === `delete-${id}`,
                onClick: () => setDeleteTarget(invoice),
              } : null,
            ]}
          />
        )
      },
    },
  ]

  return (
    <div className="page sales-page">
      <header className="sales-page__compact-header" aria-label="Sales invoice summary">
        <div className="sales-page__compact-main">
          <h1>Sales</h1>
          <div className="sales-page__metrics" aria-label="Invoice metrics">
            <span className="sales-page__metric sales-page__metric--success">
              {summary.total} Invoices
            </span>
            <span className="sales-page__metric sales-page__metric--info">
              {formatCurrency(summary.totalValue)} Sales
            </span>
            <span className="sales-page__metric sales-page__metric--warning">
              {formatCurrency(summary.balanceValue)} Outstanding
            </span>
            <span className="sales-page__metric sales-page__metric--value">
              {formatCurrency(summary.paidValue)} Paid
            </span>
          </div>
        </div>
        {canCreate ? (
          <button
            type="button"
            className="button button-primary sales-page__add-button"
            onClick={() => navigate('/pos/sales/create')}
          >
            <Plus size={16} />
            Create Invoice
          </button>
        ) : null}
      </header>

      {error ? (
        <div className="message-box message-box--error page-error-banner" role="alert">
          <span>{error}</span>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => loadInvoiceWorkspace()}
            disabled={isLoading}
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            Retry
          </button>
        </div>
      ) : null}

      <div className="card sales-page__table-card">
        <DataTable
          className="sales-page__table"
          rows={filteredInvoices}
          columns={invoiceColumns}
          loading={isLoading}
          defaultPageSize={20}
          defaultSortKey="invoiceDate"
          defaultSortDirection="desc"
          splitToolbar
          showSearch={selectedInvoices.length === 0}
          searchPlaceholder="Search sales by invoice, customer, or status"
          toolbarContent={selectedInvoices.length === 0 ? (
            <FilterBar className="sales-page__toolbar-actions">
              <button
                type="button"
                className="button button-secondary"
                onClick={() => loadInvoiceWorkspace()}
                disabled={isLoading}
              >
                <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
                Refresh
              </button>
            </FilterBar>
          ) : null}
          filterContent={selectedInvoices.length === 0 ? (
            <div className="sales-page__filters">
              <div className="sales-page__status-filter">
                <SlidersHorizontal size={15} />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  aria-label="Filter by status"
                >
                  <option value="all">All statuses</option>
                  <option value="paid">Paid</option>
                  <option value="partial">Partial</option>
                  <option value="unpaid">Unpaid</option>
                  <option value="overdue">Overdue</option>
                </select>
              </div>
            </div>
          ) : (
            <FilterBar className="sales-page__selection-actions" ariaLabel="Selected invoice actions">
              <div className="sales-selection-summary" aria-live="polite">
                <Check size={15} />
                <strong>{selectedInvoices.length} selected</strong>
              </div>
              <button
                type="button"
                className="button button-secondary sales-page__selection-button"
                onClick={async () => {
                  for (const invoice of selectedInvoices) {
                    await handleDownloadPdf(invoice)
                  }
                }}
                disabled={Boolean(actionId)}
              >
                <Download size={15} />
                PDFs
              </button>
              <button
                type="button"
                className="button button-secondary sales-page__selection-button"
                onClick={async () => {
                  for (const invoice of selectedInvoices) {
                    await handleSendEmail(invoice)
                  }
                }}
                disabled={Boolean(actionId)}
              >
                <Mail size={15} />
                Email
              </button>
              {canDelete ? (
                <button
                  type="button"
                  className="button button-secondary sales-page__selection-button sales-page__selection-button--danger"
                  onClick={() => setDeleteTarget({ invoices: selectedInvoices })}
                  disabled={Boolean(actionId)}
                >
                  <Trash2 size={15} />
                  Delete
                </button>
              ) : null}
            </FilterBar>
          )}
          columnStorageKey="ims.sales.visibleColumns.compact.v3"
          defaultVisibleColumnKeys={['invoiceNumber', 'customerName', 'invoiceDate', 'itemCount', 'totalAmount', 'paidAmount', 'paymentMethod', 'status', 'actions']}
          fitExplicitColumnsToContainer
          enableRowSelection
          selectedRowKeys={selectedInvoiceIds}
          onSelectionChange={setSelectedInvoiceIds}
          keyField="__rowKey"
          emptyMessage="No invoices available."
        />
      </div>



      {deleteTarget ? (
        <FormModal
          title="Delete Invoice"
          onClose={() => (actionId ? undefined : setDeleteTarget(null))}
          dialogClassName="sales-page__confirm-dialog"
        >
          <div className="sales-page__confirm-content">
            <div className="sales-page__confirm-icon">
              <AlertCircle size={22} />
            </div>
            <div>
              <h3>
                {deleteTarget.invoices
                  ? `${deleteTarget.invoices.length} selected invoices`
                  : deleteTarget.invoiceNumber || `Invoice ${deleteTarget.id}`}
              </h3>
              <p>
                {deleteTarget.invoices
                  ? 'This removes the selected invoice records and reverses their recorded stock deductions.'
                  : 'This removes the invoice record and reverses the stock deduction recorded for it.'}
              </p>
            </div>
          </div>
          <div className="button-row sales-page__confirm-actions">
            <button className="button button-cancel button-secondary"
              type="button"
              onClick={() => setDeleteTarget(null)}
              disabled={Boolean(actionId)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="button button-danger"
              onClick={confirmDeleteInvoice}
              disabled={Boolean(actionId)}
            >
              {actionId ? <LoaderCircle size={16} className="animate-spin" /> : <Trash2 size={16} />}
              {deleteTarget.invoices ? 'Delete Invoices' : 'Delete Invoice'}
            </button>
          </div>
        </FormModal>
      ) : null}

      {detailsTarget ? (
        <FormModal
          title={detailedInvoice ? `Invoice Preview: ${detailedInvoice.invoiceNumber || detailedInvoice.id}` : 'Loading Invoice Preview...'}
          subtitle={detailedInvoice?.invoiceDate ? `Issued on ${formatDate(detailedInvoice.invoiceDate)}` : 'Please wait while we fetch the complete invoice information.'}
          onClose={() => {
            if (!detailsLoading) {
              setDetailsTarget(null)
              setDetailedInvoice(null)
              setDetailDocumentModel(null)
            }
          }}
          dialogClassName="invoice-details-modal"
        >
          {detailsLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
              <LoaderCircle className="animate-spin" size={32} style={{ color: '#684cda' }} />
            </div>
          ) : detailedInvoice && detailDocumentModel ? (
            <div className="invoice-details">
              <InvoiceDocument model={detailDocumentModel} />

              <div className="invoice-details__actions">
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => handleDownloadPdf(detailedInvoice)}
                  disabled={actionId === `pdf-${detailedInvoice.invoiceId || detailedInvoice.id}`}
                >
                  {actionId === `pdf-${detailedInvoice.invoiceId || detailedInvoice.id}` ? <LoaderCircle className="animate-spin" size={15} /> : <Download size={15} />}
                  Download PDF
                </button>
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => handlePrintInvoice(detailedInvoice)}
                  disabled={actionId === `print-${detailedInvoice.invoiceId || detailedInvoice.id}`}
                >
                  {actionId === `print-${detailedInvoice.invoiceId || detailedInvoice.id}` ? <LoaderCircle className="animate-spin" size={15} /> : <Printer size={15} />}
                  Print Invoice
                </button>
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => handleSendEmail(detailedInvoice)}
                  disabled={actionId === `email-${detailedInvoice.invoiceId || detailedInvoice.id}`}
                >
                  {actionId === `email-${detailedInvoice.invoiceId || detailedInvoice.id}` ? <LoaderCircle className="animate-spin" size={15} /> : <Mail size={15} />}
                  Send Email
                </button>
                <button
                  type="button"
                  className="button button-primary"
                  onClick={() => {
                    setDetailsTarget(null)
                    setDetailedInvoice(null)
                    setDetailDocumentModel(null)
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            <p style={{ textAlign: 'center', margin: '20px 0' }}>Failed to load invoice details.</p>
          )}
        </FormModal>
      ) : null}

      {printDocumentModel
        ? createPortal(
            <InvoiceDocument model={printDocumentModel} printRoot />,
            document.body,
          )
        : null}
    </div>
  )
}
