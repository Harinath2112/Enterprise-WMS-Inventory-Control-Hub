import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { isNavItemMatch } from '../../utils/permissions'

function SidebarSubItem({ item }) {
  const location = useLocation()
  const navigate = useNavigate()

  const isActive = (() => {
    const [itemPathname, itemSearch] = item.path.split('?')
    if (location.pathname !== itemPathname) return false

    if (itemSearch) {
      const itemParams = new URLSearchParams(itemSearch)
      const locParams = new URLSearchParams(location.search)

      for (const [key, val] of itemParams.entries()) {
        if (locParams.get(key) !== val) {
          // Special fallback: if checking tab 'stock' and query parameter is empty/null, it's active
          if (key === 'tab' && val === 'stock' && !locParams.get(key)) {
            continue
          }
          return false
        }
      }
      return true
    }
    return true
  })()

  function handleClick(event) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.altKey ||
      event.ctrlKey ||
      event.shiftKey
    ) {
      return
    }

    event.preventDefault()
    navigate(item.path)
  }

  return (
    <NavLink
      to={item.path}
      onClick={handleClick}
      className={`app-sidebar__link app-sidebar__sub-link ${isActive ? 'is-active' : ''}`}
      aria-current={isActive ? 'page' : undefined}
      data-sidebar-focusable="true"
      data-sidebar-item-link="true"
    >
      <span className="app-sidebar__sub-link-dot" aria-hidden="true" />
      <span className="app-sidebar__link-label">{item.label}</span>
    </NavLink>
  )
}

export default function SidebarItem({ item, isCollapsed }) {
  const Icon = item.icon
  const location = useLocation()
  const navigate = useNavigate()
  const linkRef = useRef(null)
  const [tooltipPosition, setTooltipPosition] = useState(null)

  const hasChildren = item.children && item.children.length > 0
  const isCurrentlyActive = isNavItemMatch(item, location.pathname)
  const [isOpen, setIsOpen] = useState(isCurrentlyActive)

  useEffect(() => {
    if (isCurrentlyActive) {
      setIsOpen(true)
    }
  }, [isCurrentlyActive])

  useEffect(() => {
    if (!isCollapsed) {
      setTooltipPosition(null)
    }
  }, [isCollapsed])

  function handleParentClick(event) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.altKey ||
      event.ctrlKey ||
      event.shiftKey
    ) {
      return
    }

    event.preventDefault()

    if (hasChildren) {
      if (location.pathname === item.path) {
        setIsOpen(!isOpen)
      } else {
        setIsOpen(true)
        navigate(item.path)
      }
    } else {
      navigate(item.path)
    }
  }

  function handleChevronClick(event) {
    event.stopPropagation()
    event.preventDefault()
    setIsOpen(!isOpen)
  }

  function showTooltip() {
    if (!isCollapsed || typeof document === 'undefined') {
      return
    }

    const rect = linkRef.current?.getBoundingClientRect()
    if (!rect) {
      return
    }

    setTooltipPosition({
      left: rect.right + 10,
      top: rect.top + rect.height / 2,
    })
  }

  function hideTooltip() {
    setTooltipPosition(null)
  }

  const tooltip = isCollapsed && tooltipPosition && typeof document !== 'undefined'
    ? createPortal(
        <span
          className="app-sidebar__tooltip"
          style={{
            left: `${tooltipPosition.left}px`,
            top: `${tooltipPosition.top}px`,
          }}
          role="tooltip"
        >
          {item.label}
        </span>,
        document.body,
      )
    : null

  const childrenList = hasChildren && isOpen && !isCollapsed ? (
    <div className="app-sidebar__sub-menu">
      {item.children.map((child) => (
        <SidebarSubItem key={child.path} item={child} />
      ))}
    </div>
  ) : null

  return (
    <div className={`app-sidebar__item-container ${hasChildren && isOpen ? 'is-expanded' : ''}`}>
      <NavLink
        ref={linkRef}
        to={item.path}
        onClick={handleParentClick}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
        className={({ isActive }) =>
          `app-sidebar__link ${isActive || isCurrentlyActive ? 'is-active' : ''}`
        }
        aria-current={isCurrentlyActive ? 'page' : undefined}
        aria-label={isCollapsed ? item.label : undefined}
        data-sidebar-focusable="true"
        data-sidebar-item-link="true"
      >
        <span className="app-sidebar__link-icon" aria-hidden="true">
          <Icon size={20} />
        </span>
        <span className="app-sidebar__link-label">{item.label}</span>

        {isCurrentlyActive && !hasChildren && !isCollapsed && (
          <span className="app-sidebar__active-dot" aria-hidden="true" />
        )}

        {hasChildren && !isCollapsed && (
          <span
            className="app-sidebar__link-chevron-btn"
            onClick={handleChevronClick}
            role="button"
            aria-label={isOpen ? 'Collapse menu' : 'Expand menu'}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                handleChevronClick(e)
              }
            }}
          >
            <ChevronDown
              size={14}
              className={`app-sidebar__link-chevron ${isOpen ? 'is-open' : ''}`}
            />
          </span>
        )}
      </NavLink>
      {tooltip}
      {childrenList}
    </div>
  )
}
