import { useCallback, useState } from 'react'
import {
  fetchSectionSettings,
  saveSectionSettings,
  resetSectionSettings,
} from '../api/systemSettingsApi'

const SECTION_KEYS = [
  'productRules',
  'purchaseRules',
  'salesRules',
  'returnRules',
  'taxRules',
  'stockRules',
  'warehouseRules',
  'auditRules',
  'reportRules',
  'securityPolicy',
  'integrationSettings',
]

const initialSectionState = {
  data: {},
  originalData: {},
  loading: false,
  saving: false,
  resetting: false,
  error: null,
  isDirty: false,
}

const buildInitialState = () => {
  return SECTION_KEYS.reduce((acc, key) => {
    acc[key] = { ...initialSectionState }
    return acc
  }, {})
}

function shallowEqual(objA, objB) {
  if (objA === objB) return true
  if (typeof objA !== 'object' || objA === null || typeof objB !== 'object' || objB === null) {
    return false
  }
  const keysA = Object.keys(objA)
  const keysB = Object.keys(objB)
  if (keysA.length !== keysB.length) return false
  for (const key of keysA) {
    if (objA[key] !== objB[key]) return false
  }
  return true
}

export function useSystemSettings() {
  const [sections, setSections] = useState(buildInitialState)

  const fetchSection = useCallback(async (sectionKey, defaults = {}) => {
    setSections((prev) => ({
      ...prev,
      [sectionKey]: {
        ...prev[sectionKey],
        loading: true,
        error: null,
      },
    }))

    const result = await fetchSectionSettings(sectionKey)

    setSections((prev) => {
      if (!result.success) {
        return {
          ...prev,
          [sectionKey]: {
            ...prev[sectionKey],
            loading: false,
            error: result.error || 'Failed to load settings.',
          },
        }
      }

      const mergedData = {
        ...defaults,
        ...result.data,
      }

      return {
        ...prev,
        [sectionKey]: {
          ...prev[sectionKey],
          data: mergedData,
          originalData: mergedData,
          loading: false,
          isDirty: false,
          error: null,
        },
      }
    })

    return result
  }, [])

  const updateField = useCallback((sectionKey, fieldName, value) => {
    setSections((prev) => {
      const section = prev[sectionKey]
      const nextData = {
        ...section.data,
        [fieldName]: value,
      }
      const isDirty = !shallowEqual(nextData, section.originalData)

      return {
        ...prev,
        [sectionKey]: {
          ...section,
          data: nextData,
          isDirty,
        },
      }
    })
  }, [])

  const saveSection = useCallback(async (sectionKey) => {
    let currentData
    setSections((prev) => {
      currentData = prev[sectionKey].data
      return {
        ...prev,
        [sectionKey]: {
          ...prev[sectionKey],
          saving: true,
          error: null,
        },
      }
    })

    const result = await saveSectionSettings(sectionKey, currentData)

    setSections((prev) => {
      if (!result.success) {
        return {
          ...prev,
          [sectionKey]: {
            ...prev[sectionKey],
            saving: false,
            error: result.error || 'Failed to save settings.',
          },
        }
      }

      return {
        ...prev,
        [sectionKey]: {
          ...prev[sectionKey],
          originalData: prev[sectionKey].data,
          saving: false,
          isDirty: false,
          error: null,
        },
      }
    })

    return result
  }, [])

  const resetSection = useCallback(async (sectionKey, defaults = {}) => {
    setSections((prev) => ({
      ...prev,
      [sectionKey]: {
        ...prev[sectionKey],
        resetting: true,
        error: null,
      },
    }))

    const result = await resetSectionSettings(sectionKey)

    setSections((prev) => {
      if (!result.success) {
        return {
          ...prev,
          [sectionKey]: {
            ...prev[sectionKey],
            resetting: false,
            error: result.error || 'Failed to reset settings.',
          },
        }
      }

      const mergedData = {
        ...defaults,
        ...result.data,
      }

      return {
        ...prev,
        [sectionKey]: {
          ...prev[sectionKey],
          data: mergedData,
          originalData: mergedData,
          resetting: false,
          isDirty: false,
          error: null,
        },
      }
    })

    return result
  }, [])

  return {
    sections,
    fetchSection,
    updateField,
    saveSection,
    resetSection,
  }
}
