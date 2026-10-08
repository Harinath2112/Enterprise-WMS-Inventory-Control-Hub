import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Boxes,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Download,
  Eye,
  FileText,
  FolderTree,
  Layers,
  LayoutGrid,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  Save,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react'
import {
  createCategory,
  deleteCategory,
  getCategories,
  getSubCategoryRecords,
  normalizeCategory,
  updateCategory,
} from '../../../api/productApi'
import { validateCategoryName } from '../../../validators/categoryValidator'
import FormModal from '../../../layouts/FormModal'
import StateBlock from '../../../components/common/StateBlock'
import RecordDetailsView from '../../../components/common/RecordDetailsView'
import InputField from '../../../components/InputField'
import SearchableSelect from '../../../components/SearchableSelect'
import { ActionMenu, DataTable, FilterBar, StatusBadge } from '../../../components/erp'
import { showToast } from '../../../components/common/toast'
import { useAuth } from '../../../hooks/useAuth'
import './Categories.css'

const CATALOG_STRUCTURE_UPDATED_EVENT = 'ims:catalog-structure-updated'
const CATEGORY_COLUMNS_STORAGE_KEY = 'ims.categories.table.visibleColumns.warehouseParity.v1'
const CATEGORY_DEFAULT_COLUMNS = ['name', 'parentId', 'childCount', 'status', 'actions']
const CATEGORY_COLUMN_WIDTHS = {
  name: 250,
  parentId: 160,
  childCount: 150,
  status: 96,
  updatedAt: 160,
  actions: 90,
}

function clean(value) {
  return String(value ?? '').trim()
}

function comparable(value) {
  return clean(value).toLowerCase()
}

function categoryIdOf(category) {
  if (!category) return ''
  return String(category.id ?? category.categoryId ?? category.subCategoryId ?? '')
}

function parentIdOf(category) {
  if (!category) return ''
  const pId = category.parentId ?? category.parentCategoryId ?? null
  if (pId === null || pId === undefined || pId === '' || pId === 0 || pId === '0' || pId === 'null' || pId === 'undefined') {
    return ''
  }
  return String(pId)
}

function sortByName(items) {
  return [...items].sort((first, second) =>
    first.name.localeCompare(second.name, undefined, { sensitivity: 'base' }),
  )
}

function getLegacyChildren(categories, parentId) {
  return sortByName(
    categories.filter((category) => parentIdOf(category) === String(parentId ?? '')),
  )
}

function childSubCategoriesOf(category, allCategories = []) {
  const directChildren = Array.isArray(category?.childSubCategories)
    ? category.childSubCategories
    : []
  const legacyChildren = Array.isArray(allCategories)
    ? getLegacyChildren(allCategories, categoryIdOf(category))
    : []

  const mergedMap = new Map()
  directChildren.forEach((child) =>
    mergedMap.set(String(child.id || child.subCategoryId || child.categoryId), child),
  )
  legacyChildren.forEach((child) => {
    const id = categoryIdOf(child)
    if (!mergedMap.has(id)) {
      mergedMap.set(id, {
        id,
        name: child.name,
        description: child.description,
        status: child.status,
        createdAt: child.createdAt,
        updatedAt: child.updatedAt,
        parentName: category.name,
      })
    }
  })

  return sortByName([...mergedMap.values()])
}

function getAllChildren(category, allCategories = []) {
  const catId = categoryIdOf(category)
  if (!catId) return []

  const childMap = new Map()

  const directChildren = Array.isArray(category?.childSubCategories)
    ? category.childSubCategories
    : []

  directChildren.forEach((sub) => {
    const subId = String(sub.subCategoryId || sub.id || '')
    const nameKey = comparable(sub.name)
    if (nameKey) {
      childMap.set(nameKey, {
        ...sub,
        id: subId ? `subcat-${subId}` : `sub-${nameKey}`,
        subCategoryId: subId,
        categoryId: catId,
        parentId: catId,
        name: sub.name,
        description: sub.description || '',
        parentName: category.name,
        status: sub.status || 'Active',
        sourceType: 'subcategory',
      })
    }
  })

  allCategories.forEach((item) => {
    const itemParentId = parentIdOf(item)
    const itemId = categoryIdOf(item)
    if (itemParentId && itemParentId === catId && itemId !== catId && item.sourceType === 'subcategory') {
      const nameKey = comparable(item.name)
      if (nameKey && !childMap.has(nameKey)) {
        childMap.set(nameKey, {
          ...item,
          id: `subcat-${itemId}`,
          name: item.name,
          description: item.description || '',
          parentId: catId,
          parentName: category.name,
          status: item.status || 'Active',
          sourceType: 'subcategory',
        })
      }
    }
  })

  return sortByName(Array.from(childMap.values()))
}

function getCategoryChildCount(category, allCategories = []) {
  if (!category) return 0
  return getAllChildren(category, allCategories).length
}

function hasChildSubCategories(category, allCategories = []) {
  return getCategoryChildCount(category, allCategories) > 0
}

function getDescendantIds(categories, categoryId) {
  const result = new Set()
  const queue = [String(categoryId)]

  while (queue.length) {
    const currentId = queue.shift()
    const children = categories.filter((category) => parentIdOf(category) === currentId)

    children.forEach((child) => {
      const childId = categoryIdOf(child)
      if (!result.has(childId)) {
        result.add(childId)
        queue.push(childId)
      }
    })
  }

  return result
}

function buildPath(categories, category) {
  const names = [category.name]
  let parentId = parentIdOf(category)
  const visited = new Set([categoryIdOf(category)])

  while (parentId) {
    if (visited.has(parentId)) {
      break
    }

    visited.add(parentId)
    const parent = categories.find((item) => categoryIdOf(item) === parentId)
    if (!parent) {
      break
    }

    names.unshift(parent.name)
    parentId = parentIdOf(parent)
  }

  return names.join(' / ')
}

