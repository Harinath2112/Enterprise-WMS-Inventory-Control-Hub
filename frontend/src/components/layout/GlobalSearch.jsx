import {
  Activity,
  Building2,
  CreditCard,
  FileText,
  Folder,
  LayoutDashboard,
  Layers,
  LoaderCircle,
  Package,
  ReceiptText,
  Search,
  ShieldCheck,
  Tag,
  User,
  Warehouse,
} from 'lucide-react'
import { Fragment, memo, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { getGlobalSearchCounts, searchGlobal } from '../../api/searchApi'
import { validateSearchQuery } from '../../utils/searchValidationUtils'

const MIN_QUERY_LENGTH = 2
const DEBOUNCE_MS = 300
const MAX_CACHE_ENTRIES = 20
const MAX_RECENT_SEARCHES = 5
const RECENT_SEARCHES_KEY = 'ims.globalSearch.recent'

const TYPE_LABELS = {
  Product: 'Products',
  Category: 'Categories',
  SubCategory: 'Sub Categories',
  Brand: 'Brands',
  Customer: 'Customers',
  Supplier: 'Suppliers',
  PurchaseOrder: 'Purchase Orders',
  Invoice: 'Invoices',
  InvoiceItem: 'Invoice Items',
  PurchaseOrderItem: 'Purchase Order Items',
  GoodsReceipt: 'Goods Receipts',
  GoodsReceiptItem: 'Goods Receipt Items',
  StockTransaction: 'Stock Transactions',
  Warehouse: 'Warehouses',
  SupplierPayment: 'Supplier Payments',
  CustomerPayment: 'Customer Payments',
  User: 'Users',
  Role: 'Roles',
}

const TYPE_BADGES = {
  Product: 'Product',
  Category: 'Category',
  SubCategory: 'Sub Category',
  Brand: 'Brand',
  Customer: 'Customer',
  Supplier: 'Supplier',
  PurchaseOrder: 'Purchase Order',
  Invoice: 'Invoice',
  InvoiceItem: 'Invoice Item',
  PurchaseOrderItem: 'Purchase Order Item',
  GoodsReceipt: 'Goods Receipt',
  GoodsReceiptItem: 'Goods Receipt Item',
  StockTransaction: 'Stock Transaction',
  Warehouse: 'Warehouse',
  SupplierPayment: 'Supplier Payment',
  CustomerPayment: 'Customer Payment',
  User: 'User',
  Role: 'Role',
}

const TYPE_ORDER = [
  'Customer',
  'Supplier',
  'Product',
  'Invoice',
  'PurchaseOrder',
  'Brand',
  'Category',
  'SubCategory',
  'InvoiceItem',
  'PurchaseOrderItem',
  'GoodsReceipt',
  'GoodsReceiptItem',
  'StockTransaction',
  'Warehouse',
  'SupplierPayment',
  'CustomerPayment',
  'User',
  'Role',
]

const TYPE_ROUTES = {
  Product: '/inventory/products',
  Category: '/inventory/categories',
  SubCategory: '/inventory/subcategories',
  Brand: '/inventory/brands',
  Customer: '/people/customers',
  Supplier: '/people/suppliers',
  PurchaseOrder: '/inventory/purchases',
  Invoice: '/management/accounting',
  InvoiceItem: '/management/accounting',
  PurchaseOrderItem: '/inventory/purchases',
  GoodsReceipt: '/inventory/goods-receipts',
  GoodsReceiptItem: '/inventory/goods-receipts',
  StockTransaction: '/inventory/stock',
  Warehouse: '/management/warehouses',
  SupplierPayment: '/people/supplier-payments',
  CustomerPayment: '/people/customer-payments',
  User: '/administration/users',
  Role: '/administration/roles',
}

const QUICK_ACCESS = [
  { type: 'Product', label: 'Products', route: '/inventory/products', icon: 'package' },
  { type: 'Customer', label: 'Customers', route: '/people/customers', icon: 'user' },
  { type: 'Supplier', label: 'Suppliers', route: '/people/suppliers', icon: 'building' },
  { type: 'Brand', label: 'Brands', route: '/inventory/brands', icon: 'tag' },
  { type: 'Category', label: 'Categories', route: '/inventory/categories', icon: 'folder' },
  { type: 'SubCategory', label: 'Sub Categories', route: '/inventory/subcategories', icon: 'layers' },
  { type: 'Dashboard', label: 'Dashboard', route: '/dashboard', icon: 'dashboard' },
]

const ICONS = {
  package: Package,
  folder: Folder,
  layers: Layers,
  tag: Tag,
  user: User,
  building: Building2,
  truck: Building2,
  file: FileText,
  receipt: ReceiptText,
  dashboard: LayoutDashboard,
  activity: Activity,
  warehouse: Warehouse,
  payment: CreditCard,
  shield: ShieldCheck,
}

function readValue(source, ...keys) {
  return keys.reduce((value, key) => (
    value === undefined ? source?.[key] : value
  ), undefined)
}

function normalizeResult(result) {
  const type = readValue(result, 'type', 'Type') || 'Result'
  const id = readValue(result, 'id', 'Id')
  const title = readValue(result, 'title', 'Title') || 'Untitled result'
  const subtitle = readValue(result, 'subtitle', 'Subtitle') || ''
  const route = readValue(result, 'route', 'Route') || ''
  const icon = readValue(result, 'icon', 'Icon') || ''

  return {
    type,
    id,
    title,
    subtitle,
    route,
    icon,
    key: `${type}-${id}-${route}-${title}`,
  }
}

function getSubtitleLabel(result) {
  if (!result.subtitle) {
    return ''
  }

  return result.subtitle
}

function getEntityLabel(type) {
  return TYPE_BADGES[type] || type || 'Result'
}

function normalizeForSearch(value) {
  return String(value || '').trim().toLowerCase()
}

function isPhoneLike(value) {
  return /^[+\d\s()-]{4,}$/.test(String(value || '').trim())
}

function rankResult(result, query) {
  const needle = normalizeForSearch(query)
  const title = normalizeForSearch(result.title)
  const subtitle = normalizeForSearch(result.subtitle)

  if (!needle) return 99
  if (title === needle) return 1
  if (title.startsWith(needle)) return 2
  if (title.includes(needle)) return 3
  if (isPhoneLike(result.subtitle) && subtitle.includes(needle)) return 4
  if (subtitle.includes('@') && subtitle.includes(needle)) return 5
  if (result.type === 'Product' && subtitle.includes(needle)) return 6
  if (subtitle.includes(needle)) return 7

  return 20
}

function sortResultsByRank(results, query) {
  return [...results].sort((first, second) => {
    const rankDelta = rankResult(first, query) - rankResult(second, query)
    if (rankDelta !== 0) return rankDelta

    const typeDelta =
      (TYPE_ORDER.indexOf(first.type) === -1 ? 99 : TYPE_ORDER.indexOf(first.type)) -
      (TYPE_ORDER.indexOf(second.type) === -1 ? 99 : TYPE_ORDER.indexOf(second.type))
    if (typeDelta !== 0) return typeDelta

    return String(first.title).localeCompare(String(second.title))
  })
}

function groupResults(results, query) {
  const groups = new Map()

  sortResultsByRank(results, query).forEach((result) => {
    const group = groups.get(result.type) || []
    group.push(result)
    groups.set(result.type, group)
  })

  return [...groups.entries()]
    .sort(([firstType], [secondType]) => {
      const firstIndex = TYPE_ORDER.indexOf(firstType)
      const secondIndex = TYPE_ORDER.indexOf(secondType)
      return (firstIndex === -1 ? 99 : firstIndex) - (secondIndex === -1 ? 99 : secondIndex)
    })
    .map(([type, items]) => ({
      type,
      label: TYPE_LABELS[type] || `${type}s`,
      icon: items[0]?.icon || 'search',
      route: TYPE_ROUTES[type],
      items,
    }))
}

function trimCache(cache) {
  while (cache.size > MAX_CACHE_ENTRIES) {
    const firstKey = cache.keys().next().value
    cache.delete(firstKey)
  }
}

function getStoredRecentSearches() {
  if (typeof window === 'undefined') return []

  try {
    const parsed = JSON.parse(window.localStorage.getItem(RECENT_SEARCHES_KEY) || '[]')
    return Array.isArray(parsed) ? parsed.map(normalizeResult).filter((item) => item.route).slice(0, MAX_RECENT_SEARCHES) : []
  } catch {
    return []
  }
}

function saveStoredRecentSearches(items) {
  if (typeof window === 'undefined') return

  window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(items.slice(0, MAX_RECENT_SEARCHES)))
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function HighlightedText({ text, query }) {
  const source = String(text || '')
  const needle = query.trim()

  if (!source || needle.length < MIN_QUERY_LENGTH) {
    return source
  }

  const pattern = new RegExp(`(${escapeRegExp(needle)})`, 'ig')
  const parts = source.split(pattern)

  return parts.map((part, index) => (
    part.toLowerCase() === needle.toLowerCase()
      ? <mark className="global-search__match" key={`${part}-${index}`}>{part}</mark>
      : <Fragment key={`${part}-${index}`}>{part}</Fragment>
  ))
}

function SearchInput({ inputRef, query, isOpen, isLoading, listboxId, activeOptionId, onChange, onFocus, onKeyDown }) {
  return (
    <form
      className="app-header__search global-search__control"
      role="search"
      onSubmit={(event) => event.preventDefault()}
    >
      <Search size={17} aria-hidden="true" />
      <input
        ref={inputRef}
        type="search"
        value={query}
        placeholder="Search products, customers, suppliers, or invoices"
        aria-label="Global search"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-activedescendant={activeOptionId}
        autoComplete="off"
        onChange={onChange}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
      />
      {isLoading ? (
        <LoaderCircle className="global-search__spinner" size={15} aria-hidden="true" />
      ) : (
        <kbd>Ctrl K</kbd>
      )}
    </form>
  )
}

const SearchResultItem = memo(function SearchResultItem({
  active,
  id,
  item,
  onActivate,
  onNavigate,
  optionRole = true,
  query,
  showTypeLabel = false,
}) {
  const Icon = ICONS[item.icon] || Search
  const subtitle = getSubtitleLabel(item)
  const entityLabel = getEntityLabel(item.type)

  return (
    <button
      type="button"
      id={id}
      className={`global-search__item ${active ? 'is-active' : ''}`}
      role={optionRole ? 'option' : undefined}
      aria-selected={optionRole ? active : undefined}
      onMouseEnter={onActivate}
      onClick={() => onNavigate(item)}
    >
      <span className="global-search__icon" aria-hidden="true">
        <Icon size={16} />
      </span>
      <span className="global-search__copy">
        {showTypeLabel ? <span className="global-search__entity-label">{TYPE_BADGES[item.type] || item.type}</span> : null}
        <strong><HighlightedText text={item.title} query={query} /></strong>
        <small>
          <span>{entityLabel}</span>
          {subtitle ? (
            <>
              <span aria-hidden="true"> • </span>
              <HighlightedText text={subtitle} query={query} />
            </>
          ) : null}
        </small>
      </span>
    </button>
  )
})

function SearchSkeletonRows() {
  return (
    <div className="global-search__skeleton-list" role="status" aria-live="polite">
      {[0, 1, 2, 3, 4].map((item) => (
        <div className="global-search__skeleton-row" key={item}>
          <span />
          <div>
            <strong />
            <small />
          </div>
        </div>
      ))}
    </div>
  )
}

function SearchSection({ group, getOptionId, startIndex, activeIndex, onActivate, onNavigate, query }) {
  const Icon = ICONS[group.icon] || Search
  const canViewAll = group.items.length >= 5 && group.route

  return (
    <section className="global-search__group">
      <h3>
        <span className="global-search__section-icon" aria-hidden="true"><Icon size={13} /></span>
        <span>{group.label}</span>
        <span className="global-search__count">({group.items.length})</span>
      </h3>
      {group.items.map((result, localIndex) => {
        const resultIndex = startIndex + localIndex

        return (
          <SearchResultItem
            active={resultIndex === activeIndex}
            id={getOptionId(resultIndex)}
            item={result}
            key={result.key}
            onActivate={() => onActivate(resultIndex)}
            onNavigate={onNavigate}
            query={query}
          />
        )
      })}
      {canViewAll ? (
        <button
          className="global-search__view-all"
          type="button"
          onClick={() => onNavigate({ route: group.route })}
        >
          View all {group.label.toLowerCase()} &rarr;
        </button>
      ) : null}
    </section>
  )
}

function RecentSearches({ items, onClear, onNavigate }) {
  return (
    <section className="global-search__group global-search__group--surface">
      <div className="global-search__section-header">
        <h3>Recent Searches</h3>
        {items.length > 0 ? (
          <button
            aria-label="Clear all recent searches"
            className="global-search__clear"
            type="button"
            onClick={onClear}
          >
            Clear All
          </button>
        ) : null}
      </div>
      {items.length > 0 ? (
        items.map((item) => (
          <SearchResultItem
            active={false}
            id={undefined}
            item={item}
            key={item.key}
            onActivate={() => {}}
            onNavigate={onNavigate}
            optionRole={false}
            query=""
            showTypeLabel
          />
        ))
      ) : (
        <p className="global-search__recent-empty">Opened results will appear here.</p>
      )}
    </section>
  )
}

function QuickAccess({ counts, onNavigate }) {
  return (
    <section className="global-search__group global-search__group--surface">
      <h3>Quick Access</h3>
      <div className="global-search__quick-grid">
        {QUICK_ACCESS.map((item) => {
          const Icon = ICONS[item.icon] || Search

          return (
            <button
              aria-label={`Open ${item.label}`}
              className="global-search__quick-link"
              key={item.route}
              type="button"
              onClick={() => onNavigate(item)}
            >
              <span className="global-search__icon" aria-hidden="true">
                <Icon size={15} />
              </span>
              <span>
                {item.label}
                {Number.isFinite(counts[item.type]) ? <span className="global-search__quick-count"> ({counts[item.type]})</span> : null}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

function SearchDropdown({
  activeIndex,
  error,
  getOptionId,
  groupedResults,
  isLoading,
  listboxId,
  onActivate,
  onClearRecentSearches,
  onNavigate,
  query,
  quickAccessCounts,
  recentSearches,
  showDiscovery,
}) {
  const flatResults = groupedResults.flatMap((group) => group.items)

  if (showDiscovery) {
    return (
      <div className="global-search__panel" role="dialog" aria-modal="true" aria-label="IMS command palette">
        <div className="global-search__results" id={listboxId}>
          <RecentSearches items={recentSearches} onClear={onClearRecentSearches} onNavigate={onNavigate} />
          <QuickAccess counts={quickAccessCounts} onNavigate={onNavigate} />
        </div>
        <SearchFooter />
      </div>
    )
  }

  return (
    <div className="global-search__panel" role="presentation">
      {isLoading ? (
        <SearchSkeletonRows />
      ) : error ? (
        <div className="global-search__state" role="status" aria-live="polite">
          <strong>Search unavailable</strong>
          <p>{error}</p>
        </div>
      ) : flatResults.length > 0 ? (
        <div className="global-search__results" id={listboxId} role="listbox" aria-label="Global search results">
          {groupedResults.map((group, groupIndex) => {
            const startIndex = groupedResults
              .slice(0, groupIndex)
              .reduce((count, currentGroup) => count + currentGroup.items.length, 0)

            return (
              <SearchSection
                activeIndex={activeIndex}
                getOptionId={getOptionId}
                group={group}
                key={group.type}
                onActivate={onActivate}
                onNavigate={onNavigate}
                query={query}
                startIndex={startIndex}
              />
            )
          })}
        </div>
      ) : validateSearchQuery(query).isInvalid ? (
        <div className="global-search__state global-search__state--invalid" role="status" aria-live="polite">
          <strong>Invalid search term</strong>
          <p>Please enter a valid search term (e.g., product, customer, supplier, invoice, or date).</p>
        </div>
      ) : (
        <div className="global-search__state global-search__state--empty" role="status" aria-live="polite">
          <strong>No results found for "{query}"</strong>
          <p>Try searching by:</p>
          <ul className="global-search__empty-list">
            <li>Product Name</li>
            <li>SKU</li>
            <li>Customer Name</li>
            <li>Supplier Name</li>
            <li>Invoice Number</li>
          </ul>
        </div>
      )}
      <SearchFooter />
    </div>
  )
}

function SearchFooter() {
  return null
}

export default function GlobalSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeIndex, setActiveIndex] = useState(-1)
  const [quickAccessCounts, setQuickAccessCounts] = useState({})
  const [recentSearches, setRecentSearches] = useState(() => getStoredRecentSearches())
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const rootRef = useRef(null)
  const portalRef = useRef(null)
  const cacheRef = useRef(new Map())
  const requestRef = useRef(null)
  const [isPortalReady, setIsPortalReady] = useState(false)
  const searchId = useId()
  const normalizedQuery = query.trim()
  const canSearch = normalizedQuery.length >= MIN_QUERY_LENGTH
  const showDiscovery = isOpen && !normalizedQuery
  const groupedResults = useMemo(() => groupResults(results, normalizedQuery), [normalizedQuery, results])
  const flatResults = useMemo(() => groupedResults.flatMap((group) => group.items), [groupedResults])
  const listboxId = `${searchId}-listbox`
  const getOptionId = useCallback((index) => `${searchId}-option-${index}`, [searchId])
  const activeOptionId = isOpen && activeIndex >= 0 ? getOptionId(activeIndex) : undefined
  const activeResult = activeIndex >= 0 ? flatResults[activeIndex] : null

  useEffect(() => {
    setIsPortalReady(true)
  }, [])

  useEffect(() => {
    let isMounted = true

    getGlobalSearchCounts()
      .then((counts) => {
        if (isMounted) {
          setQuickAccessCounts(counts)
        }
      })
      .catch(() => {
        if (isMounted) {
          setQuickAccessCounts({})
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    function handleShortcut(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        inputRef.current?.focus()
        setIsOpen(true)
      }
    }

    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [])

  useEffect(() => {
    function handlePointerDown(event) {
      if (rootRef.current?.contains(event.target) || portalRef.current?.contains(event.target)) {
        return
      }

      if (isOpen) {
        setIsOpen(false)
        setActiveIndex(-1)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [isOpen])

  useEffect(() => {
    if (!activeOptionId) return

    document.getElementById(activeOptionId)?.scrollIntoView({
      block: 'nearest',
    })
  }, [activeOptionId])

  useEffect(() => {
    if (!canSearch) {
      requestRef.current?.abort()
      setResults([])
      setIsLoading(false)
      setError('')
      setActiveIndex(-1)
      return undefined
    }

    const cacheKey = normalizedQuery.toLowerCase()
    const cachedResults = cacheRef.current.get(cacheKey)

    if (cachedResults) {
      setResults(cachedResults)
      setIsOpen(true)
      setActiveIndex(cachedResults.length > 0 ? 0 : -1)
      setIsLoading(false)
      setError('')
      return undefined
    }

    const controller = new AbortController()
    requestRef.current?.abort()
    requestRef.current = controller

    const debounceId = window.setTimeout(async () => {
      setIsLoading(true)
      setError('')
      setIsOpen(true)

      const response = await searchGlobal(normalizedQuery, { signal: controller.signal })

      if (controller.signal.aborted) {
        return
      }

      if (!response.success) {
        setResults([])
        setActiveIndex(-1)
        setError(response.error || 'Search is unavailable right now.')
        setIsLoading(false)
        return
      }

      const nextResults = response.data.map(normalizeResult).filter((item) => item.route)
      cacheRef.current.set(cacheKey, nextResults)
      trimCache(cacheRef.current)
      setResults(nextResults)
      setActiveIndex(nextResults.length > 0 ? 0 : -1)
      setIsLoading(false)
    }, DEBOUNCE_MS)

    return () => {
      window.clearTimeout(debounceId)
      controller.abort()
    }
  }, [canSearch, normalizedQuery])

  const rememberResult = useCallback((result) => {
    if (!result?.title || !result?.route) return

    setRecentSearches((current) => {
      const nextResult = normalizeResult(result)
      const next = [nextResult, ...current.filter((item) => item.route !== nextResult.route)].slice(0, MAX_RECENT_SEARCHES)
      saveStoredRecentSearches(next)
      return next
    })
  }, [])

  const navigateToResult = useCallback((result) => {
    if (!result?.route) {
      return
    }

    if (result.title) {
      rememberResult(result)
    }

    setIsOpen(false)
    setQuery('')
    setResults([])
    setActiveIndex(-1)
    navigate(result.route)
  }, [navigate, rememberResult])

  const clearRecentSearches = useCallback(() => {
    saveStoredRecentSearches([])
    setRecentSearches([])
  }, [])

  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault()
      setIsOpen(false)
      setActiveIndex(-1)
      return
    }

    if (!isOpen && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
      setIsOpen(true)
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (flatResults.length === 0) return
      setActiveIndex((current) => (current + 1) % flatResults.length)
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (flatResults.length === 0) return
      setActiveIndex((current) => (current <= 0 ? flatResults.length - 1 : current - 1))
      return
    }

    if (event.key === 'Enter' && activeResult) {
      event.preventDefault()
      navigateToResult(activeResult)
      return
    }

    if (event.key === 'Tab' && flatResults.length > 0) {
      event.preventDefault()
      const groupStartIndexes = groupedResults.reduce((indexes, group) => {
        const previousCount = indexes.count
        indexes.values.push(previousCount)
        indexes.count += group.items.length
        return indexes
      }, { values: [], count: 0 }).values
      const currentGroupIndex = groupStartIndexes.findIndex((startIndex, index) => {
        const nextStartIndex = groupStartIndexes[index + 1] ?? flatResults.length
        return activeIndex >= startIndex && activeIndex < nextStartIndex
      })
      const direction = event.shiftKey ? -1 : 1
      const nextGroupIndex = currentGroupIndex === -1
        ? 0
        : (currentGroupIndex + direction + groupStartIndexes.length) % groupStartIndexes.length
      setActiveIndex(groupStartIndexes[nextGroupIndex])
    }
  }

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus()
      }, 10)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  const overlay = isOpen ? (
    <div className="global-search__portal" ref={portalRef}>
      <div
        className="global-search__backdrop"
        aria-hidden="true"
        onMouseDown={() => {
          setIsOpen(false)
          setActiveIndex(-1)
        }}
      />
      <div className="global-search__modal" role="dialog" aria-modal="true" aria-label="IMS command palette search">
        <div className="global-search__modal-header">
          <SearchInput
            activeOptionId={activeOptionId}
            inputRef={inputRef}
            isLoading={isLoading}
            isOpen={isOpen}
            listboxId={listboxId}
            onChange={(event) => {
              setQuery(event.target.value)
              setIsOpen(true)
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            query={query}
          />
        </div>
        <SearchDropdown
          activeIndex={activeIndex}
          error={error}
          getOptionId={getOptionId}
          groupedResults={groupedResults}
          isLoading={isLoading}
          listboxId={listboxId}
          onActivate={setActiveIndex}
          onClearRecentSearches={clearRecentSearches}
          onNavigate={navigateToResult}
          quickAccessCounts={quickAccessCounts}
          query={normalizedQuery}
          recentSearches={recentSearches}
          showDiscovery={showDiscovery}
        />
      </div>
    </div>
  ) : null

  return (
    <div className={`global-search ${isOpen ? 'is-open' : ''}`} ref={rootRef}>
      <form
        className="app-header__search global-search__trigger"
        role="search"
        onClick={() => setIsOpen(true)}
        onSubmit={(event) => event.preventDefault()}
      >
        <Search size={17} aria-hidden="true" />
        <input
          type="text"
          value={query}
          placeholder="Search products, customers, suppliers, or invoices"
          aria-label="Global search trigger"
          readOnly
          onFocus={() => setIsOpen(true)}
        />
        <kbd>Ctrl K</kbd>
      </form>

      {isPortalReady && overlay ? createPortal(overlay, document.body) : null}
    </div>
  )
}
