import { useRef, useCallback, useEffect, useState, RefObject } from 'react'
import { useSpring, useMotionValue, MotionValue } from 'framer-motion'

interface InertialScrollOptions {
  /** 惯性系数 (0-1), 越大惯性越强 */
  inertia?: number
  /** 摩擦力 (0-1), 越小减速越快 */
  friction?: number
  /** 最大滚动速度 */
  maxVelocity?: number
  /** 边界弹性系数 */
  bounceStiffness?: number
  /** 边界阻尼系数 */
  bounceDamping?: number
  /** 是否启用滚轮平滑滚动 */
  smoothWheel?: boolean
  /** 滚轮平滑系数 */
  wheelSmoothing?: number
  /** 容器尺寸 (用于边界计算) */
  containerSize?: { width: number; height: number }
  /** 内容尺寸 */
  contentSize?: { width: number; height: number }
  /** 是否启用边界回弹 */
  enableBounce?: boolean
  /** 是否水平滚动 */
  horizontal?: boolean
  /** 是否垂直滚动 */
  vertical?: boolean
  /** 缩放比例 (用于画布) */
  scale?: number
}

interface ScrollState {
  /** 当前位置 X */
  x: number
  /** 当前位置 Y */
  y: number
  /** 当前速度 X */
  velocityX: number
  /** 当前速度 Y */
  velocityY: number
  /** 是否正在拖拽 */
  isDragging: boolean
  /** 是否正在滚动 */
  isScrolling: boolean
  /** 是否到达边界 */
  atBounds: { left: boolean; right: boolean; top: boolean; bottom: boolean }
}

interface InertialScrollReturn {
  /** 绑定到容器元素的 ref */
  containerRef: RefObject<HTMLElement>
  /** 绑定到内容元素的 ref */
  contentRef: RefObject<HTMLElement>
  /** 滚动位置 MotionValues */
  scrollX: MotionValue<number>
  scrollY: MotionValue<number>
  /** Spring 版本的位置值 */
  springX: MotionValue<number>
  springY: MotionValue<number>
  /** 当前状态 */
  state: ScrollState
  /** 手动滚动到指定位置 */
  scrollTo: (x: number, y: number, animated?: boolean) => void
  /** 手动设置位置 */
  setPosition: (x: number, y: number) => void
  /** 停止惯性滚动 */
  stop: () => void
  /** 重置位置 */
  reset: () => void
}

/**
 * 惯性滚动 Hook - Notion/Linear 级别的丝滑体验
 * 
 * 核心特性:
 * 1. 拖拽惯性 - 松开后继续滑动
 * 2. 滚轮平滑 - 滚轮滚动有缓动效果
 * 3. 边界回弹 - 到达边界时弹性回弹
 * 4. 速度限制 - 防止滚动过快
 * 5. 双轴支持 - 水平和垂直同时支持
 */