function buildVisibleRows(categories, expandedIds, viewMode = 'grid') {
  const categoryMap = new Map()
  categories.forEach((item) => {
    const id = categoryIdOf(item)
    if (id) {
      categoryMap.set(id, item)
    }
  })

  // In Grid View: Display uniform tabular grid of Main Top-Level categories only.
  // Subcategories are accessed via the dedicated Subcategories Drawer Modal.
  if (viewMode === 'grid') {
    const mainCategories = categories.filter((item) => {
      if (item.sourceType === 'subcategory') return false
      const pId = parentIdOf(item)
      return !pId || pId === '0' || pId === 'null' || pId === 'undefined'
    })

    return sortByName(mainCategories).map((node) => {
      const nodeCatId = categoryIdOf(node)
      const children = getAllChildren(node, categories)
      return {
        ...node,
        id: nodeCatId,
        rowType: 'category',
        parentCategoryId: null,
        parentName: 'Main category',
        depth: 0,
        childCount: children.length,
        hasChildren: children.length > 0,
        sortPath: node.name,
      }
    })
  }

  // In Tree View: Root categories are top-level categories (not subcategory records)
  const rootCategories = categories.filter((item) => {
    if (item.sourceType === 'subcategory') return false
    const pId = parentIdOf(item)
    return !pId || pId === '0' || pId === 'null' || pId === 'undefined'
  })

  const rows = []
  const visitedNodeIds = new Set()

  function processNode(node, depth = 0, parentPath = '') {
    const nodeCatId = categoryIdOf(node)
    if (!nodeCatId || visitedNodeIds.has(nodeCatId)) return
    visitedNodeIds.add(nodeCatId)

    const children = getAllChildren(node, categories)
    const childCount = children.length
    const hasChildren = childCount > 0
    const sortPath = parentPath ? `${parentPath} / ${node.name}` : node.name
    const parentObj = parentIdOf(node) ? categoryMap.get(parentIdOf(node)) : null

    rows.push({
      ...node,
      id: nodeCatId,
      rowType: depth === 0 ? 'category' : 'subcategory',
      parentCategoryId: parentIdOf(node),
      parentName: parentObj ? parentObj.name : (node.parentName || node.categoryName || 'Main category'),
      depth,
      childCount,
      hasChildren,
      sortPath,
    })

    if (viewMode === 'tree' && hasChildren && expandedIds.has(nodeCatId)) {
      children.forEach((child) => {
        const rawChildId = categoryIdOf(child) || String(child.id || child.subCategoryId || '')
        const childId = rawChildId
          ? (rawChildId.includes('-sub-') ? rawChildId : `${nodeCatId}-sub-${rawChildId}`)
          : `${nodeCatId}-sub-${comparable(child.name)}`

        if (visitedNodeIds.has(childId)) return
        visitedNodeIds.add(childId)

        const childInMap = categoryMap.get(categoryIdOf(child))
        if (childInMap && categoryIdOf(childInMap) !== nodeCatId && childInMap.sourceType !== 'subcategory') {
          processNode(childInMap, depth + 1, sortPath)
        } else {
          const childSubChildren = getAllChildren(child, categories)
          rows.push({
            ...child,
            id: childId,
            rowType: 'subcategory',
            parentCategoryId: nodeCatId,
            parentName: node.name,
            depth: depth + 1,
            childCount: childSubChildren.length,
            hasChildren: childSubChildren.length > 0,
            sortPath: `${sortPath} / ${child.name}`,
          })
        }
      })
    }
  }

  sortByName(rootCategories).forEach((root) => {
    processNode(root, 0, '')
  })

  return rows
}

