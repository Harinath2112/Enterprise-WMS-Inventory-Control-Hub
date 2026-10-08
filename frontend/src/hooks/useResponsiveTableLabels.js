import { useEffect } from 'react'

function getHeaderLabel(cell) {
  return cell?.textContent?.replace(/\s+/g, ' ').trim() ?? ''
}

function applyTableLabels(root = document) {
  const tables = root.querySelectorAll?.('table.table') ?? []

  tables.forEach((table) => {
    const headerRow = table.tHead?.rows?.[0]
    const labels = Array.from(headerRow?.cells ?? []).map(getHeaderLabel)

    if (labels.length === 0) {
      return
    }

    Array.from(table.tBodies ?? []).forEach((body) => {
      Array.from(body.rows ?? []).forEach((row) => {
        Array.from(row.cells ?? []).forEach((cell, index) => {
          if (cell.colSpan > 1 || cell.classList.contains('table-empty')) {
            cell.dataset.label = ''
            return
          }

          cell.dataset.label = labels[index] ?? ''
        })
      })
    })
  })
}

export function useResponsiveTableLabels() {
  useEffect(() => {
    let frameId = 0

    function scheduleLabelSync() {
      window.cancelAnimationFrame(frameId)
      frameId = window.requestAnimationFrame(() => applyTableLabels(document))
    }

    scheduleLabelSync()

    const observer = new MutationObserver(scheduleLabelSync)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    })

    return () => {
      window.cancelAnimationFrame(frameId)
      observer.disconnect()
    }
  }, [])
}
