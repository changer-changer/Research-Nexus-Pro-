import { useEffect, useRef, useState } from 'react'
import { CircleDot, Wrench, FileText, Lightbulb, UserRound, ArrowRight } from 'lucide-react'

interface ExperiencePhilosophyBarProps {
  darkMode: boolean
  accentColor: string
  stats: {
    problems: number
    methods: number
    papers: number
    innovations: number
  }
  userName?: string
  onOpenWorkspace: () => void
}

const STAT_META = [
  { key: 'problems' as const, label: '问题', icon: CircleDot },
  { key: 'methods' as const, label: '方法', icon: Wrench },
  { key: 'papers' as const, label: '论文', icon: FileText },
  { key: 'innovations' as const, label: '创新', icon: Lightbulb },
]

function useAnimatedNumber(target: number, duration = 800) {
  const [display, setDisplay] = useState(0)
  const startTime = useRef<number | null>(null)
  const startVal = useRef(0)

  useEffect(() => {
    startVal.current = display
    startTime.current = null
    let raf: number

    const step = (ts: number) => {
      if (!startTime.current) startTime.current = ts
      const progress = Math.min((ts - startTime.current) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(startVal.current + (target - startVal.current) * eased))
      if (progress < 1) raf = requestAnimationFrame(step)
    }

    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target])

  return display
}

export function ExperiencePhilosophyBar({
  darkMode,
  stats,
  userName,
  onOpenWorkspace,
}: ExperiencePhilosophyBarProps) {
  const [collapsed, setCollapsed] = useState(false)

  if (collapsed) {
    return (
      <div className="absolute left-5 top-3 z-20">
        <button
          onClick={() => setCollapsed(false)}
          className="rn-btn text-xs py-1.5 px-3"
        >
          展开统计面板
        </button>
      </div>
    )
  }

  return (
    <div className="absolute left-5 right-5 top-3 z-20">
      <div className="rn-surface flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        {/* Stats */}
        <div className="flex flex-wrap items-center gap-3">
          {STAT_META.map((meta) => (
            <StatChip key={meta.key} meta={meta} value={stats[meta.key]} />
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenWorkspace}
            className="rn-btn rn-btn-primary text-xs py-1.5 px-3"
          >
            <UserRound size={13} />
            {userName ? `${userName} 的空间` : '登录工作台'}
            <ArrowRight size={12} />
          </button>
          <button
            onClick={() => setCollapsed(true)}
            className="rn-btn rn-btn-ghost text-xs py-1.5 px-2"
          >
            收起
          </button>
        </div>
      </div>
    </div>
  )
}

function StatChip({
  meta,
  value,
}: {
  meta: (typeof STAT_META)[number]
  value: number
}) {
  const animated = useAnimatedNumber(value)
  const Icon = meta.icon

  return (
    <div className="flex items-center gap-1.5 text-xs">
      <Icon size={13} className="text-text-tertiary" />
      <span className="font-semibold tabular-nums text-text-primary">{animated}</span>
      <span className="text-text-tertiary">{meta.label}</span>
    </div>
  )
}
