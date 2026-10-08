import { ShoppingCart, Plus } from 'lucide-react'
import PageHeader from '../../../../components/common/PageHeader'

export default function SalesHeader({ canCreate, onAdd }) {
  return (
    <PageHeader
      icon={ShoppingCart}
      title="Sales"
      description="Create sales entries and keep order fulfillment aligned with stock."
      actions={
        canCreate ? (
          <button className="button button-primary" onClick={onAdd}>
            <Plus size={16} />
            Add Sale
          </button>
        ) : null
      }
    />
  )
}
