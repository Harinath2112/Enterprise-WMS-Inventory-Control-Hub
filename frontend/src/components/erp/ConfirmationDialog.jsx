import { AlertTriangle, Trash2 } from 'lucide-react'
import FormModal from '../../layouts/FormModal'
import './ERPComponents.css'

export default function ConfirmationDialog({
  title = 'Confirm Action',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  icon: CustomIcon,
  isSubmitting = false,
  onConfirm,
  onCancel,
}) {
  const Icon = CustomIcon || (tone === 'danger' ? Trash2 : AlertTriangle)

  return (
    <FormModal
      title={title}
      icon={Icon}
      className="erp-confirmation-modal"
      dialogClassName={`erp-confirmation-dialog erp-confirmation-dialog--${tone}`}
      onClose={onCancel}
    >
      <div className="erp-confirmation-dialog__content">
        {message ? <p className="erp-confirmation-dialog__message">{message}</p> : null}
        <div className="erp-confirmation-dialog__actions">
          <button type="button" className="button button-secondary button-cancel" onClick={onCancel} disabled={isSubmitting}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={tone === 'danger' ? 'button button-danger' : 'button button-primary'}
            onClick={onConfirm}
            disabled={isSubmitting}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </FormModal>
  )
}
