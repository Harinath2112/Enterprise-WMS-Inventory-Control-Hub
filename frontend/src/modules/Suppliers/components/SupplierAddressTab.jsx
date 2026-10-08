import { MapPin, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import InputField from '../../../components/InputField'
import SearchableSelect from '../../../components/SearchableSelect'
import { COUNTRY_OPTIONS, INDIA_STATES, toOptions } from '../supplierMasterData'
import { SupplierSection } from './SupplierFormSections'

const ADDRESS_TYPES = [
  { value: 'Billing', label: 'Billing' },
  { value: 'Shipping', label: 'Shipping' },
  { value: 'Warehouse', label: 'Warehouse' },
  { value: 'Head Office', label: 'Head Office' },
  { value: 'Branch Office', label: 'Branch Office' },
  { value: 'Factory', label: 'Factory' },
]

const COUNTRY_SELECT_OPTIONS = toOptions(COUNTRY_OPTIONS)
const OTHER_COUNTRY_OPTION = { value: 'Other Country', label: 'Other Country' }
const COUNTRY_FIELD_OPTIONS = [
  ...COUNTRY_SELECT_OPTIONS.filter((option) => option.value !== OTHER_COUNTRY_OPTION.value),
  OTHER_COUNTRY_OPTION,
]
const INDIA_STATE_OPTIONS = toOptions(INDIA_STATES)
const SELECT_PORTAL_Z_INDEX = 2147483647
const ADDRESS_SELECT_MAX_MENU_HEIGHT = 300

const emptyAddress = {
  type: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  country: 'India',
  state: '',
  pincode: '',
}

function normalizeCountry(value) {
  const rawCountry = typeof value === 'object' && value !== null
    ? value.value ?? value.label ?? value.name ?? value.Name ?? ''
    : value
  const country = String(rawCountry ?? '').trim()
  return country || 'India'
}

function getRawCountry(value) {
  const rawCountry = typeof value === 'object' && value !== null
    ? value.value ?? value.label ?? value.name ?? value.Name ?? ''
    : value
  return String(rawCountry ?? '').trim()
}

function normalizeAddressValue(value) {
  if (typeof value === 'object' && value !== null) {
    return String(value.value ?? value.label ?? value.name ?? value.Name ?? '')
  }

  return String(value ?? '')
}

function isIndiaCountry(value) {
  return normalizeCountry(value).toLowerCase() === 'india'
}

function getVisibleError({ error, blurred, focused = false, submitted = false }) {
  if (!error) return ''
  if (focused) return ''
  if (submitted) return error
  if (blurred) return error
  return ''
}

function getCompleteClass({ value, error, blurred }) {
  return value && blurred && !error ? 'field--complete' : ''
}

function getAddressCardTitle(addresses, address, index) {
  if (!address.type) {
    return `Address ${index + 1}`
  }

  const sameTypeIndex = addresses
    .slice(0, index + 1)
    .filter((item) => item.type === address.type)
    .length

  return sameTypeIndex > 1 ? `${address.type} Address ${sameTypeIndex}` : `${address.type} Address`
}

function AddressCountryStateFields({
  index,
  country,
  state,
  isIndia,
  countryError,
  stateError,
  countryBlurred,
  stateBlurred,
  countryFocused,
  stateFocused,
  showErrors,
  readOnly,
  addressCountry,
  addressState,
  onAddressChange,
  onAddressBlur,
  onAddressFocus,
  isManualCountry,
  onOtherCountrySelect,
  onManualCountryChange,
}) {
  return (
    <>
      {isIndia ? (
        <SearchableSelect
          key={`address-${index}-state-select-${country}`}
          id={`supplier-address-state-${index}`}
          name="state"
          label="State *"
          value={state}
          onChange={(event) => onAddressChange(index, event)}
          onBlur={(event) => onAddressBlur(index, event)}
          options={INDIA_STATE_OPTIONS}
          placeholder="Select state"
          searchPlaceholder="Search state"
          error={getVisibleError({ error: stateError, blurred: stateBlurred, focused: stateFocused, submitted: showErrors })}
          showError={showErrors || stateBlurred}
          className={`supplier-address-field supplier-address-select ${getCompleteClass({ value: addressState, error: stateError, blurred: stateBlurred && !stateFocused })}`.trim()}
          disabled={readOnly}
        />
      ) : (
        <InputField
          key={`address-${index}-state-input-${country}`}
          id={`supplier-address-state-${index}`}
          name="state"
          label="State / Province *"
          value={state}
          placeholder="Enter state/province"
          onFocus={(event) => onAddressFocus(index, event)}
          onChange={(event) => onAddressChange(index, event)}
          onBlur={(event) => onAddressBlur(index, event)}
          error={stateError}
          className={`supplier-address-field ${getCompleteClass({ value: addressState, error: stateError, blurred: stateBlurred && !stateFocused })}`.trim()}
          disabled={readOnly}
        />
      )}

      {isManualCountry ? (
        <InputField
          key={`address-${index}-country-input`}
          id={`supplier-address-country-${index}`}
          name="country"
          label="Country *"
          value={country}
          placeholder="Enter country name"
          onFocus={(event) => onAddressFocus(index, event)}
          onChange={(event) => onManualCountryChange(index, event)}
          onBlur={(event) => onAddressBlur(index, event)}
          error={countryError}
          className={`supplier-address-field ${getCompleteClass({ value: addressCountry, error: countryError, blurred: countryBlurred && !countryFocused })}`.trim()}
          disabled={readOnly}
        />
      ) : (
        <SearchableSelect
          id={`supplier-address-country-${index}`}
          name="country"
          label="Country *"
          value={country}
          onChange={(event) => {
            const val = event.target.value
            if (val === OTHER_COUNTRY_OPTION.value) {
              onOtherCountrySelect(index)
            } else {
              onAddressChange(index, event)
            }
          }}
          onBlur={(event) => onAddressBlur(index, event)}
          options={COUNTRY_FIELD_OPTIONS}
          placeholder="Select country"
          searchPlaceholder="Search country"
          error={getVisibleError({ error: countryError, blurred: countryBlurred, focused: countryFocused, submitted: showErrors })}
          showError={showErrors || countryBlurred}
          className={`supplier-address-field supplier-address-select ${getCompleteClass({ value: addressCountry, error: countryError, blurred: countryBlurred && !countryFocused })}`.trim()}
          disabled={readOnly}
        />
      )}
    </>
  )
}

export default function SupplierAddressTab({
  addresses,
  errors = [],
  warnings = [],
  showErrors = false,
  onChange,
  onAdd,
  onRemove,
  readOnly,
  validationRunId = 0,
}) {
  const [blurredFields, setBlurredFields] = useState(() => new Set())
  const [focusedFields, setFocusedFields] = useState(() => new Set())
  const [suppressedFields, setSuppressedFields] = useState(() => new Set())
  const [manualCountryIndexes, setManualCountryIndexes] = useState(() => new Set())

  useEffect(() => {
    setSuppressedFields(new Set())
  }, [validationRunId])

  function getFieldKey(index, name) {
    return `${index}:${name}`
  }

  function hasBlurred(index, name) {
    return blurredFields.has(getFieldKey(index, name))
  }

  function isFocused(index, name) {
    return focusedFields.has(getFieldKey(index, name))
  }

  function isSuppressed(index, name) {
    return suppressedFields.has(getFieldKey(index, name))
  }

  function removeFieldKey(currentValue, index, name) {
    const nextValue = new Set(currentValue)
    nextValue.delete(getFieldKey(index, name))
    return nextValue
  }

  function clearDependentAddressState(index) {
    setBlurredFields((currentValue) => {
      let nextValue = removeFieldKey(currentValue, index, 'country')
      nextValue = removeFieldKey(nextValue, index, 'state')
      nextValue = removeFieldKey(nextValue, index, 'pincode')
      return nextValue
    })
    setFocusedFields((currentValue) => {
      let nextValue = removeFieldKey(currentValue, index, 'country')
      nextValue = removeFieldKey(nextValue, index, 'state')
      nextValue = removeFieldKey(nextValue, index, 'pincode')
      return nextValue
    })
    setSuppressedFields((currentValue) => {
      const nextValue = new Set(currentValue)
      nextValue.add(getFieldKey(index, 'country'))
      nextValue.add(getFieldKey(index, 'state'))
      nextValue.add(getFieldKey(index, 'pincode'))
      return nextValue
    })
  }

  function clearSuppression(index, name) {
    setSuppressedFields((currentValue) => removeFieldKey(currentValue, index, name))
  }

  function isManualCountryMode(index, country) {
    const rawCountry = getRawCountry(country)
    return manualCountryIndexes.has(getFieldKey(index, 'manualCountry')) ||
      Boolean(rawCountry && !isIndiaCountry(rawCountry) && !COUNTRY_SELECT_OPTIONS.some((option) => option.value === rawCountry))
  }

  function handleAddressFocus(index, event) {
    clearSuppression(index, event.target.name)
    setFocusedFields((currentValue) => new Set(currentValue).add(getFieldKey(index, event.target.name)))
  }

  function handleAddressBlur(index, event) {
    clearSuppression(index, event.target.name)
    setBlurredFields((currentValue) => new Set(currentValue).add(getFieldKey(index, event.target.name)))
    setFocusedFields((currentValue) => {
      const nextValue = new Set(currentValue)
      nextValue.delete(getFieldKey(index, event.target.name))
      return nextValue
    })
  }

  function handleAddressChange(index, event) {
    if (event.target.name === 'country') {
      clearDependentAddressState(index)
      if (isIndiaCountry(event.target.value) || COUNTRY_SELECT_OPTIONS.some((option) => option.value === event.target.value)) {
        setManualCountryIndexes((currentValue) => removeFieldKey(currentValue, index, 'manualCountry'))
      }
    } else {
      clearSuppression(index, event.target.name)
      if (event.target.name === 'state') {
        clearSuppression(index, 'pincode')
      }
    }

    onChange(index, event)
  }

  function handleOtherCountrySelect(index) {
    setManualCountryIndexes((currentValue) => new Set(currentValue).add(getFieldKey(index, 'manualCountry')))
    clearDependentAddressState(index)
    onChange(index, { target: { name: 'country', value: '' } })
  }

  function handleManualCountryChange(index, event) {
    const nextCountry = getRawCountry(event.target.value)

    if (isIndiaCountry(nextCountry) || COUNTRY_SELECT_OPTIONS.some((option) => option.value === nextCountry)) {
      setManualCountryIndexes((currentValue) => removeFieldKey(currentValue, index, 'manualCountry'))
    } else {
      setManualCountryIndexes((currentValue) => new Set(currentValue).add(getFieldKey(index, 'manualCountry')))
    }

    handleAddressChange(index, event)
  }

  return (
    <SupplierSection
      className="supplier-address-section"
      title="Addresses"
      actions={
        !readOnly ? (
          <button type="button" className="button button-secondary supplier-address-add-button" onClick={() => onAdd(emptyAddress)}>
            <Plus size={16} />
            Add Address
          </button>
        ) : null
      }
    >
      <div className="supplier-repeat-grid supplier-address-grid">
        {addresses.map((address, index) => {
            const rawCountry = getRawCountry(address.country)
            const manualCountry = isManualCountryMode(index, rawCountry)
            const country = manualCountry ? rawCountry : normalizeCountry(address.country)
            const state = normalizeAddressValue(address.state)
            const isIndia = isIndiaCountry(country)
            const addressErrors = errors[index] || {}
            const addressWarnings = warnings[index] || {}
            const typeBlurred = hasBlurred(index, 'type')
            const typeFocused = isFocused(index, 'type')
            const line1Blurred = hasBlurred(index, 'addressLine1')
            const line1Focused = isFocused(index, 'addressLine1')
            const line2Blurred = hasBlurred(index, 'addressLine2')
            const line2Focused = isFocused(index, 'addressLine2')
            const cityBlurred = hasBlurred(index, 'city')
            const cityFocused = isFocused(index, 'city')
            const countryBlurred = hasBlurred(index, 'country')
            const countryFocused = isFocused(index, 'country')
            const countrySuppressed = isSuppressed(index, 'country')
            const stateBlurred = hasBlurred(index, 'state')
            const stateFocused = isFocused(index, 'state')
            const stateSuppressed = isSuppressed(index, 'state')
            const pincodeBlurred = hasBlurred(index, 'pincode')
            const pincodeFocused = isFocused(index, 'pincode')
            const pincodeSuppressed = isSuppressed(index, 'pincode')
            const showPincodeWarning = Boolean(addressWarnings.pincode && !addressErrors.pincode && (showErrors || pincodeBlurred))
            const stateError = stateSuppressed
              ? ''
              : getVisibleError({ error: addressErrors.state, blurred: stateBlurred, focused: stateFocused, submitted: showErrors })
            const pincodeError = pincodeSuppressed
              ? ''
              : addressErrors.pincode && (showErrors || pincodeBlurred || (address.pincode && String(address.pincode).trim().length >= 6))
                ? addressErrors.pincode
                : getVisibleError({ error: addressErrors.pincode, blurred: pincodeBlurred, focused: pincodeFocused, submitted: showErrors })
            const line1Error = addressErrors.addressLine1 && (showErrors || line1Blurred || (address.addressLine1 && address.addressLine1.trim().length >= 3))
              ? addressErrors.addressLine1
              : getVisibleError({ error: addressErrors.addressLine1, blurred: line1Blurred, focused: line1Focused, submitted: showErrors })
            const line2Error = addressErrors.addressLine2 && (showErrors || line2Blurred || (address.addressLine2 && address.addressLine2.trim().length >= 3))
              ? addressErrors.addressLine2
              : getVisibleError({ error: addressErrors.addressLine2, blurred: line2Blurred, focused: line2Focused, submitted: showErrors })
            const cityError = addressErrors.city && (showErrors || cityBlurred || Boolean(address.city))
              ? addressErrors.city
              : getVisibleError({ error: addressErrors.city, blurred: cityBlurred, focused: cityFocused, submitted: showErrors })
            const countryError = countrySuppressed
              ? ''
              : getVisibleError({ error: addressErrors.country, blurred: countryBlurred, focused: countryFocused, submitted: showErrors })

            return (
              <div className="supplier-address-card" key={address.id ?? index}>
              <div className="supplier-repeat-card__header supplier-address-card__header">
                <div>
                  <strong>{getAddressCardTitle(addresses, address, index)}</strong>
                </div>
                {!readOnly ? (
                  <button
                    type="button"
                    className="button button-danger supplier-icon-button supplier-address-delete-button"
                    onClick={() => onRemove(index)}
                    aria-label={`Remove address ${index + 1}`}
                  >
                    <Trash2 size={14} />
                  </button>
                ) : null}
              </div>
              <div className="form-grid supplier-form__grid">
                <SearchableSelect
                  id={`supplier-address-type-${index}`}
                  name="type"
                  label="Address Type *"
                  value={address.type}
                  onChange={(event) => handleAddressChange(index, event)}
                  onBlur={(event) => handleAddressBlur(index, event)}
                  options={ADDRESS_TYPES}
                  placeholder="Select address type"
                  searchPlaceholder="Search address type"
                  error={getVisibleError({ error: addressErrors.type, blurred: typeBlurred, focused: typeFocused, submitted: showErrors })}
                  showError={showErrors || typeBlurred}
                  className={`supplier-address-field supplier-address-select ${getCompleteClass({ value: address.type, error: addressErrors.type, blurred: typeBlurred && !typeFocused })}`.trim()}
                  disabled={readOnly}
                />
                <InputField
                  id={`supplier-address-line1-${index}`}
                  name="addressLine1"
                  label="Address Line 1 *"
                  value={address.addressLine1}
                  placeholder="Enter street address, building, or locality"
                  onFocus={(event) => handleAddressFocus(index, event)}
                  onChange={(event) => handleAddressChange(index, event)}
                  onBlur={(event) => handleAddressBlur(index, event)}
                  error={line1Error}
                  className={`supplier-address-field supplier-address-field--full ${getCompleteClass({ value: address.addressLine1, error: addressErrors.addressLine1, blurred: line1Blurred && !line1Focused })}`.trim()}
                  disabled={readOnly}
                />
                <InputField
                  id={`supplier-address-line2-${index}`}
                  name="addressLine2"
                  label="Address Line 2"
                  value={address.addressLine2}
                  placeholder="Apartment, suite, landmark (optional)"
                  onFocus={(event) => handleAddressFocus(index, event)}
                  onChange={(event) => handleAddressChange(index, event)}
                  onBlur={(event) => handleAddressBlur(index, event)}
                  error={line2Error}
                  className={`supplier-address-field supplier-address-field--full ${getCompleteClass({ value: address.addressLine2, error: addressErrors.addressLine2, blurred: line2Blurred && !line2Focused })}`.trim()}
                  disabled={readOnly}
                />
                <InputField
                  id={`supplier-address-city-${index}`}
                  name="city"
                  label="City *"
                  value={address.city}
                  placeholder="Enter city"
                  onFocus={(event) => handleAddressFocus(index, event)}
                  onChange={(event) => handleAddressChange(index, event)}
                  onBlur={(event) => handleAddressBlur(index, event)}
                  error={cityError}
                  className={`supplier-address-field ${getCompleteClass({ value: address.city, error: addressErrors.city, blurred: cityBlurred && !cityFocused })}`.trim()}
                  disabled={readOnly}
                />
                <AddressCountryStateFields
                  index={index}
                  country={country}
                  state={state}
                  isIndia={isIndia}
                  countryError={countryError}
                  stateError={stateError}
                  countryBlurred={countryBlurred}
                  stateBlurred={stateBlurred}
                  countryFocused={countryFocused}
                  stateFocused={stateFocused}
                  showErrors={showErrors}
                  readOnly={readOnly}
                  addressCountry={address.country}
                  addressState={address.state}
                  onAddressChange={handleAddressChange}
                  onAddressBlur={handleAddressBlur}
                  onAddressFocus={handleAddressFocus}
                  isManualCountry={manualCountry}
                  onOtherCountrySelect={handleOtherCountrySelect}
                  onManualCountryChange={handleManualCountryChange}
                />
                <InputField
                  id={`supplier-address-pincode-${index}`}
                  name="pincode"
                  label={isIndia ? 'Pincode' : 'Postal Code'}
                  value={normalizeAddressValue(address.pincode)}
                  placeholder={isIndia ? 'Enter 6-digit pincode' : 'Enter postal code'}
                  onFocus={(event) => handleAddressFocus(index, event)}
                  onChange={(event) => handleAddressChange(index, event)}
                  onBlur={(event) => handleAddressBlur(index, event)}
                  error={pincodeError}
                  helperText={showPincodeWarning ? addressWarnings.pincode : ''}
                  className={`supplier-address-field ${showPincodeWarning ? 'field--warning' : ''} ${getCompleteClass({ value: address.pincode, error: addressErrors.pincode, blurred: pincodeBlurred && !pincodeFocused })}`.trim()}
                  inputMode={isIndia ? 'numeric' : 'text'}
                  maxLength={isIndia ? 6 : 12}
                  pattern={isIndia ? '[0-9]*' : undefined}
                  disabled={readOnly}
                />
              </div>
            </div>
        )})}
      </div>
    </SupplierSection>
  )
}
