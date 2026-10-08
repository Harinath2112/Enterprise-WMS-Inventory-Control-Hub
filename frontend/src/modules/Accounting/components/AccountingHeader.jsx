import { FileText, Plus } from 'lucide-react'
import PageHeader from '../../../components/common/PageHeader'

export default function AccountingHeader({ canCreate, onToggleForm }) {
  return (
    <PageHeader
      icon={FileText}
      title="Accounting"
      description="Create invoices, track payments, and review finance documents."
      actions={
        canCreate ? (
          <button type="button" className="button button-primary" onClick={onToggleForm}>
            <Plus size={16} />
            Add Invoice
          </button>
        ) : null
      }
    />
  )
}
