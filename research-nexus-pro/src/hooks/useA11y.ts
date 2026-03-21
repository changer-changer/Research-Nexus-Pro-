import { useEffect, useCallback, useRef, useState } from 'react'

// Hook for keyboard navigation
export function useKeyboardNavigation(
  containerRef: React.RefObject<HTMLElement>,
  options: {
    selector?: string
    onSelect?: (element: HTMLElement) => void
    onEscape?: () => void
    loop?: boolean
  } = {}
) {
  const { selector = '[tabindex]:not([tabindex="-1"])', onSelect, onEscape, loop = true } = options
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const elementsRef = useRef<HTMLElement[]>([])

  const updateElements = useCallback(() => {
    if (containerRef.current) {
      elementsRef.current = Array.from(
        containerRef.current.querySelectorAll(selector)
      )
    }
  }, [containerRef, selector])

  useEffect(() => {
    updateElements()
    const observer = new MutationObserver(updateElements)

    if (containerRef.current) {
      observer.observe(containerRef.current, { childList: true, subtree: true })
    }

    return () => observer.disconnect()
  }, [containerRef, selector, updateElements])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleKeyDown = (e: KeyboardEvent) => {
      const elements = elementsRef.current
      if (elements.length === 0) return

      switch (e.key) {
        case 'ArrowDown':
        case 'ArrowRight':
          e.preventDefault()
          setFocusedIndex((prev) => {
            const next = prev + 1
            if (next >= elements.length) {
              return loop ? 0 : prev
            }
            return next
          })
          break

        case 'ArrowUp':
        case 'ArrowLeft':
          e.preventDefault()
          setFocusedIndex((prev) => {
            const next = prev - 1
            if (next < 0) {
              return loop ? elements.length - 1 : prev
            }
            return next
          })
          break

        case 'Home':
          e.preventDefault()
          setFocusedIndex(0)
          break

        case 'End':
          e.preventDefault()
          setFocusedIndex(elements.length - 1)
          break

        case 'Enter':
        case ' ':
          if (focusedIndex >= 0 && focusedIndex < elements.length) {
            e.preventDefault()
            onSelect?.(elements[focusedIndex])
          }
          break

        case 'Escape':
          onEscape?.()
          break
      }
    }

    container.addEventListener('keydown', handleKeyDown)
    return () => container.removeEventListener('keydown', handleKeyDown)
  }, [containerRef, focusedIndex, loop, onSelect, onEscape])

  useEffect(() => {
    const elements = elementsRef.current
    if (focusedIndex >= 0 && focusedIndex < elements.length) {
      elements[focusedIndex]?.focus()
    }
  }, [focusedIndex])

  return { focusedIndex, setFocusedIndex }
}

// Hook for focus trap (modals, popovers)
export function useFocusTrap(
  containerRef: React.RefObject<HTMLElement>,
  isActive: boolean
) {
  const previousFocusRef = useRef<Element | null>(null)

  useEffect(() => {
    if (isActive) {
      previousFocusRef.current = document.activeElement

      // Focus first focusable element
      const focusable = containerRef.current?.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      ) as HTMLElement
      focusable?.focus()
    } else {
      // Restore previous focus
      const previous = previousFocusRef.current as HTMLElement
      previous?.focus()
    }
  }, [isActive, containerRef])

  useEffect(() => {
    if (!isActive) return

    const container = containerRef.current
    if (!container) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return

      const focusableElements = Array.from(
        container.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ) as HTMLElement[]

      if (focusableElements.length === 0) return

      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault()
          lastElement.focus()
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault()
          firstElement.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isActive, containerRef])
}

// Hook for announcing to screen readers
export function useAnnouncer() {
  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    const announcer = document.getElementById(`aria-announcer-${priority}`)
    if (announcer) {
      announcer.textContent = message
      // Clear after announcement
      setTimeout(() => {
        announcer.textContent = ''
      }, 1000)
    }
  }, [])

  return { announce }
}

// Hook for skip link
export function useSkipLink(targetId: string) {
  const handleSkip = useCallback(() => {
    const target = document.getElementById(targetId)
    if (target) {
      target.tabIndex = -1
      target.focus()
      target.scrollIntoView({ behavior: 'smooth' })
    }
  }, [targetId])

  return { handleSkip }
}

// Hook for ARIA live regions
export function useLiveRegion() {
  const [announcement, setAnnouncement] = useState('')

  const notify = useCallback((message: string) => {
    setAnnouncement(message)
  }, [])

  return { announcement, notify }
}

// Component: Skip Link
export function SkipLink({ targetId, children = '跳转到主要内容' }: { targetId: string; children?: React.ReactNode }) {
  const { handleSkip } = useSkipLink(targetId)

  return (
    <a
      href={`#${targetId}`}
      onClick={(e) => {
        e.preventDefault()
        handleSkip()
      }}
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 z-50 px-4 py-2 bg-indigo-600 text-white rounded-lg"
    >
      {children}
    </a>
  )
}

// Component: ARIA Announcer (add to root layout)
export function AriaAnnouncer() {
  return (
    <>
      <div
        id="aria-announcer-polite"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      />
      <div
        id="aria-announcer-assertive"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      />
    </>
  )
}

// Visually hidden component for screen readers
export function VisuallyHidden({ children }: { children: React.ReactNode }) {
  return (
    <span className="absolute w-px h-px p-0 -m-px overflow-hidden whitespace-nowrap border-0">
      {children}
    </span>
  )
}
