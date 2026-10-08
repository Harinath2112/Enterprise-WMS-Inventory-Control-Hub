import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Check,
  Plus,
  Trash2,
  Pencil,
  ChevronDown,
  LoaderCircle,
} from 'lucide-react'
import { createInvoice, getInvoices } from '../../../api/businessApi'
import { getWarehouses } from '../../../api/warehousesApi'
import { showToast } from '../../../components/common/toast'
import { DEFAULT_WAREHOUSES, formatCurrency, getToday } from '../../../utils/helpers'

const defaultItem = {
  productId: '',
  description: '',
  hsn: '',
  uom: '',
  quantity: '1',
  unitPrice: '0',
  discount: '0',
  tax: '18',
}

function getDueDateFromTerms(invoiceDateStr, terms) {
  if (!invoiceDateStr) return ''
  const date = new Date(`${invoiceDateStr}T00:00:00`)
  if (Number.isNaN(date.getTime())) return invoiceDateStr

  let daysToAdd = 0
  if (terms === 'Net 15 Days') daysToAdd = 15
  else if (terms === 'Net 30 Days') daysToAdd = 30
  else if (terms === 'Net 60 Days') daysToAdd = 60
  else if (terms === 'Due on Receipt') daysToAdd = 0

  date.setDate(date.getDate() + daysToAdd)

  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function formatCustomerAddress(customer) {
  if (!customer) return 'No customer selected'
  const lines = []
  
  if (customer.companyName) {
    lines.push(customer.companyName)
  } else if (customer.company) {
    lines.push(customer.company)
  } else {
    lines.push(customer.name)
  }

  if (customer.address) {
    lines.push(customer.address)
  }

  const cityLine = []
  if (customer.city) cityLine.push(customer.city)
  if (customer.state) cityLine.push(customer.state)
  if (customer.pincode) cityLine.push(customer.pincode)
  if (cityLine.length > 0) {
    lines.push(cityLine.join(', '))
  }

  lines.push('India')
  return lines.join('\n')
}

function convertNumberToWords(amount) {
  if (amount === 0) return 'Zero Rupees Only'

  const singleDigits = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine']
  const doubleDigits = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
  const tensPlace = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

  function convertLessThanThousand(num) {
    let str = ''
    if (num >= 100) {
      str += singleDigits[Math.floor(num / 100)] + ' Hundred '
      num %= 100
    }
    if (num >= 10 && num < 20) {
      str += doubleDigits[num - 10] + ' '
    } else {
      if (num >= 20) {
        str += tensPlace[Math.floor(num / 10)] + ' '
        num %= 10
      }
      if (num > 0) {
        str += singleDigits[num] + ' '
      }
    }
    return str.trim()
  }

  function convertWholeNumber(num) {
    if (num === 0) return 'Zero'
    let str = ''
    if (num >= 10000000) {
      str += convertLessThanThousand(Math.floor(num / 10000000)) + ' Crore '
      num %= 10000000
    }
    if (num >= 100000) {
      str += convertLessThanThousand(Math.floor(num / 100000)) + ' Lakh '
      num %= 100000
    }
    if (num >= 1000) {
      str += convertLessThanThousand(Math.floor(num / 1000)) + ' Thousand '
      num %= 1000
    }
    if (num > 0) {
      str += convertLessThanThousand(num)
    }
    return str.trim()
  }

  const roundedAmount = Math.round(amount * 100) / 100
  const rupees = Math.floor(roundedAmount)
  const paise = Math.round((roundedAmount - rupees) * 100)

  let result = ''
  if (rupees > 0) {
    result += convertWholeNumber(rupees) + ' Rupees'
  }
  if (paise > 0) {
    if (rupees > 0) {
      result += ' and '
    }
    result += convertWholeNumber(paise) + ' Paise'
  }

  if (result) {
    return result + ' Only'
  }
  return 'Zero Rupees Only'
}

function generateInvoiceNumber(invoices = []) {
  const today = new Date()
  const yyyy = today.getFullYear()
  const mm = String(today.getMonth() + 1).padStart(2, '0')
  const dd = String(today.getDate()).padStart(2, '0')
  const dateString = `${yyyy}${mm}${dd}`

  const prefix = `INV-${dateString}-`
  
  let maxSeq = 0
  invoices.forEach((inv) => {
    const num = inv.invoiceNumber || inv.invoiceNo || ''
    if (num.startsWith(prefix)) {
      const parts = num.split(prefix)
      if (parts.length > 1) {
        const seq = parseInt(parts[1], 10)
        if (!Number.isNaN(seq) && seq > maxSeq) {
          maxSeq = seq
        }
      }
    }
  })

  const nextSeq = String(maxSeq + 1).padStart(3, '0')
  return `${prefix}${nextSeq}`
}

function buildInitialDraft(initialInvoiceNo) {
  const today = getToday()
  return {
    customerId: '',
    warehouseId: 'all',
    invoiceNo: initialInvoiceNo || `INV-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(Math.floor(1000 + Math.random() * 9000))}`,
    invoiceDate: today,
    dueDate: getDueDateFromTerms(today, 'Net 15 Days'),
    salesPerson: 'Ravi Kiran',
    paymentTerms: 'Net 15 Days',
    paymentMethod: 'Cash',
    reference: '',
    notes: '',
    paidAmount: '',
    items: [{ ...defaultItem }],
  }
}

function toNumber(value) {
  const num = parseFloat(value)
  return Number.isNaN(num) ? 0 : num
}

function toApiId(value, _type) {
  const num = parseInt(value, 10)
  return Number.isNaN(num) ? null : num
}

function InvoiceForm({
  customers,
  products,
  warehouses: propWarehouses = [],
  onSubmit,
  onCancel,
  isSubmitting,
  initialInvoiceNo,
}) {
  const [draft, setDraft] = useState(() => buildInitialDraft(initialInvoiceNo))
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [isEditingAddress, setIsEditingAddress] = useState(false)
  const [customAddress, setCustomAddress] = useState('')
  const [warehousesList, setWarehousesList] = useState(propWarehouses)

  useEffect(() => {
    if (Array.isArray(propWarehouses) && propWarehouses.length > 0) {
      setWarehousesList(propWarehouses)
      return
    }
    async function fetchWarehouses() {
      try {
        const res = await getWarehouses()
        if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
          setWarehousesList(res.data)
        } else {
          setWarehousesList(DEFAULT_WAREHOUSES)
        }
      } catch {
        setWarehousesList(DEFAULT_WAREHOUSES)
      }
    }
    fetchWarehouses()
  }, [propWarehouses])

  const productOptions = useMemo(
    () => products,
    [products]
  )

  const selectedCustomer = useMemo(
    () => customers.find((c) => String(c.id) === String(draft.customerId)),
    [draft.customerId, customers]
  )

  const calculatedTotals = useMemo(() => {
    let subTotal = 0
    let totalDiscount = 0
    let totalTax = 0

    const mappedItems = draft.items.map((item) => {
      const qty = toNumber(item.quantity)
      const price = toNumber(item.unitPrice)
      const discPercent = toNumber(item.discount)
      const taxPercent = toNumber(item.tax)

      const gross = qty * price
      const discAmount = gross * (discPercent / 100)
      const taxable = gross - discAmount
      const taxAmount = taxable * (taxPercent / 100)
      const rowAmount = taxable + taxAmount

      return {
        ...item,
        gross,
        discAmount,
        taxAmount,
        rowAmount,
      }
    })

    for (const item of mappedItems) {
      subTotal += item.gross
      totalDiscount += item.discAmount
      totalTax += item.taxAmount
    }

    const grandTotal = subTotal - totalDiscount + totalTax

    return {
      items: mappedItems,
      subTotal,
      totalDiscount,
      totalTax,
      grandTotal,
    }
  }, [draft.items])

  const amountInWords = useMemo(() => {
    return convertNumberToWords(calculatedTotals.grandTotal)
  }, [calculatedTotals.grandTotal])

  const amountPaid = Math.min(
    Math.max(0, toNumber(draft.paidAmount)),
    calculatedTotals.grandTotal,
  )
  const balanceDue = Math.max(0, calculatedTotals.grandTotal - amountPaid)

  function updateField(name, value) {
    setDraft((currentValue) => ({
      ...currentValue,
      [name]: value,
    }))

    setErrors((currentValue) => ({
      ...currentValue,
      [name]: '',
    }))
    setFormError('')
  }

  function handleCustomerChange(event) {
    const customerId = event.target.value
    const customer = customers.find((c) => String(c.id) === String(customerId))
    setDraft((currentValue) => ({
      ...currentValue,
      customerId,
    }))
    setCustomAddress(customer ? formatCustomerAddress(customer) : '')
    setErrors((currentValue) => ({
      ...currentValue,
      customerId: '',
    }))
    setFormError('')
  }

  function handleInvoiceDateChange(event) {
    const invoiceDate = event.target.value
    setDraft((currentValue) => ({
      ...currentValue,
      invoiceDate,
      dueDate: getDueDateFromTerms(invoiceDate, currentValue.paymentTerms),
    }))
    setErrors((currentValue) => ({
      ...currentValue,
      invoiceDate: '',
    }))
    setFormError('')
  }

  function handlePaymentTermsChange(event) {
    const paymentTerms = event.target.value
    setDraft((currentValue) => ({
      ...currentValue,
      paymentTerms,
      dueDate: getDueDateFromTerms(currentValue.invoiceDate, paymentTerms),
    }))
    setFormError('')
  }

  function handleItemProductChange(index, productId) {
    const product = productOptions.find((p) => String(p.id) === String(productId))

    setDraft((currentValue) => {
      const updatedItems = [...currentValue.items]
      const actualUnitPrice = product?.price ? String(product.price) : '0'

      updatedItems[index] = {
        ...updatedItems[index],
        productId,
        description: product?.description || product?.name || '',
        uom: product?.unit || 'Nos',
        unitPrice: actualUnitPrice,
        hsn: product ? '84713010' : '',
      }
      return {
        ...currentValue,
        items: updatedItems,
      }
    })

    setErrors((currentValue) => ({
      ...currentValue,
      [`item_${index}_productId`]: '',
      [`item_${index}_quantity`]: '',
      [`item_${index}_unitPrice`]: '',
    }))
    setFormError('')
  }

  function handleItemFieldChange(index, field, value) {
    setDraft((currentValue) => {
      const updatedItems = [...currentValue.items]
      updatedItems[index] = {
        ...updatedItems[index],
        [field]: value,
      }
      return {
        ...currentValue,
        items: updatedItems,
      }
    })

    setErrors((currentValue) => ({
      ...currentValue,
      [`item_${index}_${field}`]: '',
    }))
    setFormError('')
  }

  function handleAddItem() {
    setDraft((currentValue) => ({
      ...currentValue,
      items: [...currentValue.items, { ...defaultItem }],
    }))
    setFormError('')
  }

  function handleDeleteItem(index) {
    setDraft((currentValue) => {
      let updatedItems = [...currentValue.items]
      if (updatedItems.length <= 1) {
        updatedItems = [{ ...defaultItem }]
      } else {
        updatedItems.splice(index, 1)
      }
      return {
        ...currentValue,
        items: updatedItems,
      }
    })
    setFormError('')
  }

  function handleClearAll() {
    setDraft((currentValue) => ({
      ...currentValue,
      items: [{ ...defaultItem }],
    }))
    setFormError('')
  }

  function validate() {
    const nextErrors = {}

    if (!draft.customerId) {
      nextErrors.customerId = 'Select a customer.'
    }

    if (!draft.invoiceNo) {
      nextErrors.invoiceNo = 'Invoice number is required.'
    }

    if (!draft.invoiceDate) {
      nextErrors.invoiceDate = 'Invoice date is required.'
    }

    if (draft.dueDate && draft.invoiceDate && draft.dueDate < draft.invoiceDate) {
      nextErrors.dueDate = 'Due date cannot be before invoice date.'
    }

    const enteredPaidAmount = toNumber(draft.paidAmount)
    if (enteredPaidAmount < 0) {
      nextErrors.paidAmount = 'Paid amount cannot be negative.'
    } else if (enteredPaidAmount > calculatedTotals.grandTotal) {
      nextErrors.paidAmount = 'Paid amount cannot exceed the grand total.'
    }

    if (draft.items.length === 0 || (draft.items.length === 1 && !draft.items[0].productId)) {
      setFormError('At least one item is required.')
      return false
    }

    draft.items.forEach((item, index) => {
      if (!item.productId) {
        nextErrors[`item_${index}_productId`] = 'Product is required.'
      }

      const qty = toNumber(item.quantity)
      const price = toNumber(item.unitPrice)

      if (qty <= 0) {
        nextErrors[`item_${index}_quantity`] = 'Qty must be > 0.'
      }

      if (price < 0) {
        nextErrors[`item_${index}_unitPrice`] = 'Price cannot be negative.'
      }

      const product = productOptions.find((p) => String(p.id) === String(item.productId))
      if (product && Number(product.stock) > 0 && qty > Number(product.stock)) {
        nextErrors[`item_${index}_quantity`] = `Only ${product.stock} unit${Number(product.stock) === 1 ? '' : 's'} available.`
      }
    })

    setErrors(nextErrors)
    const isValid = Object.keys(nextErrors).length === 0
    if (!isValid) {
      setFormError('Please correct the highlighted validation errors.')
    }
    return isValid
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setFormError('')

    if (!validate()) {
      return
    }

    try {
      const response = await onSubmit({
        customerId: toApiId(draft.customerId, 'Customer'),
        invoiceDate: draft.invoiceDate || null,
        dueDate: draft.dueDate || null,
        paidAmount: amountPaid,
        paymentMethod: draft.paymentMethod || 'Cash',
        referenceNumber: draft.reference || null,
        items: calculatedTotals.items.map((item) => {
          const qty = toNumber(item.quantity)
          const baseUnitPrice = toNumber(item.unitPrice)
          const disc = toNumber(item.discount)
          const tax = toNumber(item.tax)
          const gross = qty * baseUnitPrice
          const discAmount = gross * (disc / 100)
          const taxable = gross - discAmount
          const taxAmount = taxable * (tax / 100)
          const lineTotal = taxable + taxAmount

          const product = productOptions.find((p) => String(p.id) === String(item.productId))

          return {
            productId: toApiId(item.productId, 'Product'),
            productName: product?.name || item.description || 'Product Item',
            productSku: product?.sku || '',
            variantId: null,
            quantity: qty,
            unitPrice: baseUnitPrice,
            price: baseUnitPrice,
            discountPercent: disc,
            discountAmount: discAmount,
            taxPercent: tax,
            taxAmount: taxAmount,
            lineTotal: lineTotal,
            total: lineTotal,
            unit: item.uom || product?.unit || 'Nos',
            hsn: item.hsn || '',
          }
        }),
      })

      if (response?.success) {
        // Submit will handle transition back
      } else {
        setFormError(response?.error || 'Invoice could not be saved.')
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Invoice could not be saved.')
    }
  }

  return (
    <form className="invoice-form" onSubmit={handleSubmit}>
      {formError ? (
        <div className="message-box message-box--error page-error-banner" role="alert">
          <span>{formError}</span>
        </div>
      ) : null}

      {/* Single Header Details Container */}
      <div className="invoice-form__single-header-card">
        <div className="invoice-form__single-header-top">
          <h3>Customer, Invoice &amp; Warehouse Details</h3>
        </div>

        <div className="invoice-form__single-header-grid">
          {/* Customer Field */}
          <label className={`field ${errors.customerId ? 'field--error' : ''}`}>
            <span>Customer *</span>
            <select
              value={draft.customerId}
              onChange={handleCustomerChange}
              disabled={isSubmitting}
            >
              <option value="">Select customer</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {errors.customerId ? <span className="field-error">{errors.customerId}</span> : null}
          </label>

          {/* Warehouse Dropdown Field */}
          <label className="field">
            <span>Warehouse</span>
            <select
              value={draft.warehouseId || 'all'}
              onChange={(e) => updateField('warehouseId', e.target.value)}
              disabled={isSubmitting}
            >
              <option value="all">All Warehouses</option>
              {warehousesList.map((wh) => {
                const wId = String(wh.id ?? wh.warehouseId ?? wh.WarehouseId ?? '')
                const wName = wh.name ?? wh.warehouseName ?? wh.Name ?? `Warehouse #${wId}`
                return (
                  <option key={wId} value={wId}>
                    {wName}
                  </option>
                )
              })}
            </select>
          </label>

          {/* Invoice No. Field */}
          <label className={`field ${errors.invoiceNo ? 'field--error' : ''}`}>
            <span>Invoice No. *</span>
            <input
              type="text"
              value={draft.invoiceNo}
              onChange={(e) => updateField('invoiceNo', e.target.value)}
              disabled={isSubmitting}
            />
            {errors.invoiceNo ? <span className="field-error">{errors.invoiceNo}</span> : null}
          </label>

          {/* Invoice Date Field */}
          <label className={`field ${errors.invoiceDate ? 'field--error' : ''}`}>
            <span>Invoice Date *</span>
            <input
              type="date"
              value={draft.invoiceDate}
              onChange={handleInvoiceDateChange}
              disabled={isSubmitting}
            />
            {errors.invoiceDate ? <span className="field-error">{errors.invoiceDate}</span> : null}
          </label>

          {/* Due Date Field */}
          <label className={`field ${errors.dueDate ? 'field--error' : ''}`}>
            <span>Due Date</span>
            <input
              type="date"
              value={draft.dueDate}
              onChange={(e) => updateField('dueDate', e.target.value)}
              disabled={isSubmitting}
            />
            {errors.dueDate ? <span className="field-error">{errors.dueDate}</span> : null}
          </label>

          {/* Sales Person Field */}
          <label className="field">
            <span>Sales Person</span>
            <select
              value={draft.salesPerson}
              onChange={(e) => updateField('salesPerson', e.target.value)}
              disabled={isSubmitting}
            >
              <option value="Ravi Kiran">Ravi Kiran</option>
              <option value="Anil Kumar">Anil Kumar</option>
              <option value="Suresh Raina">Suresh Raina</option>
              <option value="Meera Jasmine">Meera Jasmine</option>
            </select>
          </label>

          {/* Payment Terms Field */}
          <label className="field">
            <span>Payment Terms</span>
            <select
              value={draft.paymentTerms}
              onChange={handlePaymentTermsChange}
              disabled={isSubmitting}
            >
              <option value="Net 15 Days">Net 15 Days</option>
              <option value="Net 30 Days">Net 30 Days</option>
              <option value="Net 60 Days">Net 60 Days</option>
              <option value="Due on Receipt">Due on Receipt</option>
            </select>
          </label>

          {/* Payment Method Field */}
          <label className="field">
            <span>Payment Method</span>
            <select
              value={draft.paymentMethod}
              onChange={(e) => updateField('paymentMethod', e.target.value)}
              disabled={isSubmitting}
            >
              <option value="Cash">Cash</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="UPI">UPI</option>
              <option value="Card">Card</option>
              <option value="Cheque">Cheque</option>
            </select>
          </label>

          {/* Reference Field */}
          <label className="field">
            <span>Reference</span>
            <input
              type="text"
              placeholder="Enter reference (optional)"
              value={draft.reference}
              onChange={(e) => updateField('reference', e.target.value)}
              disabled={isSubmitting}
            />
          </label>

          {/* GSTIN Field */}
          <label className="field">
            <span>GSTIN</span>
            <input
              type="text"
              value={selectedCustomer?.gstNumber || 'N/A'}
              disabled
              style={{ background: '#f1f5f9', color: '#64748b' }}
            />
          </label>

          {/* Billing Address Field */}
          <div className="invoice-form__grid-col-span-2">
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
              Billing Address
            </span>
            <div className="invoice-form__billing-address-container">
              {isEditingAddress ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <textarea
                    style={{
                      width: '100%',
                      minHeight: '60px',
                      fontSize: '13px',
                      padding: '6px 8px',
                      border: '1px solid #cbd5e1',
                      borderRadius: '4px',
                      resize: 'vertical',
                    }}
                    value={customAddress}
                    onChange={(e) => setCustomAddress(e.target.value)}
                    placeholder="Enter billing address"
                  />
                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      style={{ fontSize: '11px', padding: '2px 8px', border: '1px solid #cbd5e1', borderRadius: '4px', background: '#ffffff', cursor: 'pointer' }}
                      onClick={() => {
                        setIsEditingAddress(false)
                        setCustomAddress(formatCustomerAddress(selectedCustomer))
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      style={{ fontSize: '11px', padding: '2px 8px', border: 'none', borderRadius: '4px', background: '#6c5ce7', color: '#ffffff', cursor: 'pointer' }}
                      onClick={() => setIsEditingAddress(false)}
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <pre className="invoice-form__billing-address-text">
                    {customAddress || 'No customer selected'}
                  </pre>
                  {draft.customerId ? (
                    <button
                      type="button"
                      className="invoice-form__edit-address-btn"
                      onClick={() => setIsEditingAddress(true)}
                      title="Edit billing address"
                    >
                      <Pencil size={14} />
                    </button>
                  ) : null}
                </>
              )}
            </div>
          </div>

          {/* Notes Field */}
          <div className="invoice-form__grid-col-span-2">
            <label className="field" style={{ marginBottom: 0 }}>
              <span>Notes</span>
              <textarea
                placeholder="Enter notes (optional)"
                value={draft.notes}
                onChange={(e) => updateField('notes', e.target.value)}
                disabled={isSubmitting}
                style={{
                  minHeight: '84px',
                  resize: 'vertical',
                  fontSize: '13px',
                  padding: '6px 8px',
                  border: '1px solid #cbd5e1',
                  borderRadius: '4px'
                }}
              />
            </label>
          </div>
        </div>
      </div>

      <div className="invoice-form__items-section-header">
        <h3>Invoice Items</h3>
        <div className="invoice-form__actions-header">
          <button
            type="button"
            className="invoice-form__action-btn-outline invoice-form__action-btn-outline--clear"
            onClick={handleClearAll}
            disabled={isSubmitting}
          >
            <Trash2 size={14} /> Clear All
          </button>
        </div>
      </div>

      <div className="invoice-form__table-container">
        <table className="invoice-form__items-table">
          <thead>
            <tr>
              <th style={{ width: '40px', textAlign: 'center' }}>Slno</th>
              <th style={{ width: '220px' }}>Item *</th>
              <th style={{ width: '70px', textAlign: 'center' }}>Qty *</th>
              <th style={{ width: '110px', textAlign: 'right' }}>Unit Price (₹) *</th>
              <th style={{ width: '85px', textAlign: 'center' }}>Discount (%)</th>
              <th style={{ width: '80px', textAlign: 'center' }}>Tax (%)</th>
              <th style={{ width: '120px', textAlign: 'right' }}>Amount (₹)</th>
              <th style={{ width: '80px', textAlign: 'center' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {calculatedTotals.items.map((item, index) => (
              <tr key={index}>
                <td className="invoice-form__cell-center">{index + 1}</td>
                <td>
                  <select
                    value={item.productId}
                    onChange={(e) => handleItemProductChange(index, e.target.value)}
                    disabled={isSubmitting}
                    style={{
                      border: errors[`item_${index}_productId`] ? '1px solid #ef4444' : '1px solid #cbd5e1'
                    }}
                  >
                    <option value="">Select product</option>
                    {productOptions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => handleItemFieldChange(index, 'quantity', e.target.value)}
                    disabled={isSubmitting}
                    className="invoice-form__input--center"
                    style={{
                      border: errors[`item_${index}_quantity`] ? '1px solid #ef4444' : '1px solid #cbd5e1'
                    }}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unitPrice}
                    onChange={(e) => handleItemFieldChange(index, 'unitPrice', e.target.value)}
                    disabled={isSubmitting}
                    className="invoice-form__input--right"
                    style={{
                      border: errors[`item_${index}_unitPrice`] ? '1px solid #ef4444' : '1px solid #cbd5e1'
                    }}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={item.discount}
                    onChange={(e) => handleItemFieldChange(index, 'discount', e.target.value)}
                    disabled={isSubmitting}
                    className="invoice-form__input--center"
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={item.tax}
                    onChange={(e) => handleItemFieldChange(index, 'tax', e.target.value)}
                    disabled={isSubmitting}
                    className="invoice-form__input--center"
                  />
                </td>
                <td className="invoice-form__cell--right">
                  {formatCurrency(item.rowAmount || 0)}
                </td>
                <td className="invoice-form__cell--center">
                  <div className="invoice-form__row-actions">
                    <button
                      type="button"
                      className="invoice-form__row-action-btn invoice-form__row-action-btn--delete"
                      onClick={() => handleDeleteItem(index)}
                      disabled={isSubmitting}
                      title="Delete Row"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <button
          type="button"
          className="invoice-form__action-btn-outline invoice-form__action-btn-outline--add"
          onClick={handleAddItem}
          disabled={isSubmitting}
        >
          <Plus size={14} /> Add Item
        </button>
      </div>

      <div className="invoice-form__bottom-row">
        <div className="invoice-form__words-container">
          <h4>Amount in Words</h4>
          <div className="invoice-form__words-box">
            {amountInWords}
          </div>
        </div>

        <div className="invoice-form__summary-card">
          <div className="invoice-form__summary-row">
            <span>Sub Total</span>
            <span>{formatCurrency(calculatedTotals.subTotal)}</span>
          </div>
          <div className="invoice-form__summary-row invoice-form__summary-row--discount">
            <span>Discount</span>
            <span>- {formatCurrency(calculatedTotals.totalDiscount)}</span>
          </div>
          <div className="invoice-form__summary-row">
            <span>Tax</span>
            <span>{formatCurrency(calculatedTotals.totalTax)}</span>
          </div>
          <div className="invoice-form__summary-row invoice-form__summary-row--total">
            <span>Grand Total</span>
            <span>{formatCurrency(calculatedTotals.grandTotal)}</span>
          </div>
        </div>
      </div>

      <div className="invoice-form__payment-card">
        <div className="invoice-form__payment-input-section">
          <label htmlFor="invoice-paid-amount">Paid Amount (₹)</label>
          <input
            id="invoice-paid-amount"
            type="number"
            min="0"
            max={calculatedTotals.grandTotal}
            step="0.01"
            value={draft.paidAmount}
            onChange={(event) => updateField('paidAmount', event.target.value)}
            onKeyDown={(event) => {
              if (['-', '+', 'e', 'E'].includes(event.key)) event.preventDefault()
            }}
            placeholder="0.00"
            className={errors.paidAmount ? 'is-invalid' : ''}
            disabled={isSubmitting}
          />
          {errors.paidAmount && (
            <span className="invoice-form__payment-error">{errors.paidAmount}</span>
          )}
        </div>

        <div className="invoice-form__payment-divider" aria-hidden="true" />
        <div className="invoice-form__payment-metric">
          <span>Total Amount</span>
          <strong>{formatCurrency(calculatedTotals.grandTotal)}</strong>
        </div>
        <span className="invoice-form__payment-dot" aria-hidden="true">•</span>
        <div className="invoice-form__payment-metric invoice-form__payment-metric--paid">
          <span>Amount Paid</span>
          <strong>{formatCurrency(amountPaid)}</strong>
        </div>
        <span className="invoice-form__payment-dot" aria-hidden="true">•</span>
        <div className="invoice-form__payment-metric invoice-form__payment-metric--balance">
          <span>Balance Due</span>
          <strong>{formatCurrency(balanceDue)}</strong>
        </div>
      </div>

      <div className="invoice-form__footer">
        <button className="button button-cancel button-secondary"
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="button button-primary"
          disabled={isSubmitting}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          Save Invoice
        </button>
      </div>
    </form>
  )
}

export default function CreateInvoiceScreen({ customers = [], products = [], warehouses = [] }) {
  const navigate = useNavigate()
  const [isSaving, setIsSaving] = useState(false)
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(true)
  const [nextInvoiceNo, setNextInvoiceNo] = useState('')

  useEffect(() => {
    async function loadInvoices() {
      try {
        const response = await getInvoices()
        if (response.success) {
          const invoices = response.data || []
          setNextInvoiceNo(generateInvoiceNumber(invoices))
        } else {
          // Fallback to format INV-YYYYMMDD-001 based on current date
          const today = new Date()
          const yyyy = today.getFullYear()
          const mm = String(today.getMonth() + 1).padStart(2, '0')
          const dd = String(today.getDate()).padStart(2, '0')
          setNextInvoiceNo(`INV-${yyyy}${mm}${dd}-001`)
        }
      } catch (err) {
        const today = new Date()
        const yyyy = today.getFullYear()
        const mm = String(today.getMonth() + 1).padStart(2, '0')
        const dd = String(today.getDate()).padStart(2, '0')
        setNextInvoiceNo(`INV-${yyyy}${mm}${dd}-001`)
      } finally {
        setIsLoadingInvoices(false)
      }
    }
    loadInvoices()
  }, [])

  const customerOptions = useMemo(
    () => customers.filter((c) => c && c.id && c.name).sort((a, b) => a.name.localeCompare(b.name)),
    [customers]
  )

  const productOptions = useMemo(
    () =>
      products
        .filter((p) => {
          if (!p || !(p.id ?? p.productId) || !p.name) return false
          if (p.isArchived === true || p.IsArchived === true || p.is_archived === true) return false
          const status = String(p.rawStatus ?? p.sourceStatus ?? p.status ?? '').trim().toLowerCase()
          return status !== 'archived' && status !== 'discontinued'
        })
        .map((product) => ({
          ...product,
          id: String(product.id ?? product.productId),
          name: product.name || `Product ${product.id ?? product.productId}`,
          sku: product.sku || product.SKU || '',
          price: Number(product.price ?? product.Price ?? 0),
          stock: Number(product.stock ?? product.Stock ?? 0),
          unit: product.unit || 'Nos',
          description: product.description || '',
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [products]
  )

  async function handleCreateInvoice(payload) {
    setIsSaving(true)
    try {
      const response = await createInvoice(payload)
      if (!response.success) {
        showToast({
          type: 'error',
          title: 'Invoices',
          message: response.error || 'Unable to create invoice.',
        })
        return response
      }

      showToast({
        type: 'success',
        title: 'Invoices',
        message: response.message || 'Invoice created successfully.',
      })
      navigate('/pos/sales')
      return response
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Invoices',
        message: error instanceof Error ? error.message : 'Unable to create invoice.',
      })
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoadingInvoices) {
    return (
      <div className="page sales-page sales-page--create" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
        <LoaderCircle className="animate-spin" size={40} style={{ color: '#684cda' }} />
      </div>
    )
  }

  return (
    <div className="page sales-page sales-page--create">
      <div className="sales-page__breadcrumb-bar" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#0f172a' }}>Create Invoice</h1>
        </div>
        
      </div>

      <div className="card" style={{ padding: '24px', background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
        <InvoiceForm
          customers={customerOptions}
          onSubmit={handleCreateInvoice}
          onCancel={() => navigate('/pos/sales')}
          isSubmitting={isSaving}
          initialInvoiceNo={nextInvoiceNo}
          products={productOptions}
          warehouses={warehouses}
        />
      </div>
    </div>
  )
}
