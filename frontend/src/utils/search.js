export function searchItems(items, query, keys) {
  const normalizedQuery = String(query ?? '').trim().toLowerCase()

  if (!normalizedQuery) {
    return items
  }

  return items.filter((item) =>
    keys.some((key) =>
      String(item[key] ?? '')
        .toLowerCase()
        .includes(normalizedQuery),
    ),
  )
}
