import { Bell, Check } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  NOTIFICATIONS_UPDATED_EVENT,
} from '../../api/notificationsApi'
import { formatDateTime } from '../../utils/helpers'
import PortalDropdown from './PortalDropdown'

export default function NotificationMenu() {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const menuRef = useRef(null)
  const buttonRef = useRef(null)

  const refresh = useCallback(async ({ includeList = false } = {}) => {
    const responses = await Promise.all([
      getUnreadNotificationCount(),
      includeList ? getNotifications() : Promise.resolve(null),
    ])
    const [countResponse, listResponse] = responses

    if (countResponse.success) {
      setUnreadCount(countResponse.data)
    }
    if (listResponse?.success) {
      setNotifications(listResponse.data.slice(0, 6))
    }
  }, [])

  useEffect(() => {
    refresh({ includeList: isOpen })

    const handleUpdate = () => refresh({ includeList: isOpen })
    const intervalId = window.setInterval(handleUpdate, 60000)
    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, handleUpdate)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, handleUpdate)
    }
  }, [isOpen, refresh])

  useEffect(() => {
    function handleClick(event) {
      if (!menuRef.current?.contains(event.target)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function toggleMenu() {
    setIsOpen((current) => !current)
  }

  async function handleRead(notification) {
    if (notification.isRead) return

    const response = await markNotificationRead(notification.id)
    if (!response.success) return

    setNotifications((current) => current.map((item) =>
      String(item.id) === String(notification.id) ? { ...item, isRead: true } : item
    ))
    setUnreadCount((current) => Math.max(0, current - 1))
  }

  return (
    <div className="app-menu" ref={menuRef}>
      <button
        ref={buttonRef}
        type="button"
        className="app-icon-button"
        aria-label="Notifications"
        aria-expanded={isOpen}
        onClick={toggleMenu}
      >
        <Bell size={18} />
        {unreadCount > 0 ? (
          <span className="app-icon-button__badge">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <PortalDropdown anchorRef={buttonRef} className="app-dropdown--notifications" width={360}>
          <div className="app-dropdown__header">
            <strong>Notifications</strong>
            <span>{unreadCount} unread</span>
          </div>

          {isLoading ? (
            <div className="app-dropdown__empty">
              <Bell size={20} />
              <strong>Loading notifications</strong>
            </div>
          ) : notifications.length === 0 ? (
            <div className="app-dropdown__empty">
              <Bell size={20} />
              <strong>No notifications</strong>
              <p>Backend notifications will appear here automatically.</p>
            </div>
          ) : (
            <div className="app-notification-list">
              {notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  className={`app-notification-item ${notification.isRead ? 'is-read' : 'is-unread'}`}
                  onClick={() => handleRead(notification)}
                >
                  <span className="app-notification-item__copy">
                    <strong>{notification.title}</strong>
                    <small>{notification.message}</small>
                    {notification.createdAt ? (
                      <span className="app-notification-item__time">
                        {formatDateTime(notification.createdAt)}
                      </span>
                    ) : null}
                  </span>
                  {!notification.isRead ? <Check size={15} /> : null}
                </button>
              ))}
            </div>
          )}

          <Link
            to="/management/notifications"
            className="app-notification-view-all"
            onClick={() => setIsOpen(false)}
          >
            View all notifications
          </Link>
        </PortalDropdown>
      ) : null}
    </div>
  )
}
