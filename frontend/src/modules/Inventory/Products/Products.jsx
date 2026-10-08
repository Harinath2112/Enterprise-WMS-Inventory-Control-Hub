// Products.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Archive, Package, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useAuth } from '../../../hooks/useAuth'
import FormModal from '../../../layouts/FormModal'
import { showToast } from '../../../components/common/toast'
import ProductIdentity from '../../../components/ProductIdentity'
import { apiRequest, getResponseData, getResponseList } from '../../../api/apiClient'
import { API_ENDPOINTS } from '../../../api/endpoints'
import { getTopProducts } from '../../../api/businessApi'
import {
  createFullProduct,
  deleteProduct,
  getCategories,
  getProductCatalog,
  normalizeProduct,
  patchProduct,
  uploadProductImage,
} from '../../../api/productApi'
import {
  createVariant,
  deleteVariant,
  getVariantsByProduct,
  updateVariant,
} from '../../../api/productVariantsApi'
import ProductsTable from './components/ProductsTable'
import ProductForm from './components/ProductForm'
import StateBlock from '../../../components/common/StateBlock'
import { StatusBadge } from '../../../components/erp'
import { formatCurrency } from '../../../utils/helpers'
import { getDescriptiveVariantName } from '../../../utils/productNameUtils'
import './Products.css'

const PRODUCT_CATALOG_UPDATED_EVENT = 'ims:product-catalog-updated'

function ProductsHeader({ canCreate, summary, activeStatusFilter, isTopSellingView, onFilterStatus, onAdd }) {
  const metrics = [
    {
      key: 'total',
      filterValue: 'all',
      label: 'Products',
      value: formatCompactCount(summary.total),
      tone: 'info',
      isActive: !isTopSellingView && activeStatusFilter === 'all',
      title: 'Show active products',
    },
    ...(isTopSellingView || summary.topSelling > 0 ? [{
      key: 'topSelling',
      filterValue: 'top-selling',
      label: 'Top Selling',
      value: formatCompactCount(summary.topSelling || (isTopSellingView ? summary.total : 0)),
      tone: 'success',
      isActive: isTopSellingView,
      title: 'Filter top-selling products',
    }] : []),
    {
      key: 'inStock',
      filterValue: 'In Stock',
      label: 'In Stock',
      value: formatCompactCount(summary.inStock),
      tone: 'success',
      isActive: !isTopSellingView && activeStatusFilter === 'In Stock',
      title: 'Filter in-stock inventory products',
    },
    {
      key: 'lowStock',
      filterValue: 'Low Stock',
      label: 'Low Stock',
      value: formatCompactCount(summary.lowStock),
      tone: 'warning',
      isActive: !isTopSellingView && activeStatusFilter === 'Low Stock',
      title: 'Filter low-stock products',
    },
    {
      key: 'outOfStock',
      filterValue: 'Out Of Stock',
      label: 'Out Of Stock',
      value: formatCompactCount(summary.outOfStock),
      tone: 'danger',
      isActive: !isTopSellingView && activeStatusFilter === 'Out Of Stock',
      title: 'Filter out-of-stock products',
    },
    {
      key: 'archived',
      filterValue: 'Archived',
      label: 'Archived',
      value: formatCompactCount(summary.archived),
      tone: 'neutral',
      isActive: !isTopSellingView && activeStatusFilter === 'Archived',
      title: 'Filter archived products',
    },
  ]

  return (
    <header className="resource-center__inventory-header" aria-label="Products summary">
      <div className="resource-center__inventory-header-main">
        <h1>Products</h1>
        <div className="resource-center__inventory-metrics" role="region" aria-label="Inventory metrics filter controls">
          {metrics.map((metric) => (
            <button
              type="button"
              key={metric.key}
              onClick={() => onFilterStatus?.(metric.filterValue)}
              className={`resource-center__inventory-metric resource-center__inventory-metric--${metric.tone} ${metric.isActive ? 'is-active' : ''}`}
              title={metric.title}
              aria-pressed={metric.isActive}
            >
              {metric.value ? <strong>{metric.value}</strong> : null}{metric.value ? ' ' : ''}{metric.label}
            </button>
          ))}
        </div>
      </div>

      <div className="resource-center__inventory-header-actions">
        {canCreate ? (
          <button className="button button-primary" onClick={onAdd}>
            <Plus size={16} />
            Add Product
          </button>
        ) : null}
      </div>
    </header>
  )
}

const PRODUCT_STATUS_FILTER_OPTIONS = [
  { value: 'In Stock', label: 'In Stock' },
  { value: 'Low Stock', label: 'Low Stock' },
  { value: 'Out Of Stock', label: 'Out Of Stock' },
  { value: 'Archived', label: 'Archived' },
]

function getEntityId(entity) {
  return entity?.id ?? entity?._id ?? entity?.productId ?? entity?.variantId ?? ''
}

function toNullableId(value) {
  if (value === '' || value === null || value === undefined) {
    return null
  }

  const numberValue = Number(value)
  return Number.isInteger(numberValue) && numberValue > 0 ? numberValue : null
}

function toSafeNumber(value, fallback = 0) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : fallback
}

const editableProductFields = new Set([
  'name',
  'sku',
  'barcode',
  'categoryId',
  'subCategoryId',
  'brandId',
  'unitId',
  'price',
  'costPrice',
  'reorderLevel',
  'supplierId',
  'warehouseId',
  'status',
  'description',
  'image',
])

function toOptionalNumber(value) {
  if (value === '' || value === null || value === undefined) {
    return null
  }

  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : null
}

