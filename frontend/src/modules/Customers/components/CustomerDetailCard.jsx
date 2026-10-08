import StatusBadge from './StatusBadge'

export default function CustomerDetailCard({ label, value, helper, status }) {
  return (
    <div className="customer-detail-card">
      <div className="customer-detail-card__header">
        <span>{label}</span>
        {status ? <StatusBadge status={status} /> : null}
      </div>
      <strong>{value}</strong>
      {helper ? <p>{helper}</p> : null}
    </div>
  )
}
