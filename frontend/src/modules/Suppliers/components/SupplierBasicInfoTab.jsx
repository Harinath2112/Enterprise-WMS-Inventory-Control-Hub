import { Building2, Globe, Hash, Mail, Phone, ShieldCheck, Tag, Truck } from 'lucide-react'
import ReactSelect from 'react-select'
import InputField from '../../../components/InputField'
import SearchableSelect from '../../../components/SearchableSelect'
import { emailInputProps } from '../../../validators/emailValidator'
import { phoneInputProps } from '../../../validators/phoneValidator'
import { SupplierSection } from './SupplierFormSections'

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'pending', label: 'Pending' },
]

const STATUS_SELECT_Z_INDEX = 2147483647
const STATUS_SELECT_MAX_MENU_HEIGHT = 260

const statusSelectStyles = {
  control: (base, state) => ({
    ...base,
    minHeight: 36,
    borderColor: state.selectProps['aria-invalid'] ? '#ead7da' : state.isFocused ? '#866ee7' : '#e4e2ff',
    borderRadius: 7,
    backgroundColor: '#fbfaff',
    boxShadow: state.isFocused
      ? '0 0 0 3px rgba(37, 99, 235, 0.085), inset 0 1px 0 rgba(15, 23, 42, 0.015)'
      : 'inset 0 1px 0 rgba(15, 23, 42, 0.015)',
    cursor: 'pointer',
    fontSize: 12.5,
    fontWeight: 520,
    lineHeight: 1.25,
    minWidth: 0,
    '&:hover': {
      borderColor: state.isFocused ? '#866ee7' : '#c7bbf7',
      backgroundColor: '#ffffff',
    },
  }),
  valueContainer: (base) => ({
    ...base,
    minHeight: 34,
    padding: '0 8px',
  }),
  input: (base) => ({
    ...base,
    margin: 0,
    padding: 0,
    color: '#1f2937',
  }),
  placeholder: (base) => ({
    ...base,
    color: '#6b7f6e',
    fontWeight: 450,
  }),
  singleValue: (base) => ({
    ...base,
    color: '#1f2937',
    fontWeight: 520,
  }),
  indicatorsContainer: (base) => ({
    ...base,
    minHeight: 34,
  }),
  dropdownIndicator: (base, state) => ({
    ...base,
    padding: '0 8px',
    color: state.isFocused ? '#6c5ce7' : '#6b7f6e',
    transition: 'transform 140ms ease, color 140ms ease',
    transform: state.selectProps.menuIsOpen ? 'rotate(180deg)' : 'rotate(0deg)',
    '&:hover': {
      color: '#6c5ce7',
    },
  }),
  indicatorSeparator: () => ({
    display: 'none',
  }),
  menuPortal: (base) => ({
    ...base,
    position: 'fixed',
    width: base.width,
    zIndex: STATUS_SELECT_Z_INDEX,
  }),
  menu: (base) => ({
    ...base,
    width: '100%',
    zIndex: STATUS_SELECT_Z_INDEX,
    border: '1px solid #e4e2ff',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 6,
    marginTop: 6,
    boxShadow: '0 10px 30px rgba(15, 23, 42, 0.12)',
    animation: 'supplier-react-select-menu-in 150ms cubic-bezier(0.2, 0, 0, 1)',
  }),
  menuList: (base) => ({
    ...base,
    maxHeight: STATUS_SELECT_MAX_MENU_HEIGHT,
    overflowY: 'auto',
    padding: 6,
    scrollBehavior: 'smooth',
    overscrollBehavior: 'contain',
  }),
  option: (base, state) => ({
    ...base,
    minHeight: 32,
    borderRadius: 8,
    padding: '7px 9px',
    backgroundColor: state.isSelected
      ? 'rgba(119, 93, 222, 0.12)'
      : state.isFocused
        ? 'rgba(119, 93, 222, 0.08)'
        : '#ffffff',
    color: state.isSelected || state.isFocused ? '#6c5ce7' : '#24344b',
    cursor: 'pointer',
    fontSize: 12.5,
    fontWeight: state.isSelected ? 650 : 560,
    transition: 'background-color 120ms ease, color 120ms ease',
    '&:active': {
      backgroundColor: 'rgba(119, 93, 222, 0.14)',
    },
  }),
}

function getFieldDisplayError(name, value, error, touched) {
  if (!error) return ''
  if (touched?.[name] || touched?.collections) return error
  if (value && String(value).trim()) return error
  return ''
}

