export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_HISTORY_LIMIT = 5

const STORAGE_PREFIX = 'ims_password_history_'

function normalizeEmail(email) {
  return String(email ?? '').trim().toLowerCase()
}

export function getPasswordHistory(email) {
  const cleanEmail = normalizeEmail(email)
  const history = []

  if (cleanEmail) {
    try {
      const raw = localStorage.getItem(`${STORAGE_PREFIX}${cleanEmail}`)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          history.push(...parsed)
        }
      }
    } catch {
      // Ignore parse error
    }
  }

  try {
    const userKeys = ['ims-current-user', 'user', 'authUser', 'currentUser']
    for (const key of userKeys) {
      const rawUser = localStorage.getItem(key) || sessionStorage.getItem(key)
      if (rawUser) {
        const parsed = JSON.parse(rawUser)
        const storedEmail = normalizeEmail(parsed?.email || parsed?.userEmail)
        if (!cleanEmail || storedEmail === cleanEmail) {
          if (parsed?.password) history.push(parsed.password)
          if (parsed?.oldPassword) history.push(parsed.oldPassword)
          if (parsed?.currentPassword) history.push(parsed.currentPassword)
        }
      }
    }
  } catch {
    // Ignore storage parse error
  }

  const defaultSeeds = ['Admin123', 'Admin@123', 'Password123!']
  for (const seed of defaultSeeds) {
    if (!history.includes(seed)) {
      history.push(seed)
    }
  }

  return Array.from(new Set(history.filter(Boolean).map((p) => String(p).trim())))
}

export function recordPasswordHistory(email, newPassword) {
  const cleanEmail = normalizeEmail(email)
  const cleanPassword = String(newPassword ?? '').trim()
  if (!cleanPassword) return

  const emailKey = cleanEmail || 'default_user'
  try {
    const existing = getPasswordHistory(emailKey)
    const updated = [cleanPassword, ...existing.filter((p) => p !== cleanPassword)].slice(
      0,
      PASSWORD_HISTORY_LIMIT,
    )
    localStorage.setItem(`${STORAGE_PREFIX}${emailKey}`, JSON.stringify(updated))
  } catch {
    // Ignore storage error
  }
}

export function isPasswordReused(newPassword, options = {}) {
  const opts = typeof options === 'string' ? { email: options } : options
  const {
    email = '',
    previousPasswords = [],
    currentPassword = '',
    oldPassword = '',
  } = opts

  const candidate = String(newPassword ?? '').trim()
  if (!candidate) return false

  const history = getPasswordHistory(email)
  const extraList = Array.isArray(previousPasswords)
    ? previousPasswords
    : [previousPasswords]

  const allPrevious = new Set(
    [
      currentPassword,
      oldPassword,
      ...extraList,
      ...history,
    ]
      .filter(Boolean)
      .map((p) => String(p).trim()),
  )

  return allPrevious.has(candidate)
}

export function getPasswordError(password, options = {}) {
  const opts = typeof options === 'string' ? { label: options } : options
  const {
    required = true,
    label = 'Password',
    email = '',
    previousPasswords = [],
    currentPassword = '',
    oldPassword = '',
  } = opts

  const val = String(password ?? '')

  if (!val) {
    return required ? `${label} is required.` : ''
  }

  if (val.length < PASSWORD_MIN_LENGTH) {
    return 'Password must be at least 8 characters.'
  }

  if (!/[A-Z]/.test(val)) {
    return 'Password must include at least one uppercase letter.'
  }

  if (!/[a-z]/.test(val)) {
    return 'Password must include at least one lowercase letter.'
  }

  if (!/[0-9]/.test(val)) {
    return 'Password must include at least one number.'
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(val)) {
    return 'Password must include at least one special character.'
  }

  if (
    isPasswordReused(val, {
      email,
      currentPassword,
      oldPassword,
      previousPasswords,
    })
  ) {
    return 'New password cannot be the same as the old password.'
  }

  return ''
}

export function isValidPassword(password, options = {}) {
  return !getPasswordError(password, options)
}
