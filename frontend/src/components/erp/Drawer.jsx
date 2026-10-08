import { X } from 'lucide-react'
import './ERPComponents.css'

export default function Drawer({
  title,
  subtitle,
  children,
  footer,
  onClose,
  width = '520px',
  className = '',
  titleId = 'erp-drawer-title',
}) {
  return (
    <div className={`erp-drawer ${className}`.trim()} role="dialog" aria-modal="true" aria-labelledby={titleId} style={{ '--erp-drawer-width': width }}>
      <button type="button" className="erp-drawer__backdrop" aria-label="Close drawer" onClick={onClose} />
      <aside className="erp-drawer__panel">
        <header className="erp-drawer__header">
          <div className="erp-drawer__title">
            {title ? <h2 id={titleId}>{title}</h2> : null}
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <button type="button" className="button button-secondary erp-drawer__close" onClick={onClose} aria-label="Close drawer">
            <X size={14} />
          </button>
        </header>
        <div className="erp-drawer__content">{children}</div>
        {footer ? <footer className="erp-drawer__footer">{footer}</footer> : null}
      </aside>
    </div>
  )
}
