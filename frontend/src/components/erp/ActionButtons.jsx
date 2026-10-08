import './ERPComponents.css'

export default function ActionButtons({
  children,
  className = '',
  align = 'end',
  ariaLabel = 'Record actions',
  ...rest
}) {
  return (
    <div
      className={`erp-action-buttons erp-action-buttons--${align} ${className}`.trim()}
      aria-label={ariaLabel}
      data-row-click-ignore="true"
      {...rest}
    >
      {children}
    </div>
  )
}
