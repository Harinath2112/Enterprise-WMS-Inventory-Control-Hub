import { apiRequest, getResponseData, getResponseList } from './apiClient'
import { API_ENDPOINTS } from './endpoints'
import { cachedApiRequest, createApiCacheKey, hasApiCache, invalidateApiCache } from './apiCache'
import { invalidateUsersCache } from './usersApi'

export const ROLES_UPDATED_EVENT = 'ims:roles-updated'
const ROLES_CACHE_PREFIX = 'roles:'

export function invalidateRolesCache() {
  invalidateApiCache(ROLES_CACHE_PREFIX)
}

function roleId(role = {}) {
  return role.roleId ?? role.RoleId ?? role.id ?? role.Id ?? ''
}

function roleName(role = {}) {
  return String(role.roleName ?? role.RoleName ?? role.name ?? role.Name ?? '').trim()
}

function normalizePermissionList(payload) {
  const source = payload?.data ?? payload ?? {}
  const list = Array.isArray(source)
    ? source
    : Array.isArray(source.permissions)
      ? source.permissions
      : []

  return list.reduce((permissions, item) => {
    const moduleKey = String(item.moduleKey ?? item.ModuleKey ?? '').trim()
    if (!moduleKey) return permissions

    const actions = []
    if (item.canView ?? item.CanView) actions.push('view')
    if (item.canAdd ?? item.CanAdd) actions.push('create')
    if (item.canEdit ?? item.CanEdit) actions.push('edit')
    if (item.canDelete ?? item.CanDelete) actions.push('delete')

    permissions[moduleKey] = actions
    return permissions
  }, {})
}

export function notifyRolesUpdated() {
  invalidateRolesCache()
  invalidateUsersCache()
  invalidateApiCache('resource:')
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(ROLES_UPDATED_EVENT))
  }
}

export function getRolesWithPermissions(options = {}) {
  return cachedApiRequest(
    createApiCacheKey(ROLES_CACHE_PREFIX, 'with-permissions'),
    async () => {
      const rolesResponse = await apiRequest(API_ENDPOINTS.permissions.roles)
      if (!rolesResponse.success) return rolesResponse

      const rawRoles = getResponseList(rolesResponse)
      const roleResults = await Promise.all(rawRoles.map(async (role) => {
        const id = roleId(role)
        const name = roleName(role)

        if (!id || !name) {
          return { success: false, error: 'The roles API returned an invalid role record.' }
        }

        const permissionsResponse = await apiRequest(API_ENDPOINTS.permissions.byRole(id))
        if (!permissionsResponse.success) return permissionsResponse

        return {
          success: true,
          data: {
            id,
            roleId: id,
            name,
            roleName: name,
            description: role.description ?? role.Description ?? '',
            isActive: role.isActive ?? role.IsActive ?? false,
            permissions: normalizePermissionList(getResponseData(permissionsResponse, {})),
          },
        }
      }))

      const failedResult = roleResults.find((result) => !result.success)
      if (failedResult) {
        return {
          success: false,
          data: null,
          error: failedResult.error || 'Unable to load role permissions.',
        }
      }

      return {
        success: true,
        data: roleResults.map((result) => result.data),
      }
    },
    options,
  )
}
getRolesWithPermissions.hasCache = () => hasApiCache(createApiCacheKey(ROLES_CACHE_PREFIX, 'with-permissions'))
