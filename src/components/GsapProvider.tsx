import { createContext, useContext, useEffect, useRef, ReactNode } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { Flip } from 'gsap/Flip'

// Register GSAP plugins
gsap.registerPlugin(ScrollTrigger, Flip)

interface GsapContextType {
  gsap: typeof gsap
  ScrollTrigger: typeof ScrollTrigger
  Flip: typeof Flip
}

const GsapContext = createContext<GsapContextType | null>(null)

export const useGsap = () => {
  const context = useContext(GsapContext)
  if (!context) {
    throw new Error('useGsap must be used within GsapProvider')
  }
  return context
}

interface GsapProviderProps {
  children: ReactNode
}

export const GsapProvider = ({ children }: GsapProviderProps) => {
  const contextValue = useRef({
    gsap,
    ScrollTrigger,
    Flip,
  })

  useEffect(() => {
    // Refresh ScrollTrigger on mount
    ScrollTrigger.refresh()
    
    return () => {
      // Cleanup all ScrollTriggers on unmount
      ScrollTrigger.getAll().forEach(trigger => trigger.kill())
    }
  }, [])

  return (
    <GsapContext.Provider value={contextValue.current}>
      {children}
    </GsapContext.Provider>
  )
}

export default GsapProvider
