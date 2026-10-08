import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { BarChart3 } from 'lucide-react'
import ResponsiveChart from '../../../components/charts/ResponsiveChart'
import { formatCurrency } from '../../../utils/helpers'
import SkeletonCard from './SkeletonCard'

function DashboardTooltip({ active, payload, label }) {
  if (!active || !payload?.length) {
    return null
  }

  return (
    <div className="dashboard-chart__tooltip">
      <strong>{label}</strong>
      {payload.map((item) => (
        <span key={item.dataKey}>
          <i style={{ backgroundColor: item.color }} />
          {item.name}: {formatCurrency(item.value)}
        </span>
      ))}
    </div>
  )
}

export default function DashboardChart({ data = [], isLoading }) {
  const safeData = Array.isArray(data) ? data : []
  const hasHistoricalData =
    safeData.length > 0 &&
    safeData.some((item) => Number(item.sales || 0) > 0 || Number(item.purchases || 0) > 0)
  const isCompactEmpty = !isLoading && !hasHistoricalData

  const chartData = safeData.length === 1
    ? [{ month: '', sales: 0, purchases: 0 }, ...safeData]
    : safeData

  return (
    <section className={`dashboard-panel dashboard-chart ${isCompactEmpty ? 'is-empty' : ''}`}>
      <div className="dashboard-panel__header">
        <div>
          <h2>Monthly Sales</h2>
        </div>
      </div>

      {isLoading ? (
        <SkeletonCard variant="chart" />
      ) : hasHistoricalData ? (
        <ResponsiveChart className="dashboard-chart__frame">
          <AreaChart data={chartData} margin={{ top: 6, right: 10, bottom: 0, left: -4 }}>
            <defs>
              <linearGradient id="salesArea" x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor="#684cda" stopOpacity={0.22} />
                <stop offset="95%" stopColor="#684cda" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="purchasesArea" x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor="#6446d9" stopOpacity={0.18} />
                <stop offset="95%" stopColor="#6446d9" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#E2E8F0" strokeDasharray="4 8" vertical={false} />
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: '#64748B', fontWeight: 600 }}
              dy={6}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: '#64748B', fontWeight: 600 }}
              tickFormatter={(value) => formatCurrency(value).replace('.00', '')}
              width={68}
            />
            <Tooltip content={<DashboardTooltip />} cursor={{ stroke: '#CBD5E1', strokeDasharray: '4 4' }} />
            <Legend iconType="circle" align="right" verticalAlign="top" wrapperStyle={{ fontSize: 11, paddingBottom: 4 }} />
            <Area
              type="monotone"
              dataKey="sales"
              name="Sales"
              stroke="#684cda"
              strokeWidth={2.6}
              fill="url(#salesArea)"
              dot={false}
              activeDot={{ r: 5, strokeWidth: 2, stroke: '#FFFFFF' }}
              animationDuration={600}
            />
            <Area
              type="monotone"
              dataKey="purchases"
              name="Purchases"
              stroke="#6446d9"
              strokeWidth={2.6}
              fill="url(#purchasesArea)"
              dot={false}
              activeDot={{ r: 5, strokeWidth: 2, stroke: '#FFFFFF' }}
              animationDuration={600}
            />
          </AreaChart>
        </ResponsiveChart>
      ) : (
        <div className="dashboard-empty dashboard-empty--chart">
          <BarChart3 size={22} />
          <strong>No monthly trend yet</strong>
          <p>Create invoices across more than one month to compare sales and purchase movement.</p>
        </div>
      )}
    </section>
  )
}
