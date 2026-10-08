import { CheckCircle2, Hash, LoaderCircle, Mail, MapPin, Phone, Power, Save, UserRound, Warehouse } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import InputField from '../../../components/InputField'
import {
  emailInputProps,
  getEmailError,
  sanitizeEmailInput,
} from '../../../validators/emailValidator'
import {
  getPhoneError,
  phoneInputProps,
  sanitizePhoneInput,
} from '../../../validators/phoneValidator'
import './WarehouseForm.css'

const emptyForm = {
  name: '',
  warehouseCode: '',
  location: '',
  managerName: '',
  phone: '',
  email: '',
  status: 'Active',
}

const statusOptions = ['Active', 'Inactive']
const warehouseCodePattern = /^[A-Z]{2,5}-[A-Z]{3,5}-\d{3,5}$/
const maxLengths = {
  name: 150,
  warehouseCode: 12,
  location: 255,
  managerName: 150,
  phone: 10,
  email: 255,
}

function normalizeStatus(value) {
  return statusOptions.find((status) => status.toLowerCase() === String(value ?? '').toLowerCase()) ?? 'Active'
}

function collapseSpaces(value) {
  return String(value ?? '').replace(/\s+/g, ' ')
}

function removeScriptTagText(value) {
  return String(value ?? '').replace(/<\/?script\b[^>]*>/gi, '')
}

function sanitizeWarehouseName(value) {
  return collapseSpaces(removeScriptTagText(value).replace(/[^A-Za-z0-9\-\s]/g, '')).slice(0, maxLengths.name)
}

function sanitizeWarehouseCode(value) {
  return String(value ?? '')
    .replace(/[^A-Z0-9-]/g, '')
    .slice(0, maxLengths.warehouseCode)
}

function sanitizeLocation(value) {
  return collapseSpaces(removeScriptTagText(value).replace(/[^A-Za-z\s]/g, '')).slice(0, maxLengths.location)
}

function sanitizeManagerName(value) {
  return collapseSpaces(String(value ?? '').replace(/[^A-Za-z\s]/g, '')).replace(/^\s+/, '').slice(0, maxLengths.managerName)
}

function generateWarehouseCode(location, name) {
  const base = String(location || name || 'WH').trim().replace(/[^A-Za-z]/g, '').toUpperCase()
  const locCode = base.length >= 3 ? base.slice(0, 3) : (base + 'XXX').slice(0, 3)
  const randomNum = Math.floor(100 + Math.random() * 900)
  return `WH-${locCode}-${randomNum}`
}

function sanitizeEmailForSubmit(value) {
  return sanitizeEmailInput(removeScriptTagText(value).replace(/[<>]/g, ''))
}

function getWarehouseNameError(value) {
  const cleanValue = sanitizeWarehouseName(value).trim()

  if (!cleanValue) {
    return 'Warehouse name is required.'
  }

  if (cleanValue.length < 3) {
    return 'Warehouse name must be at least 3 characters.'
  }

  if (cleanValue.length > maxLengths.name) {
    return `Warehouse name must be ${maxLengths.name} characters or fewer.`
  }

  if (!/[A-Za-z]/.test(cleanValue)) {
    return 'Warehouse name must include letters.'
  }

  if (!/^[A-Za-z0-9 -]+$/.test(cleanValue)) {
    return 'Use only letters, numbers, spaces, and hyphens.'
  }

  return ''
}

function getLocationError(value) {
  const cleanValue = String(value ?? '').trim()

  if (!cleanValue) {
    return 'Location is required.'
  }

  if (cleanValue.length < 2) {
    return 'Location must be at least 2 characters.'
  }

  if (!/^[A-Za-z ]+$/.test(cleanValue) || !/[A-Za-z]/.test(cleanValue)) {
    return 'Use alphabetic location names only.'
  }

  return ''
}

