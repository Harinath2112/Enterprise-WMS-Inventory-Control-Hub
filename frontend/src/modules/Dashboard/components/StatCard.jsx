import { Link } from 'react-router-dom'

export default function StatCard({
  title,
  value,
  description,
  trend,
  trendDirection,
  icon: Icon,
  to,
  tone = 'primary',
  tooltip,
}) {
  const Component = to ? Link : 'article'
  const label = tooltip || description || `Open ${title}`
  const interactiveProps = to
    ? {
        to,
        title: label,
        'aria-label': label,
      }
    : {
        title: label,
        'aria-label': label,
      }

  return (
    <Component className={`dashboard-stat dashboard-stat--${tone} ${to ? 'is-clickable' : ''}`} {...interactiveProps}>
      <div className="dashboard-stat__header">
        <span className="dashboard-stat__icon" aria-hidden="true">
          <Icon size={16} />
        </span>
        <span className="dashboard-stat__label" title={title}>{title}</span>
      </div>
      <div className="dashboard-stat__content">
        <strong className="dashboard-stat__value" title={String(value)}>{value}</strong>
        {trend ? (
          <span
            className={`dashboard-stat__trend ${trendDirection ? `is-${trendDirection}` : ''}`}
            title={typeof trend === 'string' ? trend : undefined}
          >
            {trend}
          </span>
        ) : null}
        {description ? <p>{description}</p> : null}
      </div>
    </Component>
  )
}
