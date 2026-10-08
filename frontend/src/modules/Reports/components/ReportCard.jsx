export default function ReportCard({ title, value, caption, icon }) {
  return (
    <div className="card stat-card">
      <div className="stat-card__top">
        <h3>{title}</h3>

        <div className="stat-card__icon">
          {icon}
        </div>
      </div>

      <strong>{value}</strong>

      <p className="stat-card__caption">{caption}</p>
    </div>
  )
}