import { getBarcodeBars, getQrCells } from '../utils/preview'

function BarcodeVisual({ value }) {
  const bars = getBarcodeBars(value)

  return (
    <div className="barcode-visual" aria-label={`Barcode preview for ${value}`}>
      <div className="barcode-visual__bars">
        {bars.map((bar) => (
          <span
            key={bar.key}
            className="barcode-visual__bar"
            style={{
              width: `${bar.width}px`,
              height: `${bar.height}px`,
            }}
          />
        ))}
      </div>
      <span className="barcode-visual__label">{value}</span>
    </div>
  )
}

function QrVisual({ value }) {
  const cells = getQrCells(value)

  return (
    <div className="qr-visual" aria-label={`QR preview for ${value}`}>
      <div className="qr-visual__grid">
        {cells.map((cell) => (
          <span
            key={cell.key}
            className={`qr-visual__cell ${cell.dark ? 'is-dark' : ''}`}
          />
        ))}
      </div>
      <span className="qr-visual__label">{value}</span>
    </div>
  )
}

export default function CodePreview({ codeType, value }) {
  if (codeType === 'QR Code') {
    return <QrVisual value={value} />
  }

  return <BarcodeVisual value={value} />
}
