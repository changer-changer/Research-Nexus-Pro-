import { useEffect } from 'react'
import { 
  OnboardingOverlay, 
  OnboardingTrigger, 
  useFirstVisitCheck,
  useOnboarding 
} from '../components/Onboarding'
import { HelpPanel, QuickHelpTooltip, ContextualHelp } from '../components/Help'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { PageLoader, Skeleton, DataLoading } from '../components/Loading'
import { useTranslation } from '../i18n'
import { useBreakpoint, useDarkMode, useReducedMotion, useHighContrast } from '../hooks'
import { SkipLink, VisuallyHidden, AriaAnnouncer } from '../hooks/useA11y'

// 示例：如何在主应用中集成所有可用性功能
function AppWithAccessibility({ children }: { children: React.ReactNode }) {
  const { t, language } = useTranslation()
  const { isActive, currentStep, progress } = useOnboarding()
  const isMobile = useBreakpoint('sm')
  const isDark = useDarkMode()
  const prefersReducedMotion = useReducedMotion()
  const prefersHighContrast = useHighContrast()
  
  // Auto-start onboarding for first-time users
  useFirstVisitCheck()
  
  // Add ARIA announcer and skip link at root level
  useEffect(() => {
    // Add ARIA announcer elements if not present
    if (!document.getElementById('aria-announcer-polite')) {
      const polite = document.createElement('div')
      polite.id = 'aria-announcer-polite'
      polite.setAttribute('aria-live', 'polite')
      polite.setAttribute('aria-atomic', 'true')
      polite.className = 'sr-only'
      document.body.appendChild(polite)
    }
    
    if (!document.getElementById('aria-announcer-assertive')) {
      const assertive = document.createElement('div')
      assertive.id = 'aria-announcer-assertive'
      assertive.setAttribute('aria-live', 'assertive')
      assertive.setAttribute('aria-atomic', 'true')
      assertive.className = 'sr-only'
      document.body.appendChild(assertive)
    }
  }, [])
  
  return (
    <>
      {/* Skip link for keyboard users */}
      <SkipLink targetId="main-content" children="跳转到主要内容" />
      
      {/* ARIA live regions */}
      <AriaAnnouncer />
      
      {/* Page loader - shown during initial load */}
      <PageLoader 
        message={t('common.loading')} 
        submessage={language === 'zh' ? '正在初始化研究网络...' : 'Initializing research network...'}
      />
      
      {/* Main content with error boundary */}
      <ErrorBoundary 
        onError={(error, info) => {
          console.error('Application error:', error, info)
          // Could send to error tracking service here
        }}
      >
        <div id="main-content" className="min-h-screen">
          {/* Visually hidden heading for screen readers */}
          <VisuallyHidden>Research Nexus Pro 主界面</VisuallyHidden>
          
          {/* Conditional content based on loading states */}
          {/* ... main app content would go here ... */}
          
          {/* Onboarding overlay (shown when active) */}
          {isActive && (
            <OnboardingOverlay />
          )}
          
          {/* Help panel (would be controlled by state) */}
          {/* <HelpPanel isOpen={showHelp} onClose={setShowHelp(false)} /> */}
          
          {/* Contextual help examples */}
          <div className="p-4">
            <ContextualHelp 
              featureId="problem-tree-view"
              title="问题树视图"
              description="探索研究领域中的核心问题及其演变历史"
              tips=[
                "点击节点展开/折叠子问题",
                "右键查看详细信息选项",
                "拖拽节点重新排列布局",
                "使用搜索框快速定位特定问题"
              ]
              videoUrl="/help/problem-tree-tutorial"
              docsUrl="/docs/problem-tree"
            />
            
            {/* Demo data explorer button */}
            <div className="fixed bottom-6 right-6 z-40">
              {/* Would trigger demo explorer in actual implementation */}
              <button 
                className="p-3 rounded-full bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-800/30 transition-colors"
                title="查看示例数据演示"
                aria-label="查看示例数据演示"
              >
                <Play className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </button>
            </div>
          </div>
          
          {/* Accessibility indicators (for development/testing) */}
          {!import.meta.env.PROD && (
            <div className="fixed bottom-4 left-4 z-40 bg-slate-800 dark:bg-slate-200 text-xs px-2 py-1 rounded text-white">
              {language} {isDark ? '🌙' : '☀️'} 
              {prefersReducedMotion ? '⚪' : ''}
              {prefersHighContrast ? '⚫' : ''}
            </div>
          )}
        </div>
      </ErrorBoundary>
    </>
  )
}

// Export for use in main App.tsx
export default AppWithAccessibility

// Custom hook that combines all accessibility features
export function useAccessibilityFeatures() {
  const { t, language, setLanguage } = useTranslation()
  const isMobile = useBreakpoint('sm')
  const isDark = useDarkMode()
  const prefersReducedMotion = useReducedMotion()
  const prefersHighContrast = useHighContrast()
  const canHover = useHover()
  const isTouch = useTouch()
  
  return {
    // i18n
    t,
    language,
    setLanguage,
    
    // Responsive
    isMobile,
    isTablet: useBreakpoint('md') && !useBreakpoint('lg'),
    isDesktop: useBreakpoint('lg'),
    isWide: useBreakpoint('xl'),
    
    // Theme & Preferences
    isDark,
    prefersReducedMotion,
    prefersHighContrast,
    canHover,
    isTouch,
    
    // Utility functions
    toggleLanguage: () => setLanguage(language === 'zh' ? 'en' : 'zh'),
    prefersColorScheme: isDark ? 'dark' : 'light',
  }
}
