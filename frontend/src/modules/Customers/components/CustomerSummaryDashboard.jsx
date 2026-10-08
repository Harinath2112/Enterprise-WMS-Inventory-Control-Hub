import { Activity, CreditCard, IndianRupee, PieChart, Users } from 'lucide-react'
import { StatisticsCard } from '../../../components/erp'
import { formatCurrency } from '../../../utils/helpers'

const cards = [
  {
    key: 'totalCustomers',
    label: 'Total Customers',
    helper: 'Live customer master records.',
    icon: Users,
    priority: 'primary',
  },
  {
    key: 'activeCustomers',
    label: 'Active Customers',
    helper: 'Ready for current operations.',
    icon: Activity,
    priority: 'supporting',
  },
  {
    key: 'outstandingReceivables',
    label: 'Outstanding Receivables',
    helper: 'Open customer balance currently due.',
    icon: IndianRupee,
    format: (value) => formatCurrency(value || 0),
    priority: 'secondary',
  },
  {
    key: 'creditUtilization',
    label: 'Credit Utilization',
    helper: 'Receivables against configured credit.',
    icon: PieChart,
    format: (value) => `${Number(value || 0)}%`,
    priority: 'trend',
  },
  {
    key: 'newCustomers',
    label: 'New Customers',
    helper: 'Profiles added in the last 30 days.',
    icon: CreditCard,
    priority: 'supporting',
  },
]

export default function CustomerSummaryDashboard({ metrics, isLoading, error }) {
  return (
    <section className="customers-page__summary-section" aria-label="Customer summary">
      <div className="customers-page__summary-grid">
        {cards.map((card) => {
          const rawValue = metrics?.[card.key] ?? 0
          const value = card.format ? card.format(rawValue) : rawValue

          return (
            <StatisticsCard
              icon={card.icon}
              label={card.label}
              value={isLoading ? '...' : value}
              helper={card.helper}
              className={`card customers-page__summary-card customers-page__summary-card--${card.priority}`}
              key={card.key}
            />
          )
        })}
      </div>

      {error ? (
        <p className="customers-page__summary-warning page-error-banner" role="alert">{error}</p>
      ) : null}
    </section>
  )
}