function prepareProductPayload(values) {
  let variants = Array.isArray(values?.variants) ? values.variants : []

  if (variants.length === 0) {
    const derivedVariantName =
      getDescriptiveVariantName(null, values) ||
      [values.variantColor, values.variantSize].filter(Boolean).join(' / ') ||
      values.variantColor ||
      values.variantSize ||
      'Standard'

    variants = [
      {
        variantName: derivedVariantName,
        sku: values.sku || '',
        priceDelta: 0,
        attributes: [],
      },
    ]
  }

  return {
    name: values.name || '',
    sku: values.sku || '',
    barcode: values.barcode || '',

    categoryId: toNullableId(values.categoryId),
    subCategoryId: toNullableId(values.subCategoryId),
    brandId: toNullableId(values.brandId),
    unitId: toNullableId(values.unitId),

    price: toSafeNumber(values.price),
    costPrice: toSafeNumber(values.costPrice),
    reorderLevel: toSafeNumber(values.reorderLevel),

    supplierId: toNullableId(values.supplierId),
    warehouseId: toNullableId(values.warehouseId),

    status: values.status || '',
    description: values.description || '',
    imageUrl: values.imageFile ? '' : values.image || '',
    image: values.imageFile ? '' : values.image || '',

    variants: variants.map((variant, index) => {
      const resolvedName =
        variant.variantName && !/^default$/i.test(variant.variantName)
          ? variant.variantName
          : getDescriptiveVariantName(variant, values) || `Variant-${index + 1}`

      return {
        variantName: resolvedName,
        sku: variant.sku || values.sku || '',
        priceDelta: toSafeNumber(variant.priceDelta, 0),

        attributes: (Array.isArray(variant.attributes) ? variant.attributes : [])
          .map((attribute) => ({
            attributeId: toNullableId(attribute.attributeId),
            valueId: toNullableId(attribute.valueId),
          }))
          .filter((attribute) => attribute.attributeId && attribute.valueId),
      }
    }),
  }
}

function prepareProductPatchPayload(values, changedFields = []) {
  return changedFields.reduce((payload, field) => {
    if (!editableProductFields.has(field)) {
      return payload
    }

    if (['categoryId', 'subCategoryId', 'brandId', 'unitId', 'supplierId', 'warehouseId'].includes(field)) {
      return {
        ...payload,
        [field]: toNullableId(values[field]),
      }
    }

    if (['price', 'costPrice', 'reorderLevel'].includes(field)) {
      return {
        ...payload,
        [field]: toOptionalNumber(values[field]),
      }
    }

    return {
      ...payload,
      [field]: values[field] ?? '',
    }
  }, {})
}

function getProductDeleteBlocker(_product) {
  return ''
}

function getProductDeleteError(error) {
  const message = error instanceof Error ? error.message : String(error ?? '')

  if (/stock|transaction|conflict|foreign key|constraint/i.test(message)) {
    return 'Product cannot be deleted because stock history, purchases, or inventory transactions exist.'
  }

  return message || 'Delete failed'
}

function uniqueValues(values) {
  return [...new Set(values.filter((value) => value !== undefined && value !== null && value !== '').map(String))]
}

function normalizeFilterValue(value) {
  return String(value ?? '').trim()
}

function getProductStock(product) {
  return toSafeNumber(product?.stock ?? product?.currentStock ?? product?.availableQty)
}

function getProductCost(product) {
  return toSafeNumber(product?.costPrice ?? product?.cost ?? product?.price)
}

function getProductDisplayStatus(product) {
  if (isProductArchived(product)) {
    return 'Archived'
  }

  const rawStatus = String(product?.status ?? '').trim()

  if (/inactive|archived/i.test(rawStatus)) {
    return 'Inactive'
  }

  if (getProductStock(product) <= 0) {
    return 'Out Of Stock'
  }

  if (/low/i.test(rawStatus) || getProductStock(product) <= toSafeNumber(product?.reorderLevel)) {
    return 'Low Stock'
  }

  return 'In Stock'
}

function isProductLowStock(product) {
  if (!product || isProductArchived(product)) return false
  const stock = getProductStock(product)
  if (stock <= 0) return false
  const reorder = toSafeNumber(product?.reorderLevel)
  const rawStatus = String(product?.status ?? '').trim()
  return stock <= reorder || /low/i.test(rawStatus)
}

function isProductOutOfStock(product) {
  if (!product || isProductArchived(product)) return false
  return getProductStock(product) <= 0
}

function isProductArchived(product) {
  if (!product) return false
  if (product.isArchived === true || product.IsArchived === true || product.is_archived === true) return true
  if (product.isArchived === 1 || product.IsArchived === 1 || product.is_archived === 1) return true
  if (String(product.isArchived).toLowerCase() === 'true' || String(product.IsArchived).toLowerCase() === 'true') return true
  const rawStatus = String(product?.rawStatus ?? product?.sourceStatus ?? product?.status ?? '').trim().toLowerCase()
  return rawStatus === 'archived' || rawStatus === 'discontinued'
}

