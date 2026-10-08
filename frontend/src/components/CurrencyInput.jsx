import { useEffect, useMemo, useRef, useState } from 'react'
import { renderFormLabel } from '../utils/labelUtils'
import { sanitizeNumericInput } from './numericInputUtils'

function getCurrencyFormatter(currency = 'INR') {
  const code = String(currency || 'INR').trim().toUpperCase() || 'INR'
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: code,
      currencyDisplay: 'code',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  } catch {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      currencyDisplay: 'code',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }
}

function getRawValue(value, { maxIntegerDigits = 10, maxDecimalDigits = 2 } = {}) {
  return sanitizeNumericInput(value, {
    allowDecimal: true,
    allowNegative: false,
    maxIntegerDigits,
    maxDecimalDigits,
  })
}

function getFormattedValue(value, currency, { maxIntegerDigits = 10, maxDecimalDigits = 2 } = {}) {
  const rawValue = getRawValue(value, { maxIntegerDigits, maxDecimalDigits })

  if (!rawValue || rawValue === '.') {
    return ''
  }

  const numericValue = Number(rawValue)

  if (!Number.isFinite(numericValue)) {
    return rawValue
  }

  return getCurrencyFormatter(currency).format(numericValue).replace(/\u00A0/g, ' ')
}

function normalizeCompletedCurrencyValue(value, { maxIntegerDigits = 10, maxDecimalDigits = 2 } = {}) {
  const rawValue = getRawValue(value, { maxIntegerDigits, maxDecimalDigits })
  const numericValue = Number(rawValue)

  if (!rawValue || !Number.isFinite(numericValue)) {
    return rawValue
  }

  return String(numericValue)
}

export default function CurrencyInput({
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
  helperText,
  className = '',
  currency = 'INR',
  onFocus,
  maxIntegerDigits = 10,
  maxDecimalDigits = 2,
  ...props
}) {
  const inputRef = useRef(null)
  const [isFocused, setIsFocused] = useState(false)
  const [displayValue, setDisplayValue] = useState(() =>
    getFormattedValue(value, currency, { maxIntegerDigits, maxDecimalDigits }),
  )
  const resolvedPrefix = prefix || (isFocused && currency ? String(currency).trim().toUpperCase() : null)
  const describedBy = [
    helperText ? `${id}-help` : '',
    error ? `${id}-error` : '',
  ].filter(Boolean).join(' ') || undefined

  const formattedValue = useMemo(
    () => getFormattedValue(value, currency, { maxIntegerDigits, maxDecimalDigits }),
    [currency, maxDecimalDigits, maxIntegerDigits, value],
  )

  useEffect(() => {
    if (isFocused) {
      return
    }

    setDisplayValue(formattedValue)
  }, [formattedValue, isFocused])

  function emitChange(nextValue) {
    onChange?.({
      target: {
        name,
        value: nextValue,
      },
    })
  }

  function handleFocus(event) {
    const rawValue = getRawValue(value, { maxIntegerDigits, maxDecimalDigits })
    setIsFocused(true)
    setDisplayValue(rawValue)
    onFocus?.(event)
  }

  function handleChange(event) {
    const rawInputValue = event.target.value
    const caretPosition = event.target.selectionStart ?? rawInputValue.length
    const beforeCaret = rawInputValue.slice(0, caretPosition)
    const nextValue = getRawValue(rawInputValue, { maxIntegerDigits, maxDecimalDigits })
    const nextCaret = getRawValue(beforeCaret, { maxIntegerDigits, maxDecimalDigits }).length

    setDisplayValue(nextValue)
    emitChange(nextValue)

    if (nextValue !== rawInputValue) {
      window.requestAnimationFrame(() => {
        inputRef.current?.setSelectionRange(nextCaret, nextCaret)
      })
    }
  }

  function handleBlur(event) {
    const nextValue = normalizeCompletedCurrencyValue(event.target.value, {
      maxIntegerDigits,
      maxDecimalDigits,
    })
    setIsFocused(false)
    setDisplayValue(getFormattedValue(nextValue, currency, { maxIntegerDigits, maxDecimalDigits }))
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
        {resolvedPrefix ? <span className="input-prefix">{resolvedPrefix}</span> : null}
        <input
          ref={inputRef}
          id={id}
          name={name}
          type="text"
          inputMode="decimal"
          value={displayValue}
          placeholder={placeholder}
          {...props}
          style={{ textAlign: 'right', ...props.style }}
          onFocus={handleFocus}
          onChange={handleChange}
          onBlur={handleBlur}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          autoComplete="off"
        />
      </div>
      {helperText && !error ? (
        <span id={`${id}-help`} className="field-help">
          {helperText}
        </span>
      ) : null}
      {error ? <span id={`${id}-error`} className="field-error" role="alert">{error}</span> : null}
    </div>
  )
}
