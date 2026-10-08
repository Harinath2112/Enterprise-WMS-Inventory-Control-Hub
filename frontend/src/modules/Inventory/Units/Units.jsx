import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ClipboardList,
  Eye,
  Pencil,
  Plus,
  RefreshCw,
  Ruler,
  Save,
  Trash2,
} from 'lucide-react'
import {
  createUnit,
  deleteUnit,
  formatUnitTitle,
  getCanonicalUnitStem,
  getUnits,
  normalizeUnit,
  updateUnit,
} from '../../../api/productApi'
import FormModal from '../../../layouts/FormModal'
import StateBlock from '../../../components/common/StateBlock'
import RecordDetailsView from '../../../components/common/RecordDetailsView'
import InputField from '../../../components/InputField'
import { ActionMenu, DataTable, FilterBar, StatusBadge } from '../../../components/erp'
import { showToast } from '../../../components/common/toast'
import { useAuth } from '../../../hooks/useAuth'
import { validateUnitName, validateUnitShortName } from '../../../validators/unitValidator'
import './Units.css'

const UNITS_COLUMNS_STORAGE_KEY = 'ims.units.table.visibleColumns.warehouseParity.v1'
const UNITS_DEFAULT_COLUMNS = ['name', 'shortName', 'status', 'actions']