function cleanSku(s) {
  return String(s || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
}

function isMatchingTopProduct(product, topItem) {
  if (!product || !topItem) return false
  const pId = String(getEntityId(product) || product.productId || product.id || product._id || '').trim().toLowerCase()
  const tId = String(topItem.productId || topItem.id || '').trim().toLowerCase()
  if (pId && tId && pId === tId) return true

  const pSku = cleanSku(product.sku)
  const tSku = cleanSku(topItem.sku)
  if (pSku && tSku && pSku === tSku) return true

  const pName = String(product.name ?? '').trim().toLowerCase()
  const tName = String(topItem.name ?? '').trim().toLowerCase()
  if (pName && tName) {
    if (pName === tName || pName.startsWith(tName) || tName.startsWith(pName)) return true
    if (pName.length >= 10 && tName.length >= 10) {
      if (pName.slice(0, 15) === tName.slice(0, 15)) return true
    }
  }

  return false
}

function getOptionList(records, key) {
  return uniqueValues(records.map((record) => normalizeFilterValue(record?.[key])))
    .sort((first, second) => first.localeCompare(second))
    .map((value) => ({ value, label: value }))
}

function formatCompactCount(value) {
  return new Intl.NumberFormat('en-IN').format(Number(value) || 0)
}

function formatCompactInventoryValue(value) {
  const amount = Number(value) || 0
  const absoluteAmount = Math.abs(amount)

  if (absoluteAmount >= 10000000) {
    const croreValue = amount / 10000000
    return `₹${croreValue.toLocaleString('en-IN', {
      minimumFractionDigits: croreValue >= 10 ? 0 : 1,
      maximumFractionDigits: 1,
    })} Cr`
  }

  if (absoluteAmount >= 100000) {
    const lakhValue = amount / 100000
    return `₹${lakhValue.toLocaleString('en-IN', {
      minimumFractionDigits: lakhValue >= 10 ? 0 : 1,
      maximumFractionDigits: 1,
    })} L`
  }

  return formatCurrency(amount)
}

function readId(item, keys) {
  for (const key of keys) {
    const value = item?.[key]
    if (value !== undefined && value !== null && value !== '') {
      return String(value)
    }
  }

  return ''
}

async function listEndpoint(endpoint) {
  const response = await apiRequest(endpoint, { query: { page: 1, pageSize: 1000 } })

  if (!response.success) {
    throw new Error(response.error || 'Unable to load dependency records.')
  }

  return getResponseList(response)
}

async function deleteEndpoint(endpoint, label) {
  const response = await apiRequest(endpoint, { method: 'DELETE' })

  if (!response.success && response.status !== 404) {
    throw new Error(response.error || `${label} could not be deleted.`)
  }

  return response
}

async function deleteMany(records, idKeys, byId, label) {
  let deleted = 0

  for (const id of uniqueValues(records.map((record) => readId(record, idKeys)))) {
    await deleteEndpoint(byId(id), label)
    deleted += 1
  }

  return deleted
}

async function cleanupProductInventoryDependencies(productId) {
  const [
    stockAuditItems,
    stockAudits,
    stockMovements,
    stockLedger,
    stockRows,
    goodsReceipts,
    purchaseOrders,
  ] = await Promise.all([
    listEndpoint(API_ENDPOINTS.stockAuditItems.list),
    listEndpoint(API_ENDPOINTS.stockAudits.list),
    listEndpoint(API_ENDPOINTS.stockMovements.list),
    listEndpoint(API_ENDPOINTS.stockLedger.list),
    listEndpoint(API_ENDPOINTS.stock.list),
    listEndpoint(API_ENDPOINTS.goodsReceipts.list),
    listEndpoint(API_ENDPOINTS.purchaseOrders.list),
  ])

  const productKey = String(productId)
  const productAuditItems = stockAuditItems.filter((item) =>
    String(item.productId ?? item.ProductId ?? '') === productKey,
  )
  const affectedAuditIds = uniqueValues(productAuditItems.map((item) => item.auditId ?? item.AuditId))
  const auditIdsSafeToDelete = affectedAuditIds.filter((auditId) =>
    stockAuditItems.every((item) =>
      String(item.auditId ?? item.AuditId ?? '') !== auditId ||
      String(item.productId ?? item.ProductId ?? '') === productKey,
    ),
  )
  const productMovements = stockMovements.filter((item) =>
    String(item.productId ?? item.ProductId ?? '') === productKey,
  )
  const productLedger = stockLedger.filter((item) =>
    String(item.productId ?? item.ProductId ?? '') === productKey,
  )
  const productStock = stockRows.filter((item) =>
    String(item.productId ?? item.ProductId ?? '') === productKey,
  )
  const productReceipts = goodsReceipts.filter((item) =>
    String(item.productId ?? item.ProductId ?? '') === productKey,
  )
  const receiptPoIds = uniqueValues(productReceipts.map((item) => item.poId ?? item.PoId))
  const productPurchaseOrders = purchaseOrders.filter((item) =>
    String(item.productId ?? item.ProductId ?? '') === productKey ||
    receiptPoIds.includes(String(item.poId ?? item.PoId ?? '')),
  )

  const deleted = {
    stockAuditItems: await deleteMany(productAuditItems, ['id', 'Id', 'auditItemId', 'AuditItemId'], API_ENDPOINTS.stockAuditItems.byId, 'Stock audit item'),
    stockAudits: await deleteMany(
      stockAudits.filter((item) => auditIdsSafeToDelete.includes(String(item.auditId ?? item.AuditId ?? ''))),
      ['auditId', 'AuditId', 'id', 'Id'],
      API_ENDPOINTS.stockAudits.byId,
      'Stock audit',
    ),
    stockMovements: await deleteMany(productMovements, ['movementId', 'MovementId', 'id', 'Id'], API_ENDPOINTS.stockMovements.byId, 'Stock movement'),
    stockLedger: await deleteMany(productLedger, ['ledgerId', 'LedgerId', 'id', 'Id'], API_ENDPOINTS.stockLedger.byId, 'Stock ledger entry'),
    stock: await deleteMany(productStock, ['stockId', 'StockId', 'id', 'Id'], API_ENDPOINTS.stock.byId, 'Stock register entry'),
    goodsReceipts: await deleteMany(productReceipts, ['grnId', 'GrnId', 'grId', 'receiptId', 'id', 'Id'], API_ENDPOINTS.goodsReceipts.byId, 'Goods receipt'),
    purchaseOrders: await deleteMany(productPurchaseOrders, ['poId', 'PoId', 'id', 'Id'], API_ENDPOINTS.purchaseOrders.byId, 'Purchase order'),
  }

  return deleted
}

export default function Products({
  suppliers = [],
  warehouses = [],
  onQuickAddSupplier,
  onQuickAddWarehouse,
}) {
  const { hasPermission } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { productId } = useParams()
  const [searchParams] = useSearchParams()

  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [editingProduct, setEditingProduct] = useState(null)
  const [formInitialValues, setFormInitialValues] = useState(null)
  const [formMode, setFormMode] = useState('create')
  const [viewTarget, setViewTarget] = useState(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [bulkDeleteTarget, setBulkDeleteTarget] = useState(null)
  const [archiveTarget, setArchiveTarget] = useState(null)
  const [isArchiving, setIsArchiving] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [filters, setFilters] = useState({
    category: 'all',
    brand: 'all',
    status: 'all',
    search: '',
  })
  const productsLengthRef = useRef(products.length)
  const latestRequestIdRef = useRef(0)

  const canCreate = hasPermission('products', 'create')
  const canEdit = hasPermission('products', 'edit')
  const canDelete = hasPermission('products', 'delete')
  const filterParam = searchParams.get('filter') || searchParams.get('status')
  const isLowStockView = Boolean(filterParam && /low[-_]?stock/i.test(filterParam))
  const isTopSellingView = Boolean(filterParam && /top[-_]?(selling|products)?/i.test(filterParam))

  const [topProducts, setTopProducts] = useState(() => (Array.isArray(location.state?.topProducts) ? location.state.topProducts : []))

  useEffect(() => {
    if (Array.isArray(location.state?.topProducts) && location.state.topProducts.length > 0) {
      setTopProducts(location.state.topProducts)
    }
  }, [location.state?.topProducts])

  useEffect(() => {
    if (!isTopSellingView) return
    if (topProducts.length > 0) return

    let isMounted = true
    getTopProducts()
      .then((res) => {
        if (isMounted && res?.success && Array.isArray(res?.data) && res.data.length > 0) {
          setTopProducts(res.data)
        }
      })
      .catch(() => {})

    return () => {
      isMounted = false
    }
  }, [isTopSellingView, topProducts.length])

  useEffect(() => {
    if (!filterParam) return

    const normalized = filterParam.toLowerCase().replace(/[-_]/g, '')
    if (normalized === 'lowstock') {
      setFilters((current) => ({ ...current, status: 'Low Stock' }))
    } else if (normalized === 'outofstock') {
      setFilters((current) => ({ ...current, status: 'Out Of Stock' }))
    } else if (normalized === 'active') {
      setFilters((current) => ({ ...current, status: 'Active' }))
    } else if (normalized === 'archived') {
      setFilters((current) => ({ ...current, status: 'Archived' }))
    } else if (normalized === 'topselling' || normalized === 'topproducts') {
      setFilters((current) => ({ ...current, status: 'all' }))
    }
  }, [filterParam])

  useEffect(() => {
    const targetId = productId || searchParams.get('productId')
    if (!targetId || products.length === 0) return

    const targetKey = String(targetId).toLowerCase()
    const foundProduct = products.find(
      (p) =>
        String(getEntityId(p)).toLowerCase() === targetKey ||
        String(p.id ?? '').toLowerCase() === targetKey ||
        String(p.sku ?? '').toLowerCase() === targetKey,
    )

    if (foundProduct) {
      setViewTarget(foundProduct)
    }
  }, [productId, searchParams, products])

  function handleCloseViewTarget() {
    setViewTarget(null)
    if (productId || searchParams.get('productId')) {
      const currentFilter = searchParams.get('filter') || searchParams.get('status')
      const targetPath = currentFilter ? `/inventory/products?filter=${encodeURIComponent(currentFilter)}` : '/inventory/products'
      navigate(targetPath, { replace: true })
    }
  }

  useEffect(() => {
    productsLengthRef.current = products.length
  }, [products.length])

  const hasProductsCache = useCallback(function hasProductsCache() {
    return (
      getProductCatalog.hasCache?.({ isArchived: false }) &&
      getProductCatalog.hasCache?.({ isArchived: true })
    )
  }, [])

  const fetchProducts = useCallback(async function fetchProducts(options = {}) {
    const force = Boolean(options.force)
    const shouldShowLoading = options.showLoading ?? (force || (!hasProductsCache() && productsLengthRef.current === 0))

    const requestId = latestRequestIdRef.current + 1
    latestRequestIdRef.current = requestId

    if (shouldShowLoading) {
      setIsLoading(true)
    }

    setErrorMessage('')

    try {
      const [activeResponse, archivedResponse] = await Promise.all([
        getProductCatalog({ isArchived: false }, { force }),
        getProductCatalog({ isArchived: true }, { force }),
      ])

      if (requestId !== latestRequestIdRef.current) {
        return false
      }

      if (!activeResponse.success) {
        throw new Error(activeResponse.error || 'Active products could not be loaded from the IMS API.')
      }

      if (!archivedResponse.success) {
        throw new Error(archivedResponse.error || 'Archived products could not be loaded from the IMS API.')
      }

      setProducts(
        [...getResponseList(activeResponse, 'products'), ...getResponseList(archivedResponse, 'products')]
          .map((product) => normalizeProduct(product, { suppliers, warehouses })),
      )
      setErrorMessage('')
      return true
    } catch (error) {
      if (requestId !== latestRequestIdRef.current) {
        return false
      }
      const message =
        error instanceof Error
          ? error.message
          : 'Products could not be loaded from the IMS API.'
      setErrorMessage(message)
      showToast({ type: 'error', title: 'Products', message })
      return false
    } finally {
      if (requestId === latestRequestIdRef.current) {
        setIsLoading(false)
      }
    }
  }, [hasProductsCache, suppliers, warehouses])

  useEffect(() => {
    fetchProducts({ showLoading: !hasProductsCache() && productsLengthRef.current === 0 })
  }, [fetchProducts, hasProductsCache])

  useEffect(() => {
    function handleReconnect(event) {
      const retry = fetchProducts({ force: true, showLoading: true })
      event.detail?.addRetry?.(retry)
    }

    window.addEventListener('ims:reconnect', handleReconnect)
    return () => {
      window.removeEventListener('ims:reconnect', handleReconnect)
    }
  }, [fetchProducts])

  useEffect(() => {
    let isMounted = true

    async function fetchCategoryOptions() {
      const response = await getCategories()

      if (!isMounted || !response.success) return

      setCategories(
        (response.data ?? []).filter((category) =>
          String(category.status || 'Active').toLowerCase() !== 'inactive',
        ),
      )
    }

    fetchCategoryOptions()

    return () => {
      isMounted = false
    }
  }, [])



  function getVariantList(response) {
    const data = getResponseList(response, 'variants')
    return Array.isArray(data) ? data : []
  }

  async function runVariantRequest(request) {
    const response = await request()

    if (!response.success) {
      throw new Error(response.error || 'Variant request failed')
    }

    return getResponseData(response)
  }

  async function loadProductVariants(productId) {
    const response = await getVariantsByProduct(productId)

    if (!response.success) {
      throw new Error(response.error || 'Failed to load product variants')
    }

    return getVariantList(response)
  }

  async function syncProductVariants(productId, variantDrafts) {
    const drafts = Array.isArray(variantDrafts) ? variantDrafts : []
    const existingList = await loadProductVariants(productId)
    const existingIds = new Set(existingList.map((item) => String(getEntityId(item))))
    const draftIds = new Set(drafts.map((item) => String(item.id)))

    for (const existing of existingList) {
      const existingId = String(getEntityId(existing))
      if (!draftIds.has(existingId)) {
        await runVariantRequest(() => deleteVariant(existingId))
      }
    }

    for (const draft of drafts) {
      const payload = {
        variantName: draft.variantName || '',
        sku: draft.sku || '',
        priceDelta: toSafeNumber(draft.priceDelta, 0),
        attributes: (Array.isArray(draft.attributes) ? draft.attributes : [])
          .map((attribute) => ({
            attributeId: toNullableId(attribute.attributeId),
            valueId: toNullableId(attribute.valueId),
          }))
          .filter((attribute) => attribute.attributeId && attribute.valueId),
      }

      if (existingIds.has(String(draft.id))) {
        await runVariantRequest(() => updateVariant(String(draft.id), payload))
      } else {
        await runVariantRequest(() => createVariant(productId, payload))
      }
    }
  }

  async function saveProduct(submission, id = null) {
    const values = submission?.values ?? submission
    const changedFields = submission?.changedFields ?? Object.keys(values ?? {})
    const variantsChanged = Boolean(submission?.variantsChanged)
    const imageFile = values?.imageFile
    const imageRemoved = Boolean(values?.imageRemoved)
    const productChangedFields =
      imageFile && !imageRemoved
        ? changedFields.filter((field) => field !== 'image')
        : changedFields

    if (id) {
      const payload = prepareProductPatchPayload(values, productChangedFields)
      const hasProductChanges = Object.keys(payload).length > 0

      if (hasProductChanges) {
        const response = await patchProduct(id, payload)

        if (!response.success) {
          throw new Error(response.error || 'Save failed')
        }
      }

      if (variantsChanged) {
        await syncProductVariants(id, values.variants)
      }

      if (imageFile && !imageRemoved) {
        const uploadResponse = await uploadProductImage(id, imageFile)

        if (!uploadResponse.success) {
          throw new Error(uploadResponse.error || 'Product image upload failed')
        }
      }

      return null
    }

    const payload = prepareProductPayload(values)
    if (import.meta.env.DEV) {
      console.debug('[Products] CreateFull payload', payload)
    }

    const response = await createFullProduct(payload)

    if (!response.success) {
      throw new Error(response.error || 'Save failed')
    }

    const savedProduct = getResponseData(response)
    const productId = getEntityId(savedProduct)

    if (imageFile && !imageRemoved && productId) {
      const uploadResponse = await uploadProductImage(productId, imageFile)

      if (!uploadResponse.success) {
        throw new Error(uploadResponse.error || 'Product image upload failed')
      }
    }

    return savedProduct
  }

  async function handleSave(values, id = null) {
    setIsSaving(true)

    try {
      await saveProduct(values, id)
      showToast({ type: 'success', title: 'Products', message: 'Saved successfully' })
      await fetchProducts({ force: true })
      window.dispatchEvent(
        new CustomEvent(PRODUCT_CATALOG_UPDATED_EVENT, {
          detail: { action: id ? 'updated' : 'created' },
        }),
      )
      setIsFormOpen(false)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Save failed'
      showToast({ type: 'error', title: 'Products', message })
    } finally {
      setIsSaving(false)
    }
  }

  function handleDeleteRequest(product) {
    setDeleteTarget(product)
  }

  function handleBulkDeleteRequest(selectedProducts, onComplete) {
    if (!Array.isArray(selectedProducts) || selectedProducts.length === 0) {
      return
    }

    setBulkDeleteTarget({ products: selectedProducts, onComplete })
  }

  function handleView(product) {
    setViewTarget(product)
  }

  function handleAdjustStock(product) {
    const productId = getEntityId(product)
    navigate(productId ? `/inventory/stock?productId=${encodeURIComponent(productId)}` : '/inventory/stock')
    showToast({
      type: 'info',
      title: 'Stock adjustment',
      message: 'Opening Stock Operations for this product.',
    })
  }

  function handleArchive(product) {
    setArchiveTarget(product)
  }

  async function confirmArchive() {
    if (!archiveTarget) {
      return
    }

    const product = archiveTarget
    const id = getEntityId(product)

    if (!id) {
      showToast({ type: 'error', title: 'Products', message: 'Product identifier is missing.' })
      return
    }

    if (isProductArchived(product)) {
      showToast({ type: 'info', title: 'Products', message: 'This product is already archived.' })
      setArchiveTarget(null)
      return
    }

    setIsArchiving(true)

    try {
      const response = await patchProduct(id, { isArchived: true, status: 'inactive' })

      if (!response.success) {
        throw new Error(response.error || 'Archive failed')
      }

      showToast({ type: 'success', title: 'Products', message: 'Product archived successfully.' })
      setArchiveTarget(null)
      await fetchProducts({ force: true })
      window.dispatchEvent(new CustomEvent(PRODUCT_CATALOG_UPDATED_EVENT))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Archive failed'
      showToast({ type: 'error', title: 'Products', message })
    } finally {
      setIsArchiving(false)
    }
  }

  async function handleRestore(product) {
    const id = getEntityId(product)

    if (!id) {
      showToast({ type: 'error', title: 'Products', message: 'Product identifier is missing.' })
      return
    }

    setIsRestoring(true)

    try {
      const response = await patchProduct(id, { isArchived: false, status: 'active' })

      if (!response.success) {
        throw new Error(response.error || 'Restore failed')
      }

      showToast({ type: 'success', title: 'Products', message: 'Product restored successfully.' })
      await fetchProducts({ force: true })
      window.dispatchEvent(new CustomEvent(PRODUCT_CATALOG_UPDATED_EVENT))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Restore failed'
      showToast({ type: 'error', title: 'Products', message })
    } finally {
      setIsRestoring(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) {
      return
    }

    const blocker = getProductDeleteBlocker(deleteTarget)

    if (blocker) {
      showToast({ type: 'error', title: 'Products', message: blocker })
      return
    }

    setIsDeleting(true)

    try {
      const id = getEntityId(deleteTarget)
      const cleanup = await cleanupProductInventoryDependencies(id)
      const response = await deleteProduct(id)

      if (!response.success) {
        throw new Error(response.error || 'Delete failed')
      }

      const cleanedCount = Object.values(cleanup).reduce((sum, count) => sum + count, 0)
      showToast({
        type: 'success',
        title: 'Products',
        message: cleanedCount > 0
          ? `Deleted successfully after cleaning ${cleanedCount} inventory record${cleanedCount === 1 ? '' : 's'}.`
          : 'Deleted successfully.',
      })
      setDeleteTarget(null)
      await fetchProducts({ force: true })
      window.dispatchEvent(new CustomEvent(PRODUCT_CATALOG_UPDATED_EVENT))
    } catch (error) {
      const message = getProductDeleteError(error)
      showToast({ type: 'error', title: 'Products', message })
    } finally {
      setIsDeleting(false)
    }
  }

  async function confirmBulkDelete() {
    if (!bulkDeleteTarget?.products?.length) {
      return
    }

    const blocker = bulkDeleteTarget.products.map(getProductDeleteBlocker).find(Boolean)

    if (blocker) {
      showToast({ type: 'error', title: 'Products', message: blocker })
      return
    }

    setIsDeleting(true)

    try {
      let cleanedCount = 0

      for (const product of bulkDeleteTarget.products) {
        const id = getEntityId(product)

        if (!id) {
          throw new Error(`Product identifier is missing for ${product.name || 'one selected product'}.`)
        }

        const cleanup = await cleanupProductInventoryDependencies(id)
        cleanedCount += Object.values(cleanup).reduce((sum, count) => sum + count, 0)

        const response = await deleteProduct(id)

        if (!response.success) {
          throw new Error(response.error || `Delete failed for ${product.name || 'selected product'}`)
        }
      }

      showToast({
        type: 'success',
        title: 'Products',
        message: cleanedCount > 0
          ? `Deleted ${bulkDeleteTarget.products.length} products after cleaning ${cleanedCount} inventory records.`
          : `Deleted ${bulkDeleteTarget.products.length} products.`,
      })
      bulkDeleteTarget.onComplete?.()
      setBulkDeleteTarget(null)
      await fetchProducts({ force: true })
      window.dispatchEvent(new CustomEvent(PRODUCT_CATALOG_UPDATED_EVENT))
    } catch (error) {
      const message = getProductDeleteError(error)
      showToast({ type: 'error', title: 'Products', message })
    } finally {
      setIsDeleting(false)
    }
  }

  function handleEdit(product) {
    setEditingProduct(product)
    setFormInitialValues(product)
    setFormMode('edit')
    setIsFormOpen(true)
  }

  function handleOpenCreate() {
    setEditingProduct(null)
    setFormInitialValues(null)
    setFormMode('create')
    setIsFormOpen(true)
  }

  function handleCloseForm() {
    setEditingProduct(null)
    setFormInitialValues(null)
    setFormMode('create')
    setIsFormOpen(false)
  }

  const filteredProducts = useMemo(() => {
    if (isTopSellingView) {
      if (topProducts.length === 0) {
        return []
      }

      const matched = []
      const matchedKeys = new Set()

      topProducts.forEach((topItem) => {
        const found = products.find((p) => isMatchingTopProduct(p, topItem))
        if (found) {
          const key = String(getEntityId(found) || found.productId || found.id || found.sku || found.name)
          if (!matchedKeys.has(key)) {
            matchedKeys.add(key)
            matched.push(found)
          }
        } else if (!isLoading && products.length > 0) {
          const key = String(topItem.productId || topItem.id || topItem.sku || topItem.name)
          if (!matchedKeys.has(key)) {
            matchedKeys.add(key)
            matched.push({
              id: topItem.productId || topItem.id,
              productId: topItem.productId || topItem.id,
              name: topItem.name,
              sku: topItem.sku,
              category: 'Garden Tools',
              stock: 0,
              price: topItem.revenue && topItem.totalSold ? Math.round((topItem.revenue / topItem.totalSold) * 100) / 100 : 0,
              costPrice: 0,
              status: 'Active',
            })
          }
        }
      })

      return matched.filter((p) => {
        if (filters.category !== 'all' && normalizeFilterValue(p.category) !== filters.category) return false
        if (filters.brand !== 'all' && normalizeFilterValue(p.brand) !== filters.brand) return false
        if (filters.status !== 'all') {
          const isArchived = isProductArchived(p)
          if (filters.status === 'Archived') {
            if (!isArchived) return false
          } else {
            if (isArchived) return false
            const displayStatus = getProductDisplayStatus(p)
            if (filters.status === 'Low Stock') {
              if (!isProductLowStock(p)) return false
            } else if (filters.status === 'Out Of Stock') {
              if (!isProductOutOfStock(p)) return false
            } else if (displayStatus !== filters.status) {
              return false
            }
          }
        }
        return true
      })
    }

    return products.filter((p) => {
      const isArchived = isProductArchived(p)

      if (filters.status === 'Archived') {
        if (!isArchived) return false
      } else {
        if (isArchived) return false
      }

      const displayStatus = getProductDisplayStatus(p)
      if (filters.category !== 'all' && normalizeFilterValue(p.category) !== filters.category) return false
      if (filters.brand !== 'all' && normalizeFilterValue(p.brand) !== filters.brand) return false
      
      if (filters.status !== 'all' && filters.status !== 'Archived') {
        if (filters.status === 'Low Stock') {
          if (!isProductLowStock(p)) return false
        } else if (filters.status === 'Out Of Stock') {
          if (!isProductOutOfStock(p)) return false
        } else if (displayStatus !== filters.status) {
          return false
        }
      } else if (isLowStockView) {
        if (!isProductLowStock(p)) return false
      }

      return true
    })
  }, [products, filters, isLowStockView, isTopSellingView, topProducts, isLoading])

  const filterOptions = useMemo(() => ({
    categories: getOptionList(categories, 'name'),
    brands: getOptionList(products, 'brand'),
    statuses: PRODUCT_STATUS_FILTER_OPTIONS,
  }), [categories, products])

  function handleFilterChange(name, value) {
    setFilters((currentValue) => ({
      ...currentValue,
      [name]: value,
    }))
  }

  function handleMetricFilterClick(targetStatus) {
    if (searchParams.get('filter')) {
      navigate('/inventory/products', { replace: true })
    }

    if (targetStatus === 'top-selling') {
      if (isTopSellingView) {
        navigate('/inventory/products', { replace: true })
      } else {
        navigate('/inventory/products?filter=top-selling', { replace: true })
      }
      setFilters((currentValue) => ({
        ...currentValue,
        status: 'all',
      }))
      return
    }

    if (targetStatus === 'all') {
      setFilters({
        category: 'all',
        brand: 'all',
        status: 'all',
        search: '',
      })
    } else {
      setFilters((currentValue) => ({
        ...currentValue,
        status: currentValue.status === targetStatus ? 'all' : targetStatus,
      }))
    }
  }

  const productSummary = useMemo(() => {
    const activeInventoryProducts = products.filter((product) => !isProductArchived(product))
    const archivedProducts = products.filter(isProductArchived)
    const value = activeInventoryProducts.reduce(
      (total, product) => total + getProductStock(product) * getProductCost(product),
      0,
    )

    return {
      total: activeInventoryProducts.length,
      archived: archivedProducts.length,
      lowStock: activeInventoryProducts.filter(isProductLowStock).length,
      outOfStock: activeInventoryProducts.filter(isProductOutOfStock).length,
      inStock: activeInventoryProducts.filter((product) => getProductDisplayStatus(product) === 'In Stock').length,
      topSelling: topProducts.length,
      inventoryValue: value,
      inventoryValueLabel: formatCompactInventoryValue(value),
    }
  }, [products, topProducts.length])

  return (
    <div className="page resource-center">
      <div className="resource-center__page resource-center__page--products">
        <ProductsHeader
          canCreate={canCreate}
          summary={productSummary}
          activeStatusFilter={filters.status}
          isTopSellingView={isTopSellingView}
          onFilterStatus={handleMetricFilterClick}
          onAdd={handleOpenCreate}
        />

        {errorMessage ? (
          <StateBlock
            type="server"
            title="We could not load products"
            message={errorMessage}
            actionLabel="Retry"
            onAction={() => fetchProducts({ force: true })}
            compact
          />
        ) : null}

      <ProductsTable
        products={filteredProducts}
        canEdit={canEdit}
        canDelete={canDelete}
        filters={filters}
        filterOptions={filterOptions}
        onFilterChange={handleFilterChange}
        onView={handleView}
        onEdit={handleEdit}
        onAdjustStock={handleAdjustStock}
        onArchive={handleArchive}
        onRestore={handleRestore}
        onDelete={handleDeleteRequest}
        onBulkDelete={handleBulkDeleteRequest}
        canCreate={canCreate}
        onCreate={handleOpenCreate}
        isRestoreDisabled={isRestoring}
        onRefresh={() => fetchProducts({ force: true, showLoading: true })}
        emptyMessage={
          isLoading
            ? 'Loading products...'
            : errorMessage
              ? 'Products could not be loaded. Check the API connection and try again.'
              : isTopSellingView
                ? 'No top-selling products found.'
                : isLowStockView
                  ? 'No low-stock products found.'
                  : filters.status === 'Archived'
                    ? 'No archived products found.'
                    : filters.status === 'In Stock'
                      ? 'No in-stock products available.'
                      : 'No products available.'
        }
        loading={isLoading}
      />

      {isFormOpen && (
        <FormModal
          title={formMode === 'edit' ? 'Edit Product' : 'Add Product'}
          onClose={handleCloseForm}
          dialogClassName="product-modal"
          bodyClassName="product-modal__body"
        >
          <ProductForm
            initialValues={formInitialValues}
            modeOverride={formMode}
            suppliers={suppliers}
            warehouses={warehouses}
            products={products}
            canSubmit={formMode === 'edit' ? canEdit : canCreate}
            isSaving={isSaving}
            onQuickAddSupplier={onQuickAddSupplier}
            onQuickAddWarehouse={onQuickAddWarehouse}
            onSubmit={(data) => handleSave(data, getEntityId(editingProduct))}
            onCancel={handleCloseForm}
          />
        </FormModal>
      )}

      {viewTarget ? (
        <FormModal
          title="Product Details"
          subtitle={viewTarget.sku ? `SKU: ${viewTarget.sku}` : (viewTarget.barcode ? `Barcode: ${viewTarget.barcode}` : 'Product Master Specification')}
          onClose={handleCloseViewTarget}
          dialogClassName="product-modal product-modal--details"
          bodyClassName="product-modal__body product-modal__body--details"
        >
          <div className="product-details-view">
            {isProductArchived(viewTarget) ? (
              <div className="product-details-archived-banner" role="status">
                <Archive size={16} />
                <span>This product is marked as Archived/Discontinued and is excluded from active inventory operations.</span>
              </div>
            ) : null}

            {/* Hero Banner Header Card */}
            <div className="product-details-hero">
              <div className="product-details-hero__image-wrap">
                {viewTarget.image ? (
                  <img src={viewTarget.image} alt={viewTarget.name} className="product-details-hero__image" />
                ) : (
                  <div className="product-details-hero__placeholder">
                    <Package size={30} />
                  </div>
                )}
              </div>

              <div className="product-details-hero__content">
                <div className="product-details-hero__tags">
                  {viewTarget.category ? <span className="product-details-tag">{viewTarget.category}</span> : null}
                  {viewTarget.subCategory ? <span className="product-details-tag product-details-tag--sub">{viewTarget.subCategory}</span> : null}
                  {viewTarget.brand ? <span className="product-details-tag product-details-tag--brand">{viewTarget.brand}</span> : null}
                </div>
                <h2 className="product-details-hero__title">{viewTarget.name}</h2>
                <div className="product-details-hero__status">
                  <StatusBadge status={getProductDisplayStatus(viewTarget)}>
                    {getProductDisplayStatus(viewTarget)}
                  </StatusBadge>
                </div>
              </div>
            </div>

            {/* Financial & Inventory Key Stat Cards */}
            <div className="product-details-stats">
              <div className="product-details-stat-card product-details-stat-card--price">
                <div className="product-details-stat-card__label">Selling Price (MRP)</div>
                <div className="product-details-stat-card__value">{formatCurrency(viewTarget.price)}</div>
              </div>

              <div className="product-details-stat-card">
                <div className="product-details-stat-card__label">Cost Price</div>
                <div className="product-details-stat-card__value">{formatCurrency(getProductCost(viewTarget))}</div>
              </div>

              <div className="product-details-stat-card">
                <div className="product-details-stat-card__label">Current Stock</div>
                <div className="product-details-stat-card__value">
                  {isProductArchived(viewTarget) ? (
                    <span className="product-details-stock-archived" title="Archived products do not participate in active inventory">
                      — (Archived)
                    </span>
                  ) : (
                    `${getProductStock(viewTarget)} ${viewTarget.unit || 'Units'}`
                  )}
                </div>
              </div>
            </div>

            {/* Product Identifiers & Specifications */}
            <div className="product-details-section">
              <h3 className="product-details-section__title">Product Identifiers & Specifications</h3>
              <div className="product-details-grid">
                <div className="product-details-item">
                  <span className="product-details-item__label">Category</span>
                  <span className="product-details-item__value">{viewTarget.category || 'Uncategorized'}</span>
                </div>
                <div className="product-details-item">
                  <span className="product-details-item__label">SubCategory</span>
                  <span className="product-details-item__value">{viewTarget.subCategory || 'No subcategory'}</span>
                </div>
                <div className="product-details-item">
                  <span className="product-details-item__label">Brand</span>
                  <span className="product-details-item__value">{viewTarget.brand || 'No brand'}</span>
                </div>
                <div className="product-details-item">
                  <span className="product-details-item__label">SKU</span>
                  <span className="product-details-item__value">{viewTarget.sku || 'No SKU'}</span>
                </div>
                <div className="product-details-item">
                  <span className="product-details-item__label">Barcode</span>
                  <span className="product-details-item__value">{viewTarget.barcode || 'No barcode'}</span>
                </div>
                <div className="product-details-item">
                  <span className="product-details-item__label">Unit</span>
                  <span className="product-details-item__value">{viewTarget.unit || 'Piece'}</span>
                </div>
                <div className="product-details-item">
                  <span className="product-details-item__label">Variant Size / Spec</span>
                  <span className="product-details-item__value">{viewTarget.variantSize || 'Standard'}</span>
                </div>
                <div className="product-details-item">
                  <span className="product-details-item__label">Variant Attribute</span>
                  <span className="product-details-item__value">{viewTarget.variantColor || 'Standard'}</span>
                </div>
                <div className="product-details-item">
                  <span className="product-details-item__label">Supplier</span>
                  <span className="product-details-item__value">{viewTarget.supplierName || 'No supplier'}</span>
                </div>
                <div className="product-details-item">
                  <span className="product-details-item__label">Reorder Level</span>
                  <span className="product-details-item__value">{viewTarget.reorderLevel ?? 0}</span>
                </div>
              </div>
            </div>

            {/* Description Section */}
            {viewTarget.description ? (
              <div className="product-details-section">
                <h3 className="product-details-section__title">Description</h3>
                <div className="product-details-description">
                  <p>{viewTarget.description}</p>
                </div>
              </div>
            ) : null}

            {/* Non-overlapping Sticky Action Footer */}
            <div className="product-details-footer">
              {isProductArchived(viewTarget) && canEdit ? (
                <button
                  type="button"
                  className="button button-primary"
                  onClick={() => {
                    setViewTarget(null)
                    handleRestore(viewTarget)
                  }}
                  disabled={isRestoring}
                >
                  <RotateCcw size={16} />
                  {isRestoring ? 'Restoring...' : 'Restore Product'}
                </button>
              ) : canEdit ? (
                <button
                  type="button"
                  className="button button-primary"
                  onClick={() => {
                    setViewTarget(null)
                    handleEdit(viewTarget)
                  }}
                >
                  <Pencil size={15} />
                  Edit Product
                </button>
              ) : null}
              <button
                type="button"
                className="button button-secondary"
                onClick={handleCloseViewTarget}
              >
                Close
              </button>
            </div>
          </div>
        </FormModal>
      ) : null}

      {deleteTarget ? (
        <FormModal
          title={isProductArchived(deleteTarget) ? 'Delete Product Permanently' : 'Delete Product'}
          onClose={() => setDeleteTarget(null)}
        >
          <div className="product-delete-dialog">
            <p>
              {getProductDeleteBlocker(deleteTarget) ||
                `${isProductArchived(deleteTarget) ? 'Permanently delete' : 'Delete'} ${deleteTarget.name || 'this product'} and clean inventory dependencies in the required order? This cannot be undone.`}
            </p>
            <div className="button-row">
              <button className="button button-cancel button-secondary"
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
              >
                {getProductDeleteBlocker(deleteTarget) ? 'Close' : 'Cancel'}
              </button>
              {getProductDeleteBlocker(deleteTarget) ? null : (
                <button
                  type="button"
                  className="button button-danger"
                  onClick={confirmDelete}
                  disabled={isDeleting}
                >
                  <Trash2 size={16} />
                  {isDeleting
                    ? 'Deleting...'
                    : isProductArchived(deleteTarget)
                      ? 'Delete Permanently'
                      : 'Delete'}
                </button>
              )}
            </div>
          </div>
        </FormModal>
      ) : null}

      {bulkDeleteTarget ? (
        <FormModal
          title="Delete Selected Products"
          onClose={() => setBulkDeleteTarget(null)}
        >
          <div className="product-delete-dialog">
            <p>
              Delete {bulkDeleteTarget.products.length} selected product{bulkDeleteTarget.products.length === 1 ? '' : 's'}?
              This cannot be undone.
            </p>
            <ul className="product-delete-dialog__list">
              {bulkDeleteTarget.products.slice(0, 5).map((product) => (
                <li key={getEntityId(product) || product.name}>
                  {product.name || product.sku || 'Unnamed product'}
                </li>
              ))}
              {bulkDeleteTarget.products.length > 5 ? (
                <li>+{bulkDeleteTarget.products.length - 5} more</li>
              ) : null}
            </ul>
            <div className="button-row">
              <button className="button button-cancel button-secondary"
                type="button"
                onClick={() => setBulkDeleteTarget(null)}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button button-danger"
                onClick={confirmBulkDelete}
                disabled={isDeleting}
              >
                <Trash2 size={16} />
                {isDeleting ? 'Deleting...' : 'Delete Selected'}
              </button>
            </div>
          </div>
        </FormModal>
      ) : null}

      {archiveTarget ? (
        <FormModal
          title="Archive Product?"
          subtitle="This product will be hidden from active inventory but can be restored later."
          onClose={() => setArchiveTarget(null)}
        >
          <div className="product-delete-dialog">
            <p>
              Archive {archiveTarget.name || 'this product'}? It will move to Archived Products and remain available for restore.
            </p>
            <div className="button-row">
              <button
                type="button"
                className="button button-warning"
                onClick={confirmArchive}
                disabled={isArchiving}
              >
                <Archive size={16} />
                {isArchiving ? 'Archiving...' : 'Archive'}
              </button>
              <button
                type="button"
                className="button"
                onClick={() => setArchiveTarget(null)}
                disabled={isArchiving}
              >
                Cancel
              </button>
            </div>
          </div>
        </FormModal>
      ) : null}
      </div>
    </div>
  )
}
