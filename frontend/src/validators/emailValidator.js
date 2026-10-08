export const EMAIL_MAX_LENGTH = 150

const VALID_TLDS = new Set([
  'com', 'co', 'org', 'net', 'edu', 'gov', 'mil', 'int', 'info', 'biz', 'in', 'io', 'ai',
  'app', 'dev', 'tech', 'store', 'online', 'site', 'xyz', 'me', 'tv', 'cc', 'mobi', 'asia',
  'name', 'pro', 'tel', 'travel', 'museum', 'uk', 'us', 'ca', 'de', 'fr', 'jp', 'cn', 'nl',
  'se', 'no', 'fi', 'es', 'it', 'ru', 'mx', 'br', 'za', 'sg', 'hk', 'tw', 'kr', 'nz', 'ch',
  'at', 'be', 'dk', 'pl', 'pt', 'cz', 'ro', 'gr', 'hu', 'ie', 'il', 'my', 'ph', 'th', 'vn',
  'id', 'ae', 'sa', 'cl', 'ar', 'pe', 'au', 'cloud', 'digital', 'global',
  'life', 'live', 'media', 'news', 'space', 'today', 'world', 'works', 'zone',
  'design', 'studio', 'agency', 'solutions', 'services', 'systems', 'network', 'company',
  'management', 'center', 'directory', 'shop', 'software', 'technology', 'academy', 'education',
  'foundation', 'institute', 'international', 'organization', 'ltd', 'corp', 'enterprises'
])

const VALID_MULTI_PART_TLDS = new Set([
  'co.in', 'net.in', 'org.in', 'gen.in', 'ind.in', 'edu.in', 'gov.in', 'ac.in',
  'co.uk', 'org.uk', 'me.uk', 'ltd.uk', 'plc.uk', 'ac.uk', 'gov.uk',
  'com.au', 'net.au', 'org.au', 'edu.au', 'gov.au',
  'co.jp', 'or.jp', 'ne.jp', 'ac.jp', 'go.jp',
  'co.za', 'org.za', 'net.za', 'ac.za', 'gov.za',
  'co.nz', 'net.nz', 'org.nz', 'ac.nz', 'govt.nz',
  'com.sg', 'net.sg', 'org.sg', 'edu.sg', 'gov.sg',
  'co.id', 'net.id', 'or.id', 'ac.id', 'go.id',
  'com.my', 'net.my', 'org.my', 'edu.my', 'gov.my',
  'com.br', 'net.br', 'org.br',
  'com.mx', 'net.mx', 'org.mx',
  'com.ar', 'net.ar', 'org.ar',
  'com.tr', 'net.tr', 'org.tr'
])

const TYPO_TLDS = new Set(['cm', 'c', 'coom', 'comm', 'commm', 'ccommmm', 'con', 'cmm', 'gma', 'gmai', 'gamil', 'cmo'])

const COMMON_DOMAIN_TYPOS = {
  'gmail.cm': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmail.comm': 'gmail.com',
  'gmail.commm': 'gmail.com',
  'gmail.coom': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gmai.co': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gamil.co': 'gmail.com',
  'gmial.com': 'gmail.com',
  'gmial.co': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'yahoo.cm': 'yahoo.com',
  'yahoo.co': 'yahoo.com',
  'yaho.com': 'yahoo.com',
  'hotmail.cm': 'hotmail.com',
  'hotmail.co': 'hotmail.com',
  'hotmial.com': 'hotmail.com',
  'outlook.cm': 'outlook.com',
  'outlook.co': 'outlook.com',
  'outlok.com': 'outlook.com'
}

