import { Eye, Pencil, RefreshCw, Trash2 } from 'lucide-react'
import { ActionMenu, DataTable, FilterBar, StatusBadge } from '../../../../components/erp'
import { formatCurrency, formatDate } from '../../../../utils/helpers'

function getStatusType(status) {
  const normalized = String(status || '').toLowerCase()

  if (normalized.includes('partial')) {
    return 'partial'
  }

  if (normalized.includes('received') || normalized.includes('complete')) {
    return 'received'
  }

  if (normalized.includes('cancel')) {
    return 'critical'
  }

  return 'ordered'
}

function getPurchaseOrderStatus(status) {
  const value = String(status || 'Ordered').trim()
  return value.toLowerCase() === 'pending' ? 'Ordered' : value
}

function getPurchaseLines(purchase) {
  return Array.isArray(purchase?.items) && purchase.items.length > 0
    ? purchase.items
    : [{
        quantity: purchase?.quantity ?? purchase?.totalQuantity,
        price: purchase?.price ?? purchase?.unitPrice,
        total: purchase?.totalAmount,
      }]
}

function getPurchaseQuantity(purchase) {
  return getPurchaseLines(purchase).reduce((sum, line) => sum + (Number(line.quantity) || 0), 0)
}

function getPurchaseTotal(purchase) {
  const directTotal = Number(purchase?.grandTotal || purchase?.totalAmount || 0)

  if (Number.isFinite(directTotal) && directTotal > 0) {
    return directTotal
  }

  return getPurchaseLines(purchase).reduce(
    (sum, line) => sum + (Number(line.total) || Number(line.quantity || 0) * Number(line.price ?? line.unitPrice ?? 0)),
    0,
  )
}

export default function PurchasesTable({
  purchases,
  canDelete,
  onDelete,
  onView,
  onEdit,
  onRefresh,
  loading,
}) {
  const columns = [
    {
      key: 'poNumber',
      label: 'PO Number',
      sortable: true,
      mobilePrimary: true,
      mobileLabel: 'Purchase Order',
      className: 'purchases-page__col-po-number',
      tableWidth: 230,
      style: { width: 230, minWidth: 230 },
      headerStyle: { width: 230, minWidth: 230 },
      searchValue: (purchase) =>
        `${purchase.poNumber} ${purchase.supplierName || purchase.supplier} ${purchase.status}`,
    },
    {
      key: 'supplier',
      label: 'Supplier',
      sortable: true,
      render: (purchase) => purchase.supplierName || purchase.supplier || 'Not Available',
      sortValue: (purchase) => purchase.supplierName || purchase.supplier || '',
    },
    {
      key: 'orderDate',
      label: 'Order Date',
      sortable: true,
      render: (purchase) => formatDate(purchase.orderDate),
    },
    {
      key: 'quantity',
      label: 'Quantity',
      sortable: true,
      render: (purchase) => getPurchaseQuantity(purchase) || 0,
      sortValue: getPurchaseQuantity,
    },
    {
      key: 'totalAmount',
      label: 'Total',
      sortable: true,
      render: (purchase) => formatCurrency(getPurchaseTotal(purchase)),
      sortValue: getPurchaseTotal,
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      mobileStatus: true,
      className: 'purchases-page__col-status',
      tableWidth: 160,
      style: { width: 160, minWidth: 160 },
      headerStyle: { width: 160, minWidth: 160 },
      render: (purchase) => {
        const status = getPurchaseOrderStatus(purchase.status)

        return (
          <StatusBadge type={getStatusType(status)}>
            {status}
          </StatusBadge>
        )
      },
    },
  ]

  columns.push({
    key: 'actions',
    label: 'Actions',
    searchable: false,
    hideable: false,
    className: 'purchases-page__col-actions',
    tableWidth: 72,
    style: { width: 72, minWidth: 72, maxWidth: 72 },
    headerStyle: { width: 72, minWidth: 72, maxWidth: 72 },
    render: (purchase) => (
      <ActionMenu
        iconOnly
        label={`Actions for ${purchase.poNumber || purchase.poId}`}
        menuKey={purchase.id || purchase.poId || purchase.poNumber}
        className="purchases-page__row-actions"
        actions={[
          {
            key: 'view',
            label: 'View Details',
            icon: Eye,
            onClick: () => onView?.(purchase),
          },
          {
            key: 'edit',
            label: 'Edit',
            icon: Pencil,
            onClick: () => onEdit?.(purchase),
          },
          canDelete && {
            key: 'delete',
            label: 'Delete',
            icon: Trash2,
            tone: 'danger',
            onClick: () => onDelete(purchase),
          },
        ]}
      />
    ),
  })

  return (
    <div className="card purchases-page__table-card">
      <DataTable
        className="purchases-page__table"
        rows={purchases}
        columns={columns}
        loading={loading}
        defaultPageSize={20}
        defaultSortKey=""
        splitToolbar
        toolbarContent={(
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
        )}
        columnStorageKey="ims.purchases.visibleColumns.compact.v2"
        defaultVisibleColumnKeys={['poNumber', 'supplier', 'orderDate', 'quantity', 'totalAmount', 'status', 'actions']}
        fitExplicitColumnsToContainer
        searchPlaceholder="Search purchase orders by supplier, PO number, or status"
        emptyMessage="No purchase orders found."
      />
    </div>
  )
}
