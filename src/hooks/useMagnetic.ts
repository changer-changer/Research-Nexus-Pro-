import { useRef, useCallback, useEffect, RefObject } from 'react'
import { useSpring, useTransform, MotionValue } from 'framer-motion'

interface MagneticOptions {
  /** 磁吸强度 (0-1), 越大吸引力越强 */
  strength?: number
  /** 磁吸半径 (px), 鼠标进入此范围开始生效 */
  radius?: number
  /** 按钮移动的最大距离 (px) */
  maxOffset?: number
  /** 弹性系数, 越大回弹越快 */
  stiffness?: number
  /** 阻尼系数, 越大越稳定 */
  damping?: number
  /** 是否启用光晕效果 */
  enableGlow?: boolean
  /** 光晕颜色 */
  glowColor?: string
  /** 点击时的缩放比例 */
  clickScale?: number
  /** 是否禁用 */
  disabled?: boolean
}

interface MagneticState {
  x: MotionValue<number>
  y: MotionValue<number>
  scale: MotionValue<number>
  glow: MotionValue<number>
  glowX: MotionValue<number>
  glowY: MotionValue<number>
  isHovered: boolean
  isPressed: boolean
}

interface MagneticReturn {
  ref: RefObject<HTMLButtonElement>
  style: {
    x: MotionValue<number>
    y: MotionValue<number>
    scale: MotionValue<number>
  }
  glowStyle: {
    opacity: MotionValue<number>
    background: string
    x: MotionValue<number>
    y: MotionValue<number>
  }
  state: MagneticState
}

/**
 * 磁吸按钮 Hook - Linear 级别的交互体验
 * 
 * 实现原理:
 * 1. 监听鼠标在按钮周围的移动
 * 2. 计算鼠标与按钮中心的距离和角度
 * 3. 当距离小于 radius 时, 按钮被"吸引"向鼠标方向移动
 * 4. 使用 spring 动画实现自然的弹性效果
 * 5. 光晕跟随鼠标位置, 产生沉浸感
 */
