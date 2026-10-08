import { ExternalLink } from 'lucide-react'
import { DataTable, StatusBadge } from '../../../components/erp'
import { formatCurrency, formatDate } from '../../../utils/helpers'
import { formatEmpty, formatStatus, getStatusBadgeType } from '../supplierFormatters'
import { SupplierSection } from './SupplierFormSections'

export default function SupplierPurchaseHistoryTab({ purchases }) {
  const columns = [
    {
      key: 'poNumber',
      label: 'PO Number',
      sortable: true,
      render: (po) => (
        <button type="button" className="supplier-link-button">
          {formatEmpty(po.poNumber || po.purchaseOrderNumber || po.PoNumber || po.PurchaseOrderNumber || (po.id ? `PO-${po.id}` : ''))}
          <ExternalLink size={13} />
        </button>
      ),
    },
    { key: 'orderDate', label: 'Order Date', sortable: true, render: (po) => formatDate(po.orderDate || po.createdAt || po.createdDate || po.date) || 'Date pending' },
    { key: 'totalAmount', label: 'Total Amount', sortable: true, render: (po) => formatCurrency(po.totalAmount ?? po.grandTotal ?? po.amount ?? 0) },
    { key: 'status', label: 'Status', sortable: true, render: (po) => <StatusBadge type={getStatusBadgeType(po.status)}>{formatStatus(po.status)}</StatusBadge> },
    { key: 'receivedQuantity', label: 'Received Qty', sortable: true, render: (po) => formatEmpty(po.receivedQuantity ?? po.totalQuantity ?? po.quantity) },
    { key: 'pendingQuantity', label: 'Pending Qty', sortable: true, render: (po) => formatEmpty(po.pendingQuantity ?? 0) },
    { key: 'paymentStatus', label: 'Payment Status', sortable: true, render: (po) => <StatusBadge type={getStatusBadgeType(po.paymentStatus || po.invoiceStatus || 'Pending')}>{formatStatus(po.paymentStatus || po.invoiceStatus || 'Pending')}</StatusBadge> },
  ]

  return (
    <SupplierSection
      title="Purchase History"
      description="Read-only purchase order history from purchase_orders."
    >
      <DataTable
        rows={purchases}
        columns={columns}
        defaultPageSize={5}
        emptyMessage="No purchase orders found for this supplier."
        searchPlaceholder="Search purchase orders"
        invalidSearchMessage="Please enter a valid search term (e.g., PO number, order date, total amount, status, received qty)."
        splitToolbar
      />
    </SupplierSection>
  )
}
