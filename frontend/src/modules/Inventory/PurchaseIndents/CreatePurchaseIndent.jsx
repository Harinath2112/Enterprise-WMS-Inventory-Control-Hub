import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Plus,
  Trash2,
  LoaderCircle,
} from 'lucide-react'
import {
  createPurchaseIndent,
  getPurchaseIndent,
  getPurchaseIndents,
  updatePurchaseIndent,
} from '../../../api/purchaseIndentsApi'
import { apiRequest, IMS_DATA_MUTATION_EVENT } from '../../../api/apiClient'
import { getSuppliers } from '../../../api/suppliersApi'
import { showToast } from '../../../components/common/toast'
import SearchableSelect from '../../../components/SearchableSelect'
import DatePicker from '../../../components/DatePicker'
import { addDaysToDate, compareDateOnly, getLogicalRequiredDate, getToday } from '../../../utils/helpers'
import './PurchaseIndents.css'

const defaultItem = {
  productId: '',
  description: '',
  hsn: '',
  uom: '',
  quantity: '1',
  unitPrice: '0',
  discount: '0',
  tax: '18',
  requiredDate: '',
  remarks: '',
}



const DEFAULT_UNIT_ID = 1

function getProductUnitId(product) {
  const unitValue = product?.unitId ?? product?.UnitId ?? product?.uomId ?? product?.UomId
  const nestedUnitId = product?.unit?.unitId ?? product?.unit?.id ?? product?.Unit?.UnitId ?? product?.Unit?.Id
  const resolvedValue = unitValue ?? nestedUnitId
  const numericValue = Number(resolvedValue)

  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : DEFAULT_UNIT_ID
}

const departmentOptions = [
  { id: 1, value: 'Production', label: 'Production' },
  { id: 2, value: 'Inventory', label: 'Inventory' },
  { id: 3, value: 'Sales', label: 'Sales' },
  { id: 4, value: 'Purchase', label: 'Purchase' },
  { id: 5, value: 'Finance', label: 'Finance' },
  { id: 6, value: 'Admin', label: 'Admin' },
]

const priorityOptions = [
  { value: 'Low', label: 'Low' },
  { value: 'Medium', label: 'Medium' },
  { value: 'High', label: 'High' },
]

const ROLE_SEED_USER_NAMES = new Set(['Admin', 'Manager', 'Staff'])
let cachedPurchaseIndentUsers = null
let pendingPurchaseIndentUsersRequest = null

function getListData(data) {
  if (Array.isArray(data)) {
    return data
  }

  if (Array.isArray(data?.data)) {
    return data.data
  }

  if (Array.isArray(data?.users)) {
    return data.users
  }

  if (Array.isArray(data?.items)) {
    return data.items
  }

  if (Array.isArray(data?.results)) {
    return data.results
  }

  return []
}

function isRoleSeedUser(user) {
  const name = String(user?.name || user?.Name || user?.fullName || user?.FullName || '').trim()
  const email = String(user?.email || user?.Email || '').trim().toLowerCase()
  const role = String(user?.role || user?.Role || '').trim()

  return ROLE_SEED_USER_NAMES.has(name) && ROLE_SEED_USER_NAMES.has(role) && email.endsWith('@test.com')
}

function normalizeUserList(data) {
  return getListData(data).filter((user) => user && getUserId(user) && !isRoleSeedUser(user))
}

async function loadPurchaseIndentUsers() {
  if (cachedPurchaseIndentUsers) {
    return cachedPurchaseIndentUsers
  }

  if (!pendingPurchaseIndentUsersRequest) {
    pendingPurchaseIndentUsersRequest = apiRequest('/Users')
      .then((response) => {
        const users = response.success ? normalizeUserList(response.data) : []
        cachedPurchaseIndentUsers = users
        return users
      })
      .finally(() => {
        pendingPurchaseIndentUsersRequest = null
      })
  }

  return pendingPurchaseIndentUsersRequest
}

