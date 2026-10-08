import { LoaderCircle } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import FormModal from '../../../layouts/FormModal'

const STATUS_OPTIONS = ['Active', 'Inactive']

function normalizeStatus(status) {
  const value = String(status || 'Active').trim().toLowerCase()

  if (value === 'blocked') {
    return 'Blocked'
  }

  if (value === 'inactive') {
    return 'Inactive'
  }

  return 'Active'
}

export default function CustomerStatusDialog({
  customer,
  isSubmitting,
  onClose,
  onSubmit,
}) {
  const currentStatus = useMemo(
    () => normalizeStatus(customer?.status),
    [customer?.status],
  )
  const [status, setStatus] = useState(currentStatus)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    setStatus(currentStatus)
    setReason('')
    setError('')
  }, [currentStatus, customer?.id])

  if (!customer) {
    return null
  }

  function handleSubmit(event) {
    event.preventDefault()

    if (status === currentStatus) {
      setError('Please select a different status.')
      return
    }

    setError('')
    onSubmit({ status, reason })
  }

  return (
    <FormModal
      title="Update Customer Status"
      onClose={onClose}
      className="customer-status-modal"
      dialogClassName="customer-status-modal__dialog"
      bodyClassName="customer-status-modal__body"
    >
      <form className="customer-status-form" onSubmit={handleSubmit}>
        <div className="customer-status-form__summary">
          <span>Customer</span>
          <strong>{customer.name || 'Unnamed customer'}</strong>
        </div>

        <div className="customer-status-form__summary">
          <span>Current Status</span>
          <strong>{currentStatus}</strong>
        </div>

        <label className="customer-status-form__field">
          <span>New Status</span>
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value)
              setError('')
            }}
            disabled={isSubmitting}
            autoFocus
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="customer-status-form__field">
          <span>Reason <em>(optional)</em></span>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            disabled={isSubmitting}
            placeholder="Add a short reason"
            maxLength={240}
            rows={3}
          />
        </label>

        {error ? <p className="customer-status-form__error page-error-banner" role="alert">{error}</p> : null}

        <div className="customer-status-form__actions">
          <button className="button button-cancel"
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="button button-primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? <LoaderCircle size={15} className="animate-spin" /> : null}
            Update Status
          </button>
        </div>
      </form>
    </FormModal>
  )
}
