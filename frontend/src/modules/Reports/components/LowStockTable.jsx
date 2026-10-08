import { DataTable } from '../../../components/erp'

export default function LowStockTable({ lowStockProducts }) {
  const columns = [
    {
      key: 'name',
      label: 'Product',
      sortable: true,
      mobilePrimary: true,
      searchValue: (product) => `${product.name} ${product.warehouseName}`,
    },
    { key: 'warehouseName', label: 'Warehouse', sortable: true },
    { key: 'stock', label: 'Stock', sortable: true },
    { key: 'reorderLevel', label: 'Reorder Level', sortable: true },
  ]

  return (
    <div className="card">
      <DataTable
        title="Low-stock report"
        rows={lowStockProducts}
        columns={columns}
        defaultPageSize={8}
        searchPlaceholder="Search low stock by product or warehouse"
        emptyMessage="Stock levels are healthy."
      />
    </div>
  )
}
