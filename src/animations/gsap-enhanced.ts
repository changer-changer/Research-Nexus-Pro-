// Minimal GSAP animation utilities for Research-Nexus Pro

import { gsap } from 'gsap'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

export const animateButtonClick = (button: Element) => {
  if (prefersReducedMotion()) return gsap.timeline()
  const tl = gsap.timeline()
  tl.to(button, { scale: 0.97, duration: 0.08, ease: 'power2.in' })
    .to(button, { scale: 1, duration: 0.2, ease: 'power2.out' })
  return tl
}

export const animateNavItemHover = (item: Element, isEntering: boolean) => {
  if (prefersReducedMotion()) return gsap.timeline()
  if (isEntering) {
    return gsap.to(item, { x: 4, duration: 0.15, ease: 'power2.out' })
  } else {
    return gsap.to(item, { x: 0, duration: 0.15, ease: 'power2.out' })
  }
}

export const initPageLoadSequence = () => {
  if (prefersReducedMotion()) return gsap.timeline()
  const tl = gsap.timeline({ defaults: { ease: 'power2.out' } })
  gsap.set('aside', { opacity: 0, x: -20 })
  gsap.set('main', { opacity: 0 })
  tl.to('aside', { opacity: 1, x: 0, duration: 0.3 })
    .to('main', { opacity: 1, duration: 0.3 }, '-=0.15')
  return tl
}

// Stub exports for backward compatibility (MethodTree.tsx uses these)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const animateTreeNodeEntrance = (_container?: unknown) => {}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const animateNodeHover = (_node?: unknown, _isEntering?: unknown, _color?: unknown) => {}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const animateNodeClick = (_node?: unknown, _x?: unknown, _y?: unknown, _color?: unknown) => {}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const animateNodeSelection = (_node?: unknown, _isSelected?: unknown) => {}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const animateAllConnections = (_container?: unknown) => {}
