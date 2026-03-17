import { useState, useEffect } from 'react'
import { GitBranch, Clock, Network, Settings, Sparkles, Download, Layers } from 'lucide-react'
import { useNexusStore } from './store/nexusStore'
import TreeView from './components/TreeView'
import TimelineView from './components/TimelineView'
import CitationView from './components/CitationView'
import ExportPanel from './components/ExportPanel'
import LayerOverlay from './components/LayerOverlay'

type View = 'tree' | 'timeline' | 'citation'

function App() {
  const [activeView, setActiveView] = useState<View>('tree')
  const [showExport, setShowExport] = useState(false)
  const [showLayers, setShowLayers] = useState(false)
  const loadData = useNexusStore((state) => state.loadData)
  
  useEffect(() => {
    import('./data/real_papers.json').then((data) => {
      loadData(data.default)
    })
  }, [])

  const togglePanel = (panel: 'layers' | 'export') => {
    if (panel === 'layers') {
      setShowLayers(!showLayers)
      if (!showLayers) setShowExport(false)
    } else {
      setShowExport(!showExport)
      if (!showExport) setShowLayers(false)
    }
  }

  return (
    <div className="flex h-full w-full bg-zinc-950 text-zinc-100 font-sans">
      {/* Sidebar */}
      <aside className="w-60 border-r border-zinc-800 bg-zinc-950 flex flex-col shrink-0">
        <div className="p-5 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
              <Sparkles size={18} />
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-tight">Research Nexus</h1>
              <p className="text-[10px] text-zinc-500 font-mono tracking-widest">PRO v1.0</p>
            </div>
          </div>
        </div>
        
        <nav className="flex-1 p-3 space-y-1">
          <div className="text-[10px] text-zinc-600 uppercase tracking-wider px-3 py-2">Views</div>
          <ViewButton active={activeView === 'tree'} onClick={() => setActiveView('tree')} icon={GitBranch} label="Problem Tree" description="Hierarchical topology" />
          <ViewButton active={activeView === 'timeline'} onClick={() => setActiveView('timeline')} icon={Clock} label="Timeline" description="Time × Domain evolution" />
          <ViewButton active={activeView === 'citation'} onClick={() => setActiveView('citation')} icon={Network} label="Citations" description="Paper reference network" />
        </nav>

        <div className="p-3 space-y-1 border-t border-zinc-800">
          <div className="text-[10px] text-zinc-600 uppercase tracking-wider px-3 py-2">Tools</div>
          <ToolButton active={showLayers} onClick={() => togglePanel('layers')} icon={Layers} label="Layers" />
          <ToolButton active={showExport} onClick={() => togglePanel('export')} icon={Download} label="Export" />
        </div>

        <div className="p-4 border-t border-zinc-800">
          <StatsPanel />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 relative overflow-hidden">
        {showExport && <ExportPanel />}
        {showLayers && <LayerOverlay />}
        {!showExport && !showLayers && (
          activeView === 'tree' ? <TreeView /> :
          activeView === 'timeline' ? <TimelineView /> :
          <CitationView />
        )}
      </main>
    </div>
  )
}

const ViewButton = ({ active, onClick, icon: Icon, label, description }: any) => (
  <button
    onClick={onClick}
    className={`flex items-start gap-3 w-full px-3 py-2.5 rounded-lg transition-all duration-200 text-left ${
      active 
        ? 'bg-indigo-500/10 border border-indigo-500/20' 
        : 'hover:bg-zinc-800/50 border border-transparent'
    }`}
  >
    <Icon size={16} className={active ? 'text-indigo-400 mt-0.5' : 'text-zinc-500 mt-0.5'} />
    <div>
      <div className={`text-sm ${active ? 'text-indigo-300 font-medium' : 'text-zinc-400'}`}>{label}</div>
      <div className="text-[10px] text-zinc-600">{description}</div>
    </div>
  </button>
)

const ToolButton = ({ active, onClick, icon: Icon, label }: any) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm transition-all ${
      active ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'
    }`}
  >
    <Icon size={14} />
    <span>{label}</span>
  </button>
)

const StatsPanel = () => {
  const stats = useNexusStore(s => s.stats)
  return (
    <div className="space-y-2">
      <div className="text-[10px] text-zinc-600 uppercase tracking-wider">Statistics</div>
      <div className="grid grid-cols-2 gap-1.5 text-xs">
        <StatCard label="Branches" value={stats.branches} color="text-indigo-400" />
        <StatCard label="Problems" value={stats.nodes} color="text-white" />
        <StatCard label="Links" value={stats.connections} color="text-indigo-400" />
        <StatCard label="Unsolved" value={stats.unsolved} color="text-red-400" />
      </div>
    </div>
  )
}

const StatCard = ({ label, value, color }: any) => (
  <div className="bg-zinc-900/50 rounded-lg p-2">
    <div className="text-zinc-600 text-[10px]">{label}</div>
    <div className={`text-lg font-bold ${color}`}>{value}</div>
  </div>
)

export default App