function stripUnsafeText(value) {
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

export function sanitizeEmailInput(value) {
  return stripUnsafeText(value)
    .normalize('NFKC')
    .replace(/[<>]/g, '')
    .toLowerCase()
    .trim()
    .slice(0, EMAIL_MAX_LENGTH)
}

const COMMON_LABEL_TYPOS = new Set([
  'gmai', 'gamil', 'gmaill', 'gnail', 'gmaiil',
  'yaho', 'yahooo', 'yahoos',
  'hotmai', 'hotmial', 'hotmailll',
  'outlok', 'outloo', 'inboxx'
])

export function getEmailError(value, options = {}) {
  const opts = typeof options === 'string' ? { label: options } : options
  const { required = true, label = 'Email' } = opts
  const raw = String(value ?? '')
  const trimmed = raw.trim()

  if (!trimmed) {
    return required ? `${label} is required.` : ''
  }

  const INVALID_MSG = 'Please enter a valid email address.'

  if (/\s/.test(trimmed) || trimmed.length > EMAIL_MAX_LENGTH) {
    return INVALID_MSG
  }

  if (trimmed.includes('..')) {
    return INVALID_MSG
  }

  const parts = trimmed.split('@')
  if (parts.length !== 2) {
    return INVALID_MSG
  }

  const [localPart, domainPart] = parts
  if (!localPart || !domainPart) {
    return INVALID_MSG
  }

  if (localPart.length < 1 || localPart.length > 64) {
    return INVALID_MSG
  }

  if (localPart.startsWith('.') || localPart.endsWith('.')) {
    return INVALID_MSG
  }

  if (!/^[a-z0-9._%+-]+$/i.test(localPart)) {
    return INVALID_MSG
  }

  // Reject 3 or more identical repeated characters in local part (e.g. aaa@, 111@)
  if (/([a-z0-9])\1{2,}/i.test(localPart)) {
    return INVALID_MSG
  }

  // Reject 5 or more consecutive digits anywhere in local part (e.g., nisha1233455454667555)
  if (/\d{5,}/.test(localPart)) {
    return INVALID_MSG
  }

  // Reject 6 or more total digits in local part
  const totalDigitsInLocal = (localPart.match(/\d/g) || []).length
  if (totalDigitsInLocal >= 6) {
    return INVALID_MSG
  }

  // Reject 5 or more consecutive consonants (excluding vowels & digits & symbols)
  if (/[bcdfghjklmnpqrstvwxyz]{5,}/i.test(localPart)) {
    return INVALID_MSG
  }

  // Reject 4 or more consecutive vowels
  if (/[aeiou]{4,}/i.test(localPart)) {
    return INVALID_MSG
  }

  if (domainPart.startsWith('.') || domainPart.endsWith('.') || domainPart.startsWith('-') || domainPart.endsWith('-')) {
    return INVALID_MSG
  }

  const domainParts = domainPart.split('.')
  if (domainParts.length < 2) {
    return INVALID_MSG
  }

  for (const part of domainParts) {
    if (!part || part.startsWith('-') || part.endsWith('-') || !/^[a-z0-9-]+$/i.test(part) || part.length > 63) {
      return INVALID_MSG
    }

    // Reject 3 or more repeated identical characters in any domain label (e.g. gmaill.com)
    if (/([a-z0-9])\1{2,}/i.test(part)) {
      return INVALID_MSG
    }

    // Reject digits-only domain labels (e.g. @12345.com)
    if (/^\d+$/.test(part)) {
      return INVALID_MSG
    }

    // Reject 4 or more consecutive digits in any domain label (e.g. @domain1234.com)
    if (/\d{4,}/.test(part)) {
      return INVALID_MSG
    }

    // Reject 5 or more consecutive consonants in domain label
    if (/[bcdfghjklmnpqrstvwxyz]{5,}/i.test(part)) {
      return INVALID_MSG
    }

    // Reject 4 or more consecutive vowels in domain label
    if (/[aeiou]{4,}/i.test(part)) {
      return INVALID_MSG
    }
  }

  const secondLevelDomain = domainParts[domainParts.length - 2].toLowerCase()
  if (COMMON_LABEL_TYPOS.has(secondLevelDomain)) {
    return INVALID_MSG
  }

  const mainDomain = domainParts[0].toLowerCase()
  if (mainDomain.length < 2) {
    return INVALID_MSG
  }

  const lowerDomain = domainPart.toLowerCase()
  if (COMMON_DOMAIN_TYPOS[lowerDomain]) {
    return INVALID_MSG
  }

  const tld = domainParts[domainParts.length - 1].toLowerCase()
  if (!tld || !/^[a-z]+$/i.test(tld) || tld.length < 2) {
    return INVALID_MSG
  }

  // Check multi-part TLD if domain has 3 or more parts (e.g. farmti.co.in, supplier.co.uk)
  if (domainParts.length >= 3) {
    const multiTld = domainParts.slice(-2).join('.').toLowerCase()
    if (VALID_MULTI_PART_TLDS.has(multiTld)) {
      return ''
    }
  }

  if (TYPO_TLDS.has(tld)) {
    return INVALID_MSG
  }

  if (!VALID_TLDS.has(tld)) {
    return INVALID_MSG
  }

  return ''
}

export function isValidEmail(value, options = {}) {
  return !getEmailError(value, options)
}

export const emailInputProps = {
  type: 'email',
  inputMode: 'email',
  maxLength: EMAIL_MAX_LENGTH,
  autoComplete: 'email',
  spellCheck: false,
}
