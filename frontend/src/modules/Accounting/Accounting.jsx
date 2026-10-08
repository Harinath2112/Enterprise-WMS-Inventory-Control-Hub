import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Boxes,
  CalendarDays,
  DollarSign,
  FileText,
  RotateCcw,
  Save,
  Truck,
  User,
  Warehouse,
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import CurrencyInput from '../../components/CurrencyInput'
import NumberInput from '../../components/NumberInput'
import QuantityInput from '../../components/QuantityInput'
import SearchableSelect from '../../components/SearchableSelect'
import SelectWithAdd from '../../components/SelectWithAdd'
import { DataTable, StatisticsCard, StatusBadge } from '../../components/erp'
import AccountingHeader from './components/AccountingHeader'
import {
  createId,
  formatCurrency,
  formatDate,
  getNumberError,
  getRequiredError,
  getToday,
} from '../../utils/helpers'
import './Accounting.css'

const ACCOUNTING_META_STORAGE_KEY = 'ims-accounting-invoice-meta'
const ACCOUNTING_META_EVENT = 'ims:accounting-meta-updated'

function readStorageValue(key, fallbackValue) {
  if (typeof window === 'undefined') {
    return fallbackValue
  }

  try {
    const rawValue = window.localStorage.getItem(key)
    return rawValue ? JSON.parse(rawValue) : fallbackValue
  } catch {
    return fallbackValue
  }
}

function writeStorageValue(key, value) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Ignore persistence failures and keep the UI interactive.
  }
}

function toNumber(value) {
  const parsedValue = Number(value)
  return Number.isFinite(parsedValue) ? parsedValue : 0
}

function addDays(dateValue, days) {
  const parsedDate = new Date(`${dateValue}T00:00:00`)

  if (Number.isNaN(parsedDate.getTime())) {
    return getToday()
  }

  parsedDate.setDate(parsedDate.getDate() + days)
  return parsedDate.toISOString().slice(0, 10)
}

function getPaymentStatus(paidAmount, finalTotal) {
  if (paidAmount <= 0 || finalTotal <= 0) {
    return 'Pending'
  }

  if (paidAmount >= finalTotal) {
    return 'Paid'
  }

  return 'Partial'
}

function buildInvoiceCalculations(amountValue, gstRateValue, paidAmountValue) {
  const baseAmount = Math.max(toNumber(amountValue), 0)
  const gstRate = Math.max(toNumber(gstRateValue), 0)
  const gstAmount = (baseAmount * gstRate) / 100
  const cgstAmount = gstAmount / 2
  const sgstAmount = gstAmount / 2
  const finalTotal = baseAmount + gstAmount
  const paidAmount = Math.min(Math.max(toNumber(paidAmountValue), 0), finalTotal)
  const balanceAmount = Math.max(finalTotal - paidAmount, 0)

  return {
    baseAmount,
    gstRate,
    gstAmount,
    cgstAmount,
    sgstAmount,
    finalTotal,
    paidAmount,
    balanceAmount,
    paymentStatus: getPaymentStatus(paidAmount, finalTotal),
  }
}

function buildDefaultInvoiceMeta(invoice) {
  const calculations = buildInvoiceCalculations(invoice.amount, 0, 0)

  return {
    ...calculations,
    dueDate: addDays(invoice.date, 7),
    paymentHistory: [],
  }
}

function buildMetaFromForm(formData) {
  const calculations = buildInvoiceCalculations(
    formData.amount,
    formData.gstRate,
    formData.paidAmount,
  )

  return {
    ...calculations,
    dueDate: formData.dueDate,
    paymentHistory:
      calculations.paidAmount > 0
        ? [
            {
              id: createId('PMT'),
              date: formData.paymentDate,
              amount: calculations.paidAmount,
            },
          ]
        : [],
  }
}

function createInitialForm() {
  const today = getToday()

  return {
    invoiceType: 'Sales',
    partyId: '',
    productId: '',
    warehouseId: '',
    quantity: '',
    amount: '',
    gstRate: '18',
    paidAmount: '0',
    paymentDate: today,
    date: today,
    dueDate: addDays(today, 7),
  }
}

