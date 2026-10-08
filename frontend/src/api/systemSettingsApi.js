/**
 * systemSettingsApi.js
 *
 * Handles all System Settings API calls.
 *
 * Backend contract (confirmed from Swagger):
 *   GET  /api/{section}         → Array<{ ruleId, ruleName, ruleKey, ruleValue, isEnabled, ... }>
 *   PUT  /api/{section}         → Array<{ ruleId, ruleValue, isEnabled }>
 *   POST /api/{section}/reset   → resets section to server defaults, returns new array
 *
 * The ruleId values returned by GET are the IDs that MUST be sent back in PUT.
 * We cache them in memory so that Save can always reconstruct the correct payload.
 */
import apiRequest, { getResponseData } from './apiClient'
import { API_ENDPOINTS } from './endpoints'

const EP = API_ENDPOINTS.systemSettings

export const SYSTEM_SETTINGS_UPDATED_EVENT = 'ims:system-settings-updated'

export const PRODUCT_RULE_DEFAULTS = {
    autoGenerateProductCode: true,
    productCodePrefix: 'PRD-',
    skuPrefix: 'SKU-',
    allowProductVariants: true,
    brandRequired: true,
    categoryRequired: true,
    subCategoryRequired: false,
    attributeRequiredForVariants: true,
    hsnCodeRequired: false,
    productImageRequired: false,
    duplicateProductNameAllowed: false,
}

// ---------------------------------------------------------------------------
// In-memory ruleId cache:  sectionKey → Map<ruleKey, { ruleId, ruleKey }>
// Populated from GET responses so PUT always sends correct ruleId values.
// ---------------------------------------------------------------------------
const ruleIdCache = {}

function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function readProp(value, ...keys) {
    if (!isRecord(value)) return undefined
    for (const key of keys) {
        if (value[key] !== undefined) return value[key]
    }
    return undefined
}

function toFieldKey(rawKey) {
    const value = String(rawKey ?? '').trim()
    if (!value) return ''

    if (/[\s_-]/.test(value)) {
        const parts = value
            .split(/[\s_-]+/)
            .map((part) => part.trim())
            .filter(Boolean)

        return parts
            .map((part, index) => {
                const lower = part.charAt(0).toLowerCase() + part.slice(1)
                return index === 0 ? lower : lower.charAt(0).toUpperCase() + lower.slice(1)
            })
            .join('')
    }

    return value.charAt(0).toLowerCase() + value.slice(1)
}

function extractRulesArray(response) {
    const data = getResponseData(response)

    if (Array.isArray(data)) return data
    if (Array.isArray(response?.data)) return response.data

    return (
        readProp(data, 'rules', 'Rules') ??
        readProp(data, 'items', 'Items') ??
        readProp(data, 'results', 'Results') ??
        []
    )
}

// ---------------------------------------------------------------------------
// Normalise a raw array item from the backend into a predictable shape
// ---------------------------------------------------------------------------
function normalizeRuleItem(item) {
    const ruleId = item?.ruleId ?? item?.RuleId ?? item?.id ?? item?.Id ?? null
    // The backend may use different casing for the rule key / name
    const ruleKey =
        item?.ruleKey ??
        item?.RuleKey ??
        item?.ruleName ??
        item?.RuleName ??
        item?.key ??
        item?.name ??
        null
    const ruleValue =
        item?.ruleValue ?? item?.RuleValue ?? item?.value ?? item?.Value ?? null
    const ruleType =
        item?.ruleType ?? item?.RuleType ?? item?.type ?? item?.Type ?? ''
    const isEnabled =
        item?.isEnabled ?? item?.IsEnabled ?? item?.enabled ?? item?.Enabled ?? false

    return { ruleId, ruleKey, ruleValue, ruleType, isEnabled }
}

// ---------------------------------------------------------------------------
// Convert the backend array into a flat { fieldName: value } object that the
// UI components can consume directly.
//
// Strategy for value resolution (toggle vs text/number):
//   • isEnabled  → boolean value (for toggle fields)
//   • ruleValue  → parsed string/number value (for text/number/select fields)
//
// We store BOTH so the save function can reconstruct the correct payload.
// ---------------------------------------------------------------------------
function rawArrayToSettingsMap(items, sectionKey) {
    const settingsMap = {}
    const idMap = {}

    if (!Array.isArray(items)) return { settingsMap, idMap }

    for (const raw of items) {
        const { ruleId, ruleKey, ruleValue, ruleType, isEnabled } = normalizeRuleItem(raw)
        if (!ruleKey) continue

        const camelKey = toFieldKey(ruleKey)
        if (!camelKey) continue

        // Store the ID for PUT payloads
        idMap[camelKey] = ruleId

        // Determine the JS value:
        // If ruleValue is a non-empty string, parse it to number/boolean where
        // possible; otherwise use isEnabled for toggle-only rules.
        let jsValue
        const normalizedRuleType = String(ruleType || '').trim().toLowerCase()
        const isToggleRule = ['toggle', 'boolean', 'bool', 'switch'].includes(normalizedRuleType)

        if (isToggleRule && (ruleValue === null || ruleValue === undefined || String(ruleValue) === '')) {
            jsValue = Boolean(isEnabled)
        } else if (ruleValue !== null && ruleValue !== undefined && String(ruleValue) !== '') {
            const str = String(ruleValue).toLowerCase()
            if (str === 'true') jsValue = true
            else if (str === 'false') jsValue = false
            else {
                const num = Number(ruleValue)
                jsValue = Number.isFinite(num) ? num : ruleValue
            }
        } else {
            // text/number field with empty ruleValue – use isEnabled as a fallback
            jsValue = isEnabled
        }

        settingsMap[camelKey] = jsValue
    }

    return { settingsMap, idMap }
}

