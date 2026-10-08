import React, { useState, useRef, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Check, Search } from 'lucide-react'

export default function ReportsFilterSelect({
  name,
  value,
  onChange,
  options = [],
  disabled = false,
  className = '',
  dropdownClassName = '',
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [hoveredOption, setHoveredOption] = useState(null)
  const containerRef = useRef(null)

  const isWide = name === 'product' || dropdownClassName.includes('wide')

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  // Reset search term and clear hover tooltip when closed
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('')
      setHoveredOption(null)
    }
  }, [isOpen])

  const selectedOption = options.find((opt) => String(opt.value) === String(value)) || options[0]

  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return options
    const term = searchTerm.trim().toLowerCase()
    return options.filter((opt) => String(opt.label || '').toLowerCase().includes(term))
  }, [options, searchTerm])

  function handleSelect(optionValue) {
    onChange?.({
      target: {
        name,
        value: optionValue,
      },
    })
    setIsOpen(false)
    setHoveredOption(null)
  }

  function handleMouseEnter(event, opt) {
    if (!opt || !opt.label) return
    const btn = event.currentTarget
    const rect = btn.getBoundingClientRect()
    const x = Math.max(160, Math.min(window.innerWidth - 180, rect.left + rect.width / 2))
    const y = rect.top - 6
    setHoveredOption({
      text: opt.label,
      x,
      y,
    })
  }

  function handleMouseLeave() {
    setHoveredOption(null)
  }

  return (
    <div className={`reports-custom-select-wrapper ${className}`} ref={containerRef}>
      <button
        type="button"
        className={`reports-page__filter-select-trigger ${isOpen ? 'is-open' : ''}`}
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="reports-custom-select-label">{selectedOption ? selectedOption.label : ''}</span>
        <ChevronDown size={14} className="reports-custom-select-chevron" />
      </button>

      {isOpen ? (
        <div
          className={`reports-custom-select-dropdown ${isWide ? 'reports-custom-select-dropdown--wide' : ''} ${dropdownClassName}`.trim()}
          role="listbox"
        >
          {options.length > 6 ? (
            <div className="reports-custom-select-search-box" onClick={(e) => e.stopPropagation()}>
              <Search size={14} className="reports-custom-select-search-icon" />
              <input
                type="text"
                className="reports-custom-select-search-input"
                placeholder="Search options"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
              />
            </div>
          ) : null}

          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt) => {
              const isSelected = String(opt.value) === String(value)
              return (
                <button
                  key={opt.value}
                  type="button"
                  className={`reports-custom-select-option ${isSelected ? 'is-selected' : ''}`}
                  disabled={opt.disabled}
                  onClick={() => handleSelect(opt.value)}
                  onMouseEnter={(e) => handleMouseEnter(e, opt)}
                  onMouseLeave={handleMouseLeave}
                  role="option"
                  aria-selected={isSelected}
                >
                  <span>{opt.label}</span>
                  {isSelected ? <Check size={14} className="reports-custom-select-check" /> : null}
                </button>
              )
            })
          ) : (
            <div className="reports-custom-select-no-results">No matching options</div>
          )}
        </div>
      ) : null}

      {hoveredOption && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="reports-select-dark-tooltip"
              style={{
                left: `${hoveredOption.x}px`,
                top: `${hoveredOption.y}px`,
              }}
            >
              {hoveredOption.text}
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
