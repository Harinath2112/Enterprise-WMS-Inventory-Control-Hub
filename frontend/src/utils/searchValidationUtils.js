/**
 * Utility to validate search inputs across IMS to detect invalid, random, or nonsensical input (key-smash, repeated characters, etc.).
 * Returns { isValid: boolean, isInvalid: boolean, errorMessage: string }
 */
export function validateSearchQuery(term, hasResults = true) {
  if (!term || typeof term !== 'string') {
    return { isValid: true, isInvalid: false, errorMessage: '' }
  }

  const trimmed = term.trim()
  if (!trimmed) {
    return { isValid: true, isInvalid: false, errorMessage: '' }
  }

  // 1. Minimum search length check (if length is 1 non-alphanumeric char)
  if (trimmed.length === 1 && !/[a-zA-Z0-9]/.test(trimmed)) {
    return {
      isValid: false,
      isInvalid: true,
      errorMessage: 'Please enter a valid search term.',
    }
  }

  // 2. Check for 3 or more identical consecutive characters (e.g., "aaaa", "sssss", "hhh")
  if (/(.)\1{2,}/.test(trimmed.toLowerCase())) {
    return {
      isValid: false,
      isInvalid: true,
      errorMessage: 'Please enter a valid search term.',
    }
  }

  // 3. Check for double-pair key smash (e.g. "gghh", "aass", "ddff", "hhkk")
  if (/([a-z])\1([a-z])\2/i.test(trimmed)) {
    return {
      isValid: false,
      isInvalid: true,
      errorMessage: 'Please enter a valid search term.',
    }
  }

  // 4. Check for key-smash / random character patterns in single continuous words
  const words = trimmed.split(/\s+/)
  for (const word of words) {
    // Only ignore pure digits, valid dates, UUIDs, SKUs containing numbers/hyphens, and emails
    if (
      /^\d+$/.test(word) ||
      /^\d{1,4}[-/]\d{1,2}[-/]\d{1,4}$/.test(word) ||
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(word) ||
      /^[A-Za-z0-9_-]*\d[A-Za-z0-9_-]*$/.test(word) ||
      word.includes('@')
    ) {
      continue
    }

    const lowerWord = word.toLowerCase()

    // Single alphabetic word >= 20 chars without numbers/spaces -> key-smash
    if (lowerWord.length >= 20) {
      return {
        isValid: false,
        isInvalid: true,
        errorMessage: 'Please enter a valid search term.',
      }
    }

    // Word >= 5 chars with 0 vowels (a, e, i, o, u, y) -> key-smash
    if (lowerWord.length >= 5 && !/[aeiouy]/.test(lowerWord)) {
      return {
        isValid: false,
        isInvalid: true,
        errorMessage: 'Please enter a valid search term.',
      }
    }

    // Repeated 2-4 character pattern blocks (e.g. "vbvbvb", "dfdfdf", "gfgfgf", "ababab")
    if (/(.{2,4})\1{2,}/i.test(lowerWord)) {
      return {
        isValid: false,
        isInvalid: true,
        errorMessage: 'Please enter a valid search term.',
      }
    }

    // Word >= 7 chars with low vowel ratio (< 28%)
    const vowelMatches = lowerWord.match(/[aeiouy]/g) || []
    if (lowerWord.length >= 7 && vowelMatches.length / lowerWord.length < 0.28) {
      return {
        isValid: false,
        isInvalid: true,
        errorMessage: 'Please enter a valid search term.',
      }
    }

    // Repeated keyboard home-row or sequence patterns (e.g. "asdf", "sdfg", "dfgh", "fghj", "ghjk", "hjkl", "qwer", "cvbn")
    if (
      /(asdf|sdfg|dfgh|fghj|ghjk|hjkl|qwer|wert|erty|rtyu|tyui|yuio|uiop|zxcv|xcvb|cvbn|vbnm|hjk|kuj|jkuj|ujk|hhu|uhj|vnb|cvb|bvb|vcb|bvn|dfd|gfg|fgf){2,}/i.test(
        lowerWord
      ) ||
      /(hkuh|hujk|kuj|ujkuj|gghh|hhku)/i.test(lowerWord)
    ) {
      return {
        isValid: false,
        isInvalid: true,
        errorMessage: 'Please enter a valid search term.',
      }
    }
  }

  // 5. Check for invalid HTML/script tags or disallowed special characters
  if (/[<>{}\\]/.test(trimmed)) {
    return {
      isValid: false,
      isInvalid: true,
      errorMessage: 'Please enter a valid search term.',
    }
  }

  // 6. If search query returns 0 matches in the dataset
  if (!hasResults) {
    return {
      isValid: false,
      isInvalid: true,
      errorMessage: 'Please enter a valid search term.',
    }
  }

  return { isValid: true, isInvalid: false, errorMessage: '' }
}
