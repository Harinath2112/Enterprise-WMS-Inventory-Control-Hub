import { useEffect, useRef } from 'react'
import { ShieldCheck, LogOut, ArrowRight } from 'lucide-react'
import './GuestPreviewModal.css'

export default function GuestPreviewModal({ isOpen, onClose, onExitGuestMode }) {
  const modalRef = useRef(null)
  const primaryButtonRef = useRef(null)

  useEffect(() => {
    if (!isOpen) return undefined

    // Focus primary button on mount for accessibility
    const timer = setTimeout(() => {
      primaryButtonRef.current?.focus()
    }, 50)

    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="guest-modal-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        className="guest-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="guest-modal-title"
        aria-describedby="guest-modal-description"
        ref={modalRef}
      >
        <div className="guest-modal-header">
          <div className="guest-modal-icon-badge">
            <ShieldCheck size={28} />
          </div>
          <div>
            <h2 id="guest-modal-title" className="guest-modal-title">
              Guest Preview Mode
            </h2>
            <span className="guest-modal-subtitle">Enterprise WMS — Read-Only Architecture</span>
          </div>
        </div>

        <p id="guest-modal-description" className="guest-modal-description">
          You are viewing a preview of the Enterprise WMS interface. Business records, financial
          information and operational actions are hidden to protect private data. Sign in with an
          authorized account to access the full functionality.
        </p>

        <div className="guest-modal-features-list">
          <div className="guest-modal-feature-item">
            <span className="guest-modal-dot" />
            <span>Actual layouts, menus, navigation and tables</span>
          </div>
          <div className="guest-modal-feature-item">
            <span className="guest-modal-dot" />
            <span>Zero database or sensitive business data revealed</span>
          </div>
          <div className="guest-modal-feature-item">
            <span className="guest-modal-dot" />
            <span>Interactive modifications restricted to authorized roles</span>
          </div>
        </div>

        <div className="guest-modal-actions">
          <button
            type="button"
            className="button button-primary guest-modal-btn-continue"
            ref={primaryButtonRef}
            onClick={onClose}
          >
            <span>Continue Preview</span>
            <ArrowRight size={16} />
          </button>

          <button
            type="button"
            className="button button-secondary guest-modal-btn-exit"
            onClick={onExitGuestMode}
          >
            <LogOut size={16} />
            <span>Exit Guest Mode</span>
          </button>
        </div>
      </div>
    </div>
  )
}
