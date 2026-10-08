import {
  Bar,
  BarChart,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import ResponsiveChart from '../../../components/charts/ResponsiveChart'

export default function CategoryChart({ data }) {
  return (
    <div className="card chart-card">
      <h2 className="section-title">Stock by category</h2>

      <ResponsiveChart>
        <BarChart data={data} margin={{ top: 12, right: 10, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 12, fill: '#64748b' }}
            tickLine={false}
            axisLine={{ stroke: '#e2e8f0' }}
            interval="preserveStartEnd"
            minTickGap={10}
          />
          <YAxis
            tick={{ fontSize: 12, fill: '#64748b' }}
            tickLine={false}
            axisLine={false}
            width={40}
          />
          <Tooltip
            cursor={{ fill: 'rgba(124, 108, 240, 0.08)' }}
            contentStyle={{
              borderRadius: 8,
              borderColor: '#e2e8f0',
              boxShadow: '0 14px 30px rgba(15, 23, 42, 0.12)',
            }}
          />
          <Bar dataKey="stock" fill="#7c6cf0" radius={[6, 6, 0, 0]} maxBarSize={42} />
        </BarChart>
      </ResponsiveChart>
    </div>
  )
}
