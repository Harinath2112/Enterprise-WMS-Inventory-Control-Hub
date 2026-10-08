import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { autoCapitalizeWords, shouldAutoCapitalizeField } from '../validators/nameValidator'

import { renderFormLabel } from '../utils/labelUtils'

export default function InputField({
  id,
  label,
  icon: Icon,
  prefix,
  type = 'text',
  name,
  value,
  onChange,
  onBlur,
  placeholder,
  error,
  helperText,
  textarea,
  rows = 4,
  className = '',
  trailingAction,
  onIconClick,
  iconLabel,
  ...props
}) {
  const [showPassword, setShowPassword] = useState(false)
  const isPasswordField = type === 'password' || name === 'password' || name === 'confirmPassword' || name === 'newPassword' || name === 'currentPassword'
  const computedInputType = isPasswordField ? (showPassword ? 'text' : 'password') : type

  const isTextarea = Boolean(textarea)
  const describedBy = [
    helperText ? `${id}-help` : '',
    error ? `${id}-error` : '',
  ].filter(Boolean).join(' ') || undefined

  const hasValue = value !== undefined && value !== null && String(value).length > 0

  const handleInputChange = (event) => {
    if (!onChange) return

    const isAutoCap = props.autoCapitalize === 'words' || (props.autoCapitalize !== 'off' && shouldAutoCapitalizeField(name, computedInputType))

    if (isAutoCap && event?.target && typeof event.target.value === 'string' && event.target.value) {
      const originalValue = event.target.value
      const capitalizedValue = autoCapitalizeWords(originalValue)
      if (capitalizedValue !== originalValue) {
        event = {
          ...event,
          target: {
            ...event.target,
            name: event.target.name || name,
            value: capitalizedValue,
          },
        }
      }
    }

    onChange(event)
  }

  const renderTrailingAction = () => {
    if (trailingAction) {
      return trailingAction
    }
    if (isPasswordField && hasValue) {
      const ToggleIcon = showPassword ? Eye : EyeOff
      return (
        <button
          type="button"
          className="input-icon-button input-icon-button--password"
          onClick={() => setShowPassword((prev) => !prev)}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
          title={showPassword ? 'Hide password' : 'Show password'}
          tabIndex={-1}
        >
          <ToggleIcon size={18} />
        </button>
      )
    }
    return null
  }

  const isAutoCapField = props.autoCapitalize === 'words' || (props.autoCapitalize !== 'off' && shouldAutoCapitalizeField(name, computedInputType))

  return (
    <div className={`field ${error ? 'field--error' : ''} ${className}`.trim()}>
      <label htmlFor={id}>{renderFormLabel(label)}</label>
      <div
        className={`input-with-icon ${isTextarea ? 'input-with-icon--textarea' : ''} ${
          error ? 'field--error' : ''
        }`.trim()}
      >
        {Icon ? (
          onIconClick ? (
            <button
              type="button"
              className="input-icon-button"
              onClick={onIconClick}
              aria-label={iconLabel || `${label || 'Field'} action`}
            >
              <Icon size={18} />
            </button>
          ) : (
            <Icon size={18} />
          )
        ) : null}
        {prefix ? <span className="input-prefix">{prefix}</span> : null}
        {textarea ? (
          <textarea
            id={id}
            name={name}
            value={value}
            rows={rows}
            placeholder={placeholder}
            onChange={handleInputChange}
            onBlur={onBlur}
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy}
            autoComplete="off"
            autoCapitalize={isAutoCapField && hasValue ? 'words' : 'off'}
            style={isAutoCapField && hasValue ? { textTransform: 'capitalize', ...props.style } : props.style}
            {...props}
          />
        ) : (
          <input
            id={id}
            name={name}
            type={computedInputType}
            value={value}
            placeholder={placeholder}
            onChange={handleInputChange}
            onBlur={onBlur}
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy}
            autoComplete="off"
            autoCapitalize={isAutoCapField && hasValue ? 'words' : 'off'}
            style={isAutoCapField && hasValue ? { textTransform: 'capitalize', ...props.style } : props.style}
            {...props}
          />
        )}
        {!textarea ? renderTrailingAction() : null}
      </div>
      {helperText && !error ? (
        <span id={`${id}-help`} className="field-help">
          {helperText}
        </span>
      ) : null}
      {error ? (
        <span id={`${id}-error`} className="field-error" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  )
}
