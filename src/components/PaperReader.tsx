import { useState, useRef, useCallback, useEffect } from 'react'
import { Document, Page } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import {
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize,
  Minimize, RotateCw, FileText, Hash
} from 'lucide-react'

interface PaperReaderProps {
  pdfUrl: string
  currentPage: number
  numPages: number
  scale: number
  onPageChange: (page: number) => void
  onNumPages: (n: number) => void
  onScaleChange: (s: number) => void
  darkMode?: boolean
}

export default function PaperReader({
  pdfUrl,
  currentPage,
  numPages,
  scale,
  onPageChange,
  onNumPages,
  onScaleChange,
  darkMode,
}: PaperReaderProps) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showThumbnails, setShowThumbnails] = useState(false)
  const [rotation, setRotation] = useState(0)
  const [searchText, setSearchText] = useState('')
  const [pageInput, setPageInput] = useState(String(currentPage))
  const containerRef = useRef<HTMLDivElement>(null)
  const [pdfError, setPdfError] = useState<string | null>(null)

  useEffect(() => {
    setPageInput(String(currentPage))
  }, [currentPage])

  const onDocumentLoadSuccess = useCallback(
    ({ numPages: n }: { numPages: number }) => {
      onNumPages(n)
      setPdfError(null)
    },
    [onNumPages]
  )

  const onDocumentLoadError = useCallback((error: Error) => {
    setPdfError(error.message)
  }, [])

  const goToPage = useCallback(
    (page: number) => {
      const p = Math.max(1, Math.min(numPages || 1, page))
      onPageChange(p)
    },
    [numPages, onPageChange]
  )

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  const zoomIn = () => onScaleChange(scale + 0.2)
  const zoomOut = () => onScaleChange(scale - 0.2)
  const rotate = () => setRotation((r) => (r + 90) % 360)

  if (pdfError) {
    return (
      <div className="flex items-center justify-center h-full flex-col gap-3">
        <FileText size={48} style={{ color: 'var(--text-tertiary)' }} />
        <p style={{ color: 'var(--text-secondary)' }}>Failed to load PDF</p>
        <p className="text-xs" style={{ color: 'var(--error)' }}>{pdfError}</p>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={`flex flex-col h-full ${isFullscreen ? 'bg-black' : ''}`}
      style={{ background: darkMode ? '#0a0a0f' : '#ffffff' }}
    >
      {/* Toolbar */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b shrink-0"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div className="flex items-center gap-2">
          {/* Page nav */}
          <button
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
            className="p-1.5 rounded hover:bg-white/10 disabled:opacity-30 transition-colors"
            style={{ color: 'var(--text-secondary)' }}
          >
            <ChevronLeft size={18} />
          </button>
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const p = parseInt(pageInput, 10)
                  if (!isNaN(p)) goToPage(p)
                }
              }}
              onBlur={() => {
                const p = parseInt(pageInput, 10)
                if (!isNaN(p)) goToPage(p)
                else setPageInput(String(currentPage))
              }}
              className="w-12 text-center text-sm rounded py-1 outline-none"
              style={{
                background: 'var(--bg-hover)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-default)',
              }}
            />
            <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
              / {numPages || '?'}
            </span>
          </div>
          <button
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= (numPages || 1)}
            className="p-1.5 rounded hover:bg-white/10 disabled:opacity-30 transition-colors"
            style={{ color: 'var(--text-secondary)' }}
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Zoom + Actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={zoomOut}
            className="p-1.5 rounded hover:bg-white/10 transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            title="Zoom out"
          >
            <ZoomOut size={16} />
          </button>
          <span className="text-xs w-12 text-center tabular-nums" style={{ color: 'var(--text-tertiary)' }}>
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={zoomIn}
            className="p-1.5 rounded hover:bg-white/10 transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            title="Zoom in"
          >
            <ZoomIn size={16} />
          </button>
          <div className="w-px h-4 mx-1" style={{ background: 'var(--border-subtle)' }} />
          <button
            onClick={rotate}
            className="p-1.5 rounded hover:bg-white/10 transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            title="Rotate"
          >
            <RotateCw size={16} />
          </button>
          <button
            onClick={() => setShowThumbnails((v) => !v)}
            className={`p-1.5 rounded transition-colors ${showThumbnails ? 'bg-white/10' : 'hover:bg-white/10'}`}
            style={{ color: showThumbnails ? 'var(--accent)' : 'var(--text-secondary)' }}
            title="Thumbnails"
          >
            <Hash size={16} />
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded hover:bg-white/10 transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            title="Fullscreen"
          >
            {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
          </button>
        </div>
      </div>

      {/* Content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Thumbnail sidebar */}
        {showThumbnails && numPages > 0 && (
          <div
            className="w-32 shrink-0 overflow-y-auto border-r py-2 space-y-1"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
              <button
                key={pageNum}
                onClick={() => goToPage(pageNum)}
                className={`w-full px-2 py-1 text-center transition-colors ${
                  pageNum === currentPage ? 'bg-white/10' : 'hover:bg-white/5'
                }`}
              >
                <Page
                  pageNumber={pageNum}
                  width={100}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                  className="mx-auto"
                />
                <span
                  className="text-[10px] block mt-0.5"
                  style={{
                    color: pageNum === currentPage ? 'var(--accent)' : 'var(--text-tertiary)',
                  }}
                >
                  {pageNum}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* PDF viewer */}
        <div className="flex-1 overflow-auto flex justify-center py-4">
          <Document
            file={pdfUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={
              <div className="flex items-center justify-center h-96">
                <div className="w-8 h-8 border-2 border-accent/20 border-t-accent rounded-full animate-spin" />
              </div>
            }
          >
            <Page
              pageNumber={currentPage}
              scale={scale}
              rotate={rotation}
              renderTextLayer={true}
              renderAnnotationLayer={true}
              className="shadow-lg"
              loading={
                <div className="flex items-center justify-center h-96 w-[600px]">
                  <div className="w-8 h-8 border-2 border-accent/20 border-t-accent rounded-full animate-spin" />
                </div>
              }
            />
          </Document>
        </div>
      </div>
    </div>
  )
}
