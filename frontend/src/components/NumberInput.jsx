import { useEffect, useMemo, useRef, useState } from 'react'
import { renderFormLabel } from '../utils/labelUtils'
import { sanitizeNumericInput } from './numericInputUtils'

function getDisplayValue(value, options) {
  return sanitizeNumericInput(value, options)
}

export default function NumberInput({
  id,
  label,
  icon: Icon,
  prefix,
  name,
  value,
  onChange,
  onBlur,
  placeholder,
  error,
  className = '',
  allowDecimal = true,
  allowNegative = false,
  inputMode,
  ...props
}) {
  const options = useMemo(
    () => ({ allowDecimal, allowNegative }),
    [allowDecimal, allowNegative],
  )
  const inputRef = useRef(null)
  const [displayValue, setDisplayValue] = useState(() => getDisplayValue(value, options))

  useEffect(() => {
    if (document.activeElement === inputRef.current) {
      return
    }

    setDisplayValue(getDisplayValue(value, options))
  }, [options, value])

  function emitChange(nextValue) {
    onChange?.({
      target: {
        name,
        value: nextValue,
      },
    })
  }

  function handleChange(event) {
    const rawValue = event.target.value
    const caretPosition = event.target.selectionStart ?? rawValue.length
    const beforeCaret = rawValue.slice(0, caretPosition)
    const nextValue = sanitizeNumericInput(rawValue, options)
    const nextCaret = sanitizeNumericInput(beforeCaret, options).length

    setDisplayValue(nextValue)
    emitChange(nextValue)

    if (nextValue !== rawValue) {
      window.requestAnimationFrame(() => {
        inputRef.current?.setSelectionRange(nextCaret, nextCaret)
      })
    }
  }

  function handleBlur(event) {
    const nextValue = sanitizeNumericInput(event.target.value, options)
    setDisplayValue(nextValue)
    emitChange(nextValue)
    onBlur?.({
      target: {
        name,
        value: nextValue,
      },
    })
  }

  return (
    <div className={`field ${className}`.trim()}>
      <label htmlFor={id}>{renderFormLabel(label)}</label>
      <div className={`input-with-icon ${error ? 'field--error' : ''}`.trim()}>
        {Icon ? <Icon size={18} /> : null}
        {prefix ? <span className="input-prefix">{prefix}</span> : null}
        <input
          ref={inputRef}
          id={id}
          name={name}
          type="text"
          inputMode={inputMode ?? (allowDecimal ? 'decimal' : 'numeric')}
          value={displayValue}
          placeholder={placeholder}
          {...props}
          onChange={handleChange}
          onBlur={handleBlur}
          autoComplete="off"
        />
      </div>
      {error ? <span className="field-error">{error}</span> : null}
    </div>
  )
}
