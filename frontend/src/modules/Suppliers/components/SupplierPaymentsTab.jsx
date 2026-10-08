import { DataTable, StatusBadge } from '../../../components/erp'
import { formatCurrency, formatDate } from '../../../utils/helpers'
import { formatEmpty, formatPaymentMethod, formatStatus, getStatusBadgeType } from '../supplierFormatters'
import { SupplierSection } from './SupplierFormSections'

export default function SupplierPaymentsTab({ payments }) {
  const columns = [
    { key: 'paymentNumber', label: 'Payment #', sortable: true, render: (payment) => formatEmpty(payment.paymentNumber || payment.id ? `PAY-${payment.id}` : '') },
    { key: 'paymentDate', label: 'Payment Date', sortable: true, render: (payment) => formatDate(payment.paymentDate || payment.createdAt || payment.date) || 'Date pending' },
    { key: 'amount', label: 'Amount', sortable: true, render: (payment) => formatCurrency(payment.amount ?? payment.paymentAmount ?? 0) },
    {
      key: 'referenceNumber',
      label: 'Reference Number',
      sortable: true,
      render: (payment) => {
        const rawRef = payment.referenceNumber || payment.ReferenceNumber || payment.referenceNo || payment.chequeNo || payment.transactionId
        if (rawRef && rawRef.toLowerCase() !== 'not provided' && rawRef.toLowerCase() !== 'n/a') {
          return rawRef
        }
        const payId = payment.id || payment.paymentId || payment.PaymentId
        return payId ? `REF-PAY-${String(payId).padStart(4, '0')}` : 'Not provided'
      },
    },
    { key: 'paymentMethod', label: 'Payment Method', sortable: true, render: (payment) => formatEmpty(formatPaymentMethod(payment.paymentMethod)) },
    { key: 'status', label: 'Status', sortable: true, render: (payment) => <StatusBadge type={getStatusBadgeType(payment.status)}>{formatStatus(payment.status)}</StatusBadge> },
  ]

  return (
    <SupplierSection
      title="Payment History"
      description="Read-only settlement history from supplier_payments."
    >
      <DataTable
        rows={payments}
        columns={columns}
        defaultPageSize={5}
        emptyMessage="No supplier payments recorded."
        searchPlaceholder="Search payments"
        invalidSearchMessage="Please enter a valid search term (e.g., payment number, payment method, amount, date, reference number)."
        splitToolbar
      />
    </SupplierSection>
  )
}
