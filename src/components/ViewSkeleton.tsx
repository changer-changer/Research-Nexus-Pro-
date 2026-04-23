import React from 'react'

export default function ViewSkeleton() {
  return (
    <div className="h-full w-full flex flex-col animate-pulse">
      {/* Toolbar skeleton */}
      <div className="flex items-center gap-3 px-5 py-3 border-b shrink-0"
        style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}>
        <div className="w-8 h-8 rounded-lg rn-skeleton" />
        <div className="w-32 h-4 rounded rn-skeleton" />
        <div className="w-16 h-5 rounded-full rn-skeleton ml-2" />
        <div className="flex-1" />
        <div className="w-24 h-6 rounded-lg rn-skeleton" />
      </div>

      {/* Content area skeleton */}
      <div className="flex-1 p-5 overflow-hidden">
        <div className="h-full flex flex-col gap-4">
          {/* Header row */}
          <div className="flex items-center gap-4 mb-2">
            <div className="w-48 h-6 rounded rn-skeleton" />
            <div className="w-20 h-4 rounded rn-skeleton" />
            <div className="w-20 h-4 rounded rn-skeleton" />
          </div>

          {/* Main skeleton grid — mimics tree/graph views */}
          <div className="flex-1 grid grid-cols-12 gap-4">
            {/* Left sidebar area */}
            <div className="col-span-3 flex flex-col gap-3">
              <div className="h-10 rounded-lg rn-skeleton" />
              <div className="h-8 rounded-lg rn-skeleton" />
              <div className="h-8 rounded-lg rn-skeleton" />
              <div className="h-8 rounded-lg rn-skeleton" />
              <div className="flex-1 rounded-lg rn-skeleton" />
            </div>

            {/* Main canvas area */}
            <div className="col-span-9 flex flex-col gap-3">
              <div className="h-12 rounded-lg rn-skeleton" />
              <div className="flex-1 rounded-lg rn-skeleton" />
            </div>
          </div>
        </div>
      </div>

      {/* Status bar skeleton */}
      <div className="flex items-center gap-4 px-5 py-2.5 border-t shrink-0"
        style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="w-32 h-3 rounded rn-skeleton" />
        <div className="flex-1" />
        <div className="w-20 h-3 rounded rn-skeleton" />
      </div>
    </div>
  )
}
