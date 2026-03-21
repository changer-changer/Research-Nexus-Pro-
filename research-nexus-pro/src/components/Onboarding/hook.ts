import { useEffect, useState, useCallback } from 'react'
import { useOnboardingStore, ONBOARDING_STEPS } from './store'

export function useOnboarding() {
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

  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null)
  const currentStepData = ONBOARDING_STEPS[currentStep]

  useEffect(() => {
    if (isActive && currentStepData?.targetSelector) {
      const element = document.querySelector(currentStepData.targetSelector) as HTMLElement
      setTargetElement(element)
      
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' })
        element.classList.add('onboarding-highlight')
        
        return () => {
          element.classList.remove('onboarding-highlight')
        }
      }
    } else {
      setTargetElement(null)
    }
  }, [isActive, currentStep, currentStepData])

  const getTooltipPosition = useCallback(() => {
    if (!targetElement) {
      return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
    }

    const rect = targetElement.getBoundingClientRect()
    const position = currentStepData?.position || 'bottom'
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
  }, [targetElement, currentStepData])

  const progress = ((currentStep + 1) / ONBOARDING_STEPS.length) * 100

  return {
    isActive,
    currentStep,
    currentStepData,
    completedSteps,
    hasCompletedOnboarding,
    showTooltips,
    progress,
    targetElement,
    tooltipPosition: getTooltipPosition(),
    startOnboarding,
    nextStep,
    prevStep,
    skipOnboarding,
    completeOnboarding,
    goToStep,
    markStepCompleted,
    resetOnboarding,
    toggleTooltips,
    totalSteps: ONBOARDING_STEPS.length,
  }
}

export function useFirstVisitCheck() {
  const { hasCompletedOnboarding, startOnboarding } = useOnboardingStore()

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!hasCompletedOnboarding) {
        startOnboarding()
      }
    }, 1000)

    return () => clearTimeout(timer)
  }, [hasCompletedOnboarding, startOnboarding])
}
