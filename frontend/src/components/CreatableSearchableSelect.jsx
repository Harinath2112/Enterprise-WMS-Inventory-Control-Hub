import { Check, ChevronDown, Plus, Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { getSelectedOption, normalizeSelectOptions } from './searchableSelectUtils'
import './SearchableSelect.css'
import { renderFormLabel } from '../utils/labelUtils'

function stripUnsafeSearchText(value) {
  return Array.from(value).filter((character) => {
    const code = character.charCodeAt(0)
    return !(
      character === '<' ||
      character === '>' ||
      code <= 31 ||
      (code >= 127 && code <= 159) ||
      (code >= 0x200B && code <= 0x200D) ||
      code === 0xFEFF
    )
  }).join('')
}

function cleanSearchValue(value) {
  return stripUnsafeSearchText(String(value ?? '').normalize('NFKC'))
    .replace(/\s+/g, ' ')
    .trim()
}

export default function CreatableSearchableSelect({
  id,
  name,
  label,
  value,
  onChange,
  onBlur,
  options,
  placeholder = 'Select option',
  searchPlaceholder = 'Search or create option',
  error,
  showError,
  disabled = false,
  className = '',
  createLabel = 'Create',
  onCreateOption,
  isValidOption = () => true,
}) {
  const rootRef = useRef(null)
  const searchRef = useRef(null)
  const instanceIdRef = useRef(`creatable-select-${Math.random().toString(36).substring(2, 9)}`)
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const normalizedOptions = useMemo(() => normalizeSelectOptions(options), [options])
  const selectedOption = getSelectedOption(normalizedOptions, value)
  const cleanTerm = cleanSearchValue(searchTerm)
  const filteredOptions = normalizedOptions.filter((option) =>
    option.label.toLowerCase().includes(cleanTerm.toLowerCase()),
  )
  const canCreate =
    Boolean(cleanTerm) &&
    isValidOption(cleanTerm) &&
    !normalizedOptions.some((option) => option.label.toLowerCase() === cleanTerm.toLowerCase())

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

  useEffect(() => {
    if (!isOpen) return undefined

    const handlePointerDown = (event) => {
      if (rootRef.current?.contains(event.target)) return
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
    if (isOpen) searchRef.current?.focus()
  }, [isOpen])

  function selectValue(nextValue, created = false) {
    if (disabled) return
    onChange({ target: { name, value: nextValue } })
    if (created) onCreateOption?.(nextValue)
    onBlur?.({ target: { name, value: nextValue } })
    setIsOpen(false)
    setSearchTerm('')
  }

  function handleToggleOpen() {
    if (disabled) return

    setIsOpen((currentValue) => {
      const nextState = !currentValue
      if (nextState) {
        window.dispatchEvent(new CustomEvent('ims:dropdown-opened', { detail: { id: instanceIdRef.current } }))
      }
      return nextState
    })
  }

  function handleTriggerKeyDown(event) {
    if (event.key === 'Escape') {
      setIsOpen(false)
      setSearchTerm('')
      onBlur?.({ target: { name, value } })
      return
    }

    if ((event.key === 'ArrowDown' || event.key === 'Enter') && !isOpen) {
      event.preventDefault()
      window.dispatchEvent(new CustomEvent('ims:dropdown-opened', { detail: { id: instanceIdRef.current } }))
      setIsOpen(true)
    }
  }

  function handleSearchKeyDown(event) {
    if (event.key === 'Escape') {
      setIsOpen(false)
      setSearchTerm('')
      onBlur?.({ target: { name, value } })
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()

      if (filteredOptions.length > 0) {
        selectValue(filteredOptions[0].value)
        return
      }

      if (canCreate) {
        selectValue(cleanTerm, true)
      }
    }
  }

  return (
    <div className={`field searchable-select ${showError && error ? 'field--error' : ''} ${className}`.trim()} ref={rootRef}>
      <label htmlFor={id}>{renderFormLabel(label)}</label>
      <button
        id={id}
        type="button"
        className={`searchable-select__trigger ${isOpen ? 'is-open' : ''}`}
        onClick={handleToggleOpen}
        onKeyDown={handleTriggerKeyDown}
        disabled={disabled}
        aria-disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-invalid={Boolean(showError && error)}
        title={selectedOption?.label || value || placeholder}
      >
        <span className="searchable-select__value" title={selectedOption?.label || value || placeholder}>
          <span className={selectedOption || value ? '' : 'searchable-select__placeholder'} title={selectedOption?.label || value || placeholder}>
            {selectedOption?.label || value || placeholder}
          </span>
        </span>
        <ChevronDown size={16} />
      </button>

      {isOpen ? (
        <div className="searchable-select__menu">
          <div className="searchable-select__search">
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

          <div className="searchable-select__options" role="listbox">
            <button
              type="button"
              className={`searchable-select__option ${!value ? 'is-selected' : ''}`}
              onClick={() => selectValue('')}
              role="option"
              aria-selected={!value}
            >
              <span>{placeholder}</span>
            </button>

            {filteredOptions.map((option, index) => (
              <button
                key={option.value || `${option.label}-${index}`}
                type="button"
                className={`searchable-select__option ${String(option.value) === String(value) ? 'is-selected' : ''}`}
                onClick={() => selectValue(option.value)}
                role="option"
                aria-selected={String(option.value) === String(value)}
              >
                <span>{option.label}</span>
                {String(option.value) === String(value) ? <Check size={14} /> : null}
              </button>
            ))}

            {filteredOptions.length === 0 && !canCreate ? (
              <div className="searchable-select__empty">No matching option found.</div>
            ) : null}

            {canCreate ? (
              <button
                type="button"
                className="searchable-select__option searchable-select__option--create"
                onClick={() => selectValue(cleanTerm, true)}
                role="option"
                aria-selected={false}
              >
                <span>{createLabel} "{cleanTerm}"</span>
                <Plus size={14} />
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {showError && error ? <span className="field-error">{error}</span> : null}
    </div>
  )
}