export function useMagnetic(options: MagneticOptions = {}): MagneticReturn {
  const {
    strength = 0.4,
    radius = 150,
    maxOffset = 25,
    stiffness = 150,
    damping = 15,
    enableGlow = true,
    glowColor = 'rgba(99, 102, 241, 0.4)',
    clickScale = 0.95,
    disabled = false,
  } = options

  const ref = useRef<HTMLButtonElement>(null)
  const isHoveredRef = useRef(false)
  const isPressedRef = useRef(false)
  const rafRef = useRef<number | null>(null)
  const mouseRef = useRef({ x: 0, y: 0 })

  // Spring 动画配置 - Linear 级别的丝滑
  const springConfig = { stiffness, damping, mass: 1 }

  // 位移 spring
  const x = useSpring(0, springConfig)
  const y = useSpring(0, springConfig)

  // 点击缩放 spring
  const scale = useSpring(1, { stiffness: 400, damping: 25 })

  // 光晕效果
  const glowOpacity = useSpring(0, { stiffness: 200, damping: 20 })
  const glowX = useSpring(50, { stiffness: 100, damping: 20 })
  const glowY = useSpring(50, { stiffness: 100, damping: 20 })

  // 计算磁吸位移
  const calculateMagneticOffset = useCallback((mouseX: number, mouseY: number) => {
    if (!ref.current || disabled) return { x: 0, y: 0, distance: Infinity, isInside: false }

    const rect = ref.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2

    const deltaX = mouseX - centerX
    const deltaY = mouseY - centerY
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

    // 检查鼠标是否在按钮内部
    const isInside = 
      mouseX >= rect.left && 
      mouseX <= rect.right && 
      mouseY >= rect.top && 
      mouseY <= rect.bottom

    if (distance > radius && !isInside) {
      return { x: 0, y: 0, distance, isInside }
    }

    // 计算磁吸力 - 距离越近吸引力越强
    const attractionRatio = Math.max(0, 1 - distance / radius)
    const easeOutCubic = 1 - Math.pow(1 - attractionRatio, 3)
    
    // 限制最大位移
    const offsetX = (deltaX / distance) * maxOffset * easeOutCubic * strength
    const offsetY = (deltaY / distance) * maxOffset * easeOutCubic * strength

    return {
      x: isInside ? offsetX * 0.5 : offsetX,
      y: isInside ? offsetY * 0.5 : offsetY,
      distance,
      isInside,
      centerX,
      centerY,
      width: rect.width,
      height: rect.height,
    }
  }, [disabled, maxOffset, radius, strength])

  // 处理鼠标移动
  const handleMouseMove = useCallback((e: MouseEvent) => {
    mouseRef.current = { x: e.clientX, y: e.clientY }

    if (rafRef.current) return

    rafRef.current = requestAnimationFrame(() => {
      const result = calculateMagneticOffset(mouseRef.current.x, mouseRef.current.y)

      if (result.distance <= radius || result.isInside) {
        x.set(result.x)
        y.set(result.y)
        isHoveredRef.current = true

        // 光晕跟随鼠标
        if (enableGlow && ref.current) {
          const rect = ref.current.getBoundingClientRect()
          const percentX = ((mouseRef.current.x - rect.left) / rect.width) * 100
          const percentY = ((mouseRef.current.y - rect.top) / rect.height) * 100
          glowX.set(Math.max(0, Math.min(100, percentX)))
          glowY.set(Math.max(0, Math.min(100, percentY)))
          glowOpacity.set(result.isInside ? 0.8 : 0.5)
        }
      } else {
        x.set(0)
        y.set(0)
        isHoveredRef.current = false
        glowOpacity.set(0)
      }

      rafRef.current = null
    })
  }, [calculateMagneticOffset, enableGlow, glowOpacity, glowX, glowY, radius, x, y])

  // 处理鼠标离开
  const handleMouseLeave = useCallback(() => {
    x.set(0)
    y.set(0)
    glowOpacity.set(0)
    isHoveredRef.current = false
  }, [glowOpacity, x, y])

  // 处理点击
  const handleMouseDown = useCallback(() => {
    if (disabled) return
    isPressedRef.current = true
    scale.set(clickScale)
  }, [clickScale, disabled, scale])

  const handleMouseUp = useCallback(() => {
    isPressedRef.current = false
    scale.set(1)
  }, [scale])

  // 设置事件监听
  useEffect(() => {
    if (disabled) return

    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    window.addEventListener('mouseup', handleMouseUp)

    const element = ref.current
    if (element) {
      element.addEventListener('mouseleave', handleMouseLeave)
      element.addEventListener('mousedown', handleMouseDown)
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      if (element) {
        element.removeEventListener('mouseleave', handleMouseLeave)
        element.removeEventListener('mousedown', handleMouseDown)
      }
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [disabled, handleMouseDown, handleMouseLeave, handleMouseMove, handleMouseUp])

  // 构建光晕样式
  const glowBackground = `radial-gradient(circle at ${glowX.get()}% ${glowY.get()}%, ${glowColor} 0%, transparent 60%)`

  return {
    ref,
    style: { x, y, scale },
    glowStyle: {
      opacity: glowOpacity,
      background: glowBackground,
      x: glowX,
      y: glowY,
    },
    state: {
      x,
      y,
      scale,
      glow: glowOpacity,
      glowX,
      glowY,
      isHovered: isHoveredRef.current,
      isPressed: isPressedRef.current,
    },
  }
}

/**
 * 磁吸按钮变体 - 适用于不同场景
 */
export const magneticPresets = {
  /** 微妙效果 - 适合次要按钮 */
  subtle: {
    strength: 0.2,
    radius: 100,
    maxOffset: 12,
    stiffness: 200,
    damping: 20,
  },
  /** 标准效果 - 适合主要按钮 */
  default: {
    strength: 0.4,
    radius: 150,
    maxOffset: 25,
    stiffness: 150,
    damping: 15,
  },
  /** 强烈效果 - 适合 CTA 按钮 */
  strong: {
    strength: 0.6,
    radius: 200,
    maxOffset: 40,
    stiffness: 120,
    damping: 12,
  },
  /** 游戏风格 - 弹性更强 */
  bouncy: {
    strength: 0.5,
    radius: 180,
    maxOffset: 30,
    stiffness: 300,
    damping: 10,
  },
} as const

export type MagneticPreset = keyof typeof magneticPresets

/** 使用预设快速创建磁吸效果 */
export function useMagneticPreset(
  preset: MagneticPreset,
  overrides: Partial<MagneticOptions> = {}
): MagneticReturn {
  return useMagnetic({ ...magneticPresets[preset], ...overrides })
}

export default useMagnetic