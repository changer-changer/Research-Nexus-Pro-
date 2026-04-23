import React, { useRef, useState, useEffect, useMemo } from 'react'

interface VirtualRowsProps {
  rowCount: number
  rowHeight: number
  renderRow: (index: number) => React.ReactNode
  className?: string
  overscan?: number
}

export default function VirtualRows({
  rowCount,
  rowHeight,
  renderRow,
  className = '',
  overscan = 6
}: VirtualRowsProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [containerHeight, setContainerHeight] = useState(0)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height)
      }
    })
    resizeObserver.observe(el)

    const handleScroll = () => setScrollTop(el.scrollTop)
    el.addEventListener('scroll', handleScroll)

    return () => {
      resizeObserver.disconnect()
      el.removeEventListener('scroll', handleScroll)
    }
  }, [])

  const totalHeight = rowCount * rowHeight

  const { startIndex, endIndex, paddingTop } = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan)
    const visibleCount = Math.ceil(containerHeight / rowHeight) + overscan * 2
    const end = Math.min(rowCount - 1, start + visibleCount)
    return {
      startIndex: start,
      endIndex: end,
      paddingTop: start * rowHeight
    }
  }, [scrollTop, containerHeight, rowHeight, rowCount, overscan])

  const visibleRows = useMemo(() => {
    const rows = []
    for (let i = startIndex; i <= endIndex; i++) {
      rows.push(
        <div key={i} style={{ height: rowHeight }}>
          {renderRow(i)}
        </div>
      )
    }
    return rows
  }, [startIndex, endIndex, renderRow, rowHeight])

  return (
    <div ref={containerRef} className={`overflow-y-auto ${className}`}>
      <div style={{ height: totalHeight, paddingTop }}>
        {visibleRows}
      </div>
    </div>
  )
}
