import {
  CartesianGrid,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import ResponsiveChart from '../../../components/charts/ResponsiveChart'

export default function TransactionChart({ reportData }) {
  return (
    <div className="card chart-card">
      <h2 className="section-title">Transactions Trend</h2>

      <ResponsiveChart>
        <LineChart data={reportData} margin={{ top: 12, right: 12, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 12, fill: '#64748b' }}
            tickLine={false}
            axisLine={{ stroke: '#e2e8f0' }}
            interval="preserveStartEnd"
            minTickGap={12}
          />
          <YAxis
            tick={{ fontSize: 12, fill: '#64748b' }}
            tickLine={false}
            axisLine={false}
            width={40}
          />
          <Tooltip />

          <Line
            type="monotone"
            dataKey="purchases"
            stroke="#7c6cf0"
            strokeWidth={2.4}
            dot={false}
          />

          <Line
            type="monotone"
            dataKey="sales"
            stroke="#64748b"
            strokeWidth={2.4}
            dot={false}
          />
        </LineChart>
      </ResponsiveChart>
    </div>
  )
}
