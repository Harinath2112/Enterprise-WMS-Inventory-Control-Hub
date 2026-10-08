import { useEffect, useState, useMemo } from 'react'
import FormModal from '../../layouts/FormModal'
import { getStockRegister } from '../../api/stockApi'
import { getProductCatalog } from '../../api/productApi'
import { getWarehouses } from '../../api/warehousesApi'
import StatusBadge from '../StatusBadge'
import { AlertTriangle, Building2, Loader2 } from 'lucide-react'
import './LowStockAlert.css'

export default function LowStockAlert({ lowStockProducts = [], onClose }) {
  const [stockItems, setStockItems] = useState([])
  const [productCatalog, setProductCatalog] = useState([])
  const [warehouses, setWarehouses] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let isMounted = true

    async function fetchData() {
      try {
        setIsLoading(true)
        const [stockRes, catalogRes, warehousesRes] = await Promise.all([
          getStockRegister({ bypassCache: false }),
          getProductCatalog({}, { bypassCache: false }),
          getWarehouses({ bypassCache: false }),
        ])

        if (!isMounted) return

        if (stockRes?.success && catalogRes?.success && warehousesRes?.success) {
          setStockItems(stockRes.data || [])
          setProductCatalog(catalogRes.data || [])
          setWarehouses(warehousesRes.data || [])
        } else {
          const failed = []
          if (!stockRes?.success) failed.push('Stock API')
          if (!catalogRes?.success) failed.push('Catalog API')
          if (!warehousesRes?.success) failed.push('Warehouses API')
          throw new Error(`Failed to retrieve data from: ${failed.join(', ')}`)
        }
      } catch (err) {
        console.error('[LowStockAlert] Failed to retrieve backend data:', err)
        if (isMounted) {
          setError(err)
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    fetchData()

    return () => {
      isMounted = false
    }
  }, [])

  const groupedData = useMemo(() => {
    if (productCatalog.length === 0 || stockItems.length === 0) {
      return {
        warehouses: [],
        summary: { total: 0, critical: 0, outOfStock: 0, affectedWarehouses: 0 },
      }
    }

    const productMap = new Map(productCatalog.map((p) => [String(p.productId || p.id), p]))
    const warehouseNameMap = new Map(warehouses.map((w) => [String(w.id || w.warehouseId), w.name]))

    const warehousesMap = {}
    const processedProductIds = new Set()

    // 1. Process items from stock register
    stockItems.forEach((stockItem) => {
      const prodId = String(stockItem.productId)
      const product = productMap.get(prodId)

      if (!product) return
      const statusStr = String(product.rawStatus ?? product.sourceStatus ?? product.status ?? 'active').trim().toLowerCase()
      const isDeleted = Boolean(product.isDeleted ?? product.IsDeleted)
      if (isDeleted || statusStr !== 'active') return

      const reorderLevel = product.reorderLevel ?? 0
      const available = stockItem.availableQty ?? stockItem.quantity ?? 0

      if (available <= reorderLevel) {
        processedProductIds.add(prodId)
        const whId = stockItem.warehouseId ? String(stockItem.warehouseId) : 'unassigned'

        let whName = 'Unassigned Warehouse'
        if (whId !== 'unassigned') {
          whName = warehouseNameMap.get(whId) || stockItem.warehouseName || stockItem.WarehouseName || `Warehouse ${whId}`
        }

        let status = 'Low Stock'
        if (available <= 0) {
          status = 'Out of Stock'
        } else if (available <= reorderLevel * 0.25) {
          status = 'Critical'
        }

        if (!warehousesMap[whId]) {
          warehousesMap[whId] = {
            warehouseId: whId,
            warehouseName: whName,
            items: [],
          }
        }

        warehousesMap[whId].items.push({
          productId: prodId,
          productName: product.name,
          sku: product.sku,
          available,
          reorderLevel,
          unit: product.unit || '',
          status,
        })
      }
    })

    // 2. Catch active products with reorderLevel > 0 that have NO entries in the stock register (0 stock)
    productCatalog.forEach((product) => {
      const prodId = String(product.productId || product.id)
      if (processedProductIds.has(prodId)) return

      const statusStr = String(product.rawStatus ?? product.sourceStatus ?? product.status ?? 'active').trim().toLowerCase()
      const isDeleted = Boolean(product.isDeleted ?? product.IsDeleted)
      if (isDeleted || statusStr !== 'active') return

      const reorderLevel = product.reorderLevel ?? 0
      if (reorderLevel > 0) {
        const whId = product.warehouseId ? String(product.warehouseId) : 'unassigned'

        let whName = 'Unassigned Warehouse'
        if (whId !== 'unassigned') {
          whName = warehouseNameMap.get(whId) || product.warehouseName || product.WarehouseName || `Warehouse ${whId}`
        }

        if (!warehousesMap[whId]) {
          warehousesMap[whId] = {
            warehouseId: whId,
            warehouseName: whName,
            items: [],
          }
        }

        warehousesMap[whId].items.push({
          productId: prodId,
          productName: product.name,
          sku: product.sku,
          available: 0,
          reorderLevel,
          unit: product.unit || '',
          status: 'Out of Stock',
        })
      }
    })

    let totalLowStockItems = 0
    let criticalCount = 0
    let outOfStockCount = 0

    Object.values(warehousesMap).forEach((wh) => {
      totalLowStockItems += wh.items.length
      wh.items.forEach((item) => {
        if (item.status === 'Critical') criticalCount++
        if (item.available <= 0) outOfStockCount++
      })
    })

    return {
      warehouses: Object.values(warehousesMap),
      summary: {
        total: totalLowStockItems,
        critical: criticalCount,
        outOfStock: outOfStockCount,
        affectedWarehouses: Object.keys(warehousesMap).length,
      },
    }
  }, [stockItems, productCatalog, warehouses])

  if (isLoading) {
    return (
      <FormModal
        title="Low Stock Alert"
        subtitle="Checking inventory levels..."
        onClose={onClose}
      >
        <div className="low-stock-alert__loading">
          <Loader2 className="low-stock-alert__spinner" size={24} />
          <p>Checking inventory levels...</p>
        </div>
      </FormModal>
    )
  }

  if (error) {
    return (
      <FormModal
        title="Low Stock Alert"
        subtitle="Error retrieving inventory levels."
        onClose={onClose}
      >
        <div className="low-stock-alert__loading">
          <AlertTriangle className="text-danger" size={24} style={{ marginBottom: '8px' }} />
          <p>Failed to retrieve inventory levels. Please try again later.</p>
          <button className="button button-cancel button-secondary"
            type="button"
            onClick={onClose}
            style={{ marginTop: '16px', minWidth: '100px' }}
          >
            Close
          </button>
        </div>
      </FormModal>
    )
  }

  if (groupedData.warehouses.length === 0) {
    return null
  }

  return (
    <FormModal
      title="Low Stock Alert"
      subtitle="Some inventory items are running below the required stock level."
      onClose={onClose}
      bodyClassName="low-stock-modal-body"
      dialogClassName="low-stock-modal-dialog"
    >
      <div className="low-stock-alert-content">
        {/* Summary Bar */}
        <div className="low-stock-alert-summary">
          <div className="summary-card">
            <span className="summary-value">{groupedData.summary.total}</span>
            <span className="summary-label">Low Stock Items</span>
          </div>
          <div className="summary-divider"></div>
          <div className="summary-card">
            <span className="summary-value">{groupedData.summary.affectedWarehouses}</span>
            <span className="summary-label">Affected Warehouses</span>
          </div>
          <div className="summary-divider"></div>
          <div className="summary-card text-critical">
            <span className="summary-value">{groupedData.summary.critical}</span>
            <span className="summary-label">Critical</span>
          </div>
          <div className="summary-divider"></div>
          <div className="summary-card text-danger">
            <span className="summary-value">{groupedData.summary.outOfStock}</span>
            <span className="summary-label">Out of Stock</span>
          </div>
        </div>

        {/* Scrollable Warehouse List */}
        <div className="low-stock-warehouses-list">
          {groupedData.warehouses.map((wh, idx) => (
            <div key={idx} className="warehouse-card">
              <div className="warehouse-card-header">
                <div className="warehouse-title-group">
                  <Building2 className="warehouse-icon" size={18} />
                  <div>
                    <h3>{wh.warehouseName}</h3>
                    <p className="warehouse-subtitle">
                      {wh.items.length} {wh.items.length === 1 ? 'item requires' : 'items require'} attention
                    </p>
                  </div>
                </div>
                <span className="warehouse-badge">
                  {wh.items.length} {wh.items.length === 1 ? 'Item' : 'Items'}
                </span>
              </div>
              <div className="warehouse-table-wrapper">
                <table className="warehouse-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>SKU</th>
                      <th>Available</th>
                      <th>Minimum</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wh.items.map((item, itemIdx) => {
                      let badgeType = 'warning'
                      let badgeStatus = item.status

                      if (item.status === 'Out of Stock') {
                        badgeType = 'failed'
                      } else if (item.status === 'Critical') {
                        badgeType = 'failed'
                      }

                      return (
                        <tr key={itemIdx}>
                          <td className="product-name-cell">
                            <strong>{item.productName}</strong>
                          </td>
                          <td className="sku-cell">{item.sku}</td>
                          <td className="available-cell">
                            <span className="available-qty">{item.available}</span>{' '}
                            {item.unit && <span className="unit-label">{item.unit}</span>}
                          </td>
                          <td className="minimum-cell">{item.reorderLevel}</td>
                          <td className="status-cell">
                            <StatusBadge status={badgeStatus} type={badgeType} />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>

        {/* Footer/Action Area */}
        <div className="low-stock-modal-footer">
          <button type="button" className="button button-secondary button-cancel" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </FormModal>
  )
}
