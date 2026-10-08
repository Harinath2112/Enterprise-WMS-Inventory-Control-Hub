export const IMS_TOAST_EVENT = 'ims:toast'

let lastToastKey = ''
let lastToastAt = 0

function sanitizeToastMessage(message) {
  const value = String(message ?? '').trim()

  if (/normalizeCategory\s+is\s+not\s+defined/i.test(value)) {
    return 'Invalid category name. Please select from predefined categories.'
  }

  if (/is\s+not\s+defined|referenceerror|typeerror|syntaxerror|cannot\s+read\s+propert|is\s+not\s+a\s+function|uncaught\b/i.test(value)) {
    return 'An unexpected error occurred. Please try again.'
  }

  if (/vite_api_base_url|backend server|ims api|failed to fetch|networkerror|load failed/i.test(value)) {
    return 'Unable to connect to the server.'
  }

  if (/stack trace|exception|system\.|microsoft\.|sql|object reference/i.test(value)) {
    return 'We are having trouble completing this request right now.'
  }

  return value
}

export function showToast(detail, typeArg) {
  if (typeof window === 'undefined') {
    return
  }

  let toastConfig = {}
  if (typeof detail === 'string') {
    const type = (typeof typeArg === 'string' && typeArg) ? typeArg : 'info'
    toastConfig = {
      type,
      title: type === 'success' ? 'Success' : type === 'error' ? 'Error' : type === 'warning' ? 'Warning' : 'Notification',
      message: detail,
    }
  } else if (detail && typeof detail === 'object') {
    toastConfig = { ...detail }
  }

  const type = toastConfig.type || 'info'
  const defaultTitle = type === 'success' ? 'Success' : type === 'error' ? 'Error' : type === 'warning' ? 'Warning' : 'Notification'

  const nextDetail = {
    duration: 3600,
    type,
    title: toastConfig.title || defaultTitle,
    ...toastConfig,
    message: sanitizeToastMessage(toastConfig.message || (typeof detail === 'string' ? detail : '')),
  }

  const toastKey = [
    nextDetail.type,
    nextDetail.title || '',
    nextDetail.message || '',
  ].join('|')
  const now = Date.now()

  if (toastKey === lastToastKey && now - lastToastAt < 1800) {
    return
  }

  lastToastKey = toastKey
  lastToastAt = now

  window.dispatchEvent(
    new CustomEvent(IMS_TOAST_EVENT, {
      detail: {
        id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
        ...nextDetail,
      },
    }),
  )
}
