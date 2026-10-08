import { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import AccessDenied from '../components/common/AccessDenied'
import AppLayout from '../components/layout/AppLayout'
import Header from '../components/layout/Header'
import PageContainer from '../components/layout/PageContainer'
import Sidebar from '../components/layout/Sidebar'
import { useAuth } from '../hooks/useAuth'
import { getNavItem, NAV_ITEMS } from '../utils/permissions'
import './MainLayout.css'

const SIDEBAR_COLLAPSED_KEY = 'ims-sidebar-collapsed'
const SIDEBAR_OPEN_MENU_KEY = 'ims-sidebar-open-menu'
const SIDEBAR_MENU_KEYS = ['admin', 'masters', 'inventory', 'pos', 'management', 'billing']

function getActiveMenuKey(pathname) {
  const activeItem = getNavItem(pathname)
  return SIDEBAR_MENU_KEYS.includes(activeItem?.category) ? activeItem.category : ''
}

function getInitialCollapsedState() {
  if (typeof window === 'undefined') {
    return false
  }

  return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true'
}

function getStoredOpenMenuKey() {
  if (typeof window === 'undefined') {
    return ''
  }

  const storedMenu = window.localStorage.getItem(SIDEBAR_OPEN_MENU_KEY)
  return SIDEBAR_MENU_KEYS.includes(storedMenu) ? storedMenu : ''
}

export default function MainLayout() {
  const { user, logout, hasPermission } = useAuth()
  const location = useLocation()
  const [openMenuKey, setOpenMenuKey] = useState(() => getActiveMenuKey(location.pathname) || getStoredOpenMenuKey())
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(getInitialCollapsedState)
  const mainRef = useRef(null)
  const drawerTouchStartX = useRef(null)

  const isCustomersRoute = location.pathname.startsWith('/people/customers')
  const visibleItems = NAV_ITEMS.filter((item) =>
    hasPermission(item.key, 'view'),
  )
  const activeItem = getNavItem(location.pathname)
  const canViewPage = activeItem ? hasPermission(activeItem.key, 'view') : true

  useEffect(() => {
    setIsDrawerOpen(false)
    const activeMenuKey = getActiveMenuKey(location.pathname)

    setOpenMenuKey((currentMenuKey) =>
      activeMenuKey ||
      (SIDEBAR_MENU_KEYS.includes(currentMenuKey) ? currentMenuKey : getStoredOpenMenuKey()),
    )
  }, [location.pathname])

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, left: 0 })
  }, [location.pathname])

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(isSidebarCollapsed))
  }, [isSidebarCollapsed])

  useEffect(() => {
    if (openMenuKey) {
      window.localStorage.setItem(SIDEBAR_OPEN_MENU_KEY, openMenuKey)
      return
    }

    window.localStorage.removeItem(SIDEBAR_OPEN_MENU_KEY)
  }, [openMenuKey])

  useEffect(() => {
    if (!isDrawerOpen) {
      document.body.classList.remove('is-drawer-open')
      return undefined
    }

    document.body.classList.add('is-drawer-open')

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsDrawerOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.classList.remove('is-drawer-open')
    }
  }, [isDrawerOpen])

  function handleDrawerTouchStart(event) {
    drawerTouchStartX.current = event.touches?.[0]?.clientX ?? null
  }

  function handleDrawerTouchMove(event) {
    if (drawerTouchStartX.current === null) {
      return
    }

    const currentX = event.touches?.[0]?.clientX ?? drawerTouchStartX.current
    const deltaX = currentX - drawerTouchStartX.current

    if (deltaX < -64) {
      setIsDrawerOpen(false)
      drawerTouchStartX.current = null
    }
  }

  function isMenuOpen(menu) {
    return openMenuKey === menu
  }

  function toggleMenu(menu) {
    setOpenMenuKey((currentMenu) => (currentMenu === menu ? '' : menu))
  }

  function openMenu(menu) {
    setOpenMenuKey(SIDEBAR_MENU_KEYS.includes(menu) ? menu : '')
  }

  function closeMenu(menu) {
    setOpenMenuKey((currentMenu) => (currentMenu === menu ? '' : currentMenu))
  }

  function toggleSidebarCollapsed() {
    setIsSidebarCollapsed((value) => !value)
  }

  return (
    <AppLayout
      className={isCustomersRoute ? 'app-shell--customers' : ''}
      isCollapsed={isSidebarCollapsed}
      isDrawerOpen={isDrawerOpen}
    >
      <button
        type="button"
        className="app-shell__drawer-overlay"
        aria-label="Close navigation"
        hidden={!isDrawerOpen}
        onClick={() => setIsDrawerOpen(false)}
      />

      <Sidebar
        user={user}
        visibleItems={visibleItems}
        isCollapsed={isSidebarCollapsed}
        isDrawerOpen={isDrawerOpen}
        isMenuOpen={isMenuOpen}
        onToggleMenu={toggleMenu}
        onOpenMenu={openMenu}
        onCloseMenu={closeMenu}
        onToggleCollapsed={toggleSidebarCollapsed}
        onCloseDrawer={() => setIsDrawerOpen(false)}
        onTouchStart={handleDrawerTouchStart}
        onTouchMove={handleDrawerTouchMove}
      />

      <div className="app-shell__content">
        <Header
          user={user}
          onLogout={logout}
          onOpenDrawer={() => setIsDrawerOpen(true)}
        />

        <PageContainer mainRef={mainRef}>
          {canViewPage ? <Outlet /> : <AccessDenied />}
        </PageContainer>
      </div>
    </AppLayout>
  )
}
