export const DEFAULT_API_STALE_TIME = 5 * 60 * 1000
export const DEFAULT_API_GC_TIME = 30 * 60 * 1000

const apiCache = new Map()

function stableStringify(value) {
  if (!value || typeof value !== 'object') {
    return String(value ?? '')
  }

  return JSON.stringify(
    Object.keys(value)
      .sort()
      .reduce((result, key) => ({
        ...result,
        [key]: value[key],
      }), {}),
  )
}

export function createApiCacheKey(namespace, value = '') {
  return `${namespace}:${typeof value === 'string' ? value : stableStringify(value)}`
}

export function hasApiCache(key) {
  const entry = apiCache.get(key)
  return Boolean(entry?.data && Date.now() - entry.updatedAt < entry.gcTime)
}

export function readApiCache(key) {
  const entry = apiCache.get(key)
  return hasApiCache(key) ? entry.data : null
}

export function invalidateApiCache(prefix = '') {
  if (!prefix) {
    apiCache.clear()
    return
  }

  Array.from(apiCache.keys()).forEach((key) => {
    if (key.startsWith(prefix)) {
      apiCache.delete(key)
    }
  })
}

export async function cachedApiRequest(key, loader, options = {}) {
  const {
    force = false,
    staleTime = DEFAULT_API_STALE_TIME,
    gcTime = DEFAULT_API_GC_TIME,
  } = options
  const now = Date.now()
  const currentEntry = apiCache.get(key)

  if (!force && currentEntry?.data && now - currentEntry.updatedAt < gcTime) {
    if (now - currentEntry.updatedAt > staleTime && !currentEntry.promise) {
      const promise = loader()
        .then((data) => {
          apiCache.set(key, {
            data,
            updatedAt: Date.now(),
            staleTime,
            gcTime,
            promise: null,
          })
          return data
        })
        .catch(() => {
          apiCache.set(key, {
            ...currentEntry,
            promise: null,
          })
          return currentEntry.data
        })

      apiCache.set(key, {
        ...currentEntry,
        promise,
      })
    }

    return {
      ...currentEntry.data,
      fromCache: true,
    }
  }

  if (!force && currentEntry?.promise) {
    return currentEntry.promise
  }

  const promise = loader()
    .then((data) => {
      apiCache.set(key, {
        data,
        updatedAt: Date.now(),
        staleTime,
        gcTime,
        promise: null,
      })

      return data
    })
    .catch((error) => {
      if (currentEntry?.data) {
        apiCache.set(key, {
          ...currentEntry,
          promise: null,
        })
      } else {
        apiCache.delete(key)
      }

      throw error
    })

  apiCache.set(key, {
    data: currentEntry?.data ?? null,
    updatedAt: currentEntry?.updatedAt ?? 0,
    staleTime,
    gcTime,
    promise,
  })

  return promise
}
