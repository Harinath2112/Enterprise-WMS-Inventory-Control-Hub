import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  SlidersHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  GitBranch,
  Sparkles,
  X,
  Eye,
} from 'lucide-react'
import { apiRequest } from '../../../api/apiClient'
import { API_ENDPOINTS } from '../../../api/endpoints'
import {
  listResource,
  normalizeResourceRow,
  readResourceValue,
} from '../../../api/resourceApi'
import {
  getDescriptiveProductName,
  getDescriptiveProductBarcode,
  getDescriptiveVariantName,
} from '../../../utils/productNameUtils'
import { getStandardizedSku } from '../../../utils/skuUtils'
import { getStockRegister } from '../../../api/stockApi'
import { RESOURCE_CONFIGS } from '../../ResourceCenter/resourceConfigs'
import FormModal from '../../../layouts/FormModal'
import StateBlock from '../../../components/common/StateBlock'
import RecordDetailsView from '../../../components/common/RecordDetailsView'
import InputField from '../../../components/InputField'
import SearchableSelect from '../../../components/SearchableSelect'
import { ActionMenu, DataTable, FilterBar, StatusBadge } from '../../../components/erp'
import { showToast } from '../../../components/common/toast'
import { useAuth } from '../../../hooks/useAuth'
import { formatCurrency } from '../../../utils/helpers'
import './ProductVariants.css'

const PRODUCT_VARIANTS_COLUMNS_STORAGE_KEY = 'ims.product-variants.table.visibleColumns.v1'
const PRODUCT_VARIANTS_DEFAULT_COLUMNS = [
  'productName',
  'variantName',
  'sku',
  'mappedAttributes',
  'price',
  'costPrice',
  'status',
  'actions',
]

const config = RESOURCE_CONFIGS.productVariants

