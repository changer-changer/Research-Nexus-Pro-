import { useRef, useCallback, useEffect, useState, RefObject } from 'react'
import { useSpring, useMotionValue, AnimatePresence, motion, MotionValue } from 'framer-motion'

interface FocusModeOptions {
  /** 聚焦动画时长 (秒) */
  duration?: number
  /** 非聚焦元素的不透明度 */
  unfocusedOpacity?: number
  /** 非聚焦元素的缩放 */
  unfocusedScale?: number
  /** 聚焦元素的缩放 */
  focusedScale?: number
  /** 模糊程度 (px) */
  blurAmount?: number
  /** 过渡缓动函数 */
  ease?: [number, number, number, number]
  /** 是否启用暗色遮罩 */
  enableOverlay?: boolean
  /** 遮罩颜色 */
  overlayColor?: string
  /** 遮罩不透明度 */
  overlayOpacity?: number
  /** 是否禁用背景滚动 */
  disableBackgroundScroll?: boolean
  /** 点击外部是否退出聚焦 */
  exitOnClickOutside?: boolean
  /** 聚焦完成回调 */
  onFocusStart?: (nodeId: string) => void
  /** 聚焦结束回调 */
  onFocusEnd?: () => void
  /** 退出聚焦回调 */
  onExit?: () => void
}

interface FocusedNode {
  id: string
  element: HTMLElement
  rect: DOMRect
  originalZIndex: string
  centerX: number
  centerY: number
}

interface FocusModeState {
  /** 当前聚焦的节点 ID */
  focusedNodeId: string | null
  /** 是否正在聚焦动画中 */
  isAnimating: boolean
  /** 是否处于聚焦模式 */
  isFocused: boolean
  /** 聚焦历史记录 */
  focusHistory: string[]
}

interface FocusModeReturn {
  /** 绑定到容器元素的 ref */
  containerRef: RefObject<HTMLElement>
  /** 当前状态 */
  state: FocusModeState
  /** 聚焦到指定节点 */
  focus: (nodeId: string, element?: HTMLElement) => void
  /** 退出聚焦模式 */
  exit: () => void
  /** 返回上一个聚焦 */
  back: () => void
  /** 切换聚焦状态 */
  toggle: (nodeId: string) => void
  /** 检查节点是否被聚焦 */
  isNodeFocused: (nodeId: string) => boolean
  /** 检查节点是否被虚化 */
  isNodeDimmed: (nodeId: string) => boolean
  /** 获取节点的聚焦样式 */
  getNodeStyle: (nodeId: string) => {
    opacity: MotionValue<number>
    scale: MotionValue<number>
    filter: MotionValue<string>
    zIndex: number
  }
  /** 聚焦遮罩组件 */
  FocusOverlay: React.FC
  /** 聚焦动画配置 */
  transition: {
    duration: number
    ease: [number, number, number, number]
  }
}

/**
 * 焦点模式 Hook - 沉浸式的节点聚焦体验
 * 
 * 功能:
 * 1. 选中节点时其他元素虚化/模糊
 * 2. 平滑的聚焦动画过渡
 * 3. 支持历史记录后退
 * 4. 可选的暗色遮罩
 * 5. 退出焦点时恢复原始状态
 */
