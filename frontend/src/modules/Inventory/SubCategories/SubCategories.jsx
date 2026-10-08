import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Check,
  Download,
  Eye,
  Layers,
  LoaderCircle,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Trash2,
} from 'lucide-react'
import { apiRequest, getResponseList } from '../../../api/apiClient'
import { API_ENDPOINTS } from '../../../api/endpoints'
import {
  createResource,
  deleteResource,
  listResource,
  normalizeResourceRow,
  readResourceValue,
  updateResource,
} from '../../../api/resourceApi'
import InputField from '../../../components/InputField'
import SearchableSelect from '../../../components/SearchableSelect'
import StateBlock from '../../../components/common/StateBlock'
import RecordDetailsView from '../../../components/common/RecordDetailsView'
import { ActionMenu, DataTable, FilterBar, StatusBadge } from '../../../components/erp'
import { showToast } from '../../../components/common/toast'
import FormModal from '../../../layouts/FormModal'
import { useAuth } from '../../../hooks/useAuth'
import { formatDate } from '../../../utils/helpers'
import { RESOURCE_CONFIGS } from '../../ResourceCenter/resourceConfigs'
import './SubCategories.css'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const config = RESOURCE_CONFIGS.subCategories
const CATALOG_STRUCTURE_UPDATED_EVENT = 'ims:catalog-structure-updated'
const SUBCATEGORY_DRAFT_KEY = 'ims:subCategory:createDraft'
const SUBCATEGORY_DEFAULT_COLUMNS = ['id', 'name', 'categoryName', 'status', 'createdAt', 'actions']
const SUBCATEGORY_COLUMNS_STORAGE_KEY = 'ims.subCategories.visibleColumns.warehouseParity.v1'

// ─────────────────────────────────────────────────────────────────────────────
// Draft helpers
// ─────────────────────────────────────────────────────────────────────────────

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function readStoredDraft(key) {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return isRecord(parsed) ? parsed : null
  } catch {
    return null
  }
}

function writeStoredDraft(key, value) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Draft persistence is a convenience; failing storage should not block the form.
  }
}

function clearStoredDraft(key) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(key)
  } catch {
    // Ignore storage failures.
  }
}

