import React, { useCallback } from 'react'
import { Download, FileJson, Image, Table } from 'lucide-react'
import { useNexusStore } from '../store/nexusStore'

export default function ExportPanel() {
  const problems = useNexusStore(s => s.problems)
  const methods = useNexusStore(s => s.methods)
  const branches = useNexusStore(s => s.branches)

  const exportJSON = useCallback(() => {
    const data = { problems, methods, branches, exportedAt: new Date().toISOString() }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `nexus-export-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [problems, methods, branches])

  const exportCSV = useCallback(() => {
    const header = 'id,name,year,status,branchId,description'
    const rows = problems.map(p => 
      `${p.id},"${p.name}",${p.year},${p.status},${p.branchId},"${p.description}"`
    )
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `nexus-problems-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [problems])

  const exportPNG = useCallback(() => {
    const canvas = document.querySelector('.react-flow__renderer canvas') as HTMLCanvasElement
    if (canvas) {
      const a = document.createElement('a')
      a.href = canvas.toDataURL('image/png')
      a.download = `nexus-visualization-${Date.now()}.png`
      a.click()
    }
  }, [])

  return (
    <div className="p-4 space-y-3">
      <h3 className="text-sm font-medium text-zinc-300 flex items-center gap-2">
        <Download size={16} /> Export Data
      </h3>
      <div className="grid grid-cols-3 gap-2">
        <button onClick={exportJSON} className="flex flex-col items-center gap-1 p-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors">
          <FileJson size={20} className="text-green-400" />
          <span className="text-xs text-zinc-300">JSON</span>
        </button>
        <button onClick={exportCSV} className="flex flex-col items-center gap-1 p-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors">
          <Table size={20} className="text-blue-400" />
          <span className="text-xs text-zinc-300">CSV</span>
        </button>
        <button onClick={exportPNG} className="flex flex-col items-center gap-1 p-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors">
          <Image size={20} className="text-purple-400" />
          <span className="text-xs text-zinc-300">PNG</span>
        </button>
      </div>
    </div>
  )
}