export function useFocusMode(options: FocusModeOptions = {}): FocusModeReturn {
  const {
    duration = 0.5,
    unfocusedOpacity = 0.3,
    unfocusedScale = 0.95,
    focusedScale = 1.05,
    blurAmount = 4,
    ease = [0.25, 0.1, 0.25, 1],
    enableOverlay = true,
    overlayColor = 'rgba(0, 0, 0, 0.3)',
    overlayOpacity = 0.5,
    disableBackgroundScroll = true,
    exitOnClickOutside = true,
    onFocusStart,
    onFocusEnd,
    onExit,
  } = options

  const containerRef = useRef<HTMLElement>(null)
  const focusedNodeRef = useRef<FocusedNode | null>(null)
  const scrollPositionRef = useRef(0)

  // 动画值
  const overlayOpacityMotion = useMotionValue(0)
  const overlaySpring = useSpring(overlayOpacityMotion, { stiffness: 300, damping: 30 })

  // 节点动画缓存
  const nodeAnimationsRef = useRef<Map<string, {
    opacity: MotionValue<number>
    scale: MotionValue<number>
    filter: MotionValue<string>
    springOpacity: MotionValue<number>
    springScale: MotionValue<number>
    springFilter: MotionValue<string>
  }>>(new Map())

  const [state, setState] = useState<FocusModeState>({
    focusedNodeId: null,
    isAnimating: false,
    isFocused: false,
    focusHistory: [],
  })

  // 创建节点的动画值
  const getOrCreateNodeAnimations = useCallback((nodeId: string) => {
    if (!nodeAnimationsRef.current.has(nodeId)) {
      const opacity = useMotionValue(1)
      const scale = useMotionValue(1)
      const filter = useMotionValue('blur(0px)')

      const springOpacity = useSpring(opacity, { stiffness: 200, damping: 25 })
      const springScale = useSpring(scale, { stiffness: 200, damping: 25 })
      const springFilter = useSpring(filter, { stiffness: 200, damping: 25 })

      nodeAnimationsRef.current.set(nodeId, {
        opacity,
        scale,
        filter,
        springOpacity,
        springScale,
        springFilter,
      })
    }

    return nodeAnimationsRef.current.get(nodeId)!
  }, [])

  // 获取节点样式
  const getNodeStyle = useCallback((nodeId: string) => {
    const animations = getOrCreateNodeAnimations(nodeId)
    const isFocused = state.focusedNodeId === nodeId
    const isDimmed = state.focusedNodeId !== null && !isFocused

    return {
      opacity: isDimmed ? animations.springOpacity : animations.opacity,
      scale: isFocused ? animations.springScale : animations.scale,
      filter: isDimmed ? animations.springFilter : animations.filter,
      zIndex: isFocused ? 100 : 1,
    }
  }, [getOrCreateNodeAnimations, state.focusedNodeId])

  // 聚焦到节点
  const focus = useCallback((nodeId: string, element?: HTMLElement) => {
    if (state.focusedNodeId === nodeId) return

    setState(prev => ({
      ...prev,
      isAnimating: true,
      focusedNodeId: nodeId,
      isFocused: true,
      focusHistory: [...prev.focusHistory, nodeId],
    }))

    // 查找元素
    let targetElement = element
    if (!targetElement && containerRef.current) {
      targetElement = containerRef.current.querySelector(`[data-node-id="${nodeId}"]`) as HTMLElement
    }

    if (targetElement) {
      const rect = targetElement.getBoundingClientRect()
      focusedNodeRef.current = {
        id: nodeId,
        element: targetElement,
        rect,
        originalZIndex: targetElement.style.zIndex,
        centerX: rect.left + rect.width / 2,
        centerY: rect.top + rect.height / 2,
      }

      // 保存原始 z-index
      targetElement.style.zIndex = '100'

      // 滚动到可见区域
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
    }

    // 应用动画到所有节点
    nodeAnimationsRef.current.forEach((animations, id) => {
      if (id === nodeId) {
        // 聚焦节点
        animations.opacity.set(1)
        animations.scale.set(focusedScale)
        animations.filter.set('blur(0px)')
      } else {
        // 虚化其他节点
        animations.opacity.set(unfocusedOpacity)
        animations.scale.set(unfocusedScale)
        animations.filter.set(`blur(${blurAmount}px)`)
      }
    })

    // 显示遮罩
    overlayOpacityMotion.set(overlayOpacity)

    // 禁用背景滚动
    if (disableBackgroundScroll) {
      scrollPositionRef.current = window.scrollY
      document.body.style.overflow = 'hidden'
      document.body.style.position = 'fixed'
      document.body.style.top = `-${scrollPositionRef.current}px`
      document.body.style.width = '100%'
    }

    onFocusStart?.(nodeId)

    // 动画结束
    setTimeout(() => {
      setState(prev => ({ ...prev, isAnimating: false }))
      onFocusEnd?.()
    }, duration * 1000)
  }, [blurAmount, disableBackgroundScroll, duration, focusedScale, getOrCreateNodeAnimations, onFocusEnd, onFocusStart, overlayOpacity, overlayOpacityMotion, state.focusedNodeId, unfocusedOpacity, unfocusedScale])

  // 退出聚焦
  const exit = useCallback(() => {
    setState(prev => ({
      ...prev,
      isAnimating: true,
      focusedNodeId: null,
      isFocused: false,
    }))

    // 恢复聚焦节点的 z-index
    if (focusedNodeRef.current) {
      focusedNodeRef.current.element.style.zIndex = focusedNodeRef.current.originalZIndex
      focusedNodeRef.current = null
    }

    // 恢复所有节点
    nodeAnimationsRef.current.forEach((animations) => {
      animations.opacity.set(1)
      animations.scale.set(1)
      animations.filter.set('blur(0px)')
    })

    // 隐藏遮罩
    overlayOpacityMotion.set(0)

    // 恢复滚动
    if (disableBackgroundScroll) {
      document.body.style.overflow = ''
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.width = ''
      window.scrollTo(0, scrollPositionRef.current)
    }

    onExit?.()

    setTimeout(() => {
      setState(prev => ({ ...prev, isAnimating: false }))
    }, duration * 1000)
  }, [disableBackgroundScroll, duration, onExit, overlayOpacityMotion])

  // 返回上一个聚焦
  const back = useCallback(() => {
    const history = state.focusHistory
    if (history.length <= 1) {
      exit()
      return
    }

    const newHistory = history.slice(0, -1)
    const previousNodeId = newHistory[newHistory.length - 1]

    setState(prev => ({ ...prev, focusHistory: newHistory }))
    focus(previousNodeId)
  }, [exit, focus, state.focusHistory])

  // 切换聚焦
  const toggle = useCallback((nodeId: string) => {
    if (state.focusedNodeId === nodeId) {
      exit()
    } else {
      focus(nodeId)
    }
  }, [exit, focus, state.focusedNodeId])

  // 检查节点状态
  const isNodeFocused = useCallback((nodeId: string) => {
    return state.focusedNodeId === nodeId
  }, [state.focusedNodeId])

  const isNodeDimmed = useCallback((nodeId: string) => {
    return state.focusedNodeId !== null && state.focusedNodeId !== nodeId
  }, [state.focusedNodeId])

  // 点击外部退出
  const handleContainerClick = useCallback((e: MouseEvent) => {
    if (!exitOnClickOutside || !state.focusedNodeId) return

    const target = e.target as HTMLElement
    const focusedElement = focusedNodeRef.current?.element

    if (focusedElement && !focusedElement.contains(target)) {
      exit()
    }
  }, [exit, exitOnClickOutside, state.focusedNodeId])

  // 键盘快捷键
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!state.isFocused) return

    switch (e.key) {
      case 'Escape':
        exit()
        break
      case 'Backspace':
        if (e.metaKey || e.ctrlKey) {
          back()
        }
        break
    }
  }, [back, exit, state.isFocused])

  // 设置事件监听
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    container.addEventListener('click', handleContainerClick)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      container.removeEventListener('click', handleContainerClick)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleContainerClick, handleKeyDown])

  // 聚焦遮罩组件
  const FocusOverlay = useCallback(() => {
    if (!enableOverlay) return null

    return (
      <motion.div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: overlayColor,
          opacity: overlaySpring,
          pointerEvents: state.isFocused ? 'auto' : 'none',
          zIndex: 50,
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: state.isFocused ? overlayOpacity : 0 }}
        transition={{ duration, ease }}
        onClick={exitOnClickOutside ? exit : undefined}
      />
    )
  }, [duration, ease, enableOverlay, exit, exitOnClickOutside, overlayColor, overlayOpacity, overlaySpring, state.isFocused])

  return {
    containerRef: containerRef as RefObject<HTMLElement>,
    state,
    focus,
    exit,
    back,
    toggle,
    isNodeFocused,
    isNodeDimmed,
    getNodeStyle,
    FocusOverlay,
    transition: { duration, ease },
  }
}

/**
 * 简化的聚焦 hook - 只处理状态
 */
export function useSimpleFocus() {
  const [focusedId, setFocusedId] = useState<string | null>(null)

  const focus = useCallback((id: string) => setFocusedId(id), [])
  const exit = useCallback(() => setFocusedId(null), [])
  const toggle = useCallback((id: string) => {
    setFocusedId(prev => prev === id ? null : id)
  }, [])

  return {
    focusedId,
    focus,
    exit,
    toggle,
    isFocused: (id: string) => focusedId === id,
    isDimmed: (id: string) => focusedId !== null && focusedId !== id,
  }
}

export default useFocusMode