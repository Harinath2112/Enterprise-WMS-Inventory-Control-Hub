import { CalendarDays, Star, TimerReset, TrendingUp } from 'lucide-react'
import { formatDate } from '../../../utils/helpers'
import { formatEmpty, formatVendorRating } from '../supplierFormatters'
import { SupplierMetricCard, SupplierSection } from './SupplierFormSections'

export default function SupplierPerformanceTab({ performance, supplier, purchases = [] }) {
  const resolvedLastSupplyDate =
    performance?.lastSupplyDate ||
    supplier?.lastPurchaseDate ||
    supplier?.lastSupplyDate ||
    supplier?.lastOrderDate ||
    (Array.isArray(purchases) && purchases.length > 0
      ? purchases
          .map((p) => p?.orderDate || p?.receivedDate || p?.createdAt || p?.createdDate || p?.date)
          .filter(Boolean)
          .sort((a, b) => new Date(b) - new Date(a))[0]
      : null)

  const formattedDate = resolvedLastSupplyDate && resolvedLastSupplyDate !== '-' && resolvedLastSupplyDate !== '—'
    ? formatDate(resolvedLastSupplyDate)
    : null
  const displayLastSupplyDate = formattedDate && formattedDate !== '-' ? formattedDate : 'No supply history'

  const totalOrders = Number(
    performance?.totalOrders ??
    (Array.isArray(purchases) && purchases.length > 0 ? purchases.length : (resolvedLastSupplyDate ? 1 : 0))
  )
  const onTimeDeliveries = Number(performance?.onTimeDeliveries ?? (totalOrders > 0 ? totalOrders : 0))
  const onTimeRate = totalOrders
    ? Math.round((onTimeDeliveries / totalOrders) * 100)
    : 100

  const ratingValue = formatVendorRating(performance?.vendorRating)

  return (
    <SupplierSection
      title="Performance"
      description="Read-only vendor scorecard derived from supplier_performance."
    >
      <div className="supplier-performance-grid">
        <SupplierMetricCard label="Total Orders" value={formatEmpty(totalOrders || performance?.totalOrders || 0)} helper="POs raised against this vendor." />
        <SupplierMetricCard label="On-Time Deliveries" value={formatEmpty(totalOrders ? onTimeDeliveries : (performance?.onTimeDeliveries ?? 0))} helper={`${onTimeRate}% delivery reliability`} tone="success" />
        <SupplierMetricCard label="Delayed Deliveries" value={formatEmpty(performance?.delayedDeliveries ?? 0)} helper="Requires procurement review." tone="warning" />
        <SupplierMetricCard label="Vendor Rating" value={ratingValue} helper="Weighted delivery and quality score." />
      </div>
      <div className="supplier-analytics">
        <div className="supplier-analytics__row">
          <span><TimerReset size={16} /> Delivery Reliability</span>
          <strong>{onTimeRate}%</strong>
        </div>
        <div className="supplier-progress"><span style={{ width: `${onTimeRate}%` }} /></div>
        <div className="supplier-analytics__split">
          <span><CalendarDays size={16} /> Last Supply Date: <strong>{displayLastSupplyDate}</strong></span>
          <span><TrendingUp size={16} /> Return Percentage: <strong>{performance?.returnPercentage != null ? `${performance.returnPercentage}%` : '0%'}</strong></span>
          <span><Star size={16} /> Rating: <strong>{ratingValue}</strong></span>
        </div>
      </div>
    </SupplierSection>
  )
}
