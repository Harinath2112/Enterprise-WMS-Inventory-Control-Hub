import {
  Activity,
  Boxes,
  Building2,
  CircleDollarSign,
  Package,
  ReceiptText,
  Tags,
  User,
  Warehouse,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import SkeletonCard from './SkeletonCard'
import { formatExactTimestamp, formatRelativeTime } from '../../../utils/helpers'

function toneForActivity(type = '') {
  const value = String(type).toLowerCase()

  if (value.includes('product') || value.includes('stock')) return 'product'
  if (value.includes('customer')) return 'customer'
  if (value.includes('purchase') || value.includes('supplier')) return 'purchase'
  if (value.includes('sale') || value.includes('invoice')) return 'sales'
  return 'default'
}

function getBadgeLabel(type = '') {
  const value = String(type || 'Activity').trim()
  const normalized = value
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!normalized) {
    return 'Activity'
  }

  const words = normalized.split(' ')
  const moduleWord = words.find((word) =>
    /product|customer|supplier|invoice|purchase|payment|stock|category|brand|receipt/i.test(word),
  )

  return titleCase(moduleWord || words[0])
}

function normalizeName(value = '') {
  return String(value).trim().replace(/^["']|["']$/g, '')
}

function titleCase(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase())
}

function formatActivityDescription(activity = {}) {
  const description = String(activity.description || '').trim()

  if (!description) {
    return 'Activity recorded'
  }

  const actor = String(activity.userName || '').trim()
  const actorPrefix = actor && !description.toLowerCase().startsWith(actor.toLowerCase())
    ? `${actor} `
    : ''

  const statusMatch = description.match(/^(?:.+?\s+)?(customer|supplier)\s+status\s+changed\s+from\s+(.+?)\s+to\s+(.+)$/i)
  if (statusMatch) {
    const entity = titleCase(statusMatch[1])
    const nextStatus = statusMatch[3].trim().toLowerCase()

    if (nextStatus === 'active') {
      return `${actorPrefix}${entity} Activated`.trim()
    }

    if (nextStatus === 'inactive') {
      return `${actorPrefix}${entity} Deactivated`.trim()
    }

    return `${actorPrefix}${entity} Status Updated`.trim()
  }

  const entityMatch = description.match(/^(product|customer|supplier|category|sub category|brand|invoice|purchase order|goods receipt)\s+(.+?)\s+(created|updated|deleted)$/i)
  if (entityMatch) {
    const [, entity, rawName, action] = entityMatch
    const name = normalizeName(rawName)
    return `${actorPrefix}${titleCase(action)} ${titleCase(entity)}: ${name}`.trim()
  }

  const invoiceMatch = description.match(/^(invoice|purchase order|goods receipt)\s+(.+?)\s+(created|updated|deleted)$/i)
  if (invoiceMatch) {
    const [, entity, rawName, action] = invoiceMatch
    return `${actorPrefix}${titleCase(action)} ${titleCase(entity)}: ${normalizeName(rawName)}`.trim()
  }

  return `${actorPrefix}${description}`.trim()
}

function getActivityIcon(activity = {}) {
  const value = `${activity.module || ''} ${activity.type || ''}`.toLowerCase()

  if (value.includes('payment')) return CircleDollarSign
  if (value.includes('product') || value.includes('stock')) return Package
  if (value.includes('customer')) return User
  if (value.includes('supplier')) return Building2
  if (value.includes('invoice') || value.includes('sales')) return ReceiptText
  if (value.includes('receipt') || value.includes('warehouse')) return Warehouse
  if (value.includes('category') || value.includes('brand')) return Tags
  if (value.includes('purchase')) return Boxes
  return Activity
}

function getActivityRoute(activity = {}) {
  const value = `${activity.module || ''} ${activity.type || ''} ${activity.tableName || ''}`.toLowerCase()
  const id = activity.recordId || activity.RecordId

  if (value.includes('product')) return id ? `/inventory/products/${id}` : '/inventory/products'
  if (value.includes('customer') && value.includes('payment')) return '/people/customer-payments'
  if (value.includes('supplier') && value.includes('payment')) return '/people/supplier-payments'
  if (value.includes('customer')) return id ? `/people/customers/${id}` : '/people/customers'
  if (value.includes('supplier')) return id ? `/people/suppliers/${id}` : '/people/suppliers'
  if (value.includes('invoice') || value.includes('sales')) return id ? `/management/accounting/${id}` : '/management/accounting'
  if (value.includes('purchase')) return id ? `/inventory/purchases/${id}` : '/inventory/purchases'
  if (value.includes('receipt')) return '/inventory/goods-receipts'
  if (value.includes('stock')) return '/inventory/stock'
  if (value.includes('brand')) return '/inventory/brands'
  if (value.includes('subcategor')) return '/inventory/subcategories'
  if (value.includes('categor')) return '/inventory/categories'
  return '/administration/audit-logs'
}

export default function ActivityTimeline({ activities = [], isLoading }) {
  const navigate = useNavigate()
  const safeActivities = Array.isArray(activities) ? activities : []
  const visibleActivities = safeActivities.slice(0, 50)

  return (
    <section className="dashboard-panel activity-panel">
      <div className="dashboard-panel__header">
        <div>
          <h2>Recent Activity</h2>
        </div>
        {safeActivities.length > 4 && (
          <Link className="dashboard-panel__link" to="/administration/audit-logs">View all</Link>
        )}
      </div>

      {isLoading ? (
        <div className="activity-timeline">
          <SkeletonCard variant="timeline" />
          <SkeletonCard variant="timeline" />
          <SkeletonCard variant="timeline" />
        </div>
      ) : safeActivities.length > 0 ? (
        <div className="activity-timeline">
          {visibleActivities.map((activity) => {
            const tone = toneForActivity(activity.type)
            const badge = getBadgeLabel(activity.type)
            const Icon = getActivityIcon(activity)
            const route = getActivityRoute(activity)
            const description = formatActivityDescription(activity)

            return (
              <article
                className={`activity-item activity-item--${tone}`}
                key={activity.id}
                role="button"
                tabIndex={0}
                title={activity.description || description}
                aria-label={`Open activity: ${description}`}
                onClick={() => navigate(route)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    navigate(route)
                  }
                }}
              >
                <span className="activity-item__marker" aria-hidden="true">
                  <Icon size={13} strokeWidth={2.25} />
                </span>
                <div className="activity-item__body">
                  <span className="activity-item__badge">{badge}</span>
                  <strong>{description}</strong>
                  <time dateTime={activity.date} title={formatExactTimestamp(activity.date)}>{formatExactTimestamp(activity.date)}</time>
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <div className="dashboard-empty">
          <Activity size={22} />
          <strong>No recent activity yet</strong>
          <p>Product, customer, purchase and sales events will appear here.</p>
          <Link className="dashboard-empty__button" to="/administration/audit-logs">
            View Audit Logs
          </Link>
        </div>
      )}
    </section>
  )
}