export default function SupplierBasicInfoTab({
  formData,
  errors,
  touched = {},
  onChange,
  onBlur,
  readOnly,
  categoryOptions = [],
}) {
  const selectedStatus = STATUS_OPTIONS.find((option) => option.value === formData.status) ?? null
  const statusPortalTarget = typeof document !== 'undefined' ? document.body : undefined

  return (
    <SupplierSection
      title="Basic Information"
      className="supplier-basic-section"
    >
      <div className="form-grid supplier-form__grid">
        <InputField
          id="supplier-name"
          name="name"
          label="Supplier Name *"
          value={formData.name}
          onChange={onChange}
          onBlur={onBlur}
          error={getFieldDisplayError('name', formData.name, errors.name, touched)}
          placeholder="Enter registered supplier name"
          helperText="Spaces, initials, periods, apostrophes, and hyphens are preserved."
          className={formData.name && !errors.name ? 'field--success' : ''}
          maxLength={120}
          disabled={readOnly}
        />
        <InputField
          id="supplier-code"
          name="supplierCode"
          label="Supplier Code *"
          value={formData.supplierCode}
          onChange={onChange}
          onBlur={onBlur}
          placeholder="Enter supplier code"
          error={getFieldDisplayError('supplierCode', formData.supplierCode, errors.supplierCode, touched)}
          helperText="Unique internal vendor code (max 20 characters)."
          className={formData.supplierCode && !errors.supplierCode ? 'field--success' : ''}
          maxLength={20}
          disabled={readOnly}
        />
        <InputField
          id="supplier-company"
          name="companyName"
          label="Company Name"
          value={formData.companyName}
          onChange={onChange}
          onBlur={onBlur}
          placeholder="Legal entity name"
          error={getFieldDisplayError('companyName', formData.companyName, errors.companyName, touched)}
          helperText="Business suffixes, periods, hyphens, and ampersands are supported."
          className={formData.companyName && !errors.companyName ? 'field--success' : ''}
          maxLength={150}
          disabled={readOnly}
        />
        <SearchableSelect
          id="supplier-category"
          name="category"
          label="Category *"
          value={formData.category}
          onChange={onChange}
          onBlur={onBlur}
          options={categoryOptions}
          placeholder={categoryOptions.length ? 'Select category' : 'No categories available'}
          error={errors.category}
          showError={touched.category || Boolean(formData.category)}
          className={formData.category && !errors.category ? 'field--success' : ''}
          disabled={readOnly || categoryOptions.length === 0}
        />
        <InputField
          id="supplier-gst"
          name="gstNumber"
          label="GST Number"
          value={formData.gstNumber}
          onChange={onChange}
          onBlur={onBlur}
          placeholder="Enter GSTIN"
          error={getFieldDisplayError('gstNumber', formData.gstNumber, errors.gstNumber, touched)}
          helperText="Example: 22AAAAA0000A1Z5"
          className={formData.gstNumber && !errors.gstNumber ? 'field--success' : ''}
          maxLength={15}
          autoCapitalize="characters"
          disabled={readOnly}
        />
        <InputField
          id="supplier-pan"
          name="panNumber"
          label="PAN Number"
          value={formData.panNumber}
          onChange={onChange}
          onBlur={onBlur}
          placeholder="Enter PAN"
          error={getFieldDisplayError('panNumber', formData.panNumber, errors.panNumber, touched)}
          helperText="Example: ABCDE1234F."
          className={formData.panNumber && !errors.panNumber ? 'field--success' : ''}
          maxLength={10}
          autoCapitalize="characters"
          disabled={readOnly}
        />
        <InputField
          id="supplier-phone"
          name="phone"
          label="Phone *"
          {...phoneInputProps}
          value={formData.phone}
          onChange={onChange}
          onBlur={onBlur}
          error={getFieldDisplayError('phone', formData.phone, errors.phone, touched)}
          placeholder="9876543210"
          helperText="10 digits only."
          className={formData.phone && !errors.phone ? 'field--success' : ''}
          disabled={readOnly}
        />
        <InputField
          id="supplier-email"
          name="email"
          label="Email *"
          {...emailInputProps}
          value={formData.email}
          onChange={onChange}
          onBlur={onBlur}
          error={getFieldDisplayError('email', formData.email, errors.email, touched)}
          placeholder="Enter supplier email"
          helperText="Email is normalized to lowercase."
          className={formData.email && !errors.email ? 'field--success' : ''}
          disabled={readOnly}
        />
        <InputField
          id="supplier-website"
          name="website"
          label="Website"
          value={formData.website}
          onChange={onChange}
          onBlur={onBlur}
          placeholder="Enter website URL"
          error={getFieldDisplayError('website', formData.website, errors.website, touched)}
          helperText="Domain-only entries are normalized to https://."
          className={formData.website && !errors.website ? 'field--success' : ''}
          maxLength={150}
          disabled={readOnly}
        />
        <div className={`field supplier-basic-status-select ${getFieldDisplayError('status', formData.status, errors.status, touched) ? 'field--error' : ''} ${formData.status && !errors.status ? 'field--success' : ''}`.trim()}>
          <label htmlFor="supplier-status">Status *</label>
          <ReactSelect
            inputId="supplier-status"
            instanceId="supplier-status"
            name="status"
            options={STATUS_OPTIONS}
            value={selectedStatus}
            onChange={(option) => onChange({ target: { name: 'status', value: option?.value ?? '' } })}
            onBlur={() => onBlur?.({ target: { name: 'status', value: formData.status } })}
            placeholder="Select status"
            isSearchable={false}
            isDisabled={readOnly}
            menuPortalTarget={statusPortalTarget}
            menuPosition="fixed"
            menuPlacement="bottom"
            maxMenuHeight={STATUS_SELECT_MAX_MENU_HEIGHT}
            menuShouldScrollIntoView={false}
            styles={statusSelectStyles}
            classNamePrefix="supplier-react-select"
            aria-invalid={Boolean(getFieldDisplayError('status', formData.status, errors.status, touched))}
          />
          {getFieldDisplayError('status', formData.status, errors.status, touched) ? (
            <span className="field-error">{errors.status}</span>
          ) : null}
        </div>
      </div>
    </SupplierSection>
  )
}
