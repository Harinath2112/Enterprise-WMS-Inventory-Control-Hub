import './ERPComponents.css'

export default function Pagination({ children, className = '' }) {
  return <div className={`erp-pagination ${className}`.trim()}>{children}</div>
}
