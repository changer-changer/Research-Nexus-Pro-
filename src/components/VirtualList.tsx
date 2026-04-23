import React, { useRef, useState, useEffect, useMemo } from 'react'

interface VirtualListProps<T> {
  items: T[]
  itemHeight: number
  renderItem: (item: T, index: number) => React.ReactNode
  className?: string
  overscan?: number
}

export default function VirtualList<T>({
  items,
  itemHeight,
  renderItem,
  className = '',
  overscan = 4
}: VirtualListProps<T>) {
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

    const handleScroll = () => {
      setScrollTop(el.scrollTop)
    }
    el.addEventListener('scroll', handleScroll)

    return () => {
      resizeObserver.disconnect()
      el.removeEventListener('scroll', handleScroll)
    }
  }, [])

  const totalHeight = items.length * itemHeight

  const { startIndex, endIndex, paddingTop } = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
    const visibleCount = Math.ceil(containerHeight / itemHeight) + overscan * 2
    const end = Math.min(items.length - 1, start + visibleCount)
    return {
      startIndex: start,
      endIndex: end,
      paddingTop: start * itemHeight
    }
  }, [scrollTop, containerHeight, itemHeight, items.length, overscan])

  const visibleItems = useMemo(() => {
    return items.slice(startIndex, endIndex + 1)
  }, [items, startIndex, endIndex])

  return (
    <div ref={containerRef} className={`overflow-y-auto ${className}`}>
      <div style={{ height: totalHeight, paddingTop }}>
        {visibleItems.map((item, idx) => (
          <div key={startIndex + idx} style={{ height: itemHeight }}>
            {renderItem(item, startIndex + idx)}
          </div>
        ))}
      </div>
    </div>
  )
}
