import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  useNavigate,
  useParams,
} from 'react-router-dom'

import {
  AlertCircle,
  ArrowLeft,
  Plus,
  Save,
  Trash2,
} from 'lucide-react'

import PageHeader from '../../../components/common/PageHeader'
import StateBlock from '../../../components/common/StateBlock'
import { showToast } from '../../../components/common/toast'

import {
  createPurchaseReturn,
  getPurchaseReturnById,
  getPurchaseReturnGrnItems,
  getPurchaseReturnGrns,
  getPurchaseReturnSuppliers,
  updatePurchaseReturn,
} from '../../../api/purchaseReturnApi'

import { formatCurrency } from '../../../utils/helpers'

import './PurchaseReturns.css'


const emptyItem = () => ({
  id: `${Date.now()}-${Math.random()}`,
  productId: '',
  variantId: '',
  productName: '',
  variantName: '',
  receivedQuantity: '0',
  previouslyReturnedQuantity: '0',
  returnableQuantity: '0',
  returnQuantity: '0',
  price: '0',
})


const getArrayFromResponse = (response) => {
  if (Array.isArray(response)) {
    return response
  }

  if (Array.isArray(response?.data)) {
    return response.data
  }

  if (Array.isArray(response?.data?.items)) {
    return response.data.items
  }

  if (Array.isArray(response?.items)) {
    return response.items
  }

  return null
}


const getResponseData = (response) => {
  if (
    response?.data !== undefined &&
    !Array.isArray(response?.data)
  ) {
    return response.data
  }

  return response
}


const getId = (item) =>
  item?.id ??
  item?.supplierId ??
  item?.supplier_id


const getSupplierName = (supplier) =>
  supplier?.name ??
  supplier?.supplierName ??
  supplier?.supplier_name ??
  (
    getId(supplier)
      ? `Supplier #${getId(supplier)}`
      : '-'
  )


const getGrnId = (grn) =>
  grn?.id ??
  grn?.grnId ??
  grn?.grn_id


const getGrnNumber = (grn) =>
  grn?.grnNumber ??
  grn?.grn_number ??
  grn?.number ??
  (
    getGrnId(grn)
      ? `GRN-${getGrnId(grn)}`
      : '-'
  )


const getProductId = (item) =>
  item?.productId ??
  item?.product_id


const getVariantId = (item) =>
  item?.variantId ??
  item?.variant_id


const getProductName = (item) =>
  item?.productName ??
  item?.product_name ??
  item?.name ??
  (
    getProductId(item)
      ? `Product #${getProductId(item)}`
      : '-'
  )


const getVariantName = (item) =>
  item?.variantName ??
  item?.variant_name ??
  item?.variant?.name ??
  item?.sku ??
  (
    getVariantId(item)
      ? `Variant #${getVariantId(item)}`
      : ''
  )


const getNumber = (...values) => {
  for (const value of values) {
    if (
      value !== null &&
      value !== undefined &&
      value !== ''
    ) {
      const number = Number(value)

      if (Number.isFinite(number)) {
        return number
      }
    }
  }

  return 0
}


const normalizeGrnItem = (line, index = 0) => {
  const receivedQuantity = getNumber(
    line?.receivedQuantity,
    line?.quantityReceived,
    line?.received_quantity,
    line?.quantity,
  )


  const previouslyReturnedQuantity =
    getNumber(
      line?.previouslyReturnedQuantity,
      line?.returnedQuantity,
      line?.alreadyReturnedQuantity,
      line?.previously_returned_quantity,
      line?.already_returned_quantity,
    )


  const explicitReturnableQuantity =
    line?.returnableQuantity ??
    line?.availableReturnQuantity ??
    line?.remainingQuantity ??
    line?.returnable_quantity ??
    line?.available_return_quantity ??
    line?.remaining_quantity


  const calculatedReturnableQuantity =
    Math.max(
      0,
      receivedQuantity -
      previouslyReturnedQuantity
    )


  const returnableQuantity =
    explicitReturnableQuantity !==
      undefined &&
      explicitReturnableQuantity !== null &&
      explicitReturnableQuantity !== ''
      ? Math.max(
        0,
        getNumber(
          explicitReturnableQuantity
        )
      )
      : calculatedReturnableQuantity


  return {
    id: `${Date.now()}-${index}-${Math.random()}`,

    productId: String(
      getProductId(line) ?? ''
    ),

    variantId: String(
      getVariantId(line) ?? ''
    ),

    productName:
      getProductName(line),

    variantName:
      getVariantName(line),

    receivedQuantity:
      String(receivedQuantity),

    previouslyReturnedQuantity:
      String(previouslyReturnedQuantity),

    returnableQuantity:
      String(returnableQuantity),

    returnQuantity:
      '0',

    price: String(
      getNumber(
        line?.unitPrice,
        line?.price,
        line?.unitCost,
        line?.purchasePrice,
        line?.unit_price,
        line?.unit_cost,
      )
    ),
  }
}


