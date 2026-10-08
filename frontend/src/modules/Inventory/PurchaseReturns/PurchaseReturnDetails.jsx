import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

import { useNavigate, useParams } from 'react-router-dom'

import {
  AlertCircle,
  ArrowLeft,
  Pencil,
  RefreshCw,
} from 'lucide-react'

import PageHeader from '../../../components/common/PageHeader'
import StateBlock from '../../../components/common/StateBlock'

import {
  getPurchaseReturnById,
} from '../../../api/purchaseReturnApi'

import {
  formatCurrency,
  formatDate,
} from '../../../utils/helpers'

import './PurchaseReturns.css'

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

const getResponseData = (response) => {
  if (
    response?.data !== undefined &&
    !Array.isArray(response?.data)
  ) {
    return response.data
  }

  return response
}

const getItems = (record) => {
  if (Array.isArray(record?.items)) {
    return record.items
  }

  if (Array.isArray(record?.returnItems)) {
    return record.returnItems
  }

  if (Array.isArray(record?.purchaseReturnItems)) {
    return record.purchaseReturnItems
  }

  return []
}

const getSupplierName = (record) => {
  return (
    record?.supplierName ??
    record?.supplier_name ??
    record?.supplier?.name ??
    (record?.supplierId
      ? `Supplier #${record.supplierId}`
      : '-')
  )
}

const getGrnNumber = (record) => {
  return (
    record?.grnNumber ??
    record?.grn_number ??
    record?.grn?.grnNumber ??
    record?.grn?.grn_number ??
    (record?.grnId
      ? `GRN-${record.grnId}`
      : '-')
  )
}

const getProductName = (item) => {
  return (
    item?.productName ??
    item?.product_name ??
    item?.product?.name ??
    item?.name ??
    (item?.productId
      ? `Product #${item.productId}`
      : '-')
  )
}

const getVariantName = (item) => {
  return (
    item?.variantName ??
    item?.variant_name ??
    item?.variant?.name ??
    item?.sku ??
    '-'
  )
}

const getItemQuantity = (item) => {
  return getNumber(
    item?.returnQuantity,
    item?.return_quantity,
    item?.quantity,
  )
}

const getItemPrice = (item) => {
  return getNumber(
    item?.unitPrice,
    item?.unit_price,
    item?.price,
    item?.unitCost,
    item?.unit_cost,
  )
}

