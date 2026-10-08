/**
 * Category Name format and validity validator
 */

export function isGibberishOrKeySmash(text) {
  if (!text || typeof text !== 'string') return false
  const trimmed = text.trim().toLowerCase()

  // 1. 3 or more identical consecutive characters (e.g. "aaaa", "hhhh")
  if (/(.)\1{2,}/i.test(trimmed)) {
    return true
  }

  // 2. Double-pair key smash (e.g. "gghh", "aass", "ddff", "hhkk")
  if (/([a-z])\1([a-z])\2/i.test(trimmed)) {
    return true
  }

  // 3. 5 or more consecutive consonants (e.g. "jhjjh", "fhfjgk", "bcdfgh")
  if (/[bcdfghjklmnpqrstvwxyz]{5,}/i.test(trimmed)) {
    return true
  }

  // 4. Repeated keyboard sequences or home-row patterns
  const keyboardPatterns = [
    'qwerty', 'asdfgh', 'zxcvbn', 'qwertz', 'azerty',
    'yuiop', 'ghjkl', 'fghjk', 'xcvbn', 'dfgh', 'fghj', 'hjkl',
    'hjk', 'kuj', 'jkuj', 'ujk', 'fhfj'
  ]
  if (keyboardPatterns.some((pattern) => trimmed.includes(pattern))) {
    return true
  }

  // 5. Check words without vowels (length >= 5) or low vowel ratio for words >= 7 chars
  const words = trimmed.split(/[\s\-/&]+/)
  for (const word of words) {
    const lettersOnly = word.replace(/[^a-z]/gi, '')
    if (lettersOnly.length >= 5 && !/[aeiouy]/i.test(lettersOnly)) {
      return true
    }
    const vowels = lettersOnly.match(/[aeiouy]/gi) || []
    if (lettersOnly.length >= 7 && vowels.length / lettersOnly.length < 0.25) {
      return true
    }
    if (lettersOnly.length > 25) {
      return true
    }
  }

  return false
}

export function validateCategoryName(name, existingCategories = [], currentId = null) {
  if (!name || typeof name !== 'string' || !name.trim()) {
    return 'Category name is required.'
  }

  const trimmed = name.trim()

  if (trimmed.length < 2) {
    return 'Category name must be at least 2 characters.'
  }

  if (trimmed.length > 50) {
    return 'Category name cannot exceed 50 characters.'
  }

  // Must contain only allowed characters (letters, numbers, spaces, &, /, -, ., ( ))
  if (!/^[a-zA-Z0-9\s&/\-().]+$/.test(trimmed)) {
    return 'Invalid category name. Please select from predefined categories.'
  }

  // Must contain at least one letter
  if (!/[a-zA-Z]/.test(trimmed)) {
    return 'Invalid category name. Please select from predefined categories.'
  }

  // Check gibberish / key smash
  if (isGibberishOrKeySmash(trimmed)) {
    return 'Invalid category name. Please select from predefined categories.'
  }

  // Check duplicate
  if (Array.isArray(existingCategories) && existingCategories.length > 0) {
    const lower = trimmed.toLowerCase()
    const isDuplicate = existingCategories.some((cat) => {
      if (currentId && String(cat.id || cat.categoryId) === String(currentId)) {
        return false
      }
      const existingName = (cat.name || cat.label || '').trim().toLowerCase()
      return existingName === lower
    })

    if (isDuplicate) {
      return 'A category with this name already exists.'
    }
  }

  return ''
}
