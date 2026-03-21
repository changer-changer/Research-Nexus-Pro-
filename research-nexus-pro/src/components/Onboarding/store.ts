import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface OnboardingStep {
  id: string
  title: string
  description: string
  targetSelector?: string
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center'
  image?: string
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: '欢迎来到 Research Nexus Pro',
    description: '这是一个强大的学术研究可视化工具，帮助您探索问题、方法和论文之间的关系网络。',
    position: 'center',
  },
  {
    id: 'problem-tree',
    title: '问题树视图',
    description: '这里展示了研究领域中的核心问题及其演变。点击节点查看详细信息。',
    targetSelector: '[data-tour="problem-tree"]',
    position: 'right',
  },
  {
    id: 'method-tree',
    title: '方法树视图',
    description: '探索各种研究方法及其关联。可以追踪方法如何应用于不同问题。',
    targetSelector: '[data-tour="method-tree"]',
    position: 'right',
  },
  {
    id: 'dual-tree',
    title: '双树融合',
    description: '同时在问题树和方法树之间导航，发现跨领域的研究机会。',
    targetSelector: '[data-tour="dual-tree"]',
    position: 'right',
  },
  {
    id: 'timeline',
    title: '时间轴视图',
    description: '查看研究问题和论文的时间演变，追踪研究趋势的发展。',
    targetSelector: '[data-tour="timeline"]',
    position: 'right',
  },
  {
    id: 'bookmarks',
    title: '书签系统',
    description: '使用 Ctrl+B 快速打开书签面板，保存您关心的节点以便后续查看。',
    targetSelector: '[data-tour="bookmarks"]',
    position: 'left',
  },
  {
    id: 'shortcuts',
    title: '快捷键',
    description: 'Ctrl+Z 撤销, Ctrl+Y 重做, Ctrl+B 书签, 按 ? 查看所有快捷键。',
    position: 'center',
  },
]

interface OnboardingState {
  isActive: boolean
  currentStep: number
  completedSteps: string[]
  hasCompletedOnboarding: boolean
  showTooltips: boolean
  
  startOnboarding: () => void
  nextStep: () => void
  prevStep: () => void
  skipOnboarding: () => void
  completeOnboarding: () => void
  goToStep: (step: number) => void
  markStepCompleted: (stepId: string) => void
  resetOnboarding: () => void
  toggleTooltips: () => void
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      isActive: false,
      currentStep: 0,
      completedSteps: [],
      hasCompletedOnboarding: false,
      showTooltips: true,

      startOnboarding: () => set({ isActive: true, currentStep: 0 }),
      
      nextStep: () => {
        const { currentStep } = get()
        if (currentStep < ONBOARDING_STEPS.length - 1) {
          set({ currentStep: currentStep + 1 })
        } else {
          get().completeOnboarding()
        }
      },
      
      prevStep: () => {
        const { currentStep } = get()
        if (currentStep > 0) {
          set({ currentStep: currentStep - 1 })
        }
      },
      
      skipOnboarding: () => set({ isActive: false }),
      
      completeOnboarding: () => set({
        isActive: false,
        hasCompletedOnboarding: true,
        currentStep: 0,
      }),
      
      goToStep: (step: number) => {
        if (step >= 0 && step < ONBOARDING_STEPS.length) {
          set({ currentStep: step })
        }
      },
      
      markStepCompleted: (stepId: string) => set((state) => ({
        completedSteps: [...state.completedSteps, stepId],
      })),
      
      resetOnboarding: () => set({
        isActive: false,
        currentStep: 0,
        completedSteps: [],
        hasCompletedOnboarding: false,
      }),
      
      toggleTooltips: () => set((state) => ({ showTooltips: !state.showTooltips })),
    }),
    {
      name: 'onboarding-storage',
      partialize: (state) => ({
        hasCompletedOnboarding: state.hasCompletedOnboarding,
        completedSteps: state.completedSteps,
        showTooltips: state.showTooltips,
      }),
    }
  )
)
