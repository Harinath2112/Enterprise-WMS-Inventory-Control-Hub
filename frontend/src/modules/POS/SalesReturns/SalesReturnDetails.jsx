import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Pencil, Trash2, AlertCircle, RefreshCw } from 'lucide-react'
import PageHeader from '../../../components/common/PageHeader'
import StateBlock from '../../../components/common/StateBlock'
import { showToast } from '../../../components/common/toast'
import FormModal from '../../../layouts/FormModal'
import { getSalesReturnById, deleteSalesReturn } from '../../../api/salesReturnApi'
import { formatCurrency, formatDate } from '../../../utils/helpers'
import './SalesReturns.css'

export default function SalesReturnDetails() {
  const navigate = useNavigate()
  const { id } = useParams()

  const [returnDetails, setReturnDetails] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const fetchDetails = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const res = await getSalesReturnById(id)
      if (res && res.success && res.data) {
        setReturnDetails(res.data)
      } else {
        setError(res?.error || 'Sales return record not found on server.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching sales return details.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchDetails()
  }, [fetchDetails])

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const res = await deleteSalesReturn(id)
      if (res && res.success) {
        showToast('Sales return deleted successfully.', 'success')
        navigate('/pos/returns')
      } else {
        showToast(res?.error || 'Failed to delete sales return.', 'error')
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Delete error occurred.', 'error')
    } finally {
      setDeleting(false)
      setShowDeleteModal(false)
    }
  }

  if (loading) {
    return <StateBlock state="loading" message="Loading return details..." />
  }

  if (error || !returnDetails) {
    return (
      <main className="sales-return-details-page">
        <PageHeader
          title="Sales Return Details"
          primaryAction={{
            icon: ArrowLeft,
            label: 'Back to Returns',
            onClick: () => navigate('/pos/returns'),
            variant: 'secondary',
          }}
        />
        <div className="card sales-returns-error-card" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <AlertCircle size={24} className="error-icon" style={{ color: '#ef4444' }} />
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: '0 0 4px 0' }}>Record Not Found</h3>
            <p style={{ margin: 0, color: '#64748b' }}>{String(error || 'The requested sales return could not be retrieved.')}</p>
          </div>
          <button className="erp-button erp-button--primary" onClick={fetchDetails} type="button">
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      </main>
    )
  }

  const formatReturnCode = (val) => {
    if (!val) return ''
    const str = String(val).trim().replace(/^#/, '')
    if (/^SRR-\d{6}$/i.test(str)) return str.toUpperCase()
    const digits = str.replace(/\D/g, '')
    if (digits) return `SRR-${digits.padStart(6, '0')}`
    return str.startsWith('SRR-') ? str : `SRR-${str}`
  }

  const retId = returnDetails.salesReturnId || returnDetails.id || id
  const displayCode = formatReturnCode(returnDetails.returnNumber || retId)
  const customerName = returnDetails.customerName || (returnDetails.customerId ? `Customer #${returnDetails.customerId}` : '-')
  const invoiceDisplay = returnDetails.invoiceNumber || (returnDetails.invoiceId ? `INV-${String(returnDetails.invoiceId).padStart(6, '0')}` : '-')
  const totalAmount = Number(returnDetails.totalAmount || returnDetails.totalReturnAmount || 0)

  return (
    <main className="sales-return-details-page">
      <PageHeader
        title={`Sales Return ${displayCode}`}
        subtitle="Complete details of returned customer transaction."
        primaryAction={{
          icon: ArrowLeft,
          label: 'Back to Returns',
          onClick: () => navigate('/pos/returns'),
          variant: 'secondary',
        }}
      />

      {/* Header Info Summary Card */}
      <section className="card details-header-card">
        <div className="details-header-top" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <span className="details-badge" style={{ fontSize: '0.8rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Return ID</span>
            <h2 className="details-id-title" style={{ margin: '4px 0 0 0', color: '#0f172a' }}>{displayCode}</h2>
          </div>
          <div className="details-action-buttons" style={{ display: 'flex', gap: '10px' }}>
            <button
              className="erp-button erp-button--secondary"
              type="button"
              onClick={() => navigate(`/pos/returns/edit/${retId}`)}
            >
              <Pencil size={15} /> Edit
            </button>
            <button
              className="erp-button erp-button--danger"
              type="button"
              onClick={() => setShowDeleteModal(true)}
            >
              <Trash2 size={15} /> Delete
            </button>
          </div>
        </div>

        <div className="details-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <div className="details-item">
            <span className="label" style={{ display: 'block', color: '#64748b', fontSize: '0.85rem' }}>Customer</span>
            <span className="value font-semibold" style={{ fontWeight: 600, color: '#1e293b' }}>{customerName}</span>
          </div>

          <div className="details-item">
            <span className="label" style={{ display: 'block', color: '#64748b', fontSize: '0.85rem' }}>Invoice</span>
            <span className="value invoice-badge">{invoiceDisplay}</span>
          </div>

          <div className="details-item">
            <span className="label" style={{ display: 'block', color: '#64748b', fontSize: '0.85rem' }}>Return Date</span>
            <span className="value" style={{ color: '#1e293b' }}>
              {returnDetails.returnDate ? formatDate(returnDetails.returnDate) : '-'}
            </span>
          </div>

          <div className="details-item">
            <span className="label" style={{ display: 'block', color: '#64748b', fontSize: '0.85rem' }}>Total Amount</span>
            <span className="value font-semibold text-primary" style={{ fontWeight: 600, color: '#2563eb' }}>
              {formatCurrency(totalAmount)}
            </span>
          </div>

          <div className="details-item full-width" style={{ gridColumn: '1 / -1' }}>
            <span className="label" style={{ display: 'block', color: '#64748b', fontSize: '0.85rem' }}>Reason for Return</span>
            <span className="value reason-text" style={{ color: '#334155' }}>
              {returnDetails.reason || 'No reason provided.'}
            </span>
          </div>
        </div>
      </section>

      {/* Return Items Table Card */}
      <section className="card details-items-card" style={{ marginTop: '20px' }}>
        <h3 className="section-title">Return Line Items</h3>

        {(!Array.isArray(returnDetails.items) || returnDetails.items.length === 0) ? (
          <p className="no-items-text" style={{ padding: '16px', color: '#64748b' }}>No item lines found for this return.</p>
        ) : (
          <div className="items-table-container">
            <table className="sales-returns-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Variant</th>
                  <th className="text-right">Invoiced Qty</th>
                  <th className="text-right">Return Qty</th>
                  <th className="text-right">Price</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {returnDetails.items.map((line, idx) => {
                  const prodName = line.productName || (line.productId ? `Product #${line.productId}` : '-')
                  const varName = line.variantName || (line.variantId ? `Variant #${line.variantId}` : '-')
                  const invoicedQty = Number(line.invoicedQuantity ?? line.receivedQuantity ?? line.returnQuantity ?? 0)
                  const returnQty = Number(line.returnQuantity ?? line.quantity ?? 0)
                  const price = Number(line.price ?? 0)
                  const lineTotal = Number(line.total ?? (returnQty * price))

                  return (
                    <tr key={line.salesReturnItemId ?? line.id ?? idx}>
                      <td className="font-semibold">{prodName}</td>
                      <td>{varName}</td>
                      <td className="text-right">{invoicedQty.toFixed(2)}</td>
                      <td className="text-right font-semibold text-primary">{returnQty.toFixed(2)}</td>
                      <td className="text-right">{formatCurrency(price)}</td>
                      <td className="text-right font-semibold">{formatCurrency(lineTotal)}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5} className="text-right font-semibold">Total Return Amount:</td>
                  <td className="text-right font-semibold text-primary" style={{ fontSize: '1.05rem' }}>
                    {formatCurrency(totalAmount)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <FormModal
          isOpen={showDeleteModal}
          title="Delete Sales Return?"
          onClose={() => setShowDeleteModal(false)}
        >
          <div className="delete-confirm-content">
            <p>This will permanently delete this sales return and all its line items.</p>
            <p className="delete-warning">Return ID: {displayCode}</p>
            <div className="form-modal-actions">
              <button
                className="erp-button erp-button--secondary"
                type="button"
                disabled={deleting}
                onClick={() => setShowDeleteModal(false)}
              >
                Cancel
              </button>
              <button
                className="erp-button erp-button--danger"
                type="button"
                disabled={deleting}
                onClick={handleDelete}
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
