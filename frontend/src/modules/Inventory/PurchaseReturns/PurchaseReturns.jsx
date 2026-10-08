import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'

import { useNavigate } from 'react-router-dom'

import {
  AlertCircle,
  Eye,
  MoreVertical,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react'

import PageHeader from '../../../components/common/PageHeader'
import StateBlock from '../../../components/common/StateBlock'
import { showToast } from '../../../components/common/toast'
import FormModal from '../../../layouts/FormModal'

import {
  deletePurchaseReturn,
  getPurchaseReturns,
  getPurchaseReturnGrns,
  getPurchaseReturnSuppliers,
} from '../../../api/purchaseReturnApi'

import {
  formatCurrency,
  formatDate,
} from '../../../utils/helpers'

import './PurchaseReturns.css'


/**
 * Normalize API responses without hiding API errors.
 *
 * Supports:
 * 1. Direct array
 * 2. { data: [] }
 * 3. { data: { items: [] } }
 * 4. { items: [] }
 */
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


const getSupplierId = (supplier) =>
  supplier?.id ??
  supplier?.supplierId ??
  supplier?.supplier_id


const getSupplierName = (supplier) =>
  supplier?.name ??
  supplier?.supplierName ??
  supplier?.supplier_name ??
  (
    getSupplierId(supplier)
      ? `Supplier #${getSupplierId(supplier)}`
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


const getReturnId = (item) =>
  item?.purchaseReturnId ??
  item?.returnId ??
  item?.return_id ??
  item?.id


const getReturnNumberDisplay = (item) =>
  item?.returnNumber ??
  item?.return_number ??
  (getReturnId(item) ? `#${getReturnId(item)}` : '-')


const getReturnSupplierId = (item) =>
  item?.supplierId ??
  item?.supplier_id


const getReturnGrnId = (item) =>
  item?.grnId ??
  item?.grn_id


const getReturnDate = (item) =>
  item?.returnDate ??
  item?.return_date


const getTotalAmount = (item) =>
  item?.totalAmount ??
  item?.total_amount ??
  item?.totalReturnAmount ??
  0


export default function PurchaseReturns() {
  const navigate = useNavigate()

  // =========================================================
  // STATE
  // =========================================================

  const [returns, setReturns] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [grns, setGrns] = useState([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [searchQuery, setSearchQuery] = useState('')
  const [supplierFilter, setSupplierFilter] = useState('')

  const [deleteTargetId, setDeleteTargetId] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const [activeMenuId, setActiveMenuId] = useState(null)


  // =========================================================
  // CLOSE ACTION MENU WHEN CLICKING OUTSIDE
  // =========================================================

  useEffect(() => {
    const handleOutsideClick = () => {
      setActiveMenuId(null)
    }

    document.addEventListener('click', handleOutsideClick)

    return () => {
      document.removeEventListener(
        'click',
        handleOutsideClick
      )
    }
  }, [])


  // =========================================================
  // LOAD DATA
  // =========================================================

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const [
        returnsResponse,
        suppliersResponse,
      ] = await Promise.all([
        getPurchaseReturns(),
        getPurchaseReturnSuppliers(),
      ])


      const returnsData =
        getArrayFromResponse(returnsResponse)

      const suppliersData =
        getArrayFromResponse(suppliersResponse)


      if (returnsData === null) {
        throw new Error(
          'Purchase Returns API returned an unexpected response format.'
        )
      }

      if (suppliersData === null) {
        throw new Error(
          'Purchase Return Suppliers API returned an unexpected response format.'
        )
      }


      setReturns(returnsData)
      setSuppliers(suppliersData)
      setGrns([])

    } catch (err) {
      console.error(
        'Purchase Returns API error:',
        err
      )

      setReturns([])
      setSuppliers([])
      setGrns([])

      setError(
        err?.response?.data?.message ||
        err?.response?.data?.title ||
        err?.message ||
        'Failed to load Purchase Returns.'
      )
    } finally {
      setLoading(false)
    }
  }, [])


  useEffect(() => {
    fetchData()
  }, [fetchData])


  // =========================================================
  // SUPPLIER LOOKUP
  // =========================================================

  const suppliersMap = useMemo(() => {
    const map = {}

    suppliers.forEach((supplier) => {
      const id = getSupplierId(supplier)

      if (
        id === null ||
        id === undefined ||
        id === ''
      ) {
        return
      }

      map[String(id)] = getSupplierName(supplier)
    })

    return map
  }, [suppliers])


  // =========================================================
  // GRN LOOKUP
  // =========================================================

  const grnsMap = useMemo(() => {
    const map = {}

    grns.forEach((grn) => {
      const id = getGrnId(grn)

      if (
        id === null ||
        id === undefined ||
        id === ''
      ) {
        return
      }

      map[String(id)] = getGrnNumber(grn)
    })

    return map
  }, [grns])


  // =========================================================
  // FILTER RETURNS
  // =========================================================

  const filteredReturns = useMemo(() => {
    const query = searchQuery
      .trim()
      .toLowerCase()

    return returns.filter((item) => {
      const returnId = String(
        getReturnId(item) ?? ''
      ).toLowerCase()

      const supplierId =
        getReturnSupplierId(item)

      const grnId =
        getReturnGrnId(item)

      const supplierName = String(
        suppliersMap[String(supplierId ?? '')] ??
        item?.supplierName ??
        item?.supplier_name ??
        ''
      ).toLowerCase()

      const grnNumber = String(
        grnsMap[String(grnId ?? '')] ??
        item?.grnNumber ??
        item?.grn_number ??
        ''
      ).toLowerCase()

      const reason = String(
        item?.reason ?? ''
      ).toLowerCase()


      const matchesSearch =
        !query ||
        returnId.includes(query) ||
        supplierName.includes(query) ||
        grnNumber.includes(query) ||
        reason.includes(query)


      const matchesSupplier =
        !supplierFilter ||
        String(supplierId ?? '') ===
        String(supplierFilter)


      return (
        matchesSearch &&
        matchesSupplier
      )
    })
  }, [
    returns,
    suppliersMap,
    grnsMap,
    searchQuery,
    supplierFilter,
  ])


  // =========================================================
  // DELETE
  // =========================================================

  const handleDeleteConfirm = async () => {
    if (
      deleteTargetId === null ||
      deleteTargetId === undefined ||
      deleting
    ) {
      return
    }

    setDeleting(true)

    try {
      await deletePurchaseReturn(
        deleteTargetId
      )

      setReturns((previous) =>
        previous.filter((item) => {
          const itemId =
            getReturnId(item)

          return (
            String(itemId) !==
            String(deleteTargetId)
          )
        })
      )

      showToast(
        'Purchase return deleted successfully.',
        'success'
      )

    } catch (err) {
      console.error(
        'Delete Purchase Return error:',
        err
      )

      showToast(
        err?.response?.data?.message ||
        err?.response?.data?.title ||
        err?.message ||
        'Failed to delete purchase return.',
        'error'
      )
    } finally {
      setDeleting(false)
      setDeleteTargetId(null)
    }
  }


  // =========================================================
  // CREATE
  // =========================================================

  const handleCreate = () => {
    navigate(
      '/inventory/purchase-returns/create'
    )
  }


  // =========================================================
  // VIEW
  // =========================================================

  const handleView = (id) => {
    if (
      id === null ||
      id === undefined
    ) {
      return
    }

    setActiveMenuId(null)

    navigate(
      `/inventory/purchase-returns/${id}`
    )
  }


  // =========================================================
  // EDIT
  // =========================================================

  const handleEdit = (id) => {
    if (
      id === null ||
      id === undefined
    ) {
      return
    }

    setActiveMenuId(null)

    navigate(
      `/inventory/purchase-returns/edit/${id}`
    )
  }


  // =========================================================
  // DELETE
  // =========================================================

  const handleDelete = (id) => {
    if (
      id === null ||
      id === undefined
    ) {
      return
    }

    setActiveMenuId(null)
    setDeleteTargetId(id)
  }


  // =========================================================
  // RESET
  // =========================================================

  const handleResetFilters = () => {
    setSearchQuery('')
    setSupplierFilter('')
  }


  // =========================================================
  // RENDER
  // =========================================================

  return (
    <main>
      <PageHeader
        title="Purchase Returns"
        subtitle="Manage and track goods returned to suppliers."
        primaryAction={{
          icon: Plus,
          label: 'Create Purchase Return',
          onClick: handleCreate,
        }}
      />


      {/* TOOLBAR */}

      <section className="purchase-returns-toolbar card">
        <div className="toolbar-search">
          <Search
            size={16}
            className="search-icon"
          />

          <input
            type="text"
            placeholder="Search by Return ID, Supplier, GRN or Reason"
            value={searchQuery}
            onChange={(event) =>
              setSearchQuery(
                event.target.value
              )
            }
          />

          {searchQuery && (
            <button
              type="button"
              className="clear-search-btn"
              onClick={() =>
                setSearchQuery('')
              }
            >
              Clear
            </button>
          )}
        </div>


        <div className="toolbar-filters">
          <div className="filter-group">
            <label htmlFor="supplier-select">
              Supplier:
            </label>

            <select
              id="supplier-select"
              value={supplierFilter}
              onChange={(event) =>
                setSupplierFilter(
                  event.target.value
                )
              }
            >
              <option value="">
                All Suppliers
              </option>

              {suppliers.map((supplier) => {
                const supplierId =
                  getSupplierId(supplier)

                if (
                  supplierId === null ||
                  supplierId === undefined ||
                  supplierId === ''
                ) {
                  return null
                }

                return (
                  <option
                    key={String(supplierId)}
                    value={String(supplierId)}
                  >
                    {getSupplierName(supplier)}
                  </option>
                )
              })}
            </select>
          </div>


          {(searchQuery ||
            supplierFilter) && (
              <button
                className="erp-button erp-button--secondary"
                type="button"
                onClick={
                  handleResetFilters
                }
              >
                Reset Filters
              </button>
            )}
        </div>
      </section>


      {/* LOADING */}

      {loading && (
        <StateBlock
          state="loading"
          message="Loading purchase returns..."
        />
      )}


      {/* ERROR */}

      {!loading && error && (
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
            className="erp-button erp-button--primary"
            onClick={fetchData}
            type="button"
          >
            <RefreshCw size={14} />
            Retry
          </button>
        </div>
      )}


      {/* EMPTY */}

      {!loading &&
        !error &&
        filteredReturns.length === 0 && (
          <div className="purchase-returns-empty card">
            <p className="empty-title">
              No purchase returns found
            </p>

            <p className="empty-subtitle">
              {searchQuery ||
                supplierFilter
                ? 'No returns match your filter criteria.'
                : 'Click "Create Purchase Return" to record your first return.'}
            </p>

            {!searchQuery &&
              !supplierFilter && (
                <button
                  className="erp-button erp-button--primary"
                  onClick={
                    handleCreate
                  }
                  type="button"
                >
                  <Plus size={14} />
                  Create Purchase Return
                </button>
              )}
          </div>
        )}


      {/* TABLE */}

      {!loading &&
        !error &&
        filteredReturns.length > 0 && (
          <section className="card purchase-returns-table-container">
            <table className="purchase-returns-table">
              <thead>
                <tr>
                  <th>Return ID</th>
                  <th>Supplier</th>
                  <th>GRN</th>
                  <th>Return Date</th>
                  <th className="text-right">
                    Total Amount
                  </th>
                  <th>Reason</th>
                  <th className="text-right">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredReturns.map((row) => {
                  const returnId =
                    getReturnId(row)

                  const supplierId =
                    getReturnSupplierId(row)

                  const grnId =
                    getReturnGrnId(row)

                  const supplierName =
                    suppliersMap[
                    String(supplierId ?? '')
                    ] ??
                    row?.supplierName ??
                    row?.supplier_name ??
                    (
                      supplierId
                        ? `Supplier #${supplierId}`
                        : '-'
                    )

                  const grnNumber =
                    grnsMap[
                    String(grnId ?? '')
                    ] ??
                    row?.grnNumber ??
                    row?.grn_number ??
                    (
                      grnId
                        ? `GRN-${grnId}`
                        : '-'
                    )

                  const returnDate =
                    getReturnDate(row)

                  const totalAmount =
                    getTotalAmount(row)

                  const reason =
                    row?.reason ?? ''


                  return (
                    <tr key={returnId}>
                      <td className="font-semibold text-primary">
                        {getReturnNumberDisplay(row)}
                      </td>

                      <td>
                        {supplierName}
                      </td>

                      <td>
                        <span className="grn-badge">
                          {grnNumber}
                        </span>
                      </td>

                      <td>
                        {returnDate
                          ? formatDate(
                            returnDate
                          )
                          : '-'}
                      </td>

                      <td className="text-right font-semibold">
                        {formatCurrency(
                          totalAmount
                        )}
                      </td>

                      <td
                        className="reason-cell"
                        title={reason}
                      >
                        {reason
                          ? reason.length > 50
                            ? `${reason.slice(
                              0,
                              50
                            )}...`
                            : reason
                          : '-'}
                      </td>

                      <td className="text-right actions-cell">
                        <div className="actions-dropdown-container">
                          <button
                            className={`action-menu-btn ${activeMenuId ===
                              returnId
                              ? 'active'
                              : ''
                              }`}
                            type="button"
                            title="Actions"
                            onClick={(event) => {
                              event.stopPropagation()

                              setActiveMenuId(
                                (previous) =>
                                  previous ===
                                    returnId
                                    ? null
                                    : returnId
                              )
                            }}
                          >
                            <MoreVertical
                              size={18}
                            />
                          </button>

                          {activeMenuId ===
                            returnId && (
                              <div
                                className="action-dropdown-menu"
                                onClick={(event) =>
                                  event.stopPropagation()
                                }
                              >
                                <button
                                  type="button"
                                  className="action-dropdown-item"
                                  onClick={() =>
                                    handleView(
                                      returnId
                                    )
                                  }
                                >
                                  <Eye size={15} />
                                  View Details
                                </button>

                                <button
                                  type="button"
                                  className="action-dropdown-item"
                                  onClick={() =>
                                    handleEdit(
                                      returnId
                                    )
                                  }
                                >
                                  <Pencil size={15} />
                                  Edit
                                </button>

                                <button
                                  type="button"
                                  className="action-dropdown-item danger-item"
                                  onClick={() =>
                                    handleDelete(
                                      returnId
                                    )
                                  }
                                >
                                  <Trash2 size={15} />
                                  Delete
                                </button>
                              </div>
                            )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </section>
        )}


      {/* DELETE MODAL */}

      {deleteTargetId !== null &&
        deleteTargetId !== undefined && (
          <FormModal
            isOpen={true}
            title="Delete Purchase Return?"
            onClose={() =>
              !deleting &&
              setDeleteTargetId(null)
            }
          >
            <div className="delete-confirm-content">
              <p>
                This action will permanently
                remove this purchase return
                and its associated items.
              </p>

              <p className="delete-warning">
                Return ID: #{deleteTargetId}
              </p>

              <div className="form-modal-actions">
                <button
                  className="erp-button erp-button--secondary"
                  type="button"
                  disabled={deleting}
                  onClick={() =>
                    setDeleteTargetId(null)
                  }
                >
                  Cancel
                </button>

                <button
                  className="erp-button erp-button--danger"
                  type="button"
                  disabled={deleting}
                  onClick={
                    handleDeleteConfirm
                  }
                >
                  {deleting
                    ? 'Deleting...'
                    : 'Delete'}
                </button>
              </div>
            </div>
          </FormModal>
        )}
    </main>
  )
}