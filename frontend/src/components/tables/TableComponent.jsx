import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  LoaderCircle,
  SlidersHorizontal,
} from 'lucide-react'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import StateBlock from '../common/StateBlock'
import MobileEntityCard from '../masterData/MobileEntityCard'
import Pagination from '../erp/Pagination'
import SearchBar from '../erp/SearchBar'
import TableToolbar from '../erp/TableToolbar'
import TruncatedCellTooltip from './TruncatedCellTooltip'
import { validateSearchQuery } from '../../utils/searchValidationUtils'
import './TableComponent.css'

function extractTextFromReactNode(node) {
  if (node === null || node === undefined || typeof node === 'boolean') {
    return ''
  }
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node)
  }
  if (Array.isArray(node)) {
    return node.map(extractTextFromReactNode).join('')
  }
  if (node?.props) {
    if (node.props.label && typeof node.props.label === 'string') {
      return node.props.label
    }
    if (node.props.value !== undefined && node.props.value !== null && typeof node.props.value !== 'object') {
      return String(node.props.value)
    }
    if (node.props.children) {
      return extractTextFromReactNode(node.props.children)
    }
  }
  return ''
}

function parseNumeric(val) {
  if (typeof val === 'number') {
    return Number.isFinite(val) ? val : null
  }
  if (typeof val !== 'string') return null
  const trimmed = val.trim()
  if (!trimmed) return null

  // Don't treat dates as numeric (e.g. 03-09-2026 or 2026-09-03)
  if (/^\d{1,4}[-/]\d{1,2}[-/]\d{1,4}/.test(trimmed)) {
    return null
  }

  // Don't treat identifiers with letters like "IND-20260903-001" as numbers
  if (/[A-Za-z]/.test(trimmed) && !/^[-+]?[$₹€£]?\s*[-+]?\d/.test(trimmed)) {
    return null
  }

  // Pure standard number (e.g. "100", "2.5", "-10")
  const directNum = Number(trimmed)
  if (!Number.isNaN(directNum) && Number.isFinite(directNum)) {
    return directNum
  }

  // Formatted currency, percentage, or number with commas (e.g. "$1,200.50", "₹ 15,000", "(50.00)", "1,000")
  const currencyMatch = trimmed.match(/^([+-]?)\s*([$₹€£]?)\s*([+-]?)\s*\(?(\d{1,3}(?:,\d{3})*|\d+)(?:\.(\d+))?\)?\s*(%?)$/)
  if (currencyMatch) {
    const isNegative = trimmed.includes('-') || trimmed.includes('(')
    const cleaned = trimmed.replace(/[^0-9.]/g, '')
    const num = Number(cleaned)
    if (!Number.isNaN(num) && Number.isFinite(num)) {
      return isNegative ? -num : num
    }
  }

  return null
}

function parseDateRobust(val) {
  if (!val) return null
  if (val instanceof Date) {
    const t = val.getTime()
    return Number.isNaN(t) ? null : t
  }
  if (typeof val === 'number' && val > 100000000000) {
    return val
  }
  if (typeof val !== 'string') return null
  const trimmed = val.trim()
  if (!trimmed || trimmed.length < 8) return null

  // Pure numbers (or numbers with commas/currency) are NOT dates
  if (/^[-+]?[$₹€£]?\s*[-+]?\d+(?:,\d{3})*(?:\.\d+)?%?$/.test(trimmed)) {
    return null
  }

  // 1. Match DD-MM-YYYY or DD/MM/YYYY with optional time and AM/PM (e.g. "03-09-2026", "19-08-2026 05:15 PM")
  const ddmmyyyyMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM))?)?$/i)
  if (ddmmyyyyMatch) {
    const day = parseInt(ddmmyyyyMatch[1], 10)
    const month = parseInt(ddmmyyyyMatch[2], 10)
    const year = parseInt(ddmmyyyyMatch[3], 10)
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      let hours = ddmmyyyyMatch[4] ? parseInt(ddmmyyyyMatch[4], 10) : 0
      const minutes = ddmmyyyyMatch[5] ? parseInt(ddmmyyyyMatch[5], 10) : 0
      const seconds = ddmmyyyyMatch[6] ? parseInt(ddmmyyyyMatch[6], 10) : 0
      const ampm = ddmmyyyyMatch[7] ? ddmmyyyyMatch[7].toUpperCase() : null
      if (ampm === 'PM' && hours < 12) hours += 12
      if (ampm === 'AM' && hours === 12) hours = 0
      return new Date(year, month - 1, day, hours, minutes, seconds).getTime()
    }
  }

  // 2. Match YYYY-MM-DD or YYYY/MM/DD
  const yyyymmddMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?)?/)
  if (yyyymmddMatch) {
    const year = parseInt(yyyymmddMatch[1], 10)
    const month = parseInt(yyyymmddMatch[2], 10)
    const day = parseInt(yyyymmddMatch[3], 10)
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      let hours = yyyymmddMatch[4] ? parseInt(yyyymmddMatch[4], 10) : 0
      const minutes = yyyymmddMatch[5] ? parseInt(yyyymmddMatch[5], 10) : 0
      const seconds = yyyymmddMatch[6] ? parseInt(yyyymmddMatch[6], 10) : 0
      return new Date(year, month - 1, day, hours, minutes, seconds).getTime()
    }
    const parsed = Date.parse(trimmed)
    if (!Number.isNaN(parsed)) return parsed
  }

  // 3. Fallback for textual month formats like "Jan 15, 2026" or "15-Aug-2026"
  if (/^(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}|\d{1,2}[-\s]+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[-\s]+\d{4})/i.test(trimmed)) {
    const parsed = Date.parse(trimmed)
    if (!Number.isNaN(parsed)) return parsed
  }

  return null
}

