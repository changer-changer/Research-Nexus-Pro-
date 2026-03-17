import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  GitBranch, Clock, Network, Layers, Download, Settings, Sparkles,
  Sun, Moon, RotateCcw, Layout, PanelLeft, Eye, Filter,
  BookOpen, Target, Workflow
} from 'lucide-react'
import { useAppStore } from './store/appStore'
import ProblemTree from './components/ProblemTree'
import TimelineView from './components/TimelineView'
import CitationView from './components/CitationView'

type NavItem = {
  id: string
  label: string
  icon: any
  badge?: string
  group: 'problems' | 'methods' | 'papers' | 'tools'
}

const NAV_ITEMS: NavItem[] = [
  { id: 'problem-tree', label: 'Problem Tree', icon: GitBranch, group: 'problems' },
  { id: 'method-tree', label: 'Method Tree', icon: Target, group: 'methods' },
  { id: 'dual-tree', label: 'Dual Tree Fusion', icon: Workflow, group: 'methods', badge: 'NEW' },
  { id: 'timeline', label: 'Timeline View', icon: Clock, group: 'problems' },
  { id: 'citation', label: 'Citation Network', icon: Network, group: 'papers' },
]

function App() {
  const { activeView, setActiveView, viewConfig, updateViewConfig, loadData } = useAppStore()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  useEffect(() => {
    import('./data/real_papers.json').then((data) => {
      loadData(data.default)
    })
  }, [])

  return (
    <div className={`h-screen w-screen flex overflow-hidden ${viewConfig.darkMode ? 'dark' : ''}`}>
      {/* Sidebar */}
      <aside className={`${sidebarCollapsed ? 'w-16' : 'w-60'} border-r border-zinc-800 bg-zinc-950 flex flex-col shrink-0 transition-all duration-300`}>
        {/* Logo */}
        <div className="p-4 border-b border-zinc-800 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 shrink-0">
            <Sparkles size={18} />
          </div>
          {!sidebarCollapsed && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="overflow-hidden">
              <h1 className="font-bold text-sm text-white tracking-tight">Research Nexus</h1>
              <p className="text-[10px] text-zinc-500 font-mono tracking-widest">PRO v2.0</p>
            </motion.div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
          {!sidebarCollapsed && (
            <div className="text-[10px] text-zinc-600 uppercase tracking-wider px-3 py-2 font-medium">
              Problem System
            </div>
          )}
          {NAV_ITEMS.filter(i => i.group === 'problems').map(item => (
            <NavButton 
              key={item.id}
              item={item}
              active={activeView === item.id}
              onClick={() => setActiveView(item.id)}
              collapsed={sidebarCollapsed}
            />
          ))}
          
          {!sidebarCollapsed && (
            <div className="text-[10px] text-zinc-600 uppercase tracking-wider px-3 py-2 font-medium mt-3">
              Method System
            </div>
          )}
          {NAV_ITEMS.filter(i => i.group === 'methods').map(item => (
            <NavButton
              key={item.id}
              item={item}
              active={activeView === item.id}
              onClick={() => setActiveView(item.id)}
              collapsed={sidebarCollapsed}
            />
          ))}
          
          {!sidebarCollapsed && (
            <div className="text-[10px] text-zinc-600 uppercase tracking-wider px-3 py-2 font-medium mt-3">
              Paper System
            </div>
          )}
          {NAV_ITEMS.filter(i => i.group === 'papers').map(item => (
            <NavButton
              key={item.id}
              item={item}
              active={activeView === item.id}
              onClick={() => setActiveView(item.id)}
              collapsed={sidebarCollapsed}
            />
          ))}
        </nav>

        {/* Bottom tools */}
        <div className="p-3 border-t border-zinc-800 space-y-1">
          <ToolBtn icon={viewConfig.darkMode ? Sun : Moon}
            label={viewConfig.darkMode ? 'Light Mode' : 'Dark Mode'}
            collapsed={sidebarCollapsed}
            onClick={() => updateViewConfig({ darkMode: !viewConfig.darkMode })}
          />
          <ToolBtn icon={sidebarCollapsed ? PanelLeft : Layout}
            label={sidebarCollapsed ? 'Expand' : 'Collapse'}
            collapsed={sidebarCollapsed}
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          />
          <ToolBtn icon={Settings} label="Settings" collapsed={sidebarCollapsed} />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 relative overflow-hidden bg-zinc-950">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeView}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            {activeView === 'problem-tree' && <ProblemTree />}
            {activeView === 'timeline' && <TimelineView />}
            {activeView === 'citation' && <CitationView />}
            {activeView === 'method-tree' && <MethodTreePlaceholder />}
            {activeView === 'dual-tree' && <DualTreePlaceholder />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  )
}

// ============ Nav Button ============
function NavButton({ item, active, onClick, collapsed }: any) {
  const Icon = item.icon
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 w-full rounded-lg transition-all duration-200 ${
        collapsed ? 'px-0 py-2 justify-center' : 'px-3 py-2'
      } ${
        active
          ? 'bg-indigo-500/10 text-indigo-400 font-medium border border-indigo-500/20'
          : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 border border-transparent'
      }`}
      title={collapsed ? item.label : undefined}
    >
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

// ============ Tool Button ============
function ToolBtn({ icon: Icon, label, collapsed, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 w-full rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-all ${
        collapsed ? 'px-0 py-2 justify-center' : 'px-3 py-2'
      }`}
      title={collapsed ? label : undefined}
    >
      <Icon size={14} />
      {!collapsed && <span className="text-xs">{label}</span>}
    </button>
  )
}

// ============ Placeholder Views ============
function MethodTreePlaceholder() {
  return (
    <div className="h-full flex items-center justify-center text-zinc-500 flex-col gap-4">
      <Target size={48} className="opacity-20" />
      <div className="text-center">
        <p className="text-lg font-medium">Method Tree View</p>
        <p className="text-sm mt-1">Hierarchical method decomposition</p>
        <p className="text-xs mt-2 text-zinc-600">Coming in next iteration</p>
      </div>
    </div>
  )
}

function DualTreePlaceholder() {
  return (
    <div className="h-full flex items-center justify-center text-zinc-500 flex-col gap-4">
      <Workflow size={48} className="opacity-20" />
      <div className="text-center">
        <p className="text-lg font-medium">Dual Tree Fusion View</p>
        <p className="text-sm mt-1">Problem tree + Method tree with cross-links</p>
        <p className="text-xs mt-2 text-zinc-600">Coming in next iteration</p>
      </div>
    </div>
  )
}

export default App
