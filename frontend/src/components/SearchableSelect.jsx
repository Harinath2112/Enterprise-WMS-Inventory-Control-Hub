import { Check, ChevronDown, Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { getSelectedOption, normalizeSelectOptions } from './searchableSelectUtils'
import { renderFormLabel } from '../utils/labelUtils'
import { validateSearchQuery } from '../utils/searchValidationUtils'
import './SearchableSelect.css'

const SELECT_PORTAL_Z_INDEX = 2147483647
const SELECT_MENU_MAX_HEIGHT = 450

export default function SearchableSelect(props) {
  const {
    id,
    name,
    label,
    icon: Icon,
    value,
    onChange,
    onBlur,
    options,
    placeholder = 'Select option',
    error,
    showError,
    searchPlaceholder = 'Search options',
    hideLabel = false,
    disabled = false,
    className = '',
    menuClassName = '',
    showSearch = true,
    showPlaceholder = true,
    menuPlacement = 'auto',
  } = props

  const rootRef = useRef(null)
  const menuRef = useRef(null)
  const searchRef = useRef(null)
  const instanceIdRef = useRef(`select-${Math.random().toString(36).substring(2, 9)}`)
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [menuStyle, setMenuStyle] = useState(null)
  const [portalElement, setPortalElement] = useState(null)

  useEffect(() => {
    function handleGlobalDropdownOpened(event) {
      if (event.detail?.id !== instanceIdRef.current) {
        setIsOpen(false)
        setSearchTerm('')
      }
    }

    window.addEventListener('ims:dropdown-opened', handleGlobalDropdownOpened)
    return () => window.removeEventListener('ims:dropdown-opened', handleGlobalDropdownOpened)
  }, [])

  const normalizedOptions = useMemo(
    () => normalizeSelectOptions(options),
    [options],
  )
  const selectedValue = typeof value === 'object' && value !== null
    ? value.value ?? value.label ?? value.name ?? value.Name ?? ''
    : value
  const selectedOption = getSelectedOption(normalizedOptions, value)
  const filteredOptions = normalizedOptions.filter((option) =>
    String(option.label ?? '').toLowerCase().includes(searchTerm.trim().toLowerCase()),
  )
  const pinnedSelectedOption = selectedOption && !searchTerm.trim()
    ? [selectedOption]
    : []
  const filteredWithoutPinned = filteredOptions.filter((option) =>
    !selectedOption || String(option.value) !== String(selectedOption.value),
  )
  const displayedOptions = [
    ...(showPlaceholder ? [{ value: '', label: placeholder, isPlaceholder: true }] : []),
    ...pinnedSelectedOption.map((option) => ({ ...option, isPinned: true })),
    ...filteredWithoutPinned,
  ]
  const hasNoMatches = filteredOptions.length === 0 && Boolean(searchTerm.trim())
  const menuOptions = hasNoMatches ? [] : displayedOptions

  const updateMenuPosition = useCallback(() => {
    const trigger = rootRef.current?.querySelector('.searchable-select__trigger')

    if (!trigger || typeof window === 'undefined') {
      return
    }

    const rect = trigger.getBoundingClientRect()
    const viewportWidth = window.visualViewport?.width ?? window.innerWidth
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight
    const gutter = 12
    const preferredHeight = SELECT_MENU_MAX_HEIGHT
    const spaceBelow = viewportHeight - rect.bottom - gutter
    const spaceAbove = rect.top - gutter
    const openAbove = menuPlacement === 'top' ||
      (menuPlacement === 'auto' && spaceBelow < 120 && spaceAbove > spaceBelow)
    const availableSpace = Math.max(96, openAbove ? spaceAbove - 4 : spaceBelow - 4)
    const maxHeight = Math.min(preferredHeight, availableSpace)
    const width = Math.min(rect.width, viewportWidth - gutter * 2)
    const left = Math.min(Math.max(gutter, rect.left), viewportWidth - width - gutter)

    setMenuStyle({
      position: 'fixed',
      left,
      top: openAbove ? undefined : rect.bottom + 5,
      bottom: openAbove ? viewportHeight - rect.top + 5 : undefined,
      width,
      maxHeight,
      '--searchable-select-options-max-height': `${Math.max(72, maxHeight - 54)}px`,
      zIndex: SELECT_PORTAL_Z_INDEX,
    })
  }, [menuPlacement])

  useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined
    }

    const element = document.createElement('div')
    element.className = 'searchable-select-portal-root'
    document.body.appendChild(element)
    setPortalElement(element)

    return () => {
      setPortalElement(null)
      element.remove()
    }
  }, [])

  useEffect(() => {
    if (!isOpen) {
      return undefined
    }

    const handlePointerDown = (event) => {
      if (rootRef.current?.contains(event.target) || menuRef.current?.contains(event.target)) {
        return
      }

      setIsOpen(false)
      setSearchTerm('')
      onBlur?.({ target: { name, value } })
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('pointerdown', handlePointerDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [isOpen, name, onBlur, value])

  useEffect(() => {
    if (isOpen) {
      updateMenuPosition()
      searchRef.current?.focus()
    }
  }, [isOpen, updateMenuPosition])

  useEffect(() => {
    if (!isOpen) {
      return undefined
    }

    const handleReposition = () => updateMenuPosition()
    window.addEventListener('resize', handleReposition)
    window.addEventListener('scroll', handleReposition, true)
    window.visualViewport?.addEventListener('resize', handleReposition)
    window.visualViewport?.addEventListener('scroll', handleReposition)

    return () => {
      window.removeEventListener('resize', handleReposition)
      window.removeEventListener('scroll', handleReposition, true)
      window.visualViewport?.removeEventListener('resize', handleReposition)
      window.visualViewport?.removeEventListener('scroll', handleReposition)
    }
  }, [isOpen, updateMenuPosition])

  useEffect(() => {
    setActiveIndex(0)
  }, [isOpen, searchTerm])

  function closeMenu(nextValue = value) {
    setIsOpen(false)
    setSearchTerm('')
    onBlur?.({ target: { name, value: nextValue } })
  }

  function handleTriggerPointerDown(event) {
    if (disabled) {
      return
    }

    event.preventDefault()
    updateMenuPosition()

    if (isOpen) {
      closeMenu()
      return
    }

    window.dispatchEvent(new CustomEvent('ims:dropdown-opened', { detail: { id: instanceIdRef.current } }))
    setIsOpen(true)
  }

  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      closeMenu()
      return
    }

    if ((event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') && !isOpen) {
      event.preventDefault()
      updateMenuPosition()
      setIsOpen(true)
    }
  }

  function handleSearchKeyDown(event) {
    if (event.key === 'Escape') {
      closeMenu()
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (menuOptions.length === 0) return
      setActiveIndex((currentValue) => (currentValue + 1) % menuOptions.length)
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (menuOptions.length === 0) return
      setActiveIndex((currentValue) => (currentValue - 1 + menuOptions.length) % menuOptions.length)
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      if (menuOptions.length === 0) return
      handleSelect(menuOptions[activeIndex]?.value ?? '')
    }
  }

  function handleSelect(nextValue) {
    if (disabled) {
      return
    }

    onChange({ target: { name, value: nextValue } })
    closeMenu(nextValue)
  }

  function renderOptionLabel(label) {
    const text = String(label ?? '')
    const query = searchTerm.trim()

    if (!query) {
      return text
    }

    const index = text.toLowerCase().indexOf(query.toLowerCase())
    if (index < 0) {
      return text
    }

    return (
      <>
        {text.slice(0, index)}
        <mark>{text.slice(index, index + query.length)}</mark>
        {text.slice(index + query.length)}
      </>
    )
  }

  const menu = isOpen ? (
    <div
      className={`searchable-select__menu searchable-select__menu--floating searchable-select__menu--portal ${menuClassName}`.trim()}
      ref={menuRef}
      style={menuStyle ?? undefined}
    >
      {showSearch ? (
        <div className={`searchable-select__search ${validateSearchQuery(searchTerm, !hasNoMatches).isInvalid ? 'searchable-select__search--invalid' : ''}`.trim()}>
          <Search size={16} />
          <input
            ref={searchRef}
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder={searchPlaceholder}
            autoComplete="off"
          />
        </div>
      ) : null}

      <div className="searchable-select__options" role="listbox">
        {hasNoMatches ? (
          <div className="searchable-select__empty searchable-select__empty--invalid">
            Please enter a valid search term.
          </div>
        ) : (
          menuOptions.map((option, index) => (
            <div
              key={option.isPlaceholder ? '__placeholder__' : option.value || `${option.label}-${index}`}
              className={`searchable-select__option ${
                option.isPlaceholder
                  ? !selectedOption ? 'is-selected' : ''
                  : String(option.value) === String(selectedValue) ? 'is-selected' : ''
              } ${index === activeIndex ? 'is-active' : ''} ${
                option.isPlaceholder ? 'is-placeholder-option' : ''
              }`}
              onClick={() => handleSelect(option.value)}
              onMouseEnter={() => setActiveIndex(index)}
              role="option"
              aria-selected={option.isPlaceholder ? !selectedOption : String(option.value) === String(selectedValue)}
              style={{ cursor: 'pointer' }}
              title={option.label}
            >
              <span title={option.label}>{renderOptionLabel(option.label)}</span>
              {String(option.value) === String(selectedValue) && !option.isPlaceholder ? <Check size={14} /> : null}
            </div>
          ))
        )}
      </div>
    </div>
  ) : null

  return (
    <div
      className={`${hideLabel ? 'searchable-select' : 'field searchable-select'} ${showError && error ? 'field--error' : ''} ${className}`.trim()}
      ref={rootRef}
    >
      {hideLabel ? null : <label htmlFor={id}>{renderFormLabel(label)}</label>}

      <button
        id={id}
        type="button"
        className={`searchable-select__trigger ${isOpen ? 'is-open' : ''}`}
        onPointerDown={handleTriggerPointerDown}
        onClick={(event) => event.preventDefault()}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        aria-disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-invalid={Boolean(showError && error)}
        title={selectedOption?.label ?? placeholder}
      >
        <span className="searchable-select__value" title={selectedOption?.label ?? placeholder}>
          {Icon ? <Icon size={16} /> : null}
          <span className={selectedOption ? '' : 'searchable-select__placeholder'} title={selectedOption?.label ?? placeholder}>
            {selectedOption?.label ?? placeholder}
          </span>
        </span>
        <ChevronDown size={16} />
      </button>

      {menu && portalElement ? createPortal(menu, portalElement) : null}

      {showError && error ? <span className="field-error">{error}</span> : null}
    </div>
  )
}
