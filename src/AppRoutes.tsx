import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import App from './App'

// Lazy load all views
const InnovationBoard = lazy(() => import('./components/InnovationBoard'))
const ProblemTree = lazy(() => import('./components/ProblemTree'))
const MethodTree = lazy(() => import('./components/MethodTree'))
const MethodArrowView = lazy(() => import('./components/MethodArrowView'))
const MethodTimelineView = lazy(() => import('./components/MethodTimelineView'))
const TimelineView = lazy(() => import('./components/TimelineView'))
const CitationView = lazy(() => import('./components/CitationView'))
const PaperTimelineView = lazy(() => import('./components/PaperTimelineView'))
const BookmarkPanel = lazy(() => import('./components/BookmarkPanel'))
const LandingPage = lazy(() => import('./components/LandingPage'))
const InsightStudio = lazy(() => import('./components/InsightStudio'))

// Lazy load paper generation pages
const InnovationFavorites = lazy(() => import('./components/InnovationFavorites'))
const PaperGenerationControlCenter = lazy(() => import('./components/PaperGenerationControlCenter'))
const MultiAgentPaperGenerator = lazy(() => import('./components/MultiAgentPaperGenerator'))
const PaperPreview = lazy(() => import('./components/PaperPreview'))
const ExperimentGuideGenerator = lazy(() => import('./components/ExperimentGuideGenerator'))
const ExperimentInput = lazy(() => import('./components/ExperimentInput'))
const PaperRepository = lazy(() => import('./components/PaperRepository'))
const PaperLibrary = lazy(() => import('./components/PaperLibrary'))
const UserWorkspace = lazy(() => import('./components/UserWorkspace'))
const GraphDataManager = lazy(() => import('./components/GraphDataManager'))
const GraphRAGChat = lazy(() => import('./components/GraphRAGChat'))

// Loading fallback component
const PageLoading = () => (
  <div className="h-screen w-screen flex items-center justify-center bg-[#020204]">
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <div className="w-12 h-12 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
        <div className="absolute inset-0 w-12 h-12 border-2 border-transparent border-t-cyan-500 rounded-full animate-spin" style={{ animationDuration: '1.5s' }} />
      </div>
      <p className="text-zinc-500 text-sm tracking-wide">Loading...</p>
    </div>
  </div>
)

export default function AppRoutes() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Routes>
        {/* Landing Page - Entry point */}
        <Route path="/" element={<LandingPage />} />

        {/* Main app layout with sidebar - all views as children */}
        <Route path="/app" element={<App />}>
          <Route index element={<Navigate to="/app/innovation-board" replace />} />
          <Route path="innovation-board" element={<InnovationBoard />} />
          <Route path="problem-tree" element={<ProblemTree />} />
          <Route path="timeline" element={<TimelineView />} />
          <Route path="method-arrows" element={<MethodArrowView />} />
          <Route path="method-tree" element={<MethodTree />} />
          <Route path="method-timeline" element={<MethodTimelineView />} />
            <Route path="insights" element={<InsightStudio />} />
          <Route path="paper-timeline" element={<PaperTimelineView />} />
          <Route path="citation" element={<CitationView />} />
          <Route path="bookmarks" element={<BookmarkPanel />} />
          <Route path="admin" element={<GraphDataManager />} />
        </Route>

        {/* Paper generation system routes */}
        <Route path="/favorites" element={<InnovationFavorites />} />
        <Route path="/paper-generation/:innovationId" element={<PaperGenerationControlCenter />} />
        <Route path="/multi-agent-generate/:innovationId" element={<MultiAgentPaperGenerator />} />
        <Route path="/experiment-guide/:experimentId" element={<ExperimentGuideGenerator />} />
        <Route path="/paper-preview/:taskId" element={<PaperPreview />} />
        <Route path="/paper-repository" element={<Navigate to="/generated-content" replace />} />
        <Route path="/generated-content" element={<PaperRepository />} />
        <Route path="/experiments/:taskId" element={<ExperimentInput />} />
        <Route path="/user-workspace" element={<UserWorkspace />} />
        <Route path="/paper-library" element={<PaperLibrary />} />
        <Route path="/graphrag" element={<GraphRAGChat />} />

        {/* Catch all - redirect to landing */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
