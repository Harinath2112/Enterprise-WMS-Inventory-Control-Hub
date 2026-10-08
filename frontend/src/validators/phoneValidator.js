export const PHONE_MAX_LENGTH = 10

const CONTROL_KEYS = new Set([
  'Backspace',
  'Delete',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
  'Tab',
  'Enter',
])

export function sanitizePhoneInput(value, maxLength = PHONE_MAX_LENGTH) {
  return String(value ?? '').replace(/\D/g, '').slice(0, maxLength)
}

export function getPhoneDigits(value) {
  return sanitizePhoneInput(value)
}

export function getPhoneError(value, label = 'Mobile number') {
  const phone = sanitizePhoneInput(value)

  if (!phone) {
    return `${label} is required.`
  }

  // Indian mobile numbers must start with 6, 7, 8, or 9
  if (!/^[6-9]/.test(phone)) {
    return `${label} must start with 6, 7, 8, or 9 and be exactly 10 digits.`
  }

  if (phone.length !== PHONE_MAX_LENGTH) {
    return `${label} must contain exactly ${PHONE_MAX_LENGTH} digits.`
  }

  // Reject all-same-digit numbers (e.g. 0000000000, 9999999999, 1111111111)
  if (/^(\d)\1{9}$/.test(phone)) {
    return `Please enter a valid ${label.toLowerCase()}.`
  }

  // Reject sequential patterns (e.g. 0123456789, 1234567890)
  const SEQUENTIAL_PATTERNS = ['0123456789', '1234567890']
  if (SEQUENTIAL_PATTERNS.some((seq) => seq === phone)) {
    return `Please enter a valid ${label.toLowerCase()}.`
  }

  return ''
}

export function isValidPhone(value) {
  return !getPhoneError(value)
}

export function blockInvalidPhoneKey(event) {
  if (
    CONTROL_KEYS.has(event.key) ||
    event.ctrlKey ||
    event.metaKey
  ) {
    return
  }

  if (!/^\d$/.test(event.key)) {
    event.preventDefault()
    return
  }

  // Prevent entering invalid leading digit (Indian mobile numbers must start with 6, 7, 8, or 9)
  const target = event.target
  if (target) {
    const isFirstChar =
      (target.selectionStart === 0 && target.value.length === 0) ||
      (target.selectionStart === 0 && target.selectionEnd === target.value.length)
    if (isFirstChar && !/^[6-9]$/.test(event.key)) {
      event.preventDefault()
    }
  }
}

export const phoneInputProps = {
  type: 'tel',
  inputMode: 'numeric',
  pattern: '[0-9]*',
  maxLength: PHONE_MAX_LENGTH,
  onKeyDown: blockInvalidPhoneKey,
}
