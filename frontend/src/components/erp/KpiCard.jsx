import StatisticsCard from './StatisticsCard'

export default function KpiCard({ className = '', ...props }) {
  return (
    <StatisticsCard
      className={`erp-kpi-card ${className}`.trim()}
      {...props}
    />
  )
}
