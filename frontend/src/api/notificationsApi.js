import { apiRequest, getResponseData, getResponseList } from './apiClient'
import { API_ENDPOINTS } from './endpoints'
import { cachedApiRequest, createApiCacheKey, invalidateApiCache } from './apiCache'

export const NOTIFICATIONS_UPDATED_EVENT = 'ims:notifications-updated'
const NOTIFICATIONS_CACHE_PREFIX = 'notifications:'

function text(value) {
  return String(value ?? '').trim()
}

function booleanValue(value) {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value > 0
  return ['true', '1', 'yes', 'read'].includes(text(value).toLowerCase())
}

function emitNotificationsUpdated(detail = {}) {
  invalidateApiCache(NOTIFICATIONS_CACHE_PREFIX)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(NOTIFICATIONS_UPDATED_EVENT, { detail }))
  }
}

export function normalizeNotification(item = {}) {
  const notificationId =
    item.notificationId ??
    item.NotificationId ??
    item.id ??
    item.Id ??
    ''

  return {
    ...item,
    id: notificationId,
    notificationId,
    title: text(item.title ?? item.Title) || 'Notification',
    message: text(item.message ?? item.Message),
    type: text(item.type ?? item.Type) || 'info',
    isRead: booleanValue(item.isRead ?? item.IsRead ?? item.read ?? item.Read),
    createdAt:
      item.createdAt ??
      item.CreatedAt ??
      item.createdDate ??
      item.CreatedDate ??
      '',
  }
}

export async function getNotifications(options = {}) {
  const response = await apiRequest(API_ENDPOINTS.notifications.list, options)

  return response.success
    ? {
        ...response,
        data: getResponseList(response, 'notifications').map(normalizeNotification),
      }
    : response
}

export function getUnreadNotificationCount(options = {}) {
  return cachedApiRequest(
    createApiCacheKey(NOTIFICATIONS_CACHE_PREFIX, 'unread-count'),
    async () => {
      const response = await apiRequest(API_ENDPOINTS.notifications.unreadCount)

      if (!response.success) {
        return response
      }

      const payload = getResponseData(response, 0)
      const value = typeof payload === 'number'
        ? payload
        : payload?.unreadCount ??
          payload?.UnreadCount ??
          payload?.count ??
          payload?.Count ??
          response.data?.unreadCount ??
          response.data?.count ??
          0

      return {
        ...response,
        data: Math.max(0, Number(value) || 0),
      }
    },
    { staleTime: 10000, ...options },
  )
}

export async function createNotification(data) {
  const response = await apiRequest(API_ENDPOINTS.notifications.list, {
    method: 'POST',
    body: {
      title: text(data.title),
      message: text(data.message),
      type: text(data.type) || 'info',
      isRead: Boolean(data.isRead),
    },
  })

  if (response.success) {
    emitNotificationsUpdated({ action: 'created' })
  }

  return response
}

export async function markNotificationRead(id) {
  const response = await apiRequest(API_ENDPOINTS.notifications.read(id), {
    method: 'PUT',
  })

  if (response.success) {
    emitNotificationsUpdated({ action: 'read', id })
  }

  return response
}

export async function deleteNotification(id) {
  const response = await apiRequest(API_ENDPOINTS.notifications.byId(id), {
    method: 'DELETE',
  })

  if (response.success) {
    emitNotificationsUpdated({ action: 'deleted', id })
  }

  return response
}
