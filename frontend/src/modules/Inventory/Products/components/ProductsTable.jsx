import {
  Archive,
  Boxes,
  Check,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import ProductIdentity from '../../../../components/ProductIdentity'
import {
  ActionMenu,
  DataTable,
  ExportMenu,
  FilterBar,
  FilterDropdown,
  StatusBadge,
} from '../../../../components/erp'
import { formatCurrency } from '../../../../utils/helpers'
import { getStandardizedSku } from '../../../../utils/skuUtils'
import { getDescriptiveVariantName } from '../../../../utils/productNameUtils'

function getProductId(product) {
  return product?.productId ?? product?.id ?? product?._id ?? ''
}

function getProductStatusType(product) {
  const status = getProductStatusLabel(product)

  if (status === 'Archived') return 'draft'
  if (status === 'Inactive' || status === 'Out Of Stock') return 'failed'
  if (status === 'Low Stock') return 'warning'
  return 'success'
}

function getProductStatusLabel(product) {
  if (isProductArchived(product)) return 'Archived'

  const rawStatus = String(product?.rawStatus ?? product?.sourceStatus ?? product?.status ?? '').trim().toLowerCase()
  const stock = Number(product.stock ?? product.currentStock ?? product.availableQty ?? 0)
  const reorderLevel = Number(product.reorderLevel ?? 0)

  if (rawStatus === 'inactive') return 'Inactive'
  if (stock <= 0) return 'Out Of Stock'
  if (/low/i.test(rawStatus) || stock <= reorderLevel) return 'Low Stock'
  return 'In Stock'
}

function isProductArchived(product) {
  if (!product) return false
  if (product.isArchived === true || product.IsArchived === true || product.is_archived === true) return true
  if (product.isArchived === 1 || product.IsArchived === 1 || product.is_archived === 1) return true
  if (String(product.isArchived).toLowerCase() === 'true' || String(product.IsArchived).toLowerCase() === 'true') return true
  const rawStatus = String(product?.rawStatus ?? product?.sourceStatus ?? product?.status ?? '').trim().toLowerCase()
  return rawStatus === 'archived' || rawStatus === 'discontinued'
}

function getVariantLabel(product) {
  if (product.variantSize || product.variantColor) {
    const parts = [
      product.variantSize,
      product.variantColor && !/^default$/i.test(product.variantColor) ? product.variantColor : '',
    ].filter(Boolean)
    if (parts.length > 0) return parts.join(' / ')
  }

  return getDescriptiveVariantName(null, product) || 'Standard'
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function getExportImageSrc(value) {
  const rawValue = String(value ?? '').trim()

  if (!rawValue) {
    return ''
  }

  try {
    return new URL(rawValue, window.location.origin).href
  } catch {
    return rawValue
  }
}

function exportProductsExcel(products) {
  const rows = products.map((product) => `
    <tr>
      <td>${product.image ? `<img src="${escapeHtml(getExportImageSrc(product.image))}" alt="" />` : ''}</td>
      <td>${escapeHtml(product.name)}</td>
      <td>${escapeHtml(getStandardizedSku(product.sku, product))}</td>
      <td>${escapeHtml(product.barcode)}</td>
      <td>${escapeHtml(product.category)}</td>
      <td>${escapeHtml(product.subCategory)}</td>
      <td>${escapeHtml(product.brand)}</td>
      <td>${escapeHtml(product.unit)}</td>
      <td>${escapeHtml(product.price)}</td>
      <td>${escapeHtml(isProductArchived(product) ? '—' : product.stock)}</td>
      <td>${escapeHtml(getProductStatusLabel(product))}</td>
    </tr>
  `).join('')
  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
      <head>
        <meta charset="UTF-8" />
        <style>
          table { border-collapse: collapse; font-family: Segoe UI, Arial, sans-serif; font-size: 12px; }
          th, td { border: 1px solid #d1d5db; padding: 6px; vertical-align: middle; }
          th { background: #f8fafc; font-weight: 700; }
          img { width: 44px; height: 44px; object-fit: cover; border-radius: 4px; }
        </style>
      </head>
      <body>
        <table>
          <thead>
            <tr>
              <th>Image</th>
              <th>Product</th>
              <th>SKU</th>
              <th>Barcode</th>
              <th>Category</th>
              <th>SubCategory</th>
              <th>Brand</th>
              <th>Unit</th>
              <th>Price</th>
              <th>Stock</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </body>
    </html>
  `
  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'ProductCatalog.xls'
  link.click()
  URL.revokeObjectURL(url)
}

function printProductsPdf(products) {
  const rows = products.map((product) => `
    <tr>
      <td>${product.image ? `<img src="${escapeHtml(getExportImageSrc(product.image))}" alt="" />` : ''}</td>
      <td>${escapeHtml(product.name)}</td>
      <td>${escapeHtml(getStandardizedSku(product.sku, product))}</td>
      <td>${escapeHtml(product.barcode)}</td>
      <td>${escapeHtml(product.category)}</td>
      <td>${escapeHtml(product.subCategory)}</td>
      <td>${escapeHtml(product.brand)}</td>
      <td>${escapeHtml(product.unit)}</td>
      <td>${escapeHtml(product.price)}</td>
      <td>${escapeHtml(isProductArchived(product) ? '—' : product.stock)}</td>
      <td>${escapeHtml(getProductStatusLabel(product))}</td>
    </tr>
  `).join('')
  const printWindow = window.open('', '_blank', 'width=1100,height=800')

  if (!printWindow) {
    return
  }

  printWindow.document.write(`
    <html>
      <head>
        <title>Product Catalog</title>
        <style>
          body { font-family: Segoe UI, Arial, sans-serif; color: #0f172a; padding: 20px; }
          h1 { font-size: 18px; margin: 0 0 12px; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th, td { border: 1px solid #d1d5db; padding: 6px; text-align: left; vertical-align: middle; }
          th { background: #f8fafc; }
          img { width: 40px; height: 40px; object-fit: cover; border-radius: 4px; }
        </style>
      </head>
      <body>
        <h1>Product Catalog</h1>
        <table>
          <thead>
            <tr>
              <th>Image</th>
              <th>Product</th>
              <th>SKU</th>
              <th>Barcode</th>
              <th>Category</th>
              <th>SubCategory</th>
              <th>Brand</th>
              <th>Unit</th>
              <th>Price</th>
              <th>Stock</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </body>
    </html>
  `)
  printWindow.document.close()

  const images = Array.from(printWindow.document.images)
  const runPrint = () => {
    printWindow.focus()
    printWindow.print()
  }

  if (images.length === 0) {
    runPrint()
    return
  }

  Promise.all(
    images.map((image) =>
      image.complete
        ? Promise.resolve()
        : new Promise((resolve) => {
            image.onload = resolve
            image.onerror = resolve
          }),
    ),
  ).then(runPrint)
}

export default function ProductTable({
  products,
  canCreate: _canCreate,
  canEdit,
  canDelete,
  filters = { category: 'all', brand: 'all', status: 'all' },
  filterOptions = { categories: [], brands: [], statuses: [] },
  onFilterChange,
  onView,
  onEdit,
  onAdjustStock,
  onArchive,
  onRestore,
  onDelete,
  onBulkDelete,
  onCreate: _onCreate,
  isRestoreDisabled = false,
  loading = false,
  emptyMessage = 'No products available.',
  onRefresh,
}) {
  const [selectedProductIds, setSelectedProductIds] = useState([])
  const selectedProducts = useMemo(() => {
    const selectedIdSet = new Set(selectedProductIds.map(String))
    return products.filter((product) => selectedIdSet.has(String(getProductId(product))))
  }, [products, selectedProductIds])
  const hasSelectedProducts = selectedProducts.length > 0

  function handleBulkDelete() {
    if (!canDelete || selectedProducts.length === 0) {
      return
    }

    onBulkDelete?.(selectedProducts, () => setSelectedProductIds([]))
  }

  const columns = [
    {
      key: 'name',
      label: 'Product',
      tableWidth: 360,
      className: 'products-col-product',
      sortable: true,
      mobilePrimary: true,
      mobileLabel: 'Product',
      hideable: false,
      searchValue: (product) =>
        `${product.name} ${product.sku} ${getStandardizedSku(product.sku, product)} ${product.barcode} ${product.category} ${product.subCategory} ${product.brand}`,
      render: (product) => (
        <ProductIdentity
          name={product.name}
          image={product.image || product.imageUrl}
          meta={product.brand || product.category || 'Generic brand'}
          size="lg"
        />
      ),
    },
    {
      key: 'sku',
      label: 'SKU',
      tableWidth: 220,
      className: 'products-col-sku',
      mobileLabel: 'SKU',
      sortable: true,
      render: (product) => (
        <div className="products-table__stack">
          <strong>{getStandardizedSku(product.sku, product)}</strong>
          <span>{product.barcode || 'Barcode pending'}</span>
        </div>
      ),
    },
    {
      key: 'category',
      label: 'Category',
      tableWidth: 240,
      className: 'products-col-category',
      sortable: true,
      render: (product) => (
        <div className="products-table__stack">
          <strong>{product.category}</strong>
          <span>{product.subCategory || 'No subcategory'}</span>
        </div>
      ),
    },
    {
      key: 'unit',
      label: 'Unit',
      tableWidth: 100,
      className: 'products-col-unit',
      sortable: true,
      render: (product) => product.unit || 'Unit not set',
    },
    {
      key: 'variantColor',
      label: 'Variant',
      tableWidth: 130,
      className: 'products-col-variant',
      sortable: true,
      render: (product) =>
        product.variantSize || product.variantColor ? (
          <div className="products-table__stack">
            <strong>{product.variantSize || 'Standard'}</strong>
            <span>{product.variantColor || 'Default color'}</span>
          </div>
        ) : (
          'Standard'
        ),
    },
    {
      key: 'supplierName',
      label: 'Supplier',
      tableWidth: 180,
      className: 'products-col-supplier',
      sortable: true,
    },
    {
      key: 'stock',
      label: 'Stock',
      tableWidth: 130,
      className: 'products-col-stock',
      sortable: true,
      sortValue: (product) => (isProductArchived(product) ? -1 : Number(product.stock ?? 0)),
      render: (product) => {
        if (isProductArchived(product)) {
          return (
            <div className="products-table__stack products-table__stack--archived" title="Archived products do not participate in active inventory operations">
              <strong className="products-table__stock-archived-value">—</strong>
              <span className="products-table__stock-archived-label">Archived</span>
            </div>
          )
        }

        return (
          <div className="products-table__stack">
            <strong>{product.stock}</strong>
            <span>Reorder at {product.reorderLevel}</span>
          </div>
        )
      },
    },
    {
      key: 'price',
      label: 'Price',
      tableWidth: 130,
      className: 'products-col-price',
      sortable: true,
      render: (product) => formatCurrency(product.price),
    },
    {
      key: 'status',
      label: 'Status',
      tableWidth: 140,
      className: 'products-col-status',
      sortable: true,
      mobileStatus: true,
      render: (product) => (
        <StatusBadge
          type={getProductStatusType(product)}
        >
          {getProductStatusLabel(product)}
        </StatusBadge>
      ),
    },
  ]

  columns.push({
    key: 'actions',
    label: 'Actions',
    tableWidth: 90,
    className: 'products-col-actions',
    searchable: false,
    hideable: false,
    render: (product) => (
      <ActionMenu
        iconOnly
        className="inventory-row-action-menu"
        label={`Actions for ${product.name || getProductId(product)}`}
        actions={isProductArchived(product)
          ? [
              {
                key: 'view',
                label: 'View Details',
                icon: Eye,
                onClick: () => onView?.(product),
              },
              canEdit ? {
                key: 'restore',
                label: 'Restore Product',
                icon: RotateCcw,
                disabled: isRestoreDisabled,
                onClick: () => onRestore?.(product),
              } : null,
              canDelete ? {
                key: 'delete-permanently',
                label: 'Delete Permanently',
                icon: Trash2,
                variant: 'danger',
                onClick: () => onDelete(product),
              } : null,
            ]
          : [
              {
                key: 'view',
                label: 'View',
                icon: Eye,
                onClick: () => onView?.(product),
              },
              canEdit ? {
                key: 'edit',
                label: 'Edit',
                icon: Pencil,
                onClick: () => onEdit(product),
              } : null,
              canEdit ? {
                key: 'adjust-stock',
                label: 'Adjust Stock',
                icon: Boxes,
                onClick: () => onAdjustStock?.(product),
              } : null,
              canEdit ? {
                key: 'archive',
                label: 'Archive',
                icon: Archive,
                onClick: () => onArchive?.(product),
              } : null,
              canDelete ? {
                key: 'delete',
                label: 'Delete',
                icon: Trash2,
                variant: 'danger',
                onClick: () => onDelete(product),
              } : null,
            ]}
      />
    ),
  })

  function renderProductMobileCard({ row: product }) {
    return (
      <article className={`products-mobile-card ${getProductStatusLabel(product) === 'Low Stock' ? 'products-mobile-card--low' : ''}`.trim()}>
        <div className="products-mobile-card__header">
          <ProductIdentity
            name={product.name}
            image={product.image || product.imageUrl}
            meta={product.brand || product.category || 'Generic brand'}
            size="sm"
            className="products-mobile-card__identity"
          />
          <StatusBadge type={getProductStatusType(product)}>{getProductStatusLabel(product)}</StatusBadge>
        </div>

        <dl className="products-mobile-card__meta products-mobile-card__meta--catalog">
          <div>
            <dt>SKU</dt>
            <dd>{product.sku || 'SKU pending'}</dd>
          </div>
          <div>
            <dt>Barcode</dt>
            <dd>{product.barcode || 'Pending'}</dd>
          </div>
          <div>
            <dt>Category</dt>
            <dd>{product.category || 'Uncategorized'}</dd>
          </div>
          <div>
            <dt>Unit</dt>
            <dd>{product.unit || 'Not set'}</dd>
          </div>
          <div>
            <dt>Variant</dt>
            <dd>{getVariantLabel(product)}</dd>
          </div>
          <div className="products-mobile-card__metric products-mobile-card__metric--price">
            <dt>Price</dt>
            <dd>{formatCurrency(product.price)}</dd>
          </div>
        </dl>

        <dl className="products-mobile-card__meta products-mobile-card__meta--operations">
          <div>
            <dt>Supplier</dt>
            <dd>{product.supplierName || 'No supplier'}</dd>
          </div>
          <div className="products-mobile-card__metric products-mobile-card__metric--stock">
            <dt>Stock</dt>
            <dd>{isProductArchived(product) ? '—' : (product.stock ?? 0)}</dd>
          </div>
          <div>
            <dt>Reorder</dt>
            <dd>{isProductArchived(product) ? 'Archived' : (product.reorderLevel ?? 0)}</dd>
          </div>
        </dl>

        <div className="products-mobile-card__actions">
          <ActionMenu
            className="inventory-row-action-menu"
            label="Actions"
            actions={isProductArchived(product)
              ? [
                  { key: 'view', label: 'View Details', icon: Eye, onClick: () => onView?.(product) },
                  canEdit ? { key: 'restore', label: 'Restore Product', icon: RotateCcw, disabled: isRestoreDisabled, onClick: () => onRestore?.(product) } : null,
                  canDelete ? { key: 'delete-permanently', label: 'Delete Permanently', icon: Trash2, variant: 'danger', onClick: () => onDelete(product) } : null,
                ]
              : [
                  { key: 'view', label: 'View', icon: Eye, onClick: () => onView?.(product) },
                  canEdit ? { key: 'edit', label: 'Edit', icon: Pencil, onClick: () => onEdit(product) } : null,
                  canEdit ? { key: 'adjust-stock', label: 'Adjust Stock', icon: Boxes, onClick: () => onAdjustStock?.(product) } : null,
                  canEdit ? { key: 'archive', label: 'Archive', icon: Archive, onClick: () => onArchive?.(product) } : null,
                  canDelete ? { key: 'delete', label: 'Delete', icon: Trash2, variant: 'danger', onClick: () => onDelete(product) } : null,
                ]}
          />
        </div>
      </article>
    )
  }

  const filterControls = (
    <FilterBar className="products-page__filters">
      <FilterDropdown
        value={filters.category}
        allLabel="Category"
        options={filterOptions.categories}
        onChange={(value) => onFilterChange?.('category', value)}
      />
      <FilterDropdown
        value={filters.brand}
        allLabel="Brand"
        options={filterOptions.brands}
        onChange={(value) => onFilterChange?.('brand', value)}
      />
      <FilterDropdown
        value={filters.status}
        allLabel="All Statuses"
        options={filterOptions.statuses}
        onChange={(value) => onFilterChange?.('status', value)}
      />
    </FilterBar>
  )

  const primaryToolbarContent = (
    <div className="products-table__primary-controls">
      {filterControls}
    </div>
  )

  const selectedToolbarContent = hasSelectedProducts ? (
    <FilterBar className="products-table__selection-actions" ariaLabel="Selected product actions">
      <div className="products-selection-summary" aria-live="polite">
        <Check size={15} />
        <strong>{selectedProducts.length} selected</strong>
      </div>
      <button
        type="button"
        className="button button-secondary products-table__selection-button"
        onClick={() => exportProductsExcel(selectedProducts)}
      >
        <Download size={15} />
        Export
      </button>
      <button
        type="button"
        className="button button-secondary products-table__selection-button"
        onClick={() => printProductsPdf(selectedProducts)}
      >
        <Printer size={15} />
        Print
      </button>
      {canDelete ? (
        <button
          type="button"
          className="button button-secondary products-table__selection-button products-table__selection-button--danger"
          onClick={handleBulkDelete}
        >
          <Trash2 size={15} />
          Delete
        </button>
      ) : null}
    </FilterBar>
  ) : null

  return (
    <div className="card resource-center__inventory-table-card">
      <DataTable
        className="resource-center__inventory-table"
        rows={products}
        columns={columns}
        defaultPageSize={20}
        defaultVisibleColumnKeys={['name', 'sku', 'category', 'stock', 'price', 'status', 'actions']}
        lockedColumnKeys={['name', 'actions']}
        columnStorageKey="ims.products.table.visibleColumns.workspace.v2"
        keyField="productId"
        searchPlaceholder="Search products by name, SKU, or category"
        searchTerm={filters.search || ''}
        onSearchChange={(value) => onFilterChange?.('search', value)}
        emptyMessage={emptyMessage}
        loading={loading}
        showSearch={!hasSelectedProducts}
        splitToolbar
        fitExplicitColumnsToContainer
        filterContent={hasSelectedProducts ? selectedToolbarContent : primaryToolbarContent}
        toolbarContent={
          <FilterBar className="products-table__toolbar-actions" ariaLabel="Product table utility actions">
            <button
              type="button"
              className="button button-secondary"
              onClick={onRefresh}
              disabled={loading}
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </FilterBar>
        }
        rowClassName={(product) =>
          `${isProductArchived(product) ? 'products-table__row--archived' : getProductStatusLabel(product) === 'Low Stock' ? 'products-table__row--low' : ''} ${
            selectedProductIds.includes(String(getProductId(product))) ? 'is-selected' : ''
          }`.trim()
        }
        renderMobileCard={renderProductMobileCard}
        enableRowSelection
        selectedRowKeys={selectedProductIds}
        onSelectionChange={setSelectedProductIds}
      />
    </div>
  )
}
