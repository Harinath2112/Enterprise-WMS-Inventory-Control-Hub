import { Mail, Plus, Trash2, UserRound } from 'lucide-react'
import { useState } from 'react'
import CreatableSearchableSelect from '../../../components/CreatableSearchableSelect'
import InputField from '../../../components/InputField'
import { emailInputProps } from '../../../validators/emailValidator'
import { phoneInputProps, sanitizePhoneInput } from '../../../validators/phoneValidator'
import { SupplierSection } from './SupplierFormSections'
import { getBusinessTitleError } from './SupplierForm'

const emptyContact = {
  name: '',
  designation: '',
  department: '',
  phone: '',
  email: '',
  isPrimary: false,
}

function getVisibleError({ error, blurred, focused = false, submitted = false, value = '' }) {
  if (!error) return ''
  if (focused && !error.includes('already exists') && !error.includes('invalid') && !error.includes('repetitive')) return ''
  if (submitted) return error
  if (blurred) return error
  if (value && String(value).trim()) return error
  return ''
}

function getCompleteClass({ value, error, blurred }) {
  return value && blurred && !error ? 'field--complete' : ''
}

function buildContactEvent(event, value) {
  return {
    ...event,
    target: {
      name: event.target.name,
      type: event.target.type,
      checked: event.target.checked,
      value,
    },
  }
}

