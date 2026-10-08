import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Eye, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { ActionMenu, DataTable, FilterBar } from '../../../components/erp'
import StateBlock from '../../../components/common/StateBlock'
import { showToast } from '../../../components/common/toast'
import FormModal from '../../../layouts/FormModal'
import { getSalesReturns, deleteSalesReturn } from '../../../api/salesReturnApi'
import { getCustomers } from '../../../api/customersApi'
import { formatCurrency, formatDate } from '../../../utils/helpers'
import './SalesReturns.css'

export default function SalesReturns() {
  const navigate = useNavigate()

  const [returns, setReturns] = useState([])
  const [customersList, setCustomersList] = useState([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [customerFilter, setCustomerFilter] = useState('')

  const [selectedRowKeys, setSelectedRowKeys] = useState([])
  const [deleteTargetId, setDeleteTargetId] = useState(null)
  const [deleting, setDeleting] = useState(false)

  // Fetch Sales Returns & Customers from Backend API
  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [returnsRes, customersRes] = await Promise.allSettled([
        getSalesReturns(),
        getCustomers(),
      ])

      // Handle Customers lookup for filter dropdown
      const cusList = customersRes.status === 'fulfilled' && customersRes.value?.success
        ? (Array.isArray(customersRes.value.data) ? customersRes.value.data : [])
        : []
      setCustomersList(cusList)

      // Handle Sales Returns from API
      if (returnsRes.status === 'fulfilled' && returnsRes.value?.success) {
        const rawList = Array.isArray(returnsRes.value.data) ? returnsRes.value.data : []
        setReturns(rawList.filter(Boolean))
      } else if (returnsRes.status === 'fulfilled' && returnsRes.value) {
        const errStr = typeof returnsRes.value.error === 'string'
          ? returnsRes.value.error
          : typeof returnsRes.value.message === 'string'
          ? returnsRes.value.message
          : 'Unable to connect to the server.'
        setError(errStr)
        setReturns([])
      } else if (returnsRes.status === 'rejected') {
        const errStr = returnsRes.reason instanceof Error
          ? returnsRes.reason.message
          : 'Failed to load sales returns.'
        setError(errStr)
        setReturns([])
      } else {
        setReturns([])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading sales returns.')
      setReturns([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Filter returns based on customer filter dropdown
  const filteredReturns = useMemo(() => {
    const list = Array.isArray(returns) ? returns.filter(Boolean) : []
    if (!customerFilter) return list
    return list.filter((item) => String(item.customerId || item.customer_id) === String(customerFilter))
  }, [returns, customerFilter])

  // Header Metrics Summary
  const stats = useMemo(() => {
    const list = Array.isArray(returns) ? returns.filter(Boolean) : []
    const total = list.length
    const uniqueCustomers = new Set(
      list.map((item) => item.customerId || item.customer_id).filter(Boolean)
    ).size
    const totalAmount = list.reduce(
      (sum, item) => sum + (Number(item.totalAmount || item.totalReturnAmount) || 0),
      0
    )

    return {
      total,
      customers: uniqueCustomers,
      totalAmount,
    }
  }, [returns])

  // Delete Handler
  const handleDeleteConfirm = async () => {
    if (!deleteTargetId) return
    setDeleting(true)
    try {
      const res = await deleteSalesReturn(deleteTargetId)
      if (res && res.success) {
        showToast('Sales return deleted successfully.', 'success')
        fetchData()
      } else {
        showToast(res?.error || res?.message || 'Failed to delete sales return on server.', 'error')
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete sales return.', 'error')
    } finally {
      setDeleting(false)
      setDeleteTargetId(null)
    }
  }

  // Format Return Number (SRR-XXXXXX)
  const formatReturnCode = (val) => {
    if (!val) return '-'
    const str = String(val).trim().replace(/^#/, '')
    if (/^SRR-\d{6}$/i.test(str)) return str.toUpperCase()
    const digits = str.replace(/\D/g, '')
    if (digits) return `SRR-${digits.padStart(6, '0')}`
    return str.startsWith('SRR-') ? str : `SRR-${str}`
  }

  // DataTable Column Definitions matching Purchase Indents UI
  const columns = useMemo(() => [
    {
      key: 'returnNumber',
      label: 'Return ID',
      sortable: true,
      mobilePrimary: true,
      tableWidth: 160,
      style: { width: 160, minWidth: 160 },
      headerStyle: { width: 160, minWidth: 160 },
      searchValue: (row) =>
        `${formatReturnCode(row.returnNumber || row.salesReturnId)} ${row.customerName || ''} ${row.invoiceNumber || ''} ${row.reason || ''}`,
      render: (row) => (
        <span className="font-semibold text-primary" style={{ cursor: 'pointer' }} onClick={() => navigate(`/pos/returns/${row.salesReturnId || row.id}`)}>
          {formatReturnCode(row.returnNumber || row.salesReturnId || row.id)}
        </span>
      ),
    },
    {
      key: 'invoiceNumber',
      label: 'Invoice',
      sortable: true,
      tableWidth: 160,
      style: { width: 160, minWidth: 160 },
      headerStyle: { width: 160, minWidth: 160 },
      render: (row) => {
        const invId = row.invoiceId || row.invoice_id
        const invNum = row.invoiceNumber || (invId ? `INV-${String(invId).padStart(6, '0')}` : '-')
        return <span className="invoice-badge">{invNum}</span>
      },
    },
    {
      key: 'customerName',
      label: 'Customer',
      sortable: true,
      tableWidth: 200,
      style: { width: 200, minWidth: 200 },
      headerStyle: { width: 200, minWidth: 200 },
      render: (row) => row.customerName || (row.customerId ? `Customer #${row.customerId}` : '-'),
    },
    {
      key: 'returnDate',
      label: 'Return Date',
      sortable: true,
      tableWidth: 140,
      style: { width: 140, minWidth: 140 },
      headerStyle: { width: 140, minWidth: 140 },
      render: (row) => (row.returnDate ? formatDate(row.returnDate) : '-'),
    },
    {
      key: 'totalAmount',
      label: 'Total Amount',
      sortable: true,
      tableWidth: 150,
      style: { width: 150, minWidth: 150 },
      headerStyle: { width: 150, minWidth: 150 },
      render: (row) => (
        <span className="font-semibold" style={{ color: '#1e293b' }}>
          {formatCurrency(Number(row.totalAmount || row.totalReturnAmount) || 0)}
        </span>
      ),
    },
    {
      key: 'reason',
      label: 'Reason',
      sortable: true,
      tableWidth: 240,
      style: { width: 240, minWidth: 240 },
      headerStyle: { width: 240, minWidth: 240 },
      render: (row) => (
        <span className="reason-cell" title={row.reason || ''}>
          {row.reason ? (row.reason.length > 45 ? `${row.reason.slice(0, 45)}...` : row.reason) : '-'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      searchable: false,
      hideable: false,
      className: 'purchases-page__col-actions',
      tableWidth: 80,
      style: { width: 80, minWidth: 80, maxWidth: 80 },
      headerStyle: { width: 80, minWidth: 80, maxWidth: 80 },
      render: (row) => {
        const retId = row.salesReturnId || row.id || row.returnId
        return (
          <ActionMenu
            iconOnly
            label={`Actions for ${formatReturnCode(row.returnNumber || retId)}`}
            menuKey={retId}
            className="purchases-page__row-actions"
            actions={[
              {
                key: 'view',
                label: 'View Details',
                icon: Eye,
                onClick: () => navigate(`/pos/returns/${retId}`),
              },
              {
                key: 'edit',
                label: 'Edit',
                icon: Pencil,
                onClick: () => navigate(`/pos/returns/edit/${retId}`),
              },
              {
                key: 'delete',
                label: 'Delete',
                icon: Trash2,
                tone: 'danger',
                onClick: () => setDeleteTargetId(retId),
              },
            ]}
          />
        )
      },
    },
  ], [navigate])

  const hasSelection = selectedRowKeys.length > 0

  // Selection toolbar matching Purchase Indents
  const selectionToolbar = hasSelection ? (
    <FilterBar className="resource-center__product-style-selection-actions" ariaLabel="Selected sales returns actions">
      <div className="resource-center__product-style-selection-summary" aria-live="polite">
        <Check size={15} />
        <strong>{selectedRowKeys.length} selected</strong>
      </div>
    </FilterBar>
  ) : (
    <FilterBar className="purchases-page__table-actions" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <div className="filter-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <select
          id="customer-filter-select"
          value={customerFilter}
          onChange={(e) => setCustomerFilter(e.target.value)}
          style={{
            height: '38px',
            padding: '0 32px 0 12px',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: '500',
            color: '#334155',
            backgroundColor: '#ffffff',
            cursor: 'pointer',
          }}
        >
          <option value="">All Customers</option>
          {customersList.map((c) => {
            if (!c) return null
            const cId = String(c.id ?? c.customerId ?? c.customer_id)
            return (
              <option key={cId} value={cId}>
                {c.name || c.customerName || `Customer #${cId}`}
              </option>
            )
          })}
        </select>
      </div>

      <button
        type="button"
        className="button button-secondary"
        onClick={fetchData}
        disabled={loading}
      >
        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        Refresh
      </button>
    </FilterBar>
  )

  if (error) {
    return (
      <main className="sales-returns-page">
        <PageHeader title="Sales Returns" />
        <div className="card sales-returns-error-card" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <RefreshCw size={24} style={{ color: '#ef4444' }} />
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: '0 0 4px 0' }}>We could not load this workspace</h3>
            <p style={{ margin: 0, color: '#64748b' }}>{String(error)}</p>
          </div>
          <button className="erp-button erp-button--primary" onClick={fetchData} type="button">
            Retry
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="sales-returns-page">
      {/* Compact Header matching Purchase Indents */}
      <header className="purchases-page__compact-header">
        <div className="purchases-page__compact-main">
          <h1>Sales Returns</h1>
          <div className="purchases-page__metrics">
            <span className="purchases-page__metric purchases-page__metric--info">
              {stats.total} Returns
            </span>
            <span className="purchases-page__metric purchases-page__metric--warning">
              {stats.customers} Customers
            </span>
            <span className="purchases-page__metric purchases-page__metric--success">
              {formatCurrency(stats.totalAmount)} Total Returned
            </span>
          </div>
        </div>
        <button
          type="button"
          className="button button-primary"
          onClick={() => navigate('/pos/returns/create')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <Plus size={16} />
          Create Sales Return
        </button>
      </header>

      {/* Main DataTable Card matching Purchase Indents UI */}
      <div className="card purchases-page__table-card">
        <DataTable
          className="purchases-page__table"
          rows={filteredReturns}
          columns={columns}
          loading={loading}
          defaultPageSize={20}
          defaultSortKey="returnDate"
          defaultSortDirection="desc"
          splitToolbar
          toolbarContent={selectionToolbar}
          enableRowSelection={true}
          hideSelectionSummary={true}
          selectedRowKeys={selectedRowKeys}
          onSelectionChange={setSelectedRowKeys}
          keyField="salesReturnId"
          showSearch={!hasSelection}
          showColumnControls={!hasSelection}
          columnStorageKey="ims.sales-returns.visibleColumns.v1"
          defaultVisibleColumnKeys={['returnNumber', 'invoiceNumber', 'customerName', 'returnDate', 'totalAmount', 'reason', 'actions']}
          fitExplicitColumnsToContainer={false}
          searchPlaceholder="Search by Return ID, Invoice #, Customer, or Reason"
          emptyMessage="No sales returns found."
        />
      </div>

      {/* Delete Confirmation Modal */}
      {deleteTargetId && (
        <FormModal
          isOpen={Boolean(deleteTargetId)}
          title="Delete Sales Return?"
          onClose={() => setDeleteTargetId(null)}
        >
          <div className="delete-confirm-content">
            <p>This action will permanently delete this sales return and its associated items.</p>
            <p className="delete-warning">Return ID: #{deleteTargetId}</p>

            <div className="form-modal-actions">
              <button
                className="erp-button erp-button--secondary"
                type="button"
                disabled={deleting}
                onClick={() => setDeleteTargetId(null)}
              >
                Cancel
              </button>
              <button
                className="erp-button erp-button--danger"
                type="button"
                disabled={deleting}
                onClick={handleDeleteConfirm}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </FormModal>
      )}
    </main>
  )
}
