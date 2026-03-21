import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronRight, ChevronLeft, Sparkles, Check } from 'lucide-react'
import { useOnboarding } from './hook'
import { Button } from '../ui/Button'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function OnboardingOverlay() {
  const {
    isActive,
    currentStep,
    currentStepData,
    progress,
    tooltipPosition,
    nextStep,
    prevStep,
    skipOnboarding,
    completeOnboarding,
    totalSteps,
  } = useOnboarding()

  if (!isActive || !currentStepData) return null

  const isLastStep = currentStep === totalSteps - 1
  const isFirstStep = currentStep === 0

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={skipOnboarding} />

      {/* Spotlight for targeted element */}
      {currentStepData.targetSelector && (
        <Spotlight selector={currentStepData.targetSelector} />
      )}

      {/* Tooltip Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, scale: 0.9, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: -10 }}
          transition={{ duration: 0.2 }}
          className="absolute z-10"
          style={tooltipPosition}
        >
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-6 max-w-md">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                    步骤 {currentStep + 1}/{totalSteps}
                  </span>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    {currentStepData.title}
                  </h3>
                </div>
              </div>
              <button
                onClick={skipOnboarding}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                aria-label="关闭引导"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <p className="text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
              {currentStepData.description}
            </p>

            {/* Progress Bar */}
            <div className="mb-6">
              <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between">
              <button
                onClick={skipOnboarding}
                className="text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                跳过引导
              </button>

              <div className="flex items-center gap-2">
                {!isFirstStep && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={prevStep}
                    icon={<ChevronLeft className="w-4 h-4" />}
                  >
                    上一步
                  </Button>
                )}

                {isLastStep ? (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={completeOnboarding}
                    icon={<Check className="w-4 h-4" />}
                  >
                    完成
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={nextStep}
                    icon={<ChevronRight className="w-4 h-4" />}
                    iconPosition="right"
                  >
                    下一步
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Arrow */}
          {currentStepData.position && currentStepData.position !== 'center' && (
            <TooltipArrow position={currentStepData.position} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

function Spotlight({ selector }: { selector: string }) {
  const [rect, setRect] = useState<DOMRect | null>(null)

  useEffect(() => {
    const updateRect = () => {
      const element = document.querySelector(selector)
      if (element) {
        setRect(element.getBoundingClientRect())
      }
    }

    updateRect()
    window.addEventListener('resize', updateRect)
    window.addEventListener('scroll', updateRect)

    return () => {
      window.removeEventListener('resize', updateRect)
      window.removeEventListener('scroll', updateRect)
    }
  }, [selector])

  if (!rect) return null

  const padding = 8

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        top: rect.top - padding,
        left: rect.left - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
        boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6)',
        borderRadius: 12,
      }}
    />
  )
}

function TooltipArrow({ position }: { position: string }) {
  const arrowClasses = {
    top: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-full border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-white dark:border-t-slate-900',
    bottom: 'top-0 left-1/2 -translate-x-1/2 -translate-y-full border-l-8 border-r-8 border-b-8 border-l-transparent border-r-transparent border-b-white dark:border-b-slate-900',
    left: 'right-0 top-1/2 translate-x-full -translate-y-1/2 border-t-8 border-b-8 border-l-8 border-t-transparent border-b-transparent border-l-white dark:border-l-slate-900',
    right: 'left-0 top-1/2 -translate-x-full -translate-y-1/2 border-t-8 border-b-8 border-r-8 border-t-transparent border-b-transparent border-r-white dark:border-r-slate-900',
  }

  return (
    <div
      className={cn(
        'absolute w-0 h-0',
        arrowClasses[position as keyof typeof arrowClasses]
      )}
    />
  )
}

// Button component for onboarding
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  icon?: React.ReactNode
  iconPosition?: 'left' | 'right'
}

function Button({
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  children,
  className,
  ...props
}: ButtonProps) {
  const variants = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700',
    secondary: 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300',
    ghost: 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800',
  }

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2',
    lg: 'px-6 py-3 text-lg',
  }

  return (
    <button
      className={cn(
        'inline-flex items-center gap-2 rounded-lg font-medium transition-colors',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {icon && iconPosition === 'left' && icon}
      {children}
      {icon && iconPosition === 'right' && icon}
    </button>
  )
}
