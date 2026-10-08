import './ERPComponents.css'

export default function TableToolbar({ children, className = '', ariaLabel = 'Table toolbar' }) {
  return (
    <div className={`erp-table-toolbar ${className}`.trim()} aria-label={ariaLabel}>
      {children}
    </div>
  )
}
