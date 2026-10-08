import { Ban, Check, Download, Eye, Mail, Pencil, Printer, RefreshCw, ShoppingCart, Trash2 } from 'lucide-react'
import { useMemo } from 'react'
import { ActionMenu, DataTable, FilterBar, StatusBadge } from '../../../../components/erp'
import { formatDate, formatIndentNumber } from '../../../../utils/helpers'

const EMPTY_VALUE = 'Not Available'
const NOT_ASSIGNED = 'Not Assigned'
const DEFAULT_STATUS = 'Pending'
const DEFAULT_PRIORITY = 'Medium'

function getIndentNumber(indent) {
  return formatIndentNumber(indent)
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

function getBadgeStatus(statusKind) {
  if (statusKind === 'approved') {
    return 'success'
  }

  if (statusKind === 'rejected') {
    return 'failed'
  }

  if (statusKind === 'converted') {
    return 'info'
  }

  return 'warning'
}

function getItemQuantity(item) {
  return Number(item?.requiredQty ?? item?.quantity ?? 0)
}

function getIndentQuantity(indent) {
  if (Array.isArray(indent?.items) && indent.items.length > 0) {
    return indent.items.reduce((sum, item) => sum + getItemQuantity(item), 0)
  }

  return Number(indent?.totalQuantity ?? indent?.requiredQty ?? indent?.quantity ?? 0)
}

function getProductId(item) {
  return item?.productId || item?.id
}

function getProductNameFromList(products, productId) {
  if (!productId) {
    return ''
  }

  const product = products.find((item) =>
    String(item?.productId ?? item?.id) === String(productId)
  )

  return product?.name || product?.productName || ''
}

function getItemProductName(item, products = []) {
  return (
    item?.productName ||
    item?.name ||
    getProductNameFromList(products, getProductId(item)) ||
    EMPTY_VALUE
  )
}

function getIndentProductsText(indent, products = []) {
  if (Array.isArray(indent?.items) && indent.items.length > 0) {
    return indent.items.map((item) => getItemProductName(item, products)).join('; ')
  }

  return (
    indent?.productName ||
    getProductNameFromList(products, indent?.productId) ||
    EMPTY_VALUE
  )
}

function getFirstProductSummary(indent, products = []) {
  if (Array.isArray(indent?.items) && indent.items.length > 0) {
    const firstProductName = getItemProductName(indent.items[0], products)
    return indent.items.length === 1
      ? firstProductName
      : `${firstProductName} (+${indent.items.length - 1} more)`
  }

  return getIndentProductsText(indent, products)
}

function getIndentDateValue(indent) {
  return (
    indent?.indentDate ??
    indent?.IndentDate ??
    indent?.requestDate ??
    indent?.RequestDate ??
    indent?.requestedDate ??
    indent?.RequestedDate ??
    indent?.createdAt ??
    indent?.CreatedAt ??
    indent?.createdDate ??
    null
  )
}

function getIndentDateTimestamp(indent) {
  const rawDate = getIndentDateValue(indent)
  if (!rawDate) return null

  if (rawDate instanceof Date) {
    const t = rawDate.getTime()
    return Number.isNaN(t) ? null : t
  }

  if (typeof rawDate === 'number' && Number.isFinite(rawDate) && rawDate > 0) {
    return rawDate
  }

  const str = String(rawDate).trim()
  if (!str) return null

  // DD-MM-YYYY or DD/MM/YYYY with optional time
  const ddmmyyyy = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM))?)?$/i)
  if (ddmmyyyy) {
    const day = parseInt(ddmmyyyy[1], 10)
    const month = parseInt(ddmmyyyy[2], 10)
    const year = parseInt(ddmmyyyy[3], 10)
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      let hours = ddmmyyyy[4] ? parseInt(ddmmyyyy[4], 10) : 0
      const mins = ddmmyyyy[5] ? parseInt(ddmmyyyy[5], 10) : 0
      const secs = ddmmyyyy[6] ? parseInt(ddmmyyyy[6], 10) : 0
      const ampm = ddmmyyyy[7] ? ddmmyyyy[7].toUpperCase() : null
      if (ampm === 'PM' && hours < 12) hours += 12
      if (ampm === 'AM' && hours === 12) hours = 0
      return new Date(year, month - 1, day, hours, mins, secs).getTime()
    }
  }

  // YYYY-MM-DD or YYYY/MM/DD with optional time
  const ymd = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?)?/)
  if (ymd) {
    const year = parseInt(ymd[1], 10)
    const month = parseInt(ymd[2], 10)
    const day = parseInt(ymd[3], 10)
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      let hours = ymd[4] ? parseInt(ymd[4], 10) : 0
      const mins = ymd[5] ? parseInt(ymd[5], 10) : 0
      const secs = ymd[6] ? parseInt(ymd[6], 10) : 0
      return new Date(year, month - 1, day, hours, mins, secs).getTime()
    }
  }

  const parsed = Date.parse(str)
  return Number.isNaN(parsed) ? null : parsed
}

