export function formatINR(amount, { convertFromUSD = false, rate = 83 } = {}) {
  const numericValue = Number(amount) || 0
  const value = convertFromUSD ? numericValue * rate : numericValue

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatCreditLimit(amount, currency = 'INR') {
  if (amount === null || amount === undefined || amount === '') {
    return '-'
  }

  const numericValue = Number(amount)
  if (!Number.isFinite(numericValue)) {
    return '-'
  }

  const code = String(currency || 'INR').trim().toUpperCase() || 'INR'

  try {
    const formatted = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: code,
      currencyDisplay: 'code',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numericValue)

    return formatted.replace(/\u00A0/g, ' ')
  } catch {
    return `${code} ${numericValue.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  }
}
