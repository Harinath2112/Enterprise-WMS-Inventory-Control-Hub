import { useLayoutEffect, useRef, useState } from 'react'
import { ResponsiveContainer } from 'recharts'

function getRoundedSize(width, height) {
  return {
    width: Math.max(0, Math.floor(width || 0)),
    height: Math.max(0, Math.floor(height || 0)),
  }
}

export default function ResponsiveChart({ children, className = '' }) {
  const frameRef = useRef(null)
  const animationFrameRef = useRef(0)
  const [size, setSize] = useState({ width: 0, height: 0 })

  useLayoutEffect(() => {
    const element = frameRef.current

    if (!element) {
      return undefined
    }

    function commitSize(width, height) {
      const nextSize = getRoundedSize(width, height)

      setSize((currentSize) =>
        currentSize.width === nextSize.width && currentSize.height === nextSize.height
          ? currentSize
          : nextSize,
      )
    }

    function measure() {
      const rect = element.getBoundingClientRect()
      commitSize(rect.width, rect.height)
    }

    measure()

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure)

      return () => {
        window.removeEventListener('resize', measure)
      }
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      const contentBox = Array.isArray(entry.contentBoxSize)
        ? entry.contentBoxSize[0]
        : entry.contentBoxSize

      const width = contentBox?.inlineSize ?? entry.contentRect.width
      const height = contentBox?.blockSize ?? entry.contentRect.height

      window.cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = window.requestAnimationFrame(() => {
        commitSize(width, height)
      })
    })

    observer.observe(element)

    return () => {
      window.cancelAnimationFrame(animationFrameRef.current)
      observer.disconnect()
    }
  }, [])

  const isReady = size.width > 0 && size.height > 0

  return (
    <div className={`chart-box ${className}`.trim()} ref={frameRef}>
      {isReady ? (
        <ResponsiveContainer width={size.width} height={size.height} debounce={80}>
          {children}
        </ResponsiveContainer>
      ) : (
        <div className="chart-box__fallback" aria-hidden="true" />
      )}
    </div>
  )
}