export default function CreatePurchaseReturn() {
  const navigate = useNavigate()

  const { id } = useParams()

  const isEditMode =
    Boolean(id)


  const [suppliers, setSuppliers] =
    useState([])

  const [allGrns, setAllGrns] =
    useState([])

  const [items, setItems] =
    useState([])


  const [supplierId, setSupplierId] =
    useState('')

  const [grnId, setGrnId] =
    useState('')

  const [returnDate, setReturnDate] =
    useState(
      () =>
        new Date()
          .toISOString()
          .slice(0, 10)
    )

  const [reason, setReason] =
    useState('')


  const [loading, setLoading] =
    useState(true)

  const [
    loadingGrnItems,
    setLoadingGrnItems,
  ] = useState(false)

  const [submitting, setSubmitting] =
    useState(false)

  const [error, setError] =
    useState('')

  const [
    validationErrors,
    setValidationErrors,
  ] = useState({})


  // =========================================================
  // LOAD REFERENCE DATA
  // =========================================================

  const loadReferenceData =
    useCallback(async () => {
      setLoading(true)
      setError('')

      try {
        const suppliersResponse = await getPurchaseReturnSuppliers()

        const supplierData =
          getArrayFromResponse(
            suppliersResponse
          )

        if (supplierData === null) {
          throw new Error(
            'Supplier API returned an unexpected response format.'
          )
        }

        setSuppliers(
          supplierData
        )


        // =====================================================
        // EDIT MODE
        // =====================================================

        if (isEditMode) {
          const response =
            await getPurchaseReturnById(
              id
            )

          const record =
            getResponseData(
              response
            )


          if (!record) {
            throw new Error(
              'Purchase return was not found.'
            )
          }


          const recordSupplierId =
            record?.supplierId ??
            record?.supplier_id ??
            ''


          const recordGrnId =
            record?.grnId ??
            record?.grn_id ??
            ''


          setSupplierId(
            String(recordSupplierId)
          )

          setGrnId(
            String(recordGrnId)
          )

          if (recordSupplierId) {
            const grnsResponse = await getPurchaseReturnGrns(recordSupplierId)
            const grnData = getArrayFromResponse(grnsResponse)
            setAllGrns(grnData || [])
          }

          const dateValue =
            record?.returnDate ??
            record?.return_date


          if (dateValue) {
            setReturnDate(
              String(dateValue)
                .slice(0, 10)
            )
          }


          setReason(
            record?.reason ?? ''
          )


          const recordItems =
            Array.isArray(
              record?.items
            )
              ? record.items
              : Array.isArray(
                record?.returnItems
              )
                ? record.returnItems
                : []


          if (recordItems.length) {
            setItems(
              recordItems.map(
                (line, index) => ({
                  ...normalizeGrnItem(
                    line,
                    index
                  ),

                  returnQuantity:
                    String(
                      getNumber(
                        line?.returnQuantity,
                        line?.quantity,
                        line?.return_quantity
                      )
                    ),
                })
              )
            )
          }
        }

      } catch (err) {
        console.error(
          'Purchase Return reference data error:',
          err
        )

        setError(
          err?.response?.data?.message ||
          err?.response?.data?.title ||
          err?.message ||
          'Failed to load purchase return data.'
        )
      } finally {
        setLoading(false)
      }
    }, [
      id,
      isEditMode,
    ])


  useEffect(() => {
    loadReferenceData()
  }, [loadReferenceData])


  // =========================================================
  // FILTER GRNS BY SUPPLIER
  // =========================================================

  const availableGrns =
    useMemo(() => {
      if (!supplierId) {
        return []
      }

      return allGrns.filter(
        (grn) => {
          const grnSupplierId =
            grn?.supplierId ??
            grn?.supplier_id ??
            grn?.supplier?.id

          return (
            String(
              grnSupplierId ?? ''
            ) ===
            String(supplierId)
          )
        }
      )
    }, [
      allGrns,
      supplierId,
    ])


  // =========================================================
  // TOTAL
  // =========================================================

  const totalReturnAmount =
    useMemo(
      () =>
        items.reduce(
          (sum, item) =>
            sum +
            getNumber(
              item.returnQuantity
            ) *
            getNumber(
              item.price
            ),
          0
        ),
      [items]
    )


  // =========================================================
  // LOAD GRN ITEMS
  // =========================================================

  const loadGrnItems =
    useCallback(
      async (selectedGrnId) => {
        if (!selectedGrnId) {
          setItems([])
          return
        }

        setLoadingGrnItems(true)

        setValidationErrors(
          (previous) => ({
            ...previous,
            grnItems:
              undefined,
          })
        )


        try {
          const response =
            await getPurchaseReturnGrnItems(
              selectedGrnId
            )


          const rawItems =
            getArrayFromResponse(
              response
            )


          if (rawItems === null) {
            throw new Error(
              'GRN items API returned an unexpected response format.'
            )
          }


          if (!rawItems.length) {
            throw new Error(
              'No returnable items were found for the selected GRN.'
            )
          }


          const normalizedItems =
            rawItems
              .map(
                normalizeGrnItem
              )
              .filter(
                (item) =>
                  getNumber(
                    item.returnableQuantity
                  ) > 0
              )


          if (
            !normalizedItems.length
          ) {
            throw new Error(
              'All items in this GRN have already been returned or are not returnable.'
            )
          }


          setItems(
            normalizedItems
          )

        } catch (err) {
          console.error(
            'GRN items API error:',
            err
          )

          setItems([])

          setValidationErrors(
            (previous) => ({
              ...previous,

              grnItems:
                err?.response?.data?.message ||
                err?.response?.data?.title ||
                err?.message ||
                'Failed to load GRN returnable items.',
            })
          )
        } finally {
          setLoadingGrnItems(false)
        }
      },
      []
    )


  // =========================================================
  // SUPPLIER CHANGE
  // =========================================================

  const handleSupplierChange =
    async (event) => {
      const selectedSupplierId =
        event.target.value

      setSupplierId(
        selectedSupplierId
      )

      setGrnId('')
      setItems([])
      setAllGrns([])

      setValidationErrors({})

      if (selectedSupplierId) {
        try {
          const response = await getPurchaseReturnGrns(selectedSupplierId)
          const grnData = getArrayFromResponse(response)
          setAllGrns(grnData || [])
        } catch (err) {
          console.error('Failed to load GRNs for supplier:', err)
          showToast('Failed to load Goods Receipts for the selected supplier.', 'error')
        }
      }
    }


  // =========================================================
  // GRN CHANGE
  // =========================================================

  const handleGrnChange =
    async (event) => {
      const selectedGrnId =
        event.target.value

      setGrnId(
        selectedGrnId
      )

      setItems([])

      setValidationErrors({})

      if (selectedGrnId) {
        await loadGrnItems(
          selectedGrnId
        )
      }
    }


  // =========================================================
  // RETURN QUANTITY
  // =========================================================

  const handleReturnQuantityChange =
    (index, value) => {
      setItems(
        (previous) =>
          previous.map(
            (item, itemIndex) =>
              itemIndex === index
                ? {
                  ...item,
                  returnQuantity:
                    value,
                }
                : item
          )
      )

      const returnQtyStr = String(value || '').trim()
      const returnableQtyVal = getNumber(items[index]?.returnableQuantity)
      let errorMsg = ''

      if (returnQtyStr === '') {
        errorMsg = 'Return quantity is required.'
      } else {
        const returnQtyVal = Number(returnQtyStr)
        if (isNaN(returnQtyVal)) {
          errorMsg = 'Return quantity must be a valid number.'
        } else if (returnQtyVal < 0) {
          errorMsg = 'Return quantity cannot be negative.'
        } else if (returnQtyVal > returnableQtyVal) {
          errorMsg = `Return quantity cannot exceed the returnable quantity of ${returnableQtyVal}.`
        }
      }

      setValidationErrors(
        (previous) => {
          const newItemErrors = { ...(previous?.itemErrors || {}) }
          if (errorMsg) {
            newItemErrors[index] = {
              ...(newItemErrors[index] || {}),
              returnQuantity: errorMsg
            }
          } else {
            if (newItemErrors[index]) {
              const { returnQuantity, ...rest } = newItemErrors[index]
              if (Object.keys(rest).length > 0) {
                newItemErrors[index] = rest
              } else {
                delete newItemErrors[index]
              }
            }
          }

          const nextErrors = { ...previous }
          if (Object.keys(newItemErrors).length > 0) {
            nextErrors.itemErrors = newItemErrors
          } else {
            delete nextErrors.itemErrors
          }
          return nextErrors
        }
      )
    }


  // =========================================================
  // ADD ITEM
  // =========================================================

  const handleAddItem = () => {
    showToast(
      'Return items are loaded from the selected GRN. Select a GRN first.',
      'error'
    )
  }


  // =========================================================
  // REMOVE ITEM
  // =========================================================

  const handleRemoveItem =
    (index) => {
      setItems(
        (previous) =>
          previous.filter(
            (_, itemIndex) =>
              itemIndex !== index
          )
      )
    }


  // =========================================================
  // VALIDATION
  // =========================================================

  const validateForm = () => {
    const errors = {}


    if (!supplierId) {
      errors.supplierId =
        'Supplier is required.'
    }


    if (!grnId) {
      errors.grnId =
        'Goods Receipt / GRN is required.'
    }


    if (!returnDate) {
      errors.returnDate =
        'Return date is required.'
    }


    if (!reason.trim()) {
      errors.reason =
        'Reason for return is required.'
    }


    if (!items.length) {
      errors.items =
        'No returnable items are available for this GRN.'
    }


    const itemErrors = []
    let totalReturnQty = 0

    items.forEach(
      (item, index) => {
        const rowErrors = {}
        const returnQtyStr = String(item.returnQuantity || '').trim()

        if (returnQtyStr === '') {
          rowErrors.returnQuantity = 'Return quantity is required.'
        } else {
          const returnQuantity = Number(returnQtyStr)
          const returnableQuantity = getNumber(item.returnableQuantity)
          const price = getNumber(item.price)

          if (isNaN(returnQuantity)) {
            rowErrors.returnQuantity = 'Return quantity must be a valid number.'
          } else if (returnQuantity < 0) {
            rowErrors.returnQuantity = 'Return quantity cannot be negative.'
          } else if (returnQuantity > returnableQuantity) {
            rowErrors.returnQuantity = `Return quantity cannot exceed the returnable quantity of ${returnableQuantity}.`
          } else {
            totalReturnQty += returnQuantity
          }

          if (price < 0) {
            rowErrors.price = 'Unit price cannot be negative.'
          }
        }

        if (Object.keys(rowErrors).length) {
          itemErrors[index] = rowErrors
        }
      }
    )

    if (items.length > 0 && totalReturnQty <= 0 && !itemErrors.some(x => x && x.returnQuantity)) {
      errors.items = 'At least one item must have a return quantity greater than 0.'
    }

    if (itemErrors.filter(Boolean).length > 0) {
      errors.itemErrors = itemErrors
    }


    setValidationErrors(
      errors
    )

    return (
      Object.keys(errors)
        .length === 0
    )
  }


  // =========================================================
  // SUBMIT
  // =========================================================

  const handleSubmit =
    async (event) => {
      event.preventDefault()

      if (submitting) {
        return
      }


      if (!validateForm()) {
        showToast(
          'Please resolve the validation errors before submitting.',
          'error'
        )

        return
      }


      setSubmitting(true)


      try {
        const payload = {
          supplierId:
            Number(supplierId),

          grnId:
            Number(grnId),

          returnDate,

          reason:
            reason.trim(),

          items:
            items
              .filter(item => getNumber(item.returnQuantity) > 0)
              .map(
                (item) => ({
                  productId:
                    Number(
                      item.productId
                    ),

                  variantId:
                    item.variantId
                      ? Number(
                        item.variantId
                      )
                      : null,

                  returnQuantity:
                    Number(
                      item.returnQuantity
                    ),
                })
              ),
        }


        console.log(
          'Purchase Return payload:',
          payload
        )


        if (isEditMode) {
          await updatePurchaseReturn(
            id,
            payload
          )
        } else {
          await createPurchaseReturn(
            payload
          )
        }


        showToast(
          isEditMode
            ? 'Purchase return updated successfully.'
            : 'Purchase return created successfully.',
          'success'
        )


        navigate(
          '/inventory/purchase-returns'
        )

      } catch (err) {
        console.error(
          'Purchase Return save error:',
          err
        )

        showToast(
          err?.response?.data?.message ||
          err?.response?.data?.title ||
          err?.message ||
          'Failed to save purchase return.',
          'error'
        )
      } finally {
        setSubmitting(false)
      }
    }


  // =========================================================
  // LOADING
  // =========================================================

  if (loading) {
    return (
      <main>
        <PageHeader
          title={
            isEditMode
              ? `Edit Purchase Return #${id}`
              : 'Create Purchase Return'
          }
          subtitle="Manage supplier goods returns against actual goods receipts."
          primaryAction={{
            icon: ArrowLeft,
            label: 'Back to Returns',
            onClick: () =>
              navigate(
                '/inventory/purchase-returns'
              ),
            variant: 'secondary',
          }}
        />

        <StateBlock
          state="loading"
          message="Loading purchase return data..."
        />
      </main>
    )
  }


  // =========================================================
  // ERROR
  // =========================================================

  if (error) {
    return (
      <main>
        <PageHeader
          title={
            isEditMode
              ? `Edit Purchase Return #${id}`
              : 'Create Purchase Return'
          }
          subtitle="Manage supplier goods returns against actual goods receipts."
          primaryAction={{
            icon: ArrowLeft,
            label: 'Back to Returns',
            onClick: () =>
              navigate(
                '/inventory/purchase-returns'
              ),
            variant: 'secondary',
          }}
        />

        <div className="purchase-returns-error-card card">
          <AlertCircle
            size={24}
            className="error-icon"
          />

          <div>
            <h3>
              We could not load this workspace
            </h3>

            <p>{error}</p>
          </div>

          <button
            type="button"
            className="erp-button erp-button--primary"
            onClick={
              loadReferenceData
            }
          >
            Retry
          </button>
        </div>
      </main>
    )
  }


  // =========================================================
  // MAIN
  // =========================================================

  return (
    <main>
      <PageHeader
        title={
          isEditMode
            ? `Edit Purchase Return #${id}`
            : 'Create Purchase Return'
        }
        subtitle={
          isEditMode
            ? 'Update the supplier goods return transaction.'
            : 'Return goods to the supplier against an actual GRN.'
        }
        primaryAction={{
          icon: ArrowLeft,
          label: 'Back to Returns',
          onClick: () =>
            navigate(
              '/inventory/purchase-returns'
            ),
          variant: 'secondary',
        }}
      />


      <form
        onSubmit={handleSubmit}
        noValidate
      >

        {/* HEADER */}

        <section className="card form-section-card">
          <h3 className="section-title">
            Return Header Details
          </h3>

          <div className="form-grid">

            {/* SUPPLIER */}

            <div className="form-field">
              <label htmlFor="supplierId">
                Supplier{' '}
                <span className="required-star">
                  *
                </span>
              </label>

              <select
                id="supplierId"
                value={supplierId}
                onChange={
                  handleSupplierChange
                }
                disabled={
                  isEditMode
                }
                className={
                  validationErrors.supplierId
                    ? 'input-error'
                    : ''
                }
              >
                <option value="">
                  -- Select Supplier --
                </option>

                {suppliers.map(
                  (supplier) => {
                    const supplierValue =
                      String(
                        getId(
                          supplier
                        ) ?? ''
                      )

                    if (
                      !supplierValue
                    ) {
                      return null
                    }

                    return (
                      <option
                        key={
                          supplierValue
                        }
                        value={
                          supplierValue
                        }
                      >
                        {getSupplierName(
                          supplier
                        )}
                      </option>
                    )
                  }
                )}
              </select>

              {validationErrors.supplierId && (
                <span className="field-error">
                  {
                    validationErrors.supplierId
                  }
                </span>
              )}
            </div>


            {/* GRN */}

            <div className="form-field">
              <label htmlFor="grnId">
                Goods Receipt / GRN{' '}
                <span className="required-star">
                  *
                </span>
              </label>

              <select
                id="grnId"
                value={grnId}
                onChange={
                  handleGrnChange
                }
                disabled={
                  !supplierId ||
                  isEditMode
                }
                className={
                  validationErrors.grnId
                    ? 'input-error'
                    : ''
                }
              >
                <option value="">
                  {!supplierId
                    ? '-- Select Supplier First --'
                    : availableGrns.length === 0
                      ? 'No eligible GRNs available'
                      : '-- Select GRN --'}
                </option>

                {availableGrns.map(
                  (grn) => {
                    const value =
                      String(
                        getGrnId(
                          grn
                        ) ?? ''
                      )

                    if (!value) {
                      return null
                    }

                    const date =
                      grn?.receivedDate ??
                      grn?.received_date ??
                      grn?.date

                    return (
                      <option
                        key={value}
                        value={value}
                      >
                        {getGrnNumber(
                          grn
                        )}

                        {date
                          ? ` (${String(
                            date
                          ).slice(
                            0,
                            10
                          )})`
                          : ''}
                      </option>
                    )
                  }
                )}
              </select>

              {validationErrors.grnId && (
                <span className="field-error">
                  {
                    validationErrors.grnId
                  }
                </span>
              )}

              {validationErrors.grnItems && (
                <span className="field-error">
                  {
                    validationErrors.grnItems
                  }
                </span>
              )}
            </div>


            {/* DATE */}

            <div className="form-field">
              <label htmlFor="returnDate">
                Return Date{' '}
                <span className="required-star">
                  *
                </span>
              </label>

              <input
                id="returnDate"
                type="date"
                value={returnDate}
                onChange={(event) =>
                  setReturnDate(
                    event.target.value
                  )
                }
                className={
                  validationErrors.returnDate
                    ? 'input-error'
                    : ''
                }
              />

              {validationErrors.returnDate && (
                <span className="field-error">
                  {
                    validationErrors.returnDate
                  }
                </span>
              )}
            </div>


            {/* REASON */}

            <div className="form-field full-width">
              <label htmlFor="reason">
                Reason for Return{' '}
                <span className="required-star">
                  *
                </span>
              </label>

              <textarea
                id="reason"
                rows={3}
                placeholder="Enter the reason for returning the goods..."
                value={reason}
                onChange={(event) =>
                  setReason(
                    event.target.value
                  )
                }
                className={
                  validationErrors.reason
                    ? 'input-error'
                    : ''
                }
              />

              {validationErrors.reason && (
                <span className="field-error">
                  {
                    validationErrors.reason
                  }
                </span>
              )}
            </div>

          </div>
        </section>


        {/* ITEMS */}

        <section className="card form-section-card">
          <div className="section-header-row">
            <h3 className="section-title">
              Returned Items
            </h3>

            <button
              type="button"
              className="erp-button erp-button--secondary add-row-btn"
              onClick={
                handleAddItem
              }
              disabled={
                !grnId ||
                loadingGrnItems
              }
            >
              <Plus size={14} />
              Items From GRN
            </button>
          </div>


          {validationErrors.items && (
            <div className="form-global-error">
              <AlertCircle size={15} />

              {
                validationErrors.items
              }
            </div>
          )}


          {loadingGrnItems && (
            <StateBlock
              state="loading"
              message="Loading returnable items from GRN..."
            />
          )}


          {!loadingGrnItems && (
            <div className="items-table-container" style={{ width: '100%', maxWidth: '100%', overflowX: 'auto', display: 'block' }}>
              <table className="items-table" style={{ width: '100%', minWidth: '1100px', tableLayout: 'fixed' }}>
                <thead>
                  <tr>
                    <th style={{ width: '250px', textAlign: 'left' }}>Product</th>
                    <th style={{ width: '120px', textAlign: 'left' }}>Variant</th>
                    <th style={{ width: '100px', textAlign: 'center' }}>Received Qty</th>
                    <th style={{ width: '130px', textAlign: 'center' }}>Previously Returned</th>
                    <th style={{ width: '110px', textAlign: 'center' }}>Returnable Qty</th>
                    <th style={{ width: '110px', textAlign: 'center' }}>Return Qty *</th>
                    <th style={{ width: '110px', textAlign: 'right' }}>Unit Price</th>
                    <th style={{ width: '110px', textAlign: 'right' }}>Total</th>
                    <th style={{ width: '60px', textAlign: 'center' }} />
                  </tr>
                </thead>

                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td
                        colSpan="9"
                        className="text-center"
                      >
                        {grnId
                          ? 'No returnable items found for this GRN.'
                          : 'Select a supplier and GRN to load returnable items.'}
                      </td>
                    </tr>
                  ) : (
                    items.map(
                      (
                        item,
                        index
                      ) => {
                        const itemErrors =
                          validationErrors
                            .itemErrors?.[
                          index
                          ] || {}

                        const lineTotal =
                          getNumber(
                            item.returnQuantity
                          ) *
                          getNumber(
                            item.price
                          )


                        return (
                          <tr
                            key={
                              item.id
                            }
                          >
                            <td>
                              <div className="font-semibold" style={{ wordBreak: 'break-word', whiteSpace: 'normal' }}>
                                {
                                  item.productName
                                }
                              </div>

                              <small className="text-muted">
                                ID: {
                                  item.productId
                                }
                              </small>
                            </td>

                            <td>
                              {
                                item.variantName ||
                                '-'
                              }
                            </td>

                            <td className="text-center">
                              {
                                item.receivedQuantity
                              }
                            </td>

                            <td className="text-center">
                              {
                                item.previouslyReturnedQuantity
                              }
                            </td>

                            <td className="text-center font-semibold">
                              {
                                item.returnableQuantity
                              }
                            </td>

                            <td className="text-center">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                max={
                                  item.returnableQuantity
                                }
                                value={
                                  item.returnQuantity
                                }
                                onChange={(
                                  event
                                ) =>
                                  handleReturnQuantityChange(
                                    index,
                                    event
                                      .target
                                      .value
                                  )
                                }
                                className={
                                  itemErrors.returnQuantity
                                    ? 'input-error'
                                    : ''
                                }
                                style={{ width: '100%', textAlign: 'center', boxSizing: 'border-box' }}
                              />

                              {itemErrors.returnQuantity && (
                                <span className="field-error" style={{ display: 'block', marginTop: '4px', fontSize: '11px' }}>
                                  {
                                    itemErrors.returnQuantity
                                  }
                                </span>
                              )}
                            </td>

                            <td className="text-right">
                              {formatCurrency(
                                getNumber(
                                  item.price
                                )
                              )}
                            </td>

                            <td className="text-right font-semibold">
                              {formatCurrency(
                                lineTotal
                              )}
                            </td>

                            <td className="text-center">
                              <button
                                type="button"
                                className="icon-action-btn delete-icon"
                                title="Remove Line Item"
                                onClick={() =>
                                  handleRemoveItem(
                                    index
                                  )
                                }
                              >
                                <Trash2
                                  size={
                                    16
                                  }
                                />
                              </button>
                            </td>
                          </tr>
                        )
                      }
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}


          <div className="return-totals-summary">
            <div className="total-amount-box">
              <span className="total-label">
                Total Return Amount:
              </span>

              <span className="total-value">
                {formatCurrency(
                  totalReturnAmount
                )}
              </span>
            </div>
          </div>
        </section>


        {/* SUBMIT */}

        <div className="form-submit-bar">
          <button
            type="button"
            className="erp-button erp-button--secondary"
            onClick={() =>
              navigate(
                '/inventory/purchase-returns'
              )
            }
            disabled={submitting}
          >
            Cancel
          </button>

          <button
            type="submit"
            className="erp-button erp-button--primary"
            disabled={
              submitting ||
              loadingGrnItems ||
              !items.length
            }
          >
            <Save size={15} />

            {submitting
              ? 'Saving...'
              : isEditMode
                ? 'Update Return'
                : 'Save Return'}
          </button>
        </div>

      </form>
    </main>
  )
}