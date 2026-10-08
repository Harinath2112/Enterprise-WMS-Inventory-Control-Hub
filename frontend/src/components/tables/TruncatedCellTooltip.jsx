import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const HOVER_DELAY_MS = 250
const VIEWPORT_GUTTER = 12
const TOOLTIP_GAP = 8
const MAX_TOOLTIP_WIDTH = 360

function hasVisibleText(element) {
  return Boolean(String(element?.innerText || element?.textContent || '').trim())
}

function isTruncated(element) {
  if (!(element instanceof HTMLElement) || !hasVisibleText(element)) return false

  return (
    element.scrollWidth > element.clientWidth + 1 ||
    element.scrollHeight > element.clientHeight + 1 ||
    element.offsetWidth < element.scrollWidth
  )
}

function findTruncatedElement(cell) {
  const titleElement = cell.querySelector('[title]')
  if (titleElement && isTruncated(titleElement)) {
    return titleElement
  }

  const descendants = [...cell.querySelectorAll('*')]
  const truncatedDescendant = descendants.find((element) => isTruncated(element))
  if (truncatedDescendant) return truncatedDescendant

  if (isTruncated(cell)) return cell

  if (titleElement) {
    const titleVal = titleElement.getAttribute('title')?.trim()
    if (titleVal) {
      return titleElement
    }
  }

  return null
}

function getTooltipPosition(element) {
  const rect = element.getBoundingClientRect()
  const left = Math.max(VIEWPORT_GUTTER, Math.min(rect.left, window.innerWidth - VIEWPORT_GUTTER - 100))
  const maxWidth = Math.min(MAX_TOOLTIP_WIDTH, window.innerWidth - left - VIEWPORT_GUTTER)

  return {
    left,
    maxWidth,
    top: rect.top,
    placement: 'overlay',
  }
}

export default function TruncatedCellTooltip({ containerRef }) {
  const timerRef = useRef(null)
  const activeCellRef = useRef(null)
  const [tooltip, setTooltip] = useState(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return undefined

    function clearTimer() {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }

    function hideTooltip() {
      clearTimer()
      activeCellRef.current = null
      setTooltip(null)
    }

    function handlePointerOver(event) {
      const cell = event.target.closest?.('td')
      if (!cell || !container.contains(cell) || cell === activeCellRef.current) return
      if (cell.classList.contains('table-component__selection-cell')) return

      clearTimer()
      setTooltip(null)
      activeCellRef.current = cell

      timerRef.current = window.setTimeout(() => {
        const truncatedElement = findTruncatedElement(cell)
        const titleText = truncatedElement?.getAttribute?.('title')
        const text = String(titleText || truncatedElement?.innerText || truncatedElement?.textContent || '').trim()

        if (!truncatedElement || !text || activeCellRef.current !== cell) return

        setTooltip({
          text,
          ...getTooltipPosition(truncatedElement),
        })
      }, HOVER_DELAY_MS)
    }

    function handlePointerOut(event) {
      const currentCell = event.target.closest?.('td')
      const nextCell = event.relatedTarget?.closest?.('td')

      if (currentCell && currentCell !== nextCell) hideTooltip()
    }

    container.addEventListener('pointerover', handlePointerOver)
    container.addEventListener('pointerout', handlePointerOut)
    container.addEventListener('scroll', hideTooltip, { passive: true })
    window.addEventListener('resize', hideTooltip)

    return () => {
      hideTooltip()
      container.removeEventListener('pointerover', handlePointerOver)
      container.removeEventListener('pointerout', handlePointerOut)
      container.removeEventListener('scroll', hideTooltip)
      window.removeEventListener('resize', hideTooltip)
    }
  }, [containerRef])

  if (!tooltip || typeof document === 'undefined') return null

  return createPortal(
    <div
      className={`table-truncated-tooltip table-truncated-tooltip--${tooltip.placement}`}
      role="tooltip"
      style={{
        left: `${tooltip.left}px`,
        maxWidth: `${tooltip.maxWidth}px`,
        top: `${tooltip.top}px`,
      }}
    >
      {tooltip.text}
    </div>,
    document.body,
  )
}
