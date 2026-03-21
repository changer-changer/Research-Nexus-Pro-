/**
 * 快捷键系统 - Linear/Notion 级别的键盘导航体验
 * 
 * 特性:
 * 1. 完整的快捷键映射
 * 2. 快捷键提示系统
 * 3. Vim-like 导航支持
 * 4. 可配置的快捷键
 * 5. 上下文感知
 */

import { useEffect, useRef, useCallback, useState } from 'react'

// 快捷键修饰键
type ModifierKey = 'ctrl' | 'cmd' | 'alt' | 'shift' | 'meta'

// 快捷键定义
interface Shortcut {
  /** 快捷键 ID */
  id: string
  /** 快捷键名称 */
  name: string
  /** 快捷键描述 */
  description: string
  /** 快捷键组合 */
  keys: string[]
  /** 修饰键 */
  modifiers?: ModifierKey[]
  /** 回调函数 */
  handler: () => void | boolean
  /** 是否可阻止默认行为 */
  preventDefault?: boolean
  /** 是否可停止冒泡 */
  stopPropagation?: boolean
  /** 生效条件 */
  when?: () => boolean
  /** 所属分类 */
  category: string
  /** 上下文 (全局/特定组件) */
  context?: string
}

// 快捷键上下文
interface ShortcutContext {
  id: string
  name: string
  shortcuts: Shortcut[]
  active: boolean
}

// 快捷键帮助项
interface ShortcutHelpItem {
  id: string
  name: string
  description: string
  displayKeys: string
  category: string
}

/**
 * 快捷键管理器类
 */
class ShortcutManager {
  private shortcuts: Map<string, Shortcut> = new Map()
  private contexts: Map<string, ShortcutContext> = new Map()
  private activeContext: string = 'global'
  private vimMode: boolean = false
  private listeners: Set<(keyboardEvent: KeyboardEvent) => void> = new Set()

  constructor() {
    this.handleKeyDown = this.handleKeyDown.bind(this)
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.handleKeyDown)
    }
  }

  /**
   * 注册快捷键
   */
  register(shortcut: Shortcut): () => void {
    const key = this.getShortcutKey(shortcut)
    this.shortcuts.set(key, shortcut)

    return () => {
      this.shortcuts.delete(key)
    }
  }

  /**
   * 批量注册快捷键
   */
  registerMany(shortcuts: Shortcut[]): () => void {
    const unregisterFns = shortcuts.map(s => this.register(s))
    return () => unregisterFns.forEach(fn => fn())
  }

  /**
   * 注销快捷键
   */
  unregister(shortcut: Shortcut): void {
    const key = this.getShortcutKey(shortcut)
    this.shortcuts.delete(key)
  }

  /**
   * 设置当前上下文
   */
  setContext(contextId: string): void {
    this.activeContext = contextId
  }

  /**
   * 切换 Vim 模式
   */
  setVimMode(enabled: boolean): void {
    this.vimMode = enabled
  }

  /**
   * 获取快捷键唯一键
   */
  private getShortcutKey(shortcut: Shortcut): string {
    const modifiers = (shortcut.modifiers || []).sort().join('+')
    const keys = shortcut.keys.join('+')
    return `${modifiers}:${keys}:${shortcut.context || 'global'}`
  }

  /**
   * 检查快捷键是否匹配
   */
  private matchesShortcut(event: KeyboardEvent, shortcut: Shortcut): boolean {
    // 检查上下文
    if (shortcut.context && shortcut.context !== this.activeContext) {
      return false
    }

    // 检查修饰键
    const modifiers = shortcut.modifiers || []
    const hasCtrl = modifiers.includes('ctrl') || modifiers.includes('cmd')
    const hasAlt = modifiers.includes('alt')
    const hasShift = modifiers.includes('shift')
    const hasMeta = modifiers.includes('meta') || modifiers.includes('cmd')

    if (hasCtrl !== (event.ctrlKey || event.metaKey)) return false
    if (hasAlt !== event.altKey) return false
    if (hasShift !== event.shiftKey) return false
    if (hasMeta !== event.metaKey) return false

    // 检查主键
    const key = event.key.toLowerCase()
    const matchesKey = shortcut.keys.some(k => k.toLowerCase() === key)

    return matchesKey
  }

  /**
   * 键盘事件处理
   */
  private handleKeyDown(event: KeyboardEvent): void {
    // 通知所有监听器
    this.listeners.forEach(listener => listener(event))

    // 在输入框中不触发快捷键
    if (this.isInputElement(event.target as HTMLElement)) {
      return
    }

    // 查找匹配的快捷键
    for (const shortcut of this.shortcuts.values()) {
      if (this.matchesShortcut(event, shortcut)) {
        // 检查条件
        if (shortcut.when && !shortcut.when()) {
          continue
        }

        // 执行回调
        const result = shortcut.handler()

        // 阻止默认行为
        if (shortcut.preventDefault !== false && result !== false) {
          event.preventDefault()
        }

        if (shortcut.stopPropagation) {
          event.stopPropagation()
        }

        break
      }
    }
  }

  /**
   * 检查是否为输入元素
   */
  private isInputElement(element: HTMLElement): boolean {
    const tagName = element.tagName.toLowerCase()
    return (
      tagName === 'input' ||
      tagName === 'textarea' ||
      tagName === 'select' ||
      element.isContentEditable
    )
  }

  /**
   * 获取所有快捷键帮助信息
   */
  getHelp(): ShortcutHelpItem[] {
    return Array.from(this.shortcuts.values()).map(s => ({
      id: s.id,
      name: s.name,
      description: s.description,
      displayKeys: this.formatShortcut(s),
      category: s.category,
    }))
  }

  /**
   * 格式化快捷键显示
   */
  formatShortcut(shortcut: Shortcut): string {
    const parts: string[] = []

    if (shortcut.modifiers?.includes('cmd') || shortcut.modifiers?.includes('meta')) {
      parts.push('⌘')
    }
    if (shortcut.modifiers?.includes('ctrl')) {
      parts.push('Ctrl')
    }
    if (shortcut.modifiers?.includes('alt')) {
      parts.push('Alt')
    }
    if (shortcut.modifiers?.includes('shift')) {
      parts.push('⇧')
    }

    parts.push(...shortcut.keys.map(k => k.toUpperCase()))

    return parts.join(' ')
  }

  /**
   * 添加键盘事件监听器
   */
  addListener(listener: (keyboardEvent: KeyboardEvent) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /**
   * 销毁
   */
  destroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.handleKeyDown)
    }
    this.shortcuts.clear()
    this.contexts.clear()
    this.listeners.clear()
  }
}

