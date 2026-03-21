import { useState, useEffect, useCallback } from 'react'

// Breakpoint definitions matching Tailwind defaults
const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
}

type Breakpoint = keyof typeof BREAKPOINTS
type ScreenSize = 'mobile' | 'tablet' | 'desktop' | 'wide'

export function useBreakpoint(breakpoint: Breakpoint): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const query = `(min-width: ${BREAKPOINTS[breakpoint]}px)`
    const media = window.matchMedia(query)

    setMatches(media.matches)

    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)
    media.addEventListener('change', handler)

    return () => media.removeEventListener('change', handler)
  }, [breakpoint])

  return matches
}

export function useScreenSize(): ScreenSize {
  const isSm = useBreakpoint('sm')
  const isMd = useBreakpoint('md')
  const isLg = useBreakpoint('lg')
  const isXl = useBreakpoint('xl')

  if (isXl) return 'wide'
  if (isLg) return 'desktop'
  if (isMd) return 'tablet'
  return 'mobile'
}

export function useMobile(): boolean {
  return !useBreakpoint('md')
}

export function useTablet(): boolean {
  const isMd = useBreakpoint('md')
  const isLg = useBreakpoint('lg')
  return isMd && !isLg
}

export function useDesktop(): boolean {
  return useBreakpoint('lg')
}

// Hook for responsive value selection
export function useResponsiveValue<T>(values: {
  mobile: T
  tablet?: T
  desktop?: T
  wide?: T
}): T {
  const screenSize = useScreenSize()

  switch (screenSize) {
    case 'wide':
      return values.wide ?? values.desktop ?? values.tablet ?? values.mobile
    case 'desktop':
      return values.desktop ?? values.tablet ?? values.mobile
    case 'tablet':
      return values.tablet ?? values.mobile
    default:
      return values.mobile
  }
}

// Hook for orientation
export function useOrientation(): 'portrait' | 'landscape' {
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>(
    window.innerHeight > window.innerWidth ? 'portrait' : 'landscape'
  )

  useEffect(() => {
    const handler = () => {
      setOrientation(window.innerHeight > window.innerWidth ? 'portrait' : 'landscape')
    }

    window.addEventListener('resize', handler)
    window.addEventListener('orientationchange', handler)

    return () => {
      window.removeEventListener('resize', handler)
      window.removeEventListener('orientationchange', handler)
    }
  }, [])

  return orientation
}

// Hook for reduced motion preference
export function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(media.matches)

    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    media.addEventListener('change', handler)

    return () => media.removeEventListener('change', handler)
  }, [])

  return reducedMotion
}

// Hook for high contrast mode
export function useHighContrast(): boolean {
  const [highContrast, setHighContrast] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(prefers-contrast: high)')
    setHighContrast(media.matches)

    const handler = (e: MediaQueryListEvent) => setHighContrast(e.matches)
    media.addEventListener('change', handler)

    return () => media.removeEventListener('change', handler)
  }, [])

  return highContrast
}

// Hook for dark mode
export function useDarkMode(): boolean {
  const [darkMode, setDarkMode] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    setDarkMode(media.matches)

    const handler = (e: MediaQueryListEvent) => setDarkMode(e.matches)
    media.addEventListener('change', handler)

    return () => media.removeEventListener('change', handler)
  }, [])

  return darkMode
}

// Hook for touch capability
export function useTouch(): boolean {
  const [isTouch, setIsTouch] = useState(false)

  useEffect(() => {
    setIsTouch(
      'ontouchstart' in window || navigator.maxTouchPoints > 0
    )
  }, [])

  return isTouch
}

// Hook for hover capability
export function useHover(): boolean {
  const [canHover, setCanHover] = useState(true)

  useEffect(() => {
    const media = window.matchMedia('(hover: hover)')
    setCanHover(media.matches)

    const handler = (e: MediaQueryListEvent) => setCanHover(e.matches)
    media.addEventListener('change', handler)

    return () => media.removeEventListener('change', handler)
  }, [])

  return canHover
}
