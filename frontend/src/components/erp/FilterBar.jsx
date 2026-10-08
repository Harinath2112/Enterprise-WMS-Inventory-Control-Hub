import './ERPComponents.css'

export default function FilterBar({ children, className = '', ariaLabel = 'Table filters' }) {
  return (
    <div className={`erp-filter-bar ${className}`.trim()} aria-label={ariaLabel}>
      {children}
    </div>
  )
}
