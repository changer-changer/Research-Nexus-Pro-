import { useRef, useCallback, useEffect, useState, RefObject } from 'react'
import { useMotionValue, useSpring, MotionValue } from 'framer-motion'

interface GestureState {
  /** 是否正在双指缩放 */
  isPinching: boolean
  /** 是否正在三指拖拽 */
  isPanning: boolean
  /** 是否正在单指触摸 */
  isTouching: boolean
  /** 当前缩放比例 */
  scale: number
  /** 当前位置 X */
  x: number
  /** 当前位置 Y */
  y: number
  /** 双指中心点 X */
  centerX: number
  /** 双指中心点 Y */
  centerY: number
  /** 触摸点数量 */
  touchCount: number
  /** 旋转角度 (用于高级手势) */
  rotation: number
}

interface GestureOptions {
  /** 最小缩放比例 */
  minScale?: number
  /** 最大缩放比例 */
  maxScale?: number
  /** 缩放速度系数 */
  zoomSpeed?: number
  /** 是否启用双指缩放 */
  enablePinch?: boolean
  /** 是否启用三指拖拽 */
  enablePan?: boolean
  /** 是否启用旋转检测 */
  enableRotate?: boolean
  /** 缩放弹性系数 */
  scaleStiffness?: number
  /** 位置弹性系数 */
  positionStiffness?: number
  /** 是否禁用默认行为 */
  preventDefault?: boolean
  /** 初始缩放 */
  initialScale?: number
  /** 初始位置 */
  initialPosition?: { x: number; y: number }
  /** 容器边界 */
  bounds?: { minX: number; maxX: number; minY: number; maxY: number }
  /** 回调函数 */
  onPinchStart?: (state: GestureState) => void
  onPinch?: (state: GestureState, deltaScale: number) => void
  onPinchEnd?: (state: GestureState) => void
  onPanStart?: (state: GestureState) => void
  onPan?: (state: GestureState, deltaX: number, deltaY: number) => void
  onPanEnd?: (state: GestureState) => void
  onTap?: (state: GestureState, x: number, y: number) => void
  onDoubleTap?: (state: GestureState, x: number, y: number) => void
  onScaleChange?: (scale: number) => void
}

interface GestureReturn {
  ref: RefObject<HTMLElement>
  /** 缩放 MotionValue */
  scale: MotionValue<number>
  /** 平滑缩放 MotionValue */
  smoothScale: MotionValue<number>
  /** X 位置 MotionValue */
  x: MotionValue<number>
  /** Y 位置 MotionValue */
  y: MotionValue<number>
  /** 平滑位置 MotionValues */
  smoothX: MotionValue<number>
  smoothY: MotionValue<number>
  /** 当前状态 */
  state: GestureState
  /** 设置缩放 */
  setScale: (scale: number, animate?: boolean) => void
  /** 设置位置 */
  setPosition: (x: number, y: number, animate?: boolean) => void
  /** 重置 */
  reset: () => void
  /** 缩放到指定点 */
  zoomTo: (scale: number, x: number, y: number, animate?: boolean) => void
  /** 适配内容 */
  fitToBounds: (contentWidth: number, contentHeight: number, padding?: number) => void
}

/**
 * 手势操作 Hook - 完整的触摸手势支持
 * 
 * 支持的手势:
 * 1. 双指缩放 (Pinch) - 标准触摸板/触摸屏手势
 * 2. 三指拖拽 (Pan) - 触摸板三指滑动
 * 3. 单指点击 (Tap) - 点击检测
 * 4. 双指点击 (Double Tap) - 双击放大
 * 5. 旋转检测 (Rotate) - 双指旋转
 */