export default function Units() {
  const { hasPermission } = useAuth()
  const [units, setUnits] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState('')

  // Modals state
  const [isCreateOpen, setCreateOpen] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [viewingUnit, setViewingUnit] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  // Filters state
  const [searchTerm, setSearchTerm] = useState('')

  // Form state
  const [formValues, setFormValues] = useState({ name: '', shortName: '' })
  const [touched, setTouched] = useState({ name: false, shortName: false })
  const [wasSubmitted, setWasSubmitted] = useState(false)
  const [serverErrors, setServerErrors] = useState({})

  const canCreate = hasPermission('units', 'create')
  const canEdit = hasPermission('units', 'edit')
  const canDelete = hasPermission('units', 'delete')

  // ── Load Data ──────────────────────────────────────────────────────────────
  const loadData = useCallback(async (options = {}) => {
    const force = Boolean(options.force)
    const shouldShowLoading = options.showLoading ?? force

    if (shouldShowLoading) {
      setIsLoading(true)
    }
    setError('')

    try {
      const response = await getUnits({ force })

      if (!response.success) {
        throw new Error(response.error || 'Failed to load units.')
      }

      const rawList = response.data ?? []
      const normalized = rawList.map(normalizeUnit)

      // Deduplicate near-duplicate entries by canonical unit stem
      const uniqueMap = new Map()
      normalized.forEach((item) => {
        const key = getCanonicalUnitStem(item.name)
        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, item)
        } else {
          const existing = uniqueMap.get(key)
          // Prefer Title Cased name (e.g. 'Pieces' over 'piece')
          if (item.name && item.name[0] === item.name[0].toUpperCase() && existing.name[0] !== existing.name[0].toUpperCase()) {
            uniqueMap.set(key, item)
          }
        }
      })

      setUnits(Array.from(uniqueMap.values()))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load units data.')
      setUnits([])
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
    setFormValues({ name: '', shortName: '' })
    setTouched({ name: false, shortName: false })
    setWasSubmitted(false)
    setServerErrors({})
    setCreateOpen(true)
  }

  const handleOpenEdit = (item) => {
    setEditingItem(item)
    setFormValues({
      name: item.name || '',
      shortName: item.shortName || '',
    })
    setTouched({ name: false, shortName: false })
    setWasSubmitted(false)
    setServerErrors({})
    setCreateOpen(true)
  }

  const handleCloseModal = () => {
    setCreateOpen(false)
    setEditingItem(null)
    setTouched({ name: false, shortName: false })
    setWasSubmitted(false)
    setServerErrors({})
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setWasSubmitted(true)
    setTouched({ name: true, shortName: true })
    setServerErrors({})

    const nameErr = validateUnitName(formValues.name, units, editingItem?.id)
    const shortErr = validateUnitShortName(formValues.shortName, units, editingItem?.id)

    const errors = {}
    if (nameErr) errors.name = nameErr
    if (shortErr) errors.shortName = shortErr

    if (Object.keys(errors).length > 0) {
      setServerErrors(errors)
      return
    }

    const name = formValues.name.trim()
    const shortName = formValues.shortName.trim()

    setIsSaving(true)

    const payload = {
      name,
      shortName,
      unitName: name,
      short_name: shortName,
      abbreviation: shortName,
      unitAbbreviation: shortName,
    }

    try {
      let response
      if (editingItem) {
        response = await updateUnit(editingItem.id, payload)
      } else {
        response = await createUnit(payload)
      }

      if (!response.success) {
        if (response.validationErrors) {
          setServerErrors(response.validationErrors)
        }
        throw new Error(response.error || 'Failed to save unit.')
      }

      showToast(editingItem ? 'Unit updated successfully.' : 'Unit created successfully.', 'success')
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
      const response = await deleteUnit(deleteTarget.id)

      if (!response.success) {
        throw new Error(response.error || 'Failed to delete unit.')
      }

      showToast('Unit deleted successfully.', 'success')
      setDeleteTarget(null)
      loadData({ force: true, showLoading: false })
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'An error occurred while deleting.', 'error')
    } finally {
      setIsDeleting(false)
    }
  }

  // ── Filters logic ───────────────────────────────────────────────────────────
  const filteredUnits = useMemo(() => {
    if (!searchTerm) return units

    const query = searchTerm.toLowerCase()
    return units.filter(
      (u) =>
        u.name.toLowerCase().includes(query) ||
        u.shortName.toLowerCase().includes(query)
    )
  }, [units, searchTerm])

  // ── Columns config ──────────────────────────────────────────────────────────
  const columns = useMemo(
    () => [

      {
        key: 'name',
        label: 'Unit Name',
        sortable: true,
        className: 'units-col-name',
        tableWidth: 360,
        style: { width: '45%', minWidth: 200 },
        headerStyle: { width: '45%', minWidth: 200 },
        render: (item) => (
          <div className="units__identity">
            <strong title={item.name}>{item.name}</strong>
          </div>
        ),
      },
      {
        key: 'shortName',
        label: 'Abbreviation',
        sortable: true,
        className: 'units-col-shortname',
        tableWidth: 200,
        style: { width: '25%', minWidth: 120 },
        headerStyle: { width: '25%', minWidth: 120 },
        render: (item) => <span className="font-mono text-sm">{item.shortName}</span>,
      },
      {
        key: 'status',
        label: 'Status',
        sortable: false,
        className: 'units-col-status',
        tableWidth: 120,
        style: { width: '15%', minWidth: 100 },
        headerStyle: { width: '15%', minWidth: 100 },
        render: () => <StatusBadge type="active">Active</StatusBadge>,
      },
      {
        key: 'actions',
        label: 'Actions',
        className: 'units-col-actions',
        tableWidth: 120,
        style: { width: '15%', minWidth: 80 },
        headerStyle: { width: '15%', minWidth: 80 },
        render: (item) => {
          const menuItems = [
            {
              key: 'view',
              label: 'View',
              icon: Eye,
              onClick: () => setViewingUnit(item),
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
            <div className="units-page__row-actions">
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
    [canEdit, canDelete]
  )

  // ── Render ──────────────────────────────────────────────────────────────────
  if (error && units.length === 0) {
    return (
      <div className="page resource-center__page--units">
        <StateBlock
          type="error"
          title="Failed to Load Units"
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
    <div className="page resource-center__page--units">
      {/* Page Header */}
      <div className="resource-center__inventory-header">
        <div className="resource-center__inventory-header-main">
          <h1>Units</h1>
          <div className="resource-center__inventory-metrics">
            <span className="resource-center__inventory-metric resource-center__inventory-metric--success">
              {filteredUnits.length} Units
            </span>
          </div>
        </div>
        {canCreate && (
          <div className="resource-center__inventory-header-actions">
            <button type="button" className="button button-primary" onClick={handleOpenCreate}>
              <Plus size={16} />
              Add Unit
            </button>
          </div>
        )}
      </div>

      {/* Main Table Card */}
      <div className="card resource-center__inventory-table-card">
        <DataTable
          className="resource-center__inventory-table"
          columns={columns}
          rows={filteredUnits}
          keyField="id"
          searchPlaceholder="Search by name or symbol"
          loading={isLoading}
          showSearch={true}
          splitToolbar
          fitExplicitColumnsToContainer
          onSearchChange={setSearchTerm}
          searchValue={searchTerm}
          toolbarContent={
            <FilterBar className="units__toolbar-actions" ariaLabel="Unit table actions">
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
          }
          columnStorageKey={UNITS_COLUMNS_STORAGE_KEY}
          defaultVisibleColumns={UNITS_DEFAULT_COLUMNS}
        />
      </div>

      {/* Add / Edit Form Modal */}
      {isCreateOpen && (
        <FormModal
          title={editingItem ? 'Edit Unit' : 'Add Unit'}
          subtitle={editingItem ? 'Modify existing unit abbreviation or title.' : undefined}
          className="form-modal--units"
          onClose={handleCloseModal}
        >
          <form className="catalog-form" onSubmit={handleSave}>
            <div className="form-modal__body--units">
              <div className="resource-form__section">
                <div className="resource-form__grid-2">
                  <InputField
                    id="unitName"
                    name="name"
                    label="Unit Name *"
                    value={formValues.name}
                    onChange={(e) => {
                      const val = typeof e === 'object' && e !== null && 'target' in e ? e.target.value : e
                      setFormValues((prev) => ({ ...prev, name: val }))
                      if (serverErrors.name) setServerErrors((prev) => ({ ...prev, name: '' }))
                    }}
                    onBlur={() => setTouched((prev) => ({ ...prev, name: true }))}
                    placeholder="e.g. Kilogram"
                    error={(touched.name || wasSubmitted) ? (serverErrors.name || validateUnitName(formValues.name, units, editingItem?.id)) : ''}
                    disabled={isSaving}
                  />

                  <InputField
                    id="unitAbbreviation"
                    name="shortName"
                    label="Abbreviation / Symbol *"
                    value={formValues.shortName}
                    onChange={(e) => {
                      const val = typeof e === 'object' && e !== null && 'target' in e ? e.target.value : e
                      setFormValues((prev) => ({ ...prev, shortName: val }))
                      if (serverErrors.shortName) setServerErrors((prev) => ({ ...prev, shortName: '' }))
                    }}
                    onBlur={() => setTouched((prev) => ({ ...prev, shortName: true }))}
                    placeholder="e.g. kg"
                    error={(touched.shortName || wasSubmitted) ? (serverErrors.shortName || validateUnitShortName(formValues.shortName, units, editingItem?.id)) : ''}
                    disabled={isSaving}
                  />
                </div>
              </div>
            </div>

            <div className="button-row form-modal__footer">
              <button type="submit" className="button button-primary" disabled={isSaving}>
                <Save size={16} />
                {isSaving ? 'Saving...' : 'Save Unit'}
              </button>
              <button className="button button-cancel button-secondary"
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
          title="Delete Unit"
          onClose={() => {
            if (!isDeleting) {
              setDeleteTarget(null)
            }
          }}
        >
          <div className="resource-center__delete-dialog">
            <div className="delete-confirmation__copy">
              <p>
                Are you sure you want to delete <strong>{deleteTarget.name}</strong>{' '}
                (<code>{deleteTarget.shortName}</code>)?
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
                {isDeleting ? 'Deleting...' : 'Delete Unit'}
              </button>
            </div>
          </div>
        </FormModal>
      )}

      {/* View Unit Modal */}
      {viewingUnit && (
        <RecordDetailsView
          modalTitle="Unit Details"
          heroTitle={viewingUnit.name || 'Unit'}
          heroSubtitle={`Abbreviation: ${viewingUnit.shortName || '—'}`}
          icon={Ruler}
          status="Active"
          fields={[
            { label: 'Unit ID', value: `ID ${viewingUnit.id || '—'}` },
            { label: 'Unit Name', value: viewingUnit.name || '—' },
            { label: 'Abbreviation / Symbol', render: () => <code>{viewingUnit.shortName || '—'}</code> },
            { label: 'Status', render: () => <StatusBadge status="Active">Active</StatusBadge> },
          ]}
          onClose={() => setViewingUnit(null)}
        />
      )}
    </div>
  )
}
