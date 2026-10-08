/**
 * Unit Name and Abbreviation/Symbol format validator
 */

export function validateUnitName(name, existingUnits = [], currentId = null) {
  if (!name || typeof name !== 'string' || !name.trim()) {
    return 'Unit Name is required.'
  }

  const trimmed = name.trim()

  if (trimmed.length < 2) {
    return 'Unit Name must be at least 2 characters.'
  }

  if (trimmed.length > 30) {
    return 'Unit Name cannot exceed 30 characters.'
  }

  // Reject invalid characters
  if (!/^[a-zA-Z0-9\s\-/°%().]+$/.test(trimmed)) {
    return 'Unit Name contains invalid characters.'
  }

  // Reject unspaced gibberish words longer than 15 chars
  const words = trimmed.split(/[\s\-/]+/)
  if (words.some((w) => w.length > 15)) {
    return 'Unit Name contains invalid or excessive long words.'
  }

  // Check duplicate
  if (Array.isArray(existingUnits) && existingUnits.length > 0) {
    const normalizedNew = trimmed.toLowerCase()
    const isDuplicate = existingUnits.some((u) => {
      if (currentId && String(u.id || u.unitId) === String(currentId)) {
        return false
      }
      const existingName = (u.name || u.unitName || '').trim().toLowerCase()
      return existingName === normalizedNew
    })

    if (isDuplicate) {
      return 'Unit Name already exists.'
    }
  }

  return ''
}

export function validateUnitShortName(shortName, existingUnits = [], currentId = null) {
  if (!shortName || typeof shortName !== 'string' || !shortName.trim()) {
    return 'Abbreviation / Symbol is required.'
  }

  const trimmed = shortName.trim()

  if (trimmed.length > 10) {
    return 'Abbreviation cannot exceed 10 characters.'
  }

  // Reject invalid characters
  if (!/^[a-zA-Z0-9\s\-/°%().]+$/.test(trimmed)) {
    return 'Abbreviation contains invalid characters.'
  }

  // Abbreviation should be concise - reject unspaced strings > 8 chars without delimiter
  if (trimmed.length > 8 && !/[\s\-/.]/.test(trimmed)) {
    return 'Abbreviation / Symbol is invalid or too long.'
  }

  // Check duplicate
  if (Array.isArray(existingUnits) && existingUnits.length > 0) {
    const normalizedNew = trimmed.toLowerCase()
    const isDuplicate = existingUnits.some((u) => {
      if (currentId && String(u.id || u.unitId) === String(currentId)) {
        return false
      }
      const existingShort = (u.shortName || u.abbreviation || u.unitAbbreviation || '').trim().toLowerCase()
      return existingShort === normalizedNew
    })

    if (isDuplicate) {
      return 'Unit Abbreviation already exists.'
    }
  }

  return ''
}
