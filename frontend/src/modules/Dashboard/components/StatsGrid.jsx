import {
  AlertTriangle,
  DollarSign,
  Package,
  ShoppingCart,
} from 'lucide-react'
import StatCard from './StatCard'
import { formatCurrency } from '../../../utils/helpers'

export default function StatsGrid({
  products,
  sales,
  lowStock,
  inventoryValue,
}) {
  return (
    <div className="stats-grid">
      <StatCard
        title="Products"
        value={products.length}
        icon={Package}
        caption="Active SKUs in the catalog."
      />

      <StatCard
        title="Low stock"
        value={lowStock.length}
        icon={AlertTriangle}
        caption="Products at or below reorder level."
      />

      <StatCard
        title="Inventory value"
        value={formatCurrency(inventoryValue)}
        icon={DollarSign}
        caption="Estimated value on hand."
      />

      <StatCard
        title="Sales"
        value={sales.length}
        icon={ShoppingCart}
        caption="Orders recorded in the workspace."
      />
    </div>
  )
}
