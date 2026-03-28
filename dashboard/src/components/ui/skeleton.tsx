'use client';

import { cn } from '@/lib/utils';

/**
 * Base skeleton component — pulsing placeholder for loading states.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-zinc-800/50',
        className
      )}
    />
  );
}

/**
 * Agent card skeleton for agents list loading state.
 */
export function AgentCardSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 border border-zinc-800 rounded-lg">
      <Skeleton className="h-10 w-10 rounded-full shrink-0" />
      <div className="flex-1 space-y-2 min-w-0">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="h-6 w-20 rounded-full" />
    </div>
  );
}

/**
 * Task row skeleton for task list loading state.
 */
export function TaskRowSkeleton() {
  return (
    <div className="flex items-center gap-4 p-3 border-b border-zinc-800/50">
      <Skeleton className="h-5 w-5 rounded shrink-0" />
      <div className="flex-1 space-y-1.5 min-w-0">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <div className="flex gap-2 shrink-0">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-12 rounded-full" />
      </div>
    </div>
  );
}

/**
 * Stats card skeleton for dashboard stats loading.
 */
export function StatCardSkeleton() {
  return (
    <div className="p-4 border border-zinc-800 rounded-lg space-y-3">
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-8 w-16" />
      <Skeleton className="h-3 w-24" />
    </div>
  );
}

/**
 * Full agents list skeleton.
 */
export function AgentsListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {[...Array(count)].map((_, i) => (
        <AgentCardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Full tasks list skeleton.
 */
export function TasksListSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="divide-y divide-zinc-800/50">
      {[...Array(count)].map((_, i) => (
        <TaskRowSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Chat message skeleton for conversation loading.
 */
export function ChatMessageSkeleton({ isUser = false }: { isUser?: boolean }) {
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <Skeleton className={cn('h-8 w-8 rounded-full shrink-0', isUser ? '' : 'mt-1')} />
      <div className={cn('space-y-2 max-w-[70%]', isUser ? 'items-end' : 'items-start')}>
        <Skeleton className={cn('h-10 rounded-2xl', isUser ? 'w-48' : 'w-64')} />
      </div>
    </div>
  );
}

/**
 * Content block skeleton for general content loading.
 */
export function ContentSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2">
      {[...Array(lines)].map((_, i) => (
        <Skeleton key={i} className={cn('h-4', i === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  );
}
