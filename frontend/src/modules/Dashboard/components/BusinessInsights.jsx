import { AlertTriangle, CheckCircle2, Info, Lightbulb } from 'lucide-react'
import { Link } from 'react-router-dom'

const severityMeta = {
  success: {
    label: 'Success',
    icon: CheckCircle2,
  },
  warning: {
    label: 'Warning',
    icon: AlertTriangle,
  },
  info: {
    label: 'Info',
    icon: Info,
  },
  primary: {
    label: 'Info',
    icon: Info,
  },
  neutral: {
    label: 'Info',
    icon: Info,
  },
}

export default function BusinessInsights({ insights = [] }) {
  const safeInsights = Array.isArray(insights) ? insights : []
  const visibleInsights = safeInsights.slice(0, 50)

  return (
    <section className="dashboard-panel insights-panel">
      <div className="dashboard-panel__header">
        <div>
          <h2>Insights</h2>
        </div>
        {safeInsights.length > 4 && (
          <Link className="dashboard-panel__link" to="/reports">View all</Link>
        )}
        <Lightbulb size={17} aria-hidden="true" />
      </div>

      {visibleInsights.length > 0 ? (
        <div className="insights-list">
          {visibleInsights.map((insight, index) => {
            const tone = insight.tone === 'primary' || insight.tone === 'neutral' ? 'info' : insight.tone
            const meta = severityMeta[insight.tone] || severityMeta.info
            const Icon = meta.icon

            return (
              <article className={`insight-item insight-item--${tone} ${index === 0 ? 'is-priority' : ''}`} key={insight.title}>
                <span className="insight-item__icon" aria-hidden="true">
                  <Icon size={16} />
                </span>
                <div>
                  <small>{index === 0 ? 'Priority' : meta.label}</small>
                  <strong>{insight.title}</strong>
                  <p>{insight.description}</p>
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <div className="dashboard-empty dashboard-empty--compact">
          <Lightbulb size={18} />
          <strong>No insights yet</strong>
          <p>Insights will appear as dashboard activity grows.</p>
          <Link className="dashboard-empty__button" to="/reports">
            View Reports
          </Link>
        </div>
      )}
    </section>
  )
}
