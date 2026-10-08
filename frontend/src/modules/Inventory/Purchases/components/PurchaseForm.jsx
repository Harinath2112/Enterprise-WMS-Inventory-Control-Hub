import { Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import CurrencyInput from '../../../../components/CurrencyInput'
import DatePicker from '../../../../components/DatePicker'
import QuantityInput from '../../../../components/QuantityInput'
import SearchableSelect from '../../../../components/SearchableSelect'
import { getProductById } from '../../../../api/productApi'
import { createId, formatCurrency, getNumberError, getRequiredError, getToday } from '../../../../utils/helpers'
import { renderFormLabel } from '../../../../utils/labelUtils'
import '../../PurchaseIndents/PurchaseIndents.css'

function createLineItem() {
  return {
    id: createId('POL'),
    productId: '',
    quantity: '',
    price: '',
  }
}

const initialForm = {
  supplierId: '',
  orderDate: getToday(),
  expectedDate: '',
  notes: '',
  lineItems: [createLineItem()],
}

function getProductId(product) {
  return product?.id ?? product?.productId ?? product?.ProductId
}

function getProductStock(product) {
  return Number(product?.stock ?? product?.Stock ?? product?.availableStock ?? product?.currentStock ?? product?.availableQty ?? 0)
}

function getProductPurchasePrice(product) {
  const candidates = [
    product?.costPrice ??
    product?.CostPrice,
    product?.purchasePrice ??
    product?.PurchasePrice,
    product?.buyingPrice ??
    product?.BuyingPrice,
    product?.purchaseRate ??
    product?.PurchaseRate,
    product?.unitPrice ??
    product?.UnitPrice,
    product?.cost ??
    product?.Cost,
    product?.price ??
    product?.Price,
    product?.sellingPrice ??
    product?.SellingPrice,
    product?.salePrice ??
    product?.SalePrice,
    product?.mrp ??
    product?.MRP,
  ]

  for (const candidate of candidates) {
    const price = Number(String(candidate ?? '').replace(/,/g, ''))
    if (Number.isFinite(price) && price > 0) {
      return price
    }
  }

  return 0
}

function getDuplicateProductErrors(lineItems) {
  const seen = new Map()

  lineItems.forEach((lineItem) => {
    if (!lineItem.productId) {
      return
    }

    seen.set(lineItem.productId, (seen.get(lineItem.productId) ?? 0) + 1)
  })

  return lineItems.map((lineItem) =>
    lineItem.productId && seen.get(lineItem.productId) > 1
      ? 'This product is already on the order.'
      : '',
  )
}

export default function PurchaseForm({
  suppliers,
  products,
  onSubmit,
  onCancel,
  isSubmitting = false,
  initialData = null,
}) {
  const [formData, setFormData] = useState(initialData || initialForm)
  const [touched, setTouched] = useState({})

  useEffect(() => {
    if (initialData) {
      setFormData(initialData)
    }
  }, [initialData])

  useEffect(() => {
    if (!Array.isArray(products) || products.length === 0) {
      return
    }

    setFormData((currentValue) => {
      let changed = false
      const lineItems = currentValue.lineItems.map((lineItem) => {
        if (!lineItem.productId || Number(lineItem.price) > 0) {
          return lineItem
        }

        const selectedProduct = products.find(
          (product) => String(getProductId(product)) === String(lineItem.productId),
        )
        const purchasePrice = getProductPurchasePrice(selectedProduct)

        if (!(purchasePrice > 0)) {
          return lineItem
        }

        changed = true
        return {
          ...lineItem,
          price: String(purchasePrice),
        }
      })

      return changed ? { ...currentValue, lineItems } : currentValue
    })
  }, [products, formData.lineItems])

  const duplicateErrors = getDuplicateProductErrors(formData.lineItems)
  const errors = {
    supplierId: getRequiredError(formData.supplierId, 'Supplier'),
    orderDate: getRequiredError(formData.orderDate, 'Order date'),
    expectedDate:
      formData.expectedDate && formData.expectedDate < formData.orderDate
        ? 'Expected date cannot be before the order date.'
        : '',
    lineItems: formData.lineItems.map((lineItem, index) => ({
      productId: getRequiredError(lineItem.productId, 'Product') || duplicateErrors[index],
      quantity: getNumberError(lineItem.quantity, 'Quantity', { allowZero: false }),
      price: getNumberError(lineItem.price, 'Unit price', { allowZero: false }),
    })),
  }

  const isFormValid =
    !errors.supplierId &&
    !errors.orderDate &&
    !errors.expectedDate &&
    errors.lineItems.every((lineItem) =>
      !lineItem.productId && !lineItem.quantity && !lineItem.price,
    )

  const summary = useMemo(() => {
    const total = formData.lineItems.reduce(
      (sum, lineItem) => sum + Number(lineItem.quantity || 0) * Number(lineItem.price || 0),
      0,
    )

    return {
      total,
      lines: formData.lineItems.length,
    }
  }, [formData.lineItems])

  function handleChange(event) {
    const { name, value } = event.target
    setFormData((currentValue) => ({
      ...currentValue,
      [name]: value,
    }))
  }

  function handleBlur(event) {
    setTouched((currentValue) => ({
      ...currentValue,
      [event.target.name]: true,
    }))
  }

  function handleLineChange(lineId, fieldName, nextValue) {
    setFormData((currentValue) => ({
      ...currentValue,
      lineItems: currentValue.lineItems.map((lineItem) => {
        if (lineItem.id !== lineId) {
          return lineItem
        }
        const updated = { ...lineItem, [fieldName]: nextValue }
        if (fieldName === 'productId' && nextValue) {
          const selectedProduct = products?.find((p) => String(getProductId(p)) === String(nextValue))
          if (selectedProduct) {
            const purchasePrice = getProductPurchasePrice(selectedProduct)
            updated.price = purchasePrice > 0 ? String(purchasePrice) : ''
            updated.quantity = '1'
          }
        }
        return updated
      }),
    }))
  }

  async function handleProductChange(lineId, productId) {
    const selectedProduct = products?.find(
      (product) => String(getProductId(product)) === String(productId),
    )
    const listedPurchasePrice = getProductPurchasePrice(selectedProduct)

    setFormData((currentValue) => ({
      ...currentValue,
      lineItems: currentValue.lineItems.map((lineItem) =>
        lineItem.id === lineId
          ? {
              ...lineItem,
              productId,
              quantity: productId ? '1' : '',
              price: productId && listedPurchasePrice > 0
                ? String(listedPurchasePrice)
                : '',
            }
          : lineItem
      ),
    }))

    if (!productId) {
      return
    }

    const response = await getProductById(productId, { cache: 'no-store' })
    const purchasePrice = response.success
      ? getProductPurchasePrice(response.data)
      : listedPurchasePrice

    setFormData((currentValue) => ({
      ...currentValue,
      lineItems: currentValue.lineItems.map((lineItem) =>
        lineItem.id === lineId && String(lineItem.productId) === String(productId)
          ? {
              ...lineItem,
              price: purchasePrice > 0 ? String(purchasePrice) : '',
            }
          : lineItem
      ),
    }))
  }

  function handleLineBlur(lineId, fieldName) {
    setTouched((currentValue) => ({
      ...currentValue,
      [`${lineId}-${fieldName}`]: true,
    }))
  }

  function addLineItem() {
    setFormData((currentValue) => ({
      ...currentValue,
      lineItems: [...currentValue.lineItems, createLineItem()],
    }))
  }

  function removeLineItem(lineId) {
    setFormData((currentValue) => {
      if (currentValue.lineItems.length === 1) {
        return {
          ...currentValue,
          lineItems: [createLineItem()],
        }
      }
      return {
        ...currentValue,
        lineItems: currentValue.lineItems.filter((lineItem) => lineItem.id !== lineId),
      }
    })
  }

  function markAllTouched() {
    setTouched({
      supplierId: true,
      orderDate: true,
      expectedDate: true,
      ...formData.lineItems.reduce((result, lineItem) => ({
        ...result,
        [`${lineItem.id}-productId`]: true,
        [`${lineItem.id}-quantity`]: true,
        [`${lineItem.id}-price`]: true,
      }), {}),
    })
  }

  function handleSubmit(event) {
    event.preventDefault()
    markAllTouched()

    if (!isFormValid || isSubmitting) {
      return
    }

    onSubmit({
      ...formData,
      lineItems: formData.lineItems.map((lineItem) => ({
        productId: lineItem.productId,
        quantity: Number(lineItem.quantity),
        price: Number(lineItem.price),
      })),
    })
  }

  return (
    <form className="indent-create-wrapper" onSubmit={handleSubmit} autoComplete="off">
      {/* Header */}
      <div className="indent-create-header">
        <div className="indent-create-header__title">
          <h1>Create Purchase Order</h1>
        </div>
      </div>

      {/* Section 1: Purchase Order Details */}
      <div className="indent-card">
        <h3 className="indent-card__title">Purchase Order Details</h3>
        <div className="indent-details-grid">
          {/* Supplier */}
          <div className={`indent-field-group ${touched.supplierId && errors.supplierId ? 'indent-field-group--error' : ''}`}>
            <label htmlFor="po-supplier">Supplier <span className="required">*</span></label>
            <SearchableSelect
              id="po-supplier"
              name="supplierId"
              value={formData.supplierId}
              onChange={handleChange}
              onBlur={handleBlur}
              options={suppliers}
              placeholder="Select supplier"
              hideLabel={true}
              className="indent-details-searchable-select"
            />
            {touched.supplierId && errors.supplierId && (
              <span className="indent-field-error">{errors.supplierId}</span>
            )}
          </div>

          {/* Order Date */}
          <div className={`indent-field-group ${touched.orderDate && errors.orderDate ? 'indent-field-group--error' : ''}`}>
            <label htmlFor="po-order-date">Order date <span className="required">*</span></label>
            <DatePicker
              id="po-order-date"
              name="orderDate"
              value={formData.orderDate}
              onChange={handleChange}
              onBlur={handleBlur}
              error={touched.orderDate ? errors.orderDate : ''}
              className="indent-details-date-picker"
            />
          </div>

          {/* Expected Date */}
          <div className={`indent-field-group ${touched.expectedDate && errors.expectedDate ? 'indent-field-group--error' : ''}`}>
            <label htmlFor="po-expected-date">{renderFormLabel('Expected Date *')}</label>
            <DatePicker
              id="po-expected-date"
              name="expectedDate"
              value={formData.expectedDate}
              onChange={handleChange}
              onBlur={handleBlur}
              error={touched.expectedDate ? errors.expectedDate : ''}
              className="indent-details-date-picker"
            />
          </div>

          {/* Notes */}
          <div className="indent-field-group" style={{ gridColumn: '1 / -1' }}>
            <label htmlFor="po-notes">Notes</label>
            <textarea
              id="po-notes"
              name="notes"
              className="indent-remarks-textarea"
              placeholder="Vendor terms, delivery instructions, or receiving notes"
              value={formData.notes}
              onChange={handleChange}
              onBlur={handleBlur}
              rows={3}
            />
          </div>
        </div>
      </div>

      {/* Section 2: Product Line Items */}
      <div className="indent-card">
        <h3 className="indent-card__title">Product Line Items</h3>
        
        <div className="indent-items-table-wrapper">
          <table className="indent-items-table" style={{ tableLayout: 'fixed' }}>
            <thead>
              <tr>
                <th style={{ width: '55px', textAlign: 'center' }}>S.No</th>
                <th style={{ width: '35%' }}>Product *</th>
                <th style={{ width: '15%', textAlign: 'center' }}>Available Stock</th>
                <th style={{ width: '15%', textAlign: 'center' }}>Quantity *</th>
                <th style={{ width: '15%', textAlign: 'right' }}>Unit price *</th>
                <th style={{ width: '15%', textAlign: 'right' }}>Line total</th>
                <th style={{ width: '70px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {formData.lineItems.map((lineItem, index) => {
                const matchedProduct = products?.find(p => String(getProductId(p)) === String(lineItem.productId))
                return (
                  <tr key={lineItem.id}>
                    {/* S.No */}
                    <td className="indent-sno-col">{index + 1}</td>
                    
                    {/* Product */}
                    <td>
                      <SearchableSelect
                        id={`po-product-${lineItem.id}`}
                        name={`product-${lineItem.id}`}
                        value={lineItem.productId}
                        onChange={(event) =>
                          handleProductChange(lineItem.id, event.target.value)
                        }
                        onBlur={() => handleLineBlur(lineItem.id, 'productId')}
                        options={products}
                        placeholder="Select product"
                        error={errors.lineItems[index].productId}
                        showError={touched[`${lineItem.id}-productId`]}
                        hideLabel={true}
                        className="indent-table-searchable-select"
                      />
                    </td>
                    
                    {/* Available Stock */}
                    <td>
                      <input
                        type="text"
                        className="indent-table-input"
                        value={matchedProduct ? String(getProductStock(matchedProduct)) : '0'}
                        readOnly
                        disabled
                        style={{ textAlign: 'center' }}
                      />
                    </td>
                    
                    {/* Quantity */}
                    <td>
                      <QuantityInput
                        id={`po-quantity-${lineItem.id}`}
                        name={`quantity-${lineItem.id}`}
                        value={lineItem.quantity}
                        onChange={(event) =>
                          handleLineChange(lineItem.id, 'quantity', event.target.value)
                        }
                        onBlur={() => handleLineBlur(lineItem.id, 'quantity')}
                        error={touched[`${lineItem.id}-quantity`] ? errors.lineItems[index].quantity : ''}
                        className="indent-table-field"
                      />
                    </td>

                    {/* Unit Price */}
                    <td>
                      <CurrencyInput
                        id={`po-price-${lineItem.id}`}
                        name={`price-${lineItem.id}`}
                        value={lineItem.price}
                        onBlur={() => handleLineBlur(lineItem.id, 'price')}
                        error={touched[`${lineItem.id}-price`] ? errors.lineItems[index].price : ''}
                        className="indent-table-field"
                        style={{ textAlign: 'right' }}
                        readOnly
                        aria-readonly="true"
                      />
                    </td>

                    {/* Line Total */}
                    <td>
                      <input
                        type="text"
                        className="indent-table-input"
                        value={formatCurrency(Number(lineItem.quantity || 0) * Number(lineItem.price || 0))}
                        readOnly
                        disabled
                        style={{ textAlign: 'right', fontWeight: '600' }}
                      />
                    </td>
                    
                    {/* Actions */}
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        className="indent-row-delete-btn"
                        onClick={() => removeLineItem(lineItem.id)}
                        aria-label={`Remove line ${index + 1}`}
                        title="Remove line"
                        disabled={isSubmitting}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Add Line button below the table */}
        <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-start' }}>
          <button
            type="button"
            className="indent-btn indent-btn--draft"
            onClick={addLineItem}
            disabled={isSubmitting}
            style={{ height: '36px', padding: '0 14px' }}
          >
            <Plus size={16} /> Add Line
          </button>
        </div>

        {/* Order Summary */}
        <div className="indent-summary-row" style={{ marginTop: '16px' }}>
          <div className="indent-summary-item">
            Lines: <strong>{summary.lines}</strong>
          </div>
          <div className="indent-summary-item">
            Total amount: <strong>{formatCurrency(summary.total)}</strong>
          </div>
        </div>
      </div>

      {/* Actions Section */}
      <div className="indent-create-actions" style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
        <button className="button button-cancel indent-btn indent-btn--cancel"
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="indent-btn indent-btn--submit"
          disabled={!isFormValid || isSubmitting}
        >
          {isSubmitting ? 'Saving...' : 'Create Purchase Order'}
        </button>
      </div>
    </form>
  )
}
