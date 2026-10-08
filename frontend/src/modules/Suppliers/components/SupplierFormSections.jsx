import { FileText } from 'lucide-react'

export function SupplierSection({ title, description, children, actions, className = '' }) {
  return (
    <section className={`supplier-form__section ${className}`.trim()}>
      <div className="supplier-form__section-header">
        <div>
          <h3>{title}</h3>
          {description ? <p>{description}</p> : null}
        </div>
        {actions ? <div className="supplier-form__section-actions">{actions}</div> : null}
      </div>
      {children}
    </section>
  )
}

export function SupplierEmptyState({ title, message, action }) {
  return (
    <div className="supplier-empty" role="status">
      <div className="supplier-empty__icon">
        <FileText size={20} />
      </div>
      <div>
        <strong>{title}</strong>
        <p>{message}</p>
      </div>
      {action ? <div className="supplier-empty__action">{action}</div> : null}
    </div>
  )
}

export function SupplierMetricCard({ label, value, helper, tone = 'neutral' }) {
  return (
    <div className={`supplier-metric supplier-metric--${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {helper ? <p>{helper}</p> : null}
    </div>
  )
}

export function InlineField({ label, children, className = '' }) {
  return (
    <label className={`supplier-inline-field ${className}`.trim()}>
      <span>{label}</span>
      {children}
    </label>
  )
}
