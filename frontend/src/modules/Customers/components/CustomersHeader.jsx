import { LoaderCircle, Plus, RefreshCw, Users } from 'lucide-react'
import PageHeader from '../../../components/common/PageHeader'

export default function CustomersHeader({
  canCreate,
  isRefreshing,
  onAdd,
  onRefresh,
}) {
  return (
    <PageHeader
      icon={Users}
      title="Customers"
      description="Manage customer profiles, balances, and account activity from live IMS data."
      actions={
        <>
          <button
            type="button"
            className="button button-secondary customers-header__action customers-header__action--refresh"
            onClick={onRefresh}
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <LoaderCircle size={16} className="animate-spin" />
            ) : (
              <RefreshCw size={16} />
            )}
            Refresh
          </button>

          {canCreate ? (
            <button type="button" className="button button-primary customers-header__action customers-header__action--primary" onClick={onAdd}>
              <Plus size={16} />
              Add Customer
            </button>
          ) : null}
        </>
      }
    />
  )
}
