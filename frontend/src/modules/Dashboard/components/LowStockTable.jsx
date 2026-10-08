import { TrendingUp } from 'lucide-react'
import { DataTable } from '../../../components/erp'

export default function LowStockTable({ products }) {
  const columns = [
    {
      key: 'name',
      label: 'Product',
      sortable: true,
      mobilePrimary: true,
      searchValue: (product) => `${product.name} ${product.sku}`,
    },
    { key: 'sku', label: 'SKU', sortable: true },
    { key: 'stock', label: 'Stock', sortable: true },
    { key: 'reorderLevel', label: 'Reorder Level', sortable: true },
  ]

  return (
    <div className="card">
      <div className="stat-card__top">
        <h2 className="section-title">Low-stock watchlist</h2>

        <div className="stat-card__icon">
          <TrendingUp size={18} />
        </div>
      </div>

      <DataTable
        rows={products}
        columns={columns}
        defaultPageSize={8}
        searchPlaceholder="Search product or SKU"
        emptyMessage="Stock levels are healthy."
      />
    </div>
  )
}
