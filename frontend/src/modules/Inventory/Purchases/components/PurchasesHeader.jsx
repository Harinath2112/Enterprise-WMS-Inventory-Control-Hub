import { ReceiptText, Plus } from 'lucide-react'
import PageHeader from '../../../../components/common/PageHeader'

export default function PurchasesHeader({ canCreate, onAdd }) {
  return (
    <PageHeader
      icon={ReceiptText}
      title="Purchases"
      description="Create purchase orders and keep receiving workflows aligned with stock."
      actions={
        canCreate ? (
          <button className="button button-primary" onClick={onAdd}>
            <Plus size={16} />
            Add Purchase
          </button>
        ) : null
      }
    />
  )
}
