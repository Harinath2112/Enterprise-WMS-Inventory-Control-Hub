import {
  CalendarDays,
  Package,
  Save,
  ScanLine,
  X,
} from 'lucide-react'
import SelectWithAdd from '../../../../components/SelectWithAdd'
import SearchableSelect from '../../../../components/SearchableSelect'
import CodePreview from './CodePreview'

export default function BarcodeForm({
  formData,
  touched,
  errors,
  products,
  livePreviewValue,
  onChange,
  onBlur,
  onSubmit,
  onCancel,
  onQuickAddProduct,
  isSaving = false,
}) {
  const isFormValid = Object.values(errors).every((value) => !value)

  return (
    <div className="card">
      <h2 className="section-title">Generate Barcode / QR</h2>
      <form className="form-grid" onSubmit={onSubmit} autoComplete="off">
        <SelectWithAdd
          id="barcode-product"
          name="productId"
          label="Product"
          icon={Package}
          value={formData.productId}
          onChange={onChange}
          onBlur={onBlur}
          options={products}
          placeholder="Select product"
          error={errors.productId}
          showError={touched.productId}
          onAddOption={onQuickAddProduct}
          addLabel="+ Add"
          addTitle="Add Product"
          addFields={[
            {
              name: 'name',
              label: 'Product Name',
              placeholder: 'Enter product name',
            },
            {
              name: 'sku',
              label: 'SKU',
              placeholder: 'Enter SKU',
              required: false,
            },
          ]}
        />

        <SearchableSelect
          id="barcode-type"
          name="codeType"
          label="Code Type"
          icon={ScanLine}
          value={formData.codeType}
          onChange={onChange}
          options={['Barcode', 'QR Code']}
          placeholder="Select code type"
        />

        <div className="field">
          <label htmlFor="barcode-date">Date</label>
          <div className="input-with-icon">
            <CalendarDays size={16} />
            <input
              id="barcode-date"
              name="date"
              type="date"
              value={formData.date}
              onChange={onChange}
              onBlur={onBlur}
            />
          </div>
          {touched.date && errors.date ? (
            <span className="field-error">{errors.date}</span>
          ) : null}
        </div>

        <div className="barcode-page__note">
          <strong>Static preview:</strong>
          <span>
            This page shows built-in visual barcode and QR previews. We can replace
            them with a standards-compliant library later.
          </span>
        </div>

        {livePreviewValue ? (
          <div className="barcode-page__live-preview">
            <h3>Preview</h3>
            <CodePreview codeType={formData.codeType} value={livePreviewValue} />
          </div>
        ) : null}

        <div className="button-row field--full">
          <button
            type="submit"
            className="button button-primary"
            disabled={!isFormValid || isSaving}
          >
            <Save size={16} />
            {isSaving ? 'Generating...' : 'Generate'}
          </button>
          <button type="button" className="button button-cancel" onClick={onCancel}>
            <X size={16} />
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
