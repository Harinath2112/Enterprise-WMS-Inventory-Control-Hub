import { FileText, Plus } from 'lucide-react'
import PageHeader from '../../../../components/common/PageHeader'

export default function PurchaseIndentsHeader({ canCreate, onAdd }) {
  return (
    <PageHeader
      icon={FileText}
      title="Purchase Indents"
      description="Create purchase requisitions and stock top-up requests."
      actions={
        canCreate ? (
          <button className="button button-primary" onClick={onAdd}>
            <Plus size={16} />
            Add Purchase Indent
          </button>
        ) : null
      }
    />
  )
}