function generateIndentNumber(indents = []) {
  const today = new Date()
  const yyyy = today.getFullYear()
  const mm = String(today.getMonth() + 1).padStart(2, '0')
  const dd = String(today.getDate()).padStart(2, '0')
  const dateString = `${yyyy}${mm}${dd}`

  const prefix = `IND-${dateString}-`

  let maxSeq = 0
  indents.forEach((ind) => {
    const num = ind.indentNumber || ind.indentNo || ''
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

function buildInitialDraft(initialIndentNo) {
  const today = getToday()
  const defaultRequiredDate = addDaysToDate(today, 7)
  return {
    vendorId: '',
    indentNo: initialIndentNo || generateIndentNumber([]),
    indentDate: today,
    expectedDeliveryDate: defaultRequiredDate, // Required Date (7 days lead time)
    requestedBy: '',
    department: 'Production',
    priority: 'Medium',
    approvedBy: '',
    paymentTerms: 'Net 15 Days',
    currency: 'INR - Indian Rupee',
    reference: '',
    paidAmount: '',
    remarks: '',
    items: [{ ...defaultItem, requiredDate: defaultRequiredDate, remarks: '' }],
  }
}

function toDateInput(value) {
  return value ? String(value).slice(0, 10) : getToday()
}

function buildDraftFromIndent(indent, initialIndentNo) {
  const baseDraft = buildInitialDraft(initialIndentNo)
  const items = Array.isArray(indent?.items) && indent.items.length > 0
    ? indent.items
    : [{
        productId: indent?.productId,
        requiredQty: indent?.requiredQty ?? indent?.quantity,
        requiredDate: indent?.requiredDate,
        remarks: indent?.remarks,
      }]

  const indentDate = toDateInput(indent?.indentDate)
  const rawRequiredDate = indent?.requiredDate || indent?.expectedDeliveryDate || items[0]?.requiredDate
  const expectedDeliveryDate = getLogicalRequiredDate(rawRequiredDate, indentDate, 7)

  return {
    ...baseDraft,
    vendorId: String(indent?.supplierId || indent?.vendorId || indent?.suggestedSupplierId || ''),
    indentNo: indent?.indentNo || indent?.indentNumber || initialIndentNo || baseDraft.indentNo,
    indentDate,
    expectedDeliveryDate,
    requestedBy: String(indent?.requestedById ?? indent?.RequestedById ?? indent?.requestedByUserId ?? indent?.RequestedByUserId ?? indent?.requestedBy ?? indent?.RequestedBy ?? ''),
    department: getDepartmentNameFromIndent(indent, baseDraft.department),
    priority: indent?.priority || baseDraft.priority,
    approvedBy: String(indent?.approvedById ?? indent?.ApprovedById ?? indent?.approvedByUserId ?? indent?.ApprovedByUserId ?? indent?.approvedBy ?? indent?.ApprovedBy ?? ''),
    paidAmount: String(indent?.paidAmount ?? indent?.amountPaid ?? ''),
    remarks: indent?.remarks || indent?.notes || '',
    items: items.map((item) => ({
      ...defaultItem,
      productId: item?.productId ? String(item.productId) : '',
      quantity: String(item?.requiredQty ?? item?.quantity ?? 1),
      requiredDate: getLogicalRequiredDate(item?.requiredDate || expectedDeliveryDate, indentDate, 7),
      remarks: item?.remarks || '',
    })),
  }
}

function toNumber(value) {
  const num = parseFloat(value)
  return Number.isNaN(num) ? 0 : num
}

function convertAmountToWords(amount) {
  const singleDigits = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine']
  const doubleDigits = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
  const tensPlace = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

  function convertLessThanThousand(value) {
    let number = value
    let words = ''

    if (number >= 100) {
      words += `${singleDigits[Math.floor(number / 100)]} Hundred `
      number %= 100
    }
    if (number >= 10 && number < 20) {
      words += `${doubleDigits[number - 10]} `
    } else {
      if (number >= 20) {
        words += `${tensPlace[Math.floor(number / 10)]} `
        number %= 10
      }
      if (number > 0) {
        words += `${singleDigits[number]} `
      }
    }

    return words.trim()
  }

  function convertWholeNumber(value) {
    let number = value
    let words = ''

    if (number >= 10000000) {
      words += `${convertLessThanThousand(Math.floor(number / 10000000))} Crore `
      number %= 10000000
    }
    if (number >= 100000) {
      words += `${convertLessThanThousand(Math.floor(number / 100000))} Lakh `
      number %= 100000
    }
    if (number >= 1000) {
      words += `${convertLessThanThousand(Math.floor(number / 1000))} Thousand `
      number %= 1000
    }
    if (number > 0) {
      words += convertLessThanThousand(number)
    }

    return words.trim() || 'Zero'
  }

  const roundedAmount = Math.round(Math.max(0, amount) * 100) / 100
  const rupees = Math.floor(roundedAmount)
  const paise = Math.round((roundedAmount - rupees) * 100)
  let result = `${convertWholeNumber(rupees)} Rupees`

  if (paise > 0) {
    result += ` and ${convertWholeNumber(paise)} Paise`
  }

  return `${result} Only`
}

function getDuplicateProductIndexes(items) {
  const seen = new Map()
  const duplicates = new Set()

  items.forEach((item, index) => {
    if (!item.productId) {
      return
    }

    const key = String(item.productId)
    if (seen.has(key)) {
      duplicates.add(index)
      duplicates.add(seen.get(key))
      return
    }

    seen.set(key, index)
  })

  return duplicates
}

function getResponseRecord(data) {
  return data?.data || data || null
}

function getUserId(user) {
  return user?.id ?? user?.Id ?? user?.userId ?? user?.UserId ?? user?.userID ?? user?.employeeId ?? user?.EmployeeId
}

function getUserName(user) {
  return (
    user?.fullName ||
    user?.FullName ||
    user?.displayName ||
    user?.DisplayName ||
    user?.name ||
    user?.Name ||
    user?.userName ||
    user?.UserName ||
    user?.email ||
    user?.Email ||
    ''
  )
}

function getUserDisplayName(user) {
  const name = getUserName(user)

  if (!name) {
    return ''
  }

  return name
}

function getSupplierId(supplier) {
  return supplier?.supplierId ?? supplier?.id ?? supplier?.vendorId
}

function getSupplierName(supplier) {
  return (
    supplier?.name ||
    supplier?.Name ||
    supplier?.supplierName ||
    supplier?.SupplierName ||
    supplier?.companyName ||
    supplier?.CompanyName ||
    supplier?.company ||
    supplier?.Company ||
    ''
  )
}

function getProductId(product) {
  return product?.productId ?? product?.id
}

function getProductStock(product) {
  return Number(product?.stock ?? product?.Stock ?? product?.availableStock ?? product?.currentStock ?? 0)
}

function getStatusKind(status) {
  const normalized = String(status || 'Pending').toLowerCase()

  if (normalized.includes('converted') || normalized.includes('ordered')) {
    return 'converted'
  }

  if (normalized.includes('approved')) {
    return 'approved'
  }

  if (normalized.includes('rejected')) {
    return 'rejected'
  }

  return 'pending'
}

function canEditIndent(indent) {
  return getStatusKind(indent?.status) === 'pending'
}

function getDepartmentId(value) {
  const option = departmentOptions.find((item) => item.value === value || String(item.id) === String(value))
  return option?.id ?? departmentOptions[0].id
}

function getDepartmentNameFromIndent(indent, fallback) {
  const departmentValue = indent?.departmentName || indent?.DepartmentName || indent?.department || indent?.Department

  if (departmentValue) {
    return departmentValue
  }

  const departmentId = indent?.departmentId ?? indent?.DepartmentId
  const option = departmentOptions.find((item) => String(item.id) === String(departmentId))
  return option?.value || fallback
}

function toPayloadId(value) {
  if (value === undefined || value === null || value === '') {
    return null
  }

  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : value
}

function getUserIdForDraftValue(users, value) {
  if (!value) {
    return ''
  }

  const matchedUser = users.find((user) => {
    const normalizedValue = String(value).trim().toLowerCase()
    return (
      String(getUserId(user)).trim().toLowerCase() === normalizedValue ||
      String(getUserName(user)).trim().toLowerCase() === normalizedValue ||
      String(getUserDisplayName(user)).trim().toLowerCase() === normalizedValue
    )
  })

  return matchedUser ? String(getUserId(matchedUser)) : String(value)
}

function PurchaseIndentForm({
    suppliers,
    products,
    users,
  isSupplierLoading = false,
  supplierError = '',
  onSubmit,
  onCancel,
  isSubmitting,
  initialIndentNo,
  initialValues = null,
  isEdit = false,
}) {
  const formRef = useRef(null)
  const [draft, setDraft] = useState(() => (
    initialValues
      ? buildDraftFromIndent(initialValues, initialIndentNo)
      : buildInitialDraft(initialIndentNo)
  ))

  useEffect(() => {
    if (users.length > 0 && draft.requestedBy === '') {
      setDraft(prev => ({
        ...prev,
        requestedBy: String(getUserId(users[0])),
      }))
    }
  }, [draft.requestedBy, users])

  useEffect(() => {
    if (users.length === 0) {
      return
    }

    setDraft((prev) => {
      const requestedBy = getUserIdForDraftValue(users, prev.requestedBy)
      const approvedBy = getUserIdForDraftValue(users, prev.approvedBy)

      if (requestedBy === prev.requestedBy && approvedBy === prev.approvedBy) {
        return prev
      }

      return {
        ...prev,
        requestedBy,
        approvedBy,
      }
    })
  }, [users])
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [productTooltip, setProductTooltip] = useState(null)

  const productOptions = useMemo(
    () => products,
    [products]
  )
  const selectedProductIds = useMemo(
    () => new Set(draft.items.map((item) => String(item.productId)).filter(Boolean)),
    [draft.items],
  )

  // Dynamically update Indent No when parent sets nextIndentNo
  useEffect(() => {
    if (initialIndentNo) {
      setDraft((prev) => ({
        ...prev,
        indentNo: initialIndentNo,
      }))
    }
  }, [initialIndentNo])

  useEffect(() => {
    if (initialValues) {
      setDraft(buildDraftFromIndent(initialValues, initialIndentNo))
    }
  }, [initialIndentNo, initialValues])

  const calculatedTotals = useMemo(
    () => draft.items.reduce((totals, item) => {
      const product = productOptions.find(
        (option) => String(getProductId(option)) === String(item.productId)
      )
      const unitPrice = toNumber(item.unitPrice) || toNumber(product?.costPrice ?? product?.cost ?? product?.purchasePrice ?? product?.price)
      const baseAmount = toNumber(item.quantity) * unitPrice
      const discountAmount = (baseAmount * toNumber(item.discount)) / 100
      const discountedAmount = baseAmount - discountAmount
      const taxAmount = (discountedAmount * toNumber(item.tax)) / 100

      return {
        subTotal: totals.subTotal + baseAmount,
        discount: totals.discount + discountAmount,
        tax: totals.tax + taxAmount,
        grandTotal: totals.grandTotal + discountedAmount + taxAmount,
      }
    }, {
      subTotal: 0,
      discount: 0,
      tax: 0,
      grandTotal: 0,
    }),
    [draft.items, productOptions],
  )
  const amountInWords = useMemo(
    () => convertAmountToWords(calculatedTotals.grandTotal),
    [calculatedTotals.grandTotal],
  )
  const amountPaid = Math.min(
    Math.max(0, toNumber(draft.paidAmount)),
    calculatedTotals.grandTotal,
  )
  const balanceDue = Math.max(0, calculatedTotals.grandTotal - amountPaid)

  function updateField(name, value) {
    setDraft((currentValue) => {
      const nextDraft = {
        ...currentValue,
        [name]: value,
      }

      if (name === 'indentDate' && value) {
        if (!currentValue.expectedDeliveryDate || compareDateOnly(currentValue.expectedDeliveryDate, value) <= 0) {
          nextDraft.expectedDeliveryDate = addDaysToDate(value, 7)
        }
      }

      return nextDraft
    })

    setErrors((currentValue) => ({
      ...currentValue,
      [name]: '',
    }))
    setFormError('')
  }

  function handleItemProductChange(index, productId) {
    const product = productOptions.find(
  (p) => String(getProductId(p)) === String(productId)
)

    const isDuplicate = productId && draft.items.some((item, itemIndex) =>
      itemIndex !== index && String(item.productId) === String(productId)
    )

    if (isDuplicate) {
      setErrors((currentValue) => ({
        ...currentValue,
        [`item_${index}_productId`]: 'This product is already added.',
      }))
      setFormError('Duplicate products are not allowed in a Purchase Indent.')
      return
    }

    setDraft((currentValue) => {
      const updatedItems = [...currentValue.items]
      updatedItems[index] = {
        ...updatedItems[index],
        productId,
        description: product?.description || product?.name || '',
        uom: product?.unit || 'Nos',
        unitPrice: (product?.costPrice ?? product?.cost ?? product?.purchasePrice ?? product?.price) ? String(product?.costPrice ?? product?.cost ?? product?.purchasePrice ?? product?.price) : '0',
        hsn: product ? '84713010' : '',
        requiredDate: updatedItems[index].requiredDate || currentValue.expectedDeliveryDate || getToday(),
        remarks: updatedItems[index].remarks || '',
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
      [`item_${index}_remarks`]: '',
    }))
    setFormError('')
  }

  function handleItemFieldChange(index, field, value) {
    const nextValue = field === 'quantity' && value !== ''
      ? String(Math.max(1, Number(value) || 1))
      : value

    setDraft((currentValue) => {
      const updatedItems = [...currentValue.items]
      updatedItems[index] = {
        ...updatedItems[index],
        [field]: nextValue,
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
    const hasEmptyProduct = draft.items.some((item) => !item.productId)
    if (hasEmptyProduct) {
      setFormError('Select a product in the empty row before adding another item.')
      return
    }

    setDraft((currentValue) => ({
      ...currentValue,
      items: [...currentValue.items, { ...defaultItem, requiredDate: currentValue.expectedDeliveryDate || getToday() }],
    }))
    setFormError('')
  }

  function handleDeleteItem(index) {
    setDraft((currentValue) => {
      let updatedItems = [...currentValue.items]
      if (updatedItems.length <= 1) {
        updatedItems = [{ ...defaultItem, requiredDate: currentValue.expectedDeliveryDate || getToday() }]
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

  function validate() {
    const nextErrors = {}
    let firstErrorKey = ''
    const setError = (key, message) => {
      nextErrors[key] = message
      if (!firstErrorKey) {
        firstErrorKey = key
      }
    }

    if (!draft.vendorId) {
      setError('vendorId', 'Suggested supplier is required.')
    }

    if (!draft.indentNo) {
      setError('indentNo', 'Purchase Indent number is required.')
    }

    if (!draft.indentDate) {
      setError('indentDate', 'Indent date is required.')
    }

    if (!draft.expectedDeliveryDate) {
      setError('expectedDeliveryDate', 'Required date is required.')
    }

    if (!draft.requestedBy) {
      setError('requestedBy', 'Requester is required.')
    }

    if (draft.expectedDeliveryDate && draft.indentDate && compareDateOnly(draft.expectedDeliveryDate, draft.indentDate) <= 0) {
      setError('expectedDeliveryDate', 'Required date must be later than request date.')
    }

    const enteredPaidAmount = toNumber(draft.paidAmount)
    if (enteredPaidAmount < 0) {
      setError('paidAmount', 'Paid amount cannot be negative.')
    } else if (enteredPaidAmount > calculatedTotals.grandTotal) {
      setError('paidAmount', 'Paid amount cannot exceed the grand total.')
    }

    if (draft.items.length === 0 || (draft.items.length === 1 && !draft.items[0].productId)) {
      setFormError('At least one item is required in the table.')
      window.requestAnimationFrame(() => {
        formRef.current?.querySelector('[data-field-key="item_0_productId"]')?.focus()
      })
      return false
    }

    const duplicateIndexes = getDuplicateProductIndexes(draft.items)

    draft.items.forEach((item, index) => {
      if (!item.productId) {
        setError(`item_${index}_productId`, 'Product is required.')
      } else if (duplicateIndexes.has(index)) {
        setError(`item_${index}_productId`, 'This product is already added.')
      }
      const qty = toNumber(item.quantity)
      if (qty <= 0) {
        setError(`item_${index}_quantity`, 'Quantity must be greater than zero.')
      }

      // Stock validation: If available stock is 0, justification is required
      if (item.productId) {
        const matchedProduct = productOptions.find(
          (p) => String(getProductId(p)) === String(item.productId)
        )
        if (matchedProduct) {
          const availableStock = getProductStock(matchedProduct)
          if (availableStock <= 0 && (!item.remarks || !item.remarks.trim())) {
            setError(`item_${index}_remarks`, 'Justification is required for items with 0 available stock.')
          }
        }
      }
    })

    setErrors(nextErrors)
    const isValid = Object.keys(nextErrors).length === 0
    if (!isValid) {
      setFormError('Please correct the validation errors in the fields and items table.')
      window.requestAnimationFrame(() => {
        formRef.current?.querySelector(`[data-field-key="${firstErrorKey}"]`)?.focus()
      })
    }
    return isValid
  }

  // Unified Action Handler for Save Draft vs Submit
  async function handleAction() {
    setFormError('')

    if (!validate()) {
      return
    }

    try {
      const response = await onSubmit({
        indentDate: draft.indentDate,
        requiredDate: draft.expectedDeliveryDate,
        requestedBy: toPayloadId(draft.requestedBy),
        departmentId: getDepartmentId(draft.department),
        supplierId: toPayloadId(draft.vendorId),
        approvedBy: draft.approvedBy ? toPayloadId(draft.approvedBy) : null,
        priority: draft.priority,
        remarks: draft.remarks,
        items: draft.items.map(item => {
          const product = productOptions.find(
            p => String(getProductId(p)) === String(item.productId)
          )

          return {
            productId: Number(item.productId),
            requiredQty: Number(item.quantity),
            unitId: getProductUnitId(product),
            availableStock: getProductStock(product),
            requiredDate: item.requiredDate || draft.expectedDeliveryDate,
            remarks: item.remarks,
          }
        }),
      })

      if (response?.success) {
        // Handled by parent redirect
      } else {
        setFormError(response?.error || 'Purchase Indent could not be saved.')
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Purchase Indent could not be saved.')
    }
  }

  return (
    <div className="indent-create-wrapper" ref={formRef}>
      {formError ? (
        <div className="message-box message-box--error page-error-banner" style={{ marginBottom: '20px' }} role="alert">
          {formError}
        </div>
      ) : null}

      {/* Indent Actions Header Bar */}
      <div className="indent-create-header">
        <div className="indent-create-header__title">
          <h1>{isEdit ? 'Edit Purchase Indent' : 'Create Purchase Indent'}</h1>
        </div>
      </div>

      {/* Section 1: Indent Details */}
      <div className="indent-card">
        <h3 className="indent-card__title">Indent Details</h3>
        <div className="indent-details-grid">
          {/* Indent No */}
          <div className="indent-field-group">
            <label>Indent No.</label>
            <input
              type="text"
              className="indent-input"
              data-field-key="indentNo"
              value={draft.indentNo}
              readOnly
              disabled
            />
          </div>

          {/* Indent Date */}
          <div className={`indent-field-group ${errors.indentDate ? 'indent-field-group--error' : ''}`}>
            <label>Indent Date <span className="required">*</span></label>
            <DatePicker
              name="indentDate"
              data-field-key="indentDate"
              value={draft.indentDate}
              onChange={(e) => updateField('indentDate', e.target.value)}
              disabled={isSubmitting}
              className="indent-details-date-picker"
            />
            {errors.indentDate && <span className="indent-field-error">{errors.indentDate}</span>}
          </div>

          {/* Required Date */}
          <div className={`indent-field-group ${errors.expectedDeliveryDate ? 'indent-field-group--error' : ''}`}>
            <label>Required Date <span className="required">*</span></label>
            <DatePicker
              name="expectedDeliveryDate"
              data-field-key="expectedDeliveryDate"
              value={draft.expectedDeliveryDate}
              onChange={(e) => updateField('expectedDeliveryDate', e.target.value)}
              disabled={isSubmitting}
              className="indent-details-date-picker"
            />
            {errors.expectedDeliveryDate && <span className="indent-field-error">{errors.expectedDeliveryDate}</span>}
          </div>

          {/* Requested by */}
          <div className={`indent-field-group ${errors.requestedBy ? 'indent-field-group--error' : ''}`}>
            <label>Requested by <span className="required">*</span></label>
            <select
              id="indent-requested-by"
              name="requestedBy"
              className="indent-select"
              data-field-key="requestedBy"
              value={draft.requestedBy}
              onChange={(event) => updateField('requestedBy', event.target.value)}
              disabled={isSubmitting}
            >
              {users.map((user) => (
                <option key={getUserId(user)} value={getUserId(user)}>
                  {getUserDisplayName(user)}
                </option>
              ))}
            </select>
            {errors.requestedBy && <span className="indent-field-error">{errors.requestedBy}</span>}
          </div>

          {/* Department */}
          <div className="indent-field-group">
            <label>Department</label>
            <select
              className="indent-select"
              data-field-key="vendorId"
              value={draft.department}
              onChange={(e) => updateField('department', e.target.value)}
              disabled={isSubmitting}
            >
              {departmentOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Suggested Supplier */}
          <div className={`indent-field-group ${errors.vendorId ? 'indent-field-group--error' : ''}`}>
            <label>Suggested Supplier <span className="required">*</span></label>
            <select
              className="indent-select"
              value={draft.vendorId}
              onChange={(e) => updateField('vendorId', e.target.value)}
              disabled={isSubmitting || isSupplierLoading || Boolean(supplierError)}
            >
              <option value="">
                {isSupplierLoading
                  ? 'Loading suppliers...'
                  : supplierError
                    ? 'Unable to load suppliers'
                    : suppliers.length === 0
                      ? 'No active suppliers available'
                      : 'Select supplier'}
              </option>
              {suppliers.map((s) => (
                <option
                  key={getSupplierId(s)}
                  value={getSupplierId(s)}
                >
                  {getSupplierName(s)}
                </option>
              ))}
            </select>
            {(errors.vendorId || supplierError) && (
              <span className="indent-field-error">{errors.vendorId || supplierError}</span>
            )}
          </div>

          {/* Priority */}
          <div className="indent-field-group">
            <label>Priority</label>
            <select
              className="indent-select"
              value={draft.priority}
              onChange={(e) => updateField('priority', e.target.value)}
              disabled={isSubmitting}
            >
              {priorityOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Approved By */}
          <div className="indent-field-group">
            <label>Approved By</label>
            <SearchableSelect
              id="indent-approved-by"
              name="approvedBy"
              className="indent-details-searchable-select"
              value={draft.approvedBy}
              onChange={(event) => updateField('approvedBy', event.target.value)}
              options={users.map((user) => ({
                value: getUserId(user),
                label: getUserDisplayName(user),
              }))}
              placeholder="Select approver"
              searchPlaceholder="Search approver"
              hideLabel
              disabled={isSubmitting}
              menuPlacement="bottom"
              showSearch={false}
              menuClassName="indent-native-select-menu"
            />
          </div>
        </div>
      </div>

      {/* Section 2: Items Card */}
      <div className="indent-card">
        <div className="indent-items-header">
          <h3 className="indent-card__title" style={{ margin: 0 }}>Items</h3>
        </div>

        <div className="indent-items-table-wrapper">
          <table className="indent-items-table" style={{ tableLayout: 'fixed' }}>
            <thead>
              <tr>
                <th style={{ width: '50px', textAlign: 'center' }}>S.No</th>
                <th style={{ width: '22%' }}>Item Name *</th>
                <th style={{ width: '10%', textAlign: 'center' }}>Required Qty *</th>
                <th style={{ width: '8%', textAlign: 'center' }}>Unit</th>
                <th style={{ width: '11%', textAlign: 'center' }}>Unit Price (₹)</th>
                <th style={{ width: '13%', textAlign: 'center' }}>Available Stock</th>
                <th style={{ width: '18%' }}>Justification / Remarks</th>
                <th style={{ width: '14%' }}>Required Date</th>
                <th style={{ width: '60px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {draft.items.map((item, index) => {
                const matchedProduct = productOptions.find(
                  (p) => String(getProductId(p)) === String(item.productId)
                )
                const availableStock = matchedProduct ? getProductStock(matchedProduct) : null
                const isUnavailable = matchedProduct && availableStock <= 0
                return (
                  <tr key={index}>
                    {/* S.No */}
                    <td className="indent-sno-col">{index + 1}</td>

                    {/* Item Name */}
                    <td>
                      <div
                        className="indent-product-field"
                        onMouseEnter={(event) => {
                          if (!matchedProduct?.name) return
                          const rect = event.currentTarget.getBoundingClientRect()
                          setProductTooltip({
                            name: matchedProduct.name,
                            left: rect.left + rect.width / 2,
                            top: rect.bottom + 5,
                          })
                        }}
                        onMouseLeave={() => setProductTooltip(null)}
                      >
                        <select
                          className="indent-table-input"
                          data-field-key={`item_${index}_productId`}
                          value={item.productId}
                          title={matchedProduct?.name || 'Select product'}
                          onChange={(e) => handleItemProductChange(index, e.target.value)}
                          disabled={isSubmitting}
                          style={{
                            borderColor: errors[`item_${index}_productId`] ? '#ef4444' : '#cbd5e1'
                          }}
                        >
                          <option value="">Select product</option>
                          {productOptions.map((p) => {
                            const productId = String(getProductId(p))
                            const isSelectedElsewhere = selectedProductIds.has(productId) && String(item.productId) !== productId

                            return (
                              <option
                                key={getProductId(p)}
                                value={getProductId(p)}
                                disabled={isSelectedElsewhere}
                              >
                                {p.name}{isSelectedElsewhere ? ' (Already added)' : ''}
                              </option>
                            )
                          })}
                        </select>
                      </div>
                    </td>

                    {/* Required Qty */}
                    <td>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        className="indent-table-input"
                        data-field-key={`item_${index}_quantity`}
                        value={item.quantity}
                        onChange={(e) => handleItemFieldChange(index, 'quantity', e.target.value)}
                        onKeyDown={(e) => {
                          if (['-', '+', 'e', 'E', '.'].includes(e.key)) {
                            e.preventDefault()
                          }
                        }}
                        disabled={isSubmitting}
                        style={{
                          borderColor: errors[`item_${index}_quantity`] ? '#ef4444' : '#cbd5e1',
                          textAlign: 'center'
                        }}
                      />
                    </td>

                    {/* Unit */}
                    <td>
                      <input
                        type="text"
                        className="indent-table-input"
                        value={matchedProduct?.unit || item.uom || 'Nos'}
                        readOnly
                        disabled
                        style={{ textAlign: 'center' }}
                      />
                    </td>

                    {/* Unit Price */}
                    <td>
                      <input
                        type="text"
                        className="indent-table-input indent-unit-price-input"
                        value={(toNumber(item.unitPrice) || toNumber(matchedProduct?.costPrice ?? matchedProduct?.cost ?? matchedProduct?.purchasePrice ?? matchedProduct?.price)).toLocaleString('en-IN', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                        readOnly
                        aria-label={`Unit price for item ${index + 1}`}
                      />
                    </td>

                    {/* Available Stock */}
                    <td style={{ textAlign: 'center' }}>
                      {matchedProduct ? (
                        isUnavailable ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                padding: '3px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 600,
                                backgroundColor: '#fef2f2',
                                color: '#dc2626',
                                border: '1px solid #fecaca',
                              }}
                              title="Available stock is 0 in warehouse - justification required"
                            >
                              0 (Out of Stock)
                            </span>
                          </div>
                        ) : (
                          <input
                            type="text"
                            className="indent-table-input"
                            value={String(availableStock)}
                            readOnly
                            disabled
                            style={{ textAlign: 'center' }}
                          />
                        )
                      ) : (
                        <input
                          type="text"
                          className="indent-table-input"
                          value="Not Available"
                          readOnly
                          disabled
                          style={{ textAlign: 'center', color: '#94a3b8' }}
                        />
                      )}
                    </td>

                    {/* Justification / Remarks */}
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <input
                          type="text"
                          className="indent-table-input"
                          data-field-key={`item_${index}_remarks`}
                          placeholder={isUnavailable ? 'Justification required *' : 'Optional remarks'}
                          value={item.remarks || ''}
                          onChange={(e) => handleItemFieldChange(index, 'remarks', e.target.value)}
                          disabled={isSubmitting}
                          style={{
                            borderColor: errors[`item_${index}_remarks`]
                              ? '#ef4444'
                              : (isUnavailable && !item.remarks?.trim() ? '#f59e0b' : '#cbd5e1'),
                            backgroundColor: errors[`item_${index}_remarks`]
                              ? '#fef2f2'
                              : (isUnavailable && !item.remarks?.trim() ? '#fffbeb' : '#fff'),
                          }}
                        />
                        {errors[`item_${index}_remarks`] && (
                          <span
                            className="indent-field-error"
                            style={{ fontSize: '11px', color: '#ef4444', lineHeight: 1.2, marginTop: '2px' }}
                          >
                            {errors[`item_${index}_remarks`]}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Required Date */}
                    <td>
                      <DatePicker
                        name={`item_required_date_${index}`}
                        value={item.requiredDate || draft.expectedDeliveryDate || getToday()}
                        onChange={(e) => handleItemFieldChange(index, 'requiredDate', e.target.value)}
                        disabled={isSubmitting}
                        className="indent-table-date-picker"
                      />
                    </td>

                    {/* Actions */}
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        className="indent-row-delete-btn"
                        onClick={() => handleDeleteItem(index)}
                        disabled={isSubmitting}
                        title="Delete Row"
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
            onClick={handleAddItem}
            disabled={isSubmitting}
            style={{ height: '36px', padding: '0 14px' }}
          >
            <Plus size={16} /> Add Item
          </button>
        </div>

        <div className="indent-total-section">
          <div className="indent-amount-words">
            <h4>Amount in Words</h4>
            <div className="indent-amount-words__box">
              {amountInWords}
            </div>
          </div>

          <div className="indent-totals-card">
            <div className="indent-totals-card__row">
              <span>Sub Total</span>
              <strong>₹{calculatedTotals.subTotal.toLocaleString('en-IN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}</strong>
            </div>
            <div className="indent-totals-card__row indent-totals-card__row--discount">
              <span>Discount</span>
              <strong>- ₹{calculatedTotals.discount.toLocaleString('en-IN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}</strong>
            </div>
            <div className="indent-totals-card__row">
              <span>Tax</span>
              <strong>₹{calculatedTotals.tax.toLocaleString('en-IN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}</strong>
            </div>
            <div className="indent-totals-card__row indent-totals-card__row--grand">
              <span>Grand Total</span>
              <strong>₹{calculatedTotals.grandTotal.toLocaleString('en-IN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}</strong>
            </div>
          </div>
        </div>

        <div className="indent-payment-card">
        <div className={`indent-payment-card__input-section ${errors.paidAmount ? 'indent-payment-card__input-section--error' : ''}`}>
          <label htmlFor="indent-paid-amount">Paid Amount (₹)</label>
          <input
            id="indent-paid-amount"
            type="number"
            min="0"
            max={calculatedTotals.grandTotal}
            step="0.01"
            data-field-key="paidAmount"
            value={draft.paidAmount}
            onChange={(event) => updateField('paidAmount', event.target.value)}
            onKeyDown={(event) => {
              if (['-', '+', 'e', 'E'].includes(event.key)) {
                event.preventDefault()
              }
            }}
            placeholder="0.00"
            disabled={isSubmitting}
          />
          {errors.paidAmount && (
            <span className="indent-payment-card__error">{errors.paidAmount}</span>
          )}
        </div>

        <div className="indent-payment-card__divider" />

        <div className="indent-payment-card__metric">
          <span>Total Amount</span>
          <strong>₹{calculatedTotals.grandTotal.toLocaleString('en-IN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}</strong>
        </div>

        <span className="indent-payment-card__dot" aria-hidden="true">•</span>

        <div className="indent-payment-card__metric indent-payment-card__metric--paid">
          <span>Amount Paid</span>
          <strong>₹{amountPaid.toLocaleString('en-IN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}</strong>
        </div>

        <span className="indent-payment-card__dot" aria-hidden="true">•</span>

        <div className="indent-payment-card__metric indent-payment-card__metric--balance">
          <span>Balance Due</span>
          <strong>₹{balanceDue.toLocaleString('en-IN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}</strong>
        </div>
        </div>
      </div>

      {/* Remarks Section */}
      <div className="indent-card">
        <h3 className="indent-card__title">Remarks / Notes</h3>
        <textarea
          className="indent-remarks-textarea"
          placeholder="Enter remarks or special instructions (optional)"
          value={draft.remarks}
          onChange={(e) => updateField('remarks', e.target.value)}
          disabled={isSubmitting}
        />
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
          type="button"
          className="indent-btn indent-btn--submit"
          onClick={() => handleAction('Pending')}
          disabled={isSubmitting}
        >
          {isEdit ? 'Update' : 'Submit'}
        </button>
      </div>

      {productTooltip && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="indent-product-tooltip"
              style={{
                left: productTooltip.left,
                top: productTooltip.top,
              }}
              role="tooltip"
            >
              {productTooltip.name}
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}

export default function CreatePurchaseIndentScreen({
    products = [],
    users = []
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const editIndentId = location.state?.editIndentId
  const saveInFlightRef = useRef(false)
  const supplierRequestRef = useRef(0)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoadingIndents, setIsLoadingIndents] = useState(true)
  const [nextIndentNo, setNextIndentNo] = useState('')
  const [editIndent, setEditIndent] = useState(null)
  const [backendUsers, setBackendUsers] = useState(() => normalizeUserList(users))
  const [backendSuppliers, setBackendSuppliers] = useState([])
  const [isSupplierLoading, setIsSupplierLoading] = useState(true)
  const [supplierError, setSupplierError] = useState('')

  useEffect(() => {
    let isActive = true

    async function loadLiveSuppliers() {
      const requestId = supplierRequestRef.current + 1
      supplierRequestRef.current = requestId
      setIsSupplierLoading(true)
      setSupplierError('')

      const response = await getSuppliers({
        page: 1,
        pageSize: 500,
        includeDeleted: false,
        includeArchived: false,
      })

      if (!isActive || requestId !== supplierRequestRef.current) {
        return
      }

      if (!response.success) {
        setBackendSuppliers([])
        setSupplierError(response.error || 'Unable to load suppliers from the backend.')
      } else {
        setBackendSuppliers(
          (Array.isArray(response.data) ? response.data : [])
            .filter((supplier) => supplier && !supplier.isDeleted),
        )
      }

      setIsSupplierLoading(false)
    }

    function handleSupplierMutation(event) {
      const endpoint = String(event.detail?.endpoint || '').toLowerCase()

      if (endpoint.includes('/suppliers')) {
        loadLiveSuppliers()
      }
    }

    loadLiveSuppliers()
    window.addEventListener(IMS_DATA_MUTATION_EVENT, handleSupplierMutation)

    return () => {
      isActive = false
      window.removeEventListener(IMS_DATA_MUTATION_EVENT, handleSupplierMutation)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    async function loadInitialData() {
      try {
       if (editIndentId) {
        const response = await getPurchaseIndent(editIndentId, { signal: controller.signal })

        if (controller.signal.aborted) {
          return
        }

        if (!response.success) {
          throw new Error(response.error || 'Unable to load Purchase Indent.')
        }

        const indent = getResponseRecord(response.data)

        if (!canEditIndent(indent)) {
          showToast({
            type: 'warning',
            title: 'Purchase Indents',
            message: 'Only pending Purchase Indents can be edited.',
          })
          navigate('/inventory/purchase-indents')
          return
        }

        setEditIndent(indent)
        setNextIndentNo(indent?.indentNo || indent?.indentNumber || '')
        return
       }

       const response = await getPurchaseIndents(1, 1000, { signal: controller.signal })

        if (controller.signal.aborted) {
          return
        }

        let indents = []
        if (response.success) {
          indents = Array.isArray(response.data) ? response.data : response.data?.data || []
        }
        setNextIndentNo(generateIndentNumber(indents))
      } catch (error) {
    if (controller.signal.aborted) {
      return
    }

    if (!controller.signal.aborted) {
      showToast({
        type: 'error',
        title: 'Purchase Indents',
        message:
          error instanceof Error
            ? error.message
            : 'Unable to load Purchase Indent.',
      })
    }

    if (editIndentId) {
      navigate('/inventory/purchase-indents')
      return
    }

    setNextIndentNo(generateIndentNumber([]))
} finally {
        if (!controller.signal.aborted) {
          setIsLoadingIndents(false)
        }
      }
    }
    loadInitialData()

    return () => controller.abort()
  }, [editIndentId, navigate])

  useEffect(() => {
    let isActive = true
    const propUsers = normalizeUserList(users)

    if (propUsers.length > 0) {
      setBackendUsers(propUsers)
    }

    loadPurchaseIndentUsers()
      .then((loadedUsers) => {
        if (isActive && loadedUsers.length > 0) {
          setBackendUsers(loadedUsers)
        }
      })
      .catch(() => {
        if (isActive && propUsers.length > 0) {
          setBackendUsers(propUsers)
        }
      })

    return () => {
      isActive = false
    }
  }, [users])

  const supplierOptions = useMemo(
    () =>
      backendSuppliers
        .filter((supplier) => supplier && getSupplierId(supplier) && getSupplierName(supplier))
        .map((supplier) => ({
          ...supplier,
          supplierId: getSupplierId(supplier),
          name: getSupplierName(supplier),
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [backendSuppliers]
  )

  const productOptions = useMemo(
    () =>
      products
        .filter((product) => {
          if (!product || !getProductId(product)) return false
          if (product.isArchived === true || product.IsArchived === true || product.is_archived === true) return false
          const status = String(product.rawStatus ?? product.sourceStatus ?? product.status ?? '').trim().toLowerCase()
          return status !== 'archived' && status !== 'discontinued'
        })
        .map((product) => ({
          ...product,
          productId: Number(getProductId(product)),
          name: product.name || product.productName || `Product ${getProductId(product)}`,
          sku: product.sku || product.SKU || '',
          price: Number(product.price ?? product.Price ?? 0),
          costPrice: Number(product.costPrice ?? product.CostPrice ?? product.cost_price ?? product.cost ?? product.Cost ?? product.purchasePrice ?? product.PurchasePrice ?? product.price ?? product.Price ?? 0),
          stock: getProductStock(product),
          unitId: getProductUnitId(product),
          unit: product.unit?.name || product.unit?.unitName || product.unitName || product.UnitName || product.unit || 'Nos',
          description: product.description || '',
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [products]
  )

  const userOptions = useMemo(
    () =>
      backendUsers
        .filter((user) => user && getUserId(user))
        .map((user) => ({
          ...user,
          id: getUserId(user),
          name: getUserName(user),
          displayName: getUserDisplayName(user),
        }))
        .filter((user) => user.name)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [backendUsers]
  )

  

  async function handleSavePurchaseIndent(payload) {
    if (saveInFlightRef.current) {
      return { success: false, duplicateBlocked: true }
    }

    saveInFlightRef.current = true
    setIsSaving(true)

    try {

        const response = editIndentId
          ? await updatePurchaseIndent(editIndentId, payload)
          : await createPurchaseIndent(payload)

        if (!response.success) {
            throw new Error(response.error)
        }

        showToast({
            type: 'success',
            title: 'Purchase Indents',
            message: editIndentId
              ? 'Purchase Indent updated successfully.'
              : 'Purchase Indent created successfully.'
        })

        navigate('/inventory/purchase-indents')

        return response
    }
    catch (error) {

        showToast({
            type: 'error',
            title: 'Purchase Indents',
            message:
                error instanceof Error
                    ? error.message
                    : editIndentId
                      ? 'Unable to update Purchase Indent.'
                      : 'Unable to create Purchase Indent.'
        })

        return { success: false }
    }
    finally {
        saveInFlightRef.current = false
        setIsSaving(false)
    }
}

  if (isLoadingIndents) {
    return (
      <div className="page sales-page sales-page--create" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
        <LoaderCircle className="animate-spin" size={40} style={{ color: '#684cda' }} />
      </div>
    )
  }



  return (
    <div className="indent-create-container">
      <PurchaseIndentForm
        users={userOptions}
        suppliers={supplierOptions}
        isSupplierLoading={isSupplierLoading}
        supplierError={supplierError}
        onSubmit={handleSavePurchaseIndent}
        onCancel={() => navigate('/inventory/purchase-indents')}
        isSubmitting={isSaving}
        initialIndentNo={nextIndentNo}
        initialValues={editIndent}
        isEdit={Boolean(editIndentId)}
        products={productOptions}
      />
    </div>
  )
}