// 单例实例
let shortcutManager: ShortcutManager | null = null

export function getShortcutManager(): ShortcutManager {
  if (!shortcutManager) {
    shortcutManager = new ShortcutManager()
  }
  return shortcutManager
}

/**
 * React Hook: 使用快捷键
 */
export function useShortcut(shortcut: Shortcut | Shortcut[]): void {
  const manager = getShortcutManager()

  useEffect(() => {
    if (Array.isArray(shortcut)) {
      return manager.registerMany(shortcut)
    } else {
      return manager.register(shortcut)
    }
  }, [manager, shortcut])
}

/**
 * React Hook: 使用键盘监听
 */
export function useKeyboardListener(callback: (event: KeyboardEvent) => void): void {
  const manager = getShortcutManager()

  useEffect(() => {
    return manager.addListener(callback)
  }, [manager, callback])
}

/**
 * React Hook: 快捷键帮助面板
 */
export function useShortcutHelp() {
  const manager = getShortcutManager()
  const [isOpen, setIsOpen] = useState(false)

  const shortcuts = manager.getHelp()

  const toggle = useCallback(() => setIsOpen(prev => !prev), [])
  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])

  return { shortcuts, isOpen, toggle, open, close }
}

// ==================== 预定义快捷键 ====================

export const GLOBAL_SHORTCUTS: Shortcut[] = [
  // 导航
  {
    id: 'nav.search',
    name: '搜索',
    description: '打开全局搜索',
    keys: ['k'],
    modifiers: ['cmd'],
    category: '导航',
    handler: () => {
      document.dispatchEvent(new CustomEvent('shortcut:search'))
    },
  },
  {
    id: 'nav.shortcuts',
    name: '快捷键帮助',
    description: '显示快捷键帮助面板',
    keys: ['?'],
    modifiers: ['shift'],
    category: '导航',
    handler: () => {
      document.dispatchEvent(new CustomEvent('shortcut:help'))
    },
  },
  {
    id: 'nav.escape',
    name: '退出',
    description: '关闭当前面板或取消操作',
    keys: ['escape'],
    category: '导航',
    handler: () => {
      document.dispatchEvent(new CustomEvent('shortcut:escape'))
    },
  },

  // 视图
  {
    id: 'view.zoomIn',
    name: '放大',
    description: '放大画布',
    keys: ['='],
    modifiers: ['cmd'],
    category: '视图',
    handler: () => {
      document.dispatchEvent(new CustomEvent('shortcut:zoomIn'))
    },
  },
  {
    id: 'view.zoomOut',
    name: '缩小',
    description: '缩小画布',
    keys: ['-'],
    modifiers: ['cmd'],
    category: '视图',
    handler: () => {
      document.dispatchEvent(new CustomEvent('shortcut:zoomOut'))
    },
  },
  {
    id: 'view.zoomReset',
    name: '重置缩放',
    description: '重置画布缩放比例',
    keys: ['0'],
    modifiers: ['cmd'],
    category: '视图',
    handler: () => {
      document.dispatchEvent(new CustomEvent('shortcut:zoomReset'))
    },
  },
  {
    id: 'view.fit',
    name: '适应屏幕',
    description: '将内容适应到屏幕大小',
    keys: ['1'],
    modifiers: ['cmd'],
    category: '视图',
    handler: () => {
      document.dispatchEvent(new CustomEvent('shortcut:fit'))
    },
  },
  {
    id: 'view.fullscreen',
    name: '全屏',
    description: '切换全屏模式',
    keys: ['f'],
    modifiers: ['cmd', 'shift'],
    category: '视图',
    handler: () => {
      document.dispatchEvent(new CustomEvent('shortcut:fullscreen'))
    },
  },

  // 编辑
  {
    id: 'edit.undo',
    name: '撤销',
    description: '撤销上一步操作',
    keys: ['z'],
    modifiers: ['cmd'],
    category: '编辑',
    handler: () => {
      document.dispatchEvent(new CustomEvent('shortcut:undo'))
    },
  },
  {
    id: 'edit.redo',
    name: '重做',
    description: '重做上一步操作',
    keys: ['z'],
    modifiers: ['cmd', 'shift'],
    category: '编辑',
    handler: () => {
      document.dispatchEvent(new CustomEvent('shortcut:redo'))
    },
  },
  {
    id: 'edit.selectAll',
    name: '全选',
    description: '选中所有节点',
    keys: ['a'],
    modifiers: ['cmd'],
    category: '编辑',
    handler: () => {
      document.dispatchEvent(new CustomEvent('shortcut:selectAll'))
    },
  },
  {
    id: 'edit.delete',
    name: '删除',
    description: '删除选中项',
    keys: ['backspace'],
    category: '编辑',
    handler: () => {
      document.dispatchEvent(new CustomEvent('shortcut:delete'))
    },
  },

  // Vim-like 导航
  {
    id: 'vim.up',
    name: '向上移动',
    description: '向上导航',
    keys: ['k'],
    category: 'Vim 导航',
    when: () => getShortcutManager()['vimMode'],
    handler: () => {
      document.dispatchEvent(new CustomEvent('shortcut:moveUp'))
    },
  },
  {
    id: 'vim.down',
    name: '向下移动',
    description: '向下导航',
    keys: ['j'],
    category: 'Vim 导航',
    when: () => getShortcutManager()['vimMode'],
    handler: () => {
      document.dispatchEvent(new CustomEvent('shortcut:moveDown'))
    },
  },
  {
    id: 'vim.left',
    name: '向左移动',
    description: '向左导航',
    keys: ['h'],
    category: 'Vim 导航',
    when: () => getShortcutManager()['vimMode'],
    handler: () => {
      document.dispatchEvent(new CustomEvent('shortcut:moveLeft'))
    },
  },
  {
    id: 'vim.right',
    name: '向右移动',
    description: '向右导航',
    keys: ['l'],
    category: 'Vim 导航',
    when: () => getShortcutManager()['vimMode'],
    handler: () => {
      document.dispatchEvent(new CustomEvent('shortcut:moveRight'))
    },
  },
  {
    id: 'vim.select',
    name: '选择/展开',
    description: '选择当前项或展开节点',
    keys: ['enter'],
    category: 'Vim 导航',
    handler: () => {
      document.dispatchEvent(new CustomEvent('shortcut:select'))
    },
  },
  {
    id: 'vim.parent',
    name: '跳转到父节点',
    description: '跳转到父节点',
    keys: ['p'],
    category: 'Vim 导航',
    when: () => getShortcutManager()['vimMode'],
    handler: () => {
      document.dispatchEvent(new CustomEvent('shortcut:parent'))
    },
  },
  {
    id: 'vim.children',
    name: '跳转到子节点',
    description: '跳转到第一个子节点',
    keys: ['c'],
    category: 'Vim 导航',
    when: () => getShortcutManager()['vimMode'],
    handler: () => {
      document.dispatchEvent(new CustomEvent('shortcut:children'))
    },
  },
  {
    id: 'vim.sibling',
    name: '跳转到兄弟节点',
    description: '跳转到下一个兄弟节点',
    keys: ['s'],
    category: 'Vim 导航',
    when: () => getShortcutManager()['vimMode'],
    handler: () => {
      document.dispatchEvent(new CustomEvent('shortcut:sibling'))
    },
  },
]

