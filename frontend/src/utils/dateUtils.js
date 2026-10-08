/**
 * Centralized Date Utility Module
 * Handles date-only values (YYYY-MM-DD) and timestamps (ISO 8601) in a timezone-safe manner.
 * Prevents 1-day date shifting caused by UTC conversions on local date-only strings.
 */

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}/

/**
 * Returns today's local date formatted as YYYY-MM-DD without UTC timezone shifting.
 * @returns {string} e.g. "2026-08-05"
 */
export function getLocalTodayDate() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Converts any date representation (string, Date object) into a safe YYYY-MM-DD format for <input type="date">.
 * @param {string|Date|null|undefined} value
 * @returns {string} e.g. "2026-08-05" or ""
 */
export function toDateInputValue(value) {
  if (value === null || value === undefined || value === '') {
    return ''
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return ''
    const year = value.getFullYear()
    const month = String(value.getMonth() + 1).padStart(2, '0')
    const day = String(value.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const strVal = String(value).trim()
  if (!strVal) return ''

  // If already YYYY-MM-DD or starts with YYYY-MM-DD
  if (DATE_ONLY_REGEX.test(strVal)) {
    return strVal.slice(0, 10)
  }

  // Fallback parsing
  const parsed = new Date(strVal)
  if (Number.isNaN(parsed.getTime())) return ''

  const year = parsed.getFullYear()
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  const day = String(parsed.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Formats a date-only or timestamp value into DD-MM-YYYY for UI display.
 * @param {string|Date|null|undefined} value
 * @param {string} fallback
 * @returns {string} e.g. "05-08-2026" or "-"
 */
export function formatDateForDisplay(value, fallback = '-') {
  const dateInput = toDateInputValue(value)
  if (!dateInput) return fallback

  const parts = dateInput.split('-')
  if (parts.length !== 3) return fallback

  return `${parts[2]}-${parts[1]}-${parts[0]}`
}

/**
 * Formats a date-time timestamp into DD-MM-YYYY hh:mm A for UI display.
 * @param {string|Date|null|undefined} value
 * @param {string} fallback
 * @returns {string} e.g. "05-08-2026 05:15 PM" or "-"
 */
export function formatDateTimeForDisplay(value, fallback = '-') {
  if (!value) return fallback

  const parsed = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(parsed.getTime())) return fallback

  const day = String(parsed.getDate()).padStart(2, '0')
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  const year = parsed.getFullYear()

  let hours = parsed.getHours()
  const minutes = String(parsed.getMinutes()).padStart(2, '0')
  const ampm = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12
  hours = hours ? hours : 12
  const formattedHours = String(hours).padStart(2, '0')

  return `${day}-${month}-${year} ${formattedHours}:${minutes} ${ampm}`
}

/**
 * Normalizes date-only values for API payloads.
 * Keeps YYYY-MM-DD format intact without converting to UTC ISO string (which shifts dates).
 * @param {string|Date|null|undefined} value
 * @returns {string|null} e.g. "2026-08-05" or null
 */
export function normaliseDateOnlyPayload(value) {
  const inputVal = toDateInputValue(value)
  return inputVal || null
}

/**
 * Checks whether a given value is a valid date.
 * @param {any} value
 * @returns {boolean}
 */
export function isValidDateValue(value) {
  if (!value) return false
  const inputVal = toDateInputValue(value)
  return Boolean(inputVal)
}

/**
 * Compares two date-only values.
 * Returns -1 if first < second, 1 if first > second, 0 if equal.
 * @param {string|Date} first
 * @param {string|Date} second
 * @returns {number}
 */
export function compareDateOnly(first, second) {
  const d1 = toDateInputValue(first)
  const d2 = toDateInputValue(second)

  if (!d1 || !d2) return 0
  if (d1 < d2) return -1
  if (d1 > d2) return 1
  return 0
}

/**
 * Safely parses any date/timestamp representation (string, Date object, numeric epoch) into a valid Date object.
 * Does not force UTC suffixes on local ISO date-time strings.
 * @param {string|Date|number|null|undefined} value
 * @returns {Date|null}
 */
export function parseDateValue(value) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

  const strVal = String(value).trim()
  if (!strVal) {
    return null
  }

  // Handle epoch timestamps (numeric)
  if (/^\d+$/.test(strVal)) {
    const num = Number(strVal)
    const ms = strVal.length === 10 ? num * 1000 : num
    const date = new Date(ms)
    return Number.isNaN(date.getTime()) ? null : date
  }

  // Parse ISO string or date string directly without modifying timezone
  const date = new Date(strVal)
  if (!Number.isNaN(date.getTime())) {
    return date
  }

  // Fallback for space-separated date-time strings (e.g. "2026-08-14 17:00:00")
  const normalized = strVal.replace(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}(?::\d{2})?)/, '$1T$2')
  const fallbackDate = new Date(normalized)
  return Number.isNaN(fallbackDate.getTime()) ? null : fallbackDate
}

