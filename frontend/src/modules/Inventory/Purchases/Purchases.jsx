import { useEffect, useMemo, useState } from 'react'
import { Plus, RefreshCw } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  createPurchaseOrder,
  deletePurchaseOrder,
  getPurchaseOrders,
  updatePurchaseOrder,
} from '../../../api/businessApi'
import { getPurchaseIndents, updatePurchaseIndent } from '../../../api/purchaseIndentsApi'
import { apiRequest } from '../../../api/apiClient'
import { API_ENDPOINTS } from '../../../api/endpoints'
import { showToast } from '../../../components/common/toast'
import FormModal from '../../../layouts/FormModal'
import { useAuth } from '../../../hooks/useAuth'
import { formatCurrency, formatDate, getToday, createId } from '../../../utils/helpers'
import { StatusBadge } from '../../../components/erp'
import PurchasesTable from './components/PurchasesTable'
import PurchaseForm from './components/PurchaseForm'
import './Purchases.css'

const EMPTY_VALUE = 'Not Available'

function toApiId(value, label) {
  const parsed = Number(value)

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be selected from live API records.`)
  }

  return parsed
}

function getProductId(product) {
  return product?.id ?? product?.productId ?? product?.ProductId
}

function getProductPurchasePrice(product) {
  const candidates = [
    product?.costPrice ??
    product?.CostPrice,
    product?.purchasePrice ??
    product?.PurchasePrice,
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
  ]

  for (const candidate of candidates) {
    const price = Number(String(candidate ?? '').replace(/,/g, ''))
    if (Number.isFinite(price) && price > 0) {
      return price
    }
  }

  return 0
}

function getSafeText(value, fallback = EMPTY_VALUE) {
  const text = String(value ?? '').trim()
  return text && text !== '-' && text.toLowerCase() !== 'undefined' && text.toLowerCase() !== 'null'
    ? text
    : fallback
}

function getPurchaseOrderStatus(status) {
  const value = String(status || 'Ordered').trim()
  return value.toLowerCase() === 'pending' ? 'Ordered' : value
}

function formatSafeDate(value) {
  return value ? formatDate(value) : EMPTY_VALUE
}

function getPurchaseLines(purchase) {
  return Array.isArray(purchase?.items) && purchase.items.length > 0
    ? purchase.items
    : [{
        productId: purchase?.productId,
        productName: purchase?.productName || purchase?.product,
        variantId: purchase?.variantId,
        variantName: purchase?.variantName,
        unitName: purchase?.unitName,
        quantity: purchase?.quantity ?? purchase?.totalQuantity,
        price: purchase?.price ?? purchase?.unitPrice,
        total: purchase?.totalAmount,
        remarks: purchase?.remarks || purchase?.notes,
      }]
}

function getPurchaseQuantity(purchase) {
  return getPurchaseLines(purchase).reduce((sum, line) => sum + (Number(line.quantity) || 0), 0)
}

function getPurchaseTotal(purchase) {
  const explicitTotal = Number(purchase?.grandTotal || purchase?.totalAmount || 0)

  if (Number.isFinite(explicitTotal) && explicitTotal > 0) {
    return explicitTotal
  }

  return getPurchaseLines(purchase).reduce(
    (sum, line) => sum + (Number(line.quantity || 0) * Number(line.price ?? line.unitPrice ?? 0)),
    0,
  )
}

function getMatchingGrns(purchaseOrder, allGoodsReceipts = []) {
  if (!Array.isArray(allGoodsReceipts) || allGoodsReceipts.length === 0) {
    return []
  }

  const poId = String(purchaseOrder.id ?? purchaseOrder.poId ?? purchaseOrder.purchaseOrderId ?? '').trim()
  const poNum = String(purchaseOrder.poNumber ?? purchaseOrder.number ?? '').trim().toLowerCase()

  return allGoodsReceipts.filter((grn) => {
    const grnPoId = String(grn.poId ?? grn.purchaseOrderId ?? '').trim()
    const grnPoNum = String(grn.poNumber ?? grn.purchaseOrderNumber ?? '').trim().toLowerCase()

    const matchesId = poId && grnPoId && poId === grnPoId
    const matchesNum = poNum && grnPoNum && poNum === grnPoNum

    return matchesId || matchesNum
  })
}

function calculatePOStatus(purchase, matchingGrns) {
  const currentStatus = String(purchase?.status || '').trim()
  if (currentStatus.toLowerCase().includes('cancel')) {
    return 'Cancelled'
  }

  const rawItems = Array.isArray(purchase?.items) && purchase.items.length > 0
    ? purchase.items
    : [{
        productId: purchase?.productId,
        quantity: purchase?.quantity ?? purchase?.totalQuantity ?? 0,
      }]

  const allGrnItems = []
  for (const grn of matchingGrns) {
    const grnItems = Array.isArray(grn.items) && grn.items.length > 0
      ? grn.items
      : [{
          productId: grn.productId,
          receivedQuantity: grn.receivedQuantity ?? grn.quantityReceived ?? grn.acceptedQuantity ?? grn.quantity ?? 0,
        }]

    for (const item of grnItems) {
      allGrnItems.push(item)
    }
  }

  if (allGrnItems.length === 0) {
    return 'Ordered'
  }

  let totalOrdered = 0
  let totalReceived = 0
  let allItemsFullyReceived = true
  let anyItemReceived = false

  for (const item of rawItems) {
    const orderedQty = Number(item.quantity || 0)
    totalOrdered += orderedQty

    const itemGrnItems = allGrnItems.filter(
      (gi) => String(gi.productId || gi.id || '') === String(item.productId || item.id || '')
    )

    const itemReceivedQty = itemGrnItems.length > 0
      ? itemGrnItems.reduce(
          (sum, gi) => sum + Number(gi.receivedQuantity ?? gi.quantityReceived ?? gi.acceptedQuantity ?? gi.quantity ?? 0),
          0
        )
      : 0

    if (itemReceivedQty > 0) {
      anyItemReceived = true
    }

    if (itemReceivedQty < orderedQty) {
      allItemsFullyReceived = false
    }

    totalReceived += itemReceivedQty
  }

  if (allGrnItems.length > 0 && !anyItemReceived && totalReceived === 0) {
    totalReceived = allGrnItems.reduce(
      (sum, gi) => sum + Number(gi.receivedQuantity ?? gi.quantityReceived ?? gi.acceptedQuantity ?? gi.quantity ?? 0),
      0
    )
    if (totalReceived > 0) {
      anyItemReceived = true
    }
    allItemsFullyReceived = totalReceived >= totalOrdered && totalOrdered > 0
  }

  if (!anyItemReceived || totalReceived <= 0) {
    return 'Ordered'
  }

  if (allItemsFullyReceived && totalReceived >= totalOrdered && totalOrdered > 0) {
    return 'Received'
  }

  return 'Partially Received'
}

function enrichPurchaseOrders(orders, productsCatalog = [], goodsReceipts = [], purchaseIndents = []) {
  if (!Array.isArray(orders)) return []

  return orders.map((purchase) => {
    // Resolve matching GRNs
    const matchingGrns = getMatchingGrns(purchase, goodsReceipts)

    // Resolve matching source Purchase Indent
    const sourceIndentRef = String(
      purchase?.sourceIndentId ||
      purchase?.indentId ||
      purchase?.indentNumber ||
      purchase?.indentNo ||
      purchase?.sourceIndent ||
      ''
    ).trim().toLowerCase()

    const matchingIndent = (purchaseIndents || []).find((ind) => {
      const indId = String(ind?.id || ind?.indentId || '').trim().toLowerCase()
      const indNum = String(ind?.indentNumber || ind?.indentNo || '').trim().toLowerCase()
      return sourceIndentRef && ((indId && sourceIndentRef === indId) || (indNum && sourceIndentRef === indNum))
    })

    // Resolve Department
    const departmentCandidates = [
      purchase.departmentName,
      purchase.department,
      purchase.DepartmentName,
      purchase.Department,
      purchase.dept,
      purchase.deptName,
      matchingGrns[0]?.departmentName,
      matchingGrns[0]?.department,
      matchingGrns[0]?.DepartmentName,
      matchingGrns[0]?.Department,
      matchingIndent?.department,
      matchingIndent?.departmentName,
      matchingIndent?.Department,
      matchingIndent?.DepartmentName,
    ]

    let resolvedDepartment = ''
    for (const candidate of departmentCandidates) {
      const textVal = String(candidate ?? '').trim()
      if (textVal && textVal !== '-' && textVal.toLowerCase() !== 'undefined' && textVal.toLowerCase() !== 'null') {
        resolvedDepartment = textVal
        break
      }
    }

    // Resolve lines and units
    const rawItems = Array.isArray(purchase.items) && purchase.items.length > 0
      ? purchase.items
      : [{
          productId: purchase.productId,
          productName: purchase.productName || purchase.product,
          variantId: purchase.variantId,
          variantName: purchase.variantName,
          unitName: purchase.unitName || purchase.unit || purchase.uom,
          quantity: purchase.quantity ?? purchase.totalQuantity,
          price: purchase.price ?? purchase.unitPrice,
          total: purchase.totalAmount,
          remarks: purchase.remarks || purchase.notes,
        }]

    const enrichedItems = rawItems.map((item) => {
      let price = Number(item.price ?? item.unitPrice ?? 0)
      const productId = item.productId || purchase.productId

      // Catalog product lookup
      const catalogProd = (productsCatalog || []).find(
        (p) => String(p.id ?? p.productId ?? p.ProductId ?? '') === String(productId ?? '')
      )

      if (price <= 0 && catalogProd) {
        price = Number(catalogProd.cost || catalogProd.costPrice || catalogProd.purchasePrice || catalogProd.price || 0)
      }

      // Matching GRN item lookup
      let matchingGrnItem = null
      for (const grn of matchingGrns) {
        const grnItems = Array.isArray(grn.items) && grn.items.length > 0 ? grn.items : [grn]
        matchingGrnItem = grnItems.find(
          (gi) => String(gi.productId || gi.id || '') === String(productId || '')
        )
        if (matchingGrnItem) break
      }

      // Unit candidates
      const unitCandidates = [
        item.unitName,
        item.unit,
        item.uom,
        item.uomName,
        item.unitSymbol,
        item.unitOfMeasure,
        item.UnitName,
        item.Unit,
        item.Uom,
        item.UOM,
        matchingGrnItem?.unitName,
        matchingGrnItem?.unit,
        matchingGrnItem?.uom,
        matchingGrnItem?.unitSymbol,
        matchingGrnItem?.uomName,
        matchingGrnItem?.unitOfMeasure,
        catalogProd?.unitName,
        catalogProd?.unit,
        catalogProd?.uom,
        catalogProd?.unitSymbol,
        catalogProd?.uomName,
        catalogProd?.unitOfMeasure,
        catalogProd?.unit?.unitName,
        catalogProd?.unit?.name,
        catalogProd?.unit?.symbol,
        catalogProd?.UnitName,
        catalogProd?.Unit,
        catalogProd?.Uom,
      ]

      let resolvedUnit = ''
      for (const candidate of unitCandidates) {
        if (typeof candidate === 'object' && candidate !== null) {
          const nested = candidate.unitName || candidate.name || candidate.symbol || candidate.label
          if (nested && String(nested).trim()) {
            resolvedUnit = String(nested).trim()
            break
          }
        } else {
          const textVal = String(candidate ?? '').trim()
          if (textVal && textVal !== '-' && textVal.toLowerCase() !== 'undefined' && textVal.toLowerCase() !== 'null') {
            resolvedUnit = textVal
            break
          }
        }
      }

      const quantity = Number(item.quantity || 0)
      return {
        ...item,
        unitName: resolvedUnit || item.unitName || item.unit || 'Nos',
        price,
        unitPrice: price,
        total: Number(item.total || 0) || (quantity * price),
      }
    })

    const totalAmount = enrichedItems.reduce((sum, line) => sum + (Number(line.total) || 0), 0)
    const calculatedStatus = calculatePOStatus(purchase, matchingGrns)

    return {
      ...purchase,
      departmentName: resolvedDepartment,
      department: resolvedDepartment || purchase.department,
      items: enrichedItems,
      totalAmount: purchase.totalAmount > 0 ? purchase.totalAmount : totalAmount,
      grandTotal: purchase.grandTotal > 0 ? purchase.grandTotal : totalAmount,
      status: calculatedStatus,
    }
  })
}

function DetailField({ label, value, strong = false }) {
  return (
    <div className="purchase-details__field">
      <span>{label}</span>
      <strong className={strong ? 'purchase-details__value--emphasis' : ''}>{value}</strong>
    </div>
  )
}

export default function Purchases({
  products,
  suppliers,
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const [purchaseOrders, setPurchaseOrders] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [viewTarget, setViewTarget] = useState(null)
  const [prefilledData, setPrefilledData] = useState(null)
  const [editingItem, setEditingItem] = useState(null)

  const canCreate = hasPermission('purchases', 'create')
  const canDelete = hasPermission('purchases', 'delete')

  useEffect(() => {
    if (location.state && location.state.prefilledIndent) {
      const indent = location.state.prefilledIndent
      const prefilled = {
        supplierId: '',
        orderDate: getToday(),
        expectedDate: '',
        notes: `Imported from Indent Ref: ${indent.indentNumber || indent.indentId}`,
        sourceIndentId: indent.indentId,
        lineItems: indent.items && indent.items.length > 0
          ? indent.items.map(item => ({
              id: createId('POL'),
              productId: String(item.productId),
              quantity: String(item.quantity),
              price: String(getProductPurchasePrice(products?.find(p => String(getProductId(p)) === String(item.productId))) || ''),
            }))
          : [
              {
                id: createId('POL'),
                productId: String(indent.productId),
                quantity: String(indent.quantity),
                price: String(getProductPurchasePrice(products?.find(p => String(getProductId(p)) === String(indent.productId))) || ''),
              }
            ]
      }
      setPrefilledData(prefilled)
      setIsFormOpen(true)

      // Clear the routing state so refreshing doesn't reopen modal
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [location, products, navigate])

  const handleOpenEdit = (item) => {
    setEditingItem(item)
    const prefilled = {
      supplierId: String(item.supplierId || ''),
      orderDate: item.orderDate ? item.orderDate.slice(0, 10) : getToday(),
      expectedDate: item.expectedDate ? item.expectedDate.slice(0, 10) : '',
      notes: item.notes || '',
      lineItems: getPurchaseLines(item).map((line) => ({
        id: line.id || createId('POL'),
        productId: String(line.productId || ''),
        variantId: line.variantId ? String(line.variantId) : '',
        quantity: String(line.quantity || ''),
        price: String(line.price ?? line.unitPrice ?? ''),
      })),
    }
    setPrefilledData(prefilled)
    setIsFormOpen(true)
  }

  async function loadPurchaseOrders() {
    setIsLoading(true)
    setError('')

    const [poRes, grnRes, indentRes] = await Promise.all([
      getPurchaseOrders(),
      apiRequest(API_ENDPOINTS.goodsReceipts.list),
      getPurchaseIndents(1, 100),
    ])

    if (!poRes.success) {
      setError(poRes.error || 'Unable to load purchase orders.')
      setPurchaseOrders([])
      setIsLoading(false)
      return
    }

    const goodsReceipts = grnRes?.success ? (grnRes.data ?? []) : []
    const purchaseIndents = indentRes?.success ? (indentRes.data?.items ?? indentRes.data ?? []) : []
    setPurchaseOrders(enrichPurchaseOrders(poRes.data ?? [], products, goodsReceipts, purchaseIndents))
    setIsLoading(false)
  }

  useEffect(() => {
    let isMounted = true

    async function load() {
      setIsLoading(true)
      setError('')

      const [poRes, grnRes, indentRes] = await Promise.all([
        getPurchaseOrders(),
        apiRequest(API_ENDPOINTS.goodsReceipts.list),
        getPurchaseIndents(1, 100),
      ])

      if (!isMounted) {
        return
      }

      if (!poRes.success) {
        setError(poRes.error || 'Unable to load purchase orders.')
        setPurchaseOrders([])
      } else {
        const goodsReceipts = grnRes?.success ? (grnRes.data ?? []) : []
        const purchaseIndents = indentRes?.success ? (indentRes.data?.items ?? indentRes.data ?? []) : []
        setPurchaseOrders(enrichPurchaseOrders(poRes.data ?? [], products, goodsReceipts, purchaseIndents))
      }

      setIsLoading(false)
    }

    load()

    return () => {
      isMounted = false
    }
  }, [products])

  const summary = useMemo(() => {
    const totalValue = purchaseOrders.reduce(
      (sum, purchase) => sum + Number(purchase.totalAmount || 0),
      0,
    )
    const received = purchaseOrders.filter((purchase) =>
      String(purchase.status).toLowerCase().includes('received'),
    ).length
    const open = purchaseOrders.length - received

    return {
      total: purchaseOrders.length,
      open,
      received,
      totalValue,
    }
  }, [purchaseOrders])

  async function handleSave(data) {
    setIsSaving(true)

    try {
      const supplierId = toApiId(data.supplierId, 'Supplier')
      const lineItems = data.lineItems.map((lineItem) => ({
        productId: toApiId(lineItem.productId, 'Product'),
        variantId: lineItem.variantId ? toApiId(lineItem.variantId, 'Variant') : null,
        quantity: Number(lineItem.quantity),
        price: Number(lineItem.price),
        unitPrice: Number(lineItem.price),
      }))
      const firstLine = lineItems[0]
      const payload = {
        supplierId,
        productId: firstLine.productId,
        variantId: firstLine.variantId,
        quantity: lineItems.reduce((sum, lineItem) => sum + Number(lineItem.quantity || 0), 0),
        price: firstLine.price,
        unitPrice: firstLine.unitPrice,
        totalAmount: lineItems.reduce((sum, lineItem) => sum + Number(lineItem.quantity || 0) * Number(lineItem.price || 0), 0),
        orderDate: data.orderDate,
        expectedDate: data.expectedDate || null,
        notes: data.notes.trim(),
        items: lineItems,
      }

      let response
      if (editingItem) {
        response = await updatePurchaseOrder(editingItem.id, payload)
      } else {
        response = await createPurchaseOrder(payload)
      }

      if (!response.success) {
        throw new Error(response.error || `Unable to ${editingItem ? 'update' : 'create'} Purchase Order.`)
      }

      if (!editingItem && prefilledData && prefilledData.sourceIndentId) {
        await updatePurchaseIndent(prefilledData.sourceIndentId, { status: 'Ordered' })
      }

      await loadPurchaseOrders()

      showToast({
        type: 'success',
        title: 'Purchase Orders',
        message: `Purchase Order ${editingItem ? 'updated' : 'created'} successfully.`,
      })
      setIsFormOpen(false)
      setPrefilledData(null)
      setEditingItem(null)
    } catch (saveError) {
      showToast({
        type: 'error',
        title: 'Purchase Orders',
        message: saveError instanceof Error ? saveError.message : `Unable to ${editingItem ? 'update' : 'create'} purchase order.`,
      })
    } finally {
      setIsSaving(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) {
      return
    }

    const previousOrders = purchaseOrders
    setPurchaseOrders((currentValue) =>
      currentValue.filter((purchase) => String(purchase.id) !== String(deleteTarget.id)),
    )
    setDeleteTarget(null)

    const response = await deletePurchaseOrder(deleteTarget.id)

    if (!response.success) {
      setPurchaseOrders(previousOrders)
      await loadPurchaseOrders()
      showToast({
        type: 'error',
        title: 'Purchase Orders',
        message: response.error || 'Unable to delete purchase order.',
      })
      return
    }

    showToast({
      type: 'success',
      title: 'Purchase Orders',
      message: 'Purchase order deleted successfully.',
    })
  }

  return (
    <div className="page purchases-page">
      <header className="purchases-page__compact-header" aria-label="Purchases summary">
        <div className="purchases-page__compact-main">
          <h1>Purchases</h1>
          <div className="purchases-page__metrics" aria-label="Purchase order metrics">
            <span className="purchases-page__metric purchases-page__metric--success">
              {summary.total} Orders
            </span>
            <span className="purchases-page__metric purchases-page__metric--warning">
              {summary.open} Open
            </span>
            <span className="purchases-page__metric purchases-page__metric--info">
              {summary.received} Received
            </span>
            <span className="purchases-page__metric purchases-page__metric--value">
              {formatCurrency(summary.totalValue)} Value
            </span>
          </div>
        </div>
        {canCreate ? (
          <button
            type="button"
            className="button button-primary"
            onClick={() => setIsFormOpen(true)}
          >
            <Plus size={16} />
            Add Purchase
          </button>
        ) : null}
      </header>

      {error ? (
        <div className="message-box message-box--error page-error-banner" role="alert">
          {error}
          <button
            type="button"
            className="button button-secondary"
            onClick={loadPurchaseOrders}
          >
            <RefreshCw size={16} />
            Retry
          </button>
        </div>
      ) : null}

      <PurchasesTable
        purchases={purchaseOrders}
        canDelete={canDelete}
        onDelete={setDeleteTarget}
        onView={setViewTarget}
        onEdit={handleOpenEdit}
        onRefresh={loadPurchaseOrders}
        loading={isLoading}
      />

      {isFormOpen ? (
        <FormModal
          title={editingItem ? 'Edit Purchase Order' : null}
          className="edit-purchase-modal"
          onClose={() => {
            setIsFormOpen(false)
            setPrefilledData(null)
            setEditingItem(null)
          }}
        >
          <PurchaseForm
            suppliers={suppliers}
            products={products}
            initialData={prefilledData}
            onSubmit={handleSave}
            onCancel={() => {
              setIsFormOpen(false)
              setPrefilledData(null)
              setEditingItem(null)
            }}
            isSubmitting={isSaving}
          />
        </FormModal>
      ) : null}

      {deleteTarget ? (
        <FormModal
          title="Delete Purchase Order"
          onClose={() => setDeleteTarget(null)}
        >
          <div className="purchase-form__delete-dialog">
            <div className="delete-confirmation__copy">
              <p>
                Are you sure you want to delete{' '}
                <strong>{deleteTarget.poNumber || deleteTarget.poId}</strong>?
              </p>
              <p className="delete-confirmation__warning">This action cannot be undone.</p>
            </div>
            <div className="button-row">
              <button type="button" className="button button-secondary button-cancel" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button type="button" className="button button-danger" onClick={confirmDelete}>
                Delete
              </button>
            </div>
          </div>
        </FormModal>
      ) : null}

      {viewTarget ? (
        <FormModal
          title="Purchase Order Details"
          subtitle={`Detailed view of ${viewTarget.poNumber || viewTarget.poId}`}
          className="purchase-details-modal"
          onClose={() => setViewTarget(null)}
        >
          <div className="purchase-details">
            <section className="purchase-details__hero">
              <div>
                <span className="purchase-details__eyebrow">Purchase Order</span>
                <h3>{getSafeText(viewTarget.poNumber || viewTarget.poId)}</h3>
                <p>{getSafeText(viewTarget.notes || viewTarget.remarks, 'No purchase notes recorded.')}</p>
              </div>
              <StatusBadge type={getPurchaseOrderStatus(viewTarget.status).toLowerCase().includes('received') ? 'received' : getPurchaseOrderStatus(viewTarget.status).toLowerCase().includes('cancel') ? 'critical' : 'ordered'}>
                {getPurchaseOrderStatus(viewTarget.status)}
              </StatusBadge>
            </section>

            <section className="purchase-details__summary">
              <DetailField label="Total Quantity" value={getPurchaseQuantity(viewTarget) || 0} strong />
              <DetailField label="Subtotal" value={formatCurrency(viewTarget.subtotal || getPurchaseTotal(viewTarget))} strong />
              <DetailField label="Tax" value={formatCurrency(viewTarget.taxAmount || 0)} />
              <DetailField label="Discount" value={formatCurrency(viewTarget.discountAmount || 0)} />
              <DetailField label="Grand Total" value={formatCurrency(viewTarget.grandTotal || getPurchaseTotal(viewTarget))} strong />
            </section>

            <section className="purchase-details__section">
              <h3>Order Summary</h3>
              <div className="purchase-details__grid">
                <DetailField label="Supplier" value={getSafeText(viewTarget.supplierName || viewTarget.supplier, 'Supplier not assigned')} />
                <DetailField label="Warehouse" value={getSafeText(viewTarget.warehouseName || viewTarget.warehouse, 'Warehouse not assigned')} />
                <DetailField label="Department" value={getSafeText(viewTarget.departmentName || viewTarget.department || viewTarget.DepartmentName || viewTarget.Department, 'Department not assigned')} />
                <DetailField label="Source Indent" value={getSafeText(viewTarget.indentNumber || viewTarget.sourceIndentId, 'Not linked to an indent')} />
                <DetailField label="Order Date" value={formatSafeDate(viewTarget.orderDate)} />
                <DetailField label="Expected Date" value={formatSafeDate(viewTarget.expectedDate)} />
              </div>
            </section>

            <section className="purchase-details__section">
              <h3>Line Items</h3>
              <div className="purchase-details__table-wrapper">
                <table className="purchase-details__table">
                  <thead>
                    <tr>
                      <th style={{ width: '48px', textAlign: 'center' }}>#</th>
                      <th>Product</th>
                      <th>Variant</th>
                      <th>Unit</th>
                      <th style={{ textAlign: 'right' }}>Qty</th>
                      <th style={{ textAlign: 'right' }}>Unit Price</th>
                      <th style={{ textAlign: 'right' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getPurchaseLines(viewTarget).map((line, index) => {
                      const quantity = Number(line.quantity || 0)
                      const price = Number(line.price ?? line.unitPrice ?? 0)
                      const total = Number(line.total || 0) || quantity * price

                      return (
                        <tr key={line.id || `${line.productId || 'line'}-${index}`}>
                          <td style={{ textAlign: 'center' }}>{index + 1}</td>
                          <td>{getSafeText(line.productName || line.product || viewTarget.productName)}</td>
                          <td>{getSafeText(line.variantName || viewTarget.variantName, 'Default variant')}</td>
                          <td>{getSafeText(line.unitName || line.unit || line.uom || line.unitSymbol || line.uomName || viewTarget.unitName, 'Nos')}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>{quantity || 0}</td>
                          <td style={{ textAlign: 'right' }}>{formatCurrency(price)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatCurrency(total)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <div className="button-row purchase-details__footer">
              <button type="button" className="button button-primary" onClick={() => setViewTarget(null)}>
                Close
              </button>
            </div>
          </div>
        </FormModal>
      ) : null}
    </div>
  )
}