// ---------------------------------------------------------------------------
// Convert a flat { fieldName: value } map back into the array of
// UpdateSystemRuleDto that the PUT endpoint requires.
// ---------------------------------------------------------------------------
function settingsMapToUpdateArray(sectionKey, sectionValues) {
    const idMap = ruleIdCache[sectionKey] ?? {}
    const updateItems = []

    for (const [fieldName, value] of Object.entries(sectionValues)) {
        const ruleId = idMap[fieldName]
        if (ruleId === undefined || ruleId === null) continue // unknown field, skip

        const isBoolean = typeof value === 'boolean'
        updateItems.push({
            ruleId: Number(ruleId),
            ruleValue: isBoolean ? null : String(value ?? ''),
            isEnabled: isBoolean ? value : true,
        })
    }

    return updateItems
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch a single section's settings from the backend.
 *
 * Returns `{ success, data: { fieldName: value, … }, error }`.
 */
export async function fetchSectionSettings(sectionKey) {
    const ep = EP[sectionKey]
    if (!ep) {
        return { success: false, data: {}, error: `Unknown section: ${sectionKey}` }
    }

    const response = await apiRequest(ep.get)
    if (!response.success) {
        return { ...response, data: {} }
    }

    // Backend section endpoints return a section envelope with a rules array.
    const rawArray = extractRulesArray(response)

    const { settingsMap, idMap } = rawArrayToSettingsMap(rawArray, sectionKey)

    // Persist the ruleId map so PUT can send correct IDs
    ruleIdCache[sectionKey] = idMap

    return { ...response, data: settingsMap }
}

export async function fetchProductRules() {
    const response = await fetchSectionSettings('productRules')

    if (!response.success) {
        return {
            ...response,
            data: { ...PRODUCT_RULE_DEFAULTS },
        }
    }

    return {
        ...response,
        data: {
            ...PRODUCT_RULE_DEFAULTS,
            ...(response.data ?? {}),
        },
    }
}

/**
 * Fetch all 11 sections in parallel.
 *
 * Returns `{ success, data: { sectionKey: { fieldName: value } }, errors }`.
 */
export async function fetchAllSystemSettings() {
    const sectionKeys = Object.keys(EP)

    const results = await Promise.all(
        sectionKeys.map(async (key) => ({
            key,
            result: await fetchSectionSettings(key),
        })),
    )

    const data = {}
    const errors = {}
    let anySuccess = false

    for (const { key, result } of results) {
        if (result.success) {
            data[key] = result.data
            anySuccess = true
        } else {
            data[key] = {}
            errors[key] = result.error
        }
    }

    return { success: anySuccess, data, errors }
}

/**
 * Save a section's settings.
 *
 * Converts the flat `{ fieldName: value }` map to the array of
 * `UpdateSystemRuleDto` that the backend requires.
 *
 * Returns `{ success, error }`.
 */
export async function saveSectionSettings(sectionKey, sectionValues) {
    const ep = EP[sectionKey]
    if (!ep) {
        return { success: false, error: `Unknown section: ${sectionKey}` }
    }

    const body = settingsMapToUpdateArray(sectionKey, sectionValues)

    if (body.length === 0) {
        // ruleIds not yet loaded — re-fetch first, then retry
        const fetchResult = await fetchSectionSettings(sectionKey)
        if (!fetchResult.success) {
            return { success: false, error: 'Could not load rule IDs before saving.' }
        }
        const retryBody = settingsMapToUpdateArray(sectionKey, sectionValues)
        if (retryBody.length === 0) {
            return { success: false, error: 'No rule IDs found. Cannot save.' }
        }
        return apiRequest(ep.put, { method: 'PUT', body: retryBody })
    }

    return apiRequest(ep.put, { method: 'PUT', body })
}

/**
 * Reset a section to backend defaults.
 * After a successful reset, re-fetches to get the new values + fresh ruleIds.
 *
 * Returns `{ success, data: { fieldName: value }, error }`.
 */
export async function resetSectionSettings(sectionKey) {
    const ep = EP[sectionKey]
    if (!ep) {
        return { success: false, data: {}, error: `Unknown section: ${sectionKey}` }
    }

    const response = await apiRequest(ep.reset, { method: 'POST' })
    if (!response.success) {
        return { ...response, data: {} }
    }

    // Re-fetch to get the reset values
    return fetchSectionSettings(sectionKey)
}
