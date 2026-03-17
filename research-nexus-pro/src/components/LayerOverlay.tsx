import React from 'react'
import { Layers, Eye, EyeOff } from 'lucide-react'
import { useNexusStore } from '../store/nexusStore'

interface Layer {
  id: string
  name: string
  visible: boolean
  color: string
}

const defaultLayers: Layer[] = [
  { id: 'l_problems', name: 'Problem Nodes', visible: true, color: '#8b5cf6' },
  { id: 'l_methods', name: 'Method Links', visible: true, color: '#22c55e' },
  { id: 'l_evolution', name: 'Evolution Arrows', visible: true, color: '#f59e0b' },
  { id: 'l_domains', name: 'Domain Swimlanes', visible: true, color: '#6366f1' },
  { id: 'l_annotations', name: 'Annotations', visible: false, color: '#ef4444' }
]

export default function LayerOverlay() {
  const [layers, setLayers] = React.useState<Layer[]>(defaultLayers)
  const setLayerVisibility = useNexusStore(s => s.setLayerVisibility)

  const toggle = (id: string) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, visible: !l.visible } : l))
    setLayerVisibility(id, !layers.find(l => l.id === id)?.visible)
  }

  return (
    <div className="p-4 space-y-3">
      <h3 className="text-sm font-medium text-zinc-300 flex items-center gap-2">
        <Layers size={16} /> Layer Control
      </h3>
      <div className="space-y-1">
        {layers.map(layer => (
          <button
            key={layer.id}
            onClick={() => toggle(layer.id)}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <div className="w-3 h-3 rounded-sm" style={{ background: layer.color, opacity: layer.visible ? 1 : 0.3 }} />
            <span className={`text-sm flex-1 text-left ${layer.visible ? 'text-zinc-200' : 'text-zinc-500'}`}>
              {layer.name}
            </span>
            {layer.visible ? <Eye size={14} className="text-zinc-400" /> : <EyeOff size={14} className="text-zinc-600" />}
          </button>
        ))}
      </div>
    </div>
  )
}
