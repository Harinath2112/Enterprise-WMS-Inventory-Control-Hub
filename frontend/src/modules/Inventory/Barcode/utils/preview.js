export function getBarcodeBars(value) {
  const cleanValue = String(value || 'BARCODE').replace(/\s+/g, '')

  return cleanValue.split('').flatMap((char, index) => {
    const code = char.charCodeAt(0)

    return [
      { key: `${index}-a`, width: (code % 3) + 1, height: 54 - ((code + index) % 3) * 8 },
      { key: `${index}-b`, width: ((code + 1) % 2) + 1, height: 54 },
      { key: `${index}-c`, width: ((code + index) % 4) + 1, height: 54 - ((code + index) % 2) * 6 },
    ]
  })
}

function getHashSeed(value) {
  return value.split('').reduce((total, char, index) => {
    return (total * 31 + char.charCodeAt(0) + index) % 2147483647
  }, 7)
}

function getFinderCell(row, col, offsetRow, offsetCol) {
  const localRow = row - offsetRow
  const localCol = col - offsetCol

  if (localRow < 0 || localRow > 6 || localCol < 0 || localCol > 6) {
    return null
  }

  const isOuterBorder = localRow === 0 || localRow === 6 || localCol === 0 || localCol === 6
  const isInnerGap = localRow === 1 || localRow === 5 || localCol === 1 || localCol === 5
  const isCenter = localRow >= 2 && localRow <= 4 && localCol >= 2 && localCol <= 4

  if (isOuterBorder || isCenter) {
    return true
  }

  return isInnerGap ? false : false
}

export function getQrCells(value) {
  const size = 21
  const seed = getHashSeed(value || 'QR')

  return Array.from({ length: size * size }, (_, index) => {
    const row = Math.floor(index / size)
    const col = index % size
    const finderCell =
      getFinderCell(row, col, 0, 0) ??
      getFinderCell(row, col, 0, size - 7) ??
      getFinderCell(row, col, size - 7, 0)

    if (finderCell !== null) {
      return { key: `${row}-${col}`, dark: finderCell }
    }

    const charCode = value.charCodeAt((row + col) % value.length) || 17
    const mix = (seed + row * 17 + col * 23 + row * col + charCode) % 11

    return { key: `${row}-${col}`, dark: mix % 2 === 0 || mix === 7 }
  })
}

export function getPreviewValue(product, codeType) {
  if (!product) {
    return ''
  }

  return codeType === 'QR Code'
    ? `QR:${product.id}:${product.sku || product.name}`
    : `${product.sku || product.name}-STATIC`
}
