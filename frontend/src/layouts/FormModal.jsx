import { X } from 'lucide-react'
import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import './FormModal.css'

export default function FormModal({
  title,
  subtitle,
  icon: Icon,
  children,
  onClose,
  closeOnBackdropClick = true,
  className = '',
  dialogClassName = '',
  bodyClassName = '',
}) {
  const titleId = useId()
  const subtitleId = useId()
  const dialogRef = useRef(null)
  const previouslyFocusedElementRef = useRef(null)
  const onCloseRef = useRef(onClose)
  const isDestructiveConfirmation =
    typeof title === 'string' && /\b(delete|remove)\b/i.test(title)
  const visibleSubtitle = isDestructiveConfirmation ? null : subtitle
  const VisibleIcon = isDestructiveConfirmation ? null : Icon

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    previouslyFocusedElementRef.current = document.activeElement
    const mainElements = document.querySelectorAll('.app-shell__main')
    const originalMainOverflows = Array.from(mainElements).map((el) => el.style.overflow)

    function getFocusableElements() {
      return Array.from(
        dialogRef.current?.querySelectorAll(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) || [],
      ).filter((element) => element.offsetParent !== null)
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onCloseRef.current?.()
        return
      }

      if (event.key !== 'Tab') {
        return
      }

      const focusableElements = getFocusableElements()

      if (focusableElements.length === 0) {
        event.preventDefault()
        dialogRef.current?.focus()
        return
      }

      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault()
        lastElement.focus()
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault()
        firstElement.focus()
      }
    }

    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
    document.body.style.overflow = 'hidden'
    document.body.style.paddingRight = `${scrollbarWidth}px`
    mainElements.forEach((el) => {
      el.style.overflow = 'hidden'
    })

    document.addEventListener('keydown', handleKeyDown)
    window.requestAnimationFrame(() => {
      if (dialogRef.current?.contains(document.activeElement) && document.activeElement !== dialogRef.current) {
        return
      }
      const autoFocusElement = dialogRef.current?.querySelector('[autofocus], input[autofocus]')
      if (autoFocusElement) {
        autoFocusElement.focus()
        return
      }
      const focusableElements = getFocusableElements()
      ;(focusableElements[0] || dialogRef.current)?.focus()
    })

    return () => {
      document.body.style.overflow = previousOverflow
      document.body.style.paddingRight = ''
      mainElements.forEach((el, index) => {
        el.style.overflow = originalMainOverflows[index] || ''
      })
      document.removeEventListener('keydown', handleKeyDown)
      previouslyFocusedElementRef.current?.focus?.()
    }
  }, [])

  return createPortal(
    <div
      className={`form-modal ${isDestructiveConfirmation ? 'form-modal--delete-confirmation' : ''} ${className}`.trim()}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
      aria-describedby={visibleSubtitle ? subtitleId : undefined}
      onClick={closeOnBackdropClick ? onClose : undefined}
    >
      <div
        className={`form-modal__dialog ${isDestructiveConfirmation ? 'form-modal__dialog--delete-confirmation' : ''} ${dialogClassName}`.trim()}
        ref={dialogRef}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="form-modal__header">
          <div className="form-modal__heading">
            <div>
              {title ? <h2 className="form-modal__title" id={titleId}>{title}</h2> : null}
              {visibleSubtitle ? (
                <p className="form-modal__subtitle" id={subtitleId}>{visibleSubtitle}</p>
              ) : null}
            </div>
          </div>

          <button
            type="button"
            className="form-modal__close"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={13} />
          </button>
        </div>

        <div
          className={`form-modal__body ${isDestructiveConfirmation ? 'form-modal__body--delete-confirmation' : ''} ${bodyClassName}`.trim()}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body,
  )
}
