import { Trash2 } from 'lucide-react'
import { ActionButtons, DataTable, StatusBadge } from '../../../../components/erp'
import { formatCurrency } from '../../../../utils/helpers'

export default function SalesTable({ sales, canDelete, onDelete }) {
  const columns = [
    {
      key: 'customerName',
      label: 'Customer',
      sortable: true,
      mobilePrimary: true,
      searchValue: (sale) =>
        `${sale.customerName} ${sale.productName} ${sale.warehouseName} ${sale.status}`,
    },
    { key: 'productName', label: 'Product', sortable: true },
    { key: 'warehouseName', label: 'Warehouse', sortable: true },
    { key: 'quantity', label: 'Quantity', sortable: true },
    {
      key: 'total',
      label: 'Total',
      sortable: true,
      render: (sale) => formatCurrency(sale.total),
    },
    { key: 'date', label: 'Date', sortable: true },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      mobileStatus: true,
      render: (sale) => (
        <StatusBadge type={sale.status === 'Completed' ? 'received' : 'ordered'}>
          {sale.status}
        </StatusBadge>
      ),
    },
  ]

  if (canDelete) {
    columns.push({
      key: 'actions',
      label: 'Actions',
      searchable: false,
      render: (sale) => (
        <ActionButtons className="table-actions table-actions--nowrap">
          <button
            type="button"
            className="button button-danger"
            onClick={(event) => {
              event.stopPropagation()
              onDelete(sale.id)
            }}
          >
            <Trash2 size={16} />
            Delete
          </button>
        </ActionButtons>
      ),
    })
  }

  return (
    <div className="card">
      <DataTable
        title="Sales List"
        rows={sales}
        columns={columns}
        defaultPageSize={8}
        searchPlaceholder="Search sales by customer, product, warehouse, or status"
        emptyMessage="No sales available."
      />
    </div>
  )
}
