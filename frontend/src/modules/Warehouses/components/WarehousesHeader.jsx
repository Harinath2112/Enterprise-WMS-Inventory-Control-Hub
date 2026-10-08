import { Plus } from 'lucide-react'

export default function WarehousesHeader({
  canCreate,
  summary,
  onAdd,
}) {
  const metrics = [
    { key: 'warehouses', label: 'Warehouses', value: summary?.warehouses ?? 0, tone: 'success' },
    { key: 'stock', label: 'Stock Units', value: summary?.stockUnits ?? 0, tone: 'info' },
    { key: 'storage', label: 'Rack / Bin', value: `${summary?.racks ?? 0} / ${summary?.bins ?? 0}`, tone: 'warning' },
  ]

  return (
    <header className="warehouses-workspace-header" aria-label="Warehouses summary">
      <div className="warehouses-workspace-header__main">
        <h1>Warehouses</h1>
        <div className="warehouses-workspace-header__metrics" aria-label="Warehouse metrics">
          {metrics.map((metric) => (
            <span
              key={metric.key}
              className={`warehouses-metric-badge warehouses-metric-badge--${metric.tone}`}
            >
              {metric.value} {metric.label}
            </span>
          ))}
        </div>
      </div>

      <div className="warehouses-workspace-header__actions">
        {canCreate ? (
          <button className="button button-primary" onClick={onAdd}>
            <Plus size={16} />
            Add Warehouse
          </button>
        ) : null}
      </div>
    </header>
  )
}