function getValueFromColumn(column, row) {
  if (!column || !row) return ''

  if (typeof column.sortValue === 'function') {
    return column.sortValue(row)
  }

  if (column.key) {
    let value
    if (typeof column.key === 'string' && column.key.includes('.')) {
      value = column.key.split('.').reduce((acc, part) => acc?.[part], row)
    } else {
      value = row[column.key]
    }

    if (value !== undefined && value !== null && value !== '') {
      if (typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
        return value.name ?? value.label ?? value.title ?? value.code ?? value.value ?? value.id ?? String(value)
      }
      return value
    }
  }

  if (typeof column.render === 'function') {
    try {
      const rendered = column.render(row)
      if (typeof rendered === 'string' || typeof rendered === 'number' || rendered instanceof Date) {
        return rendered
      }
      if (rendered && typeof rendered === 'object') {
        const text = extractTextFromReactNode(rendered).trim()
        if (text) return text
      }
    } catch {
      // Ignore render errors during value extraction
    }
  }

  if (typeof column.searchValue === 'function') {
    try {
      const searched = column.searchValue(row)
      if (typeof searched === 'string' || typeof searched === 'number') {
        return searched
      }
    } catch {
      // Ignore search errors
    }
  }

  return ''
}

function getSearchableText(row, columns, searchKeys) {
  if (searchKeys.length > 0) {
    return searchKeys
      .map((key) => String(row[key] ?? '').toLowerCase())
      .join(' ')
  }

  return columns
    .filter((column) => column.searchable !== false)
    .map((column) => {
      if (typeof column.searchValue === 'function') {
        return String(column.searchValue(row) ?? '').toLowerCase()
      }

      if (column.key) {
        return String(row[column.key] ?? '').toLowerCase()
      }

      return ''
    })
    .join(' ')
}

function getRowKey(row, keyField, index) {
  return row?.[keyField] ?? row?.id ?? row?._id ?? row?.productId ?? `row-${index}`
}

function getColumnLabel(column) {
  if (typeof column.mobileLabel === 'string') {
    return column.mobileLabel
  }

  if (typeof column.label === 'string') {
    return column.label
  }

  return column.key ?? ''
}

function isActionsColumn(column) {
  return column.key === 'actions' || String(column.label ?? '').toLowerCase() === 'actions'
}

function isStatusColumn(column) {
  if (column.mobileStatus === true || column.format === 'status') {
    return true
  }

  const value = `${column.key ?? ''} ${column.label ?? ''}`.toLowerCase()
  return ['status', 'state', 'active', 'priority'].some((token) => value.includes(token))
}

function renderCellContent(column, row) {
  return typeof column.render === 'function'
    ? column.render(row)
    : row[column.key]
}

function getMobilePrimaryColumn(columns) {
  return columns.find((column) => column.mobilePrimary) ||
    columns.find((column) => !isActionsColumn(column) && column.mobileHidden !== true) ||
    columns[0]
}

function renderPlainText(value) {
  if (typeof value === 'string' || typeof value === 'number') {
    return value
  }

  return value
}

function isInteractiveTarget(target) {
  return Boolean(
    target?.closest?.(
      'button, a, input, select, textarea, summary, [role="button"], [data-row-click-ignore="true"]',
    ),
  )
}

function getVisiblePages(currentPage, totalPages) {
  const pages = []
  const maxVisiblePages = 5
  let startPage = Math.max(1, currentPage - 2)
  const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1)

  if (endPage - startPage + 1 < maxVisiblePages) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1)
  }

  for (let pageNumber = startPage; pageNumber <= endPage; pageNumber += 1) {
    pages.push(pageNumber)
  }

  return pages
}

function getColumnKey(column, index) {
  return String(column.key || column.label || `column-${index}`)
}

function getInitialVisibleColumnKeys(columns, defaultVisibleColumnKeys, storageKey) {
  const allKeys = columns.map(getColumnKey)
  const fallbackKeys = Array.isArray(defaultVisibleColumnKeys) && defaultVisibleColumnKeys.length > 0
    ? defaultVisibleColumnKeys.filter((key) => allKeys.includes(key))
    : allKeys

  if (!storageKey || typeof window === 'undefined') {
    return fallbackKeys.length > 0 ? fallbackKeys : allKeys
  }

  try {
    const rawValue = window.localStorage.getItem(storageKey)
    const parsedValue = rawValue ? JSON.parse(rawValue) : null

    if (Array.isArray(parsedValue)) {
      const storedKeys = parsedValue.filter((key) => allKeys.includes(key))
      return storedKeys.length > 0 ? storedKeys : fallbackKeys
    }
  } catch {
    // Ignore storage failures and keep table controls usable.
  }

  return fallbackKeys.length > 0 ? fallbackKeys : allKeys
}

function areStringArraysEqual(firstItems = [], secondItems = []) {
  return firstItems.length === secondItems.length &&
    firstItems.every((item, index) => item === secondItems[index])
}

