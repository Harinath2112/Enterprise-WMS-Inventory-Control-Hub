import { AlertTriangle, LoaderCircle, Trash2 } from 'lucide-react'
import FormModal from '../../../layouts/FormModal'

export default function CustomerDeleteDialog({
  customer,
  isDeleting,
  onCancel,
  onConfirm,
}) {
  return (
    <FormModal title="Delete Customer" onClose={onCancel}>
      <div className="customer-delete-dialog">
        <div className="customer-delete-dialog__icon">
          <AlertTriangle size={24} />
        </div>
        <div>
          <h3>Delete {customer?.name || 'this customer'}?</h3>
          <p>
            Customers with invoices, payments, or transactions are protected from deletion.
          </p>
        </div>
        <div className="button-row customer-delete-dialog__actions">
          <button className="button button-cancel button-secondary"
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="button button-danger"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <LoaderCircle size={16} className="animate-spin" />
            ) : (
              <Trash2 size={16} />
            )}
            {isDeleting ? 'Deleting...' : 'Delete Customer'}
          </button>
        </div>
      </div>
    </FormModal>
  )
}
