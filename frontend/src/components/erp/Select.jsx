import './ERPComponents.css'

export default function Select({ className = '', options = [], children, ...props }) {
  return (
    <select className={`erp-select ${className}`.trim()} {...props}>
      {children}
      {options.map((option) => (
        <option key={option.value ?? option.label} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}
