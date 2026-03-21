import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Download, Sparkles, Sun, Moon, Layout, PanelLeft,
  ArrowRight, Image, FileJson, Bookmark, Undo2, Redo2, Play,
  GitBranch, Clock, Workflow, BookOpen, Network, Target
} from 'lucide-react'
import { useAppStore } from './store/appStore'
import { useNexusStore } from './store/nexusStore'

const ProblemTree = lazy(() => import('./components/ProblemTree'))
const MethodTree = lazy(() => import('./components/MethodTree'))
const MethodArrowView = lazy(() => import('./components/MethodArrowView'))
const MethodTimelineView = lazy(() => import('./components/MethodTimelineView'))
const DualTreeView = lazy(() => import('./components/DualTreeView'))
const TimelineView = lazy(() => import('./components/TimelineView'))
const CitationView = lazy(() => import('./components/CitationView'))
const PaperTimelineView = lazy(() => import('./components/PaperTimelineView'))
const BookmarkPanel = lazy(() => import('./components/BookmarkPanel'))
const NodeDetailPanel = lazy(() => import('./components/NodeDetailPanel'))
const PaperDetailPanel = lazy(() => import('./components/PaperDetailPanel'))
const PresentationMode = lazy(() => import('./components/PresentationMode'))

type NavItem = {
  id: string
  label: string
  icon: LucideIcon
  badge?: string
  group: string
}

const NAV_ITEMS: NavItem[] = [
  { id: 'problem-tree', label: 'Problem Tree', icon: GitBranch, group: 'problems' },
  { id: 'timeline', label: 'Time Evolution', icon: Clock, group: 'problems' },
  { id: 'method-arrows', label: 'Method → Problem', icon: ArrowRight, group: 'methods' },
  { id: 'method-tree', label: 'Method Tree', icon: Target, group: 'methods' },
  { id: 'method-timeline', label: 'Method Evolution', icon: Clock, group: 'methods', badge: 'NEW' },
  { id: 'dual-tree', label: 'Dual Tree Fusion', icon: Workflow, group: 'methods' },
  { id: 'paper-timeline', label: 'Paper Timeline', icon: BookOpen, group: 'papers' },
  { id: 'citation', label: 'Citation Network', icon: Network, group: 'papers' },
]

