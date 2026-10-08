export default function SkeletonCard({ variant = 'card' }) {
  return (
    <div className={`dashboard-skeleton dashboard-skeleton--${variant}`} aria-hidden="true">
      <div className="dashboard-skeleton__header">
        <span className="dashboard-skeleton__icon" />
        <span className="dashboard-skeleton__title" />
      </div>
      <div className="dashboard-skeleton__content">
        <strong className="dashboard-skeleton__value" />
        <p className="dashboard-skeleton__badge" />
      </div>
    </div>
  )
}
