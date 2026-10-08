import { Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import QuantityInput from '../../../../components/QuantityInput'
import SearchableSelect from '../../../../components/SearchableSelect'
import DatePicker from '../../../../components/DatePicker'
import { createId, getNumberError, getRequiredError, getToday } from '../../../../utils/helpers'

function createLineItem() {
  return {
    id: createId('PIL'),
    productId: '',
    quantity: '',
  }
}

function getProductId(product) {
  return product?.productId ?? product?.id
}

function getProductStock(product) {
  return Number(product?.stock ?? product?.Stock ?? product?.availableStock ?? product?.currentStock ?? 0)
}

const initialForm = {
  indentDate: getToday(),
  priority: 'Medium',
  status: 'Pending',
  notes: '',
  lineItems: [createLineItem()],
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
      ? 'This product is already on the requisition.'
      : '',
  )
}

export default function PurchaseIndentForm({
  products,
  nextIndentNumber,
  onSubmit,
  onCancel,
  isSubmitting = false,
  initialValues = null,
}) {
  const [formData, setFormData] = useState(() => {
    if (initialValues) {
      const lineItems = initialValues.items && initialValues.items.length > 0
        ? initialValues.items.map(item => ({
            id: createId('PIL'),
            productId: String(item.productId || ''),
            quantity: String(item.requiredQty ?? item.quantity ?? ''),
          }))
        : [{
            id: createId('PIL'),
            productId: String(initialValues.productId || ''),
            quantity: String(initialValues.quantity || ''),
          }];
      return {
        indentDate: initialValues.indentDate,
        priority: initialValues.priority || 'Medium',
        status: initialValues.status || 'Pending',
        notes: initialValues.notes || '',
        lineItems,
      }
    }
    return initialForm
  })
  const [touched, setTouched] = useState({})

  const duplicateErrors = getDuplicateProductErrors(formData.lineItems)
  const errors = {
    indentDate: getRequiredError(formData.indentDate, 'Request date'),
    priority: getRequiredError(formData.priority, 'Priority'),
    lineItems: formData.lineItems.map((lineItem, index) => ({
      productId: getRequiredError(lineItem.productId, 'Product') || duplicateErrors[index],
      quantity: getNumberError(lineItem.quantity, 'Quantity', { allowZero: false }),
    })),
  }

  const isFormValid =
    !errors.indentDate &&
    !errors.priority &&
    errors.lineItems.every((lineItem) =>
      !lineItem.productId && !lineItem.quantity
    )

  const summary = useMemo(() => {
    const totalQty = formData.lineItems.reduce(
      (sum, lineItem) => sum + Number(lineItem.quantity || 0),
      0,
    )

    return {
      totalQty,
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
          updated.quantity = '1'
        }
        return updated
      }),
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
      indentDate: true,
      priority: true,
      status: true,
      ...formData.lineItems.reduce((result, lineItem) => ({
        ...result,
        [`${lineItem.id}-productId`]: true,
        [`${lineItem.id}-quantity`]: true,
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
      })),
    })
  }

  return (
    <form className="indent-create-wrapper" onSubmit={handleSubmit} autoComplete="off">
      {/* Header */}
      <div className="indent-create-header">
        <div className="indent-create-header__title">
          <h1>{initialValues ? 'Edit Purchase Indent' : 'Create Purchase Indent'}</h1>
        </div>
      </div>

      {/* Section 1: Indent Details */}
      <div className="indent-card">
        <h3 className="indent-card__title">Indent Details</h3>
        <div className="indent-details-grid">
          {/* Indent Number */}
          <div className="indent-field-group">
            <label htmlFor="pi-indent-number">Indent Number</label>
            <input
              id="pi-indent-number"
              type="text"
              className="indent-input"
              value={initialValues ? (initialValues.indentNumber || initialValues.indentId) : nextIndentNumber}
              readOnly
              disabled
            />
          </div>

          {/* Request Date */}
          <div className={`indent-field-group ${touched.indentDate && errors.indentDate ? 'indent-field-group--error' : ''}`}>
            <label htmlFor="pi-indent-date">Request date <span className="required">*</span></label>
            <DatePicker
              id="pi-indent-date"
              name="indentDate"
              value={formData.indentDate}
              onChange={handleChange}
              onBlur={handleBlur}
              disabled={isSubmitting}
              className="indent-details-date-picker"
            />
            {touched.indentDate && errors.indentDate && (
              <span className="indent-field-error">{errors.indentDate}</span>
            )}
          </div>

          {/* Priority */}
          <div className={`indent-field-group ${touched.priority && errors.priority ? 'indent-field-group--error' : ''}`}>
            <label htmlFor="pi-priority">Priority <span className="required">*</span></label>
            <select
              id="pi-priority"
              name="priority"
              className="indent-select"
              value={formData.priority}
              onChange={handleChange}
              onBlur={handleBlur}
              disabled={isSubmitting}
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
            </select>
            {touched.priority && errors.priority && (
              <span className="indent-field-error">{errors.priority}</span>
            )}
          </div>

          {/* Status */}
          <div className="indent-field-group">
            <label htmlFor="pi-status">Status</label>
            <select
              id="pi-status"
              name="status"
              className="indent-select"
              value={formData.status}
              onChange={handleChange}
              onBlur={handleBlur}
              disabled={isSubmitting}
            >
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
              <option value="Ordered">Ordered</option>
            </select>
          </div>

          {/* Notes removed totally as per user request */}
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
                <th>Product *</th>
                <th style={{ width: '140px', textAlign: 'center' }}>Available Stock</th>
                <th style={{ width: '140px', textAlign: 'center' }}>Quantity *</th>
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
                        id={`pi-product-${lineItem.id}`}
                        name={`product-${lineItem.id}`}
                        value={lineItem.productId}
                        onChange={(event) =>
                          handleLineChange(lineItem.id, 'productId', event.target.value)
                        }
                        onBlur={() => handleLineBlur(lineItem.id, 'productId')}
                        options={products}
                        placeholder="Select product"
                        error={errors.lineItems?.[index]?.productId || ''}
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
                        id={`pi-quantity-${lineItem.id}`}
                        name={`quantity-${lineItem.id}`}
                        value={lineItem.quantity}
                        onChange={(event) =>
                          handleLineChange(lineItem.id, 'quantity', event.target.value)
                        }
                        onBlur={() => handleLineBlur(lineItem.id, 'quantity')}
                        error={touched[`${lineItem.id}-quantity`] ? errors.lineItems?.[index]?.quantity || '' : ''}
                        className="indent-table-field"
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

        {/* Footer Summary */}
        <div className="indent-summary-row" style={{ marginTop: '16px' }}>
          <div className="indent-summary-item">
            Lines: <strong>{summary.lines}</strong>
          </div>
          <div className="indent-summary-item">
            Total items requested: <strong>{summary.totalQty}</strong>
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
          {isSubmitting ? 'Saving...' : initialValues ? 'Save Changes' : 'Submit'}
        </button>
      </div>
    </form>
  )
}
