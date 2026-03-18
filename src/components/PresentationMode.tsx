import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Maximize, Minimize, Play, Pause, ChevronLeft, ChevronRight, Monitor, Smartphone, Tablet } from 'lucide-react'
import { useAppStore } from '../store/appStore'

interface PresentationModeProps {
  onClose: () => void
}

const SLIDES = [
  { id: 'intro', title: 'Research-Nexus Pro', subtitle: 'AI-Native Research Exploration System', view: null },
  { id: 'problem-tree', title: 'Problem Topology', subtitle: 'Hierarchical decomposition from goal to leaves', view: 'problem-tree' },
  { id: 'method-arrows', title: 'Method → Problem', subtitle: 'Targeting relationships and verification status', view: 'method-arrows' },
  { id: 'dual-tree', title: 'Dual Tree Fusion', subtitle: 'Problem + Method trees with cross-links', view: 'dual-tree' },
  { id: 'timeline', title: 'Time Evolution', subtitle: 'Problem evolution across domains and time', view: 'timeline' },
  { id: 'paper-timeline', title: 'Paper Timeline', subtitle: 'Research papers categorized by domain', view: 'paper-timeline' },
  { id: 'citation', title: 'Citation Network', subtitle: 'Paper reference connections', view: 'citation' },
  { id: 'summary', title: 'Summary', subtitle: '42 papers · 12 problems · 21 methods · 8 domains', view: null },
]

export default function PresentationMode({ onClose }: PresentationModeProps) {
  const { setActiveView, viewConfig } = useAppStore()
  const [currentSlide, setCurrentSlide] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [devicePreview, setDevicePreview] = useState<'desktop' | 'tablet' | 'mobile'>('desktop')

  const slide = SLIDES[currentSlide]

  // Auto-play
  useEffect(() => {
    if (!isPlaying) return
    const timer = setInterval(() => {
      setCurrentSlide(c => (c + 1) % SLIDES.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [isPlaying])

  // Navigate to view when slide changes
  useEffect(() => {
    if (slide.view) {
      setActiveView(slide.view)
    }
  }, [currentSlide, slide.view, setActiveView])

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault()
        setCurrentSlide(c => Math.min(c + 1, SLIDES.length - 1))
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setCurrentSlide(c => Math.max(c - 1, 0))
      }
      if (e.key === 'Escape') onClose()
      if (e.key === 'p') setIsPlaying(p => !p)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const deviceWidth = devicePreview === 'desktop' ? '100%' : devicePreview === 'tablet' ? '768px' : '375px'

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-zinc-950 flex flex-col"
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 bg-zinc-900/80 backdrop-blur border-b border-zinc-800">
        <div className="flex items-center gap-4">
          <span className="text-sm font-bold text-white">Presentation Mode</span>
          <span className="text-xs text-zinc-500">{currentSlide + 1} / {SLIDES.length}</span>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Device preview */}
          <div className="flex items-center gap-1 bg-zinc-800 rounded-lg p-1">
            <button onClick={() => setDevicePreview('desktop')}
              className={`p-1.5 rounded ${devicePreview === 'desktop' ? 'bg-zinc-700 text-white' : 'text-zinc-500'}`}>
              <Monitor size={14} />
            </button>
            <button onClick={() => setDevicePreview('tablet')}
              className={`p-1.5 rounded ${devicePreview === 'tablet' ? 'bg-zinc-700 text-white' : 'text-zinc-500'}`}>
              <Tablet size={14} />
            </button>
            <button onClick={() => setDevicePreview('mobile')}
              className={`p-1.5 rounded ${devicePreview === 'mobile' ? 'bg-zinc-700 text-white' : 'text-zinc-500'}`}>
              <Smartphone size={14} />
            </button>
          </div>
          
          {/* Playback */}
          <button onClick={() => setIsPlaying(p => !p)}
            className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400">
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
          </button>
          
          <button onClick={onClose} className="px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300">
            Exit (Esc)
          </button>
        </div>
      </div>
      
      {/* Slide content */}
      <div className="flex-1 flex items-center justify-center p-8 overflow-hidden">
        <div className="w-full h-full flex items-center justify-center" style={{ maxWidth: deviceWidth }}>
          <AnimatePresence mode="wait">
            {!slide.view ? (
              <motion.div
                key={slide.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="text-center">
                <h1 className="text-5xl font-bold text-white mb-4">{slide.title}</h1>
                <p className="text-xl text-zinc-400">{slide.subtitle}</p>
                {slide.id === 'intro' && (
                  <div className="mt-8 flex items-center justify-center gap-6">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-indigo-400">42</div>
                      <div className="text-xs text-zinc-500">Papers</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-green-400">12</div>
                      <div className="text-xs text-zinc-500">Problems</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-blue-400">21</div>
                      <div className="text-xs text-zinc-500">Methods</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-purple-400">8</div>
                      <div className="text-xs text-zinc-500">Domains</div>
                    </div>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key={slide.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-full h-full rounded-xl overflow-hidden border border-zinc-800">
                <div className="bg-zinc-900/50 px-4 py-2 border-b border-zinc-800 flex items-center gap-3">
                  <span className="text-sm font-medium text-white">{slide.title}</span>
                  <span className="text-xs text-zinc-500">{slide.subtitle}</span>
                </div>
                <div className="h-[calc(100%-40px)]">
                  {/* View is rendered in main area via setActiveView */}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      
      {/* Bottom navigation */}
      <div className="flex items-center justify-between px-6 py-3 bg-zinc-900/80 backdrop-blur border-t border-zinc-800">
        <button onClick={() => setCurrentSlide(c => Math.max(c - 1, 0))}
          disabled={currentSlide === 0}
          className="flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-400 hover:text-white disabled:opacity-30 transition-colors">
          <ChevronLeft size={14} /> Previous
        </button>
        
        {/* Slide dots */}
        <div className="flex items-center gap-2">
          {SLIDES.map((s, i) => (
            <button key={s.id} onClick={() => setCurrentSlide(i)}
              className={`w-2 h-2 rounded-full transition-all ${
                i === currentSlide ? 'bg-indigo-500 w-6' : 'bg-zinc-700 hover:bg-zinc-600'
              }`} />
          ))}
        </div>
        
        <button onClick={() => setCurrentSlide(c => Math.min(c + 1, SLIDES.length - 1))}
          disabled={currentSlide === SLIDES.length - 1}
          className="flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-400 hover:text-white disabled:opacity-30 transition-colors">
          Next <ChevronRight size={14} />
        </button>
      </div>
    </motion.div>
  )
}
