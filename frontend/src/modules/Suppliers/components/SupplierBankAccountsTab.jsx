import { Eye, EyeOff, Landmark, LoaderCircle, Plus, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import InputField from '../../../components/InputField'
import { SupplierSection } from './SupplierFormSections'

const emptyBankAccount = {
  accountName: '',
  accountNumber: '',
  bankName: '',
  ifscCode: '',
  branch: '',
  bankState: '',
  bankCity: '',
  upiId: '',
  bankNameAutoFilled: false,
  bankNameManualOverride: false,
  branchAutoFilled: false,
  branchManualOverride: false,
  bankCityAutoFilled: false,
  bankCityManualOverride: false,
  bankStateAutoFilled: false,
  bankStateManualOverride: false,
  ifscLookupStatus: '',
  ifscLookupMessage: '',
  isPrimary: false,
}

const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/

function getVisibleError({ value, error, dirty, blurred, focused = false, submitted = false, revealWhileTyping = true }) {
  if (!error) return ''
  if (focused) return ''
  if (submitted) return error
  if (blurred) return error
  return revealWhileTyping && dirty && value ? error : ''
}

function getIfscValue(value) {
  return String(value ?? '').replace(/\s/g, '').toUpperCase().slice(0, 11)
}

function getSuccessClass({ value, error, dirty, blurred, isEmptyAccount }) {
  if (isEmptyAccount || (!dirty && !blurred)) return ''
  return value && !error ? 'field--complete' : ''
}

function getAccountNumberErrorMessage(error) {
  if (!error) return ''
  if (/duplicate|already used|combination/i.test(error)) return error
  return 'Use a valid account number.'
}

function getAutomationClass(isAutomated, baseClass = '') {
  return `${baseClass} ${isAutomated ? 'field--automation' : ''}`.trim()
}

export default function SupplierBankAccountsTab({
  bankAccounts,
  errors = [],
  showErrors = false,
  onChange,
  onAdd,
  onRemove,
  onIfscLookup,
  readOnly,
}) {
  const [revealedAccounts, setRevealedAccounts] = useState(() => new Set())
  const [checkingIfscFields, setCheckingIfscFields] = useState(() => new Set())
  const [interactedFields, setInteractedFields] = useState(() => new Set())
  const [blurredFields, setBlurredFields] = useState(() => new Set())
  const [focusedFields, setFocusedFields] = useState(() => new Set())
  const [removeIndex, setRemoveIndex] = useState(null)
  const lookupTimersRef = useRef(new Map())
  const lookupRequestsRef = useRef(new Set())
  const onIfscLookupRef = useRef(onIfscLookup)

  useEffect(() => {
    const lookupTimers = lookupTimersRef.current
    return () => {
      lookupTimers.forEach((timerId) => window.clearTimeout(timerId))
      lookupTimers.clear()
    }
  }, [])

  useEffect(() => {
    onIfscLookupRef.current = onIfscLookup
  }, [onIfscLookup])

  useEffect(() => {
    if (readOnly || typeof onIfscLookupRef.current !== 'function') {
      return undefined
    }

    const activeLookupKeys = new Set()

    bankAccounts.forEach((account, index) => {
      const ifscCode = String(account.ifscCode || '').trim().toUpperCase()
      const lookupKey = `${index}:${ifscCode}`

      if (!IFSC_PATTERN.test(ifscCode) || account.ifscLookupStatus !== 'pending') {
        return
      }

      activeLookupKeys.add(lookupKey)

      if (lookupTimersRef.current.has(lookupKey) || lookupRequestsRef.current.has(lookupKey)) {
        return
      }

      const timerId = window.setTimeout(async () => {
        lookupTimersRef.current.delete(lookupKey)
        lookupRequestsRef.current.add(lookupKey)
        setCheckingIfscFields((currentValue) => new Set(currentValue).add(String(index)))

        try {
          await onIfscLookupRef.current(index, ifscCode)
        } finally {
          lookupRequestsRef.current.delete(lookupKey)
          setCheckingIfscFields((currentValue) => {
            const nextValue = new Set(currentValue)
            nextValue.delete(String(index))
            return nextValue
          })
        }
      }, 450)

      lookupTimersRef.current.set(lookupKey, timerId)
    })

    lookupTimersRef.current.forEach((timerId, lookupKey) => {
      if (!activeLookupKeys.has(lookupKey)) {
        window.clearTimeout(timerId)
        lookupTimersRef.current.delete(lookupKey)
      }
    })

    return undefined
  }, [bankAccounts, readOnly])

  function toggleAccountVisibility(index) {
    setRevealedAccounts((currentValue) => {
      const nextValue = new Set(currentValue)
      if (nextValue.has(index)) {
        nextValue.delete(index)
      } else {
        nextValue.add(index)
      }
      return nextValue
    })
  }

  function getFieldKey(index, name) {
    return `${index}:${name}`
  }

  function hasInteracted(index, name) {
    return interactedFields.has(getFieldKey(index, name))
  }

  function hasBlurred(index, name) {
    return blurredFields.has(getFieldKey(index, name))
  }

  function isFocused(index, name) {
    return focusedFields.has(getFieldKey(index, name))
  }

  function markFieldInteracted(index, name) {
    setInteractedFields((currentValue) => {
      const key = getFieldKey(index, name)
      if (currentValue.has(key)) return currentValue
      return new Set(currentValue).add(key)
    })
  }

  function buildSanitizedEvent(event, value) {
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

  function handleBankFieldChange(index, event) {
    const { name, value } = event.target
    const nextEvent =
      name === 'accountNumber'
        ? buildSanitizedEvent(event, String(value ?? '').replace(/\D/g, '').slice(0, 18))
        : name === 'ifscCode'
          ? buildSanitizedEvent(event, getIfscValue(value))
          : event

    markFieldInteracted(index, name)
    onChange(index, nextEvent)
  }

  function handleAccountNumberPaste(index, event) {
    const pastedValue = event.clipboardData?.getData('text') || ''
    const currentValue = String(bankAccounts[index]?.accountNumber ?? '')
    const selectionStart = Number(event.target?.selectionStart ?? currentValue.length)
    const selectionEnd = Number(event.target?.selectionEnd ?? selectionStart)
    const beforeSelection = currentValue.slice(0, selectionStart)
    const afterSelection = currentValue.slice(selectionEnd)
    const nextValue = `${beforeSelection}${pastedValue.replace(/\D/g, '')}${afterSelection}`.slice(0, 18)

    event.preventDefault()
    handleBankFieldChange(index, {
      ...event,
      target: {
        ...event.target,
        name: 'accountNumber',
        value: nextValue,
      },
    })
  }

  function handleBankFieldFocus(index, event) {
    setFocusedFields((currentValue) => new Set(currentValue).add(getFieldKey(index, event.target.name)))
  }

  function handleBankFieldBlur(index, event) {
    markFieldInteracted(index, event.target.name)
    setBlurredFields((currentValue) => new Set(currentValue).add(getFieldKey(index, event.target.name)))
    setFocusedFields((currentValue) => {
      const nextValue = new Set(currentValue)
      nextValue.delete(getFieldKey(index, event.target.name))
      return nextValue
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
      className="supplier-bank-section"
      title="Bank Accounts"
      actions={
        !readOnly ? (
          <button type="button" className="button button-secondary supplier-bank-add-button" onClick={() => onAdd(emptyBankAccount)}>
            <Plus size={16} />
            Add Bank Account
          </button>
        ) : null
      }
    >
      <div className="supplier-repeat-grid supplier-bank-grid">
        {bankAccounts.map((account, index) => {
            const accountErrors = errors[index] || {}
            const isAccountRevealed = revealedAccounts.has(index)
            const isIfscChecking = checkingIfscFields.has(String(index))
            const isEmptyAccount = !account.accountName && !account.accountNumber && !account.bankName && !account.ifscCode && !account.branch && !account.bankState && !account.bankCity && !account.upiId
            const accountNameInteracted = hasInteracted(index, 'accountName')
            const accountNameBlurred = hasBlurred(index, 'accountName')
            const accountNameFocused = isFocused(index, 'accountName')
            const accountNumberInteracted = hasInteracted(index, 'accountNumber')
            const accountNumberBlurred = hasBlurred(index, 'accountNumber')
            const accountNumberFocused = isFocused(index, 'accountNumber')
            const bankNameInteracted = hasInteracted(index, 'bankName')
            const bankNameBlurred = hasBlurred(index, 'bankName')
            const bankNameFocused = isFocused(index, 'bankName')
            const ifscInteracted = hasInteracted(index, 'ifscCode')
            const ifscBlurred = hasBlurred(index, 'ifscCode')
            const ifscFocused = isFocused(index, 'ifscCode')
            const branchInteracted = hasInteracted(index, 'branch')
            const branchBlurred = hasBlurred(index, 'branch')
            const branchFocused = isFocused(index, 'branch')
            const upiInteracted = hasInteracted(index, 'upiId')
            const upiBlurred = hasBlurred(index, 'upiId')
            const upiFocused = isFocused(index, 'upiId')
            const hasExplicitPrimary = bankAccounts.some((acc) => acc.isPrimary)
            const isPrimary = hasExplicitPrimary ? Boolean(account.isPrimary) : index === 0
            const accountTitle = `Account ${index + 1}`
            const isIfscReady = String(account.ifscCode || '').length === 11
            const isIfscWarningVisible = account.ifscLookupStatus === 'unrecognized' && ifscBlurred && !ifscFocused && !isIfscChecking
            const isIfscMatchedVisible = account.ifscLookupStatus === 'recognized' && ifscInteracted && isIfscReady && !ifscFocused && !isIfscChecking
            const ifscHelperText =
              isIfscChecking
                ? 'Fetching bank details...'
                : isIfscWarningVisible
                  ? account.ifscLookupMessage || "We couldn't fetch bank details. You can enter them manually."
                  : isIfscMatchedVisible
                    ? 'Bank details fetched from IFSC.'
                    : ''
            const cardClassName = [
              'supplier-repeat-card',
              'supplier-bank-card',
              isEmptyAccount ? 'is-empty-account' : '',
              isIfscMatchedVisible ? 'is-ifsc-recognized' : '',
              isIfscWarningVisible ? 'is-ifsc-warning' : '',
            ]
              .filter(Boolean)
              .join(' ')

            return (
              <div className={cardClassName} key={account.id ?? index}>
                <div className="supplier-repeat-card__header supplier-bank-card__header">
                  <div>
                    <strong>{accountTitle}</strong>
                  </div>
                  <div className="supplier-bank-card__header-actions">
                    {isPrimary ? (
                      <button
                        type="button"
                        className="supplier-bank-primary-control is-primary"
                        disabled
                      >
                        Primary
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="supplier-bank-primary-control"
                        onClick={() => {
                          if (!readOnly) {
                            onChange(index, {
                              target: {
                                name: 'isPrimary',
                                value: true,
                                type: 'checkbox',
                                checked: true,
                              },
                            })
                          }
                        }}
                        disabled={readOnly}
                      >
                        Set as Primary
                      </button>
                    )}
                    {!readOnly ? (
                      <button
                        type="button"
                        className="button button-danger supplier-icon-button supplier-bank-delete-button"
                        onClick={() => requestRemove(index)}
                        aria-label={`Remove bank account ${index + 1}`}
                      >
                        <Trash2 size={15} />
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="supplier-bank-card__body">
                  <div className="form-grid supplier-form__grid">
                    <InputField
                      id={`supplier-bank-account-name-${index}`}
                      name="accountName"
                      label="Account Name *"
                      value={account.accountName}
                      placeholder="Enter account holder name"
                      onFocus={(event) => handleBankFieldFocus(index, event)}
                      onChange={(event) => handleBankFieldChange(index, event)}
                      onBlur={(event) => handleBankFieldBlur(index, event)}
                      error={getVisibleError({ value: account.accountName, error: accountErrors.accountName, dirty: accountNameInteracted, blurred: accountNameBlurred, focused: accountNameFocused, submitted: showErrors, revealWhileTyping: false })}
                      className={`supplier-bank-field supplier-bank-field--account-name ${getSuccessClass({ value: account.accountName, error: accountErrors.accountName, dirty: accountNameInteracted, blurred: accountNameBlurred && !accountNameFocused, isEmptyAccount })}`.trim()}
                      disabled={readOnly}
                      autoComplete="new-password"
                    />
                    <InputField
                      id={`supplier-bank-account-number-${index}`}
                      name="accountNumber"
                      label="Account Number *"
                      value={account.accountNumber}
                      placeholder="Enter account number"
                      onFocus={(event) => handleBankFieldFocus(index, event)}
                      onChange={(event) => handleBankFieldChange(index, event)}
                      onBlur={(event) => handleBankFieldBlur(index, event)}
                      onPaste={(event) => handleAccountNumberPaste(index, event)}
                      error={getAccountNumberErrorMessage(getVisibleError({ value: account.accountNumber, error: accountErrors.accountNumber, dirty: accountNumberInteracted, blurred: accountNumberBlurred, focused: accountNumberFocused, submitted: showErrors, revealWhileTyping: false }))}
                      className={`supplier-bank-field supplier-bank-field--account-number ${account.accountNumber ? 'field--secured' : ''} ${account.accountNumber && !isAccountRevealed ? 'field--masked-account' : ''} ${getSuccessClass({ value: account.accountNumber, error: accountErrors.accountNumber, dirty: accountNumberInteracted, blurred: accountNumberBlurred && !accountNumberFocused, isEmptyAccount })}`.trim()}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={18}
                      autoComplete="new-password"
                      disabled={readOnly}
                      trailingAction={
                        account.accountNumber ? (
                          <button
                            type="button"
                            className="supplier-bank-field__security-toggle"
                            onClick={() => toggleAccountVisibility(index)}
                            aria-label={`${isAccountRevealed ? 'Hide' : 'Show'} account number ${index + 1}`}
                            disabled={readOnly}
                          >
                            {isAccountRevealed ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        ) : null
                      }
                    />
                    <InputField
                      id={`supplier-bank-ifsc-${index}`}
                      name="ifscCode"
                      label="IFSC Code"
                      value={account.ifscCode}
                      placeholder="Enter IFSC code"
                      onFocus={(event) => handleBankFieldFocus(index, event)}
                      onChange={(event) => handleBankFieldChange(index, event)}
                      onBlur={(event) => handleBankFieldBlur(index, event)}
                      error={getVisibleError({ value: account.ifscCode, error: accountErrors.ifscCode, dirty: ifscInteracted, blurred: ifscBlurred, focused: ifscFocused, submitted: showErrors, revealWhileTyping: false })}
                      helperText={ifscHelperText}
                      className={`supplier-bank-field supplier-bank-field--ifsc ${
                        isIfscChecking
                          ? 'field--checking'
                          : isIfscWarningVisible
                          ? 'field--warning'
                          : isIfscMatchedVisible
                            ? 'field--verified'
                            : ''
                      }`.trim()}
                      maxLength={11}
                      autoComplete="new-password"
                      disabled={readOnly}
                      trailingAction={isIfscChecking ? <LoaderCircle size={14} className="supplier-bank-field__loader" /> : null}
                    />
                    <InputField
                      id={`supplier-bank-name-${index}`}
                      name="bankName"
                      label="Bank Name *"
                      value={account.bankName}
                      placeholder="Bank name"
                      onFocus={(event) => handleBankFieldFocus(index, event)}
                      onChange={(event) => handleBankFieldChange(index, event)}
                      onBlur={(event) => handleBankFieldBlur(index, event)}
                      error={isIfscChecking ? '' : getVisibleError({ value: account.bankName, error: accountErrors.bankName, dirty: bankNameInteracted, blurred: bankNameBlurred, focused: bankNameFocused, submitted: showErrors, revealWhileTyping: false })}
                      helperText=""
                      className={`supplier-bank-field supplier-bank-field--autofill supplier-bank-field--secondary ${getAutomationClass(account.bankNameAutoFilled && !account.bankNameManualOverride, getSuccessClass({ value: account.bankName, error: accountErrors.bankName, dirty: bankNameInteracted || account.bankNameAutoFilled, blurred: (bankNameBlurred || account.bankNameAutoFilled) && !bankNameFocused, isEmptyAccount }))}`.trim()}
                      disabled={readOnly}
                    />
                    <InputField
                      id={`supplier-bank-branch-${index}`}
                      name="branch"
                      label="Branch"
                      value={account.branch}
                      placeholder="Branch"
                      onFocus={(event) => handleBankFieldFocus(index, event)}
                      onChange={(event) => handleBankFieldChange(index, event)}
                      onBlur={(event) => handleBankFieldBlur(index, event)}
                      error={getVisibleError({ value: account.branch, error: accountErrors.branch, dirty: branchInteracted, blurred: branchBlurred, focused: branchFocused, submitted: showErrors, revealWhileTyping: false })}
                      helperText=""
                      className={`supplier-bank-field supplier-bank-field--autofill supplier-bank-field--secondary ${getAutomationClass(account.branchAutoFilled && !account.branchManualOverride, getSuccessClass({ value: account.branch, error: accountErrors.branch, dirty: branchInteracted || account.branchAutoFilled, blurred: (branchBlurred || account.branchAutoFilled) && !branchFocused, isEmptyAccount }))}`.trim()}
                      maxLength={100}
                      disabled={readOnly}
                    />
                    <InputField
                      id={`supplier-bank-city-${index}`}
                      name="bankCity"
                      label="City"
                      value={account.bankCity}
                      placeholder="City"
                      onFocus={(event) => handleBankFieldFocus(index, event)}
                      onChange={(event) => handleBankFieldChange(index, event)}
                      onBlur={(event) => handleBankFieldBlur(index, event)}
                      helperText=""
                      className={`supplier-bank-field supplier-bank-field--autofill supplier-bank-field--secondary ${account.bankCityAutoFilled && !account.bankCityManualOverride ? 'field--automation' : ''}`.trim()}
                      disabled={readOnly}
                    />
                    <InputField
                      id={`supplier-bank-state-${index}`}
                      name="bankState"
                      label="State"
                      value={account.bankState}
                      placeholder="State"
                      onFocus={(event) => handleBankFieldFocus(index, event)}
                      onChange={(event) => handleBankFieldChange(index, event)}
                      onBlur={(event) => handleBankFieldBlur(index, event)}
                      helperText=""
                      className={`supplier-bank-field supplier-bank-field--autofill supplier-bank-field--secondary ${account.bankStateAutoFilled && !account.bankStateManualOverride ? 'field--automation' : ''}`.trim()}
                      disabled={readOnly}
                    />
                    <InputField
                      id={`supplier-bank-upi-${index}`}
                      name="upiId"
                      label="UPI ID"
                      value={account.upiId}
                      placeholder="Optional UPI ID"
                      onFocus={(event) => handleBankFieldFocus(index, event)}
                      onChange={(event) => handleBankFieldChange(index, event)}
                      onBlur={(event) => handleBankFieldBlur(index, event)}
                      error={getVisibleError({ value: account.upiId, error: accountErrors.upiId, dirty: upiInteracted, blurred: upiBlurred, focused: upiFocused, submitted: showErrors, revealWhileTyping: false })}
                      className={`supplier-bank-field supplier-bank-field--upi supplier-bank-field--secondary ${getSuccessClass({ value: account.upiId, error: accountErrors.upiId, dirty: upiInteracted, blurred: upiBlurred && !upiFocused, isEmptyAccount })}`.trim()}
                      disabled={readOnly}
                    />
                  </div>
                </div>
              </div>
            )
        })}
      </div>
      {removeIndex !== null ? (
        <div className="supplier-bank-confirm-backdrop" role="presentation">
          <div className="supplier-bank-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="supplier-bank-remove-title">
            <strong id="supplier-bank-remove-title">Remove bank account?</strong>
            <p>Are you sure you want to remove this bank account?</p>
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