export default function PurchaseIndentsTable({
  indents,
  products,
  canDelete,
  onDelete,
  onView,
  onApprove,
  onReject,
  onConvert,
  onRefresh,
  loading,
  selectedIndentIds = [],
  onSelectionChange,
  onBulkExport,
  onBulkPrint,
  onBulkMail,
  onBulkDelete,
  canBulkDelete = true,
  onClearSelection,
  onEdit,
  onMail,
  onPdf,
  onPrint,
  busyAction = null,
}) {
  const safeIndents = Array.isArray(indents) ? indents : []
  const safeProducts = useMemo(() => (Array.isArray(products) ? products : []), [products])

  const columns = useMemo(() => [
    {
      key: 'indentNumber',
      label: 'Indent Number',
      sortable: true,
      mobilePrimary: true,
      mobileLabel: 'Purchase Indent',
      className: 'purchases-page__col-po-number',
      tableWidth: 180,
      style: { width: 180, minWidth: 180 },
      headerStyle: { width: 180, minWidth: 180 },
      sortValue: (indent) => getIndentNumber(indent),
      searchValue: (indent) =>
        `${getIndentNumber(indent)} ${getIndentProductsText(indent, safeProducts)} ${indent?.requestedByDisplay || ''} ${indent?.supplierDisplay || ''} ${indent?.departmentDisplay || ''} ${indent?.status || DEFAULT_STATUS}`,
      render: (indent) => getIndentNumber(indent),
    },
    {
      key: 'productName',
      label: 'Product',
      sortable: true,
      tableWidth: 320,
      style: { width: 320, minWidth: 320 },
      headerStyle: { width: 320, minWidth: 320 },
      sortValue: (indent) => {
        const text = indent?.productName || getFirstProductSummary(indent, safeProducts)
        return String(text || '').trim()
      },
      render: (indent) => {
        const text = indent?.productName || getFirstProductSummary(indent, safeProducts)
        return (
          <span style={{ whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: '1.4', display: 'inline-block' }}>
            {text || EMPTY_VALUE}
          </span>
        )
      },
    },

    {
      key: 'priority',
      label: 'Priority',
      sortable: true,
      tableWidth: 120,
      style: { width: 120, minWidth: 120 },
      headerStyle: { width: 120, minWidth: 120 },
      sortValue: (indent) => indent?.priority || DEFAULT_PRIORITY,
      render: (indent) => (
        <span className={`badge badge--priority-${String(indent?.priority || DEFAULT_PRIORITY).toLowerCase()}`}>
          {indent?.priority || DEFAULT_PRIORITY}
        </span>
      ),
    },
    {
      key: 'indentDate',
      label: 'Request Date',
      sortable: true,
      tableWidth: 140,
      style: { width: 140, minWidth: 140 },
      headerStyle: { width: 140, minWidth: 140 },
      sortValue: (indent) => getIndentDateTimestamp(indent),
      searchValue: (indent) => {
        const rawDate = getIndentDateValue(indent)
        return `${rawDate || ''} ${rawDate ? formatDate(rawDate) : ''}`
      },
      render: (indent) => {
        const rawDate = getIndentDateValue(indent)
        return rawDate ? formatDate(rawDate) : EMPTY_VALUE
      },
    },
    {
      key: 'quantity',
      label: 'Quantity',
      sortable: true,
      tableWidth: 110,
      style: { width: 110, minWidth: 110 },
      headerStyle: { width: 110, minWidth: 110 },
      sortValue: (indent) => {
        const val = indent?.quantity ?? getIndentQuantity(indent)
        const num = Number(val)
        return Number.isFinite(num) ? num : 0
      },
      render: (indent) => {
        const val = indent?.quantity ?? getIndentQuantity(indent)
        const num = Number(val)
        return Number.isFinite(num) ? num : EMPTY_VALUE
      },
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      mobileStatus: true,
      tableWidth: 120,
      style: { width: 120, minWidth: 120 },
      headerStyle: { width: 120, minWidth: 120 },
      sortValue: (indent) => indent?.status || DEFAULT_STATUS,
      render: (indent) => {
        const rawStatus = indent?.status || DEFAULT_STATUS
        const badgeStatus = getBadgeStatus(getStatusKind(rawStatus))
        return (
          <StatusBadge status={badgeStatus}>
            {rawStatus}
          </StatusBadge>
        )
      },
    },
    {
      key: 'requestedByDisplay',
      label: 'Requested By',
      sortable: true,
      tableWidth: 140,
      style: { width: 140, minWidth: 140 },
      headerStyle: { width: 140, minWidth: 140 },
      sortValue: (indent) => indent?.requestedByDisplay || NOT_ASSIGNED,
      render: (indent) => indent?.requestedByDisplay || NOT_ASSIGNED,
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
    render: (indent) => {
      const indentId = indent?.purchaseIndentId || indent?.indentId || indent?.id
      const statusKind = getStatusKind(indent?.status)
      const isPending = statusKind === 'pending'
      const isApproved = statusKind === 'approved'
      const isBusy = (actionKey) =>
        String(busyAction?.id || '') === String(indentId || '') &&
        busyAction?.key === actionKey

      return (
        <ActionMenu
          iconOnly
          label={`Actions for ${getIndentNumber(indent)}`}
          menuKey={indentId}
          className="purchases-page__row-actions"
          actions={[
          {
            key: 'view',
            label: 'View Details',
            icon: Eye,
            loading: isBusy('view'),
            onClick: () => onView?.(indent),
          },

          isPending && {
            key: 'approve',
            label: 'Approve',
            icon: Check,
            loading: isBusy('approve'),
            onClick: () => onApprove?.(indent),
          },

          isPending && {
            key: 'reject',
            label: 'Reject',
            icon: Ban,
            tone: 'danger',
            loading: isBusy('reject'),
            onClick: () => onReject?.(indent),
          },

          isApproved && {
            key: 'convert-po',
            label: 'Convert to Purchase Order',
            icon: ShoppingCart,
            loading: isBusy('convert-po'),
            onClick: () => onConvert?.(indent),
          },

          isPending && {
            key: 'edit',
            label: 'Edit',
            icon: Pencil,
            onClick: () => onEdit?.(indent),
          },
          {
            key: 'mail',
            label: isBusy('mail') ? 'Preparing email...' : 'Mail Copy',
            icon: Mail,
            disabled: isPending,
            title: isPending ? 'Email is disabled until the indent is approved or rejected' : undefined,
            loading: isBusy('mail'),
            onClick: () => {
              if (isPending) return
              onMail?.(indent)
            },
          },
          {
            key: 'pdf',
            label: isBusy('pdf') ? 'Downloading...' : 'Download PDF',
            icon: Download,
            disabled: isPending,
            title: isPending ? 'PDF download is disabled until the indent is approved or rejected' : undefined,
            loading: isBusy('pdf'),
            onClick: () => {
              if (isPending) return
              onPdf?.(indent)
            },
          },
          {
            key: 'print',
            label: isBusy('print') ? 'Preparing print...' : 'Print',
            icon: Printer,
            disabled: isPending,
            title: isPending ? 'Print is disabled until the indent is approved or rejected' : undefined,
            loading: isBusy('print'),
            onClick: () => {
              if (isPending) return
              onPrint?.(indent)
            },
          },
          canDelete && isPending && {
            key: 'delete',
            label: 'Delete',
            icon: Trash2,
            tone: 'danger',
            onClick: () => onDelete(indent),
          },
        ].filter(Boolean)}
        />
      )
    },
    },
  ], [busyAction, canDelete, onApprove, onConvert, onDelete, onEdit, onMail, onPdf, onPrint, onReject, onView, safeProducts])

  const hasSelection = selectedIndentIds.length > 0

  const selectedRows = useMemo(() => {
    const idSet = new Set(selectedIndentIds.map(String))
    return safeIndents.filter((indent) => idSet.has(String(getIndentId(indent))))
  }, [safeIndents, selectedIndentIds])

  const hasPendingInSelection = selectedRows.some((indent) => getStatusKind(indent?.status) === 'pending')
  const canBulkPrint = selectedRows.length > 0 && !hasPendingInSelection
  const canBulkMail = selectedRows.length > 0 && !hasPendingInSelection

  const selectionToolbar = hasSelection ? (
    <FilterBar className="resource-center__product-style-selection-actions" ariaLabel="Selected purchase indents actions">
      <div className="resource-center__product-style-selection-summary" aria-live="polite">
        <Check size={15} />
        <strong>{selectedIndentIds.length} selected</strong>
      </div>
      <button
        type="button"
        className="button button-secondary resource-center__product-style-selection-button"
        onClick={onBulkExport}
      >
        <Download size={15} />
        Export
      </button>
      <button
        type="button"
        className="button button-secondary resource-center__product-style-selection-button"
        onClick={onBulkPrint}
        disabled={!canBulkPrint}
        title={canBulkPrint ? 'Print selected purchase indents' : 'Print is disabled because one or more selected indents are pending approval'}
      >
        <Printer size={15} />
        Print
      </button>
      <button
        type="button"
        className="button button-secondary resource-center__product-style-selection-button"
        onClick={onBulkMail}
        disabled={!canBulkMail}
        title={canBulkMail ? 'Mail selected purchase indents' : 'Email is disabled because one or more selected indents are pending approval'}
      >
        <Mail size={15} />
        Mail
      </button>
      {canDelete ? (
        <button
        type="button"
        className="button button-secondary resource-center__product-style-selection-button resource-center__product-style-selection-button--danger"
        onClick={onBulkDelete}
        disabled={!canBulkDelete}
        title={canBulkDelete ? 'Delete selected pending indents' : 'Only pending indents can be deleted'}
      >
          <Trash2 size={15} />
          Delete
        </button>
      ) : null}
    </FilterBar>
  ) : (
    <FilterBar className="purchases-page__table-actions">
      <button
        type="button"
        className="button button-secondary"
        onClick={onRefresh}
        disabled={loading}
      >
        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        Refresh
      </button>
    </FilterBar>
  )

  return (
    <div className="card purchases-page__table-card">
      <DataTable
        className="purchases-page__table"
        rows={safeIndents}
        columns={columns}
        loading={loading}
        defaultPageSize={20}
        defaultSortKey="indentDate"
        defaultSortDirection="desc"
        allowSortReset={false}
        splitToolbar
        toolbarContent={selectionToolbar}
        enableRowSelection={true}
        hideSelectionSummary={true}
        selectedRowKeys={selectedIndentIds}
        onSelectionChange={onSelectionChange}
        keyField="purchaseIndentId"
        showSearch={!hasSelection}
        showColumnControls={!hasSelection}
        columnStorageKey="ims.purchase-indents.visibleColumns.compact.v6"
        defaultVisibleColumnKeys={['indentNumber', 'productName', 'priority', 'indentDate', 'quantity', 'status', 'requestedByDisplay', 'actions']}
        fitExplicitColumnsToContainer={false}
        searchPlaceholder="Search by indent number, product name, or request date"
        invalidSearchMessage="Please enter a valid search term (e.g., indent number, product name, request date)."
        emptyMessage="No purchase indents found."
      />
    </div>
  )
}
