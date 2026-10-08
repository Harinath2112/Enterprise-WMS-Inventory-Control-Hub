import { Boxes, CalendarDays, DollarSign, Save, Warehouse, X } from 'lucide-react'
import CurrencyInput from '../../../components/CurrencyInput'
import QuantityInput from '../../../components/QuantityInput'
import SearchableSelect from '../../../components/SearchableSelect'
import SelectWithAdd from '../../../components/SelectWithAdd'

export default function AccountingForm({
  formData,
  errors,
  touched,
  isFormValid,
  onChange,
  onBlur,
  onSubmit,
  onCancel,
  onQuickAddParty,
  onQuickAddProduct,
  onQuickAddWarehouse,
  products,
  warehouses,
  partyLabel,
  partyOptions,
  partyIcon,
  partyAddTitle,
}) {
  return (
    <div className="card">
      <h2 className="section-title">Invoice Form</h2>
      <form className="form-grid" onSubmit={onSubmit} autoComplete="off">
        <SearchableSelect
          id="invoice-type"
          name="invoiceType"
          label="Invoice Type"
          icon={Save}
          value={formData.invoiceType}
          onChange={onChange}
          options={[
            { value: 'Sales', label: 'Sales Invoice' },
            { value: 'Purchases', label: 'Purchase Invoice' },
          ]}
          placeholder="Select invoice type"
        />

        <SelectWithAdd
          id="invoice-party"
          name="partyId"
          label={partyLabel}
          icon={partyIcon}
          value={formData.partyId}
          onChange={onChange}
          onBlur={onBlur}
          options={partyOptions}
          placeholder={`Select ${partyLabel.toLowerCase()}`}
          error={errors.partyId}
          showError={touched.partyId}
          onAddOption={onQuickAddParty}
          addLabel="+ Add"
          addTitle={partyAddTitle}
          addFields={[
            { name: 'name', label: `${partyLabel} Name`, placeholder: `Enter ${partyLabel.toLowerCase()} name` },
          ]}
        />

        <SelectWithAdd
          id="invoice-product"
          name="productId"
          label="Product"
          icon={Boxes}
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
            { name: 'name', label: 'Product Name', placeholder: 'Enter product name' },
            { name: 'sku', label: 'SKU', placeholder: 'Enter SKU', required: false },
          ]}
        />

        <SelectWithAdd
          id="invoice-warehouse"
          name="warehouseId"
          label="Warehouse"
          icon={Warehouse}
          value={formData.warehouseId}
          onChange={onChange}
          onBlur={onBlur}
          options={warehouses}
          placeholder="Select warehouse"
          error={errors.warehouseId}
          showError={touched.warehouseId}
          onAddOption={onQuickAddWarehouse}
          addLabel="+ Add"
          addTitle="Add Warehouse"
          addFields={[
            { name: 'name', label: 'Warehouse Name', placeholder: 'Enter warehouse name' },
          ]}
        />

        <QuantityInput
          id="invoice-quantity"
          name="quantity"
          label="Quantity"
          icon={Boxes}
          value={formData.quantity}
          onChange={onChange}
          onBlur={onBlur}
          error={touched.quantity ? errors.quantity : ''}
        />

        <CurrencyInput
          id="invoice-amount"
          name="amount"
          label="Amount"
          icon={DollarSign}
          value={formData.amount}
          onChange={onChange}
          onBlur={onBlur}
          error={touched.amount ? errors.amount : ''}
        />

        <div className="field">
          <label htmlFor="invoice-date">Date</label>
          <div className="input-with-icon">
            <CalendarDays size={16} />
            <input
              id="invoice-date"
              name="date"
              type="date"
              value={formData.date}
              onChange={onChange}
              onBlur={onBlur}
            />
          </div>
          {touched.date && errors.date ? <span className="field-error">{errors.date}</span> : null}
        </div>

        <div className="button-row field--full">
          <button type="submit" className="button button-primary" disabled={!isFormValid}>
            <Save size={16} />
            Save Invoice
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
