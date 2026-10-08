export function getInitialDraft(addFields) {
  return addFields.reduce((result, field) => {
    result[field.name] = field.defaultValue ?? ''
    return result
  }, {})
}

export function normalizeAddLabel(value) {
  return String(value ?? 'Add')
    .replace(/^\+\s*/, '')
    .trim()
}