/**
 * Calculates human-readable relative time (e.g. "Just now", "5 min ago", "2 hours ago", "in 10 min").
 * Accurately determines past ("ago") vs future ("from now") relative times.
 * @param {string|Date|number|null|undefined} value
 * @returns {string}
 */
export function formatRelativeTime(value) {
  if (!value) {
    return 'Recently'
  }

  const date = parseDateValue(value)
  if (!date) {
    return 'Recently'
  }

  const now = Date.now()
  let diffMs = now - date.getTime()

  // Handle future-leaning timestamps caused by server clock skew or UTC/local timezone mismatch
  if (diffMs < 0) {
    const absDiffMinutes = Math.abs(diffMs) / 60000

    // If within 5 minutes into the future, treat as server clock skew for a recent action -> "Just now"
    if (absDiffMinutes <= 5) {
      return 'Just now'
    }

    // Account for timezone offset mismatch (e.g. server timestamp in local time tagged as UTC)
    const tzOffsetMs = new Date().getTimezoneOffset() * 60000
    const adjustedTime = date.getTime() + tzOffsetMs
    const adjustedDiffMs = now - adjustedTime

    if (adjustedDiffMs >= 0) {
      diffMs = adjustedDiffMs
    } else {
      const adjustedAbsMins = Math.abs(adjustedDiffMs) / 60000
      if (adjustedAbsMins <= 15) {
        return 'Just now'
      }
      diffMs = adjustedDiffMs
    }
  }

  const diffSeconds = Math.round(diffMs / 1000)
  const diffMinutes = Math.round(diffMs / 60000)
  const absMinutes = Math.abs(diffMinutes)
  const isFuture = diffMs < -60000

  const suffix = isFuture ? 'from now' : 'ago'

  if (!isFuture && diffSeconds >= -60 && diffSeconds < 45) {
    return 'Just now'
  }

  if (absMinutes < 60) {
    const mins = Math.max(1, absMinutes)
    return `${mins} min ${suffix}`
  }

  const absHours = Math.round(absMinutes / 60)
  if (absHours < 24) {
    return `${absHours} ${absHours === 1 ? 'hour' : 'hours'} ${suffix}`
  }

  const absDays = Math.round(absHours / 24)
  if (absDays < 30) {
    return `${absDays} ${absDays === 1 ? 'day' : 'days'} ${suffix}`
  }

  const absMonths = Math.round(absDays / 30)
  return `${absMonths}mo ${suffix}`
}

/**
 * Formats activity timestamps with exact date, month, year, time, and relative age for audit precision.
 * @param {string|Date|number|null|undefined} value
 * @returns {string} e.g. "20-08-2026 05:15 PM • 2 days ago" or "Recently"
 */
export function formatExactTimestamp(value) {
  if (!value) return 'Recently'
  const exactTime = formatDateTimeForDisplay(value, '')
  const relativeTime = formatRelativeTime(value)
  if (!exactTime) return relativeTime
  return `${exactTime} • ${relativeTime}`
}

/**
 * Adds a specified number of days to a YYYY-MM-DD date string without UTC timezone shifting.
 * @param {string|Date|null|undefined} dateStr
 * @param {number} days
 * @returns {string} e.g. "2026-09-15"
 */
export function addDaysToDate(dateStr, days = 7) {
  const inputVal = toDateInputValue(dateStr) || getLocalTodayDate()
  const parts = inputVal.split('-')
  if (parts.length !== 3) return getLocalTodayDate()

  const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
  date.setDate(date.getDate() + days)

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Returns rawRequiredDate if it is strictly later than indentDateStr, or defaults to indentDateStr + defaultDays.
 * @param {string|Date|null|undefined} rawRequiredDate
 * @param {string|Date|null|undefined} indentDateStr
 * @param {number} defaultDays
 * @returns {string} e.g. "2026-09-15"
 */
export function getLogicalRequiredDate(rawRequiredDate, indentDateStr, defaultDays = 7) {
  const reqDate = toDateInputValue(rawRequiredDate)
  const indDate = toDateInputValue(indentDateStr) || getLocalTodayDate()

  if (reqDate && compareDateOnly(reqDate, indDate) > 0) {
    return reqDate
  }

  return addDaysToDate(indDate, defaultDays)
}

