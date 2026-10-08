import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Eye,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react'
import {
  listResource,
  createResource,
  updateResource,
  deleteResource,
} from '../../../api/resourceApi'
import { getAttributeValues } from '../../../api/productApi'
import { RESOURCE_CONFIGS } from '../../ResourceCenter/resourceConfigs'
import FormModal from '../../../layouts/FormModal'
import StateBlock from '../../../components/common/StateBlock'
import RecordDetailsView from '../../../components/common/RecordDetailsView'
import InputField from '../../../components/InputField'
import { ActionMenu, DataTable, FilterBar } from '../../../components/erp'
import { showToast } from '../../../components/common/toast'
import { useAuth } from '../../../hooks/useAuth'
import './Attributes.css'

const ATTRIBUTE_COLUMNS_STORAGE_KEY = 'ims.attributes.table.visibleColumns.v1'
const ATTRIBUTE_DEFAULT_COLUMNS = ['name', 'actions']

const config = RESOURCE_CONFIGS.productAttributes

function validateAttributeName(name, existingAttributes = [], editingId = null) {
  const trimmed = (name || '').trim()

  if (!trimmed) {
    return 'Attribute Name is required.'
  }

  if (trimmed.length < 2) {
    return 'Please enter a valid attribute name (e.g., Size, Color, Material).'
  }

  // Must contain at least one letter
  if (!/[a-zA-Z]/.test(trimmed)) {
    return 'Please enter a valid attribute name (e.g., Size, Color, Material).'
  }

  // Allowed characters: letters, numbers, spaces, hyphens, slashes, parentheses
  if (!/^[a-zA-Z0-9\s\-/()]+$/.test(trimmed)) {
    return 'Please enter a valid attribute name (e.g., Size, Color, Material).'
  }

  // Check for random gibberish / key mashing (e.g., 5+ chars with 0 vowels or 6+ consecutive consonants)
  const lettersOnly = trimmed.replace(/[^a-zA-Z]/g, '')
  if (lettersOnly.length >= 5 && !/[aeiouyAEIOUY]/.test(lettersOnly)) {
    return 'Please enter a valid attribute name (e.g., Size, Color, Material).'
  }
  if (/[bcdfghjklmnpqrstvwxyzBCDFGHJKLMNPQRSTVWXYZ]{6,}/.test(trimmed)) {
    return 'Please enter a valid attribute name (e.g., Size, Color, Material).'
  }

  // Duplicate check
  const isDuplicate = existingAttributes.some(
    (attr) =>
      (attr.name || '').trim().toLowerCase() === trimmed.toLowerCase() &&
      String(attr.attributeId ?? attr.id) !== String(editingId ?? ''),
  )

  if (isDuplicate) {
    return 'Attribute name already exists.'
  }

  return ''
}

