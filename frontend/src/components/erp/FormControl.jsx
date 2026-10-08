import { renderFormLabel } from '../../utils/labelUtils'
import './ERPComponents.css'

export default function FormControl({
  id,
  label,
  children,
  helpText,
  error,
  required = false,
  className = '',
}) {
  const describedBy = [
    helpText ? `${id}-help` : '',
    error ? `${id}-error` : '',
  ].filter(Boolean).join(' ') || undefined

  return (
    <div className={`erp-form-control ${error ? 'erp-form-control--error' : ''} ${className}`.trim()}>
      {label ? (
        <label className="erp-form-control__label" htmlFor={id}>
          <span>{renderFormLabel(label)}</span>
          {required && !String(label).includes('*') ? (
            <span className="erp-form-control__required" aria-hidden="true">*</span>
          ) : null}
        </label>
      ) : null}
      <div className="erp-form-control__field">
        {typeof children === 'function' ? children({ id, describedBy, invalid: Boolean(error) }) : children}
      </div>
      {helpText ? (
        <p className="erp-form-control__help" id={`${id}-help`}>
          {helpText}
        </p>
      ) : null}
      {error ? (
        <p className="erp-form-control__error" id={`${id}-error`}>
          {error}
        </p>
      ) : null}
    </div>
  )
}
