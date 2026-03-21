import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Language = 'zh' | 'en'

export type LocaleKey =
  // Common
  | 'common.loading'
  | 'common.error'
  | 'common.retry'
  | 'common.cancel'
  | 'common.save'
  | 'common.delete'
  | 'common.edit'
  | 'common.close'
  | 'common.back'
  | 'common.next'
  | 'common.search'
  | 'common.filter'
  | 'common.sort'
  // Navigation
  | 'nav.problemTree'
  | 'nav.methodTree'
  | 'nav.dualTree'
  | 'nav.timeline'
  | 'nav.citation'
  | 'nav.bookmarks'
  | 'nav.export'
  // Views
  | 'view.problemTree.title'
  | 'view.problemTree.description'
  | 'view.methodTree.title'
  | 'view.methodTree.description'
  | 'view.dualTree.title'
  | 'view.dualTree.description'
  | 'view.timeline.title'
  | 'view.timeline.description'
  // Onboarding
  | 'onboarding.welcome.title'
  | 'onboarding.welcome.description'
  | 'onboarding.problemTree.title'
  | 'onboarding.problemTree.description'
  | 'onboarding.methodTree.title'
  | 'onboarding.methodTree.description'
  | 'onboarding.next'
  | 'onboarding.prev'
  | 'onboarding.skip'
  | 'onboarding.finish'
  // Help
  | 'help.title'
  | 'help.shortcuts'
  | 'help.features'
  | 'help.guide'
  // Errors
  | 'error.generic'
  | 'error.notFound'
  | 'error.network'
  | 'error.boundary.title'
  | 'error.boundary.description'

interface I18nState {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: LocaleKey, params?: Record<string, string>) => string
}

const translations: Record<Language, Record<LocaleKey, string>> = {
  zh: {
    // Common
    'common.loading': '加载中...',
    'common.error': '出错了',
    'common.retry': '重试',
    'common.cancel': '取消',
    'common.save': '保存',
    'common.delete': '删除',
    'common.edit': '编辑',
    'common.close': '关闭',
    'common.back': '返回',
    'common.next': '下一步',
    'common.search': '搜索',
    'common.filter': '筛选',
    'common.sort': '排序',
    // Navigation
    'nav.problemTree': '问题树',
    'nav.methodTree': '方法树',
    'nav.dualTree': '双树融合',
    'nav.timeline': '时间轴',
    'nav.citation': '引用网络',
    'nav.bookmarks': '书签',
    'nav.export': '导出',
    // Views
    'view.problemTree.title': '问题树视图',
    'view.problemTree.description': '探索研究领域中的核心问题及其演变',
    'view.methodTree.title': '方法树视图',
    'view.methodTree.description': '浏览研究方法体系及其关系',
    'view.dualTree.title': '双树融合',
    'view.dualTree.description': '同时在问题和方法维度上探索',
    'view.timeline.title': '时间轴视图',
    'view.timeline.description': '按时间顺序查看研究发展',
    // Onboarding
    'onboarding.welcome.title': '欢迎来到 Research Nexus Pro',
    'onboarding.welcome.description': '这是一个强大的学术研究可视化工具，帮助您探索问题、方法和论文之间的关系网络。',
    'onboarding.problemTree.title': '问题树视图',
    'onboarding.problemTree.description': '这里展示了研究领域中的核心问题及其演变。点击节点查看详细信息。',
    'onboarding.methodTree.title': '方法树视图',
    'onboarding.methodTree.description': '探索各种研究方法及其关联。可以追踪方法如何应用于不同问题。',
    'onboarding.next': '下一步',
    'onboarding.prev': '上一步',
    'onboarding.skip': '跳过引导',
    'onboarding.finish': '完成',
    // Help
    'help.title': '帮助中心',
    'help.shortcuts': '快捷键',
    'help.features': '功能指南',
    'help.guide': '快速入门',
    // Errors
    'error.generic': '发生错误，请稍后重试',
    'error.notFound': '未找到相关内容',
    'error.network': '网络连接错误，请检查网络',
    'error.boundary.title': '出了点问题',
    'error.boundary.description': '应用遇到了意外错误，请尝试刷新页面',
  },
  en: {
    // Common
    'common.loading': 'Loading...',
    'common.error': 'Error',
    'common.retry': 'Retry',
    'common.cancel': 'Cancel',
    'common.save': 'Save',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.close': 'Close',
    'common.back': 'Back',
    'common.next': 'Next',
    'common.search': 'Search',
    'common.filter': 'Filter',
    'common.sort': 'Sort',
    // Navigation
    'nav.problemTree': 'Problem Tree',
    'nav.methodTree': 'Method Tree',
    'nav.dualTree': 'Dual Tree',
    'nav.timeline': 'Timeline',
    'nav.citation': 'Citation Network',
    'nav.bookmarks': 'Bookmarks',
    'nav.export': 'Export',
    // Views
    'view.problemTree.title': 'Problem Tree View',
    'view.problemTree.description': 'Explore core research problems and their evolution',
    'view.methodTree.title': 'Method Tree View',
    'view.methodTree.description': 'Browse research methods and their relationships',
    'view.dualTree.title': 'Dual Tree Fusion',
    'view.dualTree.description': 'Explore both problem and method dimensions',
    'view.timeline.title': 'Timeline View',
    'view.timeline.description': 'View research development chronologically',
    // Onboarding
    'onboarding.welcome.title': 'Welcome to Research Nexus Pro',
    'onboarding.welcome.description': 'A powerful academic research visualization tool to explore relationships between problems, methods, and papers.',
    'onboarding.problemTree.title': 'Problem Tree View',
    'onboarding.problemTree.description': 'Explore core research problems and their evolution. Click nodes for details.',
    'onboarding.methodTree.title': 'Method Tree View',
    'onboarding.methodTree.description': 'Discover research methods and their connections. Track how methods apply to different problems.',
    'onboarding.next': 'Next',
    'onboarding.prev': 'Previous',
    'onboarding.skip': 'Skip Tour',
    'onboarding.finish': 'Finish',
    // Help
    'help.title': 'Help Center',
    'help.shortcuts': 'Keyboard Shortcuts',
    'help.features': 'Feature Guide',
    'help.guide': 'Quick Start',
    // Errors
    'error.generic': 'An error occurred, please try again later',
    'error.notFound': 'Content not found',
    'error.network': 'Network error, please check your connection',
    'error.boundary.title': 'Something went wrong',
    'error.boundary.description': 'The app encountered an unexpected error, please try refreshing',
  },
}

export const useI18nStore = create<I18nState>()(
  persist(
    (set, get) => ({
      language: 'zh',
      setLanguage: (lang) => set({ language: lang }),
      t: (key, params) => {
        const { language } = get()
        let text = translations[language][key] || key

        if (params) {
          Object.entries(params).forEach(([param, value]) => {
            text = text.replace(`{{${param}}}`, value)
          })
        }

        return text
      },
    }),
    {
      name: 'i18n-storage',
    }
  )
)

// Hook for components
export function useTranslation() {
  const { language, setLanguage, t } = useI18nStore()

  return {
    t,
    language,
    setLanguage,
    isZh: language === 'zh',
    isEn: language === 'en',
  }
}

// Utility to get browser language
export function getBrowserLanguage(): Language {
  const lang = navigator.language.toLowerCase()
  if (lang.startsWith('zh')) return 'zh'
  return 'en'
}

// Initialize language from browser
export function initI18n() {
  const saved = localStorage.getItem('i18n-storage')
  if (!saved) {
    const browserLang = getBrowserLanguage()
    useI18nStore.getState().setLanguage(browserLang)
  }
}
