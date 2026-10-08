import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import ResponsiveChart from '../../../components/charts/ResponsiveChart'

export default function TransactionChart({ data }) {
  return (
    <div className="card chart-card">
      <h2 className="section-title">Purchases vs sales</h2>

      <ResponsiveChart>
        <LineChart
          data={data}
          margin={{ top: 12, right: 12, bottom: 4, left: 0 }}
        >
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
          <Tooltip
            contentStyle={{
              borderRadius: 8,
              borderColor: '#e2e8f0',
              boxShadow: '0 14px 30px rgba(15, 23, 42, 0.12)',
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
          <Line
            type="monotone"
            dataKey="purchases"
            stroke="#7c6cf0"
            strokeWidth={2.4}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey="sales"
            stroke="#475569"
            strokeWidth={2.4}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveChart>
    </div>
  )
}
