import './ERPComponents.css'

export default function FilterToolbar({
  children,
  actions,
  className = '',
  filtersClassName = '',
  actionsClassName = '',
}) {
  return (
    <div className={`erp-filter-toolbar ${className}`.trim()}>
      <div className={`erp-filter-toolbar__group ${filtersClassName}`.trim()}>
        {children}
      </div>
      {actions ? (
        <div className={`erp-filter-toolbar__group ${actionsClassName}`.trim()}>
          {actions}
        </div>
      ) : null}
    </div>
  )
}
