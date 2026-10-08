import { useRef } from 'react'
import { ChevronLeft, ChevronRight, ChevronUp, Menu, User } from 'lucide-react'
import imsSidebarIcon from '../../assets/brand/ims-sidebar-icon.png'
import SidebarItem from './SidebarItem'
import SidebarSection from './SidebarSection'

const SECTIONS = [
  { key: 'admin', title: 'Admin' },
  { key: 'masters', title: 'Masters' },
  { key: 'inventory', title: 'Inventory' },
  { key: 'pos', title: 'POS' },
  { key: 'management', title: 'Management' },
  { key: 'billing', title: 'Billing' },
]

function getInitials(value) {
  const parts = String(value || 'IMS')
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)

  return parts.map((part) => part.charAt(0).toUpperCase()).join('') || 'B'
}

export default function Sidebar({
  user,
  visibleItems,
  isCollapsed,
  isDrawerOpen,
  isMenuOpen,
  onToggleMenu,
  onOpenMenu,
  onCloseMenu,
  onToggleCollapsed,
  onCloseDrawer,
  onTouchStart,
  onTouchMove,
}) {
  const navRef = useRef(null)
  const dashboardItems = visibleItems.filter((item) => item.category === 'dashboard')
  const userName = user?.name || user?.email?.split('@')[0] || 'Bhargava'
  const userRole = user?.role || 'Admin'
  const userInitials = getInitials(userName)

  function getVisibleNavItems() {
    if (!navRef.current) {
      return []
    }

    return Array.from(navRef.current.querySelectorAll('[data-sidebar-focusable="true"]'))
      .filter((item) => {
        const styles = window.getComputedStyle(item)
        return styles.visibility !== 'hidden' && styles.display !== 'none' && item.offsetParent !== null
      })
  }

  function focusNavItem(item) {
    const nav = navRef.current
    item?.focus({ preventScroll: true })
    if (!item || !nav) {
      return
    }

    const itemRect = item.getBoundingClientRect()
    const navRect = nav.getBoundingClientRect()
    const topOverflow = itemRect.top - navRect.top
    const bottomOverflow = itemRect.bottom - navRect.bottom

    if (topOverflow < 0) {
      nav.scrollBy({ top: topOverflow - 8, behavior: 'smooth' })
    } else if (bottomOverflow > 0) {
      nav.scrollBy({ top: bottomOverflow + 8, behavior: 'smooth' })
    }
  }

  function handleNavKeyDown(event) {
    const navigationKeys = ['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft', 'Home', 'End', 'Enter']
    if (!navigationKeys.includes(event.key)) {
      return
    }

    const visibleNavItems = getVisibleNavItems()
    if (visibleNavItems.length === 0) {
      return
    }

    const activeElement = document.activeElement
    const currentIndex = Math.max(0, visibleNavItems.indexOf(activeElement))

    if (event.key === 'Enter' && activeElement?.matches?.('[data-sidebar-item-link="true"]')) {
      event.preventDefault()
      activeElement.click()
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      focusNavItem(visibleNavItems[Math.min(currentIndex + 1, visibleNavItems.length - 1)])
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      focusNavItem(visibleNavItems[Math.max(currentIndex - 1, 0)])
      return
    }

    if (event.key === 'Home') {
      event.preventDefault()
      focusNavItem(visibleNavItems[0])
      return
    }

    if (event.key === 'End') {
      event.preventDefault()
      focusNavItem(visibleNavItems[visibleNavItems.length - 1])
      return
    }

    const sectionButton = activeElement?.closest?.('[data-sidebar-section-button="true"]')
    const section = activeElement?.closest?.('.app-sidebar__section')
    const parentSectionButton = section?.querySelector?.('[data-sidebar-section-button="true"]')

    if (event.key === 'ArrowRight' && sectionButton?.dataset.sidebarSectionOpen !== 'true') {
      event.preventDefault()
      onOpenMenu(sectionButton.dataset.sidebarSectionKey)
      return
    }

    if (event.key === 'ArrowLeft') {
      const collapsibleButton = sectionButton || parentSectionButton
      if (collapsibleButton?.dataset.sidebarSectionOpen === 'true') {
        event.preventDefault()
        onCloseMenu(collapsibleButton.dataset.sidebarSectionKey)
        focusNavItem(collapsibleButton)
      }
    }
  }

  return (
    <aside
      className={`app-sidebar ${isDrawerOpen ? 'is-open' : ''}`}
      aria-label="Workspace navigation"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
    >
      <div className="app-sidebar__brand">
        <div className="app-sidebar__brand-badge">
          <div className="app-sidebar__brand-mark" aria-hidden="true">
            <img src={imsSidebarIcon} alt="IMS" />
          </div>
          <div className="app-sidebar__brand-copy">
            <strong>IMS</strong>
            <span>Inventory Management System</span>
          </div>
        </div>
        <button
          type="button"
          className="app-sidebar__collapse-toggle"
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!isCollapsed}
          onClick={onToggleCollapsed}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <Menu size={17} /> : <ChevronLeft size={17} />}
        </button>
      </div>

      <nav
        ref={navRef}
        className="app-sidebar__nav"
        aria-label="Primary navigation"
        role="navigation"
        onKeyDown={handleNavKeyDown}
      >
        {dashboardItems.length > 0 ? (
          <div className="app-sidebar__dashboard">
            {dashboardItems.map((item) => (
              <SidebarItem key={item.path} item={item} isCollapsed={isCollapsed} />
            ))}
          </div>
        ) : null}

        {SECTIONS.map((section) => (
          <SidebarSection
            key={section.key}
            sectionKey={section.key}
            title={section.title}
            items={visibleItems.filter((item) => item.category === section.key)}
            isOpen={isMenuOpen(section.key)}
            isCollapsed={isCollapsed}
            onToggle={() => onToggleMenu(section.key)}
          />
        ))}
      </nav>
    </aside>
  )
}
