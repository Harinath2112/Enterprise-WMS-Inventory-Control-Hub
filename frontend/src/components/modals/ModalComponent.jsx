import FormModal from '../../layouts/FormModal'
import './ModalComponent.css'

export default function ModalComponent({
  title,
  subtitle,
  children,
  onClose,
}) {
  return (
    <FormModal title={title} subtitle={subtitle} onClose={onClose}>
      <div className="modal-component">{children}</div>
    </FormModal>
  )
}
