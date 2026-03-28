'use client';

import { lazy, Suspense } from 'react';

/**
 * Lazy-loaded heavy components.
 *
 * These are loaded only when needed, reducing initial bundle size.
 * Fallback shows a skeleton placeholder during load.
 */

// Lazy load AgentChatPanel - it's a large component with OpenClaw integration
export const AgentChatPanelLazy = lazy(() =>
  import('./AgentChatPanel').then((m) => ({ default: m.AgentChatPanel }))
);

// Lazy load TaskModal - it includes PlanningTab and CaseDocuments
export const TaskModalLazy = lazy(() =>
  import('./TaskModal').then((m) => ({ default: m.TaskModal }))
);

// Lazy load PlanningTab - heavy Notion/sync logic
export const PlanningTabLazy = lazy(() =>
  import('./PlanningTab').then((m) => ({ default: m.PlanningTab }))
);

// Lazy load CaseDocuments - large file handling
export const CaseDocumentsLazy = lazy(() =>
  import('./CaseDocuments').then((m) => ({ default: m.CaseDocuments }))
);

/**
 * Skeleton fallback for lazy-loaded components.
 */
export function ComponentSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-blue-400" />
    </div>
  );
}