function getColumnWidth(column) {
  const widthValue =
    column?.tableWidth ??
    column?.width ??
    column?.headerStyle?.width ??
    column?.style?.width ??
    column?.headerStyle?.minWidth ??
    column?.style?.minWidth

  if (typeof widthValue === 'number' && Number.isFinite(widthValue)) {
    return `${widthValue}px`
  }

  if (typeof widthValue === 'string' && widthValue.trim()) {
    return widthValue
  }

  return ''
}

function getColumnWidthNumber(column) {
  const width = getColumnWidth(column)
  const parsedWidth = Number.parseFloat(width)

  return Number.isFinite(parsedWidth) && width.endsWith('px') ? parsedWidth : 0
}

export default function TableComponent({
  title,
  subtitle,
  rows,
  columns,
  keyField = 'id',
  searchKeys = [],
  searchPlaceholder = 'Search by name or keyword',
  invalidSearchMessage = '',
  showSearch = true,
  emptyMessage = 'No records available.',
  loading = false,
  defaultPageSize = 6,
  hideSelectionSummary = false,
  defaultSortKey = '',
  defaultSortDirection = 'asc',
  showSubtitle = false,
  toolbarContent = null,
  primaryActionContent = null,
  datasetContent = null,
  footerContent = null,
  filterContent = null,
  splitToolbar = false,
  rowClassName,
  onRowClick,
  renderMobileCard,
  allowSortReset = false,
  showColumnControls = true,
  defaultVisibleColumnKeys = [],
  lockedColumnKeys = [],
  minVisibleColumnCount = 1,
  columnStorageKey = '',
  enableRowSelection = false,
  selectedRowKeys,
  onSelectionChange,
  searchTerm: externalSearchTerm,
  onSearchChange,
  fitExplicitColumnsToContainer = true,
  showHorizontalScrollbar = false,
}) {
  const columnMenuRef = useRef(null)
  const tableContainerRef = useRef(null)
  const horizontalScrollbarRef = useRef(null)
  const selectAllCheckboxRef = useRef(null)
  const [internalSearchTerm, setInternalSearchTerm] = useState('')
  const isSearchControlled = externalSearchTerm !== undefined
  const searchTerm = isSearchControlled ? externalSearchTerm : internalSearchTerm
  const setSearchTerm = isSearchControlled ? (onSearchChange || (() => {})) : setInternalSearchTerm
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(defaultPageSize)
  const [isColumnMenuOpen, setIsColumnMenuOpen] = useState(false)
  const [internalSelectedKeys, setInternalSelectedKeys] = useState([])
  const resolvedColumnStorageKey = useMemo(() => {
    if (columnStorageKey) {
      return columnStorageKey
    }

    if (typeof window === 'undefined') {
      return ''
    }

    const columnSignature = columns.map(getColumnKey).join('-')
    return `ims.table.visibleColumns.${window.location.pathname}.${keyField}.${columnSignature}`
  }, [columnStorageKey, columns, keyField])
  const [visibleColumnKeys, setVisibleColumnKeys] = useState(() =>
    getInitialVisibleColumnKeys(columns, defaultVisibleColumnKeys, resolvedColumnStorageKey),
  )
  const [sortConfig, setSortConfig] = useState({
    key: defaultSortKey,
    direction: defaultSortDirection,
  })

  useEffect(() => {
    if (defaultSortKey) {
      setSortConfig((current) => {
        if (!current.key) {
          return { key: defaultSortKey, direction: defaultSortDirection }
        }
        return current
      })
    }
  }, [defaultSortKey, defaultSortDirection])
  const selectedKeys = Array.isArray(selectedRowKeys) ? selectedRowKeys : internalSelectedKeys
  const minimumVisibleColumnCount = Math.max(1, Number(minVisibleColumnCount) || 1)

  const effectiveLockedColumnKeys = useMemo(() => {
    const lockedKeys = new Set(lockedColumnKeys)

    columns.forEach((column, index) => {
      const key = getColumnKey(column, index)

      if (column.hideable === false || column.mobilePrimary || isActionsColumn(column)) {
        lockedKeys.add(key)
      }
    })

    return [...lockedKeys]
  }, [columns, lockedColumnKeys])

  const resolvedInvalidSearchMessage = useMemo(() => {
    if (invalidSearchMessage && typeof invalidSearchMessage === 'string' && invalidSearchMessage.trim()) {
      return invalidSearchMessage.trim()
    }

    if (searchPlaceholder && typeof searchPlaceholder === 'string') {
      const trimmed = searchPlaceholder.trim()
      const lower = trimmed.toLowerCase()
      if (lower.startsWith('search by ')) {
        const criteria = trimmed.slice(10).trim()
        if (criteria && !lower.includes('name or keyword')) {
          return `Please enter a valid search term (e.g., ${criteria}).`
        }
      } else if (lower.startsWith('search indents by ')) {
        const criteria = trimmed.slice(18).trim()
        return `Please enter a valid search term (e.g., ${criteria}).`
      } else if (lower.startsWith('search products by ')) {
        const criteria = trimmed.slice(19).trim()
        return `Please enter a valid search term (e.g., ${criteria}).`
      } else if (lower.startsWith('search ')) {
        const criteria = trimmed.slice(7).replace(/^for\s+/i, '').replace(/^by\s+/i, '').trim()
        if (criteria && !lower.includes('name or keyword')) {
          return `Please enter a valid search term (e.g., ${criteria}).`
        }
      }
    }

    return 'Please enter a valid search term (e.g., name, code, date).'
  }, [invalidSearchMessage, searchPlaceholder])

  useEffect(() => {
    function handlePointerDown(event) {
      if (!columnMenuRef.current?.contains(event.target)) {
        setIsColumnMenuOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [])

  useEffect(() => {
    const allowedKeys = columns.map(getColumnKey)

    setVisibleColumnKeys((currentValue) => {
      const nextKeys = currentValue.filter((key) => allowedKeys.includes(key))

      effectiveLockedColumnKeys.forEach((key) => {
        if (allowedKeys.includes(key) && !nextKeys.includes(key)) {
          nextKeys.push(key)
        }
      })

      const resolvedKeys = nextKeys.length > 0 ? nextKeys : allowedKeys
      return areStringArraysEqual(currentValue, resolvedKeys)
        ? currentValue
        : resolvedKeys
    })
  }, [columns, effectiveLockedColumnKeys])

  useEffect(() => {
    if (!resolvedColumnStorageKey || typeof window === 'undefined') {
      return
    }

    try {
      window.localStorage.setItem(resolvedColumnStorageKey, JSON.stringify(visibleColumnKeys))
    } catch {
      // Ignore storage failures and keep the table usable.
    }
  }, [resolvedColumnStorageKey, visibleColumnKeys])

  useEffect(() => {
    setPage(1)
  }, [searchTerm, pageSize, rows])

  useEffect(() => {
    if (!tableContainerRef.current) {
      return
    }

    tableContainerRef.current.scrollLeft = 0
  }, [visibleColumnKeys])

  const displayColumns = useMemo(() => {
    if (!showColumnControls) {
      return columns
    }

    const visibleKeySet = new Set(visibleColumnKeys)
    return columns.filter((column, index) => visibleKeySet.has(getColumnKey(column, index)))
  }, [columns, showColumnControls, visibleColumnKeys])

  const filteredRows = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()

    if (!normalizedSearch) {
      return rows
    }

    return rows.filter((row) =>
      getSearchableText(row, columns, searchKeys).includes(normalizedSearch),
    )
  }, [columns, rows, searchKeys, searchTerm])

  const sortedRows = useMemo(() => {
    if (!sortConfig.key) {
      return filteredRows
    }

    const activeColumn = columns.find(
      (column) =>
        column.key === sortConfig.key ||
        column.label === sortConfig.key ||
        (column.key || column.label) === sortConfig.key,
    )

    if (!activeColumn) {
      return filteredRows
    }

    const mult = sortConfig.direction === 'asc' ? 1 : -1

    return [...filteredRows].sort((firstRow, secondRow) => {
      const rawFirst = getValueFromColumn(activeColumn, firstRow)
      const rawSecond = getValueFromColumn(activeColumn, secondRow)

      const isFirstNil = rawFirst === null || rawFirst === undefined || rawFirst === ''
      const isSecondNil = rawSecond === null || rawSecond === undefined || rawSecond === ''

      if (isFirstNil && isSecondNil) return 0
      if (isFirstNil) return 1
      if (isSecondNil) return -1

      // Booleans
      if (typeof rawFirst === 'boolean' || typeof rawSecond === 'boolean') {
        const diff = (Number(Boolean(rawFirst)) - Number(Boolean(rawSecond))) * mult
        if (diff !== 0) return diff
      } else {
        // Numbers or Numeric strings (e.g. 10 vs 2, or currency "$1,200.50", "₹ 15,000", "200")
        const numFirst = parseNumeric(rawFirst)
        const numSecond = parseNumeric(rawSecond)

        if (numFirst !== null && numSecond !== null) {
          const diff = (numFirst - numSecond) * mult
          if (diff !== 0) return diff
        } else if (numFirst !== null) {
          return -1
        } else if (numSecond !== null) {
          return 1
        } else {
          // Dates (ISO timestamp, DD-MM-YYYY, Date object)
          const dateFirst = parseDateRobust(rawFirst)
          const dateSecond = parseDateRobust(rawSecond)

          if (dateFirst !== null && dateSecond !== null) {
            const diff = (dateFirst - dateSecond) * mult
            if (diff !== 0) return diff
          } else if (dateFirst !== null) {
            return -1
          } else if (dateSecond !== null) {
            return 1
          } else {
            // Natural String comparison with localeCompare
            const strFirst = String(rawFirst).trim()
            const strSecond = String(rawSecond).trim()

            const diff = strFirst.localeCompare(strSecond, undefined, { numeric: true, sensitivity: 'base' }) * mult
            if (diff !== 0) return diff
          }
        }
      }

      // Stable tie-breaker for deterministic sorting
      const keyFirst = String(getRowKey(firstRow, keyField, 0))
      const keySecond = String(getRowKey(secondRow, keyField, 0))
      return keyFirst.localeCompare(keySecond, undefined, { numeric: true }) * mult
    })
  }, [columns, filteredRows, keyField, sortConfig])

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const visiblePages = getVisiblePages(currentPage, totalPages)
  const paginatedRows = sortedRows.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  )
  const mobilePrimaryColumn = getMobilePrimaryColumn(displayColumns)
  const mobileActionColumn = displayColumns.find(isActionsColumn)
  const mobileDetailColumns = displayColumns.filter((column) =>
    column !== mobilePrimaryColumn &&
    column !== mobileActionColumn &&
    column.mobileHidden !== true &&
    !isStatusColumn(column),
  )
  const mobileStatusColumns = displayColumns.filter((column) =>
    column !== mobilePrimaryColumn &&
    column !== mobileActionColumn &&
    column.mobileHidden !== true &&
    isStatusColumn(column),
  )
  const hasManualSelectionColumn = displayColumns.some((column) => column.key === 'selection')
  const shouldShowSelection = enableRowSelection && !hasManualSelectionColumn
  const pageRowKeys = paginatedRows.map((row, index) => String(getRowKey(row, keyField, index)))
  const selectedKeySet = new Set(selectedKeys.map(String))
  const selectedPageCount = pageRowKeys.filter((key) => selectedKeySet.has(key)).length
  const isPageSelected = pageRowKeys.length > 0 && selectedPageCount === pageRowKeys.length
  const isPagePartiallySelected = selectedPageCount > 0 && selectedPageCount < pageRowKeys.length

  useEffect(() => {
    if (selectAllCheckboxRef.current) {
      selectAllCheckboxRef.current.indeterminate = false
      selectAllCheckboxRef.current.checked = isPageSelected
    }
  }, [isPageSelected])
  const hideableColumns = columns.filter((column, index) =>
    typeof column.label === 'string' &&
    !effectiveLockedColumnKeys.includes(getColumnKey(column, index)))
  const canShowColumnControls = showColumnControls && hideableColumns.length > 0
  const columnWidths = useMemo(() => displayColumns.map(getColumnWidth), [displayColumns])
  const explicitTableWidth = useMemo(() => {
    const displayColumnWidth = displayColumns.reduce(
      (totalWidth, column) => totalWidth + getColumnWidthNumber(column),
      0,
    )
    const selectionWidth = shouldShowSelection ? 44 : 0
    const totalWidth = displayColumnWidth + selectionWidth

    return totalWidth > 0 ? totalWidth : 0
  }, [displayColumns, shouldShowSelection])
  const tableStyle = explicitTableWidth > 0
    ? {
        '--table-explicit-width': `${explicitTableWidth}px`,
        width: fitExplicitColumnsToContainer ? undefined : `${explicitTableWidth}px`,
        minWidth: fitExplicitColumnsToContainer
          ? `max(${explicitTableWidth}px, 100%)`
          : `${explicitTableWidth}px`,
        tableLayout: 'fixed',
      }
    : undefined

  const handleTableScroll = () => {
    if (showHorizontalScrollbar && horizontalScrollbarRef.current && tableContainerRef.current) {
      horizontalScrollbarRef.current.scrollLeft = tableContainerRef.current.scrollLeft
    }
  }

  const handleHorizontalScrollbarScroll = () => {
    if (horizontalScrollbarRef.current && tableContainerRef.current) {
      tableContainerRef.current.scrollLeft = horizontalScrollbarRef.current.scrollLeft
    }
  }

  function handleSort(column) {
    if (!column.sortable) {
      return
    }

    const columnKey = column.key || column.label

    setSortConfig((currentValue) => {
      if (allowSortReset && currentValue.key === columnKey && currentValue.direction === 'desc') {
        return { key: '', direction: 'asc' }
      }

      return {
        key: columnKey,
        direction:
          currentValue.key === columnKey && currentValue.direction === 'asc'
            ? 'desc'
            : 'asc',
      }
    })
  }

  function handleRowClick(row, event) {
    if (!onRowClick || isInteractiveTarget(event.target)) {
      return
    }

    onRowClick(row)
  }

  function handleRowKeyDown(row, event) {
    if (!onRowClick || isInteractiveTarget(event.target)) {
      return
    }

    if (event.key !== 'Enter' && event.key !== ' ') {
      return
    }

    event.preventDefault()
    onRowClick(row)
  }

  function updateSelection(nextKeys) {
    const normalizedKeys = [...new Set(nextKeys.map(String))]

    if (!Array.isArray(selectedRowKeys)) {
      setInternalSelectedKeys(normalizedKeys)
    }

    onSelectionChange?.(normalizedKeys)
  }

  function handleToggleRowSelection(rowKey) {
    const normalizedKey = String(rowKey)
    updateSelection(
      selectedKeySet.has(normalizedKey)
        ? selectedKeys.filter((key) => String(key) !== normalizedKey)
        : [...selectedKeys, normalizedKey],
    )
  }

  function handleTogglePageSelection() {
    if (isPageSelected || isPagePartiallySelected) {
      updateSelection(selectedKeys.filter((key) => !pageRowKeys.includes(String(key))))
      return
    }

    updateSelection([...selectedKeys, ...pageRowKeys])
  }

  function handleToggleColumn(columnKey) {
    if (effectiveLockedColumnKeys.includes(columnKey)) {
      return
    }

    setVisibleColumnKeys((currentValue) => {
      const hasColumn = currentValue.includes(columnKey)

      if (hasColumn && currentValue.length <= minimumVisibleColumnCount) {
        return currentValue
      }

      const nextKeys = hasColumn
        ? currentValue.filter((key) => key !== columnKey)
        : [...currentValue, columnKey]

      effectiveLockedColumnKeys.forEach((key) => {
        if (!nextKeys.includes(key)) {
          nextKeys.push(key)
        }
      })

      return nextKeys
    })
  }

  function handleResetColumns() {
    const allKeys = columns.map(getColumnKey)
    setVisibleColumnKeys(allKeys)
  }

  const isSelectionActive = selectedKeys.length > 0 && shouldShowSelection
  const selectionSummary = isSelectionActive && !hideSelectionSummary ? (
    <div className="table-component__selection-summary" aria-live="polite">
      <Check size={14} />
      <strong>{selectedKeys.length} selected</strong>
    </div>
  ) : null

  const searchControl = showSearch && !isSelectionActive ? (
    <SearchBar
      value={searchTerm}
      onChange={setSearchTerm}
      placeholder={searchPlaceholder}
      showInlineError={false}
    />
  ) : null

  const columnControls = canShowColumnControls ? (
    <div className="table-component__columns-menu" ref={columnMenuRef}>
      <button
        type="button"
        className={`button button-secondary table-component__columns-trigger ${isColumnMenuOpen ? 'is-open' : ''}`.trim()}
        aria-haspopup="menu"
        aria-expanded={isColumnMenuOpen}
        onClick={() => setIsColumnMenuOpen((currentValue) => !currentValue)}
      >
        <SlidersHorizontal size={15} />
        Columns
      </button>

      {isColumnMenuOpen ? (
        <div className="table-component__columns-popover" role="menu">
          <div className="table-component__columns-header">
            <strong>Visible columns</strong>
            <button type="button" onClick={handleResetColumns}>
              Reset
            </button>
          </div>
          <div className="table-component__columns-options">
            {columns.map((column, index) => {
              const columnKey = getColumnKey(column, index)
              const isLocked = effectiveLockedColumnKeys.includes(columnKey)
              const isChecked = visibleColumnKeys.includes(columnKey)
              const wouldBreakMinimum = isChecked && visibleColumnKeys.length <= minimumVisibleColumnCount

              if (typeof column.label !== 'string') {
                return null
              }

              return (
                <label key={columnKey} className="table-component__columns-option">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    disabled={isLocked || wouldBreakMinimum}
                    onChange={() => handleToggleColumn(columnKey)}
                  />
                  <span className="table-component__columns-check" aria-hidden="true">
                    {isChecked ? <Check size={12} strokeWidth={2.8} /> : null}
                  </span>
                  <span>{column.label}</span>
                </label>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  ) : null

  const hasLayeredToolbar = Boolean(primaryActionContent || datasetContent)
  const hasSplitToolbar = splitToolbar && !hasLayeredToolbar

  return (
    <div className="table-component">
      {title || toolbarContent || primaryActionContent || datasetContent || filterContent || showSearch || canShowColumnControls ? (
        <div className="table-component__header">
          {title || (showSubtitle && subtitle) ? (
            <div className="table-component__title-block">
              {title ? <h2 className="section-title">{title}</h2> : null}
              {showSubtitle && subtitle ? <p className="helper-text">{subtitle}</p> : null}
            </div>
          ) : null}

          <TableToolbar className={`table-component__toolbar ${hasLayeredToolbar ? 'table-component__toolbar--layered' : ''} ${hasSplitToolbar ? 'table-component__toolbar--split' : ''}`.trim()}>
            {hasLayeredToolbar ? (
              <>
                <div className="table-component__toolbar-row table-component__toolbar-row--primary">
                  <div className="table-component__toolbar-primary">
                    {selectionSummary}
                    {searchControl}
                  </div>
                  {primaryActionContent ? (
                    <div className="table-component__primary-actions">
                      {primaryActionContent}
                    </div>
                  ) : null}
                </div>
                {filterContent ? (
                  <div className="table-component__toolbar-row table-component__toolbar-row--filters">
                    {filterContent}
                  </div>
                ) : null}
                <div className="table-component__toolbar-row table-component__toolbar-row--dataset">
                  <div className="table-component__dataset-controls">
                    {datasetContent}
                  </div>
                  <div className="table-component__utility-actions">
                    {columnControls}
                    {toolbarContent}
                  </div>
                </div>
              </>
            ) : hasSplitToolbar ? (
              <>
                <div className="table-component__toolbar-left">
                  {selectionSummary}
                  {searchControl}
                  {filterContent}
                </div>
                <div className="table-component__toolbar-right">
                  {columnControls}
                  {toolbarContent}
                </div>
              </>
            ) : (
              <>
                {selectionSummary}
                {searchControl}
                {filterContent}
                {columnControls}
                {toolbarContent}
              </>
            )}
          </TableToolbar>
        </div>
      ) : null}

      {loading ? (
        <div className="table-component__loading" role="status" aria-live="polite">
          <div className="table-component__loading-title">
            <LoaderCircle size={18} className="animate-spin" />
            <span>Loading records...</span>
          </div>
          <div className="table-component__skeleton" aria-hidden="true">
            {Array.from({ length: 5 }).map((_, index) => (
              <span key={index} />
            ))}
          </div>
        </div>
      ) : paginatedRows.length === 0 ? (
        (() => {
          if (searchTerm.trim()) {
            const validation = validateSearchQuery(searchTerm)
            const isInvalidSearch = validation.isInvalid

            if (isInvalidSearch) {
              const defaultExamples = columns
                .filter((col) => col.searchable !== false)
                .map(getColumnLabel)
                .filter((label) => label && label.toLowerCase() !== 'actions' && label.toLowerCase() !== 'action')
                .map((label) => label.toLowerCase())
                .filter((v, i, a) => a.indexOf(v) === i)

              const messageText =
                resolvedInvalidSearchMessage ||
                invalidSearchMessage ||
                (defaultExamples.length > 0
                  ? `Please enter a valid search term (e.g., ${defaultExamples.slice(0, 4).join(', ')}).`
                  : 'Please enter a valid search term.')

              return (
                <StateBlock
                  type="warning"
                  title="Invalid search term"
                  message={messageText}
                  compact
                  className="table-component__empty table-component__empty--invalid"
                />
              )
            }

            return (
              <StateBlock
                type="empty"
                title="No matching records found"
                message={`No records found matching "${searchTerm.trim()}". Try searching with a different keyword or clear the search.`}
                compact
                className="table-component__empty"
              />
            )
          }

          return (
            <StateBlock
              type="empty"
              title={emptyMessage}
              message="No records available at this time."
              compact
              className="table-component__empty"
            />
          )
        })()
      ) : (
        <>
          <div className="table-container" ref={tableContainerRef} onScroll={handleTableScroll}>
            <table className="table table-component__table" style={tableStyle}>
              {explicitTableWidth > 0 ? (
                <colgroup>
                  {shouldShowSelection ? <col style={{ width: '44px' }} /> : null}
                  {displayColumns.map((column, index) => {
                    const width = columnWidths[index]

                    return (
                      <col
                        key={column.key || column.label || index}
                        style={width ? { width } : undefined}
                      />
                    )
                  })}
                </colgroup>
              ) : null}
              <thead>
                <tr>
                  {shouldShowSelection ? (
                    <th scope="col" className="table-component__selection-cell">
                      <input
                        ref={selectAllCheckboxRef}
                        type="checkbox"
                        checked={isPageSelected}
                        onChange={handleTogglePageSelection}
                        aria-label="Select all rows on this page"
                      />
                    </th>
                  ) : null}
                  {displayColumns.map((column) => (
                    <th
                      key={column.key || column.label}
                      scope="col"
                      data-column={column.key || column.label}
                      className={`${column.headerClassName || column.className || ''} ${column.sortable ? 'is-sortable' : ''}`.trim()}
                      style={{
                        ...(column.headerStyle || column.style),
                        cursor: column.sortable ? 'pointer' : undefined,
                        userSelect: column.sortable ? 'none' : undefined,
                      }}
                      onClick={column.sortable ? () => handleSort(column) : undefined}
                    >
                      {column.sortable ? (
                        <button
                          type="button"
                          className={`table-component__sort-button ${sortConfig.key && (sortConfig.key === column.key || sortConfig.key === column.label) ? 'is-active' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleSort(column)
                          }}
                          aria-label={`Sort by ${column.label || column.key}`}
                        >
                          <span>{column.label || column.key}</span>
                          <span className="table-component__sort-indicator" aria-hidden="true">
                            {sortConfig.key && (sortConfig.key === column.key || sortConfig.key === column.label) ? (
                              sortConfig.direction === 'desc' ? (
                                <ArrowDown size={14} />
                              ) : (
                                <ArrowUp size={14} />
                              )
                            ) : (
                              <ArrowUpDown size={14} />
                            )}
                          </span>
                        </button>
                      ) : (
                        column.label
                      )}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {paginatedRows.map((row, index) => {
                  const rowKey = getRowKey(row, keyField, index)

                  return (
                  <tr
                    key={rowKey}
                    data-row-key={rowKey}
                    data-row-index={index}
                    className={`${
                      typeof rowClassName === 'function' ? rowClassName(row) : ''
                    } ${onRowClick ? 'is-clickable' : ''} ${
                      shouldShowSelection && selectedKeySet.has(String(rowKey)) ? 'is-selected' : ''
                    }`.trim()}
                    onClick={onRowClick ? (event) => handleRowClick(row, event) : undefined}
                    onKeyDown={onRowClick ? (event) => handleRowKeyDown(row, event) : undefined}
                    role={onRowClick ? 'button' : undefined}
                    tabIndex={onRowClick ? 0 : undefined}
                    aria-label={onRowClick ? `Open ${renderPlainText(renderCellContent(getMobilePrimaryColumn(displayColumns), row)) || 'record'}` : undefined}
                    aria-selected={shouldShowSelection && selectedKeySet.has(String(rowKey)) ? 'true' : undefined}
                  >
                    {shouldShowSelection ? (
                      <td className="table-component__selection-cell" data-column="selection" data-label="Select">
                        <input
                          type="checkbox"
                          checked={selectedKeySet.has(String(rowKey))}
                          onClick={(event) => event.stopPropagation()}
                          onChange={() => handleToggleRowSelection(rowKey)}
                          aria-label={`Select ${renderPlainText(renderCellContent(getMobilePrimaryColumn(displayColumns), row)) || 'row'}`}
                        />
                      </td>
                    ) : null}
                    {displayColumns.map((column) => {
                      const sNo = (currentPage - 1) * pageSize + index + 1
                      return (
                        <td
                          key={column.key || column.label}
                          data-label={getColumnLabel(column)}
                          data-column={column.key || getColumnLabel(column)}
                          className={column.className || ''}
                          style={column.style}
                        >
                          {typeof column.render === 'function'
                            ? column.render(row, index, sNo)
                            : row[column.key]}
                        </td>
                      )
                    })}
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
          {showHorizontalScrollbar ? (
            <div
              className="table-component__horizontal-scrollbar"
              ref={horizontalScrollbarRef}
              onScroll={handleHorizontalScrollbarScroll}
              role="scrollbar"
              aria-label="Scroll table columns horizontally"
              aria-orientation="horizontal"
            >
              <div style={{ width: `${Math.max(explicitTableWidth, 1)}px` }} />
            </div>
          ) : null}
          <TruncatedCellTooltip containerRef={tableContainerRef} />

          <div className="table-component__mobile-list" aria-label={`${title || 'Records'} mobile list`}>
            {paginatedRows.map((row, index) => {
              const rowKey = getRowKey(row, keyField, index)
              const primaryContent = mobilePrimaryColumn
                ? renderCellContent(mobilePrimaryColumn, row)
                : rowKey
              const visibleDetails = mobileDetailColumns.slice(0, 4)
              const overflowDetails = mobileDetailColumns.slice(4)
              const primaryLabel = getColumnLabel(mobilePrimaryColumn || {})
              const statusContent = mobileStatusColumns.length > 0 ? (
                <>
                  {mobileStatusColumns.slice(0, 2).map((column) => (
                    <span key={column.key || column.label}>
                      {renderCellContent(column, row)}
                    </span>
                  ))}
                </>
              ) : null
              const descriptionColumn = mobileDetailColumns.find((column) => column.mobileDescription)
              const detailColumns = visibleDetails.filter((column) => column !== descriptionColumn)
              const mobileCard = renderMobileCard?.({
                row,
                rowKey,
                rowClassName: typeof rowClassName === 'function' ? rowClassName(row) : '',
                primaryContent,
                primaryLabel,
                statusContent,
                description: descriptionColumn ? renderCellContent(descriptionColumn, row) : null,
                metadata: detailColumns.map((column) => ({
                  key: column.key || column.label,
                  label: getColumnLabel(column),
                  value: renderCellContent(column, row),
                })),
                actions: mobileActionColumn ? renderCellContent(mobileActionColumn, row) : null,
              })

              if (mobileCard) {
                return <Fragment key={rowKey}>{mobileCard}</Fragment>
              }

              return (
                <MobileEntityCard
                  key={rowKey}
                  className={`table-component__mobile-card ${
                    typeof rowClassName === 'function' ? rowClassName(row) : ''
                  } ${onRowClick ? 'is-clickable' : ''}`.trim()}
                  onClick={onRowClick ? (event) => handleRowClick(row, event) : undefined}
                  onKeyDown={onRowClick ? (event) => handleRowKeyDown(row, event) : undefined}
                  eyebrow={primaryLabel}
                  title={renderPlainText(primaryContent)}
                  status={statusContent}
                  description={descriptionColumn ? renderCellContent(descriptionColumn, row) : null}
                  metadata={detailColumns.map((column) => ({
                    key: column.key || column.label,
                    label: getColumnLabel(column),
                    value: renderCellContent(column, row),
                  }))}
                  actions={mobileActionColumn ? renderCellContent(mobileActionColumn, row) : null}
                >
                  {overflowDetails.length > 0 ? (
                    <details className="table-component__mobile-more">
                      <summary>More details</summary>
                      <dl className="table-component__mobile-meta">
                        {overflowDetails.map((column) => (
                          <div key={column.key || column.label}>
                            <dt>{getColumnLabel(column)}</dt>
                            <dd>{renderCellContent(column, row)}</dd>
                          </div>
                        ))}
                      </dl>
                    </details>
                  ) : null}
                </MobileEntityCard>
              )
            })}
          </div>

          <Pagination className="table-component__pagination">
            <div className="table-component__pagination-metrics">
              <label className="table-component__rows-control">
                <span>Rows</span>
                <select
                  value={pageSize}
                  onChange={(event) => setPageSize(Number(event.target.value))}
                >
                  {[8, 10, 15, 20, 25].map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>
              <span className="table-component__status">
                Showing {(currentPage - 1) * pageSize + 1}-
                {Math.min(currentPage * pageSize, sortedRows.length)} of {sortedRows.length}
              </span>
            </div>

            <div className="table-component__page-controls">
              <button
                type="button"
                className="button button-secondary"
                onClick={() => setPage(1)}
                disabled={currentPage === 1}
                aria-label="Go to first page"
              >
                <ChevronsLeft size={16} />
                First
              </button>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => setPage((currentValue) => Math.max(currentValue - 1, 1))}
                disabled={currentPage === 1}
                aria-label="Go to previous page"
              >
                <ChevronLeft size={16} />
                Previous
              </button>
              {visiblePages.map((pageNumber) => (
                <button
                  key={pageNumber}
                  type="button"
                  className={`table-component__page-number ${pageNumber === currentPage ? 'is-active' : ''}`.trim()}
                  onClick={() => setPage(pageNumber)}
                  aria-current={pageNumber === currentPage ? 'page' : undefined}
                  aria-label={`Go to page ${pageNumber}`}
                >
                  {pageNumber}
                </button>
              ))}
              <button
                type="button"
                className="button button-secondary"
                onClick={() =>
                  setPage((currentValue) =>
                    Math.min(currentValue + 1, totalPages),
                  )
                }
                disabled={currentPage === totalPages}
                aria-label="Go to next page"
              >
                Next
                <ChevronRight size={16} />
              </button>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => setPage(totalPages)}
                disabled={currentPage === totalPages}
                aria-label="Go to last page"
              >
                Last
                <ChevronsRight size={16} />
              </button>
            </div>
          </Pagination>
        </>
      )}

      {footerContent}
    </div>
  )
}
