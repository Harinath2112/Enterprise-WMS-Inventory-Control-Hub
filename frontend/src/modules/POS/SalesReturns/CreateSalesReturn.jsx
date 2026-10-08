import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Save, AlertCircle } from 'lucide-react'
import PageHeader from '../../../components/common/PageHeader'
import StateBlock from '../../../components/common/StateBlock'
import { showToast } from '../../../components/common/toast'
import {
  createSalesReturn,
  getSalesReturnById,
  getSalesReturnCustomers,
  getSalesReturnInvoices,
  getSalesReturnInvoiceItems,
  updateSalesReturn,
} from '../../../api/salesReturnApi'
import { getCustomers } from '../../../api/customersApi'
import { getWarehouses } from '../../../api/warehousesApi'
import { DEFAULT_WAREHOUSES, formatCurrency } from '../../../utils/helpers'
import './SalesReturns.css'

export default function CreateSalesReturn({ mode = 'create' }) {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEditMode = mode === 'edit' || Boolean(id)

  // Master Data
  const [customers, setCustomers] = useState([])
  const [availableInvoices, setAvailableInvoices] = useState([])
  const [warehouses, setWarehouses] = useState([])

  // Header State
  const [customerId, setCustomerId] = useState('')
  const [warehouseId, setWarehouseId] = useState('all')
  const [invoiceId, setInvoiceId] = useState('')
  const [returnDate, setReturnDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [reason, setReason] = useState('')

  // Items State
  // item: { id, productId, productName, variantId, variantName, invoicedQuantity, remainingReturnableQuantity, returnQuantity, price }
  const [items, setItems] = useState([])

  // UI States
  const [loading, setLoading] = useState(true)
  const [loadingInvoices, setLoadingInvoices] = useState(false)
  const [loadingItems, setLoadingItems] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [validationErrors, setValidationErrors] = useState({})

  // Fetch initial data (Customers list & Edit record if applicable)
  const initData = useCallback(async () => {
    setLoading(true)
    try {
      // Load warehouses
      try {
        const whRes = await getWarehouses()
        if (whRes && whRes.success && Array.isArray(whRes.data) && whRes.data.length > 0) {
          setWarehouses(whRes.data)
        } else {
          setWarehouses(DEFAULT_WAREHOUSES)
        }
      } catch {
        setWarehouses(DEFAULT_WAREHOUSES)
      }

      // Load customers strictly from API
      let custData = []
      const customersRes = await getSalesReturnCustomers()
      if (customersRes && customersRes.success && Array.isArray(customersRes.data) && customersRes.data.length > 0) {
        custData = customersRes.data
      } else {
        const fallbackCustRes = await getCustomers()
        if (fallbackCustRes && fallbackCustRes.success && Array.isArray(fallbackCustRes.data)) {
          custData = fallbackCustRes.data
        }
      }
      setCustomers(custData)

      // If Edit mode, load record directly from API
      if (isEditMode && id) {
        const returnRes = await getSalesReturnById(id)
        if (returnRes && returnRes.success && returnRes.data) {
          const rec = returnRes.data
          const editCustId = String(rec.customerId || rec.customer_id || '')
          const editInvId = String(rec.invoiceId || rec.invoice_id || '')

          setCustomerId(editCustId)
          setInvoiceId(editInvId)

          if (rec.returnDate || rec.return_date) {
            setReturnDate(String(rec.returnDate || rec.return_date).slice(0, 10))
          }
          setReason(rec.reason || '')

          // Load invoices for customer
          if (editCustId) {
            const invRes = await getSalesReturnInvoices(editCustId)
            if (invRes && invRes.success && Array.isArray(invRes.data)) {
              setAvailableInvoices(invRes.data)
            }
          }

          // Populate line items
          if (Array.isArray(rec.items) && rec.items.length > 0) {
            setItems(
              rec.items.map((line, index) => ({
                id: line.id || line.salesReturnItemId || index + 1,
                productId: String(line.productId || line.product_id || ''),
                productName: line.productName || line.product?.name || `Product #${line.productId}`,
                variantId: line.variantId || line.variant_id ? String(line.variantId || line.variant_id) : '',
                variantName: line.variantName || '',
                invoicedQuantity: String(line.invoicedQuantity ?? line.receivedQuantity ?? line.quantity ?? '1'),
                remainingReturnableQuantity: Number(line.remainingReturnableQuantity ?? line.invoicedQuantity ?? line.quantity ?? '9999'),
                returnQuantity: String(line.returnQuantity ?? line.quantity ?? '1'),
                price: String(line.price ?? '0'),
              }))
            )
          }
        } else {
          showToast(returnRes?.error || 'Failed to load sales return for editing.', 'error')
        }
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error loading reference data.', 'error')
    } finally {
      setLoading(false)
    }
  }, [id, isEditMode])

  useEffect(() => {
    initData()
  }, [initData])

  // Handle Customer Selection -> Dynamically fetch customer invoices from backend
  const handleCustomerChange = async (e) => {
    const selectedCust = e.target.value
    setCustomerId(selectedCust)
    setInvoiceId('')
    setItems([])
    setAvailableInvoices([])

    if (!selectedCust) return

    setLoadingInvoices(true)
    try {
      const res = await getSalesReturnInvoices(selectedCust)
      if (res && res.success && Array.isArray(res.data)) {
        setAvailableInvoices(res.data)
        if (res.data.length === 0) {
          showToast('No invoices found for the selected customer.', 'info')
        }
      } else {
        setAvailableInvoices([])
        showToast(res?.error || 'Failed to fetch customer invoices.', 'error')
      }
    } catch (err) {
      setAvailableInvoices([])
      showToast(err instanceof Error ? err.message : 'Failed to fetch customer invoices.', 'error')
    } finally {
      setLoadingInvoices(false)
    }
  }

  // Handle Invoice Selection -> Dynamically fetch invoice items from backend
  const handleInvoiceChange = async (e) => {
    const selectedInvId = e.target.value
    setInvoiceId(selectedInvId)
    setItems([])

    if (!selectedInvId) return

    setLoadingItems(true)
    try {
      const invItemsRes = await getSalesReturnInvoiceItems(selectedInvId)
      if (invItemsRes && invItemsRes.success && Array.isArray(invItemsRes.data)) {
        if (invItemsRes.data.length === 0) {
          showToast('No returnable line items found for this invoice.', 'error')
          return
        }

        const loadedItems = invItemsRes.data.map((line, idx) => {
          const invoicedQty = Number(line.invoicedQuantity ?? 1)
          const remainingQty = Number(line.remainingReturnableQuantity ?? invoicedQty)
          const defaultReturnQty = Math.max(0, remainingQty)

          return {
            id: line.invoiceItemId || Date.now() + idx,
            productId: String(line.productId),
            productName: line.productName || `Product #${line.productId}`,
            variantId: line.variantId ? String(line.variantId) : '',
            variantName: line.variantName || '',
            invoicedQuantity: String(invoicedQty),
            remainingReturnableQuantity: remainingQty,
            returnQuantity: String(defaultReturnQty),
            price: String(line.price ?? 0),
          }
        })

        setItems(loadedItems)

        const availableToReturn = loadedItems.some((item) => item.remainingReturnableQuantity > 0)
        if (!availableToReturn) {
          showToast('All items for this invoice have already been returned.', 'warning')
        }
      } else {
        showToast(invItemsRes?.error || 'Failed to load invoice items.', 'error')
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error loading invoice items.', 'error')
    } finally {
      setLoadingItems(false)
    }
  }

  // Item Return Quantity Handler
  const handleItemQuantityChange = (index, value) => {
    setItems((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], returnQuantity: value }
      return updated
    })
  }

  // Calculate Total Return Amount (Return Quantity * Price)
  const totalReturnAmount = useMemo(() => {
    return items.reduce((sum, item) => {
      const qty = Number(item.returnQuantity) || 0
      const price = Number(item.price) || 0
      return sum + qty * price
    }, 0)
  }, [items])

  // Form Validation
  const validateForm = () => {
    const errors = {}

    if (!customerId) {
      errors.customerId = 'Customer is required.'
    }

    if (!invoiceId) {
      errors.invoiceId = 'Invoice is required.'
    }

    if (!returnDate) {
      errors.returnDate = 'Return Date is required.'
    }

    if (!reason.trim()) {
      errors.reason = 'Reason for return is required.'
    }

    if (items.length === 0) {
      errors.items = 'At least one return item is required.'
    } else {
      const itemErrors = []
      let hasPositiveReturn = false

      items.forEach((item, index) => {
        const errs = {}
        if (!item.productId) {
          errs.productId = 'Product required.'
        }
        const returnQtyNum = Number(item.returnQuantity)
        if (isNaN(returnQtyNum) || returnQtyNum < 0) {
          errs.returnQuantity = 'Return Qty cannot be negative.'
        } else if (returnQtyNum > 0) {
          hasPositiveReturn = true
        }

        if (
          item.remainingReturnableQuantity !== undefined &&
          returnQtyNum > Number(item.remainingReturnableQuantity)
        ) {
          errs.returnQuantity = `Return Qty exceeds remaining eligible quantity (${item.remainingReturnableQuantity}).`
        }

        if (Object.keys(errs).length > 0) {
          itemErrors[index] = errs
        }
      })

      if (!hasPositiveReturn) {
        errors.items = 'At least one item must have a return quantity greater than 0.'
      }

      if (itemErrors.length > 0) {
        errors.itemErrors = itemErrors
      }
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  // Submit Handler for "Save Return"
  const handleSubmit = async (e) => {
    if (e && e.preventDefault) {
      e.preventDefault()
    }

    if (!validateForm()) {
      showToast('Please resolve validation errors before submitting.', 'error')
      return
    }

    setSubmitting(true)
    try {
      // Filter out line items with 0 return quantity
      const validItems = items.filter((item) => Number(item.returnQuantity) > 0)

      const payload = {
        customerId: Number(customerId),
        invoiceId: Number(invoiceId),
        returnDate: new Date(returnDate).toISOString(),
        reason: reason.trim(),
        items: validItems.map((item) => ({
          productId: Number(item.productId),
          variantId: item.variantId ? Number(item.variantId) : null,
          returnQuantity: Number(item.returnQuantity),
        })),
      }

      let apiRes = null
      if (isEditMode && id) {
        apiRes = await updateSalesReturn(id, payload)
      } else {
        apiRes = await createSalesReturn(payload)
      }

      if (!apiRes || apiRes.success === false) {
        const errorMsg = apiRes?.error || apiRes?.message || 'Failed to save sales return on server.'
        showToast(errorMsg, 'error')
        return
      }

      showToast(
        isEditMode
          ? 'Sales return updated successfully.'
          : 'Sales return created successfully.',
        'success'
      )
      navigate('/pos/returns')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Submission error occurred.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <StateBlock state="loading" message="Loading form data..." />
  }

  return (
    <main className="create-sales-return-page">
      <PageHeader
        title={isEditMode ? `Edit Sales Return #${id}` : 'Create Sales Return'}
        subtitle={
          isEditMode
            ? 'Update customer product return details.'
            : 'Return customer items against an issued invoice.'
        }
        primaryAction={{
          icon: ArrowLeft,
          label: 'Back to Returns',
          onClick: () => navigate('/pos/returns'),
          variant: 'secondary',
        }}
      />

      <form onSubmit={handleSubmit} noValidate>
        {/* Header Fields Section */}
        <section className="card form-section-card">
          <h3 className="section-title">Return Header Details</h3>
          <div className="form-grid">
            {/* Customer Field */}
            <div className="form-field">
              <label htmlFor="customerId">
                Customer <span className="required-star">*</span>
              </label>
              <select
                id="customerId"
                value={customerId}
                onChange={handleCustomerChange}
                className={validationErrors.customerId ? 'input-error' : ''}
              >
                <option value="">-- Select Customer --</option>
                {customers.map((c) => {
                  const cId = String(c.id ?? c.customerId ?? c.customer_id)
                  const cName = c.name || c.customerName || `Customer #${cId}`
                  return (
                    <option key={cId} value={cId}>
                      {cName}
                    </option>
                  )
                })}
              </select>
              {validationErrors.customerId && (
                <span className="field-error">{validationErrors.customerId}</span>
              )}
            </div>

            {/* Warehouse Dropdown Field */}
            <div className="form-field">
              <label htmlFor="warehouseId">Warehouse</label>
              <select
                id="warehouseId"
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
              >
                <option value="all">All Warehouses</option>
                {warehouses.map((wh) => {
                  const wId = String(wh.id ?? wh.warehouseId ?? wh.WarehouseId ?? '')
                  const wName = wh.name ?? wh.warehouseName ?? wh.Name ?? `Warehouse #${wId}`
                  return (
                    <option key={wId} value={wId}>
                      {wName}
                    </option>
                  )
                })}
              </select>
            </div>

            {/* Invoice Field (Loaded from Backend for selected Customer) */}
            <div className="form-field">
              <label htmlFor="invoiceId">
                Invoice <span className="required-star">*</span>
              </label>
              <select
                id="invoiceId"
                value={invoiceId}
                onChange={handleInvoiceChange}
                disabled={!customerId || loadingInvoices}
                className={validationErrors.invoiceId ? 'input-error' : ''}
              >
                <option value="">
                  {!customerId
                    ? '-- Select Customer First --'
                    : loadingInvoices
                    ? 'Loading invoices...'
                    : availableInvoices.length === 0
                    ? 'No Invoices available for customer'
                    : '-- Select Invoice --'}
                </option>
                {availableInvoices.map((inv) => {
                  const iId = String(inv.id ?? inv.invoiceId ?? inv.invoice_id)
                  const iNum = inv.invoiceNumber || inv.invoiceNo || inv.number || `INV-${String(iId).padStart(6, '0')}`
                  const iDate = inv.invoiceDate || inv.date ? ` (${String(inv.invoiceDate || inv.date).slice(0, 10)})` : ''
                  const iTotal = inv.totalAmount !== undefined ? ` - ${formatCurrency(inv.totalAmount)}` : ''
                  return (
                    <option key={iId} value={iId}>
                      {iNum}{iDate}{iTotal}
                    </option>
                  )
                })}
              </select>
              {validationErrors.invoiceId && (
                <span className="field-error">{validationErrors.invoiceId}</span>
              )}
              {!customerId && (
                <span className="field-hint">Select a customer to load matching invoices.</span>
              )}
            </div>

            {/* Return Date Field */}
            <div className="form-field">
              <label htmlFor="returnDate">
                Return Date <span className="required-star">*</span>
              </label>
              <input
                id="returnDate"
                type="date"
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                className={validationErrors.returnDate ? 'input-error' : ''}
              />
              {validationErrors.returnDate && (
                <span className="field-error">{validationErrors.returnDate}</span>
              )}
            </div>

            {/* Reason Field (Mandatory) */}
            <div className="form-field">
              <label htmlFor="reason">
                Reason for Return <span className="required-star">*</span>
              </label>
              <input
                id="reason"
                type="text"
                placeholder="Enter mandatory details explaining why items are being returned..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className={validationErrors.reason ? 'input-error' : ''}
              />
              {validationErrors.reason && (
                <span className="field-error">{validationErrors.reason}</span>
              )}
            </div>
          </div>
        </section>

        {/* Return Items Card */}
        <section className="card form-section-card">
          <div className="section-header-row">
            <h3 className="section-title">Returned Items</h3>
          </div>

          {validationErrors.items && (
            <div className="form-global-error">
              <AlertCircle size={15} /> {validationErrors.items}
            </div>
          )}

          {loadingItems ? (
            <StateBlock state="loading" message="Loading invoice line items..." />
          ) : items.length === 0 ? (
            <div className="empty-items-notice" style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
              {invoiceId
                ? 'No line items available for the selected invoice.'
                : 'Select an Invoice above to automatically populate returnable items.'}
            </div>
          ) : (
            <div className="items-table-container">
              <table className="items-table">
                <thead>
                  <tr>
                    <th style={{ width: '30%' }}>Product *</th>
                    <th style={{ width: '20%' }}>Variant</th>
                    <th style={{ width: '15%' }}>Invoiced Qty</th>
                    <th style={{ width: '15%' }}>Returnable Qty</th>
                    <th style={{ width: '15%' }}>Return Qty *</th>
                    <th style={{ width: '15%' }}>Price *</th>
                    <th style={{ width: '15%' }} className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => {
                    const itemErr = validationErrors.itemErrors?.[index] || {}
                    const lineTotal = (Number(item.returnQuantity) || 0) * (Number(item.price) || 0)

                    return (
                      <tr key={item.id}>
                        {/* Product Name */}
                        <td className="font-semibold">
                          {item.productName || `Product #${item.productId}`}
                        </td>

                        {/* Variant Name */}
                        <td>
                          {item.variantName || (item.variantId ? `Variant #${item.variantId}` : '-')}
                        </td>

                        {/* Invoiced Quantity */}
                        <td>
                          <input
                            type="number"
                            readOnly
                            value={item.invoicedQuantity}
                            className="input-readonly"
                            style={{ backgroundColor: '#f8fafc', color: '#64748b' }}
                          />
                        </td>

                        {/* Returnable Quantity */}
                        <td>
                          <input
                            type="number"
                            readOnly
                            value={item.remainingReturnableQuantity}
                            className="input-readonly"
                            style={{ backgroundColor: '#f8fafc', color: '#64748b', fontWeight: 600 }}
                          />
                        </td>

                        {/* Return Quantity */}
                        <td>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max={item.remainingReturnableQuantity}
                            placeholder="0.00"
                            value={item.returnQuantity}
                            onChange={(e) => handleItemQuantityChange(index, e.target.value)}
                            className={itemErr.returnQuantity ? 'input-error' : ''}
                          />
                          {itemErr.returnQuantity && (
                            <span className="field-error">{itemErr.returnQuantity}</span>
                          )}
                        </td>

                        {/* Price (Decimal) */}
                        <td>
                          <input
                            type="number"
                            step="0.01"
                            readOnly
                            value={item.price}
                            className="input-readonly"
                            style={{ backgroundColor: '#f8fafc', color: '#64748b' }}
                          />
                        </td>

                        {/* Calculated Total */}
                        <td className="text-right font-semibold">
                          {formatCurrency(lineTotal)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Total Amount Footer */}
          {items.length > 0 && (
            <div className="return-totals-summary">
              <div className="total-amount-box">
                <span className="total-label">Total Return Amount:</span>
                <span className="total-value">{formatCurrency(totalReturnAmount)}</span>
              </div>
            </div>
          )}
        </section>

        {/* Submit Actions */}
        <div className="form-submit-bar">
          <button
            type="button"
            className="erp-button erp-button--secondary"
            onClick={() => navigate('/pos/returns')}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="erp-button erp-button--primary"
            disabled={submitting || loadingItems}
          >
            <Save size={15} /> {submitting ? 'Saving...' : isEditMode ? 'Update Return' : 'Save Return'}
          </button>
        </div>
      </form>
    </main>
  )
}
