export const NAME_MAX_LENGTH = 50

export function stripUnsafeNameText(value) {
  return Array.from(String(value ?? '')).filter((character) => {
    const code = character.charCodeAt(0)
    return !(
      code <= 31 ||
      (code >= 127 && code <= 159) ||
      (code >= 0x200B && code <= 0x200D) ||
      code === 0xFEFF
    )
  }).join('')
}

export function autoCapitalizeWords(text) {
  if (typeof text !== 'string' || !text) return text
  return text.replace(/(?:^|[\s'-])\p{L}/gu, (match) => match.toUpperCase())
}

export function shouldAutoCapitalizeField(fieldName = '', fieldType = '') {
  if (!fieldName || fieldType === 'email' || fieldType === 'password' || fieldType === 'number' || fieldType === 'tel') {
    return false
  }

  const name = String(fieldName).toLowerCase()
  if (name.includes('email') || name.includes('password') || name.includes('url') || name.includes('sku') || name.includes('barcode') || name.includes('code') || name.includes('website')) {
    return false
  }

  return (
    name.includes('name') ||
    name.includes('title') ||
    name.includes('role') ||
    name.includes('designation') ||
    name.includes('department') ||
    name.includes('city') ||
    name.includes('state') ||
    name.includes('country') ||
    name.includes('address') ||
    name.includes('label') ||
    name.includes('brand') ||
    name.includes('category') ||
    name.includes('unit') ||
    name.includes('attribute') ||
    name.includes('supplier') ||
    name.includes('customer') ||
    name.includes('warehouse') ||
    name.includes('bin') ||
    name.includes('rack')
  )
}

export function sanitizeNameInput(value, maxLength = NAME_MAX_LENGTH) {
  return stripUnsafeNameText(value)
    .normalize('NFKC')
    .replace(/[<>]/g, '')
    .slice(0, maxLength)
}

export function getNameError(value, options = {}) {
  const opts = typeof options === 'string' ? { label: options } : options
  const {
    required = true,
    label = 'Full Name',
    min = 2,
    max = NAME_MAX_LENGTH,
  } = opts

  const rawValue = String(value ?? '')
  const cleanValue = rawValue.trim()

  if (!cleanValue) {
    return required ? `${label} is required.` : ''
  }

  const pattern = /^(?=.*[a-zA-Z\p{L}])[a-zA-Z\p{L}0-9\s.,&'/\-()]+$/u
  if (!pattern.test(cleanValue)) {
    return `${label} contains invalid characters.`
  }

  if (cleanValue.length < min) {
    return `${label} must contain at least ${min} characters.`
  }

  if (cleanValue.length > max) {
    return `${label} cannot exceed ${max} characters.`
  }

  // Reject 3 or more consecutive identical characters (e.g. "aaa")
  if (/([\p{L}a-zA-Z])\1\1/u.test(cleanValue)) {
    return `${label} contains invalid repeated characters.`
  }

  // Reject single words longer than 15 characters
  const nameWords = cleanValue.split(/[\s'-]+/)
  if (nameWords.some((word) => word.length > 15)) {
    return `${label} cannot contain words longer than 15 characters.`
  }

  // Gibberish / keyboard mashing validation
  const lower = cleanValue.toLowerCase()

  // Reject 4 or more repeated identical characters
  if (/(.)\1{3,}/i.test(cleanValue)) {
    return 'Please enter a valid name.'
  }

  // Reject repeated character blocks (e.g., "asdfasdf", "ababab")
  if (/(.{2,4})\1{2,}/i.test(cleanValue)) {
    return 'Please enter a valid name.'
  }

  // Reject 5 or more consecutive consonants (e.g. "jhjjhhyh")
  if (/[bcdfghjklmnpqrstvwxz]{5,}/i.test(cleanValue)) {
    return 'Please enter a valid name.'
  }

  // Keyboard row walks
  const keyboardWalks = ['qwerty', 'asdfgh', 'zxcvbn', 'qwertz', 'azerty', 'yuiop', 'ghjkl', 'fghjk', 'xcvbn']
  if (keyboardWalks.some((walk) => lower.includes(walk))) {
    return 'Please enter a valid name.'
  }

  // Reject words with 5+ characters that have no vowels
  const words = cleanValue.split(/\s+/)
  for (const word of words) {
    const lettersOnly = word.replace(/[^a-zA-Z\p{L}]/gu, '')
    if (lettersOnly.length >= 5 && !/[aeiouyAEIOUY]/i.test(lettersOnly)) {
      return 'Please enter a valid name.'
    }
  }

  return ''
}

export function isValidName(value, options = {}) {
  return !getNameError(value, options)
}

export const nameInputProps = {
  type: 'text',
  autoComplete: 'name',
  maxLength: NAME_MAX_LENGTH,
}
