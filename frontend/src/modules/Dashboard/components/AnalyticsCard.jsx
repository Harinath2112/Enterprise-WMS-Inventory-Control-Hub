export default function AnalyticsCard({
  title,
  value,
  caption,
  icon: Icon,
  tone = 'primary',
  isPlaceholder = false,
}) {
  return (
    <article className={`analytics-card analytics-card--${tone} ${isPlaceholder ? 'is-placeholder' : ''}`}>
      <div className="analytics-card__header">
        <span className="analytics-card__icon" aria-hidden="true">
          <Icon size={16} />
        </span>
        <span className="analytics-card__title">{title}</span>
      </div>
      <div className="analytics-card__content">
        <strong className="analytics-card__value">{value}</strong>
        {caption ? <span className="analytics-card__caption">{caption}</span> : null}
      </div>
    </article>
  )
}
