import { formatCurrency } from '../../../utils/helpers'
import { DataTable, StatusBadge } from '../../../components/erp'

export default function AccountingTable({ invoices }) {
  const columns = [
    {
      key: 'invoiceNo',
      label: 'Invoice No',
      sortable: true,
      mobilePrimary: true,
      searchValue: (invoice) =>
        `${invoice.invoiceNo} ${invoice.invoiceType} ${invoice.partyName} ${invoice.productName} ${invoice.status}`,
    },
    { key: 'invoiceType', label: 'Type', sortable: true },
    { key: 'partyName', label: 'Party', sortable: true },
    { key: 'productName', label: 'Product', sortable: true },
    { key: 'warehouseName', label: 'Warehouse', sortable: true },
    { key: 'quantity', label: 'Quantity', sortable: true },
    {
      key: 'amount',
      label: 'Amount',
      sortable: true,
      render: (invoice) => formatCurrency(invoice.amount),
    },
    { key: 'date', label: 'Date', sortable: true },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      mobileStatus: true,
      render: (invoice) => (
        <StatusBadge type={invoice.status === 'Issued' ? 'active' : 'info'}>
          {invoice.status}
        </StatusBadge>
      ),
    },
  ]

  return (
    <div className="card">
      <DataTable
        title="Invoice Register"
        rows={invoices}
        columns={columns}
        defaultPageSize={8}
        searchPlaceholder="Search invoices by number or party"
        emptyMessage="No invoices available."
      />
    </div>
  )
}
