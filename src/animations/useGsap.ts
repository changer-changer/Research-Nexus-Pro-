// useGsap.ts — disabled, kept for API compatibility
import { useEffect, useRef, useCallback, useState } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

export const usePageLoadAnimation = () => {}
export const useScrollAnimation = () => {}
export const useNodeAnimation = () => ({ handleHover: () => {} })
export const useSidebarAnimation = () => {}
export const useMagneticButton = () => ({ handleMouseMove: () => {}, handleMouseLeave: () => {} })
export const useTooltipAnimation = () => {}
export const useViewTransition = () => {}
export const useCardHover = () => ({ handleMouseEnter: () => {}, handleMouseLeave: () => {} })
export const usePanelAnimation = () => {}
export const useTimelineAnimation = () => {}
export const useTreeAnimation = () => {}
export const useParallax = () => {}
export const useCursorTrail = () => {}
export const useParticleSystem = () => {}

export const useReducedMotion = () => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mediaQuery.matches)
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  return prefersReducedMotion
}

export default {
  usePageLoadAnimation,
  useScrollAnimation,
  useNodeAnimation,
  useSidebarAnimation,
  useMagneticButton,
  useTooltipAnimation,
  useViewTransition,
  useCardHover,
  usePanelAnimation,
  useTimelineAnimation,
  useTreeAnimation,
  useParallax,
  useCursorTrail,
  useParticleSystem,
  useReducedMotion,
}
