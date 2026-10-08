import { Check, Eye, Pencil, Printer, RefreshCw, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { ActionMenu, DataTable, FilterBar, StatusBadge } from '../../../components/erp'
import { formatCreditLimit, formatCurrency } from '../../../utils/helpers'

const COLUMN_STORAGE_KEY = 'ims.customers.visibleColumns.supplierImageParity.v1'
const DEFAULT_VISIBLE_COLUMNS = [
  'name',
  'company',
  'gstNumber',
  'totalPurchases',
  'outstandingBalance',
  'lastActivity',
  'status',
  'actions',
]
const LOCKED_COLUMNS = ['name', 'actions']
const CUSTOMER_COLUMN_WIDTHS = {
  name: 220,
  email: 190,
  phone: 135,
  company: 140,
  address: 190,
  gstNumber: 150,
  totalOrders: 85,
  totalPurchases: 130,
  outstandingBalance: 130,
  creditLimit: 120,
  lastActivity: 135,
  createdAt: 125,
  status: 100,
  actions: 72,
}

function withCustomerColumnWidth(column) {
  const width = CUSTOMER_COLUMN_WIDTHS[column.key]

  if (!width) {
    return column
  }

  const widthStyle = {
    width: `${width}px`,
    minWidth: `${width}px`,
  }

  return {
    ...column,
    tableWidth: width,
    style: {
      ...column.style,
      ...widthStyle,
    },
    headerStyle: {
      ...column.headerStyle,
      ...widthStyle,
    },
  }
}

function getCustomerInitials(customer) {
  const source = String(customer?.name || customer?.company || 'Customer').trim()
  const parts = source.split(/\s+/).filter(Boolean)

  if (parts.length === 0) {
    return 'CU'
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function printCustomers(customers) {
  const rows = customers.map((customer) => `
    <tr>
      <td>${escapeHtml(customer.name)}</td>
      <td>${escapeHtml(customer.customerCode || customer.id)}</td>
      <td>${escapeHtml(customer.email)}</td>
      <td>${escapeHtml(customer.phone)}</td>
      <td>${escapeHtml(customer.company || 'Individual')}</td>
      <td>${escapeHtml(customer.status || 'Active')}</td>
      <td>${escapeHtml(formatCurrency(customer.outstandingBalance || 0))}</td>
    </tr>
  `).join('')
  const printWindow = window.open('', '_blank', 'width=1100,height=800')

  if (!printWindow) {
    return
  }

  printWindow.document.write(`
    <html>
      <head>
        <title>Customer Master</title>
        <style>
          body { font-family: Segoe UI, Arial, sans-serif; color: #0f172a; padding: 20px; }
          h1 { font-size: 18px; margin: 0 0 12px; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th, td { border: 1px solid #d1d5db; padding: 6px; text-align: left; vertical-align: middle; }
          th { background: #f8fafc; }
        </style>
      </head>
      <body>
        <h1>Customer Master</h1>
        <table>
          <thead>
            <tr>
              <th>Customer</th>
              <th>Code</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Company</th>
              <th>Status</th>
              <th>Outstanding</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </body>
    </html>
  `)
  printWindow.document.close()
  printWindow.focus()
  printWindow.print()
}

function getCustomerId(customer) {
  return customer?.id ?? customer?.customerId ?? customer?.customerCode ?? ''
}

function formatDate(value) {
  if (value === undefined || value === null || value === '') {
    return '-'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return '-'
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function getDateSortValue(value) {
  if (value === undefined || value === null || value === '') {
    return 0
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 0 : date.getTime()
}

export default function CustomersTable({
  customers,
  loading,
  canEdit,
  canDelete,
  companyFilter,
  companyOptions,
  statusFilter,
  statusOptions,
  balanceFilter,
  onCompanyFilter,
  onStatusFilter,
  onBalanceFilter,
  onView,
  onEdit,
  onDelete,
  onBulkDelete,
  onStatusChange,
  onRefresh,
}) {
  const [selectedCustomerIds, setSelectedCustomerIds] = useState([])
  const selectedCustomers = useMemo(() => {
    const selectedIdSet = new Set(selectedCustomerIds.map(String))
    return customers.filter((customer) => selectedIdSet.has(String(getCustomerId(customer))))
  }, [customers, selectedCustomerIds])
  const hasSelectedCustomers = selectedCustomers.length > 0

  function clearSelection() {
    setSelectedCustomerIds([])
  }

  function handleBulkDelete() {
    if (!canDelete || selectedCustomers.length === 0) {
      return
    }

    onBulkDelete?.(selectedCustomers, clearSelection)
  }

  const columns = useMemo(() => [
    {
      key: 'name',
      label: 'Customer',
      className: 'customers-col-name',
      mobileLabel: 'Name',
      mobilePrimary: true,
      searchValue: (customer) =>
        [
          customer.name,
          customer.customerCode,
          customer.email,
          customer.phone,
          customer.company,
          customer.address,
          customer.status,
        ].join(' '),
      render: (customer) => (
        <div className="customers-table__identity">
          <span className="customers-table__avatar" aria-hidden="true">
            {getCustomerInitials(customer)}
          </span>
          <div className="customers-page__table-stack">
            <strong title={customer.name || 'Unnamed customer'}>
              {customer.name || 'Unnamed customer'}
            </strong>
            <span title={customer.customerCode || customer.id}>
              {customer.customerCode || customer.id}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: 'email',
      label: 'Email',
      className: 'customers-col-email',
      render: (customer) => (
        <span className="customers-cell-text" title={customer.email || 'Not provided'}>
          {customer.email || 'Not provided'}
        </span>
      ),
    },
    {
      key: 'phone',
      label: 'Phone',
      className: 'customers-col-phone',
      render: (customer) => (
        <span className="customers-cell-text customers-cell-text--nowrap" title={customer.phone || 'Not provided'}>
          {customer.phone || 'Not provided'}
        </span>
      ),
    },
    {
      key: 'company',
      label: 'Company',
      className: 'customers-col-company',
      render: (customer) => (
        <span className="customers-category-badge" title={customer.company || 'Individual'}>
          {customer.company || 'Individual'}
        </span>
      ),
    },
    {
      key: 'address',
      label: 'Address',
      className: 'customers-col-address',
      mobileDescription: true,
      render: (customer) => (
        <span className="customers-cell-text customers-cell-text--wrap" title={customer.address || 'Address not set'}>
          {customer.address || 'Address not set'}
        </span>
      ),
    },
    {
      key: 'gstNumber',
      label: 'GST / PAN',
      className: 'customers-col-gst',
      render: (customer) => (
        <div className="customers-tax-stack">
          <span className={customer.gstNumber ? '' : 'is-empty'} title={customer.gstNumber || 'GST pending'}>
            {customer.gstNumber || 'GST pending'}
          </span>
          <span className={customer.panNumber ? '' : 'is-empty'} title={customer.panNumber || 'PAN pending'}>
            {customer.panNumber || 'PAN pending'}
          </span>
        </div>
      ),
    },
    {
      key: 'totalOrders',
      label: 'Orders',
      className: 'is-numeric customers-col-orders',
      render: (customer) => Number(customer.totalOrders || 0),
    },
    {
      key: 'totalPurchases',
      label: 'Purchases',
      className: 'is-numeric customers-col-purchases',
      render: (customer) => formatCurrency(customer.totalPurchases ?? customer.totalPurchaseAmount ?? customer.purchaseTotal ?? customer.totalAmount ?? 0),
    },
    {
      key: 'outstandingBalance',
      label: 'Outstanding',
      className: 'is-numeric customers-col-outstanding',
      render: (customer) => formatCurrency(customer.outstandingBalance || 0),
    },
    {
      key: 'creditLimit',
      label: 'Credit Limit',
      className: 'is-numeric customers-col-credit-limit',
      render: (customer) => formatCreditLimit(customer.creditLimit || 0, 'INR'),
    },
    {
      key: 'lastActivity',
      label: 'Last Purchase',
      className: 'customers-col-last-activity',
      render: (customer) => {
        const dateText = formatDate(customer.lastActivity || customer.updatedAt || customer.createdAt)
        const displayDate = dateText === '-' ? 'No purchases yet' : dateText

        return (
          <span className="customers-cell-text customers-cell-text--date" title={displayDate}>
            {displayDate}
          </span>
        )
      },
    },
    {
      key: 'createdAt',
      label: 'Created Date',
      className: 'customers-col-created',
      render: (customer) => {
        const dateText = formatDate(customer.createdAt)

        return (
          <span className="customers-cell-text customers-cell-text--date" title={dateText}>
            {dateText}
          </span>
        )
      },
    },
    {
      key: 'status',
      label: 'Status',
      className: 'customers-col-status',
      mobileStatus: true,
      render: (customer) => {
        const currentStatus = customer.status || 'Active'

        return (
          <StatusBadge type={String(currentStatus).toLowerCase() === 'active' ? 'active' : 'critical'}>
            {currentStatus}
          </StatusBadge>
        )
      },
    },
    {
      key: 'actions',
      label: 'Actions',
      className: 'customers-col-actions',
      searchable: false,
      render: (customer) => (
        <ActionMenu
          iconOnly
          label={`Actions for ${customer.name || 'customer'}`}
          actions={[
            {
              key: 'view',
              label: 'View',
              icon: Eye,
              onClick: () => onView(customer),
            },
            canEdit ? {
              key: 'edit',
              label: 'Edit',
              icon: Pencil,
              onClick: () => onEdit(customer),
            } : null,
            canDelete ? {
              key: 'delete',
              label: 'Delete',
              icon: Trash2,
              variant: 'danger',
              onClick: () => onDelete(customer),
            } : null,
            onStatusChange ? {
              key: 'status',
              label: String(customer.status).toLowerCase() === 'active' ? 'Deactivate' : 'Activate',
              onClick: () => onStatusChange(customer, {
                status: String(customer.status).toLowerCase() === 'active' ? 'Inactive' : 'Active',
                reason: '',
              }),
            } : null,
          ]}
        />
      ),
    },
  ], [canDelete, canEdit, onDelete, onEdit, onStatusChange, onView])
  const sizedColumns = useMemo(() => columns.map(withCustomerColumnWidth), [columns])

  const filterContent = (
    <FilterBar className="customers-page__filters" ariaLabel="Customer table filters">
      <select
        value={statusFilter}
        onChange={(event) => onStatusFilter(event.target.value)}
        aria-label="Filter customers by status"
      >
        {statusOptions.map((status) => (
          <option key={status} value={status}>
            {status === 'all' ? 'All statuses' : status}
          </option>
        ))}
      </select>
      <select
        value={companyFilter}
        onChange={(event) => onCompanyFilter(event.target.value)}
        aria-label="Filter customers by company"
      >
        {companyOptions.map((company) => (
          <option key={company} value={company}>
            {company === 'all' ? 'All companies' : company}
          </option>
        ))}
      </select>
      <select
        value={balanceFilter}
        onChange={(event) => onBalanceFilter(event.target.value)}
        aria-label="Filter customers by balance"
      >
        <option value="all">Balance</option>
        <option value="outstanding">Outstanding</option>
        <option value="clear">Clear</option>
      </select>
    </FilterBar>
  )

  const toolbarContent = (
    <FilterBar className="customers-page__toolbar-actions" ariaLabel="Customer table actions">
      <button type="button" className="button button-secondary" onClick={onRefresh} disabled={loading}>
        <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        Refresh
      </button>
    </FilterBar>
  )

  const selectedToolbarContent = hasSelectedCustomers ? (
    <FilterBar className="customers-table__selection-actions" ariaLabel="Selected customer actions">
      <div className="customers-selection-summary" aria-live="polite">
        <Check size={15} />
        <strong>{selectedCustomers.length} selected</strong>
      </div>
      <button
        type="button"
        className="button button-secondary customers-table__selection-button"
        onClick={() => printCustomers(selectedCustomers)}
      >
        <Printer size={15} />
        Print
      </button>
      {canDelete ? (
        <button
          type="button"
          className="button button-secondary customers-table__selection-button customers-table__selection-button--danger"
          onClick={handleBulkDelete}
        >
          <Trash2 size={15} />
          Delete
        </button>
      ) : null}
    </FilterBar>
  ) : null

  return (
    <div className="card resource-center__inventory-table-card customers-page__directory-card customers-page__directory-card--erp-compact customers-page__table-card--payment-reference">
      <DataTable
        className="resource-center__inventory-table customers-data-table--compact"
        rows={customers}
        columns={sizedColumns}
        loading={loading}
        searchKeys={[
          'name',
          'customerCode',
          'email',
          'phone',
          'company',
          'address',
          'status',
          'gstNumber',
          'taxNumber',
        ]}
        searchPlaceholder="Search customers by name"
        emptyMessage="No customers found."
        defaultPageSize={20}
        defaultSortKey=""
        columnStorageKey={COLUMN_STORAGE_KEY}
        defaultVisibleColumnKeys={DEFAULT_VISIBLE_COLUMNS}
        lockedColumnKeys={LOCKED_COLUMNS}
        fitExplicitColumnsToContainer
        showSearch={!hasSelectedCustomers}
        splitToolbar
        filterContent={hasSelectedCustomers ? selectedToolbarContent : filterContent}
        toolbarContent={toolbarContent}
        rowClassName={(customer) =>
          selectedCustomerIds.includes(String(getCustomerId(customer))) ? 'is-selected' : ''
        }
        enableRowSelection
        selectedRowKeys={selectedCustomerIds}
        onSelectionChange={setSelectedCustomerIds}
        keyField="id"
      />
    </div>
  )
}
