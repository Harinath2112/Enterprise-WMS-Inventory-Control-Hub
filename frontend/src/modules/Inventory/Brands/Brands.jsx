import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Check,
  Download,
  Eye,
  LoaderCircle,
  Package,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Trash2,
} from 'lucide-react'
import {
  createBrand,
  deleteBrand,
  getBrands,
  normalizeBrand,
  updateBrand,
} from '../../../api/productApi'
import InputField from '../../../components/InputField'
import StateBlock from '../../../components/common/StateBlock'
import { ActionMenu, DataTable, FilterBar } from '../../../components/erp'
import { showToast } from '../../../components/common/toast'
import FormModal from '../../../layouts/FormModal'
import RecordDetailsView from '../../../components/common/RecordDetailsView'
import { useAuth } from '../../../hooks/useAuth'
import './Brands.css'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function cleanText(value) {
  return String(value ?? '').trim()
}

function normalizeComparable(value) {
  return cleanText(value).toLowerCase()
}

function escapeCsvValue(value) {
  const text = String(value ?? '')
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function exportBrandsCsv(items) {
  const headers = ['Brand Name', 'Description']
  const rows = items.map((item) => [
    item.name,
    item.description || '',
  ])
  const csv = [headers, ...rows]
    .map((row) => row.map(escapeCsvValue).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'Brands.csv'
  link.click()
  URL.revokeObjectURL(url)
}

function printBrands(items) {
  const rows = items
    .map(
      (item) => `
    <tr>
      <td><strong>${escapeHtml(item.name || 'Unnamed Brand')}</strong><span>ID ${escapeHtml(item.id)}</span></td>
      <td>${escapeHtml(item.description || 'No description')}</td>
    </tr>
  `,
    )
    .join('')
  const printWindow = window.open('', '_blank')
  if (!printWindow) return
  printWindow.document.write(`<!doctype html><html><head><title>Brands</title><style>
    body { margin: 28px; color: #111827; font: 13px Arial, sans-serif; }
    h1 { margin: 0 0 16px; font-size: 20px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 8px 10px; border: 1px solid #dbe4f0; text-align: left; vertical-align: top; }
    th { background: #f8fafc; color: #475569; font-size: 12px; }
    td span { display: block; color: #64748b; margin-top: 2px; }
  </style></head><body>
    <h1>Brands</h1>
    <table>
      <thead><tr><th>Brand</th><th>Description</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </body></html>`)
  printWindow.document.close()
  printWindow.focus()
  printWindow.print()
}

// ─────────────────────────────────────────────────────────────────────────────
// BrandForm Component
// ─────────────────────────────────────────────────────────────────────────────

function BrandForm({ editingBrand, items, onSubmit, onCancel, isSubmitting }) {
  const isEditing = Boolean(editingBrand?.id)
  const [formData, setFormData] = useState(() => ({
    name: editingBrand?.name ?? '',
    description: editingBrand?.description ?? '',
  }))
  const [touched, setTouched] = useState({})

  const name = cleanText(formData.name)
  const description = cleanText(formData.description)

  const duplicateName = items.some(
    (item) =>
      normalizeComparable(item.name) === normalizeComparable(name) &&
      String(item.id) !== String(editingBrand?.id ?? ''),
  )

  const errors = {
    name: !name
      ? 'Brand name is required.'
      : duplicateName
        ? 'Brand name already exists.'
        : '',
  }

  const isFormValid = Object.values(errors).every((value) => !value)
  const hasChanges = isEditing
    ? name !== cleanText(editingBrand?.name) ||
      description !== cleanText(editingBrand?.description)
    : Boolean(name || description)

  const canSubmit = isFormValid && hasChanges && !isSubmitting

  function handleChange(event) {
    const { name: fieldName, value } = event.target
    setFormData((current) => ({ ...current, [fieldName]: value }))
  }

  function handleBlur(event) {
    setTouched((current) => ({ ...current, [event.target.name]: true }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    setTouched({ name: true })
    if (!canSubmit) return
    onSubmit({ name, description })
  }

  return (
    <form className="catalog-form" onSubmit={handleSubmit} autoComplete="off">
      <div className="catalog-form__section">
        <div className="form-grid">
          <InputField
            id="brand-name"
            name="name"
            label="Brand Name *"
            value={formData.name}
            onChange={handleChange}
            onBlur={handleBlur}
            error={touched.name ? errors.name : ''}
            placeholder="Example: Lenovo"
            maxLength={160}
          />

          <InputField
            id="brand-description"
            name="description"
            label="Description"
            textarea
            rows={4}
            className="field--full"
            value={formData.description}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="Optional sourcing, warranty, or catalog note"
            maxLength={500}
          />
        </div>
      </div>

      <div className="button-row catalog-form__footer">
        <button
          type="submit"
          className="button button-primary"
          disabled={!canSubmit}
        >
          {isSubmitting ? (
            <LoaderCircle size={16} className="animate-spin" />
          ) : (
            <Save size={16} />
          )}
          {isSubmitting ? 'Saving...' : 'Save Brand'}
        </button>
        <button className="button button-cancel button-secondary"
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Brands Header Component
// ─────────────────────────────────────────────────────────────────────────────

function BrandsHeader({ canCreate, summary, onAdd }) {
  const metrics = [
    { key: 'total', label: 'Brands', value: summary.total, tone: 'success' },
  ]

  return (
    <header className="resource-center__inventory-header" aria-label="Brands summary">
      <div className="resource-center__inventory-header-main">
        <h1>Brands</h1>
        <div className="resource-center__inventory-metrics" aria-label="Brand metrics">
          {metrics.map((metric) => (
            <span
              key={metric.key}
              className={`resource-center__inventory-metric resource-center__inventory-metric--${metric.tone}`}
            >
              {metric.value} {metric.label}
            </span>
          ))}
        </div>
      </div>

      <div className="resource-center__inventory-header-actions">
        {canCreate ? (
          <button className="button button-primary" onClick={onAdd}>
            <Plus size={16} />
            Add Brand
          </button>
        ) : null}
      </div>
    </header>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Brands Component
// ─────────────────────────────────────────────────────────────────────────────

export default function Brands() {
  const { hasPermission } = useAuth()
  const [items, setItems] = useState([])
  const [isLoading, setIsLoading] = useState(() => !getBrands.hasCache?.())
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState('')
  const [editingBrand, setEditingBrand] = useState(null)
  const [viewingBrand, setViewingBrand] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [selectedIds, setSelectedIds] = useState([])

  const canCreate = hasPermission('brands', 'create')
  const canEdit = hasPermission('brands', 'edit')
  const canDelete = hasPermission('brands', 'delete')
  const isEditing = Boolean(editingBrand?.id)

  const loadBrands = useCallback(async function loadBrands(options = {}) {
    const force = Boolean(options.force)
    const shouldShowLoading = options.showLoading ?? (force || !getBrands.hasCache?.())

    if (shouldShowLoading) {
      setIsLoading(true)
    }
    setError('')

    try {
      const response = await getBrands({ force })
      if (!response.success) {
        throw new Error(response.error || 'Unable to load brands.')
      }
      setItems((response.data ?? []).map(normalizeBrand))
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : 'Unable to load brands.'
      setError(message)
      setItems([])
      showToast({ type: 'error', title: 'Brands', message })
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadBrands({ showLoading: !getBrands.hasCache?.() })
  }, [loadBrands])

  // Keep row selection in sync
  useEffect(() => {
    const visibleIdSet = new Set(items.map((item) => String(item.id || '')))
    setSelectedIds((current) => current.filter((id) => visibleIdSet.has(String(id))))
  }, [items])

  const summary = useMemo(() => {
    return {
      total: items.length,
    }
  }, [items])

  const selectedBrands = useMemo(
    () => items.filter((item) => selectedIds.includes(String(item.id || ''))),
    [items, selectedIds],
  )
  const hasSelectedBrands = selectedBrands.length > 0

  async function handleFormSubmit(values) {
    setIsSaving(true)
    try {
      const response = isEditing
        ? await updateBrand(editingBrand.id, values)
        : await createBrand(values)

      if (!response.success) {
        throw new Error(response.error || 'Unable to save brand.')
      }

      showToast({
        type: 'success',
        title: 'Brands',
        message: `Brand ${isEditing ? 'updated' : 'created'} successfully.`,
      })
      setEditingBrand(null)
      await loadBrands({ force: true, showLoading: false })
    } catch (saveError) {
      showToast({
        type: 'error',
        title: 'Brands',
        message: saveError instanceof Error ? saveError.message : 'Unable to save brand.',
      })
    } finally {
      setIsSaving(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      const response = await deleteBrand(deleteTarget.id)
      if (!response.success) {
        throw new Error(response.error || 'Unable to delete brand.')
      }
      setSelectedIds((current) =>
        current.filter((id) => String(id) !== String(deleteTarget.id)),
      )
      showToast({
        type: 'success',
        title: 'Brands',
        message: 'Brand deleted successfully.',
      })
      setDeleteTarget(null)
      await loadBrands({ force: true, showLoading: false })
    } catch (deleteError) {
      showToast({
        type: 'error',
        title: 'Brands',
        message:
          deleteError instanceof Error ? deleteError.message : 'Unable to delete brand.',
      })
    } finally {
      setIsDeleting(false)
    }
  }

  async function handleBulkDelete() {
    if (!canDelete || selectedBrands.length === 0) return
    setIsDeleting(true)
    try {
      for (const brand of selectedBrands) {
        const response = await deleteBrand(brand.id)
        if (!response.success) {
          throw new Error(
            response.error || `Unable to delete brand ${brand.name || brand.id}.`,
          )
        }
      }
      setSelectedIds([])
      showToast({
        type: 'success',
        title: 'Brands',
        message: `${selectedBrands.length} brand record${selectedBrands.length === 1 ? '' : 's'} deleted successfully.`,
      })
      await loadBrands({ force: true, showLoading: false })
    } catch (deleteError) {
      showToast({
        type: 'error',
        title: 'Brands',
        message:
          deleteError instanceof Error
            ? deleteError.message
            : 'Unable to delete selected brands.',
      })
    } finally {
      setIsDeleting(false)
    }
  }

  // ── Column Definitions ─────────────────────────────────────────────────────
  const columns = useMemo(
    () => [
      {
        key: 'name',
        label: 'Brand Name',
        sortable: true,
        mobilePrimary: true,
        className: 'brands-col-name',
        tableWidth: 250,
        style: { width: 250, minWidth: 250 },
        headerStyle: { width: 250, minWidth: 250 },
        searchValue: (item) => `${item.name} ${item.description || ''}`,
        render: (item) => (
          <div className="brands__identity">
            <strong title={item.name || 'Unnamed Brand'}>
              {item.name || 'Unnamed Brand'}
            </strong>
            <span>ID {item.id}</span>
          </div>
        ),
      },
      {
        key: 'description',
        label: 'Description',
        sortable: true,
        mobileDescription: true,
        className: 'brands-col-description',
        tableWidth: 320,
        style: { width: 320, minWidth: 320 },
        headerStyle: { width: 320, minWidth: 320 },
        render: (item) => (
          <span
            className={`brands__cell-text ${item.description ? '' : 'is-empty'}`}
            title={item.description || 'No description'}
          >
            {item.description || 'No description'}
          </span>
        ),
      },
      {
        key: 'actions',
        label: 'Actions',
        searchable: false,
        hideable: false,
        className: 'brands-col-actions',
        tableWidth: 72,
        style: { width: 72, minWidth: 72 },
        headerStyle: { width: 72, minWidth: 72 },
        render: (item) => (
          <ActionMenu
            iconOnly
            label={`Actions for ${item.name}`}
            className="brands__row-actions"
            actions={[
              {
                key: 'view',
                label: 'View',
                icon: Eye,
                onClick: () => setViewingBrand(item),
              },
              canEdit
                ? {
                    key: 'edit',
                    label: 'Edit',
                    icon: Pencil,
                    onClick: () => setEditingBrand(item),
                  }
                : null,
              canDelete
                ? {
                    key: 'delete',
                    label: 'Delete',
                    icon: Trash2,
                    tone: 'danger',
                    onClick: () => setDeleteTarget(item),
                  }
                : null,
            ]}
          />
        ),
      },
    ],
    [canEdit, canDelete],
  )

  // ── Toolbar / Filter Content ───────────────────────────────────────────────
  const filterContent = hasSelectedBrands ? (
    <FilterBar className="brands__selection-actions" ariaLabel="Selected Brand actions">
      <div className="brands__selection-summary" aria-live="polite">
        <Check size={15} />
        <strong>{selectedBrands.length} selected</strong>
      </div>
      <button
        type="button"
        className="button button-secondary brands__selection-button"
        onClick={() => exportBrandsCsv(selectedBrands)}
      >
        <Download size={15} />
        Export
      </button>
      <button
        type="button"
        className="button button-secondary brands__selection-button"
        onClick={() => printBrands(selectedBrands)}
      >
        <Printer size={15} />
        Print
      </button>
      {canDelete ? (
        <button
          type="button"
          className="button button-secondary brands__selection-button brands__selection-button--danger"
          onClick={handleBulkDelete}
          disabled={isDeleting}
        >
          <Trash2 size={15} />
          Delete
        </button>
      ) : null}
    </FilterBar>
  ) : null

  const toolbarContent = (
    <FilterBar className="brands__toolbar-actions" ariaLabel="Brand table actions">
      <button
        type="button"
        className="button button-secondary"
        onClick={() => loadBrands({ force: true, showLoading: true })}
        disabled={isLoading}
      >
        <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
        Refresh
      </button>
    </FilterBar>
  )

  return (
    <div className="page resource-center">
      <div className="resource-center__page resource-center__page--brands">
        <BrandsHeader
          canCreate={canCreate}
          summary={summary}
          onAdd={() => setEditingBrand({ name: '', description: '' })}
        />

        {error ? (
          <StateBlock
            type="server"
            title="We could not load brands"
            message={error}
            actionLabel="Retry"
            onAction={() => loadBrands({ force: true })}
            compact
          />
        ) : null}

        <div className="card resource-center__inventory-table-card">
          <DataTable
            className="resource-center__inventory-table"
            rows={items}
            columns={columns}
            loading={isLoading}
            defaultPageSize={20}
            defaultSortKey=""
            searchPlaceholder="Search brands by name"
            emptyMessage="No brands found."
            splitToolbar
            filterContent={filterContent}
            toolbarContent={toolbarContent}
            columnStorageKey="ims.brands.visibleColumns.warehouseParity.v1"
            defaultVisibleColumnKeys={['name', 'description', 'actions']}
            enableRowSelection
            selectedRowKeys={selectedIds}
            onSelectionChange={setSelectedIds}
            keyField="id"
          />
        </div>

        {/* Add/Edit Form Modal */}
        {editingBrand && !deleteTarget ? (
          <FormModal
            title={`${isEditing ? 'Edit' : 'Create'} Brand`}
            subtitle=""
            onClose={() => !isSaving && setEditingBrand(null)}
            className="form-modal--brands"
            dialogClassName="form-modal__dialog--brands"
            bodyClassName="form-modal__body--brands"
          >
            <BrandForm
              editingBrand={isEditing ? editingBrand : null}
              items={items}
              onSubmit={handleFormSubmit}
              onCancel={() => setEditingBrand(null)}
              isSubmitting={isSaving}
            />
          </FormModal>
        ) : null}

        {/* Delete Confirmation Modal */}
        {deleteTarget ? (
          <FormModal
            title="Delete Brand"
            onClose={() => !isDeleting && setDeleteTarget(null)}
          >
            <div className="brands__delete-dialog">
              <div className="delete-confirmation__copy">
                <p>
                  Are you sure you want to delete{' '}
                  <strong>{deleteTarget.name || deleteTarget.id}</strong>?
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
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </FormModal>
        ) : null}

        {/* View Brand Modal */}
        {viewingBrand ? (
          <RecordDetailsView
            modalTitle="Brand Details"
            heroTitle={viewingBrand.name || 'Brand'}
            heroSubtitle={`Brand Record ID: ${viewingBrand.id || '—'}`}
            icon={Package}
            fields={[
              { label: 'Brand ID', value: `ID ${viewingBrand.id || '—'}` },
              { label: 'Brand Name', value: viewingBrand.name || '—' },
              { label: 'Description', value: viewingBrand.description || 'No description available', fullWidth: true },
            ]}
            onClose={() => setViewingBrand(null)}
          />
        ) : null}
      </div>
    </div>
  )
}
