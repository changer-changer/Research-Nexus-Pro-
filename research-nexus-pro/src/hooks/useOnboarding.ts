import { useCallback, useEffect } from 'react'
import { useOnboardingStore, ONBOARDING_STEPS, type OnboardingStep } from '../components/Onboarding/store'

export interface UseOnboardingReturn {
  isActive: boolean
  currentStep: number
  currentStepData: OnboardingStep | undefined
  completedSteps: string[]
  hasCompletedOnboarding: boolean
  showTooltips: boolean
  progress: number
  totalSteps: number
  startOnboarding: () => void
  nextStep: () => void
  prevStep: () => void
  skipOnboarding: () => void
  completeOnboarding: () => void
  goToStep: (step: number) => void
  markStepCompleted: (stepId: string) => void
  resetOnboarding: () => void
  toggleTooltips: () => void
  isStepCompleted: (stepId: string) => boolean
}

export function useOnboarding(): UseOnboardingReturn {
  const {
    isActive,
    currentStep,
    completedSteps,
    hasCompletedOnboarding,
    showTooltips,
    startOnboarding,
    nextStep,
    prevStep,
    skipOnboarding,
    completeOnboarding,
    goToStep,
    markStepCompleted,
    resetOnboarding,
    toggleTooltips,
  } = useOnboardingStore()

  const currentStepData = ONBOARDING_STEPS[currentStep]
  const progress = ((currentStep + 1) / ONBOARDING_STEPS.length) * 100

  const isStepCompleted = useCallback(
    (stepId: string) => completedSteps.includes(stepId),
    [completedSteps]
  )

  return {
    isActive,
    currentStep,
    currentStepData,
    completedSteps,
    hasCompletedOnboarding,
    showTooltips,
    progress,
    totalSteps: ONBOARDING_STEPS.length,
    startOnboarding,
    nextStep,
    prevStep,
    skipOnboarding,
    completeOnboarding,
    goToStep,
    markStepCompleted,
    resetOnboarding,
    toggleTooltips,
    isStepCompleted,
  }
}

// Hook to check if user is on first visit and auto-start onboarding
export function useFirstVisitCheck(delay: number = 1500): void {
  const { hasCompletedOnboarding, startOnboarding } = useOnboardingStore()

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!hasCompletedOnboarding) {
        startOnboarding()
      }
    }, delay)

    return () => clearTimeout(timer)
  }, [hasCompletedOnboarding, startOnboarding, delay])
}

// Hook to track onboarding events for analytics
export function useOnboardingAnalytics() {
  const trackEvent = useCallback((event: string, data?: Record<string, unknown>) => {
    // Analytics tracking placeholder
    // Example: gtag('event', event, data)
    if (import.meta.env.DEV) {
      console.log('[Onboarding Analytics]', event, data)
    }
  }, [])

  const trackStepView = useCallback((stepId: string, stepIndex: number) => {
    trackEvent('onboarding_step_viewed', { step_id: stepId, step_index: stepIndex })
  }, [trackEvent])

  const trackStepComplete = useCallback((stepId: string) => {
    trackEvent('onboarding_step_completed', { step_id: stepId })
  }, [trackEvent])

  const trackOnboardingComplete = useCallback(() => {
    trackEvent('onboarding_completed')
  }, [trackEvent])

  const trackOnboardingSkip = useCallback((stepIndex: number) => {
    trackEvent('onboarding_skipped', { at_step: stepIndex })
  }, [trackEvent])

  return {
    trackEvent,
    trackStepView,
    trackStepComplete,
    trackOnboardingComplete,
    trackOnboardingSkip,
  }
}

// Hook to sync onboarding with keyboard shortcuts
export function useOnboardingKeyboardShortcuts() {
  const { isActive, nextStep, prevStep, skipOnboarding } = useOnboardingStore()

  useEffect(() => {
    if (!isActive) return

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          e.preventDefault()
          nextStep()
          break
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault()
          prevStep()
          break
        case 'Escape':
          e.preventDefault()
          skipOnboarding()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isActive, nextStep, prevStep, skipOnboarding])
}

// Hook to get tooltip position based on target element
export function useTooltipPosition(
  targetSelector: string | undefined,
  position: 'top' | 'bottom' | 'left' | 'right' | 'center' = 'bottom'
) {
  const getPosition = useCallback(() => {
    if (!targetSelector) {
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      }
    }

    const element = document.querySelector(targetSelector) as HTMLElement
    if (!element) {
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      }
    }

    const rect = element.getBoundingClientRect()
    const offset = 16

    switch (position) {
      case 'top':
        return {
          top: `${rect.top - offset}px`,
          left: `${rect.left + rect.width / 2}px`,
          transform: 'translate(-50%, -100%)',
        }
      case 'bottom':
        return {
          top: `${rect.bottom + offset}px`,
          left: `${rect.left + rect.width / 2}px`,
          transform: 'translate(-50%, 0)',
        }
      case 'left':
        return {
          top: `${rect.top + rect.height / 2}px`,
          left: `${rect.left - offset}px`,
          transform: 'translate(-100%, -50%)',
        }
      case 'right':
        return {
          top: `${rect.top + rect.height / 2}px`,
          left: `${rect.right + offset}px`,
          transform: 'translate(0, -50%)',
        }
      default:
        return {
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }
    }
  }, [targetSelector, position])

  return getPosition()
}

export default useOnboarding
