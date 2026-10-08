import './MobileEntityCard.css'

export function MobileActionRow({ children, className = '' }) {
  if (!children) {
    return null
  }

  return (
    <div className={`mobile-action-row ${className}`.trim()}>
      {children}
    </div>
  )
}

export function MobileMetadata({ items = [], className = '' }) {
  const visibleItems = items.filter((item) => item && item.value !== undefined && item.value !== null && item.value !== '')

  if (visibleItems.length === 0) {
    return null
  }

  return (
    <dl className={`mobile-metadata ${className}`.trim()}>
      {visibleItems.map((item) => (
        <div className="mobile-metadata__item" key={item.key || item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}

export default function MobileEntityCard({
  eyebrow,
  title,
  subtitle,
  status,
  metadata = [],
  description,
  actions,
  className = '',
  onClick,
  onKeyDown,
  children,
}) {
  return (
    <article
      className={`mobile-entity-card ${onClick ? 'is-clickable' : ''} ${className}`.trim()}
      onClick={onClick}
      onKeyDown={onKeyDown}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <header className="mobile-entity-card__header">
        <div className="mobile-entity-card__identity">
          {eyebrow ? <span className="mobile-entity-card__eyebrow">{eyebrow}</span> : null}
          <div className="mobile-entity-card__title">{title}</div>
          {subtitle ? <span className="mobile-entity-card__subtitle">{subtitle}</span> : null}
        </div>
        {status ? <div className="mobile-entity-card__status">{status}</div> : null}
      </header>

      {description ? <p className="mobile-entity-card__description">{description}</p> : null}
      <MobileMetadata items={metadata} />
      {children}
      {actions ? <MobileActionRow>{actions}</MobileActionRow> : null}
    </article>
  )
}
