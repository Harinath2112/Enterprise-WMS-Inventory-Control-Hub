import {
  AlertTriangle,
  DollarSign,
  ShoppingCart,
  Warehouse,
} from 'lucide-react'

import ReportCard from './ReportCard'

export default function StatsCards({ stats, formatCurrency }) {
  const cards = [
    {
      title: 'Purchase value',
      value: formatCurrency(stats.purchaseValue),
      caption: 'Total purchase value recorded.',
      icon: <DollarSign size={18} />,
    },
    {
      title: 'Sales value',
      value: formatCurrency(stats.salesValue),
      caption: 'Total sales value recorded.',
      icon: <ShoppingCart size={18} />,
    },
    {
      title: 'Low stock',
      value: stats.lowStockCount,
      caption: 'Items that need replenishment.',
      icon: <AlertTriangle size={18} />,
    },
    {
      title: 'Warehouses',
      value: stats.warehouseCount,
      caption: 'Configured warehouse locations.',
      icon: <Warehouse size={18} />,
    },
  ]

  return (
    <div className="stats-grid">
      {cards.map((card, index) => (
        <ReportCard key={index} {...card} />
      ))}
    </div>
  )
}
