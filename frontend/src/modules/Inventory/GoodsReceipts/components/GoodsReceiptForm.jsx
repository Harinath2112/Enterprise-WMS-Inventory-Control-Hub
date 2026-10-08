import { Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import CurrencyInput from '../../../../components/CurrencyInput'
import DatePicker from '../../../../components/DatePicker'
import QuantityInput from '../../../../components/QuantityInput'
import SearchableSelect from '../../../../components/SearchableSelect'
import { getPurchaseOrder } from '../../../../api/businessApi'
import { apiRequest, getResponseList } from '../../../../api/apiClient'
import { API_ENDPOINTS } from '../../../../api/endpoints'
import { createId, formatCurrency, getNumberError, getRequiredError } from '../../../../utils/helpers'
import { getLocalTodayDate, toDateInputValue } from '../../../../utils/dateUtils'
import { calculateGoodsReceiptTotals, normalizeGoodsReceiptItem } from '../goodsReceiptHelpers'
import { renderFormLabel } from '../../../../utils/labelUtils'
import '../../PurchaseIndents/PurchaseIndents.css'

function calculateLineTotal(line) {
  const norm = normalizeGoodsReceiptItem(line)
  return norm.lineTotal
}

function createLineItem() {
  return {
    id: createId('GRL'),
    purchaseOrderItemId: null,
    productId: '',
    productName: '',
    variantId: '',
    variantName: '',
    unitName: 'Units',
    orderedQuantity: '1',
    previouslyReceivedQuantity: '0',
    remainingQuantity: '1',
    receivedQuantity: '1',
    acceptedQuantity: '1',
    rejectedQuantity: '0',
    unitPrice: '0',
    discount: '0',
    taxPercentage: '0',
    batchNumber: '',
    expiryDate: '',
    remarks: '',
  }
}

function extractValue(obj, keys) {
  if (!obj || typeof obj !== 'object') return ''
  for (const key of keys) {
    const val = obj[key]
    if (val !== undefined && val !== null && val !== '') {
      if (typeof val === 'object' && val.id) return String(val.id)
      return String(val)
    }
  }
  return ''
}

function findSupplierId(po, suppliers) {
  if (!po) return ''
  const directId = extractValue(po, ['supplierId', 'SupplierId', 'supplier_id'])
  if (directId && suppliers.some(s => String(s.value) === String(directId))) {
    return directId
  }

  if (po.supplier && typeof po.supplier === 'object') {
    const suppObjId = String(po.supplier.id || po.supplier.supplierId || '')
    if (suppObjId && suppliers.some(s => String(s.value) === String(suppObjId))) {
      return suppObjId
    }
  }

  const name = String(po.supplierName || po.supplier || po.SupplierName || '').trim().toLowerCase()
  if (name) {
    const match = suppliers.find(s => {
      const sName = String(s.label || s.name || s.supplierName || s.companyName || '').trim().toLowerCase()
      return sName && (sName === name || sName.includes(name) || name.includes(sName))
    })
    if (match) return String(match.value)
  }

  return directId
}

function findWarehouseId(po, warehouses) {
  if (!po) return ''

  const directId = extractValue(po, [
    'warehouseId',
    'WarehouseId',
    'warehouse_id',
    'destinationWarehouseId',
    'locationId',
    'LocationId',
    'toWarehouseId',
    'fromWarehouseId',
  ])

  if (directId && warehouses.some(w => String(w.value) === String(directId))) {
    return directId
  }

  if (po.warehouse && typeof po.warehouse === 'object') {
    const whObjId = String(po.warehouse.id || po.warehouse.warehouseId || '')
    if (whObjId && warehouses.some(w => String(w.value) === String(whObjId))) {
      return whObjId
    }
  }

  const name = String(
    po.warehouseName ||
    po.warehouse ||
    po.WarehouseName ||
    po.locationName ||
    po.location ||
    ''
  ).trim().toLowerCase()

  if (name) {
    const match = warehouses.find(w => {
      const wName = String(w.label || w.name || w.warehouseName || '').trim().toLowerCase()
      return wName && (wName === name || wName.includes(name) || name.includes(wName))
    })
    if (match) return String(match.value)
  }

  if (directId) return directId

  return ''
}

function extractLineUnitPrice(item, products = [], productVariants = []) {
  if (!item) return '0'

  const directPrice = item.unitPrice ?? item.unit_price ?? item.UnitPrice ?? item.price ?? item.Price ?? item.unitCost ?? item.unit_cost ?? item.UnitCost ?? item.costPrice ?? item.cost ?? item.Cost ?? item.rate ?? item.Rate
  if (directPrice !== undefined && directPrice !== null && !Number.isNaN(Number(directPrice)) && Number(directPrice) > 0) {
    return String(directPrice)
  }

  const totalAmt = Number(item.totalPrice ?? item.total_price ?? item.TotalPrice ?? item.totalAmount ?? item.total_amount ?? item.TotalAmount ?? item.subtotal ?? item.lineTotal ?? 0)
  const qty = Number(item.quantity ?? item.orderedQuantity ?? item.Quantity ?? 1)
  if (totalAmt > 0 && qty > 0) {
    return String((totalAmt / qty).toFixed(2))
  }

  const pId = String(item.productId || item.product_id || item.ProductId || '')
  if (pId) {
    const prod = products.find(p => String(p.id || p.productId || p.value) === pId)
    if (prod) {
      const pPrice = prod.unitPrice ?? prod.unit_price ?? prod.UnitPrice ?? prod.price ?? prod.Price ?? prod.costPrice ?? prod.cost ?? prod.purchasePrice ?? prod.unitCost
      if (pPrice !== undefined && pPrice !== null && !Number.isNaN(Number(pPrice)) && Number(pPrice) > 0) {
        return String(pPrice)
      }
    }
  }

  const vId = String(item.variantId || item.variant_id || item.VariantId || '')
  if (vId) {
    const varItem = productVariants.find(v => String(v.id || v.variantId || v.value) === vId)
    if (varItem) {
      const vPrice = varItem.unitPrice ?? varItem.unit_price ?? varItem.UnitPrice ?? varItem.price ?? varItem.Price ?? varItem.costPrice ?? varItem.cost
      if (vPrice !== undefined && vPrice !== null && !Number.isNaN(Number(vPrice)) && Number(vPrice) > 0) {
        return String(vPrice)
      }
    }
  }

  return '0'
}

function getItemQuantity(item, po = null) {
  if (!item || typeof item !== 'object') return 1

  const keys = [
    'orderedQuantity',
    'ordered_quantity',
    'quantityOrdered',
    'quantity_ordered',
    'orderedQty',
    'ordered_qty',
    'orderQuantity',
    'order_quantity',
    'quantity',
    'Quantity',
    'qty',
    'Qty',
    'poQuantity',
    'PoQuantity',
    'poQty',
    'PoQty',
    'requiredQty',
    'RequiredQty',
    'requiredQuantity',
    'totalQuantity',
    'total_quantity',
  ]

  for (const k of keys) {
    const val = item[k]
    if (val !== undefined && val !== null && val !== '') {
      const num = Number(val)
      if (Number.isFinite(num) && num > 0) {
        return num
      }
    }
  }

  const nested = item.item || item.purchaseOrderItem || item.product
  if (nested && typeof nested === 'object') {
    for (const k of keys) {
      const val = nested[k]
      if (val !== undefined && val !== null && val !== '') {
        const num = Number(val)
        if (Number.isFinite(num) && num > 0) {
          return num
        }
      }
    }
  }

  if (po && typeof po === 'object') {
    for (const k of keys) {
      const val = po[k]
      if (val !== undefined && val !== null && val !== '') {
        const num = Number(val)
        if (Number.isFinite(num) && num > 0) {
          return num
        }
      }
    }
  }

  return 1
}

function getPurchaseOrderLines(po, allPoRows = []) {
  if (!po) return []

  const directItems = po.items || po.Items || po.lineItems || po.LineItems || po.purchaseOrderItems || po.PurchaseOrderItems || po.orderItems || po.OrderItems || po.products || po.Products
  if (Array.isArray(directItems) && directItems.length > 0) {
    return directItems
  }

  const targetPoId = String(po.id || po.poId || po.purchaseOrderId || '')
  const targetPoNum = String(po.poNumber || po.number || po.PoNumber || '')

  if (Array.isArray(allPoRows) && allPoRows.length > 0) {
    const matchingRows = allPoRows.filter(row => {
      const rId = String(row.id || row.poId || row.purchaseOrderId || '')
      const rNum = String(row.poNumber || row.number || row.PoNumber || '')
      return (targetPoId && rId === targetPoId) || (targetPoNum && rNum === targetPoNum)
    })

    if (matchingRows.length > 0) {
      const combined = []
      matchingRows.forEach(row => {
        const rowItems = row.items || row.Items || row.lineItems || row.LineItems || row.purchaseOrderItems || row.PurchaseOrderItems
        if (Array.isArray(rowItems) && rowItems.length > 0) {
          combined.push(...rowItems)
        } else if (row.productId || row.product_id || row.ProductId) {
          combined.push(row)
        }
      })
      if (combined.length > 0) {
        return combined
      }
    }
  }

  if (po.productId || po.product_id || po.ProductId) {
    return [po]
  }

  return []
}

function isPurchaseOrderEligibleForGrn(po, goodsReceipts = [], currentPoId = null) {
  if (!po) return false

  const poId = String(po.id || po.poId || po.purchaseOrderId || po.value || '').trim()
  const poNum = String(po.poNumber || po.number || po.PoNumber || '').trim().toLowerCase()

  if (currentPoId && (poId === String(currentPoId).trim() || (poNum && poNum === String(currentPoId).trim().toLowerCase()))) {
    return true
  }

  const rawStatus = String(po.status || po.Status || po.purchaseOrderStatus || '').trim().toLowerCase()

  if (rawStatus === 'received' || rawStatus.includes('fully received') || rawStatus === 'completed' || rawStatus === 'closed') {
    return false
  }

  if (rawStatus.includes('cancel') || rawStatus.includes('void') || rawStatus.includes('delete')) {
    return false
  }

  if (Array.isArray(goodsReceipts) && goodsReceipts.length > 0) {
    const matchingGrns = goodsReceipts.filter(grn => {
      const gPoId = String(grn.poId || grn.purchaseOrderId || '').trim()
      const gPoNum = String(grn.poNumber || grn.purchaseOrderNumber || '').trim().toLowerCase()
      return (poId && gPoId && poId === gPoId) || (poNum && gPoNum && poNum === gPoNum)
    })

    if (matchingGrns.length > 0) {
      const poLines = (Array.isArray(po.allLines) && po.allLines.length > 0)
        ? po.allLines
        : (Array.isArray(po.items) && po.items.length > 0)
          ? po.items
          : (po.productId ? [po] : [])

      let totalOrdered = 0
      let totalReceived = 0

      const allGrnItems = []
      matchingGrns.forEach(grn => {
        const gItems = (Array.isArray(grn.items) && grn.items.length > 0)
          ? grn.items
          : [{ productId: grn.productId, receivedQuantity: grn.receivedQuantity ?? grn.quantityReceived ?? grn.acceptedQuantity ?? grn.quantity ?? 0 }]
        allGrnItems.push(...gItems)
      })

      poLines.forEach(line => {
        const ordQty = Number(line.quantity || line.orderedQuantity || line.orderedQty || 0)
        totalOrdered += ordQty
      })

      allGrnItems.forEach(gItem => {
        const rxQty = Number(gItem.receivedQuantity ?? gItem.quantityReceived ?? gItem.acceptedQuantity ?? gItem.quantity ?? 0)
        totalReceived += rxQty
      })

      if (totalOrdered > 0 && totalReceived >= totalOrdered) {
        return false
      }
    }
  }

  return true
}

export default function GoodsReceiptForm({
  mode = 'create',
  record = null,
  referenceData = {},
  isSubmitting = false,
  onSubmit,
  onCancel,
}) {
  const [formData, setFormData] = useState(() => {
    if (record) {
      const recLines = Array.isArray(record.items) && record.items.length > 0
        ? record.items
        : [{
            productId: record.productId,
            variantId: record.variantId,
            orderedQuantity: record.orderedQuantity || record.quantityReceived || record.quantity,
            receivedQuantity: record.quantityReceived || record.quantity || 1,
            unitPrice: record.price || record.unitPrice || 0,
          }]

      return {
        poId: String(record.poId || record.purchaseOrderId || ''),
        supplierId: String(record.supplierId || ''),
        supplierName: record.supplierName || record.supplier || '',
        warehouseId: String(record.warehouseId || ''),
        warehouseName: record.warehouseName || record.warehouse || '',
        receiptDate: toDateInputValue(record.receiptDate) || getLocalTodayDate(),
        supplierInvoiceNo: record.supplierInvoiceNo || record.supplierInvoiceNumber || record.invoiceNumber || record.invoiceNo || record.invoice || '',
        supplierInvoiceDate: toDateInputValue(record.supplierInvoiceDate || record.invoiceDate) || '',
        notes: record.notes || record.remarks || '',
        lineItems: recLines.map(line => {
          const rxQty = String(line.quantityReceived ?? line.receivedQuantity ?? line.quantity ?? '1')
          const accQty = String(line.acceptedQuantity ?? rxQty)
          const rejQty = String(line.rejectedQuantity ?? '0')
          const ordQty = String(line.orderedQuantity ?? rxQty)
          const prevRx = String(line.previouslyReceivedQuantity ?? '0')
          const remQty = String(Math.max(0, Number(ordQty) - Number(prevRx)))

          return {
            id: createId('GRL'),
            purchaseOrderItemId: line.purchaseOrderItemId || line.id || null,
            productId: String(line.productId || ''),
            productName: line.productName || line.product_name || '',
            variantId: String(line.variantId || ''),
            variantName: line.variantName || line.variant_name || '',
            unitName: line.unitName || line.unit || 'Units',
            orderedQuantity: ordQty,
            previouslyReceivedQuantity: prevRx,
            remainingQuantity: remQty,
            receivedQuantity: rxQty,
            acceptedQuantity: accQty,
            rejectedQuantity: rejQty,
            unitPrice: String(line.price ?? line.unitPrice ?? '0'),
            discount: String(line.discount ?? line.discountPercentage ?? '0'),
            taxPercentage: String(line.taxPercentage ?? line.tax ?? '0'),
            batchNumber: line.batchNumber || '',
            expiryDate: line.expiryDate || '',
            remarks: line.remarks || '',
          }
        }),
      }
    }

    return {
      poId: '',
      supplierId: '',
      supplierName: '',
      warehouseId: '',
      warehouseName: '',
      receiptDate: getLocalTodayDate(),
      supplierInvoiceNo: '',
      supplierInvoiceDate: '',
      notes: '',
      lineItems: [createLineItem()],
    }
  })

  const [touched, setTouched] = useState({})
  const [fetchedSuppliers, setFetchedSuppliers] = useState([])
  const [fetchedWarehouses, setFetchedWarehouses] = useState([])
  const [fetchedProducts, setFetchedProducts] = useState([])

  useEffect(() => {
    if (!referenceData.suppliers || referenceData.suppliers.length === 0) {
      apiRequest(API_ENDPOINTS.suppliers.list)
        .then(res => {
          const list = getResponseList(res, 'suppliers')
          if (Array.isArray(list) && list.length > 0) {
            setFetchedSuppliers(list)
          }
        })
        .catch(() => {})
    }
    if (!referenceData.warehouses || referenceData.warehouses.length === 0) {
      apiRequest(API_ENDPOINTS.warehouses.list)
        .then(res => {
          const list = getResponseList(res, 'warehouses')
          if (Array.isArray(list) && list.length > 0) {
            setFetchedWarehouses(list)
          }
        })
        .catch(() => {})
    }
    if (!referenceData.products || referenceData.products.length === 0) {
      apiRequest(API_ENDPOINTS.products.list, { query: { page: 1, pageSize: 500 } })
        .then(res => {
          const list = getResponseList(res, 'products')
          if (Array.isArray(list) && list.length > 0) {
            setFetchedProducts(list)
          }
        })
        .catch(() => {})
    }
  }, [referenceData.suppliers, referenceData.warehouses, referenceData.products])

  // Deduplicated Purchase Orders dropdown: PO-001 - Supplier A (No product names!)
  const purchaseOrders = useMemo(() => {
    const list = referenceData.purchaseOrders || referenceData.purchases || []
    const goodsReceipts = referenceData.goodsReceipts || referenceData.grns || []
    const uniqueMap = new Map()

    list.forEach(po => {
      const idKey = String(po.id || po.poId || po.purchaseOrderId || po.poNumber || po.number || '')
      if (!idKey) return

      const poNum = po.poNumber || po.number || po.PoNumber || `PO-${idKey}`
      const supplierName = po.supplierName || po.supplier || po.SupplierName || ''
      const labelStr = supplierName ? `${poNum} - ${supplierName}` : poNum

      const rawItems = (Array.isArray(po.items) && po.items.length > 0)
        ? po.items
        : (Array.isArray(po.lineItems) && po.lineItems.length > 0)
          ? po.lineItems
          : (po.productId ? [po] : [])

      if (!uniqueMap.has(idKey)) {
        uniqueMap.set(idKey, {
          ...po,
          value: idKey,
          label: labelStr,
          allLines: [...rawItems],
        })
      } else {
        const existingPo = uniqueMap.get(idKey)
        rawItems.forEach(item => {
          const pId = String(item.productId || item.product_id || item.ProductId || '')
          if (pId && !existingPo.allLines.some(l => String(l.productId || l.product_id || l.ProductId) === pId)) {
            existingPo.allLines.push(item)
          }
        })
        if (!existingPo.items && po.items) existingPo.items = po.items
        if (!existingPo.lineItems && po.lineItems) existingPo.lineItems = po.lineItems
      }
    })

    const allPos = Array.from(uniqueMap.values())
    return allPos.filter(po => isPurchaseOrderEligibleForGrn(po, goodsReceipts, formData?.poId))
  }, [referenceData.purchaseOrders, referenceData.purchases, referenceData.goodsReceipts, referenceData.grns, formData?.poId])

  const suppliers = useMemo(() => {
    const list = referenceData.suppliers?.length ? referenceData.suppliers : fetchedSuppliers
    const options = list.map(s => ({
      ...s,
      value: String(s.id || s.supplierId),
      label: s.name || s.supplierName || s.companyName || `Supplier ${s.id}`,
    }))

    if (formData?.supplierId && !options.some(s => String(s.value) === String(formData.supplierId))) {
      options.push({
        value: String(formData.supplierId),
        label: formData.supplierName || `Supplier #${formData.supplierId}`,
      })
    }
    return options
  }, [referenceData.suppliers, fetchedSuppliers, formData?.supplierId, formData?.supplierName])

  const warehouses = useMemo(() => {
    const list = referenceData.warehouses?.length ? referenceData.warehouses : fetchedWarehouses
    const options = list.map(w => ({
      ...w,
      value: String(w.id || w.warehouseId),
      label: w.name || w.warehouseName || `Warehouse ${w.id}`,
    }))

    if (formData?.warehouseId && !options.some(w => String(w.value) === String(formData.warehouseId))) {
      options.push({
        value: String(formData.warehouseId),
        label: formData.warehouseName || `Warehouse #${formData.warehouseId}`,
      })
    }
    return options
  }, [referenceData.warehouses, fetchedWarehouses, formData?.warehouseId, formData?.warehouseName])



  const products = useMemo(() => {
    const list = referenceData.products?.length ? referenceData.products : fetchedProducts
    const options = list.map(p => {
      const name = p.name || p.productName || `Product ${p.id}`
      const sku = p.sku || p.code || p.itemCode
      const hasSku = sku && sku !== 'No SKU' && !name.includes(sku)
      return {
        ...p,
        value: String(p.id || p.productId),
        label: hasSku ? `${name} (${sku})` : name,
      }
    })

    if (formData?.lineItems) {
      formData.lineItems.forEach(line => {
        if (line.productId && !options.some(p => String(p.value) === String(line.productId))) {
          options.push({
            value: String(line.productId),
            label: line.productName || `Product #${line.productId}`,
          })
        }
      })
    }

    return options
  }, [referenceData.products, fetchedProducts, formData?.lineItems])

  const productVariants = useMemo(() => {
    const list = referenceData.productVariants || referenceData.variants || []
    return list.map(v => ({
      ...v,
      value: String(v.id || v.variantId),
      label: v.name || v.variantName || v.sku || `Variant ${v.id}`,
    }))
  }, [referenceData.productVariants, referenceData.variants])

  async function handlePoChange(event) {
    const selectedPoId = event.target.value
    if (!selectedPoId) {
      setFormData(current => ({
        ...current,
        poId: '',
        supplierId: '',
        supplierName: '',
        warehouseId: '',
        warehouseName: '',
        lineItems: [createLineItem()],
      }))
      return
    }

    const allPoRows = referenceData.purchaseOrders || referenceData.purchases || []
    let selectedPo = purchaseOrders.find(po => String(po.value) === String(selectedPoId)) || allPoRows.find(po => String(po.id || po.poId || po.purchaseOrderId) === String(selectedPoId))
    let supplierId = selectedPo ? findSupplierId(selectedPo, suppliers) : ''
    let warehouseId = selectedPo ? findWarehouseId(selectedPo, warehouses) : ''
    let liveItems = null

    try {
      const response = await getPurchaseOrder(selectedPoId)
      if (response.success && response.data) {
        if (Array.isArray(response.data) && response.data.length > 0) {
          liveItems = response.data
          if (response.data[0]) {
            selectedPo = { ...selectedPo, ...response.data[0] }
          }
        } else if (response.data && typeof response.data === 'object') {
          const livePo = response.data
          selectedPo = { ...selectedPo, ...livePo }
          liveItems = livePo.items || livePo.lineItems || livePo.purchaseOrderItems || livePo.products || livePo.orderItems || null
        }
        supplierId = findSupplierId(selectedPo, suppliers) || supplierId
        warehouseId = findWarehouseId(selectedPo, warehouses) || warehouseId
      }
    } catch {
      // Non-blocking fallback
    }

    if (!warehouseId && warehouses.length > 0) {
      warehouseId = String(warehouses[0].value)
    }

    const poLines = (Array.isArray(liveItems) && liveItems.length > 0)
      ? liveItems
      : (selectedPo?.allLines && selectedPo.allLines.length > 0)
        ? selectedPo.allLines
        : getPurchaseOrderLines(selectedPo, allPoRows)

    const allProducts = referenceData.products?.length ? referenceData.products : fetchedProducts

    const mappedLines = poLines.length > 0
      ? poLines.map((item, idx) => {
          const pId = String(
            item.productId ||
            item.product_id ||
            item.ProductId ||
            item.id ||
            (typeof item.product === 'object' ? item.product?.id || item.product?.productId : '') ||
            ''
          )
          const vId = String(
            item.variantId ||
            item.variant_id ||
            item.VariantId ||
            (typeof item.variant === 'object' ? item.variant?.id : '') ||
            ''
          )
          
          const matchedProd = allProducts.find(p => String(p.id || p.productId) === pId)
          const matchedVar = (referenceData.productVariants || []).find(v => String(v.id || v.variantId) === vId)

          const pName =
            item.productName ||
            item.product_name ||
            item.name ||
            (typeof item.product === 'object' ? item.product?.name || item.product?.productName : '') ||
            matchedProd?.name ||
            matchedProd?.productName ||
            (pId ? `Product #${pId}` : `Item ${idx + 1}`)

          const vName =
            item.variantName ||
            item.variant_name ||
            (typeof item.variant === 'object' ? item.variant?.name || item.variant?.variantName : '') ||
            matchedVar?.name ||
            matchedVar?.variantName ||
            ''

          const unitName = item.unitName || item.unit || matchedProd?.unit || 'Units'
          const ordQty = getItemQuantity(item, selectedPo)
          const prevRx = Number(item.quantityReceived ?? item.previouslyReceivedQuantity ?? item.receivedQuantity ?? 0) || 0
          const remQty = Math.max(0, ordQty - prevRx)
          const rawPrice = extractLineUnitPrice(item, allProducts, referenceData.productVariants || [])
          const price = Number(rawPrice) > 0 ? String(rawPrice) : (matchedProd?.price ? String(matchedProd.price) : '0')

          return {
            id: createId('GRL'),
            purchaseOrderItemId: item.id || item.poItemId || item.purchaseOrderItemId || null,
            productId: pId,
            productName: pName,
            variantId: vId,
            variantName: vName,
            unitName: unitName,
            orderedQuantity: String(ordQty),
            previouslyReceivedQuantity: String(prevRx),
            remainingQuantity: String(remQty),
            receivedQuantity: String(remQty > 0 ? remQty : 0),
            acceptedQuantity: String(remQty > 0 ? remQty : 0),
            rejectedQuantity: '0',
            unitPrice: price,
            discount: String(item.discount ?? item.discountPercentage ?? '0'),
            taxPercentage: String(item.taxPercentage ?? item.tax ?? '0'),
            batchNumber: item.batchNumber || '',
            expiryDate: item.expiryDate || '',
            remarks: item.remarks || '',
          }
        })
      : [createLineItem()]

    const supplierName = selectedPo?.supplierName || selectedPo?.supplier || ''
    const warehouseName = selectedPo?.warehouseName || selectedPo?.warehouse || ''

    setFormData(current => ({
      ...current,
      poId: selectedPoId,
      supplierId: supplierId || current.supplierId,
      supplierName: supplierName || current.supplierName || '',
      warehouseId: warehouseId || current.warehouseId,
      warehouseName: warehouseName || current.warehouseName || '',
      lineItems: mappedLines,
    }))
  }

  function handleChange(event) {
    const { name, value } = event.target
    setFormData(current => ({
      ...current,
      [name]: value,
    }))
  }

  function handleBlur(event) {
    setTouched(current => ({
      ...current,
      [event.target.name]: true,
    }))
  }

  function handleLineChange(lineId, fieldName, value) {
    setFormData(current => ({
      ...current,
      lineItems: current.lineItems.map(item => {
        if (item.id !== lineId) return item
        const updated = { ...item, [fieldName]: value }

        if (fieldName === 'receivedQuantity') {
          const rxQty = Number(value || 0)
          updated.acceptedQuantity = String(rxQty)
          updated.rejectedQuantity = '0'
        } else if (fieldName === 'acceptedQuantity') {
          const rxQty = Number(updated.receivedQuantity || 0)
          const accQty = Number(value || 0)
          updated.rejectedQuantity = String(Math.max(0, rxQty - accQty))
        } else if (fieldName === 'rejectedQuantity') {
          const rxQty = Number(updated.receivedQuantity || 0)
          const rejQty = Number(value || 0)
          updated.acceptedQuantity = String(Math.max(0, rxQty - rejQty))
        } else if (fieldName === 'productId' && value) {
          const price = extractLineUnitPrice({ productId: value }, referenceData.products || [], referenceData.productVariants || [])
          if (Number(price) > 0 && (!updated.unitPrice || updated.unitPrice === '0')) {
            updated.unitPrice = price
          }
        }

        return updated
      }),
    }))
  }

  function handleLineBlur(lineId, fieldName) {
    setTouched(current => ({
      ...current,
      [`${lineId}-${fieldName}`]: true,
    }))
  }

  function addLineItem() {
    setFormData(current => ({
      ...current,
      lineItems: [...current.lineItems, createLineItem()],
    }))
  }

  function removeLineItem(lineId) {
    setFormData(current => {
      if (current.lineItems.length === 1) {
        return {
          ...current,
          lineItems: [createLineItem()],
        }
      }
      return {
        ...current,
        lineItems: current.lineItems.filter(item => item.id !== lineId),
      }
    })
  }

  const errors = {
    supplierId: getRequiredError(formData.supplierId, 'Supplier'),
    warehouseId: getRequiredError(formData.warehouseId, 'Warehouse'),
    receiptDate: getRequiredError(formData.receiptDate, 'Receipt date'),
    supplierInvoiceNo: getRequiredError(formData.supplierInvoiceNo, 'Supplier Invoice No'),
    lineItems: formData.lineItems.map(item => {
      const ordQty = Number(item.orderedQuantity || 0)
      const prevRx = Number(item.previouslyReceivedQuantity || 0)
      const maxAllowed = Math.max(0, ordQty - prevRx)
      const recQty = Number(item.receivedQuantity || 0)

      let recError = null
      if (maxAllowed > 0 || recQty > 0) {
        recError = getNumberError(item.receivedQuantity, 'Received quantity', { allowZero: false })
      }
      if (!recError && recQty > maxAllowed) {
        recError = `Received quantity cannot exceed the remaining quantity of ${maxAllowed}.`
      }
      if (!recError && recQty < 0) {
        recError = `Received quantity must be greater than or equal to 0.`
      }

      return {
        productId: getRequiredError(item.productId, 'Product'),
        receivedQuantity: recError,
        unitPrice: getNumberError(item.unitPrice, 'Unit price', { allowZero: true }),
      }
    }),
  }

  const isFormValid =
    !errors.supplierId &&
    !errors.warehouseId &&
    !errors.receiptDate &&
    !errors.supplierInvoiceNo &&
    errors.lineItems.every(line => !line.productId && !line.receivedQuantity && !line.unitPrice)

  const summary = useMemo(() => {
    const totals = calculateGoodsReceiptTotals(formData.lineItems)
    return {
      subtotal: totals.subtotal,
      totalDiscount: totals.totalDiscount,
      totalTax: totals.totalTax,
      grandTotal: totals.grandTotal,
      total: totals.grandTotal,
      lines: formData.lineItems.length,
    }
  }, [formData.lineItems])

  function markAllTouched() {
    setTouched({
      supplierId: true,
      warehouseId: true,
      receiptDate: true,
      supplierInvoiceNo: true,
      supplierInvoiceDate: true,
      ...formData.lineItems.reduce((acc, line) => ({
        ...acc,
        [`${line.id}-productId`]: true,
        [`${line.id}-receivedQuantity`]: true,
        [`${line.id}-unitPrice`]: true,
      }), {}),
    })
  }

  function handleSubmit(event) {
    event.preventDefault()
    markAllTouched()

    if (!isFormValid || isSubmitting) return

    const firstLine = formData.lineItems[0] || createLineItem()
    const items = formData.lineItems.map(line => {
      const norm = normalizeGoodsReceiptItem(line)
      return {
        purchaseOrderItemId: line.purchaseOrderItemId ? Number(line.purchaseOrderItemId) : null,
        productId: Number(line.productId),
        variantId: line.variantId ? Number(line.variantId) : null,
        orderedQuantity: Number(line.orderedQuantity || norm.quantity),
        quantity: norm.quantity,
        quantityReceived: norm.quantity,
        receivedQuantity: norm.quantity,
        acceptedQuantity: norm.quantity,
        rejectedQuantity: 0,
        unitPrice: norm.unitPrice,
        price: norm.unitPrice,
        discount: norm.discountPercentage,
        discountPercentage: norm.discountPercentage,
        discountAmount: norm.discountAmount,
        taxPercentage: norm.taxPercentage,
        taxRate: norm.taxPercentage,
        taxPercent: norm.taxPercentage,
        gstPercentage: norm.taxPercentage,
        tax: norm.taxPercentage,
        taxableAmount: norm.taxableAmount,
        taxAmount: norm.taxAmount,
        gstAmount: norm.taxAmount,
        lineTotal: norm.lineTotal,
        totalAmount: norm.lineTotal,
        batchNumber: line.batchNumber || '',
        expiryDate: line.expiryDate || null,
        remarks: line.remarks || '',
      }
    })

    const totals = calculateGoodsReceiptTotals(items)

    console.log("Items state:", formData.lineItems)
    console.log("Items count:", formData.lineItems.length)
    console.log("Final GRN payload items:", items)
    console.log("Payload item count:", items.length)

    onSubmit({
      poId: formData.poId ? Number(formData.poId) : null,
      purchaseOrderId: formData.poId ? Number(formData.poId) : null,
      supplierId: Number(formData.supplierId),
      warehouseId: Number(formData.warehouseId),
      receiptDate: formData.receiptDate,
      supplierInvoiceNo: formData.supplierInvoiceNo,
      supplierInvoiceNumber: formData.supplierInvoiceNo,
      invoiceNumber: formData.supplierInvoiceNo,
      invoiceNo: formData.supplierInvoiceNo,
      supplierInvoiceDate: formData.supplierInvoiceDate || null,
      invoiceDate: formData.supplierInvoiceDate || null,
      notes: formData.notes,
      items,
      subtotal: totals.subtotal,
      totalDiscount: totals.totalDiscount,
      totalTax: totals.totalTax,
      taxAmount: totals.totalTax,
      grandTotal: totals.grandTotal,
      totalAmount: totals.grandTotal,
      // Compatibility top-level fields
      productId: Number(firstLine.productId),
      variantId: firstLine.variantId ? Number(firstLine.variantId) : null,
      quantityReceived: Number(firstLine.receivedQuantity || 1),
      quantity: Number(firstLine.receivedQuantity || 1),
      price: Number(firstLine.unitPrice || 0),
      unitPrice: Number(firstLine.unitPrice || 0),
    })
  }

  return (
    <form className="indent-create-wrapper" onSubmit={handleSubmit} autoComplete="off" style={{ minWidth: 0, maxWidth: '100%', width: '100%' }}>
      <div className="indent-create-header">
        <div className="indent-create-header__title">
          <h1>{mode === 'edit' ? 'Edit Goods Receipt' : 'Create Goods Receipt'}</h1>
        </div>
      </div>

      <div className="indent-card" style={{ minWidth: 0, maxWidth: '100%', width: '100%' }}>
        <h3 className="indent-card__title">Goods Receipt Details</h3>
        <div className="indent-details-grid">
          <div className="indent-field-group">
            <label htmlFor="grn-po">Purchase Order</label>
            <SearchableSelect
              id="grn-po"
              name="poId"
              value={formData.poId}
              onChange={handlePoChange}
              onBlur={handleBlur}
              options={purchaseOrders}
              placeholder="Select purchase order"
              hideLabel={true}
              className="indent-details-searchable-select"
            />
          </div>

          <div className={`indent-field-group ${touched.supplierId && errors.supplierId ? 'indent-field-group--error' : ''}`}>
            <label htmlFor="grn-supplier">Supplier <span className="required">*</span></label>
            <SearchableSelect
              id="grn-supplier"
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

          <div className={`indent-field-group ${touched.warehouseId && errors.warehouseId ? 'indent-field-group--error' : ''}`}>
            <label htmlFor="grn-warehouse">Warehouse <span className="required">*</span></label>
            <SearchableSelect
              id="grn-warehouse"
              name="warehouseId"
              value={formData.warehouseId}
              onChange={handleChange}
              onBlur={handleBlur}
              options={warehouses}
              placeholder="Select warehouse"
              hideLabel={true}
              className="indent-details-searchable-select"
            />
            {touched.warehouseId && errors.warehouseId && (
              <span className="indent-field-error">{errors.warehouseId}</span>
            )}
          </div>

          <div className={`indent-field-group ${touched.receiptDate && errors.receiptDate ? 'indent-field-group--error' : ''}`}>
            <label htmlFor="grn-receipt-date">Receipt date <span className="required">*</span></label>
            <DatePicker
              id="grn-receipt-date"
              name="receiptDate"
              value={formData.receiptDate}
              onChange={handleChange}
              onBlur={handleBlur}
              error={touched.receiptDate ? errors.receiptDate : ''}
              className="indent-details-date-picker"
            />
          </div>

          <div className={`indent-field-group ${touched.supplierInvoiceNo && errors.supplierInvoiceNo ? 'indent-field-group--error' : ''}`}>
            <label htmlFor="grn-supplier-invoice-no">{renderFormLabel('Supplier Invoice No *')}</label>
            <input
              type="text"
              id="grn-supplier-invoice-no"
              name="supplierInvoiceNo"
              className="indent-field-input"
              style={{
                width: '100%',
                minHeight: '38px',
                padding: '8px 12px',
                borderRadius: '8px',
                border: touched.supplierInvoiceNo && errors.supplierInvoiceNo ? '1px solid #ef4444' : '1px solid #cbd5e1',
                background: touched.supplierInvoiceNo && errors.supplierInvoiceNo ? '#fef2f2' : '#ffffff',
                fontSize: '13px',
              }}
              placeholder="Enter supplier invoice no"
              value={formData.supplierInvoiceNo}
              onChange={handleChange}
              onBlur={handleBlur}
            />
            {touched.supplierInvoiceNo && errors.supplierInvoiceNo && (
              <span className="indent-field-error">{errors.supplierInvoiceNo}</span>
            )}
          </div>

          <div className={`indent-field-group ${touched.supplierInvoiceDate && errors.supplierInvoiceDate ? 'indent-field-group--error' : ''}`}>
            <label htmlFor="grn-supplier-invoice-date">Supplier Invoice Date</label>
            <DatePicker
              id="grn-supplier-invoice-date"
              name="supplierInvoiceDate"
              value={formData.supplierInvoiceDate}
              onChange={handleChange}
              onBlur={handleBlur}
              error={touched.supplierInvoiceDate ? errors.supplierInvoiceDate : ''}
              className="indent-details-date-picker"
            />
          </div>

          <div className="indent-field-group" style={{ gridColumn: '1 / -1' }}>
            <label htmlFor="grn-notes">Notes</label>
            <textarea
              id="grn-notes"
              name="notes"
              className="indent-remarks-textarea"
              placeholder="Delivery note reference, batch numbers, or inspection remarks"
              value={formData.notes}
              onChange={handleChange}
              onBlur={handleBlur}
              rows={3}
            />
          </div>
        </div>
      </div>

      <div className="indent-card" style={{ minWidth: 0, maxWidth: '100%', width: '100%' }}>
        <h3 className="indent-card__title">Received Product Line Items</h3>

        <div className="indent-items-table-wrapper" style={{ overflowX: 'auto', overflowY: 'hidden', width: '100%', display: 'block', minWidth: 0, maxWidth: '100%' }}>
          <table className="indent-items-table" style={{ width: '100%', minWidth: '1500px', tableLayout: 'fixed' }}>
            <thead>
              <tr>
                <th style={{ width: '52px', textAlign: 'center' }}>S.No.</th>
                <th style={{ width: '420px' }}>Product *</th>
                <th style={{ width: '180px' }}>Variant</th>
                <th style={{ width: '90px', textAlign: 'center' }}>Ordered Qty</th>
                <th style={{ width: '95px', textAlign: 'center' }}>Received *</th>
                <th style={{ width: '110px', textAlign: 'center' }}>Remaining Qty</th>
                <th style={{ width: '115px', textAlign: 'right' }}>Unit price *</th>
                <th style={{ width: '95px', textAlign: 'center' }}>Discount (%)</th>
                <th style={{ width: '85px', textAlign: 'center' }}>Tax (%)</th>
                <th style={{ width: '125px', textAlign: 'right' }}>Line total</th>
                <th style={{ width: '70px', textAlign: 'center', whiteSpace: 'nowrap' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {formData.lineItems.map((lineItem, index) => (
                <tr key={lineItem.id}>
                  <td className="indent-sno-col">{index + 1}</td>

                  <td>
                    <SearchableSelect
                      id={`grn-product-${lineItem.id}`}
                      name={`product-${lineItem.id}`}
                      value={lineItem.productId}
                      onChange={(event) => handleLineChange(lineItem.id, 'productId', event.target.value)}
                      onBlur={() => handleLineBlur(lineItem.id, 'productId')}
                      options={products}
                      placeholder="Select product"
                      error={errors.lineItems[index]?.productId}
                      showError={touched[`${lineItem.id}-productId`]}
                      hideLabel={true}
                      className="indent-table-searchable-select"
                    />
                  </td>

                  <td>
                    <SearchableSelect
                      id={`grn-variant-${lineItem.id}`}
                      name={`variant-${lineItem.id}`}
                      value={lineItem.variantId}
                      onChange={(event) => handleLineChange(lineItem.id, 'variantId', event.target.value)}
                      options={productVariants}
                      placeholder="Standard"
                      hideLabel={true}
                      className="indent-table-searchable-select"
                    />
                  </td>

                  <td>
                    <input
                      type="text"
                      className="indent-table-input"
                      value={lineItem.orderedQuantity || '-'}
                      readOnly
                      disabled
                      style={{ textAlign: 'center', background: '#f8fafc' }}
                    />
                  </td>

                  <td>
                    <QuantityInput
                      id={`grn-quantity-${lineItem.id}`}
                      name={`quantity-${lineItem.id}`}
                      value={lineItem.receivedQuantity}
                      onChange={(event) => handleLineChange(lineItem.id, 'receivedQuantity', event.target.value)}
                      onBlur={() => handleLineBlur(lineItem.id, 'receivedQuantity')}
                      error={touched[`${lineItem.id}-receivedQuantity`] ? errors.lineItems[index]?.receivedQuantity : ''}
                      className="indent-table-field indent-table-field--quantity"
                      disabled={Number(lineItem.orderedQuantity || 0) - Number(lineItem.previouslyReceivedQuantity || 0) <= 0}
                    />
                  </td>

                  <td>
                    <input
                      type="text"
                      className="indent-table-input"
                      value={Math.max(0, Number(lineItem.orderedQuantity || 0) - Number(lineItem.previouslyReceivedQuantity || 0) - Number(lineItem.receivedQuantity || 0))}
                      readOnly
                      disabled
                      style={{ textAlign: 'center', background: '#f8fafc' }}
                    />
                  </td>

                  <td>
                    <CurrencyInput
                      id={`grn-price-${lineItem.id}`}
                      name={`price-${lineItem.id}`}
                      value={lineItem.unitPrice}
                      onChange={(event) => handleLineChange(lineItem.id, 'unitPrice', event.target.value)}
                      onBlur={() => handleLineBlur(lineItem.id, 'unitPrice')}
                      error={touched[`${lineItem.id}-unitPrice`] ? errors.lineItems[index]?.unitPrice : ''}
                      className="indent-table-field indent-table-field--currency"
                    />
                  </td>

                  <td>
                    <QuantityInput
                      id={`grn-discount-${lineItem.id}`}
                      name={`discount-${lineItem.id}`}
                      value={lineItem.discount}
                      onChange={(event) => handleLineChange(lineItem.id, 'discount', event.target.value)}
                      placeholder="0"
                      className="indent-table-field indent-table-field--quantity"
                    />
                  </td>

                  <td>
                    <QuantityInput
                      id={`grn-tax-${lineItem.id}`}
                      name={`tax-${lineItem.id}`}
                      value={lineItem.taxPercentage}
                      onChange={(event) => handleLineChange(lineItem.id, 'taxPercentage', event.target.value)}
                      placeholder="0"
                      className="indent-table-field indent-table-field--quantity"
                    />
                  </td>

                  <td>
                    <input
                      type="text"
                      className="indent-table-input"
                      value={formatCurrency(calculateLineTotal(lineItem))}
                      readOnly
                      disabled
                      style={{ textAlign: 'right', fontWeight: '600' }}
                    />
                  </td>

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
              ))}
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

        <div className="indent-total-section" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '24px', marginTop: '20px', paddingTop: '16px', borderTop: '1px dashed #e2e8f0' }}>
          <div style={{ fontSize: '13.5px', color: '#64748b', whiteSpace: 'nowrap' }}>
            Lines: <strong style={{ color: '#0f172a', fontWeight: '600' }}>{summary.lines}</strong>
          </div>
          <div style={{ background: '#f8fafc', padding: '8px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '13.5px', color: '#64748b', whiteSpace: 'nowrap' }}>Total amount:</span>
            <strong style={{ fontSize: '16.5px', color: '#4a3bb8', fontWeight: '700', whiteSpace: 'nowrap' }}>{formatCurrency(summary.total)}</strong>
          </div>
        </div>
      </div>

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
          {isSubmitting ? 'Saving...' : mode === 'edit' ? 'Update Goods Receipt' : 'Create Goods Receipt'}
        </button>
      </div>
    </form>
  )
}