export function useInertialScroll(
  options: InertialScrollOptions = {}
): InertialScrollReturn {
  const {
    inertia = 0.95,
    friction = 0.05,
    maxVelocity = 2000,
    bounceStiffness = 400,
    bounceDamping = 30,
    smoothWheel = true,
    wheelSmoothing = 0.15,
    containerSize,
    contentSize,
    enableBounce = true,
    horizontal = true,
    vertical = true,
    scale = 1,
  } = options

  const containerRef = useRef<HTMLElement>(null)
  const contentRef = useRef<HTMLElement>(null)

  // 当前位置和速度
  const positionRef = useRef({ x: 0, y: 0 })
  const velocityRef = useRef({ x: 0, y: 0 })
  const targetRef = useRef({ x: 0, y: 0 })

  // 拖拽状态
  const dragStartRef = useRef({ x: 0, y: 0, clientX: 0, clientY: 0 })
  const isDraggingRef = useRef(false)
  const isWheelingRef = useRef(false)
  const wheelTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // RAF
  const rafRef = useRef<number | null>(null)
  const lastTimeRef = useRef<number>(0)

  // Motion Values
  const scrollX = useMotionValue(0)
  const scrollY = useMotionValue(0)

  // Spring 版本 - 用于平滑滚动和回弹
  const springX = useSpring(scrollX, {
    stiffness: enableBounce ? bounceStiffness : 1000,
    damping: enableBounce ? bounceDamping : 50,
    mass: 1,
  })

  const springY = useSpring(scrollY, {
    stiffness: enableBounce ? bounceStiffness : 1000,
    damping: enableBounce ? bounceDamping : 50,
    mass: 1,
  })

  // 状态
  const [state, setState] = useState<ScrollState>({
    x: 0,
    y: 0,
    velocityX: 0,
    velocityY: 0,
    isDragging: false,
    isScrolling: false,
    atBounds: { left: false, right: false, top: false, bottom: false },
  })

  // 获取边界
  const getBounds = useCallback(() => {
    const container = containerSize || {
      width: containerRef.current?.clientWidth || window.innerWidth,
      height: containerRef.current?.clientHeight || window.innerHeight,
    }

    const content = contentSize || {
      width: contentRef.current?.scrollWidth || container.width,
      height: contentRef.current?.scrollHeight || container.height,
    }

    return {
      minX: Math.min(0, container.width - content.width * scale),
      maxX: 0,
      minY: Math.min(0, container.height - content.height * scale),
      maxY: 0,
      containerWidth: container.width,
      containerHeight: container.height,
      contentWidth: content.width * scale,
      contentHeight: content.height * scale,
    }
  }, [containerSize, contentSize, scale])

  // 限制位置在边界内
  const clampPosition = useCallback((x: number, y: number, withBounce = false) => {
    const bounds = getBounds()

    let clampedX = x
    let clampedY = y

    if (horizontal) {
      clampedX = Math.max(bounds.minX - (withBounce ? 100 : 0), Math.min(bounds.maxX + (withBounce ? 100 : 0), x))
    }

    if (vertical) {
      clampedY = Math.max(bounds.minY - (withBounce ? 100 : 0), Math.min(bounds.maxY + (withBounce ? 100 : 0), y))
    }

    return { x: clampedX, y: clampedY }
  }, [getBounds, horizontal, vertical])

  // 更新位置
  const updatePosition = useCallback((x: number, y: number) => {
    positionRef.current = { x, y }
    scrollX.set(x)
    scrollY.set(y)

    const bounds = getBounds()
    setState(prev => ({
      ...prev,
      x,
      y,
      atBounds: {
        left: x >= bounds.maxX - 1,
        right: x <= bounds.minX + 1,
        top: y >= bounds.maxY - 1,
        bottom: y <= bounds.minY + 1,
      },
    }))
  }, [getBounds, scrollX, scrollY])

  // 惯性动画循环
  const inertiaLoop = useCallback((timestamp: number) => {
    if (lastTimeRef.current === 0) {
      lastTimeRef.current = timestamp
    }

    const deltaTime = (timestamp - lastTimeRef.current) / 1000
    lastTimeRef.current = timestamp

    // 应用惯性
    velocityRef.current.x *= Math.pow(inertia, deltaTime * 60)
    velocityRef.current.y *= Math.pow(inertia, deltaTime * 60)

    // 摩擦力减速
    velocityRef.current.x *= (1 - friction)
    velocityRef.current.y *= (1 - friction)

    // 限制最小速度
    if (Math.abs(velocityRef.current.x) < 0.1) velocityRef.current.x = 0
    if (Math.abs(velocityRef.current.y) < 0.1) velocityRef.current.y = 0

    // 计算新位置
    let newX = positionRef.current.x + velocityRef.current.x * deltaTime
    let newY = positionRef.current.y + velocityRef.current.y * deltaTime

    // 边界检测和回弹
    const bounds = getBounds()
    let needsBounce = false

    if (horizontal) {
      if (newX > bounds.maxX) {
        velocityRef.current.x *= -0.5
        newX = bounds.maxX
        needsBounce = true
      } else if (newX < bounds.minX) {
        velocityRef.current.x *= -0.5
        newX = bounds.minX
        needsBounce = true
      }
    }

    if (vertical) {
      if (newY > bounds.maxY) {
        velocityRef.current.y *= -0.5
        newY = bounds.maxY
        needsBounce = true
      } else if (newY < bounds.minY) {
        velocityRef.current.y *= -0.5
        newY = bounds.minY
        needsBounce = true
      }
    }

    updatePosition(newX, newY)

    setState(prev => ({
      ...prev,
      velocityX: velocityRef.current.x,
      velocityY: velocityRef.current.y,
      isScrolling: Math.abs(velocityRef.current.x) > 0.5 || Math.abs(velocityRef.current.y) > 0.5,
    }))

    // 继续动画或停止
    if (Math.abs(velocityRef.current.x) > 0.5 || Math.abs(velocityRef.current.y) > 0.5 || needsBounce) {
      rafRef.current = requestAnimationFrame(inertiaLoop)
    } else {
      rafRef.current = null
      lastTimeRef.current = 0
    }
  }, [friction, getBounds, horizontal, inertia, updatePosition, vertical])

  // 开始惯性滚动
  const startInertia = useCallback(() => {
    if (rafRef.current) return
    lastTimeRef.current = 0
    rafRef.current = requestAnimationFrame(inertiaLoop)
  }, [inertiaLoop])

  // 停止惯性
  const stop = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    velocityRef.current = { x: 0, y: 0 }
    setState(prev => ({ ...prev, isScrolling: false }))
  }, [])

  // 拖拽开始
  const handleDragStart = useCallback((e: PointerEvent | MouseEvent | TouchEvent) => {
    stop()
    isDraggingRef.current = true

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

    dragStartRef.current = {
      x: positionRef.current.x,
      y: positionRef.current.y,
      clientX,
      clientY,
    }

    setState(prev => ({ ...prev, isDragging: true }))

    // 设置光标
    if (containerRef.current) {
      containerRef.current.style.cursor = 'grabbing'
    }
  }, [stop])

  // 拖拽中
  const handleDragMove = useCallback((e: PointerEvent | MouseEvent | TouchEvent) => {
    if (!isDraggingRef.current) return

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

    const deltaX = clientX - dragStartRef.current.clientX
    const deltaY = clientY - dragStartRef.current.clientY

    // 计算速度用于惯性
    velocityRef.current.x = deltaX * 10
    velocityRef.current.y = deltaY * 10

    // 限制最大速度
    velocityRef.current.x = Math.max(-maxVelocity, Math.min(maxVelocity, velocityRef.current.x))
    velocityRef.current.y = Math.max(-maxVelocity, Math.min(maxVelocity, velocityRef.current.y))

    const newX = dragStartRef.current.x + (horizontal ? deltaX : 0)
    const newY = dragStartRef.current.y + (vertical ? deltaY : 0)

    updatePosition(newX, newY)

    dragStartRef.current.clientX = clientX
    dragStartRef.current.clientY = clientY
    dragStartRef.current.x = newX
    dragStartRef.current.y = newY
  }, [horizontal, maxVelocity, updatePosition, vertical])

  // 拖拽结束
  const handleDragEnd = useCallback(() => {
    isDraggingRef.current = false
    setState(prev => ({ ...prev, isDragging: false }))

    // 恢复光标
    if (containerRef.current) {
      containerRef.current.style.cursor = ''
    }

    // 启动惯性
    startInertia()
  }, [startInertia])

  // 滚轮处理 - 平滑滚动
  const handleWheel = useCallback((e: WheelEvent) => {
    if (!smoothWheel) return

    e.preventDefault()
    stop()

    isWheelingRef.current = true

    // 累积滚轮输入
    targetRef.current.x -= e.deltaX * wheelSmoothing
    targetRef.current.y -= e.deltaY * wheelSmoothing

    // 限制目标位置
    const clamped = clampPosition(targetRef.current.x, targetRef.current.y, enableBounce)
    targetRef.current = clamped

    // 立即应用部分移动
    const newX = positionRef.current.x + (targetRef.current.x - positionRef.current.x) * 0.3
    const newY = positionRef.current.y + (targetRef.current.y - positionRef.current.y) * 0.3

    velocityRef.current.x = (targetRef.current.x - positionRef.current.x) * 5
    velocityRef.current.y = (targetRef.current.y - positionRef.current.y) * 5

    updatePosition(newX, newY)

    // 清除之前的 timeout
    if (wheelTimeoutRef.current) {
      clearTimeout(wheelTimeoutRef.current)
    }

    // 滚轮停止后开始惯性
    wheelTimeoutRef.current = setTimeout(() => {
      isWheelingRef.current = false
      startInertia()
    }, 50)

    setState(prev => ({ ...prev, isScrolling: true }))
  }, [clampPosition, enableBounce, smoothWheel, startInertia, stop, updatePosition, wheelSmoothing])

  // 手动滚动到
  const scrollTo = useCallback((x: number, y: number, animated = true) => {
    stop()

    const clamped = clampPosition(x, y, false)

    if (animated) {
      // 使用 spring 动画
      scrollX.set(clamped.x)
      scrollY.set(clamped.y)
    } else {
      updatePosition(clamped.x, clamped.y)
    }
  }, [clampPosition, scrollX, scrollY, stop, updatePosition])

  // 设置位置
  const setPosition = useCallback((x: number, y: number) => {
    stop()
    const clamped = clampPosition(x, y, false)
    updatePosition(clamped.x, clamped.y)
    targetRef.current = clamped
  }, [clampPosition, stop, updatePosition])

  // 重置
  const reset = useCallback(() => {
    stop()
    updatePosition(0, 0)
    targetRef.current = { x: 0, y: 0 }
  }, [stop, updatePosition])

  // 设置事件监听
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // 滚轮
    if (smoothWheel) {
      container.addEventListener('wheel', handleWheel, { passive: false })
    }

    // 鼠标拖拽
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return // 只响应左键
      handleDragStart(e)
    }

    const handleMouseMove = (e: MouseEvent) => handleDragMove(e)
    const handleMouseUp = () => handleDragEnd()

    container.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      container.removeEventListener('wheel', handleWheel)
      container.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      stop()
      if (wheelTimeoutRef.current) {
        clearTimeout(wheelTimeoutRef.current)
      }
    }
  }, [handleDragEnd, handleDragMove, handleDragStart, handleWheel, smoothWheel, stop])

  return {
    containerRef: containerRef as RefObject<HTMLElement>,
    contentRef: contentRef as RefObject<HTMLElement>,
    scrollX,
    scrollY,
    springX,
    springY,
    state,
    scrollTo,
    setPosition,
    stop,
    reset,
  }
}

/**
 * 简化的画布拖拽 hook
 */
export function useCanvasDrag(options: Omit<InertialScrollOptions, 'horizontal' | 'vertical'> = {}) {
  return useInertialScroll({
    ...options,
    horizontal: true,
    vertical: true,
  })
}

/**
 * 垂直滚动 hook
 */
export function useVerticalScroll(options: Omit<InertialScrollOptions, 'horizontal' | 'vertical'> = {}) {
  return useInertialScroll({
    ...options,
    horizontal: false,
    vertical: true,
  })
}

export default useInertialScroll