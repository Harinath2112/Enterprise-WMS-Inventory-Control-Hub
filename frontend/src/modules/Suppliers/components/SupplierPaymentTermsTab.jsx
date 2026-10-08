import { CreditCard, FileText } from 'lucide-react'
import CurrencyInput from '../../../components/CurrencyInput'
import InputField from '../../../components/InputField'
import SearchableSelect from '../../../components/SearchableSelect'
import { SupplierSection } from './SupplierFormSections'

const PAYMENT_METHODS = ['Bank Transfer', 'UPI', 'Cheque', 'Cash', 'Card'].map((item) => ({ value: item, label: item }))
const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD'].map((item) => ({ value: item, label: item }))
const TAX_TYPES = ['GST Registered', 'Composition', 'Unregistered', 'Import'].map((item) => ({ value: item, label: item }))

export default function SupplierPaymentTermsTab({
  terms,
  errors = {},
  showErrors = false,
  touched = {},
  onChange,
  onBlur,
  readOnly,
}) {
  const isCreditDaysTouched = showErrors || touched.creditDays || touched.paymentTerm_creditDays || touched.paymentTerms
  const isCreditLimitTouched = showErrors || touched.creditLimit || touched.paymentTerm_creditLimit || touched.paymentTerms

  return (
    <SupplierSection
      className="supplier-payment-section"
      title="Payment Terms"
    >
      <div className="supplier-payment-panel">
        <div className="form-grid supplier-form__grid supplier-payment-grid">
          <InputField
            id="supplier-credit-days"
            name="creditDays"
            label="Credit Days"
            type="text"
            value={terms.creditDays}
            onChange={onChange}
            onBlur={onBlur}
            helperText="0 to 365 days."
            error={isCreditDaysTouched ? errors.creditDays : ''}
            inputMode="numeric"
            placeholder="Enter credit days"
            maxLength={3}
            className="supplier-payment-field supplier-payment-field--numeric"
            disabled={readOnly}
          />
          <CurrencyInput
            id="supplier-credit-limit"
            name="creditLimit"
            label="Credit Limit"
            value={terms.creditLimit}
            onChange={onChange}
            onBlur={onBlur}
            error={isCreditLimitTouched ? errors.creditLimit : ''}
            currency={terms.currency || 'INR'}
            placeholder="Enter credit limit"
            maxIntegerDigits={10}
            helperText="Up to 999,999,999.99"
            className="supplier-payment-field supplier-payment-field--numeric"
            disabled={readOnly}
          />
          <SearchableSelect
            id="supplier-preferred-payment-method"
            name="preferredPaymentMethod"
            label="Preferred Payment Method"
            value={terms.preferredPaymentMethod}
            onChange={onChange}
            options={PAYMENT_METHODS}
            placeholder="Select payment method"
            searchPlaceholder="Search payment method"
            error={errors.preferredPaymentMethod}
            showError={showErrors}
            className="supplier-payment-field supplier-payment-select"
            disabled={readOnly}
          />
          <SearchableSelect
            id="supplier-currency"
            name="currency"
            label="Currency"
            value={terms.currency}
            onChange={onChange}
            options={CURRENCIES}
            placeholder="Select currency"
            searchPlaceholder="Search currency"
            error={errors.currency}
            showError={showErrors}
            className="supplier-payment-field supplier-payment-select"
            disabled={readOnly}
          />
          <SearchableSelect
            id="supplier-tax-type"
            name="taxType"
            label="Tax Type"
            value={terms.taxType}
            onChange={onChange}
            options={TAX_TYPES}
            placeholder="Select tax type"
            searchPlaceholder="Search tax type"
            error={errors.taxType}
            showError={showErrors}
            className="supplier-payment-field supplier-payment-select supplier-payment-tax-field"
            disabled={readOnly}
          />
        </div>

        <div className="field--full supplier-notes-field supplier-payment-notes">
          <InputField
            id="supplier-payment-notes"
            name="notes"
            label="Notes"
            textarea
            rows={2}
            value={terms.notes}
            onChange={onChange}
            error={showErrors ? errors.notes : ''}
            placeholder="Add approval instructions, settlement notes, or internal finance comments"
            disabled={readOnly}
            maxLength={1000}
          />
          <span className="supplier-character-count">{String(terms.notes ?? '').length}/1000</span>
        </div>
      </div>
    </SupplierSection>
  )
}