export function useGesture(options: GestureOptions = {}): GestureReturn {
  const {
    minScale = 0.1,
    maxScale = 5,
    zoomSpeed = 0.5,
    enablePinch = true,
    enablePan = true,
    enableRotate = false,
    scaleStiffness = 300,
    positionStiffness = 200,
    preventDefault = true,
    initialScale = 1,
    initialPosition = { x: 0, y: 0 },
    bounds,
    onPinchStart,
    onPinch,
    onPinchEnd,
    onPanStart,
    onPan,
    onPanEnd,
    onTap,
    onDoubleTap,
    onScaleChange,
  } = options

  const ref = useRef<HTMLElement>(null)

  // Motion Values
  const scaleMotion = useMotionValue(initialScale)
  const xMotion = useMotionValue(initialPosition.x)
  const yMotion = useMotionValue(initialPosition.y)

  const smoothScale = useSpring(scaleMotion, { stiffness: scaleStiffness, damping: 30 })
  const smoothX = useSpring(xMotion, { stiffness: positionStiffness, damping: 25 })
  const smoothY = useSpring(yMotion, { stiffness: positionStiffness, damping: 25 })

  // 内部状态
  const stateRef = useRef<GestureState>({
    isPinching: false,
    isPanning: false,
    isTouching: false,
    scale: initialScale,
    x: initialPosition.x,
    y: initialPosition.y,
    centerX: 0,
    centerY: 0,
    touchCount: 0,
    rotation: 0,
  })

  const [state, setState] = useState<GestureState>(stateRef.current)

  // 触摸历史记录
  const touchHistoryRef = useRef<Map<number, { x: number; y: number; time: number }>>(new Map())
  const initialPinchRef = useRef({ scale: 1, distance: 0, x: 0, y: 0, centerX: 0, centerY: 0 })
  const initialPanRef = useRef({ x: 0, y: 0, touches: [] as Touch[] })
  const lastTapRef = useRef(0)
  const tapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 限制缩放范围
  const clampScale = useCallback((s: number) => {
    return Math.max(minScale, Math.min(maxScale, s))
  }, [maxScale, minScale])

  // 限制位置范围
  const clampPosition = useCallback((x: number, y: number) => {
    if (!bounds) return { x, y }
    return {
      x: Math.max(bounds.minX, Math.min(bounds.maxX, x)),
      y: Math.max(bounds.minY, Math.min(bounds.maxY, y)),
    }
  }, [bounds])

  // 更新状态
  const updateState = useCallback((updates: Partial<GestureState>) => {
    stateRef.current = { ...stateRef.current, ...updates }
    setState(stateRef.current)
  }, [])

  // 计算两点距离
  const getDistance = useCallback((t1: Touch, t2: Touch) => {
    const dx = t1.clientX - t2.clientX
    const dy = t1.clientY - t2.clientY
    return Math.sqrt(dx * dx + dy * dy)
  }, [])

  // 计算两点中心
  const getCenter = useCallback((t1: Touch, t2: Touch) => {
    return {
      x: (t1.clientX + t2.clientX) / 2,
      y: (t1.clientY + t2.clientY) / 2,
    }
  }, [])

  // 计算旋转角度
  const getRotation = useCallback((t1: Touch, t2: Touch) => {
    return Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX) * (180 / Math.PI)
  }, [])

  // 处理触摸开始
  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (preventDefault && e.touches.length > 1) {
      e.preventDefault()
    }

    const touches = Array.from(e.touches)
    const now = Date.now()

    // 记录触摸点
    touches.forEach(touch => {
      touchHistoryRef.current.set(touch.identifier, {
        x: touch.clientX,
        y: touch.clientY,
        time: now,
      })
    })

    updateState({
      isTouching: true,
      touchCount: touches.length,
    })

    // 双指缩放开始
    if (enablePinch && touches.length === 2) {
      const distance = getDistance(touches[0], touches[1])
      const center = getCenter(touches[0], touches[1])

      initialPinchRef.current = {
        scale: stateRef.current.scale,
        distance,
        x: xMotion.get(),
        y: yMotion.get(),
        centerX: center.x,
        centerY: center.y,
      }

      updateState({
        isPinching: true,
        centerX: center.x,
        centerY: center.y,
      })

      onPinchStart?.(stateRef.current)
    }

    // 三指拖拽开始
    if (enablePan && touches.length === 3) {
      initialPanRef.current = {
        x: xMotion.get(),
        y: yMotion.get(),
        touches: [...touches],
      }

      updateState({ isPanning: true })
      onPanStart?.(stateRef.current)
    }

    // 双击检测
    if (touches.length === 1) {
      const timeSinceLastTap = now - lastTapRef.current

      if (timeSinceLastTap < 300 && tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current)
        tapTimeoutRef.current = null
        lastTapRef.current = 0

        // 双击 - 缩放到该点
        const touch = touches[0]
        const rect = ref.current?.getBoundingClientRect()
        if (rect) {
          const x = touch.clientX - rect.left
          const y = touch.clientY - rect.top
          onDoubleTap?.(stateRef.current, x, y)

          // 默认行为: 双击放大/缩小
          const newScale = stateRef.current.scale > 1.5 ? 1 : 2
          zoomTo(newScale, x, y, true)
        }
      } else {
        lastTapRef.current = now
        tapTimeoutRef.current = setTimeout(() => {
          // 单击
          const touch = touches[0]
          const rect = ref.current?.getBoundingClientRect()
          if (rect) {
            const x = touch.clientX - rect.left
            const y = touch.clientY - rect.top
            onTap?.(stateRef.current, x, y)
          }
          tapTimeoutRef.current = null
        }, 300)
      }
    }
  }, [enablePan, enablePinch, getCenter, getDistance, onDoubleTap, onPanStart, onPinchStart, onTap, preventDefault, updateState, xMotion, yMotion])

  // 处理触摸移动
  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (preventDefault && (stateRef.current.isPinching || stateRef.current.isPanning)) {
      e.preventDefault()
    }

    const touches = Array.from(e.touches)
    const currentState = stateRef.current

    // 双指缩放
    if (enablePinch && currentState.isPinching && touches.length === 2) {
      const distance = getDistance(touches[0], touches[1])
      const center = getCenter(touches[0], touches[1])

      if (initialPinchRef.current.distance > 0) {
        const scaleRatio = distance / initialPinchRef.current.distance
        const newScale = clampScale(initialPinchRef.current.scale * scaleRatio)
        const deltaScale = newScale - currentState.scale

        // 调整位置以保持在中心点缩放
        const scaleDiff = newScale / currentState.scale
        const newX = center.x - (center.x - initialPinchRef.current.x) * scaleDiff
        const newY = center.y - (center.y - initialPinchRef.current.y) * scaleDiff

        scaleMotion.set(newScale)
        const clampedPos = clampPosition(newX, newY)
        xMotion.set(clampedPos.x)
        yMotion.set(clampedPos.y)

        updateState({
          scale: newScale,
          x: clampedPos.x,
          y: clampedPos.y,
          centerX: center.x,
          centerY: center.y,
        })

        onPinch?.(stateRef.current, deltaScale)
        onScaleChange?.(newScale)
      }
    }

    // 三指拖拽
    if (enablePan && currentState.isPanning && touches.length === 3) {
      const initialTouches = initialPanRef.current.touches
      if (initialTouches.length === 3) {
        // 计算平均移动距离
        let deltaX = 0
        let deltaY = 0

        for (let i = 0; i < 3; i++) {
          deltaX += touches[i].clientX - initialTouches[i].clientX
          deltaY += touches[i].clientY - initialTouches[i].clientY
        }

        deltaX /= 3
        deltaY /= 3

        const newX = initialPanRef.current.x + deltaX
        const newY = initialPanRef.current.y + deltaY

        const clampedPos = clampPosition(newX, newY)
        xMotion.set(clampedPos.x)
        yMotion.set(clampedPos.y)

        updateState({
          x: clampedPos.x,
          y: clampedPos.y,
        })

        onPan?.(stateRef.current, deltaX, deltaY)
      }
    }

    // 更新触摸历史
    const now = Date.now()
    touches.forEach(touch => {
      touchHistoryRef.current.set(touch.identifier, {
        x: touch.clientX,
        y: touch.clientY,
        time: now,
      })
    })
  }, [clampPosition, clampScale, enablePan, enablePinch, getCenter, getDistance, onPan, onPinch, onScaleChange, preventDefault, scaleMotion, updateState, xMotion, yMotion])

  // 处理触摸结束
  const handleTouchEnd = useCallback((e: TouchEvent) => {
    const touches = Array.from(e.touches)
    const currentState = stateRef.current

    // 双指缩放结束
    if (currentState.isPinching && touches.length < 2) {
      updateState({ isPinching: false })
      onPinchEnd?.(stateRef.current)
    }

    // 三指拖拽结束
    if (currentState.isPanning && touches.length < 3) {
      updateState({ isPanning: false })
      onPanEnd?.(stateRef.current)
    }

    // 更新触摸计数
    updateState({
      touchCount: touches.length,
      isTouching: touches.length > 0,
    })

    // 清理结束的触摸点
    const changedTouches = Array.from(e.changedTouches)
    changedTouches.forEach(touch => {
      touchHistoryRef.current.delete(touch.identifier)
    })
  }, [onPanEnd, onPinchEnd, updateState])

  // 鼠标滚轮缩放 (桌面端)
  const handleWheel = useCallback((e: WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return

    e.preventDefault()

    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return

    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    const delta = -e.deltaY * zoomSpeed * 0.01
    const currentScale = scaleMotion.get()
    const newScale = clampScale(currentScale * (1 + delta))

    // 以鼠标位置为中心缩放
    const scaleRatio = newScale / currentScale
    const currentX = xMotion.get()
    const currentY = yMotion.get()

    const newX = mouseX - (mouseX - currentX) * scaleRatio
    const newY = mouseY - (mouseY - currentY) * scaleRatio

    scaleMotion.set(newScale)
    const clampedPos = clampPosition(newX, newY)
    xMotion.set(clampedPos.x)
    yMotion.set(clampedPos.y)

    updateState({
      scale: newScale,
      x: clampedPos.x,
      y: clampedPos.y,
    })

    onScaleChange?.(newScale)
  }, [clampPosition, clampScale, scaleMotion, updateState, xMotion, yMotion, zoomSpeed, onScaleChange])

  // 公共方法
  const setScale = useCallback((newScale: number, animate = true) => {
    const clamped = clampScale(newScale)
    if (animate) {
      scaleMotion.set(clamped)
    } else {
      scaleMotion.set(clamped)
    }
    updateState({ scale: clamped })
    onScaleChange?.(clamped)
  }, [clampScale, scaleMotion, updateState, onScaleChange])

  const setPosition = useCallback((x: number, y: number, animate = true) => {
    const clamped = clampPosition(x, y)
    if (animate) {
      xMotion.set(clamped.x)
      yMotion.set(clamped.y)
    } else {
      xMotion.set(clamped.x)
      yMotion.set(clamped.y)
    }
    updateState({ x: clamped.x, y: clamped.y })
  }, [clampPosition, xMotion, yMotion, updateState])

  const reset = useCallback(() => {
    scaleMotion.set(1)
    xMotion.set(initialPosition.x)
    yMotion.set(initialPosition.y)
    updateState({
      scale: 1,
      x: initialPosition.x,
      y: initialPosition.y,
    })
    onScaleChange?.(1)
  }, [initialPosition.x, initialPosition.y, scaleMotion, updateState, xMotion, yMotion, onScaleChange])

  const zoomTo = useCallback((targetScale: number, focusX: number, focusY: number, animate = true) => {
    const currentScale = scaleMotion.get()
    const currentX = xMotion.get()
    const currentY = yMotion.get()

    const newScale = clampScale(targetScale)
    const scaleRatio = newScale / currentScale

    // 计算新的位置, 使得 focus 点保持在屏幕同一位置
    const newX = focusX - (focusX - currentX) * scaleRatio
    const newY = focusY - (focusY - currentY) * scaleRatio

    const clampedPos = clampPosition(newX, newY)

    if (animate) {
      scaleMotion.set(newScale)
      xMotion.set(clampedPos.x)
      yMotion.set(clampedPos.y)
    } else {
      scaleMotion.set(newScale)
      xMotion.set(clampedPos.x)
      yMotion.set(clampedPos.y)
    }

    updateState({
      scale: newScale,
      x: clampedPos.x,
      y: clampedPos.y,
    })
    onScaleChange?.(newScale)
  }, [clampPosition, clampScale, scaleMotion, updateState, xMotion, yMotion, onScaleChange])

  const fitToBounds = useCallback((contentWidth: number, contentHeight: number, padding = 40) => {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return

    const availableWidth = rect.width - padding * 2
    const availableHeight = rect.height - padding * 2

    const scaleX = availableWidth / contentWidth
    const scaleY = availableHeight / contentHeight
    const newScale = Math.min(scaleX, scaleY, 1)

    const newX = (rect.width - contentWidth * newScale) / 2
    const newY = (rect.height - contentHeight * newScale) / 2

    scaleMotion.set(newScale)
    xMotion.set(newX)
    yMotion.set(newY)

    updateState({
      scale: newScale,
      x: newX,
      y: newY,
    })
    onScaleChange?.(newScale)
  }, [scaleMotion, updateState, xMotion, yMotion, onScaleChange])

  // 设置事件监听
  useEffect(() => {
    const element = ref.current
    if (!element) return

    element.addEventListener('touchstart', handleTouchStart, { passive: !preventDefault })
    element.addEventListener('touchmove', handleTouchMove, { passive: !preventDefault })
    element.addEventListener('touchend', handleTouchEnd)
    element.addEventListener('touchcancel', handleTouchEnd)
    element.addEventListener('wheel', handleWheel, { passive: false })

    // 禁用默认的双指缩放行为
    if (preventDefault) {
      document.addEventListener('gesturestart', (e) => e.preventDefault())
      document.addEventListener('gesturechange', (e) => e.preventDefault())
      document.addEventListener('gestureend', (e) => e.preventDefault())
    }

    return () => {
      element.removeEventListener('touchstart', handleTouchStart)
      element.removeEventListener('touchmove', handleTouchMove)
      element.removeEventListener('touchend', handleTouchEnd)
      element.removeEventListener('touchcancel', handleTouchEnd)
      element.removeEventListener('wheel', handleWheel)

      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current)
      }
    }
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, handleWheel, preventDefault])

  return {
    ref: ref as RefObject<HTMLElement>,
    scale: scaleMotion,
    smoothScale,
    x: xMotion,
    y: yMotion,
    smoothX,
    smoothY,
    state,
    setScale,
    setPosition,
    reset,
    zoomTo,
    fitToBounds,
  }
}

export default useGesture