function matchesSubmittedInvoice(invoice, signature) {
  return (
    invoice.invoiceType === signature.invoiceType &&
    invoice.partyId === signature.partyId &&
    invoice.productId === signature.productId &&
    invoice.warehouseId === signature.warehouseId &&
    Number(invoice.quantity) === Number(signature.quantity) &&
    Number(invoice.amount) === Number(signature.amount) &&
    invoice.date === signature.date
  )
}

function resolveInvoiceView(invoice, metaEntry) {
  const baseMeta = metaEntry ?? buildDefaultInvoiceMeta(invoice)

  return {
    ...invoice,
    ...baseMeta,
    documentStatus: invoice.status,
    paymentHistory: Array.isArray(baseMeta.paymentHistory)
      ? baseMeta.paymentHistory
      : [],
  }
}

function MetricCard({ icon: Icon, label, value, helper }) {
  return (
    <StatisticsCard
      icon={Icon}
      label={label}
      value={value}
      helper={helper}
      className="accounting-page__metric-card"
    />
  )
}

function PaymentStatusBadge({ status }) {
  return <StatusBadge status={status} />
}

function SummaryRow({ label, value, strong = false }) {
  return (
    <div className={`accounting-page__summary-row ${strong ? 'is-strong' : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

export default function Accounting({
  invoices,
  products,
  suppliers,
  customers,
  warehouses,
  onSaveInvoice,
  onQuickAddSupplier,
  onQuickAddCustomer,
  onQuickAddProduct,
  onQuickAddWarehouse,
}) {
  const { hasPermission } = useAuth()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [formData, setFormData] = useState(() => createInitialForm())
  const [touched, setTouched] = useState({})
  const [message, setMessage] = useState(null)
  const [invoiceMeta, setInvoiceMeta] = useState(() =>
    readStorageValue(ACCOUNTING_META_STORAGE_KEY, {}),
  )
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('')
  const [paymentDraft, setPaymentDraft] = useState({
    amount: '',
    date: getToday(),
  })
  const lastSubmittedInvoiceRef = useRef(null)
  const canCreate = hasPermission('accounting', 'create')

  const isSalesInvoice = formData.invoiceType === 'Sales'
  const partyOptions = isSalesInvoice ? customers : suppliers
  const partyIcon = isSalesInvoice ? User : Truck
  const partyLabel = isSalesInvoice ? 'Customer' : 'Supplier'
  const partyAddTitle = isSalesInvoice ? 'Add Customer' : 'Add Supplier'

  const formCalculations = useMemo(
    () =>
      buildInvoiceCalculations(formData.amount, formData.gstRate, formData.paidAmount),
    [formData.amount, formData.gstRate, formData.paidAmount],
  )

  const errors = {
    partyId: getRequiredError(formData.partyId, partyLabel),
    productId: getRequiredError(formData.productId, 'Product'),
    warehouseId: getRequiredError(formData.warehouseId, 'Warehouse'),
    quantity: getNumberError(formData.quantity, 'Quantity', { allowZero: false }),
    amount: getNumberError(formData.amount, 'Amount', { allowZero: false }),
    gstRate:
      getNumberError(formData.gstRate, 'GST %', { min: 0 }) ||
      (toNumber(formData.gstRate) > 100 ? 'GST % must be 100 or less.' : ''),
    paidAmount:
      getNumberError(formData.paidAmount, 'Paid amount', { min: 0 }) ||
      (toNumber(formData.paidAmount) > formCalculations.finalTotal
        ? 'Paid amount cannot exceed the final total.'
        : ''),
    paymentDate:
      formCalculations.paidAmount > 0
        ? getRequiredError(formData.paymentDate, 'Payment date')
        : '',
    date: getRequiredError(formData.date, 'Invoice date'),
    dueDate: getRequiredError(formData.dueDate, 'Due date'),
  }

  const isFormValid = Object.values(errors).every((value) => !value)

  useEffect(() => {
    setInvoiceMeta((currentValue) => {
      const nextValue = { ...currentValue }
      let hasChanges = false

      if (lastSubmittedInvoiceRef.current) {
        const matchedInvoice = invoices.find(
          (invoice) =>
            !nextValue[invoice.id] &&
            matchesSubmittedInvoice(invoice, lastSubmittedInvoiceRef.current.signature),
        )

        if (matchedInvoice) {
          nextValue[matchedInvoice.id] = lastSubmittedInvoiceRef.current.meta
          lastSubmittedInvoiceRef.current = null
          hasChanges = true
        }
      }

      invoices.forEach((invoice) => {
        if (!nextValue[invoice.id]) {
          nextValue[invoice.id] = buildDefaultInvoiceMeta(invoice)
          hasChanges = true
        }
      })

      return hasChanges ? nextValue : currentValue
    })
  }, [invoices])

  useEffect(() => {
    writeStorageValue(ACCOUNTING_META_STORAGE_KEY, invoiceMeta)

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(ACCOUNTING_META_EVENT))
    }
  }, [invoiceMeta])

  const enrichedInvoices = useMemo(
    () => invoices.map((invoice) => resolveInvoiceView(invoice, invoiceMeta[invoice.id])),
    [invoiceMeta, invoices],
  )

  useEffect(() => {
    if (enrichedInvoices.length === 0) {
      setSelectedInvoiceId('')
      return
    }

    setSelectedInvoiceId((currentValue) =>
      enrichedInvoices.some((invoice) => invoice.id === currentValue)
        ? currentValue
        : enrichedInvoices[0].id,
    )
  }, [enrichedInvoices])

  const selectedInvoice =
    enrichedInvoices.find((invoice) => invoice.id === selectedInvoiceId) ?? null

  useEffect(() => {
    setPaymentDraft({
      amount: '',
      date: getToday(),
    })
  }, [selectedInvoiceId])

  const summary = useMemo(
    () => ({
      invoiceValue: enrichedInvoices.reduce(
        (total, invoice) => total + Number(invoice.finalTotal || 0),
        0,
      ),
      totalTax: enrichedInvoices.reduce(
        (total, invoice) => total + Number(invoice.gstAmount || 0),
        0,
      ),
      outstanding: enrichedInvoices.reduce(
        (total, invoice) => total + Number(invoice.balanceAmount || 0),
        0,
      ),
      paidInvoices: enrichedInvoices.filter(
        (invoice) => invoice.paymentStatus === 'Paid',
      ).length,
    }),
    [enrichedInvoices],
  )

  function handleChange(event) {
    const { name, value } = event.target

    setFormData((currentValue) => {
      const nextValue = {
        ...currentValue,
        [name]: value,
        ...(name === 'invoiceType' ? { partyId: '' } : {}),
      }

      if (
        name === 'date' &&
        (!currentValue.dueDate || currentValue.dueDate === addDays(currentValue.date, 7))
      ) {
        nextValue.dueDate = addDays(value, 7)
      }

      return nextValue
    })
  }

  function handleBlur(event) {
    const { name } = event.target
    setTouched((currentValue) => ({ ...currentValue, [name]: true }))
  }

  function handlePaymentDraftChange(event) {
    const { name, value } = event.target
    setPaymentDraft((currentValue) => ({
      ...currentValue,
      [name]: value,
    }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    setTouched({
      partyId: true,
      productId: true,
      warehouseId: true,
      quantity: true,
      amount: true,
      gstRate: true,
      paidAmount: true,
      paymentDate: true,
      date: true,
      dueDate: true,
    })

    if (!isFormValid) {
      return
    }

    const meta = buildMetaFromForm(formData)
    const payload = {
      ...formData,
      amount: meta.finalTotal,
    }

    const result = onSaveInvoice(payload)
    setMessage(result)

    if (result.success) {
      lastSubmittedInvoiceRef.current = {
        signature: {
          invoiceType: formData.invoiceType,
          partyId: formData.partyId,
          productId: formData.productId,
          warehouseId: formData.warehouseId,
          quantity: toNumber(formData.quantity),
          amount: meta.finalTotal,
          date: formData.date,
        },
        meta,
      }

      setFormData(createInitialForm())
      setTouched({})
      setIsFormOpen(false)
    }
  }

  function handleQuickAddParty(values) {
    const result = isSalesInvoice
      ? onQuickAddCustomer(values)
      : onQuickAddSupplier(values)

    setMessage(result)
    return result.success ? result.item : null
  }

  function handleQuickAddProduct(values) {
    const result = onQuickAddProduct({
      ...values,
      warehouseId: formData.warehouseId,
      supplierId: isSalesInvoice ? '' : formData.partyId,
    })
    setMessage(result)
    return result.success ? result.item : null
  }

  function handleQuickAddWarehouse(values) {
    const result = onQuickAddWarehouse(values)
    setMessage(result)
    return result.success ? result.item : null
  }

  function handleRecordPayment(event) {
    event.preventDefault()

    if (!selectedInvoice) {
      return
    }

    const paymentAmount = toNumber(paymentDraft.amount)

    if (!String(paymentDraft.amount ?? '').trim()) {
      setMessage({ success: false, message: 'Payment amount is required.' })
      return
    }

    if (paymentAmount <= 0) {
      setMessage({
        success: false,
        message: 'Payment amount must be greater than 0.',
      })
      return
    }

    if (!paymentDraft.date) {
      setMessage({ success: false, message: 'Payment date is required.' })
      return
    }

    if (paymentAmount > selectedInvoice.balanceAmount) {
      setMessage({
        success: false,
        message: 'Payment amount cannot exceed the current balance.',
      })
      return
    }

    setInvoiceMeta((currentValue) => {
      const nextPaidAmount = selectedInvoice.paidAmount + paymentAmount
      const nextBalanceAmount = Math.max(
        selectedInvoice.finalTotal - nextPaidAmount,
        0,
      )

      return {
        ...currentValue,
        [selectedInvoice.id]: {
          baseAmount: selectedInvoice.baseAmount,
          gstRate: selectedInvoice.gstRate,
          gstAmount: selectedInvoice.gstAmount,
          cgstAmount: selectedInvoice.cgstAmount,
          sgstAmount: selectedInvoice.sgstAmount,
          finalTotal: selectedInvoice.finalTotal,
          dueDate: selectedInvoice.dueDate,
          paidAmount: nextPaidAmount,
          balanceAmount: nextBalanceAmount,
          paymentStatus: getPaymentStatus(
            nextPaidAmount,
            selectedInvoice.finalTotal,
          ),
          paymentHistory: [
            {
              id: createId('PMT'),
              date: paymentDraft.date,
              amount: paymentAmount,
            },
            ...selectedInvoice.paymentHistory,
          ],
        },
      }
    })

    setPaymentDraft({
      amount: '',
      date: getToday(),
    })

    setMessage({
      success: true,
      message: `Payment of ${formatCurrency(paymentAmount)} recorded for ${selectedInvoice.invoiceNo}.`,
    })
  }

  const paymentHistoryColumns = [
    {
      key: 'date',
      label: 'Date',
      sortable: true,
      render: (entry) => formatDate(entry.date),
    },
    {
      key: 'amount',
      label: 'Amount Paid',
      sortable: true,
      sortValue: (entry) => Number(entry.amount || 0),
      render: (entry) => formatCurrency(entry.amount),
    },
  ]

  const invoiceRegisterColumns = [
    { key: 'invoiceNo', label: 'Invoice No', sortable: true, mobilePrimary: true },
    { key: 'invoiceType', label: 'Type', sortable: true },
    { key: 'partyName', label: 'Party', sortable: true },
    {
      key: 'baseAmount',
      label: 'Base Amount',
      sortable: true,
      sortValue: (invoice) => Number(invoice.baseAmount || 0),
      render: (invoice) => formatCurrency(invoice.baseAmount),
    },
    {
      key: 'gstAmount',
      label: 'GST',
      sortable: true,
      sortValue: (invoice) => Number(invoice.gstAmount || 0),
      render: (invoice) => formatCurrency(invoice.gstAmount),
    },
    {
      key: 'finalTotal',
      label: 'Final Total',
      sortable: true,
      sortValue: (invoice) => Number(invoice.finalTotal || 0),
      render: (invoice) => formatCurrency(invoice.finalTotal),
    },
    {
      key: 'paidAmount',
      label: 'Paid',
      sortable: true,
      sortValue: (invoice) => Number(invoice.paidAmount || 0),
      render: (invoice) => formatCurrency(invoice.paidAmount),
    },
    {
      key: 'balanceAmount',
      label: 'Balance',
      sortable: true,
      sortValue: (invoice) => Number(invoice.balanceAmount || 0),
      render: (invoice) => formatCurrency(invoice.balanceAmount),
    },
    {
      key: 'dueDate',
      label: 'Due Date',
      sortable: true,
      render: (invoice) => formatDate(invoice.dueDate),
    },
    {
      key: 'paymentStatus',
      label: 'Payment Status',
      sortable: true,
      mobileStatus: true,
      render: (invoice) => <PaymentStatusBadge status={invoice.paymentStatus} />,
    },
  ]

  return (
    <div className="page accounting-page">
      <AccountingHeader
        canCreate={canCreate}
        onToggleForm={() => setIsFormOpen((currentValue) => !currentValue)}
      />

      {message ? (
        <div
          className={`message-box ${
            message.success ? 'message-box--success' : 'message-box--error'
          }`}
        >
          {message.message}
        </div>
      ) : null}

      <div className="accounting-page__metrics-grid">
        <MetricCard
          icon={FileText}
          label="Invoice Value"
          value={formatCurrency(summary.invoiceValue)}
          helper="Combined final totals including GST."
        />
        <MetricCard
          icon={DollarSign}
          label="Outstanding"
          value={formatCurrency(summary.outstanding)}
          helper="Balance amount still pending collection."
        />
        <MetricCard
          icon={AlertTriangle}
          label="GST Collected"
          value={formatCurrency(summary.totalTax)}
          helper="Current GST amount across the register."
        />
        <MetricCard
          icon={CalendarDays}
          label="Paid In Full"
          value={summary.paidInvoices}
          helper="Invoices with zero remaining balance."
        />
      </div>

      {isFormOpen ? (
        <div className="card accounting-page__form-card">
          <div className="accounting-page__section-heading">
            <div>
              <h2 className="section-title">Invoice Form</h2>
              <p className="helper-text">
                Create invoices with GST handling, due dates, and opening payment
                entries in one step.
              </p>
            </div>
          </div>

          <form
            className="form-grid accounting-page__form-grid"
            onSubmit={handleSubmit}
            autoComplete="off"
          >
            <SearchableSelect
              id="invoice-type"
              name="invoiceType"
              label="Invoice Type"
              icon={Save}
              value={formData.invoiceType}
              onChange={handleChange}
              onBlur={handleBlur}
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
              onChange={handleChange}
              onBlur={handleBlur}
              options={partyOptions}
              placeholder={`Select ${partyLabel.toLowerCase()}`}
              error={errors.partyId}
              showError={touched.partyId}
              onAddOption={handleQuickAddParty}
              addLabel="+ Add"
              addTitle={partyAddTitle}
              addFields={[
                {
                  name: 'name',
                  label: `${partyLabel} Name`,
                  placeholder: `Enter ${partyLabel.toLowerCase()} name`,
                },
              ]}
            />

            <SelectWithAdd
              id="invoice-product"
              name="productId"
              label="Product"
              icon={Boxes}
              value={formData.productId}
              onChange={handleChange}
              onBlur={handleBlur}
              options={products}
              placeholder="Select product"
              error={errors.productId}
              showError={touched.productId}
              onAddOption={handleQuickAddProduct}
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

            <SelectWithAdd
              id="invoice-warehouse"
              name="warehouseId"
              label="Warehouse"
              icon={Warehouse}
              value={formData.warehouseId}
              onChange={handleChange}
              onBlur={handleBlur}
              options={warehouses}
              placeholder="Select warehouse"
              error={errors.warehouseId}
              showError={touched.warehouseId}
              onAddOption={handleQuickAddWarehouse}
              addLabel="+ Add"
              addTitle="Add Warehouse"
              addFields={[
                {
                  name: 'name',
                  label: 'Warehouse Name',
                  placeholder: 'Enter warehouse name',
                },
              ]}
            />

            <QuantityInput
              id="invoice-quantity"
              name="quantity"
              label="Quantity"
              icon={Boxes}
              value={formData.quantity}
              onChange={handleChange}
              onBlur={handleBlur}
              error={touched.quantity ? errors.quantity : ''}
            />

            <CurrencyInput
              id="invoice-amount"
              name="amount"
              label="Base Amount"
              icon={DollarSign}
              value={formData.amount}
              onChange={handleChange}
              onBlur={handleBlur}
              error={touched.amount ? errors.amount : ''}
            />

            <NumberInput
              id="invoice-gst-rate"
              name="gstRate"
              label="GST %"
              icon={DollarSign}
              value={formData.gstRate}
              onChange={handleChange}
              onBlur={handleBlur}
              error={touched.gstRate ? errors.gstRate : ''}
            />

            <CurrencyInput
              id="invoice-paid-amount"
              name="paidAmount"
              label="Paid Amount"
              icon={DollarSign}
              value={formData.paidAmount}
              onChange={handleChange}
              onBlur={handleBlur}
              error={touched.paidAmount ? errors.paidAmount : ''}
            />

            <div className="field">
              <label htmlFor="invoice-date">Invoice Date</label>
              <div className="input-with-icon">
                <CalendarDays size={16} />
                <input
                  id="invoice-date"
                  name="date"
                  type="date"
                  value={formData.date}
                  onChange={handleChange}
                  onBlur={handleBlur}
                />
              </div>
              {touched.date && errors.date ? (
                <span className="field-error">{errors.date}</span>
              ) : null}
            </div>

            <div className="field">
              <label htmlFor="invoice-due-date">Due Date</label>
              <div className="input-with-icon">
                <CalendarDays size={16} />
                <input
                  id="invoice-due-date"
                  name="dueDate"
                  type="date"
                  value={formData.dueDate}
                  onChange={handleChange}
                  onBlur={handleBlur}
                />
              </div>
              {touched.dueDate && errors.dueDate ? (
                <span className="field-error">{errors.dueDate}</span>
              ) : null}
            </div>

            <div className="field">
              <label htmlFor="invoice-payment-date">Payment Date</label>
              <div className="input-with-icon">
                <CalendarDays size={16} />
                <input
                  id="invoice-payment-date"
                  name="paymentDate"
                  type="date"
                  value={formData.paymentDate}
                  onChange={handleChange}
                  onBlur={handleBlur}
                />
              </div>
              {touched.paymentDate && errors.paymentDate ? (
                <span className="field-error">{errors.paymentDate}</span>
              ) : null}
            </div>

            <div className="accounting-page__summary-panel">
              <h3>Tax Summary</h3>
              <SummaryRow
                label="Base Amount"
                value={formatCurrency(formCalculations.baseAmount)}
              />
              <SummaryRow label="GST %" value={`${formCalculations.gstRate}%`} />
              <SummaryRow
                label="CGST"
                value={formatCurrency(formCalculations.cgstAmount)}
              />
              <SummaryRow
                label="SGST"
                value={formatCurrency(formCalculations.sgstAmount)}
              />
              <SummaryRow
                label="Final Total"
                value={formatCurrency(formCalculations.finalTotal)}
                strong
              />
            </div>

            <div className="accounting-page__summary-panel accounting-page__summary-panel--payment">
              <h3>Payment Preview</h3>
              <SummaryRow
                label="Paid Amount"
                value={formatCurrency(formCalculations.paidAmount)}
              />
              <SummaryRow
                label="Balance Amount"
                value={formatCurrency(formCalculations.balanceAmount)}
              />
              <SummaryRow
                label="Payment Status"
                value={formCalculations.paymentStatus}
                strong
              />
            </div>

            <div className="button-row accounting-page__form-actions">
              <button
                type="submit"
                className="button button-primary"
                disabled={!isFormValid}
              >
                <Save size={16} />
                Save Invoice
              </button>
              <button
                type="button"
                className="button"
                onClick={() => {
                  setFormData(createInitialForm())
                  setTouched({})
                  setIsFormOpen(false)
                }}
              >
                <RotateCcw size={16} />
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <div className="accounting-page__content-grid">
        <div className="card accounting-page__payment-card">
          <div className="accounting-page__section-heading">
            <div>
              <h2 className="section-title">Payment Tracking</h2>
              <p className="helper-text">
                Select an invoice to review GST details, current balance, and
                payment history.
              </p>
            </div>
          </div>

          {selectedInvoice ? (
            <>
              <div className="accounting-page__selected-top">
                <div>
                  <h3>{selectedInvoice.invoiceNo}</h3>
                  <p>
                    {selectedInvoice.partyName} • {selectedInvoice.invoiceType}
                  </p>
                </div>
                <PaymentStatusBadge status={selectedInvoice.paymentStatus} />
              </div>

              <div className="accounting-page__detail-grid">
                <div>
                  <span>Final Total</span>
                  <strong>{formatCurrency(selectedInvoice.finalTotal)}</strong>
                </div>
                <div>
                  <span>Paid Amount</span>
                  <strong>{formatCurrency(selectedInvoice.paidAmount)}</strong>
                </div>
                <div>
                  <span>Balance</span>
                  <strong>{formatCurrency(selectedInvoice.balanceAmount)}</strong>
                </div>
                <div>
                  <span>Due Date</span>
                  <strong>{formatDate(selectedInvoice.dueDate)}</strong>
                </div>
              </div>

              <div className="accounting-page__summary-panel accounting-page__summary-panel--compact">
                <h3>GST Breakdown</h3>
                <SummaryRow
                  label="Base Amount"
                  value={formatCurrency(selectedInvoice.baseAmount)}
                />
                <SummaryRow label="GST %" value={`${selectedInvoice.gstRate}%`} />
                <SummaryRow
                  label="CGST"
                  value={formatCurrency(selectedInvoice.cgstAmount)}
                />
                <SummaryRow
                  label="SGST"
                  value={formatCurrency(selectedInvoice.sgstAmount)}
                />
              </div>

              <form
                className="accounting-page__payment-form"
                onSubmit={handleRecordPayment}
              >
                <CurrencyInput
                  id="payment-amount"
                  name="amount"
                  label="Payment Amount"
                  icon={DollarSign}
                  value={paymentDraft.amount}
                  onChange={handlePaymentDraftChange}
                />

                <div className="field">
                  <label htmlFor="payment-date">Payment Date</label>
                  <div className="input-with-icon">
                    <CalendarDays size={16} />
                    <input
                      id="payment-date"
                      name="date"
                      type="date"
                      value={paymentDraft.date}
                      onChange={handlePaymentDraftChange}
                    />
                  </div>
                </div>

                <div className="button-row">
                  <button
                    type="submit"
                    className="button button-primary"
                    disabled={selectedInvoice.balanceAmount === 0}
                  >
                    <Save size={16} />
                    {selectedInvoice.balanceAmount === 0 ? 'Fully Paid' : 'Record Payment'}
                  </button>
                </div>
              </form>

              <div className="accounting-page__history-panel">
                <h3>Payment History</h3>

                <DataTable
                  className="accounting-page__history-table"
                  rows={selectedInvoice.paymentHistory}
                  columns={paymentHistoryColumns}
                  showSearch={false}
                  defaultPageSize={8}
                  defaultSortKey="date"
                  defaultSortDirection="desc"
                  emptyMessage="No payment history recorded yet."
                />
              </div>
            </>
          ) : (
            <div className="accounting-page__empty-state">
              <FileText size={20} />
              <p>No invoices available for payment tracking.</p>
            </div>
          )}
        </div>

        <div className="card accounting-page__register-card">
          <div className="accounting-page__section-heading">
            <div>
              <h2 className="section-title">Invoice Register</h2>
              <p className="helper-text">
                Review invoice totals, due dates, and payment status in one table.
              </p>
            </div>
          </div>

          <DataTable
            className="accounting-page__register-table"
            rows={enrichedInvoices}
            columns={invoiceRegisterColumns}
            showSearch={false}
            defaultPageSize={8}
            defaultSortKey="dueDate"
            defaultSortDirection="asc"
            emptyMessage="No invoices available."
            rowClassName={(invoice) =>
              invoice.id === selectedInvoiceId
                ? 'accounting-page__register-row is-selected'
                : 'accounting-page__register-row'
            }
            onRowClick={(invoice) => setSelectedInvoiceId(invoice.id)}
          />
        </div>
      </div>
    </div>
  )
}
