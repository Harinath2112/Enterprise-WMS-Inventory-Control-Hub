export function stripGrouping(value) {
  return String(value ?? '').replace(/,/g, '').trim()
}

export function sanitizeNumericInput(
  value,
  {
    allowDecimal = true,
    allowNegative = false,
    maxIntegerDigits = 10,
    maxDecimalDigits = 2,
  } = {},
) {
  const source = stripGrouping(value)
  let nextValue = ''
  let hasDecimal = false
  let hasSign = false
  let integerDigits = 0
  let decimalDigits = 0

  for (const char of source) {
    if (/\d/.test(char)) {
      if (!hasDecimal) {
        if (maxIntegerDigits !== null && maxIntegerDigits !== undefined && integerDigits >= maxIntegerDigits) {
          continue
        }
        integerDigits += 1
        nextValue += char
      } else {
        if (maxDecimalDigits !== null && maxDecimalDigits !== undefined && decimalDigits >= maxDecimalDigits) {
          continue
        }
        decimalDigits += 1
        nextValue += char
      }
      continue
    }

    if (allowDecimal && char === '.' && !hasDecimal) {
      nextValue += char
      hasDecimal = true
      continue
    }

    if (allowNegative && char === '-' && !hasSign && nextValue.length === 0) {
      nextValue += char
      hasSign = true
    }
  }

  return nextValue
}
