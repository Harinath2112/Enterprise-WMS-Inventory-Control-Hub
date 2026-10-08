import {
  Boxes,
  FileText,
  Package,
  Save,
  User,
  Warehouse,
  X,
} from 'lucide-react'
import { useState } from 'react'
import CurrencyInput from '../../../../components/CurrencyInput'
import DatePicker from '../../../../components/DatePicker'
import InputField from '../../../../components/InputField'
import QuantityInput from '../../../../components/QuantityInput'
import SearchableSelect from '../../../../components/SearchableSelect'
import SelectWithAdd from '../../../../components/SelectWithAdd'
import {
  getNumberError,
  getRequiredError,
  getToday,
} from '../../../../utils/helpers'

const initialForm = {
  customerId: '',
  productId: '',
  warehouseId: '',
  quantity: '',
  unitPrice: '',
  date: getToday(),
  status: 'Pending',
  notes: '',
}

export default function SaleForm({
  customers,
  products,
  warehouses,
  onSubmit,
  onCancel,
  onQuickAddCustomer,
  onQuickAddProduct,
  onQuickAddWarehouse,
}) {
  const [formData, setFormData] = useState(initialForm)

  const errors = {
    customerId: getRequiredError(formData.customerId, 'Customer'),
    productId: getRequiredError(formData.productId, 'Product'),
    warehouseId: getRequiredError(formData.warehouseId, 'Warehouse'),
    quantity: getNumberError(formData.quantity, 'Quantity'),
    unitPrice: getNumberError(formData.unitPrice, 'Unit price'),
    date: getRequiredError(formData.date, 'Date'),
  }

  const isFormValid = Object.values(errors).every((v) => !v)

  function handleChange(e) {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!isFormValid) return
    onSubmit(formData)
  }

  return (
    <div className="sale-form">
      <form onSubmit={handleSubmit} className="form-grid form-grid--single">
        <SelectWithAdd
          name="customerId"
          label="Customer"
          icon={User}
          value={formData.customerId}
          onChange={handleChange}
          options={customers}
          onAddOption={onQuickAddCustomer}
        />

        <SelectWithAdd
          name="productId"
          label="Product"
          icon={Package}
          value={formData.productId}
          onChange={handleChange}
          options={products}
          onAddOption={onQuickAddProduct}
        />

        <SelectWithAdd
          name="warehouseId"
          label="Warehouse"
          icon={Warehouse}
          value={formData.warehouseId}
          onChange={handleChange}
          options={warehouses}
          onAddOption={onQuickAddWarehouse}
        />

        <QuantityInput
          id="sale-quantity"
          name="quantity"
          label="Quantity"
          icon={Boxes}
          value={formData.quantity}
          onChange={handleChange}
        />

        <CurrencyInput
          id="sale-unit-price"
          name="unitPrice"
          label="Unit Price"
          value={formData.unitPrice}
          onChange={handleChange}
        />

        <DatePicker
          id="sale-date"
          name="date"
          label="Order Date"
          value={formData.date}
          onChange={handleChange}
        />

        <SearchableSelect
          name="status"
          label="Order Status"
          options={['Pending', 'Confirmed', 'Packed', 'Shipped', 'Delivered']}
          value={formData.status}
          onChange={handleChange}
        />

        <div className="field">
          <label htmlFor="sale-notes">Notes</label>
          <div className="input-with-icon input-with-icon--textarea">
            <FileText size={16} />
            <textarea
              id="sale-notes"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className="button-row">
          <button type="submit" className="button button-primary" disabled={!isFormValid}>
            <Save size={16} /> Save
          </button>
          <button type="button" className="button button-cancel" onClick={onCancel}>
            <X size={16} /> Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