// 节点相关快捷键
export const NODE_SHORTCUTS: Shortcut[] = [
  {
    id: 'node.focus',
    name: '聚焦节点',
    description: '进入聚焦模式查看节点详情',
    keys: ['f'],
    category: '节点',
    handler: () => {
      document.dispatchEvent(new CustomEvent('shortcut:focus'))
    },
  },
  {
    id: 'node.edit',
    name: '编辑节点',
    description: '编辑选中节点',
    keys: ['e'],
    category: '节点',
    handler: () => {
      document.dispatchEvent(new CustomEvent('shortcut:edit'))
    },
  },
  {
    id: 'node.expand',
    name: '展开/折叠',
    description: '展开或折叠节点',
    keys: ['space'],
    category: '节点',
    handler: () => {
      document.dispatchEvent(new CustomEvent('shortcut:expand'))
    },
  },
  {
    id: 'node.bookmark',
    name: '添加书签',
    description: '将节点添加到书签',
    keys: ['b'],
    modifiers: ['cmd'],
    category: '节点',
    handler: () => {
      document.dispatchEvent(new CustomEvent('shortcut:bookmark'))
    },
  },
]

// 导出所有预定义快捷键
export const ALL_SHORTCUTS = [...GLOBAL_SHORTCUTS, ...NODE_SHORTCUTS]