function App() {
  const { activeView, setActiveView, viewConfig, updateViewConfig, loadData, undo, redo, selectedNode, selectNode } = useAppStore()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [showBookmarks, setShowBookmarks] = useState(false)
  const [showPresentation, setShowPresentation] = useState(false)
  const [screenSize, setScreenSize] = useState<'desktop' | 'tablet' | 'mobile'>('desktop')
  const [isDataLoading, setIsDataLoading] = useState(true)
  const [dataLoadError, setDataLoadError] = useState<string | null>(null)

  const hydrateData = useCallback(async () => {
    const data = await import('./data/real_papers.json')
    loadData(data.default)

    // Keep nexusStore in sync for legacy/parallel views.
    const { loadData: nexusLoad } = useNexusStore.getState()
    nexusLoad({
      branches: data.default.branches || [],
      problems: data.default.problems || [],
      methods: data.default.methods || [],
      papers: data.default.papers || [],
    })
  }, [loadData])

  // Keyboard shortcuts
  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false
      const tag = target.tagName.toLowerCase()
      return target.isContentEditable || tag === 'input' || tag === 'textarea' || tag === 'select'
    }

    const handler = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        redo()
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault()
        setShowBookmarks(v => !v)
      }
      if (e.key === 'Escape') {
        setShowExport(false)
        setShowBookmarks(false)
        setShowPresentation(false)
        selectNode('problem', '')
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [undo, redo])

  // Responsive detection
  useEffect(() => {
    const check = () => {
      const w = window.innerWidth
      if (w < 640) { setScreenSize('mobile'); setSidebarCollapsed(true) }
      else if (w < 1024) { setScreenSize('tablet'); setSidebarCollapsed(true) }
      else { setScreenSize('desktop'); setSidebarCollapsed(false) }
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    let cancelled = false

    setIsDataLoading(true)
    setDataLoadError(null)

    hydrateData()
      .catch((error) => {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : 'Unknown error'
          console.error('Failed to load research data:', error)
          setDataLoadError(message)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsDataLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [hydrateData])

  const retryLoadData = useCallback(() => {
    setIsDataLoading(true)
    setDataLoadError(null)

    hydrateData()
      .catch((error) => {
        const message = error instanceof Error ? error.message : 'Unknown error'
        console.error('Retry failed while loading research data:', error)
        setDataLoadError(message)
      })
      .finally(() => {
        setIsDataLoading(false)
      })
  }, [hydrateData])

  const downloadBlob = useCallback((blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = fileName
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
  }, [])

  // Export functions
  const exportPNG = useCallback(async () => {
    const svg = Array
      .from(document.querySelectorAll('main svg'))
      .filter((candidate) => {
        const rect = candidate.getBoundingClientRect()
        return rect.width > 0 && rect.height > 0
      })
      .sort((a, b) => {
        const aRect = a.getBoundingClientRect()
        const bRect = b.getBoundingClientRect()
        return bRect.width * bRect.height - aRect.width * aRect.height
      })[0] as SVGSVGElement | undefined

    if (!svg) {
      console.error('No SVG canvas found for PNG export.')
      return
    }

    const rect = svg.getBoundingClientRect()
    const width = Math.max(1, Math.ceil(rect.width))
    const height = Math.max(1, Math.ceil(rect.height))
    const dpr = window.devicePixelRatio || 1

    const clonedSvg = svg.cloneNode(true) as SVGSVGElement
    clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    clonedSvg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink')
    clonedSvg.setAttribute('width', String(width))
    clonedSvg.setAttribute('height', String(height))

    const svgBlob = new Blob(
      [new XMLSerializer().serializeToString(clonedSvg)],
      { type: 'image/svg+xml;charset=utf-8' },
    )
    const svgUrl = URL.createObjectURL(svgBlob)

    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new window.Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('Failed to decode SVG for PNG export.'))
      img.src = svgUrl
    }).catch((error) => {
      console.error('PNG export failed:', error)
      return null
    })

    if (!image) {
      URL.revokeObjectURL(svgUrl)
      return
    }

    const canvas = document.createElement('canvas')
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      console.error('Failed to create canvas context for PNG export.')
      URL.revokeObjectURL(svgUrl)
      return
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)
    ctx.drawImage(image, 0, 0, width, height)

    const pngBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/png')
    })

    if (!pngBlob) {
      console.error('Failed to produce PNG blob from canvas.')
      URL.revokeObjectURL(svgUrl)
      return
    }

    downloadBlob(pngBlob, `research-nexus-${activeView}-${Date.now()}.png`)
    URL.revokeObjectURL(svgUrl)
  }, [activeView, downloadBlob])

  const exportJSON = useCallback(() => {
    const store = useAppStore.getState()
    const nexusStore = useNexusStore.getState()
    const data = {
      branches: nexusStore.branches,
      problems: store.problems,
      methods: store.methods,
      papers: store.papers,
      bookmarks: store.bookmarks,
      exportedAt: new Date().toISOString()
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    downloadBlob(blob, `research-nexus-data-${Date.now()}.json`)
  }, [downloadBlob])

  const renderActiveView = () => {
    switch (activeView) {
      case 'problem-tree':
        return <ProblemTree />
      case 'method-tree':
        return <MethodTree />
      case 'method-arrows':
        return <MethodArrowView />
      case 'method-timeline':
        return <MethodTimelineView />
      case 'dual-tree':
        return <DualTreeView />
      case 'timeline':
        return <TimelineView />
      case 'citation':
        return <CitationView />
      case 'paper-timeline':
        return <PaperTimelineView />
      default:
        return <ProblemTree />
    }
  }

  const bookmarkPanelWidthClass =
    screenSize === 'mobile' ? 'w-full' : screenSize === 'tablet' ? 'w-96 max-w-full' : 'w-80'

  return (
    <div className={`h-screen w-screen flex overflow-hidden ${viewConfig.darkMode ? 'bg-zinc-950' : 'bg-gray-50'}`}>
      {/* Sidebar */}
      <aside className={`${sidebarCollapsed ? 'w-16' : 'w-60'} border-r ${viewConfig.darkMode ? 'border-zinc-800 bg-zinc-950' : 'border-gray-200 bg-white'} flex flex-col shrink-0 transition-all duration-300`}>
        {/* Logo */}
        <div className={`p-4 border-b ${viewConfig.darkMode ? 'border-zinc-800' : 'border-gray-200'} flex items-center gap-3`}>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 shrink-0">
            <Sparkles size={18} />
          </div>
          {!sidebarCollapsed && (
            <div>
              <h1 className={`font-bold text-sm tracking-tight ${viewConfig.darkMode ? 'text-white' : 'text-gray-900'}`}>Research Nexus</h1>
              <p className={`text-[10px] font-mono tracking-widest ${viewConfig.darkMode ? 'text-zinc-500' : 'text-gray-400'}`}>PRO v2.2</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
          {!sidebarCollapsed && (
            <div className={`text-[10px] uppercase tracking-wider px-3 py-2 font-medium ${viewConfig.darkMode ? 'text-zinc-600' : 'text-gray-400'}`}>
              Problem System
            </div>
          )}
          {NAV_ITEMS.filter(i => i.group === 'problems').map(item => (
            <NavButton key={item.id} item={item} active={activeView === item.id}
              onClick={() => {
                setActiveView(item.id)
                if (screenSize === 'mobile') {
                  setSidebarCollapsed(true)
                }
              }}
              collapsed={sidebarCollapsed} dark={viewConfig.darkMode} />
          ))}
          
          {!sidebarCollapsed && (
            <div className={`text-[10px] uppercase tracking-wider px-3 py-2 font-medium mt-3 ${viewConfig.darkMode ? 'text-zinc-600' : 'text-gray-400'}`}>
              Method System
            </div>
          )}
          {NAV_ITEMS.filter(i => i.group === 'methods').map(item => (
            <NavButton key={item.id} item={item} active={activeView === item.id}
              onClick={() => {
                setActiveView(item.id)
                if (screenSize === 'mobile') {
                  setSidebarCollapsed(true)
                }
              }}
              collapsed={sidebarCollapsed} dark={viewConfig.darkMode} />
          ))}
          
          {!sidebarCollapsed && (
            <div className={`text-[10px] uppercase tracking-wider px-3 py-2 font-medium mt-3 ${viewConfig.darkMode ? 'text-zinc-600' : 'text-gray-400'}`}>
              Paper System
            </div>
          )}
          {NAV_ITEMS.filter(i => i.group === 'papers').map(item => (
            <NavButton key={item.id} item={item} active={activeView === item.id}
              onClick={() => {
                setActiveView(item.id)
                if (screenSize === 'mobile') {
                  setSidebarCollapsed(true)
                }
              }}
              collapsed={sidebarCollapsed} dark={viewConfig.darkMode} />
          ))}
        </nav>

        {/* Bottom tools */}
        <div className={`p-3 border-t ${viewConfig.darkMode ? 'border-zinc-800' : 'border-gray-200'} space-y-1`}>
          <ToolBtn icon={Bookmark} label="Bookmarks (Ctrl+B)" collapsed={sidebarCollapsed} dark={viewConfig.darkMode}
            onClick={() => setShowBookmarks(!showBookmarks)} active={showBookmarks} />
          <div className="flex gap-1">
            <ToolBtn icon={Undo2} label="Undo" collapsed={sidebarCollapsed} dark={viewConfig.darkMode} onClick={undo} />
            <ToolBtn icon={Redo2} label="Redo" collapsed={sidebarCollapsed} dark={viewConfig.darkMode} onClick={redo} />
          </div>
          <div className={`my-1 border-t ${viewConfig.darkMode ? 'border-zinc-800' : 'border-gray-200'}`} />
          <ToolBtn icon={viewConfig.darkMode ? Sun : Moon}
            label={viewConfig.darkMode ? 'Light Mode' : 'Dark Mode'}
            collapsed={sidebarCollapsed} dark={viewConfig.darkMode}
            onClick={() => updateViewConfig({ darkMode: !viewConfig.darkMode })}
          />
          <ToolBtn icon={Download} label="Export" collapsed={sidebarCollapsed} dark={viewConfig.darkMode}
            onClick={() => setShowExport(!showExport)} />
          <ToolBtn icon={Play} label="Present" collapsed={sidebarCollapsed} dark={viewConfig.darkMode}
            onClick={() => setShowPresentation(true)} />
          <ToolBtn icon={sidebarCollapsed ? PanelLeft : Layout}
            label={sidebarCollapsed ? 'Expand' : 'Collapse'}
            collapsed={sidebarCollapsed} dark={viewConfig.darkMode}
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)} />
        </div>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 relative overflow-hidden ${viewConfig.darkMode ? 'bg-zinc-950' : 'bg-gray-50'}`}>
        <AnimatePresence mode="wait">
          <motion.div key={activeView}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }} className="h-full">
            <Suspense fallback={<LoadingFallback darkMode={viewConfig.darkMode} />}>
              {renderActiveView()}
            </Suspense>
          </motion.div>
        </AnimatePresence>

        {(isDataLoading || dataLoadError) && (
          <div className={`absolute inset-0 z-30 flex items-center justify-center backdrop-blur-sm ${
            viewConfig.darkMode ? 'bg-zinc-950/80' : 'bg-white/80'
          }`}>
            <div className={`rounded-xl border px-5 py-4 text-center ${
              viewConfig.darkMode
                ? 'bg-zinc-900 border-zinc-800 text-zinc-200'
                : 'bg-white border-gray-200 text-gray-700'
            }`}>
              {isDataLoading && (
                <>
                  <p className="text-sm font-medium">Loading research dataset…</p>
                  <p className={`text-xs mt-1 ${viewConfig.darkMode ? 'text-zinc-500' : 'text-gray-500'}`}>
                    Please wait while the views initialize.
                  </p>
                </>
              )}
              {dataLoadError && (
                <>
                  <p className="text-sm font-medium text-red-500">Failed to load dataset</p>
                  <p className={`text-xs mt-1 ${viewConfig.darkMode ? 'text-zinc-500' : 'text-gray-500'}`}>
                    {dataLoadError}
                  </p>
                  <button
                    onClick={retryLoadData}
                    className={`mt-3 rounded-md border px-3 py-1.5 text-xs transition-colors ${
                      viewConfig.darkMode
                        ? 'border-zinc-700 text-zinc-300 hover:bg-zinc-800'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    Retry
                  </button>
                </>
              )}
            </div>
          </div>
        )}
        
        {/* Export Panel */}
        <AnimatePresence>
          {showExport && (
            <motion.div
              initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
              className={`absolute bottom-4 left-1/2 -translate-x-1/2 rounded-xl shadow-2xl p-4 flex items-center gap-3 z-50 ${
                viewConfig.darkMode
                  ? 'bg-zinc-900 border border-zinc-800'
                  : 'bg-white border border-gray-200'
              }`}>
              <button onClick={() => { void exportPNG() }}
                className="px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 rounded-lg text-sm text-indigo-500 flex items-center gap-2 transition-colors">
                <Image size={16} /> Export PNG
              </button>
              <button onClick={exportJSON}
                className="px-4 py-2 bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 rounded-lg text-sm text-green-500 flex items-center gap-2 transition-colors">
                <FileJson size={16} /> Export JSON
              </button>
              <button onClick={() => setShowExport(false)}
                className={`p-2 rounded-lg ${
                  viewConfig.darkMode ? 'hover:bg-zinc-800 text-zinc-500' : 'hover:bg-gray-100 text-gray-500'
                }`}>✕</button>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Bookmark Panel */}
        <AnimatePresence>
          {showBookmarks && (
            <motion.div
              initial={{ x: 400, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 400, opacity: 0 }}
              className={`absolute right-0 top-0 bottom-0 ${bookmarkPanelWidthClass} overflow-y-auto z-40 ${
                viewConfig.darkMode
                  ? 'bg-zinc-900/95 backdrop-blur-xl border-l border-zinc-800'
                  : 'bg-white/95 backdrop-blur-xl border-l border-gray-200'
              }`}>
              <div className={`flex items-center justify-between px-4 py-3 ${
                viewConfig.darkMode ? 'border-b border-zinc-800' : 'border-b border-gray-200'
              }`}>
                <h3 className={`text-sm font-semibold ${viewConfig.darkMode ? 'text-white' : 'text-gray-900'}`}>Bookmarks</h3>
                <button
                  onClick={() => setShowBookmarks(false)}
                  className={viewConfig.darkMode ? 'text-zinc-500 hover:text-zinc-300' : 'text-gray-500 hover:text-gray-700'}
                >
                  ✕
                </button>
              </div>
              <Suspense fallback={<LoadingFallback darkMode={viewConfig.darkMode} />}>
                <BookmarkPanel />
              </Suspense>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Node Detail Panel */}
        <AnimatePresence>
          {selectedNode && selectedNode.type !== 'paper' && (
            <motion.div
              initial={{ x: 400, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 400, opacity: 0 }}
              className="absolute right-0 top-0 bottom-0 w-96 z-50"
            >
              <Suspense fallback={<LoadingFallback darkMode={viewConfig.darkMode} />}>
                <NodeDetailPanel
                  nodeId={selectedNode.id}
                  nodeType={selectedNode.type as 'problem' | 'method'}
                  onClose={() => selectNode('problem', '')}
                />
              </Suspense>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Paper Detail Panel */}
        <AnimatePresence>
          {selectedNode && selectedNode.type === 'paper' && (
            <motion.div
              initial={{ x: 480, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 480, opacity: 0 }}
              className="absolute right-0 top-0 bottom-0 z-50"
            >
              <Suspense fallback={<LoadingFallback darkMode={viewConfig.darkMode} />}>
                <PaperDetailPanel
                  paperId={selectedNode.id}
                  onClose={() => selectNode('problem', '')}
                />
              </Suspense>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Presentation Mode */}
        <AnimatePresence>
          {showPresentation && (
            <Suspense fallback={<LoadingFallback darkMode={viewConfig.darkMode} />}>
              <PresentationMode onClose={() => setShowPresentation(false)} />
            </Suspense>
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}

const LoadingFallback = ({ darkMode }: { darkMode: boolean }) => (
  <div className={`h-full w-full flex items-center justify-center text-sm ${
    darkMode ? 'text-zinc-500' : 'text-gray-500'
  }`}>
    Loading view…
  </div>
)

type NavButtonProps = {
  item: NavItem
  active: boolean
  onClick: () => void
  collapsed: boolean
  dark: boolean
}

const NavButton = ({ item, active, onClick, collapsed, dark }: NavButtonProps) => {
  const Icon = item.icon
  return (
    <button onClick={onClick}
      className={`flex items-center gap-3 w-full rounded-lg transition-all duration-200 ${
        collapsed ? 'px-0 py-2 justify-center' : 'px-3 py-2'
      } ${
        active
          ? 'bg-indigo-500/10 text-indigo-400 font-medium border border-indigo-500/20'
          : dark
            ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 border border-transparent'
            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100 border border-transparent'
      }`}
      title={collapsed ? item.label : undefined}>
      <Icon size={16} className="shrink-0" />
      {!collapsed && (
        <>
          <span className="text-sm flex-1 text-left">{item.label}</span>
          {item.badge && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-500/20 text-indigo-400">
              {item.badge}
            </span>
          )}
        </>
      )}
    </button>
  )
}

type ToolBtnProps = {
  icon: LucideIcon
  label: string
  collapsed: boolean
  dark: boolean
  onClick: () => void
  active?: boolean
}

const ToolBtn = ({ icon: Icon, label, collapsed, dark, onClick, active = false }: ToolBtnProps) => (
  <button onClick={onClick}
    className={`flex items-center gap-3 w-full rounded-lg transition-all ${
      collapsed ? 'px-0 py-2 justify-center' : 'px-3 py-2'
    } ${
      active
        ? dark
          ? 'text-indigo-300 bg-indigo-500/10'
          : 'text-indigo-600 bg-indigo-50'
        : dark
          ? 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
          : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
    }`}
    title={collapsed ? label : undefined}>
    <Icon size={14} />
    {!collapsed && <span className="text-xs">{label}</span>}
  </button>
)

export default App
