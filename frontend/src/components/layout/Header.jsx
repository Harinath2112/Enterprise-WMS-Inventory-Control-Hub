import { FilePlus2, PackageCheck, Plus, Truck, UserPlus, Users } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import GlobalSearch from './GlobalSearch'
import NotificationMenu from './NotificationMenu'
import PortalDropdown from './PortalDropdown'
import UserMenu from './UserMenu'
import ThemeToggle from '../../theme/ThemeToggle'

export default function Header({ user, onLogout, onOpenDrawer }) {
  const [isQuickOpen, setIsQuickOpen] = useState(false)
  const quickRef = useRef(null)
  const quickButtonRef = useRef(null)

  useEffect(() => {
    function handleClick(event) {
      if (!quickRef.current?.contains(event.target)) {
        setIsQuickOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <header className="app-header">
      <div className="app-header__left">
        <GlobalSearch />
      </div>

      <div className="app-header__actions">
        <div className="app-menu" ref={quickRef}>
          <button
            ref={quickButtonRef}
            type="button"
            className="app-header__quick-button"
            aria-expanded={isQuickOpen}
            onClick={() => setIsQuickOpen((value) => !value)}
          >
            <Plus size={16} />
            <span>Quick actions</span>
          </button>
          {isQuickOpen ? (
            <PortalDropdown anchorRef={quickButtonRef} className="app-dropdown--quick" width={240}>
              <Link to="/inventory/products" className="app-dropdown__item" role="menuitem" onClick={() => setIsQuickOpen(false)}>
                <Plus size={16} />
                <span>Add Product</span>
              </Link>
              <Link to="/people/customers" className="app-dropdown__item" role="menuitem" onClick={() => setIsQuickOpen(false)}>
                <Users size={16} />
                <span>Add Customer</span>
              </Link>
              <Link to="/people/suppliers" className="app-dropdown__item" role="menuitem" onClick={() => setIsQuickOpen(false)}>
                <UserPlus size={16} />
                <span>Add Supplier</span>
              </Link>
              <Link to="/inventory/purchases" className="app-dropdown__item" role="menuitem" onClick={() => setIsQuickOpen(false)}>
                <Truck size={16} />
                <span>Create Purchase Order</span>
              </Link>
              <Link to="/management/accounting" className="app-dropdown__item" role="menuitem" onClick={() => setIsQuickOpen(false)}>
                <FilePlus2 size={16} />
                <span>Create Invoice</span>
              </Link>
              <Link to="/inventory/goods-receipts" className="app-dropdown__item" role="menuitem" onClick={() => setIsQuickOpen(false)}>
                <PackageCheck size={16} />
                <span>Goods Receipt</span>
              </Link>
            </PortalDropdown>
          ) : null}
        </div>

        <ThemeToggle />
        <NotificationMenu />
        <UserMenu user={user} onLogout={onLogout} />
      </div>
    </header>
  )
}
