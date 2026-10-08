import { useEffect, useState } from 'react'
import { Search, X } from 'lucide-react'
import { validateSearchQuery } from '../utils/searchValidationUtils'
import './SearchInput.css'

export default function SearchInput({
  value,
  onChange,
  placeholder = 'Search by name or keyword',
  debounce = 200,
  errorMessage,
  showInlineError = true,
}) {
  const [internalValue, setInternalValue] = useState(value ?? '')
  const validation = validateSearchQuery(internalValue)

  useEffect(() => {
    setInternalValue(value ?? '')
  }, [value])

  useEffect(() => {
    const timer = setTimeout(() => {
      onChange(internalValue)
    }, debounce)

    return () => clearTimeout(timer)
  }, [internalValue, onChange, debounce])

  function handleClear() {
    setInternalValue('')
    onChange('')
  }

  return (
    <div className="search-input-container">
      <div className={`search-wrapper ${validation.isInvalid ? 'search-wrapper--invalid' : ''}`.trim()}>
        <Search className="search-icon" size={16} />
        <input
          type="search"
          value={internalValue}
          onChange={(event) => setInternalValue(event.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          aria-invalid={validation.isInvalid}
          autoComplete="off"
        />
        {internalValue ? (
          <button
            type="button"
            className="search-clear-button"
            onClick={handleClear}
            aria-label="Clear search text"
          >
            <X size={14} />
          </button>
        ) : null}
      </div>
      {showInlineError && validation.isInvalid ? (
        <span className="search-input-error" role="alert">
          {errorMessage || validation.errorMessage}
        </span>
      ) : null}
    </div>
  )
}
