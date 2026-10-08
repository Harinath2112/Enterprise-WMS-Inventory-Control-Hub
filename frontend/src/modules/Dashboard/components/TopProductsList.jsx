import { Boxes } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatCurrency } from '../../../utils/helpers'

export default function TopProductsList({ products = [] }) {
  const safeProducts = Array.isArray(products) ? products : []
  const topProducts = safeProducts.slice(0, 50)
  const totalRevenue = safeProducts.slice(0, 5).reduce((total, product) => total + Number(product.revenue || 0), 0)

  return (
    <section className="dashboard-panel compact-list top-products-panel">
      <div className="dashboard-panel__header">
        <div>
          <h2>Top Products</h2>
        </div>
        <Link
          className="dashboard-panel__link"
          to="/inventory/products?filter=top-selling"
          state={{ topProducts }}
        >
          View all
        </Link>
      </div>

      {topProducts.length > 0 ? (
        <div className="top-products-list">
          {topProducts.map((product, index) => {
            const revenue = Number(product.revenue || 0)
            const percent = totalRevenue > 0 ? Math.round((revenue / totalRevenue) * 100) : 0
            const productName = product.name || 'Unnamed Product'
            const skuText = product.sku || 'No SKU'
            const soldText = `${product.totalSold || 0} sold`
            const subText = `${skuText} - ${soldText}`

            return (
              <article
                className="top-product-row"
                key={product.id || product.name || index}
                title={productName}
              >
                <span className="top-product-row__rank">#{index + 1}</span>
                <div className="top-product-row__main">
                  <div className="top-product-row__copy" title={productName}>
                    <strong title={productName}>{productName}</strong>
                    <small title={subText}>{subText}</small>
                  </div>
                  <div className="top-product-row__bar" aria-label={`${percent}% of top product revenue`}>
                    <span style={{ width: `${percent}%` }} />
                  </div>
                </div>
                <em>{formatCurrency(revenue)}</em>
              </article>
            )
          })}
        </div>
      ) : (
        <div className="dashboard-empty dashboard-empty--compact">
          <Boxes size={18} />
          <strong>No product performance yet</strong>
          <p>Top products will appear after sales activity is available.</p>
        </div>
      )}
    </section>
  )
}