export default function PurchaseReturnDetails() {
  const navigate = useNavigate()
  const { id } = useParams()

  const [record, setRecord] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadDetails = useCallback(async () => {
    if (!id) {
      setError(
        'Purchase return ID is missing.',
      )
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')

    try {
      const response =
        await getPurchaseReturnById(id)

      const data =
        getResponseData(response)

      if (!data) {
        throw new Error(
          'Purchase return was not found.',
        )
      }

      setRecord(data)
    } catch (err) {
      console.error(
        'Purchase Return Details API error:',
        err,
      )

      setRecord(null)

      setError(
        err?.response?.data?.message ||
        err?.response?.data?.title ||
        err?.message ||
        'Failed to load purchase return details.',
      )
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadDetails()
  }, [loadDetails])

  const items = useMemo(() => {
    return getItems(record)
  }, [record])

  const calculatedTotal = useMemo(() => {
    return items.reduce((sum, item) => {
      const quantity =
        getItemQuantity(item)

      const price =
        getItemPrice(item)

      return sum + quantity * price
    }, 0)
  }, [items])

  const totalAmount = getNumber(
    record?.totalAmount,
    record?.total_amount,
    record?.totalReturnAmount,
    calculatedTotal,
  )

  const returnId =
    record?.purchaseReturnId ??
    record?.returnId ??
    record?.id ??
    id

  const displayId =
    record?.returnNumber ??
    record?.return_number ??
    (returnId ? `#${returnId}` : '')

  const supplierId =
    record?.supplierId ??
    record?.supplier_id

  const grnId =
    record?.grnId ??
    record?.grn_id

  const returnDate =
    record?.returnDate ??
    record?.return_date

  const reason =
    record?.reason ?? '-'

  if (loading) {
    return (
      <>
        <PageHeader
          title={`Purchase Return #${id}`}
          subtitle="View purchase return details."
          primaryAction={{
            icon: ArrowLeft,
            label: 'Back to Returns',
            onClick: () =>
              navigate(
                '/inventory/purchase-returns',
              ),
            variant: 'secondary',
          }}
        />

        <StateBlock
          state="loading"
          message="Loading purchase return details..."
        />
      </>
    )
  }

  if (error) {
    return (
      <>
        <PageHeader
          title={`Purchase Return #${id}`}
          subtitle="View purchase return details."
          primaryAction={{
            icon: ArrowLeft,
            label: 'Back to Returns',
            onClick: () =>
              navigate(
                '/inventory/purchase-returns',
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
            onClick={loadDetails}
          >
            <RefreshCw size={14} />
            Retry
          </button>
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title={`Purchase Return ${displayId.startsWith('#') ? displayId : `#${displayId}`}`}
        subtitle="View purchase return details."
        primaryAction={{
          icon: ArrowLeft,
          label: 'Back to Returns',
          onClick: () =>
            navigate(
              '/inventory/purchase-returns',
            ),
          variant: 'secondary',
        }}
      />

      <section className="card form-section-card">
        <div className="section-header-row">
          <h3 className="section-title">
            Return Details
          </h3>

          <button
            type="button"
            className="erp-button erp-button--secondary"
            onClick={() =>
              navigate(
                `/inventory/purchase-returns/edit/${returnId}`,
              )
            }
          >
            <Pencil size={14} />
            Edit
          </button>
        </div>

        <div className="form-grid">
          <div className="form-field">
            <label>Return ID</label>

            <div className="detail-value">
              {displayId}
            </div>
          </div>

          <div className="form-field">
            <label>Supplier</label>

            <div className="detail-value">
              {getSupplierName(record)}
            </div>

            {supplierId && (
              <small>
                Supplier ID: {supplierId}
              </small>
            )}
          </div>

          <div className="form-field">
            <label>
              Goods Receipt / GRN
            </label>

            <div className="detail-value">
              {getGrnNumber(record)}
            </div>

            {grnId && (
              <small>
                GRN ID: {grnId}
              </small>
            )}
          </div>

          <div className="form-field">
            <label>Return Date</label>

            <div className="detail-value">
              {returnDate
                ? formatDate(returnDate)
                : '-'}
            </div>
          </div>

          <div className="form-field full-width">
            <label>
              Reason for Return
            </label>

            <div className="detail-value">
              {reason}
            </div>
          </div>
        </div>
      </section>

      <section className="card form-section-card">
        <div className="section-header-row">
          <h3 className="section-title">
            Returned Items
          </h3>
        </div>

        <div className="items-table-container">
          <table className="items-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Variant</th>
                <th>Return Qty</th>
                <th>Unit Price</th>
                <th className="text-right">
                  Total
                </th>
              </tr>
            </thead>

            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="text-center"
                  >
                    No return items found.
                  </td>
                </tr>
              ) : (
                items.map((item, index) => {
                  const quantity =
                    getItemQuantity(item)

                  const price =
                    getItemPrice(item)

                  const lineTotal =
                    quantity * price

                  const itemKey =
                    item?.id ??
                    item?.returnItemId ??
                    `${item?.productId ?? 'product'}-${item?.variantId ?? 'variant'}-${index}`

                  return (
                    <tr key={itemKey}>
                      <td>
                        <div className="font-semibold">
                          {getProductName(
                            item,
                          )}
                        </div>

                        {item?.productId && (
                          <small>
                            Product ID:{' '}
                            {item.productId}
                          </small>
                        )}
                      </td>

                      <td>
                        {getVariantName(
                          item,
                        )}
                      </td>

                      <td>
                        {quantity}
                      </td>

                      <td>
                        {formatCurrency(
                          price,
                        )}
                      </td>

                      <td className="text-right font-semibold">
                        {formatCurrency(
                          lineTotal,
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="return-totals-summary">
          <div className="total-amount-box">
            <span className="total-label">
              Total Return Amount:
            </span>

            <span className="total-value">
              {formatCurrency(
                totalAmount,
              )}
            </span>
          </div>
        </div>
      </section>
    </>
  )
}