export default function SupplierContactsTab({
  contacts,
  errors = [],
  showErrors = false,
  onChange,
  onAdd,
  onRemove,
  departmentOptions = [],
  getDesignationOptions = () => [],
  onCreateMasterOption,
  readOnly,
}) {
  const [blurredFields, setBlurredFields] = useState(() => new Set())
  const [focusedFields, setFocusedFields] = useState(() => new Set())
  const [removeIndex, setRemoveIndex] = useState(null)

  function getFieldKey(index, name) {
    return `${index}:${name}`
  }

  function hasBlurred(index, name) {
    return blurredFields.has(getFieldKey(index, name))
  }

  function isFocused(index, name) {
    return focusedFields.has(getFieldKey(index, name))
  }

  function handleContactFocus(index, event) {
    setFocusedFields((currentValue) => new Set(currentValue).add(getFieldKey(index, event.target.name)))
  }

  function handleContactBlur(index, event) {
    setBlurredFields((currentValue) => new Set(currentValue).add(getFieldKey(index, event.target.name)))
    setFocusedFields((currentValue) => {
      const nextValue = new Set(currentValue)
      nextValue.delete(getFieldKey(index, event.target.name))
      return nextValue
    })
  }

  function handleContactChange(index, event) {
    const { name, value } = event.target
    const nextEvent = name === 'phone'
      ? buildContactEvent(event, sanitizePhoneInput(value))
      : event

    onChange(index, nextEvent)
  }

  function markPrimary(index) {
    handleContactChange(index, {
      target: {
        name: 'isPrimary',
        type: 'checkbox',
        checked: true,
        value: true,
      },
    })
  }

  function requestRemove(index) {
    setRemoveIndex(index)
  }

  function confirmRemove() {
    if (removeIndex === null) return
    onRemove(removeIndex)
    setRemoveIndex(null)
  }

  return (
    <SupplierSection
      className="supplier-contact-section"
      title="Contact Persons"
      actions={
        !readOnly ? (
          <button type="button" className="button button-secondary supplier-contact-add-button" onClick={() => onAdd(emptyContact)}>
            <Plus size={16} />
            Add Contact
          </button>
        ) : null
      }
    >
      <div className="supplier-repeat-grid supplier-contact-grid">
        {contacts.map((contact, index) => {
            const contactErrors = errors[index] || {}
            const nameBlurred = hasBlurred(index, 'name')
            const nameFocused = isFocused(index, 'name')
            const designationBlurred = hasBlurred(index, 'designation')
            const designationFocused = isFocused(index, 'designation')
            const departmentBlurred = hasBlurred(index, 'department')
            const departmentFocused = isFocused(index, 'department')
            const phoneBlurred = hasBlurred(index, 'phone')
            const phoneFocused = isFocused(index, 'phone')
            const emailBlurred = hasBlurred(index, 'email')
            const emailFocused = isFocused(index, 'email')

            const nameError = contactErrors.name && (showErrors || nameBlurred || (contact.name && contactErrors.name.includes('already exists')))
              ? contactErrors.name
              : getVisibleError({ error: contactErrors.name, blurred: nameBlurred, focused: nameFocused, submitted: showErrors })

            return (
              <div className="supplier-contact-card" key={contact.contactId ?? contact.id ?? index}>
                <div className="supplier-repeat-card__header supplier-contact-card__header">
                  <div>
                    <strong>{`Contact ${index + 1}`}</strong>
                  </div>
                  <div className="supplier-contact-card__header-actions">
                    {contact.isPrimary ? (
                      <span className="supplier-contact-primary-badge">Primary</span>
                    ) : !readOnly ? (
                      <button type="button" className="supplier-contact-primary-action" onClick={() => markPrimary(index)}>
                        Set primary
                      </button>
                    ) : null}
                    {!readOnly ? (
                      <button
                        type="button"
                        className="button button-danger supplier-icon-button supplier-contact-delete-button"
                      onClick={() => requestRemove(index)}
                      aria-label={`Remove contact ${index + 1}`}
                    >
                        <Trash2 size={14} />
                      </button>
                    ) : null}
                  </div>
                </div>
                <div className="form-grid supplier-form__grid">
                  {showErrors && contactErrors.duplicate ? (
                    <div className="field field--full field--error">
                      <span className="field-error" role="alert">{contactErrors.duplicate}</span>
                    </div>
                  ) : null}
                  <InputField
                    id={`supplier-contact-name-${index}`}
                    name="name"
                    label="Contact Name *"
                    value={contact.name}
                    placeholder="Enter contact name"
                    onFocus={(event) => handleContactFocus(index, event)}
                    onChange={(event) => handleContactChange(index, event)}
                    onBlur={(event) => handleContactBlur(index, event)}
                    error={nameError}
                    className={`supplier-contact-field ${getCompleteClass({ value: contact.name, error: contactErrors.name, blurred: nameBlurred && !nameFocused })}`.trim()}
                    disabled={readOnly}
                  />
                  <CreatableSearchableSelect
                    id={`supplier-contact-designation-${index}`}
                    name="designation"
                    label="Designation"
                    value={contact.designation}
                    onChange={(event) => handleContactChange(index, event)}
                    onBlur={(event) => handleContactBlur(index, event)}
                    options={getDesignationOptions(contact.department)}
                    placeholder="Select designation"
                    searchPlaceholder="Search or create designation"
                    createLabel="Create designation"
                    onCreateOption={(value) => onCreateMasterOption?.('designations', value)}
                    isValidOption={(val) => !getBusinessTitleError(val, 'Designation')}
                    error={getVisibleError({ error: contactErrors.designation, blurred: designationBlurred, focused: designationFocused, submitted: showErrors, value: contact.designation })}
                    showError={showErrors || designationBlurred || Boolean(contact.designation && contactErrors.designation)}
                    className={`supplier-contact-field supplier-contact-select ${getCompleteClass({ value: contact.designation, error: contactErrors.designation, blurred: designationBlurred && !designationFocused })}`.trim()}
                    disabled={readOnly}
                  />
                  <CreatableSearchableSelect
                    id={`supplier-contact-department-${index}`}
                    name="department"
                    label="Department"
                    value={contact.department}
                    onChange={(event) => handleContactChange(index, event)}
                    onBlur={(event) => handleContactBlur(index, event)}
                    options={departmentOptions}
                    placeholder="Select department"
                    searchPlaceholder="Search or create department"
                    createLabel="Create department"
                    onCreateOption={(value) => onCreateMasterOption?.('departments', value)}
                    isValidOption={(val) => !getBusinessTitleError(val, 'Department')}
                    error={getVisibleError({ error: contactErrors.department, blurred: departmentBlurred, focused: departmentFocused, submitted: showErrors, value: contact.department })}
                    showError={showErrors || departmentBlurred || Boolean(contact.department && contactErrors.department)}
                    className={`supplier-contact-field supplier-contact-select ${getCompleteClass({ value: contact.department, error: contactErrors.department, blurred: departmentBlurred && !departmentFocused })}`.trim()}
                    disabled={readOnly}
                  />
                  <InputField
                    id={`supplier-contact-phone-${index}`}
                    name="phone"
                    label="Phone *"
                    {...phoneInputProps}
                    value={contact.phone}
                    placeholder="Enter phone number"
                    onFocus={(event) => handleContactFocus(index, event)}
                    onChange={(event) => handleContactChange(index, event)}
                    onBlur={(event) => handleContactBlur(index, event)}
                    error={getVisibleError({ error: contactErrors.phone, blurred: phoneBlurred, focused: phoneFocused, submitted: showErrors, value: contact.phone })}
                    className={`supplier-contact-field ${getCompleteClass({ value: contact.phone, error: contactErrors.phone, blurred: phoneBlurred && !phoneFocused })}`.trim()}
                    disabled={readOnly}
                  />
                  <InputField
                    id={`supplier-contact-email-${index}`}
                    name="email"
                    label="Email"
                    {...emailInputProps}
                    value={contact.email}
                    placeholder="Enter email address"
                    onFocus={(event) => handleContactFocus(index, event)}
                    onChange={(event) => handleContactChange(index, event)}
                    onBlur={(event) => handleContactBlur(index, event)}
                    error={getVisibleError({ error: contactErrors.email, blurred: emailBlurred, focused: emailFocused, submitted: showErrors, value: contact.email })}
                    className={`supplier-contact-field ${getCompleteClass({ value: contact.email, error: contactErrors.email, blurred: emailBlurred && !emailFocused })}`.trim()}
                    disabled={readOnly}
                  />
                </div>
              </div>
            )
        })}
      </div>
      {removeIndex !== null ? (
        <div className="supplier-bank-confirm-backdrop" role="presentation">
          <div className="supplier-bank-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="supplier-contact-remove-title">
            <strong id="supplier-contact-remove-title">Remove contact?</strong>
            <p>Are you sure you want to remove this contact?</p>
            <div className="supplier-bank-confirm-dialog__actions">
              <button type="button" className="button button-cancel" onClick={() => setRemoveIndex(null)}>
                Cancel
              </button>
              <button type="button" className="button button-danger" onClick={confirmRemove}>
                Remove
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </SupplierSection>
  )
}