function upsertCategories(currentCategories, nextCategories) {
  const map = new Map(currentCategories.map((category) => [categoryIdOf(category), category]))
  nextCategories.forEach((category) => {
    const normalized = typeof normalizeCategory === 'function' ? normalizeCategory(category) : category
    map.set(categoryIdOf(category), normalized)
  })
  return sortByName([...map.values()])
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

function formatDate(value) {
  if (!value) {
    return '-'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '-'
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function categoryParentLabel(categories, category) {
  if (category.rowType === 'subcategory') {
    return category.parentName || category.categoryName || 'Parent category'
  }

  const parent = categories.find((item) => categoryIdOf(item) === parentIdOf(category))
  return parent?.name || 'Main category'
}

function exportCategoriesCsv(categories, allCategories) {
  const headers = ['Category', 'Description', 'Parent', 'Subcategories', 'Status', 'Last Updated']
  const rows = categories.map((category) => [
    category.name,
    category.description,
    categoryParentLabel(allCategories, category),
    category.rowType === 'subcategory' ? 'Child item' : category.childCount,
    category.status || 'Active',
    category.updatedAt || category.createdAt || '',
  ])
  const csv = [headers, ...rows]
    .map((row) => row.map(escapeCsvValue).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'Categories.csv'
  link.click()
  URL.revokeObjectURL(url)
}

function printCategories(categories, allCategories) {
  const rows = categories.map((category) => `
    <tr>
      <td><strong>${escapeHtml(category.name || 'Unnamed category')}</strong><span>${escapeHtml(category.description || 'No description provided')}</span></td>
      <td>${escapeHtml(categoryParentLabel(allCategories, category))}</td>
      <td>${escapeHtml(category.rowType === 'subcategory' ? 'Child item' : category.childCount)}</td>
      <td>${escapeHtml(category.status || 'Active')}</td>
      <td>${escapeHtml(formatDate(category.updatedAt || category.createdAt))}</td>
    </tr>
  `).join('')
  const printWindow = window.open('', '_blank')

  if (!printWindow) {
    return
  }

  printWindow.document.write(`<!doctype html><html><head><title>Categories</title><style>
    body { margin: 28px; color: #111827; font: 13px Arial, sans-serif; }
    h1 { margin: 0 0 16px; font-size: 20px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 8px 10px; border: 1px solid #dbe4f0; text-align: left; vertical-align: top; }
    th { background: #f8fafc; color: #475569; font-size: 12px; }
    td span { display: block; color: #64748b; margin-top: 2px; }
  </style></head><body>
    <h1>Categories</h1>
    <table>
      <thead><tr><th>Category</th><th>Parent</th><th>Subcategories</th><th>Status</th><th>Last Updated</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </body></html>`)
  printWindow.document.close()
  printWindow.focus()
  printWindow.print()
}

function CategoriesHeader({ canCreate, summary, onAdd }) {
  const metrics = [
    { key: 'total', label: 'Categories', value: summary.total, tone: 'info' },
    { key: 'active', label: 'Active', value: summary.active, tone: 'success' },
    { key: 'inactive', label: 'Inactive', value: summary.inactive, tone: 'warning' },
  ]

  return (
    <header className="resource-center__inventory-header" aria-label="Categories summary">
      <div className="resource-center__inventory-header-main">
        <h1>Categories</h1>
        <div className="resource-center__inventory-metrics" aria-label="Category metrics">
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
            Add Category
          </button>
        ) : null}
      </div>
    </header>
  )
}

function CategoryForm({
  categories,
  editingCategory,
  initialParentId = '',
  onSubmit,
  onCancel,
  isSubmitting,
}) {
  const [formData, setFormData] = useState(() => ({
    name: editingCategory?.name ?? '',
    parentId: editingCategory ? parentIdOf(editingCategory) : initialParentId,
    description: editingCategory?.description ?? '',
    status: editingCategory?.status ?? 'Active',
  }))
  const [touched, setTouched] = useState({})

  const isEditing = Boolean(editingCategory)
  const editingId = categoryIdOf(editingCategory)
  const descendantIds = editingCategory ? getDescendantIds(categories, editingId) : new Set()
  const name = clean(formData.name)
  const parentId = String(formData.parentId || '')
  const duplicateName = categories.some((category) =>
    categoryIdOf(category) !== editingId &&
    parentIdOf(category) === parentId &&
    comparable(category.name) === comparable(name),
  )
  const selfParent = isEditing && parentId && parentId === editingId
  const circularParent = isEditing && parentId && descendantIds.has(parentId)

  const categoryValidationErr = validateCategoryName(name, categories, editingId)
  const errors = {
    name: !name
      ? 'Category name is required.'
      : duplicateName
        ? 'A category with this name already exists under the selected parent.'
        : categoryValidationErr,
    parentId: selfParent
      ? 'A category cannot be its own parent.'
      : circularParent
        ? 'A category cannot be moved under one of its subcategories.'
        : '',
  }
  const isFormValid = Object.values(errors).every((value) => !value)
  const hasChanges =
    !isEditing ||
    name !== clean(editingCategory?.name) ||
    parentId !== parentIdOf(editingCategory) ||
    clean(formData.description) !== clean(editingCategory?.description) ||
    clean(formData.status) !== clean(editingCategory?.status)

  const parentOptions = categories
    .filter((category) => {
      const id = categoryIdOf(category)
      const isCurrentParent = editingCategory && parentIdOf(editingCategory) === id
      const isActive = comparable(category.status || 'active') !== 'inactive'
      return id !== editingId && !descendantIds.has(id) && (isActive || isCurrentParent)
    })
    .map((category) => ({
      value: categoryIdOf(category),
      label: buildPath(categories, category),
    }))

  function handleChange(event) {
    const { name: fieldName, value } = event.target
    setFormData((currentValue) => ({
      ...currentValue,
      [fieldName]: value,
    }))
  }

  function handleBlur(event) {
    setTouched((currentValue) => ({
      ...currentValue,
      [event.target.name]: true,
    }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    setTouched({ name: true, parentId: Boolean(errors.parentId) })

    if (!isFormValid || !hasChanges || isSubmitting) {
      return
    }

    onSubmit({
      name,
      parentId: parentId ? Number(parentId) : null,
      description: clean(formData.description),
      status: clean(formData.status) || 'Active',
      isActive: (clean(formData.status) || 'Active') === 'Active',
    })
  }

  return (
    <form className="catalog-form" onSubmit={handleSubmit} autoComplete="off">
      <div className="catalog-form__section">
        <div className="form-grid">
          <InputField
            id="category-name"
            name="name"
            label="Category Name *"
            value={formData.name}
            onChange={handleChange}
            onBlur={handleBlur}
            error={touched.name ? errors.name : ''}
            placeholder="Enter category name"
          />

          <SearchableSelect
            id="category-parent"
            name="parentId"
            label="Parent category"
            value={formData.parentId}
            onChange={handleChange}
            onBlur={handleBlur}
            options={parentOptions}
            placeholder="No parent category"
            error={errors.parentId}
            showError={Boolean(touched.parentId && errors.parentId)}
          />

          <SearchableSelect
            id="category-status"
            name="status"
            label="Status"
            value={formData.status}
            onChange={handleChange}
            onBlur={handleBlur}
            options={[
              { value: 'Active', label: 'Active' },
              { value: 'Inactive', label: 'Inactive' },
            ]}
            placeholder="Select status"
          />

          <InputField
            id="category-description"
            name="description"
            label="Description"
            textarea
            rows={4}
            className="field--full"
            value={formData.description}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="Optional internal description"
          />
        </div>
      </div>

      <div className="button-row catalog-form__footer">
        <button
          type="submit"
          className="button button-primary"
          disabled={!isFormValid || !hasChanges || isSubmitting}
        >
          <Save size={16} />
          {isSubmitting ? 'Saving...' : 'Save Category'}
        </button>
        <button type="button" className="button button-secondary button-cancel" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </button>
      </div>
    </form>
  )
}

export default function Categories() {
  const { hasPermission } = useAuth()
  const [categories, setCategories] = useState([])
  const [expandedIds, setExpandedIds] = useState(() => new Set())
  const [metrics, setMetrics] = useState({
    totalCategories: 0,
  })
  const [isLoading, setIsLoading] = useState(() => !getCategories.hasCache?.())
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [formState, setFormState] = useState(null)
  const [viewingCategory, setViewingCategory] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [subcategoriesViewTarget, setSubcategoriesViewTarget] = useState(null)
  const [selectedCategoryIds, setSelectedCategoryIds] = useState([])
  const [statusFilter, setStatusFilter] = useState('all')
  const [viewMode, setViewMode] = useState('grid')

  const canCreate = hasPermission('categories', 'create')
  const canEdit = hasPermission('categories', 'edit')
  const canDelete = hasPermission('categories', 'delete')

  const loadCategories = useCallback(async (options = {}) => {
    const force = Boolean(options.force)
    const shouldShowLoading = options.showLoading ?? (force || !getCategories.hasCache?.())

    if (shouldShowLoading) {
      setIsLoading(true)
    }

    setError('')

    const [response, subResponse] = await Promise.all([
      getCategories({ force }),
      getSubCategoryRecords({ force }).catch(() => ({ success: false })),
    ])

    if (!response.success) {
      setError(response.error || 'Unable to load categories.')
      setCategories([])
      setMetrics({
        totalCategories: 0,
      })
      setIsLoading(false)
      return
    }

    const rawCategories = response.data ?? []
    const rawSubCategories = subResponse?.success ? (subResponse.data ?? []) : []

    const subCategoriesByParent = new Map()
    rawSubCategories.forEach((sub) => {
      const pId = String(sub.categoryId || sub.parentId || sub.parentCategoryId || '')
      if (pId) {
        if (!subCategoriesByParent.has(pId)) {
          subCategoriesByParent.set(pId, [])
        }
        subCategoriesByParent.get(pId).push(sub)
      }
    })

    const categoriesWithMergedChildren = rawCategories.map((cat) => {
      const catId = categoryIdOf(cat)
      const existingChildren = cat.childSubCategories || []
      const fetchedChildren = subCategoriesByParent.get(catId) || []

      const mergedMap = new Map()
      existingChildren.forEach((child) => mergedMap.set(String(child.id || child.subCategoryId || child.categoryId), child))
      fetchedChildren.forEach((child) => {
        const childId = String(child.id || child.subCategoryId || child.categoryId)
        if (!mergedMap.has(childId)) {
          mergedMap.set(childId, child)
        }
      })

      const childSubCategories = Array.from(mergedMap.values())
      return {
        ...cat,
        childSubCategories,
        subcategoryCount: childSubCategories.length,
      }
    })

    const nextCategories = upsertCategories([], categoriesWithMergedChildren)
    const meta = response.meta ?? {}

    setCategories(nextCategories)
    setMetrics({
      totalCategories: Number(meta.totalCategories ?? meta.TotalCategories ?? nextCategories.length),
    })
    setIsLoading(false)
  }, [])

  useEffect(() => {
    loadCategories({ showLoading: !getCategories.hasCache?.() })

    function handleCatalogUpdate(event) {
      const resource = event.detail?.resource

      if (resource === 'subCategories' || resource === 'categories') {
        loadCategories({ force: true })
      }
    }

    window.addEventListener(CATALOG_STRUCTURE_UPDATED_EVENT, handleCatalogUpdate)

    return () => {
      window.removeEventListener(CATALOG_STRUCTURE_UPDATED_EVENT, handleCatalogUpdate)
    }
  }, [loadCategories])

  const visibleRows = useMemo(
    () => buildVisibleRows(categories, expandedIds, viewMode),
    [categories, expandedIds, viewMode],
  )

  const filteredRows = useMemo(() => {
    if (statusFilter === 'all') {
      return visibleRows
    }

    return visibleRows.filter((category) =>
      comparable(category.status || 'active') === statusFilter,
    )
  }, [statusFilter, visibleRows])

  const allFlattenedRows = useMemo(() => {
    const allParentIds = new Set(categories.map((cat) => categoryIdOf(cat)).filter(Boolean))
    return buildVisibleRows(categories, allParentIds, 'tree')
  }, [categories])

  const handleSelectionChange = useCallback((newKeys) => {
    const newKeySet = new Set(newKeys.map(String))
    const prevKeySet = new Set(selectedCategoryIds.map(String))

    const parentToChildrenMap = new Map()
    const childToParentMap = new Map()

    allFlattenedRows.forEach((row) => {
      if (row.rowType === 'subcategory' && row.parentCategoryId) {
        const pId = String(row.parentCategoryId)
        const cId = String(row.id)
        if (!parentToChildrenMap.has(pId)) {
          parentToChildrenMap.set(pId, [])
        }
        parentToChildrenMap.get(pId).push(cId)
        childToParentMap.set(cId, pId)
      }
    })

    const addedKeys = newKeys.filter((k) => !prevKeySet.has(String(k)))
    const removedKeys = selectedCategoryIds.filter((k) => !newKeySet.has(String(k)))

    const finalSet = new Set(newKeys.map(String))

    addedKeys.forEach((key) => {
      const kStr = String(key)
      if (parentToChildrenMap.has(kStr)) {
        parentToChildrenMap.get(kStr).forEach((childId) => finalSet.add(childId))
      }
    })

    removedKeys.forEach((key) => {
      const kStr = String(key)
      if (parentToChildrenMap.has(kStr)) {
        parentToChildrenMap.get(kStr).forEach((childId) => finalSet.delete(childId))
      }
      if (childToParentMap.has(kStr)) {
        finalSet.delete(childToParentMap.get(kStr))
      }
    })

    parentToChildrenMap.forEach((children, parentId) => {
      if (children.length > 0 && children.every((childId) => finalSet.has(childId))) {
        finalSet.add(parentId)
      }
    })

    setSelectedCategoryIds(Array.from(finalSet))
  }, [allFlattenedRows, selectedCategoryIds])

  const selectedCategories = useMemo(() => {
    const selectedIdSet = new Set(selectedCategoryIds.map(String))
    return allFlattenedRows.filter((category) => selectedIdSet.has(String(category.id || '')))
  }, [allFlattenedRows, selectedCategoryIds])
  const hasSelectedCategories = selectedCategories.length > 0

  useEffect(() => {
    const validIdSet = new Set(allFlattenedRows.map((category) => String(category.id || '')))
    setSelectedCategoryIds((currentValue) => currentValue.filter((id) => validIdSet.has(String(id))))
  }, [allFlattenedRows])

  const mainCategories = useMemo(() => {
    return categories.filter((item) => {
      if (item.sourceType === 'subcategory') return false
      const pId = parentIdOf(item)
      return !pId || pId === '0' || pId === 'null' || pId === 'undefined'
    })
  }, [categories])

  const summary = useMemo(() => {
    return {
      total: mainCategories.length,
      active: mainCategories.filter((category) => comparable(category.status || 'active') !== 'inactive').length,
      inactive: mainCategories.filter((category) => comparable(category.status) === 'inactive').length,
    }
  }, [mainCategories])

  function toggleCategory(category) {
    const id = categoryIdOf(category)

    if (!hasChildSubCategories(category, categories)) {
      return
    }

    setExpandedIds((currentValue) => {
      const nextValue = new Set(currentValue)

      if (nextValue.has(id)) {
        nextValue.delete(id)
      } else {
        nextValue.add(id)
      }

      return nextValue
    })
  }

  async function handleSubmit(values) {
    const categoryNameErr = validateCategoryName(values?.name, categories, formState?.category?.id)
    if (categoryNameErr) {
      showToast({
        type: 'error',
        title: 'Categories',
        message: categoryNameErr,
      })
      return
    }

    setIsSaving(true)

    const response = formState?.category
      ? await updateCategory(formState.category.id, values)
      : await createCategory(values)

    setIsSaving(false)

    if (!response.success) {
      showToast({
        type: 'error',
        title: 'Categories',
        message: response.error || 'Unable to save category.',
      })
      return
    }

    if (values.parentId) {
      setExpandedIds((currentValue) => new Set([...currentValue, String(values.parentId)]))
    }

    await loadCategories({ force: true })

    showToast({
      type: 'success',
      title: 'Categories',
      message: `Category ${formState?.category ? 'updated' : 'created'} successfully.`,
    })
    setFormState(null)
  }

  async function handleToggleStatus(category, targetStatus) {
    const catId = categoryIdOf(category)
    const isInactive = comparable(category.status) === 'inactive'
    const nextStatus = targetStatus || (isInactive ? 'Active' : 'Inactive')

    setCategories((currentValue) =>
      currentValue.map((item) =>
        categoryIdOf(item) === catId ? { ...item, status: nextStatus } : item,
      ),
    )

    setIsSaving(true)
    const response = await updateCategory(catId, {
      name: category.name,
      parentId: category.parentId ? Number(category.parentId) : null,
      description: category.description || '',
      status: nextStatus,
    })
    setIsSaving(false)

    if (!response.success) {
      setCategories((currentValue) =>
        currentValue.map((item) =>
          categoryIdOf(item) === catId ? { ...item, status: category.status } : item,
        ),
      )
      showToast({
        type: 'error',
        title: 'Categories',
        message: response.error || `Unable to set category to ${nextStatus}.`,
      })
      return
    }

    if (response.data) {
      const normalizedData = typeof normalizeCategory === 'function' ? normalizeCategory(response.data) : (response.data || {})
      setCategories((currentValue) =>
        currentValue.map((item) =>
          categoryIdOf(item) === catId ? { ...item, ...normalizedData, status: nextStatus } : item,
        ),
      )
    }

    await loadCategories({ force: true })

    showToast({
      type: 'success',
      title: 'Categories',
      message: `Category status updated to ${nextStatus}.`,
    })
  }

  function handleDeleteClick(category) {
    const childCount = getCategoryChildCount(category, categories)

    if (childCount > 0) {
      showToast({
        type: 'error',
        title: 'Categories',
        message: 'Delete or move subcategories before deleting this category.',
      })
      return
    }

    setDeleteTarget(category)
  }

  function handleBulkDeleteClick() {
    const deletableCategories = selectedCategories.filter((category) => category.rowType === 'category')

    if (deletableCategories.length !== 1 || selectedCategories.length !== 1) {
      showToast({
        type: 'error',
        title: 'Categories',
        message: 'Select one main category at a time to delete.',
      })
      return
    }

    handleDeleteClick(deletableCategories[0])
  }

  async function confirmDelete() {
    if (!deleteTarget) {
      return
    }

    const previousCategories = categories
    setCategories((currentValue) =>
      currentValue.filter((category) => categoryIdOf(category) !== categoryIdOf(deleteTarget)),
    )
    setDeleteTarget(null)

    const response = await deleteCategory(deleteTarget.id)

    if (!response.success) {
      setCategories(previousCategories)
      showToast({
        type: 'error',
        title: 'Categories',
        message: response.error || 'Unable to delete category.',
      })
      return
    }

    showToast({
      type: 'success',
      title: 'Categories',
      message: 'Category deleted successfully.',
    })
    setSelectedCategoryIds((currentValue) =>
      currentValue.filter((id) => String(id) !== String(categoryIdOf(deleteTarget))),
    )
    await loadCategories({ force: true })
  }

  const columns = [
    {
      key: 'name',
      label: 'Category Name',
      tableWidth: CATEGORY_COLUMN_WIDTHS.name,
      className: 'catalog-col-category',
      style: { width: CATEGORY_COLUMN_WIDTHS.name, minWidth: CATEGORY_COLUMN_WIDTHS.name, maxWidth: CATEGORY_COLUMN_WIDTHS.name },
      headerStyle: { width: CATEGORY_COLUMN_WIDTHS.name, minWidth: CATEGORY_COLUMN_WIDTHS.name, maxWidth: CATEGORY_COLUMN_WIDTHS.name },
      sortable: true,
      mobilePrimary: true,
      mobileLabel: 'Category',
      searchValue: (category) =>
        `${category.name} ${category.description} ${category.parentName ?? ''} ${category.categoryName ?? ''} ${buildPath(categories, category)}`,
      sortValue: (category) => (viewMode === 'tree' ? (category.sortPath ?? buildPath(categories, category)) : category.name),
      render: (category) => {
        const depth = category.depth || 0
        const isChild = depth > 0 || category.rowType === 'subcategory'
        const catId = categoryIdOf(category)
        const isExpanded = expandedIds.has(catId)

        return (
          <div
            className={`catalog-page__tree-cell ${isChild ? 'catalog-page__tree-cell--child' : ''}`}
            style={{ paddingLeft: depth > 0 ? `${depth * 24}px` : undefined }}
          >
            {viewMode === 'tree' && category.hasChildren ? (
              <button
                type="button"
                className="catalog-page__tree-toggle"
                onClick={(event) => {
                  event.stopPropagation()
                  toggleCategory(category)
                }}
                aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${category.name}`}
                title="Toggle subcategories"
              >
                {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
              </button>
            ) : null}
            {isChild ? (
              <span className="catalog-page__tree-branch" aria-hidden="true" />
            ) : null}
            {isChild ? (
              <FileText size={16} className="catalog-page__tree-icon catalog-page__child-icon" />
            ) : (
              <Boxes size={16} className="catalog-page__tree-icon" />
            )}
            <div className="catalog-page__entity">
              <strong>{category.name}</strong>
              {category.description ? <span>{category.description}</span> : null}
            </div>
          </div>
        )
      },
    },
    {
      key: 'description',
      label: 'Description',
      tableWidth: 260,
      className: 'catalog-page__description-column',
      mobileDescription: true,
      sortable: true,
      sortValue: (category) => (category.description || '').toLowerCase(),
      render: (category) => (
        <span className={`catalog-page__cell-description ${category.description ? '' : 'is-empty'}`}>
          {category.description || 'No description provided'}
        </span>
      ),
    },
    {
      key: 'parentId',
      label: 'Parent',
      tableWidth: CATEGORY_COLUMN_WIDTHS.parentId,
      className: 'catalog-col-parent',
      style: { width: CATEGORY_COLUMN_WIDTHS.parentId, minWidth: CATEGORY_COLUMN_WIDTHS.parentId, maxWidth: CATEGORY_COLUMN_WIDTHS.parentId },
      headerStyle: { width: CATEGORY_COLUMN_WIDTHS.parentId, minWidth: CATEGORY_COLUMN_WIDTHS.parentId, maxWidth: CATEGORY_COLUMN_WIDTHS.parentId },
      mobileLabel: 'Parent',
      sortable: true,
      sortValue: (category) => categoryParentLabel(categories, category).toLowerCase(),
      render: (category) => {
        const label = categoryParentLabel(categories, category)
        return (
          <span className={label === 'Main category' ? 'catalog-page__parent-main' : 'catalog-page__parent-name'}>
            {label}
          </span>
        )
      },
    },
    {
      key: 'childCount',
      label: 'Subcategories',
      tableWidth: CATEGORY_COLUMN_WIDTHS.childCount,
      className: 'catalog-col-subcategories',
      style: { width: CATEGORY_COLUMN_WIDTHS.childCount, minWidth: CATEGORY_COLUMN_WIDTHS.childCount, maxWidth: CATEGORY_COLUMN_WIDTHS.childCount },
      headerStyle: { width: CATEGORY_COLUMN_WIDTHS.childCount, minWidth: CATEGORY_COLUMN_WIDTHS.childCount, maxWidth: CATEGORY_COLUMN_WIDTHS.childCount },
      mobileLabel: 'Subcats',
      sortable: true,
      sortValue: (category) => (category.rowType === 'subcategory' ? 0 : Number(category.childCount ?? 0)),
      render: (category) => {
        if (category.rowType === 'subcategory') {
          return <span className="catalog-page__muted-value">—</span>
        }
        const activeChildren = getAllChildren(category, categories)
        const childCount = activeChildren.length
        if (childCount > 0) {
          const label = childCount === 1 ? '1 Subcategory' : `${childCount} Subcategories`
          return (
            <button
              type="button"
              className="catalog-page__subcat-badge-btn"
              onClick={(e) => {
                e.stopPropagation()
                setSubcategoriesViewTarget(category)
              }}
              title="View subcategories grid"
            >
              <Layers size={13} className="catalog-page__subcat-icon" />
              <span>{label}</span>
            </button>
          )
        }
        return <span className="catalog-page__subcat-zero">0</span>
      },
    },
    {
      key: 'status',
      label: 'Status',
      tableWidth: CATEGORY_COLUMN_WIDTHS.status,
      className: 'catalog-col-status',
      style: { width: CATEGORY_COLUMN_WIDTHS.status, minWidth: CATEGORY_COLUMN_WIDTHS.status, maxWidth: CATEGORY_COLUMN_WIDTHS.status },
      headerStyle: { width: CATEGORY_COLUMN_WIDTHS.status, minWidth: CATEGORY_COLUMN_WIDTHS.status, maxWidth: CATEGORY_COLUMN_WIDTHS.status },
      mobileStatus: true,
      sortable: true,
      sortValue: (category) => (category.status || 'Active').toLowerCase(),
      render: (category) => (
        <StatusBadge status={category.status || 'Active'}>
          {category.status || 'Active'}
        </StatusBadge>
      ),
    },
    {
      key: 'updatedAt',
      label: 'Last Updated',
      tableWidth: CATEGORY_COLUMN_WIDTHS.updatedAt,
      className: 'catalog-col-date',
      style: { width: CATEGORY_COLUMN_WIDTHS.updatedAt, minWidth: CATEGORY_COLUMN_WIDTHS.updatedAt, maxWidth: CATEGORY_COLUMN_WIDTHS.updatedAt },
      headerStyle: { width: CATEGORY_COLUMN_WIDTHS.updatedAt, minWidth: CATEGORY_COLUMN_WIDTHS.updatedAt, maxWidth: CATEGORY_COLUMN_WIDTHS.updatedAt },
      sortable: true,
      sortValue: (category) => new Date(category.updatedAt || category.createdAt || 0).getTime() || 0,
      render: (category) => formatDate(category.updatedAt || category.createdAt),
    },
    {
      key: 'actions',
      label: 'Actions',
      tableWidth: CATEGORY_COLUMN_WIDTHS.actions,
      className: 'catalog-col-actions',
      style: { width: CATEGORY_COLUMN_WIDTHS.actions, minWidth: CATEGORY_COLUMN_WIDTHS.actions, maxWidth: CATEGORY_COLUMN_WIDTHS.actions },
      headerStyle: { width: CATEGORY_COLUMN_WIDTHS.actions, minWidth: CATEGORY_COLUMN_WIDTHS.actions, maxWidth: CATEGORY_COLUMN_WIDTHS.actions },
      searchable: false,
      hideable: false,
      render: (category) => (
        <div className="catalog-page__row-actions">
          {true ? (
            <ActionMenu
              iconOnly
              className="inventory-row-action-menu"
              label={`Actions for ${category.name}`}
              actions={[
                {
                  key: 'view',
                  label: 'View',
                  icon: Eye,
                  onClick: () => setViewingCategory(category),
                },
                category.childCount > 0 ? {
                  key: 'view-subcategories',
                  label: 'View Subcategories',
                  icon: ClipboardList,
                  onClick: () => setSubcategoriesViewTarget(category),
                } : null,
                canEdit ? {
                  key: 'edit',
                  label: 'Edit',
                  icon: Pencil,
                  onClick: () => setFormState({ category, initialParentId: '' }),
                } : null,
                canEdit ? {
                  key: 'toggle-status',
                  label: comparable(category.status) === 'inactive' ? 'Activate Category' : 'Deactivate Category',
                  icon: Check,
                  onClick: () => handleToggleStatus(category, comparable(category.status) === 'inactive' ? 'Active' : 'Inactive'),
                } : null,
                canDelete ? {
                  key: 'delete',
                  label: 'Delete',
                  icon: Trash2,
                  variant: 'danger',
                  onClick: () => handleDeleteClick(category),
                } : null,
              ]}
            />
          ) : null}
        </div>
      ),
    },
  ]

  function renderCategoryMobileCard({ row }) {
    const isChild = row.rowType === 'subcategory'
    const isExpanded = expandedIds.has(row.id)
    const parentLabel = isChild
      ? row.parentName || row.categoryName || 'Parent category'
      : categories.find((item) => categoryIdOf(item) === parentIdOf(row))?.name || 'Main category'
    const description = clean(row.description) || (isChild ? `Nested under ${parentLabel}` : 'No description provided')

    return (
      <article
        className={`catalog-mobile-card ${
          isChild ? 'catalog-mobile-card--child' : ''
        } ${isExpanded ? 'catalog-mobile-card--expanded' : ''}`.trim()}
      >
        <div className="catalog-mobile-card__header">
          {row.rowType === 'category' && row.hasChildren ? (
            <button
              type="button"
              className="catalog-mobile-card__expand"
              onClick={(event) => {
                event.stopPropagation()
                toggleCategory(row)
              }}
              aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${row.name}`}
              title="Toggle subcategories"
            >
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          ) : (
            <span className="catalog-mobile-card__expand catalog-mobile-card__expand--placeholder" aria-hidden="true" />
          )}

          <div className="catalog-mobile-card__identity">
            <strong>{row.name}</strong>
            {isChild ? <span>{parentLabel}</span> : null}
          </div>

          <StatusBadge type={String(row.status).toLowerCase() === 'inactive' ? 'critical' : 'active'}>
            {row.status || 'Active'}
          </StatusBadge>
        </div>

        {!isChild ? (
          <p className="catalog-mobile-card__description">{description}</p>
        ) : null}

        <dl className="catalog-mobile-card__meta">
          <div>
            <dt>Parent</dt>
            <dd>{parentLabel}</dd>
          </div>
          <div>
            <dt>Subcats</dt>
            <dd>{isChild ? 'Child item' : row.childCount}</dd>
          </div>
        </dl>

        {canEdit || canDelete ? (
          <div className="catalog-mobile-card__actions">
            <ActionMenu
              iconOnly
              className="inventory-row-action-menu"
              label={`Actions for ${row.name}`}
              actions={[
                canEdit ? {
                  key: 'edit',
                  label: 'Edit',
                  icon: Pencil,
                  onClick: () => setFormState({ category: row, initialParentId: '' }),
                } : null,
                canEdit ? {
                  key: 'toggle-status',
                  label: comparable(row.status) === 'inactive' ? 'Activate Category' : 'Deactivate Category',
                  icon: SlidersHorizontal,
                  onClick: () => handleToggleStatus(row, comparable(row.status) === 'inactive' ? 'Active' : 'Inactive'),
                } : null,
                canDelete ? {
                  key: 'delete',
                  label: 'Delete',
                  icon: Trash2,
                  variant: 'danger',
                  onClick: () => handleDeleteClick(row),
                } : null,
              ]}
            />
          </div>
        ) : null}
      </article>
    )
  }

  const selectedToolbarContent = hasSelectedCategories ? (
    <FilterBar className="catalog-table__selection-actions" ariaLabel="Selected category actions">
      <div className="catalog-selection-summary" aria-live="polite">
        <Check size={15} />
        <strong>{selectedCategories.length} selected</strong>
      </div>
      <button
        type="button"
        className="button button-secondary catalog-table__selection-button"
        onClick={() => exportCategoriesCsv(selectedCategories, categories)}
      >
        <Download size={15} />
        Export
      </button>
      <button
        type="button"
        className="button button-secondary catalog-table__selection-button"
        onClick={() => printCategories(selectedCategories, categories)}
      >
        <Printer size={15} />
        Print
      </button>
      {canDelete ? (
        <button
          type="button"
          className="button button-secondary catalog-table__selection-button catalog-table__selection-button--danger"
          onClick={handleBulkDeleteClick}
        >
          <Trash2 size={15} />
          Delete
        </button>
      ) : null}
    </FilterBar>
  ) : null

  const categoryFilterContent = hasSelectedCategories ? selectedToolbarContent : (
    <FilterBar className="categories-list-page__filters" ariaLabel="Category filters">
      <label className="categories-list-page__status-filter">
        <SlidersHorizontal size={15} aria-hidden="true" />
        <span className="sr-only">Filter categories by status</span>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          aria-label="Filter categories by status"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </label>
    </FilterBar>
  )

  return (
    <div className="page resource-center resource-center__page resource-center__page--categories">
      <CategoriesHeader
        canCreate={canCreate}
        summary={summary}
        onAdd={() => setFormState({ category: null, initialParentId: '' })}
      />

      {error ? (
        <StateBlock
          type="server"
          title="We could not load categories"
          message={error}
          actionLabel="Retry"
          onAction={() => loadCategories({ force: true })}
          compact
        />
      ) : null}

      <div className="card resource-center__inventory-table-card">
        <DataTable
          className="resource-center__inventory-table"
          rows={filteredRows}
          columns={columns}
          rowClassName={(row) =>
            row.rowType === 'subcategory'
              ? 'catalog-page__row catalog-page__row--child'
              : expandedIds.has(row.id)
                ? 'catalog-page__row catalog-page__row--expanded'
                : 'catalog-page__row'
          }
          loading={isLoading}
          defaultPageSize={20}
          defaultSortKey=""
          showSearch={!hasSelectedCategories}
          defaultVisibleColumnKeys={CATEGORY_DEFAULT_COLUMNS}
          columnStorageKey={CATEGORY_COLUMNS_STORAGE_KEY}
          fitExplicitColumnsToContainer
          splitToolbar
          filterContent={categoryFilterContent}
          toolbarContent={
            <FilterBar className="categories-list-page__toolbar-actions" ariaLabel="Category table actions">
              <button
                type="button"
                className={`button button-secondary categories-toolbar-btn ${viewMode === 'grid' ? 'is-active' : ''}`}
                onClick={() => setViewMode('grid')}
                title="Tabular Grid View (Uniform main categories table)"
              >
                <LayoutGrid size={15} />
                Grid View
              </button>
              <button
                type="button"
                className={`button button-secondary categories-toolbar-btn ${viewMode === 'tree' ? 'is-active' : ''}`}
                onClick={() => setViewMode('tree')}
                title="Expandable Tree View (Nested hierarchy)"
              >
                <FolderTree size={15} />
                Tree View
              </button>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => loadCategories({ force: true, showLoading: true })}
                disabled={isLoading}
              >
                <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                Refresh
              </button>
            </FilterBar>
          }
          searchPlaceholder="Search categories by name, parent"
          emptyMessage="No categories found."
          renderMobileCard={renderCategoryMobileCard}
          enableRowSelection
          selectedRowKeys={selectedCategoryIds}
          onSelectionChange={handleSelectionChange}
          keyField="id"
        />
      </div>

      {formState ? (
        <FormModal
          title={`${formState.category ? 'Edit' : 'Create'} Category`}
          onClose={() => setFormState(null)}
          dialogClassName="catalog-category-modal"
          bodyClassName="catalog-category-modal__body"
        >
          <CategoryForm
            categories={categories}
            editingCategory={formState.category}
            initialParentId={formState.initialParentId}
            onSubmit={handleSubmit}
            onCancel={() => setFormState(null)}
            isSubmitting={isSaving}
          />
        </FormModal>
      ) : null}

      {deleteTarget ? (
        <FormModal
          title="Delete Category"
          className="form-modal--category-delete"
          dialogClassName="catalog-category-delete-modal"
          bodyClassName="catalog-category-delete-modal__body"
          onClose={() => setDeleteTarget(null)}
        >
          <div className="catalog-form__delete-dialog">
            <div className="catalog-form__delete-copy">
              <p>
                Are you sure you want to delete <strong>{deleteTarget.name}</strong>?
              </p>
              <p className="catalog-form__delete-warning">
                Products using this category may require review after deletion.
              </p>
            </div>
            <div className="button-row catalog-form__delete-actions">
              <button className="button button-cancel button-secondary"
                type="button"
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </button>
              <button type="button" className="button button-danger" onClick={confirmDelete}>
                <Trash2 size={16} />
                Delete
              </button>
            </div>
          </div>
        </FormModal>
      ) : null}

      {subcategoriesViewTarget ? (
        <FormModal
          title={`${subcategoriesViewTarget.name} — Subcategories`}
          onClose={() => setSubcategoriesViewTarget(null)}
          dialogClassName="catalog-category-subcategories-modal"
        >
          <div className="catalog-subcategories-drawer">
            <div className="catalog-subcategories-drawer__header">
              <div>
                <strong>{subcategoriesViewTarget.name}</strong>
                <span className="subtext">
                  {getAllChildren(subcategoriesViewTarget, categories).length} Subcategories
                </span>
              </div>
              {canCreate ? (
                <button
                  type="button"
                  className="button button-primary button-sm"
                  onClick={() => {
                    setFormState({ category: null, initialParentId: subcategoriesViewTarget.id })
                  }}
                >
                  <Plus size={14} /> Add Subcategory
                </button>
              ) : null}
            </div>

            {getAllChildren(subcategoriesViewTarget, categories).length > 0 ? (
              <div className="catalog-subcategories-drawer__table-wrapper">
                <table className="catalog-subcategories-mini-table">
                  <thead>
                    <tr>
                      <th>Subcategory Name</th>
                      <th>Description</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getAllChildren(subcategoriesViewTarget, categories).map((sub) => (
                      <tr key={sub.id}>
                        <td>
                          <strong>{sub.name}</strong>
                        </td>
                        <td>{sub.description || 'No description provided'}</td>
                        <td>
                          <StatusBadge status={sub.status || 'Active'}>
                            {sub.status || 'Active'}
                          </StatusBadge>
                        </td>
                        <td>
                          <div className="catalog-page__row-actions">
                            {canEdit ? (
                              <button
                                type="button"
                                className="button button-text button-sm"
                                title="Edit subcategory"
                                onClick={() => {
                                  setSubcategoriesViewTarget(null)
                                  setFormState({ category: sub, initialParentId: subcategoriesViewTarget.id })
                                }}
                              >
                                <Pencil size={14} />
                              </button>
                            ) : null}
                            {canDelete ? (
                              <button
                                type="button"
                                className="button button-text button-danger button-sm"
                                title="Delete subcategory"
                                onClick={() => {
                                  setSubcategoriesViewTarget(null)
                                  handleDeleteClick(sub)
                                }}
                              >
                                <Trash2 size={14} />
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="catalog-subcategories-drawer__empty">
                No subcategories created under {subcategoriesViewTarget?.name || 'Category'} yet.
              </div>
            )}
          </div>
        </FormModal>
      ) : null}

      {/* View Category Modal */}
      {viewingCategory ? (
        <RecordDetailsView
          modalTitle="Category Details"
          heroTitle={viewingCategory.name || 'Category'}
          heroSubtitle={`${getCategoryChildCount(viewingCategory, categories)} Subcategories`}
          icon={FolderTree}
          status={viewingCategory.status || 'Active'}
          fields={[
            { label: 'Category ID', value: `ID ${categoryIdOf(viewingCategory) || '—'}` },
            { label: 'Category Name', value: viewingCategory.name || '—' },
            { label: 'Subcategories Count', value: getCategoryChildCount(viewingCategory, categories) },
            { label: 'Status', render: () => (
              <StatusBadge status={viewingCategory.status || 'Active'}>
                {viewingCategory.status || 'Active'}
              </StatusBadge>
            ) },
            { label: 'Last Updated', value: formatDate(viewingCategory.updatedAt || viewingCategory.createdAt) },
            { label: 'Description', value: viewingCategory.description || 'No description available', fullWidth: true },
          ]}
          onClose={() => setViewingCategory(null)}
        />
      ) : null}
    </div>
  )
}
