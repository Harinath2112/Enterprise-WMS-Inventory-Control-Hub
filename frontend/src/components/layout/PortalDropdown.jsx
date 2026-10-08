import { useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'

function getDropdownPosition(anchor, width = 260) {
  if (!anchor) {
    return { top: 0, left: 0 }
  }

  const rect = anchor.getBoundingClientRect()
  const margin = 12
  const safeWidth = Math.min(width, window.innerWidth - margin * 2)
  const left = Math.min(
    Math.max(margin, rect.right - safeWidth),
    window.innerWidth - safeWidth - margin,
  )

  return {
    top: Math.min(rect.bottom + 10, window.innerHeight - margin),
    left,
    width: safeWidth,
  }
}

export default function PortalDropdown({
  anchorRef,
  children,
  className = '',
  width = 260,
  role = 'menu',
}) {
  const [position, setPosition] = useState(() => ({ top: -9999, left: -9999, width }))

  useLayoutEffect(() => {
    function updatePosition() {
      setPosition(getDropdownPosition(anchorRef.current, width))
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)

    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [anchorRef, width])

  if (typeof document === 'undefined') {
    return null
  }

  return createPortal(
    <div
      className={`app-dropdown app-dropdown--portal ${className}`.trim()}
      role={role}
      style={{
        position: 'fixed',
        top: `${position.top}px`,
        left: `${position.left}px`,
        width: `${position.width}px`,
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      {children}
    </div>,
    document.body,
  )
}
