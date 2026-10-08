import './ERPComponents.css'

export default function Button({
  children,
  icon: Icon,
  variant = 'secondary',
  className = '',
  type = 'button',
  ...props
}) {
  return (
    <button
      type={type}
      className={`erp-button erp-button--${variant} ${className}`.trim()}
      {...props}
    >
      {Icon ? <Icon size={16} /> : null}
      {children}
    </button>
  )
}
