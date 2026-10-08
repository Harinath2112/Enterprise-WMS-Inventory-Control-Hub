export default function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  icon: Icon,
}) {
  return (
    <header className="layout-page-header">
      <div className="layout-page-header__copy">
        {eyebrow ? <span className="layout-page-header__eyebrow">{eyebrow}</span> : null}
        <div className="layout-page-header__title-row">
          {Icon ? (
            <span className="layout-page-header__icon" aria-hidden="true">
              <Icon size={18} />
            </span>
          ) : null}
          <h1>{title}</h1>
        </div>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="layout-page-header__actions">{actions}</div> : null}
    </header>
  )
}
