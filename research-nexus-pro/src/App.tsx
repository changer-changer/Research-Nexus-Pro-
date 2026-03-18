import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  GitBranch, Clock, Network, Layers, Download, Settings, Sparkles,
  Sun, Moon, RotateCcw, Layout, PanelLeft, Eye, Filter,
  BookOpen, Target, Workflow, ArrowRight, Image, FileJson,
  Bookmark, Undo2, Redo2, Play
} from 'lucide-react'
import { useAppStore } from './store/appStore'
import { useNexusStore } from './store/nexusStore'
import ProblemTree from './components/ProblemTree'
import MethodTree from './components/MethodTree'
import MethodArrowView from './components/MethodArrowView'
import DualTreeView from './components/DualTreeView'
import TimelineView from './components/TimelineView'
import CitationView from './components/CitationView'
import PaperTimelineView from './components/PaperTimelineView'
import BookmarkPanel from './components/BookmarkPanel'
import PresentationMode from './components/PresentationMode'

type NavItem = {
  id: string
  label: string
  icon: any
  badge?: string
  group: string
}

const NAV_ITEMS: NavItem[] = [
  { id: 'problem-tree', label: 'Problem Tree', icon: GitBranch, group: 'problems' },
  { id: 'timeline', label: 'Time Evolution', icon: Clock, group: 'problems' },
  { id: 'method-arrows', label: 'Method → Problem', icon: ArrowRight, group: 'methods' },
  { id: 'method-tree', label: 'Method Tree', icon: Target, group: 'methods' },
  { id: 'dual-tree', label: 'Dual Tree Fusion', icon: Workflow, group: 'methods', badge: 'NEW' },
  { id: 'paper-timeline', label: 'Paper Timeline', icon: BookOpen, group: 'papers' },
  { id: 'citation', label: 'Citation Network', icon: Network, group: 'papers' },
]

function App() {
  const { activeView, setActiveView, viewConfig, updateViewConfig, loadData, undo, redo } = useAppStore()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [showBookmarks, setShowBookmarks] = useState(false)
  const [showPresentation, setShowPresentation] = useState(false)
  const [screenSize, setScreenSize] = useState<'desktop' | 'tablet' | 'mobile'>('desktop')

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
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
      else { setScreenSize('desktop') }
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    import('./data/real_papers.json').then((data) => {
      loadData(data.default)
      // Also sync to nexusStore for ProblemEvolutionView, ProblemTreeView, TreeView, etc.
      const { loadData: nexusLoad } = useNexusStore.getState()
      nexusLoad({
        branches: data.default.branches || [],
        problems: data.default.problems || [],
        methods: data.default.methods || [],
        papers: data.default.papers || [],
      })
    })
  }, [])

  // Export functions
  const exportPNG = useCallback(() => {
    const svg = document.querySelector('svg')
    if (!svg) return
    const svgData = new XMLSerializer().serializeToString(svg)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new window.Image()
    img.onload = () => {
      canvas.width = img.width
      canvas.height = img.height
      ctx?.drawImage(img, 0, 0)
      const a = document.createElement('a')
      a.href = canvas.toDataURL('image/png')
      a.download = `research-nexus-${activeView}-${Date.now()}.png`
      a.click()
    }
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)))
  }, [activeView])

  const exportJSON = useCallback(() => {
    const store = useAppStore.getState()
    const data = {
      problems: store.problems,
      methods: store.methods,
      papers: store.papers,
      exportedAt: new Date().toISOString()
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `research-nexus-data-${Date.now()}.json`
    a.click()
  }, [])

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
              onClick={() => setActiveView(item.id)} collapsed={sidebarCollapsed} dark={viewConfig.darkMode} />
          ))}
          
          {!sidebarCollapsed && (
            <div className={`text-[10px] uppercase tracking-wider px-3 py-2 font-medium mt-3 ${viewConfig.darkMode ? 'text-zinc-600' : 'text-gray-400'}`}>
              Method System
            </div>
          )}
          {NAV_ITEMS.filter(i => i.group === 'methods').map(item => (
            <NavButton key={item.id} item={item} active={activeView === item.id}
              onClick={() => setActiveView(item.id)} collapsed={sidebarCollapsed} dark={viewConfig.darkMode} />
          ))}
          
          {!sidebarCollapsed && (
            <div className={`text-[10px] uppercase tracking-wider px-3 py-2 font-medium mt-3 ${viewConfig.darkMode ? 'text-zinc-600' : 'text-gray-400'}`}>
              Paper System
            </div>
          )}
          {NAV_ITEMS.filter(i => i.group === 'papers').map(item => (
            <NavButton key={item.id} item={item} active={activeView === item.id}
              onClick={() => setActiveView(item.id)} collapsed={sidebarCollapsed} dark={viewConfig.darkMode} />
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
            {activeView === 'problem-tree' && <ProblemTree />}
            {activeView === 'method-tree' && <MethodTree />}
            {activeView === 'method-arrows' && <MethodArrowView />}
            {activeView === 'dual-tree' && <DualTreeView />}
            {activeView === 'timeline' && <TimelineView />}
            {activeView === 'citation' && <CitationView />}
            {activeView === 'paper-timeline' && <PaperTimelineView />}
          </motion.div>
        </AnimatePresence>
        
        {/* Export Panel */}
        <AnimatePresence>
          {showExport && (
            <motion.div
              initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
              className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl p-4 flex items-center gap-3 z-50">
              <button onClick={exportPNG}
                className="px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 rounded-lg text-sm text-indigo-300 flex items-center gap-2 transition-colors">
                <Image size={16} /> Export PNG
              </button>
              <button onClick={exportJSON}
                className="px-4 py-2 bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 rounded-lg text-sm text-green-300 flex items-center gap-2 transition-colors">
                <FileJson size={16} /> Export JSON
              </button>
              <button onClick={() => setShowExport(false)}
                className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-500">✕</button>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Bookmark Panel */}
        <AnimatePresence>
          {showBookmarks && (
            <motion.div
              initial={{ x: 400, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 400, opacity: 0 }}
              className="absolute right-0 top-0 bottom-0 w-80 bg-zinc-900/95 backdrop-blur-xl border-l border-zinc-800 overflow-y-auto z-40">
              <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
                <h3 className="text-sm font-semibold text-white">Bookmarks</h3>
                <button onClick={() => setShowBookmarks(false)} className="text-zinc-500 hover:text-zinc-300">✕</button>
              </div>
              <BookmarkPanel />
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Presentation Mode */}
        <AnimatePresence>
          {showPresentation && <PresentationMode onClose={() => setShowPresentation(false)} />}
        </AnimatePresence>
      </main>
    </div>
  )
}

const NavButton = ({ item, active, onClick, collapsed, dark }: any) => {
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

const ToolBtn = ({ icon: Icon, label, collapsed, dark, onClick }: any) => (
  <button onClick={onClick}
    className={`flex items-center gap-3 w-full rounded-lg transition-all ${
      collapsed ? 'px-0 py-2 justify-center' : 'px-3 py-2'
    } ${
      dark ? 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
    }`}
    title={collapsed ? label : undefined}>
    <Icon size={14} />
    {!collapsed && <span className="text-xs">{label}</span>}
  </button>
)

export default App
