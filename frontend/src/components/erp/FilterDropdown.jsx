import './ERPComponents.css'

export default function FilterDropdown({
  label,
  value,
  onChange,
  options = [],
  className = '',
  allLabel,
}) {
  return (
    <label className={`erp-filter-dropdown ${className}`.trim()}>
      {label ? <span>{label}</span> : null}
      <select value={value} onChange={(event) => onChange?.(event.target.value)}>
        {allLabel ? <option value="all">{allLabel}</option> : null}
        {options.map((option) => (
          <option key={option.value ?? option.label} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}
