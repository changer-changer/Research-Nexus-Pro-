import { useRef, ReactNode } from 'react'

interface AnimatedCardProps {
  children: ReactNode
  className?: string
}

export function AnimatedCard({ children, className = '' }: AnimatedCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)

  const handleMouseEnter = () => {
    if (cardRef.current) {
      cardRef.current.style.transform = 'translateY(-2px)'
      cardRef.current.style.boxShadow = '0 8px 24px rgba(0,0,0,0.2)'
    }
  }

  const handleMouseLeave = () => {
    if (cardRef.current) {
      cardRef.current.style.transform = 'translateY(0)'
      cardRef.current.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)'
    }
  }

  return (
    <div
      ref={cardRef}
      className={`rn-card transition-all duration-150 ${className}`}
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
    </div>
  )
}
