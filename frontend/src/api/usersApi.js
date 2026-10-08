import apiClient from './apiClient'
import { cachedApiRequest, createApiCacheKey, hasApiCache, invalidateApiCache } from './apiCache'

const USERS_CACHE_PREFIX = 'users:'

export function invalidateUsersCache() {
  invalidateApiCache(USERS_CACHE_PREFIX)
}

export function getUsers(options = {}) {
  return cachedApiRequest(
    createApiCacheKey(USERS_CACHE_PREFIX, 'list'),
    async () => {
      try {
        const response = await apiClient.get('/Users')
        return {
          success: true,
          data: response.data
        }
      } catch (error) {
        return {
          success: false,
          data: []
        }
      }
    },
    options,
  )
}
getUsers.hasCache = () => hasApiCache(createApiCacheKey(USERS_CACHE_PREFIX, 'list'))