export default function ProductVariants() {
  const { hasPermission } = useAuth()
  const [variants, setVariants] = useState([])
  const [products, setProducts] = useState([])
  const [attributes, setAttributes] = useState([])
  const [attributeValues, setAttributeValues] = useState([])
  const [variantAttributes, setVariantAttributes] = useState([])
  const [stockRegister, setStockRegister] = useState([])

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState('')

  // Modal / Form state
  const [isCreateOpen, setCreateOpen] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [viewingItem, setViewingItem] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  // Filters / Search
  const [searchTerm, setSearchTerm] = useState('')
  const [productFilter, setProductFilter] = useState('')
  const [attributeFilter, setAttributeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const [formValues, setFormValues] = useState({
    productId: '',
    variantName: '',
    sku: '',
    priceDelta: 0,
    stockDelta: 0,
  })
  const [selectedAttrs, setSelectedAttrs] = useState([{ attributeId: '', valueId: '' }])
  const [serverErrors, setServerErrors] = useState({})

  const canCreate = hasPermission('productVariants', 'create')
  const canEdit = hasPermission('productVariants', 'edit')
  const canDelete = hasPermission('productVariants', 'delete')

  // ── Load Data ──────────────────────────────────────────────────────────────
  const loadData = useCallback(async (options = {}) => {
    const force = Boolean(options.force)
    const shouldShowLoading = options.showLoading ?? force

    if (shouldShowLoading) {
      setIsLoading(true)
    }
    setError('')

    try {
      const [
        variantsRes,
        productsRes,
        archivedProductsRes,
        attributesRes,
        valuesRes,
        varAttrRes,
        stockRes,
      ] = await Promise.all([
        listResource(config, { page: 1, pageSize: 500 }, { force }),
        getProducts({ page: 1, pageSize: 500 }, { force }),
        getProducts({ page: 1, pageSize: 500, isArchived: true }, { force }).catch(() => ({ success: false, data: [] })),
        getProductAttributes({ force }),
        getAttributeValues('', { force }),
        listResource({ key: 'variantAttributes', endpoint: '/variant-attributes' }, { page: 1, pageSize: 1000 }, { force }),
        getStockRegister(),
      ])

      if (!variantsRes.success) {
        throw new Error(variantsRes.error || 'Failed to load product variants.')
      }
      if (!productsRes.success) {
        throw new Error(productsRes.error || 'Failed to load products.')
      }

      const variantsList = variantsRes.data ?? []
      const activeProducts = Array.isArray(productsRes.data)
        ? productsRes.data
        : (productsRes.data?.items ?? productsRes.data?.data ?? [])
      const archivedProducts = Array.isArray(archivedProductsRes?.data)
        ? archivedProductsRes.data
        : (archivedProductsRes?.data?.items ?? archivedProductsRes?.data?.data ?? [])

      // Merge active and archived products into a Map
      const productsMap = new Map()
      ;[...activeProducts, ...archivedProducts].forEach((p) => {
        const id = String(p.productId ?? p.id ?? '')
        if (id && !productsMap.has(id)) {
          productsMap.set(id, p)
        }
      })

      // Fetch any missing product records individually
      const missingProductIds = [
        ...new Set(
          variantsList
            .map((v) => v.productId)
            .filter((id) => id && !productsMap.has(String(id)))
        ),
      ]

      if (missingProductIds.length > 0) {
        const missingResults = await Promise.allSettled(
          missingProductIds.map((id) => getProductById(id, { force }))
        )
        missingResults.forEach((res) => {
          if (res.status === 'fulfilled' && res.value?.success && res.value?.data) {
            const p = res.value.data
            const id = String(p.productId ?? p.id ?? '')
            if (id && !productsMap.has(id)) {
              productsMap.set(id, p)
            }
          }
        })
      }

      const allProductsList = Array.from(productsMap.values())
      const attributesList = attributesRes.success ? (attributesRes.data ?? []) : []
      const valuesList = valuesRes.success ? (valuesRes.data ?? []) : []
      const varAttrList = varAttrRes.success ? (varAttrRes.data ?? []) : []
      const stockList = stockRes.success ? (stockRes.data ?? []) : []

      setProducts(allProductsList)
      setAttributes(attributesList)
      setAttributeValues(valuesList)
      setVariantAttributes(varAttrList)
      setStockRegister(stockList)

      // Map and normalize variants for screen display
      const normalized = variantsList.map((variant) => {
        const variantId = variant.variantId ?? variant.id
        const productId = variant.productId
        const variantName = variant.variantName ?? variant.name ?? variant.title ?? ''

        // Find parent product details and resolve descriptive name & barcode
        const product = productsMap.get(String(productId))
        const descriptiveName = getDescriptiveProductName(product, variant)
        const descriptiveBarcode = getDescriptiveProductBarcode(product, variant)

        // Find stock total quantity for this variant
        const matchedStock = stockList.filter((s) => String(s.variantId) === String(variantId))
        const totalStock = matchedStock.reduce((sum, item) => sum + (item.quantity || 0), 0)

        // Find attribute values mappings for this variant
        const directAttrs = Array.isArray(variant.attributes)
          ? variant.attributes
          : Array.isArray(variant.variantAttributes)
          ? variant.variantAttributes
          : []

        const mappedFromDirect = directAttrs
          .map((va) => {
            const vaAttr = readResourceValue(va, 'attribute')
            const vaVal = readResourceValue(va, 'attributeValue')
            const attrName =
              readResourceValue(va, 'attributeName') ||
              (vaAttr && readResourceValue(vaAttr, 'name')) ||
              attributesList.find((a) => String(a.attributeId ?? a.id) === String(readResourceValue(va, 'attributeId')))?.name ||
              ''
            const valName =
              readResourceValue(va, 'value') ||
              readResourceValue(va, 'valueName') ||
              readResourceValue(va, 'name') ||
              (vaVal && (readResourceValue(vaVal, 'value') || readResourceValue(vaVal, 'name'))) ||
              valuesList.find((v) => String(v.valueId ?? v.id) === String(readResourceValue(va, 'valueId')))?.value ||
              ''
            return attrName ? (valName ? `${attrName}: ${valName}` : attrName) : ''
          })
          .filter(Boolean)

        const mappedFromList = varAttrList
          .filter((va) => String(readResourceValue(va, 'variantId')) === String(variantId))
          .map((va) => {
            const vaAttrId = readResourceValue(va, 'attributeId')
            const vaValId = readResourceValue(va, 'valueId')
            const attr = attributesList.find((a) => String(a.attributeId ?? a.id) === String(vaAttrId))
            const val = valuesList.find((v) => String(v.valueId ?? v.id) === String(vaValId))
            if (attr) {
              return val ? `${attr.name}: ${val.value || val.name}` : attr.name
            }
            return ''
          })
          .filter(Boolean)

        const mappedAttrs = mappedFromDirect.length > 0 ? mappedFromDirect : mappedFromList

        const descriptiveVariant = getDescriptiveVariantName(variant, product, mappedAttrs)

        return {
          ...variant,
          id: variantId,
          variantId,
          variantName: descriptiveVariant,
          rawVariantName: variant.variantName ?? variant.name ?? '',
          productName: descriptiveName,
          barcode: descriptiveBarcode,
          status: product ? product.status : 'Active',
          reorderLevel: product ? product.reorderLevel : 0,
          stock: totalStock,
          mappedAttributes: mappedAttrs,
          price: variant.price ?? (product ? product.price : 0),
          costPrice: variant.costPrice ?? (product ? product.costPrice : 0),
        }
      })

      setVariants(normalized)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load product variants data.')
      setVariants([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData({ showLoading: true })
  }, [loadData])

  // ── Handlers & Actions ──────────────────────────────────────────────────────
  const handleOpenCreate = () => {
    setEditingItem(null)
    setFormValues({
      productId: '',
      variantName: '',
      sku: '',
      priceDelta: 0,
      stockDelta: 0,
    })
    setSelectedAttrs([{ attributeId: '', valueId: '' }])
    setServerErrors({})
    setCreateOpen(true)
  }

  const handleOpenEdit = (item) => {
    const product = products.find((p) => String(p.productId ?? p.id) === String(item.productId))
    const productPrice = product ? (product.price || 0) : 0

    const currentAttrs = variantAttributes
      .filter((va) => String(readResourceValue(va, 'variantId')) === String(item.variantId))
      .map((va) => ({
        attributeId: String(readResourceValue(va, 'attributeId')),
        valueId: String(readResourceValue(va, 'valueId')),
      }))

    setEditingItem(item)
    setFormValues({
      productId: String(item.productId),
      variantName: item.variantName || '',
      sku: item.sku || '',
      priceDelta: Number(item.price || 0) - productPrice,
      stockDelta: 0,
    })
    setSelectedAttrs(currentAttrs.length > 0 ? currentAttrs : [{ attributeId: '', valueId: '' }])
    setServerErrors({})
    setCreateOpen(true)
  }

  const handleCloseModal = () => {
    setCreateOpen(false)
    setEditingItem(null)
  }

  const handleGenerateSku = () => {
    const selectedProd = products.find((p) => String(p.productId ?? p.id) === String(formValues.productId))
    if (!selectedProd) {
      showToast('Please select a product first.', 'warning')
      return
    }
    const baseSku = getStandardizedSku(selectedProd.sku, selectedProd)
    const suffix = Math.floor(1000 + Math.random() * 9000)
    setFormValues((prev) => ({
      ...prev,
      sku: `${baseSku}-VAR-${suffix}`.toUpperCase(),
    }))
  }

  const handleAddAttributeRow = () => {
    setSelectedAttrs((prev) => [...prev, { attributeId: '', valueId: '' }])
  }

  const handleRemoveAttributeRow = (index) => {
    setSelectedAttrs((prev) => prev.filter((_, i) => i !== index))
  }

  const handleAttributeChange = (index, attrId) => {
    setSelectedAttrs((prev) =>
      prev.map((row, i) => (i === index ? { attributeId: attrId, valueId: '' } : row))
    )
  }

  const handleValueChange = (index, valId) => {
    setSelectedAttrs((prev) =>
      prev.map((row, i) => (i === index ? { ...row, valueId: valId } : row))
    )
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setIsSaving(true)
    setServerErrors({})

    const payloadAttrs = selectedAttrs
      .filter((row) => row.attributeId && (editingItem || row.valueId))
      .map((row) => ({
        attributeId: Number(row.attributeId),
        ...(row.valueId ? { valueId: Number(row.valueId) } : {}),
      }))

    const payload = {
      variantName: formValues.variantName.trim(),
      sku: formValues.sku.trim(),
      priceDelta: Number(formValues.priceDelta || 0),
      stockDelta: Number(formValues.stockDelta || 0),
      attributes: payloadAttrs,
    }

    try {
      let response
      if (editingItem) {
        response = await apiRequest(`${API_ENDPOINTS.productVariants.list}/${editingItem.variantId}`, {
          method: 'PUT',
          body: payload,
        })
      } else {
        response = await apiRequest(`${API_ENDPOINTS.productVariants.list}/${formValues.productId}`, {
          method: 'POST',
          body: payload,
        })
      }

      if (!response.success) {
        if (response.validationErrors) {
          setServerErrors(response.validationErrors)
        }
        throw new Error(response.error || 'Failed to save variant.')
      }

      showToast(editingItem ? 'Product variant updated successfully.' : 'Product variant created successfully.', 'success')
      handleCloseModal()
      loadData({ force: true, showLoading: false })
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'An error occurred while saving.', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)

    try {
      const response = await apiRequest(`${API_ENDPOINTS.productVariants.list}/${deleteTarget.variantId}`, {
        method: 'DELETE',
      })

      if (!response.success) {
        throw new Error(response.error || 'Failed to delete variant.')
      }

      showToast('Product variant deleted successfully.', 'success')
      setDeleteTarget(null)
      loadData({ force: true, showLoading: false })
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'An error occurred while deleting.', 'error')
    } finally {
      setIsDeleting(false)
    }
  }

  // ── Filtered Variants list ──────────────────────────────────────────────────
  const filteredVariants = useMemo(() => {
    return variants.filter((item) => {
      // Search text matches variant name, sku, product name, or attributes list
      if (searchTerm) {
        const query = searchTerm.toLowerCase()
        const matchesName =
          item.variantName?.toLowerCase().includes(query) ||
          item.rawVariantName?.toLowerCase().includes(query)
        const matchesSku =
          item.sku?.toLowerCase().includes(query) ||
          getStandardizedSku(item.sku, item).toLowerCase().includes(query)
        const matchesProduct = item.productName?.toLowerCase().includes(query)
        const matchesAttr = item.mappedAttributes?.some((a) => a.toLowerCase().includes(query))

        if (!matchesName && !matchesSku && !matchesProduct && !matchesAttr) {
          return false
        }
      }

      // Product dropdown filter
      if (productFilter && String(item.productId) !== String(productFilter)) {
        return false
      }

      // Attribute dropdown filter
      if (attributeFilter) {
        const matchesAttr = item.mappedAttributes?.some(
          (a) => a.toLowerCase().startsWith(`${attributeFilter.toLowerCase()}:`) || a.toLowerCase().includes(attributeFilter.toLowerCase())
        )
        if (!matchesAttr) {
          return false
        }
      }

      // Status dropdown filter
      if (statusFilter && String(item.status).toLowerCase() !== String(statusFilter).toLowerCase()) {
        return false
      }

      return true
    })
  }, [variants, searchTerm, productFilter, attributeFilter, statusFilter])

  // ── DataTable columns ───────────────────────────────────────────────────────
  const columns = useMemo(
    () => [
      {
        key: 'productName',
        label: 'Product Name',
        sortable: true,
        tableWidth: 320,
        style: { width: 320, minWidth: 320 },
        headerStyle: { width: 320, minWidth: 320 },
        render: (item) => (
          <div className="variants__identity">
            <strong title={item.productName}>{item.productName}</strong>
            {item.barcode && <span className="text-muted text-xs font-mono">BC: {item.barcode}</span>}
          </div>
        ),
      },

      {
        key: 'variantName',
        label: 'Variant Name',
        sortable: true,
        tableWidth: 140,
        style: { width: 140, minWidth: 140 },
        headerStyle: { width: 140, minWidth: 140 },
        render: (item) => <span className="font-medium">{item.variantName}</span>,
      },
      {
        key: 'sku',
        label: 'SKU',
        sortable: true,
        tableWidth: 160,
        style: { width: 160, minWidth: 160 },
        headerStyle: { width: 160, minWidth: 160 },
        render: (item) => (
          <span className="variants-table__sku font-mono text-xs">
            {getStandardizedSku(item.sku, item)}
          </span>
        ),
      },
      {
        key: 'mappedAttributes',
        label: 'Attributes',
        tableWidth: 250,
        style: { width: 250, minWidth: 250 },
        headerStyle: { width: 250, minWidth: 250 },
        render: (item) => (
          <div className="variants-table__attributes-list">
            {item.mappedAttributes && item.mappedAttributes.length > 0 ? (
              item.mappedAttributes.map((attr, idx) => (
                <span key={idx} className="variants-table__attribute-badge" title={attr}>
                  {attr}
                </span>
              ))
            ) : (
              <span className="text-muted text-xs">No attributes</span>
            )}
          </div>
        ),
      },
      {
        key: 'price',
        label: 'Selling Price',
        sortable: true,
        tableWidth: 110,
        className: 'variants-col-numeric',
        style: { width: 110, minWidth: 110, textAlign: 'right' },
        headerStyle: { width: 110, minWidth: 110, textAlign: 'right' },
        render: (item) => <span>{formatCurrency(item.price)}</span>,
      },
      {
        key: 'costPrice',
        label: 'Purchase Price',
        sortable: true,
        tableWidth: 110,
        className: 'variants-col-numeric',
        style: { width: 110, minWidth: 110, textAlign: 'right' },
        headerStyle: { width: 110, minWidth: 110, textAlign: 'right' },
        render: (item) => <span>{formatCurrency(item.costPrice)}</span>,
      },
      {
        key: 'status',
        label: 'Status',
        sortable: true,
        tableWidth: 100,
        style: { width: 100, minWidth: 100 },
        headerStyle: { width: 100, minWidth: 100 },
        render: (item) => {
          const rawStatus = String(item.status || 'Active').trim()
          const formattedStatus = rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1).toLowerCase()
          return (
            <StatusBadge type={rawStatus.toLowerCase() === 'inactive' ? 'critical' : 'active'}>
              {formattedStatus}
            </StatusBadge>
          )
        },
      },
      {
        key: 'actions',
        label: 'Actions',
        className: 'variants-col-actions',
        tableWidth: 130,
        style: { width: 130, minWidth: 130 },
        headerStyle: { width: 130, minWidth: 130 },
        render: (item) => {
          const menuItems = [
            {
              key: 'view',
              label: 'View',
              icon: Eye,
              onClick: () => setViewingItem(item),
            },
            canEdit
              ? {
                  key: 'edit',
                  label: 'Edit',
                  icon: Pencil,
                  onClick: () => handleOpenEdit(item),
                }
              : null,
            canDelete
              ? {
                  key: 'delete',
                  label: 'Delete',
                  icon: Trash2,
                  variant: 'danger',
                  onClick: () => setDeleteTarget(item),
                }
              : null,
          ].filter(Boolean)

          if (menuItems.length === 0) return null

          return (
            <div className="variants-page__row-actions">
              <ActionMenu
                iconOnly
                className="inventory-row-action-menu"
                label={`Actions for ${item.variantName}`}
                actions={menuItems}
              />
            </div>
          )
        },
      },
    ],
    [canEdit, canDelete]
  )

  // ── Search & Filter toolbar content ─────────────────────────────────────────
  const filterContent = useMemo(
    () => (
      <>
        <div className="variants__filter-item variants__filter-item--product">
          <select
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
            aria-label="Filter by Product"
          >
            <option value="">All Products</option>
            {products.map((p) => (
              <option key={p.productId ?? p.id} value={p.productId ?? p.id}>
                {getDescriptiveProductName(p)}
              </option>
            ))}
          </select>
        </div>

        <div className="variants__filter-item">
          <select
            value={attributeFilter}
            onChange={(e) => setAttributeFilter(e.target.value)}
            aria-label="Filter by Attribute"
          >
            <option value="">All Attributes</option>
            {attributes.map((a) => (
              <option key={a.attributeId} value={a.name}>
                {a.name}
              </option>
            ))}
          </select>
        </div>

        <div className="variants__filter-item">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by Status"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="low stock">Low Stock</option>
          </select>
        </div>
      </>
    ),
    [productFilter, attributeFilter, statusFilter, products, attributes]
  )

  const toolbarContent = useMemo(
    () => (
      <FilterBar className="variants__toolbar-actions" ariaLabel="Variant table refresh actions">
        <button
          type="button"
          className="button button-secondary"
          onClick={() => loadData({ force: true, showLoading: true })}
          disabled={isLoading}
        >
          <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </FilterBar>
    ),
    [isLoading, loadData]
  )

  // ── Render Page ─────────────────────────────────────────────────────────────
  if (error && variants.length === 0) {
    return (
      <div className="page resource-center__page--productVariants">
        <StateBlock
          type="error"
          title="Failed to Load Product Variants"
          description={error}
          actions={
            <button type="button" className="button button-primary" onClick={() => loadData({ force: true })}>
              Try Again
            </button>
          }
        />
      </div>
    )
  }

  return (
    <div className="page resource-center__page--productVariants">
      {/* Page Header */}
      <div className="resource-center__inventory-header">
        <div className="resource-center__inventory-header-main">
          <h1>Product Variants</h1>
          <div className="resource-center__inventory-metrics">
            <span className="resource-center__inventory-metric resource-center__inventory-metric--success">
              {filteredVariants.length} Variants
            </span>
          </div>
        </div>
        {canCreate && (
          <div className="resource-center__inventory-header-actions">
            <button type="button" className="button button-primary" onClick={handleOpenCreate}>
              <Plus size={16} />
              Add Product Variant
            </button>
          </div>
        )}
      </div>

      {/* Main Table Card */}
      <div className="card resource-center__inventory-table-card">
        <DataTable
          className="resource-center__inventory-table"
          columns={columns}
          rows={filteredVariants}
          keyField="variantId"
          searchPlaceholder="Search variants by name, SKU, or attribute"
          invalidSearchMessage="Please enter a valid search term (e.g., variant SKU, product name, variant name, attribute, price)."
          loading={isLoading}
          showSearch={true}
          splitToolbar
          fitExplicitColumnsToContainer
          onSearchChange={setSearchTerm}
          searchValue={searchTerm}
          filterContent={filterContent}
          toolbarContent={toolbarContent}
          columnStorageKey={PRODUCT_VARIANTS_COLUMNS_STORAGE_KEY}
          defaultVisibleColumns={PRODUCT_VARIANTS_DEFAULT_COLUMNS}
        />
      </div>

      {/* Add / Edit Form Modal */}
      {isCreateOpen && (
        <FormModal
          title={editingItem ? 'Edit Product Variant' : 'Add Product Variant'}
          subtitle={editingItem ? 'Modify existing variant SKU, pricing, and attributes.' : undefined}
          className="form-modal--product-variants"
          onClose={handleCloseModal}
        >
          <form className="catalog-form" onSubmit={handleSave}>
            <div className="form-modal__body--variants">
              <div className="resource-form__section">
                {/* Product Selection */}
                <div className="resource-form__field resource-form__field--full">
                  <label htmlFor="productId">Parent Product <span className="required-asterisk">*</span></label>
                  {editingItem ? (
                    <input
                      type="text"
                      className="input"
                      value={editingItem.productName}
                      disabled
                      readOnly
                    />
                  ) : (
                    <SearchableSelect
                      id="productId"
                      name="productId"
                      placeholder="Select product"
                      searchPlaceholder="Search products by name"
                      options={products.map((p) => {
                        const pId = String(p.productId ?? p.id ?? '')
                        const pName = getDescriptiveProductName(p)
                        const pSku = p.sku ?? p.SKU ?? ''
                        return {
                          value: pId,
                          label: pSku ? `${pName} (${pSku})` : pName,
                        }
                      })}
                      value={formValues.productId}
                      onChange={(e) => {
                        const selectedId = typeof e === 'object' && e !== null && 'target' in e ? e.target.value : e
                        const prod = products.find((p) => String(p.productId ?? p.id) === String(selectedId))
                        const prodSku = prod?.sku ?? prod?.SKU ?? ''
                        const autoVariant = prod ? getDescriptiveVariantName(null, prod) : ''
                        setFormValues((prev) => ({
                          ...prev,
                          productId: String(selectedId || ''),
                          variantName: (!prev.variantName || /^default$/i.test(prev.variantName)) && autoVariant ? autoVariant : prev.variantName,
                          sku: prodSku ? `${prodSku}-VAR-${Math.floor(1000 + Math.random() * 9000)}`.toUpperCase() : prev.sku,
                        }))
                      }}
                      required
                    />
                  )}
                  {serverErrors.productId && (
                    <span className="error-text">{serverErrors.productId}</span>
                  )}
                </div>

                {/* Variant Name & SKU */}
                <div className="resource-form__grid-2">
                  <div className="resource-form__field">
                    <label htmlFor="variantName">Variant Name <span className="required-asterisk">*</span></label>
                    <InputField
                      id="variantName"
                      value={formValues.variantName}
                      onChange={(e) => {
                        const val = typeof e === 'object' && e !== null && 'target' in e ? e.target.value : e
                        setFormValues((prev) => ({ ...prev, variantName: val }))
                      }}
                      placeholder="e.g. medium - red, 64GB"
                      required
                    />
                    {serverErrors.variantName && (
                      <span className="error-text">{serverErrors.variantName}</span>
                    )}
                  </div>

                  <div className="resource-form__field">
                    <label htmlFor="sku">Variant SKU <span className="required-asterisk">*</span></label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <InputField
                        id="sku"
                        value={formValues.sku}
                        onChange={(e) => {
                          const val = typeof e === 'object' && e !== null && 'target' in e ? e.target.value : e
                          setFormValues((prev) => ({ ...prev, sku: val }))
                        }}
                        placeholder="Variant SKU"
                        required
                        style={{ flex: 1 }}
                      />
                      <button
                        type="button"
                        className="button button-secondary"
                        style={{ height: '38px', minHeight: '38px', minWidth: '38px', padding: '0 10px' }}
                        onClick={handleGenerateSku}
                        title="Auto-generate variant SKU"
                      >
                        <Sparkles size={16} />
                      </button>
                    </div>
                    {serverErrors.sku && <span className="error-text">{serverErrors.sku}</span>}
                  </div>
                </div>

                {/* Pricing & Stock adjustments */}
                <div className="resource-form__grid-2">
                  <div className="resource-form__field">
                    <label htmlFor="priceDelta">Price Adjustment (Selling Price Delta)</label>
                    <InputField
                      id="priceDelta"
                      type="number"
                      value={formValues.priceDelta}
                      onChange={(e) => {
                        const val = typeof e === 'object' && e !== null && 'target' in e ? e.target.value : e
                        setFormValues((prev) => ({ ...prev, priceDelta: val }))
                      }}
                      placeholder="e.g. 10.00 or -5.00"
                    />
                    <span className="text-muted text-xs" style={{ marginTop: '2px' }}>
                      Adds or subtracts from parent product base price.
                    </span>
                    {serverErrors.priceDelta && (
                      <span className="error-text">{serverErrors.priceDelta}</span>
                    )}
                  </div>

                  {!editingItem ? (
                    <div className="resource-form__field">
                      <label htmlFor="stockDelta">Initial Stock Quantity</label>
                      <InputField
                        id="stockDelta"
                        type="number"
                        min="0"
                        value={formValues.stockDelta}
                        onChange={(e) => {
                          const val = typeof e === 'object' && e !== null && 'target' in e ? e.target.value : e
                          setFormValues((prev) => ({ ...prev, stockDelta: val }))
                        }}
                        placeholder="0"
                      />
                      {serverErrors.stockDelta && (
                        <span className="error-text">{serverErrors.stockDelta}</span>
                      )}
                    </div>
                  ) : (
                    <div className="resource-form__field">
                      <label>Stock Quantity (Read-only)</label>
                      <input
                        type="text"
                        className="input"
                        value={editingItem.stock}
                        disabled
                        readOnly
                      />
                    </div>
                  )}
                </div>

                {/* Attributes Row list */}
                <div className="variants-form__attributes-section">
                  <div className="variants-form__attributes-title">
                    <h4>Variant Attributes Composition</h4>
                    <button
                      type="button"
                      className="button button-secondary"
                      onClick={handleAddAttributeRow}
                      style={{ height: '30px', minHeight: '30px', padding: '0 10px', fontSize: '12px' }}
                    >
                      <Plus size={14} />
                      Add Attribute
                    </button>
                  </div>

                  {selectedAttrs.map((row, idx) => {
                    const rowValues = attributeValues.filter(
                      (v) => String(v.attributeId) === String(row.attributeId)
                    )
                    return (
                      <div key={idx} className="variants-form__attributes-row">
                        <div className="resource-form__field">
                          <label>Attribute</label>
                          <select
                            value={row.attributeId}
                            onChange={(e) => handleAttributeChange(idx, e.target.value)}
                            className="input"
                            style={{ height: '38px' }}
                          >
                            <option value="">Select Attribute</option>
                            {attributes.map((a) => (
                              <option
                                key={a.attributeId}
                                value={a.attributeId}
                                disabled={selectedAttrs.some(
                                  (sa, sIdx) => sIdx !== idx && String(sa.attributeId) === String(a.attributeId)
                                )}
                              >
                                {a.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {!editingItem && (
                          <div className="resource-form__field">
                            <label>Value</label>
                            <select
                              value={row.valueId}
                              onChange={(e) => handleValueChange(idx, e.target.value)}
                              disabled={!row.attributeId}
                              className="input"
                              style={{ height: '38px' }}
                            >
                              <option value="">Select Value</option>
                              {rowValues.map((v) => (
                                <option key={v.valueId} value={v.valueId}>
                                  {v.value || v.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        <button
                          type="button"
                          className="button-icon-only"
                          onClick={() => handleRemoveAttributeRow(idx)}
                          title="Remove attribute"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    )
                  })}
                  {selectedAttrs.length === 0 && (
                    <p className="text-muted text-xs">No attributes assigned to this variant composition yet.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="button-row form-modal__footer">
              <button type="submit" className="button button-primary" disabled={isSaving}>
                <Save size={16} />
                {isSaving ? 'Saving...' : 'Save Variant'}
              </button>
              <button className="button button-cancel"
                type="button"
                onClick={handleCloseModal}
                disabled={isSaving}
              >
                Cancel
              </button>
            </div>
          </form>
        </FormModal>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <FormModal
          title="Delete Product Variant"
          onClose={() => {
            if (!isDeleting) {
              setDeleteTarget(null)
            }
          }}
        >
          <div className="resource-center__delete-dialog">
            <div className="delete-confirmation__copy">
              <p>
                Are you sure you want to delete <strong>{deleteTarget.variantName}</strong>{' '}
                (<code>{getStandardizedSku(deleteTarget.sku, deleteTarget)}</code>)?
              </p>
              <p className="delete-confirmation__warning">This action cannot be undone.</p>
            </div>
            <div className="button-row">
              <button className="button button-cancel button-secondary"
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button button-danger"
                onClick={confirmDelete}
                disabled={isDeleting}
              >
                <Trash2 size={16} />
                {isDeleting ? 'Deleting...' : 'Delete Variant'}
              </button>
            </div>
          </div>
        </FormModal>
      )}

      {/* View Details Modal */}
      {viewingItem && (
        <RecordDetailsView
          modalTitle="Product Variant Details"
          heroTitle={viewingItem.variantName || viewingItem.name}
          heroSubtitle={`Product: ${viewingItem.productName} • SKU: ${getStandardizedSku(viewingItem.sku, viewingItem)}`}
          icon={GitBranch}
          status={viewingItem.status || 'Active'}
          fields={[
            { label: 'Product Name', value: viewingItem.productName },
            { label: 'Variant Name', value: viewingItem.variantName },
            { label: 'SKU', render: () => <code>{getStandardizedSku(viewingItem.sku, viewingItem)}</code> },
            { label: 'Selling Price', value: formatCurrency(viewingItem.price) },
            { label: 'Purchase Price', value: formatCurrency(viewingItem.costPrice) },
            { label: 'Status', render: () => <StatusBadge status={viewingItem.status || 'Active'}>{viewingItem.status || 'Active'}</StatusBadge> },
            {
              label: 'Attributes',
              render: () => (
                <div className="variants-table__attributes-list">
                  {viewingItem.mappedAttributes && viewingItem.mappedAttributes.length > 0 ? (
                    viewingItem.mappedAttributes.map((attr, idx) => (
                      <span key={idx} className="variants-table__attribute-badge">
                        {attr}
                      </span>
                    ))
                  ) : (
                    <span className="text-muted text-xs">No attributes</span>
                  )}
                </div>
              ),
              fullWidth: true,
            },
          ]}
          onClose={() => setViewingItem(null)}
        />
      )}
    </div>
  )
}