function hasMeaningfulDraft(values) {
  if (!isRecord(values)) return false
  return (
    ['categoryId', 'name', 'description'].some(
      (key) => String(values[key] ?? '').trim() !== '',
    ) ||
    (String(values.status ?? '').trim() !== '' &&
      String(values.status).toLowerCase() !== 'active')
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Form field helpers
// ─────────────────────────────────────────────────────────────────────────────

function getFieldLabel(field) {
  return String(field.label ?? field.name ?? 'Field').replace(/\s*\*+\s*$/, '')
}

function getFieldKey(field) {
  return field.apiKey || field.name
}

function normalizeForCompare(value) {
  if (Array.isArray(value) || isRecord(value)) return JSON.stringify(value)
  return String(value ?? '')
}

function getDefaultValue(field) {
  if (typeof field.defaultValue === 'function') return field.defaultValue()
  if (field.defaultValue !== undefined) return field.defaultValue
  if (field.type === 'checkbox') return false
  return ''
}

function getRecordFieldValue(record, field) {
  const value = readResourceValue(
    record,
    field.name,
    readResourceValue(record, field.apiKey, undefined),
  )
  if (value === undefined || value === null) return getDefaultValue(field)
  if (field.type === 'checkbox') return Boolean(value)
  if (field.type === 'date') return String(value).slice(0, 10)
  return String(value)
}

function getActiveFields(cfg, mode) {
  return (cfg.fields ?? []).filter((field) => {
    if (mode === 'create' && field.editOnly) return false
    if (mode === 'edit' && field.createOnly) return false
    return true
  })
}

function buildInitialForm(cfg, record, mode) {
  return getActiveFields(cfg, mode).reduce((result, field) => {
    result[field.name] = record
      ? getRecordFieldValue(record, field)
      : getDefaultValue(field)
    return result
  }, {})
}

function isEmptyValue(value, field) {
  if (field.type === 'checkbox') return false
  return value === undefined || value === null || String(value).trim() === ''
}

function getFieldError(field, value, mode) {
  const isRequired = field.required || (mode === 'create' && field.requiredOnCreate)
  const label = getFieldLabel(field)

  if (isRequired && isEmptyValue(value, field)) return `${label} is required.`
  if (isEmptyValue(value, field)) return ''

  if (field.type === 'number' || field.valueType === 'number') {
    const num = Number(value)
    if (!Number.isFinite(num)) return `${label} must be a valid number.`
    if (field.min !== undefined && num < field.min) {
      return field.minMessage || `${label} must be at least ${field.min}.`
    }
    if (field.max !== undefined && num > field.max) {
      return `${label} must be ${field.max} or less.`
    }
  }

  if (field.minLength && String(value).trim().length < field.minLength) {
    return `${label} must be at least ${field.minLength} characters.`
  }

  return ''
}

function getServerFieldError(errors, field) {
  if (!errors || typeof errors !== 'object') return ''
  const candidates = [field.name, field.apiKey, field.label]
    .filter(Boolean)
    .map((v) => String(v).toLowerCase())
  const match = Object.entries(errors).find(([key]) =>
    candidates.includes(String(key).toLowerCase()),
  )
  const value = match?.[1]
  if (Array.isArray(value)) return value.filter(Boolean).join(' ')
  return value ? String(value) : ''
}

function buildPayload(values, fields) {
  return fields.reduce((payload, field) => {
    if (field.submit === false) return payload
    const value = values[field.name]
    const key = getFieldKey(field)

    if (field.type === 'checkbox') {
      payload[key] = Boolean(value)
      return payload
    }

    if (field.type === 'number' || field.valueType === 'number') {
      if (isEmptyValue(value, field) && !field.required && !field.requiredOnCreate) {
        return payload
      }
      payload[key] = Number(value)
      return payload
    }

    payload[key] = typeof value === 'string' ? value.trim() : value
    return payload
  }, {})
}

function getChangedPayload(payload, baselinePayload) {
  return Object.keys(payload).reduce((result, key) => {
    if (normalizeForCompare(payload[key]) !== normalizeForCompare(baselinePayload[key])) {
      result[key] = payload[key]
    }
    return result
  }, {})
}

// ─────────────────────────────────────────────────────────────────────────────
// Error / status helpers
// ─────────────────────────────────────────────────────────────────────────────

function getDeleteErrorMessage(cfg, error) {
  const message = String(error || '').trim()
  if (/records exist/i.test(message)) return message
  if (
    /constraint|foreign key|reference|dependency|linked|stock|transaction|conflict/i.test(
      message,
    )
  ) {
    return `${cfg.entityName} cannot be deleted because related records or transactions exist.`
  }
  return message || `Unable to delete ${cfg.entityName.toLowerCase()}.`
}

function formatStatusLabel(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return 'Not set'
  return raw
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function getStatusType(value) {
  const norm = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
  if (norm === 'inactive' || norm === 'blocked' || norm === 'failed') return 'critical'
  return norm || 'info'
}

// ─────────────────────────────────────────────────────────────────────────────
// Catalog event helper
// ─────────────────────────────────────────────────────────────────────────────

function notifyCatalogStructureUpdate(action) {
  window.dispatchEvent(
    new CustomEvent(CATALOG_STRUCTURE_UPDATED_EVENT, {
      detail: { resource: 'subCategories', action },
    }),
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Reference option helpers
// ─────────────────────────────────────────────────────────────────────────────

function getReferenceValue(item, key, fallback = '') {
  return readResourceValue(
    item,
    key,
    readResourceValue(item, key?.replace(/Id$/, 'ID'), fallback),
  )
}

function getReferenceOptionValue(item, key) {
  if (Array.isArray(key)) {
    for (const candidate of key) {
      const value = getReferenceValue(item, candidate)
      if (value !== undefined && value !== null && value !== '') return value
    }
    return ''
  }
  return getReferenceValue(item, key)
}

function getReferenceOptionLabel(item, key) {
  if (Array.isArray(key)) {
    for (const candidate of key) {
      const value = getReferenceValue(item, candidate)
      if (value !== undefined && value !== null && value !== '') return value
    }
    return ''
  }
  return getReferenceValue(item, key)
}

// ─────────────────────────────────────────────────────────────────────────────
// Export / print helpers
// ─────────────────────────────────────────────────────────────────────────────

function escapeCsvValue(value) {
  const text = String(value ?? '')
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`
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

function exportSubCategoriesCsv(rows) {
  const headers = ['SubCategory', 'Category', 'Status', 'Created']
  const csvRows = rows.map((row) => [
    readResourceValue(row, 'name', ''),
    readResourceValue(row, 'categoryName', ''),
    formatStatusLabel(readResourceValue(row, 'status', 'active')),
    readResourceValue(row, 'createdAt', ''),
  ])
  const csv = [headers, ...csvRows]
    .map((row) => row.map(escapeCsvValue).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'SubCategories.csv'
  link.click()
  URL.revokeObjectURL(url)
}

function printSubCategories(rows) {
  const tableRows = rows
    .map(
      (row) => `
    <tr>
      <td><strong>${escapeHtml(readResourceValue(row, 'name', 'Unnamed subcategory'))}</strong></td>
      <td>${escapeHtml(readResourceValue(row, 'categoryName', 'Not set'))}</td>
      <td>${escapeHtml(formatStatusLabel(readResourceValue(row, 'status', 'active')))}</td>
      <td>${escapeHtml(
        readResourceValue(row, 'createdAt')
          ? formatDate(readResourceValue(row, 'createdAt'))
          : 'Not set',
      )}</td>
    </tr>
  `,
    )
    .join('')
  const printWindow = window.open('', '_blank')
  if (!printWindow) return
  printWindow.document.write(
    `<!doctype html><html><head><title>SubCategories</title><style>
    body { margin: 28px; color: #111827; font: 13px Arial, sans-serif; }
    h1 { margin: 0 0 16px; font-size: 20px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 8px 10px; border: 1px solid #dbe4f0; text-align: left; vertical-align: top; }
    th { background: #f8fafc; color: #475569; font-size: 12px; }
  </style></head><body>
    <h1>SubCategories</h1>
    <table>
      <thead><tr><th>SubCategory</th><th>Category</th><th>Status</th><th>Created</th></tr></thead>
      <tbody>${tableRows}</tbody>
    </table>
  </body></html>`,
  )
  printWindow.document.close()
  printWindow.focus()
  printWindow.print()
}

// ─────────────────────────────────────────────────────────────────────────────
// SubCategoryForm component
// ─────────────────────────────────────────────────────────────────────────────

function SubCategoryForm({
  mode,
  record,
  isSubmitting,
  serverErrors,
  referenceErrors = {},
  isReferenceLoading = false,
  referenceData = {},
  draftData = null,
  onDraftChange,
  onCancel,
  onSubmit,
}) {
  const fields = useMemo(() => getActiveFields(config, mode), [mode])
  const [formData, setFormData] = useState(() => ({
    ...buildInitialForm(config, record, mode),
    ...(mode === 'create' && isRecord(draftData?.values) ? draftData.values : {}),
  }))
  const [baselineData] = useState(() => buildInitialForm(config, record, mode))
  const [touched, setTouched] = useState({})
  const [submitAttempted, setSubmitAttempted] = useState(false)

  const errors = useMemo(
    () =>
      fields.reduce((result, field) => {
        result[field.name] =
          getFieldError(field, formData[field.name], mode) ||
          getServerFieldError(serverErrors, field)
        return result
      }, {}),
    [fields, formData, mode, serverErrors],
  )
  const isValid = Object.values(errors).every((value) => !value)
  const payload = useMemo(() => buildPayload(formData, fields), [fields, formData])
  const baselinePayload = useMemo(
    () => buildPayload(baselineData, fields),
    [baselineData, fields],
  )
  const changedPayload = useMemo(
    () => getChangedPayload(payload, baselinePayload),
    [baselinePayload, payload],
  )
  const isDirty = Object.keys(changedPayload).length > 0
  const hasDraftContent = mode === 'create' && hasMeaningfulDraft(formData)

  const hasBlockingReferenceIssue = fields.some((field) => {
    if (
      !field.optionsFrom ||
      !field.required ||
      !['select', 'searchableSelect'].includes(field.type)
    ) {
      return false
    }
    const options = Array.isArray(referenceData[field.optionsFrom])
      ? referenceData[field.optionsFrom]
      : []
    return (
      Boolean(referenceErrors[field.optionsFrom]) ||
      (!isReferenceLoading && options.length === 0)
    )
  })

  const saveDisabled =
    isSubmitting ||
    isReferenceLoading ||
    hasBlockingReferenceIssue ||
    !isValid ||
    (mode === 'edit' && !isDirty)

  function updateField(name, value) {
    setFormData((current) => ({ ...current, [name]: value }))
  }

  useEffect(() => {
    if (mode !== 'create') return
    onDraftChange?.(formData, hasMeaningfulDraft(formData))
  }, [formData, mode, onDraftChange])

  function handleChange(event) {
    const { name, value, type, checked } = event.target
    updateField(name, type === 'checkbox' ? checked : value)
  }

  function handleBlur(event) {
    setTouched((current) => ({ ...current, [event.target.name]: true }))
  }

  function shouldShowError(field) {
    return (
      touched[field.name] ||
      submitAttempted ||
      Boolean(getServerFieldError(serverErrors, field))
    )
  }

  function handleSubmit(event) {
    event.preventDefault()
    setSubmitAttempted(true)
    setTouched(
      fields.reduce((result, field) => ({ ...result, [field.name]: true }), {}),
    )
    if (!isValid || saveDisabled) return
    onSubmit({ payload, changedPayload })
  }

  function renderField(field) {
    const error = shouldShowError(field) ? errors[field.name] : ''

    if (field.type === 'searchableSelect') {
      const referenceRows = Array.isArray(referenceData[field.optionsFrom])
        ? referenceData[field.optionsFrom]
        : []
      const referenceError = field.optionsFrom ? referenceErrors[field.optionsFrom] : ''
      const options = (
        field.optionsFrom
          ? referenceRows.map((item) => ({
            value: getReferenceOptionValue(item, field.optionValue),
            label: getReferenceOptionLabel(item, field.optionLabel),
          }))
          : field.options ?? []
      ).filter(
        (option) =>
          option &&
          option.value !== undefined &&
          option.value !== null &&
          option.value !== '' &&
          option.label !== undefined &&
          option.label !== null &&
          option.label !== '',
      )
      const emptyOptionsMessage = referenceError
        ? `Unable to load ${getFieldLabel(field).toLowerCase()} options. Please retry after the category service is available.`
        : !isReferenceLoading && field.required && options.length === 0
          ? 'No categories available.'
          : ''
      const fieldError = error || emptyOptionsMessage

      return (
        <div
          className={`resource-form__reference-field resource-form__field--${field.name}`}
          key={field.name}
        >
          <SearchableSelect
            id={`subcategory-form-${field.name}`}
            name={field.name}
            label={field.label}
            value={formData[field.name] ?? ''}
            onChange={handleChange}
            onBlur={handleBlur}
            options={options}
            placeholder={
              isReferenceLoading
                ? 'Loading categories...'
                : field.placeholder || `Select ${getFieldLabel(field).toLowerCase()}`
            }
            searchPlaceholder={
              field.searchPlaceholder || `Search ${getFieldLabel(field).toLowerCase()}`
            }
            error={fieldError}
            showError={Boolean(fieldError)}
            disabled={
              field.readOnly ||
              isReferenceLoading ||
              Boolean(referenceError) ||
              options.length === 0
            }
            className="resource-form__combobox"
            menuClassName="resource-form__combobox-menu resource-form__combobox-menu--subCategories"
          />
          {isReferenceLoading ? (
            <span className="field-help resource-form__reference-note">
              Loading category options...
            </span>
          ) : null}
        </div>
      )
    }

    if (field.type === 'select') {
      const options = field.options ?? []
      return (
        <div key={field.name} className={`field ${error ? 'field--error' : ''} resource-form__field--${field.name}`}>
          <label htmlFor={`subcategory-form-${field.name}`}>{field.label}</label>
          <select
            id={`subcategory-form-${field.name}`}
            name={field.name}
            value={formData[field.name] ?? field.defaultValue ?? 'Active'}
            onChange={handleChange}
            onBlur={handleBlur}
            disabled={field.readOnly}
            className="form-control"
            aria-invalid={Boolean(error)}
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {error ? <span className="field-error">{error}</span> : null}
        </div>
      )
    }

    const isFullWidth = ['name', 'description'].includes(field.name)
    return (
      <InputField
        key={field.name}
        id={`subcategory-form-${field.name}`}
        name={field.name}
        label={field.label}
        type={field.type === 'textarea' ? 'text' : field.type || 'text'}
        textarea={field.type === 'textarea'}
        rows={field.type === 'textarea' ? 3 : undefined}
        value={formData[field.name]}
        placeholder={field.placeholder}
        onChange={handleChange}
        onBlur={handleBlur}
        error={error}
        min={field.min}
        max={field.max}
        readOnly={field.readOnly}
        className={[
          `resource-form__field--${field.name}`,
          isFullWidth ? 'resource-form__field--full' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      />
    )
  }

  return (
    <form
      className="resource-form resource-form--subCategories"
      onSubmit={handleSubmit}
      autoComplete="off"
    >
      <div className="resource-form__section">
        {fields.length === 0 ? (
          <div className="resource-form__empty">This resource is read-only.</div>
        ) : (
          <div className="form-grid">{fields.map(renderField)}</div>
        )}
      </div>

      <div className="button-row resource-form__footer">
        {mode === 'create' && hasDraftContent ? (
          <span className="resource-form__draft-indicator">Unsaved changes</span>
        ) : null}
        <button type="submit" className="button button-primary" disabled={saveDisabled}>
          {isSubmitting ? (
            <LoaderCircle size={16} className="animate-spin" />
          ) : (
            <Save size={16} />
          )}
          {isSubmitting ? 'Saving...' : mode === 'edit' ? 'Save Changes' : 'Create'}
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

function getSubCategoryStatus(row) {
  const rawStatus = readResourceValue(row, 'status', '')
  const norm = String(rawStatus ?? '').trim().toLowerCase()
  if (norm === 'inactive') return 'inactive'
  return 'active'
}

// ─────────────────────────────────────────────────────────────────────────────
// SubCategoriesHeader component
// ─────────────────────────────────────────────────────────────────────────────

function SubCategoriesHeader({ canCreate, summary, activeStatus, onFilterStatus, onAdd }) {
  const metrics = [
    { key: 'all', label: `${summary.total} Records`, tone: 'info' },
    { key: 'active', label: `${summary.active} Active`, tone: 'success' },
    { key: 'inactive', label: `${summary.inactive} Inactive`, tone: 'warning' },
  ]

  return (
    <header
      className="resource-center__inventory-header"
      aria-label="SubCategories summary"
    >
      <div className="resource-center__inventory-header-main">
        <h1>SubCategories</h1>
        <div
          className="resource-center__inventory-metrics"
          role="region"
          aria-label="SubCategory metrics filter controls"
        >
          {metrics.map((metric) => (
            <button
              type="button"
              key={metric.key}
              onClick={() => onFilterStatus?.(metric.key)}
              className={`resource-center__inventory-metric resource-center__inventory-metric--${metric.tone} ${
                activeStatus === metric.key ? 'is-active' : ''
              }`}
              aria-pressed={activeStatus === metric.key}
            >
              {metric.label}
            </button>
          ))}
        </div>
      </div>
      <div className="resource-center__inventory-header-actions">
        {canCreate ? (
          <button type="button" className="button button-primary" onClick={onAdd}>
            <Plus size={16} />
            Add SubCategory
          </button>
        ) : null}
      </div>
    </header>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// SubCategories (main export)
// ─────────────────────────────────────────────────────────────────────────────

export default function SubCategories() {
  const { hasPermission } = useAuth()

  // ── State ──────────────────────────────────────────────────────────────────
  const [rows, setRows] = useState([])
  const [isLoading, setIsLoading] = useState(
    () => !listResource.hasCache?.(config),
  )
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [editingRecord, setEditingRecord] = useState(null)
  const [viewingSubCategory, setViewingSubCategory] = useState(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [serverErrors, setServerErrors] = useState(null)
  const [categories, setCategories] = useState([])
  const [categoriesError, setCategoriesError] = useState('')
  const [subCategoryDraft, setSubCategoryDraft] = useState(() =>
    readStoredDraft(SUBCATEGORY_DRAFT_KEY),
  )
  const [selectedIds, setSelectedIds] = useState([])
  const [statusFilter, setStatusFilter] = useState('all')

  // ── Permissions ────────────────────────────────────────────────────────────
  const canCreate =
    (config.canCreate ?? true) && hasPermission(config.permissionKey, 'create')
  const canUpdate =
    (config.canUpdate ?? true) && hasPermission(config.permissionKey, 'edit')
  const canDelete =
    (config.canDelete ?? true) && hasPermission(config.permissionKey, 'delete')
  const mode = editingRecord ? 'edit' : 'create'
  const hasSubCategoryDraft = hasMeaningfulDraft(subCategoryDraft?.values)

  // ── Derived values ─────────────────────────────────────────────────────────
  const summary = useMemo(() => {
    let activeCount = 0
    let inactiveCount = 0

    rows.forEach((row) => {
      const status = String(readResourceValue(row, 'status', 'active')).toLowerCase()
      if (status === 'inactive') inactiveCount += 1
      else activeCount += 1
    })

    return {
      total: rows.length,
      active: activeCount,
      inactive: inactiveCount,
    }
  }, [rows])

  const selectedSubCategories = useMemo(
    () => rows.filter((row) => selectedIds.includes(String(row.id || ''))),
    [rows, selectedIds],
  )
  const hasSelectedSubCategories = selectedSubCategories.length > 0

  const filteredRows = useMemo(() => {
    if (statusFilter === 'all') return rows
    return rows.filter((row) => getSubCategoryStatus(row) === statusFilter)
  }, [rows, statusFilter])

  // ── Draft helpers ──────────────────────────────────────────────────────────
  const updateDraft = useCallback((values, shouldPersist = true) => {
    if (!shouldPersist || !hasMeaningfulDraft(values)) {
      clearStoredDraft(SUBCATEGORY_DRAFT_KEY)
      setSubCategoryDraft(null)
      return
    }
    const nextDraft = {
      values: {
        categoryId: values.categoryId ?? '',
        name: values.name ?? '',
        description: values.description ?? '',
        status: values.status || 'active',
      },
      updatedAt: new Date().toISOString(),
    }
    writeStoredDraft(SUBCATEGORY_DRAFT_KEY, nextDraft)
    setSubCategoryDraft(nextDraft)
  }, [])

  function clearDraft() {
    clearStoredDraft(SUBCATEGORY_DRAFT_KEY)
    setSubCategoryDraft(null)
  }

  // ── Data loading ───────────────────────────────────────────────────────────
  const loadRows = useCallback(async function loadRows(options = {}) {
    const force = Boolean(options.force)
    const shouldShowLoading =
      options.showLoading ?? (force || !listResource.hasCache?.(config))
    if (shouldShowLoading) setIsLoading(true)
    setError('')

    const [response, categoriesResponse] = await Promise.all([
      listResource(config, undefined, { force }),
      apiRequest(API_ENDPOINTS.categories.main),
    ])

    if (!response.success) {
      setRows([])
      setError(response.error || 'Unable to load SubCategories.')
    } else {
      const rawRows = (response.data ?? []).map((row) => normalizeResourceRow(row, config))
      const sorted = [...rawRows].sort((a, b) => {
        const idA = Number(readResourceValue(a, 'id', readResourceValue(a, 'subCategoryId', 0))) || 0
        const idB = Number(readResourceValue(b, 'id', readResourceValue(b, 'subCategoryId', 0))) || 0
        if (idA && idB) return idA - idB
        const dateA = new Date(readResourceValue(a, 'createdAt', 0)).getTime() || 0
        const dateB = new Date(readResourceValue(b, 'createdAt', 0)).getTime() || 0
        return dateA - dateB
      })
      const idToDisplayMap = new Map()
      sorted.forEach((item, idx) => {
        const rawId = String(readResourceValue(item, 'id', readResourceValue(item, 'subCategoryId', '')))
        if (rawId) {
          idToDisplayMap.set(rawId, idx + 1)
        }
      })

      const mappedRows = sorted.map((row, idx) => {
        const rawId = String(readResourceValue(row, 'id', readResourceValue(row, 'subCategoryId', '')))
        const displayId = idToDisplayMap.get(rawId) ?? (idx + 1)
        return {
          ...row,
          displayId,
        }
      })

      setRows(mappedRows)
    }

    if (categoriesResponse.success) {
      setCategories(
        getResponseList(categoriesResponse, 'categories').map((row) =>
          normalizeResourceRow(row, {}),
        ),
      )
      setCategoriesError('')
    } else {
      setCategoriesError(
        categoriesResponse.error || 'Unable to load categories.',
      )
    }

    setIsLoading(false)
  }, [])

  useEffect(() => {
    loadRows({ showLoading: !listResource.hasCache?.(config) })
  }, [loadRows])

  // Keep selection in sync with visible rows
  useEffect(() => {
    const visibleIdSet = new Set(rows.map((row) => String(row.id || '')))
    setSelectedIds((current) =>
      current.filter((id) => visibleIdSet.has(String(id))),
    )
  }, [rows])

  // ── Save / delete handlers ─────────────────────────────────────────────────
  async function handleSave({ payload, changedPayload }) {
    setIsSaving(true)
    setServerErrors(null)

    const id = editingRecord?.id
    const response = id
      ? await updateResource(config, id, payload, changedPayload)
      : await createResource(config, payload)

    setIsSaving(false)

    if (!response.success) {
      setServerErrors(response.errors)
      showToast({
        type: 'error',
        title: config.title,
        message: response.error || `Unable to save ${config.entityName.toLowerCase()}.`,
      })
      return
    }

    showToast({
      type: 'success',
      title: config.title,
      message: `${config.entityName} ${id ? 'updated' : 'created'} successfully.`,
    })
    if (!id) clearDraft()
    setIsFormOpen(false)
    setEditingRecord(null)
    notifyCatalogStructureUpdate(id ? 'updated' : 'created')
    await loadRows({ force: true })
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setIsDeleting(true)

    const response = await deleteResource(config, deleteTarget.id)

    if (!response.success) {
      showToast({
        type: 'error',
        title: config.title,
        message: getDeleteErrorMessage(config, response.error),
      })
      setIsDeleting(false)
      return
    }

    setRows((current) => {
      const remaining = current.filter((row) => String(row.id) !== String(deleteTarget.id))
      return remaining.map((row, idx) => ({
        ...row,
        displayId: idx + 1,
      }))
    })
    setDeleteTarget(null)
    showToast({
      type: 'success',
      title: config.title,
      message: response.message || `${config.entityName} deleted successfully.`,
    })
    notifyCatalogStructureUpdate('deleted')
    await loadRows({ force: true })
    setIsDeleting(false)
  }

  async function handleBulkDelete() {
    if (!canDelete || selectedSubCategories.length === 0) return
    setIsDeleting(true)
    try {
      for (const row of selectedSubCategories) {
        const response = await deleteResource(config, row.id)
        if (!response.success) {
          throw new Error(getDeleteErrorMessage(config, response.error))
        }
      }
      setSelectedIds([])
      showToast({
        type: 'success',
        title: config.title,
        message: `${selectedSubCategories.length} ${config.entityName} record${selectedSubCategories.length === 1 ? '' : 's'} deleted successfully.`,
      })
      notifyCatalogStructureUpdate('deleted')
      await loadRows({ force: true })
    } catch (deleteError) {
      showToast({
        type: 'error',
        title: config.title,
        message:
          deleteError instanceof Error
            ? deleteError.message
            : `Unable to delete ${config.entityName.toLowerCase()}.`,
      })
    } finally {
      setIsDeleting(false)
    }
  }

  // ── Form open/close ────────────────────────────────────────────────────────
  function openCreate() {
    setServerErrors(null)
    setEditingRecord(null)
    setSubCategoryDraft(readStoredDraft(SUBCATEGORY_DRAFT_KEY))
    setIsFormOpen(true)
  }

  function openEdit(row) {
    setServerErrors(null)
    setEditingRecord(row)
    setIsFormOpen(true)
  }

  function closeForm() {
    if (mode === 'create') {
      clearDraft()
    }
    setServerErrors(null)
    setEditingRecord(null)
    setIsFormOpen(false)
  }

  // ── Column definitions ─────────────────────────────────────────────────────
  const columns = useMemo(
    () => [
      {
        key: 'id',
        label: 'ID',
        sortable: true,
        className: 'subcategories-col-id',
        tableWidth: 80,
        style: { width: 80, minWidth: 80 },
        headerStyle: { width: 80, minWidth: 80 },
        sortValue: (row) => Number(row.displayId ?? readResourceValue(row, 'id', readResourceValue(row, 'subCategoryId', 0))) || 0,
        searchValue: (row) => `ID ${row.displayId ?? readResourceValue(row, 'id', '')} ${row.displayId ?? readResourceValue(row, 'id', '')}`,
        render: (row, index, sNo) => (
          <span className="subcategories__cell-id">
            ID {row?.displayId ?? (sNo ?? (index != null ? index + 1 : readResourceValue(row, 'id', '—')))}
          </span>
        ),
      },
      {
        key: 'name',
        label: 'SubCategory Name',
        sortable: true,
        mobilePrimary: true,
        className: 'subcategories-col-name',
        tableWidth: 250,
        style: { width: 250, minWidth: 250 },
        headerStyle: { width: 250, minWidth: 250 },
        searchValue: (row) =>
          [
            readResourceValue(row, 'name', ''),
            readResourceValue(row, 'categoryName', ''),
            readResourceValue(row, 'status', ''),
          ].join(' '),
        render: (row) => (
          <div className="subcategories__identity">
            <strong
              title={readResourceValue(row, 'name', 'Unnamed subcategory')}
            >
              {readResourceValue(row, 'name', 'Unnamed subcategory')}
            </strong>
          </div>
        ),
        sortValue: (row) => readResourceValue(row, 'name', '').toLowerCase(),
      },
      {
        key: 'categoryName',
        label: 'Category',
        sortable: true,
        className: 'subcategories-col-category',
        tableWidth: 170,
        style: { width: 170, minWidth: 170 },
        headerStyle: { width: 170, minWidth: 170 },
        sortValue: (row) => readResourceValue(row, 'categoryName', readResourceValue(row, 'category', '')).toLowerCase(),
        render: (row) => (
          <span
            className="subcategories__cell-text"
            title={readResourceValue(row, 'categoryName', 'Not set')}
          >
            {readResourceValue(row, 'categoryName', 'Not set')}
          </span>
        ),
      },
      {
        key: 'status',
        label: 'Status',
        sortable: true,
        mobileStatus: true,
        className: 'subcategories-col-status',
        tableWidth: 96,
        style: { width: 96, minWidth: 96 },
        headerStyle: { width: 96, minWidth: 96 },
        render: (row) => {
          const status = readResourceValue(row, 'status', 'Active')
          return (
            <StatusBadge status={status}>
              {formatStatusLabel(status)}
            </StatusBadge>
          )
        },
        sortValue: (row) => readResourceValue(row, 'status', '').toLowerCase(),
      },
      {
        key: 'createdAt',
        label: 'Created Date',
        sortable: true,
        className: 'subcategories-col-date',
        tableWidth: 170,
        style: { width: 170, minWidth: 170 },
        headerStyle: { width: 170, minWidth: 170 },
        render: (row) =>
          readResourceValue(row, 'createdAt')
            ? formatDate(readResourceValue(row, 'createdAt'))
            : 'Not set',
        sortValue: (row) =>
          new Date(readResourceValue(row, 'createdAt', 0)).getTime() || 0,
      },
      {
        key: 'actions',
        label: 'Actions',
        searchable: false,
        hideable: false,
        className: 'subcategories-col-actions',
        tableWidth: 72,
        style: { width: 72, minWidth: 72 },
        headerStyle: { width: 72, minWidth: 72 },
        render: (row) => (
          <ActionMenu
            iconOnly
            label={`Actions for ${readResourceValue(row, 'name', config.entityName)}`}
            className="subcategories__row-actions"
            actions={[
              {
                key: 'view',
                label: 'View',
                icon: Eye,
                onClick: () => setViewingSubCategory(row),
              },
              canUpdate
                ? {
                  key: 'edit',
                  label: 'Edit',
                  icon: Pencil,
                  onClick: () => openEdit(row),
                }
                : null,
              canDelete
                ? {
                  key: 'delete',
                  label: 'Delete',
                  icon: Trash2,
                  tone: 'danger',
                  onClick: () => setDeleteTarget(row),
                }
                : null,
            ]}
          />
        ),
      },
    ],
    [canUpdate, canDelete],
  )

  // ── Toolbar and filter content ─────────────────────────────────────────────
  const filterContent = hasSelectedSubCategories ? (
    <FilterBar
      className="subcategories__selection-actions"
      ariaLabel="Selected SubCategory actions"
    >
      <div className="subcategories__selection-summary" aria-live="polite">
        <Check size={15} />
        <strong>{selectedSubCategories.length} selected</strong>
      </div>
      <button
        type="button"
        className="button button-secondary subcategories__selection-button"
        onClick={() => exportSubCategoriesCsv(selectedSubCategories)}
      >
        <Download size={15} />
        Export
      </button>
      <button
        type="button"
        className="button button-secondary subcategories__selection-button"
        onClick={() => printSubCategories(selectedSubCategories)}
      >
        <Printer size={15} />
        Print
      </button>
      {canDelete ? (
        <button
          type="button"
          className="button button-secondary subcategories__selection-button subcategories__selection-button--danger"
          onClick={handleBulkDelete}
          disabled={isDeleting}
        >
          <Trash2 size={15} />
          Delete
        </button>
      ) : null}
    </FilterBar>
  ) : (
    <FilterBar
      className="subcategories__filters"
      ariaLabel="SubCategory filters"
    >
      <label className="subcategories__status-filter">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </svg>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          aria-label="Filter by status"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </label>
    </FilterBar>
  )

  const toolbarContent = (
    <FilterBar
      className="subcategories__toolbar-actions"
      ariaLabel="SubCategory table actions"
    >
      <button
        type="button"
        className="button button-secondary"
        onClick={() => loadRows({ force: true, showLoading: true })}
        disabled={isLoading}
      >
        <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
        Refresh
      </button>
    </FilterBar>
  )

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="page resource-center">
      <div className="resource-center__page resource-center__page--subCategories">
        <SubCategoriesHeader
          canCreate={canCreate}
          summary={summary}
          activeStatus={statusFilter}
          onFilterStatus={(statusKey) => setStatusFilter(statusKey)}
          onAdd={openCreate}
        />

        {error ? (
          <StateBlock
            type="server"
            title="We could not load subcategories"
            message={error}
            actionLabel="Retry"
            onAction={() => loadRows({ force: true })}
            compact
          />
        ) : null}

        <div className="card resource-center__inventory-table-card">
          <DataTable
            className="resource-center__inventory-table"
            rows={filteredRows}
            columns={columns}
            loading={isLoading}
            defaultPageSize={20}
            defaultSortKey=""
            showSearch={!hasSelectedSubCategories}
            searchPlaceholder="Search subcategories by name, category, or status"
            emptyMessage="No subcategories found."
            splitToolbar
            filterContent={filterContent}
            toolbarContent={toolbarContent}
            columnStorageKey={SUBCATEGORY_COLUMNS_STORAGE_KEY}
            defaultVisibleColumnKeys={SUBCATEGORY_DEFAULT_COLUMNS}
            enableRowSelection
            selectedRowKeys={selectedIds}
            onSelectionChange={setSelectedIds}
            keyField="id"
          />
        </div>

        {/* Add / Edit form modal */}
        {isFormOpen ? (
          <FormModal
            title={`${mode === 'edit' ? 'Edit' : 'Create'} SubCategory`}
            subtitle=""
            onClose={closeForm}
            className="form-modal--subCategories"
            dialogClassName="form-modal__dialog--subCategories"
            bodyClassName="form-modal__body--subCategories"
          >
            <SubCategoryForm
              key={`subcategory-${editingRecord?.id ?? 'new'}`}
              mode={mode}
              record={editingRecord}
              isSubmitting={isSaving}
              serverErrors={serverErrors}
              referenceErrors={{ categories: categoriesError }}
              isReferenceLoading={isLoading && categories.length === 0}
              referenceData={{ categories }}
              draftData={mode === 'create' ? subCategoryDraft : null}
              onDraftChange={updateDraft}
              onSaveDraft={(values) => {
                updateDraft(values, true)
                showToast({
                  type: 'success',
                  title: 'Draft saved',
                  message: 'SubCategory draft saved on this device.',
                })
              }}
              onSubmit={handleSave}
              onCancel={closeForm}
            />
          </FormModal>
        ) : null}

        {/* Delete confirmation */}
        {deleteTarget ? (
          <FormModal
            title={`Delete ${config.entityName}`}
            onClose={() => {
              if (!isDeleting) setDeleteTarget(null)
            }}
          >
            <div className="subcategories__delete-dialog">
              <div className="delete-confirmation__copy">
                <p>
                  Are you sure you want to delete{' '}
                  <strong>{readResourceValue(deleteTarget, 'name', deleteTarget.id)}</strong>?
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

        {/* View SubCategory modal */}
        {viewingSubCategory ? (
          <RecordDetailsView
            modalTitle="SubCategory Details"
            heroTitle={readResourceValue(viewingSubCategory, 'name', 'SubCategory')}
            heroSubtitle={`Category: ${readResourceValue(viewingSubCategory, 'categoryName', readResourceValue(viewingSubCategory, 'category', 'Not set'))}`}
            icon={Layers}
            status={readResourceValue(viewingSubCategory, 'status', 'Active')}
            fields={[
              { label: 'SubCategory ID', value: `ID ${viewingSubCategory.displayId ?? readResourceValue(viewingSubCategory, 'id', '—')}` },
              { label: 'SubCategory Name', value: readResourceValue(viewingSubCategory, 'name', '—') },
              { label: 'Parent Category', value: readResourceValue(viewingSubCategory, 'categoryName', readResourceValue(viewingSubCategory, 'category', '—')) },
              { label: 'Status', render: () => (
                <StatusBadge status={readResourceValue(viewingSubCategory, 'status', 'Active')}>
                  {formatStatusLabel(readResourceValue(viewingSubCategory, 'status', 'Active'))}
                </StatusBadge>
              ) },
              { label: 'Created Date', value: readResourceValue(viewingSubCategory, 'createdAt') ? formatDate(readResourceValue(viewingSubCategory, 'createdAt')) : 'Not set' },
              { label: 'Description', value: readResourceValue(viewingSubCategory, 'description') || 'No description available', fullWidth: true },
            ]}
            onClose={() => setViewingSubCategory(null)}
          />
        ) : null}
      </div>
    </div>
  )
}