// ==================== 辅助函数 ====================

/**
 * 初始化全局快捷键
 */
export function initShortcuts(): () => void {
  const manager = getShortcutManager()
  return manager.registerMany(ALL_SHORTCUTS)
}

/**
 * 格式化键位显示
 */
export function formatKey(key: string): string {
  const keyMap: Record<string, string> = {
    'cmd': '⌘',
    'meta': '⌘',
    'ctrl': 'Ctrl',
    'alt': 'Alt',
    'shift': '⇧',
    'enter': '↵',
    'escape': 'Esc',
    'backspace': '⌫',
    'delete': 'Del',
    'arrowup': '↑',
    'arrowdown': '↓',
    'arrowleft': '←',
    'arrowright': '→',
    ' ': 'Space',
  }

  return keyMap[key.toLowerCase()] || key.toUpperCase()
}

/**
 * 检查按键组合
 */
export function isKeyCombo(event: KeyboardEvent, keys: string[], modifiers?: ModifierKey[]): boolean {
  const key = event.key.toLowerCase()
  const matchesKey = keys.some(k => k.toLowerCase() === key)

  if (!matchesKey) return false

  if (modifiers) {
    const hasCtrl = modifiers.includes('ctrl') || modifiers.includes('cmd')
    const hasAlt = modifiers.includes('alt')
    const hasShift = modifiers.includes('shift')
    const hasMeta = modifiers.includes('meta') || modifiers.includes('cmd')

    if (hasCtrl !== (event.ctrlKey || event.metaKey)) return false
    if (hasAlt !== event.altKey) return false
    if (hasShift !== event.shiftKey) return false
    if (hasMeta !== event.metaKey) return false
  }

  return true
}

export default {
  ShortcutManager,
  getShortcutManager,
  useShortcut,
  useKeyboardListener,
  useShortcutHelp,
  initShortcuts,
  formatKey,
  isKeyCombo,
  GLOBAL_SHORTCUTS,
  NODE_SHORTCUTS,
  ALL_SHORTCUTS,
}