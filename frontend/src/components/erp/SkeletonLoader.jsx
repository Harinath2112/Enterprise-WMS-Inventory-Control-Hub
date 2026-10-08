import './ERPComponents.css'

export default function SkeletonLoader({
  rows = 4,
  className = '',
  rowHeight = 14,
}) {
  return (
    <div className={`erp-skeleton-loader ${className}`.trim()} aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => (
        <span
          key={index}
          className="erp-skeleton-loader__row"
          style={{
            '--skeleton-row-height': `${rowHeight}px`,
            '--skeleton-row-width': `${100 - (index % 3) * 12}%`,
          }}
        />
      ))}
    </div>
  )
}