export default function Attributes() {
  const { hasPermission } = useAuth()
  const [attributes, setAttributes] = useState([])
  const [selectedAttributeIds, setSelectedAttributeIds] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)
  const [error, setError] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [viewingAttribute, setViewingAttribute] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [bulkDeleteTarget, setBulkDeleteTarget] = useState(null)

  const [formValues, setFormValues] = useState({ name: '' })
  const [touched, setTouched] = useState({ name: false })
  const [wasSubmitted, setWasSubmitted] = useState(false)
  const [serverErrors, setServerErrors] = useState({})

  const canCreate = hasPermission('productAttributes', 'create')
  const canEdit = hasPermission('productAttributes', 'edit')
  const canDelete = hasPermission('productAttributes', 'delete')

  // Filtered attributes based on search
  const filteredAttributes = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return attributes
    return attributes.filter((attr) => {
      const text = `${attr.name || ''} ${attr.values?.join(' ') || ''}`.toLowerCase()
      return text.includes(term)
    })
  }, [attributes, searchTerm])

  // Reconcile stale selections
  useEffect(() => {
    if (selectedAttributeIds.length === 0) return
    const validIdSet = new Set(filteredAttributes.map((attr) => String(attr.attributeId ?? attr.id)))
    setSelectedAttributeIds((prev) => {
      const filtered = prev.filter((id) => validIdSet.has(String(id)))
      return filtered.length === prev.length ? prev : filtered
    })
  }, [attributes, filteredAttributes, selectedAttributeIds])

  // Selection metrics
  const selectedCount = selectedAttributeIds.length
  const selectedAttributeSet = useMemo(
    () => new Set(selectedAttributeIds.map(String)),
    [selectedAttributeIds],
  )
  const selectedAttributes = useMemo(
    () => filteredAttributes.filter((attr) => selectedAttributeSet.has(String(attr.attributeId ?? attr.id))),
    [filteredAttributes, selectedAttributeSet],
  )

  // ── Load Data ──────────────────────────────────────────────────────────────
  const loadData = useCallback(async (options = {}) => {
    const force = Boolean(options.force)
    const shouldShowLoading = options.showLoading ?? force

    if (shouldShowLoading) {
      setIsLoading(true)
    }
    setError('')

    try {
      const [attrResponse, valResponse] = await Promise.all([
        listResource(config, { page: 1, pageSize: 500 }, { force }),
        getAttributeValues('', { force }),
      ])

      if (!attrResponse.success) {
        throw new Error(attrResponse.error || 'Failed to load attributes.')
      }

      const attrList = attrResponse.data ?? []
      const valList = valResponse.success ? (valResponse.data ?? []) : []

      // Map values to attributes
      const normalized = attrList.map((attr) => {
        const attributeId = attr.attributeId ?? attr.id
        const matchedValues = valList
          .filter((v) => String(v.attributeId) === String(attributeId))
          .map((v) => v.value || v.name || '')

        return {
          ...attr,
          id: attributeId,
          attributeId,
          values: matchedValues,
        }
      })

      setAttributes(normalized)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load attributes data.')
      setAttributes([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData({ showLoading: true })
  }, [loadData])

  useEffect(() => {
    const refresh = () => loadData({ force: true, showLoading: false })
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refresh()
      }
    }
    const intervalId = window.setInterval(refresh, 20000)

    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [loadData])

  // ── Actions ────────────────────────────────────────────────────────────────
  function handleOpenCreate() {
    setEditingItem(null)
    setFormValues({ name: '' })
    setTouched({ name: false })
    setWasSubmitted(false)
    setServerErrors({})
    setIsFormOpen(true)
  }

  function handleOpenEdit(item) {
    setEditingItem(item)
    setFormValues({ name: item.name || '' })
    setTouched({ name: false })
    setWasSubmitted(false)
    setServerErrors({})
    setIsFormOpen(true)
  }

  function handleCloseForm() {
    setIsFormOpen(false)
    setEditingItem(null)
    setFormValues({ name: '' })
    setTouched({ name: false })
    setWasSubmitted(false)
    setServerErrors({})
  }

  async function handleFormSubmit(e) {
    e.preventDefault()
    setWasSubmitted(true)
    setTouched({ name: true })

    const currentValidationError = validateAttributeName(
      formValues.name,
      attributes,
      editingItem?.attributeId,
    )

    if (currentValidationError) {
      setServerErrors({ name: currentValidationError })
      return
    }

    setIsSaving(true)
    setServerErrors({})

    const isEdit = Boolean(editingItem)
    const payload = { name: formValues.name.trim() }

    try {
      let response
      if (isEdit) {
        response = await updateResource(config, editingItem.attributeId, payload, payload)
      } else {
        response = await createResource(config, payload)
      }

      if (!response.success) {
        throw new Error(response.error || 'Failed to save attribute.')
      }

      showToast({
        type: 'success',
        title: 'Attributes',
        message: `Attribute ${isEdit ? 'updated' : 'created'} successfully.`,
      })

      setIsFormOpen(false)
      setEditingItem(null)
      setFormValues({ name: '' })
      setTouched({ name: false })
      setWasSubmitted(false)
      await loadData({ force: true, showLoading: false })
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Attributes',
        message: err instanceof Error ? err.message : 'Unable to save attribute.',
      })
    } finally {
      setIsSaving(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setIsDeleting(true)

    try {
      const response = await deleteResource(config, deleteTarget.attributeId)
      if (!response.success) {
        throw new Error(response.error || 'Failed to delete attribute.')
      }

      showToast({
        type: 'success',
        title: 'Attributes',
        message: 'Attribute deleted successfully.',
      })

      setDeleteTarget(null)
      await loadData({ force: true, showLoading: false })
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Attributes',
        message: err instanceof Error ? err.message : 'Unable to delete attribute.',
      })
    } finally {
      setIsDeleting(false)
    }
  }

  // ── Bulk Handlers ─────────────────────────────────────────────────────────
  const handleBulkDelete = useCallback(function handleBulkDelete() {
    if (selectedCount === 0 || !canDelete) return
    setBulkDeleteTarget(selectedAttributes)
  }, [selectedCount, canDelete, selectedAttributes])

  async function confirmBulkDelete() {
    if (!bulkDeleteTarget || bulkDeleteTarget.length === 0) return
    setIsBulkDeleting(true)

    try {
      const results = await Promise.all(
        bulkDeleteTarget.map((attr) => deleteResource(config, attr.attributeId ?? attr.id)),
      )
      const failed = results.filter((res) => !res.success)
      if (failed.length > 0) {
        throw new Error('Failed to delete some attributes.')
      }

      showToast({
        type: 'success',
        title: 'Attributes',
        message: `${bulkDeleteTarget.length} attribute${bulkDeleteTarget.length > 1 ? 's' : ''} deleted successfully.`,
      })

      setSelectedAttributeIds([])
      setBulkDeleteTarget(null)
      await loadData({ force: true, showLoading: false })
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Attributes',
        message: err instanceof Error ? err.message : 'Unable to delete selected attributes.',
      })
    } finally {
      setIsBulkDeleting(false)
    }
  }

  // ── Column Definitions ─────────────────────────────────────────────────────
  const columns = useMemo(
    () => [
      {
        key: 'name',
        label: 'Attribute Name',
        sortable: true,
        mobilePrimary: true,
        className: 'attributes-col-name',
        searchValue: (item) => `${item.name} ${item.values?.join(' ') || ''}`,
        render: (item) => (
          <div className="attributes__identity">
            <strong title={item.name || 'Unnamed Attribute'}>
              {item.name || 'Unnamed Attribute'}
            </strong>
          </div>
        ),
      },
      {
        key: 'actions',
        label: 'Actions',
        className: 'attributes-col-actions',
        tableWidth: 130,
        style: { width: 130, minWidth: 130 },
        headerStyle: { width: 130, minWidth: 130 },
        render: (item) => {
          const menuItems = [
            {
              key: 'view',
              label: 'View',
              icon: Eye,
              onClick: () => setViewingAttribute(item),
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
            <div className="attributes-page__row-actions">
              <ActionMenu
                iconOnly
                className="inventory-row-action-menu"
                label={`Actions for ${item.name}`}
                actions={menuItems}
              />
            </div>
          )
        },
      },
    ],
    [canEdit, canDelete],
  )

  // ── Toolbar Rendering ──────────────────────────────────────────────────────
  const primaryToolbarContent = useMemo(
    () =>
      canDelete && selectedCount > 0 ? (
        <button
          type="button"
          className="button button-secondary button-danger"
          onClick={handleBulkDelete}
          disabled={isBulkDeleting}
        >
          <Trash2 size={15} />
          {isBulkDeleting ? 'Deleting...' : 'Delete'}
        </button>
      ) : null,
    [canDelete, selectedCount, handleBulkDelete, isBulkDeleting],
  )

  const toolbarContent = useMemo(
    () => (
      <FilterBar className="attributes__toolbar-actions" ariaLabel="Attribute table actions">
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
    [loadData, isLoading],
  )

  // ── Modal Forms ────────────────────────────────────────────────────────────
  const validationError = validateAttributeName(
    formValues.name,
    attributes,
    editingItem?.attributeId,
  )
  const displayError = serverErrors.name || ((touched.name || wasSubmitted) ? validationError : '')
  const isFormValid = !validationError
  const hasFormChanges = editingItem ? formValues.name.trim() !== (editingItem.name || '') : formValues.name.trim() !== ''

  // ── Render ─────────────────────────────────────────────────────────────────
  if (isLoading && attributes.length === 0) {
    return (
      <div className="page resource-center">
        <StateBlock type="loading" message="Loading attributes..." />
      </div>
    )
  }

  if (error && attributes.length === 0) {
    return (
      <div className="page resource-center">
        <StateBlock
          type="error"
          message={error}
          actionLabel="Retry"
          onAction={() => loadData({ force: true, showLoading: true })}
        />
      </div>
    )
  }

  return (
    <div className="page resource-center">
      <div className="resource-center__page resource-center__page--attributes">
        {/* Header */}
        <header className="resource-center__inventory-header" aria-label="Attributes summary">
          <div className="resource-center__inventory-header-main">
            <h1>Product Attributes</h1>
            <div className="resource-center__inventory-metrics" aria-label="Attributes metrics">
              <span className="resource-center__inventory-metric resource-center__inventory-metric--success">
                {attributes.length} Attributes
              </span>
            </div>
          </div>
          <div className="resource-center__inventory-header-actions">
            {canCreate ? (
              <button className="button button-primary" onClick={handleOpenCreate}>
                <Plus size={16} />
                Add Attribute
              </button>
            ) : null}
          </div>
        </header>

        {/* Table Card */}
        <div className="card resource-center__inventory-table-card">
          <DataTable
            className="resource-center__inventory-table"
            columns={columns}
            rows={filteredAttributes}
            keyField="attributeId"
            searchPlaceholder="Search attributes by name"
            loading={isLoading}
            showSearch={true}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            enableRowSelection={true}
            selectedRowKeys={selectedAttributeIds}
            onSelectionChange={setSelectedAttributeIds}
            splitToolbar
            fitExplicitColumnsToContainer
            filterContent={primaryToolbarContent}
            toolbarContent={toolbarContent}
            columnStorageKey={ATTRIBUTE_COLUMNS_STORAGE_KEY}
            defaultVisibleColumns={ATTRIBUTE_DEFAULT_COLUMNS}
          />
        </div>
      </div>

      {/* Save Modal */}
      {isFormOpen ? (
        <FormModal
          title={editingItem ? 'Edit Attribute' : 'Add Attribute'}
          onClose={handleCloseForm}
          className="form-modal--attributes"
          dialogClassName="form-modal__dialog--attributes"
          bodyClassName="form-modal__body--attributes"
        >
          <form onSubmit={handleFormSubmit} className="resource-form" noValidate>
            <div className="resource-form__section">
              <InputField
                label="Attribute Name *"
                name="name"
                value={formValues.name}
                onChange={(e) => {
                  setFormValues({ name: e.target.value })
                  setServerErrors({})
                }}
                onBlur={() => setTouched({ name: true })}
                error={displayError}
                required
                placeholder="e.g. size, color, material"
                disabled={isSaving}
              />
            </div>

            <div className="resource-form__footer">
              <button
                type="submit"
                className="button button-primary"
                disabled={isSaving || !isFormValid || (editingItem && !hasFormChanges)}
              >
                <Save size={16} />
                {isSaving ? 'Saving...' : 'Save Attribute'}
              </button>
              <button className="button button-cancel button-secondary"
                type="button"
                onClick={handleCloseForm}
                disabled={isSaving}
              >
                Cancel
              </button>
            </div>
          </form>
        </FormModal>
      ) : null}

      {/* Single Delete Confirmation Modal */}
      {deleteTarget ? (
        <FormModal
          title="Delete Attribute"
          onClose={() => setDeleteTarget(null)}
        >
          <div className="resource-center__delete-dialog">
            <div className="delete-confirmation__copy">
              <p>
                Are you sure you want to delete{' '}
                <strong>{deleteTarget.name || deleteTarget.attributeName || 'this attribute'}</strong>?
              </p>
              <p className="delete-confirmation__warning">This action cannot be undone.</p>
            </div>
            <div className="button-row">
              <button
                className="button button-cancel button-secondary"
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

      {/* Bulk Delete Confirmation Modal */}
      {bulkDeleteTarget ? (
        <FormModal
          title="Delete Selected Attributes"
          onClose={() => setBulkDeleteTarget(null)}
        >
          <div className="resource-center__delete-dialog">
            <div className="delete-confirmation__copy">
              <p>
                Are you sure you want to delete <strong>{bulkDeleteTarget.length} selected attributes</strong>?
              </p>
              <p className="delete-confirmation__warning">This action cannot be undone.</p>
            </div>
            <div className="button-row">
              <button
                className="button button-cancel button-secondary"
                type="button"
                onClick={() => setBulkDeleteTarget(null)}
                disabled={isBulkDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button button-danger"
                onClick={confirmBulkDelete}
                disabled={isBulkDeleting}
              >
                <Trash2 size={16} />
                {isBulkDeleting ? 'Deleting...' : 'Delete Selected Attributes'}
              </button>
            </div>
          </div>
        </FormModal>
      ) : null}

      {/* View Attribute Modal */}
      {viewingAttribute ? (
        <RecordDetailsView
          modalTitle="Attribute Details"
          heroTitle={viewingAttribute.name || 'Attribute'}
          heroSubtitle={`Attribute ID: ${viewingAttribute.attributeId || viewingAttribute.id || '—'}`}
          icon={SlidersHorizontal}
          fields={[
            { label: 'Attribute ID', value: `ID ${viewingAttribute.attributeId || viewingAttribute.id || '—'}` },
            { label: 'Attribute Name', value: viewingAttribute.name || '—' },
            {
              label: 'Associated Values',
              value: viewingAttribute.values && viewingAttribute.values.length > 0
                ? viewingAttribute.values.join(', ')
                : 'No associated values',
              fullWidth: true,
            },
          ]}
          onClose={() => setViewingAttribute(null)}
        />
      ) : null}
    </div>
  )
}