function getManagerNameError(value) {
  const cleanValue = String(value ?? '').trim()

  if (!cleanValue) {
    return 'Manager name is required.'
  }

  if (cleanValue.length < 3) {
    return 'Manager name must be at least 3 characters.'
  }

  if (/^\d+$/.test(cleanValue) || !/[A-Za-z]/.test(cleanValue)) {
    return 'Manager name must contain alphabetic characters and cannot contain only numbers.'
  }

  if (!/^[A-Za-z .'-]+$/.test(cleanValue)) {
    return 'Use letters, spaces, hyphens, and apostrophes only.'
  }

  return ''
}

export default function WarehouseForm({
  initialValues,
  canSubmit,
  isSubmitting = false,
  mode = 'create',
  onSubmit,
  onCancel,
}) {
  const formRef = useRef(null)
  const [formData, setFormData] = useState(() => ({
    ...emptyForm,
    name: sanitizeWarehouseName(initialValues?.name ?? '').trim(),
    warehouseCode: sanitizeWarehouseCode(initialValues?.warehouseCode ?? ''),
    location: sanitizeLocation(initialValues?.location ?? '').trim(),
    managerName: sanitizeManagerName(initialValues?.managerName ?? '').trim(),
    phone: sanitizePhoneInput(initialValues?.phone ?? ''),
    email: sanitizeEmailInput(initialValues?.email ?? ''),
    status: normalizeStatus(initialValues?.status),
  }))
  const [touched, setTouched] = useState({})
  const [submitted, setSubmitted] = useState(false)

  const errors = useMemo(() => ({
    warehouseCode: '',
    name: getWarehouseNameError(formData.name),
    location: getLocationError(formData.location),
    managerName: getManagerNameError(formData.managerName),
    phone: getPhoneError(formData.phone),
    email: getEmailError(formData.email, { required: true }),
    status: statusOptions.includes(formData.status) ? '' : 'Choose Active or Inactive.',
  }), [
    formData.email,
    formData.location,
    formData.managerName,
    formData.name,
    formData.phone,
    formData.status,
    formData.warehouseCode,
  ])

  const isValid = Object.values(errors).every((value) => !value)
  const actionLabel = mode === 'edit' ? 'Save Warehouse' : 'Create Warehouse'
  const submittingLabel = mode === 'edit' ? 'Saving...' : 'Creating...'

  function shouldShowError(fieldName) {
    return submitted || Boolean(touched[fieldName])
  }

  function getVisibleError(fieldName) {
    return shouldShowError(fieldName) ? errors[fieldName] : ''
  }

  function sanitizeFieldValue(name, value) {
    switch (name) {
      case 'name':
        return sanitizeWarehouseName(value)
      case 'warehouseCode':
        return sanitizeWarehouseCode(value)
      case 'location':
        return sanitizeLocation(value)
      case 'managerName':
        return sanitizeManagerName(value)
      case 'phone':
        return sanitizePhoneInput(value)
      case 'email':
        return sanitizeEmailInput(value)
      default:
        return value
    }
  }

  function handleRestrictedKeyDown(allowedPattern) {
    return (event) => {
      const allowedControlKeys = [
        'Backspace',
        'Delete',
        'ArrowLeft',
        'ArrowRight',
        'ArrowUp',
        'ArrowDown',
        'Home',
        'End',
        'Tab',
        'Enter',
      ]

      if (allowedControlKeys.includes(event.key) || event.ctrlKey || event.metaKey) {
        return
      }

      if (!allowedPattern.test(event.key)) {
        event.preventDefault()
      }
    }
  }

  function focusFirstInvalidField(nextErrors) {
    const firstInvalidFieldName = ['warehouseCode', 'name', 'location', 'managerName', 'phone', 'email', 'status']
      .find((fieldName) => nextErrors[fieldName])

    if (!firstInvalidFieldName || !formRef.current) {
      return
    }

    const field = formRef.current.querySelector(`[name="${firstInvalidFieldName}"]`)

    if (field) {
      field.scrollIntoView({ behavior: 'smooth', block: 'center' })
      window.setTimeout(() => field.focus({ preventScroll: true }), 120)
    }
  }

  function handleChange(event) {
    const { name, value } = event.target
    const nextValue = sanitizeFieldValue(name, value)

    setFormData((currentValue) => ({
      ...currentValue,
      [name]: nextValue,
    }))

    if (name !== 'email') {
      setTouched((currentValue) => ({
        ...currentValue,
        [name]: true,
      }))
    }
  }

  function handleEmailChange(event) {
    const nextValue = sanitizeEmailInput(event.target.value)

    setFormData((currentValue) => ({
      ...currentValue,
      email: nextValue,
    }))

    setTouched((currentValue) => ({
      ...currentValue,
      email: true,
    }))
  }

  function handleBlur(event) {
    const { name, value } = event.target

    setTouched((currentValue) => ({
      ...currentValue,
      [name]: true,
    }))

    setFormData((currentValue) => ({
      ...currentValue,
      [name]: name === 'email'
        ? sanitizeEmailInput(value)
        : sanitizeFieldValue(name, value).trim(),
    }))
  }

  function handleStatusChange(status) {
    setFormData((currentValue) => ({
      ...currentValue,
      status,
    }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    setSubmitted(true)
    setTouched({
      warehouseCode: true,
      name: true,
      location: true,
      managerName: true,
      phone: true,
      email: true,
    })

    if (!isValid || isSubmitting) {
      focusFirstInvalidField(errors)
      return
    }

    const finalWarehouseCode = mode === 'create'
      ? generateWarehouseCode(formData.location, formData.name)
      : sanitizeWarehouseCode(formData.warehouseCode).trim()

    onSubmit({
      name: sanitizeWarehouseName(formData.name).trim(),
      warehouseCode: finalWarehouseCode,
      location: sanitizeLocation(formData.location).trim(),
      managerName: sanitizeManagerName(formData.managerName).trim(),
      phone: sanitizePhoneInput(formData.phone),
      email: sanitizeEmailForSubmit(formData.email),
      status: formData.status.toLowerCase()
    })
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="warehouse-form" noValidate>
      <div className="warehouse-form__surface">
        <div className="warehouse-form__grid">
          <InputField
            id="warehouse-name"
            name="name"
            label="Warehouse Name *"
            value={formData.name}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="Mumbai Central Warehouse"
            error={getVisibleError('name')}
            maxLength={maxLengths.name}
            onKeyDown={handleRestrictedKeyDown(/^[A-Za-z0-9 -]$/)}
            disabled={isSubmitting}
          />

          <InputField
            id="warehouse-location"
            name="location"
            label="Location *"
            value={formData.location}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="Mumbai"
            error={getVisibleError('location')}
            maxLength={maxLengths.location}
            onKeyDown={handleRestrictedKeyDown(/^[A-Za-z ]$/)}
            disabled={isSubmitting}
          />

          <InputField
            id="warehouse-manager"
            name="managerName"
            label="Manager Name *"
            value={formData.managerName}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="Operations Manager"
            error={getVisibleError('managerName')}
            maxLength={maxLengths.managerName}
            onKeyDown={handleRestrictedKeyDown(/^[A-Za-z .'-]$/)}
            disabled={isSubmitting}
          />

          <InputField
            id="warehouse-phone"
            name="phone"
            label="Phone *"
            {...phoneInputProps}
            value={formData.phone}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="9876543210"
            error={getVisibleError('phone')}
            disabled={isSubmitting}
          />

          <InputField
            id="warehouse-email"
            name="email"
            label="Email *"
            {...emailInputProps}
            value={formData.email}
            onChange={handleEmailChange}
            onBlur={handleBlur}
            placeholder="warehouse@example.com"
            error={getVisibleError('email')}
            disabled={isSubmitting}
          />

          <div className="field warehouse-form__status-field">
            <label id="warehouse-status-label">
              Status *
            </label>
            <div
              className="warehouse-form__segmented"
              role="radiogroup"
              aria-labelledby="warehouse-status-label"
            >
              {statusOptions.map((status) => {
                const isSelected = formData.status === status

                return (
                  <button
                    key={status}
                    type="button"
                    className={`warehouse-form__segment ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => handleStatusChange(status)}
                    disabled={isSubmitting}
                    role="radio"
                    aria-checked={isSelected}
                  >
                    {status}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="warehouse-form__footer">
        <button className="button button-cancel button-secondary"
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </button>

        <button
          type="submit"
          className="button button-primary warehouse-form__submit"
          disabled={!canSubmit || !isValid || isSubmitting}
        >
          {isSubmitting ? <LoaderCircle size={16} className="animate-spin" /> : null}
          {isSubmitting ? submittingLabel : actionLabel}
        </button>
      </div>
    </form>
  )
}
