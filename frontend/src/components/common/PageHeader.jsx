import './PageHeader.css'

export default function PageHeader({
  icon: Icon,
  title,
  description,
  actions,
  primaryAction,
  className = '',
}) {
  const PrimaryIcon = primaryAction?.icon
  const renderedPrimaryAction = primaryAction ? (
    <button
      type="button"
      className={`button button-primary ${primaryAction.className || ''}`.trim()}
      onClick={primaryAction.onClick}
      disabled={primaryAction.disabled}
    >
      {PrimaryIcon ? <PrimaryIcon size={16} /> : null}
      {primaryAction.label}
    </button>
  ) : null

  return (
    <header className={`page-header app-page-header ${className}`.trim()}>
      <div className="page-title app-page-header__title">
        {Icon ? (
          <div className="page-title__icon app-page-header__icon" aria-hidden="true">
            <Icon size={20} />
          </div>
        ) : null}
        <div className="app-page-header__copy">
          <h1>{title}</h1>
          {description ? <p className="page-subtitle">{description}</p> : null}
        </div>
      </div>

      {actions || renderedPrimaryAction ? (
        <div className="page-header__actions app-page-header__actions">
          {actions}
          {renderedPrimaryAction}
        </div>
      ) : null}
    </header>
  )
}
